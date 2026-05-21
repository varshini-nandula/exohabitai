"""
ExoHabitAI — Input Validation Test Suite
==========================================
Validates that the input validation layer correctly rejects invalid data
and accepts valid data across all validation dimensions.

WHY THESE TESTS MATTER:
    The validation layer is the gatekeeper between user input and the ML
    pipeline. Without robust validation:
    - Physically impossible values could reach the model (garbage in → garbage out)
    - Invalid categories could crash the one-hot encoder
    - Non-numeric data could cause runtime errors in the pipeline

WHAT FAILURES WOULD INDICATE:
    - Physical constraint failures → safety checks bypassed
    - Category validation failures → OHE crash risk in production
    - Type checking failures → pipeline will crash on unexpected input types
"""

import pytest


# ===========================================================================
# 1. PHYSICAL CONSTRAINT VALIDATION — hard rejections
# ===========================================================================

class TestPhysicalConstraints:
    """
    Physical constraints enforce that values are possible in the real universe.

    These are HARD rejections — values violating physics should never
    reach the ML pipeline because they are meaningless.
    """

    def test_negative_radius_rejected(self, client):
        """Planet radius must be > 0."""
        resp = client.post("/predict", json={
            "planet_name": "neg-r",
            "P_RADIUS": -1.0,
        })
        assert resp.status_code == 400

    def test_zero_radius_rejected(self, client):
        """Zero radius is not physical."""
        resp = client.post("/predict", json={
            "planet_name": "zero-r",
            "P_RADIUS": 0,
        })
        assert resp.status_code == 400

    def test_negative_mass_rejected(self, client):
        """Negative mass is impossible."""
        resp = client.post("/predict", json={
            "planet_name": "neg-m",
            "P_RADIUS": 1.0,
            "P_MASS": -10,
        })
        assert resp.status_code == 400

    def test_negative_temperature_rejected(self, client):
        """Negative Kelvin temperature is impossible."""
        resp = client.post("/predict", json={
            "planet_name": "neg-t",
            "P_RADIUS": 1.0,
            "P_TEMP_SURF": -100,
        })
        assert resp.status_code == 400

    def test_eccentricity_above_one_rejected(self, client):
        """Orbital eccentricity > 1 means unbound orbit (hyperbolic)."""
        resp = client.post("/predict", json={
            "planet_name": "hyp-ecc",
            "P_RADIUS": 1.0,
            "P_ECCENTRICITY": 1.5,
        })
        assert resp.status_code == 400

    def test_inclination_above_180_rejected(self, client):
        """Orbital inclination is bounded [0, 180]."""
        resp = client.post("/predict", json={
            "planet_name": "over-inc",
            "P_RADIUS": 1.0,
            "P_INCLINATION": 200,
        })
        assert resp.status_code == 400

    def test_zero_stellar_mass_rejected(self, client):
        """A star with zero mass cannot exist."""
        resp = client.post("/predict", json={
            "planet_name": "no-star",
            "P_RADIUS": 1.0,
            "S_MASS": 0,
        })
        assert resp.status_code == 400

    def test_negative_gravity_rejected(self, client):
        """Negative gravity is not physical."""
        resp = client.post("/predict", json={
            "planet_name": "neg-g",
            "P_RADIUS": 1.0,
            "P_GRAVITY": -5.0,
        })
        assert resp.status_code == 400

    def test_valid_eccentricity_accepted(self, client):
        """Eccentricity in (0, 1] should be accepted."""
        resp = client.post("/predict", json={
            "planet_name": "good-ecc",
            "P_RADIUS": 1.0,
            "P_ECCENTRICITY": 0.5,
        })
        assert resp.status_code == 200


# ===========================================================================
# 2. CATEGORICAL VALIDATION — valid categories only
# ===========================================================================

class TestCategoricalValidation:
    """
    Categorical values must match the training vocabulary.

    WHY: The OneHotEncoder in the pipeline was fitted on specific categories.
    handle_unknown="ignore" prevents crashes, but validation should catch
    typos before they silently get ignored.
    """

    def test_invalid_p_type_rejected(self, client):
        """Unknown planet type → 400."""
        resp = client.post("/predict", json={
            "planet_name": "bad-type",
            "P_RADIUS": 1.0,
            "P_TYPE": "GasGiant",  # Not in valid list
        })
        assert resp.status_code == 400
        assert "Invalid category" in resp.get_json()["message"]

    def test_all_valid_p_types_accepted(self, client):
        """Each valid P_TYPE → 200."""
        valid_types = ["Jovian", "Miniterran", "Neptunian",
                        "Subterran", "Superterran", "Terran"]
        for pt in valid_types:
            resp = client.post("/predict", json={
                "planet_name": f"type-{pt}",
                "P_RADIUS": 1.0,
                "P_TYPE": pt,
            })
            assert resp.status_code == 200, f"P_TYPE='{pt}' was rejected"

    def test_invalid_s_type_temp_rejected(self, client):
        """Unknown star spectral type → 400."""
        resp = client.post("/predict", json={
            "planet_name": "bad-star",
            "P_RADIUS": 1.0,
            "S_TYPE_TEMP": "Z",
        })
        assert resp.status_code == 400

    def test_all_valid_s_type_temps(self, client):
        """Each valid S_TYPE_TEMP → 200."""
        valid_types = ["A", "B", "BD", "F", "G", "K", "M", "O", "PSR", "WD"]
        for st in valid_types:
            resp = client.post("/predict", json={
                "planet_name": f"star-{st}",
                "P_RADIUS": 1.0,
                "S_TYPE_TEMP": st,
            })
            assert resp.status_code == 200, f"S_TYPE_TEMP='{st}' was rejected"

    def test_case_sensitive_categories(self, client):
        """Categories are case-sensitive — 'jovian' ≠ 'Jovian'."""
        resp = client.post("/predict", json={
            "planet_name": "case-test",
            "P_RADIUS": 1.0,
            "P_TYPE": "jovian",  # lowercase — should fail
        })
        assert resp.status_code == 400


# ===========================================================================
# 3. TYPE CHECKING — non-numeric values for numeric fields
# ===========================================================================

class TestTypeValidation:
    """
    Numeric fields must receive numeric values (int/float/None).

    If a string is sent for a numeric field, it should be rejected
    rather than silently causing pipeline errors.
    """

    def test_string_in_numeric_field(self, client):
        """String value in numeric field → 400."""
        resp = client.post("/predict", json={
            "planet_name": "type-err",
            "P_RADIUS": "not_a_number",
        })
        assert resp.status_code == 400

    def test_list_in_numeric_field(self, client):
        """List value in numeric field → 400."""
        resp = client.post("/predict", json={
            "planet_name": "list-err",
            "P_RADIUS": [1.0, 2.0],
        })
        assert resp.status_code == 400

    def test_boolean_in_numeric_field(self, client):
        """
        Boolean is technically int in Python, but semantically wrong.
        The validator should handle this gracefully.
        """
        resp = client.post("/predict", json={
            "planet_name": "bool-test",
            "P_RADIUS": True,  # int(True) == 1
        })
        # Booleans are subclass of int in Python, so this may be accepted
        # The key thing is it doesn't crash
        assert resp.status_code in (200, 400)


# ===========================================================================
# 4. NONE/NULL HANDLING — None values should be accepted (pipeline imputes)
# ===========================================================================

class TestNullHandling:
    """
    None/null values are valid — the pipeline's imputer handles them.

    This is a critical design decision: missing data should NOT be
    rejected. Instead, it flows to the pipeline where SimpleImputer
    fills it with median (numeric) or most-frequent (categorical).
    """

    def test_none_values_accepted(self, client):
        """Features set to None should not cause errors."""
        resp = client.post("/predict", json={
            "planet_name": "null-test",
            "P_RADIUS": None,
            "P_MASS": None,
            "S_TEMPERATURE": None,
        })
        assert resp.status_code == 200

    def test_mixed_none_and_values(self, client):
        """Mix of None and valid values → should work."""
        resp = client.post("/predict", json={
            "planet_name": "mixed-null",
            "P_RADIUS": 1.0,
            "P_MASS": None,
            "S_TEMPERATURE": 5000,
            "S_LUMINOSITY": None,
        })
        assert resp.status_code == 200


# ===========================================================================
# 5. EDGE CASES
# ===========================================================================

class TestEdgeCases:
    """Boundary and edge-case inputs."""

    def test_very_large_numeric_value(self, client):
        """Very large but valid number → should not crash."""
        resp = client.post("/predict", json={
            "planet_name": "big-radius",
            "P_RADIUS": 50,  # Within realistic range (0, 100)
        })
        assert resp.status_code == 200

    def test_extra_unknown_numeric_fields_ignored(self, client):
        """Unknown numeric feature fields should be silently ignored."""
        resp = client.post("/predict", json={
            "planet_name": "extra-fields",
            "P_RADIUS": 1.0,
            "UNKNOWN_FEATURE": 42,
            "ANOTHER_NUMERIC": 99.9,
        })
        assert resp.status_code == 200

    def test_string_for_unknown_field_rejected(self, client):
        """String values for non-categorical fields should be rejected."""
        resp = client.post("/predict", json={
            "planet_name": "str-unknown",
            "P_RADIUS": 1.0,
            "UNKNOWN_FIELD": "text_value",
        })
        assert resp.status_code == 400

    def test_only_planet_name_rejected(self, client):
        """Only metadata (planet_name) with no features → 400."""
        resp = client.post("/predict", json={
            "planet_name": "only-name",
        })
        assert resp.status_code == 400
