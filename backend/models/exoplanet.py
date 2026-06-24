"""
ExoHabitAI — Exoplanet Model
==============================
Stores planet data + prediction results.

Extracted from app.py to support modular architecture.
"""

import json
from datetime import datetime, timezone

from extensions import db


class PlanetStatus:
    """
    Moderation status constants for a planet submission.

    Workflow:
        - User-submitted planets start as PENDING and are invisible in
          public rankings until an admin approves them.
        - Dataset-seeded planets are inserted directly as APPROVED.
        - Admins can mark a submission REJECTED (kept for audit, hidden).

    Stored as a plain string column (no enum table) to stay extensible —
    mirrors the design rationale used for UserRole.
    """
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

    ALL_STATUSES = [PENDING, APPROVED, REJECTED]

    @classmethod
    def is_valid(cls, status: str) -> bool:
        return status in cls.ALL_STATUSES


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

    # --- Moderation status ---
    # User submissions default to "pending" and are hidden from public
    # rankings until an admin approves them. Dataset-seeded planets are
    # inserted as "approved". See PlanetStatus for the workflow.
    status = db.Column(
        db.String(20), nullable=False, default=PlanetStatus.PENDING, index=True,
    )

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
