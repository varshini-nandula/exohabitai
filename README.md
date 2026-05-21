# 🌌 ExoHabitAI

**AI-powered exoplanet habitability prediction platform** — a production-oriented MLOps system combining scikit-learn pipelines, a Flask REST API, JWT authentication, and an interactive frontend for classifying whether exoplanets can support life.

---

## Table of Contents

1. [Introduction](#introduction)
2. [How It Works](#how-it-works)
   - [Data & Feature Engineering](#data--feature-engineering)
   - [The ML Pipeline](#the-ml-pipeline)
   - [The Backend API](#the-backend-api)
   - [The Frontend](#the-frontend)
   - [MLOps: Continuous Retraining](#mlops-continuous-retraining)
3. [Evaluation Metrics](#evaluation-metrics)
4. [Project Architecture](#project-architecture)
5. [API Reference](#api-reference)
6. [Authentication & RBAC](#authentication--rbac)
7. [Setup & Installation](#setup--installation)
8. [Environment Variables](#environment-variables)
9. [Testing](#testing)
10. [Tech Stack](#tech-stack)

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
| **JWT + RBAC** | Stateless authentication with role-based access control separates public predictions from admin governance |
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

**Core Workflow:**

```
HTTP POST /predict
     │
     ├─ Rate-limit check (per-IP cooldown)
     ├─ JSON validation
     ├─ Physical validity checks (e.g., radius > 0, eccentricity ≤ 1)
     ├─ Categorical value validation (P_TYPE must be a known planet class)
     ├─ Soft range warnings (unusual but valid values flagged, not rejected)
     ├─ Derived_S_TYPE computation from S_TEMPERATURE
     ├─ Build DataFrame (missing columns filled with NaN → imputed internally)
     └─ pipeline.predict_proba() → probability + binary label
```

**Key Backend Features:**

- **Missing values allowed:** The pipeline's internal imputer handles `NaN` values — clients do not need to provide every field.
- **Batch prediction:** Send a JSON array of planets; all are processed in a single pipeline call.
- **Consistent envelope:** Every response follows `{ "status", "message", "data" }`.
- **Model versioning:** Every stored prediction records the model hash. Stale predictions (version mismatch after retraining) are detected at startup and can be recomputed via `/recompute`.

---

### The Frontend

The frontend (`frontend/`) is a lightweight, multi-page HTML/CSS/JS interface:

| Page | File | Purpose |
|---|---|---|
| Home | `index.html` | Landing page and navigation hub |
| Predict | `predict.html` | Single-planet prediction form with live results |
| Add Planet | `add_planet.html` | Submit a planet to the database without prediction |
| Rankings | `rankings.html` | Leaderboard of planets ranked by habitability probability |

The frontend calls the Flask backend API directly and renders results dynamically. No build tooling required.

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

This means the system **learns from submitted planets** — every planet added via the API can become a training example in the next retraining cycle.

---

## Evaluation Metrics

ExoHabitAI evaluates model performance using metrics specifically chosen for **highly imbalanced binary classification**, where habitable planets represent only ~1.24% of the dataset. In this setting, accuracy alone is misleading, so the project prioritises **F1 Score**, **ROC-AUC**, and **PR-AUC** for model evaluation and model selection.

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

The **F1 tolerance gate** (`RETRAIN_F1_TOLERANCE`, default in `Config`) ensures no model regression sneaks into production:

```python
if new_f1 < (old_f1 - tolerance):
    # Reject new model, restore backup
```

The `RetrainingLog` table persists `accuracy`, `f1_score`, `roc_auc`, and `pr_auc` for every retraining attempt, enabling longitudinal model performance tracking.

---

## Project Architecture

```
ExoHabitAI/
├── planetsdata.csv               # Raw exoplanet dataset (PHL catalogue)
├── train_unified_pipeline.py     # Standalone training script → saves .pkl
├── custom_transformers.py        # QuantileClipper (sklearn-compatible)
├── exoplanets.ipynb              # Exploratory Data Analysis notebook
│
├── backend/
│   ├── app.py                    # Flask API (1500+ lines, production-ready)
│   ├── retrain_pipeline.py       # Retraining script (merges DB + CSV data)
│   ├── config.py                 # Centralised configuration (env-driven)
│   ├── extensions.py             # SQLAlchemy + JWT extension instances
│   ├── database.py               # DB initialisation helpers
│   ├── cli.py                    # Flask CLI commands (create-admin, bootstrap-admin)
│   ├── migrate_db.py             # Database schema migration script
│   ├── recompute_predictions.py  # Standalone stale-prediction recomputer
│   ├── export_training_data.py   # Export DB data for offline analysis
│   ├── generate_ranked_dataset.py # Generate ranked output CSV
│   ├── requirements.txt          # Python dependencies
│   ├── .env.example              # Environment variable template
│   │
│   ├── auth/                     # JWT authentication blueprint
│   │   ├── __init__.py           # Blueprint registration + endpoints
│   │   └── decorators.py         # @admin_required, get_current_user helpers
│   │
│   ├── models/                   # SQLAlchemy ORM models
│   │   ├── __init__.py           # Model exports
│   │   ├── user.py               # User model with bcrypt password hashing + RBAC
│   │   ├── exoplanet.py          # Exoplanet model with raw_input_json + versioning
│   │   └── retraining_log.py     # Audit log model for retraining events
│   │
│   ├── artifacts/
│   │   └── habitability_pipeline.pkl   # Serialised trained pipeline
│   │
│   └── tests/                    # Pytest test suite
│       ├── test_auth.py          # 32 authentication tests
│       ├── test_api.py           # API contract + prediction tests
│       └── conftest.py           # Fixtures and test configuration
│
└── frontend/
    ├── index.html                # Landing page
    ├── predict.html              # Prediction form
    ├── add_planet.html           # Planet submission form
    ├── rankings.html             # Habitability leaderboard
    └── style.css / rankings.css  # Stylesheets
```

---

## API Reference

### Public Endpoints (No Authentication Required)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Root health check — confirms backend is live |
| `GET` | `/health` | Detailed health check (model, DB, retraining state) |
| `POST` | `/predict` | Predict habitability (single or batch) |
| `POST` | `/predict_and_store` | Predict + persist to DB |
| `POST` | `/predict_and_store_batch` | Optimised bulk predict + single-commit batch insert |
| `POST` | `/add_planet` | Store planet without prediction |
| `GET` | `/rank` | Planets ranked by habitability probability |
| `GET` | `/stats` | Aggregate DB statistics (total, habitable, user-generated) |

### Admin-Only Endpoints (JWT Required, `admin` Role)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/trigger_retraining` | Trigger async model retraining |
| `GET` | `/retraining_status` | Poll background retraining progress |
| `GET` | `/retraining_logs` | Full audit trail of past retraining runs |
| `POST` | `/recompute` | Recompute all stale predictions (model version mismatch) |

### Prediction Request Format

```json
// Single planet
{
  "planet_name": "Kepler-442b",
  "P_RADIUS": 1.34,
  "P_MASS": 2.3,
  "P_PERIOD": 112.3,
  "P_SEMI_MAJOR_AXIS": 0.409,
  "P_ECCENTRICITY": 0.04,
  "S_TEMPERATURE": 4402,
  "S_LUMINOSITY": 0.24,
  "S_MASS": 0.61,
  "S_RADIUS": 0.60,
  "S_AGE": 2.9,
  "P_TYPE": "Superterran"
}
```

**Missing fields are allowed** — the pipeline imputes them using training-set medians.

### Prediction Response Format

```json
{
  "status": "success",
  "message": "Prediction(s) generated successfully",
  "data": {
    "planet_name": "Kepler-442b",
    "habitability": 1,
    "habitability_probability": 0.872341,
    "threshold_used": 0.5
  }
}
```

---

## Authentication & RBAC

The backend uses **JWT (JSON Web Tokens)** for stateless authentication and **role-based access control (RBAC)** to protect governance endpoints.

### Auth Endpoints

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/auth/register` | `POST` | None | Create a user account |
| `/auth/login` | `POST` | None | Authenticate and receive a JWT |
| `/auth/me` | `GET` | Bearer JWT | View current user profile |
| `/auth/logout` | `POST` | Bearer JWT | Logout (client-side token invalidation) |

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

# 3. Call protected admin endpoint
curl -X POST http://localhost:5000/trigger_retraining \
  -H "Authorization: Bearer <your_access_token>" \
  -H "Content-Type: application/json" \
  -d '{"reason": "New user data available"}'
```

---

## Setup & Installation

### Prerequisites

- Python 3.10+
- pip

### 1. Clone the Repository

```bash
git clone <repository-url>
cd ExoHabitAI
```

### 2. Create a Virtual Environment

```bash
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r backend/requirements.txt
```

### 4. Configure Environment Variables

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your values
```

### 5. Train the Model

Run this once to generate the serialised pipeline artifact:

```bash
python train_unified_pipeline.py
```

The trained pipeline is saved to `backend/artifacts/habitability_pipeline.pkl`.

### 6. Initialise the Database

```bash
cd backend
python migrate_db.py

# Create the first admin user
flask create-admin
# OR bootstrap from environment variables:
flask bootstrap-admin
```

### 7. Start the Server

```bash
python app.py
```

The API is now available at `http://localhost:5000`.

### 8. Open the Frontend

Open `frontend/index.html` in a browser (no build step required).

---

## Environment Variables

See `backend/.env.example` for the full list. Key variables:

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET_KEY` | `jwt-dev-secret-change-in-prod` | **Change this in production!** |
| `JWT_ACCESS_TOKEN_HOURS` | `24` | Token lifetime in hours |
| `THRESHOLD` | `0.5` | Habitability classification cutoff |
| `RETRAIN_F1_TOLERANCE` | `0.02` | Max allowed F1 regression before rejecting new model |
| `RATE_LIMIT_SECONDS` | `2` | Minimum seconds between predictions per IP |
| `ADMIN_USERNAME` | — | Bootstrap admin username |
| `ADMIN_EMAIL` | — | Bootstrap admin email |
| `ADMIN_PASSWORD` | — | Bootstrap admin password |
| `DATABASE_URL` | `sqlite:///instance/exohabitai.db` | SQLAlchemy database URI |

---

## Testing

```bash
cd backend

# Run all tests
python -m pytest tests/ -v

# Run only auth tests (32 tests)
python -m pytest tests/test_auth.py -v

# Run with coverage report
python -m pytest tests/ --cov=. --cov-report=term-missing
```

The test suite covers:
- JWT registration, login, and token validation flows
- Role-based access control (admin vs. user)
- API contract validation (predict, add, rank, stats)
- ML sanity checks (prediction range, probability output format)
- Rate limiting and error handler responses

---

## Tech Stack

| Layer | Technology |
|---|---|
| **ML / Data** | scikit-learn, imbalanced-learn, pandas, numpy, joblib |
| **Backend** | Flask, Flask-SQLAlchemy, Flask-JWT-Extended, Flask-CORS |
| **Database** | SQLite (development) / any SQLAlchemy-compatible DB |
| **Authentication** | JWT, bcrypt (via Werkzeug) |
| **Frontend** | HTML5, CSS3, Vanilla JavaScript |
| **Testing** | pytest, pytest-cov |
| **Python** | 3.10+ |

---

*ExoHabitAI — Finding life among the stars, one probability at a time.*
