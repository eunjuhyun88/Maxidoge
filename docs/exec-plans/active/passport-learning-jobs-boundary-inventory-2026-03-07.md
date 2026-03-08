# Passport / Learning / Jobs Boundary Inventory

Date: 2026-03-07  
Status: active design slice  
Scope: `/Users/ej/Downloads/maxidoge-clones/frontend`

## 1. Slice Goal

This is the seventh real internal split slice.

Goal:

1. make `passport` clearly separable as a composite read surface inside the current `frontend` app
2. keep page composition, local tab state, local fallback views, and user-triggered actions in the `web zone`
3. keep durable profile projection, preferences persistence, progression updates, and learning pipeline authority in the `server zone`
4. define where `passport` stops being a read page and starts acting like a control plane for long-running learning jobs

This slice comes after `positions / portfolio / execution` because passport consumes holdings and trading read models but should not own them.

## 2. Current Flow Summary

There is not one passport flow today. There are five.

## 2.1 Profile projection flow

`passport/+page.svelte -> userProfileStore.ts -> profileApi.fetchProfileApi / fetchPassportApi -> /api/profile + /api/profile/passport -> users + user_profiles + profileProjection`

Implication:

1. passport profile state is partly server-projected and partly browser-cached
2. the page is a consumer of profile projection, not its durable owner

## 2.2 Progression flow

`arena and other match writers -> /api/progression -> user_profiles + lp_transactions -> profile projection consumed by passport`

Implication:

1. LP, tier, streak, and match totals are not passport-owned
2. passport reads the result of progression writes from adjacent slices

## 2.3 Preferences and UI-state flow

`passport/+page.svelte -> preferencesApi.fetchUiStateApi / updateUiStateApi -> /api/ui-state`

Implication:

1. passport tab state is persisted server-side
2. the same UI-state boundary also stores terminal, signals, and oracle page state

## 2.4 Holdings and adjacent read-model flow

`passport/+page.svelte -> portfolioApi.fetchHoldings + quickTradeStore + trackedSignalStore + matchHistoryStore + gameState`

Implication:

1. passport is a read dashboard over several adjacent slices
2. holdings, trades, tracked signals, and arena state should stay external read models

## 2.5 Learning control and job flow

`passport/+page.svelte -> passportLearningApi.ts -> /api/profile/passport/learning/* -> passportMlPipeline.ts + passport_event_outbox + ml_* tables`

Implication:

1. passport is currently a browser control surface for running workers, building datasets, queueing train jobs, and generating reports
2. this is different from a normal page-read flow and should eventually become a separate control-plane boundary

## 3. Current Web-Zone Inventory

## 3.1 Browser-facing entry points

Primary web files:

1. [passport/+page.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/passport/+page.svelte)
2. [userProfileStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/userProfileStore.ts)
3. [profileApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/profileApi.ts)
4. [preferencesApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/preferencesApi.ts)
5. [passportLearningApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/passportLearningApi.ts)
6. [gameState.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/gameState.ts)

Adjacent read-model consumers used by passport:

1. [quickTradeStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/quickTradeStore.ts)
2. [trackedSignalStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/trackedSignalStore.ts)
3. [matchHistoryStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/matchHistoryStore.ts)
4. [portfolioApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/portfolioApi.ts)

## 3.2 Web responsibilities today

### `src/routes/passport/+page.svelte`

Owns:

1. page shell and tab switching
2. live holdings fetch with static fallback
3. profile and badge presentation
4. arena summary and match-history consumption
5. learning panel hydration
6. manual learning worker trigger
7. manual retrain trigger
8. manual report-generation trigger
9. persisted `passportActiveTab` UI state

Boundary concern:

1. this page is both a read dashboard and an operations console
2. it mixes profile projection, holdings projection, arena summary, and ML job controls in one route

### `src/lib/stores/userProfileStore.ts`

Owns:

1. localStorage cache for profile state
2. server hydration from `/api/profile` and `/api/profile/passport`
3. optimistic nickname and avatar updates
4. browser-derived secondary metrics from `matchHistoryStore`
5. wallet-address synchronization and refresh debouncing

Boundary concern:

1. this is not a thin server mirror
2. it mixes durable projection, local cache, optimistic edits, and client-derived metrics
3. that makes it a hybrid view-model store instead of a clean projection boundary

### `src/lib/api/profileApi.ts`

Owns:

1. browser wrappers for `/api/profile`
2. browser wrappers for `/api/profile/passport`
3. profile patch transport

Boundary verdict:

1. this is a narrow and mostly correct transport surface
2. but it hides the difference between raw account profile and passport projection

### `src/lib/api/preferencesApi.ts`

Owns:

1. durable preferences transport
2. durable UI-state transport

Boundary concern:

1. the file mixes `user_preferences` and `user_ui_state`
2. those are related but different domains
3. `passport` currently imports one transport file that spans settings for several surfaces

### `src/lib/api/passportLearningApi.ts`

Owns:

1. browser wrappers for learning status
2. browser wrappers for dataset, eval, train-job, and report lists
3. browser wrappers for worker run, retrain queue, and report generation

Boundary concern:

1. this is a control-plane transport surface, not just a read API
2. it exposes long-running or heavy operations directly to the page layer

### `src/lib/stores/gameState.ts`

Owns:

1. local arena runtime state
2. local persistence for arena-related view and squad config

Boundary concern:

1. passport reads from this store as an adjacent read model
2. game-state authority should remain in arena, not migrate into passport

## 4. Current Server-Zone Inventory

## 4.1 Profile and passport projection routes

Current route set:

1. [profile](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/profile/+server.ts)
2. [profile/passport](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/profile/passport/+server.ts)
3. [progression](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/progression/+server.ts)

Current responsibility:

1. account profile read and patch
2. passport projection read
3. progression mutation for LP, streak, and tier
4. projection synchronization through [profileProjection.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/profileProjection.ts)

Boundary concern:

1. progression logic is server authority, but its rules are imported from [progressionRules.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/progressionRules.ts)
2. domain rules should eventually live in a neutral shared domain layer rather than under `stores`

## 4.2 Preferences and UI-state routes

Current route set:

1. [preferences](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/preferences/+server.ts)
2. [ui-state](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/ui-state/+server.ts)

Current responsibility:

1. durable preference defaults and updates
2. durable page layout and tab state for several surfaces

Boundary verdict:

1. these routes are already separate, which is good
2. the browser transport layer still collapses them into one client module

## 4.3 Learning pipeline routes

Current route set:

1. [learning/status](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/profile/passport/learning/status/+server.ts)
2. [learning/datasets](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/profile/passport/learning/datasets/+server.ts)
3. [learning/datasets/build](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/profile/passport/learning/datasets/build/+server.ts)
4. [learning/evals](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/profile/passport/learning/evals/+server.ts)
5. [learning/train-jobs](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/profile/passport/learning/train-jobs/+server.ts)
6. [learning/reports](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/profile/passport/learning/reports/+server.ts)
7. [learning/reports/generate](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/profile/passport/learning/reports/generate/+server.ts)
8. [learning/workers/run](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/profile/passport/learning/workers/run/+server.ts)

Current responsibility:

1. status lookup
2. dataset listing
3. ORPO dataset build
4. eval listing
5. train-job listing and creation
6. report listing and draft creation
7. outbox worker execution

Supporting server modules:

1. [passportMlPipeline.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/passportMlPipeline.ts)
2. [passportOutbox.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/passportOutbox.ts)

Boundary concern:

1. one large server module now owns status, lists, job creation, report creation, and worker execution
2. this is a strong future `worker` extraction target

## 5. Authority Split

Current durable authorities are already different:

1. `users`
2. `user_profiles`
3. `user_preferences`
4. `user_ui_state`
5. `passport_event_outbox`
6. `ml_dataset_versions`
7. `ml_preference_pairs`
8. `ml_train_jobs`
9. `ml_eval_reports`
10. `ml_reports`

Important conclusion:

1. `passport` is not one backend domain
2. it is a page that reads across several authorities and triggers learning control actions
3. the redesign should keep those authorities separate instead of inventing one giant `passport service`

## 6. Boundary Verdict

What is already good:

1. profile projection is already server-backed
2. preferences and UI state already have separate routes
3. learning APIs already call a server pipeline module rather than embedding ML logic in the page
4. holdings remain an adjacent read model instead of passport-owned state

What is not good enough:

1. `passport/+page.svelte` is both dashboard and operations console
2. `userProfileStore.ts` is a hybrid cache, projection mirror, and client-derived metric store
3. `preferencesApi.ts` mixes durable preferences and page UI state
4. synchronous browser-triggered worker and dataset-build endpoints blur the line between page actions and back-office jobs
5. one monolithic `passportMlPipeline.ts` hides several future extraction seams

## 7. Specific Boundary Problems

1. [passport/+page.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/passport/+page.svelte) directly issues operational commands such as worker run, retrain queue, and report generation from the page layer.
2. [userProfileStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/userProfileStore.ts) derives some profile metrics from [matchHistoryStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/matchHistoryStore.ts) on the client, which means profile presentation is partly server-authored and partly browser-authored.
3. [preferencesApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/preferencesApi.ts) mixes `/api/preferences` and `/api/ui-state` in one wrapper even though they are different persistence surfaces.
4. [ui-state/+server.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/ui-state/+server.ts) stores terminal, passport, signals, and oracle UI state together; passport currently touches only one field of a broader shell-state contract.
5. [progression/+server.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/progression/+server.ts) uses domain rules from a `stores` path, which is a layering smell for future shared-domain extraction.
6. [datasets/build/+server.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/profile/passport/learning/datasets/build/+server.ts) performs potentially heavy ORPO dataset construction synchronously in an API request instead of a queued worker flow.
7. [workers/run/+server.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/api/profile/passport/learning/workers/run/+server.ts) exposes direct outbox-worker execution to the browser, which is acceptable for internal tooling but not a clean long-term boundary.

## 8. Required Internal Split

Before any physical FE/BE extraction, this slice should be treated as four internal boundaries:

1. `passport-read-model`
   - owns profile and passport projection reads
   - consumes holdings, trades, and arena state as adjacent read models
2. `passport-ui-persistence`
   - owns durable preferences and page UI state
   - should stay separate from profile projection
3. `passport-learning-control`
   - owns authenticated list, status, and trigger endpoints for the learning panel
   - should be viewed as a control-plane API, not a generic page API
4. `passport-learning-worker`
   - owns outbox processing, dataset build, training job execution, eval generation, and report generation
   - should be the eventual `worker` extraction target

## 9. Refactor Tasks Before Physical Extraction

1. split [preferencesApi.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/api/preferencesApi.ts) into separate browser wrappers for durable preferences and UI-state persistence
2. reduce [userProfileStore.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/userProfileStore.ts) to a clearer view-model store, and document which metrics remain browser-derived versus server-authored
3. move progression rules out of [progressionRules.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/stores/progressionRules.ts) into a neutral shared-domain location
4. separate the learning panel inside [passport/+page.svelte](/Users/ej/Downloads/maxidoge-clones/frontend/src/routes/passport/+page.svelte) from the rest of the passport read surface so it is explicit that it is a control surface
5. keep holdings, quick trades, tracked signals, and arena state as imported read models rather than folding them into passport-owned state
6. split [passportMlPipeline.ts](/Users/ej/Downloads/maxidoge-clones/frontend/src/lib/server/passportMlPipeline.ts) into clearer service seams such as `status/list`, `job enqueue`, and `worker execution`
7. convert heavy sync actions such as dataset build and outbox worker run into queue-backed operations before physical worker extraction

## 10. Extraction Readiness Criteria

This slice is ready for physical extraction only when:

1. profile projection, preferences, and UI-state are treated as separate contracts
2. `passport/+page.svelte` no longer acts as a mixed dashboard and operations console
3. browser learning controls call explicit control-plane wrappers rather than general page data APIs
4. heavy learning actions are queue-backed instead of request-bound
5. worker execution logic is isolated from page-request orchestration
6. passport remains a consumer of adjacent read models rather than becoming a new source of truth for them

## 11. Immediate Next Step

The next slice should be `arena / predictions / match orchestration`.

Reason:

1. arena is still the largest remaining hybrid route
2. progression writes, passport stats, and learning samples ultimately depend on arena and match outcomes
3. clarifying that boundary will reduce coupling across both `passport` and `profile/progression`
