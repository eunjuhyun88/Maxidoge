# Profile / Preferences Internal Boundary Inventory

Date: 2026-03-07  
Status: active design slice  
Scope: `/Users/ej/Downloads/maxidoge-clones/frontend`

## 1. Slice Goal

This is the second real internal split slice.

Goal:

1. make `profile`, `preferences`, and `ui-state` clearly separable inside the current `frontend` app
2. keep page/store/view concerns in the `web zone`
3. keep authenticated projection, persistence, and validation in the `server zone`
4. define which parts are durable business truth versus user-facing cache or view preference

This slice comes after `auth/session` because all of it depends on authenticated user resolution.

## 2. Current Flow Summary

Current flow inside `frontend`:

`settings + passport + userProfileStore -> src/lib/api/profileApi.ts / src/lib/api/preferencesApi.ts -> /api/profile + /api/profile/passport + /api/preferences + /api/ui-state -> users + user_profiles + user_preferences + user_ui_state`

There are three related but different concerns here:

1. account profile identity projection
2. durable product preferences
3. server-persisted UI/view state

They currently live near each other, but they should not be treated as one undifferentiated boundary.

## 3. Current Web-Zone Inventory

## 3.1 Browser-facing entry points

Primary web files:

1. [profileApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/profileApi.ts)
2. [preferencesApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/preferencesApi.ts)
3. [userProfileStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/userProfileStore.ts)
4. [settings/+page.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/settings/+page.svelte)
5. [passport/+page.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/passport/+page.svelte)

## 3.2 Web responsibilities today

### `src/lib/api/profileApi.ts`

Owns:

1. browser transport wrappers for `/api/profile` and `/api/profile/passport`
2. local `ApiProfilePayload` and `ApiPassportPayload` response shapes
3. browser-level error parsing and timeout policy

Boundary quality:

1. good: no `$lib/server` import
2. good: profile transport is centralized
3. acceptable but should improve later: DTOs still live inside the wrapper file

### `src/lib/api/preferencesApi.ts`

Owns:

1. browser transport wrappers for `/api/preferences` and `/api/ui-state`
2. local `ApiUserPreferences` and `ApiUserUiState` shapes
3. browser-level error parsing and timeout policy

Boundary quality:

1. good: preferences and ui-state already enter through one wrapper boundary
2. acceptable but should improve later: preferences contracts are not yet shared outside this file

### `src/lib/stores/userProfileStore.ts`

Owns:

1. server-authoritative profile hydration entry
2. local cached display profile
3. optimistic avatar and nickname mutation
4. secondary client-derived metrics from `matchHistoryStore`
5. localStorage persistence

Boundary concern:

1. the store is currently both projection cache and derived-view model
2. it explicitly claims server authority, but still computes some metrics locally
3. it must remain secondary to `/api/profile` and `/api/profile/passport`

### `src/routes/settings/+page.svelte`

Owns:

1. settings page UX
2. local settings form state
3. remote hydration from `/api/preferences`
4. writeback to `/api/preferences`
5. local coupling to `gameState`
6. reset of local storage keys

Boundary concern:

1. the page is currently both view and preference orchestrator
2. it mutates remote durable preferences and local game runtime together
3. this is acceptable short-term, but the durable preference model should not be hidden inside the route

### `src/routes/passport/+page.svelte`

Owns:

1. passport tab UX
2. `passportActiveTab` local state
3. remote UI-state hydration via `/api/ui-state`
4. writeback of `passportActiveTab`
5. consumption of profile, holdings, learning, and wallet data

Boundary concern:

1. the page consumes many adjacent domains at once
2. only part of that state belongs to the profile/preferences slice
3. `passportActiveTab` is view state, not account identity truth

## 4. Current Server-Zone Inventory

## 4.1 Server routes

Current route set:

1. [profile](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/profile/+server.ts)
2. [profile/passport](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/profile/passport/+server.ts)
3. [preferences](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/preferences/+server.ts)
4. [ui-state](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/ui-state/+server.ts)

## 4.2 Server modules

Primary server files:

1. [profileProjection.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/profileProjection.ts)
2. [apiValidation.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/apiValidation.ts)
3. [authGuard.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/authGuard.ts)
4. [requestGuards.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/requestGuards.ts)

## 4.3 Server responsibilities today

### `profile/+server.ts`

Owns:

1. authenticated user requirement
2. `users` row read for base identity fields
3. profile projection sync call
4. profile response assembly
5. profile patch validation for `nickname` and `avatar`
6. direct `users` table mutation
7. rate-limit protection

This is both transport layer and light service layer today.

### `profile/passport/+server.ts`

Owns:

1. authenticated user requirement
2. profile projection sync call
3. agent summary query
4. passport response assembly

This route is projection-facing, not identity-authoritative.

### `preferences/+server.ts`

Owns:

1. authenticated user requirement
2. default preference row creation
3. preference validation
4. durable preference upsert into `user_preferences`
5. `settings_changed` activity event

This route is the current durable preference authority.

### `ui-state/+server.ts`

Owns:

1. authenticated user requirement
2. default UI-state row creation
3. view-state validation
4. server persistence for terminal, passport, signals, and oracle UI preferences

This route stores user view state, not business truth.

### `profileProjection.ts`

Owns:

1. projection read from `user_profiles`
2. derived aggregation from `quick_trades`, `tracked_signals`, `matches`
3. tier derivation
4. badge derivation
5. projection sync back into `user_profiles`

This is the real server-side projection authority for the profile slice.

## 5. Authority Split

The actual authority split today is:

1. `users`
   - source of account identity fields like email, nickname, wallet address, avatar
2. `user_profiles` + `profileProjection.ts`
   - source of server profile projection and badges
3. `user_preferences`
   - source of durable account preferences
4. `user_ui_state`
   - source of persisted view state only
5. `userProfileStore`
   - browser cache and presentation model, not durable truth

Implication:

1. `profile` is not the same thing as `preferences`
2. `preferences` is not the same thing as `ui-state`
3. physical extraction later must preserve those separations

## 6. Boundary Verdict

## 6.1 What is already good

1. browser transport already goes through `profileApi.ts` and `preferencesApi.ts`
2. authenticated route lookup is centralized through `authGuard.ts`
3. projection logic already exists in a dedicated server file
4. preferences and ui-state have explicit server tables instead of pure client storage
5. `passportActiveTab` is already treated as persisted UI state, not hardcoded local-only state

## 6.2 What is not good enough yet

1. `userProfileStore.ts` still persists profile cache to localStorage
2. `userProfileStore.ts` still computes secondary metrics from `matchHistoryStore`
3. `settings/+page.svelte` mixes durable preference writeback with `gameState` mutation
4. `preferences/+server.ts` and `ui-state/+server.ts` use raw `request.json()` rather than a standardized guarded body reader
5. DTOs are still wrapper-local instead of living in a shared contract layer
6. `ui-state` currently mixes terminal, passport, signals, and oracle view prefs in one transport surface

## 7. Specific Boundary Problems

## 7.1 Profile cache versus profile truth

`userProfileStore.ts` is positioned as server-authoritative, but in practice it is:

1. hydrating from server truth
2. caching to localStorage
3. deriving additional metrics locally
4. applying optimistic mutations

This means the current store is a hybrid, not a pure projection mirror.

## 7.2 Durable preference versus runtime preference

`settings/+page.svelte` updates:

1. durable account preferences through `/api/preferences`
2. local `gameState` runtime immediately

That is a valid UX choice, but the boundary needs to state clearly which values are account truth and which are local runtime convenience.

## 7.3 UI-state versus product behavior

`ui-state/+server.ts` currently stores:

1. terminal panel widths and collapse state
2. terminal tabs
3. passport active tab
4. signals filter
5. oracle sorting controls

This is useful for continuity, but none of it should be treated as domain authority.

## 8. Required Internal Split

Inside `frontend`, this slice should be treated as:

### Web side

1. `src/lib/api/profileApi.ts`
2. `src/lib/api/preferencesApi.ts`
3. `src/lib/stores/userProfileStore.ts`
4. `src/routes/settings/+page.svelte`
5. `src/routes/passport/+page.svelte`

### Server side

1. `src/routes/api/profile/+server.ts`
2. `src/routes/api/profile/passport/+server.ts`
3. `src/routes/api/preferences/+server.ts`
4. `src/routes/api/ui-state/+server.ts`
5. `src/lib/server/profileProjection.ts`
6. validation and auth helpers

### Contract side

Must be split out logically first:

1. `ProfilePayload`
2. `PassportPayload`
3. `UpdateProfilePayload`
4. `UserPreferencesPayload`
5. `UpdatePreferencesPayload`
6. `UserUiStatePayload`
7. `UpdateUiStatePayload`
8. shared error envelope

## 9. Refactor Tasks Before Physical Extraction

## T1. Contract freeze

Move profile/preferences/ui-state DTOs to a transport-safe contract location.

Must include:

1. profile response shape
2. passport response shape
3. profile patch request shape
4. preferences read/write shapes
5. ui-state read/write shapes

## T2. Projection clarity

Clarify that profile projection authority lives server-side.

Target:

1. `profileProjection.ts` remains canonical for server-derived tier/badge/pnl aggregates
2. browser store becomes cache/view model only
3. client-derived secondary metrics are either explicitly marked cosmetic or moved server-side

## T3. Handler thinning

Break current route logic into clearer server-side services:

1. `profileIdentityService`
   - read and patch base profile fields
2. `profileProjectionService`
   - load and sync derived projection
3. `userPreferencesService`
   - ensure, validate, and persist durable preferences
4. `userUiStateService`
   - ensure, validate, and persist view-state

Handlers should become thin adapters over those services.

## T4. Page/store thinning

Move durable preference orchestration out of route files and away from hybrid stores.

Target:

1. route = presentation and user interaction
2. store/runtime = cache and local interaction state
3. wrapper = transport only
4. server = authority and validation

## T5. UI-state decomposition

Clarify whether `ui-state` should remain one route or split later by surface.

Likely future split:

1. terminal layout state
2. passport tab state
3. signals/oracle filter state

This does not need immediate extraction, but the contract boundary should stop treating it as one domain.

## 10. Extraction Readiness Criteria

This slice is ready for physical FE/BE extraction only when:

1. browser code depends only on wrapper files plus shared contracts
2. profile projection authority is fully server-defined
3. localStorage profile cache is explicitly secondary and non-authoritative
4. preferences and ui-state handlers are thin
5. durable preferences are clearly separated from runtime/game state
6. ui-state is explicitly classified as view persistence, not product truth

## 11. Immediate Next Step

After this doc, the next correct slice is:

1. `quick-trades`

Reason:

1. `profileProjection.ts` already depends on `quick_trades`
2. passport and profile surfaces read quick-trade-derived outputs
3. it is the next boundary where user identity, server truth, and browser view state meet directly
