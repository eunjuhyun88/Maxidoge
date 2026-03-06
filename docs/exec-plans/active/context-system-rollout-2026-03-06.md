# Context System Rollout

Date: 2026-03-06
Status: active
Scope: `/Users/ej/Downloads/maxidoge-clones/frontend`

## Goal

Turn the repo's current mixed document set into an agent-first context system that is:
- discoverable,
- bounded,
- mechanically checked,
- easier to extend without drift,
- and able to preserve semantic working memory across session resets.

## Invariants

1. `frontend` remains the canonical implementation target.
2. `AGENTS.md` stays short and routes into deeper sources of truth.
3. Canonical docs are stable entry points; dated docs remain supporting material.
4. Archive does not compete with current authority.
5. `watch log` is evidence, not primary working memory.
6. `work-id` is the primary handoff unit for semantic context.

## Steps

### Phase 1: repo-local routing and canonical entry docs

1. Add canonical entrypoint docs for design, frontend, plans, product sense, quality, reliability, and security.
2. Add structured subtrees:
   - `design-docs/`
   - `product-specs/`
   - `exec-plans/`
   - `generated/`
   - `references/`
3. Add a docs validation script and wire it into local checks.
4. Update routing docs and start-sequence rules.
5. Gradually promote stable rules from dated docs into canonical docs.

### Phase 2: semantic memory layer

1. Keep `ctx:save` as machine snapshot only.
2. Add `ctx:checkpoint` for semantic working memory.
3. Change `ctx:compact` to generate:
   - branch brief
   - work-id handoff
   - compatibility compact output
4. Change `ctx:restore` to support:
   - `brief`
   - `handoff`
   - `files`
   - `context` as compatibility alias to `brief`
5. Add local quality validation with `ctx:check -- --strict`.
6. Wire strict context quality into pre-push.

### Phase 3: adoption and hardening

1. Update README/AGENTS/protocol docs to reflect checkpoint-first workflow.
2. Keep compatibility paths while local workflows migrate.
3. Reduce dependency on watch-log tail and external paths.
4. Eventually promote stable context quality rules into canonical scorecards and checks.

## Exit Criteria

- A future agent can find the right surface docs within two to three file opens.
- The repo has a mechanical check for the context system structure.
- Product intent and major invariants are readable without leaving the repo.
- A future agent can resume active work from brief + handoff without reading watch-log tail first.
- Pre-push refuses degraded stage-only context artifacts.

## Follow-Ups

- Localize remaining Arena/War edge cases from `../STOCKCLAW_UNIFIED_DESIGN.md`.
- Move stable parts of dated working docs into canonical docs.
- Reduce sibling clone drift operationally.
- Track context handoff quality explicitly in `docs/QUALITY_SCORE.md`.
