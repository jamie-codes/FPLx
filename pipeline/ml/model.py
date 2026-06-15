"""ML-01: position-specific xgboost regressors over the leakage-free features.

One XGBRegressor per element_type (1=GK,2=DEF,3=MID,4=FWD). Deterministic
(fixed seed). Target = actual points for the (player, gw) row.
"""
from collections import defaultdict

import numpy as np
from xgboost import XGBRegressor

_XGB_PARAMS = dict(
    n_estimators=300, max_depth=4, learning_rate=0.05,
    subsample=0.8, colsample_bytree=0.8, objective='reg:squarederror',
    # n_jobs=1: single-threaded so predictions are deterministic across machines /
    # CI core counts (xgboost's parallel reductions can otherwise vary by thread count).
    n_jobs=1,
)


def rows_to_matrix(rows, feature_names):
    """Stack each row's features in feature_names order into an (n, k) float array."""
    return np.array([[r['features'][f] for f in feature_names] for r in rows],
                    dtype=float)


def train_position_models(train_rows, feature_names, seed=42):
    """Train one XGBRegressor per element_type present. Returns {element_type: model}."""
    by_pos = defaultdict(list)
    for r in train_rows:
        by_pos[r['element_type']].append(r)
    models = {}
    for et, rows in by_pos.items():
        X = rows_to_matrix(rows, feature_names)
        y = np.array([r['label'] for r in rows], dtype=float)
        model = XGBRegressor(random_state=seed, **_XGB_PARAMS)
        model.fit(X, y)
        models[et] = model
        if len(rows) < 50:
            print(f"ML-01 warning: position {et} trained on only {len(rows)} rows")
    return models


def predict(models, rows, feature_names):
    """Predict per row, routing each to its element_type's model. Returns list[float].
    Rows whose position has no trained model get 0.0 (logged)."""
    preds = [0.0] * len(rows)
    by_pos = defaultdict(list)
    for i, r in enumerate(rows):
        by_pos[r['element_type']].append(i)
    for et, idxs in by_pos.items():
        model = models.get(et)
        if model is None:
            print(f"ML-01 warning: no model for position {et}; predicting 0.0")
            continue
        X = rows_to_matrix([rows[i] for i in idxs], feature_names)
        out = model.predict(X)
        for j, i in enumerate(idxs):
            preds[i] = float(out[j])
    return preds
