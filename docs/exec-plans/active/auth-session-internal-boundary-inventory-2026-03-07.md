# Auth / Session Internal Boundary Inventory

Date: 2026-03-07  
Status: active design slice  
Scope: `/Users/ej/Downloads/maxidoge-clones/frontend`

## 1. Slice Goal

This is the first real internal split slice.

Goal:

1. make `auth/session` clearly separable inside the current `frontend` app
2. keep login/register/wallet UX in the `web zone`
3. keep session issuance, cookie parsing, nonce verification, and authenticated-user lookup in the `server zone`
4. define what must be true before this slice can be physically extracted

This slice comes before `profile/preferences` because most authenticated APIs depend on it.

## 2. Current Flow Summary

Current flow inside `frontend`:

`WalletModal / walletStore -> src/lib/api/auth.ts -> /api/auth/* -> authRepository/session/walletAuthRepository/authSecurity -> DB + cookie`

There are two overlapping concerns here:

1. wallet ownership challenge flow
2. application session flow

They are related, but they are not the same boundary and should not be merged conceptually.

## 3. Current Web-Zone Inventory

## 3.1 Browser-facing entry points

Primary web files:

1. [auth.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/auth.ts)
2. [walletStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/walletStore.ts)
3. [WalletModal.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/modals/WalletModal.svelte)

## 3.2 Web responsibilities today

### `src/lib/api/auth.ts`

Owns:

1. browser transport wrappers for:
   - `registerAuth`
   - `loginAuth`
   - `fetchAuthSession`
   - `requestWalletNonce`
   - `verifyWalletSignature`
   - `logoutAuth`
2. browser-level error parsing

Boundary quality:

1. good: no `$lib/server` import
2. good: all auth calls go through one wrapper file
3. acceptable but should improve later: response shapes are local to this file, not yet in a shared contract package

### `src/lib/stores/walletStore.ts`

Owns:

1. modal-open state
2. wallet connection display state
3. local cached identity view state
4. `hydrateAuthSession()` which calls `fetchAuthSession()`

Boundary concern:

1. the store is allowed to cache session-derived display data
2. it must not become the authority for authenticated identity
3. authenticated truth must still come from `/api/auth/session`

### `src/components/modals/WalletModal.svelte`

Owns:

1. wallet connect UX
2. wallet message signing UX
3. login/signup form UX
4. sequencing of `nonce -> sign -> verify -> login/register`

Boundary concern:

1. it is currently both UI and auth-flow controller
2. that is acceptable short-term inside the web zone
3. later it should call a thinner auth-flow runtime instead of holding all action logic directly

## 4. Current Server-Zone Inventory

## 4.1 Auth routes

Current auth route set:

1. [login](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/auth/login/+server.ts)
2. [logout](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/auth/logout/+server.ts)
3. [nonce](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/auth/nonce/+server.ts)
4. [register](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/auth/register/+server.ts)
5. [session](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/auth/session/+server.ts)
6. [verify-wallet](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/auth/verify-wallet/+server.ts)
7. [wallet deprecated shim](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/auth/wallet/+server.ts)

## 4.2 Auth server modules

Primary server files:

1. [authRepository.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/authRepository.ts)
2. [session.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/session.ts)
3. [authGuard.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/authGuard.ts)
4. [walletAuthRepository.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/walletAuthRepository.ts)
5. [authSecurity.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/authSecurity.ts)
6. [rateLimit.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/rateLimit.ts)
7. [turnstile.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/turnstile.ts)
8. [originGuard.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/originGuard.ts)

## 4.3 Server responsibilities today

### `authRepository.ts`

Owns:

1. user conflict lookup
2. user creation
3. session row creation
4. authenticated user lookup
5. login user lookup by email/nickname/wallet

### `session.ts`

Owns:

1. session cookie name
2. session cookie serialization format
3. session cookie parsing
4. cookie option policy

This is server-only authority and must not leak to the browser.

### `walletAuthRepository.ts`

Owns:

1. EVM address validation
2. nonce issuance
3. nonce consumption
4. signature verification
5. wallet-user linking

This file is part of auth challenge authority, not general frontend wallet UX.

### `authSecurity.ts`

Owns:

1. auth abuse guard
2. turnstile verification
3. auth body parsing and max body size guard

This is server edge protection and should remain server-only after extraction.

### `authGuard.ts`

Owns:

1. the reusable session-user lookup entry point for authenticated routes

This is the most important fan-out point in the whole auth slice.

## 5. Session Contract

The real session contract today is:

1. browser does not parse cookie
2. server sets `stockclaw_session`
3. cookie value currently contains `token:userId`
4. server parses cookie through `parseSessionCookie(...)`
5. authenticated identity is fetched through `/api/auth/session`

Implication:

1. the browser should never know or depend on the cookie structure
2. only the server runtime may know `SESSION_COOKIE_NAME`, parsing rules, and issuance format
3. physical extraction later must preserve this contract at the transport boundary

## 6. Auth Challenge Contract

Current challenge flow:

1. browser requests nonce via `/api/auth/nonce`
2. server stores nonce in `auth_nonces`
3. browser signs returned message
4. browser submits signature to:
   - `/api/auth/register`
   - `/api/auth/login`
   - or `/api/auth/verify-wallet`
5. server verifies and consumes nonce

Important distinction:

1. wallet challenge proves wallet ownership
2. session issuance proves application identity

These should remain separate sub-services even if both stay under `auth`.

## 7. Fan-Out Risk

`auth/session` is not isolated to `/api/auth/*`.

Confirmed shared dependency:

1. [authGuard.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/authGuard.ts) is used across most authenticated API groups:
   - preferences
   - profile
   - quick-trades
   - signals
   - copy-trades
   - notifications
   - positions
   - GMX
   - chat
   - arena
   - tournaments
   - passport learning

Meaning:

This slice is the gateway slice.

If we get `auth/session` wrong, the rest of the separation becomes unstable.

## 8. Boundary Verdict

## 8.1 What is already good

1. web calls already go through one wrapper file
2. session cookie parsing is server-only
3. authenticated route lookup is centralized in one guard
4. nonce/signature logic already lives server-side
5. rate limit and turnstile checks are already server-only

## 8.2 What is not good enough yet

1. auth DTOs are not yet in a shared contract layer
2. `WalletModal` still carries too much flow orchestration directly
3. `walletStore` keeps local identity cache that must stay explicitly secondary to session truth
4. `authGuard.ts` is reusable, but not yet framed as a portable session boundary module
5. `login` and `register` handlers still do too much inside transport files

## 9. Required Internal Split

Inside `frontend`, this slice should be treated as:

### Web side

1. `src/lib/api/auth.ts`
2. `src/lib/stores/walletStore.ts`
3. `src/components/modals/WalletModal.svelte`

### Server side

1. `src/routes/api/auth/*`
2. `src/lib/server/authRepository.ts`
3. `src/lib/server/session.ts`
4. `src/lib/server/authGuard.ts`
5. `src/lib/server/walletAuthRepository.ts`
6. `src/lib/server/authSecurity.ts`
7. supporting server infra

### Contract side

Must be split out logically first:

1. `AuthUserPayload`
2. `AuthSessionResponse`
3. `RegisterAuthPayload`
4. `LoginAuthPayload`
5. nonce request/response shape
6. wallet verification response shape
7. error envelope

## 10. Refactor Tasks Before Physical Extraction

## T1. Contract freeze

Move auth DTOs to a transport-safe contract location.

Must include:

1. session response shape
2. login/register request shape
3. nonce request/response shape
4. wallet verify request/response shape

## T2. Service split inside server zone

Break current auth behavior into clearer server-side services:

1. `authSessionService`
   - create session
   - parse session
   - revoke session
   - resolve authenticated user
2. `authChallengeService`
   - issue nonce
   - verify signature
   - consume nonce
   - link wallet
3. `authIdentityService`
   - register user
   - login lookup
   - conflict checks

Handlers should become thin adapters over these services.

## T3. Guard hardening

Promote `getAuthUserFromCookies(...)` into the canonical session boundary helper.

Later target:

1. one `resolveSessionUser(...)`
2. one optional `requireSessionUser(...)`

This will make extraction of authenticated APIs much cleaner.

## T4. Web-side flow thinning

Move auth action sequencing out of `WalletModal.svelte` into a web-side runtime/controller.

Target:

1. modal = presentation and user input
2. runtime/controller = flow sequencing
3. wrapper = transport only

## T5. Local cache clarification

Clarify that `walletStore` is:

1. display/cache state
2. wallet connection UI state
3. session-derived identity mirror

It is not:

1. source of auth truth
2. source of session authority

## 11. Extraction Readiness Criteria

This slice is ready for physical FE/BE extraction only when:

1. browser code depends only on auth wrapper + auth contracts
2. auth DTOs live outside server implementation files
3. `/api/auth/*` handlers are thin
4. session cookie parsing remains server-only
5. authenticated-user lookup is centralized in one portable guard/service
6. `walletStore` and `WalletModal` no longer mix transport and authority

## 12. Immediate Next Step

After this doc, the next correct slice is:

1. `profile/preferences` inventory

Reason:

1. it is the first big consumer of session identity
2. it defines how authenticated user state becomes frontend-visible projection
3. it sits directly after auth in the boundary chain
