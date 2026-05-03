# Technology Stack — v1.9 Competitive Intelligence

**Project:** FPL Analyst — v1.9 milestone (subsequent milestone, additive only)
**Researched:** 2026-05-03
**Overall confidence:** HIGH

---

## Headline Recommendation

**Three targeted additions to the existing stack:**

1. **`p-limit` ^6.x** — concurrency throttle for the parallel rival-squad fetches in ML-01 (prevents hammering the FPL API with N simultaneous requests)
2. **`ai` + `@ai-sdk/anthropic`** — Vercel AI SDK v6 for TREE-01's structured multi-branch transfer-route generation (server-side only, zero client bundle impact)
3. **Zero additional UI libraries** — the Transfer Route Tree (TREE-01) renders as a collapsible card tree in plain Tailwind/React, not a D3 chart

MTP-01 and EO-01 need **no new packages** — they are pure TypeScript over existing `MergedPlayer`, `FTState`, and `PlanStep` shapes with the existing FPL proxy.

---

## Recommended Stack — Per Feature

### MTP-01: Manual Transfer Planner

**New packages:** None.

**Approach:** A new `manual-transfer-engine.ts` alongside `planning-engine.ts`. The existing engine already carries all the primitives needed:

| Existing primitive | What MTP-01 reuses it for |
|-------------------|---------------------------|
| `FTState` / `computeNextFTState()` in `free-transfer-engine.ts` | FT bank simulation per GW step |
| `computeHitCost()` in `free-transfer-engine.ts` | -4pt per hit, hit counting |
| `bankBalance` + `sellPrices` already on `generatePlan()` | Starting bank, sell-price-aware budget |
| `PlanStep.hitCost` + `GWStep.chip` in `types.ts` | Per-step financial state shape already exists |
| `MyTeamPick.selling_price` from `squad-adapter.ts` | Exact sell price for financial simulation |
| `useImmer` (already installed) | Nested mutable state for user-edited steps |

The new engine differs from `generatePlan()` in one way: **the user provides the transfer pair(s) per GW instead of the engine choosing them**. The engine then simulates bank/FT state forward from those choices. Break-even weeks formula is `ceil(4 / xPtsGainPerGw)` — identical to `TransferSuggestion.breakEvenGws` logic already in `suggest-transfers.ts`.

**Why not reuse `generatePlan()` directly:** `generatePlan()` is greedy-auto (it picks transfers). MTP-01 is user-designed — the engine should only simulate the user's choices, not override them. Separate function, shared primitives.

---

### ML-01: Mini-League Rival Tracker

**New package: `p-limit` ^6.x (server-side only)**

The core pattern for rival squad fetching is already proven: `src/app/api/squad/[teamId]/route.ts` calls `entry/{id}/event/{gw}/picks/` through the server-side proxy. ML-01 extends this to N rivals in parallel.

**Why p-limit is needed:** A mini-league can have 10–50 entries. `Promise.all(rivals.map(fetchPicks))` fires all requests simultaneously. FPL's API has no published rate limits but community experience shows aggressive concurrent hitting causes 429s and temporary bans. Throttling to 3 concurrent requests (configurable) eliminates this risk.

| Property | Detail |
|----------|--------|
| Package | `p-limit` |
| Version | ^6.1.0 (current: 6.x; v7.x requires Node 20, which is fine for Vercel but not worth the major jump yet — confirm project's Node version) |
| Runtime | Server-side Next.js Route Handler only |
| Bundle impact | Zero — never imported by client components |

**Note on p-limit version:** v7.x requires Node.js 20+. v6.x requires Node.js 16+. Both are ESM-only. Verify with `node -v` in the project. If Node 20+ is confirmed (likely on Vercel), v7.x is fine. The recommendation is ^6.1.0 as the safe floor; upgrade to ^7.x if Node version permits.

**FPL API endpoints needed (all public, no auth required for rival data):**

| Endpoint | Purpose | Auth |
|----------|---------|------|
| `leagues-classic/{leagueId}/standings/` | Fetch rival entry IDs, names, ranks, event totals | Public |
| `entry/{entryId}/event/{gw}/picks/` | Per-rival squad picks (element[], multiplier for captain=2) | Public |
| `entry/{entryId}/history/` | Chips used this season (chips[].chip_name, chips[].event) | Public |

**Key API fields verified:**
- `standings.results[].entry` — the rival's team ID
- `standings.results[].rank`, `last_rank`, `total`, `event_total` — rank gap computation
- `picks[].element`, `picks[].multiplier` (1=playing, 0=bench, 2=captain, 3=TC), `picks[].position`
- `active_chip` — chip played this GW (null if none; "bboost", "freehit", "wildcard", "3xc")
- `history.chips[].chip_name`, `.event` — which chips remain available

**New Route Handler:** `src/app/api/mini-league/[leagueId]/route.ts` — fetches standings then fans out to per-rival picks with p-limit concurrency control. Returns a shaped `RivalIntel[]` array. The existing `/api/fpl/[...proxy]` route could technically proxy these calls, but a dedicated route is cleaner: it orchestrates multi-step fetching, applies Zod validation, and shapes the response into the `RivalIntel` type rather than raw FPL JSON.

**EO% calculation for ML-01 differential logic:**
- Global ownership: `selected_by_percent` field already on `MergedPlayer` (string, parse to float)
- Mini-league EO: computed client-side from rival squad arrays — `(ownCount + captainCount + tcCount) / leagueSize` per player
- No new library — pure arithmetic over the fetched picks arrays

---

### EO-01: Effective Ownership & Rank Protection

**New packages:** None.

**Approach:** Pure TypeScript engine `src/lib/eo-engine.ts`. All inputs are already present:

| Input | Source |
|-------|--------|
| `selected_by_percent` per player | `MergedPlayer` (existing field) |
| `xPts_1gw` per player | `MergedPlayer` (existing field) |
| Captain multiplier | User's own picks via `useMyTeam` (existing hook) |
| Mode toggle state | New UI state only — no data requirement |

**EO-adjusted captain EV formula** (standard FPL community formula, MEDIUM confidence):
```
eo_adjusted_ev = xPts_1gw * (1 + eo_pct/100)
```
Where `eo_pct` is effective ownership % = `owns% + captain%` (captain gets double points, so captaining someone you own by 50% of rivals means you gain vs the field when they score).

**Mode toggle (`Max xPts / Protect Rank / Chase Rank / Differential Aggressive`):** A pure enum state in the new `EOTab` component. Each mode reorders/filters the existing `suggestTransfers()` output by a different objective function. No new data sources — different weights on existing `xPtsGain`, `differential_flag`, and EO% fields.

---

### TREE-01: Transfer Route Tree

**New packages: `ai` ^6.x + `@ai-sdk/anthropic` (server-side only)**

The branching tree structure (2–3 paths × 2–3 GWs) is a constrained generation problem: given the user's squad, budget, FT state, and player pool with xPts values, generate N distinct transfer sequences. Each branch needs a specific shape (players in/out per GW, cumulative FT state, hit cost, xPts per path).

**Why an LLM rather than pure TypeScript enumeration:**
- `generatePlan()` is a greedy single-path engine. Generating 2–3 *distinct* paths requires either (a) a search tree with pruning or (b) prompting an LLM with structured output to produce branching alternatives.
- A search tree for 3 paths × 3 GWs × 2 transfers per GW = 27,000 candidate evaluations — feasible but complex to implement with good diversity (greedy enumeration tends to produce near-identical paths).
- The LLM approach with `generateObject` + Zod schema produces human-readable branch rationale ("Route A: Double up on Man City assets for DGW33") alongside the structured xPts data, which is the "AI-generated" requirement in TREE-01.
- The LLM does not *score* xPts — it selects players and structures branches. xPts values are passed in as context and the LLM's output is validated/re-scored server-side with the existing `xPts_1gw` fields from `MergedPlayer`.

**Vercel AI SDK v6 — verified current (Dec 2025 release):**

| Package | Version | Purpose |
|---------|---------|---------|
| `ai` | ^6.x (current: 6.0.173) | Core `generateObject` / `generateText` with structured output |
| `@ai-sdk/anthropic` | ^1.x (latest) | Anthropic Claude provider for the AI SDK |

**Server-side only:** The LLM call lives in a new Route Handler `src/app/api/transfer-tree/route.ts`. The client fires one `fetch()` and receives the scored tree JSON. Zero LLM code in the client bundle.

**Output schema (Zod):** The server validates the LLM output against a `TransferTreeSchema` before returning it to the client. This means the UI always receives correctly-shaped data, and the LLM has a hard contract to conform to.

**Model recommendation:** `claude-sonnet-4-5` — sufficient for structured JSON generation, fast, cost-effective for a personal tool. Claude Opus is unnecessary for this scope (the task is constrained generation, not reasoning).

**Environment variable needed:** `ANTHROPIC_API_KEY` in `.env.local` and Vercel project settings.

**Chip interaction:** The TREE-01 prompt includes current chip availability (from `entry/{id}/history/` — already fetched by the existing `useChipHistory` hook) as context. The LLM can then annotate branches with chip usage notes. Chip legality is validated server-side, not trusted from LLM output.

---

## Core Technologies — No Changes

| Technology | Version | Status | v1.9 use |
|------------|---------|--------|----------|
| Next.js | 16.2.1 | Unchanged | New Route Handlers for mini-league and transfer-tree |
| React | 19.2.4 | Unchanged | New components: MTPTab, MLTab, EOTab, TransferTreePanel |
| TypeScript | ^5 | Unchanged | New engine files |
| TanStack Query | ^5.95.2 | Unchanged | New hooks: `useMiniLeague`, `useTransferTree` |
| TanStack Table | ^8.21.3 | Unchanged | Rival squad table in ML-01 |
| Tailwind CSS | ^4 | Unchanged | Tree node cards, mode toggle pills |
| Vitest | ^4.1.2 | Unchanged | TDD for new engines |
| immer / use-immer | ^11.1.4 / ^0.11.0 | Unchanged | MTP-01 step mutation |
| Zod | ^4.3.6 | Unchanged | Rival picks schema, TransferTreeSchema for AI output |
| Vercel Blob | ^2.3.1 | Unchanged | No new blobs needed for v1.9 |
| Python pipeline | requests + pandas + stdlib | Unchanged | No pipeline changes for v1.9 |

---

## New Supporting Libraries

| Library | Version | Purpose | Scope | Install |
|---------|---------|---------|-------|---------|
| `p-limit` | ^6.1.0 | Concurrency throttle for N rival-squad fetches | Server-side only | `npm install p-limit` |
| `ai` | ^6.x | Vercel AI SDK — `generateObject` for TREE-01 structured output | Server-side only | `npm install ai` |
| `@ai-sdk/anthropic` | ^1.x | Anthropic Claude provider for the AI SDK | Server-side only | `npm install @ai-sdk/anthropic` |

**Install command:**
```bash
npm install p-limit ai @ai-sdk/anthropic
```

**Bundle impact:** All three packages are used only in Next.js Route Handlers (`src/app/api/*/route.ts`). They are never imported by client components and do not affect the client JavaScript bundle. Next.js tree-shakes server-only imports automatically in the App Router.

---

## Alternatives Considered

| Capability | Recommended | Alternative | Why Not |
|------------|-------------|-------------|---------|
| Rival fetch throttling | `p-limit` ^6 | `p-queue` | `p-queue` is heavier (135 code snippets vs 3) and queue management is not needed — we just need a concurrency cap, which is exactly `p-limit`'s purpose |
| Rival fetch throttling | `p-limit` ^6 | Manual `Promise.all` batching | Requires manual chunking logic; `p-limit` is 3 lines and purpose-built |
| TREE-01 branching | Vercel AI SDK (`generateObject`) | Pure TS search tree | A search tree is feasible but produces low-diversity branches (greedy paths converge); LLM produces human-readable branch rationale that satisfies the "AI-generated" spec requirement |
| TREE-01 branching | Vercel AI SDK (`generateObject`) | Direct `@anthropic-ai/sdk` | Vercel AI SDK provides unified structured-output interface with Zod schema validation; raw Anthropic SDK requires manual JSON parsing and retry logic |
| TREE-01 branching | Vercel AI SDK (`generateObject`) | OpenAI | Claude is already familiar from project context; Anthropic SDK is well-maintained; no reason to add a second AI provider |
| Transfer tree visualization | Plain Tailwind collapsible cards | `react-d3-tree` (88KB) | TREE-01 has at most 3 branches × 3 GWs = 9 nodes. A full D3 tree library for 9 nodes is extreme overkill. CSS flexbox cards with a branch-line divider is 20 lines of Tailwind. |
| Transfer tree visualization | Plain Tailwind collapsible cards | `d3-hierarchy` | Same reason — 9 nodes does not justify importing D3 |
| EO calculation | Pure TypeScript | Python pipeline field | EO% changes every time the user switches rivals or their own squad. It must be client-side reactive, not a pipeline output. |
| FPL API call pattern (ML-01) | Dedicated `/api/mini-league/` route | Extend `/api/fpl/[...proxy]` | The proxy is a dumb passthrough. ML-01 needs orchestration: fetch standings, fan out to N picks calls with throttling, validate each, compute differential flags, and return a shaped `RivalIntel[]`. That logic belongs in a dedicated route, not in the generic proxy. |

---

## What NOT to Add

- **No D3 or charting library** — the transfer tree is a small card list, not a network graph. Adding `react-d3-tree` (88KB) or `recharts` for 9 nodes is indefensible.
- **No database or caching layer** — rival squad data is fetched fresh per session (like the existing squad view). Vercel Blob is not used for rival data because it changes each GW and is user-specific.
- **No `@ai-sdk/react` package** — the AI SDK's React hooks (`useChat`, `useObject`) are for streaming UI patterns. TREE-01 is a one-shot `generateObject` call from a server route handler. The client uses a plain TanStack Query `useQuery` hook over the `/api/transfer-tree` route.
- **No scikit-learn or ML libraries** — EO% is arithmetic, not machine learning.
- **No additional Python pipeline modules** — all four v1.9 features are either client-side engines or server-route-handler orchestrations. The pipeline does not need to change.
- **No WebSocket / real-time layer** — out of scope per PROJECT.md constraint ("Once-daily sufficient; no real-time requirements").
- **No auth changes** — ML-01 rival picks use the public `entry/{id}/event/{gw}/picks/` endpoint (no session cookie needed). The user's own team ID is already stored in client state.

---

## New Environment Variables

| Variable | Purpose | Where |
|----------|---------|-------|
| `ANTHROPIC_API_KEY` | Authenticates the AI SDK Anthropic provider for TREE-01 | `.env.local` + Vercel project settings |

No other environment variables are needed. `BLOB_READ_WRITE_TOKEN` already exists for Vercel Blob.

---

## New Files (orientating the roadmap)

| File | Feature | Type |
|------|---------|------|
| `src/lib/manual-transfer-engine.ts` | MTP-01 | New pure TS engine |
| `src/lib/eo-engine.ts` | EO-01 | New pure TS engine |
| `src/lib/hooks/useMiniLeague.ts` | ML-01 | New TanStack Query hook |
| `src/lib/hooks/useTransferTree.ts` | TREE-01 | New TanStack Query hook |
| `src/app/api/mini-league/[leagueId]/route.ts` | ML-01 | New Route Handler (uses p-limit) |
| `src/app/api/transfer-tree/route.ts` | TREE-01 | New Route Handler (uses ai + @ai-sdk/anthropic) |

---

## Verification Status

| Claim | Source | Confidence |
|-------|--------|------------|
| `leagues-classic/{id}/standings/` returns `entry`, `rank`, `last_rank`, `total`, `event_total` per rival | FPL API live fetch via WebFetch + multiple API docs | HIGH |
| `entry/{id}/event/{gw}/picks/` returns `picks[].multiplier` (2=captain, 3=TC), `active_chip` | Medium article + FPL API cheat sheet + community docs | HIGH |
| `entry/{id}/history/` returns `chips[].chip_name`, `.event` | Oliver Looney FPL API guide + community sources | MEDIUM — field name unverified against live 2025/26 API; validate in Phase research |
| `p-limit` v6.x is ESM-only, Node 16+ | GitHub releases page (verified 2025-02-03 latest v7.3.0; v6.x is the stable prior major) | HIGH |
| `p-limit` v7.x requires Node 20+ | GitHub releases page | HIGH |
| Vercel AI SDK v6.0.173 is current; `generateObject` uses Zod schema to produce typed structured output | ai-sdk.dev docs + Vercel blog (Dec 2025) | HIGH |
| AI SDK + Next.js App Router server route handler pattern is supported | ai-sdk.dev/docs/getting-started/nextjs-app-router | HIGH |
| `react-d3-tree` v3.6.6 bundle is ~89KB; unsuitable for a 9-node tree | bundlephobia + github.com/bkrem/react-d3-tree | HIGH |
| EO formula: `(own% + captain%)` producing effective ownership | allaboutfpl.com + fantasyfootballscout.co.uk + fplhints.com | MEDIUM — formula is community-standard but FPL does not publish it officially |

---

## Sources

- [FPL APIs Explained — Oliver Looney](https://www.oliverlooney.com/blogs/FPL-APIs-Explained)
- [Fantasy Premier League API Endpoints: A Detailed Guide — Frenzel Timothy, Medium](https://medium.com/@frenzelts/fantasy-premier-league-api-endpoints-a-detailed-guide-acbd5598eb19)
- [FPL API Endpoints Cheat Sheet — Cheatography](https://cheatography.com/sertalpbilal/cheat-sheets/fpl-api-endpoints/history/279325)
- [What is Effective Ownership in FPL? — FPL Hints](https://www.fplhints.com/post/what-is-effective-ownership-in-fpl)
- [How to use effective ownership to make differential FPL decisions — Fantasy Football Scout](https://www.fantasyfootballscout.co.uk/2021/03/07/how-to-use-effective-ownership-to-make-differential-fpl-decisions)
- [AI SDK Introduction — ai-sdk.dev](https://ai-sdk.dev/docs/introduction)
- [AI SDK Getting Started: Next.js App Router — ai-sdk.dev](https://ai-sdk.dev/docs/getting-started/nextjs-app-router)
- [AI SDK Generating Structured Data — ai-sdk.dev](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)
- [AI SDK 6 release — Vercel blog](https://vercel.com/blog/ai-sdk-6)
- [p-limit releases — GitHub](https://github.com/sindresorhus/p-limit/releases)
- [react-d3-tree — GitHub](https://github.com/bkrem/react-d3-tree)
- [Fetch Concurrency Control with p-limit — DEV Community](https://dev.to/recca0120/fetch-concurrency-control-limit-simultaneous-requests-with-p-limit-2p5h)
