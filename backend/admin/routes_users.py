"""
ExoHabitAI — Admin User Management Routes
============================================
View, search, and manage user accounts.

Endpoints:
    GET  /admin/users                  — Paginated user list with filters
    GET  /admin/users/<id>             — User detail with submission stats
    POST /admin/users/<id>/activate    — Reactivate account
    POST /admin/users/<id>/deactivate  — Deactivate account (preserves audit trail)
    POST /admin/users/<id>/promote     — Promote to admin role
    POST /admin/users/<id>/demote      — Demote to user role

Safety rules:
    - Admin cannot deactivate/demote themselves
    - Last admin cannot be demoted (at least one admin must exist)
"""

import logging

from flask import request
from flask_jwt_extended import get_jwt

from auth.decorators import admin_required
from admin.routes_dashboard import admin_bp, _admin_response
from admin.services import (
    get_users, get_user_detail,
    update_user_status, update_user_role,
)
from models.user import UserRole

logger = logging.getLogger("exohabitai.admin")


def _get_admin_user_id() -> int | None:
    """Extract the current admin's user ID from the JWT."""
    try:
        claims = get_jwt()
        return int(claims.get("sub"))
    except (TypeError, ValueError):
        return None


@admin_bp.route("/users", methods=["GET"])
@admin_required()
def list_users():
    """List all users with optional search, role filter, and pagination."""
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    search = request.args.get("search", None)
    role = request.args.get("role", None)

    # Parse is_active filter
    is_active_raw = request.args.get("is_active", None)
    is_active = None
    if is_active_raw is not None:
        is_active = is_active_raw.lower() in ("true", "1", "yes")

    items, total, pg, pp = get_users(
        search=search, role=role, is_active=is_active,
        page=page, per_page=per_page,
    )

    return _admin_response("success", f"Retrieved {len(items)} user(s)", {
        "users": items,
        "total": total,
        "page": pg,
        "per_page": pp,
        "total_pages": (total + pp - 1) // pp if pp > 0 else 0,
    })


@admin_bp.route("/users/<int:user_id>", methods=["GET"])
@admin_required()
def user_detail(user_id):
    """User detail with submission statistics."""
    detail = get_user_detail(user_id)
    if detail is None:
        return _admin_response("error", f"User {user_id} not found", code=404)

    return _admin_response("success", "User detail retrieved", detail)


@admin_bp.route("/users/<int:user_id>/activate", methods=["POST"])
@admin_required()
def activate_user(user_id):
    """Reactivate a deactivated user account."""
    admin_id = _get_admin_user_id()
    result, message = update_user_status(user_id, active=True, admin_user_id=admin_id)
    if result is None:
        return _admin_response("error", message, code=400)
    return _admin_response("success", message, result)


@admin_bp.route("/users/<int:user_id>/deactivate", methods=["POST"])
@admin_required()
def deactivate_user(user_id):
    """Deactivate a user account (preserves audit trail)."""
    admin_id = _get_admin_user_id()
    result, message = update_user_status(user_id, active=False, admin_user_id=admin_id)
    if result is None:
        return _admin_response("error", message, code=400)
    return _admin_response("success", message, result)


@admin_bp.route("/users/<int:user_id>/promote", methods=["POST"])
@admin_required()
def promote_user(user_id):
    """Promote a regular user to admin role."""
    admin_id = _get_admin_user_id()
    result, message = update_user_role(user_id, UserRole.ADMIN, admin_user_id=admin_id)
    if result is None:
        return _admin_response("error", message, code=400)
    return _admin_response("success", message, result)


@admin_bp.route("/users/<int:user_id>/demote", methods=["POST"])
@admin_required()
def demote_user(user_id):
    """Demote an admin user to regular user role."""
    admin_id = _get_admin_user_id()
    result, message = update_user_role(user_id, UserRole.USER, admin_user_id=admin_id)
    if result is None:
        return _admin_response("error", message, code=400)
    return _admin_response("success", message, result)
