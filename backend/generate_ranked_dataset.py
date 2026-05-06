"""
ExoHabitAI — Generate Ranked Dataset
======================================
Recomputes predictions from the training CSV using the latest ML pipeline
and produces a clean, minimal ranking CSV for frontend/backend consumption.

Key design:
  - The unified pipeline includes ALL preprocessing (imputation, encoding,
    scaling, feature selection, SMOTE, classifier) internally.
  - This script simply loads the raw CSV, drops non-feature columns (target,
    identifiers), and passes the raw DataFrame directly to the pipeline.
  - Uses a single batch predict_proba call (no row-by-row loops)
  - Outputs only: planet_name, habitability_probability, habitability, rank

Usage:
    cd backend
    python generate_ranked_dataset.py
    python generate_ranked_dataset.py --threshold 0.6
    python generate_ranked_dataset.py --input ../planetsdata.csv
"""

import sys
import os
import argparse
import warnings
import logging
import time

# ── Suppress noisy sklearn parallel warnings ──────────────────────────────
warnings.filterwarnings("ignore", category=UserWarning, module="sklearn")
os.environ["PYTHONWARNINGS"] = "ignore::UserWarning"

import numpy as np
import pandas as pd

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("exohabitai.ranked")


# ==============================================================================
# COLUMNS TO DROP (identifiers, target, leakage — NOT model features)
# ==============================================================================

# These are the same exclusions applied during training.  They are NOT
# learned transformations — they are domain-knowledge decisions about which
# columns are identifiers, targets, or leakage and must never be fed to the
# pipeline as features.

def _error_limit_cols(df):
    """Identify error/limit columns that are not useful for prediction."""
    return [c for c in df.columns
            if "_ERROR_MIN" in c or "_ERROR_MAX" in c or "_LIMIT" in c]

# Identifiers & discovery metadata
UNNECESSARY_COLUMNS = [
    "S_NAME", "S_NAME_HD", "S_NAME_HIP",
    "P_DETECTION", "P_DISCOVERY_FACILITY",
    "P_YEAR", "P_UPDATE",
    "S_RA", "S_DEC", "S_RA_STR", "S_DEC_STR",
    "S_RA_TXT", "S_DEC_TXT",
    "S_CONSTELLATION", "S_CONSTELLATION_ABR", "S_CONSTELLATION_ENG",
    "P_OMEGA", "P_MASS_ORIGIN",
]

# Leakage features (directly measure or define the target)
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

# Redundant MIN/MAX columns
REDUNDANT_COLUMNS = [
    "P_TEMP_EQUIL_MIN", "P_TEMP_EQUIL_MAX",
    "P_TEMP_SURF_MIN", "P_TEMP_SURF_MAX",
    "P_FLUX_MIN", "P_FLUX_MAX",
    "P_ECCENTRICITY_MIN",
    "P_INCLINATIONR_MIN",
]


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
    return "Unclassified"


# ==============================================================================
# MAIN GENERATION LOGIC
# ==============================================================================

def generate_ranked_dataset(
    input_path: str = "../planetsdata.csv",
    output_path: str = "artifacts/exoplanets_ranked_latest.csv",
    threshold: float = None,
):
    """
    End-to-end: load CSV → drop non-feature columns → batch predict → rank → save.

    The unified pipeline handles all preprocessing (imputation, encoding,
    scaling, feature selection) internally. This script only needs to:
      1. Drop identifier, target, and leakage columns (same as training).
      2. Derive Derived_S_TYPE (deterministic feature engineering, same as training).
      3. Drop the original S_TYPE column (same as training).
      4. Pass the raw feature DataFrame to the pipeline.

    Args:
        input_path:  Path to the raw training CSV.
        output_path: Where to save the ranked output CSV.
        threshold:   Override threshold (defaults to Config.THRESHOLD).
    """
    # ── Import pipeline and config from app.py ────────────────────────
    from app import pipeline, Config, MODEL_VERSION

    if threshold is None:
        threshold = Config.THRESHOLD

    logger.info("=" * 60)
    logger.info("ExoHabitAI — Ranked Dataset Generator")
    logger.info("=" * 60)
    logger.info("Input CSV       : %s", input_path)
    logger.info("Output CSV      : %s", output_path)
    logger.info("Threshold       : %.4f", threshold)
    logger.info("Model version   : %s", MODEL_VERSION)

    # ── Step 1: Load dataset ─────────────────────────────────────────
    if not os.path.isfile(input_path):
        logger.error("Input file not found: %s", input_path)
        sys.exit(1)

    t0 = time.perf_counter()
    raw_df = pd.read_csv(input_path)
    logger.info("Loaded %d rows × %d columns (%.2fs)",
                raw_df.shape[0], raw_df.shape[1], time.perf_counter() - t0)

    # ── Extract planet names before any transforms ────────────────────
    if "P_NAME" in raw_df.columns:
        planet_names = raw_df["P_NAME"].astype(str).values
        logger.info("Planet name column found (P_NAME)")
    elif "planet_name" in raw_df.columns:
        planet_names = raw_df["planet_name"].astype(str).values
        logger.info("Planet name column found (planet_name)")
    else:
        planet_names = [f"Planet-{i+1}" for i in range(len(raw_df))]
        logger.warning("No planet name column — generating generic names")

    # ── Step 2: Drop non-feature columns ─────────────────────────────
    # These are the same drops applied during training.  They remove
    # identifiers, targets, error columns, and leakage features so the
    # pipeline receives only legitimate raw features.

    cols_to_drop = _error_limit_cols(raw_df)
    raw_df.drop(columns=cols_to_drop, inplace=True, errors="ignore")
    raw_df.drop(columns=UNNECESSARY_COLUMNS, inplace=True, errors="ignore")
    raw_df.drop(columns=LEAKAGE_COLUMNS, inplace=True, errors="ignore")
    raw_df.drop(columns=REDUNDANT_COLUMNS, inplace=True, errors="ignore")

    # Drop target columns (we're predicting, not training)
    raw_df.drop(columns=["P_HABITABLE", "P_HABITABLE_BINARY", "P_NAME"],
                inplace=True, errors="ignore")

    # ── Step 3: Derive Derived_S_TYPE (deterministic feature eng) ────
    if "S_TEMPERATURE" in raw_df.columns:
        raw_df["Derived_S_TYPE"] = raw_df["S_TEMPERATURE"].apply(derive_star_type)
        logger.info("Derived Derived_S_TYPE from S_TEMPERATURE")

    # Drop the original S_TYPE column (same as training)
    raw_df.drop(columns=["S_TYPE"], inplace=True, errors="ignore")

    logger.info("Feature matrix shape after cleanup: %s", raw_df.shape)

    # ── Step 4: Batch prediction (single pipeline call) ──────────────
    # The pipeline's internal ColumnTransformer, imputer, encoder, scaler,
    # and classifier all operate on the raw DataFrame at once.
    logger.info("Running batch prediction on %d rows …", len(raw_df))
    t1 = time.perf_counter()

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        probs = pipeline.predict_proba(raw_df)[:, 1]

    pred_time = time.perf_counter() - t1
    logger.info("Batch prediction complete in %.3fs (%.1f rows/sec)",
                pred_time, len(raw_df) / pred_time if pred_time > 0 else float("inf"))

    # ── Step 5: Compute outputs ──────────────────────────────────────
    habitability = (probs >= threshold).astype(int)

    habitable_count = int(habitability.sum())
    logger.info("Results: %d habitable / %d total (%.1f%%) at threshold=%.4f",
                habitable_count, len(raw_df),
                100 * habitable_count / len(raw_df) if len(raw_df) > 0 else 0,
                threshold)

    # ── Step 6: Build output DataFrame + ranking ─────────────────────
    result_df = pd.DataFrame({
        "planet_name": planet_names,
        "habitability_probability": probs,
        "habitability": habitability,
        "model_version": MODEL_VERSION,
    })

    result_df = result_df.sort_values(
        "habitability_probability", ascending=False
    ).reset_index(drop=True)

    result_df["rank"] = range(1, len(result_df) + 1)

    # Final column order
    result_df = result_df[["planet_name", "habitability_probability",
                           "habitability", "rank", "model_version"]]

    # ── Step 7: Save ─────────────────────────────────────────────────
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    result_df.to_csv(output_path, index=False)

    total_time = time.perf_counter() - t0
    logger.info("─" * 60)
    logger.info("Saved ranked dataset: %s", output_path)
    logger.info("  Rows       : %d", len(result_df))
    logger.info("  Columns    : %s", list(result_df.columns))
    logger.info("  Habitable  : %d (%.1f%%)",
                habitable_count,
                100 * habitable_count / len(result_df) if len(result_df) > 0 else 0)
    logger.info("  Total time : %.2fs", total_time)
    logger.info("─" * 60)

    # Show top 10
    print("\n  Top 10 Most Habitable Planets:")
    print("  " + "-" * 55)
    for _, row in result_df.head(10).iterrows():
        print(f"  {int(row['rank']):>4d}. {row['planet_name']:<30s}  "
              f"prob={row['habitability_probability']:.6f}")
    print()


# ==============================================================================
# CLI
# ==============================================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Generate a ranked exoplanet habitability dataset "
                    "from the latest ML pipeline.",
    )
    parser.add_argument(
        "--input", "-i",
        default="../planetsdata.csv",
        help="Path to the raw planets CSV (default: ../planetsdata.csv)",
    )
    parser.add_argument(
        "--output", "-o",
        default="artifacts/exoplanets_ranked_latest.csv",
        help="Output path for the ranked CSV "
             "(default: artifacts/exoplanets_ranked_latest.csv)",
    )
    parser.add_argument(
        "--threshold", "-t",
        type=float,
        default=None,
        help="Habitability threshold (default: uses THRESHOLD from .env / Config)",
    )
    args = parser.parse_args()

    generate_ranked_dataset(
        input_path=args.input,
        output_path=args.output,
        threshold=args.threshold,
    )
