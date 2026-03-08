# STOCKCLAW System Intent

Purpose:
- Repo-local condensed brief for product intent and architectural invariants.
- Read this before opening larger design docs.
- Use the upstream design file for deep detail, not for first-pass routing.

Upstream sources:
- `docs/FRONTEND_REFACTOR_EXECUTION_DESIGN_2026-03-06.md`
- `docs/design-docs/arena-domain-model.md`
- `docs/design-docs/learning-loop.md`
- `../STOCKCLAW_UNIFIED_DESIGN.md`

## Product Thesis

STOCKCLAW is a crypto intelligence product with four connected surfaces:
- `Terminal`: market intel, scan results, AI reasoning, fast action entry
- `Arena`: structured decision game loop
- `Signals`: discover, follow, and act on signals
- `Passport`: identity, performance, learning, and progression

The product is not just a dashboard. It is a system that turns user and agent decisions into reusable learning signals while still feeling like a coherent product experience.

## Non-Negotiable Invariants

1. Same data, different interpretation.
   - Human and AI should reason over the same market context whenever possible.
   - The value comes from interpretation quality, not hidden information asymmetry.

2. Durable actions should produce legible records.
   - Product actions should be understandable as user behavior, system behavior, and future learning data.
   - Arena/War outcomes should remain compatible with GameRecord, ORPO, and RAG-style memory flows.

3. `frontend` is the canonical implementation target.
   - Do not land new behavior by copying changes into sibling clone folders.
   - New work happens once in the canonical tree.

4. Server-authoritative domains stay server-authoritative.
   - Profile, badges, quick trades, tracked signals, and durable history cannot rely on client-local truth.
   - Local storage is cache, offline support, or optimistic staging only.

5. `priceStore` is the canonical live-price owner on the client.
   - Route or feature stores may consume live prices.
   - They should not redefine market truth.

6. Route state is transient.
   - Route state owns view mode, local selections, temporary UI state, and flow control.
   - It should not become a hidden persistence or replication layer.

7. Archive is history, not authority.
   - Old audits and archived plans explain how the code got here.
   - They do not override newer execution design docs.

## Surface Intent

### Terminal
- Primary entry point for fast situational awareness.
- Must keep scan/intel/action loops clear and decomposable.
- Avoid god-components and mixed ownership between layout, orchestration, and data contracts.

### Arena
- Primary place where human-vs-agent judgment becomes explicit.
- UI choices should preserve reasoning clarity, replayability, and structured outcomes.
- Product decisions here should not break downstream learning artifacts.

### Signals
- Turns analysis into trackable, actionable signal objects.
- Requires clean contracts between community activity, signal state, and trading actions.

### Passport
- Server-derived identity and progression surface.
- Badges, stats, and tiering should be derived or validated on the server, not accepted as client truth.

## Architecture Heuristics

- Prefer a small number of canonical documents over many overlapping summaries.
- Promote stable rules into `README.md`, `AGENTS.md`, or the relevant canonical doc.
- Keep execution plans dated and task-specific.
- Archive superseded plans instead of leaving them mixed with active ones.
- Make future agent runs able to answer "where do I start?" within one or two file opens.

## When To Open The Larger Docs

- Open `docs/design-docs/arena-domain-model.md` when you need the local Arena/Arena War semantic model.
- Open `docs/design-docs/learning-loop.md` when you need ORPO, RAG, Passport contribution, or boundary-learning semantics.
- Open `docs/FRONTEND_REFACTOR_EXECUTION_DESIGN_2026-03-06.md` when you need the current structural baseline for refactor work.
- Open `../STOCKCLAW_UNIFIED_DESIGN.md` only when the local docs are insufficient for edge-case product semantics.
- Open surface-specific docs from `docs/README.md` only after this intent brief matches the task.
