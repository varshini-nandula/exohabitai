"""
ExoHabitAI — Admin Retraining Management Routes
==================================================
Trigger dataset-driven retraining and view audit logs.

Endpoints:
    POST /admin/retraining/start   — Trigger retraining with optional dataset
    GET  /admin/retraining/status  — Current job status
    GET  /admin/retraining/logs    — Audit trail of all retrain runs

Design note:
    Retraining is DATASET-DRIVEN. It consumes:
        1. planetsdata.csv (original baseline — always)
        2. An admin-uploaded verified CSV (optional)

    It does NOT read from the Exoplanet prediction table.
    This prevents the prediction feedback loop.
"""

import logging

from flask import request
from flask_jwt_extended import get_jwt

from auth.decorators import admin_required
from admin.routes_dashboard import admin_bp, _admin_response
from models.training_dataset import TrainingDataset, DatasetStatus
from models.retraining_log import RetrainingLog

logger = logging.getLogger("exohabitai.admin")


@admin_bp.route("/retraining/start", methods=["POST"])
@admin_required()
def start_retraining():
    """
    Trigger dataset-driven model retraining.

    Request body (JSON, optional):
        {
            "dataset_id": 5,      // ID of a "ready" TrainingDataset (optional)
            "reason": "Monthly retrain"   // Audit reason
        }

    If dataset_id is provided:
        Train on planetsdata.csv + the uploaded CSV.
    If dataset_id is omitted:
        Train on planetsdata.csv only (baseline retrain).
    """
    try:
        # Import from the main app module where retraining logic lives
        import app as app_module

        if not app_module._check_rate_limit():
            return _admin_response("error", "Rate limit exceeded. Try again shortly.", code=429)

        payload = request.get_json(silent=True) or {}
        reason = payload.get("reason", "manual trigger (admin)")
        dataset_id = payload.get("dataset_id", None)

        # Get admin identity from JWT
        claims = get_jwt()
        requested_by = claims.get("username", "admin")

        # --- Validate dataset if provided ---
        additional_csv_path = None
        if dataset_id is not None:
            dataset = TrainingDataset.query.get(dataset_id)
            if not dataset:
                return _admin_response(
                    "error",
                    f"Dataset {dataset_id} not found",
                    code=404,
                )
            if dataset.status != DatasetStatus.READY:
                return _admin_response(
                    "error",
                    f"Dataset '{dataset.name}' is not ready for retraining. "
                    f"Current status: {dataset.status}. "
                    f"Validate and mark it as 'ready' first.",
                    code=400,
                )
            import os
            if not os.path.isfile(dataset.storage_path):
                return _admin_response(
                    "error",
                    f"Dataset file not found on disk: {dataset.storage_path}",
                    code=500,
                )
            additional_csv_path = dataset.storage_path
            reason = f"{reason} (dataset: {dataset.name})"

        # --- Prevent concurrent retraining ---
        if not app_module._retrain_lock.acquire(blocking=False):
            return _admin_response(
                "error",
                "Retraining already in progress. Check GET /admin/retraining/status.",
                code=409,
            )

        logger.info(
            "Admin retraining accepted — reason='%s', by='%s', dataset_id=%s",
            reason, requested_by, dataset_id,
        )

        # --- Launch background thread ---
        import threading

        def _worker():
            try:
                app_module._run_retraining_background(
                    reason, requested_by,
                    additional_csv_path=additional_csv_path,
                    dataset_id=dataset_id,
                )
            finally:
                try:
                    app_module._retrain_lock.release()
                except RuntimeError:
                    pass

        thread = threading.Thread(target=_worker, daemon=True)
        thread.start()

        return _admin_response(
            "accepted",
            "Retraining started in background",
            {
                "reason": reason,
                "requested_by": requested_by,
                "dataset_id": dataset_id,
                "poll_status_at": "/admin/retraining/status",
            },
            code=202,
        )

    except Exception as exc:
        # Release lock if we acquired it but failed before thread launch
        import app as app_module
        if app_module._retrain_lock.locked():
            try:
                app_module._retrain_lock.release()
            except RuntimeError:
                pass
        logger.exception("Admin retraining trigger error")
        return _admin_response("error", f"Retraining trigger failed: {exc}", code=500)


@admin_bp.route("/retraining/status", methods=["GET"])
@admin_required()
def retraining_status():
    """Current retraining job status."""
    try:
        import app as app_module

        return _admin_response("success", "Retraining status retrieved", {
            "is_running": app_module._retrain_status["is_running"],
            "last_started": app_module._retrain_status["last_started"],
            "last_completed": app_module._retrain_status["last_completed"],
            "last_result": app_module._retrain_status["last_result"],
            "current_model_version": app_module.MODEL_VERSION,
        })
    except Exception as exc:
        logger.exception("Retraining status error")
        return _admin_response("error", f"Status retrieval failed: {exc}", code=500)


@admin_bp.route("/retraining/logs", methods=["GET"])
@admin_required()
def retraining_logs():
    """Audit trail of all retraining runs."""
    try:
        limit = request.args.get("limit", 20, type=int)

        logs = (
            RetrainingLog.query
            .order_by(RetrainingLog.timestamp.desc())
            .limit(limit)
            .all()
        )

        entries = [
            {
                "id": log.id,
                "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                "status": log.status,
                "model_version": log.model_version,
                "previous_model_version": log.previous_model_version,
                "dataset_version": log.dataset_version,
                "dataset_size": log.dataset_size,
                "user_data_count": log.user_data_count,
                "accuracy": log.accuracy,
                "f1_score": log.f1_score,
                "roc_auc": log.roc_auc,
                "pr_auc": log.pr_auc,
                "reason": log.reason,
                "requested_by": log.requested_by,
            }
            for log in logs
        ]

        return _admin_response(
            "success",
            f"Retrieved {len(entries)} retraining log(s)",
            {"logs": entries},
        )

    except Exception as exc:
        logger.exception("Retraining logs error")
        return _admin_response("error", f"Failed to retrieve logs: {exc}", code=500)
