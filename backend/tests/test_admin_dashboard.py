"""
ExoHabitAI — Admin Dashboard Route Test Suite
================================================
Validates that the dashboard endpoint is protected and returns
correctly structured system status and platform statistics.
"""

import pytest
from tests.conftest import create_admin, get_auth_header


def test_dashboard_no_auth(client):
    """Unauthenticated requests to the dashboard → 401."""
    resp = client.get("/admin/dashboard")
    assert resp.status_code == 401
    assert resp.get_json()["status"] == "error"


def test_dashboard_regular_user(client):
    """Regular users → 403 Forbidden on dashboard."""
    headers = get_auth_header(client)
    resp = client.get("/admin/dashboard", headers=headers)
    assert resp.status_code == 403
    assert resp.get_json()["status"] == "error"
    assert resp.get_json()["error_code"] == "admin_required"


def test_dashboard_admin_user(client):
    """Admin users → 200 with complete system status and stats."""
    headers = create_admin(client)
    resp = client.get("/admin/dashboard", headers=headers)
    assert resp.status_code == 200

    data = resp.get_json()
    assert data["status"] == "success"
    assert "data" in data

    dashboard_data = data["data"]
    # Check structure
    assert "system_status" in dashboard_data
    assert "stats" in dashboard_data
    assert "current_model" in dashboard_data
    assert "last_retraining" in dashboard_data
    assert "recent_submissions" in dashboard_data

    # Check system_status contents
    sys_status = dashboard_data["system_status"]
    assert sys_status["backend_online"] is True
    assert sys_status["db_connected"] is True
    assert sys_status["model_loaded"] is True
    assert "model_version" in sys_status
    assert sys_status["retraining_in_progress"] is False

    # Check stats contents
    stats = dashboard_data["stats"]
    assert "total_users" in stats
    assert "total_planets" in stats
    assert "pending_submissions" in stats
    assert "approved_planets" in stats
    assert "rejected_planets" in stats
    assert "user_generated" in stats
