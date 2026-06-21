"""
ExoHabitAI — Database Seeding Script
=====================================
Populates the database from the ranked CSV exported by the ML pipeline.

Usage:
    cd backend
    python database.py
"""

import sys
import logging

import pandas as pd
from app import app, db, Exoplanet, MODEL_VERSION
from models import PlanetStatus

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("exohabitai.seed")

# Canonical ranked output produced by generate_ranked_dataset.py.
CSV_PATH = "artifacts/exoplanets_ranked_latest.csv"

# The columns we persist as named DB fields
STORED_FEATURES = Exoplanet.STORED_FEATURES


def _first_present(row, df, candidates):
    """Return the first candidate column value present and non-null, else None."""
    for col in candidates:
        if col in df.columns and pd.notna(row.get(col)):
            return row.get(col)
    return None


def seed_database(csv_path: str = CSV_PATH):
    """
    Read the ranked CSV and insert planets that don't already exist.

    Seeded planets are dataset-derived reference data, so they are inserted
    as is_user_generated=False and status='approved' (immediately visible in
    public rankings). Column names are detected defensively so this works
    with both the current ranked export (planet_name / habitability_probability
    / habitability) and older richer exports (P_NAME / P_HABITABLE_BINARY).
    """
    try:
        df = pd.read_csv(csv_path)
    except FileNotFoundError:
        logger.error("CSV not found: %s — run generate_ranked_dataset.py first",
                     csv_path)
        sys.exit(1)

    logger.info("Loaded %d rows from %s", len(df), csv_path)

    with app.app_context():
        inserted = 0
        skipped = 0

        for _, row in df.iterrows():
            planet_name = _first_present(row, df, ["planet_name", "P_NAME"])
            if not planet_name or pd.isna(planet_name):
                skipped += 1
                continue
            planet_name = str(planet_name).strip()

            # Avoid duplicates
            if Exoplanet.query.filter_by(planet_name=planet_name).first():
                skipped += 1
                continue

            # Collect baseline features if present (older exports only)
            feature_data = {}
            for feat in STORED_FEATURES:
                if feat in df.columns and pd.notna(row.get(feat)):
                    try:
                        feature_data[feat] = float(row[feat])
                    except (ValueError, TypeError):
                        feature_data[feat] = None
                else:
                    feature_data[feat] = None

            # Probability column (current export uses habitability_probability)
            prob_raw = _first_present(
                row, df,
                ["habitability_probability", "Predicted_Habitability_Probability"],
            )
            probability = float(prob_raw) if prob_raw is not None else None

            # Habitability label (current export uses habitability)
            label_raw = _first_present(
                row, df, ["habitability", "P_HABITABLE_BINARY"],
            )
            if label_raw is not None:
                habitability = int(label_raw)
            elif probability is not None:
                habitability = int(probability >= 0.5)
            else:
                habitability = None

            planet = Exoplanet(
                planet_name=planet_name,
                habitability_probability=probability,
                habitability=habitability,
                model_version=MODEL_VERSION if probability is not None else None,
                is_user_generated=False,
                status=PlanetStatus.APPROVED,
                **feature_data,
            )

            db.session.add(planet)
            inserted += 1

        try:
            db.session.commit()
            logger.info("Database seeding completed — inserted: %d, skipped: %d",
                        inserted, skipped)
        except Exception as exc:
            db.session.rollback()
            logger.error("Database commit failed: %s", exc)
            sys.exit(1)


if __name__ == "__main__":
    seed_database()
