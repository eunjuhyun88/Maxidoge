# Internal Extraction Folder Map

Date: 2026-03-07  
Status: active  
Scope: `/Users/ej/Downloads/maxidoge-clones/frontend`  
Purpose: define the exact folder structure to create inside the canonical frontend workspace before any top-level frontend/backend repo split.

## Decision Summary

Do not clone the canonical app again.

Do this instead:

1. keep `frontend/` as the only live implementation target
2. create extraction-ready folders **inside** `frontend/src/lib`
3. move orchestration, contracts, and domain runtime out of giant route/component files
4. physically split into `apps/web` and `apps/api` only after the internal boundaries are stable

## Why This Is The Right Order

Creating another top-level app right now would repeat the same failure mode that produced `frontend/` and `backend/` drift:

- duplicate edit targets
- partial cherry-pick synchronization
- unclear implementation authority
- larger regression surface during hotspot cleanup

The current bottleneck is not repository shape.  
The current bottleneck is oversized files and mixed responsibilities inside the canonical app.

## Hard Boundary Rules

### Presentation Layer

Keep these as presentation-first surfaces:

- `src/routes/**/*.svelte` (except `src/routes/api/**`)
- `src/components/**`

Allowed responsibilities:

- markup
- local UI interaction state
- DOM refs
- event wiring
- route shell composition

Not allowed to remain here once extraction begins:

- heavy polling ownership
- request orchestration trees
- server-authoritative derivation
- cross-domain mutation sequencing
- chart runtime lifecycle internals

### Application Runtime Layer

Move non-trivial client/runtime logic here:

- `src/lib/terminal/**`
- `src/lib/chart/**`
- `src/lib/profile/**`
- `src/lib/passport/**`
- `src/lib/arena/**`
- `src/lib/contracts/**`

### Server Layer

Keep backend logic here:

- `src/routes/api/**/+server.ts`
- `src/lib/server/**`

Server routes should become thin HTTP adapters over reusable server modules.

## Folders To Create Now

These are the right folders to introduce inside `frontend/src/lib`.

### 1. `src/lib/contracts/`

Purpose:
- shared request/response contracts
- zod schemas or runtime validation contracts
- DTOs used by both browser and server code

Suggested structure:

```text
src/lib/contracts/
  common/
  arena/
  passport/
  profile/
  quick-trades/
  signals/
  terminal/
```

Why first:
- removes duplicated request/body parsing assumptions
- stabilizes eventual extraction to `packages/contracts`

### 2. `src/lib/arena/`

Purpose:
- arena route controllers and state machines that should not live in `+page.svelte`

Suggested structure:

```text
src/lib/arena/
  controllers/
  state/
  battle/
  replay/
  adapters/
  selectors/
```

What belongs here:
- match lifecycle orchestration
- phase transition rules
- replay/reward flow coordination
- chart bridge logic used by arena
- state selectors derived from large arena stores

### 3. `src/lib/chart/` expansion

This folder already exists and should become the real chart runtime home.

Suggested structure:

```text
src/lib/chart/
  runtime/
  overlays/
  patterns/
  planners/
  tradingview/
  types/
```

What belongs here:
- runtime bootstrap/teardown
- data lifecycle
- overlay rendering
- drawing session logic
- pattern scan scheduling
- trade planner math and interaction contracts
- TradingView fallback adapter

Rule:
- `.svelte` chart UI stays in `src/components/arena/**`
- `.ts` chart runtime logic moves into `src/lib/chart/**`

### 4. `src/lib/terminal/` expansion

This folder already exists and should own terminal application logic.

Suggested structure:

```text
src/lib/terminal/
  controllers/
  intel/
  warroom/
  mappers/
  selectors/
```

What belongs here:
- route shell view-models
- intel derivation/mapping
- polling coordination
- war room orchestration helpers
- card/feed mapping utilities

### 5. `src/lib/passport/`

Purpose:
- passport screen-specific orchestration that does not belong in generic profile domain code

Suggested structure:

```text
src/lib/passport/
  controllers/
  view-models/
  runtime/
  sections/
```

What belongs here:
- holdings sync runtime
- learning panel controller
- tab shell state
- insight derivation
- passport-only CTA/section assembly

Rule:
- generic profile authority stays in `src/lib/profile/**`
- passport screen behavior lives in `src/lib/passport/**`

### 6. `src/lib/profile/` expansion

This folder already exists and should remain the domain home for user/profile authority.

Suggested structure:

```text
src/lib/profile/
  authority/
  selectors/
  formatters/
  projections/
```

What belongs here:
- profile authority rules
- server projection helpers consumed by UI
- display-level selectors and formatters
- tier/badge/stat shaping logic

## File Mapping: Move These Next

The following moves are the cleanest first-stage extractions.

| Current file | Target file | Reason |
|---|---|---|
| `src/components/terminal/terminalViewModel.ts` | `src/lib/terminal/controllers/terminalShellViewModel.ts` | view-model is app logic, not component structure |
| `src/components/terminal/intelViewModel.ts` | `src/lib/terminal/intel/intelViewModel.ts` | intel derivation belongs to terminal runtime |
| `src/components/terminal/intelHelpers.ts` | `src/lib/terminal/intel/intelMappers.ts` | mapping/formatting should leave the component layer |
| `src/components/terminal/intelTypes.ts` | `src/lib/terminal/intel/intelTypes.ts` | runtime types should live beside runtime logic |
| `src/components/terminal/terminalHelpers.ts` | `src/lib/terminal/mappers/terminalDisplayMappers.ts` plus tiny local UI helpers if needed | split domain mapping from component-only formatting |
| `src/components/passport/passportHelpers.ts` | `src/lib/passport/view-models/passportViewModel.ts` or `src/lib/profile/formatters/passportFormatters.ts` | passport derivation is not a component concern |
| `src/components/arena/arenaState.ts` | `src/lib/arena/state/arenaSessionState.ts` | route state model should not sit under components |
| `src/components/arena/chart/chartBootstrap.ts` | `src/lib/chart/runtime/chartBootstrap.ts` | runtime bootstrap belongs in chart runtime |
| `src/components/arena/chart/chartDataRuntime.ts` | `src/lib/chart/runtime/chartDataRuntime.ts` | data lifecycle belongs in chart runtime |
| `src/components/arena/chart/chartRuntimeBindings.ts` | `src/lib/chart/runtime/chartRuntimeBindings.ts` | bindings are runtime glue, not component code |
| `src/components/arena/chart/chartTradingViewRuntime.ts` | `src/lib/chart/tradingview/chartTradingViewRuntime.ts` | TradingView adapter should be isolated |
| `src/components/arena/chart/chartDrawingEngine.ts` | `src/lib/chart/overlays/chartDrawingEngine.ts` | drawing engine is pure runtime |
| `src/components/arena/chart/chartDrawingSession.ts` | `src/lib/chart/overlays/chartDrawingSession.ts` | session lifecycle belongs with overlay runtime |
| `src/components/arena/chart/chartOverlayRenderer.ts` | `src/lib/chart/overlays/chartOverlayRenderer.ts` | overlay rendering is runtime/service logic |
| `src/components/arena/chart/chartPatternEngine.ts` | `src/lib/chart/patterns/chartPatternEngine.ts` | pattern engine should be independently testable |
| `src/components/arena/chart/chartPositionInteraction.ts` | `src/lib/chart/planners/chartPositionInteraction.ts` | trade interaction belongs with planner/runtime logic |
| `src/lib/chart/chartTradePlanner.ts` | `src/lib/chart/planners/chartTradePlanner.ts` | co-locate planner logic with interaction contract |
| `src/lib/chart/tradingviewEmbed.ts` | `src/lib/chart/tradingview/tradingviewEmbed.ts` | keep TradingView concerns in one sub-tree |

## Route And Component Targets

### `src/routes/terminal/+page.svelte`

Target end state:

- route shell only
- imports layout components
- imports one terminal controller/view-model from `src/lib/terminal/controllers`

### `src/components/terminal/IntelPanel.svelte`

Target end state:

- presentational orchestration only
- consumes `src/lib/terminal/intel/*`
- no broad polling ownership and no cross-domain fetch tree

### `src/components/terminal/WarRoom.svelte`

Target end state:

- UI shell + local interactions
- war room execution logic moves to `src/lib/terminal/warroom/*`

### `src/routes/passport/+page.svelte`

Target end state:

- page shell + tab composition only
- section runtimes come from `src/lib/passport/*`
- generic profile selectors come from `src/lib/profile/*`

### `src/routes/arena/+page.svelte`

Target end state:

- page shell over arena controllers
- battle/replay/reward/chart bridge logic lives in `src/lib/arena/*`

### `src/components/arena/ChartPanel.svelte`

Target end state:

- DOM refs + event bridge + prop composition
- all chart runtime subsystems imported from `src/lib/chart/*`

## Folder Creation Order

Create folders in this order:

1. `src/lib/contracts`
2. `src/lib/terminal/{controllers,intel,warroom,mappers,selectors}`
3. `src/lib/passport/{controllers,view-models,runtime,sections}`
4. `src/lib/arena/{controllers,state,battle,replay,adapters,selectors}`
5. `src/lib/chart/{runtime,overlays,patterns,planners,tradingview,types}`
6. expand `src/lib/profile/{authority,selectors,formatters,projections}`

Why this order:

- contracts reduce drift first
- terminal already has partial decomposition and yields easy wins
- passport and profile must align after authority cleanup
- arena waits for chart boundary stabilization

## Folders Not To Create Yet

Do not create these as live implementation targets yet:

- `/Users/ej/Downloads/maxidoge-clones/apps/web`
- `/Users/ej/Downloads/maxidoge-clones/apps/api`
- another sibling clone of `frontend/`
- a new live `backend/` replacement app

Those are final extraction targets, not current implementation targets.

## Extraction-Ready Rule

A new internal folder is justified only if it does at least one of these:

1. removes runtime logic from `.svelte` files
2. moves server-authoritative rules away from browser stores
3. produces reusable contracts that both browser and server can share
4. reduces the size or responsibility count of a hotspot file

If it does not satisfy one of those, do not create the folder yet.

## Definition Of Done

This internal folder strategy is considered successful when:

1. `frontend/` remains the only live implementation target
2. `ChartPanel.svelte`, `arena/+page.svelte`, and `passport/+page.svelte` become coordinators rather than control towers
3. stores stop acting like authority layers
4. server routes become thin adapters over `src/lib/server/**`
5. final physical extraction to `apps/web` and `apps/api` can happen with mostly move operations instead of redesign
