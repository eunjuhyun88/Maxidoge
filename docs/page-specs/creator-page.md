# Creator Page

Route scope:
- `/creator/[userId]`

Purpose:
- Define the current public creator profile route used by the community surface.

## Primary User Job

- Inspect a creator's public performance context and recent signals before deciding whether to open a signal detail, track it, or hand it into Terminal.

## Core Flow

1. Route loads the creator profile through `/api/creator/[userId]`.
2. Header renders nickname, joined date, tier presentation, badges, and public performance stats.
3. Recent signals are rendered as feed cards, not synthetic signal objects.
4. Each recent signal can open `/signals/[postId]`, issue a tracked-signal mutation, or hand off into `/terminal`.

## Guardrails

- This route is a public community profile, not the authenticated Passport owner surface.
- Creator stats come from server projection plus community-post counts; do not rebuild them ad hoc in the browser.
- Recent signal cards must preserve the same copy-trade and track contracts as `/signals`.
- The route must tolerate missing or deleted creators with a stable empty/error state.

## Key UI Blocks

- sticky back-nav
- creator profile header
- public stat grid
- badge row
- recent signal card list

## State Authority

- creator profile: route-local loader backed by `/api/creator/[userId]`
- recent signals: same creator API response; not a client-computed feed
- likes and reactions: `communityStore`
- tracked-signal mutation: `trackedSignalStore`
- copy-trade execution handoff: navigation into `/terminal?copyTrade=1&...`

## Supporting APIs And Data

- `/api/creator/[userId]`
- `/api/community/posts/[id]`
- `/api/community/posts/[id]/react`
- `/terminal?copyTrade=1&...`

## Failure States

- creator route is treated like Passport and leaks owner-only assumptions
- recent signal cards drift from canonical community-post contract
- creator stats are recomputed in the browser and diverge from server projection
- signal drilldown or copy-trade handoff loses canonical `postId` / `userId` context

## Read These First

- `docs/product-specs/signals.md`
- `docs/page-specs/signals-page.md`
- `docs/page-specs/signals-detail-page.md`
- `docs/API_CONTRACT.md`

