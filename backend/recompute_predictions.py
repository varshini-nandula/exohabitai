"""
ExoHabitAI — Recompute Predictions Script
==========================================
Re-runs the current pipeline on every planet in the database and updates
habitability_probability, habitability, and model_version in a single
batch prediction.

The unified pipeline handles all preprocessing internally — this script
simply builds a raw DataFrame from DB rows and passes it directly.

Use this after swapping the .pkl model to ensure DB predictions match
the latest pipeline.

Usage:
    cd backend
    python recompute_predictions.py              # update existing rows
    python recompute_predictions.py --reset      # wipe DB, re-seed, recompute
    python recompute_predictions.py --dry-run    # predict but don't commit
"""

import sys
import os
import json
import argparse
import warnings
import logging

# ── Suppress the noisy sklearn parallel warnings ──────────────────────────
warnings.filterwarnings("ignore", category=UserWarning, module="sklearn")
os.environ["PYTHONWARNINGS"] = "ignore::UserWarning"

import numpy as np
import pandas as pd

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("exohabitai.recompute")


def recompute(dry_run: bool = False, reset: bool = False):
    """
    Re-predict every planet in the DB using the currently loaded pipeline.

    The pipeline includes all preprocessing (imputation, encoding, scaling,
    etc.), so this script builds a raw DataFrame and passes it directly.
    No manual preprocessing or feature alignment is performed.

    Args:
        dry_run: if True, compute predictions but do not write to DB.
        reset:   if True, wipe the entire DB and re-seed from CSV first.
    """
    from app import (
        app, db, Exoplanet, pipeline, Config, MODEL_VERSION,
        PIPELINE_INPUT_COLUMNS, _derive_star_type,
    )

    with app.app_context():

        # ── Optional reset: clear DB and re-seed ─────────────────────
        if reset:
            logger.warning("RESET mode — dropping all rows from exoplanets table")
            try:
                Exoplanet.query.delete()
                db.session.commit()
                logger.info("Database cleared")
            except Exception as exc:
                db.session.rollback()
                logger.error("Reset failed: %s", exc)
                sys.exit(1)

            # Re-seed from CSV
            logger.info("Re-seeding database from CSV …")
            from database import seed_database
            seed_database()
            logger.info("Re-seed complete")

        planets = Exoplanet.query.all()
        total = len(planets)

        if total == 0:
            logger.info("Database is empty — nothing to recompute")
            return

        logger.info("Recomputing predictions for %d planets (threshold=%.2f, version=%s)",
                     total, Config.THRESHOLD, MODEL_VERSION)

        # ── Build a single DataFrame for batch prediction ────────────
        # Recover as much raw data as possible from raw_input_json,
        # falling back to the stored DB columns.
        records = []
        for planet in planets:
            features = {}

            # Start with stored DB features
            for feat in Exoplanet.STORED_FEATURES:
                val = getattr(planet, feat, None)
                features[feat] = val if val is not None else np.nan

            # Also try to recover extra features from raw_input_json
            if planet.raw_input_json:
                try:
                    raw = json.loads(planet.raw_input_json)
                    for key, val in raw.items():
                        if key not in features and key not in ("planet_name",):
                            features[key] = val
                except (json.JSONDecodeError, TypeError):
                    pass

            records.append(features)

        # Build DataFrame directly — pipeline handles all preprocessing
        df = pd.DataFrame(records)

        # --- Derive Derived_S_TYPE (train/serve parity) ---
        if "S_TEMPERATURE" in df.columns:
            if "Derived_S_TYPE" not in df.columns:
                df["Derived_S_TYPE"] = df["S_TEMPERATURE"].apply(_derive_star_type)
            else:
                mask = df["Derived_S_TYPE"].isna() & df["S_TEMPERATURE"].notna()
                df.loc[mask, "Derived_S_TYPE"] = df.loc[mask, "S_TEMPERATURE"].apply(_derive_star_type)

        # Ensure all pipeline-required columns are present (NaN for missing)
        # The pipeline's internal imputer handles NaN values.
        if PIPELINE_INPUT_COLUMNS is not None:
            for col in PIPELINE_INPUT_COLUMNS:
                if col not in df.columns:
                    df[col] = np.nan

        logger.info("Built feature matrix (%d rows × %d cols) — running batch prediction …",
                     df.shape[0], df.shape[1])

        # ── Batch predict (single call — much faster) ────────────────
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            probs = pipeline.predict_proba(df)[:, 1]

        labels = (probs >= Config.THRESHOLD).astype(int)

        logger.info("Predictions complete — %s database …",
                     "NOT updating (dry-run)" if dry_run else "updating")

        if dry_run:
            # Print summary without writing
            habitable = int(labels.sum())
            logger.info(
                "Dry-run results: %d habitable / %d total (%.1f%%)",
                habitable, total, 100 * habitable / total
            )
            # Show top 10
            top_idx = np.argsort(probs)[::-1][:10]
            print("\nTop 10 predictions:")
            for rank, idx in enumerate(top_idx, 1):
                p = planets[idx]
                print(f"  {rank:>3d}. {p.planet_name:<30s}  prob={probs[idx]:.6f}")
            return

        # ── Update all planets in memory (single loop, no commit) ────
        updated = 0
        errors = 0

        for i, planet in enumerate(planets):
            try:
                planet.habitability_probability = float(probs[i])
                planet.habitability = int(labels[i])
                planet.model_version = MODEL_VERSION
                updated += 1
            except Exception as exc:
                logger.warning("  Error on '%s': %s", planet.planet_name, exc)
                errors += 1
                continue

        # ── Single commit for all updates ────────────────────────────
        try:
            db.session.commit()
        except Exception as exc:
            db.session.rollback()
            logger.error("Commit failed: %s", exc)
            sys.exit(1)

        habitable = int(labels.sum())
        logger.info(
            "Recompute complete — updated: %d, errors: %d, "
            "habitable: %d / %d (%.1f%%), model_version: %s",
            updated, errors, habitable, total, 100 * habitable / total,
            MODEL_VERSION,
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Recompute predictions for all planets in the database"
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Wipe the DB and re-seed from CSV before recomputing",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Compute predictions but do not write to the database",
    )
    args = parser.parse_args()
    recompute(dry_run=args.dry_run, reset=args.reset)
