# Requirements: FPL Analyst

Requirements extracted from PROJECT.md Active requirements section.
IDs assigned for phase traceability.

---

## Team Input & Squad View

| ID | Requirement | Status |
|----|-------------|--------|
| TIS-01 | Enter FPL Team ID to pull current squad (public API, no login needed) | Pending |
| TIS-02 | Optional FPL login (email/password) to fetch bank balance and remaining transfers | Pending |
| TIS-03 | Display squad split by position (GK / DEF / MID / FWD) with price, ownership %, minutes played, and injury/flag status | Pending |

## Upcoming Gem Rating

| ID | Requirement | Status |
|----|-------------|--------|
| GEM-01 | Score each player across multiple dimensions and show an "Upcoming Gem" composite rating | Complete |
| GEM-02 | Displayed as a sortable table, filterable by position (GK / DEF / MID / FWD) | Complete |
| GEM-03 | Dimensions feeding the score: fixture difficulty, form, xG/xA, ownership %, minutes reliability, set piece role, DefCon likelihood | Complete |

## Form & Fixture Analysis

| ID | Requirement | Status |
|----|-------------|--------|
| FFA-01 | Players about to go on a high-scoring run: scored >2 pts last game(s) AND have favourable upcoming fixtures AND show high xG or xA recently | Complete |
| FFA-02 | Players currently on a high-scoring run: highlight whether upcoming fixtures are easy/hard and home/away | Complete |
| FFA-03 | Club form table: wins, goals scored, goals conceded over last N weeks | Pending |
| FFA-04 | Most in-form players: highest points scorer over last N games | Complete |

## DefCon Analysis

| ID | Requirement | Status |
|----|-------------|--------|
| DEF-01 | Per-position thresholds: DEF needs 10 defensive contributions, MID/FWD need 12 | Pending |
| DEF-02 | Per player: DefCon hit rate (% of games they achieved +2), average defensive contributions per 90, distance to threshold | Pending |
| DEF-03 | Hypothesis analysis: do players get more DefCon in tough vs easy fixtures? | Pending |
| DEF-04 | Separate ranking tables per position — no combined table (thresholds differ) | Pending |

## Value & Ownership

| ID | Requirement | Status |
|----|-------------|--------|
| VAL-01 | Cheap gems: relatively cheap players getting disproportionate points | Pending |
| VAL-02 | Low-owned but high-scoring: players with ownership < X% but strong recent returns | Pending |
| VAL-03 | Show current price and price change trend for all analysed players | Pending |

## Player Profile Signals

| ID | Requirement | Status |
|----|-------------|--------|
| PPS-01 | Penalty taker, set piece taker, corner taker flags | Complete |
| PPS-02 | Minutes reliability: average minutes per game, consistency indicator | Complete |
| PPS-03 | xG per 90 and xA per 90 (from Understat) | Complete |
| PPS-04 | Injury / availability status from FPL flags | Complete |

## Transfer Suggestions

| ID | Requirement | Status |
|----|-------------|--------|
| TRF-01 | Suggest who to sell or sub out based on recent performance and upcoming fixtures | Pending |
| TRF-02 | For each sell candidate: show up to 3 replacement options ranked by Upcoming Gem rating | Pending |
| TRF-03 | Enforce position rules (MID → MID, FWD → FWD, etc.) | Pending |
| TRF-04 | Factor in bank balance + sale value: only suggest affordable transfers | Pending |
| TRF-05 | Suggest multi-transfer combinations if user has available free transfers | Pending |
| TRF-06 | If no strong transfers available, recommend saving the transfer | Pending |
| TRF-07 | Show how many free transfers the user has (from login or user input fallback) | Pending |

## Data & Refresh

| ID | Requirement | Status |
|----|-------------|--------|
| DAT-01 | Data refreshed once daily (FPL API + Understat) | Pending |
| DAT-02 | Show "last updated" timestamp on all data views | Pending |

## UI / UX

| ID | Requirement | Status |
|----|-------------|--------|
| UIX-01 | Clear, data-forward layout using tabs or cards per section | Complete |
| UIX-02 | Scannable tables with sort/filter by position | Complete |
| UIX-03 | Visual indicators for fixture difficulty (colour-coded easy/hard) | Pending |
| UIX-04 | Home/away clearly distinguished | Complete |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DAT-01 | Phase 1 | Pending |
| DAT-02 | Phase 6 | Pending |
| PPS-01 | Phase 1 | Complete |
| PPS-02 | Phase 1 | Complete |
| PPS-03 | Phase 1 | Complete |
| PPS-04 | Phase 1 | Complete |
| GEM-03 | Phase 2 | Complete |
| FFA-01 | Phase 2 | Complete |
| FFA-02 | Phase 2 | Complete |
| FFA-04 | Phase 2 | Complete |
| UIX-03 | Phase 2 | Pending |
| UIX-04 | Phase 2 | Complete |
| GEM-01 | Phase 3 | Complete |
| GEM-02 | Phase 3 | Complete |
| DEF-01 | Phase 4 | Pending |
| DEF-02 | Phase 4 | Pending |
| DEF-03 | Phase 4 | Pending |
| DEF-04 | Phase 4 | Pending |
| UIX-01 | Phase 3 | Complete |
| UIX-02 | Phase 3 | Complete |
| TIS-01 | Phase 5 | Pending |
| TIS-02 | Phase 5 | Pending |
| TIS-03 | Phase 5 | Pending |
| TRF-01 | Phase 5 | Pending |
| TRF-02 | Phase 5 | Pending |
| TRF-03 | Phase 5 | Pending |
| TRF-04 | Phase 5 | Pending |
| TRF-05 | Phase 5 | Pending |
| TRF-06 | Phase 5 | Pending |
| TRF-07 | Phase 5 | Pending |
| FFA-03 | Phase 6 | Pending |
| VAL-01 | Phase 6 | Pending |
| VAL-02 | Phase 6 | Pending |
| VAL-03 | Phase 6 | Pending |

---

## Coverage Note

**TIS-02** (optional FPL login) is mapped to Phase 5. Per research decisions, full session-cookie auth is a v1.x enhancement — Phase 5 implements unauthenticated mode (Team ID only) with approximate budget labels. TIS-02 is included as a Phase 5 requirement because the squad view and transfer panel must be designed to accommodate it, even if the full login flow ships as a follow-on.

**DEF-03** (DefCon hypothesis analysis: tough vs easy fixture correlation) is mapped to Phase 4 as a v1 requirement per PROJECT.md. Research notes it may need a full season of data to be meaningful — if data is insufficient at Phase 4 time, this criterion will surface a "insufficient data" message rather than a full analysis.
