# Phase 1 Trading And Community Contract Extraction

Date: 2026-03-07  
Status: active design slice  
Scope: `/Users/ej/Downloads/maxidoge-clones/frontend`

## 1. Slice Goal

This is the second actual contract-extraction slice.

Goal:

1. extract the first shared `trading` and `community` contract files
2. stop using wrapper-local DTOs for quick trades, tracked signals, copy-trade runs, and community posts
3. make the social-trading surface explicit instead of hiding it inside `tradingApi.ts` and optimistic stores
4. define one canonical shape for feed records, mutation outcomes, and reaction results before API-only backend extraction

This slice follows:

1. [phase-1-foundation-contract-extraction-2026-03-07.md](/Users/ej/Downloads/maxidoge-clones/frontend/docs/exec-plans/active/phase-1-foundation-contract-extraction-2026-03-07.md#L1)
2. [signals-copy-trades-community-internal-boundary-inventory-2026-03-07.md](/Users/ej/Downloads/maxidoge-clones/frontend/docs/exec-plans/active/signals-copy-trades-community-internal-boundary-inventory-2026-03-07.md#L1)
3. [quick-trades-internal-boundary-inventory-2026-03-07.md](/Users/ej/Downloads/maxidoge-clones/frontend/docs/exec-plans/active/quick-trades-internal-boundary-inventory-2026-03-07.md#L1)

## 2. Current Sources To Replace

## 2.1 Trading wrapper

Current browser contract source:

1. [tradingApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/tradingApi.ts#L1)

Problem:

One wrapper file currently owns DTOs and transport for:

1. quick-trade list, open, close, price-sync
2. tracked-signal list, track, convert, delete
3. copy-trade publish

This mixes three adjacent but different contracts into one browser module.

## 2.2 Community wrapper

Current browser contract source:

1. [communityApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/communityApi.ts#L1)

Problem:

The wrapper owns both feed DTOs and the only browser-visible definition of `signalAttachment.evidence`, but the current server canonical path does not fully preserve that field.

## 2.3 Server route shapes

Current trading route sources:

1. [quick-trades GET](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/quick-trades/+server.ts#L1)
2. [quick-trades open](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/quick-trades/open/+server.ts#L1)
3. [signals track](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/signals/track/+server.ts#L1)
4. [signals convert](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/signals/[id]/convert/+server.ts#L1)
5. [copy-trades publish](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/copy-trades/publish/+server.ts#L1)
6. [copy-trades runs](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/copy-trades/runs/+server.ts#L1)

Current community route sources:

1. [community posts](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/community/posts/+server.ts#L1)
2. [community post react](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/community/posts/[id]/react/+server.ts#L1)

## 3. Observed Contract Drift

## 3.1 Quick-trade shape drift

Observed mismatch:

1. quick-trade list records include `userId`
2. open response returns `{ success, trade }`, but clients only extract `trade`
3. convert response returns a reduced trade shape without `userId`, `pnlPercent`, `source`, `note`, `closedAt`, or `closePnl`
4. copy-trade publish returns a trade shape closer to open/list than convert does

Implication:

There is no single canonical `QuickTrade` shape yet. The client currently tolerates multiple partial variants.

## 3.2 Tracked-signal shape drift

Observed mismatch:

1. tracked-signal list and track response include `userId`
2. `signals/track` appends `clientMutationId` onto the returned `signal`
3. copy-trade publish returns a signal shape without `userId`
4. convert writes a quick trade but does not return the updated tracked signal record

Implication:

The browser does not have one durable `TrackedSignal` contract. It has route-specific approximations.

## 3.3 Copy-trade run drift

Observed mismatch:

1. `copy-trades publish` returns `{ success, run, trade, signal }`
2. `publishCopyTradeApi(...)` types only `{ run, trade, signal }`
3. idempotent replay may add `reused: true`
4. `draft` is treated as `Record<string, unknown>` in routes but `CopyTradeDraft` in the browser

Implication:

The publish path has stronger server semantics than the typed client contract expresses.

## 3.4 Community post drift

Observed mismatch:

1. browser `SignalAttachment` includes `evidence?: SignalEvidence`
2. server `validateSignalAttachment(...)` persists `pair`, `dir`, `entry`, `tp`, `sl`, `conf`, `timeframe`, `reason`
3. route `mapRow(...)` reads back no `evidence`
4. `SignalPostCard` and `SignalPostForm` already treat `evidence` as part of product behavior

Implication:

`evidence` is currently a browser-only field, not a durable community contract.

## 3.5 Reaction and feed envelope drift

Observed mismatch:

1. feed list returns `{ success, total, records, pagination }`
2. create post returns `{ success, post }`
3. react returns `{ success, inserted, likes }`
4. unreact returns `{ success, removed, likes }`

Implication:

The contract lacks normalized action-result types for social mutations.

## 4. Proposed File Set

First contract files to create:

1. `src/lib/contracts/trading.ts`
2. `src/lib/contracts/community.ts`

Final target after package extraction:

1. `packages/contracts/src/trading.ts`
2. `packages/contracts/src/community.ts`

## 5. Proposed Exports

## 5.1 `trading.ts`

Required exports:

1. `TradeDirection`
2. `TradeStatus`
3. `TrackedSignalStatus`
4. `QuickTrade`
5. `TrackedSignal`
6. `QuickTradeListData`
7. `TrackedSignalListData`
8. `OpenQuickTradeRequest`
9. `OpenQuickTradeData`
10. `CloseQuickTradeRequest`
11. `CloseQuickTradeData`
12. `UpdateQuickTradePricesRequest`
13. `UpdateQuickTradePricesData`
14. `TrackSignalRequest`
15. `TrackSignalData`
16. `ConvertSignalRequest`
17. `ConvertSignalData`
18. `CopyTradeEvidenceItem`
19. `CopyTradeDraft`
20. `CopyTradeRun`
21. `PublishCopyTradeRequest`
22. `PublishCopyTradeData`

Field normalization rules:

1. `QuickTrade` always includes `userId`, `pnlPercent`, `source`, `note`, `openedAt`, `closedAt`, and `closePnl`
2. `TrackedSignal` always includes `userId`, `confidence`, `source`, `note`, `trackedAt`, and `expiresAt`
3. `clientMutationId` is carried on mutation request and mutation outcome metadata, not embedded ad hoc in entity shapes
4. `ConvertSignalData` returns both the canonical converted trade and the resulting tracked-signal status summary
5. `CopyTradeDraft` is an explicit shared type, not `Record<string, unknown>`

Recommended starter shape:

```ts
export type PublishCopyTradeData = {
  run: CopyTradeRun;
  trade: QuickTrade;
  signal: TrackedSignal;
  reused?: boolean;
};
```

## 5.2 `community.ts`

Required exports:

1. `CommunitySignal`
2. `SignalEvidence`
3. `CommunitySignalAttachment`
4. `CommunityPost`
5. `CommunityPostListData`
6. `CreateCommunityPostRequest`
7. `CreateCommunityPostData`
8. `ReactCommunityPostRequest`
9. `ReactCommunityPostData`
10. `UnreactCommunityPostData`

Field normalization rules:

1. `CommunityPost` uses `body`, not store-local `text`
2. `signalAttachment.evidence` is part of the canonical contract if the UI continues to render it
3. `likes`, `commentCount`, `copyCount`, and `userReacted` are feed projection fields, not optional extras
4. reaction results normalize to one `CommunityReactionData` shape with `likes` and an action flag, instead of separate `inserted` and `removed` payloads

Recommended starter shape:

```ts
export type CommunityReactionData = {
  postId: string;
  likes: number;
  reacted: boolean;
};
```

## 6. Adapter Rules During Transition

Until routes emit canonical shared contracts directly:

1. `tradingApi.ts` may parse legacy `{ success, records }`, `{ success, trade }`, and `{ success, signal }`
2. `publishCopyTradeApi(...)` must start typing `success` and optional `reused`
3. `communityApi.ts` may continue parsing `{ success, total, records }` and `{ success, post }`
4. wrapper adapters are responsible for restoring canonical `QuickTrade`, `TrackedSignal`, and `CommunityPost` shapes from legacy route payloads
5. no store should infer missing canonical fields by hand after this slice lands

## 7. Migration Sequence

1. add `src/lib/contracts/trading.ts`
2. add `src/lib/contracts/community.ts`
3. move wrapper-local interfaces in `tradingApi.ts` onto shared contract imports
4. move wrapper-local interfaces in `communityApi.ts` onto shared contract imports
5. adapt `communityStore.ts`, `copyTradeStore.ts`, `quickTradeStore.ts`, and `trackedSignalStore.ts` to canonical entity shapes
6. only then normalize route responses one by one to canonical `ApiResult<T>`

## 8. Validation Checklist

This slice is complete when:

1. no browser DTO for quick trades, tracked signals, copy-trade runs, or community posts remains inside API wrapper files
2. `SignalAttachment.evidence` is either durably supported server-side or removed from canonical UI contracts
3. `convert`, `open`, and `copy-trade publish` all return the same `QuickTrade` contract
4. `track` and `copy-trade publish` both return the same `TrackedSignal` contract
5. `copyTradeStore.ts` no longer depends on implicit route-specific payload differences
6. `communityStore.ts` no longer remaps `body -> text` as a hidden local contract fork

## 9. Why This Slice Comes Next

The foundation slice normalized transport, auth, profile, and preferences. The next actual break point is the trading-social surface because:

1. terminal, signals, and passport all depend on it
2. current browser stores hide multiple contract mismatches with optimistic remapping
3. backend extraction will fail if these entities remain wrapper-local and route-specific

This slice creates the first reusable business-entity contracts after the foundation layer.
