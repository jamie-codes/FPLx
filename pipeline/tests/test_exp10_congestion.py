def test_exp10_runs_and_produces_verdict():
    from experiments import exp10_congestion
    result = exp10_congestion.run()
    assert 'sweep' in result and len(result['sweep']) == 6
    assert 'clash_count' in result and result['clash_count'] > 0
    assert result['verdict'] in ('SHIP', 'NO_SHIP')
    base = next(a for a in result['sweep'] if a['congestion_penalty'] == 0.0)
    assert 'top10_mean_pts' in base and 'clash_rmse' in base
    # Robustness keys added by EUR-01 honest verdict
    assert 'permutation_pvalue' in result
    assert 'permutation_n' in result
    assert 'robustness_note' in result
    assert 0.0 <= result['permutation_pvalue'] <= 1.0


def test_rmse_helper():
    from experiments.exp10_congestion import _rmse
    assert _rmse([(2.0, 2.0), (3.0, 3.0)]) == 0.0
    assert abs(_rmse([(0.0, 2.0)]) - 2.0) < 1e-9
