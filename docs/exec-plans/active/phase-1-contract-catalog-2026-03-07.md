# Phase 1 Contract Catalog

Date: 2026-03-07  
Status: active design authority  
Scope: `/Users/ej/Downloads/maxidoge-clones/frontend`

## 1. Decision Summary

Phase 1 is not "move files to backend".

Phase 1 is:

1. define the transport-safe contract layer that both `web` and future `api` can share
2. remove contract drift from browser wrapper files
3. stop browser wrappers from importing server implementation types
4. make later domain cutovers mechanical instead of interpretive

This document is the concrete next step from:

1. [web-api-worker-phased-migration-map-2026-03-07.md](/Users/ej/Downloads/maxidoge-clones/frontend/docs/exec-plans/active/web-api-worker-phased-migration-map-2026-03-07.md#L1)
2. [frontend-internal-web-server-split-design-2026-03-07.md](/Users/ej/Downloads/maxidoge-clones/frontend/docs/exec-plans/active/frontend-internal-web-server-split-design-2026-03-07.md#L1)

## 2. Validated Current Problems

## 2.1 Envelope drift already exists

Current browser wrappers do not share one transport envelope.

Observed drift:

1. [auth.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/auth.ts#L86) uses `success: boolean`
2. [profileApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/profileApi.ts#L85) uses `success: boolean`
3. [preferencesApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/preferencesApi.ts#L62) uses `success: boolean`
4. [tradingApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/tradingApi.ts#L86) uses `success: boolean`
5. [positionsApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/positionsApi.ts#L48) uses `ok: boolean`
6. [terminalApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/terminalApi.ts#L99) already has to accept both `success` and `ok`

Implication:

The contract layer must define one canonical envelope and adapters for legacy endpoints during migration.

## 2.2 DTOs are trapped inside wrapper files

Current wrapper-local DTO examples:

1. [AuthUserPayload](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/auth.ts#L17)
2. [ApiProfilePayload](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/profileApi.ts#L1)
3. [ApiUserPreferences](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/preferencesApi.ts#L1)
4. [ApiQuickTrade](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/tradingApi.ts#L1)
5. [UnifiedPosition](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/positionsApi.ts#L11)
6. [RunScanResponse](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/terminalApi.ts#L17)
7. [ApiCommunityPost](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/communityApi.ts#L18)

Implication:

DTO ownership is currently "whoever wrote the wrapper", not "shared transport contract".

## 2.3 Browser wrappers still depend on server implementation details

Confirmed contract leaks:

1. [positionsApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/positionsApi.ts#L7) imports `EIP712TypedData` from `$lib/server/polymarketClob`
2. [terminalApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/terminalApi.ts#L7) imports scan DTO types from `$lib/services/scanService`

Implication:

These types must move into the contract layer before physical extraction.

## 2.4 Shared transport primitives are duplicated

Current duplication patterns:

1. wrapper-local `requestJson(...)`
2. wrapper-local `{ error?: string }` parsing
3. wrapper-local timestamp parsing
4. wrapper-local pagination records
5. wrapper-local request timeout policy

Implication:

The contract layer must define:

1. base envelopes
2. base pagination and query contracts
3. timestamp conventions
4. shared error codes

## 3. Canonical Phase 1 Contract Shape

## 3.1 Canonical envelope

New contract canonical:

```ts
type ApiSuccess<T> = {
  ok: true;
  data: T;
  warning?: string;
  meta?: {
    requestId?: string;
    pagination?: {
      limit: number;
      offset: number;
      total: number;
    };
  };
};

type ApiFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
    retryable?: boolean;
    field?: string;
  };
};

type ApiResult<T> = ApiSuccess<T> | ApiFailure;
```

Rule:

1. new contracts use `ok`
2. existing `success` endpoints may stay temporarily
3. browser wrappers normalize legacy `success` responses into the canonical `ApiResult<T>` shape during cutover

## 3.2 Timestamp and pagination rules

Canonical transport rules:

1. timestamps cross the boundary as epoch milliseconds
2. paginated collections use one shared pagination object
3. warnings stay optional and transport-level
4. auth/session cookies never cross the browser contract

## 3.3 Temporary and final placement

Temporary boot location inside the monolith:

1. `frontend/src/lib/contracts/http.ts`
2. `frontend/src/lib/contracts/<domain>.ts`

Final physical home after extraction:

1. `packages/contracts/src/http.ts`
2. `packages/contracts/src/auth.ts`
3. `packages/contracts/src/profile.ts`
4. `packages/contracts/src/preferences.ts`
5. `packages/contracts/src/trading.ts`
6. `packages/contracts/src/community.ts`
7. `packages/contracts/src/positions.ts`
8. `packages/contracts/src/terminal.ts`

Rule:

Transport-safe types only. No DB models, no provider clients, no route logic.

## 4. Catalog By Extraction Order

## 4.1 Slice A: Auth / Session

Current sources:

1. [auth.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/auth.ts#L1)
2. auth route handlers under `src/routes/api/auth/**`

Contracts to extract:

1. `RegisterAuthRequest`
2. `LoginAuthRequest`
3. `AuthUser`
4. `AuthSessionData`
5. `WalletNonceRequest`
6. `WalletNonceData`
7. `VerifyWalletRequest`
8. `VerifyWalletData`
9. `LogoutData`

Special rule:

Cookie names and parsing stay server-only. Only the session read response becomes a shared contract.

## 4.2 Slice B: Profile / Preferences / UI State

Current sources:

1. [profileApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/profileApi.ts#L1)
2. [preferencesApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/preferencesApi.ts#L1)

Contracts to extract:

1. `ProfileBadge`
2. `ProfileProjection`
3. `PassportProjection`
4. `UpdateProfileRequest`
5. `UserPreferences`
6. `UpdatePreferencesRequest`
7. `UserUiState`
8. `UpdateUiStateRequest`

Special rule:

`ProfileProjection`, `UserPreferences`, and `UserUiState` stay separate files or sections. They are adjacent, not one merged contract.

## 4.3 Slice C: Quick Trades / Signals / Copy Trades / Community

Current sources:

1. [tradingApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/tradingApi.ts#L1)
2. [communityApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/communityApi.ts#L1)

Contracts to extract:

1. `QuickTradeRecord`
2. `OpenQuickTradeRequest`
3. `CloseQuickTradeRequest`
4. `QuickTradePricePatchRequest`
5. `TrackedSignalRecord`
6. `TrackSignalRequest`
7. `ConvertSignalRequest`
8. `CopyTradeRun`
9. `CopyTradeDraft`
10. `PublishCopyTradeRequest`
11. `PublishCopyTradeData`
12. `SignalAttachment`
13. `CommunityPost`
14. `CreateCommunityPostRequest`
15. `ReactCommunityPostRequest`

Special rule:

`SignalAttachment` and evidence fields become contract-owned, not UI-only extensions.

## 4.4 Slice D: Positions / Portfolio / Venue Execution

Current sources:

1. [positionsApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/positionsApi.ts#L1)
2. `gmxApi.ts`
3. `portfolioApi.ts`

Contracts to extract:

1. `UnifiedPosition`
2. `PolymarketPosition`
3. `GmxPosition`
4. `PortfolioHolding`
5. `PolymarketAuthRequest`
6. `PolymarketAuthData`
7. `PreparePolymarketOrderRequest`
8. `PreparePolymarketOrderData`
9. `SubmitPolymarketOrderRequest`
10. `SubmitPolymarketOrderData`
11. `Eip712OrderTypedData`
12. `PrepareGmxOrderRequest`
13. `PrepareGmxOrderData`
14. `ConfirmGmxOrderRequest`
15. `ConfirmGmxOrderData`

Immediate leak to fix:

1. move `EIP712TypedData` out of [polymarketClob.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/polymarketClob.ts#L1) into the contract layer

## 4.5 Slice E: Terminal / Market / Intel

Current sources:

1. [terminalApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/terminalApi.ts#L1)
2. `intelApi.ts`

Contracts to extract:

1. `TerminalScanSummary`
2. `TerminalScanDetail`
3. `TerminalScanSignal`
4. `RunTerminalScanRequest`
5. `ScanHistoryQuery`
6. `TerminalChatRow`
7. `SendTerminalChatRequest`
8. `SendTerminalChatData`
9. `MarketSnapshot`
10. `TerminalLiveTickerSnapshot`
11. `IntelFlowRecord`
12. `IntelTrendingRecord`
13. `IntelOpportunityRecord`
14. `IntelShadowPolicy`

Immediate leak to fix:

1. move scan DTO types out of [scanService.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/services/scanService.ts#L1) into the contract layer

## 5. Proposed Contract File Map

Minimum file map for Phase 1:

1. `http.ts`
   - `ApiResult`, `ApiSuccess`, `ApiFailure`, `PaginationMeta`, `RequestMeta`
2. `auth.ts`
3. `profile.ts`
4. `preferences.ts`
5. `trading.ts`
6. `community.ts`
7. `positions.ts`
8. `terminal.ts`
9. `market.ts`

Optional split only if needed:

1. `passport-learning.ts`
2. `arena.ts`
3. `tournaments.ts`

Those are not first because Phase 1 should stabilize the earlier extraction slices first.

## 6. Migration Rules For Wrapper Files

Once a contract file exists:

1. wrapper files may import only from contract files or shared utility files
2. wrapper files may not define duplicate DTOs locally
3. wrapper files may not import from `$lib/server/**`
4. wrapper files may normalize legacy response envelopes, but may not invent new payload shapes

## 7. Validation Checklist

Phase 1 is complete for a slice only when:

1. the domain wrapper imports contracts instead of local DTO definitions
2. the wrapper no longer imports server implementation types
3. `npm run docs:check` passes
4. `npm run check` passes
5. `npm run build` passes

## 8. Immediate Next Step

The next execution slice should be the first actual contract extraction inventory:

1. `http.ts` base envelope and pagination primitives
2. `auth.ts`
3. `profile.ts`
4. `preferences.ts`

That gives the rest of the migration a stable root boundary before trading and terminal contracts are extracted.
