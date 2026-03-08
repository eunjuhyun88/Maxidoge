# Signals Page

Route scope:
- `/signals`

Purpose:
- Define the current hybrid route: community feed, leaderboard, and locally synthesized signal cards in one social-trading surface.

## Primary User Job

- Browse community activity or AI/signal views and convert interesting context into tracking or Terminal trade actions.

## Core Flow

1. Route reads `?view=` state, defaults to `feed`, and hydrates community posts on mount.
2. `feed`, `trending`, and `following` render community content with `SignalPostForm`, `SignalPostCard`, and `LivePanel`.
3. `ai` renders the embedded `OracleLeaderboard`.
4. `signals` builds cards from arena history, open trades, tracked signals, and agent metadata already in client stores.
5. Track actions update tracked-signal state; copy-trade actions hand off into `/terminal` via query params.

## Guardrails

- Docs must be explicit that this route mixes server-backed community posts with client-derived signal cards.
- Query-param view state must round-trip cleanly so shared links land in the expected tab.
- Community reactions and posts must not be mistaken for durable trade execution state.
- Terminal handoff must preserve pair, direction, levels, confidence, source, and reason.

## Key UI Blocks

- `ContextBanner`
- social header and tab switcher
- `SignalPostForm` and `SignalPostCard`
- `LivePanel`
- `OracleLeaderboard` on the `ai` tab
- signal filter bar and synthesized signal-card list on the `signals` tab

## State Authority

- community posts and reactions: `communityStore` plus `/api/community/posts`
- `signals` tab cards: client-derived from `matchHistoryStore`, `quickTradeStore`, `trackedSignalStore`, `livePrices`, and agent metadata
- tracked-signal projection: `trackedSignalStore`
- view selection and filters: route local plus URL query param
- copy-trade execution handoff: navigation into `/terminal` bootstrap params

## Supporting APIs And Data

- `/api/community/posts`
- `buildArenaSignals`
- `buildTradeSignals`
- `buildTrackedSignals`
- `buildAgentSignals`
- `/terminal?copyTrade=1&...`

## Failure States

- docs describe `/agents` as the oracle leaderboard even though the leaderboard is embedded here
- signal-to-terminal handoff loses source or level data
- social feed appears durable in the same way as synthesized signal cards without clear distinction
- query-param view state and rendered tab drift apart

## Read These First

- `docs/product-specs/signals.md`
- `docs/community-chart-signal-copytrade-flow-2026-03-06.md`
- `docs/API_CONTRACT.md`
- `docs/generated/store-authority-map.md`

## Applied Source Inputs

- `2026-03-01__STOCKCLAW_PRD_A01.md`
- `docs/community-chart-signal-copytrade-flow-2026-03-06.md`
