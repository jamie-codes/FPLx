def test_xgboost_importable_and_numpy_present():
    import numpy  # already a dep
    import xgboost
    from xgboost import XGBRegressor
    assert hasattr(XGBRegressor(), 'fit')
