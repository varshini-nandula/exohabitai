"""
ExoHabitAI — Batch Prediction Test Suite
==========================================
Validates POST /predict_and_store_batch for correctness, storage, and error handling.

WHY THESE TESTS MATTER:
    The batch endpoint is critical for data ingestion — it validates,
    predicts, and stores multiple planets in a single DB transaction.
    Bugs here could lead to partial commits, data corruption, or
    silent prediction failures that pollute the database.

WHAT FAILURES WOULD INDICATE:
    - Transaction failures → partial data in DB after errors
    - Schema failures → batch results don't match single results
    - Validation failures → invalid records bypass checks and get stored
    - Duplicate handling failures → constraint violations crash the endpoint
"""

import pytest
from tests.conftest import register_user, login_user


# ===========================================================================
# 1. SUCCESSFUL BATCH OPERATIONS
# ===========================================================================

class TestBatchSuccess:
    """Happy-path batch prediction and storage tests."""

    def test_batch_predict_and_store(self, client, earth_like_payload, gas_giant_payload):
        """
        Two valid planets → both predicted AND stored.
        Verifies the combined predict+store workflow.
        """
        batch = [earth_like_payload, gas_giant_payload]
        resp = client.post("/predict_and_store_batch", json=batch)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["status"] == "success"
        results = data["data"]
        assert len(results) == 2

        for r in results:
            assert "habitability_probability" in r
            assert "habitability" in r
            assert "stored" in r
            assert "threshold_used" in r
            assert 0.0 <= r["habitability_probability"] <= 1.0
            assert r["habitability"] in (0, 1)

    def test_batch_results_have_planet_names(self, client, earth_like_payload,
                                              gas_giant_payload):
        """Each batch result must identify the planet by name."""
        batch = [earth_like_payload, gas_giant_payload]
        resp = client.post("/predict_and_store_batch", json=batch)
        results = resp.get_json()["data"]
        names = {r["planet_name"] for r in results}
        assert "Earth-Twin-Test" in names
        assert "HotJupiter-Test" in names

    def test_single_item_batch(self, client, earth_like_payload):
        """Single-item array should work (edge case for batch logic)."""
        resp = client.post("/predict_and_store_batch", json=[earth_like_payload])
        assert resp.status_code == 200
        results = resp.get_json()["data"]
        assert len(results) == 1


# ===========================================================================
# 2. STORAGE VERIFICATION — data actually persists
# ===========================================================================

class TestBatchStorage:
    """Verify that batch predictions are actually written to the database."""

    def test_stored_planets_appear_in_stats(self, client, earth_like_payload):
        """After batch storage, /stats should reflect the new records."""
        # Get baseline
        pre_stats = client.get("/stats").get_json()["data"]
        pre_total = pre_stats["total_planets"]

        # Store one planet
        client.post("/predict_and_store_batch", json=[earth_like_payload])

        # Check updated stats
        post_stats = client.get("/stats").get_json()["data"]
        assert post_stats["total_planets"] == pre_total + 1

    def test_stored_planets_appear_in_rank(self, client, earth_like_payload):
        """After batch storage, the planet should appear in rankings."""
        client.post("/predict_and_store_batch", json=[earth_like_payload])
        resp = client.get("/rank")
        planets = resp.get_json()["data"]["planets"]
        names = [p["planet_name"] for p in planets]
        assert "Earth-Twin-Test" in names

    def test_duplicate_planet_not_re_stored(self, client, earth_like_payload):
        """Storing the same planet twice → second attempt marked as not stored."""
        client.post("/predict_and_store_batch", json=[earth_like_payload])
        resp = client.post("/predict_and_store_batch", json=[earth_like_payload])
        results = resp.get_json()["data"]
        assert results[0]["stored"] is False
        assert "already exists" in results[0]["storage_message"]


# ===========================================================================
# 3. RESPONSE CORRECTNESS — batch output matches expected schema
# ===========================================================================

class TestBatchResponseSchema:
    """Verify batch response schema matches the API contract."""

    def test_response_is_array(self, client, earth_like_payload):
        """Batch endpoint always returns an array of results."""
        resp = client.post("/predict_and_store_batch", json=[earth_like_payload])
        results = resp.get_json()["data"]
        assert isinstance(results, list)

    def test_each_result_has_storage_info(self, client, earth_like_payload):
        """Each batch result includes stored and storage_message."""
        resp = client.post("/predict_and_store_batch", json=[earth_like_payload])
        result = resp.get_json()["data"][0]
        assert "stored" in result
        assert "storage_message" in result


# ===========================================================================
# 4. INVALID BATCH PAYLOADS
# ===========================================================================

class TestBatchValidation:
    """
    Validate error handling for malformed batch inputs.

    WHY: The batch endpoint must fail gracefully. Invalid items
    should not corrupt valid items in the same batch.
    """

    def test_empty_array(self, client):
        """Empty array → 400."""
        resp = client.post("/predict_and_store_batch", json=[])
        assert resp.status_code == 400

    def test_non_array_payload(self, client, earth_like_payload):
        """Single object (not array) → 400. Batch requires array."""
        resp = client.post("/predict_and_store_batch", json=earth_like_payload)
        assert resp.status_code == 400

    def test_no_json_body(self, client):
        """No JSON body → 400."""
        resp = client.post("/predict_and_store_batch",
                           data="not json", content_type="application/json")
        assert resp.status_code == 400

    def test_batch_with_invalid_item(self, client, earth_like_payload):
        """
        One invalid item in a batch → whole batch rejected.

        WHY: The batch endpoint validates ALL items before predicting.
        This prevents partial processing that would be hard to debug.
        """
        invalid = {"planet_name": "bad", "P_MASS": -5.0}
        batch = [earth_like_payload, invalid]
        resp = client.post("/predict_and_store_batch", json=batch)
        assert resp.status_code == 400

    def test_batch_with_empty_item(self, client, earth_like_payload):
        """Empty object in batch → validation fails."""
        batch = [earth_like_payload, {}]
        resp = client.post("/predict_and_store_batch", json=batch)
        assert resp.status_code == 400


# ===========================================================================
# 5. CONSISTENCY — batch vs single prediction
# ===========================================================================

class TestBatchConsistency:
    """
    Batch predictions must produce identical results to single predictions.

    ML reasoning: If batch mode uses different preprocessing or a different
    prediction path, results will diverge — a form of train/serve skew.
    """

    def test_batch_matches_single_prediction(self, client, earth_like_payload):
        """
        Prediction from /predict must match /predict_and_store_batch.

        This catches any code-path divergence between the two endpoints.
        """
        # Single prediction
        single_resp = client.post("/predict", json=earth_like_payload)
        single_prob = single_resp.get_json()["data"]["habitability_probability"]

        # Batch prediction (different planet name to avoid DB duplicate)
        batch_payload = earth_like_payload.copy()
        batch_payload["planet_name"] = "Earth-Twin-Batch"
        batch_resp = client.post("/predict_and_store_batch", json=[batch_payload])
        batch_prob = batch_resp.get_json()["data"][0]["habitability_probability"]

        # Results should be identical (same input → same output)
        assert abs(single_prob - batch_prob) < 1e-6, (
            f"Single={single_prob}, Batch={batch_prob} — predictions diverged!"
        )
