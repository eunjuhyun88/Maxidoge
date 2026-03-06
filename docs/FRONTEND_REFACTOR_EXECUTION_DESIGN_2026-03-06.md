# Frontend Refactor Execution Design — 2026-03-06

Date: 2026-03-06
Scope: `/Users/ej/Downloads/maxidoge-clones/frontend`
Status: Design locked before implementation

## 0. Canonical Inputs
- Root guide: `/Users/ej/Downloads/maxidoge-clones/CLAUDE.md`
- Active guide: `/Users/ej/Downloads/maxidoge-clones/frontend/CLAUDE.md`
- Local design authority:
  - `docs/SYSTEM_INTENT.md`
  - `docs/DESIGN.md`
  - `docs/FRONTEND.md`
  - `docs/design-docs/arena-domain-model.md`
  - `docs/design-docs/learning-loop.md`
- External fallback only if local docs are insufficient:
  - `/Users/ej/Downloads/maxidoge-clones/STOCKCLAW_UNIFIED_DESIGN.md`
- Related working docs:
  - `docs/terminal-refactor-master-plan-2026-03-06.md`
  - `docs/terminal-uiux-refactor-design-v3-2026-03-06.md`
  - `docs/community-chart-signal-copytrade-flow-2026-03-06.md`

## 1. Problem Statement
- The product intent is strong, but the implementation is still too heavy, too stateful, and too duplicated to be safe to evolve quickly.
- The current frontend works, but it does not yet meet the intended quality bar for elegance, performance, state authority, bug isolation, and security boundaries.
- Refactoring must start from architecture and state ownership, not from cosmetic component splitting alone.

## 2. Audit Snapshot

### Validation
- `npm run check`: PASS, `0 errors / 35 warnings`
- `npm run build`: PASS

### Hotspots
- `src/components/arena/ChartPanel.svelte`: 4016 lines
- `src/routes/arena/+page.svelte`: 3396 lines
- `src/components/terminal/IntelPanel.svelte`: 2827 lines
- `src/routes/terminal/+page.svelte`: 2789 lines
- `src/routes/passport/+page.svelte`: 2688 lines

### Structural signals
- Workspace-level identical relative files across legacy apps: 386
- Large client payloads after build:
  - Pixi chunk: about 817 KB
  - lightweight-charts chunk: about 185 KB
- Current build passes, but heavy route modules remain:
  - terminal page server output: about 149.5 KB
  - arena-v2 page server output: about 135.6 KB
  - arena page server output: about 116.9 KB

## 3. Confirmed Findings

### F1. State authority is blurred
- `priceStore` is the intended live price contract, but `gameState` mirrors live prices again.
- Result: one market tick can fan out through unrelated UI state and cause avoidable reactivity churn.
- Evidence:
  - `src/lib/stores/priceStore.ts`
  - `src/lib/stores/gameState.ts`
  - `src/routes/+layout.svelte`

### F2. Server-authoritative domains still trust client-local state too much
- Profile, badges, quick trades, tracked signals, and other data still rely on `localStorage` beyond cache/offline use.
- This violates the stated architecture direction that the server should be authoritative.
- Evidence:
  - `src/lib/stores/userProfileStore.ts`
  - `src/lib/stores/quickTradeStore.ts`
  - `src/lib/stores/gameState.ts`
  - `src/lib/stores/dbStore.ts`

### F3. Chart logic is over-coupled
- Chart rendering, indicator updates, pattern detection, drawing overlay, TradingView embed, trade planner, and live WS handling live in one component.
- This creates high regression risk and makes performance tuning hard.
- Evidence:
  - `src/components/arena/ChartPanel.svelte`
  - `src/lib/chart/*`

### F4. Terminal orchestration is still a god-shell
- `/terminal` mixes viewport layout, CTA logic, analytics, scan orchestration, chat state, modal state, and responsive interaction rules.
- Layout split work has started, but domain action ownership is still too broad.
- Evidence:
  - `src/routes/terminal/+page.svelte`
  - `src/components/terminal/IntelPanel.svelte`

### F5. A real duplication bug is likely in QuickTrade hydration/reconcile
- Local optimistic trades and server-issued trades can coexist if hydration and ID replacement timing diverge.
- The current merge strategy is not based on a stable client mutation key.
- Evidence:
  - `src/lib/stores/quickTradeStore.ts`

### F6. Security hardening is incomplete
- Security headers exist, but CSP is still minimal.
- User profile badge payloads are writable from the client without strong server-side derivation rules.
- Evidence:
  - `src/hooks.server.ts`
  - `src/routes/api/profile/+server.ts`

### F7. Legacy app copies are still a maintenance tax
- `frontend` is canonical, but multiple sibling app trees still carry identical copies.
- This is not only a repo hygiene issue; it increases drift risk and review noise.

## 4. Refactor Goals

### G1. Enforce clean state authority
- Live price must have one canonical client owner.
- Domain data must have one canonical server owner.
- Route state must stay route-local and transient.

### G2. Make high-risk screens decomposable
- Terminal, Chart, Arena, and Passport must be split into orchestration layer, view model layer, and presentation layer.

### G3. Eliminate hidden performance churn
- No unnecessary propagation of live prices into large unrelated stores.
- No repeated full recompute work on every chart move or websocket tick when incremental updates are sufficient.

### G4. Tighten security boundaries
- The client may suggest, but the server must validate or derive.
- External embeds and external URLs must live behind explicit policies.

### G5. Reduce duplicate implementation surfaces
- Canonical code must live in `frontend`.
- Shared UI and shared fetch infra must be pulled upward, not copied sideways.

## 5. Target Architecture

### A. State Authority Map

#### A1. `priceStore`
- Single source of truth for live prices and 24h stats.
- Consumers subscribe directly.
- No reverse-mirroring into `gameState`.

#### A2. `gameState`
- Holds only session/transient arena and route-level control state.
- Must not own live market truth.
- Allowed examples:
  - selected pair
  - selected timeframe
  - current phase
  - draft selection
  - temporary UI view

#### A3. Server-authoritative domain stores
- `userProfileStore`
- `quickTradeStore`
- `trackedSignalStore`
- `matchHistoryStore`
- `communityStore`
- Local storage role: cache, offline fallback, or optimistic staging only.

### B. Terminal Layering

#### B1. Route shell
- `src/routes/terminal/+page.svelte`
- Owns viewport mode selection, top-level wiring, and route entry/exit behavior only.

#### B2. View model
- New target modules:
  - `src/components/terminal/terminalViewModel.ts`
  - `src/components/terminal/intelViewModel.ts`
- Own CTA labels, scan readiness, chat-trade readiness, active panel rules, responsive orchestration, and analytics payload shaping.

#### B3. Presentation
- New target components:
  - `TerminalDesktopLayout.svelte`
  - `TerminalTabletLayout.svelte`
  - `TerminalMobileLayout.svelte`
  - `IntelChatTab.svelte`
  - `IntelFeedTab.svelte`
  - `IntelPositionsTab.svelte`

### C. Chart Layering

#### C1. Chart core
- lightweight-charts instance setup
- kline loading
- resize handling
- ws update subscription

#### C2. Indicator engine
- SMA, RSI, volume, incremental updates
- chart-visible recalculation rules

#### C3. Overlay renderer
- drawing canvas rendering
- trade zones
- annotation rendering
- pattern overlay rendering

#### C4. Pattern service
- visible range extraction
- throttled scan scheduling
- result normalization

#### C5. TradingView adapter
- iframe embed
- retry/fallback handling
- explicit external policy boundary

### D. Server Data Layer
- Keep `dataFetchInfra.ts` as the shared infra base.
- Continue moving duplicated snapshot/scan fetch logic into shared fetchers.
- Keep provider fallback behavior deterministic and documented.

### E. Security Boundary
- Strict CSP for script/connect/frame sources.
- TradingView embed allowed only through explicit frame policy.
- Profile badges must be validated or server-derived.
- `localStorage` state must not be treated as trusted input.

### F. Repo Boundary
- `frontend` remains the only active implementation target.
- Sibling legacy apps move toward archive/read-only status.
- New work must not be duplicated across sibling trees.

## 6. Refactor Phases

### Phase 0. Guardrails
Purpose:
- Freeze the execution order and avoid accidental UI-only refactors.

Tasks:
- Lock this design as the execution baseline.
- Keep `check/build` green after each phase.
- Preserve existing user changes in current dirty files.

DoD:
- Design doc exists.
- Future implementation steps reference this doc.

### Phase 1. State Authority Repair
Purpose:
- Remove the biggest hidden performance and correctness issue first.

Tasks:
- Remove live price mirroring from `gameState`.
- Make all live-price consumers subscribe to `priceStore` directly.
- Audit `hydrateDomainStores()` so hydration does not implicitly widen ownership.

DoD:
- `gameState` no longer owns live price truth.
- No behavior regression in Header, Chart, Terminal, QuickTrade.

### Phase 2. Domain Integrity Repair
Purpose:
- Close correctness and tamper gaps.

Tasks:
- Fix QuickTrade optimistic/server reconciliation with a stable client mutation key.
- Restrict profile badge updates so the client cannot authoritatively set earned state.
- Mark `dbStore.ts` and similar legacy persistence utilities for removal or archive if unused.

DoD:
- No duplicate quick trades after hydrate/open/refresh.
- Badge persistence is validated or derived server-side.
- Dead persistence utilities are either removed or explicitly deprecated.

#### Phase 2 Detailed Execution Plan

##### P2-A. Profile authority split
Problem:
- `userProfileStore.ts` still computes badge earned state locally and then syncs badge arrays back to the server.
- `PATCH /api/profile` currently accepts client-authored `badges` and `displayTier`.
- This means local tampering can cross the authority boundary.

Target files:
- `src/lib/stores/userProfileStore.ts`
- `src/lib/api/profileApi.ts`
- `src/routes/api/profile/+server.ts`
- `src/routes/api/profile/passport/+server.ts`
- New helper target:
  - `src/lib/server/profileProjection.ts` or `src/lib/server/profileAuthority.ts`

Execution steps:
1. Split profile data into two classes:
   - user-editable identity:
     - nickname
     - avatar
   - server-derived progression:
     - display tier
     - badges
     - tracked signal count
     - match stats
     - total pnl
2. Remove `badges` and `displayTier` from client-authoritative PATCH semantics.
3. Move badge derivation into a server helper that projects from authoritative stats.
4. Make `GET /api/profile` and `GET /api/profile/passport` return the same derived badge/tier truth.
5. Keep `localStorage` only as a read-through cache for UI hydration speed, never as authority.
6. Remove badge auto-sync from `userProfileStore`.
7. Keep optimistic identity edits only for nickname/avatar, with rollback on API failure.

Acceptance checks:
- Editing localStorage badges does not survive hydrate.
- Client cannot elevate tier or unlock badges through `/api/profile`.
- Profile and passport surfaces return the same badge/tier result for the same user snapshot.

##### P2-B. Tracked signal mutation integrity
Problem:
- `trackedSignalStore.ts` still uses local optimistic IDs and plain ID replacement.
- Hydrate and server responses can still produce duplicate tracked signals.
- `convertToTrade()` spans two domains but has no explicit mutation envelope.

Target files:
- `src/lib/stores/trackedSignalStore.ts`
- `src/lib/api/tradingApi.ts`
- `src/routes/api/signals/track/+server.ts`
- `src/routes/api/signals/[id]/convert/+server.ts`

Execution steps:
1. Introduce the same reconcile model used in QuickTrade:
   - semantic reconcile key
   - merge-on-server-id behavior
   - hydrate dedupe against recent optimistic local records
2. Add `clientMutationId` to track/convert request payloads and echo it from the server where practical.
3. Keep a fallback semantic-key path for already-issued records or older server responses.
4. Refactor `replaceTrackedSignalId()` to merge rather than overwrite by map-only replacement.
5. Ensure `convertToTrade()` updates tracked-signal state and quick-trade state through a single ordered mutation path.

Acceptance checks:
- Track -> refresh -> hydrate does not create duplicate signals.
- Convert -> refresh -> hydrate does not leave both tracking and converted duplicates for the same local action.
- Server ack arriving after hydration still converges to one tracked signal and one quick trade.

##### P2-C. CopyTrade transaction boundary cleanup
Problem:
- `copyTradeStore.ts` currently emits two optimistic local mutations and then tries either a combined publish route or separate fallback routes.
- This is operationally correct enough to work, but structurally weak and hard to reason about.

Target files:
- `src/lib/stores/copyTradeStore.ts`
- `src/lib/stores/trackedSignalStore.ts`
- `src/lib/stores/quickTradeStore.ts`
- `src/lib/api/tradingApi.ts`
- `src/routes/api/copy-trades/publish/+server.ts`

Execution steps:
1. Make copy-trade publish use one mutation envelope that contains:
   - client mutation id
   - draft payload
   - selected signal ids
2. Prefer the combined publish route as the canonical path.
3. Keep fallback open/track behavior only behind the same reconcile contract, not as a parallel ad hoc path.
4. Normalize source/note formatting once before optimistic create and server submit.
5. Ensure local optimistic trade + local optimistic tracked signal are both merged against server results, not replaced independently.

Acceptance checks:
- Publish success yields exactly one quick trade and one tracked signal.
- Publish fallback path is still duplicate-safe after refresh/hydrate.
- No partial client residue remains if only one side of a fallback path succeeds.

##### P2-D. Dead persistence cleanup
Problem:
- `dbStore.ts` is a legacy localStorage CRUD layer and is not aligned with current server-authoritative direction.

Target files:
- `src/lib/stores/dbStore.ts`
- any importers discovered during implementation

Execution steps:
1. Confirm import surface with repo search.
2. If unused:
   - delete it, or
   - quarantine it behind explicit legacy naming if immediate deletion is risky
3. Remove any documentation that implies it is a valid current authority layer.

Acceptance checks:
- No active domain store depends on `dbStore.ts`.
- Local persistence guidance is consistent with server-authoritative architecture.

##### Phase 2 sequencing
1. Server profile projection and PATCH restriction.
2. Client profile store slimming and badge auto-sync removal.
3. Tracked-signal reconcile and client mutation IDs.
4. CopyTrade transaction cleanup on top of the new reconcile contract.
5. Dead persistence cleanup.
6. Validation pass:
   - `npm run check`
   - `npm run build`

##### Phase 2 non-goals
- No terminal layout split yet.
- No chart component split yet.
- No visual redesign work.
- No new local persistence utilities.

### Phase 3. Terminal Shell Split
Purpose:
- Make `/terminal` safe to evolve.

Tasks:
- Split route shell into desktop/tablet/mobile layout components.
- Move CTA and readiness logic into `terminalViewModel.ts`.
- Reduce `+page.svelte` to orchestration only.

DoD:
- `src/routes/terminal/+page.svelte` is no longer a god component.
- Layout branches no longer duplicate control wiring.

### Phase 4. Intel Split
Purpose:
- Isolate fetch-heavy and tab-heavy logic.

Tasks:
- Split `IntelPanel.svelte` into chat/feed/positions tabs.
- Centralize fetch triggers and visibility rules.
- Keep polling ownership explicit and bounded.

DoD:
- `IntelPanel.svelte` becomes a container, not a giant mixed component.
- Polling and tab activation rules are testable and easy to trace.

### Phase 5. Chart Split
Purpose:
- Isolate the highest-risk rendering component.

Tasks:
- Extract chart core, overlay renderer, pattern service, and TradingView adapter.
- Reuse `src/lib/chart/*` fully instead of leaving logic in `ChartPanel.svelte`.
- Reduce full recompute work on visible-range and websocket updates.

DoD:
- `ChartPanel.svelte` becomes an orchestrator instead of an all-in-one engine.
- Pattern detection and overlay rendering can be optimized independently.

### Phase 6. Security Hardening
Purpose:
- Make current protections real, not partial.

Tasks:
- Expand CSP in `hooks.server.ts`.
- Keep external URL sanitization mandatory.
- Audit mutation routes for body size, origin, rate limit, and validation consistency.

DoD:
- CSP includes actual execution/connect/frame policy.
- No high-trust domain accepts client-authored authority without validation.

### Phase 7. Legacy and Duplication Cleanup
Purpose:
- Cut long-term maintenance drag.

Tasks:
- Stop carrying identical frontend code across sibling apps where not required.
- Document canonical ownership clearly.
- Remove or quarantine dead copies when safe.

DoD:
- New work lands once in the canonical tree.
- Review and diff noise drops materially.

## 7. Non-Negotiable Rules During Implementation
- No UI-only cleanup before state authority cleanup.
- No new `localStorage` persistence for authoritative domain data.
- No widening of `gameState`.
- No new route-level god components.
- No silent duplication into sibling app trees.
- No warning count increase.

## 8. Immediate Execution Order
1. State authority repair:
   - `priceStore` stays canonical
   - `gameState` live price mirror removed
2. QuickTrade integrity repair:
   - optimistic/server reconciliation fixed
3. Profile integrity repair:
   - badge writes validated or server-derived
4. Terminal shell split
5. Intel split
6. Chart split
7. CSP and security hardening
8. Legacy tree cleanup

## 9. Definition of Done
- `npm run check` passes with no warning increase.
- `npm run build` passes.
- Live price updates do not propagate through unrelated large stores.
- QuickTrade hydration/open/refresh path is duplication-safe.
- Profile badges are not client-authoritative.
- Terminal shell, Intel, and Chart each have clear ownership boundaries.
- Canonical frontend ownership is documented and preserved.

## 10. What Starts First
- First implementation work should begin with Phase 1 and Phase 2.
- Reason:
  - They remove hidden correctness and performance debt.
  - They reduce the risk of later UI refactors.
  - They give the terminal/chart split a stable foundation.
