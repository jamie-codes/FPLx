# Phase 77: Pitch Visuals & Mobile Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-07
**Phase:** 077-pitch-visuals-mobile-polish
**Areas discussed:** Kit art source (OPT-02), Kit placement in PlayerCard, Captain card overflow fix (POL-01), Mobile audit scope (POL-03)

---

## Kit Art Source (OPT-02)

| Option | Description | Selected |
|--------|-------------|----------|
| FPL CDN `<img>` + CSS fallback | Fetch from FPL kit URL with onError handler swapping to TEAM_COLOURS div | ✓ |
| Pure CSS coloured placeholder | Skip CDN entirely, render TEAM_COLOURS div always | |

**User's choice:** FPL CDN `<img>` + CSS fallback

---

**Q: Plain `<img>` vs Next.js `<Image>`**

| Option | Description | Selected |
|--------|-------------|----------|
| Plain `<img>` with onError | Consistent with existing playerImageUrl/teamBadgeUrl usage; no config change | ✓ |
| Next.js `<Image>` | Auto-optimisation but requires next.config remotePatterns change | |

**User's choice:** Plain `<img>` with onError

**Notes:** Kit URL confirmed during discussion via curl: `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_{team_code}-66.png` returns 200 for Arsenal (3), Liverpool (14), Man City (43). TEAM_BADGE_CODE already maps team_short_name → team_code so no pipeline changes needed.

---

## Kit Placement in PlayerCard

| Option | Description | Selected |
|--------|-------------|----------|
| Small image left, text right | Flex-row in card body; ~24–28px kit image left, name/xPts/% right | ✓ |
| Image above the name | Kit image centred at top, name below; card grows to ~96–100px | |
| You decide | Leave to Claude | |

**User's choice:** Small image left, text right

---

**Q: Kit on pill row?**

| Option | Description | Selected |
|--------|-------------|----------|
| Main card body only | Kit in body flex-row; Set C/Set VC pills unchanged | ✓ |
| You decide | Let Claude decide | |

**User's choice:** Main card body only

---

## Captain Card Overflow Fix (POL-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Wrap rows | Add flex-wrap to sm:flex-row candidate rows; card expands vertically | ✓ |
| Internal scroll region | max-h ~220px with overflow-y-auto on candidates list | |
| You decide | Leave exact fix to Claude | |

**User's choice:** Wrap rows

---

**Q: Fix both Decision tab + Planner EOModeToggle?**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, fix both | Wrap EOModeToggle at small widths while touching captain overflow | ✓ |
| Decision tab only | Stay strict to POL-01 scope | |

**User's choice:** Yes, fix both — Decision tab candidate rows AND Planner EOModeToggle

---

## Mobile Audit Scope (POL-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Human UAT checkpoint | Visual review per tab; executor fixes known issues and flags others | |
| Playwright viewport assertions | Automated 430px tests asserting no horizontal scroll | ✓ |

**User's choice:** Playwright viewport assertions

---

**Q: What to assert?**

| Option | Description | Selected |
|--------|-------------|----------|
| No horizontal scroll | `document.body.scrollWidth <= window.innerWidth` on each major tab | ✓ |
| Specific element no-overflow | Per-element clientWidth assertions | |

**User's choice:** No horizontal scroll at document level

---

## Claude's Discretion

- Exact pixel size of kit image (targeting 24–28px wide)
- Whether to use React state or CSS to toggle `<img>` vs fallback `<div>`
- Playwright test file placement and grouping strategy

## Deferred Ideas

None — discussion stayed within phase scope.
