# Global Shell / Notifications / Activity Boundary Inventory

Date: 2026-03-07  
Status: active design slice  
Scope: `/Users/ej/Downloads/maxidoge-clones/frontend`

## 1. Slice Goal

This is the ninth real internal split slice.

Goal:

1. make the cross-surface app shell clearly separable inside the current `frontend` app
2. keep layout composition, viewport chrome, local toast behavior, and global price-feed runtime in the `web zone`
3. keep durable notifications, durable activity feed, and shared UI-shell persistence in the `server zone`
4. define which parts of the current shell are true persisted product state versus local presentation/runtime helpers

This slice comes after `arena / predictions / match orchestration` because every major surface now depends on the same shell, notification, and activity layer.

## 2. Current Flow Summary

There is not one shell flow today. There are five.

## 2.1 Global app shell flow

`+layout.svelte -> Header.svelte / BottomBar.svelte / WalletModal / NotificationTray / ToastStack`

Implication:

1. the top-level layout is the composition root for cross-surface chrome
2. it is also where several global runtimes start

## 2.2 Global price-feed and shell runtime flow

`+layout.svelte -> binance api wrappers -> priceStore + gameState currentView sync`

Implication:

1. the shell starts the global market feed
2. shell runtime and market runtime are currently coupled in the layout layer

## 2.3 Cross-surface hydration flow

`Header.svelte -> hydrateAuthSession + hydrateDomainStores -> quick trades + tracked signals + profile + community + notifications`

Implication:

1. the header is not only a visual shell component
2. it also boots several domain stores for the rest of the app

## 2.4 Notifications flow

`NotificationTray.svelte / notificationStore.ts -> notificationsApi.ts -> /api/notifications* -> user_notifications`

Implication:

1. durable notifications are server-backed
2. but the store also owns non-durable toast and P0 state

## 2.5 Activity flow

`many route handlers -> INSERT activity_events -> /api/activity -> shell-adjacent consumers`

Implication:

1. activity is a cross-domain audit/feed surface
2. writes are currently scattered across many route handlers rather than going through one service boundary

## 3. Current Web-Zone Inventory

## 3.1 Browser-facing entry points

Primary shell files:

1. [+layout.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/+layout.svelte)
2. [Header.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/layout/Header.svelte)
3. [BottomBar.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/layout/BottomBar.svelte)
4. [NotificationTray.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/shared/NotificationTray.svelte)
5. [ToastStack.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/shared/ToastStack.svelte)

Primary shell/state helpers:

1. [notificationStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/notificationStore.ts)
2. [hydration.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/hydration.ts)
3. [preferencesApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/preferencesApi.ts)
4. [notificationsApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/notificationsApi.ts)

Adjacent stores consumed by shell:

1. [gameState.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/gameState.ts)
2. [priceStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/priceStore.ts)
3. [walletStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/walletStore.ts)
4. [quickTradeStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/quickTradeStore.ts)
5. [trackedSignalStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/trackedSignalStore.ts)

## 3.2 Web responsibilities today

### `src/routes/+layout.svelte`

Owns:

1. app shell composition
2. URL-to-`currentView` sync into `gameState`
3. global Binance REST bootstrap
4. global Binance websocket mini-ticker subscription
5. global price flush timers
6. viewport-dependent shell chrome hiding

Boundary concern:

1. this file is a global shell controller and a market-data runtime at the same time
2. shell composition and price-feed orchestration should eventually be separate concerns

### `src/components/layout/Header.svelte`

Owns:

1. primary navigation chrome
2. wallet connect button and auth session bootstrap
3. domain-store hydration bootstrap through [hydrateDomainStores](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/hydration.ts)
4. mobile tab strip behavior
5. selected pair ticker display

Boundary concern:

1. header is not just presentation
2. it currently acts as a bootstrap controller for auth and several domain stores

### `src/components/layout/BottomBar.svelte`

Owns:

1. cross-surface status bar for positions, tracked signals, selected pair, and LP
2. navigation shortcuts into other surfaces

Boundary verdict:

1. this is mostly presentation over adjacent read models
2. it is a good shell-consumer component and should stay that way

### `src/components/shared/NotificationTray.svelte`

Owns:

1. tray open/close UI
2. notification hydration on mount
3. simulated seed notification trigger
4. mark-read, mark-all-read, clear-all, and dismiss UI actions

Boundary concern:

1. this component is both a view and a bootstrap point
2. `seedNotifications()` means a shell mount can create demo notifications with server writes, which is not a clean boundary

### `src/components/shared/ToastStack.svelte`

Owns:

1. local toast rendering
2. local auto-dismiss timers

Boundary verdict:

1. this is a clean local presentation runtime
2. it should remain web-only and not be mixed with durable notification authority

### `src/lib/stores/notificationStore.ts`

Owns:

1. persisted notification list hydration and optimistic CRUD
2. local toast list
3. local P0 override state
4. helper notification generators for trades, signals, matches, and alerts
5. seeded demo notifications

Boundary concern:

1. this is a major hybrid store
2. it mixes durable `user_notifications`, ephemeral `toasts`, local `p0Override`, and demo seeding behavior
3. that makes it impossible to treat it as one clean authority boundary

### `src/lib/stores/hydration.ts`

Owns:

1. cross-domain bootstrap for quick trades and tracked signals
2. delayed background hydration for profile, match history, agent stats, community, and notifications

Boundary concern:

1. this is a shell-level boot coordinator over many domains
2. notifications are bundled into generic domain hydration rather than isolated as their own shell slice

## 4. Current Server-Zone Inventory

## 4.1 Notifications routes

Current route set:

1. [notifications](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/notifications/+server.ts)
2. [notifications/read](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/notifications/read/+server.ts)
3. [notifications/[id]](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/notifications/[id]/+server.ts)

Current responsibility:

1. notification list read
2. notification creation
3. notification read-state mutation
4. notification deletion

Boundary verdict:

1. this is already a real durable notification boundary around `user_notifications`
2. but it is wrapped by a browser store that mixes in unrelated local concerns

## 4.2 Activity routes

Current route set:

1. [activity](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/activity/+server.ts)
2. [activity/reaction](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/activity/reaction/+server.ts)

Current responsibility:

1. activity feed read
2. explicit reaction event write

Boundary concern:

1. this route surface is small
2. but actual `activity_events` writes are scattered across many unrelated API handlers rather than going through one shared service

Observed write spread includes:

1. preferences updates
2. terminal scan
3. chat messages
4. quick-trade adjacent prediction routes
5. signal actions
6. community post reactions
7. copy-trade publish
8. Polymarket auth and submit
9. arena-war

## 4.3 Shared UI-shell persistence route

Current route:

1. [ui-state](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/ui-state/+server.ts)

Current responsibility:

1. terminal panel widths and tabs
2. passport active tab
3. signals filter
4. oracle period and sort

Boundary concern:

1. this is a cross-surface shell persistence boundary
2. it is adjacent to, but distinct from, both notifications and activity

## 5. Authority Split

Current durable authorities are already different:

1. shell composition and global price runtime in the browser
2. `user_notifications`
3. `activity_events`
4. `user_ui_state`
5. ephemeral `toasts`
6. local `p0Override`

Important conclusion:

1. `global shell` is not one authority
2. the redesign should keep `shell runtime`, `durable notifications`, `durable activity`, and `ui shell persistence` separate
3. only the browser should own toasts and other purely ephemeral presentation signals

## 6. Boundary Verdict

What is already good:

1. notifications already have dedicated CRUD routes
2. activity already has a dedicated read route
3. toast rendering is already purely local UI
4. bottom bar is mostly a read-only shell consumer

What is not good enough:

1. `+layout.svelte` mixes shell composition with global market-feed runtime
2. `Header.svelte` mixes navigation chrome with domain bootstrap
3. `notificationStore.ts` mixes persisted and ephemeral concerns
4. demo seeding writes into the real notifications API
5. activity writes are decentralized and ungoverned
6. `ui-state` is a shared shell boundary but is not described or consumed that way

## 7. Specific Boundary Problems

1. [notificationStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/notificationStore.ts) combines persisted notifications, toasts, P0 override, helper generators, and seed behavior in one store.
2. [NotificationTray.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/shared/NotificationTray.svelte) runs `seedNotifications()` on mount, which can create fake notifications through the durable notifications API.
3. [Header.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/layout/Header.svelte) triggers both auth-session hydration and cross-domain store hydration, making a layout component responsible for application bootstrap.
4. [+layout.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/+layout.svelte) owns shell composition and the global Binance feed, which are separate concerns.
5. [activity_events](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/activity/+server.ts) is read through one route, but writes are scattered across many domain routes with no shared activity service or envelope.
6. [ui-state](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/ui-state/+server.ts) stores cross-surface shell state but lives conceptually hidden under preferences-style browser transport.

## 8. Required Internal Split

Before any physical FE/BE extraction, this slice should be treated as five internal boundaries:

1. `app-shell-runtime`
   - owns layout composition, responsive chrome, and global shell mount behavior
2. `market-shell-runtime`
   - owns global Binance bootstrap and websocket fan-in into `priceStore`
3. `notifications-durable`
   - owns `user_notifications` read/write state and tray consumption
4. `activity-feed`
   - owns `activity_events` read model and standardized write envelope
5. `shell-ui-persistence`
   - owns shared `user_ui_state` fields for cross-surface shell state

Ephemeral `toasts` and `p0Override` should stay explicitly outside the durable boundaries.

## 9. Refactor Tasks Before Physical Extraction

1. split [notificationStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/notificationStore.ts) into separate stores or modules for persisted notifications, ephemeral toasts, and P0 local state
2. remove durable demo seeding from [NotificationTray.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/shared/NotificationTray.svelte) or move it to a clearly non-production-only path
3. move auth/domain bootstrap responsibilities out of [Header.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/layout/Header.svelte) into a dedicated shell runtime
4. move Binance global feed orchestration out of [+layout.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/+layout.svelte) into a dedicated shell-market runtime
5. add a shared activity writer service so domain routes stop inserting into `activity_events` ad hoc
6. split client transport for `ui-state` from broader preferences transport so shell persistence is explicit
7. keep [ToastStack.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/shared/ToastStack.svelte) local-only and independent from durable notification hydration

## 10. Extraction Readiness Criteria

This slice is ready for physical extraction only when:

1. shell runtime is separate from global market runtime
2. header no longer acts as a bootstrap controller
3. durable notifications are separated from ephemeral toasts and P0 state
4. activity writes go through a defined server boundary instead of scattered direct inserts
5. shared UI-shell persistence is documented and transported as its own contract
6. demo or seed notification behavior cannot mutate production durable notification state by accident

## 11. Immediate Next Step

The next step should not be another slice inventory first.

It should be a consolidation pass over the inventories already written:

1. normalize repeated boundary names
2. extract the cross-slice target structure
3. build the final phased migration map from `frontend internal split` to `web / api / worker`

Reason:

1. the major user-facing slices are now inventoried
2. the next high-value move is turning those per-slice findings into one executable extraction sequence
