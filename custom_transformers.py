"""
Custom sklearn-compatible transformers for the ExoHabitAI pipeline.

This module MUST be importable at deserialization time (when joblib.load()
reconstructs the pipeline).  Place it in a location on sys.path — the
project root works for both the training notebook and the Flask backend.
"""

import numpy as np
from sklearn.base import BaseEstimator, TransformerMixin


class QuantileClipper(BaseEstimator, TransformerMixin):
    """
    Clip numerical features to [lower_q, upper_q] quantile bounds.

    During ``fit``, the clipper computes the quantile bounds from the
    training data.  Features with <= 2 unique non-NaN values (binary
    flags) are automatically *skipped* — their bounds are stored as
    ``None``.

    During ``transform``, each column is clipped to its stored bounds.
    Columns that were skipped during fit are passed through unchanged.

    Parameters
    ----------
    lower_q : float, default=0.05
        Lower quantile (0–1).  Values below this percentile are clipped.
    upper_q : float, default=0.95
        Upper quantile (0–1).  Values above this percentile are clipped.

    Attributes
    ----------
    clip_bounds_ : list[tuple[float, float] | None]
        Per-column clipping bounds learned during ``fit``.
        ``None`` entries indicate columns that were skipped.
    n_features_in_ : int
        Number of features seen during ``fit``.
    """

    def __init__(self, lower_q=0.05, upper_q=0.95):
        self.lower_q = lower_q
        self.upper_q = upper_q

    def fit(self, X, y=None):
        X = np.asarray(X, dtype=float)
        self.n_features_in_ = X.shape[1]
        self.clip_bounds_ = []

        for col_idx in range(X.shape[1]):
            col = X[:, col_idx]
            # Count unique non-NaN values
            unique_vals = np.unique(col[~np.isnan(col)])
            if len(unique_vals) <= 2:
                # Skip binary / near-constant columns
                self.clip_bounds_.append(None)
            else:
                lower = float(np.nanpercentile(col, self.lower_q * 100))
                upper = float(np.nanpercentile(col, self.upper_q * 100))
                self.clip_bounds_.append((lower, upper))

        return self

    def transform(self, X):
        X = np.array(X, dtype=float).copy()
        for col_idx, bounds in enumerate(self.clip_bounds_):
            if bounds is not None:
                lower, upper = bounds
                X[:, col_idx] = np.clip(X[:, col_idx], lower, upper)
        return X

    def get_feature_names_out(self, input_features=None):
        """Pass-through: column count doesn't change."""
        if input_features is not None:
            return np.asarray(input_features)
        return np.arange(self.n_features_in_).astype(str)
