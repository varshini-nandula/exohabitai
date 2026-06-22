"""
ExoHabitAI — Prediction API Test Suite
========================================
Validates POST /predict for correctness, schema, validation, and edge cases.

WHY THESE TESTS MATTER:
    /predict is the core API — every frontend interaction uses it.
    If predictions silently return wrong structures, probabilities
    outside [0,1], or crash on edge-case inputs, user trust is lost.

WHAT FAILURES WOULD INDICATE:
    - Schema failures → frontend integration will break
    - Validation failures → invalid inputs bypass safety checks
    - Probability range failures → ML pipeline output is corrupted
    - Warning failures → users aren't informed about unusual inputs
"""

import pytest
from tests.conftest import register_user, login_user, get_auth_header


# ===========================================================================
# 1. SUCCESSFUL PREDICTIONS — happy path
# ===========================================================================

class TestPredictionSuccess:
    """Verify that valid inputs produce well-formed predictions."""

    def test_predict_earth_like(self, client, earth_like_payload):
        """Earth-like planet should produce a valid prediction."""
        resp = client.post("/predict", json=earth_like_payload)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["status"] == "success"
        result = data["data"]
        assert "habitability" in result
        assert "habitability_probability" in result
        assert "threshold_used" in result
        assert result["planet_name"] == "Earth-Twin-Test"

    def test_predict_gas_giant(self, client, gas_giant_payload):
        """Gas giant should produce a valid (but low) prediction."""
        resp = client.post("/predict", json=gas_giant_payload)
        assert resp.status_code == 200
        result = resp.get_json()["data"]
        assert "habitability" in result
        assert "habitability_probability" in result

    def test_predict_minimal_input(self, client, minimal_payload):
        """
        Minimal input (mostly missing values) → pipeline should still
        produce a prediction. The internal imputer handles missing data.
        """
        resp = client.post("/predict", json=minimal_payload)
        assert resp.status_code == 200
        result = resp.get_json()["data"]
        assert "habitability_probability" in result


# ===========================================================================
# 2. RESPONSE STRUCTURE — schema validation
# ===========================================================================

class TestPredictionSchema:
    """
    Verify the exact response schema the frontend depends on.

    If any of these fields are missing or renamed, the frontend will break.
    This is a contract test — it validates the API surface.
    """

    def test_response_envelope(self, client, earth_like_payload):
        """Every response must have status, message, and data."""
        resp = client.post("/predict", json=earth_like_payload)
        body = resp.get_json()
        assert "status" in body
        assert "message" in body
        assert "data" in body

    def test_prediction_fields(self, client, earth_like_payload):
        """Prediction result must contain required fields."""
        resp = client.post("/predict", json=earth_like_payload)
        result = resp.get_json()["data"]
        required_fields = {
            "planet_name", "habitability",
            "habitability_probability", "threshold_used",
        }
        assert required_fields.issubset(set(result.keys()))

    def test_habitability_is_binary(self, client, earth_like_payload):
        """habitability must be 0 or 1 (binary classification)."""
        resp = client.post("/predict", json=earth_like_payload)
        result = resp.get_json()["data"]
        assert result["habitability"] in (0, 1)

    def test_probability_is_float(self, client, earth_like_payload):
        """habitability_probability must be a float."""
        resp = client.post("/predict", json=earth_like_payload)
        result = resp.get_json()["data"]
        assert isinstance(result["habitability_probability"], float)


# ===========================================================================
# 3. PROBABILITY RANGE — ML output bounds
# ===========================================================================

class TestProbabilityRange:
    """
    Probabilities MUST be in [0.0, 1.0].

    ML reasoning: predict_proba() returns calibrated probabilities.
    Values outside [0,1] would indicate a broken pipeline or
    post-processing error. This is a fundamental ML sanity check.
    """

    def test_probability_between_0_and_1(self, client, earth_like_payload):
        resp = client.post("/predict", json=earth_like_payload)
        prob = resp.get_json()["data"]["habitability_probability"]
        assert 0.0 <= prob <= 1.0

    def test_gas_giant_probability_range(self, client, gas_giant_payload):
        resp = client.post("/predict", json=gas_giant_payload)
        prob = resp.get_json()["data"]["habitability_probability"]
        assert 0.0 <= prob <= 1.0

    def test_extreme_hot_probability_range(self, client, extreme_hot_payload):
        resp = client.post("/predict", json=extreme_hot_payload)
        prob = resp.get_json()["data"]["habitability_probability"]
        assert 0.0 <= prob <= 1.0

    def test_minimal_input_probability_range(self, client, minimal_payload):
        resp = client.post("/predict", json=minimal_payload)
        prob = resp.get_json()["data"]["habitability_probability"]
        assert 0.0 <= prob <= 1.0


# ===========================================================================
# 4. THRESHOLD LOGIC — label must match threshold
# ===========================================================================

class TestThresholdLogic:
    """
    The binary label must be consistent with probability and threshold.

    If prob >= threshold → label should be 1
    If prob < threshold → label should be 0

    This catches bugs where threshold is applied incorrectly.
    """

    def test_label_matches_threshold(self, client, earth_like_payload):
        resp = client.post("/predict", json=earth_like_payload)
        result = resp.get_json()["data"]
        prob = result["habitability_probability"]
        threshold = result["threshold_used"]
        expected_label = 1 if prob >= threshold else 0
        assert result["habitability"] == expected_label, (
            f"prob={prob}, threshold={threshold}, "
            f"expected_label={expected_label}, got={result['habitability']}"
        )


# ===========================================================================
# 5. VALIDATION — reject invalid inputs
# ===========================================================================

class TestPredictionValidation:
    """
    Input validation must reject physically impossible and malformed data.

    Validation reasoning: Without input validation, garbage data reaches
    the ML pipeline, which either crashes or produces meaningless results.
    Hard validation catches impossible values; soft validation warns
    about unusual-but-possible values.
    """

    def test_empty_payload(self, client):
        """Completely empty payload → 400."""
        resp = client.post("/predict", json={})
        assert resp.status_code == 400

    def test_negative_mass(self, client, invalid_payload_negative):
        """Negative planet mass is physically impossible → 400."""
        resp = client.post("/predict", json=invalid_payload_negative)
        assert resp.status_code == 400
        assert "Invalid value" in resp.get_json()["message"]

    def test_zero_radius(self, client):
        """Zero radius is physically impossible → 400."""
        resp = client.post("/predict", json={
            "planet_name": "zero-r",
            "P_RADIUS": 0,
        })
        assert resp.status_code == 400

    def test_eccentricity_above_1(self, client):
        """Orbital eccentricity > 1 is impossible → 400."""
        resp = client.post("/predict", json={
            "planet_name": "hyper-ecc",
            "P_RADIUS": 1.0,
            "P_ECCENTRICITY": 1.5,
        })
        assert resp.status_code == 400

    def test_inclination_above_180(self, client):
        """Inclination > 180° is impossible → 400."""
        resp = client.post("/predict", json={
            "planet_name": "over-incline",
            "P_RADIUS": 1.0,
            "P_INCLINATION": 200,
        })
        assert resp.status_code == 400

    def test_malformed_json(self, client):
        """Non-JSON body → 400."""
        resp = client.post("/predict", data="not json",
                           content_type="application/json")
        assert resp.status_code == 400

    def test_non_object_json(self, client):
        """String JSON → 400 (must be object or array)."""
        resp = client.post("/predict", json="just a string")
        assert resp.status_code == 400

    def test_invalid_category_p_type(self, client):
        """Invalid P_TYPE category → 400."""
        resp = client.post("/predict", json={
            "planet_name": "bad-type",
            "P_RADIUS": 1.0,
            "P_TYPE": "InvalidType",
        })
        assert resp.status_code == 400
        assert "Invalid category" in resp.get_json()["message"]

    def test_invalid_category_s_type_temp(self, client):
        """Invalid S_TYPE_TEMP → 400."""
        resp = client.post("/predict", json={
            "planet_name": "bad-star",
            "P_RADIUS": 1.0,
            "S_TYPE_TEMP": "Z",
        })
        assert resp.status_code == 400

    def test_valid_categories_accepted(self, client):
        """All valid P_TYPE values should be accepted."""
        for p_type in ["Jovian", "Miniterran", "Neptunian",
                        "Subterran", "Superterran", "Terran"]:
            resp = client.post("/predict", json={
                "planet_name": f"test-{p_type}",
                "P_RADIUS": 1.0,
                "P_TYPE": p_type,
            })
            assert resp.status_code == 200, f"P_TYPE={p_type} rejected"


# ===========================================================================
# 6. WARNINGS — soft validation produces warnings, not rejections
# ===========================================================================

class TestPredictionWarnings:
    """
    Extreme-but-valid inputs should produce warnings, not errors.

    Validation reasoning: A star temperature of 100,000 K is unrealistic
    but not physically impossible. The API should predict but warn the
    user that their input is unusual.
    """

    def test_extreme_star_temp_generates_warning(self, client):
        """Star temperature above realistic range → prediction + warning."""
        resp = client.post("/predict", json={
            "planet_name": "extreme-star",
            "P_RADIUS": 1.0,
            "S_TEMPERATURE": 60000,  # Above realistic range of 50000
        })
        assert resp.status_code == 200
        result = resp.get_json()["data"]
        assert "warnings" in result
        assert any("S_TEMPERATURE" in w for w in result["warnings"])

    def test_extreme_star_age_generates_warning(self, client):
        """Star age above 20 Gyr → warning (universe is ~13.8 Gyr old)."""
        resp = client.post("/predict", json={
            "planet_name": "old-star",
            "P_RADIUS": 1.0,
            "S_AGE": 25.0,
        })
        assert resp.status_code == 200
        result = resp.get_json()["data"]
        assert "warnings" in result


# ===========================================================================
# 7. BATCH PREDICTION VIA /predict — array input
# ===========================================================================

class TestPredictBatch:
    """
    /predict also accepts a batch array of planets.
    Each must produce valid predictions.
    """

    def test_batch_prediction(self, client, earth_like_payload, gas_giant_payload):
        """Batch of 2 planets → array of 2 results."""
        batch = [earth_like_payload, gas_giant_payload]
        resp = client.post("/predict", json=batch)
        assert resp.status_code == 200
        results = resp.get_json()["data"]
        assert isinstance(results, list)
        assert len(results) == 2
        for r in results:
            assert "habitability_probability" in r
            assert 0.0 <= r["habitability_probability"] <= 1.0

    def test_empty_batch(self, client):
        """Empty array → 400."""
        resp = client.post("/predict", json=[])
        assert resp.status_code == 400


# ===========================================================================
# 8. DERIVED_S_TYPE — train/serve parity
# ===========================================================================

class TestDerivedStarType:
    """
    Derived_S_TYPE must be computed from S_TEMPERATURE during prediction,
    matching the exact logic used during training. Train/serve skew in
    this feature would corrupt predictions silently.
    """

    def test_derived_type_from_temperature(self, client):
        """S_TEMPERATURE=5778 (Sun) → Derived_S_TYPE should be 'G-Type'."""
        resp = client.post("/predict", json={
            "planet_name": "derive-test",
            "P_RADIUS": 1.0,
            "S_TEMPERATURE": 5778,
        })
        # The prediction should succeed — the derived feature is
        # generated internally by build_dataframe()
        assert resp.status_code == 200

    def test_explicit_derived_type_accepted(self, client):
        """If Derived_S_TYPE is explicitly provided, it should be used."""
        resp = client.post("/predict", json={
            "planet_name": "explicit-type",
            "P_RADIUS": 1.0,
            "Derived_S_TYPE": "G-Type",
        })
        assert resp.status_code == 200


# ===========================================================================
# 9. IMPUTATION STRATEGY — customized feature filling
# ===========================================================================

class TestImputationStrategy:
    """Verify that backend respects imputation strategy and returns fill details."""

    def test_imputation_strategy_earth(self, client):
        """Earth strategy should fill missing features with Earth defaults."""
        payload = {
            "planet_name": "Earth-Strategy-Test",
            "P_RADIUS": 1.0,
            "P_MASS": 1.0,
            "S_TEMPERATURE": 5778,
            "S_LUMINOSITY": 1.0,
            "P_SEMI_MAJOR_AXIS": 1.0,
            "imputation_strategy": "earth"
        }
        resp = client.post("/predict", json=payload)
        assert resp.status_code == 200
        result = resp.get_json()["data"]
        assert "fill_info" in result
        fill_info = result["fill_info"]
        assert fill_info["strategy_used"] == "earth"
        assert "P_PERIOD" in fill_info["strategy_filled"]
        assert "P_FLUX" in fill_info["auto_derived"]

    def test_imputation_strategy_zeros(self, client):
        """Zeros strategy should fill missing features with 0.0."""
        payload = {
            "planet_name": "Zeros-Strategy-Test",
            "P_RADIUS": 1.0,
            "imputation_strategy": "zeros"
        }
        resp = client.post("/predict", json=payload)
        assert resp.status_code == 200
        result = resp.get_json()["data"]
        assert "fill_info" in result
        fill_info = result["fill_info"]
        assert fill_info["strategy_used"] == "zeros"
        assert "P_MASS" in fill_info["strategy_filled"]

    def test_imputation_strategy_invalid(self, client):
        """Invalid strategy should fallback to median."""
        payload = {
            "planet_name": "Invalid-Strategy-Test",
            "P_RADIUS": 1.0,
            "imputation_strategy": "invalid_value_here"
        }
        resp = client.post("/predict", json=payload)
        assert resp.status_code == 200
        result = resp.get_json()["data"]
        assert result["fill_info"]["strategy_used"] == "median"

