# Arena Page

Route scope:
- `/arena`

Purpose:
- Define the route-level battle loop as it exists now: lobby, squad deploy, scan/hypothesis, battle, result, reward, replay, and tournament support.

## Primary User Job

- Configure a squad, run a match, and inspect the outcome through a battle-style interface without losing result history or replayability.

## Core Flow

1. User starts in `Lobby`, then moves into `SquadConfig` during the draft stage.
2. On deploy, the route attempts `createArenaMatch` and `submitArenaDraft`; if sync fails, the battle can continue in local/offline mode.
3. The shared match state advances through `DRAFT -> ANALYSIS -> HYPOTHESIS -> BATTLE -> RESULT`.
4. The same match can be viewed through `arena`, `chart`, `mission`, or `card` views via `ViewPicker`.
5. Result, reward, replay, and tournament-bracket affordances are layered on top of the same underlying match state.

## Guardrails

- Server sync status must stay explicit when the route drops into offline/local continuation.
- View switching must not fork or reset the underlying battle state.
- Result, reward, and replay flows must all derive from the same completed match record.
- Tournament and bracket affordances must stay additive to the route, not become a hidden second flow.

## Key UI Blocks

- `Lobby` and `SquadConfig`
- top bar with phase track and match-history drawer
- `PhaseGuide` and `ViewPicker`
- `ChartPanel` plus `HypothesisPanel`
- `ChartWarView`, `MissionControlView`, `CardDuelView`, and arena battle view
- `ResultPanel`, reward modal, replay banner, and tournament map/bracket affordances

## State Authority

- match phase, selected view, squad, hypothesis, and battle state: `gameState`
- replay, reward modal, battle juice, and transient HUD state: route local
- durable match history, PnL, and wallet-affecting projections: server APIs plus shared stores
- tournament bracket data: API-driven route state

## Supporting APIs And Data

- `createArenaMatch`
- `submitArenaDraft`
- `runArenaAnalysis`
- `submitArenaHypothesis`
- `resolveArenaMatch`
- `getTournamentBracket`
- `/api/arena-war`
- `/api/matches`
- `/api/profile/passport`
- `docs/generated/game-record-schema.md`

## Failure States

- match continues locally after API failure without a clear offline indicator
- view switching loses battle, replay, or tournament state
- result or reward flow never appears after battle resolution
- replay banner or bracket state stays mounted against the wrong match

## Read These First

- `docs/product-specs/arena.md`
- `docs/design-docs/arena-domain-model.md`
- `docs/design-docs/learning-loop.md`
- `docs/generated/game-record-schema.md`

## Applied Source Inputs

- `2026-02-20__STOCKCLAW_HypothesisFirst_UX_Spec_v1.docx`
- `2026-02-17__STOCKCLAW_FSD_3.0_Complete.docx`
- `2026-02-20__STOCKCLAW_UserJourney_Lifecycle_v1.docx`
