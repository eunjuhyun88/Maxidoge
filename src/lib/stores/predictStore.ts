// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — Predict Store (Polymarket state)
// ═══════════════════════════════════════════════════════════════

import { writable, derived } from 'svelte/store';
import { fetchPolymarkets, type PolyMarket } from '$lib/api/polymarket';
import { STORAGE_KEYS } from './storageKeys';

export interface PredictPosition {
  id: string;
  marketId: string;
  marketTitle: string;
  direction: 'YES' | 'NO';
  entryOdds: number;
  amount: number;
  currentOdds: number;
  settled: boolean;
  pnl: number | null;
  timestamp: number;
}

interface PredictState {
  markets: PolyMarket[];
  loading: boolean;
  error: string | null;
  lastFetch: number;
  categoryFilter: string;
  userVotes: Record<string, 'YES' | 'NO'>;
  positions: PredictPosition[];
}

// Load positions from localStorage
function loadPositions(): PredictPosition[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.predictPositions);
    if (saved) return JSON.parse(saved);
  } catch {}
  return [];
}

export const predictStore = writable<PredictState>({
  markets: [],
  loading: false,
  error: null,
  lastFetch: 0,
  categoryFilter: '',
  userVotes: {},
  positions: loadPositions()
});

// Persist positions
let _posSaveTimer: ReturnType<typeof setTimeout> | null = null;
predictStore.subscribe(s => {
  if (typeof window === 'undefined') return;
  if (_posSaveTimer) clearTimeout(_posSaveTimer);
  _posSaveTimer = setTimeout(() => {
    localStorage.setItem(STORAGE_KEYS.predictPositions, JSON.stringify(s.positions));
  }, 300);
});

export const predictMarkets = derived(predictStore, $s => {
  if (!$s.categoryFilter) return $s.markets;
  return $s.markets.filter(m =>
    m.category.toLowerCase().includes($s.categoryFilter.toLowerCase()) ||
    m.question.toLowerCase().includes($s.categoryFilter.toLowerCase())
  );
});

export const predictLoading = derived(predictStore, $s => $s.loading);

export async function loadPolymarkets() {
  predictStore.update(s => ({ ...s, loading: true, error: null }));

  try {
    const markets = await fetchPolymarkets(50);
    predictStore.update(s => ({
      ...s,
      markets,
      loading: false,
      lastFetch: Date.now()
    }));
  } catch (err) {
    predictStore.update(s => ({
      ...s,
      loading: false,
      error: 'Failed to load prediction markets'
    }));
  }
}

export function setCategoryFilter(cat: string) {
  predictStore.update(s => ({ ...s, categoryFilter: cat }));
}

export function voteMarket(marketId: string, vote: 'YES' | 'NO') {
  predictStore.update(s => ({
    ...s,
    userVotes: { ...s.userVotes, [marketId]: vote }
  }));
}

// ═══ Position System ═══

export const openPositions = derived(predictStore, $s =>
  $s.positions.filter(p => !p.settled)
);

export const settledPositions = derived(predictStore, $s =>
  $s.positions.filter(p => p.settled)
);

export const totalPositionPnL = derived(predictStore, $s =>
  $s.positions.filter(p => p.settled && p.pnl !== null).reduce((sum, p) => sum + (p.pnl || 0), 0)
);

export function openPosition(marketId: string, marketTitle: string, direction: 'YES' | 'NO', entryOdds: number, amount: number) {
  const pos: PredictPosition = {
    id: crypto.randomUUID(),
    marketId,
    marketTitle,
    direction,
    entryOdds,
    amount,
    currentOdds: entryOdds,
    settled: false,
    pnl: null,
    timestamp: Date.now()
  };

  predictStore.update(s => ({
    ...s,
    positions: [pos, ...s.positions].slice(0, 100)
  }));
}

export function closePosition(positionId: string, exitOdds: number) {
  predictStore.update(s => ({
    ...s,
    positions: s.positions.map(p => {
      if (p.id !== positionId || p.settled) return p;
      // PnL = (exitOdds - entryOdds) * amount for YES, inverse for NO
      const oddsChange = p.direction === 'YES'
        ? (exitOdds - p.entryOdds)
        : (p.entryOdds - exitOdds);
      const pnl = +(oddsChange * p.amount).toFixed(2);
      return { ...p, settled: true, currentOdds: exitOdds, pnl };
    })
  }));
}

export function settlePosition(positionId: string, won: boolean) {
  predictStore.update(s => ({
    ...s,
    positions: s.positions.map(p => {
      if (p.id !== positionId || p.settled) return p;
      // Win: amount * (1/entryOdds - 1), Loss: -amount
      const pnl = won ? +(p.amount * (1 / p.entryOdds - 1)).toFixed(2) : -p.amount;
      return { ...p, settled: true, pnl };
    })
  }));
}
