# Architecture Research

**Domain:** Personal FPL analytics web app — v1.1 Decision Engine integration
**Researched:** 2026-03-29
**Confidence:** HIGH (derived from codebase inspection + verified external sources)

---

## Context: What v1.1 Adds to v1.0

v1.0 established a stable pattern: Python pipeline writes `merged_players.json` to Vercel Blob, `/api/players` serves it, `usePlayers()` hydrates the React layer. Every v1.0 feature flows through this single channel.

v1.1 adds six features on top of that foundation. Four of them extend the existing data flow. Two require new flows.

| Feature | Integration mode |
|---------|----------------|
| Projected points (1/3/5 GW) | Extend `merged_players.json` schema |
| xMins / minutes risk badges | Extend `merged_players.json` schema |
| Buy / Hold / Sell recommendations | New TypeScript engine in `lib/` consuming extended schema |
| Captaincy rankings | New TypeScript engine in `lib/` |
| Explainability panel | Structured fields from Python + TS reasoning layer |
| FPL session-cookie login | New Route Handler `/api/my-team` |

---

## System Overview (v1.1 Target State)

```
┌────────────────────────────────────────────────────────────────────┐
│                     DATA PIPELINE (Python)                          │
│                                                                     │
│  fpl_client.py      understat_client.py      fpl_fixtures          │
│       │                    │                      │                 │
│       └────────────────────┴──────────────────────┘                │
│                             │                                       │
│                        merge.py                                     │
│                        + projections.py  (NEW)                     │
│                        + xmins.py        (NEW)                     │
│                             │                                       │
│              merged_players.json  (EXTENDED schema)                 │
│                     defcon_stats.json                               │
│                      last_updated.json                              │
│                             │                                       │
│                    Vercel Blob / local cache                        │
└────────────────────────────────────────────────────────────────────┘
                              │
                  reads at request time
                              │
┌────────────────────────────────────────────────────────────────────┐
│                     NEXT.JS APP (Vercel)                            │
│                                                                     │
│  ROUTE HANDLERS (server-side)                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  ┌──────────┐  │
│  │ /api/players│  │/api/squad/  │  │/api/my-team  │  │/api/fpl/ │  │
│  │ (unchanged) │  │[teamId]     │  │(NEW: auth)   │  │[..proxy] │  │
│  │             │  │(unchanged)  │  │              │  │          │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬───────┘  └──────────┘  │
│         │                │                │                        │
│         └────────────────┴────────────────┘                        │
│                          │                                          │
│  CLIENT LIBS (lib/)                                                 │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────┐ │
│  │ gem-score.ts   │  │ recommend.ts   │  │ captaincy.ts           │ │
│  │ (unchanged)    │  │ (NEW)          │  │ (NEW)                  │ │
│  └────────────────┘  └────────────────┘  └────────────────────────┘ │
│                                                                     │
│  COMPONENTS (src/components/)                                       │
│  ┌───────────────┐  ┌─────────────────┐  ┌───────────────────────┐  │
│  │ GemTable      │  │ TransferPanel   │  │ CaptaincyPanel (NEW)  │  │
│  │ (+ proj pts   │  │ (+ rec badges,  │  │                       │  │
│  │  columns)     │  │  sell price)    │  │                       │  │
│  └───────────────┘  └─────────────────┘  └───────────────────────┘  │
│  ┌───────────────┐  ┌─────────────────┐                             │
│  │ MinutesBadge  │  │ ExplainPanel    │                             │
│  │ (NEW)         │  │ (NEW)           │                             │
│  └───────────────┘  └─────────────────┘                             │
└────────────────────────────────────────────────────────────────────┘
```

---

## Feature 1: Projected Points — merged_players.json Schema Extension

### Decision: Compute in Python pipeline

Projected points require fixture data, team xGA, historical form over multiple gameweeks, and clean sheet probabilities — all already present or easily added in the pipeline. Computing them in Python at pipeline time is cheaper, simpler, and keeps TypeScript types thin.

TypeScript should not re-derive projections client-side. It should only consume them.

### New fields added to each player record in merged_players.json

```python
# Added in merge.py (or new projections.py called from run.py)
{
  # ... existing fields unchanged ...

  # Projected points (PROJ-01, PROJ-02, PROJ-03)
  "proj_pts_1gw": 4.2,      # float, projected FPL points next 1 GW
  "proj_pts_3gw": 13.1,     # float, sum over next 3 GWs
  "proj_pts_5gw": 20.4,     # float, sum over next 5 GWs

  # xMins (MINS-01, MINS-02)
  "xmins": 72.5,            # float, expected minutes next GW (0–90)
  "start_prob": 0.82,       # float, 0.0–1.0 probability of starting
  "mins_risk": "Nailed",    # string: "Nailed" | "Likely" | "Rotation" | "Cameo"
}
```

### MergedPlayer TypeScript interface additions

```typescript
// src/lib/types.ts — additions to MergedPlayer
proj_pts_1gw: number | null    // null if insufficient data
proj_pts_3gw: number | null
proj_pts_5gw: number | null
xmins: number | null           // expected minutes next GW
start_prob: number | null      // 0.0–1.0
mins_risk: 'Nailed' | 'Likely' | 'Rotation' | 'Cameo' | null
```

Use `| null` for all projected fields, not `| undefined`. A missing projection is a data gap, not a schema gap — null communicates that explicitly, and matches the existing `xg_per90: number | null` pattern.

### Projection formula (Python, medium complexity)

xPts for a single GW per player:

```
xPts = xMinPts(minutes_prob) + xGoalPts(xg_per90, start_prob, fdr) + xAssistPts(xa_per90, start_prob, fdr) + xCSPts(position, fdr) + xBonusPts(form_pts_per90)
```

Where:
- `xMinPts`: Bayesian-smoothed probability of appearing at all (> 0 min) and of playing 60+ min, using last 6 GW minutes history from `element-summary`
- `xGoalPts / xAssistPts`: `xg_per90 * (xmins/90) * (1 ± fdr_adjustment)` — FDR-adjusted per-90 rate times expected minutes fraction
- `xCSPts`: DEF/GK only; Poisson probability of clean sheet from rolling goals-conceded data already computed for custom FDR
- `xBonusPts`: small flat multiplier from recent form

Multi-GW: sum single-GW projections over next 1/3/5 fixtures from existing `fixtures` array. Blank and double gameweeks handled naturally because the fixtures array already accounts for them.

### xMins classification thresholds

```python
if xmins >= 75:     mins_risk = "Nailed"
elif xmins >= 55:   mins_risk = "Likely"
elif xmins >= 30:   mins_risk = "Rotation"
else:               mins_risk = "Cameo"
```

These thresholds align with FPL scoring breakpoints (1 pt for any appearance, 2 pts for 60+ min).

---

## Feature 2: xMins Model — Data Sources

xMins is derived entirely from existing pipeline data — no new API calls required:

| Input | Source | Already in pipeline? |
|-------|--------|----------------------|
| Minutes per game (last 6 GW) | `element-summary/{id}/history` | Partially — DefCon already calls this |
| Start probability | Derived from minutes distribution | No — new computation |
| FPL availability status | `bootstrap.elements[].status` | Yes |
| Injury news text | `bootstrap.elements[].news` | Yes (`news` field) |

The DefCon module (`pipeline/defcon.py`) already calls `element-summary` for every non-GK player. The xMins module can reuse those calls — or the pipeline should cache element-summary results to disk (not re-fetch for each module).

### Recommended: shared element-summary cache

```python
# pipeline/run.py — share element-summary data between defcon and xmins
summaries = fetch_all_element_summaries(bootstrap)  # single fetch pass
defcon_stats = compute_defcon_stats(bootstrap, difficulty_scores, summaries)
merged = merge_players(bootstrap, fixtures, understat, id_map, summaries)  # pass through for xmins
```

This avoids a second round of ~700 individual HTTP calls.

---

## Feature 3: Buy / Hold / Sell Recommendations

### Decision: Compute in TypeScript, not Python

Buy/Hold/Sell is squad-relative — it requires knowing which players a specific manager owns. This data is per-user (from `/api/squad/[teamId]`) and is fetched at runtime. Python runs at pipeline time with no user context.

The recommendation engine belongs in `src/lib/recommend.ts` as a pure function, similar to `transfer-engine.ts`.

### recommend.ts contract

```typescript
// src/lib/recommend.ts
export type Recommendation = 'BUY' | 'HOLD' | 'SELL'

export interface PlayerRecommendation {
  player: ScoredPlayer
  recommendation: Recommendation
  proj_pts_1gw: number | null
  proj_pts_delta: number | null   // vs best available replacement
  replacement_shortlist: ScoredPlayer[]  // top 3 same-position, not in squad
  reasons: string[]               // for explainability panel
  risk_flags: RiskFlag[]
}

export type RiskFlag =
  | 'rotation_risk'
  | 'fixture_swing'   // next GW difficulty jumps vs recent average
  | 'regression_risk' // form_pts_per90 >> xg_per90+xa_per90 (overperforming)
  | 'injury_concern'  // status !== 'a'

export function computeRecommendations(
  picks: SquadPick[],
  allPlayers: ScoredPlayer[],
  bankBalance: number,
): PlayerRecommendation[]
```

### Recommendation logic (simple heuristic, not ML)

```
SELL if: mins_risk === 'Cameo' OR status === 'i'/'s'
         OR (proj_pts_1gw < median_squad_proj_pts AND positive gem_delta replacement exists)

BUY candidates: top players not in squad by proj_pts_1gw, filtered by budget

HOLD: everything else
```

### Relationship to existing transfer-engine.ts

`transfer-engine.ts` ranks transfers by `gem_delta`. The new `recommend.ts` ranks by `proj_pts_delta` (projected points improvement). These are related but distinct signals. Keep them as separate pure functions — the UI can surface both.

---

## Feature 4: Captaincy Rankings

### Decision: Compute in TypeScript

Captaincy is projection-based and uses only the public player data already in `merged_players.json`. No pipeline change needed — it runs on the client from existing + extended fields.

```typescript
// src/lib/captaincy.ts
export interface CaptaincyCandidate {
  player: ScoredPlayer
  proj_captain_pts: number  // proj_pts_1gw * 2
  category: 'safe' | 'upside'
  reasons: string[]
}

export function rankCaptaincy(players: ScoredPlayer[]): CaptaincyCandidate[]
```

Classification:
- **Safe**: high `xmins` (>= 75), `proj_pts_1gw` > threshold, easy-to-medium fixture
- **Upside**: lower `xmins` but high `xg_per90`, very easy fixture, or DGW

Top 5 returned. No separate API route needed — runs client-side from `usePlayers()` data.

---

## Feature 5: Explainability Panel

### Architecture: structured fields from Python + reasoning assembled in TypeScript

The Python pipeline contributes machine-readable signals per player (the new projected fields, risk flag inputs). The TypeScript layer assembles human-readable strings from those signals. Do not pre-compute explanation strings in Python — they are presentational, not analytical.

```typescript
// src/lib/explain.ts (or inline in recommend.ts)
function buildReasons(player: ScoredPlayer): string[] {
  const reasons: string[] = []
  if (player.start_prob !== null && player.start_prob >= 0.9)
    reasons.push('Nailed starter — near-certain 90 minutes')
  if (player.penalties_order === 1)
    reasons.push('Primary penalty taker')
  if (player.proj_pts_1gw !== null && player.proj_pts_1gw >= 8)
    reasons.push(`Strong GW projection: ${player.proj_pts_1gw.toFixed(1)} pts`)
  // ... etc
  return reasons
}
```

Risk flags are similarly assembled from player fields — they are predicates on the data, not new data.

No new API route or pipeline output needed for explainability. The data is already in the schema; the narrative layer is pure TypeScript.

---

## Feature 6: FPL Session-Cookie Login (`/api/my-team`)

### Authentication flow

FPL uses session-cookie auth, not OAuth or API tokens.

**Login endpoint:** `POST https://users.premierleague.com/accounts/login/`

```
Body (form-encoded):
  login=<email>
  password=<password>
  redirect_uri=https://fantasy.premierleague.com/a/login
  app=plfpl-web
```

On success, the response sets cookies:
- `pl_profile` (domain: `.premierleague.com`)
- `sessionid` (domain: `fantasy.premierleague.com`)
- `sessionid` (domain: `users.premierleague.com`)

**My-team endpoint:** `GET https://fantasy.premierleague.com/api/my-team/{teamId}/`

Requires the `sessionid` cookie forwarded in the request.

### New Route Handler: `/api/my-team`

This is a new dedicated Route Handler — not a generic proxy extension. It must:
1. Accept credentials (email + password) as POST body parameters
2. POST to `users.premierleague.com/accounts/login/` server-side
3. Extract `sessionid` cookies from the login response
4. GET `/api/my-team/{teamId}/` with the session cookies
5. Return `picks` array (with `selling_price`) to the client
6. Never persist credentials or session cookies

```typescript
// src/app/api/my-team/route.ts  (NEW)
export async function POST(request: NextRequest) {
  const { email, password, teamId } = await request.json()

  // Step 1: Login to FPL
  const loginRes = await fetch('https://users.premierleague.com/accounts/login/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      login: email,
      password: password,
      redirect_uri: 'https://fantasy.premierleague.com/a/login',
      app: 'plfpl-web',
    }),
  })

  // Step 2: Extract session cookie from Set-Cookie header
  const setCookieHeader = loginRes.headers.get('set-cookie')
  // Parse sessionid for fantasy.premierleague.com domain
  const sessionCookie = extractSessionId(setCookieHeader)

  if (!sessionCookie) {
    return Response.json({ error: 'Login failed' }, { status: 401 })
  }

  // Step 3: Fetch my-team with session cookie
  const myTeamRes = await fetch(
    `https://fantasy.premierleague.com/api/my-team/${teamId}/`,
    {
      headers: {
        'Cookie': sessionCookie,
        'User-Agent': 'fplx/1.1',
      },
    }
  )

  if (!myTeamRes.ok) {
    return Response.json({ error: 'Failed to fetch team data' }, { status: myTeamRes.status })
  }

  const data = await myTeamRes.json()
  // Return only picks (which contain selling_price) — do not expose chips or transfers unnecessarily
  return Response.json({ picks: data.picks })
}
```

### selling_price field

The `/api/my-team/{teamId}/` response `picks` array contains:

```json
{
  "picks": [
    {
      "element": 123,
      "position": 1,
      "selling_price": 65,   // tenths of £1m — exact FPL sell price for this player
      "purchase_price": 62,
      "multiplier": 1,
      "is_captain": false,
      "is_vice_captain": false
    }
  ]
}
```

`selling_price` is the price at which the manager can sell the player (may differ from `now_cost` due to FPL's price locking mechanic). This is the v1.1 AUTH-02 requirement.

### SquadPick schema extension

```typescript
// src/lib/squad-adapter.ts — extend SquadPickSchema
export const SquadPickSchema = z.object({
  element:          z.number().int(),
  position:         z.number().int(),
  multiplier:       z.number().int(),
  is_captain:       z.boolean(),
  is_vice_captain:  z.boolean(),
  selling_price:    z.number().optional(),  // present when loaded via /api/my-team, absent from /api/squad/[id]
  purchase_price:   z.number().optional(),
})
```

### Security constraints

- Credentials sent as POST body JSON — never in query string, never logged
- Session cookie is used for one fetch call then discarded — not stored server-side
- No cookie is forwarded to the client — all session material stays in the Route Handler
- This is a single-user personal tool: no CSRF risk, no session management needed

---

## New vs Modified Components

### New files

| File | Type | Purpose |
|------|------|---------|
| `pipeline/projections.py` | Python | xPts computation for 1/3/5 GW windows |
| `pipeline/xmins.py` | Python | xMins model and start_prob / mins_risk classification |
| `src/app/api/my-team/route.ts` | Route Handler | FPL session-cookie login + my-team fetch |
| `src/lib/recommend.ts` | TypeScript | Buy/Hold/Sell engine (pure function) |
| `src/lib/captaincy.ts` | TypeScript | Captaincy ranking engine (pure function) |
| `src/components/squad/MinutesBadge.tsx` | Component | Colour-coded mins_risk badge |
| `src/components/squad/RecommendationBadge.tsx` | Component | BUY / HOLD / SELL badge |
| `src/components/captaincy/CaptaincyPanel.tsx` | Component | Top-5 captain candidates view |
| `src/components/explain/ExplainPanel.tsx` | Component | "Why this player" reasons + risk flags |
| `src/lib/hooks/useMyTeam.ts` | Hook | TanStack Query wrapper for POST /api/my-team |

### Modified files

| File | Change |
|------|--------|
| `pipeline/merge.py` | Import and call projections.py + xmins.py; pass element-summary cache through |
| `pipeline/run.py` | Share element-summary fetch between defcon and xmins modules |
| `src/lib/types.ts` | Add projected fields + xmins fields to `MergedPlayer`; add `selling_price` + `purchase_price` to `SquadPick` |
| `src/lib/squad-adapter.ts` | Extend `SquadPickSchema` with optional `selling_price` / `purchase_price` |
| `src/app/page.tsx` | Add "Captaincy" tab; add FPL login form to Squad tab |
| `src/components/transfers/TransferPanel.tsx` | Show exact sell price when available; show Buy/Hold/Sell badges |
| `src/components/squad/SquadView.tsx` | Add MinutesBadge, RecommendationBadge, proj_pts columns |
| `src/components/gem-table/columns.tsx` | Add proj_pts_1gw, proj_pts_3gw columns (optional, toggle) |

---

## Data Flow (v1.1)

### Extended Pipeline Flow

```
GitHub Actions cron (daily)
    ↓
pipeline/run.py
    ├── fpl_client.py → bootstrap-static + fixtures
    ├── understat_client.py → xG/xA
    ├── defcon.py (existing)
    ├── projections.py (NEW) → uses element-summary history
    └── xmins.py (NEW) → uses element-summary + status + news
         ↓
    merge.py → joins all data, emits extended merged_players.json
         ↓
    Vercel Blob: merged_players.json (extended schema)
```

### FPL Login Flow (new)

```
User clicks "Login with FPL" in TransferPanel
    ↓
LoginForm component → POST /api/my-team { email, password, teamId }
    ↓
Route Handler → POST users.premierleague.com/accounts/login/
    ↓
Extract sessionid cookie from response headers
    ↓
GET fantasy.premierleague.com/api/my-team/{teamId}/ with Cookie header
    ↓
Return { picks: [...] } with selling_price per player
    ↓
useMyTeam() hook stores result in TanStack Query cache
    ↓
TransferPanel shows exact sell prices; recommend.ts uses selling_price for budget calculations
```

### Recommendation Flow (new)

```
User loads Squad tab (Team ID entered or FPL login done)
    ↓
usePlayers() → merged_players.json (now includes proj_pts_*, xmins, start_prob, mins_risk)
useSquad(teamId) → entry/[id]/event/[gw]/picks/ (existing)
    ↓ (optional, if user logged in)
useMyTeam() → /api/my-team → selling_price per player
    ↓
recommend.ts(picks, allPlayers, bankBalance, sellingPrices?) → PlayerRecommendation[]
captaincy.ts(allPlayers) → CaptaincyCandidate[5]
    ↓
SquadView shows per-player: recommendation badge, proj_pts, risk flags
CaptaincyPanel shows top 5 candidates
ExplainPanel shows reasons + risk flags on player click
```

---

## Suggested Build Order

Dependencies drive this order. A feature cannot be built until its data dependencies are available.

### Phase 1: Schema extension (pipeline)

**PROJ-01, PROJ-02, PROJ-03, MINS-01, MINS-02**

Build `pipeline/projections.py` and `pipeline/xmins.py`, wire into `run.py`, extend `merged_players.json`. Update `MergedPlayer` TypeScript type. This is the foundation for every other v1.1 feature.

Do not build any UI until this data is confirmed in the schema.

### Phase 2: xMins UI (surface the new data)

**MINS-02**

Add `MinutesBadge` component. Show `mins_risk` badges in SquadView and GemTable. This is low-complexity UI that validates the pipeline data is correct before it gets used in decision logic.

### Phase 3: Projected points columns

**PROJ-01 / PROJ-02 / PROJ-03**

Add `proj_pts_1gw`, `proj_pts_3gw` columns to GemTable (behind a toggle or as additional sortable columns). Validates projections are plausible.

### Phase 4: Buy/Hold/Sell + Captaincy engines

**REC-01, CAP-01, CAP-02**

Build `recommend.ts` and `captaincy.ts` as pure TypeScript functions with no dependencies on the auth flow. Both consume `ScoredPlayer[]` which already includes the new projected fields from Phase 1.

CaptaincyPanel component.

### Phase 5: Explainability

**EXP-01, EXP-02**

`ExplainPanel` component. Risk flags. "Why this player" reasons. These are pure derivations from already-present fields — no new data, just reasoning layer.

Add `RecommendationBadge` + replacement shortlist to TransferPanel (REC-02).

### Phase 6: FPL login + exact sell price

**AUTH-01, AUTH-02**

`/api/my-team` Route Handler. `useMyTeam` hook. Login form in TransferPanel. `selling_price` integration into recommend.ts for exact budget calculations.

Build this last because it is the most complex (network, auth, security) and adds value only on top of an already-working recommendation engine. The existing approximate bank balance from `/api/squad/[teamId]` is sufficient to validate all other features.

### Build order summary

```
Phase 1: projections.py + xmins.py + schema extension  ← all others depend on this
Phase 2: MinutesBadge (MINS-02)                         ← validates Phase 1 data
Phase 3: Projected points columns in GemTable           ← validates projections
Phase 4: recommend.ts + captaincy.ts + CaptaincyPanel   ← uses Phase 1 data
Phase 5: ExplainPanel + risk flags + REC-02 shortlist   ← uses Phase 4 output
Phase 6: /api/my-team + selling_price + login UI        ← standalone, last
```

---

## Architectural Patterns

### Pattern 1: Pipeline-computed projections, TypeScript-consumed

**What:** Python computes projected points and xMins at pipeline time. TypeScript receives them as plain numeric fields. No TypeScript projection math.

**When to use:** Any metric that requires access to historical per-GW data (element-summary) or multi-table joins. Python handles this naturally; TypeScript should not replicate it.

**Trade-offs:** +Pipeline is authoritative. +TypeScript stays thin. −A pipeline bug affects all users until the next daily run. −Cannot recompute projections with custom assumptions client-side.

### Pattern 2: Pure-function decision engines in lib/

**What:** `recommend.ts` and `captaincy.ts` are pure functions: `(data) => output`. No side effects, no external calls, no component state.

**When to use:** Any analysis that combines pipeline data with runtime user data (squad, bank). This pattern makes the engines trivially testable with Vitest — pass in fixture data, assert on output.

**Example:**
```typescript
// In a test:
const recs = computeRecommendations(mockPicks, mockPlayers, 50)
expect(recs.find(r => r.player.id === 123)?.recommendation).toBe('SELL')
```

### Pattern 3: Optional auth enrichment

**What:** The squad view and transfer panel work without FPL login (using approximate bank balance from the public picks endpoint). FPL login enriches but does not gate the feature.

**When to use:** Any feature where the primary functionality can work with public data but benefits from authenticated data.

**Trade-offs:** +Lower friction (user doesn't need to log in to see recommendations). +Degrades gracefully. −Two code paths for sell price (exact vs approximate) — handle in recommend.ts by accepting `sellingPrices?: Map<number, number>` and falling back to `now_cost`.

### Pattern 4: Separate Zod schema for my-team picks

**What:** The `/api/my-team` picks include `selling_price` and `purchase_price` which the existing `SquadPickSchema` doesn't have. Extend the schema with `.optional()` fields rather than creating a new type. This keeps `SquadPick` as the single type throughout the codebase.

**Trade-offs:** +Single type for all squad pick contexts. +Callers that don't use selling_price don't break. −Optional fields require null-checks at use sites.

---

## Anti-Patterns

### Anti-Pattern 1: Computing projections in TypeScript

**What people do:** Port the projection formula to TypeScript to allow client-side recalculation.

**Why it's wrong:** Projection needs element-summary history (6 GW of per-match data per player). That data is 700 HTTP calls from the pipeline. The client cannot fetch it without hitting FPL rate limits. The pipeline already has all this data.

**Do this instead:** Compute in Python, ship in `merged_players.json`, consume in TypeScript as plain numeric fields.

### Anti-Pattern 2: Forwarding FPL session cookies to the browser

**What people do:** Return the `sessionid` cookie from `/api/my-team` to the client so subsequent requests can use it directly.

**Why it's wrong:** The session cookie provides access to the user's FPL account. Exposing it to JavaScript (even within the same app) is an XSS attack surface.

**Do this instead:** Use the session cookie in the Route Handler only (one request lifetime), then discard it. All authenticated FPL calls go through the Route Handler, never directly from the browser.

### Anti-Pattern 3: Separate fetches for element-summary in each pipeline module

**What people do:** DefCon calls element-summary. xMins also calls element-summary. They each fetch independently, doubling HTTP calls.

**Why it's wrong:** 700+ individual HTTP calls per pipeline run is already slow. Doubling to 1400+ adds 5-10 minutes to pipeline time and risks rate-limiting.

**Do this instead:** Fetch all element-summaries once in `run.py`, pass the cached result to both `defcon.py` and `xmins.py` as a parameter.

### Anti-Pattern 4: Blocking the Squad tab on FPL login

**What people do:** Gate the recommendation panel behind the login form.

**Why it's wrong:** The recommendation engine works without authentication (using approximate sell prices). Requiring login removes most of the value for a tool that works fine without it.

**Do this instead:** Show recommendations with approximate prices by default. Offer an optional "Login for exact prices" affordance that enriches the display but doesn't gate it.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| FPL bootstrap + fixtures | Route Handler proxy (existing) | Unchanged |
| FPL picks (public) | Route Handler proxy (existing `/api/squad/[teamId]`) | Unchanged |
| FPL my-team (authenticated) | New `/api/my-team` Route Handler (POST, server-side auth) | Session cookie never leaves server |
| FPL login endpoint | `users.premierleague.com/accounts/login/` via server-side fetch | POST with form-encoded credentials |
| Vercel Blob | Extended schema, same read/write pattern | No code change needed |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `pipeline/projections.py` → `merged_players.json` | New numeric fields in existing JSON | MergedPlayer TypeScript type must be extended |
| `pipeline/xmins.py` → `merged_players.json` | New fields: `xmins`, `start_prob`, `mins_risk` | `mins_risk` is a string enum — validate in TypeScript |
| `recommend.ts` ↔ `transfer-engine.ts` | Both consume `ScoredPlayer[]`, both are pure functions | Keep separate — recommendation by proj_pts, transfer suggestion by gem_delta |
| `/api/my-team` → `useMyTeam` hook | JSON: `{ picks: SquadPick[] }` — same shape as existing picks | Extend SquadPick with optional `selling_price` |
| `captaincy.ts` → `CaptaincyPanel` | `CaptaincyCandidate[]` — top 5 | CaptaincyPanel is read-only; no state beyond display |

---

## Scaling Considerations

This is a single-user personal tool. These considerations are provided for completeness, not as recommendations to act on.

| Scale | Architecture |
|-------|-------------|
| Single user (current) | Everything as described above — no changes needed |
| Multi-user | `/api/my-team` needs per-user session isolation; recommend.ts would need to be called per-user with their squad |
| Performance | Projections for 700 players computed once/day in Python is negligible; TypeScript engines are O(n) on ~700 players, runs in < 5ms |

---

## Sources

- FPL API authentication: [Fantasy Premier League API authentication guide](https://medium.com/@bram.vanherle1/fantasy-premier-league-api-authentication-guide-2f7aeb2382e4)
- FPL API endpoints reference: [FPL API Endpoints Cheat Sheet](https://cheatography.com/sertalpbilal/cheat-sheets/fpl-api-endpoints/)
- xPts model methodology: [Modelling xPts in FPL (Version 2.0)](https://medium.com/@marcusleadboot/modelling-xpts-in-fpl-version-2-0-e7d8cd738e75)
- xMins methodology: [FPL Review xMins documentation](https://docs.fplreview.com/the-model/projections/xmins/)
- my-team endpoint: [FPL API Endpoints: A Detailed Guide](https://medium.com/@frenzelts/fantasy-premier-league-api-endpoints-a-detailed-guide-acbd5598eb19)

---

*Architecture research for: FPL Analyst v1.1 Decision Engine*
*Researched: 2026-03-29*
