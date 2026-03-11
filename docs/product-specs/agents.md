# Agents Product Spec

Purpose:
- Short product spec for the agent roster, character identity, and learning-memory surface.

## Primary User Job

Help the user inspect who the agents are and how each agent is evolving over time.

## Current Route Shape

- `/agents` currently ships as a collection page, not an oracle leaderboard.
- The route renders an agent-card grid from metadata plus `agentStats`.
- Selecting a card opens a same-page detail panel with tier, base stats, learning level, pattern memory, regime adaptation, and matchup data.
- The oracle leaderboard currently lives in `/signals?view=ai`, not here.
- Use `docs/page-specs/agents-page.md` for the detailed route contract.

## Core Flows

1. Browse the roster and identify an agent of interest.
2. Inspect the agent's role, tier, and performance snapshot.
3. Drill into learning-memory details for deeper understanding.
4. Compare roster context without confusing it with the leaderboard flow.

## Product Constraints

- This surface should emphasize collection and learning-memory semantics, not prediction ranking theater.
- Empty or partially hydrated stat state should still degrade cleanly through metadata/default fallbacks.
- The route should stay distinct from the leaderboard flow in Signals.
- Agent identity and learning-memory views should remain readable for future agents and humans.

## Supporting Docs

- `docs/page-specs/agents-page.md`
- `docs/page-specs/signals-page.md`
- `docs/generated/store-authority-map.md`
