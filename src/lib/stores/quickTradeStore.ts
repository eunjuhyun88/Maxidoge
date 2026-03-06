// ═══════════════════════════════════════════════════════════════
// STOCKCLAW — QuickTrade Store (Terminal 퀵 트레이드)
// Terminal에서의 독립적인 LONG/SHORT 포지션 트래킹
// Arena와 완전 분리 — 빠른 시그널 기반 트레이딩
// ═══════════════════════════════════════════════════════════════

import { writable, derived, get } from 'svelte/store';
import { calcPnlPercent } from '$lib/utils/pnl';
import { STORAGE_KEYS } from './storageKeys';
import {
  closeQuickTradeApi,
  fetchQuickTradesApi,
  openQuickTradeApi,
  updateQuickTradePricesApi,
  type ApiQuickTrade,
} from '$lib/api/tradingApi';
import { buildPriceMapHash, getBaseSymbolFromPair, toNumericPriceMap, type PriceLikeMap } from '$lib/utils/price';

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
const QUICK_TRADE_RECONCILE_WINDOW_MS = 45_000;
let _quickTradesHydrated = false;
let _quickTradesHydratePromise: Promise<void> | null = null;

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

function sortAndClampTrades(trades: QuickTrade[]): QuickTrade[] {
  return [...trades]
    .sort((a, b) => b.openedAt - a.openedAt)
    .slice(0, MAX_TRADES);
}

function normalizeTradeText(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeTradeNumber(value: number | null): string {
  if (value == null) return 'null';
  return Number(value).toFixed(8);
}

function buildQuickTradeReconcileKey(trade: Pick<QuickTrade, 'pair' | 'dir' | 'entry' | 'tp' | 'sl' | 'status' | 'source' | 'note'>): string {
  return [
    trade.pair.toUpperCase(),
    trade.dir,
    normalizeTradeNumber(trade.entry),
    normalizeTradeNumber(trade.tp),
    normalizeTradeNumber(trade.sl),
    trade.status,
    normalizeTradeText(trade.source),
    normalizeTradeText(trade.note),
  ].join('|');
}

function isHydrationDuplicate(serverTrade: QuickTrade, localTrade: QuickTrade): boolean {
  if (localTrade.status !== 'open' || serverTrade.status !== 'open') return false;
  if (buildQuickTradeReconcileKey(serverTrade) !== buildQuickTradeReconcileKey(localTrade)) return false;
  return Math.abs(serverTrade.openedAt - localTrade.openedAt) <= QUICK_TRADE_RECONCILE_WINDOW_MS;
}

function mergeServerAndLocalTrades(serverTrades: QuickTrade[], localTrades: QuickTrade[]): QuickTrade[] {
  const serverIds = new Set(serverTrades.map((t) => t.id));
  const matchedLocalIds = new Set<string>();

  for (const serverTrade of serverTrades) {
    const matchedLocal = localTrades.find((localTrade) => {
      if (matchedLocalIds.has(localTrade.id)) return false;
      if (serverIds.has(localTrade.id)) return false;
      return isHydrationDuplicate(serverTrade, localTrade);
    });
    if (matchedLocal) matchedLocalIds.add(matchedLocal.id);
  }

  const unsyncedLocal = localTrades.filter((t) => !serverIds.has(t.id) && !matchedLocalIds.has(t.id));
  return sortAndClampTrades([...serverTrades, ...unsyncedLocal]);
}

function mergeServerTradeIntoList(
  trades: QuickTrade[],
  serverTrade: QuickTrade,
  options: { localId?: string; patch?: Partial<QuickTrade> } = {}
): QuickTrade[] {
  const localTrade = options.localId ? trades.find((trade) => trade.id === options.localId) : null;
  const existingServerTrade = trades.find((trade) => trade.id === serverTrade.id);

  const mergedTrade: QuickTrade = {
    ...(existingServerTrade ?? {}),
    ...(localTrade ?? {}),
    ...serverTrade,
    ...(options.patch ?? {}),
    id: serverTrade.id,
  } as QuickTrade;

  return sortAndClampTrades(
    [
      mergedTrade,
      ...trades.filter((trade) => trade.id !== serverTrade.id && trade.id !== options.localId),
    ]
  );
}

function replaceTradeIdInList(trades: QuickTrade[], localId: string, nextId: string, patch: Partial<QuickTrade> = {}): QuickTrade[] {
  const localTrade = trades.find((trade) => trade.id === localId);
  const existingNextTrade = trades.find((trade) => trade.id === nextId);
  if (!localTrade && !existingNextTrade) return trades;

  const mergedTrade: QuickTrade = {
    ...(existingNextTrade ?? {}),
    ...(localTrade ?? {}),
    ...patch,
    id: nextId,
  } as QuickTrade;

  return sortAndClampTrades(
    [
      mergedTrade,
      ...trades.filter((trade) => trade.id !== localId && trade.id !== nextId),
    ]
  );
}

export async function hydrateQuickTrades(force = false): Promise<void> {
  if (typeof window === 'undefined') return;
  if (_quickTradesHydrated && !force) return;
  if (_quickTradesHydratePromise) return _quickTradesHydratePromise;

  _quickTradesHydratePromise = (async () => {
    const records = await fetchQuickTradesApi({ limit: MAX_TRADES, offset: 0 });
    if (!records) return;

    quickTradeStore.update((s) => ({
      ...s,
      trades: mergeServerAndLocalTrades(records.map(mapApiQuickTrade), s.trades),
    }));

    _quickTradesHydrated = true;
  })();

  try {
    await _quickTradesHydratePromise;
  } finally {
    _quickTradesHydratePromise = null;
  }
}

// ═══ Actions ═══

export function replaceQuickTradeId(localId: string, nextId: string, patch: Partial<QuickTrade> = {}) {
  quickTradeStore.update((s) => ({
    ...s,
    trades: replaceTradeIdInList(s.trades, localId, nextId, patch),
  }));
}

export function removeQuickTrade(tradeId: string) {
  quickTradeStore.update((s) => ({
    ...s,
    trades: s.trades.filter((trade) => trade.id !== tradeId),
  }));
}

/**
 * Validate TP/SL bounds relative to entry price and direction.
 * Returns error message string, or null if valid.
 */
export function validateTpSl(
  dir: TradeDirection,
  entry: number,
  tp: number | null,
  sl: number | null
): string | null {
  if (entry <= 0) return 'entry must be positive';
  if (tp != null && tp <= 0) return 'tp must be positive';
  if (sl != null && sl <= 0) return 'sl must be positive';
  if (dir === 'LONG') {
    if (tp != null && tp <= entry) return 'LONG tp must be above entry';
    if (sl != null && sl >= entry) return 'LONG sl must be below entry';
  } else {
    if (tp != null && tp >= entry) return 'SHORT tp must be below entry';
    if (sl != null && sl <= entry) return 'SHORT sl must be above entry';
  }
  return null;
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
  // Validate TP/SL bounds before opening trade
  const tpSlError = validateTpSl(dir, entry, tp, sl);
  if (tpSlError) {
    console.warn(`[quickTradeStore] Invalid TP/SL: ${tpSlError}`);
    return null;
  }

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
      const mappedServerTrade = mapApiQuickTrade(serverTrade);
      const localTrade = get(quickTradeStore).trades.find((t) => t.id === localId);
      const closedLocally = Boolean(localTrade && localTrade.status !== 'open');

      replaceQuickTradeId(localId, serverTrade.id, {
        pair: mappedServerTrade.pair,
        dir: mappedServerTrade.dir,
        entry: mappedServerTrade.entry,
        tp: mappedServerTrade.tp,
        sl: mappedServerTrade.sl,
        source: mappedServerTrade.source,
        note: mappedServerTrade.note,
        openedAt: mappedServerTrade.openedAt,
        currentPrice: closedLocally ? (localTrade?.currentPrice ?? mappedServerTrade.currentPrice) : mappedServerTrade.currentPrice,
        pnlPercent: closedLocally ? (localTrade?.pnlPercent ?? mappedServerTrade.pnlPercent) : mappedServerTrade.pnlPercent,
        status: closedLocally ? (localTrade?.status ?? mappedServerTrade.status) : mappedServerTrade.status,
        closedAt: closedLocally ? (localTrade?.closedAt ?? null) : mappedServerTrade.closedAt,
        closePnl: closedLocally ? (localTrade?.closePnl ?? null) : mappedServerTrade.closePnl,
      });

      if (closedLocally && localTrade) {
        const finalStatus = localTrade.status === 'stopped' ? 'stopped' : 'closed';
        void closeQuickTradeApi(serverTrade.id, {
          closePrice: localTrade.currentPrice,
          status: finalStatus,
        }).then((closedServerTrade) => {
          if (!closedServerTrade) return;
          quickTradeStore.update((s) => ({
            ...s,
            trades: mergeServerTradeIntoList(s.trades, mapApiQuickTrade(closedServerTrade), { localId }),
          }));
        });
      }
    });
  }

  return trade.id;
}

export function closeQuickTrade(tradeId: string, exitPrice: number) {
  quickTradeStore.update(s => ({
    ...s,
    trades: s.trades.map(t => {
      if (t.id !== tradeId || t.status !== 'open') return t;
      const pnl = calcPnlPercent(t.dir, t.entry, exitPrice);
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
        trades: mergeServerTradeIntoList(s.trades, mapApiQuickTrade(serverTrade), { localId: tradeId }),
      }));
    });
  }
}

export function updateTradePrice(tradeId: string, currentPrice: number) {
  quickTradeStore.update(s => ({
    ...s,
    trades: s.trades.map(t => {
      if (t.id !== tradeId || t.status !== 'open') return t;
      const pnl = calcPnlPercent(t.dir, t.entry, currentPrice);
      return { ...t, currentPrice, pnlPercent: pnl };
    })
  }));
}

let _lastLocalPriceSnapshot = '';
let _lastOpenTradeHash = '';
let _lastServerSyncSnapshot = '';
let _priceSyncTimer: ReturnType<typeof setTimeout> | null = null;
export function updateAllPrices(
  priceInput: PriceLikeMap,
  options: { syncServer?: boolean } = {}
) {
  const syncServer = options.syncServer ?? true;

  const state = get(quickTradeStore);
  const openIds = state.trades.filter((t) => t.status === 'open').map((t) => t.id);
  const hasOpenTrades = openIds.length > 0;
  const openTradeHash = openIds.join('|');
  if (!hasOpenTrades) {
    _lastOpenTradeHash = '';
    _lastServerSyncSnapshot = '';
    return;
  }

  const prices = toNumericPriceMap(priceInput);
  const snap = buildPriceMapHash(prices);

  // Skip only when both prices and open-trade set are unchanged.
  // This prevents missing updates when a new trade opens at the same price snapshot.
  if (!(snap === _lastLocalPriceSnapshot && openTradeHash === _lastOpenTradeHash)) {
    let changed = false;
    const trades = state.trades.map((t) => {
      if (t.status !== 'open') return t;
      const token = getBaseSymbolFromPair(t.pair);
      const price = prices[token];
      if (!price || price === t.currentPrice) return t;
      changed = true;
      const pnl = calcPnlPercent(t.dir, t.entry, price);
      return { ...t, currentPrice: price, pnlPercent: pnl };
    });

    if (changed) {
      quickTradeStore.set({
        ...state,
        trades,
      });
    }
  }

  _lastLocalPriceSnapshot = snap;
  _lastOpenTradeHash = openTradeHash;

  if (syncServer && typeof window !== 'undefined') {
    const serverSyncHash = `${snap}::${openTradeHash}`;
    if (serverSyncHash === _lastServerSyncSnapshot) return;
    _lastServerSyncSnapshot = serverSyncHash;

    const payload = { ...prices };
    if (_priceSyncTimer) clearTimeout(_priceSyncTimer);
    _priceSyncTimer = setTimeout(() => {
      void updateQuickTradePricesApi({ prices: payload }).catch(() => {
        // allow retry on next sync tick if request failed
        _lastServerSyncSnapshot = '';
      });
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

// 모듈 import 시 자동 hydration 제거.
// 진입점은 hydrateDomainStores() 또는 명시적 force refresh로 제한한다.
// if (typeof window !== 'undefined') { void hydrateQuickTrades(); }
