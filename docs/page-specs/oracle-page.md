# Oracle Redirect Page

Route scope:
- `/oracle`

Purpose:
- Define the legacy `/oracle` entry as a redirect shim into the canonical AI leaderboard view on `/signals?view=ai`.

## Primary User Job

- Reach the AI leaderboard even when arriving through an old `/oracle` link or header shortcut.

## Core Flow

1. Route mounts and immediately calls `goto('/signals?view=ai', { replaceState: true, noScroll: true, keepFocus: true, invalidateAll: false })`.
2. While navigation resolves, the route shows a minimal redirect message plus a fallback anchor.
3. The canonical leaderboard experience then loads under the `ai` tab of `/signals`.

## Guardrails

- Do not document `/oracle` as a standalone leaderboard surface; it owns no independent ranking logic.
- Redirect should replace history state so the user does not get stuck stepping back into the shim.
- If client navigation fails or is delayed, the fallback link must still land on `/signals?view=ai`.
- Leaderboard behavior, filters, and data authority belong to `/signals`, not this route.

## Key UI Blocks

- redirect-only shell
- temporary redirect message
- fallback anchor to `/signals?view=ai`

## State Authority

- route-local redirect only: `goto(...)`
- canonical leaderboard state: `/signals?view=ai`
- no standalone `/oracle` store, API fetch, or durable route state

## Supporting APIs And Data

- `goto` from `$app/navigation`
- `/signals?view=ai`
- `docs/page-specs/signals-page.md`

## Failure States

- docs still describe `/oracle` as the canonical leaderboard implementation
- redirect loops or leaves stale history entries behind
- fallback link points somewhere other than `/signals?view=ai`
- route accumulates feature logic that should live on `/signals`

## Read These First

- `docs/product-specs/signals.md`
- `docs/page-specs/signals-page.md`
- `docs/generated/route-map.md`

## Applied Source Inputs

- `src/routes/oracle/+page.svelte`
- `docs/generated/route-map.md`
