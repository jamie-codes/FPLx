from ml.model import rows_to_matrix, train_position_models, predict

_NAMES = ['a', 'b']


def _rows(et, n, base):
    # label correlates with feature 'a' so the model has something to learn
    return [{'features': {'a': float(i), 'b': 1.0}, 'label': base + i,
             'element_type': et} for i in range(n)]


def test_rows_to_matrix_orders_by_feature_names():
    import numpy as np
    m = rows_to_matrix([{'features': {'a': 1.0, 'b': 2.0}}], _NAMES)
    assert isinstance(m, np.ndarray)
    assert m.shape == (1, 2)
    assert list(m[0]) == [1.0, 2.0]


def test_train_and_predict_returns_finite_per_row():
    import math
    train = _rows(1, 60, 2) + _rows(2, 60, 5)
    models = train_position_models(train, _NAMES, seed=42)
    assert set(models) == {1, 2}
    preds = predict(models, _rows(1, 10, 2), _NAMES)
    assert len(preds) == 10
    assert all(math.isfinite(p) for p in preds)


def test_position_routing_uses_matching_model():
    train = _rows(1, 60, 2) + _rows(4, 60, 50)  # GK low, FWD high
    models = train_position_models(train, _NAMES, seed=42)
    gk_pred = predict(models, [{'features': {'a': 5.0, 'b': 1.0}, 'element_type': 1}], _NAMES)[0]
    fwd_pred = predict(models, [{'features': {'a': 5.0, 'b': 1.0}, 'element_type': 4}], _NAMES)[0]
    assert fwd_pred > gk_pred  # routed to different position models


def test_determinism_same_seed_same_preds():
    train = _rows(3, 80, 4)
    p1 = predict(train_position_models(train, _NAMES, seed=7), _rows(3, 5, 4), _NAMES)
    p2 = predict(train_position_models(train, _NAMES, seed=7), _rows(3, 5, 4), _NAMES)
    assert p1 == p2
