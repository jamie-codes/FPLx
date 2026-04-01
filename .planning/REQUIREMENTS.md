# Requirements — v1.2 Mobile

**Milestone:** v1.2 Mobile
**Goal:** Make the full FPL Analyst app usable on a phone — same URL, desktop layout unchanged.
**Last updated:** 2026-03-31

---

## Active Requirements

### Navigation

- [x] **MOB-NAV-01**: User sees a fixed bottom tab bar with 5 tabs (Gems, DefCon, Squad, Club Form, Values) on screens narrower than 768px, replacing the top horizontal tab strip
- [x] **MOB-NAV-02**: Desktop top tab strip is unchanged (≥768px); bottom tab bar is hidden on desktop
- [x] **MOB-NAV-03**: Bottom tab bar is inset above the iOS home indicator via `env(safe-area-inset-bottom)` so no tab is obscured

### Layout

- [x] **MOB-LAY-01**: All tab content renders in a single-column layout at 375px — no side-by-side panels break or overflow horizontally
- [x] **MOB-LAY-02**: Scrollable content has sufficient bottom padding so the last visible table row is not obscured by the fixed bottom nav bar

### Tables

- [x] **MOB-TBL-01**: GemTable shows only priority columns on mobile (Player, Position, Gem score, active Proj Pts column, Risk badge); remaining columns hidden
- [x] **MOB-TBL-02**: SquadView shows only priority columns on mobile (Player, Price, Risk badge, Rec verdict); remaining columns hidden
- [x] **MOB-TBL-03**: DefConTables show priority columns on mobile (Player, Team, Hit Rate, Avg DC/90); remaining columns hidden
- [x] **MOB-TBL-04**: ClubFormTable and ValueGemsTable show priority columns on mobile, reducing to key player identity + primary stat columns
- [x] **MOB-TBL-05**: Player column is horizontally sticky (locked to left edge) in GemTable and SquadView on mobile so the player name remains visible when scrolling right
- [x] **MOB-TBL-06**: User can tap a GemTable row on mobile to expand an inline key-value detail panel showing all columns hidden by MOB-TBL-01

### Touch & Interaction

- [x] **MOB-TOUCH-01**: All interactive elements (position filter pills, column sort headers, row expander arrows, tab bar items, buttons) have a minimum 44×44px tap target
- [x] **MOB-TOUCH-02**: All `<input>` elements use 16px font size on mobile to prevent iOS Safari from auto-zooming the viewport on focus
- [x] **MOB-TOUCH-03**: All buttons and tab items apply an `active:scale-95` CSS class to give immediate tap feedback

### Components

- [x] **MOB-COMP-01**: Transfer suggestion cards use a 2-row structured layout on mobile: row 1 = sell → buy player names with verdict/risk badges; row 2 = gem delta, cost, projected pts change
- [x] **MOB-COMP-02**: Login/token form inputs stack vertically on mobile with full-width inputs (the form uses a bearer token paste field, not an email field)
- [x] **MOB-COMP-03**: Captaincy panel renders as a 2-column card grid on mobile instead of a horizontal flex row

### Polish

- [ ] **MOB-POL-01**: GW toggle and position filter row is sticky below the top of the viewport on mobile so the user can filter GemTable without scrolling back to the top
- [ ] **MOB-POL-02**: A "back to top" button appears in GemTable on mobile after the user has scrolled past the first screen of rows

### Dark Mode

- [ ] **DARK-01**: User can toggle between light and dark mode via a button in the app header; preference persists across sessions (localStorage)
- [ ] **DARK-02**: Dark mode defaults to the system `prefers-color-scheme` preference on first visit
- [ ] **DARK-03**: All components render correctly in dark mode — no illegible text, sufficient contrast, no white flash on load

### Carry-Forward

- [ ] **DAT-01**: Verified automated daily refresh — GitHub Actions cron confirmed operational (deferred from v1.1)

---

## Future Requirements (deferred)

- Expandable row detail for SquadView and DefConTables (GemTable priority for v1.2)
- Progressive Web App manifest + home screen install prompt — v2+
- Native-style swipe-between-tabs gesture — conflicts with horizontal table scroll; v2+ only
- Column picker UI (user-selectable mobile columns) — powerful but over-engineered for v1.x defaults
- "Show top 50" filter pill for GemTable — useful but not blocking

---

## Out of Scope

- Separate `/mobile` route — same URL, responsive CSS only (per user decision)
- Card-per-player view replacing tables — destroys ranked comparison density; column priority approach used instead
- Swipe gestures between tabs — conflicts with horizontal table scroll
- Landscape-only mode enforcement — responsive approach works in portrait
- Offline mode / PWA cache — daily refresh is sufficient; no real-time requirement

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| MOB-NAV-01 | Phase 13 | Complete |
| MOB-NAV-02 | Phase 13 | Complete |
| MOB-NAV-03 | Phase 13 | Complete |
| MOB-LAY-01 | Phase 13 | Complete |
| MOB-LAY-02 | Phase 13 | Complete |
| MOB-TOUCH-01 | Phase 13 | Complete |
| MOB-TOUCH-02 | Phase 13 | Complete |
| MOB-TOUCH-03 | Phase 13 | Complete |
| MOB-TBL-01 | Phase 14 | Complete |
| MOB-TBL-05 (GemTable) | Phase 14 | Pending |
| MOB-TBL-06 | Phase 14 | Complete |
| MOB-TBL-02 | Phase 15 | Complete |
| MOB-TBL-03 | Phase 15 | Complete |
| MOB-TBL-04 | Phase 15 | Complete |
| MOB-TBL-05 (SquadView) | Phase 15 | Complete |
| MOB-COMP-01 | Phase 16 | Complete |
| MOB-COMP-02 | Phase 16 | Complete |
| MOB-COMP-03 | Phase 16 | Complete |
| MOB-POL-01 | Phase 17 | Pending |
| MOB-POL-02 | Phase 17 | Pending |
| DAT-01 | Phase 17 | Pending |
| DARK-01 | Phase 18 | Pending |
| DARK-02 | Phase 18 | Pending |
| DARK-03 | Phase 18 | Pending |
