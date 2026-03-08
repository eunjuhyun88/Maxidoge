# Arena UI/UX Layout Design

Date: 2026-03-07  
Status: active  
Scope: `/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/arena/+page.svelte` and related arena views  
Depends on:
- [`arena-core-loop-design-2026-03-07.md`](./arena-core-loop-design-2026-03-07.md)
- [`arena-page-controller-design-2026-03-07.md`](./arena-page-controller-design-2026-03-07.md)

## Purpose

Define how Arena should be visually arranged so the core loop is obvious:

`setup -> council -> commit -> resolve -> score`

This is a UI/UX placement document, not a styling redesign.  
It is about hierarchy, emphasis, and where each interaction should live.

## Current UI Problem

Today Arena shows too many first-class surfaces at once.

Examples inside [`src/routes/arena/+page.svelte`](../../../src/routes/arena/+page.svelte):

1. topbar phase track
2. phase guide
3. view picker
4. chart score bar
5. right mission bar
6. battle narration
7. battle log
8. overlays for preview / compare / verdict / result / reward / replay

The result:

- the chart is not always clearly the main decision surface
- battle theater competes with trading judgment
- the user sees multiple summaries of the same phase/state
- score and reward are visually mixed with combat spectacle

## UI North Star

Arena should feel like:

- a **trading decision board first**
- a **council of agents second**
- a **battle theater third**

That means:

1. the chart should be the primary board during `COUNCIL`, `COMMIT`, and `RESOLVE`
2. the right rail should explain and support the current decision, not compete with it
3. result state should pivot to score interpretation, not keep fighting for screen space with battle chrome

## Layout Hierarchy

### Level 1: Match Context

Always-visible, lightweight context:

- pair / timeframe
- mode
- loop progress
- LP / streak / match count

This belongs in one compact header only.  
Do not repeat this same information in multiple bars.

### Level 2: Decision Workspace

This is the main surface.

Desktop:

- left 68-72%: chart board
- right 28-32%: contextual rail

Tablet:

- chart full width
- right rail becomes sheet/drawer or lower stack

Mobile:

- chart first
- contextual actions as phase-specific sheet

### Level 3: Supporting Signal

These should not outrank the workspace:

- agent feed
- narration
- battle log
- live events
- minor score badges

They should live in a subordinate strip, tab, or collapsible rail.

### Level 4: Outcome Surfaces

These should take over only after resolution:

- result scorecard
- reward
- replay

They should replace the decision rail, not stack chaotically on top of battle UI.

## Proposed Screen Architecture

### A. Global frame

Use a stable three-zone structure:

1. `north rail`
   - compact context header
2. `main workspace`
   - board + phase rail
3. `support strip`
   - feed, events, replay timeline, optional theater summaries

## Desktop Layout

### 1. North rail

Replace multiple overlapping summaries with one compact header:

- left: back / lobby
- center: `SETUP | COUNCIL | COMMIT | RESOLVE | SCORE`
- right: pair, timeframe, mode, LP/streak

Keep:

- current phase track idea

Reduce or remove:

- repeated score badges
- duplicated mode labels
- repeated timer fragments outside the active phase panel

### 2. Main workspace

#### Left: Primary board

This should be the default focal point in almost every active phase.

Contains:

- [`ChartPanel.svelte`](../../../src/components/arena/ChartPanel.svelte)
- chart position overlays
- agent annotations / markers
- hypothesis preview projection

This left panel should remain visually dominant.

#### Right: Phase rail

This is not a second main app.  
It is one contextual rail whose contents change by phase.

Phase rail content by loop step:

- `SETUP`
  - squad config / match setup card
- `COUNCIL`
  - council snapshot
  - top agent signals
  - disagreement summary
  - “what matters now” list
- `COMMIT`
  - hypothesis form
  - R:R validation
  - commit CTA
- `RESOLVE`
  - position monitor
  - TP/SL distance
  - short agent reaction strip
  - minimal battle telemetry
- `SCORE`
  - scorecard
  - LP / FBS
  - agent accuracy
  - replay + play again

Important:

- the current giant battle sidebar should be demoted from “always-right-column app” to a `RESOLVE`-only phase rail variant

### 3. Support strip

This is a bottom strip or collapsible section.

Put here:

- feed messages
- live events
- narration
- replay progress

Do not let these sit as large competing blocks next to the main board.

## Mobile / Tablet Layout

### Mobile

Priority order:

1. chart
2. current action
3. council/hypothesis/result sheet

Rules:

- chart remains first screen
- phase rail becomes bottom sheet
- agent theater view is secondary, not default
- score appears as full-height sheet after resolution

### Tablet

Priority order:

1. chart
2. side drawer or split rail
3. support strip

Rules:

- maintain chart-first workspace
- use drawer behavior for council/result panels
- avoid three equal columns

## View Strategy

Current [`ViewPicker.svelte`](../../../src/components/arena/ViewPicker.svelte) treats all views as equal:

- `CHART WAR`
- `AGENT ARENA`
- `MISSION CONTROL`
- `CARD DUEL`

That is wrong for the core loop.

### Proposed view ranking

#### Primary

- `Board`
  - the canonical trading view

#### Secondary

- `Theater`
  - agent arena spectacle
- `Desk`
  - mission-control telemetry

#### Experimental / optional

- `Card Duel`

Implication:

- the default active view should usually be `Board`
- `Theater` is an alternate presentation of `RESOLVE`, not the main home of Arena
- `Card Duel` should not visually compete with the core loop in the primary picker row

## Phase-by-Phase UX Placement

### Setup

Goal:

- choose squad and configure the match

Placement:

- center or right-rail setup card
- chart can be present but subdued

What should dominate:

- squad config

### Council

Goal:

- understand what the agent council sees

Placement:

- chart on left
- council snapshot rail on right
- feed strip at bottom

What should dominate:

- chart + council summary

What should not dominate:

- battle theater

### Commit

Goal:

- make the user choose and commit

Placement:

- chart stays primary
- hypothesis panel docks in right rail
- preview becomes an in-rail confirmation card, not a dramatic center-overlay unless absolutely necessary

What should dominate:

- entry / tp / sl decision

### Resolve

Goal:

- monitor whether the hypothesis works

Placement:

- chart remains primary
- right rail becomes a lean position monitor
- theater can be toggled as alternate view

What should dominate:

- price path, TP/SL distance, current PnL

What should become secondary:

- sprite combat, combo, critical, decorative juice

### Score

Goal:

- understand whether the decision was good

Placement:

- right rail or centered result card becomes the main output
- chart shrinks into evidence / sparkline support
- reward and replay become secondary actions below score

What should dominate:

- scorecard
- why the trade was right or wrong
- what to do next

## Simplification Rules

### Keep

- one compact phase track
- chart-first board
- one contextual right rail
- one subordinate support strip

### Remove or demote

- duplicate phase summaries
- duplicate score/status chips
- simultaneous heavy overlays that restate the same state
- equal-weight view picker cards for non-core views

### Reframe

- battle theater as optional alternate presentation
- mission control as secondary analytics view
- result as score interpretation, not just win/lose spectacle

## Component Mapping

### Keep as primary surfaces

- [`ChartPanel.svelte`](../../../src/components/arena/ChartPanel.svelte)
- [`HypothesisPanel.svelte`](../../../src/components/arena/HypothesisPanel.svelte)
- [`ResultPanel.svelte`](../../../src/components/arena/ResultPanel.svelte)

### Demote to secondary or conditional surfaces

- [`ViewPicker.svelte`](../../../src/components/arena/ViewPicker.svelte)
- [`PhaseGuide.svelte`](../../../src/components/arena/PhaseGuide.svelte)
- battle narration block
- mini battle log
- floating juice overlays

### Reposition as alternate views

- [`ChartWarView.svelte`](../../../src/components/arena/views/ChartWarView.svelte)
- [`MissionControlView.svelte`](../../../src/components/arena/views/MissionControlView.svelte)
- `AgentArenaView.svelte`
- `CardDuelView.svelte`

## Immediate UI/UX Refactor Order

### Slice U1. Information hierarchy cleanup

- collapse duplicate phase/status summaries
- define one north rail and one support strip
- keep layout visually stable while reducing repeated info

### Slice U2. Right rail redefinition

- make right rail phase-specific
- move battle theater details out of permanent sidebar status

### Slice U3. View picker demotion

- convert view picker from equal-size selection grid to a smaller mode switch
- make `Board` the clear default

### Slice U4. Score-first result state

- show `ResultPanel` as the primary post-resolution artifact
- reward and replay become subordinate actions

## Implementation Constraint

Do not redesign styling and layout at the same time as controller extraction.

Sequence:

1. stabilize core loop and controller boundaries
2. align the layout hierarchy to the loop
3. only then consider deeper visual polish

That avoids mixing architecture risk with visual regression risk.

## Decision Rule

Any Arena UI element should answer one question:

> does this help the user decide, monitor, or learn from the trade?

If not, it is spectacle and should be visually subordinate.
