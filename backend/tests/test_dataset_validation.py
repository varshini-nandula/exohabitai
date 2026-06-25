"""
ExoHabitAI — Dataset Validation Engine Test Suite
==================================================
Validates that our dataset validation engine properly reports schema
conformity, missing columns, invalid target labels, out-of-range values,
and categorical value violations.
"""

import os
import tempfile
import pytest
import pandas as pd
from admin.validators import validate_dataset, TARGET_COLUMN


@pytest.fixture
def temp_csv_path():
    """Create a temporary CSV file path."""
    fd, path = tempfile.mkstemp(suffix=".csv")
    os.close(fd)
    yield path
    if os.path.exists(path):
        os.remove(path)


def test_validation_valid_dataset(temp_csv_path):
    """A perfectly valid CSV should be marked as valid with no errors."""
    data = {
        TARGET_COLUMN: [0, 1, 0, 1],
        "P_RADIUS": [1.0, 2.5, 0.8, 12.0],
        "P_MASS": [1.0, 5.0, 0.4, 300.0],
        "P_TYPE": ["Terran", "Superterran", "Subterran", "Jovian"],
        "S_TYPE_TEMP": ["G", "F", "K", "M"]
    }
    df = pd.DataFrame(data)
    df.to_csv(temp_csv_path, index=False)

    expected = ["P_RADIUS", "P_MASS", "P_TYPE", "S_TYPE_TEMP"]
    result = validate_dataset(temp_csv_path, expected_columns=expected)

    assert result["valid"] is True
    assert result["row_count"] == 4
    assert result["column_count"] == 5
    assert len(result["errors"]) == 0
    assert result["schema"]["has_target_column"] is True
    assert len(result["schema"]["missing_features"]) == 0


def test_validation_missing_target_column(temp_csv_path):
    """Missing target column P_HABITABLE_BINARY must fail validation."""
    data = {
        "P_RADIUS": [1.0, 2.0],
        "P_MASS": [1.0, 8.0]
    }
    df = pd.DataFrame(data)
    df.to_csv(temp_csv_path, index=False)

    result = validate_dataset(temp_csv_path, expected_columns=["P_RADIUS", "P_MASS"])

    assert result["valid"] is False
    assert any("Missing required target column" in err for err in result["errors"])
    assert result["schema"]["has_target_column"] is False


def test_validation_empty_dataset(temp_csv_path):
    """An empty CSV must fail validation."""
    df = pd.DataFrame()
    df.to_csv(temp_csv_path, index=False)

    result = validate_dataset(temp_csv_path)

    assert result["valid"] is False
    assert any("Dataset is empty" in err or "Failed to read CSV" in err for err in result["errors"])


def test_validation_missing_features_warning(temp_csv_path):
    """Missing feature columns should result in warnings, not errors (liberal feature imputation)."""
    data = {
        TARGET_COLUMN: [0, 1],
        "P_RADIUS": [1.0, 2.0]
    }
    df = pd.DataFrame(data)
    df.to_csv(temp_csv_path, index=False)

    expected = ["P_RADIUS", "P_MASS", "P_PERIOD"]
    result = validate_dataset(temp_csv_path, expected_columns=expected)

    assert result["valid"] is True  # Should still be valid
    assert len(result["warnings"]) > 0
    assert any("expected feature(s) missing" in warn for warn in result["warnings"])
    assert "P_MASS" in result["schema"]["missing_features"]
    assert "P_PERIOD" in result["schema"]["missing_features"]


def test_validation_invalid_labels(temp_csv_path):
    """Target labels other than 0 and 1 must fail validation."""
    data = {
        TARGET_COLUMN: [0, 2, 1, -1],  # 2 and -1 are invalid labels
        "P_RADIUS": [1.0, 2.0, 1.5, 3.0]
    }
    df = pd.DataFrame(data)
    df.to_csv(temp_csv_path, index=False)

    result = validate_dataset(temp_csv_path)

    assert result["valid"] is False
    assert result["quality"]["invalid_labels"] == 2
    assert any("invalid labels" in err for err in result["errors"])


def test_validation_out_of_range_values(temp_csv_path):
    """Out-of-range physical parameters should trigger warnings."""
    data = {
        TARGET_COLUMN: [0, 1],
        "P_RADIUS": [-0.5, 1.0],         # Radius must be > 0
        "P_ECCENTRICITY": [1.5, 0.05]    # Eccentricity must be between 0 and 1
    }
    df = pd.DataFrame(data)
    df.to_csv(temp_csv_path, index=False)

    result = validate_dataset(temp_csv_path)

    assert result["valid"] is True  # Warnings only, not validation failure
    assert len(result["warnings"]) >= 2
    assert "P_RADIUS" in result["quality"]["out_of_range"]
    assert "P_ECCENTRICITY" in result["quality"]["out_of_range"]


def test_validation_invalid_categories(temp_csv_path):
    """Invalid categorical classes should trigger warnings."""
    data = {
        TARGET_COLUMN: [0, 1],
        "P_TYPE": ["UnknownType", "Terran"],   # UnknownType is invalid
        "S_TYPE_TEMP": ["X", "G"]             # X is invalid
    }
    df = pd.DataFrame(data)
    df.to_csv(temp_csv_path, index=False)

    result = validate_dataset(temp_csv_path)

    assert result["valid"] is True  # Warnings only
    assert len(result["warnings"]) >= 2
    assert "UnknownType" in result["quality"]["invalid_categories"]["P_TYPE"]
    assert "X" in result["quality"]["invalid_categories"]["S_TYPE_TEMP"]


def test_validation_duplicate_rows(temp_csv_path):
    """Duplicate rows should result in warnings."""
    data = {
        TARGET_COLUMN: [0, 0, 1],
        "P_RADIUS": [1.0, 1.0, 2.0]
    }
    df = pd.DataFrame(data)
    df.to_csv(temp_csv_path, index=False)

    result = validate_dataset(temp_csv_path)

    assert result["valid"] is True
    assert result["quality"]["duplicate_rows"] == 1
    assert any("duplicate row(s)" in warn for warn in result["warnings"])
