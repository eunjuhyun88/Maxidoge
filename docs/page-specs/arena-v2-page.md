# Arena v2 Page

Route scope:
- `/arena-v2`

Purpose:
- Define the separate Arena v2 route as a simplified v2 battle shell driven by `arenaV2State`.

## Primary User Job

- Start a round quickly, move through the v2 phase sequence, and inspect battle/result views in the newer Arena shell.

## Core Flow

1. Route starts in `LOBBY` and displays live BTC price when available.
2. `START ROUND` triggers `v2StartRound()` and moves the route into `DRAFT`.
3. The store then drives the main phase sequence:
   - `LOBBY`
   - `DRAFT`
   - `ANALYSIS`
   - `HYPOTHESIS`
   - `BATTLE`
   - `RESULT`
4. `PhaseBar` stays visible while the main content swaps between `DraftScreen`, `AnalysisScreen`, `HypothesisScreen`, `BattleScreen`, and `ResultScreen`.
5. During `BATTLE`, keyboard shortcuts `1-4` switch between `arena`, `chart`, `mission`, and `card` views.
6. `Go Lobby` resets the route through `v2Reset()`; `Play Again` starts a fresh round.

## Guardrails

- This route is a separate v2 state machine, not a drop-in alias for `/arena`.
- Keyboard view switching should only work during `BATTLE`.
- Live BTC price is a feed into the v2 store, not the primary source of route phase changes.
- Reset and replay actions should create a clean new round state rather than partially mutating the old one.

## Key UI Blocks

- `PhaseBar`
- lobby start screen
- `DraftScreen`
- `AnalysisScreen`
- `HypothesisScreen`
- `BattleScreen`
- `ResultScreen`

## State Authority

- full v2 route state: `arenaV2State`
- phase/view actions: `v2SetPhase`, `v2SetView`, `v2StartRound`, `v2Reset`
- live BTC feed projection: `btcPrice` -> `arenaV2State.btcPrice`
- route shell: phase-to-screen switching plus battle-only keyboard shortcuts

## Supporting APIs And Data

- `arenaV2State`
- `v2StartRound`
- `v2SetView`
- `v2Reset`
- `btcPrice`

## Failure States

- route is documented as a variant of `/arena` without noting the separate store and phase model
- battle view shortcuts work outside `BATTLE`
- live price feed is missing and the route does not degrade cleanly
- `Go Lobby` or `Play Again` leaves stale round state behind

## Read These First

- `docs/product-specs/arena.md`
- `docs/page-specs/arena-page.md`
- `docs/generated/store-authority-map.md`

## Applied Source Inputs

- `src/routes/arena-v2/+page.svelte`
- `src/lib/stores/arenaV2State.ts`
