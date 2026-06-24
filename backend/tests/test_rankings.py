"""
ExoHabitAI — Rankings Endpoint Test Suite
===========================================
Validates GET /rank for correctness, ordering, pagination, and edge cases.

WHY THESE TESTS MATTER:
    The ranking endpoint is the primary data display endpoint. If rankings
    are unordered, missing planets, or returning wrong schemas, the
    frontend's main feature (the habitability leaderboard) breaks.

WHAT FAILURES WOULD INDICATE:
    - Ordering failures → SQL ORDER BY is broken or probability column is corrupt
    - Pagination failures → limit parameter not working
    - Schema failures → frontend integration breaks
    - Empty DB failures → edge case handling is missing
"""

import pytest

from tests.conftest import approve_all_planets


# ===========================================================================
# 1. BASIC RANKING FUNCTIONALITY
# ===========================================================================

class TestRankingBasics:
    """Verify fundamental ranking behavior."""

    def test_rank_returns_200(self, client):
        """Rank endpoint must return 200 even on empty DB."""
        resp = client.get("/rank")
        assert resp.status_code == 200

    def test_rank_response_structure(self, client):
        """Response must have the expected envelope and data fields."""
        resp = client.get("/rank")
        data = resp.get_json()
        assert data["status"] == "success"
        assert "data" in data
        assert "planets" in data["data"]
        assert "model_version" in data["data"]
        assert "returned_count" in data["data"]

    def test_rank_empty_database(self, client):
        """Empty DB → empty planets list with count 0."""
        resp = client.get("/rank")
        data = resp.get_json()["data"]
        assert data["planets"] == []
        assert data["returned_count"] == 0


# ===========================================================================
# 2. RANKING WITH DATA — ordering and content
# ===========================================================================

class TestRankingWithData:
    """Verify ranking after storing planets."""

    def test_stored_planets_appear_ranked(self, client, earth_like_payload,
                                           gas_giant_payload):
        """Stored planets should appear in the ranking."""
        client.post("/predict_and_store_batch",
                     json=[earth_like_payload, gas_giant_payload])
        approve_all_planets()
        resp = client.get("/rank")
        data = resp.get_json()["data"]
        assert data["returned_count"] == 2
        assert len(data["planets"]) == 2

    def test_ranking_is_descending(self, client, earth_like_payload,
                                     gas_giant_payload):
        """Planets must be ordered by habitability_probability descending."""
        client.post("/predict_and_store_batch",
                     json=[earth_like_payload, gas_giant_payload])
        approve_all_planets()
        resp = client.get("/rank")
        planets = resp.get_json()["data"]["planets"]
        probs = [p["habitability_probability"] for p in planets]
        assert probs == sorted(probs, reverse=True), (
            f"Ranking is not in descending order: {probs}"
        )

    def test_rank_numbers_are_sequential(self, client, earth_like_payload,
                                          gas_giant_payload):
        """Rank numbers should be 1, 2, 3, ... (sequential)."""
        client.post("/predict_and_store_batch",
                     json=[earth_like_payload, gas_giant_payload])
        approve_all_planets()
        resp = client.get("/rank")
        planets = resp.get_json()["data"]["planets"]
        ranks = [p["rank"] for p in planets]
        assert ranks == list(range(1, len(planets) + 1))

    def test_each_planet_has_required_fields(self, client, earth_like_payload):
        """Each planet in the ranking must have rank, name, and probability."""
        client.post("/predict_and_store_batch", json=[earth_like_payload])
        approve_all_planets()
        resp = client.get("/rank")
        planet = resp.get_json()["data"]["planets"][0]
        assert "rank" in planet
        assert "planet_name" in planet
        assert "habitability_probability" in planet


# ===========================================================================
# 3. PAGINATION — limit parameter
# ===========================================================================

class TestRankingPagination:
    """
    Verify the limit query parameter works correctly.

    Pagination prevents the frontend from loading thousands of planets
    at once, which would be slow and memory-intensive.
    """

    def test_limit_returns_correct_count(self, client, earth_like_payload,
                                          gas_giant_payload):
        """limit=1 should return exactly 1 planet."""
        client.post("/predict_and_store_batch",
                     json=[earth_like_payload, gas_giant_payload])
        approve_all_planets()
        resp = client.get("/rank?limit=1")
        data = resp.get_json()["data"]
        assert len(data["planets"]) == 1
        assert data["returned_count"] == 1

    def test_limit_all_returns_everything(self, client, earth_like_payload,
                                            gas_giant_payload):
        """limit=all returns all planets."""
        client.post("/predict_and_store_batch",
                     json=[earth_like_payload, gas_giant_payload])
        approve_all_planets()
        resp = client.get("/rank?limit=all")
        data = resp.get_json()["data"]
        assert data["returned_count"] == 2

    def test_default_limit_is_all(self, client, earth_like_payload):
        """No limit parameter → returns all planets."""
        client.post("/predict_and_store_batch", json=[earth_like_payload])
        approve_all_planets()
        resp = client.get("/rank")
        assert resp.get_json()["data"]["returned_count"] >= 1

    def test_invalid_limit_rejected(self, client):
        """Non-numeric limit → 400."""
        resp = client.get("/rank?limit=abc")
        assert resp.status_code == 400

    def test_negative_limit_rejected(self, client):
        """Negative limit → 400."""
        resp = client.get("/rank?limit=-1")
        assert resp.status_code == 400

    def test_zero_limit_rejected(self, client):
        """Zero limit → 400 (must be positive)."""
        resp = client.get("/rank?limit=0")
        assert resp.status_code == 400


# ===========================================================================
# 4. STALE PREDICTION TRACKING
# ===========================================================================

class TestStalePredictionTracking:
    """
    Verify that the ranking endpoint reports stale predictions.

    Stale predictions are those made by an older model version.
    The ranking endpoint should REPORT them (for transparency)
    but NOT auto-recompute (that's /recompute's job).
    """

    def test_stale_predictions_field_present(self, client, earth_like_payload):
        """Response must include stale_predictions count."""
        client.post("/predict_and_store_batch", json=[earth_like_payload])
        resp = client.get("/rank")
        data = resp.get_json()["data"]
        assert "stale_predictions" in data
        assert isinstance(data["stale_predictions"], int)

    def test_fresh_predictions_not_stale(self, client, earth_like_payload):
        """Predictions made with current model should not be stale."""
        client.post("/predict_and_store_batch", json=[earth_like_payload])
        resp = client.get("/rank")
        data = resp.get_json()["data"]
        assert data["stale_predictions"] == 0
