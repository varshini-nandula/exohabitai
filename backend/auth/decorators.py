"""
ExoHabitAI — Authorization Decorators
=======================================
Reusable decorators for role-based access control (RBAC).

Design decisions:
    1. @admin_required wraps @jwt_required() so you don't need both.
       This reduces boilerplate: one decorator does auth + authz.

    2. Role checks use the JWT claims (no DB query needed).
       The role was embedded in the token at login time. If a user's
       role changes, they must re-authenticate to get a new token
       reflecting the updated role. This is acceptable because:
       - Role changes are rare (admin action)
       - Tokens are short-lived (1 hour default)

    3. Error responses are consistent JSON matching the api_response()
       format used throughout the backend.

Usage:
    @app.route("/admin/something")
    @admin_required()
    def admin_endpoint():
        # Only admin users reach this code
        user = get_current_user()
        ...

    @app.route("/protected/something")
    @jwt_required()
    def user_endpoint():
        # Any authenticated user (admin or regular) can access
        user = get_current_user()
        ...
"""

import logging
from functools import wraps

from flask import jsonify
from flask_jwt_extended import jwt_required, get_jwt, verify_jwt_in_request, current_user

from models.user import UserRole

logger = logging.getLogger("exohabitai.auth")


def admin_required():
    """
    Decorator that requires the request to come from an admin user.

    Combines JWT verification + role check in one decorator.

    Flow:
        1. Verify the JWT (same as @jwt_required)
        2. Extract the "role" claim from the token
        3. If role != "admin", return 403 Forbidden
        4. If role == "admin", execute the route handler

    Why 403 and not 401?
        - 401 Unauthorized = "I don't know who you are" (missing/invalid token)
        - 403 Forbidden = "I know who you are, but you can't do this" (wrong role)

        This distinction matters for security logging and client-side handling.
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            # Step 1: Verify JWT (handles expired/invalid/missing tokens)
            verify_jwt_in_request()

            # Step 2: Check role claim
            claims = get_jwt()
            user_role = claims.get("role", "")

            if user_role != UserRole.ADMIN:
                logger.warning(
                    "Non-admin access attempt — user=%s, role=%s, endpoint=%s",
                    claims.get("username", "unknown"),
                    user_role,
                    fn.__name__,
                )
                return jsonify({
                    "status": "error",
                    "message": "Admin access required. This action is restricted to administrators.",
                    "error_code": "admin_required",
                }), 403

            return fn(*args, **kwargs)
        return wrapper
    return decorator


def get_current_user():
    """
    Convenience function to get the current authenticated user.

    Must be called from within a route decorated with @jwt_required()
    or @admin_required(). Returns the User object loaded by
    user_lookup_callback in auth/utils.py.

    Returns None if no user context is available (shouldn't happen
    inside a protected route, but defensive coding is good practice).
    """
    return current_user


def get_current_user_id() -> int | None:
    """
    Get the current user's database ID from the JWT.

    Uses JWT claims directly (no DB query). Useful for ownership
    tracking when you just need the ID, not the full User object.
    """
    try:
        claims = get_jwt()
        return claims.get("sub")
    except Exception:
        return None
