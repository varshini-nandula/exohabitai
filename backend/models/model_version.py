"""
ExoHabitAI — Model Version Registry
=====================================
Tracks every model version produced by retraining, including metrics,
artifact paths, and deployment status.

Design decisions:
    1. Semantic versioning (v1.0, v1.1, v1.2, …) replaces content-hash
       versioning. This is more human-readable and makes the project
       feel production-oriented.

    2. Every retrain creates a new ModelVersion row — even rejected ones.
       Rejected versions have is_active=False and a notes field explaining
       why (e.g., "F1 below threshold"). This provides a complete audit
       trail of all training attempts.

    3. Only ONE version can be is_active=True at any time. When a new
       model is deployed, the previous active version is deactivated.
       This is enforced in the retraining workflow, not at the DB level,
       to avoid complex constraints.

    4. Links back to TrainingDataset (which CSV was used) and
       RetrainingLog (full audit details) via foreign keys.

    5. On first startup, if no ModelVersion exists, a v1.0 entry is
       seeded from the current pipeline .pkl file. This bootstraps
       the registry without requiring a retrain.
"""

from datetime import datetime, timezone

from extensions import db


class ModelVersion(db.Model):
    """
    A versioned ML model artifact with associated metrics.

    Lifecycle:
        - Created during retraining (success or rejection)
        - Successful models may be marked is_active=True (deployed)
        - Rejected models are stored with is_active=False
        - Only one version is active at any time
    """
    __tablename__ = "model_versions"

    id = db.Column(db.Integer, primary_key=True)

    # --- Version identifier ---
    # Semantic version string: "v1.0", "v1.1", "v1.2", …
    version = db.Column(
        db.String(100), unique=True, nullable=False, index=True,
    )

    # --- Artifact ---
    artifact_path = db.Column(db.String(500))

    # --- Evaluation metrics ---
    accuracy = db.Column(db.Float)
    precision = db.Column(db.Float)
    recall = db.Column(db.Float)
    f1_score = db.Column(db.Float)
    roc_auc = db.Column(db.Float)
    pr_auc = db.Column(db.Float)

    # --- Provenance ---
    # Hash of the dataset(s) used for training
    dataset_version = db.Column(db.String(100))

    # Link to the specific uploaded dataset (if retrained with one)
    training_dataset_id = db.Column(
        db.Integer,
        db.ForeignKey("training_datasets.id"),
        nullable=True,
    )

    # Link to the retraining log entry for full audit details
    retraining_log_id = db.Column(
        db.Integer,
        db.ForeignKey("retraining_logs.id"),
        nullable=True,
    )

    # --- Deployment status ---
    is_active = db.Column(db.Boolean, default=False, nullable=False, index=True)

    # --- Metadata ---
    created_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    created_by = db.Column(db.String(100))
    notes = db.Column(db.Text)

    def to_dict(self) -> dict:
        """Safe serialisation for API responses."""
        return {
            "id": self.id,
            "version": self.version,
            "artifact_path": self.artifact_path,
            "accuracy": self.accuracy,
            "precision": self.precision,
            "recall": self.recall,
            "f1_score": self.f1_score,
            "roc_auc": self.roc_auc,
            "pr_auc": self.pr_auc,
            "dataset_version": self.dataset_version,
            "training_dataset_id": self.training_dataset_id,
            "retraining_log_id": self.retraining_log_id,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "created_by": self.created_by,
            "notes": self.notes,
        }

    def __repr__(self) -> str:
        status = "ACTIVE" if self.is_active else "inactive"
        return f"<ModelVersion {self.version} ({status})>"
