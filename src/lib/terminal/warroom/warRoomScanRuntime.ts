import type { AgentSignal } from '$lib/data/warroom';
import { AGENT_POOL } from '$lib/engine/agents';
import type { TerminalScanDetail, TerminalScanSignal } from '$lib/services/scanService';
import type { ScanHighlight, ScanTab, SignalDiff } from './warRoomTypes';

type PreviousSignalState = {
  vote: AgentSignal['vote'];
  conf: number;
};

export type WarRoomScanSnapshot = {
  scanId: string;
  pair: string;
  timeframe: string;
  token: string;
  createdAt: number;
  label: string;
  consensus: AgentSignal['vote'];
  avgConfidence: number;
  summary: string;
  highlights: ScanHighlight[];
  signals: AgentSignal[];
};

function resolveAgentMeta(agentId: string): { icon: string; color: string } {
  const key = agentId.toUpperCase() as keyof typeof AGENT_POOL;
  const pool = AGENT_POOL[key] ?? AGENT_POOL[agentId as keyof typeof AGENT_POOL];
  return {
    icon: pool?.icon ?? '🤖',
    color: pool?.color ?? '#888',
  };
}

export function serverSignalToAgent(sig: TerminalScanSignal, pair: string, token: string): AgentSignal {
  const meta = resolveAgentMeta(sig.agentId);
  return {
    id: sig.id,
    agentId: sig.agentId,
    icon: meta.icon,
    name: sig.name || sig.agentId,
    color: meta.color,
    token,
    pair,
    vote: sig.vote as AgentSignal['vote'],
    conf: sig.conf,
    text: sig.text,
    src: sig.src,
    time: sig.time,
    entry: sig.entry,
    tp: sig.tp,
    sl: sig.sl,
  };
}

export function mapTerminalSignalsToAgentSignals(
  signals: TerminalScanSignal[],
  pair: string,
  token: string,
): AgentSignal[] {
  return signals.map((signal) => serverSignalToAgent(signal, pair, token));
}

export function hydrateServerScanTab(
  scanTabs: ScanTab[],
  tabId: string,
  detail: TerminalScanDetail,
): ScanTab[] {
  const signals = mapTerminalSignalsToAgentSignals(detail.signals, detail.pair, detail.token);
  return scanTabs.map((tab) => (tab.id === tabId ? { ...tab, signals } : tab));
}

export function mapScanResultSnapshot(detail: TerminalScanDetail): WarRoomScanSnapshot {
  return {
    scanId: detail.scanId,
    pair: detail.pair,
    timeframe: detail.timeframe,
    token: detail.token,
    createdAt: detail.createdAt,
    label: detail.label,
    consensus: detail.consensus as AgentSignal['vote'],
    avgConfidence: detail.avgConfidence,
    summary: detail.summary,
    highlights: detail.highlights as ScanHighlight[],
    signals: mapTerminalSignalsToAgentSignals(detail.signals, detail.pair, detail.token),
  };
}

export function upsertScanTab(
  scanTabs: ScanTab[],
  scan: WarRoomScanSnapshot,
  maxSignalsPerTab: number,
): ScanTab {
  const existingTab = scanTabs.find((tab) => tab.pair === scan.pair && tab.timeframe === scan.timeframe);
  if (existingTab) {
    return {
      ...existingTab,
      token: scan.token,
      createdAt: scan.createdAt,
      label: scan.label,
      signals: [...scan.signals, ...existingTab.signals].slice(0, maxSignalsPerTab),
    };
  }

  return {
    id: `server-${scan.scanId}`,
    pair: scan.pair,
    timeframe: scan.timeframe,
    token: scan.token,
    createdAt: scan.createdAt,
    label: scan.label,
    signals: scan.signals,
  };
}

function buildPreviousSignalMap(signals: AgentSignal[]): Map<string, PreviousSignalState> {
  const previousSignals = new Map<string, PreviousSignalState>();
  for (const sig of signals) {
    previousSignals.set(`${sig.agentId}:${sig.token}`, { vote: sig.vote, conf: sig.conf });
  }
  return previousSignals;
}

// Diff는 새 시그널 집합에만 붙인다. 이전 state는 key(agentId:token) 기준으로 비교한다.
export function buildSignalDiffs(
  previousSignals: AgentSignal[],
  nextSignals: AgentSignal[],
): Map<string, SignalDiff> {
  const diffs = new Map<string, SignalDiff>();
  const previousSignalMap = buildPreviousSignalMap(previousSignals);

  for (const sig of nextSignals) {
    const prev = previousSignalMap.get(`${sig.agentId}:${sig.token}`);
    if (!prev) {
      diffs.set(sig.id, { prevVote: null, confDelta: 0, voteChanged: false, isNew: true });
      continue;
    }

    const voteChanged = prev.vote !== sig.vote;
    diffs.set(sig.id, {
      prevVote: voteChanged ? prev.vote : null,
      confDelta: sig.conf - prev.conf,
      voteChanged,
      isNew: false,
    });
  }

  return diffs;
}
