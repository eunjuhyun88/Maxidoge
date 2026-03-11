# Frontend Internal Web/Server Split Design

Date: 2026-03-07  
Status: active design  
Scope: `/Users/ej/Downloads/maxidoge-clones/frontend`

## 1. Decision

Yes, the correct order is:

1. split `frontend` internally into `web-side` and `server-side` responsibilities
2. prove that boundary inside the current app
3. only then physically extract `web` and `backend` into separate runtimes

So the next design target is not "more UI refactor".

It is:

`one frontend repo -> two logical halves -> then two physical apps`

## 2. Why This Order Is Mandatory

If we skip the internal split and jump straight to physical extraction:

1. we move duplicated ambiguity into two repos/apps
2. we keep browser/server contract drift
3. we re-implement boundaries while still discovering them
4. we increase integration risk around auth, cookies, DTO shape, and optimistic state

The current code already proves this.

Today:

1. `frontend` still contains routes, stores, API handlers, server modules, DB/provider access
2. `backend` is almost a mirrored full-stack tree, not a clean backend target
3. `src/lib/api/**` is already the best seam inside the current app

That means we must finish the logical split first.

## 3. The Internal Split We Actually Want

Inside `frontend`, every file should become part of one of these zones:

## 3.1 Web zone

Owns:

1. `src/routes/**/*.svelte`
2. `src/components/**/*.svelte`
3. `src/lib/stores/**`
4. `src/lib/api/**`
5. `src/lib/services/**`
6. `src/lib/terminal/**`, `src/lib/chart/**`, `src/lib/utils/**` when browser/runtime-facing

Allowed responsibilities:

1. page composition
2. presentation
3. local route/session state
4. optimistic UI staging
5. browser-side event handling
6. transport calls through wrappers only

Forbidden responsibilities:

1. DB access
2. secret-bearing provider access
3. durable projection truth
4. mutation authority
5. settlement logic
6. auth/session issuance

## 3.2 Server zone

Owns:

1. `src/routes/api/**/+server.ts`
2. `src/lib/server/**`
3. DB access
4. auth/session logic
5. provider fan-in and secret-bearing integrations
6. durable mutation authority

Allowed responsibilities:

1. request validation
2. business orchestration
3. persistence
4. rate limiting
5. abuse protection
6. background-job entry points while still inside the monolith

Forbidden responsibilities:

1. Svelte page UI
2. browser-only stores
3. route presentation helpers
4. client analytics or local persistence helpers

## 3.3 Shared contract zone

This is not yet a separate package, but it must behave like one.

Owns:

1. request DTOs
2. response DTOs
3. error envelope
4. enums and shared value objects
5. transport-safe type definitions

Immediate temporary location:

1. continue via `src/lib/api/**` types where necessary
2. stop importing these from `$lib/server/**`

Future physical home:

1. `packages/contracts`

## 4. The Boundary Rule That Makes Extraction Possible

Every live feature must follow this shape:

`route/component/store -> lib/api wrapper -> api handler -> lib/server service -> DB/provider`

Not these shapes:

1. `component -> fetch('/api/...')` when a wrapper already exists
2. `lib/api -> $lib/server`
3. `store -> DB-shaped authority`
4. `route/page -> long-lived business orchestration`

This rule is the real prerequisite for FE/BE extraction.

## 5. Current Boundary Problems To Solve First

## 5.1 Wrapper leakage

Confirmed issue:

1. `src/lib/api/positionsApi.ts` imports a type from `$lib/server/polymarketClob`

Meaning:

The browser-side API layer is still coupled to server implementation details.

Required fix:

1. move the shared type to a transport-safe contract location
2. keep `lib/api` free of `$lib/server` imports

## 5.2 Direct fetch leakage

Confirmed issue:

1. `src/lib/stores/warRoomStore.ts` directly calls `/api/arena/match/${matchId}/warroom`

Meaning:

The store bypasses the boundary and will be harder to rehost.

Required fix:

1. create or extend an arena API wrapper
2. route the store through that wrapper

## 5.3 Durable state leakage into local persistence

Current examples:

1. `userProfileStore`
2. `agentData`
3. `communityStore`
4. `matchHistoryStore`
5. `walletStore`

Meaning:

These stores are allowed to cache and stage, but not redefine authority.

Required fix:

1. mark local persistence as cache/fallback only
2. make reconciliation explicitly backend-owned

## 5.4 Thick route handlers and thick route pages

Current hotspots:

1. `/terminal`
2. `/arena`
3. `/passport`
4. `/signals`
5. `chat/messages`
6. `terminal/intel-policy`
7. `arena/analyze`

Meaning:

Even before physical extraction, these need thinner transport boundaries.

## 6. The Actual Step Sequence

## Step 1. Freeze the logical boundary

Goal:

Make every current file clearly belong to `web`, `server`, or `contract`.

Rules:

1. no new `$lib/server` imports in browser-facing code
2. no new direct `/api/` fetch in components/stores when a wrapper exists
3. no new server-side type leakage into `src/lib/api/**`
4. no new durable authority hidden in client stores

Done when:

1. the boundary stops getting worse

## Step 2. Normalize the transport seam

Goal:

Make `src/lib/api/**` the mandatory seam for browser to server communication.

Tasks:

1. inventory every domain wrapper
2. add missing wrappers where direct fetch still exists
3. unify request/response shape by domain
4. remove server type imports from wrapper code

Done when:

1. browser-side code talks through wrappers only

## Step 3. Thin the server entry layer

Goal:

Turn `routes/api` into transport adapters, not business centers.

Tasks:

1. move logic out of handler bodies into `src/lib/server/**`
2. isolate `RequestEvent`, cookies, and transport-specific parsing
3. standardize guards, rate limits, and validation

Done when:

1. handlers become thin
2. services become portable

## Step 4. Create a pseudo-package boundary inside frontend

Goal:

Make physical extraction mostly a file move later.

Logical target layout:

1. `web/*`
2. `server/*`
3. `contracts/*`

Transitional mapping inside current repo:

1. `src/routes`, `src/components`, `src/lib/stores`, `src/lib/api` act as `web`
2. `src/routes/api`, `src/lib/server` act as `server`
3. selected shared DTO/enums act as `contracts`

Done when:

1. you can point at any file and say which side owns it

## Step 5. Domain-by-domain internal hardening

Required order:

1. `auth/session`
2. `profile/preferences`
3. `quick-trades`
4. `signals/copy-trades/community`
5. `market data`
6. `terminal`
7. `arena/predictions/tournaments`
8. `passport learning`

Why:

1. auth and profile define the session boundary
2. trades/signals define mutation authority
3. terminal and arena are too expensive to move first
4. learning/jobs should move only after worker boundaries are clear

## Step 6. Extraction readiness review

Only after steps 1 through 5 pass do we ask:

1. can `web` become `apps/web`?
2. can `server` become `apps/api`?
3. can async job entry points become `apps/worker`?

If the answer is yes, then physical extraction becomes a packaging task, not an architecture-discovery task.

## 7. What “Done” Means Before Physical Split

Physical FE/BE split is allowed only when all of these are true:

1. browser-side code has zero `$lib/server` imports
2. direct fetch leakage outside wrappers is near-zero and tracked exceptions are explicit
3. priority domains have stable DTOs
4. priority handlers are thin transport adapters
5. client stores are clearly cache/projection/transient, not hidden authority
6. auth/session cookie contract is documented and stable
7. at least one domain has been proven portable without behavior regression

If these are not true, extraction is premature.

## 8. First Practical Slice

The first real slice should be:

1. `auth/session`
2. immediately followed by `profile/preferences`

Reason:

1. they define cookie/session ownership
2. they affect almost every route
3. they are smaller and less chaotic than Terminal or Arena
4. once stable, they make the rest of the split much safer

## 9. Recommendation

Yes, we should design the system to work exactly this way:

1. first divide `frontend` internally into web and server zones
2. make that boundary mechanically true
3. then extract those zones into separate frontend/backend apps

That is the only order that matches the current repo shape.
