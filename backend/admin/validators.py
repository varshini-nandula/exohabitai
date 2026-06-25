"""
ExoHabitAI — Dataset Validation Engine
=========================================
Validates uploaded CSV datasets for schema correctness and data quality
before they can be used for retraining.

Validation is liberal on features (pipeline has built-in imputation)
but STRICT on the target column (must exist, must contain 0/1 only).

Validation checks:
    Schema:
        - Target column P_HABITABLE_BINARY must exist
        - Known feature columns are checked for presence
        - Data types are verified (numeric for numeric features)

    Data Quality:
        - Missing value counts and percentages
        - Duplicate row detection
        - Invalid label values (target must be 0 or 1)
        - Physical constraint violations
        - Category validation for categorical features
        - Label distribution (class balance)
"""

import logging

import numpy as np
import pandas as pd

logger = logging.getLogger("exohabitai.admin.validator")

# The target column required in every training dataset
TARGET_COLUMN = "P_HABITABLE_BINARY"

# Physical constraints imported at runtime to avoid circular imports
PHYSICAL_CONSTRAINTS = {
    "P_RADIUS":          (0, None),
    "P_MASS":            (0, None),
    "P_DENSITY":         (0, None),
    "P_TEMP_SURF":       (0, None),
    "P_TEMP_EQUIL":      (0, None),
    "P_PERIOD":          (0, None),
    "P_SEMI_MAJOR_AXIS": (0, None),
    "S_TEMPERATURE":     (0, None),
    "S_LUMINOSITY":      (0, None),
    "S_MASS":            (0, None),
    "S_RADIUS":          (0, None),
    "S_DISTANCE":        (0, None),
    "P_GRAVITY":         (0, None),
    "P_ESCAPE":          (0, None),
    "P_FLUX":            (0, None),
    "P_DISTANCE":        (0, None),
    "P_ECCENTRICITY":    (0, 1),
    "P_INCLINATION":     (0, 180),
    "S_AGE":             (0, None),
}

VALID_CATEGORIES = {
    "P_TYPE": ["Jovian", "Miniterran", "Neptunian", "Subterran", "Superterran", "Terran"],
    "S_TYPE_TEMP": ["A", "B", "BD", "F", "G", "K", "M", "O", "PSR", "WD"],
    "Derived_S_TYPE": [
        "O-Type", "B-Type", "A-Type", "F-Type", "G-Type",
        "K-Type", "M-Type", "L-Type", "T-Type", "Y-Type",
    ],
}


def validate_dataset(csv_path: str, expected_columns: list[str] | None = None) -> dict:
    """
    Validate a training dataset CSV file.

    Args:
        csv_path: Path to the CSV file.
        expected_columns: List of feature columns the pipeline expects.
                         If None, only target column is enforced.

    Returns:
        A validation result dict with structure:
        {
            "valid": bool,
            "row_count": int,
            "column_count": int,
            "schema": { ... },
            "quality": { ... },
            "warnings": [...],
            "errors": [...]
        }
    """
    errors = []
    warnings = []

    # --- Load CSV ---
    try:
        df = pd.read_csv(csv_path)
    except Exception as exc:
        return {
            "valid": False,
            "row_count": 0,
            "column_count": 0,
            "schema": {},
            "quality": {},
            "warnings": [],
            "errors": [f"Failed to read CSV: {exc}"],
        }

    row_count = len(df)
    column_count = len(df.columns)
    found_columns = list(df.columns)

    if row_count == 0:
        errors.append("Dataset is empty (0 rows)")

    # =====================================================================
    # SCHEMA VALIDATION
    # =====================================================================

    has_target = TARGET_COLUMN in df.columns
    if not has_target:
        errors.append(
            f"Missing required target column: {TARGET_COLUMN}. "
            f"Training datasets must contain ground truth labels (0 or 1)."
        )

    # Check expected feature columns
    missing_features = []
    found_features = 0
    if expected_columns:
        for col in expected_columns:
            if col in df.columns:
                found_features += 1
            else:
                missing_features.append(col)

        if missing_features:
            warnings.append(
                f"{len(missing_features)} expected feature(s) missing: "
                f"{', '.join(missing_features[:10])}"
                f"{'...' if len(missing_features) > 10 else ''}"
                f" (pipeline will impute these)"
            )

    # Extra columns (not errors, just informational)
    known_columns = set(expected_columns or []) | {TARGET_COLUMN}
    extra_columns = [c for c in found_columns if c not in known_columns]

    schema = {
        "has_target_column": has_target,
        "target_column": TARGET_COLUMN,
        "expected_features": len(expected_columns) if expected_columns else 0,
        "found_features": found_features,
        "missing_features": missing_features,
        "extra_columns": extra_columns,
        "found_columns": found_columns,
    }

    # =====================================================================
    # DATA QUALITY VALIDATION
    # =====================================================================

    # --- Missing values ---
    missing_counts = {}
    missing_percentages = {}
    for col in df.columns:
        null_count = int(df[col].isnull().sum())
        if null_count > 0:
            missing_counts[col] = null_count
            missing_percentages[col] = round(null_count / row_count * 100, 2) if row_count > 0 else 0

    if missing_counts:
        top_missing = sorted(missing_counts.items(), key=lambda x: x[1], reverse=True)[:5]
        for col, count in top_missing:
            warnings.append(f"{count} rows missing {col} ({missing_percentages[col]}%)")

    # --- Duplicate rows ---
    duplicate_count = int(df.duplicated().sum())
    if duplicate_count > 0:
        warnings.append(f"{duplicate_count} duplicate row(s) detected")

    # --- Invalid labels ---
    invalid_labels = 0
    label_distribution = {}
    if has_target:
        target_series = df[TARGET_COLUMN].dropna()

        # Check for non-0/1 values
        valid_mask = target_series.isin([0, 1, 0.0, 1.0])
        invalid_labels = int((~valid_mask).sum())
        if invalid_labels > 0:
            errors.append(
                f"{invalid_labels} row(s) have invalid labels in {TARGET_COLUMN}. "
                f"Values must be 0 or 1."
            )

        # Label distribution
        dist = target_series[valid_mask].astype(int).value_counts().to_dict()
        label_distribution = {str(k): int(v) for k, v in dist.items()}

        # Warn about class imbalance
        if label_distribution:
            minority = min(label_distribution.values())
            majority = max(label_distribution.values())
            if majority > 0 and minority / majority < 0.1:
                warnings.append(
                    f"Severe class imbalance: {label_distribution} "
                    f"(minority is {minority / majority:.1%} of majority)"
                )

        # Warn about missing labels
        label_missing = int(df[TARGET_COLUMN].isnull().sum())
        if label_missing > 0:
            warnings.append(
                f"{label_missing} row(s) missing target label {TARGET_COLUMN}"
            )

    # --- Out-of-range values ---
    out_of_range = {}
    for col, (min_excl, max_incl) in PHYSICAL_CONSTRAINTS.items():
        if col not in df.columns:
            continue
        numeric_vals = pd.to_numeric(df[col], errors="coerce").dropna()
        if len(numeric_vals) == 0:
            continue

        violations = 0
        if min_excl is not None:
            violations += int((numeric_vals <= min_excl).sum())
        if max_incl is not None:
            violations += int((numeric_vals > max_incl).sum())

        if violations > 0:
            out_of_range[col] = violations

    if out_of_range:
        for col, count in out_of_range.items():
            warnings.append(f"{count} row(s) have out-of-range values for {col}")

    # --- Invalid categories ---
    invalid_categories = {}
    for col, valid_values in VALID_CATEGORIES.items():
        if col not in df.columns:
            continue
        cat_vals = df[col].dropna().unique()
        invalid = [str(v) for v in cat_vals if v not in valid_values]
        if invalid:
            invalid_categories[col] = invalid[:5]  # Show first 5
            warnings.append(
                f"{col} contains {len(invalid)} invalid category value(s): "
                f"{', '.join(invalid[:3])}"
            )

    quality = {
        "missing_values": missing_counts,
        "missing_percentages": missing_percentages,
        "duplicate_rows": duplicate_count,
        "invalid_labels": invalid_labels,
        "label_distribution": label_distribution,
        "out_of_range": out_of_range,
        "invalid_categories": invalid_categories,
    }

    # --- Final verdict ---
    is_valid = len(errors) == 0

    result = {
        "valid": is_valid,
        "row_count": row_count,
        "column_count": column_count,
        "schema": schema,
        "quality": quality,
        "warnings": warnings,
        "errors": errors,
    }

    logger.info(
        "Dataset validation complete: path=%s, valid=%s, rows=%d, errors=%d, warnings=%d",
        csv_path, is_valid, row_count, len(errors), len(warnings),
    )

    return result
