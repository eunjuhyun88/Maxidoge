# STOCKCLAW — LLM Agent Scan Engine 설계서
# 현재 룰 엔진(B-02) → LLM 기반 다중 에이전트(C-02)로의 전환

> **근거 논문:**
> 1. "Generative AI for Stock Selection" (Rasekhschaffe, 2025) — LLM+RAG로 트레이딩 신호 생성, Sharpe 14~91% 개선
> 2. "Expert Investment Teams" (Miyazaki et al., 2025) — Fine-grained task decomposition, 7-agent hierarchy, Sharpe 유의미 개선
>
> **핵심 교훈:**
> - **Fine-grained > Coarse-grained**: "차트 분석해줘"가 아니라 "RSI 14 = 72, SMA20 위, 볼밴 상단 근접. 이 조합의 모멘텀 지속 확률은?" 처럼 구체적 태스크로 분해
> - **RAG 품질이 결정적**: 지식 베이스가 손상되면 Sharpe -0.109, 정확하면 1.27 (p<0.001)
> - **Analyst-Manager 계층 구조**: 개별 분석 → 종합 → 최종 판정의 bottom-up 흐름

---

## 0. 문제 정의

### 현재 (B-02 scanEngine.ts)
```
15개 API → 8개 if-else 스코어링 함수 → scoreToVote() → 다수결 consensus
```

**한계:**
1. **고정 가중치**: `if (funding > 0.0006) derivScore -= 0.2` — 시장 레짐에 관계없이 동일
2. **맥락 무시**: RSI 72가 트렌딩 상승장에선 정상, 레인지에선 과매수 → 구분 못함
3. **비선형 조합 불가**: "펀딩비 + 고래 유출 + RSI 다이버전스" 3개가 동시에 발생하는 복합 상황 인식 불가
4. **학습 없음**: 승패 피드백이 스캔 엔진에 반영되지 않음
5. **해석 불가**: 왜 LONG인지 설명 없이 점수만 있음

### 목표 (C-02)
```
같은 15개 API 데이터 → LLM 에이전트가 Fine-grained 분석 → 해석 가능한 근거 생성
→ RAG로 과거 유사 패턴 참조 → ORPO 학습으로 지속 개선
```

---

## 1. 아키텍처 개요

```
                     ┌─────────────────────────────────────┐
                     │         DATA LAYER (기존 유지)        │
                     │  Binance, Coinalyze, FRED, CoinGecko, │
                     │  LunarCrush, Santiment, CoinMetrics   │
                     └───────────────┬─────────────────────┘
                                     │ 정제된 MarketSnapshot
                                     ▼
┌──────────────────────────────────────────────────────────────────┐
│                    LEVEL 1: ANALYST AGENTS (병렬)                 │
│                                                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │STRUCTURE │ │  DERIV   │ │  FLOW    │ │   VPA    │           │
│  │ Agent    │ │  Agent   │ │  Agent   │ │  Agent   │           │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘           │
│       │             │             │             │                  │
│  ┌────┴─────┐ ┌────┴─────┐ ┌────┴─────┐ ┌────┴─────┐           │
│  │   ICT    │ │  SENTI   │ │  MACRO   │ │VALUATION │           │
│  │  Agent   │ │  Agent   │ │  Agent   │ │  Agent   │           │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘           │
│       │             │             │             │                  │
│       ▼             ▼             ▼             ▼                  │
│    AgentVerdict × 8 (direction + confidence + reasoning)          │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                    LEVEL 2: SYNTHESIS AGENTS (병렬)               │
│                                                                    │
│  ┌─────────────────┐         ┌─────────────────┐                 │
│  │  OFFENSE 종합    │         │   DEFENSE 종합   │                 │
│  │ (STRUCTURE+VPA   │         │ (DERIV+FLOW     │                 │
│  │  +ICT)           │         │  +SENTI+MACRO)  │                 │
│  └────────┬────────┘         └────────┬────────┘                 │
│           │ OffenseVerdict             │ DefenseVerdict            │
└───────────┼────────────────────────────┼─────────────────────────┘
            │                            │
            ▼                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                    LEVEL 3: COMMANDER (단일)                      │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ COMMANDER: Offense + Defense + RAG 조회 + Guardian 체크    │    │
│  │ → 최종 direction, confidence, TP/SL, 근거 텍스트           │    │
│  └──────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

### 논문과의 대응

| 논문 (Expert Investment Teams) | STOCKCLAW C-02 |
|---|---|
| Technical Agent | STRUCTURE + VPA + ICT |
| Quantitative Agent | DERIV + FLOW + VALUATION |
| Qualitative Agent | SENTI (소셜/뉴스 감성) |
| News Agent | MACRO (매크로 이벤트) |
| Sector Agent | OFFENSE 종합 (기술적) |
| Macro Agent | DEFENSE 종합 (거시/온체인) |
| Portfolio Manager | COMMANDER |

---

## 2. 데이터 레이어: MarketSnapshot

기존 B-02가 수집하는 데이터를 **그대로 사용**. 추가 API 호출 없음.
차이점: 데이터를 if-else 점수가 아니라 **구조화된 텍스트**로 에이전트에게 전달.

```typescript
interface MarketSnapshot {
  // ── 기본 정보 ──
  pair: string;                    // 'BTC/USDT'
  timeframe: string;               // '4h'
  latestClose: number;             // 68,352
  timestamp: number;

  // ── 캔들 요약 (LLM에 raw klines 보내지 않음, 통계 요약만) ──
  candles: {
    rsi14: number | null;
    sma20: number;
    sma60: number;
    sma120: number;
    atrPct: number;
    volumeRatio: number;           // 현재 거래량 / 20봉 평균
    change24h: number;             // -3.85%
    priceVsBollinger: 'above_upper' | 'upper_zone' | 'mid' | 'lower_zone' | 'below_lower';
    recentPattern: string | null;  // 'bearish_engulfing' | 'doji' | null
    trendStructure: 'HH_HL' | 'LH_LL' | 'ranging'; // Higher-High/Higher-Low 등
  };

  // ── 파생 상품 ──
  derivatives: {
    openInterest: number | null;
    funding: number | null;
    predictedFunding: number | null;
    lsRatio: number | null;
    liqLong24h: number;
    liqShort24h: number;
    oiChangePercent: number | null; // OI 24h 변화율
  };

  // ── 온체인 ──
  onchain: {
    exchangeNetflow: number | null;   // + = 입금(매도 압력)
    whaleNetflow: number | null;
    minerOutflow: number | null;
    mvrv: number | null;
    nupl: number | null;
    exchangeReserve: number | null;
  };

  // ── 소셜/감성 ──
  sentiment: {
    fearGreedIndex: number | null;    // 0-100
    fearGreedLabel: string | null;    // 'Fear' | 'Greed' | etc
    socialSentiment: number | null;   // LunarCrush/Santiment
    socialDominance: number | null;
    galaxyScore: number | null;
  };

  // ── 매크로 ──
  macro: {
    dxy: { value: number; change1d: number; trend1m: string } | null;
    spx: { value: number; change1d: number; trend1m: string } | null;
    us10y: { value: number; change1d: number } | null;
    fedFundsRate: number | null;
    yieldCurve: number | null;       // 10y-2y spread
    m2ChangePercent: number | null;
    btcDominance: number | null;
    totalMarketCapChange24h: number | null;
  };

  // ── 이더리움 특화 (ETH pair일 때만) ──
  ethOnchain: {
    gasStandard: number | null;
    activeAddresses: number | null;
  } | null;
}
```

### 변환 함수
```typescript
// 기존 scanEngine.ts의 Phase 1~3 데이터를 MarketSnapshot으로 변환
function buildMarketSnapshot(/* 기존 변수들 */): MarketSnapshot { ... }
```

---

## 3. Level 1: Analyst Agents — Fine-Grained Task Decomposition

### 핵심 원칙 (논문에서)
> "Fine-grained: 미리 계산된 지표(RSI, MACD, 볼린저)를 주고 해석하라"
> "Coarse-grained: 원시 가격 데이터를 주고 알아서 분석하라"
> → Fine-grained이 Sharpe 0.4~0.66 포인트 우세

**따라서: 각 에이전트에게 pre-computed 수치 + 구체적 질문을 준다.**

### 3.1 STRUCTURE Agent

```typescript
interface StructureAgentInput {
  rsi14: number;
  sma20_distance_pct: number;     // 가격이 SMA20에서 몇 % 떨어져 있는가
  sma60_distance_pct: number;
  sma120_distance_pct: number;
  sma_alignment: 'bullish' | 'bearish' | 'mixed';  // 20>60>120 = bullish
  atrPct: number;
  trendStructure: string;          // HH_HL, LH_LL, ranging
  recentPattern: string | null;
  priceVsBollinger: string;
}
```

**Fine-grained prompt:**
```
You are STRUCTURE, a technical analysis agent for {pair} {timeframe}.

INDICATORS:
- RSI(14): {rsi14}
- Price vs SMA20: {sma20_distance_pct}% ({above/below})
- Price vs SMA60: {sma60_distance_pct}%
- Price vs SMA120: {sma120_distance_pct}%
- SMA alignment: {sma_alignment}
- ATR%: {atrPct}
- Trend structure: {trendStructure}
- Recent candle pattern: {recentPattern}
- Bollinger position: {priceVsBollinger}

TASKS (answer each separately):
1. TREND: Is the current trend continuation or exhaustion?
   Consider: SMA alignment + trend structure + RSI position
2. MOMENTUM: Is momentum strengthening or weakening?
   Consider: RSI slope context + ATR% + price vs SMA20
3. REVERSAL_RISK: Are there reversal signals?
   Consider: candle pattern + Bollinger position + RSI extreme (>70 or <30)

OUTPUT (JSON only):
{
  "direction": "long" | "short" | "neutral",
  "confidence": 0-100,
  "trend_assessment": "continuation" | "exhaustion" | "unclear",
  "momentum": "strengthening" | "weakening" | "flat",
  "reversal_risk": "low" | "medium" | "high",
  "reasoning": "<50자 한국어>"
}
```

### 3.2 DERIV Agent

```
INDICATORS:
- Funding rate: {funding} (양수=롱 과밀, 음수=숏 과밀)
- Predicted funding: {predFunding}
- L/S ratio: {lsRatio} (>1=롱 우세)
- Liquidation 24h: Long ${liqLong}M / Short ${liqShort}M
- OI change 24h: {oiChangePct}%
- Price change 24h: {change24h}%

TASKS:
1. CROWDING: 한쪽에 포지션이 과도하게 쏠려있는가?
   Consider: funding rate extreme + L/S ratio skew
2. SQUEEZE: 스퀴즈(과밀 청산 유발) 가능성은?
   Consider: high funding + skewed L/S + low ATR = squeeze setup
3. DIVERGENCE: OI와 가격이 다이버전스인가?
   Consider: price up + OI down = weak rally, price down + OI up = strong selling
```

### 3.3~3.8 나머지 Agent (동일 패턴)

| Agent | 입력 데이터 | Fine-grained 태스크 |
|---|---|---|
| **FLOW** | exchangeNetflow, whaleNetflow, minerOutflow, exchangeReserve | ACCUMULATION(축적/분배), WHALE(고래 행동), MINER(채굴자 매도 압력) |
| **VPA** | cvdRatio, buyVolPercent, volumeRatio, absorptionCandles | VOLUME_CONFIRM(거래량이 추세 확인?), DIVERGENCE(거래량/가격 괴리), ABSORPTION(흡수 캔들 감지) |
| **ICT** | pricePosition50, fvgCount, structureBreak, recentBodyRatio | LIQUIDITY(유동성 구간), FVG(공정가치갭), SMART_MONEY(스마트머니 흔적) |
| **SENTI** | fearGreedIndex, socialSentiment, socialDominance, galaxyScore | CROWD(군중 심리 극단?), SOCIAL(소셜 신호 방향), CONTRARIAN(역발상 기회?) |
| **MACRO** | dxy, spx, us10y, fedFunds, yieldCurve, m2, btcDominance | RISK_APPETITE(위험자산 선호도), LIQUIDITY(글로벌 유동성), CORRELATION(BTC-전통자산 상관) |
| **VALUATION** | sma120Deviation, rsi14, mvrv, nupl, marketCapChange | OVERVALUATION(과대평가?), MEAN_REVERSION(평균회귀 압력), CYCLE(시장 사이클 위치) |

---

## 4. Level 2: Synthesis Agents

### 4.1 OFFENSE Agent (공격 = 가격 기술적 분석)

**입력**: STRUCTURE + VPA + ICT의 AgentVerdict 3개

```
You are OFFENSE SYNTHESIZER.
Three technical analysts have given their views:

STRUCTURE: {direction} {confidence}% — {reasoning}
VPA:       {direction} {confidence}% — {reasoning}
ICT:       {direction} {confidence}% — {reasoning}

TASKS:
1. AGREEMENT: 3개 에이전트가 얼마나 일치하는가? (3/3, 2/3, 0/3)
2. CONFLICT_RESOLUTION: 불일치 시 어느 쪽이 현재 시장 상황에서 더 신뢰할 만한가?
3. COMBINED_SIGNAL: 종합 기술적 방향

OUTPUT (JSON):
{
  "direction": "long" | "short" | "neutral",
  "confidence": 0-100,
  "agreement_level": "strong" | "moderate" | "weak",
  "key_factor": "<가장 중요한 판단 근거>",
  "reasoning": "<50자>"
}
```

### 4.2 DEFENSE Agent (방어 = 환경/거시/온체인)

**입력**: DERIV + FLOW + SENTI + MACRO + VALUATION의 AgentVerdict 5개

```
동일 구조, 5개 에이전트의 환경 진단을 종합.
환경이 기술적 신호를 지지하는가, 반박하는가?
```

---

## 5. Level 3: COMMANDER

### 입력
1. OFFENSE 종합 verdict
2. DEFENSE 종합 verdict
3. RAG 조회 결과 (유사 패턴에서 과거 승률)
4. Guardian 체크 (리스크 한도)

### RAG 조회

```typescript
interface RAGQuery {
  // 현재 상황의 핵심 특징을 벡터로 요약
  embedding: number[];  // 256d (기존 computeTerminalScanEmbedding 활용)
  filters: {
    pair: string;
    regime: MarketRegime;
    minSimilarity: number;  // cosine similarity threshold
  };
}

interface RAGResult {
  similarCases: number;        // 유사 케이스 수
  longWinRate: number;         // 유사 상황에서 LONG 승률
  shortWinRate: number;
  avgConfidenceWhenCorrect: number;
  recentTrend: string;         // "최근 5건 중 4건 LONG 승리"
  lesson: string;              // 가장 관련 높은 과거 교훈
}
```

### Commander Prompt

```
You are COMMANDER, the final decision maker for {pair} {timeframe}.

OFFENSE (기술적 분석 종합):
  Direction: {offense.direction} | Confidence: {offense.confidence}%
  Agreement: {offense.agreement_level}
  Key factor: {offense.key_factor}
  Reasoning: {offense.reasoning}

DEFENSE (환경 분석 종합):
  Direction: {defense.direction} | Confidence: {defense.confidence}%
  Agreement: {defense.agreement_level}
  Key factor: {defense.key_factor}
  Reasoning: {defense.reasoning}

HISTORICAL CONTEXT (RAG):
  Similar cases found: {rag.similarCases}
  Long win rate: {rag.longWinRate}%
  Short win rate: {rag.shortWinRate}%
  Recent trend: {rag.recentTrend}
  Past lesson: {rag.lesson}

GUARDIAN ALERTS:
{guardian.alerts}

CURRENT PRICE: ${latestClose}
ATR%: {atrPct}

TASKS:
1. CONFLICT_CHECK: Offense와 Defense가 충돌하는가? 충돌 시 어느 쪽을 신뢰할 것인가?
2. RAG_ADJUSTMENT: 과거 유사 상황의 결과가 현재 판단을 어떻게 조정하는가?
3. FINAL_DECISION: 최종 방향, 확신도, TP/SL

OUTPUT (JSON):
{
  "direction": "long" | "short" | "neutral",
  "confidence": 0-100,
  "entry": number,
  "tp": number,
  "sl": number,
  "offense_defense_alignment": "aligned" | "conflicting" | "one_side_neutral",
  "rag_adjustment": number,  // RAG가 confidence를 몇 % 조정했는가 (-20 ~ +20)
  "reasoning": "<100자 한국어>",
  "key_risks": ["<리스크1>", "<리스크2>"]
}
```

---

## 6. 학습 루프: ORPO + RAG

### 6.1 매 스캔 → RAG 저장 (기존 동작 확장)

```
스캔 완료 → MarketSnapshot + CommanderVerdict 저장
  → embedding 생성 (기존 computeTerminalScanEmbedding)
  → rag_entries 테이블에 INSERT
```

### 6.2 매 게임 결과 → ORPO pair 생성

```
GameRecord.outcome 확정 →
  chosen  = 승자의 (direction, confidence, reasoning)
  rejected = 패자의 (direction, confidence, reasoning)
  context = MarketSnapshot (동일)
  margin  = FBS 차이

→ orpo_training_pairs 테이블에 INSERT
→ margin > 8 AND quality != 'noise' 인 pair만 학습 대상
```

### 6.3 주기적 Fine-tuning (배치)

```
주 1회 (또는 100 pair 누적 시):
  1. orpo_training_pairs에서 quality='strong' 추출
  2. ORPO fine-tuning 실행 (base model: Claude Haiku or Llama 70B)
  3. 새 모델을 에이전트에 배포
  4. A/B 테스트: 기존 모델 vs 새 모델 (50/50 트래픽)
```

### 6.4 RAG 피드백 루프

```
게임 결과 확정 →
  해당 스캔의 rag_entry에 outcome 추가:
  - humanWon: boolean
  - aiWon: boolean
  - actualDirection: Direction
  - lesson 자동 생성: "{regime}에서 {topFactors} 조합 → {direction} {winRate}%"
```

---

## 7. 구현 계획

### Phase 1: LLM Agent 프레임워크 (1주)

**신규 파일:**
```
src/lib/server/
  llmScan/
    types.ts           — MarketSnapshot, AgentVerdict, CommanderResult 타입
    snapshotBuilder.ts — 기존 scanEngine 데이터 → MarketSnapshot 변환
    promptBuilder.ts   — 에이전트별 Fine-grained prompt 생성
    agentRunner.ts     — LLM 호출 + JSON 파싱 + 에러 핸들링
    synthesizer.ts     — Level 2 종합 에이전트 로직
    commander.ts       — Level 3 Commander + RAG 조회
    llmScanEngine.ts   — 전체 파이프라인 오케스트레이션
```

**변경 파일:**
```
scanEngine.ts         — buildMarketSnapshot() 함수 추출 (기존 로직 보존)
scanService.ts        — engine 선택 로직: B-02 (기존) vs C-02 (LLM)
```

### Phase 2: RAG 연동 (3일)

```
ragService.ts 확장   — 스캔 결과 기반 RAG 조회 함수
rag_entries 스키마   — outcome, lesson 필드 추가
```

### Phase 3: ORPO 학습 파이프라인 (1주)

```
src/lib/server/
  training/
    orpoCollector.ts  — GameRecord → ORPO pair 수집
    orpoExporter.ts   — 학습 데이터 JSONL 내보내기
    modelRegistry.ts  — 모델 버전 관리 + A/B 테스트 할당
```

### Phase 4: 점진적 전환 (2일)

```
1. Feature flag: USE_LLM_SCAN = false (기본)
2. A/B: 10% → 30% → 50% → 100% 점진 전환
3. B-02 대비 C-02 성능 비교 대시보드
4. Fallback: LLM 타임아웃(5초) 시 B-02로 자동 전환
```

---

## 8. LLM 선택 + 비용

### 에이전트 호출 구조

```
1 스캔 =
  Level 1: 8 에이전트 × 1 LLM 호출 = 8 calls (병렬)
  Level 2: 2 종합 × 1 LLM 호출 = 2 calls (병렬)
  Level 3: 1 Commander × 1 LLM 호출 = 1 call
  총: 11 LLM 호출 / 스캔
```

### 모델 선택

| 레벨 | 모델 | 이유 |
|---|---|---|
| Level 1 (Analyst) | Claude Haiku 3.5 또는 Llama 70B | 빠르고 저렴, 구조화된 태스크에 충분 |
| Level 2 (Synthesis) | Claude Haiku 3.5 | 종합 판단, 중간 복잡도 |
| Level 3 (Commander) | Claude Sonnet 4 | 최종 판정, 높은 정확도 필요 |

### 비용 추정 (스캔 1회)

```
Level 1: 8 × ~500 input tokens × ~200 output tokens = ~5,600 input / 1,600 output
Level 2: 2 × ~800 input × ~200 output = ~1,600 input / 400 output
Level 3: 1 × ~1,200 input × ~300 output = ~1,200 input / 300 output

Haiku (Level 1+2): ~7,200 input ($0.25/M) + ~2,000 output ($1.25/M) = $0.004
Sonnet (Level 3):  ~1,200 input ($3/M) + ~300 output ($15/M) = $0.008
총: ~$0.012 / 스캔 = ~12원 / 스캔

일 100스캔 기준: $1.2/일 = $36/월
```

### 레이턴시 최적화

```
Level 1: 8개 병렬 → max(8개 응답시간) ≈ 1~2초
Level 2: 2개 병렬 → max(2개 응답시간) ≈ 1초
Level 3: 1개 직렬 → 1~2초
총: 3~5초 (현재 B-02의 데이터 수집 3~4초 + 순수 계산 50ms ≈ 4초)

→ C-02: 데이터 수집 3~4초 + LLM 3~5초 ≈ 7~9초
→ UX: "AI 분석 중..." 애니메이션으로 자연스럽게 처리 (이미 있음)
```

---

## 9. B-02 → C-02 마이그레이션 전략

### B-02 보존 (필수)
```
B-02(현재 scanEngine.ts)는 삭제하지 않는다.
이유:
1. LLM 장애 시 fallback
2. A/B 테스트 baseline
3. LLM 비용이 부담되는 비로그인 유저에게 제공
```

### 전환 로직
```typescript
// scanService.ts
async function runTerminalScan(userId, request) {
  const useC02 = await shouldUseC02(userId);  // feature flag + A/B

  if (useC02) {
    try {
      return await runLLMScan(userId, request);  // C-02
    } catch (e) {
      console.warn('[C-02] fallback to B-02:', e);
      return await runRuleScan(userId, request);  // B-02 fallback
    }
  }
  return await runRuleScan(userId, request);  // B-02
}
```

---

## 10. 기존 UNIFIED_DESIGN과의 정합성

| UNIFIED_DESIGN 개념 | C-02에서의 구현 |
|---|---|
| C02 파이프라인 (ORPO→CTX→Guardian→Commander) | Level 1 Offense(=ORPO) → Level 1 Defense(=CTX) → Guardian → Commander |
| 48개 팩터 | MarketSnapshot의 모든 필드 (동일 데이터, 다른 해석) |
| GameRecord.ai.c02Result | CommanderResult (LLM reasoning 포함) |
| "같은 데이터, 다른 해석" | LLM이 해석 근거를 자연어로 제공 → 인간이 읽고 반박 가능 |
| ORPO chosen/rejected | 그대로 유지. LLM reasoning이 있으므로 pair 품질 향상 |
| RAG 조회 | Commander가 직접 RAG 결과를 받아 confidence 조정 |
| factorConflicts | offense_defense_alignment 필드로 자동 감지 |

---

## 11. 성공 기준 (DoD)

1. **정확도**: C-02 consensus가 B-02 대비 방향 적중률 +5% 이상
2. **Sharpe**: 동일 기간 백테스트에서 C-02 long-short Sharpe > B-02 Sharpe
3. **해석성**: 모든 스캔에 한국어 reasoning 텍스트 포함
4. **레이턴시**: 95th percentile < 10초
5. **비용**: 월 $50 이하 (일 100스캔 기준)
6. **안정성**: LLM 장애 시 B-02 자동 fallback, 유저 인지 없음

---

## Changelog
| 날짜 | 변경 |
|---|---|
| 2026-03-07 | 초안 작성. 논문 2편 + 기존 B-02 분석 기반. |
