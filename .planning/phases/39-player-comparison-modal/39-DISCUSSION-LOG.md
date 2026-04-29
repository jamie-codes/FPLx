# Phase 39: Player Comparison Modal - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-29
**Phase:** 39-player-comparison-modal
**Areas discussed:** Compare icon trigger, Second player selection, Modal layout, Section order & emphasis

---

## Compare Icon Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Hover-reveal on Player name cell | ⊞ icon on row hover next to player name. No extra column, no layout shift. | ✓ |
| Dedicated rightmost column | Always-visible compare column icon button on every row. | |
| Row-end action button | Fixed-width action area at right edge, always visible. | |

**User's choice:** Hover-reveal on the Player name cell

---

| Option | Description | Selected |
|--------|-------------|----------|
| Tap player name → mini action sheet | Tap player name reveals small popover with "Compare" option on mobile. | ✓ |
| Always-visible icon on mobile only | Show compare icon on small screens, hidden on desktop. | |
| Long-press on the row | Long-press reveals compare option. | |

**User's choice:** Tap the player name to reveal a mini action sheet on mobile

---

## Second Player Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Search field inside the comparison modal | Modal opens with Player A shown; search input lets user pick Player B in-place. | ✓ |
| Separate picker modal first | PlayerPickerModal opens first, then comparison modal opens. | |
| Dropdown selector inside modal | Combobox listing all players inside the modal. | |

**User's choice:** Search field inside the comparison modal

---

| Option | Description | Selected |
|--------|-------------|----------|
| All players, no position filter | Cross-position comparison supported for positional switch decisions. | ✓ |
| Same position by default with toggle | Default to position-match, toggle for all positions. | |
| Always same position only | Restrict to same position. | |

**User's choice:** All players, no position filter

---

## Modal Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Two columns side by side — A \| B | Player A left, Player B right, each section spans full modal width. | ✓ |
| Stacked sections, each section side-by-side | Each section is a card; A and B values sit side by side within it. | |

**User's choice:** Two columns side by side

---

| Option | Description | Selected |
|--------|-------------|----------|
| Single scrollable column — A then B stacked | Player A block, then Player B block, vertically stacked on mobile. | ✓ |
| Tabs: Player A / Player B | Switch between players with tabs at the top. | |
| Horizontal scroll — keep side-by-side | Maintain two-column layout with horizontal scroll on mobile. | |

**User's choice:** Single scrollable column (A then B) on mobile

---

## Section Order & Emphasis

| Option | Description | Selected |
|--------|-------------|----------|
| xPts → Gem scores → Fixtures → Signals | Decision-first: the projection number acts as the primary hook. | ✓ |
| Signals → xPts → Gem scores → Fixtures | Verdict-first: BUY/SELL/DIFF/TRAP conclusions at top. | |
| Gem scores → xPts → Fixtures → Signals | Composite-first: Gem score leads as the blended summary. | |

**User's choice:** xPts → Gem scores → Fixtures → Signals

---

| Option | Description | Selected |
|--------|-------------|----------|
| Raw numbers only — no winner highlight | Show data, let the manager decide. Avoids oversimplifying. | ✓ |
| Bold/highlight the higher value per row | Winning value in each row gets bold or highlight colour. | |
| Section-level badge: 'A wins xPts' | Aggregate judgement badge per section. | |

**User's choice:** Raw numbers only — no winner highlight

---

## Claude's Discretion

- Modal max width/height (likely wider than PlayerPickerModal — `max-w-2xl` or similar)
- Whether Player B column update animates (fade/slide) or updates instantly
- Exact heading structure and label alignment within each section

## Deferred Ideas

None — discussion stayed within phase scope.
