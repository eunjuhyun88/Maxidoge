# Agents Page

Route scope:
- `/agents`

Purpose:
- Define the actual `/agents` route: a roster and learning-memory collection view, not the oracle leaderboard.

## Primary User Job

- Browse the agent roster and inspect one agent's tier, performance snapshot, and learning memory.

## Core Flow

1. Route renders the full agent grid from `AGENT_IDS`, character metadata, and `agentStats`.
2. Each card shows tier, type, level, win rate, total learned entries, and pattern-memory count.
3. Selecting a card opens a detail panel on the same page.
4. Detail view exposes base stats, learning level, challenge accuracy, pattern memory, regime adaptation, matchup data, and signature unlock context.

## Guardrails

- Do not document this route as the oracle leaderboard; that embedded leaderboard currently lives under `/signals?view=ai`.
- Empty or partially hydrated stats must still render from metadata and default learning fallbacks.
- Selected-agent detail is a drill-down on the same roster, not a separate navigation flow.
- Route context should emphasize collection/learning semantics, not hypothesis-gating language copied from older oracle specs.

## Key UI Blocks

- agent-card grid
- selected-agent detail panel
- tier/type badges and avatar chrome
- learning stats section
- pattern-memory, regime-adaptation, and matchup lists

## State Authority

- agent metadata and display rules: engine character definitions
- learning/performance projection: `agentStats`
- selected agent card: route-local state
- no route-level server fetch is performed here; upstream hydration happens elsewhere

## Supporting APIs And Data

- `$lib/stores/agentData`
- `$lib/engine/agentCharacter`
- `AGENT_IDS`
- `/api/agents/stats` only as an upstream hydration source, not a route-local fetch

## Failure States

- docs tell users to look here for the oracle leaderboard or leaderboard filters
- empty store state collapses the route instead of falling back to metadata/default learning
- users cannot tell that leaderboard-style AI ranking currently lives under `/signals?view=ai`

## Read These First

- `docs/PRODUCT_SENSE.md`
- `docs/page-specs/signals-page.md`
- `docs/generated/store-authority-map.md`

## Applied Source Inputs

- `2026-02-20__STOCKCLAW_EngagementSpec_v1.docx`
- `src/routes/agents/+page.svelte`
