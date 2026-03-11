# Terminal / Market / Intel Interaction Boundary Inventory

Date: 2026-03-07  
Status: active design slice  
Scope: `/Users/ej/Downloads/maxidoge-clones/frontend`

## 1. Slice Goal

This is the fifth real internal split slice.

Goal:

1. make `terminal` clearly separable as an interaction shell inside the current `frontend` app
2. keep route composition, panel orchestration, runtime state, and viewport behavior in the `web zone`
3. keep scan execution, intel aggregation, chat generation, and market-data authority in the `server zone`
4. define which actions inside terminal are first-party terminal concerns versus handoffs into adjacent slices such as quick trades, tracked signals, community, positions, and copy-trades

This slice comes after `signals / copy-trades / community` because terminal is the main action issuer into those already-inventoried slices.

## 2. Current Flow Summary

`terminal` is not one domain flow today. It is an orchestration shell over several server authorities.

## 2.1 Terminal scan flow

`WarRoom.svelte -> terminalApi.runTerminalScan / getScanHistory / getScanDetail -> /api/terminal/scan* -> scanService.ts -> terminal_scan_runs + terminal_scan_signals`

## 2.2 Intel feed and policy flow

`IntelPanel.svelte -> intelApi.ts -> /api/market/news + /api/market/events + /api/market/flow + /api/market/trending + /api/terminal/opportunity-scan + /api/terminal/intel-policy + /api/terminal/intel-agent-shadow`

## 2.3 Chat flow

`IntelChatSection -> terminalChatRuntime.ts -> terminalApi.sendTerminalChatMessage -> /api/chat/messages -> scan-context lookup + agent routing + llmService.ts + agent_chat_messages`

## 2.4 Shell market ticker flow

`terminalShellRuntime.ts -> terminalApi.getTerminalLiveTicker -> /api/feargreed + /api/coingecko/global`

Important implication:

1. terminal ticker truth is currently assembled in the browser
2. this is different from `/api/market/snapshot`, which already exists as a server-composed market snapshot boundary

## 2.5 Adjacent action handoff flow

`terminalActionRuntime.ts / terminalCommunityRuntime.ts / WarRoom.svelte / IntelPanel.svelte -> quickTradeStore / trackedSignalStore / copyTradeStore / communityStore / positionStore`

Important implication:

1. terminal issues actions into adjacent slices
2. terminal should not be treated as the durable owner of trades, signals, community posts, or positions

## 3. Current Web-Zone Inventory

## 3.1 Browser-facing entry points

Primary shell files:

1. [terminal/+page.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/terminal/+page.svelte)
2. [terminalActionRuntime.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/terminal/terminalActionRuntime.ts)
3. [terminalChatRuntime.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/terminal/terminalChatRuntime.ts)
4. [terminalShellRuntime.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/terminal/terminalShellRuntime.ts)
5. [terminalSessionRuntime.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/terminal/terminalSessionRuntime.ts)
6. [terminalScanRuntime.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/terminal/terminalScanRuntime.ts)
7. [terminalMessageRuntime.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/terminal/terminalMessageRuntime.ts)
8. [terminalCommunityRuntime.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/terminal/terminalCommunityRuntime.ts)
9. [terminalPanelRuntime.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/terminal/terminalPanelRuntime.ts)
10. [terminalLayoutRuntime.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/terminal/terminalLayoutRuntime.ts)
11. [terminalEngagementRuntime.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/terminal/terminalEngagementRuntime.ts)

Primary terminal consumers:

1. [WarRoom.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/terminal/WarRoom.svelte)
2. [IntelPanel.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/terminal/IntelPanel.svelte)
3. [TerminalDesktopLayout.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/terminal/TerminalDesktopLayout.svelte)
4. [TerminalTabletLayout.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/terminal/TerminalTabletLayout.svelte)
5. [TerminalMobileLayout.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/terminal/TerminalMobileLayout.svelte)

Primary browser transport files:

1. [terminalApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/terminalApi.ts)
2. [intelApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/intelApi.ts)

Adjacent stores consumed by terminal:

1. [gameState](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/gameState.ts)
2. [priceStore](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/priceStore.ts)
3. [quickTradeStore](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/quickTradeStore.ts)
4. [trackedSignalStore](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/trackedSignalStore.ts)
5. [copyTradeStore](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/copyTradeStore.ts)
6. [communityStore](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/communityStore.ts)
7. [positionStore](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/positionStore.ts)

## 3.2 Web responsibilities today

### `src/routes/terminal/+page.svelte`

Owns:

1. runtime composition
2. shared panel props assembly
3. panel ref wiring
4. viewport shell switching
5. lifecycle mount and destroy for shell/layout runtimes

Boundary verdict:

1. good: after refactor, the route is mostly an orchestration shell
2. good: it no longer fetches server data directly
3. not good enough: it still wires adjacent action boundaries together in one place

### `src/lib/terminal/terminalActionRuntime.ts`

Owns:

1. decision-rail action routing
2. war-room scan request handoff
3. chart-panel pattern scan handoff
4. trade-plan drawing handoff
5. mobile tab auto-switch behavior

Boundary concern:

1. this runtime is correctly a web-only orchestrator
2. it must remain an issuer of actions, not the owner of scan/chat/trade truth

### `src/lib/terminal/terminalChatRuntime.ts`

Owns:

1. chat request assembly from current pair, timeframe, live prices, and latest scan
2. chat UI optimistic append
3. offline fallback reply selection
4. chat-trade readiness toggles

Boundary concern:

1. it is correctly a browser-side interaction runtime
2. but it still has to know too much about scan context and trade readiness because the server chat boundary is broad

### `src/lib/terminal/terminalShellRuntime.ts`

Owns:

1. live ticker load on mount
2. alert engine lifecycle
3. `/terminal?copyTrade=1...` URL bootstrap parsing
4. copy-trade draft handoff

Boundary concern:

1. this runtime is web-only, which is correct
2. but market ticker data is assembled in the browser from multiple endpoints instead of using one server-composed contract

### `src/lib/terminal/terminalSessionRuntime.ts`

Owns:

1. scan state
2. chat trade-readiness state
3. chat connection state
4. active trade setup state

Boundary concern:

1. this is local runtime state only
2. it should stay separate from server DTOs and server persistence

### `src/lib/terminal/terminalScanRuntime.ts`

Owns:

1. scan start UI state
2. scan complete state transitions
3. chat seed messages derived from scan completion
4. chart show-on-chart handoff

Boundary concern:

1. this runtime is correctly post-scan UI choreography
2. it must not become a second scan authority beside `scanService.ts`

### `src/lib/api/terminalApi.ts`

Owns:

1. browser wrappers for terminal scan endpoints
2. browser wrappers for chat message transport
3. browser wrappers for market snapshot and ticker support
4. response DTOs for scan and chat

Boundary concern:

1. the file mixes `scan`, `chat`, and `market` transport in one browser surface
2. it imports scan DTO types from [scanService.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/services/scanService.ts), which is a server implementation file rather than a shared contract layer
3. this is a real internal boundary leak even though the import is type-only

### `src/lib/api/intelApi.ts`

Owns:

1. browser wrappers for news, events, flow, trending, onchain, opportunity scan, policy, and shadow routes
2. client-side envelope parsing
3. wrapper-local DTOs for several intel feeds

Boundary concern:

1. this file is a mixed transport boundary over many subdomains
2. it hides the fact that `IntelPanel.svelte` actually fans out into several independent server authorities

### `src/components/terminal/WarRoom.svelte`

Owns:

1. scan tab state
2. scan history merge between local state and server history
3. auto-run scan on entry
4. derivatives polling runtime
5. quick-trade, track-signal, copy-trade, show-on-chart, and share-to-community action issuance

Boundary concern:

1. this component is still a hybrid of presentation, persistence, polling, and adjacent action orchestration
2. it is not the durable owner of scans, derivatives, trades, or community posts
3. it should ultimately become a view over narrower runtimes and domain APIs

### `src/components/terminal/IntelPanel.svelte`

Owns:

1. chat tab UI
2. headlines, events, flow, onchain, trending, and picks fetch cycles
3. policy and shadow fetch cycles
4. shadow execution handoff
5. position synchronization and display
6. terminal UI-state persistence through `/api/ui-state`

Boundary concern:

1. this is currently the biggest hybrid in the terminal slice
2. it mixes intel feeds, positions, policy, shadow execution, and persisted UI state
3. it is a clear candidate for further internal split before any physical extraction

## 4. Current Server-Zone Inventory

## 4.1 Terminal scan routes

Current route set:

1. [terminal scan](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/terminal/scan/+server.ts)
2. [terminal scan history](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/terminal/scan/history/+server.ts)
3. [terminal scan detail](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/terminal/scan/[id]/+server.ts)
4. [terminal scan signals](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/terminal/scan/[id]/signals/+server.ts)
5. [terminal compare](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/terminal/compare/+server.ts)

## 4.2 Intel and terminal aggregation routes

Current route set:

1. [terminal opportunity scan](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/terminal/opportunity-scan/+server.ts)
2. [terminal intel policy](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/terminal/intel-policy/+server.ts)
3. [terminal intel agent shadow](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/terminal/intel-agent-shadow/+server.ts)
4. [terminal intel shadow execute](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/terminal/intel-agent-shadow/execute/+server.ts)

Supporting upstream routes frequently used by terminal:

1. [chat messages](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/chat/messages/+server.ts)
2. [market snapshot](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/market/snapshot/+server.ts)
3. [feargreed](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/feargreed/+server.ts)
4. [coingecko global](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/coingecko/global/+server.ts)
5. [market news](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/market/news/+server.ts)
6. [market events](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/market/events/+server.ts)
7. [market flow](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/market/flow/+server.ts)
8. [market trending](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/market/trending/+server.ts)

## 4.3 Supporting server modules

Primary supporting files:

1. [scanService.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/services/scanService.ts)
2. [scanEngine.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/scanEngine.ts)
3. [llmService.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/llmService.ts)
4. [multiTimeframeContext.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/multiTimeframeContext.ts)
5. [intelPolicyRuntime.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/intelPolicyRuntime.ts)
6. [intelShadowAgent.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/intelShadowAgent.ts)
7. [marketSnapshotService.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/marketSnapshotService.ts)
8. [marketFeedService.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/marketFeedService.ts)
9. [ragService.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/ragService.ts)
10. [requestGuards.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/requestGuards.ts)
11. [authGuard.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/authGuard.ts)

## 4.4 Server responsibilities today

### `src/lib/services/scanService.ts`

Owns:

1. scan request normalization
2. scan execution choice between `runServerScan` and `runLLMScan`
3. `terminal_scan_runs` persistence
4. `terminal_scan_signals` persistence
5. scan history lookup
6. scan detail lookup
7. scan signal lookup

Boundary verdict:

1. this is the real server authority for terminal scans
2. this is already a useful service seam for future extraction

### `terminal/scan/+server.ts`

Owns:

1. rate limit and IP guard
2. auth or guest determination
3. request guard on scan input
4. activity-event write
5. fire-and-forget RAG write

Boundary concern:

1. the route is relatively thin, which is good
2. but it still layers activity and RAG side effects directly on top of `scanService.ts`

### `terminal/scan/history`, `terminal/scan/[id]`, `terminal/scan/[id]/signals`

Own:

1. auth gate
2. read-side transport over `scanService.ts`
3. warning propagation when persistence tables are unavailable

Boundary verdict:

1. these are already thin read-side handlers
2. this is the desired shape for future physical extraction

### `chat/messages/+server.ts`

Owns:

1. auth and guest-mode handling
2. request parsing and validation
3. chat message persistence
4. scan-context lookup from `terminal_scan_runs` and `terminal_scan_signals`
5. agent mention routing and intent routing
6. MTF context lookup
7. LLM prompt construction and fallback handling
8. agent response persistence

Boundary concern:

1. this route is currently too large to be a clean transport layer
2. it is simultaneously transport, orchestration, retrieval, prompt building, fallback, and persistence
3. it needs a dedicated server service boundary before physical extraction

### `llmService.ts`

Owns:

1. provider selection and fallback
2. provider-specific request formats
3. common LLM call contract
4. terminal agent prompt helpers used by chat

Boundary verdict:

1. this is a valid server-only boundary
2. it should remain server-only and not leak into browser contracts

### `terminal/intel-policy/+server.ts`

Owns:

1. pair and timeframe normalization
2. response caching and request coalescing
3. aggregation of market news, events, flow, trending, and opportunity scan
4. intel policy output assembly

Boundary concern:

1. this is a useful aggregator boundary
2. but it currently fans out by calling other internal HTTP routes instead of directly using server services
3. that makes physical extraction and testing harder than necessary

### `terminal/opportunity-scan/+server.ts`

Owns:

1. server-side result caching
2. request coalescing
3. ranked opportunity scan execution
4. best-effort DB persistence of scan results

Boundary verdict:

1. this is already a distinct server boundary
2. terminal should consume it, not own it

### `terminal/intel-agent-shadow/+server.ts`

Owns:

1. cached shadow decision construction
2. shadow decision build over `intel-policy`
3. execution-enabled capability exposure

Boundary concern:

1. like `intel-policy`, it depends on internal route-to-route fetch instead of direct service calls
2. it is still an aggregator boundary, not a leaf service

### `terminal/intel-agent-shadow/execute/+server.ts`

Owns:

1. auth gate
2. shadow decision evaluation
3. quick-trade open handoff
4. shadow execution guardrails

Boundary concern:

1. this route crosses from terminal intel into the quick-trade slice
2. it currently does so by calling `/api/quick-trades/open` over HTTP
3. this is a clean product handoff conceptually, but not yet a clean internal service boundary

### `market/snapshot/+server.ts`

Owns:

1. server-composed market snapshot collection
2. auth-aware persistence flag
3. request guarding and rate limit

Boundary concern:

1. this is already the right kind of server market boundary
2. but terminal shell ticker is currently not using it

## 5. Authority Split

The actual authority split today is:

1. `scanService.ts` + `terminal_scan_runs` + `terminal_scan_signals`
   - source of terminal scan truth
2. `chat/messages/+server.ts` + `agent_chat_messages`
   - source of terminal chat persistence and agent reply generation
3. `market/*` routes + `opportunity-scan` + `intel-policy`
   - source of intel feed and market aggregation truth
4. `quick_trades`, `tracked_signals`, `community_posts`, `copy_trade_runs`, and positions tables
   - adjacent authorities terminal interacts with but does not own
5. `user_ui_state`
   - source of terminal intel tab/view persistence, not terminal domain truth
6. terminal runtimes and route shell
   - browser orchestration only, not durable authority

Implication:

1. `terminal` is an orchestration surface, not one durable backend domain
2. physical extraction later must split by authority, not by page route

## 6. Boundary Verdict

## 6.1 What is already good

1. [terminal/+page.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/terminal/+page.svelte) is now mostly a shell rather than a fetch-heavy god route
2. `scanService.ts` already exists as a real server service seam
3. scan read routes are already thin handlers over the service layer
4. terminal runtimes now isolate layout, session, scan, message, shell, and community choreography
5. chat POST already uses guarded request-body parsing

## 6.2 What is not good enough yet

1. `terminalApi.ts` and `intelApi.ts` each mix several domain transports
2. `terminalApi.ts` depends on a server implementation file for DTO types
3. browser ticker composition and server market snapshot composition are inconsistent
4. `WarRoom.svelte` is still a hybrid of UI, local persistence, derivatives polling, and adjacent action issuance
5. `IntelPanel.svelte` is still a hybrid of intel feeds, positions, policy, shadow execution, and UI-state persistence
6. `chat/messages/+server.ts` is too broad to be a clean transport layer
7. `intel-policy` and `intel-agent-shadow` still aggregate via internal HTTP fan-out
8. `intel-agent-shadow/execute` crosses into quick-trades via route-to-route HTTP instead of a service-level handoff

## 7. Specific Boundary Problems

## 7.1 Browser transport is too mixed

Current state:

1. [terminalApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/terminalApi.ts) mixes scan, chat, and market transport
2. [intelApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/intelApi.ts) mixes feeds, policy, shadow, and opportunity scan transport

Implication:

1. browser zone does not yet express terminal sub-boundaries explicitly
2. future extraction will be cleaner if browser transport is split into `terminalScanApi`, `terminalChatApi`, and `terminalIntelApi`

## 7.2 Scan DTOs leak from server implementation into browser wrapper

Current state:

1. [terminalApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/terminalApi.ts) imports `TerminalScanSummary`, `TerminalScanDetail`, and `TerminalScanSignal`
2. those types live in [scanService.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/services/scanService.ts)

Implication:

1. the browser contract is coupled to a server implementation file
2. these DTOs belong in a shared contract layer, not inside the server service

## 7.3 Market snapshot path is inconsistent

Current state:

1. terminal shell ticker uses [getTerminalLiveTicker](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/terminalApi.ts), which composes `/api/feargreed` and `/api/coingecko/global` in the browser
2. the project also has [market/snapshot/+server.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/market/snapshot/+server.ts), which already assembles market snapshot server-side

Implication:

1. there are two competing market aggregation boundaries
2. terminal should choose one canonical market snapshot contract

## 7.4 `WarRoom.svelte` is still a hybrid controller

Current state:

1. it restores and persists local scan-tab state
2. it merges server history into local tabs
3. it auto-runs scans
4. it starts derivatives polling
5. it issues quick-trade, tracked-signal, copy-trade, and community-share actions

Implication:

1. terminal scan UX is still partly hidden inside one component
2. this should be narrowed into scan-state, derivatives, and action-handoff runtimes

## 7.5 `IntelPanel.svelte` is still a hybrid controller

Current state:

1. it fetches news, events, flow, onchain, trending, opportunity scan, policy, and shadow data
2. it persists UI state via `/api/ui-state`
3. it consumes positions and quick-trade state
4. it can execute shadow-trade handoff

Implication:

1. the component crosses too many server and client boundaries at once
2. this is the main remaining frontend split candidate inside the terminal slice

## 7.6 `chat/messages/+server.ts` is too fat

Current state:

1. it handles guest/auth
2. it loads scan context
3. it infers agent routing
4. it builds prompts
5. it calls the LLM
6. it persists both user and agent messages

Implication:

1. the transport boundary and server intelligence boundary are still fused
2. physical extraction will be easier only after a dedicated `terminalChatService` or similar exists

## 7.7 Internal HTTP fan-out hides true service seams

Current state:

1. [intel-policy/+server.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/terminal/intel-policy/+server.ts) calls other internal routes with `fetch`
2. [intel-agent-shadow/+server.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/terminal/intel-agent-shadow/+server.ts) calls `intel-policy` through HTTP
3. [intel-agent-shadow/execute/+server.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/terminal/intel-agent-shadow/execute/+server.ts) calls `/api/quick-trades/open` through HTTP

Implication:

1. route handlers currently stand in for service boundaries
2. extraction should move this fan-out to direct server services instead

## 8. Required Internal Split

Inside the current `frontend`, terminal should be treated as five linked but distinct internal boundaries:

1. `terminal shell boundary`
   - route shell
   - layout and viewport runtimes
   - panel refs and tab routing
2. `terminal scan boundary`
   - war-room scan request and history UX
   - `/api/terminal/scan*`
   - `scanService.ts`
3. `terminal intel boundary`
   - news, events, flow, trending, opportunity scan, policy, shadow
   - `IntelPanel.svelte` and `intelApi.ts` consumers
4. `terminal chat boundary`
   - intel chat UX
   - `/api/chat/messages`
   - `llmService.ts` and scan-context retrieval
5. `adjacent action handoff boundary`
   - quick trade
   - tracked signal
   - community share
   - copy trade
   - positions and execution

Recommended internal layering:

1. web zone
   - terminal route shell
   - panel runtimes
   - view models
   - narrow browser transport wrappers
2. contract zone
   - scan DTOs
   - chat message DTOs
   - market snapshot and intel policy DTOs
3. server zone
   - thin route handlers
   - `scanService`, `terminalChatService`, `terminalIntelService`, `marketSnapshotService`
   - adjacent domain services for quick trades, positions, and community

## 9. Refactor Tasks Before Physical Extraction

Required tasks:

1. move scan DTO types out of `scanService.ts` into a shared contract layer
2. split `terminalApi.ts` into scan/chat/market wrappers
3. split `intelApi.ts` into narrower terminal-intel wrappers if policy/shadow remain separate boundaries
4. choose one canonical market snapshot path for terminal ticker and intel shell
5. extract a dedicated server service from `chat/messages/+server.ts`
6. move `intel-policy` and `intel-agent-shadow` off internal route-to-route HTTP fan-out
7. define `shadow execute` as a service-level handoff into quick-trades rather than an endpoint-to-endpoint fetch
8. further split `WarRoom.svelte` into scan-state, derivatives, and action-handoff boundaries
9. further split `IntelPanel.svelte` into feed/policy/chat/positions/ui-state sub-boundaries
10. keep terminal runtimes as orchestration-only and prevent them from becoming new data authorities

## 10. Extraction Readiness Criteria

This slice is ready for physical extraction only when all of the following are true:

1. terminal browser wrappers no longer import server implementation types
2. scan, chat, and intel each have distinct browser transport boundaries
3. `chat/messages` has a dedicated service boundary underneath the route handler
4. `intel-policy` and `intel-agent-shadow` aggregate through server services rather than internal HTTP
5. terminal uses one canonical market snapshot contract
6. `WarRoom.svelte` and `IntelPanel.svelte` no longer behave like hybrid authority holders
7. terminal action handoffs into quick trades, positions, and community are explicit cross-domain contracts

## 11. Immediate Next Step

The next slice should be `positions / portfolio / execution boundary inventory`.

Reason:

1. terminal now clearly reads and issues actions into positions and execution surfaces
2. after terminal orchestration is mapped, the next unresolved authority is the execution and portfolio layer it depends on
