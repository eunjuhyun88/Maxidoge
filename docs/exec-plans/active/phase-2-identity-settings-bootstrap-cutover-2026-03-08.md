# Phase 2 Identity / Settings / Bootstrap Cutover

Date: 2026-03-08  
Status: active design authority  
Scope: `/Users/ej/Downloads/maxidoge-clones/frontend`

## 1. Purpose

This document turns the Phase 2 line in the redesign blueprint into an executable cutover design.

Phase 2 is the first real backend cutover group because it owns:

1. authenticated identity
2. durable account projection
3. durable preferences and persisted view state
4. durable notifications and activity feed writes
5. shell bootstrap hydration used by the rest of the app

Primary sources:

1. [full-system-redesign-blueprint-2026-03-08.md](/Users/ej/Downloads/maxidoge-clones/frontend/docs/exec-plans/active/full-system-redesign-blueprint-2026-03-08.md#L1)
2. [phase-0-boundary-freeze-checklist-2026-03-08.md](/Users/ej/Downloads/maxidoge-clones/frontend/docs/exec-plans/active/phase-0-boundary-freeze-checklist-2026-03-08.md#L1)
3. [phase-1-contract-catalog-2026-03-07.md](/Users/ej/Downloads/maxidoge-clones/frontend/docs/exec-plans/active/phase-1-contract-catalog-2026-03-07.md#L1)
4. [auth-session-internal-boundary-inventory-2026-03-07.md](/Users/ej/Downloads/maxidoge-clones/frontend/docs/exec-plans/active/auth-session-internal-boundary-inventory-2026-03-07.md#L1)
5. [profile-preferences-internal-boundary-inventory-2026-03-07.md](/Users/ej/Downloads/maxidoge-clones/frontend/docs/exec-plans/active/profile-preferences-internal-boundary-inventory-2026-03-07.md#L1)
6. [global-shell-notifications-activity-boundary-inventory-2026-03-07.md](/Users/ej/Downloads/maxidoge-clones/frontend/docs/exec-plans/active/global-shell-notifications-activity-boundary-inventory-2026-03-07.md#L1)

## 1.1 Status Snapshot

Already landed in the current monolith:

1. `notifications` contracts now live in [notifications.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/contracts/notifications.ts#L1)
2. `activity` contracts and wrapper seam now live in [activity.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/contracts/activity.ts#L1) and [activityApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/activityApi.ts#L1)
3. durable notifications, toasts, and P0 override now live in separate stores under `src/lib/stores`
4. [NotificationTray.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/shared/NotificationTray.svelte#L1) no longer seeds demo notifications by default during hydration
5. authenticated session authority now lives in [authSessionStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/authSessionStore.ts#L1) instead of [walletStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/walletStore.ts#L1)
6. profile projection and client-derived profile metrics now split across [userProfileProjectionStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/userProfileProjectionStore.ts#L1), [userProfileDerivedStatsStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/userProfileDerivedStatsStore.ts#L1), and the compatibility aggregate [userProfileStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/userProfileStore.ts#L1)
7. read-only shell consumers such as [routes/+page.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/+page.svelte#L1), [ContextBanner.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/shared/ContextBanner.svelte#L1), and [LivePanel.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/live/LivePanel.svelte#L1) no longer depend on the wide compatibility `userProfileStore` surface when they only need projection-level data or no profile data at all

Still blocking full Phase 2 cutover:

1. [walletStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/walletStore.ts#L1) still mirrors some auth-facing fields for compatibility and has not yet fully shed that compatibility layer
2. `profile` still exposes a compatibility aggregate surface for deeper screens like [passport/+page.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/passport/+page.svelte#L1)
3. core route handlers still own too much inline SQL and mapping logic

## 2. Core Decision

Phase 2 is not:

1. moving every route under `profile/**`
2. moving all notification-like UI into the backend
3. moving `passport` learning workers early

Phase 2 is:

1. isolate cookie and session authority
2. isolate account/profile/projection authority
3. isolate durable preferences and persisted UI-state authority
4. isolate durable notifications and activity-feed authority
5. leave browser shell, modal flow, and toast UX in `web`

## 3. Validated Current Scope

## 3.1 Core route handlers in scope now

Validated core Phase 2 handler count: `16`

Included handlers:

1. [activity/+server.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/activity/+server.ts#L1)
2. [activity/reaction/+server.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/activity/reaction/+server.ts#L1)
3. [auth/login/+server.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/auth/login/+server.ts#L1)
4. [auth/logout/+server.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/auth/logout/+server.ts#L1)
5. [auth/nonce/+server.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/auth/nonce/+server.ts#L1)
6. [auth/register/+server.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/auth/register/+server.ts#L1)
7. [auth/session/+server.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/auth/session/+server.ts#L1)
8. [auth/verify-wallet/+server.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/auth/verify-wallet/+server.ts#L1)
9. [auth/wallet/+server.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/auth/wallet/+server.ts#L1)
10. [notifications/+server.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/notifications/+server.ts#L1)
11. [notifications/[id]/+server.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/notifications/[id]/+server.ts#L1)
12. [notifications/read/+server.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/notifications/read/+server.ts#L1)
13. [preferences/+server.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/preferences/+server.ts#L1)
14. [profile/+server.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/profile/+server.ts#L1)
15. [profile/passport/+server.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/profile/passport/+server.ts#L1)
16. [ui-state/+server.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/ui-state/+server.ts#L1)

## 3.2 Browser edges in scope now

Wrappers:

1. [auth.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/auth.ts#L1)
2. [profileApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/profileApi.ts#L1)
3. [preferencesApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/preferencesApi.ts#L1)
4. [notificationsApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/notificationsApi.ts#L1)

Primary stores and shell consumers:

1. [walletStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/walletStore.ts#L1)
2. [userProfileStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/userProfileStore.ts#L1)
3. [notificationStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/notificationStore.ts#L1)
4. [Header.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/layout/Header.svelte#L1)
5. [NotificationTray.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/shared/NotificationTray.svelte#L1)
6. [ContextBanner.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/shared/ContextBanner.svelte#L1)
7. [settings/+page.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/settings/+page.svelte#L1)
8. [passport/+page.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/passport/+page.svelte#L1)

## 3.3 Explicitly excluded from Phase 2

These routes were matched by path scanning but should not move in this cutover:

1. `profile/passport/learning/**`
2. `positions/polymarket/auth`

Reason:

1. `passport/learning/**` is Phase 6 worker territory
2. `positions/polymarket/auth` belongs with venue execution, not identity/settings

## 4. Current Problems That Block Clean Cutover

## 4.1 Auth is now split at the store layer, but wallet compatibility remains

Validated now:

1. [auth.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/auth.ts#L1) still normalizes legacy `success` envelopes into contract shapes locally
2. [authSessionStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/authSessionStore.ts#L1) now owns authenticated session hydration and cookie-backed identity state
3. [walletStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/walletStore.ts#L1) now behaves as wallet/modal shell state and mirrors auth state only for compatibility

Implication:

Phase 2 no longer needs to invent a new auth-session store.
It now needs to finish removing compatibility-only auth fields from wallet consumers over time.

1. server-derived session mirror
2. browser-only wallet connection and modal flow

## 4.2 Profile projection and derived metrics are now split, but the compatibility aggregate remains

Validated now:

1. [userProfileProjectionStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/userProfileProjectionStore.ts#L1) now owns cached server projection and optimistic profile edits
2. [userProfileDerivedStatsStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/userProfileDerivedStatsStore.ts#L1) now owns client-derived metrics from [matchHistoryStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/matchHistoryStore.ts#L1)
3. [userProfileStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/userProfileStore.ts#L1) is now the compatibility aggregate that merges those layers for existing consumers
4. projection-only reads such as badge/tier access now have direct exports on [userProfileProjectionStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/userProfileProjectionStore.ts#L1)

Implication:

Phase 2 no longer needs to perform the first projection/derived split.
It now needs to keep trimming direct consumers toward the narrower stores where useful.

1. server profile projection
2. server passport projection
3. client-derived profile overlays
4. local cache and fallback semantics

## 4.3 Preferences and UI state are adjacent but not the same authority

Validated now:

1. [preferencesApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/preferencesApi.ts#L1) carries both `preferences` and `ui-state`
2. [ui-state/+server.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/ui-state/+server.ts#L1) persists layout and tab selections
3. [settings/+page.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/settings/+page.svelte#L1) reads durable preferences
4. [passport/+page.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/passport/+page.svelte#L537) hydrates UI state for tab selection

Implication:

The transport layer may stay adjacent, but the server cutover must keep two services:

1. user preferences persistence
2. persisted UI-state persistence

## 4.4 Notifications are partially untangled, but server normalization is still legacy

Validated now:

1. [notificationsApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/notificationsApi.ts#L1) now consumes notification contracts instead of locally owning the DTO
2. durable notifications now live in [notificationsStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/notificationsStore.ts#L1)
3. ephemeral toasts now live in [toastStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/toastStore.ts#L1)
4. P0 state now lives in [p0OverrideStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/p0OverrideStore.ts#L1)
5. [NotificationTray.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/shared/NotificationTray.svelte#L1) no longer seeds demo notifications during default hydration

Implication:

Phase 2 no longer needs to split the browser store boundary first.
It now needs to finish the server side:

1. shared route mappers
2. service/repository boundaries
3. canonical envelope normalization
4. activity-write ownership rules

## 4.5 Activity now has a wrapper seam, but no shared server service layer

Validated now:

1. [activity/+server.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/activity/+server.ts#L1) is already a durable read feed
2. [activity/reaction/+server.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/activity/reaction/+server.ts#L1) is already a durable mutation
3. [activityApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/activityApi.ts#L1) now exists as the browser wrapper seam

Implication:

Before physical extraction, Phase 2 still needs:

1. centralized event-write ownership rules for later domains
2. shared server mappers instead of route-local row shaping
3. route thinning so the wrapper seam hits one service boundary

## 5. Canonical Target Shape

## 5.1 Final runtime ownership

`web` keeps:

1. header and wallet modal UX
2. wallet connection state and message-signing UX
3. local cached profile fallback
4. toast-only presentation state
5. route-local settings and passport tab UX

`api` owns:

1. session issuance and validation
2. account identity reads
3. profile projection reads and updates
4. preferences persistence
5. persisted UI-state persistence
6. durable notifications read/write
7. durable activity feed read/write

`contracts` owns:

1. auth contracts
2. profile contracts
3. preferences contracts
4. notifications contracts
5. activity contracts
6. shared HTTP envelopes

## 5.2 Target service split inside the current monolith first

Inside `frontend`, Phase 2 should behave as if these server modules already exist:

1. `src/lib/server/auth/`
2. `src/lib/server/identity/`
3. `src/lib/server/preferences/`
4. `src/lib/server/notifications/`
5. `src/lib/server/activity/`

And these browser layers should be the only consumers:

1. `src/lib/api/auth.ts`
2. `src/lib/api/profileApi.ts`
3. `src/lib/api/preferencesApi.ts`
4. `src/lib/api/notificationsApi.ts`
5. `src/lib/api/activityApi.ts`

## 5.3 Target store split

Current store -> target split:

1. `walletStore`
   - keep wallet connection UX and modal state
   - move session mirror semantics into a named `authSessionStore` or equivalent runtime
2. `userProfileStore`
   - keep cache and client-derived overlay
   - move canonical server projection shaping to profile/passport view-model helpers
3. `notificationStore`
   - split into `notificationsStore`
   - split into `toastStore`
   - split `p0OverrideStore`
   - isolate demo seed into a dev/bootstrap helper, not the durable notification path

## 6. Cutover Sequence

## 6.1 Step A: finish contract ownership

Required before any route moves:

1. stop [notificationsApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/notificationsApi.ts#L1) from owning `ApiNotification`
2. add `activity` contracts and an `activityApi.ts` wrapper
3. keep `auth.ts` legacy normalization temporary, but pin the canonical `AuthSessionData`, `AuthUser`, `WalletNonceData`, and `VerifyWalletData` in contracts

## 6.2 Step B: split shell bootstrap

Required browser bootstrap split:

1. [Header.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/layout/Header.svelte#L72) keeps calling one public hydration entry, not raw route details
2. [NotificationTray.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/shared/NotificationTray.svelte#L12) stops coupling durable hydration with demo seeding
3. [ContextBanner.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/shared/ContextBanner.svelte#L90) keeps consuming hydrated profile projection, not projection assembly logic

## 6.3 Step C: thin route handlers

Each Phase 2 route should become:

1. parse request
2. resolve authenticated user
3. call one service
4. serialize one contract result

Route handlers should stop owning:

1. inline SQL shaping
2. inline row mappers duplicated across routes
3. ad hoc activity write logic
4. policy decisions mixed with transport parsing

## 6.4 Step D: cut over to `apps/api`

Only after Steps A-C are stable:

1. move auth/session HTTP adapters first
2. move profile/preferences/ui-state next
3. move notifications/activity next
4. leave learning workers and venue auth out of this cutover

## 7. Validation Gates

Phase 2 is ready only when all of these are true.

1. the core route set above stays at `16` routes and does not silently re-expand
2. `notifications` durable data and `toasts` ephemeral data no longer share one store
3. `activity` has a wrapper seam and contract ownership
4. `walletStore` is no longer the mixed owner of both session mirror and modal UX state
5. `profile` and `passport` hydration stay server-authoritative, with client-derived overlays named explicitly as secondary
6. `passport/learning/**` and `positions/polymarket/auth` remain out of this cutover

Repeated validation commands:

```bash
rg --files src/routes/api | rg '/(auth|profile|preferences|ui-state|notifications|activity)'
rg -n "seedNotifications|p0Override|toasts\\.addToast|notifications\\.addNotification" src/lib/stores src/components src/routes
rg -n "fetchAuthSession|fetchProfileApi|fetchPassportApi|fetchPreferencesApi|fetchUiStateApi|fetchNotificationsApi" src/components src/routes src/lib
rg -n "activity" src/lib/api src/lib/stores src/components src/routes --glob '!src/routes/api/**'
```

## 8. Anti-goals

Do not do these in Phase 2:

1. move `passport/learning/**` into the identity/settings backend
2. move venue auth or trading execution into the identity/settings backend
3. keep demo seed notifications as a default production bootstrap path
4. let `notificationStore` become the permanent home for unrelated P0 or shell control state
5. merge preferences and persisted UI state into one opaque server module

## 9. Immediate Next Design-to-Implementation Bridge

The next concrete slice after this document should be:

1. split auth-session mirror from wallet-modal UX state
2. keep moving direct consumers from compatibility stores toward the narrower auth/profile stores
3. extract shared notification and activity server mappers/services
4. keep `passport/learning/**` and venue auth out of that slice

That sequence finishes the missing Phase 2 boundary prep without prematurely moving Phase 3 or Phase 6 domains.
