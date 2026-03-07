# Community Product Spec

Purpose:
- Short product spec for Community, social feed, signal sharing.

## Primary User Job

Let users share trading insights, signals, and copy-trade ideas with each other.

## Current Route Shape

- `/signals` — signal discovery, tracking, auto-expire (24h TTL)
- `/live` — live social feed and activity stream
- Community posting + signal attachment flows exist inside `communityStore`

## Core Flows

1. Browse community posts and trending signals.
2. Attach signal context to a post (pair, direction, reasoning).
3. Track a signal → auto-expire after 24h if not converted.
4. Convert tracked signal into a trade action (→ terminal surface).
5. Publish copy-trade from terminal back to community.

## Context Contracts

### Routes
- `/signals`
- `/live`

### Stores
- `communityStore` — posts + signal attachments (localStorage)
- `trackedSignalStore` — 24h tracked signals (shared with terminal)

### APIs
- `/api/community` — post CRUD, feed
- `/api/chat` — real-time messaging
- `/api/activity` — activity stream
- `/api/signal-actions` — signal track/dismiss/convert

## Product Constraints

- Signal trust: user must see who created it, when, and current P&L impact.
- Community posts are public. No sensitive data in post bodies.
- Copy-trade flow must respect the same position limits as direct trading.
- Feed should not become noise — ranking/filtering required.

## Deep Links
- `docs/DESIGN.md`
- `docs/ENGINEERING.md`
- `docs/FRONTEND.md` (store authority table)
