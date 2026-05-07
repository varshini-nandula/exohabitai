import os
import sys
import warnings
import pandas as pd
import joblib

from sklearn.impute import SimpleImputer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.feature_selection import VarianceThreshold
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.model_selection import (
    train_test_split, StratifiedKFold, cross_validate,
)
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, average_precision_score, confusion_matrix,
)
from imblearn.pipeline import Pipeline as ImbPipeline
from imblearn.over_sampling import SMOTE

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from custom_transformers import QuantileClipper  

warnings.filterwarnings("ignore")

# CONFIGURATION
DATA_PATH = os.path.join(PROJECT_ROOT, "planetsdata.csv")
ARTIFACT_DIR = os.path.join(PROJECT_ROOT, "backend", "artifacts")
PIPELINE_PATH = os.path.join(ARTIFACT_DIR, "habitability_pipeline.pkl")

TARGET = "P_HABITABLE_BINARY"
RANDOM_STATE = 42

# Columns to drop 

# Error / limit columns (not useful for prediction)
def _error_limit_cols(df):
    return [c for c in df.columns
            if "_ERROR_MIN" in c or "_ERROR_MAX" in c or "_LIMIT" in c]

# Identifiers & discovery metadata
UNNECESSARY_COLUMNS = [
    "S_NAME", "S_NAME_HD", "S_NAME_HIP",
    "P_DETECTION", "P_DISCOVERY_FACILITY",
    "P_YEAR", "P_UPDATE",
    "S_RA", "S_DEC", "S_RA_STR", "S_DEC_STR",
    "S_RA_TXT", "S_DEC_TXT",
    "S_CONSTELLATION", "S_CONSTELLATION_ABR", "S_CONSTELLATION_ENG",
    "P_OMEGA", "P_MASS_ORIGIN",
]

# Leakage features (directly measure or define the target)
LEAKAGE_COLUMNS = [
    "P_ESI",
    "P_HABZONE_OPT", "P_HABZONE_CON",
    "S_HZ_OPT_MIN", "S_HZ_OPT_MAX",
    "S_HZ_CON_MIN", "S_HZ_CON_MAX",
    "S_HZ_CON0_MIN", "S_HZ_CON0_MAX",
    "S_HZ_CON1_MIN", "S_HZ_CON1_MAX",
    "S_ABIO_ZONE", "S_SNOW_LINE", "S_TIDAL_LOCK",
    "P_DISTANCE_EFF",
    "P_TYPE_TEMP",
]

# Redundant MIN/MAX columns
REDUNDANT_COLUMNS = [
    "P_TEMP_EQUIL_MIN", "P_TEMP_EQUIL_MAX",
    "P_TEMP_SURF_MIN", "P_TEMP_SURF_MAX",
    "P_FLUX_MIN", "P_FLUX_MAX",
    "P_ECCENTRICITY_MIN",
    "P_INCLINATIONR_MIN",
]


# FEATURE ENGINEERING 
def derive_star_type(temp):
    """Derive detailed spectral type from S_TEMPERATURE."""
    if pd.isna(temp):
        return None
    if temp > 30000:
        return "O-Type"
    if temp > 10000:
        return "B-Type"
    if temp > 7500:
        return "A-Type"
    if temp > 6000:
        return "F-Type"
    if temp > 5000:
        return "G-Type"
    if temp > 3500:
        return "K-Type"
    if temp > 2500:
        return "M-Type"
    if temp > 1500:
        return "L-Type"
    if temp > 800:
        return "T-Type"
    if temp <= 800:
        return "Y-Type"
    return "Unclassified"


def prepare_dataframe(path: str) -> pd.DataFrame:
    """Load CSV, drop columns, create target, engineer features."""
    df = pd.read_csv(path)
    print(f"Raw data shape: {df.shape}")

    # Drop error / limit columns
    cols_to_drop = _error_limit_cols(df)
    df.drop(columns=cols_to_drop, inplace=True, errors="ignore")

    # Drop unnecessary metadata
    df.drop(columns=UNNECESSARY_COLUMNS, inplace=True, errors="ignore")

    # Drop leakage columns
    df.drop(columns=LEAKAGE_COLUMNS, inplace=True, errors="ignore")

    # Drop redundant MIN/MAX
    df.drop(columns=REDUNDANT_COLUMNS, inplace=True, errors="ignore")

    # Create binary target
    df[TARGET] = df["P_HABITABLE"].apply(lambda x: 1 if x in [1, 2] else 0)
    df.drop(columns=["P_HABITABLE"], inplace=True)

    # Derive star type from temperature
    df["Derived_S_TYPE"] = df["S_TEMPERATURE"].apply(derive_star_type)
    df.drop(columns=["S_TYPE"], inplace=True, errors="ignore")

    print(f"Cleaned data shape: {df.shape}")
    print(f"Class distribution:\n{df[TARGET].value_counts()}")
    return df


# BUILD THE UNIFIED PIPELINE
def build_unified_pipeline(numerical_cols, categorical_cols, use_smote=True):
    """
    Build a single ImbPipeline that encapsulates ALL preprocessing.

    Parameters:
    numerical_cols : list[str]
        Names of numerical feature columns.
    categorical_cols : list[str]
        Names of categorical feature columns.
    use_smote : bool
        Whether to include SMOTE for class balancing.

    Returns ImbPipeline
    """

    # Numerical branch
    num_pipeline = Pipeline(steps=[
        ("imputer",    SimpleImputer(strategy="median")),
        ("clipper",    QuantileClipper(lower_q=0.05, upper_q=0.95)),
        ("scaler",     StandardScaler()),
        ("var_thresh", VarianceThreshold(threshold=0.01)),
    ])

    # Categorical branch
    cat_pipeline = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("encoder", OneHotEncoder(sparse_output=False, handle_unknown="ignore")),
    ])

    # ColumnTransformer (replaces all manual preprocessing)
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", num_pipeline, numerical_cols),
            ("cat", cat_pipeline, categorical_cols),
        ],
        remainder="drop",  # drop any columns not listed
    )

    # SMOTE step
    smote_step = [
        ("smote", SMOTE(
            sampling_strategy=0.3, k_neighbors=5, random_state=RANDOM_STATE
        ))
    ] if use_smote else []

    # Full pipeline
    pipeline = ImbPipeline(steps=[
        ("preprocessor", preprocessor),
    ] + smote_step + [
        ("classifier", RandomForestClassifier(
            n_estimators=400, max_depth=8, min_samples_leaf=10,
            class_weight=None if use_smote else "balanced_subsample",
            random_state=RANDOM_STATE, n_jobs=-1,
        )),
    ])

    return pipeline


# EVALUATION
def evaluate(pipeline, X_train, X_test, y_train, y_test, label=""):
    """Train, predict, and print comprehensive metrics."""
    pipeline.fit(X_train, y_train)

    # Test metrics
    y_prob_test = pipeline.predict_proba(X_test)[:, 1]
    y_pred_test = (y_prob_test >= 0.5).astype(int)

    test_acc = accuracy_score(y_test, y_pred_test)
    test_prec = precision_score(y_test, y_pred_test, zero_division=0)
    test_rec = recall_score(y_test, y_pred_test, zero_division=0)
    test_f1 = f1_score(y_test, y_pred_test, zero_division=0)
    test_roc = roc_auc_score(y_test, y_prob_test)
    test_pr = average_precision_score(y_test, y_prob_test)

    # Train metrics (overfitting check)
    y_prob_train = pipeline.predict_proba(X_train)[:, 1]
    y_pred_train = (y_prob_train >= 0.5).astype(int)

    train_acc = accuracy_score(y_train, y_pred_train)
    train_f1 = f1_score(y_train, y_pred_train, zero_division=0)
    train_roc = roc_auc_score(y_train, y_prob_train)

    # Gaps
    acc_gap = train_acc - test_acc
    f1_gap = train_f1 - test_f1
    roc_gap = train_roc - test_roc

    print(f"  {label}")
    cm = confusion_matrix(y_test, y_pred_test)
    print(f"  Confusion Matrix:\n{cm}")
    print(f"  TEST  -> Acc: {test_acc:.4f}  Prec: {test_prec:.4f}  "
          f"Rec: {test_rec:.4f}  F1: {test_f1:.4f}")
    print(f"           ROC-AUC: {test_roc:.4f}  PR-AUC: {test_pr:.4f}")
    print(f"  TRAIN -> Acc: {train_acc:.4f}  F1: {train_f1:.4f}  "
          f"ROC-AUC: {train_roc:.4f}")
    print(f"  GAP   -> Acc: {acc_gap:+.4f}  F1: {f1_gap:+.4f}  "
          f"ROC-AUC: {roc_gap:+.4f}")

    if acc_gap > 0.10:
        print("Large accuracy gap - possible overfitting")
    elif test_roc < 0.60:
        print("Low ROC-AUC - possible underfitting")
    else:
        print("No significant overfitting or underfitting detected")

    return {
        "Test_Acc": round(test_acc, 4),
        "Precision": round(test_prec, 4),
        "Recall": round(test_rec, 4),
        "F1": round(test_f1, 4),
        "ROC-AUC": round(test_roc, 4),
        "PR-AUC": round(test_pr, 4),
        "Train_Acc": round(train_acc, 4),
        "Acc_Gap": round(acc_gap, 4),
    }


# CROSS-VALIDATION
def cross_validate_pipeline(pipeline, X_train, y_train, label=""):
    """Run 5-fold stratified cross-validation."""
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
    scoring = ["accuracy", "f1", "roc_auc", "average_precision"]

    cv_results = cross_validate(
        pipeline, X_train, y_train,
        cv=cv, scoring=scoring, n_jobs=-1,
        return_train_score=True,
    )

    print(f"\n5-Fold CV: {label}")
    for metric in scoring:
        test_key = f"test_{metric}"
        train_key = f"train_{metric}"
        t_mean = cv_results[test_key].mean()
        t_std = cv_results[test_key].std()
        tr_mean = cv_results[train_key].mean()
        print(f"  {metric:>20s}  ->  Val: {t_mean:.4f} ± {t_std:.4f}  "
              f"Train: {tr_mean:.4f}  Gap: {tr_mean - t_mean:+.4f}")


# MAIN
def main():
    # Load & clean
    df = prepare_dataframe(DATA_PATH)

    # Identify column types 
    X = df.drop(columns=[TARGET, "P_NAME"], errors="ignore")
    y = df[TARGET]

    numerical_cols = X.select_dtypes(include=["int", "float"]).columns.tolist()
    categorical_cols = X.select_dtypes(include=["object"]).columns.tolist()

    print(f"\nNumerical features ({len(numerical_cols)}): {numerical_cols}")
    print(f"Categorical features ({len(categorical_cols)}): {categorical_cols}")

    # Train / Test split (before any preprocessing)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=RANDOM_STATE, stratify=y,
    )
    print(f"\nTrain: {X_train.shape[0]} samples, Test: {X_test.shape[0]} samples")
    print(f"Train class distribution:\n{y_train.value_counts(normalize=True)}")

    # Build unified pipeline
    pipeline = build_unified_pipeline(numerical_cols, categorical_cols,
                                       use_smote=True)

    # Evaluate on hold-out test set
    metrics = evaluate(pipeline, X_train, X_test, y_train, y_test,
                       label="Unified Pipeline | Random Forest | Full (cleaned)")

    # Cross-validation
    cv_pipeline = build_unified_pipeline(numerical_cols, categorical_cols,
                                          use_smote=True)
    cross_validate_pipeline(cv_pipeline, X_train, y_train,
                            label="Unified Pipeline | Random Forest | Full (cleaned)")

    # Save
    os.makedirs(ARTIFACT_DIR, exist_ok=True)
    joblib.dump(pipeline, PIPELINE_PATH)
    print(f"\n[OK] Pipeline saved to: {PIPELINE_PATH}")
    print(f"   Pipeline type: {type(pipeline).__name__}")
    print(f"   Pipeline steps: {[name for name, _ in pipeline.steps]}")

    # Verify feature_names_in_ is accessible (backend depends on this)
    try:
        preprocessor = pipeline.named_steps["preprocessor"]
        feat_names = preprocessor.get_feature_names_out()
        print(f"   Output features after preprocessing: {len(feat_names)}")
    except Exception as e:
        print(f"   [WARNING] Could not extract feature names: {e}")

    return metrics


if __name__ == "__main__":
    results = main()
    print("\n--- Final Metrics ---")
    for k, v in results.items():
        print(f"  {k}: {v}")
