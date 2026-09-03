# LineupTab pitch redesign — implementation brief

**This file is the ground truth.** Any earlier `LINEUP-PITCH-SPEC.md` is a superseded draft —
delete it. It also referenced a companion `handoff/PitchSurface.tsx`, which does not exist and
was never written; there are no drop-in components to import. Build from this brief and the
visual reference. Where the two ever disagreed, this file wins.

Target file: `src/components/squad/LineupTab.tsx`. No engine changes except the optional
`optimiseLineup` argument in §8.
Visual reference: `Lineup Pitch.dc.html` (standalone prototype in this project — open it in a
browser, toggle Light/Dark and the formation pills).

## What changes

Today the pitch is a `bg-surface-2/40` bordered box with rows of bordered cards, each card
carrying `Set C` / `Set VC` pills. That reads as a table, not a pitch. Replace the pitch
container and `PlayerCard` presentation. Keep every behaviour: two-tap swap state machine,
`isLegalSwap` / `applySwap`, captain/VC override, Reset, BGW banners, all `data-testid`s.

## 1. Pitch surface

Replace the `data-testid="pitch"` div with a layered turf panel. All layers are absolutely
positioned siblings inside a `relative rounded-2xl overflow-hidden` wrapper; rows sit on top
in a `relative` div.

Layers, bottom to top:

1. Turf base — `bg-[#2f7a34]` light, `dark:bg-[#0f2a12]`.
2. Mown stripes — 11 horizontal bands:
   `bg-[repeating-linear-gradient(180deg,rgba(255,255,255,0.06)_0_9.09%,rgba(255,255,255,0.13)_9.09%_18.18%)]`
   and dark variant at `0.035` / `0.075`.
3. Depth — `bg-[radial-gradient(120%_80%_at_50%_0%,rgba(255,255,255,0.10),transparent_55%),radial-gradient(100%_70%_at_50%_100%,rgba(0,0,0,0.28),transparent_60%)]`.
4. Chalk markings, `aria-hidden`, border colour `rgba(255,255,255,0.55)` light /
   `rgba(255,255,255,0.22)` dark, `border-2`:
   - touchline: `absolute inset-[10px] rounded`
   - penalty box: `absolute top-[10px] left-1/2 -translate-x-1/2 w-[44%] h-[74px] border-t-0 rounded-b`
   - six-yard box: same, `w-[20%] h-[34px]`
   - centre circle: `absolute -bottom-[88px] left-1/2 -translate-x-1/2 w-[200px] h-[200px] rounded-full`
   - halfway line: `absolute left-[10px] right-[10px] bottom-[10px] border-t-2`
5. Wrapper shadow: `shadow-[0_18px_40px_-24px_rgba(0,0,0,0.55)]`, border `border-[#256428] dark:border-[#1c2a1a]`.

Rows container: `relative flex flex-col gap-1.5 px-2.5 pt-6 pb-7`.
Keep `onClick={handleBackgroundTap}` on the outer wrapper.

## 2. PitchRow

Drop the `GK / DEF / MID / FWD` text label column — the pitch shape communicates it. Keep the
`data-testid="pitch-row-*"` on the row div.

```
<div data-testid={`pitch-row-${position.toLowerCase()}`}
     className="flex justify-center items-start gap-3 px-2">
```

Cards inside: `flex-1 min-w-0 max-w-[100px]`, with the tile capped at 72px (§3).

Mobile math: five defenders in one row at 360px need `5 × 62 + 4 × 12 gap = 358px` inside a
`px-2` row, so the tile's floor is 62px. If you swap the `max-w` cap for a fluid width, use
`clamp(62px, 9vw, 72px)` — do not let it go below 62px or `e2e/mobile-overflow.spec.ts` fails.

## 3. PlayerCard (starters)

Three stacked elements, no card border, no pills:

```
<button type="button" onClick={stopPropagation + onTap}
        className="relative flex flex-1 min-w-0 max-w-[100px] flex-col items-center
                   focus-visible:outline-none group">
  {/* photo-or-kit tile — see §3a */}
  <div className="relative w-full max-w-[72px] aspect-[11/13] rounded-t-lg
                  bg-white dark:bg-[#1b201a] shadow-[0_5px_12px_-3px_rgba(0,0,0,0.55)]"
       style={{
         backgroundImage: `url(${tileSrc})`,
         backgroundSize: 'contain',
         backgroundPosition: 'bottom center',
         backgroundRepeat: 'no-repeat',
       }}>
    {/* armband */}
  </div>
  {/* name plate */}
  <div className="-mt-1 w-full rounded-t-md bg-white/[0.94] dark:bg-[#0c0e0d]/[0.88]
                  backdrop-blur-[4px] px-1 py-[3px] text-center overflow-hidden">
    <span className="block truncate text-data font-bold text-ink">{web_name}</span>
  </div>
  {/* xPts plate */}
  <div className="w-full rounded-b-md bg-accent text-on-accent px-1 py-[2px]
                  flex items-center justify-center gap-1">
    <span className="text-data font-extrabold tabular">{xPts_1gw.toFixed(1)}</span>
    <span className="text-[9px] font-bold tracking-wider opacity-70">XPTS</span>
  </div>
  {/* fixture chip */}
  <span className="mt-[3px] rounded px-1.5 py-px text-[10px] font-bold" style={fdrStyle}>
    {opponentLabel}
  </span>
</button>
```

- `min-h-[44px]` tap target is satisfied: kit + plates ≈ 84px tall.
- Armband: `absolute -top-0.5 -right-0.5 min-w-[20px] h-5 rounded-full bg-accent text-on-accent
  text-[10px] font-extrabold grid place-items-center shadow` — `C` for captain,
  `V` for vice. Keep `data-testid="captain-badge"` / `"vc-badge"`.
- `start_prob` moves off the card into the tooltip (§6) — the pitch reads cleaner without it.

### 3a. Player photos (not just kits)

The tile shows **either** a player photo **or** the team kit — never one stacked over the
other. Pick the source once, render one image:

```ts
const tileSrc = playerPhotoUrl(player) ?? teamKitUrl(teamCode)
```

**Use whatever photo source the app already has.** Do not wire this to
`resources.premierleague.com` — the official PL mugshots are out of date for this app's
purposes. Find the existing photo source in the codebase (check the scraper artifacts, the
player snapshot type, and any `public/` or CDN-backed asset directory) and use that. If there
is genuinely no photo source yet, ask before adding one; do not invent a URL pattern.

Whatever the source, `playerPhotoUrl` must return `null` (not a 404-ing URL) when there is no
photo for that player, so the kit fallback is chosen up front rather than after a failed
request. If the source can only be probed by loading it, keep an `onError` that swaps the
element's `src` to the kit URL once — but a null-returning lookup is preferable.

The tile is `aspect-[11/13]`, `bg-white` in light and `dark:bg-[#1b201a]` in dark, with
`rounded-t-lg` so it reads as a card whose bottom edge is the name plate.
`background-position: bottom center` (or `object-bottom` on an `<img>`) matters: it keeps heads
at a consistent height across crops that differ slightly, and it lands the kit fallback in the
same place a photo's shirt would sit.

### State styling (replaces `stateCls`)
Apply to the button, not a border:

| state | classes |
| --- | --- |
| resting | `hover:-translate-y-0.5 transition-transform` |
| armed (`isPending`) | `ring-2 ring-warning rounded-lg ring-offset-2 ring-offset-[#2f7a34] dark:ring-offset-[#0f2a12]` + `-translate-y-1` |
| legal target | `ring-2 ring-positive rounded-lg ring-offset-2 ring-offset-surface-1` + `animate-pulse` |
| incompatible | `opacity-40 cursor-not-allowed` |

Keep `data-pending` and `data-legal-target` attributes exactly as they are.

## 4. Captain / VC without persistent pills

The always-visible `Set C` / `Set VC` pills on every card are what makes the pitch look like a
form. Keep the pills, but render them **only for the currently-armed card** (`isPending`),
directly beneath it and absolutely positioned so they never reserve row height or shift the
pitch layout:

```
{isPending && (
  <div className="absolute top-full left-0 right-0 z-20 mt-1 flex justify-center gap-1">
    <button data-testid={`set-c-${id}`} onClick={…setCaptain} className="…">C</button>
    <button data-testid={`set-vc-${id}`} onClick={…setVc} className="…">VC</button>
  </div>
)}
```

Pill styling: `min-h-[44px] px-2 rounded-md bg-surface-1/95 border border-line text-[11px]
font-bold text-ink backdrop-blur-sm shadow`. The parent card needs `relative` (it already has
it) and the row needs no extra height — the pills overlay the row below.

Both `setCaptain` / `setVc` handlers and both `data-testid`s are unchanged, so
`LineupTab.test.tsx` keeps passing **only if** the test arms the card before querying the
pills. If it queries them on a resting card, arm the card first in the test
(`fireEvent.click(card)`) — that is the one permitted test edit.

The armband badge on the card (§3) is what communicates the current C/V at rest.

## 5. Bench

Move the bench out of the pitch into its own panel below it — a bench is not on the pitch:

```
<div className="rounded-xl border border-line bg-surface-1 p-3">
  <div className="mb-2.5 flex items-center gap-2">
    <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">Bench</span>
    <span className="h-px flex-1 bg-line" />
    <span className="text-[11px] text-ink-muted">autosub order</span>
  </div>
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">…</div>
</div>
```

Bench grid is `grid-cols-2` at every width — 4 columns leaves the name span ~53px, which
truncates ordinary names like Sánchez and Mykolenko.

Each bench chip: `relative flex items-center gap-2 rounded-lg border border-line bg-surface-1
p-2 min-h-[56px]`, a 30×36 photo-or-kit tile (single source per §3a, `rounded-[5px]`),
name, xPts, FDR chip, and the autosub slot number
`absolute top-1 right-1.5 text-[10px] font-bold text-ink-muted tabular`.
Legal-target and incompatible states as in §3.

## 6. Fixture chip + tooltip data

Fixture data is **not** on `MergedPlayer` (verified: `upcoming_fixtures: ClubFormFixture[]` is
on `ClubForm`, `src/lib/types.ts:602`, keyed by `team_id`, holding the next 32). Reuse the
existing map builder rather than a `.find()` per card:

```ts
import { buildClubFormMap } from '@/lib/chip-strategy-engine'  // team_id -> upcoming_fixtures[]

const { data: clubForm } = useClubForm()
const fixtureMap = useMemo(() => buildClubFormMap(clubForm ?? []), [clubForm])
const nextFixtures = (p: MergedPlayer) => fixtureMap.get(p.team)?.slice(0, 3) ?? []
```

`nextFixtures(p)[0]` drives the chip; all three drive the tooltip. Because
`upcoming_fixtures` already spans 32 gameweeks, no extra fetch is needed for the tooltip.

Label: `is_home ? opponent_team.toUpperCase() : opponent_team.toLowerCase()` — the FPL
convention, home in caps. Colour by `difficulty_tier` (`easy` / `medium` / `hard`) or bucket
`difficulty_score` into 5 FDR steps:

| FDR | light bg / ink | dark bg / ink |
| --- | --- | --- |
| 1–2 | `#e6f6d6` / `#3d6412` | `#1d2b10` / `#a9c46a` |
| 3 | `#f0efe4` / `#5f6a58` | `#232720` / `#8a9484` |
| 4 | `#fbe2d6` / `#9a3412` | `#2e1a12` / `#e0a83e` |
| 5 | `#f7d5d5` / `#b91c1c` | `#2b1414` / `#f08a8a` |

Chip renders nothing when there is no fixture (blank gameweek) — the existing BGW banner
already explains it.

Hover tooltip (desktop, `group-hover`) / popover body (touch) shows: full name, position,
`start_prob` as `%`, `xPts_1gw`, next 3 fixtures as FDR chips, and the lineup-news status badge
if `useLineupNews()` has an entry — reuse `StatusLabelBadge`.

## 7. Header

Replace the pipe-separated headline row with three stat tiles above the pitch
(`flex flex-wrap gap-2`, each `flex-1 min-w-[110px] rounded-xl border border-line bg-surface-1
px-3 py-2.5`): Formation, Captain, Total xPts. The xPts tile uses the accent surface
(`bg-accent-soft border-accent-soft text-accent`) so the number that matters reads first.
Label: `text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted`.
Value: `text-h3 font-bold tabular`.

Keep `data-testid="lineup-headline-row"` on the tile group so the existing test resolves.

## 8. Formation switcher (in scope — build this)

A pill row directly under the header tiles, above the pitch:

```
<div role="radiogroup" aria-label="Formation" data-testid="formation-switcher"
     className="flex flex-wrap gap-1.5">
  {FORMATIONS.map(f => (
    <button key={f} role="radio" aria-checked={f === activeFormation}
            data-testid={`formation-${f}`} onClick={() => setForcedFormation(f)}
            className={f === activeFormation
              ? "min-h-[44px] px-3 rounded-lg bg-accent text-on-accent text-[13px] font-bold tabular"
              : "min-h-[44px] px-3 rounded-lg border border-line bg-surface-1 text-ink-muted text-[13px] font-semibold tabular hover:text-ink"}>
      {f}
    </button>
  ))}
</div>
```

`const FORMATIONS = ['3-4-3','3-5-2','4-4-2','4-3-3','4-5-1','5-3-2','5-4-1'] as const`
— the seven legal FPL shapes (1 GK, 3–5 DEF, 2–5 MID, 1–3 FWD, 10 outfield).

### Engine work this needs

`optimiseLineup(picks, players, horizon)` currently picks the best legal XI across all shapes.
Add an optional fourth argument:

```ts
type Formation = `${number}-${number}-${number}`
optimiseLineup(picks, players, horizon, forcedFormation?: Formation)
```

When `forcedFormation` is passed, constrain the selection to exactly that many DEF / MID / FWD
instead of searching all shapes — the existing scoring, tie-breaks, and bench ordering are
unchanged, only the candidate set narrows. Keep the argument optional so every existing caller
and test is unaffected.

### Component state

```ts
const [forcedFormation, setForcedFormation] = useState<Formation | null>(null)
const lineup = useMemo(
  () => optimiseLineup(picks, players, 1, forcedFormation ?? undefined),
  [picks, players, forcedFormation]
)
const activeFormation = forcedFormation ?? derivedFormation(lineup)
```

`derivedFormation` is just counts of the starting XI by position — the Formation header tile
already needs it, so compute it once and share.

- `null` means "optimiser's choice": no pill is accent-filled until the user picks one, and the
  pill matching the derived shape gets `border-accent text-accent` to show what the optimiser
  landed on.
- Reset (existing button) must clear `forcedFormation` back to `null` alongside the captain and
  swap overrides.
- A forced shape that scores below the optimiser's own choice is expected and fine — do not warn
  about it. Do surface the delta in the xPts tile if it's cheap: `68.4` with
  `−1.2 vs optimal` as `text-[11px] text-ink-muted` beneath.
- If a forced shape is unsatisfiable from the 15 picks (rare — e.g. 5-4-1 with only 4 defenders
  owned), disable that pill: `opacity-40 cursor-not-allowed` + `aria-disabled`, computed by
  counting owned players per position.

If you'd rather land the UI before the engine change, ship the pill row read-only in the first
PR — highlighting the derived shape, all pills non-interactive — and wire
`forcedFormation` in the follow-up. Don't ship interactive pills that silently do nothing.

## 9. Drag to swap (optional)

Layer HTML5 drag on top of the existing two-tap flow, don't replace it: `draggable` on
starter and bench cards, `onDragStart` sets `pendingStarterId`, `onDragOver` +
`onDrop` on a card runs the same legality check and `applySwap`. Two-tap must keep working
for touch.

## Tokens

Everything above uses existing tokens from `src/app/globals.css` (`surface-1`, `line`, `ink`,
`ink-muted`, `accent`, `on-accent`, `positive`, `warning`, `accent-soft`). The only new
literals are the turf greens, the chalk white alphas, and the FDR ramp — add them to
`globals.css` as `--sp-turf`, `--sp-turf-stripe-a/b`, `--sp-chalk`, `--sp-fdr-{1..5}-bg/ink`
with `.dark` overrides, then map them in the `@theme inline` block, rather than inlining hexes
in the component.

## Test ids to preserve

`LineupTab.test.tsx` asserts on all of these. Carry every one through the rewrite:

`pitch`, `pitch-row-${position}`, `pitch-card-${id}`, `pitch-card-body-${id}`,
`pitch-card-kit-${id}`, `pitch-card-kit-fallback-${id}`, `set-c-${id}`, `set-vc-${id}`,
`captain-badge`, `vc-badge`, `lineup-reset`, `lineup-headline-row`, `bgw-banner-soft`,
`bgw-banner-critical`, plus the `data-pending` and `data-legal-target` attributes.

Two notes: `pitch-row-bench` keeps its id but becomes the bench panel of §5, not a pitch row;
and `pitch-card-kit-${id}` / `-kit-fallback-${id}` now sit on the photo-or-kit tile of §3a —
keep the fallback id on whatever element shows when there is no image, so the existing
fallback assertion still resolves.

## Acceptance

- Existing `LineupTab.test.tsx` passes (see §4 — the C/VC assertions may need the card armed
  first; that is the only permitted test edit).
- Existing `optimiseLineup` callers and tests pass unchanged — the new formation argument is
  optional.
- Switching formation re-renders the pitch rows with the right shape; Reset returns to the
  optimiser's own choice.
- 390px viewport: 5 defenders fit in one row without truncation past the ellipsis; bench is
  2 columns; no horizontal overflow (`e2e/mobile-overflow.spec.ts` stays green).
- Light and dark both hit 4.5:1 for name plate text, xPts plate text, and every FDR chip.
- `prefers-reduced-motion` removes the lift and pulse (the global rule in `globals.css`
  already collapses durations; verify the `-translate-y` transitions are the only motion).
