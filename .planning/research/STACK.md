# Technology Stack

**Project:** FPL Analyst — v1.1 Decision Engine additions
**Researched:** 2026-03-29
**Scope:** NEW capabilities only. Existing validated stack (Next.js 16, React 19, TypeScript, TanStack Table v8, TanStack Query v5, Tailwind CSS v4, Vitest, Python/pandas/soccerdata/requests/Vercel Blob) is NOT re-researched here.

---

## What Is Already Installed (do not re-add)

From `package.json` and `pipeline/requirements.txt` as of 2026-03-29:

**npm:** `next@16.2.1`, `react@19.2.4`, `@tanstack/react-query@^5.95.2`, `@tanstack/react-table@^8.21.3`, `@vercel/blob@^2.3.1`, `zod@^4.3.6`, `tailwindcss@^4`, `vitest@^4.1.2`

**pip:** `requests>=2.32.0`, `pandas>=2.2.0`, `soccerdata==1.8.8`, `vercel-blob>=0.4.0`, `python-dotenv>=1.0.0`

---

## New Stack Additions Required

### Python Pipeline — Projected Points and xMins Engine

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| scikit-learn | ^1.8.0 | xMins start-probability model (logistic regression) | The xMins model is a classifier: given recent minutes, team news flags, and fixture difficulty, estimate P(start). Logistic regression (`sklearn.linear_model.LogisticRegression`) is the correct tool — interpretable, no heavy dependencies, outputs calibrated probabilities. scikit-learn 1.8.0 released December 2025; supports Python 3.11 and pandas 2.x. |
| scipy | ^1.15.0 | Weighted ranking for captaincy scores | `scipy.stats.weightedtau` / `numpy.average` for composite captaincy score construction. Also provides `scipy.stats.norm` for Bayesian-style projection intervals if needed later. Already an indirect soccerdata dependency but should be pinned explicitly. |

**Why scikit-learn over custom formula for xMins:**
The xMins model inputs are tabular: recent minutes per GW (last 5), team news status flag (from bootstrap `news` field), FDR of next fixture, position (proxy for rotation likelihood). A logistic regression trained on historical `element_summary` data gives a calibrated start probability with `predict_proba()`. Custom formula would require manual calibration. scikit-learn adds ~30 MB to the venv — acceptable for a pipeline-only dependency.

**Why no XGBoost or neural network:**
The dataset is small (~600 players, ~38 GW history). Complex models overfit on small tabular data. A logistic regression is correct here. If a more complex model is warranted later it can be swapped; the interface stays the same.

**Why scipy separately:**
soccerdata pulls it in transitively but does not pin it. Explicit pin in requirements.txt prevents silent version drift breaking the captaincy ranking computation.

---

### Python Pipeline — FPL Auth (Session-Cookie Login)

No new library required. The existing `requests` library handles session-cookie auth natively via `requests.Session()`. The authentication pattern is:

```python
import requests

session = requests.Session()
session.post(
    'https://users.premierleague.com/accounts/login/',
    data={
        'login': email,
        'password': password,
        'redirect_uri': 'https://fantasy.premierleague.com/a/login',
        'app': 'plfpl-web',
    },
    headers=HEADERS,
)
# session now holds pl_profile and sessionid cookies
response = session.get(f'https://fantasy.premierleague.com/api/my-team/{team_id}/', headers=HEADERS)
```

**Why not the `fpl` PyPI library (amosbastian/fpl):**
The `fpl` library is unmaintained — last PyPI release August 2023, no published releases on GitHub, open issues unresolved. It is async-only (requires `aiohttp`), which is unnecessary overhead for a pipeline that runs sequentially. The raw `requests.Session()` pattern is a 10-line implementation and has no maintenance risk.

**Why not `fpl-api` (C-Roensholt/fpl-api):**
Similar maintenance uncertainty. The existing `fpl_client.py` already implements the FPL HTTP layer. Extending it with a `login()` function that returns an authenticated session is the correct approach — consistent with existing patterns, no new dependency.

**Auth endpoint status (MEDIUM confidence):**
The `users.premierleague.com/accounts/login/` endpoint has been the login URL since at least 2019. No evidence found of it being replaced or broken in 2024/25. However, FPL has changed endpoint paths before (e.g., `/drf/` → `/api/`). The my-team URL to use is `/api/my-team/{team_id}/` (modern path, not the old `/drf/my-team/`). The cookie names `pl_profile` and `sessionid` remain the same. Flag this endpoint for manual verification at v1.1 build time.

---

### Next.js Route Handler — Auth Relay

No new npm package required. The existing Next.js Route Handler pattern handles the auth relay:

- `POST /api/auth/login` — accepts `{ email, password }` from UI, calls FPL login server-side, returns `{ bank, selling_prices }` (never returns cookies to client)
- `GET /api/auth/my-team` — calls `/api/my-team/{id}/` with session cookies held server-side for the duration of the request

The session is used once per pipeline trigger or page load and is not persisted. Credentials are never stored — they are passed in the request body and discarded after use.

**Note on cookie jar in Node.js fetch:**
If the auth relay is implemented in a Route Handler using Node.js `fetch()` (not the Python pipeline), cookie jar management requires either `tough-cookie` + `node-fetch` or using the Python pipeline path. The simpler approach: delegate auth to the Python pipeline (which already uses `requests.Session()`), have the pipeline write the authenticated data (bank, selling prices) to `my_team.json` in Blob, and serve it from a Route Handler like all other pipeline outputs. This avoids cookie management in Node.js entirely.

---

### Frontend — Explainability and Recommendations UI

No new npm packages are required. All UI primitives needed exist in shadcn/ui (already installed) using Tailwind CSS v4.

| Component | shadcn/ui primitive | Purpose |
|-----------|--------------------|---------|
| Risk flag badges | `Badge` (variant="destructive" / "warning" / "outline") | Rotation risk, regression risk, fixture swing — colour-coded per severity |
| Buy/Hold/Sell pill | `Badge` with custom CVA variants | Single recommendation per squad player |
| Explainability panel | `Collapsible` or `Accordion` | "Why this player" reasons expand inline per row |
| Captaincy card | Composed from `Card` + `Badge` | Top-5 captaincy candidates with safe/upside split |
| Tooltip on flags | `Tooltip` | Hover-over detail for each risk flag code |

**Why no new UI library (e.g., react-tooltip standalone):**
shadcn/ui's `Tooltip` wraps Radix UI's `@radix-ui/react-tooltip` which is already a transitive dependency of shadcn/ui's other components. Adding a standalone tooltip library would be redundant and create conflicting styles.

**Why Collapsible over Accordion for explainability:**
`Accordion` implies mutually exclusive open panels — only one item open at a time. `Collapsible` is independent per-row, so the manager can expand multiple players simultaneously to compare reasoning. Use `Collapsible` per table row.

**Why no dedicated "explainability library" (e.g., LIME/SHAP JS bindings):**
The explainability data is generated in the Python pipeline as structured text reasons (strings) and numeric factor weights. The UI only needs to render them — it does not compute them. No ML explainability library belongs in the frontend.

---

## Summary: What to Add

### pip (pipeline/requirements.txt additions)

```bash
pip install scikit-learn>=1.8.0 scipy>=1.15.0
```

### npm (no additions needed)

The existing `package.json` is sufficient. Use shadcn/ui CLI to add any not-yet-added components:

```bash
npx shadcn@latest add collapsible accordion badge tooltip card
```

These are copy-paste components with no new runtime npm dependency — they use Radix UI primitives already present.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| xMins model | scikit-learn LogisticRegression | Custom weighted formula | Formula requires manual calibration; sklearn gives calibrated probabilities and is replaceable without interface change |
| xMins model | scikit-learn LogisticRegression | XGBoost / LightGBM | Overkill for ~600-player tabular dataset; adds 200+ MB dependency; overfits on small data |
| FPL auth library | raw requests.Session() | amosbastian/fpl (PyPI) | Unmaintained since Aug 2023; async-only (aiohttp required); existing fpl_client.py pattern is simpler |
| FPL auth library | raw requests.Session() | fpl-api (C-Roensholt) | Maintenance uncertainty; adds abstraction layer without benefit for a 10-line auth extension |
| Auth relay | Python pipeline writes my_team.json | Node.js Route Handler with cookie jar | Cookie jar in Node.js needs tough-cookie (extra dep); Python pipeline already handles auth; pattern is consistent with all other pipeline outputs |
| Explainability UI | shadcn/ui Collapsible | Dedicated react-tooltip library | Redundant — Radix tooltip already a transitive dep; conflicting styles |
| Explainability UI | shadcn/ui Collapsible | SHAP/LIME JS bindings | Explainability computed in Python, not client-side; frontend only needs to render structured strings |
| Captaincy ranking | pandas + numpy weighted score | ML ranking model | Ranking 15 squad players by composite score is a sort, not a learned model; weighted sum is correct and auditable |

---

## Integration with Existing Stack

| New Capability | Integrates With | Integration Point |
|----------------|-----------------|-------------------|
| Projected points (Python) | `merge.py` pipeline | New `projected_points.py` module adds `proj_pts_1gw`, `proj_pts_3gw`, `proj_pts_5gw` fields to `merged_players.json` schema |
| xMins model (Python) | `merge.py` pipeline | New `xmins.py` module adds `xMins`, `start_prob`, `minutes_risk` fields to `merged_players.json` |
| Buy/Hold/Sell (Python) | Pipeline output + Next.js | New `recommendations.json` blob written by pipeline; served via new `/api/recommendations` Route Handler |
| Captaincy rankings (Python) | Pipeline output + Next.js | `recommendations.json` includes `captaincy` array; served via same Route Handler |
| Explainability (UI) | `MergedPlayer` TypeScript type | Add `reasons: string[]` and `risk_flags: RiskFlag[]` to existing `MergedPlayer` type; Zod schema extended |
| FPL auth (Python + UI) | `fpl_client.py` + new Route Handler | `fpl_client.py` gets `login(email, password) -> requests.Session`; pipeline uses it when `FPL_EMAIL`/`FPL_PASSWORD` env vars present; UI has optional login form that POSTs to `/api/auth/login` |

---

## FPL Auth: Exact Endpoint Reference

The session-cookie auth flow (MEDIUM confidence — verify at build time):

```
POST https://users.premierleague.com/accounts/login/
Content-Type: application/x-www-form-urlencoded

login=<email>&password=<password>&redirect_uri=https://fantasy.premierleague.com/a/login&app=plfpl-web
```

Cookies returned: `pl_profile` (.premierleague.com), `sessionid` (fantasy.premierleague.com), `sessionid` (users.premierleague.com)

Authenticated endpoints needed for v1.1:
- `GET /api/my-team/{team_id}/` — returns `picks[].selling_price` and `transfers.bank`
- `GET /api/me/` — returns bank balance (alternative)

**Risk:** FPL has changed API paths before. The endpoint has been stable since at least 2019 based on community sources, but no official documentation exists. Build with a clear error path for auth failure — fall back to public-data-only mode.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| scikit-learn for xMins | HIGH | Version 1.8.0 confirmed on PyPI (Dec 2025); Python 3.11 + pandas 2.x compatible confirmed |
| scipy for ranking | HIGH | Standard scientific Python stack; version 1.15.x current; no compatibility issues |
| No new npm packages needed | HIGH | shadcn/ui components are copy-paste; Radix primitives already present transitively |
| requests.Session() for auth | HIGH | Documented pattern; works with Python's built-in cookie jar |
| `fpl` PyPI library abandonment | HIGH | Last release Aug 2023; GitHub shows no active maintenance |
| FPL auth endpoint stability | MEDIUM | Observed stable since 2019 in community sources; no official FPL documentation; could change without notice |
| my-team endpoint fields (selling_price, bank) | MEDIUM | `selling_price` in picks confirmed by fpl.readthedocs.io source code; `bank` field in transfers object confirmed by community guides; not officially documented |
| shadcn Collapsible for explainability | HIGH | Documented component; correct primitive for independent-expand per row |

---

## Sources

- scikit-learn 1.8.0 release: [scikit-learn PyPI](https://pypi.org/project/scikit-learn/) — v1.8.0, December 2025
- scikit-learn Python 3.11 support: [scikit-learn install docs](https://scikit-learn.org/stable/install.html)
- FPL auth flow: [Fantasy Premier League API authentication guide — Bram Vanherle, Medium](https://medium.com/@bram.vanherle1/fantasy-premier-league-api-authentication-guide-2f7aeb2382e4) (2019, still referenced as current approach in 2025 community searches)
- FPL auth Node.js variant: [Fantasy Premier League API authentication guide — eyasu kibru, Medium](https://medium.com/@eyasukibru13/fantasy-premier-league-api-authentication-guide-using-node-js-ca25e693594e)
- FPL my-team endpoint: [FPL API Endpoints Cheat Sheet — sertalpbilal, Cheatography](https://cheatography.com/sertalpbilal/cheat-sheets/fpl-api-endpoints/history/279325)
- FPL my-team fields: [Fantasy Premier League API Endpoints Detailed Guide — Frenzel Timothy, Medium](https://medium.com/@frenzelts/fantasy-premier-league-api-endpoints-a-detailed-guide-acbd5598eb19)
- amosbastian/fpl maintenance status: [fpl GitHub](https://github.com/amosbastian/fpl) — no releases published, last meaningful activity 2023
- shadcn/ui Collapsible: [Collapsible — shadcn/ui docs](https://ui.shadcn.com/docs/components/radix/collapsible)
- shadcn/ui Accordion: [Accordion — shadcn/ui docs](https://ui.shadcn.com/docs/components/radix/accordion)
- shadcn/ui Badge: [Badge — shadcn/ui docs](https://ui.shadcn.com/docs/components/radix/badge)
- pandas weighted rolling average: [pandas DataFrame.rolling — pandas 3.0.1 docs](https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.rolling.html)
- scipy weightedtau: [scipy.stats.weightedtau — SciPy v1.17.0 Manual](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.weightedtau.html)
- FPL projected points community reference: [FPL-Expected-Points — daniel-mehta, GitHub](https://github.com/daniel-mehta/FPL-Expected-Points)
