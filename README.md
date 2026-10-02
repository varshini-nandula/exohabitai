# 🌌 ExoHabitAI

**Machine Learning System & Web Platform for Exoplanet Habitability Classification**

ExoHabitAI is an end-to-end machine learning platform designed to classify and rank exoplanetary habitability based on planetary and stellar astrophysical measurements. The platform integrates a unified scikit-learn / imbalanced-learn pipeline, a modular Flask REST API, JWT-based role authentication, an administrative governance console, and a React 19 single-page application.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Demo & Seed Credentials](#demo--seed-credentials)
3. [Key Engineering & Architecture Decisions](#key-engineering--architecture-decisions)
4. [Machine Learning Pipeline](#machine-learning-pipeline)
   - [Target Variable Definition & Class Imbalance](#target-variable-definition--class-imbalance)
   - [Feature Selection & Leakage Prevention](#feature-selection--leakage-prevention)
   - [Feature Engineering & Derivations](#feature-engineering--derivations)
   - [Pipeline Architecture](#pipeline-architecture)
   - [Class Balancing with SMOTE](#class-balancing-with-smote)
   - [Evaluation Metrics & Reference Performance](#evaluation-metrics--reference-performance)
5. [System Architecture](#system-architecture)
6. [Platform Features](#platform-features)
   - [Public Access](#public-access)
   - [Authenticated User Experience (Unified Dashboard)](#authenticated-user-experience-unified-dashboard)
   - [Admin Operations Console](#admin-operations-console)
7. [Planet Submission & Moderation Lifecycle](#planet-submission--moderation-lifecycle)
8. [MLOps & Model Retraining Workflow](#mlops--model-retraining-workflow)
9. [Backend Architecture & API Reference](#backend-architecture--api-reference)
   - [Public Endpoints](#public-endpoints)
   - [Authentication Endpoints](#authentication-endpoints)
   - [User Endpoints](#user-endpoints)
   - [Admin Control Plane Endpoints](#admin-control-plane-endpoints)
   - [Inference Payload Formats](#inference-payload-formats)
10. [Frontend Architecture](#frontend-architecture)
11. [Project Structure](#project-structure)
12. [Setup & Installation](#setup--installation)
13. [Environment Configuration](#environment-configuration)
14. [Testing & Quality Assurance](#testing--quality-assurance)
15. [Tech Stack](#tech-stack)

---

## System Overview

ExoHabitAI ingests observed planetary parameters (such as planetary radius, mass, density, surface temperature, orbital period, and semi-major axis) alongside host star properties (such as stellar temperature, luminosity, metallicity, and radius) to estimate the probability that an exoplanet meets catalog-defined habitability criteria.

> [!NOTE]
> **Scientific Scope:** The model predicts binary habitability according to the criteria defined in the **Planetary Habitability Laboratory (PHL) Exoplanet Catalog** (`P_HABITABLE ∈ {1, 2}`). It provides statistical ranking based on observational parameters and does not directly detect biological activity or life.

The project operates across three integrated layers:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        React 19 SPA Frontend                           │
│  Public Portal  │  Unified User Dashboard  │  Admin Operations Console │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / REST (Axios + JWT)
┌───────────────────────────────────▼────────────────────────────────────┐
│                         Flask REST Backend                             │
│  Auth & RBAC  │  Validation Layer  │  App Blueprints  │  Admin Engine  │
└───────────────────┬───────────────────────────────┬────────────────────┘
                    │                               │
┌───────────────────▼─────────────┐   ┌─────────────▼────────────────────┐
│      Scikit-Learn Pipeline      │   │     SQLAlchemy / SQLite DB       │
│  QuantileClipper │ SMOTE │ OHE  │   │  Users │ Exoplanets │ Datasets   │
│   RandomForest Classifier       │   │  ModelVersions │ RetrainingLogs  │
└─────────────────────────────────┘   └──────────────────────────────────┘
```

---

## Demo & Seed Credentials

For quick evaluation and local testing, pre-configured demo accounts can be loaded into the database via `python backend/seed_demo_data.py`:

| Role | Username | Email | Password | Access Level |
|---|---|---|---|---|
| **Admin** | `admin` | `admin@exohabit.ai` | `AdminPassword123!` | Full Admin Operations Console (`/admin/*`) & Public Features |
| **Admin (Secondary)** | `admin_demo` | `admindemo@exohabit.ai` | `AdminPassword123!` | Full Admin Operations Console (`/admin/*`) |
| **Astronomer (User)** | `demo_astronomer` | `demo@exohabit.ai` | `Password123!` | Unified User Dashboard (`/dashboard`), Submission Form (`/add-planet`) |
| **Standard User** | `user` | `user@exohabit.ai` | `UserPassword123!` | User Dashboard & Inference Access |

---

## Key Engineering & Architecture Decisions

| Decision | Rationale |
|---|---|
| **Unified `ImbPipeline` Serialization** | Preprocessing (imputation, quantile clipping, scaling, one-hot encoding), SMOTE oversampling, and the Random Forest classifier are encapsulated into a single `.pkl` artifact. Inference receives raw inputs without manual pre-alignment, eliminating train/serve skew. |
| **SMOTE Enclosed within Pipeline** | Placing Synthetic Minority Over-sampling Technique (SMOTE) directly inside the `ImbPipeline` ensures synthetic samples are generated strictly within the training fold during cross-validation, preventing data leakage into validation/test sets. |
| **Explicit Removal of Proxy Features** | Features directly encoding the target (e.g., Earth Similarity Index `P_ESI`, habitable zone boundaries `P_HABZONE_*`, `S_HZ_*`, `S_ABIO_ZONE`) are stripped prior to training to avoid trivial data leakage. |
| **Custom `QuantileClipper` Transformer** | Outliers in physical astrophysical measurements can distort scaling. The custom transformer clips numerical inputs to learned [5th, 95th] percentiles while automatically skipping binary and near-constant columns. |
| **Deterministic Train/Serve Parity** | Derived attributes (e.g., spectral classification `Derived_S_TYPE` from stellar temperature) are calculated using identical functions across training, backend API validation, and retraining routines. |
| **Content-Based Model Versioning** | An MD5 hash of the active `.pkl` file is tracked alongside predictions. Mismatches indicate stale predictions generated by earlier model iterations, allowing targeted recomputations. |
| **Performance-Gated Retraining** | When retraining is triggered, the candidate model must meet or exceed the active model's F1 score within a configurable tolerance (`RETRAIN_F1_TOLERANCE`). If the threshold is not met, the candidate model is rejected and the active model is preserved. |
| **Moderation Queue for Public Rankings** | User submissions are saved with a `pending` status. Only approved planets enter public rankings (`/rank`), protecting leaderboard data integrity. |
| **Unified User Dashboard** | User interactions (submission history, review status, candidate modal inspections, and profile editing) are centralized in a single `/dashboard` view with backward-compatible redirects for `/profile` and `/history`. |
| **7-Module Admin Control Plane** | Administrative functions are separated into dedicated interfaces for system monitoring, moderation, user role governance, dataset management, model registry rollbacks, retraining orchestration, and audit logging. |

---

## Machine Learning Pipeline

### Target Variable Definition & Class Imbalance

The modeling objective is binary habitability classification (`P_HABITABLE_BINARY`), derived from the PHL Exoplanet Catalog:
- **Positive Class (`1`)**: Confirmed conservative or optimistic habitable zone candidates (`P_HABITABLE ∈ {1, 2}`).
- **Negative Class (`0`)**: Non-habitable planets.

Because habitable candidates represent **< 2%** of all cataloged exoplanets, extreme class imbalance exists. Evaluating models purely on raw accuracy is misleading, making **F1 Score**, **PR-AUC (Precision-Recall AUC)**, and **ROC-AUC** the primary evaluation metrics.

---

### Feature Selection & Leakage Prevention

To prevent the model from learning trivial proxies of habitability, the dataset undergoes strict column filtering:

```
Raw Exoplanet Dataset (PHL Catalog)
  │
  ├─► Drop Error / Limit Columns: *_ERROR_MIN, *_ERROR_MAX, *_LIMIT
  ├─► Drop Identifiers & Metadata: S_NAME, P_DETECTION, P_YEAR, S_RA, S_DEC, constellations...
  ├─► Drop Direct Leakage Proxies: P_ESI, P_HABZONE_OPT, P_HABZONE_CON, S_HZ_*, S_ABIO_ZONE, P_DISTANCE_EFF, P_TYPE_TEMP
  ├─► Drop Redundant Min/Max Bounds: P_TEMP_EQUIL_MIN/MAX, P_FLUX_MIN/MAX, P_ECCENTRICITY_MIN...
  └─► Retain Clean Astrophysical Features
```

---

### Feature Engineering & Derivations

1. **Derived Spectral Classification (`Derived_S_TYPE`)**:
   Replaces noisy raw star spectral types with a deterministic mapping based on stellar effective temperature (`S_TEMPERATURE`):
   - `> 30,000 K` → O-Type
   - `> 10,000 K` → B-Type
   - `> 7,500 K` → A-Type
   - `> 6,000 K` → F-Type
   - `> 5,000 K` → G-Type
   - `> 3,500 K` → K-Type
   - `> 2,500 K` → M-Type
   - `> 1,500 K` → L-Type
   - `> 800 K` → T-Type
   - `≤ 800 K` → Y-Type

2. **Auto-Derived Physical Attributes**:
   When users submit incomplete parameter sets, the backend automatically derives computable physical features before pipeline execution:
   - **Surface Gravity (`P_GRAVITY`)**: $g = \frac{M}{R^2}$ (in Earth gravities)
   - **Escape Velocity (`P_ESCAPE`)**: $v_{esc} = \sqrt{\frac{M}{R}}$ (relative to Earth)
   - **Stellar Flux (`P_FLUX`)**: $F = \frac{L}{a^2}$ (where $L$ is stellar luminosity, $a$ is semi-major axis)
   - **Equilibrium Temperature (`P_TEMP_EQUIL`)**: $T_{eq} = T_{star} \cdot \left(\frac{R_{star}}{2a}\right)^{1/2} \cdot (1 - A)^{1/4}$

---

### Pipeline Architecture

The transformation and model fitting pipeline is assembled using `imblearn.pipeline.Pipeline`:

```
Input Feature Vector
        │
        ▼
┌────────────────────────────────────────────────────────────────────────┐
│  ColumnTransformer                                                     │
│  ┌─────────────────────────────────┐  ┌──────────────────────────────┐ │
│  │ Numerical Pipeline              │  │ Categorical Pipeline         │ │
│  │ 1. SimpleImputer(median)        │  │ 1. SimpleImputer(most_freq)  │ │
│  │ 2. QuantileClipper(0.05, 0.95)  │  │ 2. OneHotEncoder             │ │
│  │ 3. StandardScaler()             │  │    (handle_unknown='ignore') │ │
│  │ 4. VarianceThreshold(0.01)      │  └──────────────────────────────┘ │
│  └─────────────────────────────────┘                                   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│  SMOTE Oversampling (Applied during training only)                     │
│  sampling_strategy=0.3, k_neighbors=5, random_state=42                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│  RandomForestClassifier                                                │
│  n_estimators=400, max_depth=8, min_samples_leaf=10, random_state=42   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
       Output: Habitability Probability [0.0 - 1.0] + Binary Class [0 / 1]
```

---

### Class Balancing with SMOTE

Because the positive class represents < 2% of instances, training standard classifiers without resampling results in high false-negative rates. ExoHabitAI employs **SMOTE (Synthetic Minority Over-sampling Technique)** with `sampling_strategy=0.3` to synthesize minority class instances in feature space until the minority class reaches 30% of the majority class volume. 

Integrating SMOTE directly into the `ImbPipeline` guarantees that oversampling occurs **only on training folds** during cross-validation and fitting, preventing synthetic observations from leaking into test evaluations.

---

### Evaluation Metrics & Reference Performance

The pipeline was evaluated on a held-out stratified 20% test split, alongside 5-fold stratified cross-validation.

#### Test Set Performance (Reference Baseline)

| Metric | Test Score | Description |
|---|---|---|
| **Accuracy** | **0.9982** | Overall classification accuracy |
| **Precision** | **0.8750** | Proportion of predicted habitable planets that are positive |
| **Recall** | **1.0000** | Proportion of actual habitable planets detected |
| **F1 Score** | **0.9333** | Harmonic mean of precision and recall |
| **ROC-AUC** | **0.9999** | Area under the ROC curve |
| **PR-AUC** | **0.9911** | Precision-Recall AUC (critical for imbalanced classes) |

#### 5-Fold Stratified Cross-Validation

| Metric | Cross-Validation Score (Mean ± Std) |
|---|---|
| **CV Accuracy** | **0.9971 ± 0.0011** |
| **CV F1 Score** | **0.8837 ± 0.0452** |
| **CV ROC-AUC** | **0.9995 ± 0.0006** |

#### Overfitting Analysis (Train vs. Test Gap)

| Metric | Train Score | Test Score | Generalization Gap |
|---|---|---|---|
| **Accuracy** | 0.9984 | 0.9982 | +0.0002 |
| **F1 Score** | 0.9402 | 0.9333 | +0.0068 |
| **ROC-AUC** | 1.0000 | 0.9999 | +0.0001 |

---

## System Architecture

```text
                       ┌──────────────────────┐
                       │ React 19 Frontend    │
                       └──────────┬───────────┘
                                  │ JSON API (JWT Bearer)
                                  ▼
                       ┌──────────────────────┐
                       │  Flask API Router    │
                       └──────────┬───────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         │                        │                        │
         ▼                        ▼                        ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  Auth Blueprint  │    │ Predict / Store  │    │ Admin Controller │
│  - /auth/login   │    │ - /predict       │    │ - /admin/*       │
│  - /auth/me      │    │ - /rank          │    │ - Moderation     │
│  - /auth/register│    │ - /my_planets    │    │ - Model Registry │
└────────┬─────────┘    └─────────┬────────┘    └─────────┬────────┘
         │                        │                       │
         ▼                        ▼                       ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│ SQLite Database  │◄───┤ ML Pipeline .pkl │◄───┤ Retrain Engine   │
│ - Users & Roles  │    │ - QuantileClip   │    │ - Concurrency Lk │
│ - Exoplanets     │    │ - Imputation     │    │ - Dataset Merge  │
│ - Model Versions │    │ - SMOTE + RF     │    │ - F1 Gate Check  │
│ - Retraining Logs│    └──────────────────┘    └──────────────────┘
└──────────────────┘
```

---

## Platform Features

### Public Access
- **Landing Page (`/`)**: Displays platform capabilities, key pipeline mechanics, live top-ranked candidate preview, and active model telemetry.
- **Interactive Predictor (`/predict`)**: 19-parameter prediction interface with 7 presets (Earth-like, Super-Earth, Gas Giant, Lava World, Kepler-442b, TRAPPIST-1e, Proxima Centauri b), missing value imputation strategy selector, and SVG arc habitability gauge.
- **Rankings Leaderboard (`/rankings`)**: Publicly accessible table of approved candidates with Top-N filtering (10, 20, 30, 50, all), search, sorting, and Recharts visualization.
- **Telemetry & Telemetry (`/about`)**: Operational telemetry, dataset breakdown, and active model parameter information.

---

### Authenticated User Experience (Unified Dashboard)
- **Unified User Dashboard (`/dashboard`)**: Central hub replacing separate profile and history pages. Includes:
  - Submission summary metrics (total submitted, approved, pending, rejected).
  - Searchable submissions table with tab filters (`All`, `Approved`, `Pending`, `Rejected`).
  - **Candidate Detail Modal**: In-depth inspection modal presenting planetary parameters, calculated equilibrium values, raw JSON, and review status.
  - **Profile Editor**: Modal to update user display details (email, bio, affiliation, location).
- **Planet Submission (`/add-planet`)**: Form for submitting new exoplanetary candidates to the database with moderation status initialized to `pending`.
- **Backward Compatibility**: Legacy routes (`/profile`, `/history`, `/my-predictions`) automatically redirect to `/dashboard`.

---

### Admin Operations Console

Accessible to users with the `admin` role via an ergonomic sidebar dock (`/admin`):

1. **Dashboard Overview (`/admin`)**: Real-time KPI cards, system status, active model summary, and recent candidate feed.
2. **Moderation Queue (`/admin/moderation`)**: Review pending submissions with detailed feature inspection and one-click `Approve` or `Reject` actions.
3. **User Management (`/admin/users`)**: Search registered users, promote/demote roles (`user` ↔ `admin`), and toggle account active/inactive statuses.
4. **Model Registry (`/admin/models`)**: View active model performance metrics, inspect version histories, and trigger rollbacks to previous `.pkl` backup artifacts.
5. **Dataset Management (`/admin/datasets`)**: Inspect catalog distributions, upload and merge external CSV datasets, and export filtered datasets.
6. **Training Console (`/admin/training`)**: Retraining orchestrator with customizable hyperparameters (SMOTE sampling ratio, tree count, max depth, F1 tolerance threshold), live polling, and log streaming.
7. **Audit Logs (`/admin/logs`)**: Filterable audit trail tracking administrative actions, user changes, and model operations.

---

## Planet Submission & Moderation Lifecycle

```
[ Researcher / User ]
         │
         ▼
[ POST /predict_and_store ] ──► Validates inputs & runs ML Pipeline
                                       │
                                       ▼
                       [ Database: status = 'pending' ]
                                       │
             ┌─────────────────────────┴─────────────────────────┐
             ▼                                                   ▼
[ User Dashboard (/dashboard) ]                         [ Admin Queue (/admin/moderation) ]
Visible only to submitting user                         Admin reviews candidate properties
                                                                 │
                                             ┌───────────────────┴───────────────────┐
                                             ▼                                       ▼
                                       [ APPROVED ]                             [ REJECTED ]
                                             │                                       │
                                             ├─► Visible in /rank Leaderboard        └─► Hidden from public
                                             └─► Eligible for Retraining Dataset         Kept for audit trail
```

---

## MLOps & Model Retraining Workflow

Retraining is orchestrated asynchronously to prevent blocking API requests:

```text
Admin Triggers Retraining (/admin/training or POST /admin/retraining/trigger)
                         │
                         ├─► Acquire Retraining Lock (prevents concurrent executions)
                         ├─► Launch Background Execution Thread
                         │
                         ▼
             [ Retraining Pipeline ]
                         │
                         ├─ 1. Load base catalogue (planetsdata.csv)
                         ├─ 2. Extract approved user-submitted records from DB
                         ├─ 3. Deduplicate and merge datasets
                         ├─ 4. 80/20 Stratified Train/Test split
                         ├─ 5. Fit unified ImbPipeline (ColumnTransformer + SMOTE + RF)
                         ├─ 6. Evaluate candidate model on held-out test split
                         │
                         ▼
             [ Performance Gate Check ]
                         │
         Is Candidate F1 < (Active F1 - RETRAIN_F1_TOLERANCE)?
                        / \
                   YES /   \ NO
                      ▼     ▼
             ┌──────────┐  ┌──────────────────────────────────┐
             │ REJECTED │  │ ACCEPTED                         │
             │ Keep old │  │ Deploy new artifact              │
             │ model    │  │ Hot-reload pipeline in memory    │
             └────┬─────┘  │ Record new active ModelVersion    │
                  │        └────────────────┬─────────────────┘
                  │                         │
                  └────────────┬────────────┘
                               ▼
                   [ Create RetrainingLog ]
```

---

## Backend Architecture & API Reference

### Public Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Root availability ping |
| `GET` | `/health` | System health check (database status, model loaded, background worker status) |
| `GET` | `/stats` | Aggregate catalog statistics & active model telemetry metrics |
| `GET` | `/retraining_status` | Current status of background retraining worker |
| `GET` | `/pipeline_info` | Pipeline metadata, expected input columns, and version identifier |
| `POST` | `/predict` | In-memory habitability prediction for single or batch planets |
| `GET` | `/rank` | Approved planets ranked by predicted habitability probability |

---

### Authentication Endpoints

| Method | Endpoint | Auth Required | Description |
|---|---|:---:|---|
| `POST` | `/auth/register` | None | Register a new user account |
| `POST` | `/auth/login` | None | Authenticate via username or email; returns JWT access token |
| `GET` | `/auth/me` | Bearer JWT | Fetch authenticated user profile & verify token validity |
| `PUT` | `/auth/me` | Bearer JWT | Update user profile fields (email, bio, affiliation, location) |
| `POST` | `/auth/logout` | Bearer JWT | Conclude session |

---

### User Endpoints

| Method | Endpoint | Auth Required | Description |
|---|---|:---:|---|
| `POST` | `/predict_and_store` | Bearer JWT | Run inference and persist planet to database with `status: pending` |
| `POST` | `/predict_and_store_batch` | Bearer JWT | Batch predict and persist multiple candidate planets |
| `GET` | `/my_planets` | Bearer JWT | Retrieve planets submitted by the authenticated user |

---

### Admin Control Plane Endpoints

| Method | Endpoint | Auth Required | Description |
|---|---|:---:|---|
| `GET` | `/admin/dashboard` | Admin JWT | Aggregated administrative statistics and system health |
| `GET` | `/admin/planets/pending` | Admin JWT | Paginated list of candidate submissions awaiting moderation |
| `GET` | `/admin/planets/all` | Admin JWT | Query all planets with status and search filters |
| `GET` | `/admin/planets/<id>` | Admin JWT | Detailed feature inspection of a single planet |
| `POST` | `/admin/planets/<id>/approve` | Admin JWT | Approve a planet candidate |
| `POST` | `/admin/planets/<id>/reject` | Admin JWT | Reject a planet candidate with optional reason |
| `GET` | `/admin/users` | Admin JWT | List registered users with pagination and search |
| `POST` | `/admin/users/<id>/role` | Admin JWT | Modify user role (`user` ↔ `admin`) |
| `POST` | `/admin/users/<id>/status` | Admin JWT | Toggle user active/inactive status |
| `GET` | `/admin/models` | Admin JWT | Model registry versions and historical performance |
| `POST` | `/admin/models/rollback` | Admin JWT | Roll back to previous backup model artifact |
| `GET` | `/admin/datasets` | Admin JWT | Dataset exploration and class distribution metrics |
| `POST` | `/admin/datasets/upload` | Admin JWT | Upload external CSV dataset for catalog integration |
| `GET` | `/admin/datasets/export` | Admin JWT | Export filtered dataset records to CSV |
| `POST` | `/admin/retraining/trigger` | Admin JWT | Launch async retraining with custom hyperparameters |
| `GET` | `/admin/retraining/status` | Admin JWT | Retraining execution status and live log output |
| `GET` | `/admin/retraining/logs` | Admin JWT | Retraining attempt audit history |
| `POST` | `/recompute` | Admin JWT | Recompute stale predictions with the active model |

---

### Inference Payload Formats

#### Single Prediction Request (`POST /predict` or `/predict_and_store`)

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

*Note: All fields except `planet_name` are optional. Missing parameters are handled by the pipeline's internal imputer based on the selected `imputation_strategy` (`median`, `earth`, `non_habitable`, `zeros`).*

#### Prediction Response

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

## Frontend Architecture

The frontend is built on **React 19**, **Vite**, and **TailwindCSS v4**:

- **Authentication Context (`AuthContext.jsx`)**: Manages JWT lifecycle, handles session expiration via Axios response interceptors, and provides authorization state across the tree.
- **Route Guarding**:
  - `ProtectedRoute`: Wraps authenticated user areas (`/dashboard`, `/add-planet`).
  - `AdminRoute`: Enforces `role === 'admin'` for access to `/admin/*`.
- **Layout Shells**:
  - `MainLayout`: Public and user shell with glassmorphism navigation header, background canvas starfield, and footer.
  - `AdminLayout`: Dedicated sidebar dock (`w-14`) with quick navigation across all 7 admin sub-modules and direct profile controls.

---

## Project Structure

```
ExoHabitAI/
├── planetsdata.csv               # Raw PHL catalog dataset (gitignored)
├── train_unified_pipeline.py     # Pipeline assembly, evaluation & serialization
├── custom_transformers.py        # Custom QuantileClipper transformer
├── exoplanets.ipynb              # Exploratory Data Analysis & experiments
│
├── backend/
│   ├── app.py                    # Flask application setup & public/prediction routes
│   ├── config.py                 # Environment-driven application configuration
│   ├── extensions.py             # SQLAlchemy & JWT extension initialization
│   ├── database.py               # Database initialisation & catalog seeding
│   ├── seed_demo_data.py         # Test account seeder (admin, astronomer, user)
│   ├── retrain_pipeline.py       # Retraining script with F1 tolerance gate
│   ├── recompute_predictions.py  # Stale prediction recomputation utility
│   ├── export_training_data.py   # Training dataset export utility
│   ├── generate_ranked_dataset.py# Ranked CSV catalog generator
│   ├── cli.py                    # Flask CLI commands (admin user bootstrap)
│   ├── migrate_db.py             # Database schema migration script
│   ├── requirements.txt          # Python backend dependencies
│   │
│   ├── auth/                     # Authentication blueprint & services
│   │   ├── routes.py             # /auth/register, /login, /me, /logout
│   │   ├── services.py           # User management & authentication logic
│   │   ├── decorators.py         # @admin_required, @login_required guards
│   │   └── utils.py              # JWT token callbacks & claim handling
│   │
│   ├── admin/                    # Admin operations control plane
│   │   ├── __init__.py           # Blueprint initialization
│   │   ├── routes_dashboard.py   # /admin/dashboard
│   │   ├── routes_moderation.py  # Planet candidate review & actions
│   │   ├── routes_users.py       # User management & role governance
│   │   ├── routes_models.py      # Model registry & artifact rollback
│   │   ├── routes_datasets.py    # Dataset exploration, upload & export
│   │   ├── routes_retraining.py  # Retraining trigger, status & logs
│   │   ├── services.py           # Admin domain business logic
│   │   └── validators.py         # Request validation schemas
│   │
│   ├── models/                   # SQLAlchemy ORM definitions
│   │   ├── user.py               # User model & UserRole enum
│   │   ├── exoplanet.py          # Exoplanet model & PlanetStatus enum
│   │   ├── model_version.py      # ModelVersion registry model
│   │   ├── training_dataset.py   # TrainingDataset metadata model
│   │   └── retraining_log.py     # RetrainingLog audit model
│   │
│   ├── artifacts/
│   │   └── habitability_pipeline.pkl  # Trained ML pipeline artifact (gitignored)
│   │
│   └── tests/                    # Pytest test suite (12 test modules, 274 tests)
│       ├── conftest.py           # Test fixtures & in-memory SQLite DB
│       ├── test_admin_protection.py
│       ├── test_auth.py
│       ├── test_batch_prediction.py
│       ├── test_database.py
│       ├── test_health.py
│       ├── test_ml_sanity.py
│       ├── test_moderation.py
│       ├── test_prediction.py
│       ├── test_rankings.py
│       ├── test_retraining.py
│       └── test_validation.py
│
└── frontend-react/               # React 19 Frontend
    ├── package.json
    ├── vite.config.js            # Vite configuration with backend proxy
    └── src/
        ├── main.jsx              # React root mount
        ├── App.jsx               # App routing wrapper
        ├── index.css             # TailwindCSS v4 theme tokens
        │
        ├── routes/
        │   └── AppRoutes.jsx     # Route definitions & guards
        ├── auth/
        │   ├── ProtectedRoute.jsx# User route guard
        │   └── AdminRoute.jsx    # Admin role route guard
        ├── context/
        │   └── AuthContext.jsx   # Global auth state & session timer
        ├── api/
        │   ├── client.js         # Axios instance & interceptors
        │   ├── auth.js           # Auth API requests
        │   ├── admin.js          # Admin operations requests
        │   ├── prediction.js     # Inference requests
        │   ├── rankings.js       # Rankings requests
        │   └── stats.js          # Telemetry & health requests
        │
        ├── layouts/
        │   ├── MainLayout.jsx    # User & public layout
        │   └── AdminLayout.jsx   # Admin sidebar dock layout
        │
        └── pages/
            ├── HomePage.jsx
            ├── PredictPage.jsx
            ├── RankingsPage.jsx
            ├── AboutPage.jsx
            ├── LoginPage.jsx
            ├── RegisterPage.jsx
            ├── UserDashboardPage.jsx  # Consolidated user dashboard
            ├── AddPlanetPage.jsx
            ├── NotFoundPage.jsx
            │
            └── admin/            # Admin console module pages
                ├── AdminDashboardPage.jsx
                ├── ModerationPage.jsx
                ├── UserManagementPage.jsx
                ├── ModelsPage.jsx
                ├── DatasetsPage.jsx
                ├── TrainingPage.jsx
                └── AuditLogsPage.jsx
```

---

## Setup & Installation

### Prerequisites
- Python 3.10+
- Node.js 18+ & npm
- Git

### 1. Clone & Set Up Virtual Environment

```bash
git clone <repository-url>
cd ExoHabitAI

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# Windows (PowerShell):
.venv\Scripts\Activate.ps1
# Windows (cmd):
.venv\Scripts\activate.bat
# macOS/Linux:
source .venv/bin/activate

# Install Python dependencies
pip install -r backend/requirements.txt
```

### 2. Configure Environment

```bash
cp backend/.env.example backend/.env
```

*(Review `backend/.env` to configure application secrets and settings).*

### 3. Build Model Artifact & Initialize Database

```bash
# 1. Train and serialize the initial ML pipeline
python train_unified_pipeline.py

# 2. Initialize database schema
cd backend
python migrate_db.py

# 3. Seed initial planetary catalog
python database.py

# 4. Seed demo accounts (admin, astronomer, user)
python seed_demo_data.py
```

### 4. Run Application Servers

**Start Flask Backend:**
```bash
cd backend
python app.py
```
*Backend runs on `http://localhost:5000`.*

**Start React Frontend:**
```bash
# In a separate terminal
cd frontend-react
npm install
npm run dev
```
*Frontend runs on `http://localhost:5173` (requests to `/api` are proxied to Flask).*

---

## Environment Configuration

Configuration variables defined in `backend/.env`:

| Variable | Default | Description |
|---|---|---|
| `SECRET_KEY` | `dev-secret-key-change-in-prod` | Flask session secret key |
| `JWT_SECRET_KEY` | `jwt-dev-secret-change-in-prod` | Key used for signing JWTs |
| `JWT_ACCESS_TOKEN_HOURS` | `1` | JWT validity duration (in hours) |
| `DATABASE_URL` | `sqlite:///exoplanets.db` | SQLAlchemy database connection URI |
| `MODEL_PATH` | `artifacts/habitability_pipeline.pkl` | Path to serialised pipeline artifact |
| `THRESHOLD` | `0.5` | Classification decision threshold |
| `RETRAIN_F1_TOLERANCE` | `0.02` | Permissible F1 regression during retraining gate check |
| `RATE_LIMIT_SECONDS` | `1.0` | Minimum interval between predictions per IP |
| `CORS_ORIGINS` | `*` | Allowed CORS origins |

---

## Testing & Quality Assurance

### Backend Automated Test Suite (Pytest)

The backend includes an automated test suite comprising **274 tests across 12 test modules**:

```bash
cd backend

# Run entire test suite
python -m pytest tests/ -v

# Run with concise summary
python -m pytest tests/ -q
```

#### Test Suite Breakdown

| Test Module | Verified Coverage |
|---|---|
| `test_auth.py` | User registration, dual login (username/email), JWT claims, profile updating, logout |
| `test_admin_protection.py` | RBAC route guards, ensuring non-admins receive 403 Forbidden on `/admin/*` |
| `test_prediction.py` | Inference validation, `/predict_and_store`, user ownership association |
| `test_batch_prediction.py` | Multi-planet batch inference and atomic batch insertion |
| `test_validation.py` | Physical constraint checks, categorical boundary handling, soft warnings |
| `test_moderation.py` | Planet status lifecycle (`pending` → `approved` / `rejected`), visibility filtering |
| `test_rankings.py` | Leaderboard ordering, pagination, stale prediction detection |
| `test_retraining.py` | Async retraining trigger, concurrency locking, log persistence |
| `test_database.py` | Model relationships, foreign keys, cascade behaviors |
| `test_health.py` | `/health`, `/stats`, and system readiness diagnostics |
| `test_ml_sanity.py` | Physical habitability sanity tests (e.g. Earth-like vs. Jovian probability comparison) |
| `conftest.py` | In-memory SQLite fixtures, isolated client sessions, and test helpers |

### Frontend Build Verification

```bash
cd frontend-react
npm run build
```

---

## Tech Stack

| Domain | Technologies |
|---|---|
| **Machine Learning** | scikit-learn, imbalanced-learn (SMOTE), pandas, numpy, joblib |
| **Backend API** | Python 3.10+, Flask, Flask-SQLAlchemy, Flask-JWT-Extended, Flask-CORS |
| **Database** | SQLite (default development) / SQLAlchemy ORM (PostgreSQL compatible) |
| **Frontend Framework** | React 19, Vite 8, React Router v7 |
| **Styling & UI** | TailwindCSS v4, Lucide React, Glassmorphism design tokens |
| **Data Visualization** | Recharts, SVG Habitability Arc Gauges |
| **Testing** | Pytest (274 tests), Pytest-Cov |

---

*ExoHabitAI — Exploring habitability beyond our solar system with precision ML.*
