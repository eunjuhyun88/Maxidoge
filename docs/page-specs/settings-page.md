# Settings Page

Route scope:
- `/settings`

Purpose:
- Define the route-level contract for user preferences, local reset, and settings sync.

## Primary User Job

- Adjust default experience settings and understand whether those settings are saved locally or synced to account preferences.

## Core Flow

1. Route loads current `gameState` defaults into local settings UI.
2. On mount, it tries `fetchPreferencesApi()` and, if present, hydrates remote preferences into both the page and `gameState`.
3. User changes timeframe, data source, battle speed, chart theme, language, signal alerts, or SFX.
4. Changes queue a debounced `updatePreferencesApi()` call and selectively update shared state like `gameState.timeframe` and `gameState.speed`.
5. User can inspect account stats or trigger the danger-zone local reset.

## Guardrails

- Remote preference sync and local page state must not drift silently.
- `resetAllData()` clears resettable local storage keys and reloads the app; do not describe it as a server-side account wipe.
- Default timeframe and speed changes should reflect into shared state immediately, not only after a later reload.
- The route should clearly communicate `Saving to cloud`, `Synced with account settings`, or `Local mode`.

## Key UI Blocks

- settings header with sync status
- trading settings
- display settings
- notification toggles
- account stats summary
- danger zone reset action

## State Authority

- page form state: route local
- persisted preferences: `/api/preferences`
- default pair/timeframe/speed bridge: `gameState`
- resettable local data scope: `RESETTABLE_STORAGE_KEYS`

## Supporting APIs And Data

- `fetchPreferencesApi`
- `updatePreferencesApi`
- `RESETTABLE_STORAGE_KEYS`
- `CORE_TIMEFRAME_OPTIONS`
- `gameState`

## Failure States

- settings look saved but remote persistence failed
- reset action is mistaken for server account deletion
- default timeframe or speed changes do not propagate into shared state
- page claims cloud sync when only local mode is active

## Read These First

- `docs/FRONTEND.md`
- `docs/API_CONTRACT.md`
- `docs/generated/store-authority-map.md`

## Applied Source Inputs

- `src/routes/settings/+page.svelte`
- `src/lib/api/preferencesApi.ts`
- `src/lib/stores/storageKeys.ts`
