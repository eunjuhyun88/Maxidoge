# Arena Page Controller Design

Date: 2026-03-07  
Status: active  
Scope: `/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/arena/+page.svelte`  
Depends on: `ChartPanel` Batch 3 shell/runtime split being materially complete; [`arena-core-loop-design-2026-03-07.md`](./arena-core-loop-design-2026-03-07.md)  
Goal: turn `arena/+page.svelte` from a game-engine monolith into a page shell over explicit arena controllers.

## Snapshot

Current measured hotspots:

- [`src/routes/arena/+page.svelte`](../../../src/routes/arena/+page.svelte): `1392` lines
- [`src/components/arena/ArenaBattleLayout.svelte`](../../../src/components/arena/ArenaBattleLayout.svelte): `1030` lines
- [`src/components/arena/ChartPanel.svelte`](../../../src/components/arena/ChartPanel.svelte): `1269` lines
- [`src/components/arena/chart/chartDerivativesRuntime.ts`](../../../src/components/arena/chart/chartDerivativesRuntime.ts): `259` lines
- [`src/components/arena/Lobby.svelte`](../../../src/components/arena/Lobby.svelte): `1459` lines
- [`src/components/arena/HypothesisPanel.svelte`](../../../src/components/arena/HypothesisPanel.svelte): `572` lines
- [`src/components/arena/ResultPanel.svelte`](../../../src/components/arena/ResultPanel.svelte): `279` lines
- [`src/components/arena/arenaState.ts`](../../../src/components/arena/arenaState.ts): `201` lines

Route-level complexity markers inside [`src/routes/arena/+page.svelte`](../../../src/routes/arena/+page.svelte):

- `14` `init*` phase functions
- replay lifecycle, reward/result lifecycle, bracket loading, exit confirmation, chart drag bridge, and battle resolver wiring all live in one file
- server API calls for match create/draft/analyze/hypothesis/resolve/bracket live directly in the route
- timer ownership is spread across replay, speech typing, live events, preview auto-close, battle turn sequencing, and exit confirmation

Implemented since draft:

- battle-stage DOM and battle-only responsive CSS moved under [`src/components/arena/ArenaBattleLayout.svelte`](../../../src/components/arena/ArenaBattleLayout.svelte)
- battle/system feed payload shaping moved under [`src/lib/arena/feed/arenaBattleFeedRuntime.ts`](../../../src/lib/arena/feed/arenaBattleFeedRuntime.ts)
- hidden phase timer handles moved under [`src/lib/arena/state/arenaPhaseTimerRuntime.ts`](../../../src/lib/arena/state/arenaPhaseTimerRuntime.ts)
- `ChartPanel` OI/Funding/Liquidation pane creation and sync moved under [`src/components/arena/chart/chartDerivativesRuntime.ts`](../../../src/components/arena/chart/chartDerivativesRuntime.ts)

## Current Problem

`arena/+page.svelte` is still acting as:

1. page shell
2. game phase state machine
3. battle presentation runtime
4. replay engine host
5. chart bridge
6. server sync controller
7. timer registry and cleanup owner

That is the wrong boundary. The page should compose those concerns, not own them directly.

## Invariants

This batch must preserve:

1. no layout or positioning changes
2. no `ChartPanel` behavior regressions
3. existing phase order: `DRAFT -> ANALYSIS -> HYPOTHESIS -> BATTLE -> RESULT`
4. existing local/offline behavior when server sync fails
5. `npm run check` and `npm run build` green after every slice

## Target End State

After Batch 4, [`src/routes/arena/+page.svelte`](../../../src/routes/arena/+page.svelte) should only do these jobs:

1. choose which major arena view is visible
2. bind controller state into child components
3. wire user events into controller methods
4. own mount/unmount registration only at the top boundary

Everything else should move under `src/lib/arena/*`.

## Target Folder Map

Create or populate these internal folders:

```text
src/lib/arena/
  controllers/
    arenaMatchController.ts
    arenaPhaseController.ts
    arenaViewController.ts
  battle/
    arenaBattlePresentationRuntime.ts
    arenaBattleTurnRuntime.ts
  feed/
    arenaBattleFeedRuntime.ts
    arenaLiveEventRuntime.ts
  reward/
    arenaRewardRuntime.ts
  adapters/
    arenaChartBridge.ts
    arenaServerSync.ts
  state/
    arenaTimerRegistry.ts
    arenaPhaseTimerRuntime.ts
    arenaVisualEffectsRuntime.ts
    arenaTypes.ts
  selectors/
    arenaViewModel.ts
```

## Concrete Responsibility Split

### 1. Match + server sync

Move out of route:

- `serverMatchId`, `serverAnalysis`, `apiError`
- `onSquadDeploy`
- `loadBracket`
- server calls:
  - `createArenaMatch`
  - `submitArenaDraft`
  - `runArenaAnalysis`
  - `submitArenaHypothesis`
  - `resolveArenaMatch`
  - `getTournamentBracket`

Target:

- `src/lib/arena/controllers/arenaMatchController.ts`
- `src/lib/arena/adapters/arenaServerSync.ts`

Route should not directly know mutation sequence details.

### 2. Phase transition controller

Move out of route:

- `onPhaseInit`
- `initDraft`
- `initAnalysis`
- `initHypothesis`
- `initPreview`
- `initScout`
- `initGather`
- `initCouncil`
- `initBattle`
- `initResult`
- `initCooldown`

Target:

- `src/lib/arena/controllers/arenaPhaseController.ts`

This controller becomes the single place that knows:

- what each phase initializes
- which runtime starts/stops at phase boundaries
- which feed/narration side effects happen on entry

Note:

- `compare` / `verdict` overlay는 현재 5-phase loop에서 retire된 legacy path다. 이 설계 문서의 active scope에는 포함하지 않는다.

### 3. Battle presentation runtime

Move out of route:

- `charSprites`, `battleTurns`, `currentTurnIdx`, `battleNarration`, `battlePhaseLabel`
- `enemyHP`, `enemyMomentum`, `comboCount`, `showCritical`, `showCombo`, `criticalText`
- `chatMessages`, `arenaParticles`
- `initCharSprites`, `setCharState`, `moveChar`, `showCharHit`, `showCharAction`, `trackCombo`
- `scheduleBattleTurnsLocal`, `executeTurn`, `addChatMsg`, `clearTurnTimers`, `startBattleTurnSequence`
- battle resolver subscription wiring

Target:

- `src/lib/arena/battle/arenaBattlePresentationRuntime.ts`
- `src/lib/arena/battle/arenaBattleTurnRuntime.ts`

This is the heaviest non-chart runtime still trapped in the page.

### 4. Reward/result runtime

Move out of route:

- `rewardVisible`, `rewardXp`, `rewardStreak`, `rewardBadges`
- `resultVisible`, `resultData`, `pvpVisible`
- reward/result auto timers

Target:

- `src/lib/arena/reward/arenaRewardRuntime.ts`
- `src/lib/arena/controllers/arenaResultController.ts`

This isolates post-match flow from battle flow.

Note:

- replay route integration은 현재 active scope가 아니다. replay UI 진입점이 다시 생기기 전까지 `arena/+page.svelte` 기준 설계에서 제외한다.

### 5. Chart bridge + hypothesis runtime

Move out of route:

- `showChartPosition`, `chartPosEntry`, `chartPosTp`, `chartPosSl`, `chartPosDir`
- `chartAgentMarkers`, `chartAnnotations`
- `generateAnnotations`, `generateAgentMarkers`
- `onHypothesisSubmit`
- `confirmPreview`
- `selectFloatDir`
- `onDragTP`, `onDragSL`, `onDragEntry`
- preview and hypothesis-side chart projection state

Target:

- `src/lib/arena/adapters/arenaChartBridge.ts`

Important rule:

- route must stop owning mirrored chart position state plus `gameState` mutation rules in two places

### 6. Feed + timer registry

Move out of route:

- `safeTimeout`
- `addFeed` payload shape
- `SYSTEM` feed payload shape
- hidden `hypothesisInterval`, `previewAutoTimer`, `pvpShowTimer`
- visual particle / floating-word effect helpers

Target:

- `src/lib/arena/feed/arenaBattleFeedRuntime.ts`
- `src/lib/arena/feed/arenaLiveEventRuntime.ts`
- `src/lib/arena/state/arenaTimerRegistry.ts`
- `src/lib/arena/state/arenaPhaseTimerRuntime.ts`
- `src/lib/arena/state/arenaVisualEffectsRuntime.ts`

This removes a large amount of invisible lifecycle risk from the page.

## Recommended Execution Order

### Slice A. Foundation

Create:

- `src/lib/arena/state/arenaTypes.ts`
- `src/lib/arena/selectors/arenaViewModel.ts`

Extract first:

- view-only derived strings and badges
- `resultOverlayTitle`
- mission / score / mode / tournament display helpers

Why first:

- lowest regression risk
- gives stable type surface for later runtimes

### Slice B. Chart bridge + hypothesis

Extract:

- chart position state
- chart drag handlers
- preview confirmation
- hypothesis submit transition
- annotation/marker generation bridge

Why second:

- it disconnects the route from the current `gameState + chart local state` duplication

### Slice C. Replay / reward / feed runtime

Extract:

- replay state machine
- reward modal state
- compare overlay timers
- feed append / cursor / live-event stream

Why third:

- these are self-contained and remove a lot of page noise without touching battle resolution yet

### Slice D. Battle presentation runtime

Extract:

- sprite state
- turn execution
- battle narration/chat
- resolver subscribe/destroy lifecycle

Why fourth:

- highest-risk slice, but by then the route will already be smaller

### Slice E. Match controller + final shell cleanup

Extract:

- server sync sequence
- bracket loading
- goLobby / playAgain / exit-confirm flow
- mount/destroy registration cleanup

Why last:

- it closes the page by making the route a real shell

## Expected Route After Batch 4

Target shape for [`src/routes/arena/+page.svelte`](../../../src/routes/arena/+page.svelte):

- imports controllers/runtimes/selectors
- derives a few shell props
- renders existing arena layout
- calls controller methods from current event handlers

It should no longer contain:

- long phase init bodies
- replay step switch logic
- battle turn timing logic
- raw server mutation choreography
- scattered timer cleanup code

## Exit Criteria

Batch 4 is complete when:

1. [`src/routes/arena/+page.svelte`](../../../src/routes/arena/+page.svelte) is materially smaller and mostly shell/composition
2. phase lifecycle is traceable through one controller
3. battle runtime teardown is owned outside the route
4. replay/reward/feed/timer ownership is no longer spread through the page
5. chart bridge state is not duplicated between page locals and `gameState` without an adapter
6. build/check remain green after every slice

## Risks To Watch

1. `gameState.update(...)` is currently mixed with local `$state` mirrors; extracting without a single adapter will create new drift
2. battle timing and replay timing both use ad hoc timers; timer ownership must be centralized before moving logic around aggressively
3. `initResult()` mixes presentation, progression, history persistence, PnL write, and server resolve; do not move that as one giant function
4. `HypothesisPanel.svelte` and `Lobby.svelte` are still large, but they are not the first extraction targets for this batch

## Immediate Next Step

Start with Slice A and Slice B only:

1. create `src/lib/arena/state/arenaTypes.ts`
2. create `src/lib/arena/selectors/arenaViewModel.ts`
3. create `src/lib/arena/adapters/arenaChartBridge.ts`
4. move chart position / hypothesis / preview bridge first

That gives the best risk-to-payoff ratio and does not require changing the visible arena layout.
