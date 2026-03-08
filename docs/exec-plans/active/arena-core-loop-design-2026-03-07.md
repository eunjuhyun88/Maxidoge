# Arena Core Loop Design

Date: 2026-03-07  
Status: active  
Scope: `/Users/ej/Downloads/maxidoge-clones/frontend`  
Purpose: define the optimized arena loop before Batch 4 controller extraction begins.

## Product Definition

Arena is not primarily a battle screen.  
Arena is a **trading judgment training loop** with game presentation wrapped around it.

The real job of the system is:

1. collect an AI council read
2. force the user to commit a hypothesis
3. resolve that hypothesis against market movement
4. score the quality of the decision
5. retain the lesson through replay/history/progression

Everything else is support or presentation.

## Core Loop

The optimized inner loop should be treated as five domain stages.

### 1. Setup

Inputs:

- pair / timeframe
- selected agents
- squad configuration
- mode context (`PVE`, `PVP`, `TOURNAMENT`)

Output:

- one match context ready to evaluate

Current code sources:

- [`src/routes/arena/+page.svelte`](../../../src/routes/arena/+page.svelte)
- [`src/lib/stores/gameState.ts`](../../../src/lib/stores/gameState.ts)

### 2. Council Snapshot

What happens:

- agents analyze the market
- offense/context outputs are produced
- the system generates one council snapshot for the user

What matters:

- direction
- confidence
- thesis
- key levels
- disagreement / divergence

Current code sources:

- [`src/routes/arena/+page.svelte`](../../../src/routes/arena/+page.svelte)
- [`src/components/arena/arenaState.ts`](../../../src/components/arena/arenaState.ts)
- [`src/lib/api/arenaApi.ts`](../../../src/lib/api/arenaApi.ts)

Important note:

- `SCOUT`, `GATHER`, `COUNCIL`, `VERDICT` are presentation sub-phases of one domain step

### 3. User Commit

What happens:

- user chooses `LONG / SHORT / NEUTRAL`
- user defines `entry / tp / sl`
- system validates `R:R`
- user confirms the hypothesis

What matters:

- one committed hypothesis object
- one chart projection of that hypothesis

Current code sources:

- [`src/routes/arena/+page.svelte`](../../../src/routes/arena/+page.svelte)
- [`src/components/arena/HypothesisPanel.svelte`](../../../src/components/arena/HypothesisPanel.svelte)
- [`src/components/arena/ChartPanel.svelte`](../../../src/components/arena/ChartPanel.svelte)

Important note:

- `HYPOTHESIS` and `PREVIEW` are one domain step

### 4. Market Resolution

What happens:

- the hypothesis is exposed to live or simulated price movement
- TP / SL / timeout / close outcome is determined

What matters:

- outcome
- exit price / exit time
- path quality
- drawdown / runup

Current code sources:

- [`src/routes/arena/+page.svelte`](../../../src/routes/arena/+page.svelte)
- [`src/lib/engine/battleResolver.ts`](../../../src/lib/engine/battleResolver.ts)

Important note:

- `BATTLE` is a presentation-heavy wrapper around one domain step: resolve the hypothesis

### 5. Score And Retain

What happens:

- compute LP and FBS
- compare user read with council read and market outcome
- persist match history / PnL / progression
- optionally expose replay

What matters:

- scorecard
- progression delta
- retention artifact

Current code sources:

- [`src/routes/arena/+page.svelte`](../../../src/routes/arena/+page.svelte)
- [`src/lib/engine/scoring.ts`](../../../src/lib/engine/scoring.ts)

Important note:

- `COMPARE`, `RESULT`, `REWARD`, `REPLAY` are post-resolution experiences, not separate domain phases

## Outer Loop Vs Inner Loop

The app currently mixes three loops together.

### Outer loop

- lobby
- mode selection
- tournament bracket
- long-term LP / streak / history

### Inner core loop

- setup
- council snapshot
- user commit
- market resolution
- score and retain

### Presentation loop

- deploy
- scout
- gather
- council
- verdict
- preview
- battle animation
- compare overlay
- result overlay
- reward modal

Refactoring should optimize for the inner core loop first.  
The other two loops should attach to it, not define it.

## Optimized Phase Model

Do not use the current page phases as the domain model.

Use this mapping instead:

| Current UI phase | Optimized domain phase |
| --- | --- |
| `DRAFT` | `SETUP` |
| `ANALYSIS` | `COUNCIL` |
| `HYPOTHESIS` | `COMMIT` |
| `PREVIEW` | `COMMIT` |
| `BATTLE` | `RESOLVE` |
| `COMPARE` | `SCORE` |
| `RESULT` | `SCORE` |
| `REWARD` | `SCORE` |
| `REPLAY` | post-loop utility |

This matters because it tells us what belongs in one controller and what is only staged presentation.

## What Is Core And What Is Secondary

### Core

- match context
- council snapshot
- committed hypothesis
- resolution result
- scorecard

### Secondary

- bracket display
- replay controls
- reward modal
- agent speech timing
- particles / combo / critical / floating doge text

### Pure presentation

- sprite states
- arena particles
- hit popups
- VS splash
- juice effects

If a piece of logic does not help produce or preserve the five core artifacts above, it should not own the route.

## Core Artifacts

These should become explicit typed objects under `src/lib/arena/state/arenaTypes.ts`.

### Match Context

- pair
- timeframe
- selected agents
- squad config
- mode / tournament context

### Council Snapshot

- normalized agent outputs
- direction / confidence
- ORPO / CTX / Guardian / Commander summary
- chart annotations / agent markers

### Hypothesis Commit

- dir
- confidence
- entry / tp / sl
- rr
- commit timestamp

### Resolution Result

- result type
- exit price
- exit time
- price path summary
- runup / drawdown / r achieved

### Scorecard

- LP delta
- FBS
- consensus alignment
- streak delta
- replay metadata

## Refactor Consequence

Batch 4 should be optimized around these module boundaries:

1. `arenaMatchController`
   - owns match context and server sync
2. `arenaCouncilRuntime`
   - owns council snapshot creation and council presentation triggers
3. `arenaChartBridge`
   - owns hypothesis commit + chart projection sync
4. `arenaResolutionRuntime`
   - owns battle resolver and outcome capture
5. `arenaScoreRuntime`
   - owns LP / FBS / persistence / reward / replay metadata

The route should compose these modules, then let existing presentation components render them.

## First Extraction Priority

Start with the most core and least decorative path:

1. `Council Snapshot`
2. `User Commit`
3. `Resolution Result`
4. `Scorecard`

That means the first implementation slice should still be:

1. `src/lib/arena/state/arenaTypes.ts`
2. `src/lib/arena/selectors/arenaViewModel.ts`
3. `src/lib/arena/adapters/arenaChartBridge.ts`

Because that is the smallest slice that clarifies the center of the loop.

## Exit Rule

Batch 4 is on the right path only if every extraction can be answered with one question:

> does this make the `setup -> council -> commit -> resolve -> score` loop easier to trace?

If not, it is probably presentation cleanup, not core-loop refactoring.
