"""
ExoHabitAI — Admin Model Registry Routes
===========================================
View model versions, metrics, and deployment status.

Endpoints:
    GET /admin/models         — All model versions (sorted by created_at desc)
    GET /admin/models/active  — Currently deployed model with full metrics
    GET /admin/models/<id>    — Single version detail
"""

import logging

from auth.decorators import admin_required
from admin.routes_dashboard import admin_bp, _admin_response
from models.model_version import ModelVersion

logger = logging.getLogger("exohabitai.admin")


@admin_bp.route("/models", methods=["GET"])
@admin_required()
def list_models():
    """List all model versions sorted by creation date (newest first)."""
    try:
        models = (
            ModelVersion.query
            .order_by(ModelVersion.created_at.desc())
            .all()
        )
        return _admin_response(
            "success",
            f"Retrieved {len(models)} model version(s)",
            {"models": [m.to_dict() for m in models]},
        )
    except Exception as exc:
        logger.exception("Model list error")
        return _admin_response("error", f"Failed to list models: {exc}", code=500)


@admin_bp.route("/models/active", methods=["GET"])
@admin_required()
def active_model():
    """Get the currently deployed (active) model version."""
    try:
        model = ModelVersion.query.filter_by(is_active=True).first()
        if not model:
            return _admin_response(
                "success",
                "No active model version found in registry",
                {"model": None},
            )
        return _admin_response(
            "success",
            f"Active model: {model.version}",
            {"model": model.to_dict()},
        )
    except Exception as exc:
        logger.exception("Active model error")
        return _admin_response("error", f"Failed to get active model: {exc}", code=500)


@admin_bp.route("/models/<int:model_id>", methods=["GET"])
@admin_required()
def model_detail(model_id):
    """Get a specific model version by ID."""
    model = ModelVersion.query.get(model_id)
    if not model:
        return _admin_response("error", f"Model version {model_id} not found", code=404)

    return _admin_response("success", "Model version retrieved", model.to_dict())
