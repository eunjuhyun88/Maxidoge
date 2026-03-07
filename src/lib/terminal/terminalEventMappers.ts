import type { SignalAttachment } from '$lib/stores/communityStore';
import type {
  AgentTradeSetup,
  ChartCommunitySignal,
  ChatMsg,
  ScanIntelDetail,
  TerminalTradeSignal,
} from './terminalTypes';

export function formatTerminalClock(date: Date = new Date()): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function buildScanCompletionMessages(detail: ScanIntelDetail, time: string): ChatMsg[] {
  const dirEmoji = detail.consensus === 'long' ? '🟢' : detail.consensus === 'short' ? '🔴' : '⚪';
  return [
    {
      from: 'SYSTEM',
      icon: '⚡',
      color: '#E8967D',
      text: `SCAN COMPLETE — ${detail.pair} ${detail.timeframe.toUpperCase()} (${detail.label})`,
      time,
      isUser: false,
      isSystem: true,
    },
    {
      from: 'COMMANDER',
      icon: '🧠',
      color: '#ff2d9b',
      text:
        `${dirEmoji} VERDICT: ${detail.consensus.toUpperCase()} — Confidence ${detail.avgConfidence}%\n` +
        `${detail.summary}\n📊 차트에 TP/SL 표시됨 · 왼쪽 시그널 카드에서 개별 에이전트 확인`,
      time,
      isUser: false,
    },
  ];
}

export function buildConsensusTradeSetup(detail: ScanIntelDetail): AgentTradeSetup | null {
  if (!detail.signals.length || detail.consensus === 'neutral') return null;
  const dirSignals = detail.signals.filter((signal) => signal.vote === detail.consensus);
  if (dirSignals.length === 0) return null;

  const avgEntry = dirSignals.reduce((sum, signal) => sum + signal.entry, 0) / dirSignals.length;
  const avgTp = dirSignals.reduce((sum, signal) => sum + signal.tp, 0) / dirSignals.length;
  const avgSl = dirSignals.reduce((sum, signal) => sum + signal.sl, 0) / dirSignals.length;
  const risk = Math.abs(avgEntry - avgSl);
  const reward = Math.abs(avgTp - avgEntry);

  return {
    source: 'consensus',
    dir: detail.consensus === 'long' ? 'LONG' : 'SHORT',
    entry: avgEntry,
    tp: avgTp,
    sl: avgSl,
    rr: risk > 0 ? reward / risk : 2,
    conf: detail.avgConfidence,
    pair: detail.pair,
  };
}

export function buildAgentTradeSetup(signal: TerminalTradeSignal): AgentTradeSetup | null {
  if (signal.vote === 'neutral' || !signal.entry || !signal.tp || !signal.sl) return null;
  const risk = Math.abs(signal.entry - signal.sl);
  const reward = Math.abs(signal.tp - signal.entry);
  return {
    source: 'agent',
    agentName: signal.name,
    dir: signal.vote === 'long' ? 'LONG' : 'SHORT',
    entry: signal.entry,
    tp: signal.tp,
    sl: signal.sl,
    rr: risk > 0 ? reward / risk : 2,
    conf: signal.conf,
    pair: signal.pair,
  };
}

/**
 * Convert an agent's trade signal (from WarRoom) into a ChartCommunitySignal
 * suitable for the share modal prefill pipeline.
 * Returns null for neutral signals or missing price data.
 */
export function agentSignalToCommunitySignal(
  signal: TerminalTradeSignal,
): ChartCommunitySignal | null {
  if (signal.vote === 'neutral' || !signal.entry || !signal.tp || !signal.sl) return null;
  if (![signal.entry, signal.tp, signal.sl].every((v) => Number.isFinite(v) && v > 0)) return null;
  return {
    pair: signal.pair,
    dir: signal.vote === 'long' ? 'LONG' : 'SHORT',
    entry: signal.entry,
    tp: signal.tp,
    sl: signal.sl,
    conf: signal.conf,
    source: signal.name,
    reason: `${signal.name} AI: ${signal.vote.toUpperCase()} ${signal.pair}`,
    openCopyTrade: false,
  };
}

export function normalizeCommunitySignalConfidence(confidence: number): number {
  return Math.max(1, Math.min(100, Math.round(confidence || 68)));
}

export function buildCommunitySignalAttachment(
  detail: ChartCommunitySignal,
  timeframeLabel: string,
  confidence: number,
): SignalAttachment {
  return {
    pair: detail.pair,
    dir: detail.dir,
    entry: detail.entry,
    tp: detail.tp,
    sl: detail.sl,
    conf: confidence,
    timeframe: timeframeLabel,
    reason: detail.reason,
  };
}

export function formatCommunitySignalPost(
  detail: ChartCommunitySignal,
  timeframeLabel: string,
): string {
  const rr = Math.abs(detail.entry - detail.sl) > 0
    ? Math.abs(detail.tp - detail.entry) / Math.abs(detail.entry - detail.sl)
    : 2;

  return [
    `[${detail.source}] ${detail.dir} ${detail.pair}`,
    `Entry ${Math.round(detail.entry).toLocaleString()} | TP ${Math.round(detail.tp).toLocaleString()} | SL ${Math.round(detail.sl).toLocaleString()}`,
    `Conf ${Math.round(detail.conf)}% | RR 1:${rr.toFixed(1)} | TF ${timeframeLabel}`,
    detail.reason,
  ].join('\n');
}

export function buildCommunitySignalMessage(params: {
  detail: ChartCommunitySignal;
  confidence: number;
  time: string;
}): ChatMsg {
  const { detail, confidence, time } = params;
  return {
    from: 'SYSTEM',
    icon: '📡',
    color: '#E8967D',
    text:
      `COMMUNITY SIGNAL CREATED — ${detail.dir} ${detail.pair} (${confidence}%)` +
      `${detail.openCopyTrade !== false ? '\nCopy Trade modal opened.' : ''}`,
    time,
    isUser: false,
    isSystem: true,
  };
}

export function buildPatternScanUnavailableMessage(time: string): ChatMsg {
  return {
    from: 'SYSTEM',
    icon: '⚠️',
    color: '#ff8c3b',
    text: '차트가 준비되지 않아 패턴 스캔을 실행하지 못했습니다.',
    time,
    isUser: false,
    isSystem: true,
  };
}

export function buildPatternScanErrorMessage(time: string): ChatMsg {
  return {
    from: 'SYSTEM',
    icon: '⚠️',
    color: '#ff8c3b',
    text: '패턴 스캔 실행 중 오류가 발생했습니다.',
    time,
    isUser: false,
    isSystem: true,
  };
}

export function buildPatternScanResultMessage(text: string, time: string): ChatMsg {
  return {
    from: 'ORCHESTRATOR',
    icon: '🧠',
    color: '#ff2d9b',
    text,
    time,
    isUser: false,
  };
}
