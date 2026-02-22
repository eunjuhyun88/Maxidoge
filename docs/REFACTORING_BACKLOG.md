# MAXI⚡DOGE v3 Refactoring Backlog

Created: 2026-02-22
Rule: Contract -> BE -> FE, never mixed in one PR

---

## Track 0: Shared (Contract / Core)

> FE/BE 둘 다 이 계약만 참조. 변경 시 항상 먼저.

### S-1. Agent/Spec/Phase 계약 확정 ✅ DONE
- `src/lib/engine/types.ts` — AgentId(8), MatchPhase(5), Tier, DraftSelection, AgentOutput, MatchState, MatchResult, Passport 등 30+ 타입
- `src/lib/engine/agents.ts` — AGENT_POOL: 8 Agent 정의 (STRUCTURE/VPA/ICT/DERIV/VALUATION/FLOW/SENTI/MACRO)
- `src/lib/engine/specs.ts` — SPEC_REGISTRY: 32 Spec (8 Agent x 4 Tier)
- `src/lib/engine/constants.ts` — LP_REWARDS, TIER_TABLE, getTierForLP(), DRAFT_AGENT_COUNT=3, DRAFT_TOTAL_WEIGHT=100

### S-2. API Response DTO 정의 ⬜ TODO
- `src/lib/engine/dto.ts` (new)
- Arena Match API 요청/응답 타입:
  - `CreateMatchRequest` / `CreateMatchResponse`
  - `SubmitDraftRequest` (DraftSelection[]) / `SubmitDraftResponse`
  - `AnalyzeResponse` (AgentOutput[])
  - `SubmitHypothesisRequest` (MatchPrediction) / `SubmitHypothesisResponse`
  - `MatchResultResponse` (MatchResult + LP delta)
- Live Session API 타입
- Market Snapshot API 타입
- **branch**: `codex/contract-dto`

### S-3. progressionRules.ts ↔ constants.ts 정렬 ⬜ TODO
- 현재 `progressionRules.ts`의 `resolveLifecyclePhase()` 임계값(LP 2200, matches 200)이 `constants.ts`의 `TIER_TABLE`(BRONZE 0~199, MASTER 2200+)과 분리 운용
- **방향**: `resolveLifecyclePhase()`가 `getTierForLP()`를 내부 호출하도록 통합, 또는 TIER_TABLE 기반으로 재정의
- walletStore의 `phase: number` → `tier: Tier` 타입 전환 검토
- **branch**: `codex/contract-progression`

---

## Track 1: BE (Backend)

> src/routes/api/**, src/lib/services/**, src/lib/engine/** (순수 계산)
> FE 파일 일절 안 건드림. 완료 기준: API 테스트 통과.

### BE-1. Arena Match API Scaffold ⬜ TODO
- `src/routes/api/arena/match/create/+server.ts` — POST
- `src/routes/api/arena/match/[id]/draft/+server.ts` — POST
- `src/routes/api/arena/match/[id]/analyze/+server.ts` — POST
- `src/routes/api/arena/match/[id]/hypothesis/+server.ts` — POST
- `src/routes/api/arena/match/[id]/result/+server.ts` — GET
- 기존 `/api/matches` → 내부 어댑터로 하위 호환
- DB: `arena_matches`, `arena_drafts`, `agent_analysis_results` 테이블 활용 (004 migration)
- **depends**: S-2
- **branch**: `codex/be-arena-api`

### BE-2. Indicator Engine (순수 함수) ⬜ TODO
- `src/lib/engine/indicators.ts` (new) — RSI, SMA, EMA, ATR, OBV, MACD, CVD, BollingerBands
- `src/lib/engine/trend.ts` (new) — analyzeTrend(), detectDivergence(), analyzeMultiTF()
- warroomScan.ts의 인라인 RSI/SMA/ATR을 이 모듈 호출로 교체
- 테스트: 순수 함수이므로 유닛 테스트 가능
- **branch**: `codex/be-indicators`

### BE-3. Scan Service ⬜ TODO
- `src/lib/services/scanService.ts` (new) — runScan(pair, timeframe)
- indicators.ts + 외부 API(binance/coinalyze) 조합
- warroomScan.ts를 이 서비스의 thin wrapper로 전환
- **depends**: BE-2
- **branch**: `codex/be-scan-service`

### BE-4. Agent Pipeline ⬜ TODO
- `src/lib/engine/agentPipeline.ts` (new) — runAgent(), computeFinalPrediction()
- `src/lib/engine/agents/` 디렉토리 (8 모듈):
  - `structure.ts`, `vpa.ts`, `ict.ts`, `deriv.ts`, `valuation.ts`, `flow.ts`, `senti.ts`, `macro.ts`
  - 각각 `computeFactors(marketData) → ScoringFactor[]`
- `src/lib/engine/exitOptimizer.ts` (new) — ATR 기반 SL/TP, conservative/balanced/aggressive
- Spec의 factorWeights에 따라 가중합산은 agentPipeline이 담당
- **depends**: BE-2, BE-3
- **branch**: `codex/be-agent-pipeline`

### BE-5. Price Service (서버 사이드) ⬜ TODO
- `src/lib/services/priceService.ts` (new) — 단일 miniTicker WS 관리
- `livePrice` writable store (SSR 호환)
- 재연결 로직, 에러 복구
- **branch**: `codex/be-price-service`

### BE-6. Data Collection + Proxy API ⬜ TODO
- `src/routes/api/market/snapshot/+server.ts` (new) — cron: 외부 API → indicator_series UPSERT
- `src/routes/api/feargreed/+server.ts` (new) — proxy
- `src/routes/api/coingecko/global/+server.ts` (new) — proxy
- `src/routes/api/yahoo/[symbol]/+server.ts` (new) — proxy
- 외부 API 클라이언트 확장:
  - `src/lib/api/binanceFutures.ts` — OI/FR/Liq/LS (coinalyze 대안)
  - `src/lib/api/yahooFinance.ts` — DXY, S&P500, US10Y
  - `src/lib/api/cryptoquant.ts` — MVRV, NUPL, Exchange Flows
- rate limiter + 캐시 레이어
- **branch**: `codex/be-data-collection`

### BE-7. LP/Tier/Accuracy 서버 반영 ⬜ TODO
- Match 완료 시 서버에서 LP 계산 + DB 기록
- `agent_accuracy_stats` 테이블 갱신
- `user_agent_progress` 테이블 → Spec 해금 체크
- **depends**: BE-1, BE-4
- **branch**: `codex/be-progression`

### BE-8. RAG Memory ⬜ TODO
- `src/lib/engine/memory.ts` (new) — storeMemory(), retrieveMemories(), augmentWithMemories()
- pgvector cosine search (match_memories 테이블)
- 임베딩: 수치 정규화 벡터 (50-100d) 또는 text-embedding-3-small
- agentPipeline 연동: runAgent() 내 retrieveMemories() 호출
- **depends**: BE-4
- **branch**: `codex/be-rag-memory`

### BE-9. Live Session API ⬜ TODO
- `src/routes/api/live/sessions/+server.ts` — GET/POST
- `src/routes/api/live/sessions/[id]/+server.ts` — GET
- 관전자 WebSocket 또는 SSE
- **depends**: BE-1
- **branch**: `codex/be-live-api`

---

## Track 2: FE (Frontend)

> src/components/**, src/routes/**/+page.svelte, src/lib/stores/**
> BE 파일 안 건드림. 완료 기준: svelte-check 0 errors + 화면 정상.

### FE-1. AGDEFS Bridge (7→8 Agent) ⬜ TODO
- `src/lib/data/agents.ts` 재작성:
  - AGDEFS를 AGENT_POOL에서 파생 (getAllAgents() → AgentDef[] 변환)
  - guardian/commander/scanner 제거, VPA/ICT/VALUATION/MACRO 추가
  - AgentDef interface 유지 (16개 파일 import 경로 불변)
  - CHARACTER_ART, SOURCES는 그대로 유지
- `agentData.ts` — createDefaultStats()를 8 Agent 기반으로
- `scoring.ts` — AgentDef type → AgentId
- **영향 파일 (import 경로 변경 없음)**:
  - arena/+page, BattleStage, Lobby, SquadConfig, BottomBar, LivePanel,
  - OracleModal, PassportModal, BottomPanel, TerminalChat,
  - +page(home), terminal/+page, passport/+page, signals/+page
- **branch**: `codex/fe-agent-bridge`

### FE-2. Progression Store 통합 ⬜ TODO
- `src/lib/stores/progressionStore.ts` (new) — Single Source of Truth
  - LP, totalMatches, wins/losses, streak, agentMatchCounts
  - Derived: currentTier (getTierForLP), unlockedSpecs (getUnlockedSpecs)
  - Action: recordMatchResult(won, lpDelta, agentIds[])
- `walletStore.ts` — phase 계산 → progressionStore 위임
- `userProfileStore.ts` — tier 계산 → progressionStore.currentTier 구독
- `agentData.ts` — level/xp → agentMatchCounts 기반 재계산
- **depends**: S-3 (progression 계약 정렬)
- **branch**: `codex/fe-progression-store`

### FE-3. Price Display 단일 구독 ⬜ TODO
- Header.svelte — 자체 WS 제거 → priceService.livePrice 구독
- ChartPanel.svelte — miniTicker 제거 → livePrice 구독 (klines WS는 차트 전용 유지)
- terminal/+page.svelte — interval sync 제거 → livePrice 구독
- gameState.ts — updatePrices() 랜덤 지터 제거 또는 priceService 연동
- **depends**: BE-5 (priceService 존재)
- **branch**: `codex/fe-price-display`

### FE-4. Draft UI v3 ⬜ TODO
- `Lobby.svelte` 재작성:
  - 8 Agent를 OFFENSE/DEFENSE/CONTEXT 그룹으로 표시
  - 3개까지 토글 선택
  - 가중치 슬라이더 (총합 100%)
  - 해금된 Spec 표시 (progressionStore → getUnlockedSpecs)
- `SquadConfig.svelte` 교체:
  - 기존 riskLevel/timeframe → v3 DraftSelection 타입
  - `{ agentId, specId, weight }[]` 배열 전달
- `arena/+page.svelte` DRAFT 분기:
  - 새 Lobby/SquadConfig 사용
  - 선택 3 Agent + Spec + 가중치 → gameState 저장
  - ANALYSIS 진입 시 agentPipeline 호출 (또는 API 호출)
- **depends**: FE-1, FE-2
- **branch**: `codex/fe-draft-ui`

### FE-5. Arena Phase UI 개선 ⬜ TODO
- ANALYSIS phase: 에이전트 출력 표시 (direction + confidence + thesis), factor 기여도 시각화
- HYPOTHESIS phase: 가중합산 결과 + 유저 override + Exit Optimizer 조합 표시
- BATTLE phase: 실시간 PnL, 에이전트별 적중 여부
- RESULT phase: LP 보상 + 에이전트별 적중률 + Spec 해금 알림
- **depends**: FE-4, BE-4 (에이전트 출력 사용)
- **branch**: `codex/fe-arena-phases`

### FE-6. WarRoom UI 분해 ⬜ TODO
- WarRoom.svelte (현재 1142줄) → 800줄 이하로 축소
- 인라인 RSI/SMA/ATR 삭제 → scanService.runScan() 또는 BE indicator 호출
- UI 렌더링만 담당
- **depends**: BE-3 (scanService)
- **branch**: `codex/fe-warroom-slim`

### FE-7. Arena 구형 참조 최종 정리 ⬜ TODO
- arena/+page.svelte — AGDEFS import → 점진적 AGENT_POOL 직접 참조 전환
- BattleStage.svelte — 동일
- initCooldown(), initPreview(), initCompare() 등 잔존 구형 UI 블록 제거 여부 확정
- **depends**: FE-1, FE-4
- **branch**: `codex/fe-arena-cleanup`

---

## Execution Order (Critical Path)

```
S-2 (DTO)  ──────────────────────────> BE-1 (Arena API) ──> BE-7 (LP Server)
  │                                       │
S-3 (Progression 정렬) ──> FE-2 (Store)   │
                                          │
                       BE-2 (Indicators) ──> BE-3 (Scan) ──> BE-4 (Pipeline) ──> BE-8 (RAG)
                                                                │
FE-1 (AGDEFS Bridge) ──> FE-4 (Draft UI) ──> FE-5 (Phase UI) ──> FE-7 (Cleanup)
                            │
                       FE-2 (Progression)
                            │
BE-5 (Price Service) ──> FE-3 (Price Display)

BE-6 (Data Collection) ─── 독립, 언제든
BE-9 (Live API) ─── BE-1 이후
FE-6 (WarRoom) ─── BE-3 이후
```

### 추천 실행 순서

**Week 1: 계약 + 기반**
1. S-2 (DTO 정의)
2. S-3 (Progression 정렬)
3. FE-1 (AGDEFS Bridge) — UI 즉시 효과, 독립적
4. BE-2 (Indicators) — 순수 함수, 독립적

**Week 2: BE 핵심**
5. BE-1 (Arena Match API)
6. BE-3 (Scan Service)
7. BE-5 (Price Service)

**Week 3: FE 핵심**
8. FE-2 (Progression Store)
9. FE-3 (Price Display)
10. FE-4 (Draft UI v3)

**Week 4: 파이프라인 + UI**
11. BE-4 (Agent Pipeline)
12. FE-5 (Arena Phase UI)
13. FE-6 (WarRoom Slim)

**Week 5+: 확장**
14. BE-6 (Data Collection)
15. BE-7 (LP Server)
16. BE-8 (RAG Memory)
17. BE-9 (Live API)
18. FE-7 (Arena Cleanup)

---

## 이미 반영된 것 ✅

| 항목 | 파일 | 상태 |
|------|------|------|
| 5-Phase 코어 | gameState.ts, phases.ts, gameLoop.ts | ✅ |
| v3 타입 30+ | engine/types.ts | ✅ |
| 8 Agent Pool | engine/agents.ts | ✅ |
| 32 Spec | engine/specs.ts | ✅ |
| LP/Tier 상수 | engine/constants.ts | ✅ |
| DB Migration | 004_agent_engine_v3.sql | ✅ |
| Oracle v3 (AGENT_POOL, Wilson) | oracle/+page.svelte | ✅ |
| WarRoom 스캔 1차 분리 | engine/warroomScan.ts | ✅ |
| 진행 규칙 공통 함수 | stores/progressionRules.ts | ✅ |
| Arena guardian→macro | arena/+page.svelte | ✅ |
| warroom.ts guardian→macro | data/warroom.ts | ✅ |

---

## Rules

1. **한 PR에 FE+BE 파일 섞지 않기**
2. **계약 변경은 Shared 먼저 → BE → FE**
3. **각 트랙 완료마다 `vite build` + `svelte-check` 통과**
4. **브랜치 네이밍**: `codex/contract-*`, `codex/be-*`, `codex/fe-*`
5. **수정 시작 전 현재 상태 auto-commit**
