# Research Summary — v1.25 Pre-Season Intelligence

**Synthesised:** 2026-05-19
**Overall confidence:** HIGH on codebase wiring; MEDIUM on FPL off-season API behaviour (undocumented).

---

## Stack additions

**No new dependencies.** All four features build on existing v1.24 primitives.

- **AUTO-01** reuses the existing `bootstrap-static` fetch in `run.py` + 4×-daily GitHub Actions cron.
- **WATCH-01/04** reuses the localStorage simple-JSON pattern + TanStack Query + React 19 `useSyncExternalStore`.
- **COST-01** reuses `buildPreSeasonSquad()` (already accepts `budget`) + React 19 `useDeferredValue` + native `<input type="range">`.
- **GREEDY-NULL** is a pure refactor adding a sibling `diagnoseBuildPreSeasonSquad()` function.

Rejected: `use-local-storage-state`, `lodash.debounce`, `@radix-ui/react-slider`, `idb-keyval`, `zustand`, `jotai`.

---

## Key feature findings

### AUTO-01 — Next-season detection
- Binary `IS_OFF_SEASON` is insufficient. Introduce **tri-state**: `PRE_SEASON_ACTIVE` requires `IS_OFF_SEASON && len(events)>=38 && !any(e.finished) && events[0].deadline_time present`.
- New artifact: `pre_season_active.json` (Blob) → `/api/pre-season-active` → `usePreSeasonActive()` hook.
- `suggest_squad.py` idempotency gate (lines 263-278) needs `force=False` parameter; AUTO-01 calls `force=True` on new-season bootstrap.
- UI: status pill on NextSeasonPlannerTab (zinc "Awaiting" → green "Live") + first-activation banner.

### WATCH-01/04 — Transfer Target Watchlist
- `localStorage['fplx_watchlist']` = `{version: 1, ids: number[], added: {id: iso}}`. **Store IDs only** — rehydrate `now_cost`, `team`, `element_type` from `/api/players` each render (fields drift between seasons).
- `useWatchlist()` backed by `useSyncExternalStore` — shared by GemTable, WatchlistTab, NSP without prop-drilling.
- GemTable: star/pin toggle in existing expand-row action cluster.
- Differentiators: squad-overlap badge (intersect with `usePreSeasonSquad`), amber border for news <48h.

### COST-01 — Squad Cost Simulator
- **Critical correction:** no Python bridge exists in `src/`; Vercel cannot run PuLP at request time. **Slider drives client-side `buildPreSeasonSquad()` greedy (<5ms on 700 players)**, not a Python subprocess.
- Pattern: `useDeferredValue` + commit-on-release (onPointerUp OR 300ms). `useMemo` re-runs greedy on `committedBudget`.
- API refactor: `/api/pre-season-squad?include=inputs` returns `{ squad, inputs: { players, scoreMap, budget_default }, health }`.
- Range: £80m–£120m, step £0.5m, default £100m. Null → "Infeasible at £X.Xm — try £Y.Ym+" using `health.min_feasible_budget_greedy`.

### GREEDY-NULL — Null-rate instrumentation
- Reframed: not a localStorage counter (vanity metric, confounded by COST-01 slider). Actionable metric = algorithmic gap: "% of (budget, archive) inputs where greedy null but ILP feasible".
- New `pipeline/squad_health.py`: sweeps £80–£120 in £0.5m steps, Python-port greedy + PuLP cross-check, writes `pre_season_squad_health.json` with `greedy_null_rate`, `min_feasible_budget_greedy`, `min_feasible_budget_ilp`, `greedy_optimality_gap_avg`.
- Surface as `health` field on `/api/pre-season-squad` response.
- Add `diagnoseBuildPreSeasonSquad()` in TS returning reason codes without breaking existing tests.

---

## Architecture decisions

| Decision | Rationale |
|----------|-----------|
| COST-01 drives client-side greedy only | No Python bridge in `src/`; Vercel can't run PuLP; greedy is <5ms in-process |
| AUTO-01 writes `pre_season_active.json` flag | Single source of truth; mirrors `mc_enabled` flag pattern from v1.18 |
| WATCH-01 uses `useSyncExternalStore` | 3 consumers; React 19 native; no new deps; no prop-drilling |
| GREEDY-NULL measured server-side via budget sweep | Client null counter is confounded by deliberate infeasibility from COST-01 slider |
| Slider state scoped to `NextSeasonPlannerTab` only | Lifting to `page.tsx` causes GemTable re-render storms |

---

## Watch out for

1. **Binary `IS_OFF_SEASON` misses armed-pre-season** → tri-state predicate (`len(events)>=38 && !any(finished) && deadline_time present`).
2. **Slider driving Python per tick → Vercel timeout** → client-side greedy via `useDeferredValue`; never spawn Python from a route handler.
3. **Element `element_type` drifts season-to-season** → store IDs only; rehydrate from `/api/players`; show "Departed" pill for missing IDs.
4. **GREEDY-NULL as localStorage counter = vanity metric** → server-side sweep with PuLP cross-check.
5. **`suggest_squad.py` idempotency gate blocks pre-season re-runs** → add `force=False`; AUTO-01 calls `force=True`.

---

## Recommended phase order

| Phase | Feature(s) | Key dependency |
|-------|------------|----------------|
| 127 | GREEDY-NULL + WATCH-01/04 | GREEDY-NULL stabilises API response shape; WATCH is fully independent |
| 128 | AUTO-01 | Establishes `pre_season_active.json` + `suggest_squad.py force=True` re-run path |
| 129 | COST-01 | Depends on Phase 127 `inputs`+`health` fields and Phase 128 freshness signal |
