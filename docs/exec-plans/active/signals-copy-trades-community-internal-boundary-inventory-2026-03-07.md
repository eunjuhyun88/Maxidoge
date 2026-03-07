# Signals / Copy Trades / Community Internal Boundary Inventory

Date: 2026-03-07  
Status: active design slice  
Scope: `/Users/ej/Downloads/maxidoge-clones/frontend`

## 1. Slice Goal

This is the fourth real internal split slice.

Goal:

1. make `community`, `signals track`, and `copy-trade publish` separable inside the current `frontend` app
2. keep feed UX, optimistic interaction state, and route/component consumption in the `web zone`
3. keep durable social-trading mutations, reaction truth, and side-effect ordering in the `server zone`
4. define which parts are plain community feed concerns versus multi-entity trading actions

This slice comes after `quick-trades` because the current social-trading flow already writes both `tracked_signals` and `quick_trades`.

## 2. Current Flow Summary

There is not one social flow today. There are three overlapping flows.

## 2.1 Community feed flow

`signals/+page.svelte -> communityStore.ts -> communityApi.ts -> /api/community/posts + /api/community/posts/[id]/react -> community_posts + community_post_reactions`

## 2.2 Terminal share flow

`terminal chart / AI signal -> terminalCommunityRuntime.ts -> SignalPostForm.svelte -> communityStore.addCommunityPost(...) -> /api/community/posts -> then local trackSignal(...)`

Important implication:

1. community post creation and tracked-signal creation are not one atomic server action
2. the browser currently stitches them together after the post succeeds

## 2.3 Copy-trade publish flow

`signals route / copyTradeStore.ts -> tradingApi.publishCopyTradeApi(...) -> /api/copy-trades/publish -> copy_trade_runs + tracked_signals + quick_trades + signal_actions + activity_events`

Important implication:

1. `copy-trade publish` is already a multi-entity server mutation envelope
2. it is stronger than the terminal share flow in terms of durability and side-effect ordering

## 3. Current Web-Zone Inventory

## 3.1 Browser-facing entry points

Primary web files:

1. [communityApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/communityApi.ts)
2. [communityStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/communityStore.ts)
3. [SignalPostForm.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/community/SignalPostForm.svelte)
4. [SignalPostCard.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/community/SignalPostCard.svelte)
5. [terminalCommunityRuntime.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/terminal/terminalCommunityRuntime.ts)
6. [signals/+page.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/signals/+page.svelte)

Adjacent browser files that also belong to this slice:

1. [copyTradeStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/copyTradeStore.ts)
2. [trackedSignalStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/trackedSignalStore.ts)
3. [tradingApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/tradingApi.ts)

## 3.2 Web responsibilities today

### `src/lib/api/communityApi.ts`

Owns:

1. browser transport wrappers for feed list, post create, react, and unreact
2. local DTOs such as `ApiCommunityPost` and `SignalAttachment`
3. the browser-visible `signalAttachment.evidence` contract

Boundary quality:

1. good: community transport is centralized
2. not good enough: DTOs still live inside the wrapper file
3. not good enough: browser contract already includes `evidence`, but the current server canonical path does not preserve it

### `src/lib/stores/communityStore.ts`

Owns:

1. localStorage persistence for community posts
2. feed hydration from server records
3. optimistic temp-post insertion
4. optimistic reaction toggling
5. temp-id replacement after create

Boundary concern:

1. the store is both feed cache and optimistic mutation orchestrator
2. it persists a server-backed feed locally
3. it allows browser-only optimistic posts to briefly contain richer data than the durable server record

### `src/components/community/SignalPostForm.svelte`

Owns:

1. evidence-first signal sharing UX
2. `SignalAttachment` assembly
3. `SignalEvidence` collection and preview
4. submit into `addCommunityPost(...)`

Boundary concern:

1. the form already treats structured `evidence` as part of the product contract
2. that means server canonical storage dropping `evidence` is a real boundary bug, not a cosmetic omission

### `src/components/community/SignalPostCard.svelte`

Owns:

1. feed-card rendering
2. evidence rendering from `signalAttachment.evidence`
3. reaction, track, and copy-trade CTA surface
4. display of `copyCount`

Boundary concern:

1. the card assumes `evidence` and `copyCount` are canonical feed fields
2. the current server paths only partially uphold that assumption

### `src/lib/terminal/terminalCommunityRuntime.ts`

Owns:

1. share modal open/prefill from terminal chart or AI signal
2. terminal-side attachment construction
3. post-submit browser follow-up via `trackSignal(...)`
4. notification and tracked-signal count increments after post

Boundary concern:

1. terminal share is not one durable server action today
2. browser code currently sequences `community_post` first and `tracked_signal` second
3. if the second step fails, feed and tracked-signal state diverge

### `src/routes/signals/+page.svelte`

Owns:

1. feed, trending, and AI tabs
2. community feed hydration
3. client-side trending sort using `likes + copyCount`
4. track CTA from feed cards
5. copy-trade handoff by redirecting to `/terminal?copyTrade=1...`

Boundary concern:

1. this route is not a pure community page
2. it mixes server-backed feed records with client-derived leaderboard and action handoff behavior
3. it is a discovery surface, not the durable authority for any one entity

### `src/lib/stores/copyTradeStore.ts`

Owns adjacent social-trading writes through:

1. optimistic local `openQuickTrade(...)`
2. optimistic local `trackSignal(...)`
3. canonical `publishCopyTradeApi(...)`
4. local-to-server id reconciliation for trade and signal

Boundary concern:

1. this store is not only UI state
2. it is the browser-side entry for a server-atomic trading publish envelope
3. it sits at the boundary between community discovery and durable trade execution

### `src/lib/stores/trackedSignalStore.ts`

Owns adjacent social-trading writes through:

1. optimistic local `trackSignal(...)`
2. async background sync through `/api/signals/track`
3. id replacement from local optimistic signal to server signal

Boundary concern:

1. `trackedSignalStore` is both optimistic UX state and mutation issuer
2. terminal share currently depends on this store to finish what community post creation started

## 4. Current Server-Zone Inventory

## 4.1 Community routes

Current route set:

1. [community posts](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/community/posts/+server.ts)
2. [community post react](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/community/posts/[id]/react/+server.ts)

## 4.2 Social-trading routes adjacent to community

Routes outside `/api/community/*` that still belong to this slice:

1. [signals track](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/signals/track/+server.ts)
2. [copy-trades publish](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/copy-trades/publish/+server.ts)
3. [copy-trades runs](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/copy-trades/runs/+server.ts)
4. [copy-trades run detail](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/copy-trades/runs/[id]/+server.ts)

## 4.3 Supporting server modules

Primary supporting files:

1. [authGuard.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/authGuard.ts)
2. [apiValidation.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/apiValidation.ts)
3. [requestGuards.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/requestGuards.ts)
4. [passportOutbox.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/passportOutbox.ts)
5. [profileProjection.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/profileProjection.ts)

There is still no dedicated `communityService` or `socialTradingService`. Route files carry most mutation logic directly.

## 4.4 Server responsibilities today

### `community/posts/+server.ts`

Owns:

1. feed list retrieval
2. optional `signal` filtering
3. optional `userReacted` enrichment using auth cookie
4. community post insert
5. activity event write for `community_posted`

Boundary concern:

1. this route is the durable owner of `community_posts`
2. but it currently validates only a reduced `signalAttachment` shape
3. it drops `evidence` even though browser inputs and card rendering already depend on it

### `community/posts/[id]/react/+server.ts`

Owns:

1. authenticated reaction add/remove
2. `community_post_reactions` mutation
3. recalculation of `community_posts.likes`
4. activity event write for reaction add

Boundary concern:

1. reaction truth is server-side and correct in principle
2. request parsing still uses raw `request.json().catch(...)`
3. the route does not update or explain `copy_count`

### `signals/track/+server.ts`

Owns:

1. authenticated tracked-signal insert
2. `signal_actions` write for `track`
3. profile projection sync
4. passport outbox event for tracked signal

Boundary concern:

1. this is the durable owner of standalone tracked-signal creation
2. terminal share currently uses it as a browser follow-up instead of using one server envelope
3. request parsing still uses raw `request.json()`

### `copy-trades/publish/+server.ts`

Owns:

1. authenticated publish mutation
2. guarded request body read
3. idempotency via `clientMutationId`
4. `quick_trades` insert
5. `tracked_signals` insert
6. `copy_trade_runs` insert
7. `signal_actions` write for `copy_trade`
8. activity event write
9. passport outbox event
10. profile projection sync

Boundary verdict:

1. this is already the strongest server boundary in the slice
2. it is the likely model for future server-side social publish envelopes

### `copy-trades/runs/*`

Owns:

1. published run history lookup
2. audit/debug visibility into copy-trade outcomes

Boundary concern:

1. this is read-side operational support
2. it should remain read-only if the slice is physically extracted later

## 5. Authority Split

The actual authority split today is:

1. `community_posts`
   - source of durable feed records, attachment payload, likes, comments, copy count, and allow-copy flag
2. `community_post_reactions`
   - source of per-user reaction truth
3. `tracked_signals`
   - source of durable tracked-signal truth
4. `quick_trades`
   - source of durable copy-trade trade truth
5. `copy_trade_runs`
   - source of durable social-trading publish audit history
6. `communityStore`
   - browser cache plus optimistic feed layer, not durable authority
7. `trackedSignalStore`
   - browser cache plus optimistic signal layer, not durable authority
8. `signals/+page.svelte`
   - presentation and routing surface, not durable authority

Implication:

1. `community` is not the same thing as `tracked_signals`
2. `tracked_signals` is not the same thing as `copy_trade_runs`
3. physical extraction later must keep feed ownership and social-trading mutation ownership separate, even if both live in one API service

## 6. Boundary Verdict

## 6.1 What is already good

1. browser transport is mostly centralized through `communityApi.ts` and `tradingApi.ts`
2. `copy-trades/publish` already uses guarded parsing and idempotent mutation semantics
3. reaction truth and feed likes are server-owned rather than purely local
4. `signals/+page.svelte` no longer creates posts directly and pushes creation back to terminal
5. terminal share prefill is already localized in `terminalCommunityRuntime.ts`

## 6.2 What is not good enough yet

1. `communityStore.ts` persists server-backed feed state to localStorage
2. `community/posts/+server.ts` drops `signalAttachment.evidence`
3. terminal share is still `community post` first and `tracked signal` second
4. `copyCount` is surfaced to cards and ranking, but no write path was found for incrementing it
5. `signals/track/+server.ts` and `community/posts/[id]/react/+server.ts` still use raw `request.json()`
6. `tradingApi.ts` still mixes tracked-signal, quick-trade, and copy-trade DTOs in one browser transport file
7. `signals/+page.svelte` mixes feed ownership assumptions with client-derived discovery surfaces

## 7. Specific Boundary Problems

## 7.1 Evidence contract mismatch

Current mismatch:

1. [SignalPostForm.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/community/SignalPostForm.svelte) assembles `SignalAttachment.evidence`
2. [communityApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/communityApi.ts) exposes `evidence` on the browser DTO
3. [SignalPostCard.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/community/SignalPostCard.svelte) renders that evidence
4. [community/posts/+server.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/community/posts/+server.ts) does not validate, store, or map `evidence`

Implication:

1. optimistic local post shape is richer than server canonical post shape
2. after hydration, a user can lose evidence that was visible at submit time
3. contract freeze must happen before physical extraction

## 7.2 Non-atomic terminal share flow

Current behavior:

1. terminal share creates a `community_post`
2. browser callback then calls `trackSignal(...)`
3. browser then increments user counters and notifications

Implication:

1. social share is split across two durable authorities
2. partial success is possible
3. if the tracked-signal step fails, community feed and user tracking state diverge

## 7.3 `copyCount` lacks an identified writer

Observed behavior:

1. feed cards display `copyCount`
2. trending ranking multiplies by `copyCount`
3. `community/posts/+server.ts` reads and returns `copy_count`
4. no server write path was found that increments `copy_count`

Implication:

1. feed ranking is using a field whose mutation boundary is currently undefined
2. future extraction must either define that writer explicitly or remove `copyCount` from ranking until it is real

## 7.4 Mixed discovery surface in `signals/+page.svelte`

Current route shape:

1. feed tab uses durable community records
2. trending tab derives rank locally from feed data
3. AI tab renders `OracleLeaderboard`
4. copy-trade CTA redirects into terminal bootstrap

Implication:

1. the route is a discovery shell, not one domain owner
2. extraction should not treat `/signals` as the backend boundary
3. the boundary is the underlying feed and trading action APIs, not the route

## 7.5 Mixed transport surface in `tradingApi.ts`

Current file shape:

1. quick-trades transport
2. tracked-signals transport
3. copy-trades transport

Implication:

1. browser zone already knows three server slices through one file
2. contract extraction later will be cleaner if `community`, `signals`, and `copy-trades` DTOs stop living in the same wrapper

## 8. Required Internal Split

Inside the current `frontend`, this slice should be treated as three linked but distinct boundaries:

1. `community feed boundary`
   - list posts
   - create post
   - react and unreact
   - own canonical attachment contract
2. `tracked signal boundary`
   - create tracked signals
   - convert or expire tracked signals elsewhere
   - own standalone signal action contract
3. `social trading publish boundary`
   - atomically create the durable entities required for copy/share style publish flows
   - own idempotency and side-effect ordering

Recommended internal layering:

1. web zone
   - route/view logic
   - optimistic stores
   - modal/runtime orchestration
2. contract zone
   - `CommunityPost`, `SignalAttachment`, `SignalEvidence`, `CopyTradeRun`, publish result DTOs
3. server zone
   - thin route handlers
   - dedicated `communityService` and `socialTradingService`
   - DB mutations and side-effect ordering

## 9. Refactor Tasks Before Physical Extraction

Required tasks:

1. freeze one canonical `SignalAttachment` contract and include `evidence` server-side
2. decide whether `terminal share` should become one server mutation envelope instead of `post -> track`
3. define the canonical writer for `community_posts.copy_count`
4. move `community/posts/[id]/react` and `signals/track` to guarded request-body readers
5. split browser transport so `communityApi`, `signalsApi`, and `copyTradesApi` are not all hidden inside `tradingApi.ts`
6. separate `communityStore` feed cache concerns from persistent local UX concerns if localStorage is kept
7. treat `/signals` as a discovery route only, not as domain authority
8. introduce a dedicated server service for social publish ordering so route files stop carrying mutation choreography directly

## 10. Extraction Readiness Criteria

This slice is ready for physical extraction only when all of the following are true:

1. browser post/share/copy flows use shared contracts rather than wrapper-local DTOs
2. `SignalAttachment.evidence` survives round-trip through the server canonical record
3. terminal share mutation ordering is explicitly server-owned or explicitly accepted as two-step eventual consistency
4. `copyCount` mutation ownership is defined
5. `community`, `signals`, and `copy-trades` browser wrappers are separated by domain
6. route files become thin transport handlers over dedicated server services

## 11. Immediate Next Step

The next slice should be `terminal / market / intel interaction boundary inventory`.

Reason:

1. terminal is the main issuer of social, signal, and trade actions
2. after this slice, the main remaining problem is not only data ownership
3. it is action orchestration across multiple already-identified server boundaries
