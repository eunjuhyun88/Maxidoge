# STOCKCLAW Frontend Architecture Map

Purpose:
- Top-level map for humans and agents.
- Read this before large structural work.
- Use this file to decide which deeper docs to open next.

## Read Order

1. `README.md`
2. `AGENTS.md`
3. `docs/README.md`
4. `docs/SYSTEM_INTENT.md`
5. `ARCHITECTURE.md`
6. Relevant docs from `docs/DESIGN.md`, `docs/FRONTEND.md`, `docs/PLANS.md`

## System Map

`Product intent -> route surfaces -> client state -> API contracts -> server modules -> DB/migrations`

### Route surfaces
- `Terminal`: situational awareness, scan, intel, action entry
- `Arena`: structured human-vs-agent decision loop
- `Signals`: discover, track, react, convert into action
- `Passport`: identity, progression, learning, history

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
- Frontend route/state ownership: `docs/FRONTEND.md`
- Product rules and user-value constraints: `docs/PRODUCT_SENSE.md`
- Current plans and execution flow: `docs/PLANS.md`
- Quality grades and drift: `docs/QUALITY_SCORE.md`
- Reliability boundaries: `docs/RELIABILITY.md`
- Security boundaries: `docs/SECURITY.md`

## When To Go Deeper

- Need system intent first: open `docs/SYSTEM_INTENT.md`
- Need route/store ownership: open `docs/FRONTEND.md`
- Need current structural refactor baseline: open `docs/FRONTEND_REFACTOR_EXECUTION_DESIGN_2026-03-06.md`
- Need Arena/War product semantics: open `docs/product-specs/arena.md`, `docs/design-docs/arena-domain-model.md`, then `docs/design-docs/learning-loop.md`
- Need Terminal scan/intel behavior: open `docs/product-specs/terminal.md`
- Need plan status: open `docs/PLANS.md` and `docs/exec-plans/index.md`
