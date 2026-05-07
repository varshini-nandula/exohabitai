"""
ExoHabitAI — Auth Routes (Blueprint)
======================================
Authentication and user management endpoints.

Endpoint summary:
    POST /auth/register  — Create a new user account (public)
    POST /auth/login     — Authenticate and receive a JWT (public)
    GET  /auth/me        — Get current user profile (authenticated)
    POST /auth/logout    — Logout placeholder (authenticated)

Design decisions:
    - All responses follow the same JSON envelope as the rest of the API
    - Registration creates "user" role by default — no admin self-registration
    - Login returns a JWT access token in the response body
    - /auth/me allows the frontend to verify token validity and get user info
"""

import logging
from datetime import datetime, timezone

from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    jwt_required,
    get_jwt,
)

from auth.decorators import get_current_user
from auth.services import register_user, authenticate_user

logger = logging.getLogger("exohabitai.auth")

# Blueprint groups all auth routes under the /auth prefix
auth_bp = Blueprint("auth", __name__, url_prefix="/auth")


def _auth_response(status: str, message: str, data=None, code: int = 200):
    """
    Consistent JSON response matching the API envelope used everywhere.

    Mirrors the api_response() helper in app.py so auth responses
    feel cohesive with the rest of the API.
    """
    return jsonify({
        "status": status,
        "message": message,
        "data": data,
    }), code


# ==========================================================================
# POST /auth/register — Public registration
# ==========================================================================

@auth_bp.route("/register", methods=["POST"])
def register():
    """
    Register a new user account.

    Request body:
        {
            "username": "researcher_jane",
            "email": "jane@example.com",
            "password": "securepassword123"
        }

    Returns:
        201: User created successfully
        400: Validation error (missing fields, weak password, duplicate)
        500: Server error

    Security notes:
        - Always creates "user" role — never "admin"
        - Password is hashed before storage
        - Duplicate username/email returns 400
    """
    payload = request.get_json(silent=True)
    if not payload:
        return _auth_response("error", "Request body must be valid JSON", code=400)

    username = payload.get("username", "")
    email = payload.get("email", "")
    password = payload.get("password", "")

    # Service handles validation, hashing, and DB operations
    user, message = register_user(username, email, password)

    if user is None:
        return _auth_response("error", message, code=400)

    logger.info(
        "User registered via API: username=%s, email=%s",
        user.username, user.email,
    )

    return _auth_response(
        "success",
        message,
        {"user": user.to_dict()},
        code=201,
    )


# ==========================================================================
# POST /auth/login — Authenticate and get JWT
# ==========================================================================

@auth_bp.route("/login", methods=["POST"])
def login():
    """
    Authenticate a user and return a JWT access token.

    Request body:
        {
            "username": "researcher_jane",
            "password": "securepassword123"
        }

    Returns:
        200: Login successful, JWT returned
        401: Invalid credentials or deactivated account
        400: Missing fields

    The returned token should be included in subsequent requests as:
        Authorization: Bearer <access_token>

    Token contents (decoded):
        {
            "sub": 1,                          // user ID
            "role": "user",                    // role for authorization
            "username": "researcher_jane",     // display name
            "email": "jane@example.com",       // email
            "exp": 1715100000,                 // expiration timestamp
            "iat": 1715096400                  // issued-at timestamp
        }
    """
    payload = request.get_json(silent=True)
    if not payload:
        return _auth_response("error", "Request body must be valid JSON", code=400)

    username = payload.get("username", "")
    password = payload.get("password", "")

    if not username or not password:
        return _auth_response("error", "Username and password are required", code=400)

    # Authenticate via service layer
    user, message = authenticate_user(username, password)

    if user is None:
        return _auth_response("error", message, code=401)

    # Create JWT — user_identity_lookup and additional_claims_loader
    # (in auth/utils.py) control what goes into the token.
    access_token = create_access_token(identity=user)

    logger.info(
        "JWT issued: username=%s, role=%s",
        user.username, user.role,
    )

    return _auth_response(
        "success",
        message,
        {
            "access_token": access_token,
            "user": user.to_dict(),
        },
    )


# ==========================================================================
# GET /auth/me — Current user profile
# ==========================================================================

@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    """
    Return the currently authenticated user's profile.

    Requires: Authorization: Bearer <access_token>

    This endpoint serves multiple purposes:
        1. Token validation: If the token is expired/invalid, this returns 401
        2. User info: Frontend can display username, role, etc.
        3. Session check: Frontend can call this on page load to verify auth state

    No database query overhead beyond the user_lookup_callback
    that flask-jwt-extended already runs for @jwt_required().
    """
    user = get_current_user()
    if user is None:
        return _auth_response(
            "error",
            "User not found or account deactivated",
            code=401,
        )

    return _auth_response(
        "success",
        "User profile retrieved",
        {"user": user.to_dict()},
    )


# ==========================================================================
# POST /auth/logout — Logout (structural placeholder)
# ==========================================================================

@auth_bp.route("/logout", methods=["POST"])
@jwt_required()
def logout():
    """
    Logout endpoint (structural placeholder).

    In a stateless JWT system, the server doesn't track sessions.
    True server-side logout requires token revocation (e.g., Redis blocklist).

    For this project's maturity level, logout is handled client-side:
    the frontend simply discards the stored token.

    This endpoint exists to:
        1. Provide a consistent API surface
        2. Log the logout event for auditing
        3. Serve as a hook for future token revocation
    """
    claims = get_jwt()
    username = claims.get("username", "unknown")

    logger.info("User logged out: username=%s", username)

    return _auth_response(
        "success",
        "Logged out successfully. Please discard your token.",
    )
