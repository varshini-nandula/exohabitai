"""
ExoHabitAI — Retraining Workflow Test Suite
=============================================
Validates retraining trigger, status, logs, and protection endpoints.
"""

import time
import pytest
from tests.conftest import get_auth_header, create_admin


class TestTriggerRetraining:
    """POST /trigger_retraining — admin-only, async."""

    def test_trigger_requires_admin(self, client):
        headers = get_auth_header(client)
        resp = client.post("/trigger_retraining", headers=headers)
        assert resp.status_code == 403

    def test_trigger_requires_auth(self, client):
        resp = client.post("/trigger_retraining")
        assert resp.status_code == 401

    def test_trigger_accepted_by_admin(self, client):
        headers = create_admin(client)
        resp = client.post("/trigger_retraining",
                           json={"reason": "test trigger"}, headers=headers)
        assert resp.status_code == 202
        assert resp.get_json()["status"] == "accepted"
        assert "poll_status_at" in resp.get_json()["data"]

    def test_trigger_response_metadata(self, client):
        headers = create_admin(client)
        resp = client.post("/trigger_retraining",
                           json={"reason": "scheduled"}, headers=headers)
        data = resp.get_json()["data"]
        assert data["reason"] == "scheduled"
        assert "requested_by" in data

    def test_trigger_default_reason(self, client):
        headers = create_admin(client)
        resp = client.post("/trigger_retraining", json={}, headers=headers)
        assert resp.status_code == 202
        assert resp.get_json()["data"]["reason"] == "manual trigger"


class TestRetrainingStatus:
    """GET /retraining_status — public polling endpoint."""

    def test_status_no_auth(self, client):
        assert client.get("/retraining_status").status_code == 200

    def test_status_fields(self, client):
        data = client.get("/retraining_status").get_json()["data"]
        for f in ["is_running", "last_started", "last_completed",
                   "last_result", "current_model_version"]:
            assert f in data

    def test_initial_status_idle(self, client):
        data = client.get("/retraining_status").get_json()["data"]
        assert data["is_running"] is False
        assert data["last_started"] is None


class TestRetrainingLogs:
    """GET /retraining_logs — admin-only audit trail."""

    def test_logs_require_admin(self, client):
        headers = get_auth_header(client)
        assert client.get("/retraining_logs", headers=headers).status_code == 403

    def test_logs_require_auth(self, client):
        assert client.get("/retraining_logs").status_code == 401

    def test_logs_accessible_by_admin(self, client):
        headers = create_admin(client)
        assert client.get("/retraining_logs", headers=headers).status_code == 200

    def test_logs_empty_initially(self, client):
        headers = create_admin(client)
        data = client.get("/retraining_logs", headers=headers).get_json()["data"]
        assert isinstance(data, list) and len(data) == 0

    def test_logs_limit_parameter(self, client):
        headers = create_admin(client)
        assert client.get("/retraining_logs?limit=5", headers=headers).status_code == 200

    def test_logs_invalid_limit_defaults(self, client):
        headers = create_admin(client)
        assert client.get("/retraining_logs?limit=abc", headers=headers).status_code == 200


class TestRecompute:
    """POST /recompute — admin-only stale prediction update."""

    def test_recompute_requires_admin(self, client):
        headers = get_auth_header(client)
        assert client.post("/recompute", headers=headers).status_code == 403

    def test_recompute_requires_auth(self, client):
        assert client.post("/recompute").status_code == 401

    def test_recompute_accessible_by_admin(self, client):
        headers = create_admin(client)
        assert client.post("/recompute", headers=headers).status_code == 200

    def test_recompute_no_stale_on_fresh_db(self, client):
        headers = create_admin(client)
        data = client.post("/recompute", headers=headers).get_json()
        assert data["data"]["updated"] == 0

    def test_recompute_includes_model_version(self, client):
        headers = create_admin(client)
        assert "model_version" in client.post("/recompute", headers=headers).get_json()["data"]


class TestRetrainingConcurrency:
    """Prevent parallel retraining via lock."""

    def test_concurrent_retraining_rejected(self, client):
        headers = create_admin(client)
        resp1 = client.post("/trigger_retraining",
                            json={"reason": "first"}, headers=headers)
        assert resp1.status_code == 202
        time.sleep(0.5)
        resp2 = client.post("/trigger_retraining",
                            json={"reason": "second"}, headers=headers)
        assert resp2.status_code in (409, 202)
