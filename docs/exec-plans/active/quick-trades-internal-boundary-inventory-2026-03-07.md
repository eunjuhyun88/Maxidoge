# Quick Trades Internal Boundary Inventory

Date: 2026-03-07  
Status: active design slice  
Scope: `/Users/ej/Downloads/maxidoge-clones/frontend`

## 1. Slice Goal

This is the third real internal split slice.

Goal:

1. make `quick-trades` clearly separable inside the current `frontend` app
2. keep trade UX, optimistic staging, and route/component consumption in the `web zone`
3. keep durable trade truth, mutation ordering, and trade-side effects in the `server zone`
4. define how adjacent flows such as `tracked-signal convert` and `copy-trade publish` are allowed to create quick trades

This slice comes after `profile/preferences` because profile projection already consumes `quick_trades`.

## 2. Current Flow Summary

There is not one quick-trade flow today. There are three.

## 2.1 Core quick-trade flow

`WarRoom / IntelPanel / BottomPanel / passport/live consumers -> quickTradeStore -> tradingApi.ts -> /api/quick-trades/* -> quick_trades`

## 2.2 Signal-convert flow

`trackedSignalStore.convertToTrade(...) -> /api/signals/[id]/convert -> tracked_signals + quick_trades`

## 2.3 Copy-trade publish flow

`copyTradeStore.publishSignal() -> /api/copy-trades/publish -> copy_trade_runs + tracked_signals + quick_trades`

Implication:

1. `quick_trades` is the durable trade table
2. `quickTradeStore` is not the only writer
3. the slice boundary must account for adjacent writers, not only `/api/quick-trades/*`

## 3. Current Web-Zone Inventory

## 3.1 Browser-facing entry points

Primary web files:

1. [tradingApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/tradingApi.ts)
2. [quickTradeStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/quickTradeStore.ts)
3. [hydration.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/hydration.ts)
4. [livePriceSyncService.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/services/livePriceSyncService.ts)
5. [WarRoom.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/terminal/WarRoom.svelte)
6. [BottomPanel.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/terminal/BottomPanel.svelte)
7. [IntelPanel.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/terminal/IntelPanel.svelte)

Adjacent mutation issuers:

1. [trackedSignalStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/trackedSignalStore.ts)
2. [copyTradeStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/copyTradeStore.ts)

Read-only or display-heavy consumers:

1. [passport/+page.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/passport/+page.svelte)
2. [signals/+page.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/signals/+page.svelte)
3. [LivePanel.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/live/LivePanel.svelte)
4. [BottomBar.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/layout/BottomBar.svelte)

## 3.2 Web responsibilities today

### `src/lib/api/tradingApi.ts`

Owns:

1. browser transport wrappers for quick trades
2. browser transport wrappers for tracked signals
3. browser transport wrapper for copy-trade publish
4. local transport DTOs such as `ApiQuickTrade`

Boundary quality:

1. good: browser calls go through one transport layer
2. not good enough: the file mixes three adjacent domains
3. not good enough: DTOs remain wrapper-local instead of shared contracts

### `src/lib/stores/quickTradeStore.ts`

Owns:

1. optimistic open and close mutation staging
2. server hydration and duplicate reconciliation
3. localStorage persistence
4. local current-price and pnl updates
5. server price-sync batching
6. `showPanel` UI state

Boundary concern:

1. the store is both durable-cache mirror and UI state holder
2. it reconciles ids and merges unsynced local trades with server records
3. that makes it a hybrid cache/orchestrator rather than a thin state mirror

### `src/lib/stores/hydration.ts`

Owns:

1. coordinated hydration entry for quick trades and tracked signals
2. live-price sync bootstrap

Boundary concern:

1. quick-trade hydration is coupled to tracked-signal hydration
2. that is operationally useful, but it hides the slice boundary

### `src/lib/services/livePriceSyncService.ts`

Owns:

1. local price application to quick trades
2. local price application to tracked signals
3. periodic server persistence of quick-trade prices

Boundary concern:

1. current quick-trade mark price is browser-driven
2. server persistence is periodic and derived from browser snapshots
3. this is a real boundary decision, not implementation detail

### `src/components/terminal/WarRoom.svelte`

Owns:

1. quick-trade initiation from scan results
2. tracked-signal initiation from scan results
3. copy-trade modal entry

Boundary concern:

1. War Room is a UI consumer and action issuer only
2. trade authority must not live here

### `src/components/terminal/BottomPanel.svelte`

Owns:

1. quick-trade close action
2. tracked-signal to trade conversion action
3. trade/tracked activity presentation

Boundary concern:

1. one panel currently drives both trade mutations and signal conversion
2. this makes the interaction surface wider than the underlying authority boundary

### `src/components/terminal/IntelPanel.svelte`

Owns:

1. quick-trade hydration call
2. quick-trade close action
3. adjacent position/market displays

Boundary concern:

1. quick-trades and broader positions are separate domains
2. this panel consumes both

### `src/lib/stores/trackedSignalStore.ts`

Owns adjacent quick-trade writes through:

1. `convertToTrade(...)`
2. fallback `openQuickTradeApi(...)` when server signal id is not yet resolved

Boundary concern:

1. tracked signals are not quick-trade authority
2. but they currently create quick trades directly through both local optimism and server mutation

### `src/lib/stores/copyTradeStore.ts`

Owns adjacent quick-trade writes through:

1. optimistic local `openQuickTrade(...)`
2. optimistic local `trackSignal(...)`
3. one combined `publishCopyTradeApi(...)`
4. id reconciliation for both signal and trade

Boundary concern:

1. copy-trade publish is not only a signal flow
2. it is a multi-entity mutation envelope that creates a quick trade as part of one atomic action

## 4. Current Server-Zone Inventory

## 4.1 Core quick-trade routes

Current quick-trade route set:

1. [quick-trades GET](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/quick-trades/+server.ts)
2. [quick-trades open](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/quick-trades/open/+server.ts)
3. [quick-trades close](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/quick-trades/[id]/close/+server.ts)
4. [quick-trades prices](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/quick-trades/prices/+server.ts)

## 4.2 Adjacent quick-trade writers

Routes outside `/api/quick-trades/*` that still write `quick_trades`:

1. [signals convert](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/signals/[id]/convert/+server.ts)
2. [copy-trades publish](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/copy-trades/publish/+server.ts)

## 4.3 Supporting server modules

Primary supporting files:

1. [authGuard.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/authGuard.ts)
2. [apiValidation.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/apiValidation.ts)
3. [requestGuards.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/requestGuards.ts)
4. [rateLimit.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/rateLimit.ts)
5. [authSecurity.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/authSecurity.ts)
6. [passportOutbox.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/passportOutbox.ts)
7. [profileProjection.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/profileProjection.ts)
8. [ragService.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/ragService.ts)

There is no dedicated `quickTradeService` yet. Route files still carry most mutation logic directly.

## 4.4 Server responsibilities today

### `quick-trades/+server.ts`

Owns:

1. authenticated trade list retrieval
2. pagination
3. optional status filtering
4. row-to-response mapping

### `quick-trades/open/+server.ts`

Owns:

1. authenticated open-trade mutation
2. request guard and rate limit
3. validation of pair, dir, entry, tp, sl
4. direct `quick_trades` insert
5. passport outbox event for open
6. fire-and-forget RAG write

### `quick-trades/[id]/close/+server.ts`

Owns:

1. authenticated close-trade mutation
2. request guard and rate limit
3. transaction and row lock (`FOR UPDATE`)
4. server-side pnl calculation
5. direct `quick_trades` close mutation
6. passport outbox event for close
7. fire-and-forget RAG write
8. profile projection sync

### `quick-trades/prices/+server.ts`

Owns:

1. authenticated bulk current-price updates
2. update-by-trade-id path
3. update-by-base-symbol path
4. server-side pnl recomputation

This is a persistence path for mark price, not an open/close mutation.

### `signals/[id]/convert/+server.ts`

Owns adjacent quick-trade creation:

1. tracked-signal lookup
2. `quick_trades` insert from signal
3. `tracked_signals` status transition to `converted`
4. `signal_actions` insert

This route writes quick trades but does not currently mirror all side effects of `/api/quick-trades/open`.

### `copy-trades/publish/+server.ts`

Owns adjacent multi-entity publish:

1. idempotent copy-trade run handling
2. `quick_trades` insert
3. `tracked_signals` insert
4. `copy_trade_runs` insert
5. `signal_actions` insert
6. `activity_events` insert
7. passport outbox event for copy trade
8. profile projection sync

This route writes a quick trade as part of a broader publish envelope.

## 5. Authority Split

The actual authority split today is:

1. `quick_trades`
   - durable truth for trade identity, status, entry, tp/sl, current price, close pnl
2. `quickTradeStore`
   - optimistic browser cache, hydration/reconcile layer, and panel state
3. `tracked_signals`
   - separate durable signal truth that can convert into a quick trade
4. `copy_trade_runs`
   - durable publish/run truth that can create a quick trade
5. `profileProjection.ts`
   - downstream consumer of quick-trade outcomes, not trade authority

Implication:

1. quick-trade truth is server-side
2. quick-trade creation is not owned by one route surface
3. extraction later must preserve both `trade authority` and `adjacent trade writers`

## 6. Boundary Verdict

## 6.1 What is already good

1. browser transport is centralized in `tradingApi.ts`
2. core open and close flows are authenticated and rate-limited
3. close flow already uses transaction + row lock
4. server list API is explicit and paginated
5. hydration merge attempts to reconcile optimistic local trades with server trades
6. server recalculates pnl on price and close updates

## 6.2 What is not good enough yet

1. `quickTradeStore.ts` still persists durable-looking trade state to localStorage
2. `quickTradeStore.ts` mixes trade cache with `showPanel` UI state
3. `tradingApi.ts` mixes quick-trades, tracked-signals, and copy-trades in one wrapper
4. quick-trade creation has three write paths with inconsistent side effects
5. `quick-trades/prices/+server.ts` uses raw `request.json()` instead of guarded body parsing
6. `signals/[id]/convert/+server.ts` also uses raw `request.json()`
7. response mapping is duplicated across multiple transport files
8. current price persistence depends on browser snapshots rather than a dedicated server market authority

## 7. Specific Boundary Problems

## 7.1 Trade cache versus trade truth

`quickTradeStore.ts` currently does all of these:

1. load from localStorage
2. auto-save to localStorage
3. optimistic open/close
4. id reconciliation
5. merge unsynced local trades with server truth
6. carry presentation state

This means it is not just a cache. It is a local mutation coordinator.

## 7.2 Mutation fan-out with inconsistent side effects

Trade creation side effects are not unified today.

### `/api/quick-trades/open`

Currently emits:

1. `quick_trades` insert
2. passport outbox event
3. RAG write

### `/api/signals/[id]/convert`

Currently emits:

1. `quick_trades` insert
2. tracked-signal status change
3. signal action

It does not currently mirror the passport/RAG/profile side effects of the core path.

### `/api/copy-trades/publish`

Currently emits:

1. `quick_trades` insert
2. `tracked_signals` insert
3. `copy_trade_runs` insert
4. activity and passport events
5. profile sync

It does not use the core quick-trade mutation route or a shared quick-trade service.

## 7.3 Price authority is only partially server-owned

`livePriceSyncService.ts` applies prices locally on every tick and only periodically persists them to the server.

That means:

1. local quick-trade pnl is browser-driven moment to moment
2. server quick-trade pnl becomes authoritative only after sync
3. the slice needs an explicit policy for mark-price truth

## 7.4 Close payload still leaks authority

`quick-trades/[id]/close/+server.ts` correctly recomputes `pnlPercent` server-side, but it still accepts optional `closePnl` from the client and persists it if supplied.

That is an authority leak:

1. close outcome should be derived by server rules
2. the client should not be able to override final `close_pnl`

## 7.5 API boundary is wider than the UI needs

`BottomPanel.svelte` and `IntelPanel.svelte` both issue quick-trade mutations directly, while `trackedSignalStore.ts` and `copyTradeStore.ts` also create trades.

This makes it harder to say:

1. who owns the mutation order
2. who owns rollback
3. who owns deterministic reconciliation

## 8. Required Internal Split

Inside `frontend`, this slice should be treated as:

### Web side

1. `src/lib/api/tradingApi.ts`
2. `src/lib/stores/quickTradeStore.ts`
3. `src/lib/stores/hydration.ts`
4. `src/lib/services/livePriceSyncService.ts`
5. terminal/passport/live display consumers

### Adjacent web mutation sidecars

1. `src/lib/stores/trackedSignalStore.ts`
2. `src/lib/stores/copyTradeStore.ts`

These are not the quick-trade authority layer, but they are allowed mutation issuers.

### Server side

1. `src/routes/api/quick-trades/*`
2. `src/routes/api/signals/[id]/convert/+server.ts`
3. `src/routes/api/copy-trades/publish/+server.ts`
4. auth, validation, outbox, profile, and rag helpers

### Contract side

Must be split out logically first:

1. `QuickTradePayload`
2. `QuickTradeListResponse`
3. `OpenQuickTradePayload`
4. `CloseQuickTradePayload`
5. `QuickTradePriceSyncPayload`
6. `QuickTradeMutationResult`
7. shared error envelope

## 9. Refactor Tasks Before Physical Extraction

## T1. Contract freeze

Move quick-trade DTOs to a transport-safe contract location.

Must include:

1. list response shape
2. open request/response shape
3. close request/response shape
4. price-sync request/response shape
5. convert-to-trade outcome shape where it returns quick-trade data

## T2. Service split inside server zone

Break current behavior into clearer server-side services:

1. `quickTradeReadService`
   - list and map trades
2. `quickTradeMutationService`
   - open and close trade
   - compute server-owned outcome fields
3. `quickTradePriceService`
   - apply explicit or ticker-map mark-price updates
4. `quickTradeSideEffectService`
   - passport outbox
   - rag writes
   - profile sync

Handlers should become thin adapters over these services.

## T3. Mutation unification

All quick-trade creation paths should converge on one server-side mutation layer.

Target:

1. direct open uses shared quick-trade service
2. signal convert uses shared quick-trade service
3. copy-trade publish uses shared quick-trade service
4. side effects become consistent and explicit

## T4. Price-authority clarification

Define whether mark-price persistence belongs to:

1. browser-driven sync only
2. server market-data authority
3. hybrid cache model

At minimum:

1. server should remain final authority for persisted pnl
2. client should not be allowed to override final `close_pnl`

## T5. Store thinning

Move UI-only concerns out of `quickTradeStore.ts`.

Target:

1. trade store = cache + reconcile logic
2. panel visibility = separate UI state
3. route/component = presentation only

## T6. Wrapper decomposition

Split `tradingApi.ts` logically or physically so quick trades stop sharing one wrapper file with unrelated domains.

Likely target:

1. `quickTradesApi`
2. `trackedSignalsApi`
3. `copyTradesApi`

## 10. Extraction Readiness Criteria

This slice is ready for physical FE/BE extraction only when:

1. quick-trade DTOs live outside wrapper and route files
2. all quick-trade creation paths use one shared server mutation service
3. `quickTradeStore.ts` is explicitly secondary to server truth
4. localStorage trade cache is clearly non-authoritative
5. final close outcome is fully server-owned
6. price-sync policy is explicit
7. UI panel state is no longer mixed into trade authority state

## 11. Immediate Next Step

After this doc, the next correct slice is:

1. `signals/copy-trades/community`

Reason:

1. `quick-trades` already has adjacent mutation fan-out into signal convert and copy-trade publish
2. `signals` and `copy-trades` currently share transport and optimistic mutation boundaries with quick trades
3. the next extraction decision is not only about trades, but about multi-entity publish and social action envelopes
