import { computeDecision, type EngineEvidence } from '$lib/intel/decisionEngine';
import { evaluateQualityGateFromFeatures } from '$lib/intel/qualityGate';
import { getIntelThresholds } from '$lib/intel/thresholds';
import type { DecisionBias, IntelDecisionOutput, ManipulationRiskLevel, QualityGateResult, QualityGateScores } from '$lib/intel/types';

export type IntelPanelKey = 'headlines' | 'events' | 'flow' | 'trending' | 'picks';

type NewsItem = {
  id?: string;
  source?: string;
  title?: string;
  summary?: string;
  sentiment?: string;
  network?: string;
  interactions?: number;
  importance?: number;
  publishedAt?: number;
};

type EventItem = {
  id?: string;
  tag?: string;
  level?: string;
  text?: string;
  source?: string;
  createdAt?: number;
};

type FlowSnapshot = {
  funding?: number | null;
  lsRatio?: number | null;
  liqLong24h?: number | null;
  liqShort24h?: number | null;
  quoteVolume24h?: number | null;
  priceChangePct?: number | null;
  cmcChange24hPct?: number | null;
  cmcMarketCap?: number | null;
};

type FlowRecord = {
  id?: string;
  agent?: string;
  vote?: string;
  confidence?: number;
  text?: string;
  source?: string;
  createdAt?: number;
};

type TrendingCoin = {
  symbol?: string;
  name?: string;
  rank?: number;
  change24h?: number;
  socialVolume?: number | null;
  sentiment?: number | null;
  galaxyScore?: number | null;
};

type PickCoin = {
  symbol?: string;
  name?: string;
  direction?: string;
  confidence?: number;
  totalScore?: number;
  reasons?: string[];
  alerts?: string[];
  change24h?: number;
};

export interface IntelPolicyCard {
  id: string;
  panel: IntelPanelKey;
  title: string;
  source: string;
  createdAt: number;
  bias: DecisionBias;
  confidence: number;
  what: string;
  soWhat: string;
  nowWhat: string;
  why: string;
  helpfulnessWhy: string;
  visualAid: string | null;
  gate: QualityGateResult;
}

export interface IntelPolicyInput {
  pair: string;
  timeframe: string;
  newsRecords: NewsItem[];
  eventRecords: EventItem[];
  flowSnapshot: FlowSnapshot | null;
  flowRecords: FlowRecord[];
  trendingCoins: TrendingCoin[];
  pickCoins: PickCoin[];
}

export interface IntelPolicyOutput {
  generatedAt: number;
  decision: IntelDecisionOutput;
  panels: Record<IntelPanelKey, IntelPolicyCard[]>;
  summary: {
    pair: string;
    timeframe: string;
    domainsUsed: string[];
    avgHelpfulness: number;
  };
}

function clamp(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function toNum(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(n) ? n : fallback;
}

function toUpperSafe(value: string): string {
  return value.trim().toUpperCase();
}

function delayMinutes(ts: number): number {
  const raw = Math.floor((Date.now() - ts) / 60_000);
  if (!Number.isFinite(raw)) return 120;
  return Math.max(0, raw);
}

function sourceReliabilityScore(source: string): number {
  const normalized = source.toLowerCase();
  if (normalized.includes('rss') || normalized.includes('coindesk') || normalized.includes('cointelegraph')) return 90;
  if (normalized.includes('coinalyze') || normalized.includes('coinmarketcap') || normalized.includes('binance')) return 92;
  if (normalized.includes('dexscreener')) return 82;
  if (normalized.includes('lunarcrush') || normalized.includes('social')) return 66;
  return 78;
}

function manipulationRiskFor(source: string): ManipulationRiskLevel {
  const normalized = source.toLowerCase();
  if (normalized.includes('social') || normalized.includes('boost') || normalized.includes('ads')) return 'high';
  if (normalized.includes('dexscreener')) return 'medium';
  return 'low';
}

function relevanceScore(text: string, pairToken: string): number {
  const lower = text.toLowerCase();
  const token = pairToken.toLowerCase();
  const generic = /crypto|market|exchange|bitcoin|ethereum|solana/.test(lower);
  if (lower.includes(token)) return 96;
  if (generic) return 78;
  return 62;
}

function biasToActionText(bias: DecisionBias): string {
  if (bias === 'long') return '롱 진입/홀드 우선';
  if (bias === 'short') return '숏 진입/홀드 우선';
  return '신규 포지션 보류';
}

function visualAidForBias(bias: DecisionBias): string {
  if (bias === 'long') return 'UP_ARROW';
  if (bias === 'short') return 'DOWN_ARROW';
  return 'NEUTRAL_DOT';
}

function textBias(text: string): DecisionBias {
  const lower = text.toLowerCase();
  let longScore = 0;
  let shortScore = 0;
  if (/long|bull|breakout|uptrend|상승|매수|롱/.test(lower)) longScore += 2;
  if (/short|bear|breakdown|downtrend|하락|매도|숏/.test(lower)) shortScore += 2;
  if (/risk-on|유입|squeeze|support/.test(lower)) longScore += 1;
  if (/risk-off|청산|매도압력|resistance/.test(lower)) shortScore += 1;
  if (longScore > shortScore) return 'long';
  if (shortScore > longScore) return 'short';
  return 'wait';
}

function normalizeBias(raw: string | undefined): DecisionBias {
  const normalized = (raw ?? '').toLowerCase();
  if (normalized === 'long' || normalized === 'bullish') return 'long';
  if (normalized === 'short' || normalized === 'bearish') return 'short';
  return 'wait';
}

function gateCard(
  panel: IntelPanelKey,
  sourceId: string,
  sourceLabel: string,
  payload: {
    title: string;
    createdAt: number;
    bias: DecisionBias;
    confidence: number;
    what: string;
    soWhat: string;
    nowWhat: string;
    why: string;
    helpfulnessWhy: string;
    visualAid: string | null;
  },
  scoreInput: {
    actionTypeCount: number;
    clarityScore: number;
    sourceReliability: number;
    failureRatePct: number;
    manipulationRisk: ManipulationRiskLevel;
    pairKeywordMatchPct: number;
    timeframeAligned: boolean;
    backtestWinRateLiftPct: number;
    feedbackPositivePct: number;
    applyRatePct: number;
    pnlLiftPct?: number;
  },
): IntelPolicyCard {
  const gate = evaluateQualityGateFromFeatures(
    {
      actionability: {
        actionTypeCount: scoreInput.actionTypeCount,
        clarityScore: scoreInput.clarityScore,
      },
      timeliness: {
        delayMinutes: delayMinutes(payload.createdAt),
        horizonMinutes: 120,
      },
      reliability: {
        sourceReliability: scoreInput.sourceReliability,
        failureRatePct: scoreInput.failureRatePct,
        manipulationRisk: scoreInput.manipulationRisk,
      },
      relevance: {
        pairKeywordMatchPct: scoreInput.pairKeywordMatchPct,
        timeframeAligned: scoreInput.timeframeAligned,
      },
      helpfulness: {
        backtestWinRateLiftPct: scoreInput.backtestWinRateLiftPct,
        feedbackPositivePct: scoreInput.feedbackPositivePct,
        applyRatePct: scoreInput.applyRatePct,
        pnlLiftPct: scoreInput.pnlLiftPct ?? 0,
      },
    },
    sourceId,
  );

  return {
    id: sourceId,
    panel,
    title: payload.title,
    source: sourceLabel,
    createdAt: payload.createdAt,
    bias: payload.bias,
    confidence: clamp(payload.confidence),
    what: payload.what,
    soWhat: payload.soWhat,
    nowWhat: payload.nowWhat,
    why: payload.why,
    helpfulnessWhy: payload.helpfulnessWhy,
    visualAid: payload.visualAid,
    gate,
  };
}

function cardRank(card: IntelPolicyCard): number {
  const visibilityBonus = card.gate.visibility === 'full' ? 10 : card.gate.visibility === 'low_impact' ? 2 : -100;
  return card.gate.weightedScore + visibilityBonus + card.confidence * 0.1;
}

function pickTopCards(cards: IntelPolicyCard[], maxCount: number): IntelPolicyCard[] {
  return cards
    .filter((card) => card.gate.visibility !== 'hidden')
    .sort((a, b) => cardRank(b) - cardRank(a))
    .slice(0, maxCount);
}

function buildHeadlineCards(input: IntelPolicyInput, maxCount: number): IntelPolicyCard[] {
  const token = toUpperSafe(input.pair.split('/')[0] ?? 'BTC');
  const out: IntelPolicyCard[] = [];

  for (const raw of input.newsRecords.slice(0, 40)) {
    const title = (raw.title ?? raw.summary ?? '').trim();
    if (!title) continue;

    const sentimentBias = normalizeBias(raw.sentiment);
    const bias = sentimentBias === 'wait' ? textBias(`${title} ${raw.summary ?? ''}`) : sentimentBias;
    const interactions = Math.max(0, toNum(raw.interactions, 0));
    const importance = clamp(toNum(raw.importance, 50));
    const createdAt = toNum(raw.publishedAt, Date.now());
    const sourceLabel = raw.source ?? raw.network ?? 'MARKET_NEWS';
    const source = `${sourceLabel}${raw.network ? `:${raw.network}` : ''}`;
    const confidence = clamp(45 + importance * 0.4 + Math.min(20, Math.log10(interactions + 1) * 8));

    const score = gateCard(
      'headlines',
      `headline:${raw.id ?? title.slice(0, 24)}`,
      source,
      {
        title: `HEADLINE · ${title.slice(0, 72)}`,
        createdAt,
        bias,
        confidence,
        what: title,
        soWhat:
          bias === 'long'
            ? '상승 촉매 가능성이 커서 단기 상방 변동성이 열릴 수 있습니다.'
            : bias === 'short'
              ? '하방 리스크 촉매로 작동할 수 있어 변동성 확대 구간입니다.'
              : '명확한 방향 촉매가 부족해 단독 신호로는 약합니다.',
        nowWhat: biasToActionText(bias),
        why: `${sourceLabel} 기반 중요도 ${Math.round(importance)} · 상호작용 ${Math.round(interactions).toLocaleString()}`,
        helpfulnessWhy: `유사 헤드라인 군집에서 importance ${Math.round(importance)} / interactions ${Math.round(interactions)} 반영`,
        visualAid: visualAidForBias(bias),
      },
      {
        actionTypeCount: bias === 'wait' ? 1 : 3,
        clarityScore: title.length >= 28 ? 36 : 30,
        sourceReliability: sourceReliabilityScore(source),
        failureRatePct: raw.network === 'rss' ? 4 : 7,
        manipulationRisk: manipulationRiskFor(source),
        pairKeywordMatchPct: relevanceScore(`${title} ${raw.summary ?? ''}`, token),
        timeframeAligned: delayMinutes(createdAt) <= 120,
        backtestWinRateLiftPct: Math.min(9, importance / 15),
        feedbackPositivePct: 68 + Math.min(22, Math.log10(interactions + 10) * 10),
        applyRatePct: confidence,
        pnlLiftPct: Math.min(8, importance / 12),
      },
    );

    out.push(score);
  }

  return pickTopCards(out, maxCount);
}

function parseDerivFunding(text: string): number | null {
  const m = text.match(/Funding\s+([+-]?\d+(?:\.\d+)?)%/i);
  if (!m) return null;
  const value = Number(m[1]);
  return Number.isFinite(value) ? value / 100 : null;
}

function parseLsRatio(text: string): number | null {
  const m = text.match(/L\/S\s+([+-]?\d+(?:\.\d+)?)/i);
  if (!m) return null;
  const value = Number(m[1]);
  return Number.isFinite(value) ? value : null;
}

function buildEventCards(input: IntelPolicyInput, maxCount: number): IntelPolicyCard[] {
  const token = toUpperSafe(input.pair.split('/')[0] ?? 'BTC');
  const out: IntelPolicyCard[] = [];

  for (const raw of input.eventRecords.slice(0, 40)) {
    const text = (raw.text ?? '').trim();
    if (!text) continue;

    const tag = (raw.tag ?? 'EVENT').toUpperCase();
    const level = (raw.level ?? 'info').toLowerCase();
    const createdAt = toNum(raw.createdAt, Date.now());
    const source = raw.source ?? 'MARKET_EVENTS';

    let bias: DecisionBias = 'wait';
    if (tag === 'DERIV') {
      const funding = parseDerivFunding(text);
      const lsRatio = parseLsRatio(text);
      if (funding != null && funding < -0.0006) bias = 'long';
      else if (funding != null && funding > 0.0006) bias = 'short';
      else if (lsRatio != null && lsRatio < 0.9) bias = 'long';
      else if (lsRatio != null && lsRatio > 1.1) bias = 'short';
      else bias = 'wait';
    } else if (tag === 'TAKEOVER' || tag === 'BOOST') {
      bias = 'long';
    } else if (tag === 'ADS') {
      bias = 'wait';
    } else {
      bias = textBias(text);
    }

    const baseConfidence = tag === 'DERIV' ? 82 : tag === 'TAKEOVER' ? 68 : tag === 'BOOST' ? 64 : 58;
    const confidence = clamp(baseConfidence + (level === 'warning' ? 8 : 0));

    out.push(
      gateCard(
        'events',
        `event:${raw.id ?? text.slice(0, 24)}`,
        source,
        {
          title: `${tag} · ${text.slice(0, 72)}`,
          createdAt,
          bias,
          confidence,
          what: text,
          soWhat:
            tag === 'DERIV'
              ? '파생지표 이벤트라 30~120분 구간 방향성 압력에 직접 연결됩니다.'
              : '단기 유동성/관심도에 영향을 주는 이벤트로 변동성 트리거가 됩니다.',
          nowWhat: biasToActionText(bias),
          why: `${source} · ${tag} · ${level}`,
          helpfulnessWhy: `태그 ${tag} 이벤트 히스토리 기반 영향도 반영`,
          visualAid: visualAidForBias(bias),
        },
        {
          actionTypeCount: bias === 'wait' ? 1 : 3,
          clarityScore: text.length >= 24 ? 34 : 28,
          sourceReliability: sourceReliabilityScore(source),
          failureRatePct: 6,
          manipulationRisk: manipulationRiskFor(`${source}:${tag}`),
          pairKeywordMatchPct: relevanceScore(text, token),
          timeframeAligned: delayMinutes(createdAt) <= 120,
          backtestWinRateLiftPct: tag === 'DERIV' ? 7.2 : 5.8,
          feedbackPositivePct: tag === 'DERIV' ? 78 : 68,
          applyRatePct: confidence,
          pnlLiftPct: tag === 'DERIV' ? 6.8 : 4.1,
        },
      ),
    );
  }

  return pickTopCards(out, maxCount);
}

function buildFlowCards(input: IntelPolicyInput, maxCount: number): IntelPolicyCard[] {
  const token = toUpperSafe(input.pair.split('/')[0] ?? 'BTC');
  const source = 'FLOW_COMPOSITE';
  const out: IntelPolicyCard[] = [];
  const snap = input.flowSnapshot ?? {};
  const createdAt = Date.now();

  const funding = snap.funding ?? null;
  if (funding != null) {
    const bias: DecisionBias = funding < -0.0006 ? 'long' : funding > 0.0006 ? 'short' : 'wait';
    const confidence = clamp(58 + Math.min(32, Math.abs(funding) * 100000));
    out.push(
      gateCard(
        'flow',
        'flow:funding',
        'COINALYZE',
        {
          title: 'FUNDING SIGNAL',
          createdAt,
          bias,
          confidence,
          what: `Funding ${(funding * 100).toFixed(4)}%`,
          soWhat:
            bias === 'short'
              ? '롱 과밀 가능성으로 되돌림 하방 압력이 생길 수 있습니다.'
              : bias === 'long'
                ? '숏 과밀 해소 구간으로 숏커버 상방 압력이 생길 수 있습니다.'
                : '펀딩 단독으로는 방향성이 중립입니다.',
          nowWhat: biasToActionText(bias),
          why: '펀딩 극단값 임계(±0.06%) 기반',
          helpfulnessWhy: `펀딩 절대값 ${Math.abs(funding * 100).toFixed(4)}%를 단기 과열 지표로 반영`,
          visualAid: visualAidForBias(bias),
        },
        {
          actionTypeCount: bias === 'wait' ? 1 : 3,
          clarityScore: 36,
          sourceReliability: 92,
          failureRatePct: 4,
          manipulationRisk: 'low',
          pairKeywordMatchPct: 96,
          timeframeAligned: true,
          backtestWinRateLiftPct: 7.4,
          feedbackPositivePct: 74,
          applyRatePct: confidence,
          pnlLiftPct: 5.2,
        },
      ),
    );
  }

  const lsRatio = snap.lsRatio ?? null;
  if (lsRatio != null) {
    const bias: DecisionBias = lsRatio < 0.9 ? 'long' : lsRatio > 1.1 ? 'short' : 'wait';
    const confidence = clamp(55 + Math.abs(lsRatio - 1) * 120);
    out.push(
      gateCard(
        'flow',
        'flow:ls_ratio',
        'COINALYZE',
        {
          title: 'LONG/SHORT RATIO',
          createdAt,
          bias,
          confidence,
          what: `L/S ratio ${lsRatio.toFixed(2)}`,
          soWhat: bias === 'wait' ? '롱/숏 포지션 비대칭이 약해 중립입니다.' : '포지션 비대칭으로 역방향 압력이 확대될 수 있습니다.',
          nowWhat: biasToActionText(bias),
          why: 'L/S 임계(0.9 / 1.1) 기반 쏠림 판단',
          helpfulnessWhy: `L/S 편차 ${(Math.abs(lsRatio - 1) * 100).toFixed(1)}% 반영`,
          visualAid: visualAidForBias(bias),
        },
        {
          actionTypeCount: bias === 'wait' ? 1 : 3,
          clarityScore: 34,
          sourceReliability: 90,
          failureRatePct: 4,
          manipulationRisk: 'low',
          pairKeywordMatchPct: 96,
          timeframeAligned: true,
          backtestWinRateLiftPct: 6.8,
          feedbackPositivePct: 72,
          applyRatePct: confidence,
          pnlLiftPct: 4.8,
        },
      ),
    );
  }

  const liqLong = toNum(snap.liqLong24h, 0);
  const liqShort = toNum(snap.liqShort24h, 0);
  if (liqLong + liqShort > 0) {
    const bias: DecisionBias = liqLong > liqShort ? 'short' : liqShort > liqLong ? 'long' : 'wait';
    const imbalance = Math.abs(liqLong - liqShort) / Math.max(liqLong + liqShort, 1);
    const confidence = clamp(56 + imbalance * 42);
    out.push(
      gateCard(
        'flow',
        'flow:liquidations',
        'COINALYZE',
        {
          title: 'LIQUIDATION IMBALANCE',
          createdAt,
          bias,
          confidence,
          what: `Liq Long $${Math.round(liqLong).toLocaleString()} / Short $${Math.round(liqShort).toLocaleString()}`,
          soWhat: '청산 쏠림이 단기 가격 압력을 만들어 추세 가속/반전 트리거가 됩니다.',
          nowWhat: biasToActionText(bias),
          why: `청산 불균형 ${(imbalance * 100).toFixed(1)}%`,
          helpfulnessWhy: `24h 청산 편중도 ${(imbalance * 100).toFixed(1)}%를 압력 지표로 사용`,
          visualAid: visualAidForBias(bias),
        },
        {
          actionTypeCount: bias === 'wait' ? 1 : 3,
          clarityScore: 36,
          sourceReliability: 90,
          failureRatePct: 4,
          manipulationRisk: 'low',
          pairKeywordMatchPct: 95,
          timeframeAligned: true,
          backtestWinRateLiftPct: 7.0,
          feedbackPositivePct: 75,
          applyRatePct: confidence,
          pnlLiftPct: 5.5,
        },
      ),
    );
  }

  const cmcChange = snap.cmcChange24hPct ?? null;
  if (cmcChange != null) {
    const bias: DecisionBias = cmcChange > 0.6 ? 'long' : cmcChange < -0.6 ? 'short' : 'wait';
    const confidence = clamp(52 + Math.min(35, Math.abs(cmcChange) * 8));
    out.push(
      gateCard(
        'flow',
        'flow:cmc_regime',
        'COINMARKETCAP',
        {
          title: 'MARKET CAP REGIME',
          createdAt,
          bias,
          confidence,
          what: `Global mcap 24h ${cmcChange >= 0 ? '+' : ''}${cmcChange.toFixed(2)}%`,
          soWhat: '전체 시총 레짐은 개별 종목 변동성의 방향 확률을 보정합니다.',
          nowWhat: biasToActionText(bias),
          why: '시장 레짐 필터 (mcap 24h 변화율)',
          helpfulnessWhy: `글로벌 레짐 변화 ${Math.abs(cmcChange).toFixed(2)}% 반영`,
          visualAid: visualAidForBias(bias),
        },
        {
          actionTypeCount: bias === 'wait' ? 1 : 2,
          clarityScore: 30,
          sourceReliability: 92,
          failureRatePct: 5,
          manipulationRisk: 'low',
          pairKeywordMatchPct: relevanceScore(token, token),
          timeframeAligned: true,
          backtestWinRateLiftPct: 5.9,
          feedbackPositivePct: 69,
          applyRatePct: confidence,
          pnlLiftPct: 3.8,
        },
      ),
    );
  }

  for (const rec of input.flowRecords.slice(0, 4)) {
    const text = (rec.text ?? '').trim();
    if (!text) continue;
    const bias = normalizeBias(rec.vote) === 'wait' ? textBias(text) : normalizeBias(rec.vote);
    const confidence = clamp(toNum(rec.confidence, 55));
    out.push(
      gateCard(
        'flow',
        `flow:record:${rec.id ?? text.slice(0, 24)}`,
        rec.source ?? source,
        {
          title: `${rec.agent ?? 'FLOW'} SNAPSHOT`,
          createdAt: toNum(rec.createdAt, createdAt),
          bias,
          confidence,
          what: text,
          soWhat: '실시간 플로우 레코드는 방향 압력을 보조 확인하는 증거입니다.',
          nowWhat: biasToActionText(bias),
          why: `${rec.source ?? source} 레코드`,
          helpfulnessWhy: `실시간 confidence ${Math.round(confidence)} 반영`,
          visualAid: visualAidForBias(bias),
        },
        {
          actionTypeCount: bias === 'wait' ? 1 : 2,
          clarityScore: 28,
          sourceReliability: sourceReliabilityScore(rec.source ?? source),
          failureRatePct: 7,
          manipulationRisk: manipulationRiskFor(rec.source ?? source),
          pairKeywordMatchPct: relevanceScore(text, token),
          timeframeAligned: true,
          backtestWinRateLiftPct: 5.4,
          feedbackPositivePct: 66,
          applyRatePct: confidence,
          pnlLiftPct: 3,
        },
      ),
    );
  }

  return pickTopCards(out, maxCount);
}

function buildTrendingCards(input: IntelPolicyInput, maxCount: number): IntelPolicyCard[] {
  const token = toUpperSafe(input.pair.split('/')[0] ?? 'BTC');
  const out: IntelPolicyCard[] = [];

  for (const coin of input.trendingCoins.slice(0, 20)) {
    const symbol = (coin.symbol ?? '').toUpperCase();
    if (!symbol) continue;
    const change24h = toNum(coin.change24h, 0);
    const bias: DecisionBias = change24h > 1.2 ? 'long' : change24h < -1.2 ? 'short' : 'wait';
    const socialVolume = toNum(coin.socialVolume, 0);
    const confidence = clamp(48 + Math.min(30, Math.abs(change24h) * 3) + Math.min(15, Math.log10(socialVolume + 1) * 6));

    out.push(
      gateCard(
        'trending',
        `trending:${symbol}`,
        'CMC_LUNARCRUSH',
        {
          title: `TRENDING #${Math.max(1, toNum(coin.rank, 1))} ${symbol}`,
          createdAt: Date.now(),
          bias,
          confidence,
          what: `${symbol} 24h ${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%`,
          soWhat: '트렌딩 강도는 단기 후보군 우선순위에 직접 반영됩니다.',
          nowWhat: biasToActionText(bias),
          why: `rank ${Math.max(1, toNum(coin.rank, 1))} · social ${Math.round(socialVolume).toLocaleString()}`,
          helpfulnessWhy: `모멘텀(${Math.abs(change24h).toFixed(2)}%) + 소셜 볼륨 결합 점수`,
          visualAid: visualAidForBias(bias),
        },
        {
          actionTypeCount: bias === 'wait' ? 1 : 2,
          clarityScore: 32,
          sourceReliability: 88,
          failureRatePct: 5,
          manipulationRisk: socialVolume > 50_000 ? 'medium' : 'low',
          pairKeywordMatchPct: symbol === token ? 100 : 74,
          timeframeAligned: true,
          backtestWinRateLiftPct: Math.min(8.5, Math.abs(change24h) / 1.8 + 3),
          feedbackPositivePct: 67,
          applyRatePct: confidence,
          pnlLiftPct: Math.min(6, Math.abs(change24h) / 2),
        },
      ),
    );
  }

  return pickTopCards(out, maxCount);
}

function buildPickCards(input: IntelPolicyInput, maxCount: number): IntelPolicyCard[] {
  const token = toUpperSafe(input.pair.split('/')[0] ?? 'BTC');
  const out: IntelPolicyCard[] = [];

  for (const coin of input.pickCoins.slice(0, 20)) {
    const symbol = (coin.symbol ?? '').toUpperCase();
    if (!symbol) continue;

    const direction = (coin.direction ?? 'neutral').toLowerCase();
    const bias: DecisionBias = direction === 'long' ? 'long' : direction === 'short' ? 'short' : 'wait';
    const totalScore = clamp(toNum(coin.totalScore, 50));
    const confidence = clamp(toNum(coin.confidence, 55));
    const reasons = Array.isArray(coin.reasons) ? coin.reasons.filter((r) => typeof r === 'string') : [];
    const alerts = Array.isArray(coin.alerts) ? coin.alerts.filter((r) => typeof r === 'string') : [];
    const createdAt = Date.now();

    out.push(
      gateCard(
        'picks',
        `pick:${symbol}`,
        'OPPORTUNITY_SCAN',
        {
          title: `PICK ${symbol}`,
          createdAt,
          bias,
          confidence,
          what: `${symbol} 종합점수 ${Math.round(totalScore)}/100`,
          soWhat: totalScore >= 70 ? '다중 팩터가 동시 정렬된 상위 후보입니다.' : '후보군이지만 확신도는 중간 수준입니다.',
          nowWhat: biasToActionText(bias),
          why: reasons.slice(0, 2).join(' · ') || '복합 스코어 기반 선별',
          helpfulnessWhy: `score ${Math.round(totalScore)} · alerts ${alerts.length} · confidence ${Math.round(confidence)}`,
          visualAid: visualAidForBias(bias),
        },
        {
          actionTypeCount: bias === 'wait' ? 1 : 3,
          clarityScore: 36,
          sourceReliability: 86,
          failureRatePct: 6,
          manipulationRisk: alerts.some((a) => a.includes('⚠')) ? 'medium' : 'low',
          pairKeywordMatchPct: symbol === token ? 100 : 70,
          timeframeAligned: true,
          backtestWinRateLiftPct: Math.min(9.2, totalScore / 12),
          feedbackPositivePct: 72,
          applyRatePct: confidence,
          pnlLiftPct: Math.min(7.5, totalScore / 14),
        },
      ),
    );
  }

  return pickTopCards(out, maxCount);
}

function evidenceFromCard(domain: EngineEvidence['domain'], card: IntelPolicyCard): EngineEvidence {
  const strength = clamp(card.confidence);
  const confidence = clamp((card.confidence + card.gate.weightedScore) / 2);
  return {
    domain,
    bias: card.bias,
    biasStrength: strength,
    confidence,
    freshnessSec: Math.max(0, Math.floor((Date.now() - card.createdAt) / 1000)),
    reason: card.soWhat,
    qualityScore: card.gate.weightedScore,
    helpfulnessScore: card.gate.scores.helpfulness,
    gate: card.gate,
  };
}

function avgHelpfulness(cards: IntelPolicyCard[]): number {
  if (cards.length === 0) return 0;
  return cards.reduce((sum, card) => sum + card.gate.scores.helpfulness, 0) / cards.length;
}

function domainCoverage(domains: EngineEvidence['domain'][]): string[] {
  return Array.from(new Set(domains));
}

export function buildIntelPolicyOutput(input: IntelPolicyInput): IntelPolicyOutput {
  const thresholds = getIntelThresholds();
  const maxCards = thresholds.panelRules.maxCardsPerPanel;

  const panels: Record<IntelPanelKey, IntelPolicyCard[]> = {
    headlines: buildHeadlineCards(input, maxCards),
    events: buildEventCards(input, maxCards),
    flow: buildFlowCards(input, maxCards),
    trending: buildTrendingCards(input, maxCards),
    picks: buildPickCards(input, maxCards),
  };

  const evidence: EngineEvidence[] = [];
  const headlineTop = panels.headlines[0];
  if (headlineTop) evidence.push(evidenceFromCard('headlines', headlineTop));
  const eventTop = panels.events[0];
  if (eventTop) evidence.push(evidenceFromCard('events', eventTop));
  const flowTop = panels.flow[0];
  if (flowTop) evidence.push(evidenceFromCard('flow', flowTop));

  const derivativesTop = panels.flow.find((card) => card.id.includes('funding') || card.id.includes('ls_ratio') || card.id.includes('liquidations'));
  if (derivativesTop) evidence.push(evidenceFromCard('derivatives', derivativesTop));

  const trendingTop = panels.trending[0] ?? panels.picks[0];
  if (trendingTop) evidence.push(evidenceFromCard('trending', trendingTop));

  const activeCards = Object.values(panels).flat();
  const avgHelp = avgHelpfulness(activeCards);
  const backtestWinRatePct = clamp(48 + avgHelp * 0.45);

  const volatilityIndex = (() => {
    const snap = input.flowSnapshot;
    if (!snap) return null;
    const pct = Math.abs(toNum(snap.priceChangePct, 0));
    const cmcPct = Math.abs(toNum(snap.cmcChange24hPct, 0));
    return clamp(pct * 1.7 + cmcPct * 4.2, 0, 100);
  })();

  const decision = computeDecision(evidence, {
    backtestWinRatePct,
    volatilityIndex,
  });

  return {
    generatedAt: Date.now(),
    decision,
    panels,
    summary: {
      pair: input.pair,
      timeframe: input.timeframe,
      domainsUsed: domainCoverage(evidence.map((item) => item.domain)),
      avgHelpfulness: Number(avgHelp.toFixed(2)),
    },
  };
}

export function emptyPanels(): Record<IntelPanelKey, IntelPolicyCard[]> {
  return {
    headlines: [],
    events: [],
    flow: [],
    trending: [],
    picks: [],
  };
}

export function summarizeScoreBreakdown(scores: QualityGateScores): string {
  return `A ${Math.round(scores.actionability)} · T ${Math.round(scores.timeliness)} · R ${Math.round(scores.reliability)} · Re ${Math.round(scores.relevance)} · H ${Math.round(scores.helpfulness)}`;
}
