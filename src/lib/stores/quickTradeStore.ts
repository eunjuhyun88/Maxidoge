// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — QuickTrade Store (Terminal 퀵 트레이드)
// Terminal에서의 독립적인 LONG/SHORT 포지션 트래킹
// Arena와 완전 분리 — 빠른 시그널 기반 트레이딩
// ═══════════════════════════════════════════════════════════════

import { writable, derived } from 'svelte/store';
import { STORAGE_KEYS } from './storageKeys';
import {
  closeQuickTradeApi,
  fetchQuickTradesApi,
  openQuickTradeApi,
  updateQuickTradePricesApi,
  type ApiQuickTrade,
} from '$lib/api/tradingApi';

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

const STORAGE_KEY = STORAGE_KEYS.quickTrades;
const MAX_TRADES = 200;
const PRICE_SYNC_DEBOUNCE_MS = 1200;
let _quickTradesHydrated = false;

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

function mapApiQuickTrade(row: ApiQuickTrade): QuickTrade {
  return {
    id: row.id,
    pair: row.pair,
    dir: row.dir,
    entry: Number(row.entry),
    tp: row.tp == null ? null : Number(row.tp),
    sl: row.sl == null ? null : Number(row.sl),
    currentPrice: Number(row.currentPrice),
    pnlPercent: Number(row.pnlPercent ?? 0),
    status: row.status,
    openedAt: Number(row.openedAt),
    closedAt: row.closedAt == null ? null : Number(row.closedAt),
    closePnl: row.closePnl == null ? null : Number(row.closePnl),
    source: row.source || 'manual',
    note: row.note || '',
  };
}

function mergeServerAndLocalTrades(serverTrades: QuickTrade[], localTrades: QuickTrade[]): QuickTrade[] {
  const serverIds = new Set(serverTrades.map((t) => t.id));
  const unsyncedLocal = localTrades.filter((t) => !serverIds.has(t.id));
  return [...serverTrades, ...unsyncedLocal]
    .sort((a, b) => b.openedAt - a.openedAt)
    .slice(0, MAX_TRADES);
}

export async function hydrateQuickTrades(force = false): Promise<void> {
  if (typeof window === 'undefined') return;
  if (_quickTradesHydrated && !force) return;

  const records = await fetchQuickTradesApi({ limit: MAX_TRADES, offset: 0 });
  if (!records) return;

  quickTradeStore.update((s) => ({
    ...s,
    trades: mergeServerAndLocalTrades(records.map(mapApiQuickTrade), s.trades),
  }));

  _quickTradesHydrated = true;
}

// ═══ Actions ═══

export function replaceQuickTradeId(localId: string, nextId: string, patch: Partial<QuickTrade> = {}) {
  quickTradeStore.update(s => ({
    ...s,
    trades: s.trades.map(t => (t.id === localId ? { ...t, id: nextId, ...patch } : t))
  }));
}

export function openQuickTrade(
  pair: string,
  dir: TradeDirection,
  entry: number,
  tp: number | null = null,
  sl: number | null = null,
  source: string = 'manual',
  note: string = '',
  sync: boolean = true
) {
  const localId = crypto.randomUUID();
  const trade: QuickTrade = {
    id: localId,
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

  if (sync && typeof window !== 'undefined') {
    void openQuickTradeApi({
      pair: trade.pair,
      dir: trade.dir,
      entry: trade.entry,
      tp: trade.tp,
      sl: trade.sl,
      currentPrice: trade.currentPrice,
      source: trade.source,
      note: trade.note,
    }).then((serverTrade) => {
      if (!serverTrade || !serverTrade.id) return;
      replaceQuickTradeId(localId, serverTrade.id, {
        currentPrice: serverTrade.currentPrice,
        pnlPercent: serverTrade.pnlPercent,
        status: serverTrade.status,
        openedAt: serverTrade.openedAt,
      });
    });
  }

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

  if (typeof window !== 'undefined') {
    void closeQuickTradeApi(tradeId, { closePrice: exitPrice, status: 'closed' }).then((serverTrade) => {
      if (!serverTrade) return;
      quickTradeStore.update(s => ({
        ...s,
        trades: s.trades.map(t => {
          if (t.id !== tradeId && t.id !== serverTrade.id) return t;
          return {
            ...t,
            id: serverTrade.id,
            currentPrice: serverTrade.currentPrice,
            pnlPercent: serverTrade.pnlPercent,
            status: serverTrade.status,
            closedAt: serverTrade.closedAt,
            closePnl: serverTrade.closePnl,
          };
        }),
      }));
    });
  }
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

let _lastPriceSnapshot = '';
let _priceSyncTimer: ReturnType<typeof setTimeout> | null = null;
export function updateAllPrices(
  prices: Record<string, number>,
  options: { syncServer?: boolean } = {}
) {
  const syncServer = options.syncServer ?? true;
  // Skip if prices haven't changed
  const snap = JSON.stringify(prices);
  if (snap === _lastPriceSnapshot) return;
  _lastPriceSnapshot = snap;

  let hasOpenTrades = false;
  quickTradeStore.update(s => {
    // Skip if no open trades
    hasOpenTrades = s.trades.some(t => t.status === 'open');
    if (!hasOpenTrades) return s;

    let changed = false;
    const trades = s.trades.map(t => {
      if (t.status !== 'open') return t;
      const token = t.pair.split('/')[0];
      const price = prices[token];
      if (!price || price === t.currentPrice) return t;
      changed = true;
      const pnl = t.dir === 'LONG'
        ? +((price - t.entry) / t.entry * 100).toFixed(2)
        : +((t.entry - price) / t.entry * 100).toFixed(2);
      return { ...t, currentPrice: price, pnlPercent: pnl };
    });
    return changed ? { ...s, trades } : s;
  });

  if (syncServer && hasOpenTrades && typeof window !== 'undefined') {
    if (_priceSyncTimer) clearTimeout(_priceSyncTimer);
    _priceSyncTimer = setTimeout(() => {
      void updateQuickTradePricesApi({ prices });
    }, PRICE_SYNC_DEBOUNCE_MS);
  }
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

if (typeof window !== 'undefined') {
  void hydrateQuickTrades();
}
