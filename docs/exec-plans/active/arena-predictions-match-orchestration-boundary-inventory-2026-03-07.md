# Arena / Predictions / Match Orchestration Boundary Inventory

Date: 2026-03-07  
Status: active design slice  
Scope: `/Users/ej/Downloads/maxidoge-clones/frontend`

## 1. Slice Goal

This is the eighth real internal split slice.

Goal:

1. make `arena` clearly separable as a local-first match shell inside the current `frontend` app
2. keep page composition, local phase timers, replay, battle presentation, and chart interaction in the `web zone`
3. keep durable match lifecycle, analysis persistence, war-room generation, tournament registration, and progression side effects in the `server zone`
4. define where the current arena implementation is a local simulation runtime versus where it becomes a persisted backend workflow

This slice comes after `passport / learning / jobs` because passport progression, stats, and learning samples all depend on arena outcomes.

## 2. Current Flow Summary

There is not one arena flow today. There are five.

## 2.1 Local-first arena session flow

`arena/+page.svelte -> gameState.ts + local timers + replay/battle runtimes + ChartPanel.svelte`

Implication:

1. the arena page is the primary runtime authority for current session choreography
2. match phases can continue locally even when server sync fails

## 2.2 Persisted match lifecycle flow

`arena/+page.svelte -> arenaApi.ts -> /api/arena/match + /api/arena/draft + /api/arena/analyze + /api/arena/hypothesis + /api/arena/resolve -> arenaService.ts + arena_matches`

Implication:

1. server match lifecycle exists and is real
2. but the page still treats server sync as a best-effort companion rather than the sole authority

## 2.3 War Room debate flow

`arena UI -> /api/arena/match/[id]/warroom -> warRoomService.ts`

Implication:

1. war-room debate is a separate generation boundary
2. it depends on analysis results but is not the same thing as core match state

## 2.4 Tournament flow

`arenaApi.ts -> /api/tournaments/active + /api/tournaments/[id]/register + /api/tournaments/[id]/bracket -> tournamentService.ts`

Implication:

1. tournaments are adjacent to arena, not identical to arena match lifecycle
2. the browser transport currently hides that by exposing tournament calls from the same `arenaApi.ts`

## 2.5 Match resolution and progression side-effect flow

`/api/arena/resolve -> arenaService.resolveMatch + progressionUpdater.updateProgressionAfterMatch`

Implication:

1. match resolution writes arena result state
2. progression update is a downstream side effect, not an arena-owned rule set

## 3. Current Web-Zone Inventory

## 3.1 Browser-facing entry points

Primary web files:

1. [arena/+page.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/arena/+page.svelte)
2. [arenaApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/arenaApi.ts)
3. [gameState.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/gameState.ts)
4. [ChartPanel.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/arena/ChartPanel.svelte)
5. [Lobby.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/arena/Lobby.svelte)
6. [SquadConfig.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/arena/SquadConfig.svelte)
7. [WarRoomPanel.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/arena/WarRoomPanel.svelte)
8. [ResultPanel.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/arena/ResultPanel.svelte)
9. [AgentArenaView.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/arena/views/AgentArenaView.svelte)
10. [ChartWarView.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/arena/views/ChartWarView.svelte)
11. [MissionControlView.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/arena/views/MissionControlView.svelte)
12. [CardDuelView.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/arena/views/CardDuelView.svelte)

Shared engine/runtime layer used by the page:

1. [battleResolver.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/engine/battleResolver.ts)
2. [v2BattleEngine.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/engine/v2BattleEngine.ts)
3. [v3BattleEngine.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/engine/v3BattleEngine.ts)

## 3.2 Web responsibilities today

### `src/routes/arena/+page.svelte`

Owns:

1. local phase machine
2. lobby and squad deploy flow
3. best-effort server match creation and draft submit
4. local hypothesis timer and auto-skip behavior
5. analysis, preview, compare, battle, replay, result, and reward choreography
6. battle feed, speech timers, particle effects, hotkeys, and view switching
7. tournament bracket hydration and map-tab behavior
8. local result persistence into adjacent stores such as match history and pnl

Boundary concern:

1. this route is still the main hybrid controller for the entire arena slice
2. it owns too much of both local session runtime and server orchestration
3. server sync failure explicitly falls back to continuing the match locally, which is an important boundary decision

### `src/lib/stores/gameState.ts`

Owns:

1. local arena session state
2. local persistent config such as pair, timeframe, squad config, and arena view
3. transient runtime data such as phase, battle tick, hypothesis, and pending action

Boundary verdict:

1. this is the correct local runtime authority for an in-progress match session
2. it should not be confused with persisted match truth in `arena_matches`

### `src/lib/api/arenaApi.ts`

Owns:

1. browser wrappers for arena match lifecycle routes
2. browser wrappers for tournament routes
3. transport DTOs for match, analysis, resolution, and tournaments

Boundary concern:

1. the file mixes `arena match lifecycle` and `tournament lifecycle`
2. that makes the browser boundary broader than the server authority split

### `src/components/arena/ChartPanel.svelte`

Owns:

1. chart mount and controller integration
2. drawing interactions and overlays
3. live price updates
4. trade drag events
5. scan/chat/community dispatch events
6. multiple chart runtimes and controller wiring

Boundary concern:

1. this is still a large hybrid component
2. it is doing view work, runtime orchestration, and action dispatch from one surface

### View and panel components

Current role:

1. `Lobby`, `SquadConfig`, `WarRoomPanel`, `ResultPanel`, and the arena view components consume page-level state and callbacks
2. they are mostly presentation surfaces, but many important actions are still issued from the route shell

Boundary concern:

1. the route still owns the real orchestration
2. these components have not yet become a clean composition over narrower runtimes

## 4. Current Server-Zone Inventory

## 4.1 Arena match lifecycle routes

Current route set:

1. [arena/match](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/arena/match/+server.ts)
2. [arena/match/[id]](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/arena/match/[id]/+server.ts)
3. [arena/draft](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/arena/draft/+server.ts)
4. [arena/analyze](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/arena/analyze/+server.ts)
5. [arena/hypothesis](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/arena/hypothesis/+server.ts)
6. [arena/resolve](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/arena/resolve/+server.ts)

Supporting service:

1. [arenaService.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/arenaService.ts)

Current responsibility:

1. match creation and listing
2. draft validation and persistence
3. analysis-result persistence
4. hypothesis persistence
5. match resolution and result persistence

Boundary concern:

1. the route and service layer are present, but the page still duplicates much of the lifecycle choreography locally
2. `resolve` also triggers progression as a side effect, which widens the boundary

## 4.2 War Room route

Current route:

1. [arena/match/[id]/warroom](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/arena/match/[id]/warroom/+server.ts)

Current responsibility:

1. auth and rate limit
2. match lookup
3. analysis prerequisite validation
4. war-room round generation

Boundary verdict:

1. this is a distinct generation boundary
2. it should remain separate from core match lifecycle state

## 4.3 Tournament routes

Current route set:

1. [tournaments/active](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/tournaments/active/+server.ts)
2. [tournaments/[id]/register](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/tournaments/[id]/register/+server.ts)
3. [tournaments/[id]/bracket](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/tournaments/[id]/bracket/+server.ts)

Supporting service:

1. [tournamentService.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/tournamentService.ts)

Current responsibility:

1. active tournament listing
2. registration
3. bracket retrieval

Boundary concern:

1. tournaments are already a separate server boundary
2. `tournamentService.ts` includes in-memory fallback behavior, which is useful for development but means durable tournament authority is not always guaranteed

## 4.4 Engine and simulation layer

Shared engine files used across local and server arena flows:

1. [battleResolver.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/engine/battleResolver.ts)
2. [v2BattleEngine.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/engine/v2BattleEngine.ts)
3. [v3BattleEngine.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/engine/v3BattleEngine.ts)

Boundary concern:

1. arena simulation rules are already separate from route files
2. but the page still binds those rules into a large local controller instead of a narrower session runtime

## 5. Authority Split

Current authorities are already different:

1. local current-session authority in [gameState.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/gameState.ts)
2. durable match truth in `arena_matches`
3. war-room generation authority in `warRoomService`
4. tournament authority in `tournamentService`
5. progression authority as a downstream side effect of resolve

Important conclusion:

1. `arena` is not one backend service
2. it is a local-first session shell over several server-side authorities
3. the redesign should preserve that split instead of flattening everything into one page controller or one backend blob

## 6. Boundary Verdict

What is already good:

1. persisted match routes and services already exist
2. war-room generation is already separated from match CRUD
3. tournament routes are already separate from arena match routes
4. local runtime state already has a dedicated store
5. simulation rules already live outside the route

What is not good enough:

1. [arena/+page.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/arena/+page.svelte) is still a 3,000+ line hybrid controller
2. local-first fallback means server and local match lifecycle can drift
3. [arenaApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/arenaApi.ts) mixes tournaments with matches
4. [ChartPanel.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/arena/ChartPanel.svelte) remains a large hybrid runtime/view component
5. `resolve` currently owns an arena result write and a progression side effect in one request path

## 7. Specific Boundary Problems

1. [arena/+page.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/arena/+page.svelte) continues the match locally when create/draft server sync fails, which means persisted match lifecycle is optional at runtime.
2. [arena/+page.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/arena/+page.svelte) directly owns timers, replay, compare, result presentation, chart drag handling, and server lifecycle calls in one place.
3. [arenaApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/arenaApi.ts) mixes `/api/arena/*` and `/api/tournaments/*` even though those are different server boundaries.
4. [resolve/+server.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/arena/resolve/+server.ts) triggers [progressionUpdater](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/progressionUpdater.ts) as a side effect, coupling arena resolution to profile progression.
5. [tournamentService.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/tournamentService.ts) contains memory-backed fallback behavior, which is useful for resilience but weakens the meaning of tournament persistence as a strict authority.
6. [ChartPanel.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/arena/ChartPanel.svelte) dispatches scan, chat, and community actions in addition to chart interaction, which broadens the arena view boundary.

## 8. Required Internal Split

Before any physical FE/BE extraction, this slice should be treated as five internal boundaries:

1. `arena-session-runtime`
   - owns local match phase choreography, timers, replay, and presentation
   - durable only for the current browser session
2. `arena-match-lifecycle`
   - owns persisted match creation, draft submit, analysis persistence, hypothesis submit, and resolution
   - durable truth in `arena_matches`
3. `arena-warroom-generation`
   - owns round-based debate generation from match context
4. `arena-tournaments`
   - owns active tournament listing, registration, and bracket reads
5. `arena-progression-side-effects`
   - owns LP and profile progression updates after match resolution
   - should be explicit as a downstream consumer, not hidden inside arena semantics

## 9. Refactor Tasks Before Physical Extraction

1. split [arenaApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/arenaApi.ts) into `arenaMatchApi.ts` and `tournamentApi.ts`
2. keep [gameState.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/gameState.ts) as local session authority, but stop treating it as an interchangeable substitute for persisted match truth
3. move more of [arena/+page.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/arena/+page.svelte) into explicit runtimes so the route becomes composition instead of orchestration
4. continue peeling runtime/controller work out of [ChartPanel.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/arena/ChartPanel.svelte)
5. make the local-first fallback explicit in contracts: either persisted match lifecycle is required or the app deliberately supports offline/local-only arena sessions
6. separate progression update dispatch from [resolve/+server.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/arena/resolve/+server.ts) into a clearer downstream event or service boundary
7. keep tournaments as a separate surface instead of folding them into general arena match transport

## 10. Extraction Readiness Criteria

This slice is ready for physical extraction only when:

1. local arena session runtime is explicitly separate from persisted match lifecycle
2. browser transport separates match APIs from tournament APIs
3. chart interaction and arena presentation do not own unrelated action dispatch
4. progression side effects are explicit and detachable from match resolution
5. war-room generation remains its own server boundary
6. local-only fallback behavior is either formalized or removed

## 11. Immediate Next Step

The next slice should be `global shell / notifications / activity`.

Reason:

1. arena, terminal, passport, and signals now all depend on shared shell state and cross-surface notifications
2. `ui-state`, activity events, and notification surfaces are still spread across page-specific flows
3. after that slice, the remaining FE/BE split map will be much closer to a stable `web / api / worker` extraction plan
