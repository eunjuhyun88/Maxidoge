# CLAUDE.md — AI Assistant Guide for MAXI⚡DOGE

> **Read `docs/README.md` before any work.** That document is the single source of truth for multi-agent collaboration rules, canonical decisions, and cross-doc update requirements.

## Project Overview

MAXI⚡DOGE is an AI-agent-based trading simulation web app. Users interact with AI agents that analyze crypto markets, simulate battles (Arena), track signals, and manage a progression system with LP (League Points) and tiers.

**Core experiences:**

| Section | Purpose |
|---------|---------|
| **Terminal** (War Room / Intel) | Real-time market data, agent signal scanning, quick trades |
| **Arena** | 5-phase match loop: DRAFT → ANALYSIS → HYPOTHESIS → BATTLE → RESULT |
| **Signals** | Anomaly detection, signal tracking, copy-trade flow |
| **Passport** | User profile, wallet, stats, badges, tier progression |

## Tech Stack

- **Framework:** SvelteKit 2 + Svelte 5 (runes: `$props()`, `$effect()`, `$state()`)
- **Language:** TypeScript (strict mode)
- **Build:** Vite 7
- **Database:** PostgreSQL via `pg` (connection pool in `src/lib/server/db.ts`)
- **Auth/Backend:** Supabase (migrations in `supabase/migrations/`)
- **Charts:** `lightweight-charts` + Binance WebSocket
- **Wallet:** `@coinbase/wallet-sdk`, `@walletconnect/ethereum-provider`
- **Prediction Markets:** Polymarket API proxy
- **Market Data:** Binance (public, no key), Coinalyze (requires API key)
- **Node:** 20+ (recommended 22 LTS)
- **npm:** 10+ (`engine-strict=true` in `.npmrc`)

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Development server
npm run build        # Production build
npm run preview      # Preview production build
npm run check        # Svelte + TypeScript type checking
npm run check:watch  # Type checking in watch mode
```

**Validation before committing:** Always run `npm run check` and ensure it passes.

## Project Structure

```
src/
├── app.css                          # Global styles
├── app.d.ts                         # SvelteKit type declarations
├── routes/
│   ├── +layout.svelte               # Root layout (Header, BottomBar, modals)
│   ├── +page.svelte                 # Home / landing page
│   ├── arena/+page.svelte           # Arena (match loop)
│   ├── terminal/+page.svelte        # Terminal (War Room + Intel)
│   ├── signals/+page.svelte         # Signal tracking
│   ├── passport/+page.svelte        # Profile / wallet / stats
│   ├── holdings/+page.svelte        # Holdings view
│   ├── oracle/+page.svelte          # Oracle view
│   ├── settings/+page.svelte        # Settings page
│   ├── live/+page.ts                # Live session entry
│   └── api/                         # Server API routes (see below)
│
├── components/
│   ├── arena/                       # ChartPanel, BattleStage, Lobby, SquadConfig, etc.
│   ├── terminal/                    # WarRoom, IntelPanel, BottomPanel, QuickTradePanel, etc.
│   ├── modals/                      # WalletModal, CopyTradeModal, SettingsModal, etc.
│   ├── shared/                      # ContextBanner, EmptyState, ToastStack, TokenDropdown, etc.
│   ├── layout/                      # Header, BottomBar
│   └── live/                        # LivePanel
│
├── lib/
│   ├── api/                         # Client-side API wrappers
│   │   ├── binance.ts               # Binance public market data (klines, ticker, 24hr)
│   │   ├── coinalyze.ts             # Coinalyze proxy client
│   │   ├── polymarket.ts            # Polymarket proxy client
│   │   ├── auth.ts                  # Auth API client
│   │   ├── matchesApi.ts            # Matches CRUD
│   │   ├── tradingApi.ts            # Quick trades
│   │   ├── profileApi.ts            # Profile API
│   │   ├── preferencesApi.ts        # Preferences API
│   │   ├── predictionsApi.ts        # Predictions API
│   │   ├── communityApi.ts          # Community posts
│   │   ├── notificationsApi.ts      # Notifications
│   │   └── agentStatsApi.ts         # Agent stats
│   │
│   ├── stores/                      # Svelte stores (client state)
│   │   ├── gameState.ts             # Core game state (phase, LP, scores, pair, timeframe)
│   │   ├── storageKeys.ts           # localStorage key constants
│   │   ├── hydration.ts             # Hydrates all domain stores from API
│   │   ├── walletStore.ts           # Wallet connection state
│   │   ├── userProfileStore.ts      # User profile
│   │   ├── quickTradeStore.ts       # Quick trades
│   │   ├── trackedSignalStore.ts    # Tracked signals
│   │   ├── matchHistoryStore.ts     # Match history
│   │   ├── communityStore.ts        # Community posts
│   │   ├── notificationStore.ts     # Notifications
│   │   ├── battleFeedStore.ts       # Battle feed events
│   │   ├── copyTradeStore.ts        # Copy trade state
│   │   ├── predictStore.ts          # Prediction positions
│   │   ├── pnlStore.ts             # PnL ledger
│   │   ├── agentData.ts            # Agent runtime data
│   │   ├── dbStore.ts              # DB-backed store helpers
│   │   └── progressionRules.ts     # Tier/progression logic
│   │
│   ├── engine/                      # Game engine logic
│   │   ├── types.ts                 # Core type definitions (AgentId, MatchState, FBScore, etc.)
│   │   ├── constants.ts             # Game constants (timers, LP rewards, tier table, badges)
│   │   ├── phases.ts                # 5-phase match engine
│   │   ├── scoring.ts               # LP calculation, consensus logic
│   │   ├── agents.ts                # Agent engine logic
│   │   ├── gameLoop.ts              # Game loop orchestration
│   │   ├── replay.ts                # Match replay
│   │   ├── specs.ts                 # Agent spec definitions
│   │   ├── chartPatterns.ts         # Chart pattern detection
│   │   └── warroomScan.ts           # War Room scan logic
│   │
│   ├── data/                        # Static/fixture data
│   │   ├── agents.ts                # 7 agent definitions (AgentDef)
│   │   ├── tokens.ts                # Token list
│   │   ├── holdings.ts              # Holdings fixtures
│   │   └── warroom.ts               # War Room fixture data
│   │
│   ├── server/                      # Server-only code ($lib/server/)
│   │   ├── db.ts                    # PostgreSQL pool (pg) + query/transaction helpers
│   │   ├── session.ts               # Session cookie parsing/building
│   │   ├── authGuard.ts             # Auth middleware (cookie → user)
│   │   ├── authRepository.ts        # User/session DB queries
│   │   ├── walletAuthRepository.ts  # Wallet auth DB queries
│   │   └── apiValidation.ts         # Shared validation (UUID, pair, direction, number parsing)
│   │
│   ├── utils/
│   │   └── timeframe.ts             # Canonical timeframe type + normalization
│   │
│   ├── wallet/
│   │   ├── providers.ts             # Wallet provider setup
│   │   └── simulatedWallet.ts       # Simulated wallet for testing
│   │
│   ├── audio/
│   │   └── sfx.ts                   # Sound effects
│   │
│   └── signals/
│       └── communitySignals.ts      # Community signal logic
│
db/
├── migrations/
│   ├── 0001_init_postgres.sql       # Initial schema (users, matches, trades, etc.)
│   ├── 0002_unify_legacy_plus_events.sql
│   └── 0003_auth_nonce_and_session_hardening.sql
│
supabase/
├── migrations/
│   ├── 001_init.sql
│   ├── 002_unify_legacy_plus_events.sql
│   ├── 003_auth_nonce_and_session_hardening.sql
│   └── 004_agent_engine_v3.sql
│
docs/                                # Design docs (see "Documentation" section)
static/                              # Static assets (doge images, character art, blockparty assets)
```

## Environment Variables

```bash
# Required
DATABASE_URL=postgresql://...        # PostgreSQL connection string
COINALYZE_API_KEY=your_key           # Coinalyze API key (without it, /api/coinalyze returns 500)

# Optional (PostgreSQL pool tuning)
PGPOOL_MAX=24                        # Max pool connections (default: 24)
PGPOOL_IDLE_TIMEOUT_MS=30000         # Idle timeout (default: 30s)
PGPOOL_CONN_TIMEOUT_MS=5000          # Connection timeout (default: 5s)
PGPOOL_MAX_USES=7500                 # Max uses per connection (default: 7500)
```

Create a `.env` file at project root. Never commit `.env` files.

## Architecture Patterns

### State Management

- **Svelte writable/derived stores** in `src/lib/stores/`
- Stores use **dual-write**: localStorage (for offline/instant restore) + server API (for persistence)
- `STORAGE_KEYS` in `storageKeys.ts` centralizes all localStorage keys
- `hydration.ts` orchestrates initial data load from server APIs on app start
- Game state excludes transient fields (prices, phase, running, pos) from persistence
- Store changes are **debounced** before writing to localStorage (typically 1s)

### Server Architecture

- SvelteKit API routes under `src/routes/api/`
- External API proxies (Binance, Coinalyze, Polymarket) to bypass CORS
- PostgreSQL via `pg` pool (`src/lib/server/db.ts`) — not Supabase client SDK
- Session-based auth with `maxidoge_session` cookie (token:userId format, UUID validated)
- Auth guard: `getAuthUserFromCookies()` in `src/lib/server/authGuard.ts`
- API validation utilities in `src/lib/server/apiValidation.ts`

### Agent System

- **8 agents total** (engine types): STRUCTURE, VPA, ICT, DERIV, VALUATION, FLOW, SENTI, MACRO
- Grouped by role: OFFENSE (STRUCTURE, VPA, ICT), DEFENSE (DERIV, VALUATION, FLOW), CONTEXT (SENTI, MACRO)
- **Terminal scan** uses 5 agents: STRUCTURE, FLOW, DERIV, SENTI, MACRO
- **Arena** uses full 8-agent pool
- Each agent has specs (base, a, b, c tiers) unlocked by match count
- Agent outputs include: direction, confidence, thesis, factor results, bull/bear scores

### Match System (Arena)

5-phase loop: `DRAFT → ANALYSIS → HYPOTHESIS → BATTLE → RESULT`

- **DRAFT:** User selects 3 agents with weight allocation (total = 100)
- **ANALYSIS:** Agents analyze market data (max 15s timeout)
- **HYPOTHESIS:** User submits direction, confidence, entry/TP/SL
- **BATTLE:** Price action plays out (12 decision windows of ~10s each)
- **RESULT:** Scoring (FBS = 0.5×DS + 0.3×RE + 0.2×CI), LP delta, tier update

### Timeframe Convention

- **Canonical format:** lowercase — `'1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w'`
- Defined as `CanonicalTimeframe` type in `src/lib/utils/timeframe.ts`
- Always use `normalizeTimeframe()` when reading timeframes from user input or storage
- Converter functions exist for Binance, Coinalyze, and TradingView interval formats
- Display labels use uppercase for hours/days: `1H`, `4H`, `1D`, `1W`

### Tier System

| Tier | LP Range | Key Features |
|------|----------|--------------|
| BRONZE | 0–199 | 8 agents (Base Spec), basic match |
| SILVER | 200–599 | Multi-position, daily batch, agent stats |
| GOLD | 600–1199 | Oracle, Challenge, Spec C unlock |
| DIAMOND I | 1200–1599 | LIVE spectating, season ranking |
| DIAMOND II | 1600–1999 | Creator profile |
| DIAMOND III | 2000–2199 | Coach review |
| MASTER | 2200+ | Strategy NFT, RAG memory review |

## API Routes

All API routes are in `src/routes/api/`. Key groups:

- **Auth:** `/api/auth/{register,session,logout,nonce,verify-wallet,wallet}`
- **Matches:** `/api/matches` (GET/POST)
- **Quick Trades:** `/api/quick-trades`, `/api/quick-trades/open`, `/api/quick-trades/{id}/close`, `/api/quick-trades/prices`
- **Signals:** `/api/signals`, `/api/signals/track`, `/api/signals/{id}/convert`
- **Predictions:** `/api/predictions`, `/api/predictions/vote`, `/api/predictions/positions/{open,close}`
- **PnL:** `/api/pnl`, `/api/pnl/summary`
- **Profile:** `/api/profile`, `/api/profile/passport`
- **Preferences:** `/api/preferences`
- **Community:** `/api/community/posts`, `/api/community/posts/{id}/react`
- **Notifications:** `/api/notifications`, `/api/notifications/read`, `/api/notifications/{id}`
- **Chat:** `/api/chat/messages` (with `channel=terminal` query param)
- **Agent Stats:** `/api/agents/stats`, `/api/agents/stats/{agentId}`
- **Copy Trades:** `/api/copy-trades/publish`, `/api/copy-trades/runs`
- **External Proxies:** `/api/coinalyze`, `/api/polymarket/markets`, `/api/polymarket/orderbook`
- **Activity:** `/api/activity`, `/api/activity/reaction`
- **UI State:** `/api/ui-state`

## Database

- **PostgreSQL** with custom domains (`timeframe_code`, `trading_pair`) and enums
- Migrations in both `db/migrations/` (raw SQL) and `supabase/migrations/`
- Key tables: `app_users`, `auth_sessions`, `user_wallets`, `user_profiles`, `user_profile_stats`, `user_preferences`, `arena_matches`, `arena_hypotheses`, `arena_match_agent_votes`, `quick_trades`, `tracked_signals`, `prediction_positions`, `pnl_entries`, `community_posts`, `user_notifications`, `user_agent_stats`, `user_badges`
- All tables use `timestamptz` and `gen_random_uuid()` for IDs
- `updated_at` triggers on most tables via `set_updated_at()` function

## Documentation

Canonical docs in `docs/` (read `docs/README.md` first for priority and update rules):

1. **`MASTER_DESIGN.md`** — Program direction, phase ordering, merge gates
2. **`ARCHITECTURE_DESIGN.md`** — Shared/BE/FE target architecture
3. **`API_CONTRACT.md`** — API request/response/error contracts
4. **`FE_STATE_MAP.md`** — Frontend state ownership, store rules
5. **`INTERACTION_CALL_MAP.md`** — Click → API call → state → UI transitions
6. **`TERMINAL_SCAN_E2E_SPEC.md`** — Terminal scan end-to-end flow
7. **`PERSISTENCE_DESIGN.md`** — DB, persistence, cache, migration design

When modifying API routes, state/stores, DB schema, or UX flows, update the corresponding docs per the Cross-Doc Update Matrix in `docs/README.md`.

## Coding Conventions

### General

- TypeScript strict mode (`"strict": true` in tsconfig)
- ESM modules (`"type": "module"` in package.json)
- Svelte 5 runes syntax in components (`$props()`, `$effect()`, `$state()`)
- Some legacy components still use `$:` reactive declarations
- File headers use decorated comment blocks: `// ═══ MAXI⚡DOGE — Title ═══`
- Korean (`KR`) and English used in comments, UI text, and docs

### Naming

- **Agent IDs:** SCREAMING_SNAKE (`STRUCTURE`, `VPA`, `SENTI`, etc.)
- **Directions:** `'LONG' | 'SHORT' | 'NEUTRAL'`
- **Phases:** `'DRAFT' | 'ANALYSIS' | 'HYPOTHESIS' | 'BATTLE' | 'RESULT'`
- **Tiers:** `'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND' | 'MASTER'`
- **Store files:** camelCase (`gameState.ts`, `quickTradeStore.ts`)
- **Component files:** PascalCase (`ChartPanel.svelte`, `WarRoom.svelte`)
- **API route files:** `+server.ts` (SvelteKit convention)
- **Trading pairs:** `'BTC/USDT'` format (slash-separated, uppercase)

### Server-side Code

- Server-only modules under `$lib/server/` (SvelteKit enforces this boundary)
- Use `query()` or `withTransaction()` from `db.ts` for all SQL
- Validate all inputs with helpers from `apiValidation.ts`
- Session auth via `getAuthUserFromCookies(cookies)` — returns `AuthUserRow | null`
- Return proper HTTP status codes with JSON error bodies

### Branch Conventions (Multi-Agent Workflow)

- Contract track: `codex/contract-*` (docs/types only)
- Backend track: `codex/be-*` (API routes, server lib, engine)
- Frontend track: `codex/fe-*` (components, pages, stores)

## Known Issues

- `auth_nonces` migration (003) must be applied for wallet verify API to work
- Dual-write (localStorage + DB) can cause sync issues until full server-side migration
- localStorage reset may have key mismatches (being addressed in `storageKeys.ts`)
- Large components (`ChartPanel.svelte`, `arena/+page.svelte`) have concentrated responsibilities
- Timeframe casing (`1h` vs `1H`) was historically inconsistent — now normalized via `timeframe.ts`

## Testing

No test framework is currently configured. The `npm run check` command (svelte-check + TypeScript) is the primary validation tool. Future test targets (from roadmap):

- Timeframe mapping
- Session parsing
- Store reset/restore
- Indicator calculations

## Security Notes

- API keys must only live in `.env` — never commit
- Session cookies are `httpOnly`, `sameSite: lax`, `secure` in production
- UUID format validation on session tokens prevents injection
- Input validation on API routes via `apiValidation.ts` helpers
- SSL is auto-enabled for non-localhost database connections
