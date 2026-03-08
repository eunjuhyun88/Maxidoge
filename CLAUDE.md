# STOCKCLAW — Canonical Frontend Full-Stack Guide
> **Last updated: 2026-03-07** | canonical workspace + frontend/backend boundary rules + staged extraction policy

## Workspace Status
- **활성 코드베이스:** `/Users/ej/Downloads/maxidoge-clones/frontend/`
- **정본:** 이 폴더 하나만 live target으로 사용한다.
- **레거시 reference-only clone:** `/Users/ej/Downloads/maxidoge-clones/backend/`, `/Users/ej/Downloads/maxidoge-clones/frontend-passport/`, `/Users/ej/Downloads/maxidoge-clones/frontend-wallet-merge/`
- 새 기능, 리팩터, 버그 수정은 reference clone에서 시작하지 않는다.

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

## Frontend/Backend Boundary Rules (필수, 2026-03-07)
1. 이 워크스페이스는 **단일 SvelteKit 풀스택 앱**이지만, 모든 작업은 프론트엔드 책임과 백엔드 책임을 분리해서 설계한다.
2. 프론트엔드 경계:
   - `src/routes/**/*.svelte` (단, `src/routes/api/**` 제외)
   - `src/components/**`
   - `src/lib/stores/**`
   - `src/lib/api/**`
   - `src/lib/services/**` (브라우저 전용)
3. 백엔드 경계:
   - `src/routes/api/**/+server.ts`
   - `src/lib/server/**`
   - DB, 인증, 권한, 외부 시장데이터, 스캔, 정책, mutation, projection 생성
4. 브라우저 런타임 코드에서 `$lib/server/**`를 직접 import하지 않는다.
5. store는 **authoritative truth source가 아니다.** store는 projection cache, UI state, interaction state만 가진다. 최종 정합성, 권한, 계산은 서버가 맡는다.
6. page/component는 화면 조합과 사용자 상호작용에 집중한다. polling, mutation orchestration, heavy derivation, business rule이 커지면 controller/view-model/helper 계층으로 내린다.
7. 새 작업은 구현 전에 반드시 `frontend-only`, `backend-only`, `cross-boundary` 중 하나로 분류하고 설계에 적는다.
8. `backend/` 폴더는 diff/reference 전용이다. 새 구현, 구조 리팩터, 버그 수정을 그쪽에 직접 쌓지 않는다.

## Separation Strategy (필수, 2026-03-07)
1. **지금은 새 top-level 앱 폴더를 만들지 않는다.** 먼저 이 canonical `frontend/` 내부 경계를 안정화한다.
2. 새 폴더를 만들어도 된다. 단, `frontend/` 내부에서 extraction-ready 목적이 분명한 경우에만 만든다.
   - 예: controller, view-model, contracts, domain helper, chart runtime 분리
3. `backend/`와 병행 개발하거나 clone 간 복사-붙여넣기로 동기화하지 않는다. 필요한 차이는 `frontend/`로 수동 통합한다.
4. 물리적 분리는 마지막 단계에서만 진행한다. 목표 구조:
   - `apps/web`
   - `apps/api`
   - `packages/contracts`
   - `packages/domain`
   - `packages/chart-runtime`
   - `packages/ui`
   - `packages/shared`
5. 즉시 물리 분리를 하지 않는 이유:
   - 현재 남은 리스크는 repo 분리보다 내부 책임 과다와 서버/클라이언트 authority 혼재에 더 크다.
   - 지금 분리하면 이동 비용과 회귀 범위가 커지고, hotspot 파일 정리 전에 경계가 다시 흔들릴 가능성이 높다.


## Architecture

### Pages (전체 라우트 맵)
| Route | Purpose | Key Stores | Lines |
|-------|---------|------------|-------|
| `/` (Home) | 랜딩 — 피처 하이라이트, Arena/Terminal 진입 | walletStore, authSessionStore, profileTier | 262 |
| `/arena` | 전략형 예측 아레나 — 드래프트→분석→가설→배틀→결과 (5 phases) | gameState, matchHistoryStore, pnlStore, battleFeedStore | 4,236 |
| `/arena-v2` | 아레나 v2 — 간소화 5-phase + 4가지 뷰 전환 (1=arena,2=chart,3=mission,4=card) | arenaV2State, btcPrice | 262 |
| `/arena-war` | 스피드형 AI 대전 — 8-phase 상태머신 (SETUP→RESULT), v3 배틀엔진(HP+챌린지), PixiJS 렌더링 | arenaWarStore, arenaWarPhase | 54 |
| `/agents` | 에이전트 컬렉션 (Pokedex 스타일) — 학습레벨, 패턴기억, 레짐적응, 매치업경험, 전적 | agentStats | ~380 |
| `/terminal` | 마켓 스캐너 터미널 — route shell + extracted desktop/tablet/mobile layouts + terminal/intel view-model + War Room/Chart/Intel orchestration | gameState, livePrices, copyTradeStore, trackedSignalStore | 1,175 |
| `/passport` | 유저 프로필 허브 — 보유, 트레이드, 시그널, 에이전트, ORPO 학습 | userProfileStore, userLifecycleStore, matchHistoryStore, quickTradeStore, agentStats | 2,688 |
| `/signals` | 트레이딩 시그널 허브 — 커뮤니티/추적/오라클 3뷰 + 필터 | gameState, matchHistoryStore, openTrades, activeSignals | 983 |
| `/settings` | 유저 환경설정 — TF/SFX/언어/테마/속도/데이터소스 | gameState | 384 |
| `/holdings` | → `/passport` 리다이렉트 | — | 10 |
| `/oracle` | → `/signals?view=ai` 리다이렉트 | — | 37 |

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
│   ├── stores/       # Svelte 스토어 (22개 — 아래 상세)
│   ├── signals/      # 트레이딩 시그널 정의
│   ├── wallet/       # 지갑 연결 로직
│   ├── utils/        # 공용 유틸리티 (pnl.ts, storage.ts, price.ts, time.ts, math.ts, errorUtils.ts, timeframe.ts)
│   │                  # math.ts: clamp(), clampSafe() — 14개 모듈에서 공유
│   ├── styles/       # 디자인 토큰 (tokens.css, arena-tone.css)
│   ├── data/         # 정적 데이터/설정
│   ├── assets/       # 이미지, 아이콘
│   └── audio/        # 사운드 이펙트
├── components/       # 72개+ Svelte 컴포넌트 (14개 디렉토리)
│   ├── arena/        # 전략 아레나 (15 + 4 views)
│   ├── arena-v2/     # 아레나 v2 (8 + 1 shared)
│   ├── arena-war/    # 아레나 워 8-phase (8) + 비주얼 배틀 (BattleCanvas[PixiJS], ChallengeOverlay, AgentSprite, BattleVisualizer, VSMeterBar, ActionFeed, BattleEffects, DraftPhase)
│   ├── terminal/     # 터미널 shell/layouts + 패널 프리미티브 (13 root + warroom + intel/)
│   ├── ui/           # 공통 UI 프리미티브 (ModalShell)
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
└── warning-priority-2026-03-06.md        # zero-warning baseline / warning 회귀 방지 기준
```

### Stores (selected authorities — canonical full inventory: `docs/generated/store-authority-map.md`)
| Store | Purpose | Lines |
|-------|---------|-------|
| **gameState** | 핵심 아레나 상태 (phase, view, hypothesis, squad, position) | 262 |
| **arenaWarStore** | Arena War 7-phase 상태머신 + RAG 검색/저장 통합 | ~830 |
| **arenaV2State** | Arena v2 상태 (phase, subPhase, currentView) | 326 |
| **activeGamesStore** | 동시 진행 게임 관리 (최대 3개) | 243 |
| **authSessionStore** | 쿠키 기반 세션 hydrate + 계정 identity projection | 74 |
| **walletStore** | 지갑 연결 transport + signed-wallet shell state | 160 |
| **walletModalStore** | wallet modal open/step flow state | 49 |
| **userLifecycleStore** | 로컬 lifecycle phase/progression shell (`phase`, onboarding, LP/match counters) | 100 |
| **userProfileProjectionStore** | 서버 프로필 projection cache + optimistic profile edits | 201 |
| **userProfileStore** | projection + derived stats compatibility aggregate | 52 |
| **priceStore** | 통합 가격 계약 (WS/REST, BTC/ETH/SOL) — Header, Chart, Terminal 공용 | 233 |
| **quickTradeStore** | 터미널 퀵 트레이드 (LONG/SHORT, PnL 추적) | 343 |
| **trackedSignalStore** | War Room 시그널 추적 (24h 자동만료, QuickTrade 전환) | 301 |
| **predictStore** | Polymarket 예측 (마켓, 포지션, 투표) | 313 |
| **notificationsStore** | durable notifications + optimistic staging | 119 |
| **toastStore** | ephemeral toast presentation state | 39 |
| **p0OverrideStore** | Guardian/P0 shell control flag | 40 |
| **notificationStore** | split notification stores compatibility barrel | 22 |
| **matchHistoryStore** | 아레나 매치 기록 (승률, 연승, PnL) | 186 |
| **copyTradeStore** | Copy Trade 빌더 + canonical publish + `clientMutationId` reconcile | 415 |
| **pnlStore** | PnL 추적 (Arena + Polymarket) | 95 |
| **positionStore** | 통합 포지션 (QuickTrade + Polymarket + GMX) | 186 |
| **battleFeedStore** | 실시간 배틀 피드 (최대 50 아이템) | 54 |
| **communityStore** | 커뮤니티 포스트 (localStorage + 서버 동기화) | 138 |
| **agentData** | 에이전트 스탯 (레벨, XP, 승/패) + AI 학습 시스템 (PatternMemory, RegimeAdaptation, MatchupExperience, learningLevel) | ~350 |
| **warRoomStore** | 3-라운드 War Room 토론 상태 | 246 |
| **progressionRules** | LP→Tier 매핑 (BRONZE→SILVER→GOLD→DIAMOND→MASTER) | 119 |
| **hydration** | 전체 스토어 API 하이드레이션 오케스트레이터 | 61 |
| **storageKeys** | localStorage 키 중앙 레지스트리 (19 keys) | 23 |

### Engine Modules (33개 — `src/lib/engine/`)
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

### Server Modules (53개 — `src/lib/server/`)

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

**유틸리티 (9):**
apiValidation, requestGuards, ipReputation, progressionUpdater, tournamentService, arenaService, taskUtils (fireAndForget), providers/cache, providers/registry

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
| **Community** | 8 | `/api/community/posts{,[id],[id]/react,[id]/comments,[id]/comments/[commentId]}`, `/api/activity{,/reaction}`, `/api/creator/[userId]` |
| **Copy Trading** | 3 | `/api/copy-trades/{runs,runs/[id],publish}` — publish는 `clientMutationId` idempotency + canonical trade/signal/run 응답 |
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

### 2026-03-06 Refactor Additions
- `src/lib/server/profileProjection.ts`: 프로필 tier/badge/stats 서버 projection 단일 계산 경로
- `src/lib/profile/profileAuthority.ts`: profile 표시 규칙 shared helper
- `src/components/terminal/{TerminalDesktopLayout,TerminalTabletLayout,TerminalMobileLayout}.svelte`: viewport별 shell 분리
- `src/components/terminal/TerminalChartViewport.svelte`: terminal chart viewport canonical boundary; ChartPanel wiring과 optional verdict overlay를 layout-preserving child로 고정
- `src/components/terminal/ChartVerdictOverlay.svelte`: 차트 위 반투명 오버레이 — 컨센서스 방향/신뢰도 표시 (VerdictBanner 대체, 레이아웃 0px)
- `src/components/terminal/MobileChatSheet.svelte`: iOS 풀업 시트 패턴 AI 채팅 (peek 48px / half 50vh / full 88vh)
- `src/components/terminal/TabletWarRoomDrawer.svelte`: 태블릿 좌측 오버레이 드로어 — WarRoom 슬라이드인 (320px)
- `src/components/terminal/MobileActionBar.svelte`: 모바일 차트탭 하단 액션바 (스캔/컨센서스/매매/채팅 트리거)
- `src/components/terminal/CopyTradeModalHost.svelte`: terminal route의 copy-trade lazy modal host 계층
- `src/components/terminal/TerminalShareModalHost.svelte`: terminal route의 community share lazy modal host 계층
- `src/components/terminal/terminalShell.css`: terminal route에서 분리한 shared shell/layout styling
- `src/lib/terminal/terminalViewModel.ts`: terminal route의 decision/control/offline-fallback 계산 계층
- `src/lib/terminal/terminalHelpers.ts`: terminal route의 layout/pattern-scan/agent-detection 순수 helper 계층
- `src/lib/terminal/terminalTypes.ts`: terminal route/layout/panel/lib 공용 타입 계층
- `src/lib/terminal/terminalEventMappers.ts`: terminal scan/chat/community message 및 trade-setup 조립 계층
- `src/lib/terminal/terminalActionRuntime.ts`: terminal route의 scan request/chat focus/trade-plan/pattern-scan orchestration 계층
- `src/lib/terminal/terminalChatRuntime.ts`: terminal route의 intel-chat transport/orchestration/offline fallback 계층
- `src/lib/terminal/terminalCommunityRuntime.ts`: terminal route의 community signal publish/share modal state + prefill orchestration 계층
- `src/lib/terminal/terminalEngagementRuntime.ts`: terminal route의 density/mobile-tab state + persistence + viewport analytics orchestration 계층
- `src/lib/terminal/terminalPanelRuntime.ts`: terminal route의 warroom/chart ref registry + active chart lookup + pending scan flush 계층
- `src/lib/terminal/terminalShellRuntime.ts`: terminal shell의 GTM emitter/live ticker state/bootstrap query parsing + shell mount lifecycle 계층
- `src/lib/terminal/terminalScanRuntime.ts`: terminal route의 scan start/complete/chart-show state transition 계층
- `src/lib/terminal/terminalLayoutRuntime.ts`: terminal shell의 desktop side-panel state/resize/drag + tablet intel split lifecycle 계층
- `src/lib/terminal/terminalMobileSplitRuntime.ts`: mobile chart/chat split ratio drag lifecycle 계층
- `src/lib/terminal/terminalMessageRuntime.ts`: terminal route의 chat message/focus state + append/trim orchestration 계층
- `src/lib/terminal/terminalSessionRuntime.ts`: terminal route의 scan/chat/trade session state ownership 계층
- `src/lib/api/terminalApi.ts`: terminal scan/chat/live-ticker browser transport 계층
- `src/lib/terminal/intel/intelViewModel.ts`: IntelPanel의 positions/trend/headline 파생 상태 계산 계층
- `src/lib/terminal/intel/{intelHelpers,intelTypes}.ts`: IntelPanel 서브패널 공용 helper/type 계층
- `src/lib/terminal/intel/intelUiState.ts`: IntelPanel의 탭 복원/지연 저장 큐 runtime 계층
- `src/lib/terminal/intel/intelPositionRuntime.ts`: IntelPanel의 positions polling/visibility refresh lifecycle 계층
- `src/lib/api/intelApi.ts`: IntelPanel용 market/onchain/opportunity/policy transport 계층
- `src/lib/terminal/intel/intelFeedMappers.ts`: IntelPanel feed/headline/flow 응답 정규화 계층
- `src/lib/terminal/intel/intelPolicyMappers.ts`: IntelPanel policy payload 정규화 계층
- `src/lib/terminal/warroom/warRoomTypes.ts`: WarRoom scan tab/diff/highlight/shared type 계층
- `src/lib/terminal/warroom/warRoomScanState.ts`: WarRoom의 scan state restore/persist/server history merge 계층
- `src/lib/terminal/warroom/warRoomScanRuntime.ts`: WarRoom의 server signal mapping/scan tab upsert/diff 계산 계층
- `src/lib/terminal/warroom/warRoomDerivativesRuntime.ts`: WarRoom의 derivatives polling/cache/visibility lifecycle 계층
- `src/lib/chart/tradingviewEmbed.ts`: TradingView iframe 생성/파괴/URL 조립 어댑터
- `src/lib/chart/chartTradePlanner.ts`: ChartPanel의 line-entry / trade-plan / community-signal 계산 계층
- `src/lib/chart/chartPanelContracts.ts`: ChartPanel public handle + cross-surface request/signal contract 계층; terminal/layout/runtime이 동일 계약을 공유
- `src/lib/chart/chartPanelViewModel.ts`: ChartPanelShell display-state + shell prop contract 조립 계층
- `src/components/arena/chart/chartPatternEngine.ts`: ChartPanel의 패턴 스캔/visible-scope/overlay snapshot 순수 계산 계층
- `src/components/arena/chart/chartPatternRuntime.ts`: ChartPanel의 pattern marker merge/visible-range scan scheduler/focus/line-series cleanup lifecycle 계층
- `src/components/arena/chart/chartTradePlanRuntime.ts`: ChartPanel의 trade-plan ratio drag/confirm/cancel cleanup lifecycle 계층
- `src/components/arena/chart/chartPositionRuntime.ts`: ChartPanel의 TP/SL/ENTRY price-line sync + hover/drag/wheel lifecycle 계층
- `src/components/arena/chart/chartDrawingRuntime.ts`: ChartPanel의 drawing mode/global mouseup/ghost-line RAF/line-entry finalize lifecycle 계층
- `src/components/arena/chart/chartOverlayRuntime.ts`: ChartPanel의 overlay canvas context/render/resize/agent overlay cleanup lifecycle 계층
- `src/components/arena/chart/chartViewportRuntime.ts`: ChartPanel의 indicator pane layout/time-scale/zoom/Y-auto/reset lifecycle 계층
- `src/components/arena/chart/chartActionRuntime.ts`: ChartPanel의 pair/timeframe 전환, chart-origin scan/chat/community signal, trade-drawing activation orchestration 계층
- `src/components/arena/chart/chartPriceRuntime.ts`: ChartPanel의 priceStore flush/throttle, 24h stats 반영, fallback live price, data-load transient cleanup 계층
- `src/components/arena/chart/chartRuntimeBundle.ts`: ChartPanel의 primary runtime 생성 순서, interaction binding, primary cleanup ordering 계층
- `src/components/arena/chart/ChartTradingViewPane.svelte`: ChartPanel의 trading-mode 전용 TradingView iframe shell + loading/error/fallback UI child boundary
- `src/components/arena/chart/ChartIndicatorStrip.svelte`: ChartPanel의 agent advanced-mode indicator strip + view toggle + legend toggle child boundary
- `src/components/arena/chart/ChartHeaderBar.svelte`: ChartPanel의 상단 toolbar/meta/pair switch/timeframe/mode toggle/layout-preserving child boundary
- `src/components/arena/chart/ChartAgentOverlayChrome.svelte`: ChartPanel의 agent overlay chrome(scale tools/legend/loading/error/CTA/position badge/notice) child boundary
- `src/components/arena/chart/ChartTradePlanOverlay.svelte`: ChartPanel의 trade-plan overlay child boundary; ratio drag/open/cancel wiring만 부모가 보유하고, overlay 마크업/스타일/반응형 위치는 layout-preserving child에서 유지
- `src/components/arena/chart/ChartAnnotationLayer.svelte`: ChartPanel의 agent annotation surface child boundary; annotation popup selection과 absolute-position markup/style를 child가 보유
- `src/components/arena/chart/ChartDrawingCanvas.svelte`: ChartPanel의 drawing canvas DOM ownership child boundary; canvas element/class/event surface는 child가 보유하고 부모는 runtime wiring만 수행
- `src/components/arena/chart/ChartAgentSurface.svelte`: ChartPanel의 chart-container surface child boundary; chart container DOM/class/event surface와 overlay stacking order를 child가 보유
- `src/components/arena/chart/ChartPanelShell.svelte`: ChartPanel의 top-level presentation shell child boundary; header/indicator strip/agent surface/trading pane composition과 lazy import/effect를 child가 보유
- `src/components/arena/chart/chartPanelController.ts`: ChartPanel의 mount/reload/mode-switch/pattern-scan/public-handle/cleanup orchestration controller 계층
- `src/components/arena/chart/chartPanelSupportRuntime.ts`: ChartPanel의 overlay/viewport/trade-plan/drawing/action/price runtime 조립과 support-runtime dispose 경계
- `src/components/arena/chart/chartMountRuntime.ts`: ChartPanel의 mount/bootstrap helper 계층; lightweight-charts import, 초기 shell state normalization, bootstrap 준비, MA period binding, primary runtime bundle setup/cleanup ordering을 담당
- `src/components/arena/chart/chartDrawingEngine.ts`: ChartPanel의 canvas drawing / persisted drawing render 순수 렌더 계층
- `src/components/arena/chart/chartDrawingSession.ts`: ChartPanel의 drawing draft / line-entry finalize 순수 세션 전이 계층
- `src/components/arena/chart/chartOverlayRenderer.ts`: ChartPanel의 overlay canvas 렌더 결정 계층
- `src/components/arena/chart/chartPositionInteraction.ts`: ChartPanel의 TP/SL/ENTRY hover/drag-target/wheel-step 순수 상호작용 계산 계층
- `src/components/arena/chart/chartRuntimeBindings.ts`: ChartPanel의 visible-range/crosshair/resize/hotkey lifecycle 바인딩 계층
- `src/components/arena/chart/chartDataRuntime.ts`: ChartPanel의 kline bootstrap/history pagination/Binance websocket lifecycle 계층
- `src/components/arena/chart/chartTradingViewRuntime.ts`: ChartPanel의 TradingView safe-mode fallback/retry/debounced re-init lifecycle 계층
- `src/components/arena/chart/chartBootstrap.ts`: ChartPanel의 lightweight-charts/pane/series bootstrap 계층
- `src/lib/arena/state/arenaTypes.ts`: arena route의 result/phase/mode/score/preview/battle shell display contract 계층
- `src/lib/arena/selectors/arenaViewModel.ts`: arena route의 phase track, mode label, mission text, score badge, result title, preview card, api sync status, battle HUD/log selector 계층
- `src/lib/arena/adapters/arenaChartBridge.ts`: arena route의 chart position state, marker/annotation decoration, hypothesis drag math canonical adapter 계층
- `src/lib/arena/controllers/arenaChartController.ts`: arena route의 chart drag event -> hypothesis/chartBridge mutation, chart marker/position line visibility toggle canonical controller 계층
- `src/lib/arena/feed/arenaLiveEventRuntime.ts`: arena route의 live-event cadence/timer/feed emission runtime 계층
- `src/lib/arena/reward/arenaRewardRuntime.ts`: arena route의 result reward XP/badge/streak 계산 계층
- `src/lib/arena/battle/arenaBattlePresentationRuntime.ts`: arena route의 sprite helper, turn sequence, battle HUD/chat presentation runtime 계층
- `src/lib/arena/battle/arenaBattleResolverRuntime.ts`: arena route의 live resolver tick reaction, VS meter/HP reaction, result feed normalization 계층
- `src/lib/arena/controllers/arenaAnalysisPresentationRuntime.ts`: arena route의 scout/gather/council stage presentation, findings reveal, council vote/chat/feed orchestration 계층
- `src/lib/arena/controllers/arenaAgentRuntime.ts`: arena route의 agent state init, typing speech timer, arena chat append, battle sprite sync 전의 UI state canonical runtime 계층
- `src/lib/arena/controllers/arenaAgentBridge.ts`: arena route의 agent speech/state/energy/chat + `SYSTEM` author 정규화 bridge 계층
- `src/lib/arena/controllers/arenaBattleStateBridge.ts`: arena route의 battle HUD/turn/vs-meter/narration state bridge 계층
- `src/lib/arena/controllers/arenaPageStateBridge.ts`: arena route의 overlay visibility/chart bridge/server sync/page timer state bridge 계층
- `src/lib/arena/controllers/arenaGameStateBridge.ts`: arena route의 `gameState` mutation canonical bridge 계층 (`squadConfig`, `arenaView`, hypothesis/pos sync, battle tick/result, result progression apply)
- `src/lib/arena/controllers/arenaUiStateBridge.ts`: arena route의 local UI shell state canonical bridge 계층 (`rewardState`, `resultData`, `floatingWords`, `arenaParticles`, `showMarkers`)
- `src/lib/arena/controllers/arenaPhaseEffectsRuntime.ts`: arena route의 draft/analysis/hypothesis/preview/battle 진입 연출, feed/audio/speech choreography canonical runtime 계층
- `src/lib/arena/controllers/arenaPhaseRuntimeBundle.ts`: arena route의 phase/battle runtime/controller assembly canonical bundle 계층 (`battlePresentationRuntime`, `analysisPresentationRuntime`, `phaseEffectsRuntime`, `phaseController`, `battleController` 조립과 clear/destroy 경계)
- `src/lib/arena/controllers/arenaRouteLifecycle.ts`: arena route의 scene lazy import warmup, phase-init callback mount, keydown listener mount/destroy canonical lifecycle 계층
- `src/lib/arena/controllers/arenaBattleController.ts`: arena route의 battle phase entry, fallback position normalization, live resolver subscribe/cleanup, battle result phase advance canonical controller 계층
- `src/lib/arena/result/arenaResultRuntime.ts`: arena route의 result 판정, FBS/LP 계산, history/PnL payload 조립, progression persistence/runtime 계층
- `src/lib/arena/controllers/arenaMatchController.ts`: arena route의 squad deploy server sync, draft payload build, server sync reset canonical controller 계층
- `src/lib/arena/controllers/arenaResultController.ts`: arena route의 result 계산/persistence/presentation/PvP reveal orchestration, reward modal close canonical controller 계층
- `src/lib/arena/controllers/arenaShellController.ts`: arena route의 lobby/play-again/reset, exit confirm, keyboard shortcut, match-history/float-dir/view-picker shell control canonical controller 계층
- `src/lib/arena/controllers/arenaPhaseController.ts`: arena route의 draft/analysis/hypothesis/battle/result phase entry, analysis sync kickoff, hypothesis countdown/timeout, preview auto-advance, phase dispatch canonical controller 계층
- `db/migrations/0007_copy_trade_publish_idempotency.sql`, `supabase/migrations/014_copy_trade_publish_idempotency.sql`: copy-trade publish durable idempotency index
- warning baseline restored to `0`: shared + `arena-v2` Svelte warnings are closed; any new warning is treated as a regression

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

## Design-First Protocol (구현 전 설계 고정)

모든 구현/수정 작업은 **설계 확정 후 코드 작성**을 원칙으로 한다.

**필수 설계 체크리스트:**
1. 문제 정의: 현재 사용자 불편/비즈니스 목표를 1~3문장으로 고정
2. UX 플로우: 시작 액션 → 중간 상태 → 종료 액션(성공/실패) 정의
3. 데이터 플로우: 입력(store/API) / 처리 / 출력(store/API/UI) 명시
4. 경계 조건: 인증 없음, 데이터 없음, 네트워크 실패 시 동작 정의
5. 수용 기준(DoD): QA가 바로 검증 가능한 체크 항목으로 작성

**실행 순서 (고정):**
1. 설계 초안 작성
2. 영향 파일 식별
3. 구현
4. `npm run check` + `npm run build`
5. 설계 대비 구현 diff 점검

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
**Arena War 로컬 정본**:
- `docs/product-specs/arena.md`
- `docs/design-docs/arena-domain-model.md`
- `docs/design-docs/learning-loop.md`

프로젝트 루트의 `STOCKCLAW_UNIFIED_DESIGN.md`는 **깊은 예외 케이스용 보조 참조**로만 사용.

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
- **로컬 정본**: `docs/product-specs/arena.md`, `docs/design-docs/arena-domain-model.md`, `docs/design-docs/learning-loop.md`
- **외부 보조 참조**: `STOCKCLAW_UNIFIED_DESIGN.md` (프로젝트 루트, edge-case semantics only)
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
- **변수명 `state` 사용 금지**: `let state = $derived(...)` 하면 `$state()` rune이 store 구독으로 오인됨. 에러: "Cannot use 'state' as a store". **`gs` 또는 다른 이름 사용.**
- **`AgentMatchRecord` vs `MatchRecord`**: agentData.ts는 `AgentMatchRecord`, matchHistoryStore.ts는 `MatchRecord` (아레나 매치). 이름 혼동 주의.
- **`$components` alias 없음**: `$components/` import path는 미등록. 컴포넌트는 **상대경로** (`../../components/`) 사용.

### 빌드 관련
- **node_modules synthetic 파일 깨짐**: `@sveltejs/kit/src/types/synthetic/` 안의 `.md` 파일들이 날짜 접두어로 rename될 수 있음. `npm install` 후에도 안 되면 수동으로 접두어 제거 후 복사.
- **`npm run build` 실패 시**: `node node_modules/.bin/vite build` 직접 사용.
- **warning budget 게이트**: `npm run check:budget`는 기본 `WARNING_BUDGET=49`를 초과하면 실패. 현재 canonical baseline은 `0 warnings`라서 새 warning은 모두 회귀로 본다.
- **CI check job 규칙**: `guard:workspace` + `check:budget`을 먼저 통과해야 함.

### Workspace / Legacy 운영
- **`frontend-passport`는 deprecated 로컬 워크스페이스**: `scripts/dev/guard-active-workspace.sh`가 gate/push 전에 차단.
- **임시 우회**: 꼭 필요한 경우에만 `ALLOW_LEGACY_WORKSPACE=1` 사용 (기본 금지).

### 공통 유틸리티 (Phase 1 리팩토링에서 추출)
- **`$lib/utils/pnl.ts`**: PnL 계산 단일 소스. `calcPnlPercent(dir, entry, current, decimals)`. quickTradeStore, close/+server.ts에서 사용.
- **`$lib/utils/storage.ts`**: localStorage 헬퍼. `loadFromStorage<T>()`, `saveToStorage()`, `autoSave()`. 12개 스토어의 보일러플레이트 교체용.
- **`$components/ui/ModalShell.svelte`**: 공통 모달 오버레이 (overlay + close + stopPropagation + a11y). 5개 모달에서 래핑 사용.

### 서버 API 패턴
- **DB 테이블 미존재 대응**: API에서 `errorContains(e, 'does not exist')` 체크 → graceful fallback + warning 반환.
- **localStorage 사용 금지**: 서버(PostgreSQL)가 있으므로 클라이언트 영속 저장은 서버 API 경유. localStorage는 캐시/임시 용도만.
- **unknown error 직접 접근 금지**: 서버/API 레이어에서 `error?.code`, `error?.message` 직접 접근하지 말고 `$lib/utils/errorUtils`의 `getErrorCode()` / `getErrorMessage()`를 사용.
- **auth route helper canonical path**: `/api/auth/login`과 `/api/auth/register`의 body 파싱, email/nickname 검증, wallet proof 검증/nonce 소비, session cookie issuance는 `src/lib/server/authService.ts`가 canonical이다. 두 route에 같은 validation/session 생성 로직을 다시 인라인하지 말고, route는 abuse guard·conflict lookup·response shaping만 소유할 것.
- **wallet modal flow canonical path**: `WalletModal.svelte`의 browser-side auth form parsing, shared validation message reuse, start-step resolution, GTM error-reason normalization은 `src/lib/auth/walletModalFlow.ts`가 canonical이다. modal 안에 email/nickname 규칙 문자열과 start-step branching을 다시 길게 복제하지 말 것.
- **wallet modal transport canonical path**: `WalletModal.svelte`의 async wallet connect, nonce/signature verify, signup/login submit, logout API 호출은 `src/lib/auth/walletModalTransport.ts`가 canonical이다. modal에 provider별 account request, nonce fetch, signature verify, auth submit fetch를 다시 직접 풀어쓰지 말 것.
- **auth api normalizer canonical path**: `/api/auth/*` browser wrapper의 legacy success envelope parsing, timestamp coercion, fallback auth-user shaping은 `src/lib/auth/authApiNormalizer.ts`가 canonical이다. `src/lib/api/auth.ts`나 auth store에서 같은 user/session/nonce/verify 정규화를 다시 풀어쓰지 말 것.
- **community row mapping canonical path**: `community_posts` / `community_post_comments` row → browser contract projection, 공통 SELECT column list는 `src/lib/server/communityMapping.ts`가 canonical이다. `/api/community/posts`, `/api/community/posts/[id]`, `/api/community/posts/[id]/comments`, `/api/creator/[userId]`에서 post/comment mapper를 다시 각자 인라인하지 말 것.
- **signals secondary-route contract**: 커뮤니티 surface의 server-backed secondary routes는 `/signals/[postId]` detail과 `/creator/[userId]` public profile이 canonical이다. feed card click과 author click을 다른 임시 route/state로 우회하지 말 것.
- **user profile aggregate boundary**: `src/lib/stores/userProfileStore.ts`는 projection + derived stats를 합치는 compatibility aggregate만 담당한다. `hydrateUserProfile()`, `incrementTrackedSignals()`, `setUsername()`, `setAvatar()` 같은 projection authority는 `src/lib/stores/userProfileProjectionStore.ts`에서 직접 가져오고, aggregate barrel에 다시 우회 의존하지 말 것.
- **passport learning panel controller canonical path**: `src/routes/passport/+page.svelte`의 learning panel hydrate, worker run, retrain queue, report generation side effect는 `src/lib/passport/passportLearningPanelController.ts`가 canonical이다. route 안에 같은 async orchestration과 success/error message choreography를 다시 인라인하지 말고, route는 derived display state와 button wiring만 소유할 것.
- **copy-trade publish idempotency**: `clientMutationId`는 `copy_trade_runs.draft.clientMutationId`에 저장되고, 고유 인덱스는 `db/migrations/0007_*` / `supabase/migrations/014_*` migration이 있어야 보장된다.
- **Svelte 5 `state` 변수명 금지**: Svelte 5 rune `$state`와 충돌하므로 prop/변수명으로 `state`를 절대 사용하지 말 것. 대안: `sheetState`, `drawerState`, `formState` 등 접두사 사용. (MobileChatSheet에서 발견된 함정)
- **terminal shell CSS 위치**: `/terminal` 레이아웃 스타일은 `src/components/terminal/terminalShell.css`가 canonical. route `<style>`로 되돌리면 `css_unused_selector` 경고가 급증한다.
- **terminal/intel view-model 경계**: `src/lib/terminal/terminalViewModel.ts`, `src/lib/terminal/intel/intelViewModel.ts`는 순수 계산 전용이다. fetch/store mutation/gtm side effect를 다시 넣지 말고 route/panel에 남겨야 한다.
- **terminal type 경계**: terminal 공용 타입은 `src/lib/terminal/terminalTypes.ts`가 canonical이다. `src/routes/terminal/*` 아래에 타입 정본을 다시 만들면 `lib -> routes` 역참조가 생긴다.
- **terminal event mapper 경계**: scan 완료 chat message, consensus/agent trade setup, community signal post/attachment/message 조립은 `src/lib/terminal/terminalEventMappers.ts`가 canonical이다. `terminal/+page.svelte`에 동일한 문자열 조립과 RR 계산을 다시 복제하지 말 것.
- **terminal action runtime 경계**: scan request 대기열, chart/intel/warroom auto-switch, trade-plan 요청, pattern-scan 요청 흐름은 `src/lib/terminal/terminalActionRuntime.ts`가 canonical이다. `terminal/+page.svelte`에 같은 orchestration 분기를 다시 복제하지 말 것.
- **terminal chat runtime 경계**: intel chat의 user-message append, `/api/chat/messages` transport, offline fallback, suggested direction 업데이트는 `src/lib/terminal/terminalChatRuntime.ts`가 canonical이다. `terminal/+page.svelte`나 `IntelPanel.svelte`에 동일한 fetch/error/reply 조립 로직을 다시 인라인하지 말 것.
- **terminal scan runtime 경계**: scan start/complete, latest scan 적용, consensus trade setup 반영, chart-origin signal display 반영은 `src/lib/terminal/terminalScanRuntime.ts`가 canonical이다. `terminal/+page.svelte`에 scan payload 해석과 chat message append/state transition 분기를 다시 인라인하지 말 것.
- **terminal community runtime 경계**: chart-origin signal tracking, community post 생성, copy-trade modal open, share modal open/prefill/close state 흐름은 `src/lib/terminal/terminalCommunityRuntime.ts`가 canonical이다. `terminal/+page.svelte`에 share modal state mutation이나 게시글/attachment 조립 로직을 다시 풀어쓰지 말 것.
- **terminal scan-to-copy canonical path**: AI scan verdict를 copy-trade draft로 넘길 때 평균 entry/tp/sl, confidence, source/reason 조립은 `src/lib/stores/copyTradeStore.ts`의 `prefillFromScan(...)`이 canonical이다. chart verdict overlay나 `terminal/+page.svelte`에서 scan 기반 copy payload를 다시 직접 조립하지 말 것.
- **terminal engagement runtime 경계**: density mode state/persistence, mobile tab state/change GTM, mobile viewport/nav impression 플래그는 `src/lib/terminal/terminalEngagementRuntime.ts`가 canonical이다. `terminal/+page.svelte`에 `mobileTab`/`densityMode` local state, localStorage access, mobile impression state flag를 다시 인라인하지 말 것.
- **terminal panel runtime 경계**: warroom ref 등록, viewport별 active chart panel lookup, pending chart-scan flush 재시도는 `src/lib/terminal/terminalPanelRuntime.ts`가 canonical이다. `terminal/+page.svelte`에 `warRoomRef` 기반 재시도 함수나 viewport 분기 chart ref lookup을 다시 복제하지 말 것.
- **terminal message runtime 경계**: chat message buffer, intel chat focus key, append, max-length trim은 `src/lib/terminal/terminalMessageRuntime.ts`가 canonical이다. `terminal/+page.svelte`에 `chatMessages`/`chatFocusKey` local state나 message buffer slice helper를 다시 풀어쓰지 말 것.
- **terminal session runtime 경계**: `latestScan`, `terminalScanning`, `chatTradeReady`, `chatSuggestedDir`, `chatConnectionStatus`, `activeTradeSetup`, `isTyping` state ownership은 `src/lib/terminal/terminalSessionRuntime.ts`가 canonical이다. `terminal/+page.svelte`에서 각 session field local state나 getter/setter closure를 다시 복제하지 말 것.
- **terminal shell runtime 경계**: shell GTM emitter, live ticker state/로드, alert engine mount lifecycle, `copyTrade=1` query bootstrap 파싱은 `src/lib/terminal/terminalShellRuntime.ts`가 canonical이다. route에서 raw URL param delete/rewrite, shell mount bootstrap, live ticker state mutation, raw market ticker JSON shape 해석을 다시 복제하지 말 것.
- **terminal layout runtime 경계**: desktop left/right panel width/collapse/drag state, wheel 기반 side-panel resize, tablet intel split width/drag/reset, viewport resize lifecycle은 `src/lib/terminal/terminalLayoutRuntime.ts`가 canonical이다. `terminal/+page.svelte`에 panel width/collapse local state, `mousemove/pointermove/resize` listener, panel clamp 로직을 다시 인라인하지 말 것.
- **terminal mobile split runtime 경계**: mobile chart/chat split 비율, divider drag, split container height 기반 clamp는 `src/lib/terminal/terminalMobileSplitRuntime.ts`가 canonical이다. `TerminalMobileLayout.svelte`에 split resize 수학과 pointer lifecycle을 다시 인라인하지 말 것.
- **terminal chart viewport 경계**: ChartPanel wiring과 optional verdict overlay shell은 `src/components/terminal/TerminalChartViewport.svelte`가 canonical이다. mobile/tablet/desktop layout에서 `ChartPanel` event props와 `ChartVerdictOverlay` 조합을 각각 다시 복제하지 말 것.
- **terminal modal lazy boundary**: `CopyTradeModal`과 `SignalPostForm`의 lazy host는 `src/components/terminal/{CopyTradeModalHost,TerminalShareModalHost}.svelte`가 canonical이다. `terminal/+page.svelte`에 dynamic import 상태/host markup/CSS를 다시 인라인하지 말 것.
- **terminal API transport 경계**: terminal scan/chat/live-ticker 브라우저 fetch는 `src/lib/api/terminalApi.ts`가 canonical이다. `terminal/+page.svelte`에서 `/api/chat/messages`, `/api/feargreed`, `/api/coingecko/global`를 직접 fetch하지 말 것.
- **terminal dead layout 금지**: 예전 tablet 좌/하단 2축 split(`tabletLeftWidth`, `tabletBottomHeight`) 경로는 제거됐다. 새 tablet layout은 intel width 단일 split만 유지하며, 폐기된 2축 split 상태/헬퍼를 다시 부활시키지 말 것.
- **IntelPanel runtime 경계**: 탭 상태 저장과 positions polling/visibility refresh는 `src/lib/terminal/intel/{intelUiState,intelPositionRuntime}.ts`가 canonical이다. `IntelPanel.svelte`에 timer/visibility listener/save debounce를 다시 인라인하지 말 것.
- **IntelPanel transport 경계**: market/onchain/opportunity/policy fetch는 `src/lib/api/intelApi.ts`, headline/flow shape 변환은 `src/lib/terminal/intel/intelFeedMappers.ts`, policy payload 정규화는 `src/lib/terminal/intel/intelPolicyMappers.ts`가 canonical이다. `IntelPanel.svelte`에 raw JSON shape 해석과 transport 세부를 다시 복제하지 말 것.
- **WarRoom state 경계**: scan state localStorage restore/persist, server history merge, entry auto-scan stale 판정은 `src/lib/terminal/warroom/warRoomScanState.ts`가 canonical이다. `WarRoom.svelte`에 localStorage parse/normalize와 history merge 로직을 다시 인라인하지 말 것.
- **WarRoom runtime 경계**: server signal → `AgentSignal` 매핑, server detail hydrate, scan tab upsert, diff 계산은 `src/lib/terminal/warroom/warRoomScanRuntime.ts`가 canonical이다. `WarRoom.svelte`에 agent palette lookup과 diff loop를 다시 복제하지 말 것.
- **WarRoom derivatives 경계**: derivatives fetch/cache/polling/visibility lifecycle은 `src/lib/terminal/warroom/warRoomDerivativesRuntime.ts`가 canonical이다. 특히 cache key는 `pair`만이 아니라 `pair + timeframe` 기준이어야 하므로, `WarRoom.svelte`에 pair-only cache를 다시 두지 말 것.
- **IntelPanel 계약 방식**: `src/components/terminal/IntelPanel.svelte`는 `sendchat/gototrade/collapse`를 component event로 dispatch하지 않고 callback prop(`onSendChat`, `onGoToTrade`, `onCollapse`)로 받는다. layout에서 `on:` 리스너를 다시 쓰면 타입 계약이 깨진다.
- **TradingView embed canonical path**: TradingView iframe URL/cleanup은 `src/lib/chart/tradingviewEmbed.ts`가 단일 진실원이다. `ChartPanel.svelte` 안에 querystring/iframe destroy 로직을 다시 복제하면 fallback·CSP 수정이 분산된다.
- **Chart trade planner canonical path**: line-entry 정규화, trade-plan ratio/order 계산, community signal draft 생성은 `src/lib/chart/chartTradePlanner.ts`가 단일 진실원이다. `ChartPanel.svelte`에 RR/risk/source/reason 계산을 다시 복제하지 말 것.
- **Chart pattern/render canonical path**: visible-range candle slice, pattern signature/snapshot, overlay marker selection은 `src/components/arena/chart/chartPatternEngine.ts`가 단일 진실원이고, persisted drawing render loop는 `src/components/arena/chart/chartDrawingEngine.ts`가 단일 진실원이다. `ChartPanel.svelte`에 pattern summary/render for-loop를 다시 복제하지 말 것.
- **Chart pattern runtime canonical path**: pattern marker merge, visible-range scan debounce, focus-range 이동, pattern guide line-series cleanup은 `src/components/arena/chart/chartPatternRuntime.ts`가 단일 진실원이다. `ChartPanel.svelte`에 `_patternRangeScanTimer`, pattern signature 비교, marker merge, line-series dispose 로직을 다시 인라인하지 말 것.
- **Chart trade-plan runtime canonical path**: trade-plan ratio pointer drag, confirm/cancel side effect, trade-plan cleanup는 `src/components/arena/chart/chartTradePlanRuntime.ts`가 단일 진실원이다. `ChartPanel.svelte`에 pointermove/pointerup 바인딩과 `pendingTradePlan` confirm/cancel side effect를 다시 인라인하지 말 것.
- **Chart position runtime canonical path**: TP/SL/ENTRY price line 생성/제거, hover target, drag state, mouse wheel adjustment는 `src/components/arena/chart/chartPositionRuntime.ts`가 단일 진실원이다. `ChartPanel.svelte`에 price-line create/remove와 hover/drag/wheel 분기를 다시 인라인하지 말 것.
- **Chart drawing runtime canonical path**: drawing mode transition, global mouseup binding, line-entry pointer lifecycle, ghost-line RAF path, line-entry finalize side effect는 `src/components/arena/chart/chartDrawingRuntime.ts`가 단일 진실원이다. `ChartPanel.svelte`에 drawing mode reset, window mouseup 바인딩, `_drawRAF` 성격의 RAF bookkeeping, line-entry finalize 분기를 다시 인라인하지 말 것.
- **Chart overlay runtime canonical path**: overlay canvas context 캐시, `renderDrawings` orchestration, canvas resize, `toOverlayPoint` 변환, agent overlay cleanup은 `src/components/arena/chart/chartOverlayRuntime.ts`가 단일 진실원이다. `ChartPanel.svelte`에 canvas context 캐시, overlay render body, resize 시 context invalidation, agent price-line cleanup을 다시 인라인하지 말 것.
- **Chart viewport runtime canonical path**: indicator visibility apply, pane stretch layout, bar-spacing time-scale apply, zoom/fit/Y-auto/reset viewport controls는 `src/components/arena/chart/chartViewportRuntime.ts`가 단일 진실원이다. `ChartPanel.svelte`에 pane stretch 분기, `barSpacing` 조정 수식, Y-auto 토글 side effect, scale reset 로직을 다시 인라인하지 말 것.
- **Chart action runtime canonical path**: pair/timeframe 전환, chart-origin scan request, chart-origin chat request, community signal publish preflight, trade-drawing activation은 `src/components/arena/chart/chartActionRuntime.ts`가 단일 진실원이다. `ChartPanel.svelte`에 `changePair`, `changeTF`, `requestAgentScan`, `requestChatAssist`, `publishCommunitySignal`, `activateTradeDrawing`의 도메인 분기를 다시 인라인하지 말 것.
- **Chart signal-assembly lazy boundary 유지**: community signal draft/evidence 조립에 필요한 `src/lib/chart/chartTradePlanner.ts`와 `src/lib/terminal/signalEvidence.ts`는 `src/components/arena/chart/chartActionRuntime.ts`에서 client action 시점에 동적 import한다. 이 둘을 다시 정적 import로 되돌리면 `chartPanelSupportRuntime` 서버 청크가 다시 커진다.
- **Chart price runtime canonical path**: priceStore 즉시 반영, WS price throttle, 24h stats 반영, fallback live price 계산, chart data reload 전 transient cleanup은 `src/components/arena/chart/chartPriceRuntime.ts`가 단일 진실원이다. `ChartPanel.svelte`에 `_priceUpdateTimer` 성격의 타이머 상태, fallback live price 계산, transient cleanup 분기를 다시 인라인하지 말 것.
- **Chart runtime bundle canonical path**: primary chart runtime 생성 순서(pattern/position/tradingview/data), interaction binding, primary cleanup ordering은 `src/components/arena/chart/chartRuntimeBundle.ts`가 단일 진실원이다. `ChartPanel.svelte`에 `onMount` 내부의 primary runtime 생성 순서와 `bindChartRuntimeInteractions` wiring, primary dispose 순서를 다시 인라인하지 말 것.
- **Chart drawing session canonical path**: hline/trendline/trade-preview draft 생성과 line-entry finalize는 `src/components/arena/chart/chartDrawingSession.ts`가 단일 진실원이다. `ChartPanel.svelte`에 drawing session branching을 다시 인라인하지 말 것.
- **Chart overlay renderer canonical path**: overlay canvas에서 pattern/agent setup/drawing/trade preview를 어떤 순서로 그릴지 결정하는 로직은 `src/components/arena/chart/chartOverlayRenderer.ts`가 단일 진실원이다. `ChartPanel.svelte`에는 canvas clear/render 분기와 ghost line 로직을 다시 흩뿌리지 말 것.
- **Chart position interaction canonical path**: TP/SL/ENTRY line hover target 판정, drag target 선택, mouse wheel step 계산은 `src/components/arena/chart/chartPositionInteraction.ts`가 단일 진실원이다. `ChartPanel.svelte` 안에 거리 계산/step heuristic을 다시 복제하지 말 것.
- **Chart runtime binding canonical path**: visible-range lazy-load trigger, crosshair RAF throttle, resize observer, keyboard hotkey wiring은 `src/components/arena/chart/chartRuntimeBindings.ts`가 단일 진실원이다. `ChartPanel.svelte`의 `onMount` 안에 이벤트 바인딩을 다시 인라인하면 cleanup 경로와 단축키 계약이 다시 분산된다.
- **Chart data runtime canonical path**: kline bootstrap, history pagination, Binance kline/miniTicker subscribe/unsubscribe는 `src/components/arena/chart/chartDataRuntime.ts`가 단일 진실원이다. `ChartPanel.svelte`에서 `fetchKlines`, `fetch24hr`, `subscribeKlines`, `subscribeMiniTicker`를 다시 직접 다루지 말 것.
- **Chart TradingView runtime canonical path**: TradingView safe-mode fallback, retry, timeout timer, pair/timeframe re-init debounce는 `src/components/arena/chart/chartTradingViewRuntime.ts`가 단일 진실원이다. `ChartPanel.svelte`에 `_tvInitTimer`, `_tvLoadTimer`, `tvWidget`, `reinitKey`를 다시 인라인하면 chart mode 전환과 cleanup 계약이 다시 분산된다.
- **Chart TradingView pane canonical path**: trading-mode 전용 iframe shell, loading/error/fallback UI, `#tradingview_widget` DOM ownership은 `src/components/arena/chart/ChartTradingViewPane.svelte`가 단일 진실원이다. `ChartPanel.svelte`에 TradingView mode 전용 마크업과 스타일을 다시 인라인하지 말 것.
- **Chart indicator strip canonical path**: agent advanced-mode indicator strip, visual mode toggle, indicator toggle chips, legend toggle/hide controls는 `src/components/arena/chart/ChartIndicatorStrip.svelte`가 단일 진실원이다. `ChartPanel.svelte`에 expanded/collapsed strip 마크업과 strip 전용 스타일을 다시 인라인하지 말 것.
- **Chart market-pulse badge canonical path**: indicator strip 안의 Heat Score / Macro Regime badge UI, pair-change refresh, compact/expanded detail surface는 `src/components/arena/chart/MarketPulseBadge.svelte`가 단일 진실원이다. `ChartIndicatorStrip.svelte`나 `ChartPanel.svelte`에 pulse badge 전용 마크업과 polling 상태를 다시 인라인하지 말 것.
- **Chart market-pulse lazy boundary 유지**: `src/components/arena/chart/ChartIndicatorStrip.svelte`는 strip이 실제 expanded 상태일 때만 `src/components/arena/chart/MarketPulseBadge.svelte`를 동적 import한다. badge를 strip 상단 정적 import로 되돌리거나 collapsed 상태에서도 미리 로드하면 agent advanced-mode 진입 비용이 다시 커진다.
- **Market pulse model canonical path**: pair normalization(`BTCUSDT` -> `BTC/USDT`)과 raw transport -> UI model 변환(heat score + macro regime 계산)은 `src/lib/market/marketPulseModel.ts`가 단일 진실원이다. 서버 route, client API, badge 컴포넌트에서 pair parse나 score 계산을 다시 중복하지 말 것.
- **Market pulse client API canonical path**: browser-side market pulse fetch, TTL cache, inflight dedupe는 `src/lib/api/marketPulse.ts`가 단일 진실원이다. `MarketPulseBadge.svelte`나 다른 chart child가 `/api/market/pulse`를 직접 호출해 중복 polling을 만들지 말 것.
- **Chart header bar canonical path**: pair summary, 24h stats, token switch, timeframe controls, mode toggle, draw toolbar, scan/publish CTA, collapsed MA meta는 `src/components/arena/chart/ChartHeaderBar.svelte`가 단일 진실원이다. 레이아웃/위치 회귀를 막기 위해 동일 DOM/class 구조를 유지하고, `ChartPanel.svelte`에 이 상단 바 마크업과 스타일을 다시 인라인하지 말 것.
- **Chart agent overlay chrome canonical path**: agent mode의 scale tools, indicator legend, loading/error badge, first-scan CTA, trade CTA bar, drawing notice, chart notice, position badge, drag indicator는 `src/components/arena/chart/ChartAgentOverlayChrome.svelte`가 단일 진실원이다. `ChartPanel.svelte`에는 canvas/trade-plan/annotation shell만 남기고, overlay chrome 마크업과 전용 absolute-position 스타일을 다시 인라인하지 말 것.
- **Chart trade-plan overlay canonical path**: trade planner overlay의 SIGNAL/ENTRY/TP/SL/RISK/R:R 표시, ratio track/preset UI, open/cancel CTA, 모바일 위치 보정 스타일은 `src/components/arena/chart/ChartTradePlanOverlay.svelte`가 단일 진실원이다. `ChartPanel.svelte`는 ratio drag wiring과 `pendingTradePlan` 상태만 보유하고, overlay 마크업/스타일을 다시 인라인하지 말 것. 레이아웃 회귀를 막기 위해 기존 class와 absolute positioning 계약을 유지할 것.
- **Chart annotation layer canonical path**: agent annotation marker, popup selection state, popup/card absolute-position 스타일은 `src/components/arena/chart/ChartAnnotationLayer.svelte`가 단일 진실원이다. `ChartPanel.svelte`에 annotation button/popup 마크업과 `.chart-annotation` 계열 스타일을 다시 인라인하지 말 것.
- **Chart drawing canvas canonical path**: drawing overlay canvas DOM element, `.drawing-canvas` class surface, drawing-active pointer-event 토글은 `src/components/arena/chart/ChartDrawingCanvas.svelte`가 단일 진실원이다. `ChartPanel.svelte`는 canvas ref handoff와 mouse event wiring만 보유하고, canvas 마크업/스타일을 다시 인라인하지 말 것. 레이아웃 회귀를 막기 위해 same-class/same-position 계약을 유지할 것.
- **Chart agent surface canonical path**: `.chart-container` DOM, hidden-chart 토글, chart mouse/wheel lifecycle 표면, overlay child들의 stacking order, container ref handoff는 `src/components/arena/chart/ChartAgentSurface.svelte`가 단일 진실원이다. `ChartPanel.svelte`에 chart-container 마크업과 관련 스타일을 다시 인라인하지 말 것. 레이아웃/위치 회귀를 막기 위해 동일 DOM 순서와 클래스 계약을 유지할 것.
- **Chart panel shell canonical path**: `.chart-wrapper` DOM, top-level header/indicator-strip/agent-surface/trading-pane composition, indicator strip lazy import, TradingView pane lazy import/effect는 `src/components/arena/chart/ChartPanelShell.svelte`가 단일 진실원이다. `ChartPanel.svelte`에는 이 presentation shell 마크업과 wrapper 스타일을 다시 인라인하지 말 것. 부모는 runtime state, callback wiring, onMount/bootstrap만 보유할 것.
- **Chart panel shell lazy boundary 유지**: `src/components/arena/ChartPanel.svelte`는 `src/components/arena/chart/ChartPanelShell.svelte`를 동적 import로 불러 presentation shell을 별도 청크로 분리한다. `ChartPanelShell.svelte`, `ChartHeaderBar.svelte`, `ChartAgentSurface.svelte`를 다시 `ChartPanel.svelte` 정적 import 체인으로 되돌리면 `ChartPanel.js` SSR chunk가 다시 커진다.
- **Chart shell child lazy boundaries 유지**: `src/components/arena/chart/ChartPanelShell.svelte`는 `src/components/arena/chart/ChartHeaderBar.svelte`와 `src/components/arena/chart/ChartAgentSurface.svelte`를 동적 import로 불러 shell chunk를 얇게 유지한다. header/surface를 다시 shell 상단 정적 import로 되돌리면 `ChartPanelShell.js` chunk가 다시 비대해진다.
- **Chart panel controller canonical path**: `onMount` bootstrap 호출, primary runtime bundle 장착, chart reload, chart mode 전환, TradingView retry/sync, intel-origin pattern scan, cleanup ordering은 `src/components/arena/chart/chartPanelController.ts`가 단일 진실원이다. `ChartPanel.svelte`에 mount orchestration, mode-switch sequencing, pattern-scan public handle, cleanup ordering 로직을 다시 길게 인라인하지 말 것.
- **Chart panel support-runtime canonical path**: overlay/viewport/trade-plan/drawing/action/price runtime의 생성 순서, 부모가 쓰는 wrapper command surface, support-runtime dispose ordering은 `src/components/arena/chart/chartPanelSupportRuntime.ts`가 단일 진실원이다. `ChartPanel.svelte`에서 개별 runtime 인스턴스를 다시 여럿 들고 `const foo = runtime?.foo()` 식 wrapper를 길게 복구하지 말 것.
- **Chart drawing-stack lazy boundary 유지**: primitive drawing manager와 persistence stack은 `src/components/arena/chart/chartDrawingRuntime.ts`에서 동적 import한다. 초기 mount는 `syncDrawingPersistence()`로 persistence만 먼저 확인하고, 현재 pair/timeframe에 저장된 drawing이 있거나 manager가 이미 활성화된 경우에만 `drawingManager`를 hydrate한다. `src/components/arena/chart/chartPanelSupportRuntime.ts`에서 create 직후 unconditional prewarm을 다시 넣지 말고, `drawingManager`/`drawingPersistence`를 support-runtime 정적 import로 끌어올리지 말 것.
- **Chart derivatives runtime canonical path**: OI/Funding/Liquidation pane lazy creation, Coinalyze fetch/sync, pane ref exposure, derivative indicator visibility 연계는 `src/components/arena/chart/chartDerivativesRuntime.ts`가 단일 진실원이다. `ChartPanel.svelte`에 derivatives pane 생성이나 fetch/sync loop를 다시 인라인하지 말 것.
- **Chart derivatives lazy boundary 유지**: `src/components/arena/ChartPanel.svelte`는 `src/components/arena/chart/chartDerivativesRuntime.ts`를 client runtime bootstrap 시점에 동적 import한다. derivatives runtime이나 Coinalyze fetch 계층을 다시 `ChartPanel.svelte` 정적 import로 끌어올리면 shell/runtime 분리 이득이 사라진다.
- **Chart panel contract canonical path**: ChartPanel public handle과 chart-origin request/signal detail 타입은 `src/lib/chart/chartPanelContracts.ts`가 단일 진실원이다. `src/lib/terminal/terminalTypes.ts`나 layout/runtime 파일에서 동일 handle 시그니처를 다시 독자 정의하지 말 것.
- **Chart panel view-model canonical path**: `ChartPanelShell.svelte`에 내려가는 표시 상태와 shell prop 계약은 `src/lib/chart/chartPanelViewModel.ts`가 단일 진실원이다. `ChartPanel.svelte` 안에서 `ChartPanelShell`에 대한 긴 prop list와 `ChartPanelShell.svelte` 안의 중복 prop 타입 정의를 다시 키우지 말 것.
- **Chart mount runtime canonical path**: lightweight-charts 동적 import, mount 시점 theme/bootstrap 준비, advanced-mode 초기 strip normalization, MA period binding 생성, primary runtime bundle 생성과 cleanup ordering은 `src/components/arena/chart/chartMountRuntime.ts`가 단일 진실원이다. `ChartPanel.svelte`의 `onMount` 안에 bootstrap/runtimes 생성 순서를 다시 길게 인라인하지 말 것.
- **ChartPanel client-only lazy runtime 유지**: `src/components/arena/ChartPanel.svelte`는 `chartMountRuntime`, `chartPanelController`, `chartPanelSupportRuntime`를 on-mount client lazy import로 불러 서버 청크를 줄인다. 이 세 모듈을 다시 정적 import로 되돌리면 `ChartPanel.js` SSR chunk가 크게 다시 불어난다.
- **Chart bootstrap canonical path**: lightweight-charts 인스턴스 생성, candlestick/MA/volume/RSI pane 구성은 `src/components/arena/chart/chartBootstrap.ts`가 단일 진실원이다. `ChartPanel.svelte`의 `onMount`에 pane/series 생성 코드를 다시 크게 인라인하지 말 것.
- **ChartPanel demo fallback 제거 상태 유지**: `src/components/arena/ChartPanel.svelte`의 dead `loadFallbackData()` path는 제거됐다. 캔들 mock/demo interval이 다시 필요하면 `ChartPanel.svelte`에 임시 interval을 되살리지 말고 별도 dev-only runtime 또는 story fixture로 분리할 것.
- **ChartPanel cleanup entrypoint 유지**: `src/components/arena/ChartPanel.svelte`의 teardown은 `chartPanelController.dispose()`와 그 내부 `chartPanelSupportRuntime` cleanup ordering을 단일 진입점으로 유지한다. `cleanup`, `chartDataRuntime.dispose()`, TradingView/runtime dispose를 `onDestroy`에서 다시 중복 호출하면 websocket unsubscribe와 chart removal이 이중 실행될 수 있다.
- **ChartPanel dual contract 유지**: `src/components/arena/ChartPanel.svelte`는 terminal shell을 위해 callback prop(`onScanRequest`, `onChatRequest`, `onCommunitySignal`, `onDrag*`)을 호출하면서, arena legacy route를 위해 `scanrequest/chatrequest/communitysignal/drag*` component events도 같이 dispatch한다. 둘 중 하나만 남기면 `/terminal` 또는 `/arena` 한쪽 타입 계약이 다시 깨진다.
- **CSP allowlist 변경 규칙**: 외부 font/embed/RPC/WebSocket/data source를 추가하면 `src/hooks.server.ts`의 `buildCsp()`를 같이 수정해야 한다. 현재 allowlist는 Google Fonts, TradingView iframe, Binance websocket을 기준으로 맞춰져 있다.
- **`arena/+page.svelte` runes 주의**: 이 라우트는 runes 모드다. top-level mutable UI state를 plain `let`로 남기면 warning budget이 즉시 폭증한다. 이 파일을 건드릴 때는 mutable 값은 `$state(...)`, side effect는 `$effect(...)`, 템플릿 DOM 이벤트는 `onclick` 계열로 유지할 것.
- **Arena selector canonical path**: topbar mode label, phase progress, mission copy, result overlay title, score summary, preview card, api sync status, battle HUD/log display, chart/mission/card view agent summaries는 `src/lib/arena/selectors/arenaViewModel.ts`가 단일 진실원이다. `arena/+page.svelte`에 동일 문자열 조립과 badge 계산, preview formatting, price/timer/status/log slice formatting을 다시 인라인하지 말 것.
- **Arena wallet gate는 retire 상태 유지**: arena route의 wallet gate overlay는 현재 비활성 dead path로 제거됐다. `arena/+page.svelte`에 `false && !walletOk` 형태의 hidden overlay와 wallet modal CTA를 다시 복구하지 말 것. 필요하면 먼저 access policy를 정의하고 별도 gate host/controller 경계를 설계할 것.
- **Arena chart bridge canonical path**: chart position visibility, entry/TP/SL/dir snapshot, active-agent marker/annotation decoration, hypothesis drag 후 RR 재계산은 `src/lib/arena/adapters/arenaChartBridge.ts`가 단일 진실원이다. `arena/+page.svelte`에 `showChartPosition`, `chartPos*`, `buildChartAnnotations`, `buildAgentMarkers`와 같은 chart bridge state/mutation을 다시 흩뿌리지 말 것.
- **Arena chart controller canonical path**: `ChartPanel` drag callback에서 hypothesis/chartBridge를 동기 갱신하고, chart marker/position line visibility toggle을 소유하는 브리지는 `src/lib/arena/controllers/arenaChartController.ts`가 단일 진실원이다. `arena/+page.svelte`에 `onDragTP()/onDragSL()/onDragEntry()` 반복 update 로직이나 marker/position visibility inline mutation을 다시 길게 복구하지 말 것.
- **Arena agent bridge canonical path**: arena route의 agent speech/state/energy/chat bridge와 `SYSTEM` chat author 정규화는 `src/lib/arena/controllers/arenaAgentBridge.ts`가 단일 진실원이다. `arena/+page.svelte`에 `setSpeech()/setAgentState()/setAgentEnergy()/addChatMsg()` local helper나 `SYSTEM` author cast를 다시 복구하지 말고, agent runtime과 battle presentation sync는 이 bridge를 통해서만 묶을 것.
- **Arena battle state bridge canonical path**: arena route의 `charSprites`, `battleTurns`, `battleNarration`, `battlePhaseLabel`, `vsMeter`, `enemyHP`, `combo/critical/VS splash` setter glue는 `src/lib/arena/controllers/arenaBattleStateBridge.ts`가 단일 진실원이다. `arena/+page.svelte`에서 battle presentation/result/battle controller wiring을 위해 같은 setter 람다 묶음을 다시 반복 생성하지 말 것.
- **Arena page state bridge canonical path**: arena route의 `serverMatchId/serverAnalysis/apiError`, `chartBridge`, `confirmingExit`, `matchHistoryOpen`, `result/preview/pvp/hypothesis` visibility, `floatDir`, `hypothesisTimer` state bridge는 `src/lib/arena/controllers/arenaPageStateBridge.ts`가 단일 진실원이다. `arena/+page.svelte`에서 shell/match/phase/chart controller마다 page-state setter/getter 람다를 다시 흩뿌리지 말고 이 bridge를 통해 공유할 것.
- **Arena game-state bridge canonical path**: arena route의 `gameState` 기반 mutation(`squadConfig`, `arenaView`, result progression, hypothesis/pos sync, battle bootstrap/tick/result)은 `src/lib/arena/controllers/arenaGameStateBridge.ts`가 단일 진실원이다. `arena/+page.svelte`에서 `gameState.update(...)` 람다를 다시 controller wiring 곳곳에 복구하지 말고, 특히 hypothesis 변경 시 `pos`를 별도로 놓치지 않도록 이 bridge를 통해서만 갱신할 것.
- **Arena UI-state bridge canonical path**: arena route의 route-local UI shell state(`rewardState`, `resultData`, `floatingWords`, `arenaParticles`, `showMarkers`)는 `src/lib/arena/controllers/arenaUiStateBridge.ts`가 단일 진실원이다. `arena/+page.svelte`에서 visual-effects runtime/result controller/chart controller wiring마다 같은 local setter 람다를 다시 반복하지 말고, reward reset과 marker toggle도 이 bridge를 통해 공유할 것.
- **Arena phase-effects runtime canonical path**: `DRAFT/ANALYSIS/HYPOTHESIS/PREVIEW/BATTLE` 진입 시점의 audio, feed, speech, reset choreography는 `src/lib/arena/controllers/arenaPhaseEffectsRuntime.ts`가 단일 진실원이다. `arena/+page.svelte`에 `safeTimeout()` 기반 deploy/review/battle speech loop, live-event start, preview confirm feed, draft reset effect를 다시 길게 인라인하지 말 것.
- **Arena phase runtime bundle canonical path**: `battlePresentationRuntime`, `analysisPresentationRuntime`, `phaseEffectsRuntime`, `phaseController`, `battleController`의 조립 순서와 clear/destroy 경계는 `src/lib/arena/controllers/arenaPhaseRuntimeBundle.ts`가 단일 진실원이다. `arena/+page.svelte`에서 이 다섯 계층을 다시 직접 생성하거나 `bindPresentationSync()/runScoutSequence()/initBattle()/onPhaseInit()` wiring을 route에 길게 복구하지 말 것.
- **Arena route lifecycle canonical path**: scene lazy import warmup, `setPhaseInitCallback()` mount, `keydown` listener mount/destroy는 `src/lib/arena/controllers/arenaRouteLifecycle.ts`가 단일 진실원이다. `arena/+page.svelte`에 `ensureArenaMatchSceneComponent()`/route-level lazy import effect와 phase-init/key listener lifecycle을 다시 길게 복구하지 말 것.
- **Arena topbar canonical path**: arena 상단 shell의 lobby/exit-confirm CTA, phase track, mode badge, LP/W-L stat strip, match-history toggle 마크업과 responsive topbar CSS는 `src/components/arena/ArenaTopbar.svelte`가 단일 진실원이다. `arena/+page.svelte`에 topbar DOM/CSS를 다시 되돌리지 말고, 상단 shell 수정은 이 컴포넌트 안에서만 처리할 것.
- **Arena optional panel lazy policy 유지**: `MatchHistory.svelte`의 optional lazy loading은 `src/components/arena/ArenaMatchScene.svelte`, alt-view 3종(`ChartWarView.svelte`, `MissionControlView.svelte`, `CardDuelView.svelte`)과 alt-view 전용 `ResultPanel.svelte`의 optional lazy loading은 `src/components/arena/ArenaAltViewHost.svelte`가 소유한다. 이 optional surface들을 다시 `arena/+page.svelte` top-level 정적 import나 route-level effect로 되돌리면 scene shell ownership이 깨지고 `arena/_page.svelte.js` 크기가 빠르게 다시 불어난다.
- **Arena battle layout canonical path**: battle 단계의 상위 배치는 `src/components/arena/ArenaBattleLayout.svelte`가 소유하고, 좌측 chart rail은 `src/components/arena/ArenaChartRail.svelte`, 우측 battle sidebar는 `src/components/arena/ArenaBattleSidebar.svelte`가 단일 진실원이다. host 계약은 `src/components/arena/arenaBattleLayoutTypes.ts`의 `ArenaChartRailProps` / `ArenaBattleSidebarProps` bundle을 사용해 전달하고, `arena/+page.svelte`에서 긴 presentation prop 목록을 다시 직접 펼치지 않는다. chart rail 내부의 가설 sheet/dir float는 `src/components/arena/ArenaHypothesisOverlay.svelte`, preview는 `src/components/arena/ArenaPreviewOverlay.svelte`, score/status bar는 `src/components/arena/ArenaChartScoreBar.svelte`가 소유한다. battle sidebar 내부의 mission/HUD/log는 `src/components/arena/ArenaBattleMissionBar.svelte`, `src/components/arena/ArenaBattleCombatHud.svelte`, `src/components/arena/ArenaBattleNarrationLog.svelte`가 소유하고, 전투 stage surface는 `src/components/arena/ArenaBattleStageSurface.svelte`가 host로 남되 내부 particle/connectors는 `src/components/arena/ArenaBattleParticleField.svelte`, center node는 `src/components/arena/ArenaBattleCenterNode.svelte`, agent sprite presentation은 `src/components/arena/ArenaBattleAgentSprite.svelte`, overlay FX는 `src/components/arena/ArenaBattleStageFx.svelte`가 소유한다. 결과 overlay는 `src/components/arena/ArenaBattleOutcomeOverlay.svelte`가 소유한다. `arena/+page.svelte`나 상위 host에 전투 레이아웃 DOM/CSS를 다시 되돌리지 말고, 해당 child boundary 안에서만 조정할 것.
- **Arena battle sidebar lazy boundary 유지**: `src/components/arena/ArenaBattleSidebar.svelte`는 무거운 presentation 조각인 `src/components/arena/ArenaBattleStageSurface.svelte`와 `src/components/arena/ArenaBattleOutcomeOverlay.svelte`를 동적 import로 불러 `arena/_page.svelte.js` SSR entry를 낮춘다. 이 두 child를 다시 sidebar 상단 정적 import 체인으로 되돌리면 arena route entry가 빠르게 다시 불어난다.
- **Arena scene shell canonical path**: lobby/draft 이후의 scene shell은 `src/components/arena/ArenaMatchScene.svelte`가 소유한다. topbar, API sync badge, phase guide, view picker, alt-view/result-panel lazy import, result-panel overlay, battle layout switching은 이 컴포넌트 안에서만 조립하고, `arena/+page.svelte`는 phase/server/controller state와 bundle prop만 소유한다. scene shell wiring이 필요하면 route에 새 마크업/CSS나 lazy-loader state를 되돌리지 말고 `ArenaMatchScene.svelte` 또는 `arenaBattleLayoutTypes.ts` 계층에서 해결할 것.
- **Arena scene host lazy policy 유지**: `src/routes/arena/+page.svelte`는 기본 `gameState` bootstrap이 항상 `inLobby=true`, `phase='DRAFT'`로 시작하는 현재 계약을 전제로 `ArenaMatchScene.svelte`를 동적 import로 늦게 불러 SSR entry를 낮춘다. 이 route에 `ArenaMatchScene` 정적 import를 다시 복구하면 `arena/_page.svelte.js`가 빠르게 비대해진다. 만약 서버 초기 렌더에서 active match를 바로 그려야 하는 계약으로 바뀌면, 그때 lazy policy를 다시 설계할 것.
- **Arena alt-view host canonical path**: alt-view 3종(`chart/mission/card`) lazy import와 alt-view 전용 result overlay는 `src/components/arena/ArenaAltViewHost.svelte`가 단일 진실원이다. `ArenaMatchScene.svelte`는 host 선택만 하고, `arena/+page.svelte`는 host 내부 lazy-loader state나 overlay markup/CSS를 다시 소유하지 않는다.
- **Arena scene contract canonical path**: `ArenaMatchScene`에 들어가는 scene bundle prop 타입은 `src/components/arena/arenaMatchSceneTypes.ts`, route-side typed wrapper는 `src/lib/arena/selectors/arenaSceneProps.ts`가 단일 진실원이다. `arena/+page.svelte`에 `Record<string, unknown>` 형태의 ad-hoc scene/result/chart/layout prop bundle을 다시 만들지 말고, scene shell 계약을 바꿀 때는 이 두 파일부터 수정할 것.
- **Arena battle feed runtime canonical path**: battle/system/event feed payload 정규화, 현재 phase stamp, `SYSTEM` feed emission, `battleFeedStore` write surface는 `src/lib/arena/feed/arenaBattleFeedRuntime.ts`가 단일 진실원이다. `arena/+page.svelte`에 `pushFeedItem()` payload shape나 `SYSTEM` feed payload를 다시 직접 조립하지 말 것.
- **Arena live-event runtime canonical path**: phase별 live event cadence, interval lifecycle, event feed emission은 `src/lib/arena/feed/arenaLiveEventRuntime.ts`가 단일 진실원이다. `arena/+page.svelte`에 `pickLiveEvent()/getEventCadence()` timer loop를 다시 인라인하지 말 것. 현재 live event UI card state는 사용되지 않으므로 dead `liveEvents` 배열을 route에 다시 복구하지 말 것.
- **Arena timer registry canonical path**: fire-and-forget timeout 등록/guard/cleanup과 safe timeout ownership은 `src/lib/arena/state/arenaTimerRegistry.ts`가 단일 진실원이다. `arena/+page.svelte`에 `_pendingTimers` Set, raw timeout bookkeeping, unmount 이후 callback guard를 다시 인라인하지 말 것.
- **Arena phase timer runtime canonical path**: hypothesis countdown interval, preview auto-confirm timeout, PvP reveal timeout의 hidden handle ownership과 clear/destroy sequencing은 `src/lib/arena/state/arenaPhaseTimerRuntime.ts`가 단일 진실원이다. `arena/+page.svelte`에 `hypothesisInterval`, `previewAutoTimer`, `pvpShowTimer`와 clear wrapper를 다시 route-local state로 되돌리지 말 것.
- **Arena visual effects runtime canonical path**: arena particle seed와 DOGE floating word burst는 `src/lib/arena/state/arenaVisualEffectsRuntime.ts`가 단일 진실원이다. `arena/+page.svelte`에 `seedArenaParticles()`/`dogeFloat()` 같은 랜덤 이펙트 조립을 다시 길게 인라인하지 말 것.
- **Arena reward runtime canonical path**: result 단계의 XP gain, streak reward, badge labeling은 `src/lib/arena/reward/arenaRewardRuntime.ts`가 단일 진실원이다. `arena/+page.svelte`에 `winBonus/scoreBonus/streakBonus/consensusBonus` 계산과 reward badge ternary를 다시 인라인하지 말 것.
- **Arena battle presentation runtime canonical path**: character sprite init/state sync, action emoji/hit popup, turn sequence, VS splash, battle narration/chat HUD orchestration은 `src/lib/arena/battle/arenaBattlePresentationRuntime.ts`가 단일 진실원이다. `arena/+page.svelte`에 `initCharSprites()/setCharState()/moveChar()/startBattleTurnSequence()` 같은 timer-heavy character presentation 로직을 다시 되돌리지 말 것.
- **Arena battle resolver runtime canonical path**: live battle tick에 대한 agent reaction, VS meter/HP 반영, timeout/tp/sl 결과 feed 정규화는 `src/lib/arena/battle/arenaBattleResolverRuntime.ts`가 단일 진실원이다. `arena/+page.svelte` subscribe 블록에 `pnlPercent/distToTP/distToSL` 분기와 result feed ternary를 다시 인라인하지 말 것.
- **Arena analysis presentation runtime canonical path**: scout/gather/council stage의 findings reveal, source narration, council voteDir 반영, analysis chat/feed 타이밍 orchestration은 `src/lib/arena/controllers/arenaAnalysisPresentationRuntime.ts`가 단일 진실원이다. `arena/+page.svelte`에 `initScout()/initGather()/initCouncil()`의 중첩 `safeTimeout()` choreography를 다시 길게 복구하지 말 것.
- **Arena agent runtime canonical path**: active agent state init, typing speech timer, arena chat append, battle sprite sync 전의 base UI state mutation은 `src/lib/arena/controllers/arenaAgentRuntime.ts`가 단일 진실원이다. `arena/+page.svelte`에 `speechTimers`, `appendBattleChatMessage()`, `initAgentStates()` 같은 agent/chat state 조작을 다시 길게 복구하지 말 것.
- **Arena battle controller canonical path**: battle phase entry, fallback position normalization, resolver bootstrap/subscribe/cleanup, resolved battle result advance는 `src/lib/arena/controllers/arenaBattleController.ts`가 단일 진실원이다. `arena/+page.svelte`에 `createBattleResolver()`/`subscribe()`/`battleExitTime` wiring과 lobby 이탈 시 cleanup 분기를 다시 길게 인라인하지 말 것.
- **Arena result runtime canonical path**: result 단계의 win/tag 판정, consensus/LP/FBS 계산, result data/reward state/history payload/PnL summary 조립과 wallet/agent/history/server resolve persistence orchestration은 `src/lib/arena/result/arenaResultRuntime.ts`가 단일 진실원이다. `arena/+page.svelte`에 `initResult()` 안의 score-vs-tag 분기, `addMatchRecord()` payload 조립, `addPnLEntry()` summary 문자열, `resolveArenaMatch()` fire-and-forget를 다시 길게 인라인하지 말 것.
- **Arena match controller canonical path**: squad deploy 시 `squadConfig` 적용, battle feed system message, server match 생성, equal-weight draft payload 조립, server sync reset은 `src/lib/arena/controllers/arenaMatchController.ts`가 단일 진실원이다. `arena/+page.svelte`에 `createArenaMatch()/submitArenaDraft()/normalizeAgentId()` 기반 deploy flow를 다시 길게 인라인하지 말 것.
- **Arena result controller canonical path**: result phase entry에서 live-event clear, battle turn cleanup, resolved result projection, persistence orchestration, PvP reveal timer, stable `opponentScore` projection, reward modal close는 `src/lib/arena/controllers/arenaResultController.ts`가 단일 진실원이다. `arena/+page.svelte`에 `buildArenaResolvedResult()/applyArenaResultPersistence()/runArenaResultPresentation()` 조합, `Math.random()` 기반 opponent score, reward modal close inline mutation을 다시 길게 인라인하지 말 것.
- **Arena shell controller canonical path**: lobby 이동, play-again reset, exit confirm, ESC/1-4 keyboard shortcut, match-history open/close, view-picker select, hypothesis float-dir selection을 포함한 shell-level reset branching은 `src/lib/arena/controllers/arenaShellController.ts`가 단일 진실원이다. `arena/+page.svelte`에 `goLobby()/playAgain()/confirmGoLobby()/handleKeydown()`와 shell toggle/store mutation을 다시 route에 되돌리지 말 것.
- **Arena phase controller canonical path**: `DRAFT`/`ANALYSIS`/`HYPOTHESIS`/`BATTLE`/`RESULT` phase entry, phase dispatch, analysis sync kickoff, submitted hypothesis apply, hypothesis countdown timeout fallback, preview auto-confirm은 `src/lib/arena/controllers/arenaPhaseController.ts`가 단일 진실원이다. `arena/+page.svelte`에 `initDraft()/initAnalysis()/initHypothesis()/confirmPreview()/onPhaseInit()`의 timer/server-sync/game-state 분기를 다시 크게 복구하지 말 것.
- **Arena compare/verdict overlay는 retire 상태 유지**: 현재 arena core loop는 `DRAFT -> ANALYSIS -> HYPOTHESIS -> BATTLE -> RESULT` 5단계다. `compare`/`verdict` overlay는 더 이상 phase 진입점이 없으므로 `arena/+page.svelte`에 hidden state, timer, markup, CSS를 다시 되살리지 말 것. 필요 시에는 먼저 phase 모델과 UX spec을 확장하고 별도 overlay host/controller 경계를 설계할 것.
- **Arena replay route integration은 retire 상태 유지**: 현재 arena route에는 replay 시작 액션과 banner 진입점이 없다. dead replay state/timer/UI를 `arena/+page.svelte`에 다시 복구하지 말 것. replay를 다시 도입하려면 먼저 `MatchHistory` 또는 별도 history shell에서 explicit replay action을 설계하고, 그 다음 dedicated replay controller/host로 재도입할 것.
- **Arena dead battle shell state는 복구하지 말 것**: `findings`, `councilActive`, `enemyMomentum`은 현재 arena route/template 계약에서 사용되지 않는다. `arena/+page.svelte`, `arenaAnalysisPresentationRuntime`, `arenaBattlePresentationRuntime`, `arenaShellController`에 이 값을 다시 되살리기 전에 실제 렌더 소비처와 UX 목적을 먼저 정의할 것.

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

### Refactor Execution Phase
- [x] RF-01: State authority 정리 (`priceStore` canonical, `gameState` live-price 미러링 제거)
- [x] RF-02: Domain integrity 정리 (`profileProjection`, tracked-signal reconcile, `dbStore` 제거)
- [x] RF-03: CopyTrade canonical publish + backend idempotency (`clientMutationId`, migration 0007/014)
- [x] RF-04: Terminal shell extraction (`TerminalDesktopLayout`, `TerminalTabletLayout`, `TerminalMobileLayout`, `terminalShell.css`)
- [x] RF-05: terminal view-model extraction (`terminalViewModel`, `intelViewModel`)
- [ ] RF-06: `ChartPanel.svelte` core/overlay/pattern/service split
- [x] RF-07: strict CSP / embed allowlist hardening

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
- [x] QW-05: warnings 49→0 단계적 감축 완료 (`npm run check`: `0 errors / 0 warnings`)

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
