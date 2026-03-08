# Arena Product Spec

Purpose:
- Short product spec for Arena and Arena War related work.

## Primary User Job

Help the user compare their interpretation against agent interpretation in a structured loop.

## Current Route Shape

- `/arena` currently includes `Lobby` and `SquadConfig` before the phase loop begins.
- The same match can be viewed through arena, chart, mission, and card modes.
- Result flow currently includes reward modal, replay state, match history, and tournament bracket support.
- Use `docs/page-specs/arena-page.md` for the actual route shell; keep this file focused on Arena's surface semantics.

## Phase Model

1. `DRAFT`
2. `ANALYSIS`
3. `HYPOTHESIS`
4. `BATTLE`
5. `RESULT`

## Core Flows

1. Choose context and squad/draft.
2. Review analysis and hypothesis.
3. Commit a directional decision.
4. Observe battle/result.
5. Produce a durable outcome that can inform learning systems.

## Product Constraints

- Arena should preserve "same data, different interpretation".
- The user must understand the current phase and what changed.
- Result screens should feel like judgment resolution, not generic dashboard output.
- Durable outcomes should remain compatible with GameRecord, ORPO, and memory systems.
- Human-vs-AI disagreement should remain inspectable instead of disappearing into presentation-only summaries.
- Battle adjustments should still map cleanly into durable records.
- The shipped route is broader than a pure hypothesis compare form, so lobby/draft/replay/tournament concerns must stay coherent with the same phase model.

## Local Authority

Read these before using any external design document:
- `docs/design-docs/arena-domain-model.md`
- `docs/design-docs/learning-loop.md`
- `docs/generated/game-record-schema.md`

## Supporting Docs

- `docs/design-docs/arena-domain-model.md`
- `docs/design-docs/learning-loop.md`
- `docs/generated/game-record-schema.md`
- `docs/ARENA_SYSTEM_SPEC_V3_0.md`
- `docs/ORPO_DATA_SCHEMA_PIPELINE_v1_2026-02-26.md`
