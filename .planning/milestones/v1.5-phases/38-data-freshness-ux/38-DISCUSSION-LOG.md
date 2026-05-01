# Phase 38: Data Freshness UX — Discussion Log

**Date:** 2026-04-29
**Duration:** ~5 min
**Areas covered:** 4/4

---

## Area 1: Real-Time Update Mechanism

**Question:** How should the "X ago" label stay current as time passes?

| Option | Description |
|--------|-------------|
| ✅ Client interval only | setInterval re-formats already-fetched timestamp — no extra API calls |
| ✗ TanStack refetch + interval | Re-poll API every N min AND tick client-side |
| ✗ You decide | Leave to planner |

**Selected:** Client interval only
**Notes:** Data doesn't change between pipeline runs — re-polling the API is unnecessary overhead.

---

## Area 2: Relative Time Format

**Question:** What relative time format should the label use?

| Option | Description |
|--------|-------------|
| ✅ "3 hours ago" full words | Tiers: "just now" / "X min ago" / "X hours ago" / "X days ago" |
| ✗ "3h ago" compact | Saves space but less readable |
| ✗ "Updated 3 hours ago" | More explicit but longer |

**Selected:** Full words ("3 hours ago")

---

## Area 3: Stale Threshold & Colour

**Question:** When should the text go amber?

| Option | Description |
|--------|-------------|
| ✅ Trust the API stale flag | Existing `stale: boolean` from /api/last-updated |
| ✗ Client age rule (>6h) | Ignore API flag, use timestamp age |
| ✗ Both: API OR age >12h | Belt-and-braces |

**Selected:** Trust the API stale flag
**Notes:** Pipeline knows its own staleness rules. Existing amber class `text-amber-600` is already correct.

---

## Area 4: Placement Beyond the Header

**Question:** Is the header placement sufficient for FRE-01?

| Option | Description |
|--------|-------------|
| ✅ Header only | Component already in header — always visible on every tab |
| ✗ Also in each section's sticky bar | More repetition, closer to data |
| ✗ Tooltip on hover only | Less visual noise but less discoverable |

**Selected:** Header only
**Notes:** FRE-01 satisfied by existing header placement.

---

## Deferred Ideas

None.

## Claude's Discretion Items

- Interval tick rate (30s suggested)
- useEffect cleanup pattern
