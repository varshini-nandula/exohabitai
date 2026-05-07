"""
ExoHabitAI — Exoplanet Model
==============================
Stores planet data + prediction results.

Extracted from app.py to support modular architecture.
"""

import json
from datetime import datetime, timezone

from extensions import db


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

    # Model version tracking — links each prediction to the exact pipeline
    # that produced it, enabling stale-data detection on model upgrades.
    model_version = db.Column(db.String(50))

    # Audit & continuous learning
    raw_input_json = db.Column(db.Text)       # full input payload
    is_user_generated = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # --- User Ownership Tracking ---
    # Links planet submissions to the authenticated user who created them.
    # This enables:
    #   - "My Predictions" queries
    #   - Moderation audit trails (who submitted what)
    #   - Abuse tracking (identify spam submissions)
    #   - Dataset accountability (trace training data provenance)
    # NULL means the planet was seeded from the dataset (no user context).
    created_by_user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=True, index=True,
    )

    # Columns that map to DB fields for dynamic storage
    STORED_FEATURES = [
        "P_RADIUS", "P_MASS", "P_DENSITY", "P_TEMP_SURF",
        "P_PERIOD", "P_SEMI_MAJOR_AXIS",
        "S_TEMPERATURE", "S_LUMINOSITY", "S_METALLICITY",
    ]
