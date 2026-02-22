# MAXI⚡DOGE — Claude Code Project Guide

## Project Overview
**StockHoo / MAXI⚡DOGE** — Crypto Intelligence OS with gamified trading arena.
SvelteKit 2 full-stack app: prediction arena, terminal scanner, AI agents, on-chain wallet integration.

## Tech Stack
- **Framework**: SvelteKit 2 + Svelte 5 (runes syntax: `$state`, `$derived`, `$effect`)
- **Language**: TypeScript (strict)
- **Build**: Vite 7.3.1
- **DB**: Supabase (PostgreSQL) via `pg` + `@supabase/supabase-js`
- **Wallet**: WalletConnect + Coinbase Wallet SDK (Arbitrum L2)
- **Charts**: lightweight-charts v5
- **LLMs**: Groq, Gemini, DeepSeek (server-side only)

## Commands
```bash
# Dev server (http://localhost:5173)
node node_modules/.bin/vite dev

# Build (use node directly — `npm run build` has sh ENOENT issue)
node node_modules/.bin/vite build

# Type check
npm run check

# Git push (gh CLI at ~/.local/bin/gh)
export PATH="$HOME/.local/bin:$HOME/.local/node-v22.14.0-darwin-arm64/bin:$PATH"
```

## Architecture

### Directory Structure
```
src/
├── lib/
│   ├── api/          # Client-side API wrappers (CoinGecko, DefiLlama, CoinCap, FearGreed)
│   ├── engine/       # Core logic (factorEngine, agentPipeline, gameLoop, scoring)
│   ├── server/       # Server-only modules (DB, auth, LLM, market data providers)
│   ├── services/     # Client services (scanService, providers)
│   ├── stores/       # Svelte stores (gameState, price, wallet, PnL, predictions)
│   ├── signals/      # Trading signal definitions
│   ├── wallet/       # Wallet connection logic
│   ├── utils/        # Shared utilities
│   ├── data/         # Static data/configs
│   ├── assets/       # Images, icons
│   └── audio/        # Sound effects
├── routes/
│   ├── api/          # SvelteKit API endpoints (23+ route groups)
│   ├── arena/        # Prediction arena pages
│   ├── terminal/     # Terminal scanner pages
│   ├── oracle/       # AI oracle pages
│   ├── holdings/     # Portfolio pages
│   ├── live/         # Live data pages
│   ├── signals/      # Signal pages
│   ├── passport/     # User profile/passport
│   └── settings/     # Settings pages
```

### Key Modules
| Module | Path | Purpose |
|--------|------|---------|
| factorEngine | `src/lib/engine/factorEngine.ts` | 48-factor scoring engine |
| agentPipeline | `src/lib/engine/agentPipeline.ts` | Multi-agent prediction pipeline |
| gameLoop | `src/lib/engine/gameLoop.ts` | Arena game state machine |
| marketSnapshotService | `src/lib/server/marketSnapshotService.ts` | Aggregated market data |
| scanService | `src/lib/services/scanService.ts` | Terminal scan orchestration |
| llmConfig | `src/lib/server/llmConfig.ts` | LLM provider config (Groq/Gemini/DeepSeek) |

### API Endpoints Pattern
All API routes follow SvelteKit conventions: `src/routes/api/[group]/+server.ts`
- Market data: `/api/market/{news,events,flow,derivatives,snapshot}`
- Proxy routes: `/api/coingecko/global`, `/api/feargreed`, `/api/yahoo/[symbol]`
- Terminal: `/api/terminal/scan`, `/api/terminal/scan/[id]`
- Chat: `/api/chat`
- Auth: `/api/auth/*`

## Environment Variables
See `.env.example` for all required keys:
- `COINALYZE_API_KEY` — Coinalyze market data
- `COINMARKETCAP_API_KEY` — CoinMarketCap
- `ETHERSCAN_API_KEY` — Etherscan on-chain data
- `DUNE_API_KEY` — Dune Analytics queries
- `GEMINI_API_KEY` / `GROQ_API_KEY` / `DEEPSEEK_API_KEY` — LLM providers
- `PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — Supabase
- `PUBLIC_WALLETCONNECT_PROJECT_ID` — WalletConnect

## Coding Conventions
- **Svelte 5 runes only**: Use `$state()`, `$derived()`, `$effect()`. No legacy `$:` reactive statements.
- **Server-side secrets**: Never expose API keys to client. Use `src/lib/server/` for key access.
- **File naming**: camelCase for modules (`factorEngine.ts`), kebab-case for routes.
- **Imports**: Use `$lib/` alias (maps to `src/lib/`).
- **Types**: Prefer interfaces over type aliases. Export from co-located `types.ts`.
- **Error handling**: API routes return `json({ error }, { status })` pattern.
- **Korean comments OK**: Codebase uses mixed Korean/English comments.

## Git Workflow
- **Branch naming**: `codex/{feature-name}` (e.g., `codex/be-market-api`)
- **Commit style**: `feat(B-XX): description` where B-XX is the task ID
- **Auto-push before edits**: Always commit+push current state before starting modifications
- **PR merge**: Use `gh pr create` + `gh pr merge` (gh at `~/.local/bin/gh`)
- **Repo**: `eunjuhyun88/Maxidoge`

## Task Backlog (BE Phase)
- [x] B-03: factorEngine + agentPipeline
- [x] B-09: Terminal Scan endpoints
- [x] B-10: Chat API + scan-context
- [x] B-11: Market data APIs + server modules
- [ ] B-05: Data source provider abstraction (in progress)
- [ ] B-01: Arena API scaffolding
- [ ] B-04: exitOptimizer implementation
