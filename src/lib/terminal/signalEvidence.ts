// ═══════════════════════════════════════════════════════════════
// STOCKCLAW — Signal Evidence Types & Builders
// 시그널 근거(evidence)를 구조화하여 "왜 이 포지션인가"를 전달
// ═══════════════════════════════════════════════════════════════

import type { AgentSignal } from '$lib/data/warroom';

// ── Types ──

export type EvidenceSource = 'ai-scan' | 'chart-observation' | 'manual';

export type EvidenceKind =
  | 'agent-vote'
  | 'consensus'
  | 'indicator'
  | 'pattern'
  | 'price-action'
  | 'user-note';

export interface EvidenceItem {
  kind: EvidenceKind;
  /** 짧은 표시 레이블 (예: "STRUCTURE LONG 82%", "RSI 34") */
  label: string;
  /** 상세 설명 텍스트 */
  detail: string;
  /** 에이전트 이름 (kind='agent-vote') */
  agent?: string;
  /** 투표 방향 */
  vote?: 'long' | 'short' | 'neutral';
  /** 신뢰도 0-100 */
  confidence?: number;
  /** 수치 값 (kind='indicator') */
  value?: number;
  /** 인디케이터/패턴 키 (렌더링 아이콘/색상용) */
  key?: string;
}

export interface SignalEvidence {
  source: EvidenceSource;
  /** 캡처 시각 (ISO 8601) */
  capturedAt: string;
  pair: string;
  timeframe: string;
  priceAtCapture: number;
  items: EvidenceItem[];
  /** Commander 요약 (AI 스캔 시) */
  commanderSummary?: string;
}

// ── Builders ──

/**
 * AI 스캔 결과에서 evidence를 조립한다.
 * WarRoom의 activeScanTab.signals (AgentSignal[])를 입력으로 받는다.
 */
export function buildAiScanEvidence(params: {
  signals: AgentSignal[];
  pair: string;
  timeframe: string;
  livePrice: number;
  commanderSummary?: string;
}): SignalEvidence {
  const { signals, pair, timeframe, livePrice, commanderSummary } = params;
  const items: EvidenceItem[] = [];

  // 1. Consensus (다수결 방향 + 평균 conf)
  const counts = { long: 0, short: 0, neutral: 0 };
  let totalConf = 0;
  for (const sig of signals) {
    counts[sig.vote]++;
    totalConf += sig.conf;
  }
  const avgConf = signals.length > 0 ? Math.round(totalConf / signals.length) : 0;
  const consensusDir =
    counts.long > counts.short ? 'long' : counts.short > counts.long ? 'short' : 'neutral';
  const arrow = consensusDir === 'long' ? '▲' : consensusDir === 'short' ? '▼' : '—';

  items.push({
    kind: 'consensus',
    label: `CONSENSUS ${arrow} ${consensusDir.toUpperCase()} ${avgConf}%`,
    detail: commanderSummary || `${signals.length}개 에이전트 분석 — ${consensusDir.toUpperCase()} 컨센서스 (${avgConf}%)`,
    vote: consensusDir,
    confidence: avgConf,
  });

  // 2. Individual agent votes
  for (const sig of signals) {
    if (sig.vote === 'neutral') continue; // neutral 에이전트는 목록에서 제외 (노이즈 감소)
    const voteArrow = sig.vote === 'long' ? '▲' : '▼';
    items.push({
      kind: 'agent-vote',
      label: `${sig.name} ${voteArrow} ${sig.conf}%`,
      detail: sig.text || `${sig.name}: ${sig.vote.toUpperCase()} ${sig.pair} (${sig.conf}%)`,
      agent: sig.name,
      vote: sig.vote,
      confidence: sig.conf,
      key: sig.agentId,
    });
  }

  return {
    source: 'ai-scan',
    capturedAt: new Date().toISOString(),
    pair,
    timeframe,
    priceAtCapture: livePrice,
    items,
    commanderSummary,
  };
}

/** 인디케이터 스냅샷 입력 */
export interface IndicatorSnapshot {
  rsi?: number;
  ma20?: number;
  ma60?: number;
  ma120?: number;
  volume?: number;
}

/** 패턴 감지 입력 */
export interface PatternDetection {
  kind: string;
  shortName: string;
  direction: string;
  status: string;
  confidence: number;
}

/**
 * 차트 관찰에서 evidence를 조립한다.
 * ChartPanel의 인디케이터 값, 패턴 감지 결과를 입력으로 받는다.
 */
export function buildChartObservationEvidence(params: {
  pair: string;
  timeframe: string;
  livePrice: number;
  indicators?: IndicatorSnapshot;
  patterns?: PatternDetection[];
  agentSetupName?: string;
  agentSetupConf?: number;
  agentSetupDir?: 'LONG' | 'SHORT';
}): SignalEvidence {
  const { pair, timeframe, livePrice, indicators, patterns } = params;
  const items: EvidenceItem[] = [];

  // RSI
  if (indicators?.rsi && indicators.rsi > 0) {
    const rsi = Math.round(indicators.rsi);
    const zone = rsi < 30 ? '과매도' : rsi > 70 ? '과매수' : '중립';
    items.push({
      kind: 'indicator',
      label: `RSI ${rsi}`,
      detail: `RSI ${rsi} — ${zone} 구간`,
      key: 'rsi',
      value: rsi,
    });
  }

  // MA position
  if (indicators?.ma20 && indicators.ma20 > 0) {
    const above = livePrice > indicators.ma20;
    items.push({
      kind: 'indicator',
      label: above ? 'Price > MA20' : 'Price < MA20',
      detail: `현재가 ${livePrice.toLocaleString()} ${above ? '>' : '<'} MA20 ${indicators.ma20.toLocaleString()}`,
      key: 'ma-position',
      value: indicators.ma20,
    });
  }

  if (indicators?.ma60 && indicators.ma20 && indicators.ma60 > 0 && indicators.ma20 > 0) {
    const goldenCross = indicators.ma20 > indicators.ma60;
    items.push({
      kind: 'indicator',
      label: goldenCross ? 'MA20 > MA60' : 'MA20 < MA60',
      detail: `MA20 ${indicators.ma20.toLocaleString()} ${goldenCross ? '>' : '<'} MA60 ${indicators.ma60.toLocaleString()} — ${goldenCross ? '골든크로스' : '데드크로스'} 구간`,
      key: 'ma-cross',
      value: indicators.ma20,
    });
  }

  // Patterns
  for (const p of patterns ?? []) {
    const confPct = Math.round(p.confidence * 100);
    const dirArrow = p.direction === 'bullish' ? '▲' : p.direction === 'bearish' ? '▼' : '—';
    items.push({
      kind: 'pattern',
      label: `${p.shortName} ${dirArrow}`,
      detail: `${p.shortName} 패턴 (${p.status}) — ${p.direction} ${confPct}%`,
      key: p.kind,
      confidence: confPct,
      vote: p.direction === 'bullish' ? 'long' : p.direction === 'bearish' ? 'short' : 'neutral',
    });
  }

  // Active agent trade setup (if present from scan)
  if (params.agentSetupName && params.agentSetupConf && params.agentSetupDir) {
    const arrow = params.agentSetupDir === 'LONG' ? '▲' : '▼';
    items.push({
      kind: 'agent-vote',
      label: `${params.agentSetupName} ${arrow} ${params.agentSetupConf}%`,
      detail: `${params.agentSetupName} 셋업: ${params.agentSetupDir} (${params.agentSetupConf}% 신뢰도)`,
      agent: params.agentSetupName,
      vote: params.agentSetupDir === 'LONG' ? 'long' : 'short',
      confidence: params.agentSetupConf,
    });
  }

  return {
    source: 'chart-observation',
    capturedAt: new Date().toISOString(),
    pair,
    timeframe,
    priceAtCapture: livePrice,
    items,
  };
}

/**
 * Evidence에서 방향(dir)을 추론한다.
 * 다수결 기반 — consensus > agent-votes > patterns 순서.
 */
export function inferDirectionFromEvidence(evidence: SignalEvidence | null | undefined): 'LONG' | 'SHORT' | null {
  if (!evidence?.items?.length) return null;

  const consensus = evidence.items.find((i) => i.kind === 'consensus');
  if (consensus?.vote === 'long') return 'LONG';
  if (consensus?.vote === 'short') return 'SHORT';

  // Fallback: agent votes 다수결
  let long = 0;
  let short = 0;
  for (const item of evidence.items) {
    if (item.vote === 'long') long++;
    if (item.vote === 'short') short++;
  }
  if (long > short) return 'LONG';
  if (short > long) return 'SHORT';
  return null;
}
