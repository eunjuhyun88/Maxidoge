# Phase 1 Terminal And Market Contract Extraction

Date: 2026-03-07  
Status: active design slice  
Scope: `/Users/ej/Downloads/maxidoge-clones/frontend`

## 1. Slice Goal

This is the fourth actual contract-extraction slice.

Goal:

1. extract shared contracts for `terminal` and `market` transport
2. remove the type-only import from `terminalApi.ts` into server `scanService.ts`
3. make `terminal` interaction contracts distinct from raw market-feed contracts
4. define `intel-policy` as a terminal aggregate contract, not a miscellaneous wrapper detail

This slice follows:

1. [phase-1-positions-portfolio-contract-extraction-2026-03-07.md](/Users/ej/Downloads/maxidoge-clones/frontend/docs/exec-plans/active/phase-1-positions-portfolio-contract-extraction-2026-03-07.md#L1)
2. [terminal-market-intel-interaction-boundary-inventory-2026-03-07.md](/Users/ej/Downloads/maxidoge-clones/frontend/docs/exec-plans/active/terminal-market-intel-interaction-boundary-inventory-2026-03-07.md#L1)

## 2. Current Sources To Replace

## 2.1 Terminal wrapper

Current browser contract source:

1. [terminalApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/terminalApi.ts#L1)

Observed boundary leak:

1. [terminalApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/terminalApi.ts#L1) imports `TerminalScanSummary`, `TerminalScanDetail`, and `TerminalScanSignal` from [scanService.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/services/scanService.ts#L1)

That is the same category of FE/BE leak as the old `positionsApi.ts` typed-data import.

## 2.2 Intel and market wrapper

Current browser contract source:

1. [intelApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/intelApi.ts#L1)

Problem:

1. one wrapper file currently covers market news, events, flow, trending, onchain alerts, opportunity scan, intel policy, and shadow execution
2. some of those are raw market-feed contracts
3. some are terminal aggregate or terminal action contracts

## 2.3 Server route shapes

Current terminal route sources:

1. [terminal/scan](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/terminal/scan/+server.ts#L1)
2. [chat/messages](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/chat/messages/+server.ts#L1)
3. [terminal/intel-policy](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/terminal/intel-policy/+server.ts#L1)
4. `terminal/scan/history`
5. `terminal/scan/[id]`
6. `terminal/scan/[id]/signals`
7. `terminal/intel-agent-shadow`
8. `terminal/intel-agent-shadow/execute`

Current market route sources:

1. [market/trending](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/market/trending/+server.ts#L1)
2. `market/news`
3. `market/events`
4. `market/flow`
5. `market/alerts/onchain`
6. `market/snapshot`

## 3. Observed Contract Drift

## 3.1 Scan contract drift

Observed mismatch:

1. `terminal/scan` returns both `success: true` and `ok: true`
2. the wrapper treats either `success` or `ok` as valid
3. scan DTOs live in a server service file, not shared contracts

Implication:

The client currently accepts a mixed legacy envelope and depends on server implementation types.

## 3.2 Chat contract drift

Observed mismatch:

1. `TerminalChatRow` only exists in `terminalApi.ts`
2. `/api/chat/messages` is a broad terminal-aware orchestration route with agent routing, scan-context lookup, and LLM fallback
3. there is no shared `SendTerminalChatMessageRequest/Data` contract even though multiple runtimes depend on the response shape

Implication:

Chat is a first-class terminal contract but is still wrapper-local.

## 3.3 Market and intel drift

Observed mismatch:

1. `intelApi.ts` defines its own DTOs for news, flow, trending, opportunity, and shadow payloads
2. `intel-policy` is not a raw market feed; it is a server aggregate built by calling several `/api/market/*` endpoints plus `/api/terminal/opportunity-scan`
3. terminal live ticker is still assembled browser-side while a server-side `market snapshot` boundary already exists elsewhere

Implication:

There is no clean line yet between:

1. raw market-feed contracts
2. terminal aggregate contracts
3. terminal action contracts

## 4. Proposed File Set

First contract files to create:

1. `src/lib/contracts/terminal.ts`
2. `src/lib/contracts/market.ts`

Final target after package extraction:

1. `packages/contracts/src/terminal.ts`
2. `packages/contracts/src/market.ts`

## 5. Proposed Exports

## 5.1 `terminal.ts`

Required exports:

1. `TerminalScanSignal`
2. `TerminalScanSummary`
3. `TerminalScanDetail`
4. `RunTerminalScanRequest`
5. `RunTerminalScanData`
6. `TerminalScanHistoryData`
7. `TerminalChatMessage`
8. `SendTerminalChatMessageRequest`
9. `SendTerminalChatMessageData`
10. `TerminalIntelPolicyData`
11. `TerminalShadowPolicyData`
12. `ExecuteTerminalShadowTradeRequest`
13. `ExecuteTerminalShadowTradeData`

Field normalization rules:

1. scan contracts move out of `scanService.ts` into shared contracts
2. terminal routes use one canonical outer envelope, not mixed `success` and `ok`
3. chat message rows are shared entities, not wrapper-local records
4. `intel-policy` and `shadow` stay under `terminal.ts` because they are terminal aggregate/action surfaces, not raw feeds

## 5.2 `market.ts`

Required exports:

1. `MarketNewsRecord`
2. `MarketNewsPageData`
3. `MarketEventRecord`
4. `MarketFlowSnapshot`
5. `MarketFlowRecord`
6. `MarketFlowData`
7. `MarketTrendingData`
8. `MarketOnchainAlertsData`
9. `MarketSnapshotData`
10. `TerminalLiveTickerSnapshot`

Field normalization rules:

1. raw feed contracts are market contracts even when terminal consumes them
2. `TerminalLiveTickerSnapshot` belongs here because it is a market-state projection, not terminal session state
3. `opportunity-scan` is classified as market intelligence input unless it carries terminal-only aggregate state

## 6. Adapter Rules During Transition

Until routes emit shared contracts directly:

1. `terminalApi.ts` may continue accepting legacy `success` and `ok`, but its entity types must come from `terminal.ts`
2. `intelApi.ts` may keep wrapper parsing, but its DTOs must come from `market.ts` or `terminal.ts`
3. no browser wrapper may import types from `$lib/services/**` or `$lib/server/**` after this slice lands

## 7. Migration Sequence

1. add `src/lib/contracts/terminal.ts`
2. add `src/lib/contracts/market.ts`
3. move scan DTO types out of `scanService.ts`
4. move chat row and chat response types out of `terminalApi.ts`
5. move market-feed DTOs out of `intelApi.ts`
6. classify each intel wrapper call as either `market` or `terminal aggregate`
7. only then consider splitting wrapper files or normalizing route envelopes

## 8. Validation Checklist

This slice is complete when:

1. `terminalApi.ts` no longer imports anything from `$lib/services/**`
2. scan, chat, and intel-policy DTOs all come from `terminal.ts`
3. news, events, flow, trending, onchain, snapshot, and ticker DTOs all come from `market.ts`
4. `intelApi.ts` no longer defines wrapper-local feed DTOs
5. wrapper code can type-check against shared contracts without reading terminal component types or server service types

## 9. Why This Slice Comes Next

This slice is the next stable break point because:

1. terminal is the main consumer and action issuer across several already-inventoried domains
2. `terminalApi.ts` still has a direct server-type dependency
3. API-only backend extraction will stall unless terminal and market transport are disentangled first
