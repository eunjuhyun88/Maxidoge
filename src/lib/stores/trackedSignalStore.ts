// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — Tracked Signal Store
// WarRoom TRACK 버튼 → 시그널 추적 → TRACKED 탭에 표시
// 24h 자동 만료, QuickTrade로 전환 가능
// ═══════════════════════════════════════════════════════════════

import { writable, derived } from 'svelte/store';
import { openQuickTrade, replaceQuickTradeId, type TradeDirection } from './quickTradeStore';
import { STORAGE_KEYS } from './storageKeys';
import { convertSignalApi, trackSignalApi, untrackSignalApi } from '$lib/api/tradingApi';

export type SignalStatus = 'tracking' | 'expired' | 'converted';

export interface TrackedSignal {
  id: string;
  pair: string;
  dir: 'LONG' | 'SHORT';
  source: string;           // agent name or 'manual'
  confidence: number;
  trackedAt: number;
  currentPrice: number;
  entryPrice: number;
  pnlPercent: number;
  status: SignalStatus;
  expiresAt: number;        // timestamp: 24h from trackedAt
  note: string;
}

interface TrackedSignalState {
  signals: TrackedSignal[];
}

const STORAGE_KEY = STORAGE_KEYS.trackedSignals;
const MAX_SIGNALS = 50;
const EXPIRE_MS = 24 * 60 * 60 * 1000; // 24 hours

function loadState(): TrackedSignalState {
  if (typeof window === 'undefined') return { signals: [] };
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Auto-expire old signals on load
      const now = Date.now();
      const signals = (parsed.signals || []).map((s: TrackedSignal) => {
        if (s.status === 'tracking' && s.expiresAt < now) {
          return { ...s, status: 'expired' as SignalStatus };
        }
        return s;
      });
      return { signals };
    }
  } catch {}
  return { signals: [] };
}

export const trackedSignalStore = writable<TrackedSignalState>(loadState());

// Persist (debounced)
let _saveTimer: ReturnType<typeof setTimeout> | null = null;
trackedSignalStore.subscribe(s => {
  if (typeof window === 'undefined') return;
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  }, 400);
});

// ═══ Derived ═══

export const activeSignals = derived(trackedSignalStore, $s =>
  $s.signals.filter(s => s.status === 'tracking')
);

export const expiredSignals = derived(trackedSignalStore, $s =>
  $s.signals.filter(s => s.status === 'expired')
);

export const convertedSignals = derived(trackedSignalStore, $s =>
  $s.signals.filter(s => s.status === 'converted')
);

export const activeSignalCount = derived(trackedSignalStore, $s =>
  $s.signals.filter(s => s.status === 'tracking').length
);

// ═══ Actions ═══

export function replaceTrackedSignalId(localId: string, nextId: string, patch: Partial<TrackedSignal> = {}) {
  trackedSignalStore.update(s => ({
    signals: s.signals.map(sig => (sig.id === localId ? { ...sig, id: nextId, ...patch } : sig))
  }));
}

export function trackSignal(
  pair: string,
  dir: 'LONG' | 'SHORT',
  entryPrice: number,
  source: string = 'manual',
  confidence: number = 75,
  note: string = '',
  sync: boolean = true
): string {
  const localId = crypto.randomUUID();
  const signal: TrackedSignal = {
    id: localId,
    pair,
    dir,
    source,
    confidence,
    trackedAt: Date.now(),
    currentPrice: entryPrice,
    entryPrice,
    pnlPercent: 0,
    status: 'tracking',
    expiresAt: Date.now() + EXPIRE_MS,
    note,
  };

  trackedSignalStore.update(s => ({
    signals: [signal, ...s.signals].slice(0, MAX_SIGNALS)
  }));

  if (sync && typeof window !== 'undefined') {
    void trackSignalApi({
      pair: signal.pair,
      dir: signal.dir,
      confidence: signal.confidence,
      entryPrice: signal.entryPrice,
      currentPrice: signal.currentPrice,
      source: signal.source,
      note: signal.note,
      ttlHours: 24,
    }).then((serverSignal) => {
      if (!serverSignal || !serverSignal.id) return;
      replaceTrackedSignalId(localId, serverSignal.id, {
        confidence: serverSignal.confidence,
        currentPrice: serverSignal.currentPrice,
        pnlPercent: serverSignal.pnlPercent,
        status: serverSignal.status,
        trackedAt: serverSignal.trackedAt,
        expiresAt: serverSignal.expiresAt,
      });
    });
  }

  return signal.id;
}

export function removeTracked(signalId: string) {
  trackedSignalStore.update(s => ({
    signals: s.signals.filter(sig => sig.id !== signalId)
  }));

  if (typeof window !== 'undefined') {
    void untrackSignalApi(signalId);
  }
}

export function convertToTrade(signalId: string, currentPrice: number): string | null {
  let tradeId: string | null = null;
  let targetSignal: TrackedSignal | null = null;

  trackedSignalStore.update(s => ({
    signals: s.signals.map(sig => {
      if (sig.id !== signalId || sig.status !== 'tracking') return sig;
      targetSignal = sig;

      // Open a QuickTrade with this signal's data
      tradeId = openQuickTrade(
        sig.pair,
        sig.dir as TradeDirection,
        currentPrice,
        null, null,
        `tracked:${sig.source}`,
        sig.note,
        false
      );

      return { ...sig, status: 'converted' as SignalStatus };
    })
  }));

  if (typeof window !== 'undefined' && targetSignal && tradeId) {
    void convertSignalApi(signalId, {
      entry: currentPrice,
      note: targetSignal.note,
    }).then((serverTrade) => {
      if (!serverTrade || !serverTrade.id) return;
      replaceQuickTradeId(tradeId as string, serverTrade.id, {
        currentPrice: serverTrade.currentPrice,
        pnlPercent: serverTrade.pnlPercent,
        status: serverTrade.status,
        openedAt: serverTrade.openedAt,
      });
    });
  }

  return tradeId;
}

let _lastTrackedPriceSnap = '';
export function updateTrackedPrices(prices: Record<string, number>) {
  const snap = JSON.stringify(prices);
  if (snap === _lastTrackedPriceSnap) return;
  _lastTrackedPriceSnap = snap;

  const now = Date.now();
  trackedSignalStore.update(s => {
    const hasTracking = s.signals.some(sig => sig.status === 'tracking');
    if (!hasTracking) return s;

    let changed = false;
    const signals = s.signals.map(sig => {
      if (sig.status === 'tracking' && sig.expiresAt < now) {
        changed = true;
        return { ...sig, status: 'expired' as SignalStatus };
      }
      if (sig.status !== 'tracking') return sig;

      const token = sig.pair.split('/')[0];
      const price = prices[token];
      if (!price || price === sig.currentPrice) return sig;

      changed = true;
      const pnl = sig.dir === 'LONG'
        ? +((price - sig.entryPrice) / sig.entryPrice * 100).toFixed(2)
        : +((sig.entryPrice - price) / sig.entryPrice * 100).toFixed(2);

      return { ...sig, currentPrice: price, pnlPercent: pnl };
    });
    return changed ? { signals } : s;
  });
}

export function clearExpired() {
  trackedSignalStore.update(s => ({
    signals: s.signals.filter(sig => sig.status === 'tracking')
  }));
}

export function clearAll() {
  trackedSignalStore.update(() => ({ signals: [] }));
}
