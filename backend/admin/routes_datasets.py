"""
ExoHabitAI — Admin Dataset Management Routes
===============================================
Upload, validate, and manage verified CSV training datasets.

Endpoints:
    POST   /admin/datasets/upload       — Upload a CSV file
    GET    /admin/datasets              — List all datasets
    GET    /admin/datasets/<id>         — Dataset detail with validation
    DELETE /admin/datasets/<id>         — Delete dataset (file + record)
    POST   /admin/datasets/<id>/validate — Run validation engine
    POST   /admin/datasets/<id>/ready   — Mark as ready for retraining

Design note:
    These are TRAINING datasets (verified labeled CSVs), NOT prediction data.
    Each CSV must contain a P_HABITABLE_BINARY column with ground truth labels.
    This enforces the separation between prediction data and training data.
"""

import os
import json
import hashlib
import logging
from datetime import datetime, timezone

from flask import request, current_app
from werkzeug.utils import secure_filename

from auth.decorators import admin_required
from admin.routes_dashboard import admin_bp, _admin_response
from admin.validators import validate_dataset
from extensions import db
from models.training_dataset import TrainingDataset, DatasetStatus

logger = logging.getLogger("exohabitai.admin")

# Default upload directory (can be overridden via env var)
DEFAULT_UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..", "artifacts", "datasets",
)
UPLOAD_DIR = os.environ.get("DATASET_UPLOAD_DIR", DEFAULT_UPLOAD_DIR)

# Max upload size: 50MB
MAX_FILE_SIZE = 50 * 1024 * 1024

ALLOWED_EXTENSIONS = {".csv"}


def _ensure_upload_dir():
    """Create the upload directory if it doesn't exist."""
    abs_dir = os.path.abspath(UPLOAD_DIR)
    os.makedirs(abs_dir, exist_ok=True)
    return abs_dir


def _compute_file_hash(path: str) -> str:
    """Compute MD5 hash of a file for dedup detection."""
    md5 = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            md5.update(chunk)
    return md5.hexdigest()


@admin_bp.route("/datasets/upload", methods=["POST"])
@admin_required()
def upload_dataset():
    """
    Upload a training dataset CSV file.

    Expects multipart/form-data with:
        - file: The CSV file
        - name: Human-friendly dataset name
        - notes: Optional notes about the dataset
    """
    from flask_jwt_extended import get_jwt

    try:
        # --- Validate request ---
        if "file" not in request.files:
            return _admin_response("error", "No file provided. Include a 'file' field.", code=400)

        file = request.files["file"]
        if not file.filename:
            return _admin_response("error", "Empty filename", code=400)

        # Check extension
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            return _admin_response(
                "error",
                f"Invalid file type: {ext}. Only CSV files are allowed.",
                code=400,
            )

        # Dataset name
        name = request.form.get("name", "").strip()
        if not name:
            name = os.path.splitext(file.filename)[0]

        notes = request.form.get("notes", "").strip() or None

        # Get admin username from JWT
        claims = get_jwt()
        uploaded_by = claims.get("username", "admin")

        # --- Save file ---
        upload_dir = _ensure_upload_dir()
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        safe_name = secure_filename(file.filename)
        storage_name = f"{timestamp}_{safe_name}"
        storage_path = os.path.join(upload_dir, storage_name)

        file.save(storage_path)

        # --- Compute metadata ---
        file_size = os.path.getsize(storage_path)
        if file_size > MAX_FILE_SIZE:
            os.remove(storage_path)
            return _admin_response(
                "error",
                f"File too large ({file_size / 1024 / 1024:.1f}MB). Max is {MAX_FILE_SIZE / 1024 / 1024:.0f}MB.",
                code=400,
            )

        file_hash = _compute_file_hash(storage_path)

        # Check for duplicate
        existing = TrainingDataset.query.filter_by(file_hash=file_hash).first()
        if existing:
            os.remove(storage_path)
            return _admin_response(
                "error",
                f"Duplicate dataset. This file matches '{existing.name}' (id={existing.id}).",
                code=409,
            )

        # Quick row/column count
        import pandas as pd
        try:
            df = pd.read_csv(storage_path, nrows=0)  # Just read header
            column_count = len(df.columns)
            # Count rows efficiently
            with open(storage_path, "r") as f:
                row_count = sum(1 for _ in f) - 1  # Subtract header
        except Exception:
            column_count = None
            row_count = None

        # --- Create record ---
        dataset = TrainingDataset(
            name=name,
            filename=file.filename,
            storage_path=storage_path,
            uploaded_by=uploaded_by,
            row_count=row_count,
            column_count=column_count,
            file_hash=file_hash,
            file_size_bytes=file_size,
            notes=notes,
        )
        db.session.add(dataset)
        db.session.commit()

        logger.info(
            "Dataset uploaded: id=%d, name=%s, rows=%s, by=%s",
            dataset.id, name, row_count, uploaded_by,
        )

        return _admin_response(
            "success",
            f"Dataset '{name}' uploaded successfully",
            dataset.to_dict(),
            code=201,
        )

    except Exception as exc:
        db.session.rollback()
        logger.exception("Dataset upload error")
        return _admin_response("error", f"Upload failed: {exc}", code=500)


@admin_bp.route("/datasets", methods=["GET"])
@admin_required()
def list_datasets():
    """List all uploaded training datasets."""
    try:
        datasets = (
            TrainingDataset.query
            .order_by(TrainingDataset.uploaded_at.desc())
            .all()
        )
        return _admin_response(
            "success",
            f"Retrieved {len(datasets)} dataset(s)",
            {"datasets": [d.to_dict() for d in datasets]},
        )
    except Exception as exc:
        logger.exception("Dataset list error")
        return _admin_response("error", f"Failed to list datasets: {exc}", code=500)


@admin_bp.route("/datasets/<int:dataset_id>", methods=["GET"])
@admin_required()
def dataset_detail(dataset_id):
    """Dataset detail including validation results."""
    dataset = TrainingDataset.query.get(dataset_id)
    if not dataset:
        return _admin_response("error", f"Dataset {dataset_id} not found", code=404)

    return _admin_response("success", "Dataset detail retrieved", dataset.to_dict())


@admin_bp.route("/datasets/<int:dataset_id>", methods=["DELETE"])
@admin_required()
def delete_dataset(dataset_id):
    """Delete a dataset (removes file and database record)."""
    dataset = TrainingDataset.query.get(dataset_id)
    if not dataset:
        return _admin_response("error", f"Dataset {dataset_id} not found", code=404)

    # Don't delete if it's being used for retraining
    if dataset.status == DatasetStatus.READY:
        return _admin_response(
            "error",
            "Cannot delete a dataset marked as 'ready'. Change its status first.",
            code=409,
        )

    try:
        # Remove file from disk
        if os.path.isfile(dataset.storage_path):
            os.remove(dataset.storage_path)
            logger.info("Deleted file: %s", dataset.storage_path)

        name = dataset.name
        db.session.delete(dataset)
        db.session.commit()

        logger.info("Dataset deleted: id=%d, name=%s", dataset_id, name)
        return _admin_response("success", f"Dataset '{name}' deleted")

    except Exception as exc:
        db.session.rollback()
        logger.exception("Dataset delete error")
        return _admin_response("error", f"Delete failed: {exc}", code=500)


@admin_bp.route("/datasets/<int:dataset_id>/validate", methods=["POST"])
@admin_required()
def validate_dataset_endpoint(dataset_id):
    """Run the validation engine on an uploaded dataset."""
    dataset = TrainingDataset.query.get(dataset_id)
    if not dataset:
        return _admin_response("error", f"Dataset {dataset_id} not found", code=404)

    if not os.path.isfile(dataset.storage_path):
        return _admin_response(
            "error",
            f"Dataset file not found on disk: {dataset.storage_path}",
            code=500,
        )

    try:
        # Get expected columns from the loaded pipeline
        try:
            from app import PIPELINE_INPUT_COLUMNS
            expected_columns = PIPELINE_INPUT_COLUMNS
        except ImportError:
            expected_columns = None

        # Run validation
        result = validate_dataset(dataset.storage_path, expected_columns)

        # Update dataset record
        dataset.validation_result = json.dumps(result)
        dataset.row_count = result.get("row_count", dataset.row_count)
        dataset.column_count = result.get("column_count", dataset.column_count)

        if result["valid"]:
            dataset.status = DatasetStatus.VALIDATED
        else:
            dataset.status = DatasetStatus.INVALID

        db.session.commit()

        logger.info(
            "Dataset validated: id=%d, name=%s, valid=%s",
            dataset.id, dataset.name, result["valid"],
        )

        return _admin_response(
            "success",
            f"Validation {'passed' if result['valid'] else 'failed'} for '{dataset.name}'",
            {
                "dataset": dataset.to_dict(),
                "validation": result,
            },
        )

    except Exception as exc:
        db.session.rollback()
        logger.exception("Dataset validation error")
        return _admin_response("error", f"Validation failed: {exc}", code=500)


@admin_bp.route("/datasets/<int:dataset_id>/ready", methods=["POST"])
@admin_required()
def mark_dataset_ready(dataset_id):
    """Mark a validated dataset as ready for retraining."""
    dataset = TrainingDataset.query.get(dataset_id)
    if not dataset:
        return _admin_response("error", f"Dataset {dataset_id} not found", code=404)

    if dataset.status != DatasetStatus.VALIDATED:
        return _admin_response(
            "error",
            f"Dataset must be validated before marking as ready. "
            f"Current status: {dataset.status}",
            code=400,
        )

    dataset.status = DatasetStatus.READY
    try:
        db.session.commit()
        logger.info("Dataset marked ready: id=%d, name=%s", dataset.id, dataset.name)
        return _admin_response(
            "success",
            f"Dataset '{dataset.name}' is now ready for retraining",
            dataset.to_dict(),
        )
    except Exception as exc:
        db.session.rollback()
        return _admin_response("error", f"Failed to update status: {exc}", code=500)
