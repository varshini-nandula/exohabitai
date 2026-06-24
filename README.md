# 🌌 ExoHabitAI

**AI-powered exoplanet habitability prediction platform** — a production-oriented MLOps system combining scikit-learn pipelines, a Flask REST API, JWT authentication, a planet submission and moderation workflow, and a full React frontend for classifying whether exoplanets can support life.

---

## Table of Contents

1. [Introduction](#introduction)
2. [How It Works](#how-it-works)
   - [Data & Feature Engineering](#data--feature-engineering)
   - [The ML Pipeline](#the-ml-pipeline)
   - [The Backend API](#the-backend-api)
   - [The React Frontend](#the-react-frontend)
   - [MLOps: Continuous Retraining](#mlops-continuous-retraining)
3. [Evaluation Metrics](#evaluation-metrics)
4. [Project Architecture](#project-architecture)
5. [API Reference](#api-reference)
6. [Authentication & RBAC](#authentication--rbac)
7. [Planet Submission & Moderation Workflow](#planet-submission--moderation-workflow)
8. [Setup & Installation](#setup--installation)
9. [Environment Variables](#environment-variables)
10. [Testing](#testing)
11. [Tech Stack](#tech-stack)

---

## Introduction

ExoHabitAI is an end-to-end machine learning platform that predicts the **habitability of exoplanets** — worlds orbiting stars beyond our solar system. It answers a fundamental question in astrobiology: *could this planet support life?*

The system ingests raw planetary and stellar measurements (radius, mass, orbital period, star temperature, etc.) and outputs a **habitability probability score** (0–1), along with a binary classification: habitable (1) or non-habitable (0).

### What Makes It Production-Oriented?

| Feature | Description |
|---|---|
| **Unified sklearn Pipeline** | All preprocessing, class balancing (SMOTE), and classification in a single serialised `.pkl` artifact — zero train/serve skew |
| **Leakage-Free Training** | ESI, habitable zone boundaries, and other derived scores are explicitly excluded from features to prevent data leakage |
| **Asynchronous Retraining** | Admins can trigger model retraining in a background thread without blocking the API |
| **Performance Gating** | A new model is only deployed if its F1 score does not drop below a configurable tolerance compared to the current model |
| **Full Audit Trail** | Every retraining run (success, rejected, failed) is logged to a `RetrainingLog` database table |
| **JWT + RBAC** | Stateless authentication with role-based access control separates public predictions from authenticated submissions and admin governance |
| **Planet Moderation Workflow** | User-submitted planets start as `pending` and are invisible in rankings until an admin approves them |
| **Stale Prediction Detection** | Model version hashes (MD5) are stored per-prediction; mismatches trigger warnings and can be recomputed on demand |

---

## How It Works

### Data & Feature Engineering

**Dataset:** A comprehensive catalogue of exoplanets and their host stars, sourced from the Planetary Habitability Laboratory (PHL) Exoplanet Catalog.

**Target Variable:** `P_HABITABLE_BINARY`
- Derived from the original `P_HABITABLE` column (ordinal scale).
- Planets with `P_HABITABLE ∈ {1, 2}` → **habitable (1)**
- All others → **non-habitable (0)**
- This is a **heavily imbalanced** classification problem (< 2% positive class).

**Column Cleaning Strategy:**

| Category | Columns Dropped | Reason |
|---|---|---|
| Error bounds | `*_ERROR_MIN`, `*_ERROR_MAX`, `*_LIMIT` | Measurement uncertainties, not physical features |
| Discovery metadata | `S_NAME`, `P_DETECTION`, `P_YEAR`, `S_RA`, `S_DEC`, constellations | Identifiers, not predictive |
| **Leakage columns** | `P_ESI`, `P_HABZONE_*`, `S_HZ_*`, `S_ABIO_ZONE`, `P_DISTANCE_EFF`, `P_TYPE_TEMP` | These directly encode or determine habitability — using them would be cheating |
| Redundant bounds | `P_TEMP_EQUIL_MIN/MAX`, `P_FLUX_MIN/MAX`, etc. | Already captured in median columns |

**Engineered Feature:** `Derived_S_TYPE`
The raw `S_TYPE` column is dropped and replaced with a clean spectral classification derived from `S_TEMPERATURE`:

```
> 30,000 K → O-Type   | > 10,000 K → B-Type  | > 7,500 K → A-Type
> 6,000 K  → F-Type   | > 5,000 K  → G-Type  | > 3,500 K → K-Type
> 2,500 K  → M-Type   | > 1,500 K  → L-Type  | > 800 K   → T-Type
≤ 800 K    → Y-Type
```

This ensures **train/serve parity**: the same derivation logic runs identically in the training script, the backend API, and the retraining pipeline.

---

### The ML Pipeline

The core of ExoHabitAI is a **unified `ImbPipeline`** that encapsulates every transformation step:

```
Raw Input DataFrame
        │
        ▼
┌───────────────────────────────────────────────────────┐
│  ColumnTransformer                                    │
│  ┌──────────────────────────┐  ┌────────────────────┐ │
│  │  Numerical Branch        │  │  Categorical Branch │ │
│  │  1. MedianImputer        │  │  1. ModeImputer     │ │
│  │  2. QuantileClipper      │  │  2. OneHotEncoder   │ │
│  │     (5th–95th pctile)    │  │     (unknown→ignore)│ │
│  │  3. StandardScaler       │  └────────────────────┘ │
│  │  4. VarianceThreshold    │                         │
│  └──────────────────────────┘                         │
└───────────────────────────────────────────────────────┘
        │
        ▼
   SMOTE (sampling_strategy=0.3, k_neighbors=5)
   [Oversamples minority class to address imbalance]
        │
        ▼
   RandomForestClassifier
   (n_estimators=400, max_depth=8, min_samples_leaf=10)
        │
        ▼
   Habitability Probability + Binary Label
```

**Key Design Decisions:**

- **`QuantileClipper`** — A custom sklearn-compatible transformer (in `custom_transformers.py`) that clips each numerical feature to its [5th, 95th] percentile range. Binary/near-constant columns are automatically skipped. This robustly handles extreme outliers without losing information.
- **`SMOTE`** — Synthetic Minority Oversampling Technique upsamples the rare habitable class during training only. It is part of the pipeline so it never leaks into validation or test data.
- **`VarianceThreshold`** — Removes near-zero-variance features that contribute noise rather than signal.
- **Configurable threshold** — The binary classification cutoff is set via the `THRESHOLD` environment variable (default: `0.5`), allowing precision/recall trade-offs without retraining.

**Serialisation:** The entire fitted pipeline is saved as `backend/artifacts/habitability_pipeline.pkl` using `joblib`. An MD5 hash of this file serves as the **model version identifier** for stale-prediction tracking.

---

### The Backend API

The backend is a **Flask REST API** (`backend/app.py`) that serves the trained pipeline as a microservice.

**Core Prediction Workflow:**

```
HTTP POST /predict
     │
     ├─ Rate-limit check (per-IP cooldown)
     ├─ JSON validation
     ├─ Physical validity checks (e.g., radius > 0, eccentricity ≤ 1)
     ├─ Categorical value validation (P_TYPE must be a known planet class)
     ├─ Soft range warnings (unusual but valid values flagged, not rejected)
     ├─ Derived_S_TYPE computation from S_TEMPERATURE
     ├─ Auto-derivation of computable features (P_GRAVITY, P_ESCAPE, P_FLUX, P_TEMP_EQUIL)
     ├─ Build DataFrame (missing columns filled with NaN → imputed internally)
     └─ pipeline.predict_proba() → probability + binary label
```

**Key Backend Features:**

- **Missing values allowed:** The pipeline's internal imputer handles `NaN` values — clients do not need to provide every field. An imputation strategy (`median`, `earth`, `non_habitable`, `zeros`) can be specified per request.
- **Batch prediction:** Send a JSON array of planets; all are processed in a single pipeline call.
- **Consistent envelope:** Every response follows `{ "status", "message", "data" }`.
- **Model versioning:** Every stored prediction records the model hash. Stale predictions (version mismatch after retraining) are detected at startup and can be recomputed via `/recompute`.
- **User ownership:** When called with a valid JWT, `/predict_and_store` links the stored planet to `created_by_user_id` for history tracking.

---

### The React Frontend

The frontend (`frontend-react/`) is a full **React 19 single-page application** built with Vite and TailwindCSS v4, featuring a dark space-themed design with glassmorphism UI, micro-animations, and a complete user workflow.

#### Pages

| Page | Route | Auth Required | Description |
|---|---|:---:|---|
| **Home** | `/` | ❌ | Hero, pipeline overview, live top-5 rankings preview, model trust metrics |
| **Predict** | `/predict` | ❌ | 19-field prediction form with presets, imputation modal, habitability gauge |
| **Rankings** | `/rankings` | ❌ | Live leaderboard with Top 10/20/30/50/all filter, search, sort, bar chart |
| **About** | `/about` | ❌ | Live system telemetry, model stats, platform capability flip-cards |
| **Login** | `/login` | ❌ | JWT auth with redirect-after-login |
| **Register** | `/register` | ❌ | Account creation with auto-login on success |
| **Add Planet** | `/add-planet` | ✅ | Authenticated planet submission form wired to `/predict_and_store` |
| **History** | `/history` | ✅ | User's own submissions with approved/pending/rejected status badges |
| **Profile** | `/profile` | ✅ | User account details from auth context |

#### Key Frontend Features

- **PredictPage** — 19-field form with 7 quick presets (Earth-like, Super-Earth, Gas Giant, Lava World, Kepler-442b, TRAPPIST-1e, Proxima Centauri b), per-field inline validation with range hints and tooltips, an `ImputationModal` for selecting how missing values are filled, and a live `HabitabilityGauge` result card
- **RankingsPage** — Recharts bar chart for top 10 candidates, Top-N dropdown (10/20/30/50/all), name search, probability sort, and 20-items/page pagination
- **AuthContext** — Global JWT state: stored in `localStorage`, validated on mount via `/auth/me`, auto-logout timer driven by the JWT `exp` claim, and an `auth:expired` event bridge from the Axios interceptor
- **ProtectedRoute** — `<Outlet>` pattern with loading state and redirect-with-return-path (`/login?redirect=...`)
- **Axios client** — Request interceptor attaches `Bearer <token>`; response interceptor handles 401s (`token_expired` / `invalid_token`) by clearing storage and firing `auth:expired`
- **Error states** — `ErrorState` component with variants for `generic`, `offline`, `rate-limit`, and `validation` errors
- **Vite proxy** — `/api` rewrites to `http://127.0.0.1:5000` in development, so no CORS configuration is needed locally

---

### MLOps-Inspired Retraining Workflow

ExoHabitAI implements an **MLOps-inspired retraining loop**:

```
Admin POST /trigger_retraining
          │
          ├─ Lock acquired (prevents concurrent retraining)
          ├─ Background thread launched (API returns immediately)
          │
          └─ retrain_pipeline.py::retrain()
               │
               ├─ 1. Load planetsdata.csv + apply same cleaning
               ├─ 2. Extract user-generated planets from DB (raw_input_json)
               ├─ 3. Merge datasets (user data takes priority on duplicates)
               ├─ 4. Train/test split (stratified, 80/20)
               ├─ 5. Build + fit new ImbPipeline
               ├─ 6. Evaluate new model on held-out test set
               │
               ├─ PERFORMANCE GATE:
               │    new_f1 < (old_f1 - RETRAIN_F1_TOLERANCE)?
               │    YES → Restore backup .pkl, log "rejected", keep old model
               │    NO  → Save new .pkl, hot-reload into memory, log "success"
               │
               └─ RetrainingLog entry created (always — success, rejected, or failed)
```

This means the system **learns from submitted planets** — every approved planet added via the API can become a training example in the next retraining cycle.

---

## Evaluation Metrics

ExoHabitAI evaluates model performance using metrics specifically chosen for **highly imbalanced binary classification**, where habitable planets represent only ~1.24% of the dataset. Accuracy alone is misleading, so the project prioritises **F1 Score**, **ROC-AUC**, and **PR-AUC** for model evaluation and model selection.

### Primary Metrics

| Metric | Why It Matters |
|---|---|
| **Accuracy** | Overall correctness; used mainly as a baseline sanity check |
| **Precision** | Measures how many predicted-habitable planets are actually habitable |
| **Recall** | Measures how many truly habitable planets are successfully detected |
| **F1 Score** | Harmonic mean of precision and recall; primary deployment metric |
| **ROC-AUC** | Measures ranking quality across thresholds |
| **PR-AUC** | Most informative metric for highly imbalanced datasets |

---

## Final Selected Model — Random Forest (Full Cleaned)

After evaluating multiple classifiers and feature sets, the final deployed model is a **Random Forest classifier trained on the fully cleaned feature set** after leakage removal, preprocessing, feature engineering, and SMOTE balancing.

### Test Set Performance

| Metric | Score |
|---|---|
| **Test Accuracy** | **0.9982** |
| **Precision** | **0.8750** |
| **Recall** | **1.0000** |
| **F1 Score** | **0.9333** |
| **ROC-AUC** | **0.9999** |
| **PR-AUC** | **0.9911** |

The model achieved extremely strong recall while maintaining high precision, making it effective at identifying potentially habitable planets without producing excessive false positives.

---

## Overfitting & Generalisation Checks

Train-test performance gaps are monitored to detect potential overfitting or underfitting.

| Metric | Train | Test | Gap |
|---|---|---|---|
| Accuracy | 0.9984 | 0.9982 | +0.0002 |
| F1 Score | 0.9402 | 0.9333 | +0.0068 |
| ROC-AUC | 1.0000 | 0.9999 | +0.0001 |

The extremely small train-test gaps indicate stable generalisation without severe overfitting.

---

## 5-Fold Stratified Cross-Validation

A **5-fold Stratified K-Fold** cross-validation was performed to ensure stable evaluation while preserving the original class imbalance ratio in every fold.

| Metric | Cross-Validation Score |
|---|---|
| **CV Accuracy** | **0.9971 ± 0.0011** |
| **CV F1 Score** | **0.8837 ± 0.0452** |
| **CV ROC-AUC** | **0.9995 ± 0.0006** |

The low standard deviation across folds indicates consistent model behaviour and stable generalisation performance.

---

## Leakage Prevention & Validation

The training pipeline includes multiple safeguards against data leakage and train/serve skew:

- Leakage-prone features such as `P_ESI`, habitable zone indicators, and target-proxy features are removed before training
- Train/test splitting is performed **before preprocessing**
- SMOTE is applied only inside training pipelines
- Categorical encoding uses `handle_unknown="ignore"` for inference robustness
- Correlation-based leakage analysis is performed before model selection
- Feature importance analysis verifies that no single feature dominates predictions

The highest feature importance in the final Random Forest model is approximately **21.9%**, indicating well-distributed feature contributions without obvious leakage dominance.

### Retraining Gating

The **F1 tolerance gate** (`RETRAIN_F1_TOLERANCE`, default `0.02`) ensures no model regression sneaks into production:

```python
if new_f1 < (old_f1 - tolerance):
    # Reject new model, restore backup
```

The `RetrainingLog` table persists `accuracy`, `f1_score`, `roc_auc`, and `pr_auc` for every retraining attempt, enabling longitudinal model performance tracking.

---

## Project Architecture

```
ExoHabitAI/
├── planetsdata.csv               # Raw exoplanet dataset (PHL catalogue) — gitignored
├── train_unified_pipeline.py     # Standalone training script → saves .pkl
├── custom_transformers.py        # QuantileClipper (sklearn-compatible)
├── exoplanets.ipynb              # Exploratory Data Analysis notebook
│
├── backend/
│   ├── app.py                    # Flask API — prediction, rankings, stats, retraining
│   ├── retrain_pipeline.py       # Retraining script (merges DB + CSV data)
│   ├── config.py                 # Centralised configuration (env-driven)
│   ├── extensions.py             # SQLAlchemy + JWT extension instances
│   ├── database.py               # DB seeding script (loads ranked CSV → exoplanets table)
│   ├── cli.py                    # Flask CLI commands (create-admin, bootstrap-admin)
│   ├── migrate_db.py             # Database schema migration script
│   ├── recompute_predictions.py  # Standalone stale-prediction recomputer
│   ├── export_training_data.py   # Export DB data for offline analysis
│   ├── generate_ranked_dataset.py # Generate ranked output CSV for seeding
│   ├── requirements.txt          # Python dependencies
│   ├── .env                      # Environment variables (gitignored)
│   │
│   ├── auth/                     # JWT authentication module
│   │   ├── __init__.py
│   │   ├── routes.py             # Blueprint: /auth/register, /login, /me, /logout
│   │   ├── services.py           # Business logic: register_user, authenticate_user
│   │   ├── decorators.py         # @admin_required, get_current_user helpers
│   │   └── utils.py              # JWT callbacks: identity, claims, error handlers
│   │
│   ├── models/                   # SQLAlchemy ORM models
│   │   ├── __init__.py           # Model exports
│   │   ├── user.py               # User model — Werkzeug hashing, UserRole constants
│   │   ├── exoplanet.py          # Exoplanet model — PlanetStatus, ownership, versioning
│   │   └── retraining_log.py     # Audit log model for retraining events
│   │
│   ├── artifacts/
│   │   └── habitability_pipeline.pkl   # Serialised trained pipeline (gitignored)
│   │
│   └── tests/                    # Pytest test suite (12 files)
│       ├── conftest.py           # Fixtures, helpers, in-memory SQLite isolation
│       ├── test_auth.py          # Registration, login, JWT, profile, logout
│       ├── test_prediction.py    # /predict, /predict_and_store, /my_planets
│       ├── test_validation.py    # Physical constraints, categorical, soft warnings
│       ├── test_ml_sanity.py     # ML behavioural sanity checks
│       ├── test_batch_prediction.py  # Bulk predict and store
│       ├── test_retraining.py    # Trigger, status polling, audit logs
│       ├── test_admin_protection.py  # RBAC — non-admins blocked from admin endpoints
│       ├── test_health.py        # /health, /stats, root endpoint
│       ├── test_rankings.py      # /rank — limit filtering, approved-only
│       ├── test_database.py      # Model relationships, status tracking
│       └── test_moderation.py    # Submission ownership, status visibility workflow
│
└── frontend-react/               # React 19 SPA (Vite + TailwindCSS v4)
    ├── package.json
    ├── vite.config.js            # Vite config + /api proxy to backend
    ├── index.html
    └── src/
        ├── main.jsx              # Entry: BrowserRouter → AuthProvider → App
        ├── App.jsx               # MainLayout + AppRoutes
        ├── index.css             # Global design tokens, TailwindCSS utilities
        │
        ├── routes/
        │   └── AppRoutes.jsx     # All routes + ProtectedRoute nesting
        │
        ├── auth/
        │   └── ProtectedRoute.jsx  # Auth guard with loading state + redirect
        │
        ├── context/
        │   └── AuthContext.jsx   # JWT state, auto-logout, auth:expired event
        │
        ├── hooks/
        │   └── useAuth.js        # Thin hook consuming AuthContext
        │
        ├── api/
        │   ├── client.js         # Axios instance, interceptors, extractError()
        │   ├── auth.js           # authAPI: login, register, logout, getProfile
        │   ├── prediction.js     # predictionAPI: predict, predictAndStore
        │   ├── rankings.js       # rankingsAPI: getRankings
        │   ├── planets.js        # planetsAPI: getMySubmissions
        │   └── stats.js          # statsAPI: getStats, getHealth, getRetrainingStatus
        │
        ├── layouts/
        │   └── MainLayout.jsx    # Sticky header, mobile sidebar, footer, Starfield
        │
        ├── pages/
        │   ├── HomePage.jsx      # Hero, pipeline cards, live rankings preview
        │   ├── PredictPage.jsx   # 19-field form, presets, imputation, gauge
        │   ├── RankingsPage.jsx  # Top-N filter, search, sort, chart, pagination
        │   ├── AboutPage.jsx     # Live telemetry, model stats, flip-cards
        │   ├── LoginPage.jsx     # JWT login with redirect-after-login
        │   ├── RegisterPage.jsx  # Registration with auto-login
        │   ├── AddPlanetPage.jsx # Authenticated planet submission
        │   ├── HistoryPage.jsx   # User's submissions + status badges
        │   └── ProfilePage.jsx   # User account info
        │
        └── components/
            ├── GlassCard.jsx     # Glassmorphism card with glow/hover/animate props
            ├── HabitabilityGauge.jsx  # SVG arc gauge for probability display
            ├── ImputationModal.jsx    # Strategy selector for missing fields
            ├── ErrorState.jsx         # Multi-variant error display
            ├── EmptyState.jsx         # Empty list placeholder with action
            ├── LoadingSpinner.jsx     # Animated spinner with message
            ├── Tooltip.jsx            # Field description tooltip
            ├── StatCard.jsx           # Animated metric card
            ├── FlipCard.jsx           # CSS 3D flip card
            ├── PageTransition.jsx     # Framer Motion page wrapper
            └── Starfield.jsx          # Canvas-based animated star background
```

---

## API Reference

### Public Endpoints (No Authentication Required)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Root health check — confirms backend is live |
| `GET` | `/health` | Detailed health check (model loaded, DB connected, retraining state) |
| `GET` | `/stats` | Aggregate DB statistics (total planets, habitable count, user-generated) |
| `GET` | `/retraining_status` | Poll background retraining progress (read-only) |
| `GET` | `/pipeline_info` | Pipeline feature metadata (expected columns, version) |
| `POST` | `/predict` | Predict habitability for one or more planets (no DB write) |
| `GET` | `/rank` | Approved planets ranked by habitability probability |

### Authenticated User Endpoints (JWT Required)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/predict_and_store` | Predict + persist planet to DB (linked to current user, status `pending`) |
| `POST` | `/predict_and_store_batch` | Optimised bulk predict + single-commit batch insert |
| `GET` | `/my_planets` | Current user's own submitted planets with moderation status |

### Auth Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | None | Create a user account |
| `POST` | `/auth/login` | None | Authenticate and receive a JWT |
| `GET` | `/auth/me` | Bearer JWT | Token validation + current user profile |
| `POST` | `/auth/logout` | Bearer JWT | Logout (client-side token invalidation, server-side logging) |

### Admin-Only Endpoints (JWT Required, `admin` Role)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/trigger_retraining` | Trigger async model retraining |
| `GET` | `/retraining_logs` | Full audit trail of past retraining runs |
| `POST` | `/recompute` | Recompute all stale predictions (model version mismatch) |

### Prediction Request Format

```json
{
  "planet_name": "Kepler-442b",
  "P_RADIUS": 1.34,
  "P_MASS": 2.36,
  "P_DENSITY": 7.0,
  "P_TEMP_SURF": 233,
  "P_PERIOD": 112.3,
  "P_SEMI_MAJOR_AXIS": 0.409,
  "P_ECCENTRICITY": 0.04,
  "P_INCLINATION": 89.9,
  "S_TEMPERATURE": 4402,
  "S_LUMINOSITY": 0.12,
  "S_METALLICITY": -0.37,
  "S_MAG": 14.96,
  "S_DISTANCE": 374.0,
  "S_MASS": 0.61,
  "S_RADIUS": 0.60,
  "S_AGE": 2.9,
  "S_LOG_G": 4.67,
  "P_HILL_SPHERE": 0.015,
  "imputation_strategy": "median"
}
```

**All fields except `planet_name` are optional** — the pipeline imputes missing values using the selected strategy. Supported strategies: `median` (default), `earth` (Earth-like defaults), `non_habitable` (dataset averages), `zeros`.

### Prediction Response Format

```json
{
  "status": "success",
  "message": "Prediction generated successfully",
  "data": {
    "planet_name": "Kepler-442b",
    "habitability": 1,
    "habitability_probability": 0.8723,
    "threshold_used": 0.5,
    "warnings": [],
    "fill_info": {
      "strategy_used": "median",
      "auto_derived": ["P_GRAVITY", "P_ESCAPE", "P_FLUX", "P_TEMP_EQUIL"]
    },
    "stored": true
  }
}
```

---

## Authentication & RBAC

The backend uses **JWT (JSON Web Tokens)** for stateless authentication and **role-based access control (RBAC)** to protect governance endpoints.

### Token Contents

Tokens are signed with `JWT_SECRET_KEY` and contain the following claims:

```json
{
  "sub": "1",
  "role": "user",
  "username": "researcher_jane",
  "email": "jane@example.com",
  "exp": 1715100000,
  "iat": 1715096400
}
```

Role-based checks use the `role` claim directly from the token — no database query needed. Token lifetime defaults to **1 hour** (`JWT_ACCESS_TOKEN_HOURS`).

### Error Responses

All JWT failures return consistent JSON with an `error_code`:

| Scenario | HTTP Status | `error_code` |
|---|---|---|
| Expired token | 401 | `token_expired` |
| Malformed token | 401 | `invalid_token` |
| Missing token | 401 | `missing_token` |
| Non-admin on admin route | 403 | `admin_required` |

The frontend Axios interceptor listens for `token_expired` and `invalid_token` codes, clears localStorage, and redirects to `/login` automatically.

### Usage Example

```bash
# 1. Register
curl -X POST http://localhost:5000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"researcher","email":"r@example.com","password":"SecurePass123!"}'

# 2. Login → receive access_token
curl -X POST http://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"researcher","password":"SecurePass123!"}'

# 3. Submit a planet (authenticated)
curl -X POST http://localhost:5000/predict_and_store \
  -H "Authorization: Bearer <your_access_token>" \
  -H "Content-Type: application/json" \
  -d '{"planet_name":"My-Candidate","P_RADIUS":1.2,"S_TEMPERATURE":5000}'

# 4. View your submission history
curl http://localhost:5000/my_planets \
  -H "Authorization: Bearer <your_access_token>"
```

---

## Planet Submission & Moderation Workflow

User-submitted planets go through a moderation pipeline before appearing in public rankings:

```
User submits via POST /predict_and_store
        │
        ├─ JWT verified → user_id extracted
        ├─ Prediction runs (ML pipeline)
        ├─ Planet stored with:
        │    created_by_user_id = user_id
        │    is_user_generated  = True
        │    status             = "pending"   ← hidden from rankings
        │
        └─ GET /my_planets shows it with status "pending"
                │
                └─ [Admin reviews — future admin dashboard]
                        │
                        ├─ Approve → status = "approved"  → appears in GET /rank
                        └─ Reject  → status = "rejected"  → stays hidden, audit preserved
```

**Key behaviour:**
- `GET /rank` filters strictly to `status = "approved"` — pending and rejected submissions are invisible to all public users
- Seeded dataset planets (inserted via `database.py`) are inserted directly as `status = "approved"`
- The `created_by_user_id` foreign key links every planet to its submitter for ownership tracking and abuse prevention
- Rejected planets are kept in the database for audit purposes (not deleted)

---

## Setup & Installation

### Prerequisites

- Python 3.10+
- Node.js 18+ and npm
- pip

### 1. Clone the Repository

```bash
git clone <repository-url>
cd ExoHabitAI
```

### 2. Backend Setup

```bash
# Create and activate a virtual environment
python -m venv .venv

# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Install Python dependencies
pip install -r backend/requirements.txt
```

### 3. Configure Environment Variables

```bash
# Copy the example env file and fill in your values
cp backend/.env.example backend/.env
```

See [Environment Variables](#environment-variables) for the full variable reference.

### 4. Train the Model

Run this once to generate the serialised pipeline artifact:

```bash
python train_unified_pipeline.py
```

The trained pipeline is saved to `backend/artifacts/habitability_pipeline.pkl`.

### 5. Initialise the Database

```bash
cd backend

# Create all tables
python migrate_db.py

# Seed the database with ranked exoplanet data
python database.py

# Create the first admin user (interactive)
flask create-admin
# OR bootstrap from environment variables:
flask bootstrap-admin
```

### 6. Start the Backend

```bash
cd backend
python app.py
```

The API is now available at `http://localhost:5000`.

### 7. Start the React Frontend

```bash
cd frontend-react
npm install
npm run dev
```

The frontend is now available at `http://localhost:5173`. The Vite dev server proxies all `/api` requests to the Flask backend — no CORS configuration needed.

---

## Environment Variables

All configuration is loaded from `backend/.env`. Key variables:

| Variable | Default | Description |
|---|---|---|
| `SECRET_KEY` | `dev-secret-key-change-in-prod` | Flask session secret — **change in production** |
| `JWT_SECRET_KEY` | `jwt-dev-secret-change-in-prod` | JWT signing key — **change in production** |
| `JWT_ACCESS_TOKEN_HOURS` | `1` | Token lifetime in hours |
| `DATABASE_URL` | `sqlite:///exoplanets.db` | SQLAlchemy database URI |
| `MODEL_PATH` | `artifacts/habitability_pipeline.pkl` | Path to the trained pipeline artifact |
| `THRESHOLD` | `0.5` | Habitability classification cutoff |
| `RETRAIN_F1_TOLERANCE` | `0.02` | Max allowed F1 regression before rejecting new model |
| `RATE_LIMIT_SECONDS` | `1.0` | Minimum seconds between predictions per IP |
| `CORS_ORIGINS` | `*` | Allowed frontend origins (set to your domain in production) |
| `DEBUG` | `false` | Flask debug mode |
| `ADMIN_USERNAME` | — | Bootstrap admin username (for `flask bootstrap-admin`) |
| `ADMIN_EMAIL` | — | Bootstrap admin email |
| `ADMIN_PASSWORD` | — | Bootstrap admin password |

> **Security note:** `SECRET_KEY` and `JWT_SECRET_KEY` must be set to strong random values in any non-development environment. The defaults are intentionally insecure to make misconfiguration obvious.

For the **React frontend**, create `frontend-react/.env.local` if deploying to production:

| Variable | Example | Description |
|---|---|---|
| `VITE_API_URL` | `https://api.exohabitai.example.com` | Backend API base URL (omit in local dev — Vite proxy handles it) |

---

## Testing

### Backend Tests

```bash
cd backend

# Run all tests
python -m pytest tests/ -v

# Run with short traceback (faster output)
python -m pytest tests/ --tb=short -q

# Run a specific test file
python -m pytest tests/test_auth.py -v
python -m pytest tests/test_prediction.py -v
python -m pytest tests/test_moderation.py -v

# Run with coverage report
python -m pytest tests/ --cov=. --cov-report=term-missing
```

The test suite covers:

| File | Coverage Area |
|---|---|
| `test_auth.py` | Registration, login, JWT claims, profile, logout, deactivation, duplicate detection |
| `test_prediction.py` | `/predict`, `/predict_and_store`, `/my_planets`, auth required, ownership tracking |
| `test_rankings.py` | `/rank` — limit filtering, approved-only visibility, empty state |
| `test_database.py` | Model relationships, status tracking, planet creation |
| `test_health.py` | `/health`, `/stats`, root endpoint |
| `test_validation.py` | Physical constraints, categorical validation, soft warnings |
| `test_admin_protection.py` | RBAC — non-admins blocked from admin endpoints (403) |
| `test_ml_sanity.py` | ML behavioural sanity: Earth-like scores higher than gas giant, relative ordering |
| `test_batch_prediction.py` | Bulk predict and store, consistency checks |
| `test_moderation.py` | Submission ownership, pending-only visibility, status transitions |
| `test_retraining.py` | Trigger, status polling, concurrency locking, audit log entries |
| `conftest.py` | Shared fixtures, in-memory SQLite isolation, test helpers |

### Frontend

The React frontend does not currently have a unit or E2E test suite. Manual testing is performed against the running development server.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **ML / Data** | scikit-learn, imbalanced-learn, pandas, numpy, joblib |
| **Backend** | Flask, Flask-SQLAlchemy, Flask-JWT-Extended, Flask-CORS |
| **Database** | SQLite (development) / any SQLAlchemy-compatible DB |
| **Authentication** | JWT (flask-jwt-extended), bcrypt via Werkzeug |
| **Frontend** | React 19, Vite 8, TailwindCSS v4, React Router v7 |
| **Frontend Libraries** | Axios, Recharts, Framer Motion |
| **Testing** | pytest, pytest-cov |
| **Python** | 3.10+ |
| **Node.js** | 18+ |

---

*ExoHabitAI — Finding life among the stars, one probability at a time.*
