"""
ExoHabitAI — Health & System Endpoint Test Suite
==================================================
Validates /, /health, /stats, and /retraining_status for correctness.

WHY THESE TESTS MATTER:
    Health and system endpoints are used by:
    - Load balancers (to decide if the instance is healthy)
    - Monitoring dashboards (to detect degradation)
    - Frontend (to display system status)
    If these endpoints return wrong data or crash, the entire operational
    pipeline (monitoring, alerting, auto-scaling) breaks silently.

WHAT FAILURES WOULD INDICATE:
    - Root endpoint failure → app failed to start correctly
    - /health failure → DB or model status reporting is broken
    - /stats failure → aggregate queries are broken
    - /retraining_status failure → retraining state tracking is broken
"""

import pytest


# ===========================================================================
# 1. ROOT ENDPOINT — basic liveness check
# ===========================================================================

class TestRootEndpoint:
    """
    GET / — confirms the backend is running.

    Used by load balancers as a quick liveness probe.
    Must always return 200 if the app started successfully.
    """

    def test_root_returns_200(self, client):
        """Root must return 200 — the most basic liveness check."""
        resp = client.get("/")
        assert resp.status_code == 200

    def test_root_response_structure(self, client):
        """Root response must include model info for debugging."""
        resp = client.get("/")
        data = resp.get_json()
        assert data["status"] == "success"
        assert "data" in data
        # Model type confirms the pipeline loaded correctly
        assert "model_type" in data["data"]
        # Model version for tracking which pipeline is serving
        assert "model_version" in data["data"]
        # Threshold for understanding prediction behavior
        assert "threshold" in data["data"]

    def test_root_threshold_is_numeric(self, client):
        """Threshold must be a valid float between 0 and 1."""
        resp = client.get("/")
        threshold = resp.get_json()["data"]["threshold"]
        assert isinstance(threshold, float)
        assert 0.0 <= threshold <= 1.0

    def test_root_model_version_format(self, client):
        """Model version should follow the v2_pipeline_<hash> format."""
        resp = client.get("/")
        version = resp.get_json()["data"]["model_version"]
        assert isinstance(version, str)
        assert version.startswith("v2_pipeline_")


# ===========================================================================
# 2. HEALTH ENDPOINT — comprehensive system check
# ===========================================================================

class TestHealthEndpoint:
    """
    GET /health — verifies model, DB, and retraining state.

    This is the readiness probe — it tells the infrastructure whether
    the service can actually handle requests (model loaded, DB reachable).
    """

    def test_health_returns_200(self, client):
        """Health endpoint must return 200 when system is healthy."""
        resp = client.get("/health")
        assert resp.status_code == 200

    def test_health_response_fields(self, client):
        """Health response must include all diagnostic fields."""
        resp = client.get("/health")
        data = resp.get_json()["data"]
        required_fields = {
            "model_loaded", "model_version", "dataset_version",
            "db_connected", "threshold", "retraining_in_progress",
        }
        assert required_fields.issubset(set(data.keys())), (
            f"Missing health fields: {required_fields - set(data.keys())}"
        )

    def test_model_is_loaded(self, client):
        """Model must be loaded in memory for predictions to work."""
        resp = client.get("/health")
        assert resp.get_json()["data"]["model_loaded"] is True

    def test_db_is_connected(self, client):
        """DB connectivity probe should pass with test DB."""
        resp = client.get("/health")
        assert resp.get_json()["data"]["db_connected"] is True

    def test_retraining_not_running_at_start(self, client):
        """No retraining should be in progress on fresh startup."""
        resp = client.get("/health")
        assert resp.get_json()["data"]["retraining_in_progress"] is False

    def test_health_status_ok_when_healthy(self, client):
        """Status should be 'ok' when all systems are functional."""
        resp = client.get("/health")
        status = resp.get_json()["status"]
        assert status == "ok"

    def test_health_no_auth_required(self, client):
        """Health endpoint must be public (no auth)."""
        resp = client.get("/health")
        assert resp.status_code == 200  # Not 401


# ===========================================================================
# 3. STATS ENDPOINT — database aggregate statistics
# ===========================================================================

class TestStatsEndpoint:
    """
    GET /stats — returns aggregate statistics about stored planets.

    Used by the frontend dashboard to display counts and summaries.
    """

    def test_stats_returns_200(self, client):
        resp = client.get("/stats")
        assert resp.status_code == 200

    def test_stats_response_fields(self, client):
        """Stats must include all dashboard-required fields."""
        resp = client.get("/stats")
        data = resp.get_json()["data"]
        required_fields = {
            "total_planets", "with_prediction", "habitable",
            "non_habitable", "user_generated", "dataset_seeded",
            "threshold",
        }
        assert required_fields.issubset(set(data.keys()))

    def test_stats_values_are_non_negative(self, client):
        """All count fields must be >= 0 (no negative counts)."""
        resp = client.get("/stats")
        data = resp.get_json()["data"]
        for key in ["total_planets", "with_prediction", "habitable",
                     "non_habitable", "user_generated", "dataset_seeded"]:
            assert data[key] >= 0, f"{key} is negative: {data[key]}"

    def test_stats_counts_are_consistent(self, client):
        """habitable + non_habitable should equal with_prediction."""
        resp = client.get("/stats")
        data = resp.get_json()["data"]
        assert data["habitable"] + data["non_habitable"] == data["with_prediction"]

    def test_stats_seeded_plus_user_equals_total(self, client):
        """dataset_seeded + user_generated should equal total_planets."""
        resp = client.get("/stats")
        data = resp.get_json()["data"]
        assert data["dataset_seeded"] + data["user_generated"] == data["total_planets"]

    def test_stats_empty_database(self, client):
        """Clean test DB should have zero planets."""
        resp = client.get("/stats")
        data = resp.get_json()["data"]
        assert data["total_planets"] == 0

    def test_stats_after_storing_planet(self, client, earth_like_payload):
        """After storing a planet, stats should reflect it."""
        client.post("/predict_and_store_batch", json=[earth_like_payload])
        resp = client.get("/stats")
        data = resp.get_json()["data"]
        assert data["total_planets"] == 1
        assert data["user_generated"] == 1
        assert data["with_prediction"] == 1


# ===========================================================================
# 4. RETRAINING STATUS ENDPOINT — polling state
# ===========================================================================

class TestRetrainingStatusEndpoint:
    """
    GET /retraining_status — returns the current retraining job state.

    This endpoint is polled by the frontend after triggering a retrain.
    """

    def test_status_returns_200(self, client):
        resp = client.get("/retraining_status")
        assert resp.status_code == 200

    def test_status_response_fields(self, client):
        """Status must include all required polling fields."""
        resp = client.get("/retraining_status")
        data = resp.get_json()["data"]
        required_fields = {
            "is_running", "last_started", "last_completed",
            "last_result", "current_model_version",
        }
        assert required_fields.issubset(set(data.keys()))

    def test_status_not_running_initially(self, client):
        """No retraining should be running on fresh startup."""
        resp = client.get("/retraining_status")
        assert resp.get_json()["data"]["is_running"] is False

    def test_status_no_auth_required(self, client):
        """Retraining status is public (read-only information)."""
        resp = client.get("/retraining_status")
        assert resp.status_code == 200


# ===========================================================================
# 5. ERROR HANDLING — 404 and method not allowed
# ===========================================================================

class TestErrorHandling:
    """Verify global error handlers return consistent JSON envelopes."""

    def test_404_returns_json(self, client):
        """Unknown routes should return JSON, not HTML."""
        resp = client.get("/nonexistent_route")
        assert resp.status_code == 404
        data = resp.get_json()
        assert data is not None
        assert data["status"] == "error"

    def test_405_method_not_allowed(self, client):
        """Wrong HTTP method should return 405 with JSON."""
        resp = client.delete("/health")
        assert resp.status_code == 405
        data = resp.get_json()
        assert data is not None
        assert data["status"] == "error"

    def test_predict_get_not_allowed(self, client):
        """/predict only accepts POST."""
        resp = client.get("/predict")
        assert resp.status_code == 405
