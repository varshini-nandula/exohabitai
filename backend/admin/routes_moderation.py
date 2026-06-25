"""
ExoHabitAI — Admin Moderation Routes
=======================================
Planet moderation workflow — view, approve, reject user submissions.

Endpoints:
    GET  /admin/planets/pending      — Paginated pending queue
    GET  /admin/planets/all          — All planets with filters
    GET  /admin/planets/<id>         — Full planet detail
    POST /admin/planets/<id>/approve — Set status → approved
    POST /admin/planets/<id>/reject  — Set status → rejected

Design note:
    Approving a planet makes it visible in public /rank.
    It does NOT add it to training data. Training data only comes
    from verified CSV uploads (see routes_datasets.py).
"""

import logging

from flask import request

from auth.decorators import admin_required
from admin.routes_dashboard import admin_bp, _admin_response
from admin.services import get_planets_by_status, get_planet_detail, moderate_planet
from models.exoplanet import PlanetStatus

logger = logging.getLogger("exohabitai.admin")


@admin_bp.route("/planets/pending", methods=["GET"])
@admin_required()
def pending_planets():
    """List pending planet submissions with pagination."""
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    search = request.args.get("search", None)

    items, total, pg, pp = get_planets_by_status(
        status=PlanetStatus.PENDING, search=search,
        page=page, per_page=per_page,
    )

    return _admin_response("success", f"Retrieved {len(items)} pending planet(s)", {
        "planets": items,
        "total": total,
        "page": pg,
        "per_page": pp,
        "total_pages": (total + pp - 1) // pp if pp > 0 else 0,
    })


@admin_bp.route("/planets/all", methods=["GET"])
@admin_required()
def all_planets():
    """List all planets with optional status filter, search, and pagination."""
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    status = request.args.get("status", None)
    search = request.args.get("search", None)

    items, total, pg, pp = get_planets_by_status(
        status=status, search=search,
        page=page, per_page=per_page,
    )

    return _admin_response("success", f"Retrieved {len(items)} planet(s)", {
        "planets": items,
        "total": total,
        "page": pg,
        "per_page": pp,
        "total_pages": (total + pp - 1) // pp if pp > 0 else 0,
    })


@admin_bp.route("/planets/<int:planet_id>", methods=["GET"])
@admin_required()
def planet_detail(planet_id):
    """Full planet detail including features, raw input, and submitter info."""
    detail = get_planet_detail(planet_id)
    if detail is None:
        return _admin_response("error", f"Planet {planet_id} not found", code=404)

    return _admin_response("success", "Planet detail retrieved", detail)


@admin_bp.route("/planets/<int:planet_id>/approve", methods=["POST"])
@admin_required()
def approve_planet(planet_id):
    """Approve a planet submission — makes it visible in public rankings."""
    result, message = moderate_planet(planet_id, PlanetStatus.APPROVED)
    if result is None:
        return _admin_response("error", message, code=404)

    return _admin_response("success", message, result)


@admin_bp.route("/planets/<int:planet_id>/reject", methods=["POST"])
@admin_required()
def reject_planet(planet_id):
    """Reject a planet submission — hides it from public rankings."""
    result, message = moderate_planet(planet_id, PlanetStatus.REJECTED)
    if result is None:
        return _admin_response("error", message, code=404)

    return _admin_response("success", message, result)
