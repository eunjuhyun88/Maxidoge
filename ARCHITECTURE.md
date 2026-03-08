# STOCKCLAW Frontend Architecture Map

Purpose:
- Top-level map for humans and agents.
- Read this before large structural work.
- Use this file to decide which deeper docs to open next.

## Read Order

1. `README.md`
2. `AGENTS.md`
3. `docs/README.md`
4. `docs/CONTEXT_ENGINEERING.md`
5. `docs/SYSTEM_INTENT.md`
6. `ARCHITECTURE.md`
7. Relevant docs from `docs/DESIGN.md`, `docs/FRONTEND.md`, `docs/PLANS.md`

## System Map

`Product intent -> route surfaces -> client state -> API contracts -> server modules -> DB/migrations`

### Route surfaces
- `Home`: positioning, onboarding, first action routing
- `Terminal`: situational awareness, scan, intel, action entry
- `Arena`: structured human-vs-agent decision loop
- `Signals`: discover, track, react, convert into action
- `Passport`: identity, progression, learning, history
- `Agents`: roster and learning-memory collection view

### Client authority
- Live market truth: `priceStore`
- Route/session flow state: route-local stores like `gameState`
- Durable user/domain state: server-authoritative stores backed by API

### Server authority
- Auth, profile, badges, quick trades, tracked signals, persistence, learning data
- API contracts and schema boundaries live in repo-local docs, not chat history

## Non-Negotiable Boundaries

1. `frontend/` is the canonical implementation target.
2. `docs/archive/` is not current authority.
3. Product intent must be readable from repo-local markdown.
4. Stable rules belong in canonical docs or scripts, not only watch logs.
5. The agent should be able to start with a small map and progressively disclose detail.

## Canonical Doc Entry Points

- Design and architecture: `docs/DESIGN.md`
- Context loading and resume policy: `docs/CONTEXT_ENGINEERING.md`
- Route/page behavior: `docs/page-specs/index.md`
- Frontend route/state ownership: `docs/FRONTEND.md`
- Product rules and user-value constraints: `docs/PRODUCT_SENSE.md`
- Current plans and execution flow: `docs/PLANS.md`
- Quality grades and drift: `docs/QUALITY_SCORE.md`
- Reliability boundaries: `docs/RELIABILITY.md`
- Security boundaries: `docs/SECURITY.md`

## When To Go Deeper

- Need system intent first: open `docs/SYSTEM_INTENT.md`
- Need context loading or resume order: open `docs/CONTEXT_ENGINEERING.md`, then `docs/AGENT_CONTEXT_COMPACTION_PROTOCOL.md`
- Need route/page behavior first: open `docs/page-specs/index.md`, then the relevant page spec
- Need route/store ownership: open `docs/FRONTEND.md`
- Need current structural refactor baseline: open `docs/FRONTEND_REFACTOR_EXECUTION_DESIGN_2026-03-06.md`
- Need frontend/backend separation target and cutover order: open `docs/exec-plans/active/frontend-backend-separation-plan-2026-03-07.md`
- Need Arena/War product semantics: open `docs/product-specs/arena.md`, `docs/design-docs/arena-domain-model.md`, then `docs/design-docs/learning-loop.md`
- Need Home/first-run semantics: open `docs/product-specs/home.md`, then `docs/page-specs/home-onboarding.md`
- Need Terminal scan/intel behavior: open `docs/product-specs/terminal.md`
- Need Agent roster semantics: open `docs/product-specs/agents.md`, then `docs/page-specs/agents-page.md`
- Need secondary route behavior: open `docs/page-specs/settings-page.md`, `docs/page-specs/arena-war-page.md`, `docs/page-specs/arena-v2-page.md`, or `docs/page-specs/oracle-page.md`
- Need plan status: open `docs/PLANS.md` and `docs/exec-plans/index.md`
