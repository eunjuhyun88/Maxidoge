# Phase 1 Foundation Contract Extraction

Date: 2026-03-07  
Status: active design slice  
Scope: `/Users/ej/Downloads/maxidoge-clones/frontend`

## 1. Slice Goal

This is the first actual contract-extraction slice.

Goal:

1. define the first shared contract files
2. cover the root authenticated surface before any trading or terminal contracts
3. normalize the transport boundary for `http`, `auth`, `profile`, `preferences`, and `ui-state`
4. make later domain extraction depend on one stable foundation instead of wrapper-local DTOs

This slice follows:

1. [phase-1-contract-catalog-2026-03-07.md](/Users/ej/Downloads/maxidoge-clones/frontend/docs/exec-plans/active/phase-1-contract-catalog-2026-03-07.md#L1)
2. [web-api-worker-phased-migration-map-2026-03-07.md](/Users/ej/Downloads/maxidoge-clones/frontend/docs/exec-plans/active/web-api-worker-phased-migration-map-2026-03-07.md#L1)

## 2. Current Sources To Replace

## 2.1 HTTP base primitives

Current duplication lives in wrapper-local helpers:

1. [auth.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/auth.ts#L44)
2. [profileApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/profileApi.ts#L50)
3. [preferencesApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/preferencesApi.ts#L33)

Problem:

Each wrapper defines its own error parsing, timeout assumptions, and success envelope expectations.

## 2.2 Auth

Current browser contract source:

1. [auth.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/auth.ts#L1)

Current route shape sources:

1. [auth/session](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/auth/session/+server.ts#L1)
2. [auth/register](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/auth/register/+server.ts#L1)
3. `auth/login`, `auth/logout`, `auth/nonce`, `auth/verify-wallet`

Observed mismatch:

1. session route returns `{ authenticated, user }` with no `success`
2. register route returns `{ success, user }`
3. session user uses `wallet`
4. wrapper user type uses `walletAddress` and optional `wallet`
5. register response includes `walletVerified` and `createdAt` that do not exist on the session response

## 2.3 Profile

Current browser contract source:

1. [profileApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/profileApi.ts#L1)

Current route shape source:

1. [profile](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/profile/+server.ts#L1)

Observed mismatch:

1. GET returns `success + profile`
2. PATCH returns only `success`
3. `stats.displayTier` is projection language, while top-level `tier` is account identity language

## 2.4 Preferences and UI state

Current browser contract source:

1. [preferencesApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/preferencesApi.ts#L1)

Current route shape sources:

1. [preferences](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/preferences/+server.ts#L1)
2. [ui-state](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/ui-state/+server.ts#L1)

Observed mismatch:

1. both routes use `success`, but payload keys differ: `preferences` vs `uiState`
2. enums are enforced server-side but remain loose strings in the wrapper layer
3. durable preferences and persisted view state currently share one wrapper module

## 3. Proposed File Set

First contract files to create:

1. `src/lib/contracts/http.ts`
2. `src/lib/contracts/auth.ts`
3. `src/lib/contracts/profile.ts`
4. `src/lib/contracts/preferences.ts`

Final target after package extraction:

1. `packages/contracts/src/http.ts`
2. `packages/contracts/src/auth.ts`
3. `packages/contracts/src/profile.ts`
4. `packages/contracts/src/preferences.ts`

## 4. Proposed Exports

## 4.1 `http.ts`

Required exports:

1. `ApiSuccess<T>`
2. `ApiFailure`
3. `ApiResult<T>`
4. `PaginationMeta`
5. `ApiErrorCode`

Recommended starter shape:

```ts
export type ApiErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'invalid_request'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'server_error';

export type ApiSuccess<T> = {
  ok: true;
  data: T;
  warning?: string;
  meta?: { pagination?: PaginationMeta };
};

export type ApiFailure = {
  ok: false;
  error: {
    code: ApiErrorCode;
    message: string;
    retryable?: boolean;
    field?: string;
  };
};

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;
```

Rule:

Legacy `success` routes may exist for a while, but contract files are written in canonical `ok` form.

## 4.2 `auth.ts`

Required exports:

1. `AuthUser`
2. `AuthSessionData`
3. `RegisterAuthRequest`
4. `RegisterAuthData`
5. `LoginAuthRequest`
6. `LoginAuthData`
7. `WalletNonceRequest`
8. `WalletNonceData`
9. `VerifyWalletRequest`
10. `VerifyWalletData`
11. `LogoutData`

Field normalization rules:

1. use `walletAddress` as the canonical property name
2. do not expose cookie names or cookie parsing rules
3. keep `authenticated` as part of session data, not as the outer transport envelope
4. use epoch milliseconds for timestamps if timestamps are retained

## 4.3 `profile.ts`

Required exports:

1. `ProfileBadge`
2. `ProfileStats`
3. `ProfileProjection`
4. `PassportProjection`
5. `UpdateProfileRequest`
6. `UpdateProfileData`

Field normalization rules:

1. top-level account identity fields stay separate from projection stats
2. `tier` and `stats.displayTier` are not collapsed into one field
3. badge shape is shared between profile and passport

## 4.4 `preferences.ts`

Required exports:

1. `UserPreferences`
2. `UpdatePreferencesRequest`
3. `UserUiState`
4. `UpdateUiStateRequest`
5. `TerminalMobileTab`
6. `TerminalActiveTab`
7. `TerminalInnerTab`
8. `PassportActiveTab`
9. `OraclePeriod`
10. `OracleSort`

Field normalization rules:

1. keep durable preferences and UI state as separate types
2. move server-enforced enum values into shared string unions
3. width fields remain numeric and bounded by server validation

## 5. Adapter Rules During Transition

Until routes emit canonical `ApiResult<T>` directly:

1. wrapper files may parse legacy `{ success, profile }`
2. wrapper files may parse legacy `{ success, preferences }`
3. wrapper files may parse legacy `{ authenticated, user }`
4. wrappers must immediately normalize those responses into the contract-owned shapes

Rule:

The normalization lives in wrappers temporarily, but the type source of truth moves to `src/lib/contracts/**`.

## 6. Concrete Field Decisions

## 6.1 Session data

Canonical session payload:

```ts
type AuthSessionData = {
  authenticated: boolean;
  user: AuthUser | null;
};
```

Reason:

The route already models session as a check, not a command result. We keep that semantic meaning and only normalize the outer envelope.

## 6.2 Register/login user payload

Canonical user payload keeps:

1. `id`
2. `email`
3. `nickname`
4. `tier`
5. `phase`
6. `walletAddress`

Optional command-only additions:

1. `walletVerified`
2. `createdAt`

Reason:

The shared `AuthUser` must stay stable across session, login, and register. Command-specific fields become optional command result fields, not part of the base user shape.

## 6.3 Preferences enums

Move these server-side allowed values into shared contracts:

1. timeframes from [preferences/+server.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/preferences/+server.ts#L8)
2. terminal and passport tabs from [ui-state/+server.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/ui-state/+server.ts#L7)
3. oracle filter values from [ui-state/+server.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/ui-state/+server.ts#L11)

Reason:

The browser should be able to type these values without copying server-only sets or drifting from them.

## 7. Done Criteria

This slice is complete when:

1. the four contract files exist
2. `auth.ts`, `profileApi.ts`, and `preferencesApi.ts` import from them
3. wrapper-local DTO definitions for these domains are removed or reduced to transport adapters only
4. `npm run docs:check` passes
5. `npm run check` passes
6. `npm run build` passes

## 8. Immediate Next Step

The next implementation slice after this document should be small and mechanical:

1. create `src/lib/contracts/http.ts`
2. create `src/lib/contracts/auth.ts`
3. create `src/lib/contracts/profile.ts`
4. create `src/lib/contracts/preferences.ts`
5. switch the three browser wrappers to those imports without changing server behavior yet
