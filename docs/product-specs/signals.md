# Signals Product Spec

Purpose:
- Short product spec for community signals and action conversion.

## Primary User Job

Help the user discover, follow, and act on structured signal objects.

## Current Route Shape

- `/signals` is currently a hybrid route with `feed`, `trending`, `following`, `ai`, and `signals` tabs.
- Community-post views are server-backed, while the `signals` tab still synthesizes cards from client stores and agent metadata.
- The oracle leaderboard currently lives on `/signals?view=ai`, not on `/agents`.
- The legacy `/oracle` route is now only a redirect shim into `/signals?view=ai`.
- Copy-trade handoff currently jumps back into `/terminal` through query params.
- Use `docs/page-specs/signals-page.md` for the actual route contract; keep this file focused on surface intent.

## Core Flows

1. Browse or filter signals.
2. Track or react to a signal.
3. Convert a signal into a trade/action path.
4. Understand community and personal relevance over time.

## Product Constraints

- Durable tracking and trade effects should have clear server authority even though the current route still mixes server-backed and client-derived signal views.
- The user must be able to distinguish discovery, tracking, and execution.
- Community reactions should not redefine durable state authority.

## Supporting Docs

- `docs/community-chart-signal-copytrade-flow-2026-03-06.md`
- `docs/API_CONTRACT.md`
- `docs/INTERACTION_CALL_MAP.md`
