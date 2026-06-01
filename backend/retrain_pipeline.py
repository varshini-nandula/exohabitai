"""
ExoHabitAI — Retrain Pipeline Script
======================================
Loads the original dataset (planetsdata.csv), extracts user-generated data
from the database, merges both datasets, applies the SAME preprocessing
as the original training pipeline, retrains the unified pipeline, and
saves the updated .pkl artifact.

This script is intended to be called from the /trigger_retraining endpoint
or run standalone.

Usage:
    cd backend
    python retrain_pipeline.py
    python retrain_pipeline.py --dry-run    # evaluate only, don't save
"""

import os
import sys
import json
import hashlib
import logging
import warnings
import argparse
from datetime import datetime

import numpy as np
import pandas as pd
import joblib

# Ensure project root is on sys.path for custom_transformers import
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

from custom_transformers import QuantileClipper  # noqa: E402

from sklearn.impute import SimpleImputer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.feature_selection import VarianceThreshold
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_validate
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, average_precision_score, confusion_matrix,
)
from imblearn.pipeline import Pipeline as ImbPipeline
from imblearn.over_sampling import SMOTE

warnings.filterwarnings("ignore")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("exohabitai.retrain")

# ============================================================================
# 1. CONFIGURATION  (mirrors train_unified_pipeline.py)
# ============================================================================

DATA_PATH = os.path.join(_PROJECT_ROOT, "planetsdata.csv")
ARTIFACT_DIR = os.path.join(_PROJECT_ROOT, "backend", "artifacts")
PIPELINE_PATH = os.path.join(ARTIFACT_DIR, "habitability_pipeline.pkl")

TARGET = "P_HABITABLE_BINARY"
RANDOM_STATE = 42

# Columns to drop — same rules as train_unified_pipeline.py
def _error_limit_cols(df):
    return [c for c in df.columns
            if "_ERROR_MIN" in c or "_ERROR_MAX" in c or "_LIMIT" in c]

UNNECESSARY_COLUMNS = [
    "S_NAME", "S_NAME_HD", "S_NAME_HIP",
    "P_DETECTION", "P_DISCOVERY_FACILITY",
    "P_YEAR", "P_UPDATE",
    "S_RA", "S_DEC", "S_RA_STR", "S_DEC_STR",
    "S_RA_TXT", "S_DEC_TXT",
    "S_CONSTELLATION", "S_CONSTELLATION_ABR", "S_CONSTELLATION_ENG",
    "P_OMEGA", "P_MASS_ORIGIN",
]

LEAKAGE_COLUMNS = [
    "P_ESI",
    "P_HABZONE_OPT", "P_HABZONE_CON",
    "S_HZ_OPT_MIN", "S_HZ_OPT_MAX",
    "S_HZ_CON_MIN", "S_HZ_CON_MAX",
    "S_HZ_CON0_MIN", "S_HZ_CON0_MAX",
    "S_HZ_CON1_MIN", "S_HZ_CON1_MAX",
    "S_ABIO_ZONE", "S_SNOW_LINE", "S_TIDAL_LOCK",
    "P_DISTANCE_EFF",
    "P_TYPE_TEMP",
]

REDUNDANT_COLUMNS = [
    "P_TEMP_EQUIL_MIN", "P_TEMP_EQUIL_MAX",
    "P_TEMP_SURF_MIN", "P_TEMP_SURF_MAX",
    "P_FLUX_MIN", "P_FLUX_MAX",
    "P_ECCENTRICITY_MIN",
    "P_INCLINATIONR_MIN",
]


# ============================================================================
# 2. FEATURE ENGINEERING  (same as train_unified_pipeline.py)
# ============================================================================

def derive_star_type(temp):
    """Derive detailed spectral type from S_TEMPERATURE."""
    if pd.isna(temp):
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
    return None  # unreachable — all numeric temps are handled above


def prepare_dataframe(path: str) -> pd.DataFrame:
    """Load CSV, drop columns, create target, engineer features."""
    df = pd.read_csv(path)
    logger.info("Raw data shape: %s", df.shape)

    # Drop error / limit columns
    cols_to_drop = _error_limit_cols(df)
    df.drop(columns=cols_to_drop, inplace=True, errors="ignore")

    # Drop unnecessary metadata
    df.drop(columns=UNNECESSARY_COLUMNS, inplace=True, errors="ignore")

    # Drop leakage columns
    df.drop(columns=LEAKAGE_COLUMNS, inplace=True, errors="ignore")

    # Drop redundant MIN/MAX
    df.drop(columns=REDUNDANT_COLUMNS, inplace=True, errors="ignore")

    # Create binary target
    df[TARGET] = df["P_HABITABLE"].apply(lambda x: 1 if x in [1, 2] else 0)
    df.drop(columns=["P_HABITABLE"], inplace=True)

    # Derive star type from temperature
    df["Derived_S_TYPE"] = df["S_TEMPERATURE"].apply(derive_star_type)
    df.drop(columns=["S_TYPE"], inplace=True, errors="ignore")

    logger.info("Cleaned data shape: %s", df.shape)
    logger.info("Class distribution:\n%s", df[TARGET].value_counts())
    return df


# ============================================================================
# 3. EXTRACT USER DATA FROM DB
# ============================================================================

def extract_user_data() -> pd.DataFrame:
    """
    Extract user-generated planets from the database.

    Uses raw_input_json to recover the full feature set that was sent
    during prediction.  Also uses stored DB columns as fallback.

    Returns a DataFrame with a P_HABITABLE_BINARY column derived from
    the stored prediction label.
    """
    from app import app, db, Exoplanet

    with app.app_context():
        user_planets = (
            Exoplanet.query
            .filter(Exoplanet.is_user_generated.is_(True))
            .all()
        )

        if not user_planets:
            logger.info("No user-generated planets found in DB")
            return pd.DataFrame()

        records = []
        for planet in user_planets:
            record = {"P_NAME": planet.planet_name}

            # Start with stored DB columns
            for feat in Exoplanet.STORED_FEATURES:
                val = getattr(planet, feat, None)
                record[feat] = val if val is not None else np.nan

            # Overlay with full raw input (contains ALL features sent)
            if planet.raw_input_json:
                try:
                    raw = json.loads(planet.raw_input_json)
                    for key, val in raw.items():
                        if key in ("planet_name", "default_strategy"):
                            continue
                        if val is not None:
                            record[key] = val
                except (json.JSONDecodeError, TypeError):
                    pass

            # Use stored prediction as the target label
            if planet.habitability is not None:
                record[TARGET] = int(planet.habitability)
            elif planet.habitability_probability is not None:
                record[TARGET] = int(planet.habitability_probability >= 0.5)
            else:
                # Cannot use for training without a label — skip
                logger.warning(
                    "Skipping planet '%s': no habitability label available",
                    planet.planet_name,
                )
                continue

            records.append(record)

        df = pd.DataFrame(records)
        logger.info("Extracted %d user-generated planets from DB", len(df))
        return df


# ============================================================================
# 4. BUILD PIPELINE  (same architecture as train_unified_pipeline.py)
# ============================================================================

def build_unified_pipeline(numerical_cols, categorical_cols, use_smote=True):
    """Build the same ImbPipeline used by the original training script."""

    num_pipeline = Pipeline(steps=[
        ("imputer",    SimpleImputer(strategy="median")),
        ("clipper",    QuantileClipper(lower_q=0.05, upper_q=0.95)),
        ("scaler",     StandardScaler()),
        ("var_thresh", VarianceThreshold(threshold=0.01)),
    ])

    cat_pipeline = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("encoder", OneHotEncoder(sparse_output=False, handle_unknown="ignore")),
    ])

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", num_pipeline, numerical_cols),
            ("cat", cat_pipeline, categorical_cols),
        ],
        remainder="drop",
    )

    smote_step = [
        ("smote", SMOTE(
            sampling_strategy=0.3, k_neighbors=5, random_state=RANDOM_STATE
        ))
    ] if use_smote else []

    pipeline = ImbPipeline(steps=[
        ("preprocessor", preprocessor),
    ] + smote_step + [
        ("classifier", RandomForestClassifier(
            n_estimators=400, max_depth=8, min_samples_leaf=10,
            class_weight=None if use_smote else "balanced_subsample",
            random_state=RANDOM_STATE, n_jobs=-1,
        )),
    ])

    return pipeline


# ============================================================================
# 5. COMPUTE MODEL HASH
# ============================================================================

def compute_model_hash(path: str) -> str:
    """Compute MD5 hash of a .pkl file for version tracking."""
    md5 = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            md5.update(chunk)
    return md5.hexdigest()[:12]


# ============================================================================
# 6. MAIN RETRAIN FUNCTION
# ============================================================================

def retrain(dry_run: bool = False) -> dict:
    """
    Full retraining pipeline:

    1. Load original dataset + apply same cleaning/feature engineering
    2. Extract user-generated data from DB
    3. Merge datasets
    4. Train/test split
    5. Build & train unified pipeline
    6. Evaluate on held-out test set
    7. Save new .pkl artifact (unless dry_run)

    Returns a summary dict with metrics and new model version.
    """
    # ── 1. Load & prepare original dataset ───────────────────────────
    if not os.path.isfile(DATA_PATH):
        raise FileNotFoundError(f"Original dataset not found: {DATA_PATH}")

    original_df = prepare_dataframe(DATA_PATH)
    logger.info("Original dataset: %d rows", len(original_df))

    # ── 2. Extract user data from DB ─────────────────────────────────
    user_df = extract_user_data()

    # ── 3. Merge datasets ────────────────────────────────────────────
    if not user_df.empty:
        # Ensure user data has matching columns — missing ones → NaN
        for col in original_df.columns:
            if col not in user_df.columns:
                user_df[col] = np.nan

        # Apply Derived_S_TYPE to user data if they have S_TEMPERATURE
        if "S_TEMPERATURE" in user_df.columns and "Derived_S_TYPE" not in user_df.columns:
            user_df["Derived_S_TYPE"] = user_df["S_TEMPERATURE"].apply(derive_star_type)

        # Deduplicate by P_NAME (user data takes priority)
        if "P_NAME" in original_df.columns and "P_NAME" in user_df.columns:
            user_names = set(user_df["P_NAME"].dropna().str.strip())
            original_df = original_df[
                ~original_df["P_NAME"].str.strip().isin(user_names)
            ]

        combined_df = pd.concat([original_df, user_df], ignore_index=True)
        logger.info(
            "Merged dataset: %d rows (%d original + %d user)",
            len(combined_df), len(original_df), len(user_df),
        )
    else:
        combined_df = original_df
        logger.info("No user data — retraining on original dataset only (%d rows)",
                     len(combined_df))

    # ── 4. Prepare features and target ───────────────────────────────
    X = combined_df.drop(columns=[TARGET, "P_NAME"], errors="ignore")
    y = combined_df[TARGET]

    numerical_cols = X.select_dtypes(include=["number"]).columns.tolist()
    categorical_cols = X.select_dtypes(exclude=["number"]).columns.tolist()

    logger.info("Numerical features (%d): %s", len(numerical_cols), numerical_cols)
    logger.info("Categorical features (%d): %s", len(categorical_cols), categorical_cols)

    # ── 5. Train / Test split ────────────────────────────────────────
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=RANDOM_STATE, stratify=y,
    )
    logger.info("Train: %d samples, Test: %d samples", len(X_train), len(X_test))

    # ── 6. Build & train pipeline ────────────────────────────────────
    new_pipeline = build_unified_pipeline(
        numerical_cols, categorical_cols, use_smote=True,
    )
    new_pipeline.fit(X_train, y_train)
    logger.info("Pipeline training complete")

    # ── 7. Evaluate ──────────────────────────────────────────────────
    y_prob_test = new_pipeline.predict_proba(X_test)[:, 1]
    y_pred_test = (y_prob_test >= 0.5).astype(int)

    metrics = {
        "accuracy":  round(accuracy_score(y_test, y_pred_test), 4),
        "precision": round(precision_score(y_test, y_pred_test, zero_division=0), 4),
        "recall":    round(recall_score(y_test, y_pred_test, zero_division=0), 4),
        "f1":        round(f1_score(y_test, y_pred_test, zero_division=0), 4),
        "roc_auc":   round(roc_auc_score(y_test, y_prob_test), 4),
        "pr_auc":    round(average_precision_score(y_test, y_prob_test), 4),
    }

    logger.info("Evaluation metrics: %s", metrics)

    cm = confusion_matrix(y_test, y_pred_test)
    logger.info("Confusion matrix:\n%s", cm)

    # ── 8. Save (unless dry run) ─────────────────────────────────────
    if dry_run:
        logger.info("DRY RUN — pipeline NOT saved")
        return {
            "status": "dry_run",
            "metrics": metrics,
            "train_size": len(X_train),
            "test_size": len(X_test),
            "user_planets_included": len(user_df) if not user_df.empty else 0,
        }

    os.makedirs(ARTIFACT_DIR, exist_ok=True)

    # Back up the old pipeline
    if os.path.isfile(PIPELINE_PATH):
        backup_name = PIPELINE_PATH.replace(
            ".pkl",
            f"_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pkl",
        )
        os.rename(PIPELINE_PATH, backup_name)
        logger.info("Backed up previous pipeline to: %s", backup_name)

    joblib.dump(new_pipeline, PIPELINE_PATH)
    logger.info("New pipeline saved to: %s", PIPELINE_PATH)

    # Compute new model version hash
    new_hash = compute_model_hash(PIPELINE_PATH)
    new_version = f"v2_pipeline_{new_hash}"
    logger.info("New model version: %s", new_version)

    return {
        "status": "success",
        "new_model_version": new_version,
        "metrics": metrics,
        "train_size": len(X_train),
        "test_size": len(X_test),
        "total_dataset_size": len(combined_df),
        "user_planets_included": len(user_df) if not user_df.empty else 0,
        "pipeline_path": PIPELINE_PATH,
    }


# ============================================================================
# 7. CLI ENTRY POINT
# ============================================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Retrain the ExoHabitAI pipeline with user-generated data"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Train and evaluate but do not save the pipeline",
    )
    args = parser.parse_args()

    result = retrain(dry_run=args.dry_run)
    print("\n── Retraining Summary ──")
    for k, v in result.items():
        print(f"  {k}: {v}")
