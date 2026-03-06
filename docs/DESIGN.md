# DESIGN

Purpose:
- Canonical design entry point for the frontend repo.
- Keeps large dated design docs navigable instead of competing.

## Design Authority Stack

1. `docs/SYSTEM_INTENT.md`
   - Product thesis and architectural invariants.
2. `docs/design-docs/core-beliefs.md`
   - Agent-first operating beliefs and doc-writing rules.
3. `docs/design-docs/arena-domain-model.md`
   - Local canonical Arena/Arena War semantics.
4. `docs/design-docs/learning-loop.md`
   - Local canonical ORPO/RAG/Passport learning loop.
5. `docs/FRONTEND_REFACTOR_EXECUTION_DESIGN_2026-03-06.md`
   - Current structural refactor baseline.
6. `docs/overall-architecture-design.md`
   - Older broad architecture analysis; useful for historical rationale.

## Design Principles

1. A short map beats a giant manual.
2. Product intent must be repo-local and versioned.
3. Stable rules should graduate into canonical docs or scripts.
4. Route shells, view models, and presentation should be separable.
5. Domain authority must be explicit:
   - client live-price owner
   - server durable-state owner
   - route-local transient owner
6. Historical docs may explain why; they do not overrule newer canonical docs.

## Current Design Hotspots

- Terminal orchestration and Intel decomposition
- Arena and Arena War product/implementation alignment
- Passport authority and badge/progression derivation
- QuickTrade and tracked-signal server authority
- Sibling clone drift vs canonical `frontend` implementation

## Required Promotion Path

- Stable belief or invariant -> `docs/design-docs/core-beliefs.md`
- Surface behavior or user-facing scope -> `docs/product-specs/*.md`
- Active implementation sequence -> `docs/exec-plans/active/*.md`
- Stable route/state architecture -> `docs/FRONTEND.md`
- Risk tracking -> `docs/QUALITY_SCORE.md` or `docs/exec-plans/tech-debt-tracker.md`

## Source Docs

- `docs/design-docs/index.md`
- `docs/design-docs/arena-domain-model.md`
- `docs/design-docs/learning-loop.md`
- `docs/FRONTEND.md`
- `docs/PRODUCT_SENSE.md`
- `docs/PLANS.md`
