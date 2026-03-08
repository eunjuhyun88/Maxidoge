# Arena War Page

Route scope:
- `/arena-war`

Purpose:
- Define the separate Arena War route as a store-driven 7-phase competitive flow distinct from the main `/arena` battle shell.

## Primary User Job

- Draft teams, compare human and AI interpretation on the same market context, and reach a judged war result.

## Core Flow

1. User starts in `SETUP` and chooses the mode/setup context.
2. `DRAFT` lets the user finalize teams and bans, then `handleDraftComplete()` sets teams and starts the match.
3. The store drives the phase machine:
   - `SETUP`
   - `DRAFT`
   - `AI_ANALYZE`
   - `HUMAN_CALL`
   - `REVEAL`
   - `BATTLE`
   - `JUDGE`
   - `RESULT`
4. Shared market context, AI decision, human call, battle result, judge result, and RAG recall all accumulate in `arenaWarStore`.
5. On route destroy, `resetArenaWar()` clears the session.

## Guardrails

- This route is a separate war flow, not just another visual skin on `/arena`.
- Human-vs-AI comparison depends on "same data, different interpretation"; phase transitions must preserve that framing.
- Route exit must reset the store so stale match state does not bleed into the next visit.
- Durable result and RAG/game-record side effects belong to the store workflow, not the route shell itself.

## Key UI Blocks

- `SetupPhase`
- `DraftPhase`
- `AnalyzePhase`
- `HumanCallPhase`
- `RevealPhase`
- `BattlePhase`
- `JudgePhase`
- `ResultPhase`

## State Authority

- full war session state: `arenaWarStore`
- current phase: `arenaWarPhase`
- durable game record and RAG persistence: store-integrated save/search helpers
- route shell: phase-to-screen switching only

## Supporting APIs And Data

- `arenaWarStore`
- `setTeams`
- `startMatch`
- `resetArenaWar`
- `saveGameRecord`
- `searchRAG`
- `saveRAGEntryAPI`

## Failure States

- route is documented like `/arena` even though it uses a different phase model
- stale war state survives after leaving and re-entering the route
- draft completion fails to seed teams before match start
- result/judge persistence is described as route-local when it actually lives in store workflows

## Read These First

- `docs/product-specs/arena.md`
- `docs/design-docs/arena-domain-model.md`
- `docs/design-docs/learning-loop.md`

## Applied Source Inputs

- `src/routes/arena-war/+page.svelte`
- `src/lib/stores/arenaWarStore.ts`
