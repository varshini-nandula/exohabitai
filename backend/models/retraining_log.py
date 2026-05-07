"""
ExoHabitAI — Retraining Log Model
===================================
Audit trail for every retraining run — success or failure.

Extracted from app.py to support modular architecture.
"""

from datetime import datetime, timezone

from extensions import db


class RetrainingLog(db.Model):
    """
    Audit trail for every retraining run — success or failure.

    Captures metrics, dataset size, dataset version, and the resulting
    model version so that any model in production can be traced back to
    its training conditions.
    """
    __tablename__ = "retraining_logs"

    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False,
    )
    status = db.Column(db.String(20), nullable=False)        # success / rejected / failed
    model_version = db.Column(db.String(50))
    previous_model_version = db.Column(db.String(50))
    dataset_version = db.Column(db.String(50))
    dataset_size = db.Column(db.Integer)
    user_data_count = db.Column(db.Integer)
    accuracy = db.Column(db.Float)
    f1_score = db.Column(db.Float)
    roc_auc = db.Column(db.Float)
    pr_auc = db.Column(db.Float)
    reason = db.Column(db.String(200))
    requested_by = db.Column(db.String(100))
    details = db.Column(db.Text)                             # JSON blob for extras
