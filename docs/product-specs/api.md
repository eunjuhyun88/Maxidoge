# API Surface Spec

Purpose:
- Canonical reference for all server-side API contracts and external integrations.

## Primary Role

Auth, profile, market data aggregation, onchain data, and external API proxy.
This surface does NOT have a user-facing route — it serves all other surfaces.

## API Groups

### Auth & Identity
- `/api/auth` — register, session, wallet connect
- `/api/profile` — user profile CRUD, badges
- `/api/preferences` — user settings persistence
- `/api/progression` — LP→Tier progression, phase gating

### Market Data
- `/api/market` — aggregated market overview
- `/api/coinalyze` — derivatives data (OI, funding)
- `/api/coingecko` — spot prices, market caps
- `/api/yahoo` — traditional market data
- `/api/macro` — macro indicators
- `/api/feargreed` — Fear & Greed index
- `/api/senti` — social sentiment

### Trading & Positions
- `/api/quick-trades` — terminal LONG/SHORT trades
- `/api/positions` — unified position tracking
- `/api/pnl` — P&L recording
- `/api/copy-trades` — copy-trade execution
- `/api/predictions` — Polymarket prediction markets
- `/api/gmx` — GMX perpetual trading
- `/api/polymarket` — Polymarket integration

### Onchain
- `/api/onchain` — onchain metrics
- `/api/etherscan` — Ethereum explorer data
- `/api/portfolio` — wallet portfolio tracking

### Arena & Agents
- `/api/arena` — arena game CRUD, phase transitions
- `/api/arena-war` — arena war state management
- `/api/matches` — match history, results
- `/api/agents` — agent stats, XP, configuration
- `/api/tournaments` — tournament brackets

### Social
- `/api/community` — community posts, feed
- `/api/chat` — real-time messaging
- `/api/activity` — activity stream
- `/api/notifications` — push notifications
- `/api/signals` — signal discovery
- `/api/signal-actions` — signal actions (track/dismiss/convert)

### UI State
- `/api/ui-state` — server-persisted UI preferences

## Shared Stores (server-backed)

| Store | Server truth | Client role |
| --- | --- | --- |
| `priceStore` | Binance WS + REST | Real-time mirror, no persistence |
| `walletStore` | Auth server + chain | Tier/connect state |
| `userProfileStore` | `/api/profile` | localStorage cache only |
| `notificationStore` | `/api/notifications` | Runtime display queue |

## Boundary Rules

- All API inputs validated with zod at `+server.ts` boundary
- External API responses parsed at fetch boundary — never trust raw shapes
- Sensitive keys (API keys, secrets) in `.env` only, never in client code
- Rate limiting on all external proxy endpoints

## Deep Links
- `docs/ENGINEERING.md` (boundary rules)
- `docs/SECURITY.md`
- `docs/generated/api-group-map.md`
