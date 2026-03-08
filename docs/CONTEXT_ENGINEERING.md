# CONTEXT_ENGINEERING

Purpose:
- Canonical context-loading strategy for the frontend repo.
- Separates stable retrieval policy from the runtime `ctx:*` protocol.
- Read this before opening many docs, replaying watch logs, or depending on parent-folder context.

## Why This Exists

- Context is limited; loading too much too early makes the agent miss the real constraint.
- Repo-local, versioned context is more reliable than chat memory, Slack threads, or parent-folder docs.
- `AGENTS.md` should stay a map, not turn back into an encyclopedia.
- `docs/AGENT_CONTEXT_COMPACTION_PROTOCOL.md` explains the runtime artifacts; this file explains when to load which layer.

## Context Layers

1. Canonical authority
   - `README.md`
   - `AGENTS.md`
   - `ARCHITECTURE.md`
   - `docs/README.md`
   - `docs/SYSTEM_INTENT.md`
   - `docs/{DESIGN,FRONTEND,PLANS,PRODUCT_SENSE,QUALITY_SCORE,RELIABILITY,SECURITY}.md`
   - These define stable rules, routing, and invariants.

2. Generated navigation
   - `docs/generated/route-map.md`
   - `docs/generated/store-authority-map.md`
   - `docs/generated/api-group-map.md`
   - `docs/generated/db-schema.md`
   - `docs/generated/game-record-schema.md`
   - Use these before broad code scanning.

3. Surface and domain semantics
   - `docs/product-specs/*.md`
   - `docs/page-specs/*.md`
   - `docs/design-docs/*.md`
   - Open only the surface/domain/page files relevant to the task.

4. Active execution memory
   - `docs/exec-plans/active/*.md`
   - Use when the task is ongoing, multi-step, or structurally constrained by an active plan.

5. Local semantic working memory
   - `.agent-context/briefs/*`
   - `.agent-context/handoffs/*`
   - `.agent-context/checkpoints/*`
   - These are resume artifacts for the current branch or work ID. They are not canonical authority.

6. Raw evidence
   - `docs/AGENT_WATCH_LOG.md`
   - `.agent-context/snapshots/*`
   - Use only when you need chronology, validation history, or ambiguity resolution.

## Retrieval Order

1. Start with the smallest stable map.
   - `README.md` -> `AGENTS.md` -> `docs/README.md` -> `ARCHITECTURE.md`

2. Load one context layer at a time.
   - Pick the smallest set that answers "what surface is this?" and "where is the authority?"

3. Prefer generated maps before codebase-wide scans.
   - Route/store/API inventories are cheaper and cleaner than opening large implementation files first.

4. Prefer brief or handoff before raw snapshots.
   - `brief` is the fast resume surface.
   - `handoff` is the fuller transfer surface.
   - `snapshot` is machine state only.

5. Open watch-log entries only by keyword/date.
   - Do not read the full log unless the task is specifically historical.

6. If knowledge is repeatedly needed, promote it.
   - Move it into a canonical doc, generated artifact, or validation script.
   - Do not leave repeat knowledge trapped in chat, logs, or parent-folder docs.

## Token and Noise Rules

- Do not bulk-read `docs/`.
- Do not start from `docs/archive/`.
- Do not treat a dated plan as durable canon when a canonical entry doc exists.
- Do not make ordinary tasks depend on parent-folder design docs.
- Prefer 2 to 4 targeted docs before reading code.
- Prefer `rg`/generated maps over wide file-by-file opening.

## Compaction and Memory Rules

- `checkpoint` is the primary semantic working-memory artifact.
- `brief` is the default resume artifact.
- `handoff` is the richer transfer artifact.
- `snapshot` captures git/runtime state, not intent.
- `watch log` is evidence, not authority.
- If a repeated review comment keeps coming back, encode it into docs, scripts, or checks.

## Anti-Patterns

- one giant instruction file
- canonical routing docs that keep growing without budget limits
- watch log or snapshot acting as the main memory system
- copied summaries drifting across multiple files
- sibling clone folders treated like normal implementation targets
- external docs required for first-pass understanding of an ordinary task

## Mechanical Enforcement

- `npm run docs:check`
  - ensures the context-document skeleton exists
  - verifies key entry sections are present
  - enforces small-map line budgets on the main routing docs
- `npm run docs:refresh`
  - refreshes generated navigation artifacts
- `npm run ctx:check -- --strict`
  - validates brief/handoff quality
- `docs/QUALITY_SCORE.md`
  - tracks where context drift still exists

## Applied Inputs (Reference-Only)

- Anthropic: `Effective Context Engineering for AI Agents`
- Anthropic: `Effective Harnesses for Long-Running Agents`
- Anthropic: `Infrastructure and the illusion of understanding`
- OpenAI: `Harnessing engineering: using Codex in an agent-first world`

Rule:
- These references may shape repo-local design, but they do not replace repo-local authority.
