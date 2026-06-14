def test_exp09_runs_and_produces_verdict():
    from experiments import exp09_odds
    result = exp09_odds.run()
    assert 'cs_sweep' in result and len(result['cs_sweep']) == 5
    assert 'goalexp_sweep' in result and len(result['goalexp_sweep']) == 5
    assert 'verdict' in result and result['verdict'] in ('SHIP_CS', 'SHIP_GOALEXP', 'SHIP_BOTH', 'NO_SHIP')
    # baseline (weight 0) Brier present and in [0,1]
    base = next(a for a in result['cs_sweep'] if a['odds_cs_weight'] == 0.0)
    assert 0.0 <= base['cs_brier'] <= 1.0


def test_cs_metrics_helper():
    from experiments.exp09_odds import _brier
    # perfect prediction -> 0 ; worst -> 1
    assert _brier([(1.0, True), (0.0, False)]) == 0.0
    assert _brier([(0.0, True), (1.0, False)]) == 1.0
