# FRONTEND

Purpose:
- Canonical frontend architecture map for routes, state authority, and layering.
- Read before touching route shells, stores, or shared UI contracts.

## Route Surfaces

| Surface | Route | Role | Primary concerns |
| --- | --- | --- | --- |
| Home | `/` | entry, positioning, onboarding | narrative clarity, navigation |
| Terminal | `/terminal` | situational awareness, scan, intel, action entry | responsive layouts, feed clarity, chart |
| Arena | `/arena` | structured human-vs-agent decision loop | phase clarity, chart legibility, outcome recording |
| Arena War | `/arena-war` | unified 8-phase competitive loop | phase state machine, battle visualization |
| Arena v2 | `/arena-v2` | 5-phase draft/analyze/battle flow | hypothesis, agent draft |
| Signals | `/signals` | discover, track, react, action convert | signal authority, auto-expire |
| Passport | `/passport` | profile, identity, progression | server-derived identity, learning history |
| Oracle | `/oracle` | AI prediction dashboard | prediction accuracy, agent performance |
| Settings | `/settings` | user preferences | preference persistence |

## Component Architecture

```
src/components/
├── arena/              # Arena v1 (30 comps, chart/ + views/)
│   └── chart/          # ChartPanel, ChartToolbar, ChartDrawingCanvas, etc.
├── arena-v2/           # Arena v2 (9 comps, Draft/Battle/Result screens)
├── arena-war/          # Arena War unified (15 comps, 8-phase system)
├── terminal/           # Trading terminal (20 comps)
│   ├── intel/          # IntelFeedTrending/News/Onchain/Positions
│   └── warroom/        # WarRoomHeader/Footer/SignalFeed
├── shared/             # UI atoms (HPBar, ToastStack, PartyTray, etc.)
├── modals/             # WalletModal, SettingsModal, OracleModal, etc.
└── layout/             # Header, BottomBar
```

## State Authority — Full Store Map

### Shared (cross-surface)
| Store | State | Persist | Notes |
| --- | --- | --- | --- |
| `priceStore` | Live BTC/ETH/SOL WS+REST feed | No | Market truth. Never mirror into other stores |
| `walletStore` | User tier + wallet connect + progression | Partial | Tier affects gating across all surfaces |
| `userProfileStore` | Profile cache (server-authoritative) | Yes | Client caches; server defines truth |
| `notificationStore` | 3-part: notifications + toasts + P0 rule | No | P0 hard rule = always-visible critical alerts |
| `progressionRules` | LP→Tier + Phase utility | No | Pure functions, no state. Single source for tier logic |

### Arena surface
| Store | State | Persist | Notes |
| --- | --- | --- | --- |
| `gameState` | Phase + squad config + position | Partial | Transient phase state, persistent squad config |
| `arenaWarStore` | 8-phase state machine + RAG context | No | Runtime only. Resets each game |
| `arenaV2State` | 5-phase + currentView + agents | No | Runtime only |
| `battleFeedStore` | Live battle feed (max 50 items) | No | FIFO buffer |
| `matchHistoryStore` | Match records + win rate stats | Partial | localStorage cache, server is truth |
| `activeGamesStore` | Concurrent living games (max 3) | Yes | Excluding SPRINT games |
| `agentData` | Agent stats + XP + learning system | Yes | Agent progression state |

### Terminal surface
| Store | State | Persist | Notes |
| --- | --- | --- | --- |
| `positionStore` | Unified positions (QuickTrade+Polymarket+GMX) | No | Fetched from server/chain |
| `pnlStore` | PnL entries (Arena + Polymarket) | Yes | Local tracking |
| `quickTradeStore` | Terminal LONG/SHORT trades + reconcile | Partial | Optimistic → server reconcile |
| `trackedSignalStore` | 24h tracked signals + auto-expire | Partial | localStorage fallback |
| `warRoomStore` | 3-round LLM debate + voting | No | Session-only |
| `copyTradeStore` | Signal → trade builder + publish | No | Session-only |
| `predictStore` | Polymarket markets + positions + votes | Yes | Client-side tracking |

### Community surface
| Store | State | Persist | Notes |
| --- | --- | --- | --- |
| `communityStore` | Posts + signal attachments | Yes | Social feed state |

## Store Pattern

**All 20 stores use Svelte 4 `writable()` / `derived()`.** No Svelte 5 runes in stores.
Components use Svelte 5 runes ($state, $derived, $effect, $props).

```
Stores: Svelte 4 writable() — import { writable, derived } from 'svelte/store'
Components: Svelte 5 runes — $state(), $derived(), $effect(), $props()
```

## Layering Rules

1. Route file owns entry/exit and high-level composition.
2. View-model or orchestration modules own derived UI state and decision glue.
3. Presentation components own rendering and user events only.
4. Shared utilities centralize invariants, not duplicate behavior.
5. Server contracts validated at the boundary (zod / pydantic).
6. `types → repository → service → ui(Svelte)` — UI에서 repository 직접 import 금지.

## Current Hot Files

- `src/routes/terminal/+page.svelte`
- `src/components/terminal/IntelPanel.svelte`
- `src/routes/arena/+page.svelte`
- `src/components/arena/ChartPanel.svelte` — chart drawing system 작업 중
- `src/components/arena/chart/ChartToolbar.svelte` — TradingView-style 드로잉 툴바
- `src/lib/chart/primitives/drawingManager.ts` — 드로잉 상호작용 엔진

## Source Docs

- `docs/generated/route-map.md`
- `docs/generated/store-authority-map.md`
- `docs/generated/api-group-map.md`
