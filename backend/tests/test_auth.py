"""
ExoHabitAI — Authentication & Authorization Test Suite
========================================================
Validates the entire auth lifecycle: registration, login, JWT handling,
role-based access control, and inactive-user rejection.

WHY THESE TESTS MATTER:
    Authentication is the security perimeter. If registration allows
    privilege escalation, or if JWTs can be forged, the entire platform
    is compromised. These tests verify that:
    - Only valid credentials produce tokens
    - Invalid/expired/malformed tokens are rejected
    - Admin endpoints are unreachable by regular users
    - Password hashes never leak in responses
    - Deactivated accounts cannot authenticate

WHAT FAILURES WOULD INDICATE:
    - Registration failures → user enumeration or validation bypass
    - Login failures → credential verification broken
    - JWT failures → token signing/verification compromised
    - RBAC failures → privilege escalation vulnerability
    - Inactive user failures → deactivated accounts still have access
"""

import pytest
from tests.conftest import register_user, login_user, get_auth_header, create_admin


# ===========================================================================
# 1. REGISTRATION — validates user creation flow
# ===========================================================================

class TestRegistration:
    """
    Registration endpoint tests.

    Security reasoning: Registration is the only public endpoint that
    creates database records. It must enforce uniqueness, password strength,
    and never allow admin self-registration.
    """

    def test_register_success(self, client):
        """Happy path: valid registration returns 201 with user data."""
        resp = register_user(client)
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["status"] == "success"
        assert data["data"]["user"]["username"] == "testuser"
        assert data["data"]["user"]["role"] == "user"  # NEVER admin via registration
        # Password hash must NEVER appear in API responses
        assert "password_hash" not in data["data"]["user"]
        assert "password" not in data["data"]["user"]

    def test_register_duplicate_username(self, client):
        """Duplicate username → 400. Prevents account collision."""
        register_user(client)
        resp = register_user(client, email="other@example.com")
        assert resp.status_code == 400
        assert "already taken" in resp.get_json()["message"]

    def test_register_duplicate_email(self, client):
        """Duplicate email → 400. One account per email address."""
        register_user(client)
        resp = register_user(client, username="other")
        assert resp.status_code == 400
        assert "already registered" in resp.get_json()["message"]

    def test_register_short_password(self, client):
        """Weak password → 400. Enforces minimum password strength."""
        resp = register_user(client, password="short")
        assert resp.status_code == 400
        assert "at least" in resp.get_json()["message"]

    def test_register_invalid_email(self, client):
        """Malformed email → 400. Catches typos before DB insert."""
        resp = register_user(client, email="not-an-email")
        assert resp.status_code == 400
        assert "email" in resp.get_json()["message"].lower()

    def test_register_missing_fields(self, client):
        """Empty payload → 400. All fields are required."""
        resp = client.post("/auth/register", json={})
        assert resp.status_code == 400

    def test_register_short_username(self, client):
        """Username under 3 chars → 400. Prevents trivial usernames."""
        resp = register_user(client, username="ab")
        assert resp.status_code == 400
        assert "3 characters" in resp.get_json()["message"]

    def test_register_special_chars_username(self, client):
        """Special characters in username → 400. Prevents injection."""
        resp = register_user(client, username="user@evil")
        assert resp.status_code == 400

    def test_register_no_json_body(self, client):
        """Non-JSON body → 400. Enforces content type."""
        resp = client.post("/auth/register", data="not json",
                           content_type="text/plain")
        assert resp.status_code == 400

    def test_register_always_creates_user_role(self, client):
        """
        Even if 'role' is sent in payload, it must NOT create an admin.
        This prevents privilege escalation via the public API.
        """
        resp = client.post("/auth/register", json={
            "username": "sneaky_admin",
            "email": "sneaky@example.com",
            "password": "securepass123",
            "role": "admin",  # attacker tries to escalate
        })
        # Registration should succeed but ignore the role field
        if resp.status_code == 201:
            assert resp.get_json()["data"]["user"]["role"] == "user"


# ===========================================================================
# 2. LOGIN — validates credential verification
# ===========================================================================

class TestLogin:
    """
    Login endpoint tests.

    Security reasoning: Login is the JWT issuance gate. Wrong password
    must never yield a token. Error messages must be vague enough to
    prevent username enumeration attacks.
    """

    def test_login_success(self, client):
        """Valid credentials → 200 + JWT access token."""
        register_user(client)
        resp = login_user(client)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["status"] == "success"
        assert "access_token" in data["data"]
        assert data["data"]["user"]["username"] == "testuser"
        # Token should be a non-empty string
        assert len(data["data"]["access_token"]) > 50

    def test_login_wrong_password(self, client):
        """Wrong password → 401 with generic error (prevents enumeration)."""
        register_user(client)
        resp = login_user(client, password="wrongpassword")
        assert resp.status_code == 401
        assert "Invalid credentials" in resp.get_json()["message"]

    def test_login_nonexistent_user(self, client):
        """Unknown user → 401 with SAME message as wrong password."""
        resp = login_user(client, username="ghost", password="doesntmatter")
        assert resp.status_code == 401
        # Must use the same error message to prevent username enumeration
        assert "Invalid credentials" in resp.get_json()["message"]

    def test_login_missing_fields(self, client):
        """No credentials → 400."""
        resp = client.post("/auth/login", json={})
        assert resp.status_code == 400

    def test_login_empty_username(self, client):
        """Empty username string → 400."""
        resp = client.post("/auth/login", json={
            "username": "",
            "password": "something",
        })
        assert resp.status_code == 400

    def test_login_no_json_body(self, client):
        """Non-JSON body on login → 400."""
        resp = client.post("/auth/login", data="not json",
                           content_type="text/plain")
        assert resp.status_code == 400

    def test_login_updates_last_login(self, client, db_session):
        """Successful login should update last_login_at timestamp."""
        register_user(client)
        resp = login_user(client)
        assert resp.status_code == 200

        from models.user import User
        user = User.query.filter_by(username="testuser").first()
        assert user.last_login_at is not None


# ===========================================================================
# 3. PASSWORD SECURITY — verifies hashing implementation
# ===========================================================================

class TestPasswordSecurity:
    """
    Validates that passwords are properly hashed using industry-standard
    algorithms (scrypt or pbkdf2). Plaintext storage would be a critical
    security vulnerability.
    """

    def test_password_not_stored_plaintext(self, client, db_session):
        """Password hash in DB must NOT equal the plaintext password."""
        register_user(client)
        from models.user import User
        user = User.query.filter_by(username="testuser").first()
        assert user.password_hash != "securepass123"
        # Werkzeug uses scrypt: or pbkdf2: prefixes
        assert user.password_hash.startswith(("scrypt:", "pbkdf2:"))

    def test_check_password_correct(self, client, db_session):
        """check_password() returns True for the correct password."""
        register_user(client)
        from models.user import User
        user = User.query.filter_by(username="testuser").first()
        assert user.check_password("securepass123") is True

    def test_check_password_incorrect(self, client, db_session):
        """check_password() returns False for wrong passwords."""
        register_user(client)
        from models.user import User
        user = User.query.filter_by(username="testuser").first()
        assert user.check_password("wrongpassword") is False

    def test_different_users_have_different_hashes(self, client, db_session):
        """Same password → different hashes (salt uniqueness)."""
        register_user(client, username="user1", email="u1@example.com",
                      password="samepassword123")
        register_user(client, username="user2", email="u2@example.com",
                      password="samepassword123")
        from models.user import User
        u1 = User.query.filter_by(username="user1").first()
        u2 = User.query.filter_by(username="user2").first()
        # Different salts → different hashes even for identical passwords
        assert u1.password_hash != u2.password_hash


# ===========================================================================
# 4. JWT TOKEN VALIDATION — verifies token lifecycle
# ===========================================================================

class TestJWT:
    """
    JWT generation and validation tests.

    Why this matters: JWTs are the backbone of stateless auth. If token
    verification is broken, attackers can forge identity. These tests
    ensure the full token lifecycle works: issuance → usage → rejection.
    """

    def test_valid_token_grants_access(self, client):
        """A token from login should grant access to protected routes."""
        headers = get_auth_header(client)
        resp = client.get("/auth/me", headers=headers)
        assert resp.status_code == 200
        assert resp.get_json()["data"]["user"]["username"] == "testuser"

    def test_missing_token_rejected(self, client):
        """No Authorization header → 401 with missing_token error code."""
        resp = client.get("/auth/me")
        assert resp.status_code == 401
        assert "missing_token" in resp.get_json().get("error_code", "")

    def test_invalid_token_rejected(self, client):
        """Garbage token → 401. Prevents forgery attempts."""
        headers = {"Authorization": "Bearer invalid.token.here"}
        resp = client.get("/auth/me", headers=headers)
        assert resp.status_code == 401

    def test_malformed_header_rejected(self, client):
        """Non-Bearer prefix → 401. Enforces Bearer token scheme."""
        headers = {"Authorization": "NotBearer sometoken"}
        resp = client.get("/auth/me", headers=headers)
        assert resp.status_code == 401

    def test_token_with_wrong_secret_rejected(self, client):
        """Token signed with a different secret must be rejected."""
        import jwt as pyjwt
        fake_token = pyjwt.encode(
            {"sub": "1", "role": "admin"},
            "wrong-secret-key",
            algorithm="HS256",
        )
        headers = {"Authorization": f"Bearer {fake_token}"}
        resp = client.get("/auth/me", headers=headers)
        assert resp.status_code == 401

    def test_empty_bearer_token_rejected(self, client):
        """'Bearer ' with no token → 422 or 401."""
        headers = {"Authorization": "Bearer "}
        resp = client.get("/auth/me", headers=headers)
        assert resp.status_code in (401, 422)

    def test_token_contains_user_claims(self, client):
        """Verify the /auth/me response includes expected user fields."""
        headers = get_auth_header(client)
        resp = client.get("/auth/me", headers=headers)
        user_data = resp.get_json()["data"]["user"]
        # These fields must be present for frontend display
        assert "id" in user_data
        assert "username" in user_data
        assert "email" in user_data
        assert "role" in user_data
        assert "created_at" in user_data


# ===========================================================================
# 5. ROLE-BASED ACCESS CONTROL — admin vs user authorization
# ===========================================================================

class TestProtectedRoutes:
    """
    Verify admin-only endpoints reject non-admin users with 403.

    Security reasoning: The distinction between 401 (unauthenticated)
    and 403 (unauthorized) is critical. 401 means "who are you?"
    while 403 means "I know you, but you can't do this."
    """

    def test_retraining_logs_requires_admin(self, client):
        """Regular user → 403 on admin endpoint."""
        headers = get_auth_header(client)
        resp = client.get("/retraining_logs", headers=headers)
        assert resp.status_code == 403
        assert "admin_required" in resp.get_json().get("error_code", "")

    def test_retraining_logs_allowed_for_admin(self, client):
        """Admin user → 200 on admin endpoint."""
        headers = create_admin(client)
        resp = client.get("/retraining_logs", headers=headers)
        assert resp.status_code == 200

    def test_recompute_requires_admin(self, client):
        """Regular user cannot trigger recomputation."""
        headers = get_auth_header(client)
        resp = client.post("/recompute", headers=headers)
        assert resp.status_code == 403

    def test_recompute_allowed_for_admin(self, client):
        """Admin can trigger recomputation."""
        headers = create_admin(client)
        resp = client.post("/recompute", headers=headers)
        assert resp.status_code == 200

    def test_trigger_retraining_requires_admin(self, client):
        """Regular user cannot trigger retraining."""
        headers = get_auth_header(client)
        resp = client.post("/trigger_retraining", headers=headers)
        assert resp.status_code == 403

    def test_trigger_retraining_no_auth(self, client):
        """No auth → 401 on admin endpoint."""
        resp = client.post("/trigger_retraining")
        assert resp.status_code == 401

    def test_recompute_no_auth(self, client):
        """No auth → 401 on admin endpoint."""
        resp = client.post("/recompute")
        assert resp.status_code == 401

    def test_retraining_logs_no_auth(self, client):
        """No auth → 401 on admin endpoint."""
        resp = client.get("/retraining_logs")
        assert resp.status_code == 401


# ===========================================================================
# 6. PUBLIC ROUTES — must remain accessible without auth
# ===========================================================================

class TestPublicRoutes:
    """
    Public endpoints must work without any authentication.

    WHY: health, stats, rank, and prediction endpoints are designed
    to be publicly accessible. Adding accidental auth requirements
    would break the frontend and monitoring systems.
    """

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

    def test_predict_no_auth(self, client, earth_like_payload):
        """Prediction endpoint should be publicly accessible."""
        resp = client.post("/predict", json=earth_like_payload)
        assert resp.status_code == 200

    def test_retraining_status_no_auth(self, client):
        """Retraining status is read-only — public access allowed."""
        resp = client.get("/retraining_status")
        assert resp.status_code == 200


# ===========================================================================
# 7. INACTIVE USERS — deactivated accounts must be rejected
# ===========================================================================

class TestInactiveUsers:
    """
    Deactivated accounts must be rejected at both login and token usage.

    WHY: When a user is deactivated (e.g., for abuse), they must lose
    access immediately. If existing tokens still work, deactivation
    is ineffective. These tests verify both paths.
    """

    def test_inactive_user_cannot_login(self, client, db_session):
        """Deactivated user → login rejected with clear message."""
        register_user(client)
        from models.user import User
        user = User.query.filter_by(username="testuser").first()
        user.is_active = False
        db_session.commit()

        resp = login_user(client)
        assert resp.status_code == 401
        assert "deactivated" in resp.get_json()["message"].lower()

    def test_inactive_user_token_rejected(self, client, db_session):
        """
        A valid token from BEFORE deactivation must be rejected.

        This tests the user_lookup_callback in auth/utils.py which
        checks is_active on every protected request.
        """
        # Get a valid token first
        headers = get_auth_header(client)

        # Deactivate the user
        from models.user import User
        user = User.query.filter_by(username="testuser").first()
        user.is_active = False
        db_session.commit()

        # Token should now be rejected
        resp = client.get("/auth/me", headers=headers)
        assert resp.status_code == 401


# ===========================================================================
# 8. LOGOUT — structural verification
# ===========================================================================

class TestLogout:
    """Logout endpoint tests (stateless — client discards token)."""

    def test_logout_success(self, client):
        headers = get_auth_header(client)
        resp = client.post("/auth/logout", headers=headers)
        assert resp.status_code == 200
        assert "success" in resp.get_json()["status"]

    def test_logout_requires_auth(self, client):
        resp = client.post("/auth/logout")
        assert resp.status_code == 401


# ===========================================================================
# 9. ROLE CLAIMS — JWT contains correct authorization data
# ===========================================================================

class TestRoleClaims:
    """Verify JWT claims contain the correct role for authorization."""

    def test_regular_user_has_user_role(self, client):
        headers = get_auth_header(client)
        resp = client.get("/auth/me", headers=headers)
        assert resp.get_json()["data"]["user"]["role"] == "user"

    def test_admin_has_admin_role(self, client):
        headers = create_admin(client)
        resp = client.get("/auth/me", headers=headers)
        assert resp.get_json()["data"]["user"]["role"] == "admin"


# ===========================================================================
# 10. USER SERIALIZATION — to_dict() safety
# ===========================================================================

class TestUserSerialization:
    """Verify user serialization never leaks sensitive data."""

    def test_to_dict_excludes_password_hash(self, client, db_session):
        """to_dict() must never include password_hash."""
        register_user(client)
        from models.user import User
        user = User.query.filter_by(username="testuser").first()
        user_dict = user.to_dict()
        assert "password_hash" not in user_dict
        assert "password" not in user_dict

    def test_to_dict_includes_required_fields(self, client, db_session):
        """to_dict() must include all frontend-required fields."""
        register_user(client)
        from models.user import User
        user = User.query.filter_by(username="testuser").first()
        user_dict = user.to_dict()
        required = {"id", "username", "email", "role", "is_active", "created_at"}
        assert required.issubset(set(user_dict.keys()))
