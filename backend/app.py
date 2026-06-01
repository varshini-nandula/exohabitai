"""
ExoHabitAI Backend — Production-Ready Flask API
=================================================
Pipeline-aware, env-secured, batch-ready ML deployment with JWT authentication.

Key design decisions:
- The pipeline includes ALL preprocessing (imputation, clipping, encoding,
  scaling, feature selection, SMOTE, classifier).  The backend sends **raw**
  input directly — no manual feature engineering or alignment.
- Missing values are allowed — the pipeline handles imputation internally.
- Threshold is configurable via THRESHOLD env var (default 0.5).
- All responses follow a consistent JSON envelope.
- Physical-validity checks reject impossible inputs without blocking NaN.
- JWT authentication protects admin/governance endpoints.
- Role-based access control (RBAC) separates user and admin capabilities.
"""

import os
import sys
import json
import hashlib
import logging
import threading
from datetime import datetime, timezone
from time import time as _monotime

# Ensure custom_transformers (QuantileClipper) is importable when
# joblib deserialises the pipeline .pkl file.
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)


import numpy as np
import pandas as pd
import joblib
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import jwt_required, get_jwt_identity

# Import centralised extensions (avoids circular imports)
from extensions import db, jwt
from config import Config

# ==============================================================================
# 2. LOGGING (replaces all print statements)
# ==============================================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("exohabitai")


# ==============================================================================
# 3. FLASK APP SETUP
# ==============================================================================

app = Flask(__name__)
app.config.from_object(Config)
CORS(app)

# Bind extensions to this app instance
db.init_app(app)
jwt.init_app(app)

# Register auth blueprint and CLI commands
from auth import auth_bp  # noqa: E402
app.register_blueprint(auth_bp)

from cli import register_cli_commands  # noqa: E402
register_cli_commands(app)

# Import models so SQLAlchemy registers them before create_all()
from models import User, UserRole, Exoplanet, RetrainingLog  # noqa: E402
from auth.decorators import admin_required, get_current_user  # noqa: E402

# Log JWT config warnings
if Config.JWT_SECRET_KEY == "jwt-dev-secret-change-in-prod":
    logger.warning("Using default JWT_SECRET_KEY — change this in production!")


# ==============================================================================
# 4. MODEL LOADING (pipeline-aware)
# ==============================================================================

def _compute_model_hash(path: str) -> str:
    """
    Compute an MD5 hash of the pipeline .pkl file.

    This provides a deterministic, content-based version identifier.
    Any change to the serialised model file — retraining, hyperparameter
    tuning, new features — produces a different hash.
    """
    md5 = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            md5.update(chunk)
    return md5.hexdigest()[:12]  # first 12 hex chars is plenty


def _extract_input_columns(pipeline) -> list[str] | None:
    """
    Extract the list of input column names that the pipeline's
    ColumnTransformer was fitted on.

    sklearn's ColumnTransformer requires ALL trained columns to be present
    in the input DataFrame (even if values are NaN — the internal imputer
    handles missing data).  This function reads the column list at load
    time so build_dataframe() can guarantee column presence.

    This is NOT manual preprocessing — it is a structural contract that
    sklearn enforces.
    """
    # Try pipeline-level feature_names_in_ (sklearn >= 1.0)
    if hasattr(pipeline, "feature_names_in_"):
        return list(pipeline.feature_names_in_)

    # Walk pipeline steps and check the ColumnTransformer
    if hasattr(pipeline, "named_steps"):
        for step_name, step_obj in pipeline.named_steps.items():
            if hasattr(step_obj, "feature_names_in_"):
                return list(step_obj.feature_names_in_)

    return None


def load_pipeline(path: str):
    """
    Load and validate the serialised pipeline.

    The unified pipeline includes all preprocessing steps internally.
    We extract the required input column names so that build_dataframe()
    can ensure column presence (sklearn's ColumnTransformer requirement).

    Also computes a content-hash of the .pkl file for version tracking.
    """
    if not os.path.isfile(path):
        logger.critical("Model file not found: %s", path)
        raise FileNotFoundError(f"Model file not found: {path}")

    pipeline = joblib.load(path)
    logger.info("Loaded model from %s", path)
    logger.info("Pipeline type: %s", type(pipeline).__name__)

    # --- Validate predict_proba ---
    if not hasattr(pipeline, "predict_proba"):
        logger.critical("Pipeline does not support predict_proba — aborting")
        raise AttributeError(
            "The loaded pipeline does not expose predict_proba. "
            "Ensure the classifier supports probability estimation."
        )

    # Log pipeline steps for debugging
    if hasattr(pipeline, "steps"):
        step_names = [name for name, _ in pipeline.steps]
        logger.info("Pipeline steps: %s", step_names)

    # --- Extract required input columns ---
    input_columns = _extract_input_columns(pipeline)
    if input_columns:
        logger.info("Pipeline expects %d input columns: %s",
                    len(input_columns), input_columns)
    else:
        logger.warning("Could not extract input column names from pipeline")

    # --- Compute model version hash ---
    model_hash = _compute_model_hash(path)
    model_version = f"v2_pipeline_{model_hash}"
    logger.info("Model version: %s", model_version)

    return pipeline, input_columns, model_version


pipeline, PIPELINE_INPUT_COLUMNS, MODEL_VERSION = load_pipeline(Config.MODEL_PATH)


# ==============================================================================
# 4c. DATASET VERSION HASH (Task 4)
# ==============================================================================

def _compute_dataset_hash(path: str) -> str:
    """Compute a fast MD5 hash of the training CSV for version tracking."""
    if not os.path.isfile(path):
        return "unknown"
    md5 = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            md5.update(chunk)
    return md5.hexdigest()[:12]


_DATA_CSV_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "planetsdata.csv",
)
DATASET_VERSION = _compute_dataset_hash(_DATA_CSV_PATH)
logger.info("Dataset version (hash): %s", DATASET_VERSION)


# ==============================================================================
# 4d. RETRAINING STATE (Task 1)
# ==============================================================================

_retrain_lock = threading.Lock()        # prevents concurrent retraining
_retrain_status: dict = {               # shared state for async queries
    "is_running": False,
    "last_started": None,
    "last_completed": None,
    "last_result": None,
}


# ==============================================================================
# 4e. RATE LIMITER (Task 6)
# ==============================================================================

_rate_limit_store: dict[str, float] = {}


def _check_rate_limit() -> bool:
    """Return True if the request is allowed, False if rate-limited."""
    ip = request.remote_addr or "unknown"
    now = _monotime()
    last = _rate_limit_store.get(ip, 0.0)
    # Read from app.config so TestConfig overrides take effect
    limit_seconds = app.config.get("RATE_LIMIT_SECONDS", Config.RATE_LIMIT_SECONDS)
    if now - last < limit_seconds:
        return False
    _rate_limit_store[ip] = now
    return True


# ==============================================================================
# 4b. PHYSICAL VALIDATION RULES
# ==============================================================================

# Maps feature name → (min_exclusive, max_inclusive_or_None, description)
# None means no upper bound.  Only features the user might actually send
# are listed; OHE columns are not user-facing.
PHYSICAL_CONSTRAINTS = {
    "P_RADIUS":          (0, None,   "Planet radius must be > 0"),
    "P_MASS":            (0, None,   "Planet mass must be > 0"),
    "P_DENSITY":         (0, None,   "Planet density must be > 0"),
    "P_TEMP_SURF":       (0, None,   "Surface temperature must be > 0 K"),
    "P_TEMP_EQUIL":      (0, None,   "Equilibrium temperature must be > 0 K"),
    "P_PERIOD":          (0, None,   "Orbital period must be > 0"),
    "P_SEMI_MAJOR_AXIS": (0, None,   "Semi-major axis must be > 0"),
    "S_TEMPERATURE":     (0, None,   "Star temperature must be > 0 K"),
    "S_LUMINOSITY":      (0, None,   "Star luminosity must be > 0"),
    "S_MASS":            (0, None,   "Star mass must be > 0"),
    "S_RADIUS":          (0, None,   "Star radius must be > 0"),
    "S_DISTANCE":        (0, None,   "Star distance must be > 0"),
    "P_GRAVITY":         (0, None,   "Planet gravity must be > 0"),
    "P_ESCAPE":          (0, None,   "Escape velocity must be > 0"),
    "P_FLUX":            (0, None,   "Stellar flux must be > 0"),
    "P_DISTANCE":        (0, None,   "Planet distance must be > 0"),
    "P_PERIASTRON":      (0, None,   "Periastron must be > 0"),
    "P_APASTRON":        (0, None,   "Apastron must be > 0"),
    "P_ECCENTRICITY":    (0, 1,      "Eccentricity must be between 0 and 1"),
    "P_INCLINATION":     (0, 180,    "Inclination must be between 0 and 180°"),
    "S_AGE":             (0, None,   "Star age must be > 0"),
}

# --- Valid categorical values (Task 2) ---
# Restricts categorical inputs to values observed in training data.
VALID_CATEGORIES = {
    "P_TYPE": ["Jovian", "Miniterran", "Neptunian", "Subterran", "Superterran", "Terran"],
    "S_TYPE_TEMP": ["A", "B", "BD", "F", "G", "K", "M", "O", "PSR", "WD"],
    "Derived_S_TYPE": [
        "O-Type", "B-Type", "A-Type", "F-Type", "G-Type",
        "K-Type", "M-Type", "L-Type", "T-Type", "Y-Type",
    ],
}

# --- Realistic range limits for soft warnings (Task 3) ---
# Values outside these ranges are NOT rejected — they produce warnings.
REALISTIC_LIMITS = {
    "P_RADIUS":          (0, 100),
    "P_MASS":            (0, 10000),
    "P_DENSITY":         (0, 200),
    "P_TEMP_SURF":       (0, 100000),
    "P_TEMP_EQUIL":      (0, 100000),
    "P_PERIOD":          (0, 1e8),
    "P_SEMI_MAJOR_AXIS": (0, 10000),
    "S_TEMPERATURE":     (1000, 50000),
    "S_LUMINOSITY":      (0, 1e7),
    "S_MASS":            (0, 300),
    "S_RADIUS":          (0, 2000),
    "S_DISTANCE":        (0, 1e6),
    "P_GRAVITY":         (0, 1e6),
    "P_ESCAPE":          (0, 1e6),
    "P_FLUX":            (0, 1e8),
    "P_DISTANCE":        (0, 1e6),
    "S_AGE":             (0, 20),
}



# ==============================================================================
# 5. DATABASE MODELS — imported from models/ package
# ==============================================================================
# Exoplanet, RetrainingLog, and User models are defined in backend/models/
# They were imported above: from models import User, UserRole, Exoplanet, RetrainingLog


with app.app_context():
    db.create_all()
    logger.info("Database tables ready (exoplanets, retraining_logs, users)")

    # ── Startup stale-data check ─────────────────────────────────────
    stale_count = (
        Exoplanet.query
        .filter(
            Exoplanet.habitability_probability.isnot(None),
            db.or_(
                Exoplanet.model_version.is_(None),
                Exoplanet.model_version != MODEL_VERSION,
            ),
        )
        .count()
    )
    if stale_count > 0:
        logger.warning(
            "Model version changed — %d planet(s) have stale predictions "
            "(expected '%s'). Run: python recompute_predictions.py",
            stale_count, MODEL_VERSION,
        )
    else:
        logger.info("All predictions match current model version '%s'",
                    MODEL_VERSION)


# ==============================================================================
# 6. HELPERS
# ==============================================================================

def api_response(status: str, message: str, data=None, code: int = 200):
    """Consistent JSON envelope for every response."""
    return jsonify({
        "status": status,
        "message": message,
        "data": data,
    }), code


def validate_input(data: dict) -> tuple[dict | None, str | None, list | None]:
    """
    Validate a single planet input dict.

    Rules:
    - Must not be completely empty (after removing metadata keys)
    - Numeric fields must be numeric (int/float/None)
    - Categorical fields must be in VALID_CATEGORIES (Task 2)
    - None / missing values are ALLOWED (pipeline handles imputation)
    - Provided values are checked against physical constraints
    - Extreme but valid values produce warnings, not rejections (Task 3)

    Returns (cleaned_features_dict, error_message_or_None, warnings_list).
    """
    if not data or not isinstance(data, dict):
        return None, "Input must be a non-empty JSON object", None

    METADATA_KEYS = {"planet_name"}
    features = {k: v for k, v in data.items() if k not in METADATA_KEYS}

    if not features:
        return None, "No feature values provided — input is empty", None

    warnings_list = []
    invalid_fields = []

    for key, value in features.items():
        if value is None:
            continue

        # --- Categorical validation (Task 2) ---
        if isinstance(value, str):
            if key in VALID_CATEGORIES:
                if value not in VALID_CATEGORIES[key]:
                    return None, (
                        f"Invalid category for {key}: '{value}'. "
                        f"Must be one of {VALID_CATEGORIES[key]}"
                    ), None
            elif key not in VALID_CATEGORIES:
                # String value for a non-categorical field → reject.
                # Numeric fields should receive int/float/None, not strings.
                return None, (
                    f"Feature '{key}' must be numeric, got string '{value}'"
                ), None
            continue

        if not isinstance(value, (int, float)):
            return None, (
                f"Feature '{key}' must be numeric or string, "
                f"got {type(value).__name__}"
            ), None

        if isinstance(value, float) and np.isnan(value):
            features[key] = None
            continue

        # --- Physical validity check (hard reject) ---
        if key in PHYSICAL_CONSTRAINTS:
            min_excl, max_incl, msg = PHYSICAL_CONSTRAINTS[key]
            if min_excl is not None and value <= min_excl:
                invalid_fields.append(key)
                return None, (
                    f"Invalid value: {msg} (got {value})"
                ), None
            if max_incl is not None and value > max_incl:
                invalid_fields.append(key)
                return None, (
                    f"Invalid value: {msg} (got {value})"
                ), None

        # --- Realistic range warnings (Task 3 — soft check) ---
        if key in REALISTIC_LIMITS:
            r_min, r_max = REALISTIC_LIMITS[key]
            if value < r_min or value > r_max:
                w = f"{key} value ({value}) is outside realistic range [{r_min}, {r_max}]"
                warnings_list.append(w)
                logger.warning("Soft validation: %s", w)

    return features, None, warnings_list if warnings_list else None


def _derive_star_type(temp) -> str | None:
    """
    Derive detailed spectral type from S_TEMPERATURE.

    This MUST mirror the identical function in train_unified_pipeline.py
    and retrain_pipeline.py so that the feature value at serve time
    matches what the pipeline saw during training (no train/serve skew).
    """
    if temp is None or (isinstance(temp, float) and np.isnan(temp)):
        return None
    if temp > 30000:
        return "O-Type"
    if temp > 10000:
        return "B-Type"
    if temp > 7500:
        return "A-Type"
    if temp > 6000:
        return "F-Type"
    if temp > 5000:
        return "G-Type"
    if temp > 3500:
        return "K-Type"
    if temp > 2500:
        return "M-Type"
    if temp > 1500:
        return "L-Type"
    if temp > 800:
        return "T-Type"
    if temp <= 800:
        return "Y-Type"
    return None


def build_dataframe(features: dict) -> pd.DataFrame:
    """
    Build a single-row DataFrame from the input features dict.

    sklearn's ColumnTransformer requires all columns it was trained on
    to be present in the input DataFrame.  Missing columns are filled
    with NaN — the pipeline's internal imputer handles the actual values.

    Derived features:
        - Derived_S_TYPE is computed from S_TEMPERATURE when not
          explicitly provided.  This mirrors the feature engineering
          applied during training (train/serve parity).

    Task 5: Logs warnings on column mismatches between user input and
    pipeline expectations. Extra features are silently dropped; missing
    features are filled with NaN.
    """
    # --- Derive Derived_S_TYPE from S_TEMPERATURE (train/serve parity) ---
    if "Derived_S_TYPE" not in features or features.get("Derived_S_TYPE") is None:
        s_temp = features.get("S_TEMPERATURE")
        if s_temp is not None:
            derived = _derive_star_type(s_temp)
            if derived is not None:
                features["Derived_S_TYPE"] = derived
                logger.debug(
                    "Derived Derived_S_TYPE='%s' from S_TEMPERATURE=%s",
                    derived, s_temp,
                )

    if PIPELINE_INPUT_COLUMNS is not None:
        expected = set(PIPELINE_INPUT_COLUMNS)
        provided = set(features.keys())

        missing = expected - provided
        extra = provided - expected

        if missing:
            logger.warning(
                "Pipeline input mismatch — missing features (will be NaN-imputed): %s",
                sorted(missing),
            )
        if extra:
            logger.debug(
                "Extra features ignored by pipeline: %s", sorted(extra),
            )

        row = {col: features.get(col, np.nan) for col in PIPELINE_INPUT_COLUMNS}
        return pd.DataFrame([row])
    return pd.DataFrame([features])


def run_prediction(df: pd.DataFrame) -> tuple[list[float], list[int]]:
    """
    Run the pipeline on a DataFrame and return (probabilities, labels).

    Uses predict_proba[:, 1] for the positive-class probability and
    applies the configurable THRESHOLD for the binary label.
    """
    probabilities = pipeline.predict_proba(df)[:, 1]
    threshold = Config.THRESHOLD
    labels = (probabilities >= threshold).astype(int).tolist()
    probabilities = probabilities.tolist()
    return probabilities, labels


def store_planet(data: dict, probability: float = None, label: int = None,
                 is_user_generated: bool = True, user_id: int = None):
    """
    Persist a planet to the database.

    Args:
        data: planet feature dict (must include ``planet_name``).
        probability: predicted habitability probability.
        label: binary habitability label.
        is_user_generated: True when the planet comes from user input
                           (API call), False for dataset-seeded rows.
        user_id: ID of the authenticated user who submitted this planet.
                 None for anonymous/seeded submissions.

    Returns (success: bool, message: str).
    """
    planet_name = data.get("planet_name")
    if not planet_name or not str(planet_name).strip():
        return False, "planet_name is required for storage"

    planet_name = str(planet_name).strip()

    try:
        existing = Exoplanet.query.filter_by(planet_name=planet_name).first()
        if existing:
            return False, f"Planet '{planet_name}' already exists"

        # Build column kwargs from the stored feature set
        feature_kwargs = {}
        for feat in Exoplanet.STORED_FEATURES:
            val = data.get(feat)
            if val is not None:
                try:
                    feature_kwargs[feat] = float(val)
                except (ValueError, TypeError):
                    feature_kwargs[feat] = None
            else:
                feature_kwargs[feat] = None

        planet = Exoplanet(
            planet_name=planet_name,
            habitability_probability=float(probability) if probability is not None else None,
            habitability=int(label) if label is not None else None,
            model_version=MODEL_VERSION if probability is not None else None,
            raw_input_json=json.dumps(data, default=str),
            is_user_generated=is_user_generated,
            created_by_user_id=user_id,
            **feature_kwargs,
        )
        db.session.add(planet)
        db.session.commit()
        logger.info("Stored planet '%s' (prob=%.4f, label=%s, version=%s, user=%s)",
                     planet_name, probability or 0, label, MODEL_VERSION,
                     is_user_generated)
        return True, "Planet stored successfully"

    except Exception as exc:
        db.session.rollback()
        logger.error("DB error storing planet '%s': %s", planet_name, exc)
        return False, f"Database error: {exc}"


# ==============================================================================
# 7. GLOBAL ERROR HANDLERS
# ==============================================================================

@app.errorhandler(400)
def bad_request(error):
    return api_response("error", str(error), code=400)


@app.errorhandler(404)
def not_found(error):
    return api_response("error", "Resource not found", code=404)


@app.errorhandler(405)
def method_not_allowed(error):
    return api_response("error", "Method not allowed", code=405)


@app.errorhandler(500)
def internal_error(error):
    logger.exception("Internal server error")
    return api_response("error", "Internal server error", code=500)


@app.errorhandler(429)
def too_many_requests(error):
    return api_response("error", "Too many requests", code=429)


# ==============================================================================
# 8. API ENDPOINTS
# ==============================================================================

# ---- Root Health Check ----
@app.route("/", methods=["GET"])
def root():
    """Quick root check — confirms backend is running."""
    return api_response(
        "success",
        "ExoHabitAI Backend running",
        {
            "model_type": type(pipeline).__name__,
            "model_version": MODEL_VERSION,
            "threshold": Config.THRESHOLD,
        },
    )


# ---- Detailed Health Check (Task 7) ----
@app.route("/health", methods=["GET"])
def health():
    """
    Comprehensive health check — verifies model, DB connectivity,
    and retraining state.
    """
    # DB connectivity probe
    db_ok = True
    try:
        db.session.execute(db.text("SELECT 1"))
    except Exception:
        db_ok = False

    return api_response(
        "ok" if db_ok else "degraded",
        "Health check",
        {
            "model_loaded": pipeline is not None,
            "model_version": MODEL_VERSION,
            "dataset_version": DATASET_VERSION,
            "db_connected": db_ok,
            "threshold": Config.THRESHOLD,
            "retraining_in_progress": _retrain_status["is_running"],
        },
    )


# ---- PREDICT (prediction only — no DB write) ----
def _process_prediction_item(item: dict, idx: int):
    """
    Shared logic for /predict and /predict_and_store.

    Validates input, builds DataFrame from raw features,
    runs prediction via the unified pipeline, and returns the result dict.

    Returns (result_dict, error_response_or_None).
    """
    # --- Validate ---
    features, err, warnings_list = validate_input(item)
    if err:
        return None, api_response(
            "error",
            f"Validation failed (item {idx}): {err}",
            code=400,
        )

    # --- Build DataFrame & predict ---
    df = build_dataframe(features)
    probabilities, labels = run_prediction(df)

    planet_name = item.get("planet_name", f"Unknown-{idx}")
    prob = probabilities[0]
    label = labels[0]

    logger.info(
        "Prediction — planet=%s  prob=%.6f  label=%d  threshold=%.2f",
        planet_name, prob, label, Config.THRESHOLD,
    )

    result = {
        "planet_name": planet_name,
        "habitability": label,
        "habitability_probability": round(prob, 6),
        "threshold_used": Config.THRESHOLD,
    }
    if warnings_list:
        result["warnings"] = warnings_list
    return result, None


@app.route("/predict", methods=["POST"])
def predict():
    """
    Predict habitability for one or many planets.

    Accepts:
        - single object:  { "planet_name": "...", "P_RADIUS": 1.2, ... }
        - batch array:    [{ ... }, { ... }]

    The pipeline handles all preprocessing internally — send raw values.
    Missing fields are allowed (pipeline imputes them).

    Returns prediction(s) without storing to the database.
    """
    try:
        if not _check_rate_limit():
            return api_response("error", "Rate limit exceeded. Try again shortly.", code=429)

        payload = request.get_json(silent=True)
        if payload is None:
            return api_response("error", "Request body must be valid JSON", code=400)

        # Normalise to a list for uniform processing
        is_batch = isinstance(payload, list)
        items = payload if is_batch else [payload]

        if not items:
            return api_response("error", "Empty input list", code=400)

        results = []
        for idx, item in enumerate(items):
            result, err_resp = _process_prediction_item(item, idx)
            if err_resp is not None:
                return err_resp
            results.append(result)

        return api_response(
            "success",
            "Prediction(s) generated successfully",
            results if is_batch else results[0],
        )

    except Exception as exc:
        logger.exception("Prediction error")
        return api_response("error", f"Prediction failed: {exc}", code=500)


# ---- ADD PLANET (storage only — no prediction) ----
@app.route("/add_planet", methods=["POST"])
def add_planet():
    """
    Store one or many planets in the database (no prediction).

    Accepts:
        - single object:  { "planet_name": "...", "P_RADIUS": 1.2, ... }
        - batch array:    [{ ... }, { ... }]
    """
    try:
        payload = request.get_json(silent=True)
        if payload is None:
            return api_response("error", "Request body must be valid JSON", code=400)

        is_batch = isinstance(payload, list)
        items = payload if is_batch else [payload]

        if not items:
            return api_response("error", "Empty input list", code=400)

        results = []
        for idx, item in enumerate(items):
            features, err, _warnings = validate_input(item)
            if err:
                return api_response(
                    "error",
                    f"Validation failed (item {idx}): {err}",
                    code=400,
                )

            ok, msg = store_planet(item)
            results.append({
                "planet_name": item.get("planet_name", f"Unknown-{idx}"),
                "stored": ok,
                "message": msg,
            })

        return api_response(
            "success",
            "Add planet request processed",
            results if is_batch else results[0],
        )

    except Exception as exc:
        logger.exception("Add planet error")
        return api_response("error", f"Add planet failed: {exc}", code=500)


# ---- PREDICT AND STORE (combined) ----
@app.route("/predict_and_store", methods=["POST"])
def predict_and_store():
    """
    Predict habitability AND store the planet + result in the database.

    Accepts:
        - single object:  { "planet_name": "...", "P_RADIUS": 1.2, ... }
        - batch array:    [{ ... }, { ... }]

    The pipeline handles all preprocessing internally — send raw values.
    """
    try:
        if not _check_rate_limit():
            return api_response("error", "Rate limit exceeded. Try again shortly.", code=429)

        payload = request.get_json(silent=True)
        if payload is None:
            return api_response("error", "Request body must be valid JSON", code=400)

        is_batch = isinstance(payload, list)
        items = payload if is_batch else [payload]

        if not items:
            return api_response("error", "Empty input list", code=400)

        results = []
        for idx, item in enumerate(items):
            result, err_resp = _process_prediction_item(item, idx)
            if err_resp is not None:
                return err_resp

            # Storage is optional — prediction is still returned on DB failure
            ok, msg = store_planet(
                item,
                probability=result["habitability_probability"],
                label=result["habitability"],
            )

            result["stored"] = ok
            result["storage_message"] = msg
            results.append(result)

        return api_response(
            "success",
            "Predict and store completed",
            results if is_batch else results[0],
        )

    except Exception as exc:
        logger.exception("Predict+Store error")
        return api_response("error", f"Predict and store failed: {exc}", code=500)


# ---- PREDICT AND STORE BATCH (Task 7 — bulk insert optimization) ----
@app.route("/predict_and_store_batch", methods=["POST"])
def predict_and_store_batch():
    """
    Optimised batch predict-and-store: validates all items, runs batch
    prediction, and commits all new rows in a single DB transaction.
    """
    try:
        payload = request.get_json(silent=True)
        if payload is None:
            return api_response("error", "Request body must be valid JSON", code=400)
        if not isinstance(payload, list) or not payload:
            return api_response("error", "Payload must be a non-empty JSON array", code=400)

        # --- Validate all items first ---
        validated = []
        for idx, item in enumerate(payload):
            features, err, warnings_list = validate_input(item)
            if err:
                return api_response(
                    "error",
                    f"Validation failed (item {idx}): {err}",
                    code=400,
                )
            validated.append((item, features, warnings_list))

        # --- Build batch DataFrame ---
        dfs = [build_dataframe(feat) for _, feat, _ in validated]
        batch_df = pd.concat(dfs, ignore_index=True)

        # --- Batch predict (single call) ---
        probabilities, labels = run_prediction(batch_df)

        # --- Bulk insert (single commit) ---
        results = []
        for i, (item, features, warnings_list) in enumerate(validated):
            prob = probabilities[i]
            label = labels[i]
            planet_name = item.get("planet_name", f"Unknown-{i}")

            result = {
                "planet_name": planet_name,
                "habitability": label,
                "habitability_probability": round(prob, 6),
                "threshold_used": Config.THRESHOLD,
            }
            if warnings_list:
                result["warnings"] = warnings_list

            # Prepare DB row (don't commit yet)
            pname = str(planet_name).strip()
            existing = Exoplanet.query.filter_by(planet_name=pname).first()
            if existing:
                result["stored"] = False
                result["storage_message"] = f"Planet '{pname}' already exists"
            else:
                feature_kwargs = {}
                for feat in Exoplanet.STORED_FEATURES:
                    val = item.get(feat)
                    if val is not None:
                        try:
                            feature_kwargs[feat] = float(val)
                        except (ValueError, TypeError):
                            feature_kwargs[feat] = None
                    else:
                        feature_kwargs[feat] = None

                planet = Exoplanet(
                    planet_name=pname,
                    habitability_probability=float(prob),
                    habitability=int(label),
                    model_version=MODEL_VERSION,
                    raw_input_json=json.dumps(item, default=str),
                    is_user_generated=True,
                    **feature_kwargs,
                )
                db.session.add(planet)
                result["stored"] = True
                result["storage_message"] = "Planet stored successfully"

            results.append(result)

        # Single commit for all inserts
        try:
            db.session.commit()
        except Exception as exc:
            db.session.rollback()
            logger.error("Batch commit failed: %s", exc)
            return api_response("error", f"Batch storage failed: {exc}", code=500)

        return api_response(
            "success",
            f"Batch predict and store completed ({len(results)} items)",
            results,
        )

    except Exception as exc:
        logger.exception("Batch predict+store error")
        return api_response("error", f"Batch predict and store failed: {exc}", code=500)


# ---- RANK PLANETS (Task 4 — no auto-recompute) ----

@app.route("/rank", methods=["GET"])
def rank_planets():
    """
    Return planets ranked by habitability probability.

    Stale predictions (model_version mismatch) are logged as a warning
    but NOT auto-recomputed here.  Use POST /recompute to update them.

    Query parameters:
        limit  — number of planets to return.
                 "all" or omitted → return everything.
                 integer → return top N.
    """
    try:
        # ── Check for stale predictions (log only, no recompute) ─────
        stale_count = (
            Exoplanet.query
            .filter(
                Exoplanet.habitability_probability.isnot(None),
                db.or_(
                    Exoplanet.model_version.is_(None),
                    Exoplanet.model_version != MODEL_VERSION,
                ),
            )
            .count()
        )
        if stale_count > 0:
            logger.warning(
                "Ranking contains %d stale prediction(s). "
                "POST /recompute to update them.",
                stale_count,
            )

        raw_limit = request.args.get("limit", "all").strip().lower()

        query = (
            Exoplanet.query
            .filter(Exoplanet.habitability_probability.isnot(None))
            .order_by(Exoplanet.habitability_probability.desc())
        )

        if raw_limit != "all":
            try:
                limit_int = int(raw_limit)
                if limit_int < 1:
                    return api_response(
                        "error", "limit must be a positive integer or 'all'",
                        code=400,
                    )
                query = query.limit(limit_int)
            except ValueError:
                return api_response(
                    "error",
                    f"Invalid limit value: '{raw_limit}'. "
                    "Use a positive integer or 'all'.",
                    code=400,
                )

        planets = query.all()

        ranked = [
            {
                "rank": i + 1,
                "planet_name": p.planet_name,
                "habitability_probability": round(p.habitability_probability, 6),
            }
            for i, p in enumerate(planets)
        ]

        return api_response(
            "success",
            f"Planets ranked successfully ({len(ranked)} returned)",
            {
                "model_version": MODEL_VERSION,
                "stale_predictions": stale_count,
                "returned_count": len(ranked),
                "limit_applied": raw_limit,
                "planets": ranked,
            },
        )

    except Exception as exc:
        logger.exception("Ranking error")
        return api_response("error", f"Ranking failed: {exc}", code=500)


# ---- RECOMPUTE STALE PREDICTIONS (Task 4 — dedicated endpoint) ----
@app.route("/recompute", methods=["POST"])
@admin_required()
def recompute_predictions():
    """
    Detect and recompute all stale predictions (model_version mismatch).

    This is the dedicated endpoint for heavy recomputation, moved out of
    /rank to keep the ranking endpoint lightweight.
    """
    import warnings as _warnings

    try:
        stale_planets = (
            Exoplanet.query
            .filter(
                Exoplanet.habitability_probability.isnot(None),
                db.or_(
                    Exoplanet.model_version.is_(None),
                    Exoplanet.model_version != MODEL_VERSION,
                ),
            )
            .all()
        )

        if not stale_planets:
            return api_response(
                "success",
                "No stale predictions found — all up to date",
                {"updated": 0, "model_version": MODEL_VERSION},
            )

        logger.info("Recomputing %d stale prediction(s) …", len(stale_planets))

        records = []
        for planet in stale_planets:
            features = {}
            for feat in Exoplanet.STORED_FEATURES:
                val = getattr(planet, feat, None)
                features[feat] = val if val is not None else np.nan
            if planet.raw_input_json:
                try:
                    raw = json.loads(planet.raw_input_json)
                    for key, val in raw.items():
                        if key not in features and key != "planet_name":
                            features[key] = val
                except (json.JSONDecodeError, TypeError):
                    pass
            records.append(features)

        df = pd.DataFrame(records)

        # --- Derive Derived_S_TYPE (train/serve parity) ---
        if "S_TEMPERATURE" in df.columns:
            if "Derived_S_TYPE" not in df.columns:
                df["Derived_S_TYPE"] = df["S_TEMPERATURE"].apply(_derive_star_type)
            else:
                # Fill only where Derived_S_TYPE is missing but S_TEMPERATURE is available
                mask = df["Derived_S_TYPE"].isna() & df["S_TEMPERATURE"].notna()
                df.loc[mask, "Derived_S_TYPE"] = df.loc[mask, "S_TEMPERATURE"].apply(_derive_star_type)

        if PIPELINE_INPUT_COLUMNS is not None:
            for col in PIPELINE_INPUT_COLUMNS:
                if col not in df.columns:
                    df[col] = np.nan

        with _warnings.catch_warnings():
            _warnings.simplefilter("ignore")
            probs = pipeline.predict_proba(df)[:, 1]

        threshold = Config.THRESHOLD
        for i, planet in enumerate(stale_planets):
            planet.habitability_probability = float(probs[i])
            planet.habitability = int(probs[i] >= threshold)
            planet.model_version = MODEL_VERSION

        db.session.commit()
        logger.info(
            "Recompute complete — %d planet(s) updated to version '%s'",
            len(stale_planets), MODEL_VERSION,
        )

        return api_response(
            "success",
            f"Recomputed {len(stale_planets)} stale prediction(s)",
            {"updated": len(stale_planets), "model_version": MODEL_VERSION},
        )

    except Exception as exc:
        db.session.rollback()
        logger.exception("Recompute error")
        return api_response("error", f"Recompute failed: {exc}", code=500)


# ---- STATS (dashboard summary) ----
@app.route("/stats", methods=["GET"])
def stats():
    """
    Return aggregate statistics about the stored planets.

    Useful for frontend dashboards: total count, habitable count,
    user-generated count, etc.
    """
    try:
        total = Exoplanet.query.count()
        with_prediction = (
            Exoplanet.query
            .filter(Exoplanet.habitability_probability.isnot(None))
            .count()
        )
        habitable = (
            Exoplanet.query
            .filter(Exoplanet.habitability == 1)
            .count()
        )
        user_generated = (
            Exoplanet.query
            .filter(Exoplanet.is_user_generated.is_(True))
            .count()
        )

        return api_response(
            "success",
            "Database statistics retrieved",
            {
                "total_planets": total,
                "with_prediction": with_prediction,
                "habitable": habitable,
                "non_habitable": with_prediction - habitable,
                "user_generated": user_generated,
                "dataset_seeded": total - user_generated,
                "threshold": Config.THRESHOLD,
            },
        )

    except Exception as exc:
        logger.exception("Stats error")
        return api_response("error", f"Stats retrieval failed: {exc}", code=500)


# ---- TRIGGER RETRAINING (Tasks 1,2,3,4,6 — async, validated, audited) ----

def _run_retraining_background(reason: str, requested_by: str):
    """
    Background worker that performs the actual retraining.

    Runs in a daemon thread so the API returns immediately.
    Uses _retrain_lock to prevent concurrent runs and updates
    _retrain_status so /retraining_status can report progress.

    Task 2: Compares new-model F1/ROC-AUC against the current model.
             Only replaces the .pkl if the new model meets the tolerance.
    Task 3: Logs every run (success / rejected / failed) to RetrainingLog.
    Task 4: Records the dataset version hash for traceability.
    """
    global pipeline, PIPELINE_INPUT_COLUMNS, MODEL_VERSION

    _retrain_status["is_running"] = True
    _retrain_status["last_started"] = datetime.now(timezone.utc).isoformat()
    previous_version = MODEL_VERSION

    try:
        from retrain_pipeline import retrain

        # --- Capture current model's F1 for comparison (Task 2) ---
        # We read the last *successful* retraining log to get old F1.
        old_f1 = None
        old_roc = None
        with app.app_context():
            last_success = (
                RetrainingLog.query
                .filter_by(status="success")
                .order_by(RetrainingLog.timestamp.desc())
                .first()
            )
            if last_success:
                old_f1 = last_success.f1_score
                old_roc = last_success.roc_auc

        # --- Run the actual retraining ---
        result = retrain(dry_run=False)

        new_metrics = result.get("metrics", {})
        new_f1 = new_metrics.get("f1")
        new_roc = new_metrics.get("roc_auc")

        with app.app_context():
            # --- Task 2: Performance validation ---
            if old_f1 is not None and new_f1 is not None:
                tolerance = Config.RETRAIN_F1_TOLERANCE
                if new_f1 < (old_f1 - tolerance):
                    logger.warning(
                        "New model F1 (%.4f) is below threshold (old=%.4f, tol=%.4f). "
                        "Keeping old model.",
                        new_f1, old_f1, tolerance,
                    )
                    # Restore backup — the retrain script renamed old → backup
                    import glob
                    backups = sorted(
                        glob.glob(Config.MODEL_PATH.replace(".pkl", "_backup_*.pkl")),
                        reverse=True,
                    )
                    if backups:
                        import shutil
                        shutil.copy2(backups[0], Config.MODEL_PATH)
                        logger.info("Restored previous pipeline from: %s", backups[0])

                    # Log the rejected run
                    log_entry = RetrainingLog(
                        status="rejected",
                        model_version=result.get("new_model_version"),
                        previous_model_version=previous_version,
                        dataset_version=DATASET_VERSION,
                        dataset_size=result.get("total_dataset_size"),
                        user_data_count=result.get("user_planets_included", 0),
                        accuracy=new_metrics.get("accuracy"),
                        f1_score=new_f1,
                        roc_auc=new_roc,
                        pr_auc=new_metrics.get("pr_auc"),
                        reason=reason,
                        requested_by=requested_by,
                        details=json.dumps({
                            "old_f1": old_f1, "old_roc_auc": old_roc,
                            "rejection_reason": "F1 below tolerance",
                        }),
                    )
                    db.session.add(log_entry)
                    db.session.commit()

                    _retrain_status["last_result"] = {
                        "status": "rejected",
                        "message": "New model did not meet performance threshold. Old model retained.",
                        "new_f1": new_f1,
                        "old_f1": old_f1,
                        "tolerance": tolerance,
                    }
                    return

            # --- Reload pipeline into memory ---
            new_pipeline, new_columns, new_version = load_pipeline(Config.MODEL_PATH)
            pipeline = new_pipeline
            PIPELINE_INPUT_COLUMNS = new_columns
            MODEL_VERSION = new_version

            logger.info("Pipeline hot-reloaded — new version: %s", MODEL_VERSION)

            # --- Task 3: Log the successful run ---
            log_entry = RetrainingLog(
                status="success",
                model_version=new_version,
                previous_model_version=previous_version,
                dataset_version=DATASET_VERSION,
                dataset_size=result.get("total_dataset_size"),
                user_data_count=result.get("user_planets_included", 0),
                accuracy=new_metrics.get("accuracy"),
                f1_score=new_f1,
                roc_auc=new_roc,
                pr_auc=new_metrics.get("pr_auc"),
                reason=reason,
                requested_by=requested_by,
                details=json.dumps(new_metrics),
            )
            db.session.add(log_entry)
            db.session.commit()

            _retrain_status["last_result"] = {
                "status": "success",
                "new_model_version": new_version,
                "metrics": new_metrics,
            }

    except Exception as exc:
        logger.exception("Background retraining failed")

        try:
            with app.app_context():
                log_entry = RetrainingLog(
                    status="failed",
                    previous_model_version=previous_version,
                    dataset_version=DATASET_VERSION,
                    reason=reason,
                    requested_by=requested_by,
                    details=json.dumps({"error": str(exc)}),
                )
                db.session.add(log_entry)
                db.session.commit()
        except Exception as db_exc:
            logger.warning(
                "Could not write failure log to DB (DB may be unavailable): %s",
                db_exc,
            )

        _retrain_status["last_result"] = {
            "status": "failed",
            "error": str(exc),
        }


    finally:
        _retrain_status["is_running"] = False
        _retrain_status["last_completed"] = datetime.now(timezone.utc).isoformat()


@app.route("/trigger_retraining", methods=["POST"])
@admin_required()
def trigger_retraining():
    """
    Trigger model retraining in a background thread.

    Returns immediately with status 'accepted'. Use GET /retraining_status
    to poll for completion.

    Rate-limited, admin-only, and protected against concurrent runs.
    """
    try:
        if not _check_rate_limit():
            return api_response("error", "Rate limit exceeded. Try again shortly.", code=429)

        payload = request.get_json(silent=True) or {}
        reason = payload.get("reason", "manual trigger")
        # Use the authenticated admin's identity from the JWT for audit trails
        # instead of trusting a client-supplied value.
        from flask_jwt_extended import get_jwt
        claims = get_jwt()
        requested_by = claims.get("username", "admin")

        # --- Prevent concurrent retraining (Task 1) ---
        if not _retrain_lock.acquire(blocking=False):
            return api_response(
                "error",
                "Retraining already in progress. Check GET /retraining_status.",
                code=409,
            )

        user_generated_count = (
            Exoplanet.query
            .filter(Exoplanet.is_user_generated.is_(True))
            .count()
        )

        logger.info(
            "Retraining accepted — reason='%s', by='%s', "
            "user_generated_planets=%d",
            reason, requested_by, user_generated_count,
        )

        # --- Launch background thread ---
        def _worker():
            try:
                _run_retraining_background(reason, requested_by)
            finally:
                # Guard against releasing an already-unlocked lock.
                # This can happen in tests when conftest resets the lock
                # between test functions while a daemon thread is still running.
                try:
                    _retrain_lock.release()
                except RuntimeError:
                    pass

        thread = threading.Thread(target=_worker, daemon=True)
        thread.start()

        return api_response(
            "accepted",
            "Retraining started in background",
            {
                "reason": reason,
                "requested_by": requested_by,
                "user_generated_planets_available": user_generated_count,
                "poll_status_at": "/retraining_status",
            },
            code=202,
        )

    except Exception as exc:
        # Release lock if we acquired it but failed before thread launch
        if _retrain_lock.locked():
            try:
                _retrain_lock.release()
            except RuntimeError:
                pass
        logger.exception("Trigger retraining error")
        return api_response(
            "error", f"Trigger retraining failed: {exc}", code=500,
        )


# ---- RETRAINING STATUS (Task 1) ----
@app.route("/retraining_status", methods=["GET"])
def retraining_status():
    """Poll the current retraining job status."""
    return api_response(
        "success",
        "Retraining status retrieved",
        {
            "is_running": _retrain_status["is_running"],
            "last_started": _retrain_status["last_started"],
            "last_completed": _retrain_status["last_completed"],
            "last_result": _retrain_status["last_result"],
            "current_model_version": MODEL_VERSION,
        },
    )


# ---- RETRAINING LOGS (Task 3) ----
@app.route("/retraining_logs", methods=["GET"])
@admin_required()
def retraining_logs():
    """Return the audit trail of all retraining runs."""
    try:
        limit = request.args.get("limit", "20")
        try:
            limit_int = int(limit)
        except ValueError:
            limit_int = 20

        logs = (
            RetrainingLog.query
            .order_by(RetrainingLog.timestamp.desc())
            .limit(limit_int)
            .all()
        )

        entries = [
            {
                "id": log.id,
                "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                "status": log.status,
                "model_version": log.model_version,
                "previous_model_version": log.previous_model_version,
                "dataset_version": log.dataset_version,
                "dataset_size": log.dataset_size,
                "user_data_count": log.user_data_count,
                "accuracy": log.accuracy,
                "f1_score": log.f1_score,
                "roc_auc": log.roc_auc,
                "pr_auc": log.pr_auc,
                "reason": log.reason,
                "requested_by": log.requested_by,
            }
            for log in logs
        ]

        return api_response(
            "success",
            f"Retrieved {len(entries)} retraining log(s)",
            entries,
        )

    except Exception as exc:
        logger.exception("Retraining logs error")
        return api_response("error", f"Failed to retrieve logs: {exc}", code=500)


# ==============================================================================
# 9. ENTRY POINT
# ==============================================================================

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.getenv("PORT", "5000")),
        debug=Config.DEBUG,
    )

