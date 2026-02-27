# STOCKCLAW — Claude Code Project Guide

## Project Overview
**StockHoo / STOCKCLAW** — Crypto Intelligence OS with gamified trading arena.
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
| gameLoop | `src/lib/engine/gameLoop.ts` | Arena game state machine (client UI) |
| arenaMatchStateMachine | `src/lib/server/arenaMatchStateMachine.ts` | Server-authoritative phase transitions |
| agentPersonaService | `src/lib/server/agentPersonaService.ts` | 8 agent personas + Emergency Meeting LLM |
| ragMemoryService | `src/lib/server/ragMemoryService.ts` | RAG match memory (pgvector + 4-way search) |
| embeddingService | `src/lib/server/embeddingService.ts` | Text embedding (Gemini 256d + hash fallback) |
| tournamentService | `src/lib/server/tournamentService.ts` | Tournament CRUD + bracket + registration |
| teamService | `src/lib/server/teamService.ts` | 3v3 team CRUD + team match + resolve |
| pvpMatchingService | `src/lib/server/pvpMatchingService.ts` | PvP async queue + tier matching |
| liveConnectionManager | `src/lib/server/liveConnectionManager.ts` | SSE LIVE spectator streaming |
| arenaSignalBridge | `src/lib/server/arenaSignalBridge.ts` | Arena→Signal→Follow→CopyTrade bridge |
| arenaService | `src/lib/server/arenaService.ts` | Match CRUD + scoring + decision windows |
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
- Arena (core): `/api/arena/{match,draft,analyze,hypothesis,resolve}`
- Arena (game): `/api/arena/match/[id]/{phase,decision,emergency-meeting,memory,publish}`
- Arena (social): `/api/arena/{memories,challenge,pvp/queue}`
- Arena (LIVE): `/api/arena/live/{session,sessions,stream/[sessionId],react}`
- Arena (tournament): `/api/arena/tournament`, `/api/arena/tournament/[id]/bracket`
- Arena (team): `/api/arena/team`, `/api/arena/team/match`, `/api/arena/team/match/[id]`
- Social: `/api/social/{follow,feed,profile/[userId]}`

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
- **Repo**: `eunjuhyun88/Stockclaw`

## Work Modes (작업 모드)

### "업데이트" / "Update" 모드

유저가 **"업데이트해"**, **"[X] 업데이트"**, **"update [X]"** 라고 하면, 단순 수정이 아닌 **구조적 개선 + 레거시 제거** 작업을 의미한다.

**필수 워크플로우:**

1. **감사 (Audit)** — 대상 파일/모듈의 현재 상태를 전체 읽기
   - import 그래프 추적: 누가 이 파일을 쓰는가, 이 파일이 뭘 쓰는가
   - dead code 탐지: 미사용 export, 호출되지 않는 함수, deprecated 표기
   - 중복 로직 식별: 같은 일을 하는 코드가 여러 곳에 있는가
   - 파일 크기/복잡도: 300줄 이상이면 분리 후보

2. **계획 (Plan)** — 변경 계획을 유저에게 먼저 제시
   - 삭제할 코드 (dead code, deprecated, 중복)
   - 이동할 코드 (파일 분리, 모듈 추출)
   - 새로 작성할 코드 (대체 구현, 통합 함수)
   - 영향 범위 (이 변경이 어디에 파급되는가)

3. **실행 (Execute)** — 단계별로 진행
   - **삭제 우선**: dead code → deprecated → 중복 순서로 제거
   - **구조 정리**: 큰 파일 분해, 역할별 모듈 분리
   - **코드 품질**: 타입 강화, 에러 핸들링, 네이밍 통일
   - **각 단계마다 `npm run check` 통과 확인**

4. **검증 (Verify)** — 완료 후 필수 확인
   - `npm run check` (0 errors)
   - `npm run build` (빌드 성공)
   - 기존 기능 회귀 없음
   - 변경 전/후 비교 요약 제시

**금지 사항:**
- 단순히 주석만 달고 끝내지 않는다
- 기존 코드를 그대로 두고 새 코드만 옆에 추가하지 않는다 (레거시 제거 필수)
- 한 커밋에 너무 많은 변경을 넣지 않는다 (논리적 단위로 분리)

### "만들어" / "Build" 모드

유저가 **"만들어"**, **"구현해"**, **"build"**, **"implement"** 라고 하면, 새 기능 구현을 의미한다.

- 기존 패턴/컨벤션을 따른다
- 새 파일은 Architecture 섹션의 디렉토리 구조를 따른다
- 타입을 먼저 정의하고, 구현한다
- 검증: check + build 통과 필수

### "고쳐" / "Fix" 모드

유저가 **"고쳐"**, **"fix"**, **"버그"** 라고 하면, 최소한의 정확한 수정을 의미한다.

- 근본 원인 (root cause)을 먼저 찾는다
- 최소 변경으로 수정한다 (주변 리팩토링은 하지 않는다)
- 회귀 가능성을 확인한다

---

## Design Authority (정본 설계)

**Agent Architecture C02 v1.0** (`MAXIDOGE_Agent_Architecture_C02_v1_0_20260223_0430`)이 정본.

### C02 핵심 구조
- **Layer 0 — ORPO Model:** 유일한 분석 엔진 (캔들+볼륨+90개 지표 → direction, confidence, pattern, key_levels)
- **Layer 1 — 4 CTX Agents:** DERIV, FLOW, MACRO, SENTI (각 RED/GREEN/NEUTRAL flag)
- **COMMANDER:** 충돌 시에만 LLM 호출 (~$0.008)
- **GUARDIAN:** P0 하드룰 (RSI>=95 차단, R:R<1.5 차단, 데이터소스 다운 → HALT)

### 현재 프론트엔드 매핑 (ORPO 통합 전)
| C02 슬롯 | 현재 데이터 | ORPO 통합 후 |
|----------|-----------|-------------|
| ORPO Card | OFFENSE 3개 합의 (STRUCTURE+VPA+ICT) | ORPO model output |
| DERIV Card | DERIV agent | DERIV CTX Belief |
| FLOW Card | FLOW + VALUATION | FLOW CTX Belief |
| MACRO Card | MACRO agent | MACRO CTX Belief |
| SENTI Card | SENTI agent | SENTI CTX Belief |
| COMMANDER | 8-agent consensus | COMMANDER LLM |

C02와 충돌하는 다른 설계 문서는 무시. C02가 canonical.

---

## UIUX Optimization (Loox Reference)

**디자인 레퍼런스:** Loox "Lost in Space" (https://loox.app/lost-in-space)
- 배경: `#00120a` (다크 포레스트 그린-블랙)
- 액센트: `#E8967D` (살몬 핑크) — 기존 `#FFE600` 노란색 대체
- 텍스트: `#F0EDE4` (크림 화이트)
- 톤: 레트로-퓨처리스틱, 어둡고 깔끔

### 완료된 페이지
| 페이지 | PR | 작업 내용 |
|--------|-----|---------|
| Terminal (`/terminal`) | #43 | 노란색→살몬 31파일, 헤더 36px, 리사이즈 핸들, 타이포 |
| Community (`/signals`) | #45 | Community Hub 라이트→다크 전환, sig-header/카드/칩 |

### 미완료 페이지
- Arena (`/arena`) — C02 다크 아레나 일부 적용됨, UIUX 리뷰 필요
- Home (`/`) — ORPO GTM 구조, UIUX 리뷰 필요
- Passport (`/passport`) — 미착수
- Settings (`/settings`) — 미착수
- Holdings (`/holdings`) — 미착수
- Oracle (`/oracle`) — 미착수

---

## Task Backlog (BE Phase)
- [x] B-03: factorEngine + agentPipeline
- [x] B-09: Terminal Scan endpoints
- [x] B-10: Chat API + scan-context
- [x] B-11: Market data APIs + server modules
- [x] B-05: Data source provider abstraction (providers/, cache, registry, 14+ sources)
- [x] B-01: Arena API scaffolding + community bridge (Phase 1+2)
- [x] B-04: exitOptimizer implementation (617 lines, 3 risk profiles, ATR/Fib/Kelly)
- [x] B-01 Phase 3: Tournament API + pgvector RAG + 3v3 Team System
