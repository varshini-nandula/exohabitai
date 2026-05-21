"""
ExoHabitAI — Admin Protection Test Suite
==========================================
Validates that ALL admin-only endpoints are properly protected.

WHY THESE TESTS MATTER:
    If even ONE admin endpoint lacks proper authentication or
    authorization checks, attackers can escalate privileges and
    compromise the ML pipeline (e.g., trigger retraining with
    poisoned data, view audit logs, or modify predictions).

WHAT FAILURES WOULD INDICATE:
    - Missing @admin_required → privilege escalation vulnerability
    - Missing @jwt_required → unauthenticated access to governance
    - Wrong status codes → security monitoring can't detect attacks
"""

import pytest
from tests.conftest import get_auth_header, create_admin


# All admin-protected endpoints
ADMIN_ENDPOINTS = [
    ("POST", "/trigger_retraining"),
    ("GET", "/retraining_logs"),
    ("POST", "/recompute"),
]


class TestAdminEndpointsNoAuth:
    """All admin endpoints must return 401 without authentication."""

    @pytest.mark.parametrize("method,path", ADMIN_ENDPOINTS)
    def test_no_auth_returns_401(self, client, method, path):
        """Unauthenticated requests to admin endpoints → 401."""
        if method == "POST":
            resp = client.post(path)
        else:
            resp = client.get(path)
        assert resp.status_code == 401, (
            f"{method} {path} returned {resp.status_code} without auth"
        )


class TestAdminEndpointsRegularUser:
    """All admin endpoints must return 403 for regular users."""

    @pytest.mark.parametrize("method,path", ADMIN_ENDPOINTS)
    def test_regular_user_returns_403(self, client, method, path):
        """Regular users → 403 Forbidden on admin endpoints."""
        headers = get_auth_header(client)
        if method == "POST":
            resp = client.post(path, headers=headers)
        else:
            resp = client.get(path, headers=headers)
        assert resp.status_code == 403, (
            f"{method} {path} returned {resp.status_code} for regular user"
        )


class TestAdminEndpointsAdminUser:
    """All admin endpoints must be accessible by admin users."""

    @pytest.mark.parametrize("method,path", ADMIN_ENDPOINTS)
    def test_admin_user_granted_access(self, client, method, path):
        """Admin users → 200 or 202 on admin endpoints."""
        headers = create_admin(client)
        if method == "POST":
            resp = client.post(path, headers=headers)
        else:
            resp = client.get(path, headers=headers)
        assert resp.status_code in (200, 202), (
            f"{method} {path} returned {resp.status_code} for admin"
        )


class TestPrivilegeEscalation:
    """Verify no privilege escalation paths exist."""

    def test_registration_never_creates_admin(self, client):
        """Public registration must always create 'user' role."""
        resp = client.post("/auth/register", json={
            "username": "attacker",
            "email": "attacker@evil.com",
            "password": "securepass123",
            "role": "admin",
        })
        if resp.status_code == 201:
            assert resp.get_json()["data"]["user"]["role"] == "user"

    def test_invalid_token_no_admin_access(self, client):
        """Forged token with role=admin must be rejected."""
        import jwt as pyjwt
        fake_token = pyjwt.encode(
            {"sub": "999", "role": "admin", "username": "hacker"},
            "wrong-secret",
            algorithm="HS256",
        )
        headers = {"Authorization": f"Bearer {fake_token}"}
        resp = client.get("/retraining_logs", headers=headers)
        assert resp.status_code == 401


class TestErrorResponseConsistency:
    """Auth error responses must use consistent JSON format."""

    def test_401_has_error_code(self, client):
        """401 responses should include an error_code for client handling."""
        resp = client.get("/auth/me")
        data = resp.get_json()
        assert data["status"] == "error"
        assert "error_code" in data

    def test_403_has_error_code(self, client):
        """403 responses should include admin_required error_code."""
        headers = get_auth_header(client)
        resp = client.get("/retraining_logs", headers=headers)
        data = resp.get_json()
        assert data["status"] == "error"
        assert data.get("error_code") == "admin_required"
