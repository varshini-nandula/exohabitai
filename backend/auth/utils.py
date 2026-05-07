"""
ExoHabitAI — JWT Utility Callbacks
====================================
Configures flask-jwt-extended callbacks that customise how JWTs
are created, decoded, and how errors are handled.

Why these callbacks matter:
    flask-jwt-extended uses callback functions to determine:
    1. What data goes INTO the JWT (additional_claims_callback)
    2. How to load the user from a JWT (user_lookup_callback)
    3. What happens when auth fails (expired/invalid/revoked tokens)

    Centralising these callbacks here keeps auth logic out of routes
    and ensures consistent error handling across all protected endpoints.
"""

import logging
from datetime import datetime, timezone

from flask import jsonify
from flask_jwt_extended import get_jwt

from extensions import db, jwt

logger = logging.getLogger("exohabitai.auth")


# ==========================================================================
# JWT Identity & Claims
# ==========================================================================

@jwt.user_identity_loader
def user_identity_lookup(user):
    """
    Define what the JWT "sub" (subject) claim contains.

    We use the user's database ID as the identity. This is:
    - Immutable (unlike usernames which might change)
    - Compact (integer, not a long string)
    - Suitable for database lookups

    Called automatically when create_access_token(identity=user) is used.
    """
    return str(user.id)


@jwt.additional_claims_loader
def add_claims_to_access_token(user):
    """
    Add custom claims to the JWT payload.

    Including role, username, and email in the token allows:
    - Authorization decisions without a database query
    - Frontend display of user info from the token
    - Audit logging with username context

    Security note: Claims are signed (tamper-proof) but NOT encrypted.
    Do not include sensitive data (password hashes, internal IDs, etc.).
    Anyone with the token can decode and read these claims.
    """
    return {
        "role": user.role,
        "username": user.username,
        "email": user.email,
    }


@jwt.user_lookup_loader
def user_lookup_callback(_jwt_header, jwt_data):
    """
    Load the full User object from the database using the JWT identity.

    Called by flask-jwt-extended when @jwt_required() is used and
    current_user is accessed. This enables:
    - Checking is_active status (deactivated users are rejected)
    - Accessing full user data in route handlers

    Returns None if the user doesn't exist or is deactivated,
    which triggers the user_lookup_error callback below.
    """
    from models.user import User

    identity = int(jwt_data["sub"])
    user = User.query.filter_by(id=identity).one_or_none()

    # Reject deactivated accounts even if the token is valid
    if user and not user.is_active:
        logger.warning(
            "Deactivated user attempted access: user_id=%s, username=%s",
            user.id, user.username,
        )
        return None

    return user


# ==========================================================================
# Error Handlers — consistent JSON responses for all auth failures
# ==========================================================================

@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_payload):
    """
    Handle expired JWT tokens.

    Tokens expire after JWT_ACCESS_TOKEN_EXPIRES. Clients must
    re-authenticate (POST /auth/login) to get a fresh token.

    Why tokens expire:
        Short-lived tokens limit the damage window if a token is stolen.
        An attacker with a stolen token can only use it until it expires.
    """
    logger.info(
        "Expired token used — sub=%s, exp=%s",
        jwt_payload.get("sub"), jwt_payload.get("exp"),
    )
    return jsonify({
        "status": "error",
        "message": "Token has expired. Please log in again.",
        "error_code": "token_expired",
    }), 401


@jwt.invalid_token_loader
def invalid_token_callback(error_string):
    """
    Handle malformed or tampered JWT tokens.

    This fires when the token cannot be decoded or its signature
    doesn't match. This could indicate:
    - A corrupted token
    - A token from a different application
    - An attempted forgery
    """
    logger.warning("Invalid token presented: %s", error_string)
    return jsonify({
        "status": "error",
        "message": "Invalid token. Please log in again.",
        "error_code": "invalid_token",
    }), 401


@jwt.unauthorized_loader
def missing_token_callback(error_string):
    """
    Handle requests to protected endpoints without a JWT.

    Clients must include: Authorization: Bearer <token>
    """
    return jsonify({
        "status": "error",
        "message": "Authentication required. Please include a valid Bearer token.",
        "error_code": "missing_token",
    }), 401


@jwt.revoked_token_loader
def revoked_token_callback(jwt_header, jwt_payload):
    """
    Handle revoked tokens (placeholder for future token blacklisting).

    Currently, token revocation is not implemented — this handler
    exists as a structural placeholder. In production, you might:
    - Use a Redis set to track revoked token JTIs
    - Check the set in a @jwt.token_in_blocklist_loader callback
    - Add revoked tokens on logout or password change

    For this project's maturity level, the deactivated-user check
    in user_lookup_callback provides equivalent protection.
    """
    logger.warning(
        "Revoked token used — sub=%s",
        jwt_payload.get("sub"),
    )
    return jsonify({
        "status": "error",
        "message": "Token has been revoked. Please log in again.",
        "error_code": "token_revoked",
    }), 401
