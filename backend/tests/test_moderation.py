"""
ExoHabitAI — Moderation & Ownership Test Suite
================================================
Covers the moderation workflow introduced for user submissions:

    - POST /predict_and_store requires authentication
    - User submissions are stored as PENDING and owned by the submitter
    - PENDING planets are hidden from public /rank until approved
    - Approved planets appear in /rank
    - GET /my_planets returns only the caller's own submissions
    - POST /add_planet is deprecated (410)
    - GET /stats exposes approved / pending / rejected counts

These lock in the behaviour the frontend relies on while the admin
approval UI is still pending.
"""

import pytest

from tests.conftest import approve_all_planets


class TestSubmissionAuth:
    """Storing a planet now requires a valid JWT."""

    def test_predict_and_store_requires_auth(self, client, earth_like_payload):
        """No token → 401, nothing stored."""
        resp = client.post("/predict_and_store", json=earth_like_payload)
        assert resp.status_code == 401

    def test_predict_and_store_succeeds_with_auth(self, client, normal_user,
                                                  earth_like_payload):
        """Authenticated submission returns a prediction and stores the planet."""
        _user, headers = normal_user
        resp = client.post("/predict_and_store", json=earth_like_payload,
                            headers=headers)
        assert resp.status_code == 200
        data = resp.get_json()["data"]
        assert data["stored"] is True
        assert "habitability_probability" in data


class TestPendingWorkflow:
    """User submissions are pending and hidden until approved."""

    def test_submission_is_hidden_from_rank(self, client, normal_user,
                                            earth_like_payload):
        """A fresh (pending) submission must NOT appear in public rankings."""
        _user, headers = normal_user
        client.post("/predict_and_store", json=earth_like_payload, headers=headers)
        resp = client.get("/rank")
        names = [p["planet_name"] for p in resp.get_json()["data"]["planets"]]
        assert "Earth-Twin-Test" not in names

    def test_submission_visible_after_approval(self, client, normal_user,
                                               earth_like_payload):
        """Once approved, the submission appears in rankings."""
        _user, headers = normal_user
        client.post("/predict_and_store", json=earth_like_payload, headers=headers)
        approve_all_planets()
        resp = client.get("/rank")
        names = [p["planet_name"] for p in resp.get_json()["data"]["planets"]]
        assert "Earth-Twin-Test" in names

    def test_submission_status_is_pending(self, client, normal_user,
                                          earth_like_payload):
        """Stored submission carries status='pending'."""
        from models.exoplanet import Exoplanet, PlanetStatus
        _user, headers = normal_user
        client.post("/predict_and_store", json=earth_like_payload, headers=headers)
        planet = Exoplanet.query.filter_by(planet_name="Earth-Twin-Test").first()
        assert planet is not None
        assert planet.status == PlanetStatus.PENDING

    def test_submission_records_owner(self, client, normal_user,
                                      earth_like_payload):
        """created_by_user_id is populated from the JWT."""
        from models.exoplanet import Exoplanet
        user, headers = normal_user
        client.post("/predict_and_store", json=earth_like_payload, headers=headers)
        planet = Exoplanet.query.filter_by(planet_name="Earth-Twin-Test").first()
        assert planet.created_by_user_id == user["id"]


class TestMyPlanets:
    """GET /my_planets returns the caller's own submissions."""

    def test_requires_auth(self, client):
        resp = client.get("/my_planets")
        assert resp.status_code == 401

    def test_returns_own_submission(self, client, normal_user, earth_like_payload):
        _user, headers = normal_user
        client.post("/predict_and_store", json=earth_like_payload, headers=headers)
        resp = client.get("/my_planets", headers=headers)
        assert resp.status_code == 200
        data = resp.get_json()["data"]
        assert data["count"] == 1
        entry = data["planets"][0]
        assert entry["planet_name"] == "Earth-Twin-Test"
        assert entry["status"] == "pending"

    def test_only_returns_own(self, client, earth_like_payload, gas_giant_payload):
        """A user must not see another user's submissions."""
        from tests.conftest import get_auth_header
        alice = get_auth_header(client, username="alice")
        bob = get_auth_header(client, username="bob")

        client.post("/predict_and_store", json=earth_like_payload, headers=alice)
        client.post("/predict_and_store", json=gas_giant_payload, headers=bob)

        alice_planets = client.get("/my_planets", headers=alice).get_json()["data"]
        names = [p["planet_name"] for p in alice_planets["planets"]]
        assert names == ["Earth-Twin-Test"]
        assert alice_planets["count"] == 1


class TestDeprecatedAddPlanet:
    """The legacy /add_planet endpoint is gone."""

    def test_add_planet_returns_410(self, client, earth_like_payload):
        resp = client.post("/add_planet", json=earth_like_payload)
        assert resp.status_code == 410
        assert "/predict_and_store" in resp.get_json()["message"]


class TestStatsModeration:
    """/stats reports the moderation breakdown."""

    def test_stats_has_moderation_fields(self, client):
        data = client.get("/stats").get_json()["data"]
        for key in ("approved", "pending", "rejected"):
            assert key in data
            assert data[key] >= 0

    def test_pending_counted(self, client, normal_user, earth_like_payload):
        _user, headers = normal_user
        client.post("/predict_and_store", json=earth_like_payload, headers=headers)
        data = client.get("/stats").get_json()["data"]
        assert data["pending"] == 1
        assert data["approved"] == 0
