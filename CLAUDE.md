# STOCKCLAW — Claude Code Project Guide

## Project Overview
**STOCKCLAW** — Crypto Intelligence OS with gamified trading arena.
SvelteKit 2 full-stack app: prediction arena, terminal scanner, AI agents, on-chain wallet integration.
Repo: `eunjuhyun88/Maxidoge` (GitHub)

---

## Context Management (자동화됨)

> 상세 프로토콜: `docs/AGENT_CONTEXT_COMPACTION_PROTOCOL.md`
> 자동화 스크립트: `scripts/dev/context-auto.sh`

### Zero-Command Mode (기본값)
수동으로 "현재를 저장" 안 해도 자동 수행됨:
- `safe:status` → `ctx:auto(safe-status)`
- `safe:sync` → `ctx:auto(safe-sync-start/end)`
- `git push` (pre-push hook) → `ctx:auto(pre-push)`
- `git merge/pull` (post-merge hook) → `ctx:auto(post-merge)`

### 저장 위치
```
.agent-context/
├── snapshots/<branch>/        # Raw 스냅샷
├── compact/<branch>-latest.md # 최신 압축본
├── pinned-facts.md            # 리셋 시에도 유지할 사실
└── runtime/                   # Throttle epoch markers
```

### 수동 명령어
```bash
npm run ctx:save -- --title "<task>" --work-id "<W-ID>" --agent "<agent>"
npm run ctx:compact
npm run ctx:pin -- --add "<durable fact>"
npm run ctx:restore -- --mode context   # 세션 복구
npm run ctx:restore -- --mode files     # 파일 복구
```

### 복구 (disambiguation 필수)
- **컨텍스트 복구**: `복구해줘 (context)` → `npm run ctx:restore -- --mode context`
- **파일 복구**: `복구해줘 (files)` → `npm run ctx:restore -- --mode files`
- mode 없이 실행 시 실패하도록 설계됨 (혼선 방지)

### 제어 환경변수
| 변수 | 기본값 | 설명 |
|------|--------|------|
| `CTX_AUTO_DISABLED` | `0` | `1`이면 자동 저장/컴팩션 비활성화 |
| `CTX_AUTO_MIN_INTERVAL_SEC` | `300` | branch+stage별 최소 실행 간격(초) |
| `CTX_AUTO_STRICT` | `0` | `1`이면 자동화 실패 시 호출 명령도 실패 |
| `CTX_WORK_ID` | auto | 명시적 work ID |
| `CTX_AGENT_ID` | `auto` | 에이전트 라벨 |

---

## Tech Stack
- **Framework**: SvelteKit 2 + Svelte 5 (runes: `$state`, `$derived`, `$effect`)
- **Language**: TypeScript (strict)
- **Build**: Vite 7.3.1
- **DB**: Supabase (PostgreSQL) via `pg` + `@supabase/supabase-js`
- **Wallet**: WalletConnect + Coinbase Wallet SDK (Arbitrum L2)
- **Charts**: lightweight-charts v5
- **LLMs**: Groq, Gemini, DeepSeek (server-side only)

## Commands
```bash
# Dev
node node_modules/.bin/vite dev

# Build
node node_modules/.bin/vite build

# Type check
npm run check

# Gate (check + build)
npm run gate

# PATH (gh CLI 등)
export PATH="$HOME/.local/bin:$HOME/.local/node-v22.14.0-darwin-arm64/bin:$PATH"
```

---

## Architecture

### Workspace Layout (Multi-repo, 같은 upstream)
```
maxidoge-clones/
├── frontend/                  # 프론트엔드 (주 작업 디렉토리)
│   └── branch: codex/home-backend-live-20260226
├── frontend-wallet-merge/     # git worktree (main 브랜치)
├── frontend-passport/         # passport 기능 분리
├── backend/                   # 백엔드 (터미널 등)
│   └── branch: terminal/uiux-optimization
├── integration/               # 통합 테스트
└── .claude/                   # Claude Code 설정
```
모든 repo의 remote: `git@github.com:eunjuhyun88/Maxidoge.git`

### Source Directory
```
src/
├── lib/
│   ├── api/          # Client API wrappers (Binance, CoinGecko, DefiLlama, FearGreed)
│   ├── engine/       # Core logic (factorEngine, agentPipeline, gameLoop, scoring)
│   ├── server/       # Server-only (DB, auth, LLM, market data)
│   ├── services/     # Client services (scanService, providers)
│   ├── stores/       # Svelte stores (gameState, price, wallet, PnL)
│   ├── signals/      # Trading signal definitions
│   ├── wallet/       # Wallet connection logic
│   ├── utils/        # Shared utilities
│   ├── data/         # Static data/configs (tokens, etc.)
│   ├── assets/       # Images, icons
│   └── audio/        # Sound effects
├── routes/
│   ├── api/          # SvelteKit API endpoints (23+ groups)
│   ├── arena/        # Prediction arena (5-phase battle)
│   ├── terminal/     # Terminal scanner (WarRoom)
│   ├── oracle/       # AI oracle / leaderboard
│   ├── signals/      # Community signals
│   ├── passport/     # User profile & stats
│   └── settings/     # Settings
└── components/
    ├── layout/       # Header, Footer, global layout
    ├── home/         # Landing page components
    ├── terminal/     # Terminal/WarRoom components
    └── arena/        # Arena components
```

### Key Modules
| Module | Path | Purpose |
|--------|------|---------|
| factorEngine | `lib/engine/factorEngine.ts` | 48-factor scoring engine |
| agentPipeline | `lib/engine/agentPipeline.ts` | Multi-agent prediction pipeline |
| gameLoop | `lib/engine/gameLoop.ts` | Arena game state machine |
| marketSnapshotService | `lib/server/marketSnapshotService.ts` | Aggregated market data |
| scanService | `lib/services/scanService.ts` | Terminal scan orchestration |
| llmConfig | `lib/server/llmConfig.ts` | LLM provider config |
| walletStore | `lib/stores/walletStore.ts` | Wallet state + auth |
| priceStore | `lib/stores/priceStore.ts` | Live price (WS + REST) |
| gameState | `lib/stores/gameState.ts` | Global game state |

### API Endpoints
```
/api/market/{news,events,flow,derivatives,snapshot}
/api/coingecko/global  /api/feargreed  /api/yahoo/[symbol]
/api/terminal/{scan,scan/[id],intel-agent-shadow,intel-policy,opportunity-scan}
/api/arena/{analyze,matches}
/api/chat/messages
/api/auth/*
/api/profile/passport/*
```

---

## Design Authority (정본 설계)

**Agent Architecture C02 v1.0** 이 canonical. 다른 설계 문서와 충돌 시 C02 우선.

### C02 핵심 구조
- **Layer 0 — ORPO Model**: 유일한 분석 엔진 (캔들+볼륨+90개 지표 → direction, confidence, pattern, key_levels)
- **Layer 1 — 4 CTX Agents**: DERIV, FLOW, MACRO, SENTI (각 RED/GREEN/NEUTRAL flag)
- **COMMANDER**: 충돌 시에만 LLM 호출 (~$0.008)
- **GUARDIAN**: P0 하드룰 (RSI>=95 차단, R:R<1.5 차단, 데이터소스 다운 → HALT)

### 프론트엔드 5화면
| 화면 | 경로 | 역할 |
|------|------|------|
| TERMINAL | `/terminal` | ORPO 판단 + Context 감시 + Entry Score |
| ARENA | `/arena` | 네 판단 vs ORPO — 5 Phase 대전 |
| SCANNER | `/signals` | 28 패턴 이상 감지 → Push |
| PASSPORT | `/passport` | Win Rate, LP, Tier, IDS 점수 |
| ORACLE | `/oracle` | ORPO Skill별 적중률 리더보드 |

---

## Coding Conventions
- **Svelte 5 runes only**: `$state()`, `$derived()`, `$effect()`. Legacy `$:` 금지 (Header.svelte 예외: SvelteKit stores 호환).
- **Server-side secrets**: API keys는 `src/lib/server/`에서만 접근.
- **File naming**: camelCase for modules, kebab-case for routes.
- **Imports**: `$lib/` alias 사용.
- **Types**: interface 우선. co-located `types.ts`에서 export.
- **Error handling**: API → `json({ error }, { status })` 패턴.
- **Korean comments OK**: 한/영 혼용 허용.
- **CSS**: Space theme — `#0a1a0d` (dark green-black) + `#E8967D` (salmon pink) + `#F0EDE4` (cream).
- **Font**: `'Press Start 2P', monospace` via `var(--fp)`.

---

## Git Workflow
- **Branch naming**: `codex/{feature-name}` 또는 `terminal/{feature-name}`
- **Commit style**: `feat(scope): description` / `fix(scope):` / `style(scope):`
- **PR merge**: squash merge only (branch protection: 1 approve + status checks)
- **Worktree**: `frontend` = feature branch, `frontend-wallet-merge` = main branch
- **gh CLI**: `~/.local/bin/gh`

### Branch Protection (main)
- Required: 1 approving review
- Required status checks: `check`, `build`
- Required linear history (squash only)
- Enforce admins: ON (admin bypass 시 일시 해제 후 재활성화)

---

## Work Modes (작업 모드)

### "업데이트" 모드
구조적 개선 + 레거시 제거.
1. **감사**: import 그래프, dead code, 중복 로직, 파일 크기
2. **계획**: 삭제/이동/신규 코드 + 영향 범위 제시
3. **실행**: 삭제 우선 → 구조 정리 → 코드 품질. 매 단계 `npm run check`
4. **검증**: check 0 errors + build 성공

### "만들어" 모드
새 기능 구현. 기존 패턴/컨벤션 따름. 타입 먼저 정의.

### "고쳐" 모드
최소 변경. root cause 먼저. 주변 리팩토링 금지.

---

## Environment Variables
`.env.example` 참조:
- `COINALYZE_API_KEY`, `COINMARKETCAP_API_KEY`, `ETHERSCAN_API_KEY`, `DUNE_API_KEY`
- `GEMINI_API_KEY`, `GROQ_API_KEY`, `DEEPSEEK_API_KEY`
- `PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `PUBLIC_WALLETCONNECT_PROJECT_ID`

---

## Current Status (최근 반영 사항)

### Home Page (2026-02-27 merged to main)
- ORPO 중심 GTM 구조 전면 교체 (Hero, WHY DIFFERENT, Flow, Detect, Squad, CTA)
- 모바일 UIUX 최적화: 2단 헤더, bottom sheet, feature 카드 가로 스크롤
- Branding: MAXI DOGE → STOCKCLAW

### Terminal (in progress — backend branch)
- Terminal UIUX optimization: typography ladder, VerdictCard compact, scrollbar, resize handles

### Task Backlog
- [x] B-03: factorEngine + agentPipeline
- [x] B-09: Terminal Scan endpoints
- [x] B-10: Chat API + scan-context
- [x] B-11: Market data APIs + server modules
- [ ] B-05: Data source provider abstraction
- [ ] B-01: Arena API scaffolding
- [ ] B-04: exitOptimizer implementation
