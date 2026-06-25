"""
ExoHabitAI — Admin Dashboard Routes
======================================
GET /admin/dashboard — aggregated system overview.

Provides the System Status card, stat counts, current model info,
last retraining result, and recent submissions feed.
"""

import logging

from flask import Blueprint, jsonify

from auth.decorators import admin_required
from admin.services import get_dashboard_stats

logger = logging.getLogger("exohabitai.admin")

# Blueprint for all admin routes — other route modules import and extend this.
admin_bp = Blueprint("admin", __name__, url_prefix="/admin")


def _admin_response(status: str, message: str, data=None, code: int = 200):
    """Consistent JSON envelope matching the API pattern."""
    return jsonify({
        "status": status,
        "message": message,
        "data": data,
    }), code


@admin_bp.route("/dashboard", methods=["GET"])
@admin_required()
def dashboard():
    """
    Aggregated admin dashboard data.

    Returns system status, platform statistics, current model info,
    last retraining result, and recent user submissions.

    Powers the Admin Dashboard overview page.
    """
    try:
        data = get_dashboard_stats()
        return _admin_response("success", "Dashboard data retrieved", data)
    except Exception as exc:
        logger.exception("Dashboard error")
        return _admin_response("error", f"Dashboard failed: {exc}", code=500)
