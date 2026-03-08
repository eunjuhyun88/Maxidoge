# Phase 0 Boundary Freeze Checklist

Date: 2026-03-08  
Status: active execution checklist  
Scope: `/Users/ej/Downloads/maxidoge-clones/frontend`

## 1. Purpose

This document translates the top-level redesign blueprint into the immediate execution gate:

`stop the monolith from getting more entangled before further extraction`

This is the first checklist that must stay true before deeper `api` and `worker` cutovers are allowed.

Primary source:

1. [full-system-redesign-blueprint-2026-03-08.md](/Users/ej/Downloads/maxidoge-clones/frontend/docs/exec-plans/active/full-system-redesign-blueprint-2026-03-08.md#L1)

Supporting references:

1. [frontend-internal-web-server-split-design-2026-03-07.md](/Users/ej/Downloads/maxidoge-clones/frontend/docs/exec-plans/active/frontend-internal-web-server-split-design-2026-03-07.md#L1)
2. [phase-1-contract-catalog-2026-03-07.md](/Users/ej/Downloads/maxidoge-clones/frontend/docs/exec-plans/active/phase-1-contract-catalog-2026-03-07.md#L1)
3. the `*-boundary-inventory-2026-03-07.md` set in this folder

## 2. Current Baseline

Snapshot validated on 2026-03-08 against the canonical `frontend` tree.

## 2.1 Browser-to-server import leakage

Current scan:

1. browser-facing `$lib/server/**` imports in `src/routes`, `src/components`, `src/lib/stores`, `src/lib/api`: `0`

Interpretation:

1. the codebase has already cleared the most dangerous direct browser/server type leak
2. this must remain at `0`

## 2.2 Direct `/api` fetch leakage in browser-side state layers

Confirmed exception still alive:

1. [warRoomStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/warRoomStore.ts#L218) directly fetches `/api/arena/match/${matchId}/warroom`

Interpretation:

1. the wrapper seam is mostly present
2. arena still has at least one store-level bypass that blocks a clean `web -> lib/api -> api` rule

## 2.3 Wrapper-local transport shape sprawl

Current scan:

1. `31` files under `src/lib/api/**` still declare local `interface` or `type` transport shapes

Important nuance:

1. not every local type is a boundary bug
2. vendor-only client adapters may keep local shapes temporarily
3. browser wrappers for first-cut domains must stop owning canonical DTO truth

Immediate examples:

1. [terminalApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/terminalApi.ts#L1) still owns scan/chat response shapes and imports terminal scan DTOs from `$lib/services/scanService`
2. [arenaApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/arenaApi.ts#L1) still owns multiple route response interfaces
3. [matchesApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/matchesApi.ts#L1) still owns legacy match response interfaces

## 2.4 Contract extraction progress

Already improved:

1. [positionsApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/positionsApi.ts#L1) now consumes `src/lib/contracts/positions`
2. auth, profile, preferences, trading, and community wrappers already have partial contract adoption

Still incomplete:

1. `terminal` transport types are not fully contract-owned
2. `arena` transport types are not fully contract-owned
3. shell/activity/notifications do not yet have an explicit contract catalog

## 3. Phase 0 Exit Conditions

Phase 0 is complete only when all five conditions are true.

1. browser-facing files keep `$lib/server/**` import count at `0`
2. no active browser store or component bypasses wrappers with direct `/api` fetch unless the exception is tracked here
3. priority browser wrappers stop importing implementation-defined DTOs from service/server modules
4. client stores stop mixing durable projection authority with ephemeral UI state without explicit naming
5. route handlers keep shrinking toward thin transport adapters

## 4. Workstream Checklist

## 4.1 Import hygiene

Keep this permanently green:

1. `src/routes/**/*.svelte` do not import `$lib/server/**`
2. `src/components/**` do not import `$lib/server/**`
3. `src/lib/stores/**` do not import `$lib/server/**`
4. `src/lib/api/**` do not import `$lib/server/**`

Validation command:

```bash
rg -n "\$lib/server" src/routes src/components src/lib/stores src/lib/api
```

Target result:

1. no matches

## 4.2 Direct fetch normalization

Fix every browser-side direct `/api` fetch where a wrapper should exist.

Tracked current exception list:

1. [warRoomStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/warRoomStore.ts#L218)

Required action:

1. create or extend an `arena` API wrapper for war-room generation
2. route `warRoomStore` through that wrapper
3. prohibit adding new direct `/api` fetch in stores/components

Validation commands:

```bash
rg -n "/api/" src/routes src/components src/lib/stores
rg -n "fetch\(" src/routes src/components src/lib/stores
```

Target result:

1. only approved wrapperless exceptions remain
2. approved exceptions are listed here explicitly

## 4.3 Wrapper contract normalization

Priority wrappers must stop acting like canonical DTO owners.

Immediate target list:

1. [terminalApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/terminalApi.ts#L1)
2. [arenaApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/arenaApi.ts#L1)
3. [matchesApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/matchesApi.ts#L1)
4. [passportLearningApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/passportLearningApi.ts#L1)
5. [notificationsApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/notificationsApi.ts#L1)

Required action:

1. move canonical DTOs into `src/lib/contracts/**`
2. keep wrapper-local legacy normalization only where migration requires it
3. remove imports from implementation modules such as `$lib/services/**` when the shape is really transport-owned

Validation commands:

```bash
rg -n "^(export )?(interface|type) " src/lib/api
rg -n "\$lib/services|\\$lib/server" src/lib/api
```

Target result:

1. priority domain wrappers import contracts
2. wrapper-local DTO declarations trend downward

## 4.4 Store authority split

Stores may cache, derive, and stage.
They may not pretend to be durable truth.

Priority hybrid stores:

1. [userProfileStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/userProfileStore.ts#L1)
2. [notificationStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/notificationStore.ts#L1)
3. [communityStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/communityStore.ts#L1)
4. [walletStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/walletStore.ts#L1)
5. [matchHistoryStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/matchHistoryStore.ts#L1)

Required action:

1. label local persistence as cache/fallback only
2. isolate ephemeral UI state from durable projection state
3. document the server-owned reconciliation path

## 4.5 Route and handler thinning

Big files are not automatically boundary bugs, but big files often hide them.

Phase-0 priority hotspots:

1. [terminal/+page.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/terminal/+page.svelte#L1)
2. [arena/+page.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/arena/+page.svelte#L1)
3. [passport/+page.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/passport/+page.svelte#L1)
4. [chat/messages +server.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/chat/messages/+server.ts#L1)
5. [terminal/intel-policy +server.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/terminal/intel-policy/+server.ts#L1)
6. [arena/analyze +server.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/arena/analyze/+server.ts#L1)

Required action:

1. keep extracting orchestration into runtime/service layers
2. avoid re-growing route-local domain logic
3. use the route as the composition/transport edge only

## 5. Domain Readiness Scorecard

This scorecard tells us where Phase 0 is already stable and where it is not.

## 5.1 Green

### Auth / Session

Why green:

1. browser-side `$lib/server` leakage is gone
2. wrapper seam exists and is stable
3. this domain already has contract-backed types in [auth.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/auth.ts#L1)

Remaining work:

1. normalize envelopes toward canonical `ok/data/error`

### Positions / Portfolio

Why green:

1. [positionsApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/positionsApi.ts#L1) already consumes contract-owned types
2. the previous server-type leak has been removed

Remaining work:

1. continue normalizing envelope shape and shared HTTP helpers

## 5.2 Yellow

### Profile / Preferences / UI State

Why yellow:

1. wrapper seam exists
2. contract adoption is underway
3. stores still carry local persistence/cache behavior that must stay explicitly non-authoritative

### Quick Trades / Signals / Community

Why yellow:

1. trading and community contracts exist
2. store authority and optimistic reconciliation still need clearer separation
3. legacy response normalization still lives in wrappers

### Passport / Learning

Why yellow:

1. wrapper surface exists
2. this domain still mixes dashboard reads and job control
3. final ownership will cross `api` and `worker`

## 5.3 Red

### Terminal / Market / Intel

Why red:

1. [terminalApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/terminalApi.ts#L1) still imports scan DTOs from `$lib/services/scanService`
2. the terminal shell is interaction-heavy and still depends on incomplete contract extraction
3. handler thickness remains high in the terminal stack

### Arena / Predictions / Tournaments

Why red:

1. [warRoomStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/warRoomStore.ts#L218) still bypasses the wrapper seam
2. the route and match stack are still structurally heavy
3. arena mixes local-first runtime with persisted workflow authority more than any other surface

## 6. Immediate Execution Queue

Phase 0 should now execute in this order:

1. remove the `warRoomStore` direct fetch bypass
2. move `terminalApi.ts` scan DTO ownership into `src/lib/contracts/terminal`
3. normalize `arenaApi.ts` and `matchesApi.ts` around contract-owned transport types
4. split hybrid projection/UI authority in profile, notification, and community stores
5. keep thinning terminal and arena handlers/routes while preserving current runtime boundaries

## 7. Commands To Keep Re-Running

```bash
rg -n "\$lib/server" src/routes src/components src/lib/stores src/lib/api
rg -n "/api/" src/routes src/components src/lib/stores
rg -n "^(export )?(interface|type) " src/lib/api
npm run docs:check
npm run check
npm run build
```

## 8. Done Definition

This checklist is done when:

1. browser-side `$lib/server` leakage stays at `0`
2. `warRoomStore` no longer fetches `/api` directly
3. `terminal`, `arena`, and shell-notification wrappers use contract-owned DTOs for their primary transport shapes
4. hybrid stores have explicit authority boundaries
5. Phase 1 contract extraction can proceed without rediscovering Phase 0 problems
