# ⛔ DEPRECATED — 이 폴더는 레거시입니다

**`frontend/` 으로 통합되었습니다. 이 폴더에서 작업하지 마세요.**
**활성 코드베이스: `/Users/ej/Downloads/maxidoge-clones/frontend/`**
**가이드: `frontend/CLAUDE.md` 참조**

---

# (아래는 레거시 — 참고용으로만 유지)

# STOCKCLAW — Claude Code Project Guide
> **Last updated: 2026-03-06** | 워크스페이스 가드 + warning budget CI 게이트 + 경고 우선순위표 추가

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
- **Battle Rendering**: PixiJS v8 (2D sprites, dynamic import)
- **LLMs**: Groq, Gemini, DeepSeek (server-side only)

## Commands
```bash
# Dev server (http://localhost:5173)
node node_modules/.bin/vite dev

# Build (use node directly — `npm run build` has sh ENOENT issue)
node node_modules/.bin/vite build

# Type check
npm run check

# Type check + warning budget gate (기본 budget=49)
npm run check:budget

# Workspace guard (deprecated workspace 차단)
npm run guard:workspace

# Full gate (guard + check:budget + build)
npm run gate

# Git push (gh CLI at ~/.local/bin/gh)
export PATH="$HOME/.local/bin:$HOME/.local/node-v22.14.0-darwin-arm64/bin:$PATH"
```

## Git/Sync 운영 규칙 (필수, 2026-03-06)
1. 브랜치별 작업은 clone 폴더를 늘리지 말고 `git worktree`로 분리한다. (예: `.wt-<branch>`)
2. 기본 동기화는 `merge --ff-only` 또는 명시적 `cherry-pick`만 사용한다. 강제 머지/강제 푸시는 금지한다.
3. push 전에는 대상 워크트리에서 반드시 `npm run gate`를 통과한다. (`guard:workspace` + `check:budget` + `build`)
4. pre-push 훅 실패 시 원인을 수정한 뒤 재시도한다. `--no-verify` 사용 금지.
5. HEAD/브랜치 포인터만 되돌려야 할 때는 `git update-ref`로 ref만 이동하고, 워킹트리 변경사항은 보존한다.
6. 동기화 직후 `git status`, `git branch -vv`, `git worktree list`로 HEAD 위치/업스트림/워크트리 상태를 확인한다.
7. 컨텍스트 관리는 `.agent-context` 스냅샷을 유지하고, 의미 있는 결정/절차 변경은 `docs/AGENT_WATCH_LOG.md`에 기록한다.


## Architecture

### Pages (전체 라우트 맵)
| Route | Purpose | Key Stores | Lines |
|-------|---------|------------|-------|
| `/` (Home) | 랜딩 — 피처 하이라이트, Arena/Terminal 진입 | walletStore, userProfileStore | 262 |
| `/arena` | 전략형 예측 아레나 — 드래프트→분석→가설→배틀→결과 (5 phases) | gameState, matchHistoryStore, pnlStore, battleFeedStore | 4,236 |
| `/arena-v2` | 아레나 v2 — 간소화 5-phase + 4가지 뷰 전환 (1=arena,2=chart,3=mission,4=card) | arenaV2State, btcPrice | 262 |
| `/arena-war` | 스피드형 AI 대전 — 8-phase 상태머신 (SETUP→RESULT), v3 배틀엔진(HP+챌린지), PixiJS 렌더링 | arenaWarStore, arenaWarPhase | 54 |
| `/agents` | 에이전트 컬렉션 (Pokedex 스타일) — 학습레벨, 패턴기억, 레짐적응, 매치업경험, 전적 | agentStats | ~380 |
| `/terminal` | 마켓 스캐너 터미널 — War Room + Chart + Intel 3패널 리사이즈 | gameState, livePrices, copyTradeStore | 3,333 |
| `/passport` | 유저 프로필 허브 — 보유, 트레이드, 시그널, 에이전트, ORPO 학습 | userProfileStore, matchHistoryStore, quickTradeStore, agentStats | 2,688 |
| `/signals` | 트레이딩 시그널 허브 — 커뮤니티/추적/오라클 3뷰 + 필터 | gameState, matchHistoryStore, openTrades, activeSignals | 983 |
| `/settings` | 유저 환경설정 — TF/SFX/언어/테마/속도/데이터소스 | gameState | 384 |
| `/holdings` | → `/passport` 리다이렉트 | — | 10 |
| `/oracle` | → `/signals?view=oracle` 리다이렉트 | — | 37 |

### Directory Structure
```
src/
├── lib/
│   ├── api/          # 클라이언트 API 래퍼 (CoinGecko, DefiLlama, CoinCap, FearGreed)
│   ├── engine/       # 핵심 로직 (28 모듈 — 팩터, 에이전트, 배틀, 스코어링, RAG, Few-Shot)
│   ├── server/       # 서버 전용 (52 모듈 — DB, 인증, LLM, 시장데이터, ORPO, RAG)
│   │   ├── migrations/ # SQL 마이그레이션 (001_arena_war_records, 002_arena_war_rag, 003_decision_memory)
│   │   ├── orpo/       # ORPO 트레이닝 파이프라인 (4 모듈)
│   │   └── providers/  # 데이터 소스 추상화 (cache, registry, types)
│   ├── services/     # 클라이언트 서비스 (scanService, providers)
│   ├── stores/       # Svelte 스토어 (23개 — 아래 상세)
│   ├── signals/      # 트레이딩 시그널 정의
│   ├── wallet/       # 지갑 연결 로직
│   ├── utils/        # 공용 유틸리티
│   ├── data/         # 정적 데이터/설정
│   ├── assets/       # 이미지, 아이콘
│   └── audio/        # 사운드 이펙트
├── components/       # 72개 Svelte 컴포넌트 (14개 디렉토리)
│   ├── arena/        # 전략 아레나 (15 + 4 views)
│   ├── arena-v2/     # 아레나 v2 (8 + 1 shared)
│   ├── arena-war/    # 아레나 워 8-phase (8) + 비주얼 배틀 (BattleCanvas[PixiJS], ChallengeOverlay, AgentSprite, BattleVisualizer, VSMeterBar, ActionFeed, BattleEffects, DraftPhase)
│   ├── terminal/     # 터미널 패널 (10 + 3 warroom)
│   ├── modals/       # 모달 (5: CopyTrade, Oracle, Passport, Settings, Wallet)
│   ├── shared/       # 공용 (11: ContextBanner, EmptyState, Toast, P0Banner, TokenDropdown, NotificationTray, PokemonFrame, TypewriterBox, HPBar, PhaseTransition, PartyTray)
│   ├── layout/       # 레이아웃 (2: Header, BottomBar)
│   ├── home/         # 홈 (1: HomeBackground)
│   ├── community/    # 커뮤니티 (1: OracleLeaderboard)
│   └── live/         # 라이브 (1: LivePanel)
├── routes/
│   ├── api/          # SvelteKit API (99 엔드포인트, 17 카테고리)
│   └── [pages]/      # 위 Pages 테이블 참조
scripts/
├── dev/              # 브랜치/컨텍스트/가드 자동화
│   ├── guard-active-workspace.sh         # deprecated workspace(frontend-passport) 차단
│   └── check-svelte-warning-budget.sh    # svelte-check warning budget 게이트
docs/
└── warning-priority-2026-03-06.md        # 49 warnings 정리 우선순위표
```

### Stores (23개 — Svelte 4 writable 패턴)
| Store | Purpose | Lines |
|-------|---------|-------|
| **gameState** | 핵심 아레나 상태 (phase, view, hypothesis, squad, position) | 262 |
| **arenaWarStore** | Arena War 7-phase 상태머신 + RAG 검색/저장 통합 | ~830 |
| **arenaV2State** | Arena v2 상태 (phase, subPhase, currentView) | 326 |
| **activeGamesStore** | 동시 진행 게임 관리 (최대 3개) | 243 |
| **walletStore** | 지갑 연결 + 유저 진행 (guest→registered→connected→verified) | 301 |
| **userProfileStore** | 유저 프로필 (tier, badges, stats) + passport 통합 | 378 |
| **priceStore** | 통합 가격 계약 (WS/REST, BTC/ETH/SOL) — Header, Chart, Terminal 공용 | 233 |
| **quickTradeStore** | 터미널 퀵 트레이드 (LONG/SHORT, PnL 추적) | 343 |
| **trackedSignalStore** | War Room 시그널 추적 (24h 자동만료, QuickTrade 전환) | 301 |
| **predictStore** | Polymarket 예측 (마켓, 포지션, 투표) | 313 |
| **notificationStore** | 알림/토스트/P0(Guardian 하드룰) 3-part 스토어 | 309 |
| **matchHistoryStore** | 아레나 매치 기록 (승률, 연승, PnL) | 186 |
| **copyTradeStore** | Copy Trade 빌더 (시그널→트레이드 변환) | 285 |
| **pnlStore** | PnL 추적 (Arena + Polymarket) | 95 |
| **positionStore** | 통합 포지션 (QuickTrade + Polymarket + GMX) | 186 |
| **battleFeedStore** | 실시간 배틀 피드 (최대 50 아이템) | 54 |
| **communityStore** | 커뮤니티 포스트 (localStorage + 서버 동기화) | 138 |
| **agentData** | 에이전트 스탯 (레벨, XP, 승/패) + AI 학습 시스템 (PatternMemory, RegimeAdaptation, MatchupExperience, learningLevel) | ~350 |
| **warRoomStore** | 3-라운드 War Room 토론 상태 | 246 |
| **progressionRules** | LP→Tier 매핑 (BRONZE→SILVER→GOLD→DIAMOND→MASTER) | 119 |
| **hydration** | 전체 스토어 API 하이드레이션 오케스트레이터 | 61 |
| **dbStore** | 제네릭 localStorage CRUD 레이어 | 169 |
| **storageKeys** | localStorage 키 중앙 레지스트리 (19 keys) | 23 |

### Engine Modules (28개 — `src/lib/engine/`)
| Module | Purpose | Lines |
|--------|---------|-------|
| **factorEngine** | 48-factor 스코어링 (8 에이전트 × 6 팩터) | 909 |
| **agentPipeline** | 8-에이전트 예측 파이프라인 오케스트레이션 | 289 |
| **c02Pipeline** | C02 4-layer + RAG-enhanced Commander (few-shot LLM, heuristic fallback) | ~520 |
| **ragEmbedding** | 결정론적 256d 임베딩 생성 ($0). Arena War 48팩터 + Terminal 8에이전트 + QuickTrade + SignalAction + DedupeHash 지원 | ~600 |
| **fewShotBuilder** | Few-shot 프롬프트 빌더 (유사 게임→예시 포맷, 멀티소스 few-shot, AGENT_RETRIEVAL_WEIGHTS, Commander LLM 메시지) | ~320 |
| **agents** | 8-에이전트 풀 정의 (STRUCTURE, VPA, ICT, DERIV, VALUATION, FLOW, SENTI, MACRO) | 232 |
| **agentCharacter** | 포켓몬 스타일 캐릭터 시스템 — 4타입 상성(TECH/FLOW/SENTI/MACRO), 티어 진화(1-3), 시그니처 무브, XP/레벨 상수, AgentCharacter 정의 | ~350 |
| **types** | 엔진 전체 타입 레지스트리 (100+ types) | 605 |
| **v2BattleEngine** | 게임 메카닉 배틀 (틱 분류, 에너지, 콤보, 크리티컬) — v3에서 래핑하여 사용 (수정 없음, canonical) | 1,483 |
| **v2BattleTypes** | v2 배틀 타입 (100+ types) | 490 |
| **v3BattleEngine** | v2 래핑 + 개별 HP, 4타입 상성 데미지, 차트 리딩 챌린지, 리드 교체, 가드 시스템 | ~450 |
| **v3BattleTypes** | v3 타입 (V3AgentState, ChartChallenge, V3BattleState, HP_CONFIG, CHALLENGE_CONFIG, SWITCH_CONFIG) | ~200 |
| **battleEngine** | 실시간 배틀 (Binance WS, TP/SL 체크) | 759 |
| **battleResolver** | 배틀 해결 (가격 히스토리 기반 TP/SL 판정) | 241 |
| **exitOptimizer** | 최적 SL/TP 계산 (ATR, Fibonacci, Kelly 사이징) | 616 |
| **scoring** | FBS 스코어 (0.5·DS + 0.3·RE + 0.2·CI) + LP 정책 | 339 |
| **arenaWarTypes** | Arena War 타입 (GameRecord, OrpoPair, RAGEntry, Decision Memory types: ChainMatureResult, QuickTradeRAGInput, SignalActionRAGInput) | ~460 |
| **mockArenaData** | 48팩터/C02/캔들 목업 생성기 | 518 |
| **gameRecordStore** | Arena War 서버 API 클라이언트 (저장/조회/RAG 검색/RAG 저장) | ~160 |
| **specs** | 32 Spec 변형 (8 에이전트 × 4 specs, 팩터 가중치) | 573 |
| **indicators** | 순수 함수 지표 라이브러리 (SMA, EMA, RSI, ATR, MACD 등 14+) | 187 |
| **patternDetector** | 차트 패턴 감지 (H&S, 폴링 웨지, 피봇 분석) | 694 |
| **opportunityScanner** | 멀티자산 기회 스캐너 (0-100 점수) | 490 |
| **trend** | 트렌드 분석 (기울기, 다이버전스, 멀티TF) | 250 |
| **teamSynergy** | 5개 팀 시너지 (3-에이전트 조합 보너스) | 256 |
| **chartPatterns** | 8개 합성 차트 패턴 (테스트/데모용) | 156 |
| **constants** | 매치 타이머, 드래프트 규칙, 검증 로직 | 223 |
| **gameLoop** | RAF 기반 게임 루프 (phase 전환, 델타 타임) | 87 |
| **phases** | 5-phase 매치 정의 (DRAFT→ANALYSIS→HYPOTHESIS→BATTLE→RESULT) | 50 |
| **replay** | 매치 리플레이 엔진 | 76 |
| **warroomScan** | ⚠️ deprecated — 서버 scanEngine.ts 사용 | 867 |

### Server Modules (54개 — `src/lib/server/`)

**데이터 프로바이더 (19):**
binance (WS+REST), coingecko, coinmarketcap, coinalyze, cryptoquant, coinmetrics (CryptoQuant 대체, 무료), geckoWhale (GeckoTerminal DEX 고래 추적, 무료), defillama, dexscreener, dune, etherscan, feargreed, fred, lunarcrush, santiment (LunarCrush 대체), yahooFinance, polymarketClob, gmxV2, rssParser

**알림 규칙 엔진 (1):**
alertRules (MVRV zone 전환 + Whale spike + Liquidation cascade + Exchange flow surge — 텔레그램 봇 @bitcoin_mvrv, @BinanceWhaleVolumeAlerts, @REKTbinance 스타일)

**인증 & 보안 (7):**
authGuard (`getAuthUserFromCookies`), authRepository, authSecurity, walletAuthRepository, originGuard, turnstile, distributedRateLimit

**시장 데이터 & 분석 (6):**
marketSnapshotService (19개 소스), multiTimeframeContext, scanEngine (15개 소스 집계, Santiment+CoinMetrics primary/fallback), marketFeedService, warRoomService (3라운드 LLM 토론), intelPolicyRuntime

**LLM & AI (4):**
llmService (Groq→Gemini→DeepSeek 폴백), llmConfig, agentPersonaService (한국어 페르소나), intelShadowAgent

**ORPO 파이프라인 (`server/orpo/`, 4):**
pairBuilder, contextContract, utilityScore, exportJsonl

**RAG Decision Memory (1):**
ragService (save/search/analyze — pgvector 256d 코사인 거리, Decision Chain + Quality Maturation + Dedup. Sources: Arena War, Terminal Scan, QuickTrade Open/Close, Signal Action. Paper 1+2 준수)

**DB & 인프라 (7):**
db (`getPool`, `query`, `withTransaction`), session, rateLimit (단순), distributedRateLimit (분산), passportOutbox (이벤트 아웃박스), passportMlPipeline, secretCrypto

**유틸리티 (8):**
apiValidation, requestGuards, ipReputation, progressionUpdater, tournamentService, arenaService, providers/cache, providers/registry

### API Endpoints (~110개 — 18 카테고리)
All routes: `src/routes/api/[group]/+server.ts`

| Category | Count | Key Routes |
|----------|-------|------------|
| **Auth & Session** | 7 | `/api/auth/{nonce,verify-wallet,wallet,login,register,session,logout}` |
| **Market Data** | 14 | `/api/market/{snapshot,flow,derivatives/[pair],events,news,trending}`, `/api/market/dex/{search,pairs,tokens,token-pairs,orders,ads,community-takeovers,token-boosts,token-profiles}` |
| **Terminal Scanner** | 8 | `/api/terminal/{scan,scan/[id],scan/[id]/signals,scan/history,compare}`, `/api/terminal/{intel-agent-shadow,intel-policy,opportunity-scan}` — scan POST에 RAG fire-and-forget 저장 통합 |
| **Signals** | 5 | `/api/signals`, `/api/signals/[id]`, `/api/signals/[id]/convert`, `/api/signals/track`, `/api/signal-actions` — signal-actions POST에 RAG fire-and-forget 저장 통합 |
| **Quick Trades** | 4 | `/api/quick-trades`, `/api/quick-trades/{open,[id]/close,prices}` — open/close에 Decision Memory RAG + Chain Maturation fire-and-forget 통합 |
| **GMX V2** | 6 | `/api/gmx/{balance,markets,positions,prepare,close,confirm}` |
| **Polymarket** | 8 | `/api/polymarket/{markets,orderbook}`, `/api/positions/polymarket/{auth,prepare,submit,[id]/close,status/[id]}` |
| **Unified Positions** | 1 | `/api/positions/unified` |
| **Arena (전략형)** | 7 | `/api/arena/{draft,analyze,hypothesis,resolve,match/[id],match/[id]/warroom}`, `/api/matches` |
| **Arena War** | 2 | `/api/arena-war` (POST: GameRecord 저장+RAG fire-and-forget, GET: 기록+통계), `/api/arena-war/rag` (POST: action=search\|save — 256d pgvector 검색/저장) |
| **Passport Learning** | 8 | `/api/profile/passport/learning/{datasets,datasets/build,evals,reports,reports/generate,train-jobs,workers/run,status}` |
| **User Profile** | 7 | `/api/profile`, `/api/profile/passport`, `/api/portfolio/holdings`, `/api/preferences`, `/api/progression`, `/api/agents/stats`, `/api/agents/stats/[agentId]` |
| **Predictions** | 4 | `/api/predictions`, `/api/predictions/{positions/open,positions/[id]/close,vote}` |
| **Community** | 3 | `/api/community/posts/[id]/react`, `/api/activity`, `/api/activity/reaction` |
| **Copy Trading** | 3 | `/api/copy-trades/{runs,runs/[id],publish}` |
| **Tournaments** | 3 | `/api/tournaments/{active,[id]/bracket,[id]/register}` |
| **Notifications** | 3 | `/api/notifications`, `/api/notifications/[id]`, `/api/notifications/read` |
| **Market Alerts** | 1 | `/api/market/alerts/onchain` (GET — MVRV zone + Whale + Liquidation + ExFlow 통합 알림, alertEngine이 5분 주기 폴링) |
| **Proxies & Infra** | 17 | `/api/coingecko/*`, `/api/feargreed`, `/api/yahoo/[symbol]`, `/api/macro/{fred,indicators}`, `/api/senti/social`, `/api/coinalyze`, `/api/etherscan/onchain`, `/api/onchain/cryptoquant`, `/api/chat/messages`, `/api/ui-state`, `/api/pnl`, `/api/pnl/summary` |

### Server API 패턴 (신규 API 작성 시 참고)
```typescript
// 인증: 모든 보호 라우트에서
const user = await getAuthUserFromCookies(cookies);
if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

// DB 쿼리: raw SQL via pg pool
const result = await query<MyRow>('SELECT * FROM table WHERE id = $1', [id]);

// 응답: 일관된 패턴
return json({ success: true, ...data });
return json({ error: 'message' }, { status: 400 });

// SQL 결과 매핑: (r: any) 타입 명시
const records = result.rows.map((r: any) => ({ ... }));
```

## Environment Variables
See `.env.example` for all required keys:
- `COINALYZE_API_KEY` — Coinalyze market data
- `COINMARKETCAP_API_KEY` — CoinMarketCap
- `ETHERSCAN_API_KEY` — Etherscan on-chain data
- `DUNE_API_KEY` — Dune Analytics queries
- `GEMINI_API_KEY` / `GROQ_API_KEY` / `DEEPSEEK_API_KEY` — LLM providers
- `PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — Supabase
- `PUBLIC_WALLETCONNECT_PROJECT_ID` — WalletConnect
- `SANTIMENT_API_KEY` — Santiment social sentiment (LunarCrush 대체, 선택적 — 없으면 LunarCrush fallback)
- _(Coin Metrics Community API는 키 불필요 — CryptoQuant 대체)_

## Coding Conventions
- **Svelte 5 runes only**: Use `$state()`, `$derived()`, `$effect()`. No legacy `$:` reactive statements.
- **Svelte 5 점진적 마이그레이션**: `.svelte` 파일을 수정할 때, 해당 파일 내 레거시 문법이 있으면 함께 전환한다:
  - `let x = 0;` → `let x = $state(0);` (반응적 상태)
  - `$: y = x * 2;` → `const y = $derived(x * 2);` (파생값)
  - `$: { ... }` / `$: if (...)` → `$effect(() => { ... });` (사이드이펙트)
  - `export let prop` → `const { prop } = $props();` (컴포넌트 props)
  - `$$restProps` → `const { ...rest } = $props();`
  - 수정 대상이 아닌 파일은 건드리지 않는다 (수정하는 파일만 전환)
- **Store 패턴 분리**:
  - **Store 파일** (`src/lib/stores/`): Svelte 4 `writable<T>()` + `derived()` 패턴 유지. exported action 함수로 상태 변경.
  - **Component 파일** (`src/components/`, `src/routes/`): Svelte 5 runes (`$state`, `$derived`, `$effect`).
  - Store 값 구독: `let ws = $derived($arenaWarStore)` 형태로.
- **Server-side secrets**: Never expose API keys to client. Use `src/lib/server/` for key access.
- **File naming**: camelCase for modules (`factorEngine.ts`), kebab-case for routes.
- **Imports**: Use `$lib/` alias (maps to `src/lib/`). Component imports는 상대경로 (`../../components/`).
- **Types**: Prefer interfaces over type aliases. Export from co-located `types.ts`.
- **Error handling**: API routes return `json({ error }, { status })` pattern.
- **Korean comments OK**: Codebase uses mixed Korean/English comments.

## Git Workflow
- **Branch naming**: `codex/{feature-name}` (e.g., `codex/be-market-api`)
- **Commit style**: `feat(B-XX): description` where B-XX is the task ID
- **Auto-push before edits**: Always commit+push current state before starting modifications
- **PR merge**: Use `gh pr create` + `gh pr merge` (gh at `~/.local/bin/gh`)
- **Repo**: `eunjuhyun88/Stockclaw`
- **Deprecated workspace guard**: `frontend-passport` 로컬 워크스페이스에서 gate/push 차단 (`ALLOW_LEGACY_WORKSPACE=1`로 임시 우회 가능)

## Active Branches (병렬 작업 현황)

⚠️ **여러 브랜치에서 동시 작업 진행 중. 충돌 주의.**

| Branch | 작업 내용 | 상태 |
|--------|----------|------|
| `codex/context-engineering` | RAG + Few-Shot + Hybrid Retrieval 구현 | 🔵 진행 중 |
| `codex/arena-game-feel` | Arena War 7-phase + v2 Battle Engine | ✅ main 머지 (PR #61) |
| `feat/chart-trade-overlay` | TradingView 차트 트레이드 오버레이 | 🟡 PR 대기 |
| `codex/home-backend-live-20260226` | Home + Backend 라이브 연동 | 🟡 PR 대기 |
| `codex/uiux-frontend` | UIUX 프론트엔드 전반 | 🟡 활성 |
| `feat/onchain-alerts-dashboard` | CI hardening (workspace guard + warning budget gate) + 문서/컨텍스트 기록 | 🔵 진행 중 (2026-03-06) |

**충돌 가능성 높은 파일:**
- `arenaWarStore.ts` — Arena War 관련 브랜치에서 동시 수정 가능
- `c02Pipeline.ts` — 에이전트/분석 관련 브랜치에서 수정 가능
- `Header.svelte` — UIUX 브랜치에서 수정 가능

**브랜치 작업 시 규칙:**
1. 작업 시작 전 `git fetch origin && git log --oneline origin/main -3`으로 main 상태 확인
2. 이 섹션의 브랜치 상태를 갱신 (main 머지 시 ✅로 변경)
3. 충돌 가능 파일 수정 시 최소 범위로 변경

## Context Engineering 규칙 (세션 간 연속성)

**새 모듈/API/컴포넌트를 생성하면 반드시 이 CLAUDE.md를 갱신한다:**
- Key Modules 테이블에 추가
- API Endpoints에 추가
- Directory Structure에 반영
- Known Pitfalls에 발견한 함정 기록
- Task Backlog 상태 업데이트
- Active Branches 상태 업데이트

**세션 종료 전 체크리스트:**
- [ ] 새로 만든 파일이 CLAUDE.md에 등록되었는가
- [ ] 발견한 함정/교훈이 Known Pitfalls에 기록되었는가
- [ ] Task Backlog가 현재 상태를 반영하는가
- [ ] Active Branches가 현재 상태를 반영하는가

이 규칙의 목적: 다음 Claude 세션이 탐색 없이 즉시 이어받을 수 있게 하기 위함.

---

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
- **완료 후: 이 CLAUDE.md의 Key Modules, API Endpoints, Directory Structure, Task Backlog 갱신**

### "고쳐" / "Fix" 모드

유저가 **"고쳐"**, **"fix"**, **"버그"** 라고 하면, 최소한의 정확한 수정을 의미한다.

- 근본 원인 (root cause)을 먼저 찾는다
- 최소 변경으로 수정한다 (주변 리팩토링은 하지 않는다)
- 회귀 가능성을 확인한다

---

## Design Authority (정본 설계)

**Agent Architecture C02 v1.0** (`MAXIDOGE_Agent_Architecture_C02_v1_0_20260223_0430`)이 정본.
**Arena War 통합 설계서**: `STOCKCLAW_UNIFIED_DESIGN.md` (프로젝트 루트)

### C02 핵심 구조
- **Layer 0 — ORPO Model:** 유일한 분석 엔진 (캔들+볼륨+90개 지표 → direction, confidence, pattern, key_levels)
- **Layer 1 — 4 CTX Agents:** DERIV, FLOW, MACRO, SENTI (각 RED/GREEN/NEUTRAL flag)
- **COMMANDER:** 충돌 시 RAG few-shot 포함 LLM 호출 (~$0.003-0.008), 실패 시 heuristic fallback ($0)
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

### Arena War (AI 대전 모드)
- **통합 설계서**: `STOCKCLAW_UNIFIED_DESIGN.md` (프로젝트 루트)
- **핵심 원칙**: "같은 데이터, 다른 해석" — AI와 인간이 동일 48팩터를 보고 다르게 판단 → 시장이 판정
- **데이터 파이프라인**: GameRecord → OrpoPair (ORPO 학습) + RAGEntry (AI 기억)
- **DB 테이블**: `arena_war_records` (마이그레이션: `frontend/src/lib/server/migrations/001_arena_war_records.sql`)
- **API**: `/api/arena-war` (POST: GameRecord 저장, GET: 기록 목록 + 통계)
- **현재 상태**: Phase 1 완성 (UI + 상태머신 + 서버 저장), Phase 2 미착수 (RAG + AI 개선)

---

## Feature Details (주요 기능별 상세)

### 1. Arena (전략형 — `/arena`, 4,236줄)
- **5-phase**: DRAFT → ANALYSIS → HYPOTHESIS → BATTLE → RESULT
- 8-에이전트 드래프트 → 48-factor 분석 → 유저 가설 → 실시간 배틀
- 캐릭터 상태머신 (9 states), 8 action types, PnL 추적
- 핵심 파일: `arena/+page.svelte`, `gameState` store, `gameLoop`/`scoring`/`battleResolver` engine

### 2. Arena v2 (간소화 — `/arena-v2`, 262줄)
- DRAFT → ANALYSIS → HYPOTHESIS → BATTLE → RESULT (간소화 5-phase)
- 4가지 뷰 전환: Arena, Chart, Mission, Card (키보드 1/2/3/4)
- 핵심 파일: `arena-v2/+page.svelte`, `arenaV2State` store, `v2BattleEngine`

### 3. Arena War (스피드형 AI 대전 — `/arena-war`, 54줄)
**핵심 원칙:** "같은 데이터, 다른 해석" — AI와 인간이 동일 데이터(48팩터+C02)를 보고 다르게 판단
- **8-Phase**: `SETUP(10s) → DRAFT → AI_ANALYZE(8s) → HUMAN_CALL(45s) → REVEAL(3s) → BATTLE(v3 엔진+PixiJS) → JUDGE(3s) → RESULT`
- 매 판 = 게임 플레이 + ORPO 학습 신호 + RAG 메모리 포인트
- 데이터 파이프라인: `GameRecord → OrpoPair → RAGEntry → arena_war_records + arena_war_rag(PostgreSQL)`
- **RAG 파이프라인**: AI_ANALYZE 시 256d 임베딩→유사게임 검색→Few-shot 주입→Commander LLM, RESULT 시 RAG 저장
- 핵심 파일: `arenaWarStore`(~830줄), `arenaWarTypes`, `mockArenaData`, `gameRecordStore`, `ragEmbedding`, `fewShotBuilder`, `v3BattleEngine`, `v3BattleTypes`
- 컴포넌트: `components/arena-war/` (10: Setup, Draft, Analyze, HumanCall, Reveal, Battle[PixiJS], Judge, Result, BattleCanvas, ChallengeOverlay)
- **v3 배틀 시스템**: v2 엔진 래핑 + 개별 HP + 4타입 상성 데미지 + 차트 리딩 챌린지 4종(direction_call, pattern_recognition, risk_decision, quick_reaction)
- **BattleCanvas**: PixiJS v8 2D 스프라이트 렌더링 (dynamic import, CSS fallback). 에이전트 아바타, HP바, 데미지넘버, VS미터, 스크린셰이크
- **ChallengeOverlay**: 배틀 중 차트 리딩 챌린지 UI (3-6초 타이머, 정답 보너스/오답 패널티)
- **AI 학습**: agentData에 AgentLearning (패턴기억, 레짐적응, 매치업경험, learningLevel=floor(RAG/10))
- **에이전트 컬렉션**: `/agents` Pokedex 스타일 페이지 (학습 진행도, 패턴 기억, 전적)
- **현재 상태**: ✅ Phase 1 완성 (UI + 상태머신 + mock + 서버 저장) | ✅ Phase 2 RAG + Few-Shot 완성 | ✅ Phase 3 Decision Memory 완성 | ✅ Phase 4 v3 Battle Engine + PixiJS + AI Learning 완성
- ⬚ DB 마이그레이션 미적용 (`001_arena_war_records.sql`, `002_arena_war_rag.sql`, `003_decision_memory.sql`)

### 4. Terminal (마켓 스캐너 — `/terminal`, 3,333줄)
- 3패널 리사이즈: War Room(200-450px) | Chart | Intel(220-500px)
- War Room: 채팅 기반 시장 분석 → 패턴 감지 → 에이전트 추론
- QuickTrade: LONG/SHORT 포지션 + PnL 추적
- Copy Trade: War Room 시그널 → 트레이드 변환
- **RAG Decision Memory**: 스캔 완료 시 8에이전트 시그널→256d 임베딩→`arena_war_rag` 테이블 저장 (source='terminal_scan', agent_signals JSONB, chain_id, semantic dedup, fire-and-forget)
- Intel Agent Shadow: 백그라운드 분석 에이전트 (`/api/terminal/intel-agent-shadow`)
- Intel Policy: 정책 기반 인텔 런타임 (`/api/terminal/intel-policy`)
- Opportunity Scan: 멀티자산 기회 스캔 (`/api/terminal/opportunity-scan`)
- 핵심 파일: `terminal/+page.svelte`, `quickTradeStore`, `copyTradeStore`, `scanEngine`(서버), `intelShadowAgent`, `intelPolicyRuntime`

### 5. Passport (유저 프로필 — `/passport`, 2,688줄)
- 탭 기반: Holdings | Trades | Signals | Agents | Learning
- Holdings: 지갑 자산 + 실시간 가격
- Learning: ORPO 데이터셋 빌드, 트레이닝 잡, 평가 리포트
- 진행 시스템: LP → Tier (BRONZE→SILVER→GOLD→DIAMOND→MASTER)
- 핵심 파일: `passport/+page.svelte`, `userProfileStore`, `progressionRules`

### 6. Signals (시그널 허브 — `/signals`, 983줄)
- 3가지 뷰: Community | Signals | Oracle
- 시그널 소스: Arena + Trade + Tracked + Agent
- 시그널 추적 → QuickTrade 전환 가능
- 핵심 파일: `signals/+page.svelte`, `trackedSignalStore`, `OracleLeaderboard`

---

## UIUX Optimization (Loox Reference)

**디자인 레퍼런스:** Loox "Lost in Space" (https://loox.app/lost-in-space)
- 배경: `#00120a` (다크 포레스트 그린-블랙)
- 액센트: `#E8967D` (살몬 핑크) — 기존 `#FFE600` 노란색 대체
- 텍스트: `#F0EDE4` (크림 화이트)
- 톤: 레트로-퓨처리스틱, 어둡고 깔끔

### Arena War CSS Variables
```css
--arena-bg-0: #081a12    /* 배경 어두운 */
--arena-bg-1: #0d2118    /* 카드/패널 */
--arena-line: #1a3d2e    /* 테두리 */
--arena-accent: #e8967d  /* 살몬 핑크 (강조) */
--arena-good: #00cc88    /* 상승/긍정 */
--arena-bad: #ff5e7a     /* 하락/부정 */
--arena-text-0: #e0f0e8  /* 밝은 텍스트 */
--arena-text-1: #8ba59e  /* 중간 텍스트 */
--arena-text-2: #5a7d6e  /* 어두운 텍스트 */
```

### 페이지별 UIUX 상태
| 페이지 | 상태 | 비고 |
|--------|------|------|
| Terminal (`/terminal`) | ✅ 완료 (PR #43) | 노란색→살몬 31파일, 헤더 36px, 리사이즈 핸들 |
| Signals (`/signals`) | ✅ 완료 (PR #45) | Community Hub 다크 전환, sig-header/카드/칩 |
| Arena War (`/arena-war`) | ✅ 완료 | 7-phase 전체, 다크 포레스트 테마 |
| Arena (`/arena`) | 🔶 부분 적용 | C02 다크 아레나 일부, UIUX 리뷰 필요 |
| Home (`/`) | 🔶 부분 적용 | ORPO GTM 구조, UIUX 리뷰 필요 |
| Passport (`/passport`) | ⬚ 미착수 | 2,688줄 — 기능 풍부하나 테마 미적용 |
| Settings (`/settings`) | ⬚ 미착수 | |
| Arena v2 (`/arena-v2`) | 🔶 Sprint 1 완료 | Pokemon UI: BattleScreen arena view + 5 shared components |

---

## Known Pitfalls (함정 — 다음 세션에 전달)

### Svelte 5 Runes 충돌
- **변수명 `state` 사용 금지**: `let state = $derived(...)` 하면 `$state()` rune이 store 구독으로 오인됨. 에러: "Cannot use 'state' as a store". **`ws` 또는 다른 이름 사용.**
- **`$components` alias 없음**: `$components/` import path는 미등록. 컴포넌트는 **상대경로** (`../../components/`) 사용.

### 빌드 관련
- **node_modules synthetic 파일 깨짐**: `@sveltejs/kit/src/types/synthetic/` 안의 `.md` 파일들이 날짜 접두어로 rename될 수 있음. `npm install` 후에도 안 되면 수동으로 접두어 제거 후 복사.
- **`npm run build` 실패 시**: `node node_modules/.bin/vite build` 직접 사용.
- **warning budget 게이트**: `npm run check:budget`는 기본 `WARNING_BUDGET=49`를 초과하면 실패. 경고 총량을 늘리는 PR 금지.
- **CI check job 규칙**: `guard:workspace` + `check:budget`을 먼저 통과해야 함.

### Workspace / Legacy 운영
- **`frontend-passport`는 deprecated 로컬 워크스페이스**: `scripts/dev/guard-active-workspace.sh`가 gate/push 전에 차단.
- **임시 우회**: 꼭 필요한 경우에만 `ALLOW_LEGACY_WORKSPACE=1` 사용 (기본 금지).

### 서버 API 패턴
- **DB 테이블 미존재 대응**: API에서 `errorContains(e, 'does not exist')` 체크 → graceful fallback + warning 반환.
- **localStorage 사용 금지**: 서버(PostgreSQL)가 있으므로 클라이언트 영속 저장은 서버 API 경유. localStorage는 캐시/임시 용도만.

### Store vs Rune 패턴
- Store 파일은 **Svelte 4 `writable()`** 유지 (다수 컴포넌트에서 import하므로)
- `.svelte` 컴포넌트에서 store 구독: `let ws = $derived($storeName)`
- 직접 `$state()`를 store 파일에 쓰지 않는다 (store는 `.ts` 파일이라 rune 사용 불가)

### API 대체 소스 (Primary/Fallback 패턴)
- **Santiment → LunarCrush fallback**: `SANTIMENT_API_KEY` 없으면 자동으로 LunarCrush 사용. Santiment 무료 티어는 30일 지연, 유료 키 필요. `galaxyScore`는 Santiment에 없어 50 기본값.
- **Coin Metrics → CryptoQuant fallback**: Community API 무료, 키 불필요. MVRV 직접 제공, NUPL은 MVRV 기반 근사 (CapRealUSD Pro 전용 → `1-(1/MVRV)`). Exchange Flow는 `FlowInExUSD/FlowOutExUSD`로 netflow 계산 (주의: `FlowTfrFromExchNtv`는 무료 티어에 없음). API 파라미터: `page_size`/`paging_from=end` 사용 (`limit_per_asset`/`sort_dir` 미지원). `minerData`는 null (무료 대안 없음, 소비측은 이미 null-safe).
- **GeckoTerminal DEX 고래 추적** (`geckoWhale.ts`): `coinmetrics.ts`가 내부적으로 호출. WBTC/USDC, WETH/USDC Uniswap V3 풀의 $50K+ 거래를 고래로 판별. 무료 API, 키 불필요. 풀 주소는 `WHALE_POOLS` 상수로 관리 (새 풀 추가 시 여기 수정). Rate limit: ~30 req/min, 5분 캐시.
- **Primary/Fallback 판별**: `scanEngine.ts`와 `marketSnapshotService.ts`에서 Santiment/CoinMetrics가 primary, 실패 시 LunarCrush/CryptoQuant fallback. API 프록시 (`/api/senti/social`, `/api/onchain/cryptoquant`)도 동일 패턴.
- **Source 라벨**: 시그널 `src` 필드에 실제 소스 표시 (SANTIMENT vs LUNARCRUSH, COINMETRICS vs CRYPTOQUANT)

### 온체인 알림 시스템 (텔레그램 봇 스타일)
- **alertRules.ts**: MVRV zone 전환, Whale spike, Liquidation cascade, Exchange flow surge 규칙 엔진. 서버 사이드에서 threshold 평가.
- **MVRV Zones**: deep_value(<0.8), undervalued(0.8-1.0), fair_value(1.0-1.5), optimism(1.5-2.5), greed(2.5-3.5), extreme_greed(>3.5). Zone **전환** 시에만 알림 발생 (중복 방지, `_prevState` in-memory).
- **alertEngine.ts**: 기존 opportunity-scan 폴링 + `/api/market/alerts/onchain` 병렬 폴링. `processOnchainAlerts()`로 dedup 후 notification/toast 발생.
- **Dedup**: `_previousOnchainAlertIds` Set으로 같은 alert id 재발생 방지 (최대 200개 유지).
- **Liquidation 데이터**: Coinalyze `fetchLiquidationHistoryServer()` 사용. API 키 필요 (`COINALYZE_API_KEY`). 데이터 없을 시 liq=0 (alert 안 뜸).
- **UI 위치**: IntelPanel > FEED > FLOW 탭의 최상단에 `oc-dashboard` 섹션. 2×2 그리드(MVRV/NUPL/Whale/ExFlow) + Liquidation bar + Alert cards. 2분마다 자동 갱신 (`_onchainTimer`). CSS 클래스: `.oc-*`. `{@const}`는 `{#if}` 블록의 직접 자식이어야 함 (Svelte 제약).

### PixiJS v8 관련
- **Text API 변경**: v7의 `dropShadow: true, dropShadowColor: 0x000000, dropShadowDistance: 2`는 v8에서 `dropShadow: { color: 0x000000, distance: 2, alpha: 0.8 }` 객체 형태로 변경됨. flat property 사용 시 TS 오류.
- **Dynamic Import 필수**: PixiJS는 window 객체가 필요하므로 SSR 환경에서 `import('pixi.js')` 동적 import 사용. `onMount()` 또는 `$effect()` 내에서만 로드.
- **CSS Fallback**: PixiJS 로딩 실패 시 CSS 기반 에이전트 표시 (colored circle + initial text) 사용. `canvasReady` 플래그로 전환.
- **ParticleContainer 제거**: PixiJS v8에서 `ParticleContainer`가 제거됨. 일반 `Container` + `Sprite` 사용.

### RAG + pgvector 관련
- **임베딩 포맷**: pgvector는 `'[1,2,3,...,256]'` 문자열 포맷, `$N::vector` 캐스팅 필수
- **MarketRegime 타입**: `types.ts`에 정의됨 (`arenaWarTypes.ts`가 아닌 `types.ts`에서 import)
- **Terminal vs Arena War 벡터 호환**: 동일 256d 공간을 공유. Terminal 8에이전트 시그널은 Arena War 48팩터 중 6개 슬롯씩 매핑 (center-heavy gradient)
- **Graceful degradation**: `arena_war_rag` 테이블 미존재 시 `isTableMissing()` → warning 반환, 크래시 없음. `search_arena_war_rag()` 함수 미존재 시 직접 쿼리 fallback
- **Commander LLM 호출**: `callLLM`은 서버 전용 (`$lib/server/llmService`), c02Pipeline에서 동적 import. 실패 시 heuristic fallback (비용 $0)
- **Decision Chain 패턴**: scan→trade_open→trade_close를 `chain_id`로 연결. trade_close 시 `matureDecisionChain()`이 체인 전체 pending→confirmed. chainId 추론: source='terminal_scan'이면 `scan-{note}`, 아니면 `trade-{id}`
- **Semantic Dedup**: `computeDedupeHash()` → pair+tf+dir+regime+source+time_bucket 해시. 같은 시간창(기본 60분) 내 구조적 동일 → 중복 스킵
- **search_arena_war_rag_v2**: `preferConfirmedOutcomes=true` 시 v2 함수 사용. quality_weight × cosine_sim × recency_decay × outcome_bonus(confirmed 2x) 가중 스코어링. v2 미존재 시 v1 fallback
- **Agent Retrieval Weights (Paper 2)**: STRUCTURE=1.3, VPA=1.2, ICT=1.2 > SENTI=0.8, MACRO=0.7. `buildMultiSourceFewShotExamples()`와 `computeRAGRecallV2()`에서 사용

---

## Task Backlog

### BE Phase
- [x] B-03: factorEngine + agentPipeline
- [x] B-09: Terminal Scan endpoints
- [x] B-10: Chat API + scan-context
- [x] B-11: Market data APIs + server modules (50 서버 모듈)
- [ ] B-05: Data source provider abstraction (in progress)
- [ ] B-01: Arena API scaffolding
- [ ] B-04: exitOptimizer implementation

### Arena War Phase
- [x] AW-01: 7-phase 상태머신 + mock 데이터
- [x] AW-02: 7개 phase 컴포넌트 UI
- [x] AW-03: GameRecord → 서버 저장 API
- [x] AW-04: Header 네비게이션 추가
- [ ] AW-05: DB 마이그레이션 적용 (001_arena_war_records.sql)
- [x] AW-06: RAG 저장 + 유사도 검색 구현 (ragEmbedding, ragService, /api/arena-war/rag, 002_arena_war_rag.sql)
- [x] AW-07: AI confidence RAG 기반 조정 (fewShotBuilder, c02Pipeline RAG-enhanced Commander)
- [x] AW-08: Decision Memory Architecture (Paper 1+2 기반, Decision Chain + Quality Maturation + Dedup + Agent Signals)
- [x] AW-09: v3 Battle Engine (v2 래핑 + HP + 4타입 상성 + 챌린지 시스템)
- [x] AW-10: PixiJS BattleCanvas + ChallengeOverlay UI
- [x] AW-11: arenaWarStore v3 엔진 통합 (startBattle, processTick, submitChallenge, switchLead, activateGuard)
- [x] AW-12: agentData AI 학습 구조 (PatternMemory, RegimeAdaptation, MatchupExperience)
- [x] AW-13: 에이전트 컬렉션 페이지 `/agents` (Pokedex 스타일)
- [x] AW-14: ResultPhase/JudgePhase/DraftPhase v3 데이터 표시
- [ ] AW-15: Passport 기본 (승률 추이, 레짐별 성과)
- [ ] AW-16: 잭팟 + 배지 + 일일 미션
- [ ] AW-17: 실제 C02 파이프라인 연결 (mock → real)
- [ ] AW-18: 실제 스프라이트 시트 아트 에셋 교체 (현재 colored circle + initial 텍스트)

### UIUX Phase (Loox 테마 적용)
- [x] UX-01: Terminal 다크 포레스트 전환 (PR #43)
- [x] UX-02: Signals/Community 다크 전환 (PR #45)
- [x] UX-03: Arena War 다크 포레스트 테마
- [ ] UX-04: Arena 전략형 UIUX 리뷰 + 테마 통일
- [ ] UX-05: Home 랜딩 UIUX 리뷰
- [ ] UX-06: Passport 테마 적용 (2,688줄 — 대규모)
- [ ] UX-07: Settings 테마 적용
- [ ] UX-08: Arena v2 테마 적용

### Quality / Workflow Phase
- [x] QW-01: deprecated workspace 차단 가드 추가 (`guard-active-workspace.sh`, pre-push/gate 연동)
- [x] QW-02: Svelte warning budget 게이트 추가 (`check-svelte-warning-budget.sh`, baseline=49)
- [x] QW-03: CI check job에 guard + warning budget 반영 (`ci-check-build.yml`)
- [x] QW-04: 경고 정리 우선순위표 문서화 (`docs/warning-priority-2026-03-06.md`)
- [ ] QW-05: warnings 49→0 단계적 감축 (P1: a11y + deprecated slot 우선)

### Arena v2 Pokemon UI Phase
- [x] PKM-00: Sprint 0 엔진 갭 수정 (SpecBonuses, ATR, Tier, Agent ID, RAG 연동)
- [x] PKM-01: Sprint 1 공유 컴포넌트 + BattleScreen Pokemon UI (PokemonFrame, TypewriterBox, HPBar, PhaseTransition, PartyTray)
- [ ] PKM-02: Sprint 2 DraftScreen Pokemon 파티 선택 UI
- [ ] PKM-03: Sprint 3 HypothesisScreen 기술 선택 UI
- [ ] PKM-04: Sprint 4 ResultScreen 승리/패배 연출
- [ ] PKM-05: Sprint 5 AnalysisScreen 탐험 이펙트
- [ ] PKM-06: Sprint 6 PhaseTransition + PhaseBar 통합

### Integration Phase
- [ ] INT-01: Polymarket 실 연동 테스트
- [ ] INT-02: GMX V2 실 연동 테스트
- [ ] INT-03: ORPO 트레이닝 파이프라인 E2E
- [ ] INT-04: 토너먼트 시스템 활성화
