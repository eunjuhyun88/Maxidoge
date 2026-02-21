// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — Match History Store (localStorage persisted)
// ═══════════════════════════════════════════════════════════════

import { writable, derived } from 'svelte/store';

export interface MatchRecord {
  id: string;
  matchN: number;
  timestamp: number;
  win: boolean;
  lp: number;
  score: number;
  streak: number;

  // Squad details
  agents: string[];             // agent IDs
  agentVotes: Array<{
    agentId: string;
    name: string;
    icon: string;
    color: string;
    dir: string;
    conf: number;
  }>;

  // Hypothesis
  hypothesis: {
    dir: string;
    conf: number;
    tf: string;
    entry: number;
    tp: number;
    sl: number;
    rr: number;
  } | null;

  // Result details
  battleResult: string | null;
  consensusType: string | null;
  lpMult: number;

  // Signals summary
  signals: string[];
}

interface MatchHistoryState {
  records: MatchRecord[];
}

const STORAGE_KEY = 'maxidoge_match_history';
const MAX_RECORDS = 100;

function loadHistory(): MatchHistoryState {
  if (typeof window === 'undefined') return { records: [] };
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return { records: [] };
}

export const matchHistoryStore = writable<MatchHistoryState>(loadHistory());

// Persist to localStorage (debounced)
let _histSaveTimer: ReturnType<typeof setTimeout> | null = null;
matchHistoryStore.subscribe(s => {
  if (typeof window === 'undefined') return;
  if (_histSaveTimer) clearTimeout(_histSaveTimer);
  _histSaveTimer = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  }, 500);
});

// Derived stores
export const matchRecords = derived(matchHistoryStore, $s => $s.records);
export const winRate = derived(matchHistoryStore, $s => {
  if ($s.records.length === 0) return 0;
  return Math.round(($s.records.filter(r => r.win).length / $s.records.length) * 100);
});
export const avgLP = derived(matchHistoryStore, $s => {
  if ($s.records.length === 0) return 0;
  return Math.round($s.records.reduce((sum, r) => sum + r.lp, 0) / $s.records.length);
});
export const bestStreak = derived(matchHistoryStore, $s => {
  let best = 0;
  let cur = 0;
  for (const r of $s.records) {
    if (r.win) { cur++; if (cur > best) best = cur; }
    else { cur = 0; }
  }
  return best;
});

export function addMatchRecord(record: Omit<MatchRecord, 'id' | 'timestamp'>) {
  matchHistoryStore.update(s => ({
    records: [
      { ...record, id: crypto.randomUUID(), timestamp: Date.now() },
      ...s.records
    ].slice(0, MAX_RECORDS)
  }));
}
