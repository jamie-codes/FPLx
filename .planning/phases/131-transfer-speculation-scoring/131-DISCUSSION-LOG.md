# Phase 131: Transfer Speculation Scoring - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-21
**Phase:** 131-transfer-speculation-scoring
**Areas discussed:** Source tier assignment, Decay visual treatment, Tier badge design, Tier filter interaction

---

## Source Tier Assignment

### Q1 — Where should source_tier be computed?

| Option | Description | Selected |
|--------|-------------|----------|
| Pipeline (Recommended) | Python computes source_tier and writes it into each article dict in transfer_news.json | ✓ |
| Frontend | Frontend derives tier from article.source at render time. No pipeline changes. | |

**User's choice:** Pipeline

---

### Q2 — Sky/BBC tier mapping and how Official is assigned

| Option | Description | Selected |
|--------|-------------|----------|
| Sky+BBC = Reliable; Official reserved (Recommended) | sky/bbc always map to Reliable. Official reserved for future direct club/FPL sources. | ✓ |
| Sky+BBC = Reliable; Official via keyword | Official assigned when article title contains 'official', 'announces', etc. | |
| sky = Reliable, bbc = Speculative | BBC treated as less authoritative than Sky Sports transfer centre. | |

**User's choice:** Sky+BBC = Reliable; Official reserved

---

### Q3 — Always present vs optional

| Option | Description | Selected |
|--------|-------------|----------|
| Always present, fallback Reliable (Recommended) | source_tier always written; sky/bbc articles always get 'Reliable'. | ✓ |
| Optional / null when unassigned | source_tier omitted or null when tier isn't set. | |

**User's choice:** Always present, fallback Reliable

---

### Q4 — Tier label terminology

| Option | Description | Selected |
|--------|-------------|----------|
| Speculative (Recommended) | Matches REQUIREMENTS.md exactly (SPEC-01, SPEC-03). | ✓ |
| Tabloid | Matches ROADMAP.md wording. More specific but odd on a Sky article. | |

**User's choice:** Speculative

---

## Decay Visual Treatment

### Q1 — Primary visual treatment

| Option | Description | Selected |
|--------|-------------|----------|
| Opacity fade only (Recommended) | Card renders at ~40-50% opacity. Clean, minimal. | ✓ |
| Age label added | Normal opacity but explicit label appears (e.g. 'Stale (24 days)'). | |
| Both — opacity + label | Card fades AND shows an age label. | |

**User's choice:** Opacity fade only

---

### Q2 — Binary vs gradual decay

| Option | Description | Selected |
|--------|-------------|----------|
| Binary threshold (Recommended) | Full opacity <21 days, then fixed reduced opacity ≥21 days. | ✓ |
| Gradual decay | Opacity decreases linearly from 100% at day 0 to ~40% at day 21+. | |

**User's choice:** Binary threshold

---

### Q3 — Opacity value

| Option | Description | Selected |
|--------|-------------|----------|
| opacity-40 (Recommended) | Noticeably faded but readable. | ✓ |
| opacity-50 | Slightly less dramatic. | |
| opacity-60 | Subtle — may not be visually distinct enough. | |

**User's choice:** opacity-40

---

### Q4 — Which timestamp for age calculation

| Option | Description | Selected |
|--------|-------------|----------|
| published ?? scraped_at (Recommended) | Use publish date when available; fallback to scraped_at. Mirrors existing sort logic. | ✓ |
| scraped_at always | Always use pipeline scrape time. Simpler but ignores real publication age. | |

**User's choice:** published ?? scraped_at

---

## Tier Badge Design

### Q1 — Badge position on the card

| Option | Description | Selected |
|--------|-------------|----------|
| Alongside source badge (Recommended) | Tier badge sits next to existing [SKY]/[BBC] badge in top-right cluster. Both visible. | ✓ |
| Replaces source badge | Source badge removed; tier takes its slot. Simpler but loses source info. | |
| Left side of card | Colored left border or left-aligned pill. Source badge stays top-right. | |

**User's choice:** Alongside source badge

---

### Q2 — Color scheme

| Option | Description | Selected |
|--------|-------------|----------|
| Teal/Blue/Zinc (Recommended) | Official=teal, Reliable=blue, Speculative=zinc. Uses existing badge CSS pattern. | ✓ |
| Green/Amber/Red | Traffic-light metaphor. Red for Speculative may feel alarming on Sky articles. | |
| Outlined only, no fill | Border color indicates tier. Lighter visual weight. | |

**User's choice:** Teal/Blue/Zinc

---

### Q3 — Badge label text

| Option | Description | Selected |
|--------|-------------|----------|
| Full word (Recommended) | 'Official', 'Reliable', 'Speculative' — already short enough. | ✓ |
| Abbreviated | 'OFF', 'REL', 'SPEC' — saves space but less readable. | |

**User's choice:** Full word

---

## Tier Filter Interaction

### Q1 — Combination logic with classification filter

| Option | Description | Selected |
|--------|-------------|----------|
| AND logic — both apply (Recommended) | Articles must match selected classification AND selected tier. | ✓ |
| Independent — last clicked wins | Only one filter active at a time. Clicking tier clears classification. | |
| Separate rows | Tier pills in a second row beneath classification pills. Both can be active (AND logic). | |

**User's choice:** AND logic

---

### Q2 — Tier pill position in the row

| Option | Description | Selected |
|--------|-------------|----------|
| After existing pills, same row (Recommended) | Row: All/Confirmed/Rumour/Injury/Rotation ‖ All/Official/Reliable/Speculative. Visual divider separates groups. | ✓ |
| Before existing pills, same row | Tier group comes first, then classification. | |
| Separate second row | Tier gets its own row below classification pills. | |

**User's choice:** After existing pills, same row

---

### Q3 — All-tiers reset pill

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — default 'All tiers' (Recommended) | 'All' tier pill at start of tier group; default = all tiers shown. Mirrors classification 'All' pill. | ✓ |
| No — tier pills are toggles | No 'All' pill; none selected = all tiers shown. Saves one pill but breaks visual pattern. | |

**User's choice:** Yes — default 'All tiers'

---

## Claude's Discretion

- Exact Tailwind class for the visual divider between classification and tier pill groups
- Whether to extract the 21-day stale check into a module-level helper or inline it
- `SourceTier` type placement (local or in `src/lib/types.ts`)
- Whether `activeTierFilter` state is typed as `'all' | SourceTier`
- Whether to add a `confidence_score` numeric field to the pipeline output

## Deferred Ideas

None — discussion stayed within phase scope.
