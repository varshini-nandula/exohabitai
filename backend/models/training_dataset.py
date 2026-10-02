"""
ExoHabitAI — Training Dataset Model
======================================
Tracks verified CSV datasets uploaded by admins for model retraining.

Design decisions:
    1. Training datasets are conceptually SEPARATE from prediction data.
       The Exoplanet table stores inference records (what the model predicted).
       This table stores curated, labeled data used to TRAIN models.
       This prevents the prediction feedback loop where model outputs
       become training inputs.

    2. Datasets go through a lifecycle:
       uploaded → validated → ready → (consumed by retraining)
       Only "ready" datasets can be used for retraining.

    3. The validation_result column stores a JSON blob with schema checks,
       data quality metrics, and warnings. This avoids re-validating on
       every page load.

    4. file_hash enables deduplication — uploading the same CSV twice
       is caught before wasting disk space.
"""

from datetime import datetime, timezone

from extensions import db


class DatasetStatus:
    """
    Lifecycle statuses for uploaded training datasets.

    Workflow:
        UPLOADED  → Admin uploads CSV, file is saved
        VALIDATED → Validation engine has run, results stored
        READY     → Admin has reviewed validation and approved for retraining
        INVALID   → Validation failed (missing target column, bad data, etc.)
    """
    UPLOADED = "uploaded"
    VALIDATED = "validated"
    READY = "ready"
    INVALID = "invalid"

    ALL_STATUSES = [UPLOADED, VALIDATED, READY, INVALID]

    @classmethod
    def is_valid(cls, status: str) -> bool:
        return status in cls.ALL_STATUSES


class TrainingDataset(db.Model):
    """
    A verified CSV dataset uploaded by an admin for model retraining.

    This is NOT prediction data. Each row in the CSV must contain:
        - Physical features (P_RADIUS, P_MASS, etc.)
        - A ground truth label (P_HABITABLE_BINARY: 0 or 1)

    The dataset is validated before it can be used for retraining.
    """
    __tablename__ = "training_datasets"

    id = db.Column(db.Integer, primary_key=True)

    # --- Identity ---
    name = db.Column(db.String(200), nullable=False)
    filename = db.Column(db.String(300), nullable=False)
    storage_path = db.Column(db.String(500), nullable=False)

    # --- Upload metadata ---
    uploaded_by = db.Column(db.String(100), nullable=False)
    uploaded_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # --- Dataset statistics ---
    row_count = db.Column(db.Integer)
    column_count = db.Column(db.Integer)
    file_hash = db.Column(db.String(32))         # MD5 for dedup detection
    file_size_bytes = db.Column(db.Integer)

    # --- Lifecycle ---
    status = db.Column(
        db.String(20),
        default=DatasetStatus.UPLOADED,
        nullable=False,
        index=True,
    )

    # --- Validation ---
    # JSON blob containing schema checks, quality metrics, warnings.
    # Populated when POST /admin/datasets/:id/validate is called.
    validation_result = db.Column(db.Text)

    # --- Notes ---
    notes = db.Column(db.Text)

    def to_dict(self) -> dict:
        """Safe serialisation for API responses."""
        import json
        return {
            "id": self.id,
            "name": self.name,
            "filename": self.filename,
            "uploaded_by": self.uploaded_by,
            "uploaded_at": self.uploaded_at.isoformat() if self.uploaded_at else None,
            "row_count": self.row_count,
            "column_count": self.column_count,
            "file_hash": self.file_hash,
            "file_size_bytes": self.file_size_bytes,
            "status": self.status,
            "validation_result": (
                json.loads(self.validation_result)
                if self.validation_result else None
            ),
            "notes": self.notes,
        }

    def __repr__(self) -> str:
        return f"<TrainingDataset {self.name} ({self.status})>"
