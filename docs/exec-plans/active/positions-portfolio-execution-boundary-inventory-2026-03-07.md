# Positions / Portfolio / Execution Boundary Inventory

Date: 2026-03-07  
Status: active design slice  
Scope: `/Users/ej/Downloads/maxidoge-clones/frontend`

## 1. Slice Goal

This is the sixth real internal split slice.

Goal:

1. make `positions` and `portfolio` separable inside the current `frontend` app
2. keep wallet-mediated UX, optimistic staging, and tab refresh logic in the `web zone`
3. keep venue-specific execution authority and holdings projection in the `server zone`
4. define the actual boundary shape: `unified positions read model`, `polymarket execution`, `gmx execution`, and `portfolio holdings projection`

This slice comes after `terminal / market / intel` because terminal and passport both consume the current hybrid positions surface.

## 2. Current Flow Summary

There is not one positions flow today. There are four.

## 2.1 Unified positions read flow

`IntelPanel / passport / future positions consumers -> positionStore.ts -> positionsApi.fetchUnifiedPositions -> /api/positions/unified -> quick_trades + polymarket_positions + gmx_positions`

Implication:

1. `/api/positions/unified` is a read-side aggregate view
2. it is not the durable execution authority for any one venue

## 2.2 Polymarket execution flow

`PolymarketBetPanel.svelte -> positionsApi.preparePolymarketOrder / submitPolymarketOrder / getPolymarketAuthData / submitPolymarketAuth -> /api/positions/polymarket/* -> polymarketClob + polymarket_positions`

Implication:

1. Polymarket is a multi-step wallet-mediated execution flow
2. typed-data signing and submit status are first-class boundary concerns, not UI details

## 2.3 GMX execution flow

`GmxTradePanel.svelte -> gmxApi.prepareGmxOrder / confirmGmxOrder / fetchGmxBalance / fetchGmxMarkets -> /api/gmx/* -> gmxV2 + gmx_positions`

Implication:

1. GMX is another multi-step wallet-mediated execution flow
2. it has different authority, different failure states, and different persistence than Polymarket

## 2.4 Portfolio holdings flow

`passport/+page.svelte -> portfolioApi.fetchHoldings -> /api/portfolio/holdings -> portfolio_holdings`

Implication:

1. holdings are a portfolio projection
2. holdings are not the same thing as open execution positions
3. the UI currently discusses them together, but the authority boundary is different

## 3. Current Web-Zone Inventory

## 3.1 Browser-facing entry points

Primary web files:

1. [positionStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/positionStore.ts)
2. [positionsApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/positionsApi.ts)
3. [gmxApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/gmxApi.ts)
4. [portfolioApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/portfolioApi.ts)
5. [intelPositionRuntime.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/terminal/intel/intelPositionRuntime.ts)
6. [GmxTradePanel.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/terminal/GmxTradePanel.svelte)
7. [PolymarketBetPanel.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/terminal/PolymarketBetPanel.svelte)
8. [IntelPanel.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/terminal/IntelPanel.svelte)
9. [passport/+page.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/passport/+page.svelte)

## 3.2 Web responsibilities today

### `src/lib/stores/positionStore.ts`

Owns:

1. unified positions hydration through `/api/positions/unified`
2. optimistic `addPosition`, `updatePosition`, and `removePosition`
3. derived split views for `quick_trade`, `polymarket`, and `gmx`
4. pending-position polling for both Polymarket and GMX
5. aggregate pnl and position counts across all three authorities

Boundary concern:

1. the store is a hybrid cache over three different server authorities
2. it is useful as a UI projection, but it is not a clean authority boundary
3. execution truth is venue-specific, while the store hides that behind one optimistic surface

### `src/lib/api/positionsApi.ts`

Owns:

1. browser wrappers for unified positions
2. browser wrappers for Polymarket auth, prepare, submit, status, and close
3. wrapper-local DTOs for unified and Polymarket responses

Boundary concern:

1. this file mixes read-model transport and Polymarket execution transport
2. it imports `EIP712TypedData` from [polymarketClob](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/polymarketClob.ts)
3. that is a direct browser-to-server implementation type leak and should move into a shared contract layer

### `src/lib/api/gmxApi.ts`

Owns:

1. browser wrappers for GMX market discovery
2. browser wrappers for GMX balance and allowance checks
3. browser wrappers for GMX prepare, confirm, position fetch, and close

Boundary concern:

1. GMX is cleaner than Polymarket because its transport file does not import server implementation types
2. but it still mixes discovery, balance, execution, and read-model concerns in one wrapper

### `src/lib/api/portfolioApi.ts`

Owns:

1. holdings fetch
2. holdings upsert

Boundary concern:

1. this file is already narrow and points at the right server boundary
2. but it still lives next to execution consumers that treat holdings as just another positions tab

### `src/lib/terminal/intel/intelPositionRuntime.ts`

Owns:

1. polling cadence for the `positions` intel tab
2. document-visibility-aware refresh
3. coordination between full hydrate and pending-position polling

Boundary verdict:

1. this is a good web-only runtime seam
2. it should remain a view/runtime concern rather than absorbing execution logic

### `src/components/terminal/GmxTradePanel.svelte`

Owns:

1. GMX market selection and leverage input
2. wallet chain switch to Arbitrum
3. balance and approval checks
4. prepare -> wallet send -> confirm workflow
5. optimistic `addPosition(...)` after transaction send

Boundary concern:

1. this panel is a workflow orchestrator, not the durable owner of GMX positions
2. wallet-mediated transaction sequencing is still embedded in the UI panel

### `src/components/terminal/PolymarketBetPanel.svelte`

Owns:

1. YES/NO market bet input
2. wallet chain switch to Polygon
3. prepare -> sign typed data -> submit workflow
4. auth fallback for deriving Polymarket L2 credentials
5. optimistic `addPosition(...)` after submit

Boundary concern:

1. this panel is also a workflow orchestrator, not the durable owner of Polymarket positions
2. authentication fallback and signed-order retry are still embedded in the UI panel

### `src/components/terminal/IntelPanel.svelte`

Owns:

1. positions tab consumption
2. refresh and display entry point for the unified positions slice
3. adjacent consumption of intel feeds, policy, shadow execution, and other terminal concerns

Boundary concern:

1. positions are not the only domain consumed here
2. this makes the positions boundary harder to see from the route layer

### `src/routes/passport/+page.svelte`

Owns:

1. holdings fetch through `portfolioApi.fetchHoldings()`
2. holdings fallback to static `HOLDINGS_DATA`
3. presentation of holdings next to profile, arena, and quick-trade metrics

Boundary concern:

1. passport is a read-side consumer of portfolio projection
2. it must not become a second authority for holdings or positions

## 4. Current Server-Zone Inventory

## 4.1 Unified positions read route

Current route:

1. [positions/unified](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/positions/unified/+server.ts)

Current responsibility:

1. auth check
2. query `quick_trades`
3. query `polymarket_positions`
4. query `gmx_positions`
5. map all three into a single unified response contract

Boundary verdict:

1. this route is a read aggregation boundary only
2. it should not be mistaken for execution authority

## 4.2 Polymarket execution routes

Current route set:

1. [positions/polymarket](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/positions/polymarket/+server.ts)
2. [positions/polymarket/auth](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/positions/polymarket/auth/+server.ts)
3. [positions/polymarket/prepare](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/positions/polymarket/prepare/+server.ts)
4. [positions/polymarket/submit](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/positions/polymarket/submit/+server.ts)
5. [positions/polymarket/status/[id]](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/positions/polymarket/status/[id]/+server.ts)
6. [positions/polymarket/[id]/close](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/positions/polymarket/[id]/close/+server.ts)

Current responsibility:

1. auth and wallet ownership checks
2. typed-data order preparation
3. L2 auth credential derivation
4. signed order submission
5. status synchronization
6. close-order preparation
7. direct writes to `polymarket_positions`

Boundary verdict:

1. this is a real server execution boundary
2. but the logic still lives mostly in route files rather than a dedicated service layer

## 4.3 GMX execution routes

Current route set:

1. [gmx/markets](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/gmx/markets/+server.ts)
2. [gmx/balance](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/gmx/balance/+server.ts)
3. [gmx/prepare](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/gmx/prepare/+server.ts)
4. [gmx/confirm](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/gmx/confirm/+server.ts)
5. [gmx/positions](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/gmx/positions/+server.ts)
6. [gmx/close](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/gmx/close/+server.ts)

Current responsibility:

1. market metadata exposure
2. wallet balance and allowance checks
3. calldata preparation
4. post-wallet transaction confirmation
5. open-position list read
6. close calldata preparation
7. direct writes to `gmx_positions`

Boundary verdict:

1. this is another real server execution boundary
2. it should remain separate from Polymarket even if the UI presents both inside one positions tab

## 4.4 Portfolio holdings projection route

Current route:

1. [portfolio/holdings](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/portfolio/holdings/+server.ts)

Current responsibility:

1. auth check
2. read holdings projection from `portfolio_holdings`
3. compute portfolio totals server-side
4. upsert manual or synced holding rows

Boundary concern:

1. this is a narrow projection boundary, which is good
2. but POST still uses raw `request.json()` instead of a shared guarded body reader

## 5. Authority Split

Current durable authorities are already separate in storage:

1. `quick_trades`
2. `polymarket_positions`
3. `gmx_positions`
4. `portfolio_holdings`

Important conclusion:

1. the current UI suggests one broad `positions` domain
2. the server truth is already four smaller domains
3. the real redesign should respect that split instead of forcing one artificial backend service called `positions`

## 6. Boundary Verdict

What is already good:

1. Polymarket and GMX mutations already go through server APIs
2. wallet send/sign steps stay in the browser where they belong
3. `intelPositionRuntime.ts` is already a good web-only refresh seam
4. holdings are already isolated behind their own route

What is not good enough:

1. the browser store collapses several authorities into one optimistic cache
2. read-model transport and execution transport are mixed in `positionsApi.ts`
3. browser transport imports a type from a server implementation module
4. panel components still embed too much workflow sequencing
5. unified positions can be mistaken for a write authority when it is only a read model

## 7. Specific Boundary Problems

1. [positionsApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/positionsApi.ts) imports `EIP712TypedData` from [polymarketClob.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/polymarketClob.ts) instead of a shared contract file.
2. [positionStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/positionStore.ts) mixes quick-trade, Polymarket, and GMX positions into one optimistic surface even though they have different authorities and lifecycle rules.
3. [GmxTradePanel.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/terminal/GmxTradePanel.svelte) and [PolymarketBetPanel.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/terminal/PolymarketBetPanel.svelte) still hold venue-specific workflow orchestration directly in UI components.
4. [positions/unified/+server.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/positions/unified/+server.ts) is a read projection, but the current naming makes it easy to over-ascribe authority to it.
5. [portfolio/holdings/+server.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/portfolio/holdings/+server.ts) uses a narrower domain correctly, but its POST path still bypasses shared request guards.
6. [passport/+page.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/passport/+page.svelte) treats holdings as a read-side view with static fallback, which is fine, but that reinforces that holdings are a projection and not an execution source of truth.

## 8. Required Internal Split

Before any physical FE/BE extraction, this slice should be treated as four internal boundaries:

1. `positions-read-model`
   - owns unified cross-venue list projection
   - exposed through `/api/positions/unified`
2. `polymarket-execution`
   - owns auth, prepare, submit, status, and close for Polymarket
   - durable truth in `polymarket_positions`
3. `gmx-execution`
   - owns market metadata, balance, prepare, confirm, positions, and close for GMX
   - durable truth in `gmx_positions`
4. `portfolio-projection`
   - owns holdings list and holdings upsert
   - durable truth in `portfolio_holdings`

The browser should consume these as distinct boundaries even if one page shows them together.

## 9. Refactor Tasks Before Physical Extraction

1. move `EIP712TypedData` and any other transport DTOs out of server implementation files into a shared contract layer
2. split [positionsApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/positionsApi.ts) into `positionsReadApi.ts` and `polymarketExecutionApi.ts`
3. keep [gmxApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/gmxApi.ts) but consider splitting discovery/balance from execution transport
4. reduce [positionStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/positionStore.ts) to a read-model cache and stop using it as a generic optimistic authority bucket
5. extract venue-specific orchestration from [GmxTradePanel.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/terminal/GmxTradePanel.svelte) and [PolymarketBetPanel.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/components/terminal/PolymarketBetPanel.svelte) into web runtimes or action controllers
6. add shared guarded body parsing to [portfolio/holdings/+server.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/portfolio/holdings/+server.ts) so projection writes follow the same server standards as other mutations
7. keep `/api/positions/unified` read-only and name/document it as a projection boundary rather than a venue authority

## 10. Extraction Readiness Criteria

This slice is ready for physical extraction only when:

1. browser transport no longer imports from `$lib/server/*`
2. venue-specific execution DTOs live in a shared contract layer
3. unified positions is treated as a read model rather than a write boundary
4. portfolio holdings remains a separate projection service surface
5. wallet-mediated browser workflows call only explicit browser API wrappers
6. route files hand off most venue logic to dedicated server services instead of carrying all mutation logic inline

## 11. Immediate Next Step

The next slice should be `passport / learning / jobs`.

Reason:

1. passport already consumes holdings as a projection
2. it mixes profile, portfolio, arena summary, and learning worker orchestration
3. finishing that slice will clarify which read models stay in the web app and which long-running operations belong in future `api` or `worker` services
