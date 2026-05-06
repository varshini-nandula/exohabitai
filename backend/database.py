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
from app import app, db, Exoplanet

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("exohabitai.seed")

CSV_PATH = "artifacts/ranked_exoplanets_by_habitability.csv"

# The columns we persist as named DB fields
STORED_FEATURES = Exoplanet.STORED_FEATURES


def seed_database(csv_path: str = CSV_PATH):
    """Read the CSV and insert planets that don't already exist."""
    try:
        df = pd.read_csv(csv_path)
    except FileNotFoundError:
        logger.error("CSV not found: %s", csv_path)
        sys.exit(1)

    logger.info("Loaded %d rows from %s", len(df), csv_path)

    with app.app_context():
        inserted = 0
        skipped = 0

        for _, row in df.iterrows():
            planet_name = row.get("P_NAME")
            if not planet_name or pd.isna(planet_name):
                skipped += 1
                continue

            # Avoid duplicates
            if Exoplanet.query.filter_by(planet_name=planet_name).first():
                skipped += 1
                continue

            # Collect baseline features if present
            feature_data = {}
            for feat in STORED_FEATURES:
                if feat in df.columns and pd.notna(row.get(feat)):
                    try:
                        feature_data[feat] = float(row[feat])
                    except (ValueError, TypeError):
                        feature_data[feat] = None
                else:
                    feature_data[feat] = None

            # Probability column
            prob_col = "Predicted_Habitability_Probability"
            probability = (
                float(row[prob_col])
                if prob_col in df.columns and pd.notna(row.get(prob_col))
                else None
            )

            # Use dataset label for seeding (not the threshold-based label)
            if "P_HABITABLE_BINARY" in df.columns and pd.notna(row.get("P_HABITABLE_BINARY")):
                habitability = int(row["P_HABITABLE_BINARY"])
            elif probability is not None:
                habitability = int(probability >= 0.5)
            else:
                habitability = None

            planet = Exoplanet(
                planet_name=planet_name,
                habitability_probability=probability,
                habitability=habitability,
                is_user_generated=False,
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
