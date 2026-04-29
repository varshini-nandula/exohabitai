"""
ExoHabitAI Backend — Production-Ready Flask API
=================================================
Pipeline-aware, env-secured, batch-ready ML deployment.

Key design decisions:
- The pipeline includes ALL preprocessing (imputation, clipping, encoding,
  scaling, feature selection, SMOTE, classifier).  The backend sends **raw**
  input directly — no manual feature engineering or alignment.
- Missing values are allowed — the pipeline handles imputation internally.
- Threshold is configurable via THRESHOLD env var (default 0.5).
- All responses follow a consistent JSON envelope.
- Physical-validity checks reject impossible inputs without blocking NaN.
"""

import os
import sys
import json
import logging
from datetime import datetime, timezone

# Ensure custom_transformers (QuantileClipper) is importable when
# joblib deserialises the pipeline .pkl file.
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)


import numpy as np
import pandas as pd
import joblib
from dotenv import load_dotenv
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy

# ==============================================================================
# 1. CONFIGURATION
# ==============================================================================

load_dotenv()  # loads .env from the backend directory

class Config:
    """Centralised configuration — every tuneable value comes from the env."""
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", "sqlite:///exoplanets.db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-prod")
    DEBUG = os.getenv("DEBUG", "false").lower() in ("true", "1", "yes")
    MODEL_PATH = os.getenv("MODEL_PATH", "artifacts/habitability_pipeline.pkl")
    THRESHOLD = float(os.getenv("THRESHOLD", "0.5"))


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
db = SQLAlchemy(app)


# ==============================================================================
# 4. MODEL LOADING (pipeline-aware)
# ==============================================================================

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

    return pipeline, input_columns


pipeline, PIPELINE_INPUT_COLUMNS = load_pipeline(Config.MODEL_PATH)


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


# ==============================================================================
# 5. DATABASE MODEL
# ==============================================================================

class Exoplanet(db.Model):
    """
    Stores planet data + prediction results.

    Only the 9 baseline physical features are persisted as named columns
    (for ranking/querying convenience). Raw input JSON is stored separately
    so full-feature pipelines can still be audited.
    """
    __tablename__ = "exoplanets"

    id = db.Column(db.Integer, primary_key=True)
    planet_name = db.Column(db.String(150), unique=True, nullable=False)

    # Baseline physical features (always stored when available)
    P_RADIUS = db.Column(db.Float)
    P_MASS = db.Column(db.Float)
    P_DENSITY = db.Column(db.Float)
    P_TEMP_SURF = db.Column(db.Float)
    P_PERIOD = db.Column(db.Float)
    P_SEMI_MAJOR_AXIS = db.Column(db.Float)
    S_TEMPERATURE = db.Column(db.Float)
    S_LUMINOSITY = db.Column(db.Float)
    S_METALLICITY = db.Column(db.Float)

    # Prediction outputs
    habitability_probability = db.Column(db.Float)
    habitability = db.Column(db.Integer)

    # Audit & continuous learning (Task 7)
    raw_input_json = db.Column(db.Text)       # full input payload
    is_user_generated = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Columns that map to DB fields for dynamic storage
    STORED_FEATURES = [
        "P_RADIUS", "P_MASS", "P_DENSITY", "P_TEMP_SURF",
        "P_PERIOD", "P_SEMI_MAJOR_AXIS",
        "S_TEMPERATURE", "S_LUMINOSITY", "S_METALLICITY",
    ]


with app.app_context():
    db.create_all()
    logger.info("Database tables ready")


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


def validate_input(data: dict) -> tuple[dict | None, str | None]:
    """
    Validate a single planet input dict.

    Rules:
    - Must not be completely empty (after removing metadata keys)
    - Numeric fields must be numeric (int/float/None)
    - String fields are accepted as-is (for categorical inputs)
    - None / missing values are ALLOWED (pipeline handles imputation)
    - Provided values are checked against physical constraints

    Returns (cleaned_features_dict, error_message).
    """
    if not data or not isinstance(data, dict):
        return None, "Input must be a non-empty JSON object"

    # Keys that are metadata, not features
    METADATA_KEYS = {"planet_name"}

    # Separate metadata from features
    features = {k: v for k, v in data.items() if k not in METADATA_KEYS}

    if not features:
        return None, "No feature values provided — input is empty"

    # Type validation + physical constraint checking
    for key, value in features.items():
        if value is None:
            continue  # missing values are OK

        if isinstance(value, str):
            # Accept strings for categorical features
            continue

        if not isinstance(value, (int, float)):
            return None, (
                f"Feature '{key}' must be numeric or string, "
                f"got {type(value).__name__}"
            )

        if isinstance(value, float) and np.isnan(value):
            features[key] = None  # normalise NaN → None
            continue

        # --- Physical validity check ---
        if key in PHYSICAL_CONSTRAINTS:
            min_excl, max_incl, msg = PHYSICAL_CONSTRAINTS[key]
            if min_excl is not None and value <= min_excl:
                return None, f"Invalid value: {msg} (got {value})"
            if max_incl is not None and value > max_incl:
                return None, f"Invalid value: {msg} (got {value})"

    return features, None


def build_dataframe(features: dict) -> pd.DataFrame:
    """
    Build a single-row DataFrame from the input features dict.

    sklearn's ColumnTransformer requires all columns it was trained on
    to be present in the input DataFrame.  Missing columns are filled
    with NaN — the pipeline's internal imputer handles the actual values.

    No manual preprocessing, encoding, scaling, or feature ordering is
    performed here.
    """
    if PIPELINE_INPUT_COLUMNS is not None:
        # Ensure every required column exists; missing → NaN
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
                 is_user_generated: bool = True):
    """
    Persist a planet to the database.

    Args:
        data: planet feature dict (must include ``planet_name``).
        probability: predicted habitability probability.
        label: binary habitability label.
        is_user_generated: True when the planet comes from user input
                           (API call), False for dataset-seeded rows.

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
            raw_input_json=json.dumps(data, default=str),
            is_user_generated=is_user_generated,
            **feature_kwargs,
        )
        db.session.add(planet)
        db.session.commit()
        logger.info("Stored planet '%s' (prob=%.4f, label=%s, user=%s)",
                     planet_name, probability or 0, label, is_user_generated)
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


# ==============================================================================
# 8. API ENDPOINTS
# ==============================================================================

# ---- Health Check ----
@app.route("/", methods=["GET"])
def health():
    """Health check — confirms backend + model are ready."""
    return api_response(
        "success",
        "ExoHabitAI Backend running",
        {
            "model_type": type(pipeline).__name__,
            "threshold": Config.THRESHOLD,
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
    features, err = validate_input(item)
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
            features, err = validate_input(item)
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


# ---- RANK PLANETS ----
@app.route("/rank", methods=["GET"])
def rank_planets():
    """
    Return planets ranked by habitability probability.

    Query parameters:
        limit  — number of planets to return.
                 "all" or omitted → return everything.
                 integer → return top N.
    """
    try:
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

        # Total count (useful for frontend to know the full dataset size)
        total_count = (
            Exoplanet.query
            .filter(Exoplanet.habitability_probability.isnot(None))
            .count()
        )

        ranked = [
            {
                "rank": i + 1,
                "planet_name": p.planet_name,
                "habitability_probability": round(p.habitability_probability, 6),
                "habitability": p.habitability,
                "is_user_generated": p.is_user_generated,
            }
            for i, p in enumerate(planets)
        ]

        return api_response(
            "success",
            f"Planets ranked successfully ({len(ranked)} returned)",
            {
                "total_count": total_count,
                "returned_count": len(ranked),
                "limit_applied": raw_limit,
                "planets": ranked,
            },
        )

    except Exception as exc:
        logger.exception("Ranking error")
        return api_response("error", f"Ranking failed: {exc}", code=500)


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


# ---- TRIGGER RETRAINING (Task 7 — async job queue placeholder) ----
@app.route("/trigger_retraining", methods=["POST"])
def trigger_retraining():
    """
    Log / queue a model retraining request.

    This endpoint does NOT perform real-time training. It records the
    request so that an offline process (cron, Celery, manual run) can
    pick it up later. This prevents blocking the backend.
    """
    try:
        payload = request.get_json(silent=True) or {}
        reason = payload.get("reason", "manual trigger")
        requested_by = payload.get("requested_by", "unknown")

        user_generated_count = (
            Exoplanet.query
            .filter(Exoplanet.is_user_generated.is_(True))
            .count()
        )

        logger.info(
            "Retraining requested — reason='%s', by='%s', "
            "user_generated_planets=%d",
            reason, requested_by, user_generated_count,
        )

        return api_response(
            "success",
            "Retraining request logged successfully",
            {
                "queued": True,
                "reason": reason,
                "requested_by": requested_by,
                "user_generated_planets_available": user_generated_count,
                "note": (
                    "Model retraining is performed offline. "
                    "Use export_training_data.py to generate the dataset, "
                    "then retrain with your notebook/pipeline."
                ),
            },
        )

    except Exception as exc:
        logger.exception("Trigger retraining error")
        return api_response(
            "error", f"Trigger retraining failed: {exc}", code=500,
        )


# ==============================================================================
# 9. ENTRY POINT
# ==============================================================================

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.getenv("PORT", "5000")),
        debug=Config.DEBUG,
    )
