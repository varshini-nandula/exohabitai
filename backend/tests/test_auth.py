"""
ExoHabitAI — Authentication Test Suite
========================================
Tests for registration, login, JWT, RBAC, and protected routes.
"""

import pytest
from tests.conftest import register_user, login_user, get_auth_header, create_admin


# =========================================================================
# 1. REGISTRATION
# =========================================================================

class TestRegistration:
    """User registration endpoint tests."""

    def test_register_success(self, client):
        resp = register_user(client)
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["status"] == "success"
        assert data["data"]["user"]["username"] == "testuser"
        assert data["data"]["user"]["role"] == "user"
        # Password hash must NEVER appear in responses
        assert "password_hash" not in data["data"]["user"]

    def test_register_duplicate_username(self, client):
        register_user(client)
        resp = register_user(client, email="other@example.com")
        assert resp.status_code == 400
        assert "already taken" in resp.get_json()["message"]

    def test_register_duplicate_email(self, client):
        register_user(client)
        resp = register_user(client, username="other")
        assert resp.status_code == 400
        assert "already registered" in resp.get_json()["message"]

    def test_register_short_password(self, client):
        resp = register_user(client, password="short")
        assert resp.status_code == 400
        assert "at least" in resp.get_json()["message"]

    def test_register_invalid_email(self, client):
        resp = register_user(client, email="not-an-email")
        assert resp.status_code == 400
        assert "email" in resp.get_json()["message"].lower()

    def test_register_missing_fields(self, client):
        resp = client.post("/auth/register", json={})
        assert resp.status_code == 400

    def test_register_short_username(self, client):
        resp = register_user(client, username="ab")
        assert resp.status_code == 400
        assert "3 characters" in resp.get_json()["message"]


# =========================================================================
# 2. LOGIN
# =========================================================================

class TestLogin:
    """User login and JWT issuance tests."""

    def test_login_success(self, client):
        register_user(client)
        resp = login_user(client)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["status"] == "success"
        assert "access_token" in data["data"]
        assert data["data"]["user"]["username"] == "testuser"

    def test_login_wrong_password(self, client):
        register_user(client)
        resp = login_user(client, password="wrongpassword")
        assert resp.status_code == 401
        assert "Invalid credentials" in resp.get_json()["message"]

    def test_login_nonexistent_user(self, client):
        resp = login_user(client, username="ghost", password="doesntmatter")
        assert resp.status_code == 401
        # Same error message to prevent user enumeration
        assert "Invalid credentials" in resp.get_json()["message"]

    def test_login_missing_fields(self, client):
        resp = client.post("/auth/login", json={})
        assert resp.status_code == 400


# =========================================================================
# 3. PASSWORD HASHING
# =========================================================================

class TestPasswordSecurity:
    """Verify password hashing is working correctly."""

    def test_password_not_stored_plaintext(self, client, db_session):
        register_user(client)
        from models.user import User
        user = User.query.filter_by(username="testuser").first()
        assert user.password_hash != "securepass123"
        assert user.password_hash.startswith(("scrypt:", "pbkdf2:"))

    def test_check_password_correct(self, client, db_session):
        register_user(client)
        from models.user import User
        user = User.query.filter_by(username="testuser").first()
        assert user.check_password("securepass123") is True

    def test_check_password_incorrect(self, client, db_session):
        register_user(client)
        from models.user import User
        user = User.query.filter_by(username="testuser").first()
        assert user.check_password("wrongpassword") is False


# =========================================================================
# 4. JWT TOKEN VALIDATION
# =========================================================================

class TestJWT:
    """JWT generation and validation tests."""

    def test_valid_token_grants_access(self, client):
        headers = get_auth_header(client)
        resp = client.get("/auth/me", headers=headers)
        assert resp.status_code == 200
        assert resp.get_json()["data"]["user"]["username"] == "testuser"

    def test_missing_token_rejected(self, client):
        resp = client.get("/auth/me")
        assert resp.status_code == 401
        assert "missing_token" in resp.get_json().get("error_code", "")

    def test_invalid_token_rejected(self, client):
        headers = {"Authorization": "Bearer invalid.token.here"}
        resp = client.get("/auth/me", headers=headers)
        assert resp.status_code == 401

    def test_malformed_header_rejected(self, client):
        headers = {"Authorization": "NotBearer sometoken"}
        resp = client.get("/auth/me", headers=headers)
        assert resp.status_code == 401


# =========================================================================
# 5. PROTECTED ROUTES (admin-only)
# =========================================================================

class TestProtectedRoutes:
    """Verify admin-only endpoints reject non-admin users."""

    def test_retraining_logs_requires_admin(self, client):
        headers = get_auth_header(client)  # regular user
        resp = client.get("/retraining_logs", headers=headers)
        assert resp.status_code == 403
        assert "admin_required" in resp.get_json().get("error_code", "")

    def test_retraining_logs_allowed_for_admin(self, client):
        headers = create_admin(client)
        resp = client.get("/retraining_logs", headers=headers)
        assert resp.status_code == 200

    def test_recompute_requires_admin(self, client):
        headers = get_auth_header(client)  # regular user
        resp = client.post("/recompute", headers=headers)
        assert resp.status_code == 403

    def test_trigger_retraining_requires_admin(self, client):
        headers = get_auth_header(client)
        resp = client.post("/trigger_retraining", headers=headers)
        assert resp.status_code == 403

    def test_trigger_retraining_no_auth(self, client):
        resp = client.post("/trigger_retraining")
        assert resp.status_code == 401


# =========================================================================
# 6. PUBLIC ROUTES REMAIN ACCESSIBLE
# =========================================================================

class TestPublicRoutes:
    """Public endpoints must work without authentication."""

    def test_health_no_auth(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200

    def test_root_no_auth(self, client):
        resp = client.get("/")
        assert resp.status_code == 200

    def test_rank_no_auth(self, client):
        resp = client.get("/rank")
        assert resp.status_code == 200

    def test_stats_no_auth(self, client):
        resp = client.get("/stats")
        assert resp.status_code == 200


# =========================================================================
# 7. INACTIVE USERS
# =========================================================================

class TestInactiveUsers:
    """Deactivated accounts must be rejected."""

    def test_inactive_user_cannot_access_protected(self, client, db_session):
        register_user(client)
        # Deactivate the user directly in DB
        from models.user import User
        user = User.query.filter_by(username="testuser").first()
        user.is_active = False
        db_session.commit()

        # Login should fail
        resp = login_user(client)
        assert resp.status_code == 401
        assert "deactivated" in resp.get_json()["message"].lower()


# =========================================================================
# 8. LOGOUT
# =========================================================================

class TestLogout:
    """Logout endpoint tests."""

    def test_logout_success(self, client):
        headers = get_auth_header(client)
        resp = client.post("/auth/logout", headers=headers)
        assert resp.status_code == 200
        assert "success" in resp.get_json()["status"]

    def test_logout_requires_auth(self, client):
        resp = client.post("/auth/logout")
        assert resp.status_code == 401


# =========================================================================
# 9. ROLE CLAIMS IN JWT
# =========================================================================

class TestRoleClaims:
    """Verify JWT contains correct role claims."""

    def test_regular_user_has_user_role(self, client):
        headers = get_auth_header(client)
        resp = client.get("/auth/me", headers=headers)
        assert resp.get_json()["data"]["user"]["role"] == "user"

    def test_admin_has_admin_role(self, client):
        headers = create_admin(client)
        resp = client.get("/auth/me", headers=headers)
        assert resp.get_json()["data"]["user"]["role"] == "admin"
