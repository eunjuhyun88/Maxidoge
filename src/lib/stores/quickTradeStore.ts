// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — QuickTrade Store (Terminal 퀵 트레이드)
// Terminal에서의 독립적인 LONG/SHORT 포지션 트래킹
// Arena와 완전 분리 — 빠른 시그널 기반 트레이딩
// ═══════════════════════════════════════════════════════════════

import { writable, derived } from 'svelte/store';

export type TradeDirection = 'LONG' | 'SHORT';
export type TradeStatus = 'open' | 'closed' | 'stopped';

export interface QuickTrade {
  id: string;
  pair: string;
  dir: TradeDirection;
  entry: number;
  tp: number | null;       // take profit (optional)
  sl: number | null;       // stop loss (optional)
  currentPrice: number;
  pnlPercent: number;
  status: TradeStatus;
  openedAt: number;
  closedAt: number | null;
  closePnl: number | null; // final PnL when closed
  source: string;          // 'manual' | agent name
  note: string;
}

interface QuickTradeState {
  trades: QuickTrade[];
  showPanel: boolean;      // toggle trade panel visibility
}

const STORAGE_KEY = 'maxidoge_quicktrades';
const MAX_TRADES = 200;

function loadState(): QuickTradeState {
  if (typeof window === 'undefined') return { trades: [], showPanel: false };
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { trades: parsed.trades || [], showPanel: false };
    }
  } catch {}
  return { trades: [], showPanel: false };
}

export const quickTradeStore = writable<QuickTradeState>(loadState());

// Persist (debounced)
let _saveTimer: ReturnType<typeof setTimeout> | null = null;
quickTradeStore.subscribe(s => {
  if (typeof window === 'undefined') return;
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ trades: s.trades }));
  }, 400);
});

// ═══ Derived ═══
export const openTrades = derived(quickTradeStore, $s =>
  $s.trades.filter(t => t.status === 'open')
);

export const closedTrades = derived(quickTradeStore, $s =>
  $s.trades.filter(t => t.status !== 'open')
);

export const totalQuickPnL = derived(quickTradeStore, $s =>
  $s.trades
    .filter(t => t.closePnl !== null)
    .reduce((sum, t) => sum + (t.closePnl || 0), 0)
);

export const openTradeCount = derived(quickTradeStore, $s =>
  $s.trades.filter(t => t.status === 'open').length
);

// ═══ Actions ═══

export function openQuickTrade(
  pair: string,
  dir: TradeDirection,
  entry: number,
  tp: number | null = null,
  sl: number | null = null,
  source: string = 'manual',
  note: string = ''
) {
  const trade: QuickTrade = {
    id: crypto.randomUUID(),
    pair,
    dir,
    entry,
    tp,
    sl,
    currentPrice: entry,
    pnlPercent: 0,
    status: 'open',
    openedAt: Date.now(),
    closedAt: null,
    closePnl: null,
    source,
    note
  };

  quickTradeStore.update(s => ({
    ...s,
    trades: [trade, ...s.trades].slice(0, MAX_TRADES),
    showPanel: true
  }));

  return trade.id;
}

export function closeQuickTrade(tradeId: string, exitPrice: number) {
  quickTradeStore.update(s => ({
    ...s,
    trades: s.trades.map(t => {
      if (t.id !== tradeId || t.status !== 'open') return t;
      const pnl = t.dir === 'LONG'
        ? +((exitPrice - t.entry) / t.entry * 100).toFixed(2)
        : +((t.entry - exitPrice) / t.entry * 100).toFixed(2);
      return {
        ...t,
        status: 'closed' as TradeStatus,
        currentPrice: exitPrice,
        pnlPercent: pnl,
        closePnl: pnl,
        closedAt: Date.now()
      };
    })
  }));
}

export function updateTradePrice(tradeId: string, currentPrice: number) {
  quickTradeStore.update(s => ({
    ...s,
    trades: s.trades.map(t => {
      if (t.id !== tradeId || t.status !== 'open') return t;
      const pnl = t.dir === 'LONG'
        ? +((currentPrice - t.entry) / t.entry * 100).toFixed(2)
        : +((t.entry - currentPrice) / t.entry * 100).toFixed(2);
      return { ...t, currentPrice, pnlPercent: pnl };
    })
  }));
}

export function updateAllPrices(prices: Record<string, number>) {
  quickTradeStore.update(s => ({
    ...s,
    trades: s.trades.map(t => {
      if (t.status !== 'open') return t;
      // Extract base token from pair (e.g. "BTC/USDT" → "BTC")
      const token = t.pair.split('/')[0];
      const price = prices[token];
      if (!price) return t;
      const pnl = t.dir === 'LONG'
        ? +((price - t.entry) / t.entry * 100).toFixed(2)
        : +((t.entry - price) / t.entry * 100).toFixed(2);
      return { ...t, currentPrice: price, pnlPercent: pnl };
    })
  }));
}

export function toggleTradePanel() {
  quickTradeStore.update(s => ({ ...s, showPanel: !s.showPanel }));
}

export function clearClosedTrades() {
  quickTradeStore.update(s => ({
    ...s,
    trades: s.trades.filter(t => t.status === 'open')
  }));
}
