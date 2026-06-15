def test_exp11_runs_produces_ml_and_formula_metrics_and_caveat():
    from experiments import exp11_ml_shadow
    result = exp11_ml_shadow.run()
    assert 'ml_metrics' in result and 'formula_metrics' in result
    for m in (result['ml_metrics'], result['formula_metrics']):
        assert m['top10_mean_pts'] is not None
        assert m['rmse'] is not None
    assert 'feature_importances' in result
    assert 'caveat' in result and 'NOT a promotion signal' in result['caveat']
    assert 'verdict' not in result  # groundwork: deliberately no verdict
