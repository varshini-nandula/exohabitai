"""
ExoHabitAI — Export Training Data for Retraining
==================================================
Combines the original training CSV with new user-generated planets from the
database into a single, clean CSV that can be fed into the ML pipeline for
retraining / fine-tuning.

Output:  backend/artifacts/training_export_{timestamp}.csv

Usage:
    cd backend
    python export_training_data.py
    python export_training_data.py --output my_dataset.csv
    python export_training_data.py --user-only          # export only user planets
"""

import argparse
import json
import logging
import sys
from datetime import datetime

import pandas as pd
import numpy as np

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("exohabitai.export")

# Path to the original training dataset (ranked CSV from the pipeline)
ORIGINAL_CSV = "artifacts/ranked_exoplanets_by_habitability.csv"


def export(output_path: str = None, user_only: bool = False):
    """
    Build a unified training dataset.

    Steps:
        1. Load original CSV (if not user_only).
        2. Query all user-generated planets from the DB.
        3. Recover full feature vectors from ``raw_input_json``.
        4. Merge and deduplicate.
        5. Write to CSV.
    """
    from app import app, db, Exoplanet, PIPELINE_INPUT_COLUMNS

    # ── 1. Original CSV ─────────────────────────────────────────────
    original_df = None
    if not user_only:
        try:
            original_df = pd.read_csv(ORIGINAL_CSV)
            logger.info("Loaded original dataset: %d rows from %s",
                        len(original_df), ORIGINAL_CSV)
            original_df["_source"] = "original_dataset"
        except FileNotFoundError:
            logger.warning("Original CSV not found at %s — skipping",
                           ORIGINAL_CSV)

    # ── 2. User-generated planets from DB ────────────────────────────
    with app.app_context():
        if user_only:
            planets = (
                Exoplanet.query
                .filter(Exoplanet.is_user_generated.is_(True))
                .all()
            )
        else:
            planets = Exoplanet.query.all()

        logger.info("Queried %d planets from database (user_only=%s)",
                     len(planets), user_only)

        if not planets and original_df is None:
            logger.error("No data available to export")
            sys.exit(1)

        # ── 3. Recover features from raw_input_json ──────────────────
        db_records = []
        for planet in planets:
            record = {"P_NAME": planet.planet_name}

            # Start with stored columns
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

            # Prediction columns
            record["Predicted_Habitability_Probability"] = (
                planet.habitability_probability
            )
            record["P_HABITABLE_BINARY"] = planet.habitability
            record["_source"] = (
                "user_generated" if planet.is_user_generated
                else "dataset_seeded"
            )
            record["_is_user_generated"] = planet.is_user_generated
            record["_created_at"] = str(planet.created_at) if planet.created_at else None

            db_records.append(record)

        db_df = pd.DataFrame(db_records)

    # ── 4. Merge ─────────────────────────────────────────────────────
    if original_df is not None and not db_df.empty:
        # Deduplicate: DB takes priority over original CSV
        if "P_NAME" in original_df.columns:
            db_names = set(db_df["P_NAME"].dropna().str.strip())
            original_df = original_df[
                ~original_df["P_NAME"].str.strip().isin(db_names)
            ]
        combined = pd.concat([original_df, db_df], ignore_index=True)
    elif original_df is not None:
        combined = original_df
    else:
        combined = db_df

    logger.info("Combined dataset: %d rows", len(combined))

    # ── 5. Write CSV ─────────────────────────────────────────────────
    if output_path is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = f"artifacts/training_export_{timestamp}.csv"

    combined.to_csv(output_path, index=False)
    logger.info("Exported training dataset → %s (%d rows, %d columns)",
                output_path, len(combined), len(combined.columns))

    # Summary
    if "_source" in combined.columns:
        print("\n── Source Breakdown ──")
        print(combined["_source"].value_counts().to_string())

    if "_is_user_generated" in combined.columns:
        ug_count = combined["_is_user_generated"].sum()
        print(f"\nUser-generated planets: {int(ug_count)}")
        print(f"Dataset-origin planets: {len(combined) - int(ug_count)}")

    print(f"\nOutput file: {output_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Export training data for model retraining"
    )
    parser.add_argument(
        "--output", "-o",
        type=str,
        default=None,
        help="Output CSV path (default: artifacts/training_export_{timestamp}.csv)",
    )
    parser.add_argument(
        "--user-only",
        action="store_true",
        help="Export only user-generated planets (skip original dataset)",
    )
    args = parser.parse_args()
    export(output_path=args.output, user_only=args.user_only)
