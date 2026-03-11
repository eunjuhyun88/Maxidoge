# Phase 1 Positions And Portfolio Contract Extraction

Date: 2026-03-07  
Status: active design slice  
Scope: `/Users/ej/Downloads/maxidoge-clones/frontend`

## 1. Slice Goal

This is the third actual contract-extraction slice.

Goal:

1. extract canonical contracts for unified positions, portfolio holdings, and Polymarket signing flows
2. remove the direct browser import of server implementation types from `positionsApi.ts`
3. separate read-model contracts from venue execution contracts before API-only backend extraction
4. keep `positionStore.ts` as a web projection layer instead of a hidden source of entity shape truth

This slice follows:

1. [phase-1-trading-community-contract-extraction-2026-03-07.md](/Users/ej/Downloads/maxidoge-clones/frontend/docs/exec-plans/active/phase-1-trading-community-contract-extraction-2026-03-07.md#L1)
2. [positions-portfolio-execution-boundary-inventory-2026-03-07.md](/Users/ej/Downloads/maxidoge-clones/frontend/docs/exec-plans/active/positions-portfolio-execution-boundary-inventory-2026-03-07.md#L1)

Out of scope for this slice:

1. full GMX contract extraction
2. market discovery contracts
3. venue service implementation moves

## 2. Current Sources To Replace

## 2.1 Positions wrapper

Current browser contract source:

1. [positionsApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/positionsApi.ts#L1)

Observed boundary leak:

1. [positionsApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/positionsApi.ts#L1) imports `EIP712TypedData` from [polymarketClob.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/polymarketClob.ts#L1)

That is a direct browser-to-server implementation type leak and must be replaced by a shared contract type.

## 2.2 Portfolio wrapper

Current browser contract source:

1. [portfolioApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/portfolioApi.ts#L1)

Problem:

1. holdings fetch has a typed response
2. holdings upsert throws away the returned canonical `holding` payload and collapses to `boolean`

## 2.3 Server route shapes

Current read-side route sources:

1. [positions/unified](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/positions/unified/+server.ts#L1)
2. [portfolio/holdings](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/portfolio/holdings/+server.ts#L1)

Current Polymarket execution route sources:

1. [positions/polymarket/auth](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/positions/polymarket/auth/+server.ts#L1)
2. [positions/polymarket/prepare](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/positions/polymarket/prepare/+server.ts#L1)
3. [positions/polymarket/submit](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/positions/polymarket/submit/+server.ts#L1)

## 3. Observed Contract Drift

## 3.1 Unified positions drift

Observed mismatch:

1. `positions/unified` returns `{ ok, positions, total }`
2. `UnifiedPosition` is only defined in the wrapper and the route
3. `meta` is a free-form `Record<string, unknown>` that changes by venue
4. `positionStore.ts` treats the wrapper-local type as canonical and mutates it optimistically

Implication:

The unified read model is real, but its entity contract is not yet shared or stable.

## 3.2 Portfolio holdings drift

Observed mismatch:

1. `portfolio/holdings GET` returns `{ ok, data: { holdings, totalValue, totalCost } }`
2. `portfolio/holdings POST` returns `{ ok, holding }`
3. `portfolioApi.fetchHoldings()` models the GET contract
4. `portfolioApi.upsertHolding(...)` discards the POST contract and returns `boolean`

Implication:

The browser cannot treat holdings as a canonical entity round-trip today because the upsert contract is erased at the wrapper boundary.

## 3.3 Polymarket typed-data drift

Observed mismatch:

1. auth GET returns `{ ok, typedData, timestamp, nonce }`
2. auth POST returns `{ ok, authenticated }`
3. prepare returns `{ ok, positionId, typedData, orderParams }`
4. submit returns `{ ok, clobOrderId, orderStatus }`
5. all of those shapes rely on typed-data structure that currently lives in a server implementation module

Implication:

The browser can only compile because it imports a server-only type. That blocks clean FE/BE separation.

## 3.4 Venue scope drift

Observed mismatch:

1. `positionsApi.ts` mixes unified read transport and Polymarket execution transport
2. `portfolioApi.ts` is separate, but downstream UI surfaces discuss holdings and positions together
3. `positionStore.ts` polls Polymarket status and GMX status through the same optimistic projection

Implication:

Read model, holdings projection, and venue execution are adjacent concerns, not one shared transport contract.

## 4. Proposed File Set

First contract files to create:

1. `src/lib/contracts/positions.ts`
2. `src/lib/contracts/portfolio.ts`
3. `src/lib/contracts/polymarket.ts`

Final target after package extraction:

1. `packages/contracts/src/positions.ts`
2. `packages/contracts/src/portfolio.ts`
3. `packages/contracts/src/polymarket.ts`

This refines the earlier generic catalog. One `positions.ts` file is not enough because typed-data signing is not the same contract category as a unified portfolio read model.

## 5. Proposed Exports

## 5.1 `positions.ts`

Required exports:

1. `PositionType`
2. `UnifiedPositionStatus`
3. `UnifiedPosition`
4. `UnifiedPositionsData`

Field normalization rules:

1. `UnifiedPosition` is a read projection only
2. `meta` stays venue-specific but is typed as a tagged object per `type`, not an unbounded generic record
3. `openedAt` is always epoch milliseconds
4. `direction` stays presentation-safe and normalized across venues

## 5.2 `portfolio.ts`

Required exports:

1. `PortfolioHolding`
2. `PortfolioSummary`
3. `PortfolioHoldingsData`
4. `UpsertPortfolioHoldingRequest`
5. `UpsertPortfolioHoldingData`

Field normalization rules:

1. holdings remain separate from open positions
2. `totalValue` and `totalCost` belong to summary data, not each holding row
3. upsert returns the canonical saved holding, not only a success boolean

Recommended starter shape:

```ts
export type PortfolioHoldingsData = {
  holdings: PortfolioHolding[];
  totalValue: number;
  totalCost: number;
};
```

## 5.3 `polymarket.ts`

Required exports:

1. `Eip712TypeField`
2. `Eip712TypedData`
3. `PolymarketAuthChallengeData`
4. `SubmitPolymarketAuthRequest`
5. `SubmitPolymarketAuthData`
6. `PreparePolymarketOrderRequest`
7. `PreparePolymarketOrderData`
8. `SubmitPolymarketOrderRequest`
9. `SubmitPolymarketOrderData`
10. `PolymarketOrderParams`
11. `PolymarketPosition`
12. `PolymarketPositionStatusData`

Field normalization rules:

1. the typed-data contract is shared and implementation-agnostic
2. browser code imports it from contracts, never from `$lib/server/**`
3. auth challenge, order prepare, and submit are separate contracts, not overloaded response unions
4. `positionId` and `clobOrderId` remain server-issued identifiers, not UI-local placeholders

Recommended starter shape:

```ts
export type PreparePolymarketOrderData = {
  positionId: string;
  typedData: Eip712TypedData;
  orderParams: PolymarketOrderParams;
};
```

## 6. Adapter Rules During Transition

Until routes emit shared contracts directly:

1. `positionsApi.ts` may keep parsing legacy `{ ok, positions, total }`
2. `portfolioApi.ts` must stop collapsing upsert to `boolean` and start surfacing the saved holding
3. wrapper adapters may continue mapping legacy `meta` payloads into typed venue-specific `meta` variants
4. no browser file may import types from `$lib/server/**` after this slice lands

## 7. Migration Sequence

1. add `src/lib/contracts/positions.ts`
2. add `src/lib/contracts/portfolio.ts`
3. add `src/lib/contracts/polymarket.ts`
4. move `UnifiedPosition`, `PortfolioHolding`, and typed-data shapes out of wrapper files
5. replace the direct `EIP712TypedData` server import in `positionsApi.ts`
6. update `portfolioApi.upsertHolding(...)` to return canonical data
7. adapt `positionStore.ts` to the shared `UnifiedPosition` contract without changing authority boundaries
8. only then normalize route responses to canonical `ApiResult<T>`

## 8. Validation Checklist

This slice is complete when:

1. `positionsApi.ts` no longer imports anything from `$lib/server/**`
2. unified positions, portfolio holdings, and Polymarket typed-data shapes all come from shared contract files
3. `portfolioApi.upsertHolding(...)` returns the saved holding contract
4. `positionStore.ts` compiles against shared `UnifiedPosition` without wrapper-local DTOs
5. auth, prepare, and submit Polymarket responses all type-check without server implementation imports

## 9. Why This Slice Comes Next

This slice is the next stable break point because:

1. positions and holdings are shared consumers across terminal, passport, and future portfolio pages
2. the current direct import of a server type into browser transport blocks actual FE/BE separation
3. read-model and execution contracts need to be explicit before venue services can move into an API-only backend
