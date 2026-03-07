// ═══════════════════════════════════════════════════════════════
// STOCKCLAW — Tracked Signal Store
// Server-authoritative tracked signals with optimistic local staging
// ═══════════════════════════════════════════════════════════════

import { writable, derived, get } from 'svelte/store';
import { openQuickTrade, replaceQuickTradeId } from './quickTradeStore';
import { STORAGE_KEYS } from './storageKeys';
import { loadFromStorage, autoSave } from '$lib/utils/storage';
import {
  convertSignalApi,
  fetchTrackedSignalsApi,
  openQuickTradeApi,
  trackSignalApi,
  type ApiTrackedSignal,
  untrackSignalApi,
} from '$lib/api/tradingApi';
import type { TradeDirection, TrackedSignal, TrackedSignalStatus } from '$lib/contracts/trading';
import { buildPriceMapHash, getBaseSymbolFromPair, toNumericPriceMap, type PriceLikeMap } from '$lib/utils/price';

export type { TrackedSignal };
export type SignalStatus = TrackedSignalStatus;

interface TrackedSignalState {
  signals: TrackedSignal[];
}

const MAX_SIGNALS = 50;
const EXPIRE_MS = 24 * 60 * 60 * 1000;
const TRACK_SIGNAL_RECONCILE_WINDOW_MS = 45_000;
let _trackedSignalsHydrated = false;
let _trackedSignalsHydratePromise: Promise<void> | null = null;
const _pendingTrackedSignalSyncs = new Map<string, Promise<ApiTrackedSignal | null>>();
const _localTrackedSignalIds = new Set<string>();

function loadState(): TrackedSignalState {
  const raw = loadFromStorage<{ signals: TrackedSignal[] }>(STORAGE_KEYS.trackedSignals, { signals: [] });
  const now = Date.now();
  return {
    signals: raw.signals.map((signal) => {
      if (signal.status === 'tracking' && signal.expiresAt < now) {
        return { ...signal, status: 'expired' as SignalStatus };
      }
      return signal;
    }),
  };
}

export const trackedSignalStore = writable<TrackedSignalState>(loadState());

autoSave(trackedSignalStore, STORAGE_KEYS.trackedSignals, undefined, 400);

export const activeSignals = derived(trackedSignalStore, ($state) =>
  $state.signals.filter((signal) => signal.status === 'tracking')
);

export const expiredSignals = derived(trackedSignalStore, ($state) =>
  $state.signals.filter((signal) => signal.status === 'expired')
);

export const convertedSignals = derived(trackedSignalStore, ($state) =>
  $state.signals.filter((signal) => signal.status === 'converted')
);

export const activeSignalCount = derived(trackedSignalStore, ($state) =>
  $state.signals.filter((signal) => signal.status === 'tracking').length
);

function mapApiTrackedSignal(row: ApiTrackedSignal): TrackedSignal {
  return {
    ...row,
    confidence: Number(row.confidence ?? 0),
    trackedAt: Number(row.trackedAt),
    currentPrice: Number(row.currentPrice),
    entryPrice: Number(row.entryPrice),
    pnlPercent: Number(row.pnlPercent ?? 0),
    expiresAt: Number(row.expiresAt),
    source: row.source || 'manual',
    note: row.note || '',
  };
}

function sortAndClampSignals(signals: TrackedSignal[]): TrackedSignal[] {
  return [...signals]
    .sort((a, b) => b.trackedAt - a.trackedAt)
    .slice(0, MAX_SIGNALS);
}

function pruneLocalSignalIds(signals: TrackedSignal[]) {
  const ids = new Set(signals.map((signal) => signal.id));
  for (const localId of [..._localTrackedSignalIds]) {
    if (!ids.has(localId)) _localTrackedSignalIds.delete(localId);
  }
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeNumber(value: number): string {
  return Number(value).toFixed(8);
}

function buildTrackedSignalReconcileKey(
  signal: Pick<TrackedSignal, 'pair' | 'dir' | 'confidence' | 'entryPrice' | 'source' | 'note' | 'status'>
): string {
  return [
    signal.pair.toUpperCase(),
    signal.dir,
    String(Math.round(signal.confidence)),
    normalizeNumber(signal.entryPrice),
    normalizeText(signal.source),
    normalizeText(signal.note),
    signal.status,
  ].join('|');
}

function isHydrationDuplicate(serverSignal: TrackedSignal, localSignal: TrackedSignal): boolean {
  if (serverSignal.status !== 'tracking' || localSignal.status !== 'tracking') return false;
  if (buildTrackedSignalReconcileKey(serverSignal) !== buildTrackedSignalReconcileKey(localSignal)) return false;
  return Math.abs(serverSignal.trackedAt - localSignal.trackedAt) <= TRACK_SIGNAL_RECONCILE_WINDOW_MS;
}

function mergeServerAndLocalSignals(serverSignals: TrackedSignal[], localSignals: TrackedSignal[]): TrackedSignal[] {
  const serverIds = new Set(serverSignals.map((signal) => signal.id));
  const matchedLocalIds = new Set<string>();

  for (const serverSignal of serverSignals) {
    const matchedLocal = localSignals.find((localSignal) => {
      if (matchedLocalIds.has(localSignal.id)) return false;
      if (serverIds.has(localSignal.id)) return false;
      return isHydrationDuplicate(serverSignal, localSignal);
    });
    if (matchedLocal) matchedLocalIds.add(matchedLocal.id);
  }

  return sortAndClampSignals(
    [
      ...serverSignals,
      ...localSignals.filter((signal) => !serverIds.has(signal.id) && !matchedLocalIds.has(signal.id)),
    ]
  );
}

function replaceSignalIdInList(
  signals: TrackedSignal[],
  localId: string,
  nextId: string,
  patch: Partial<TrackedSignal> = {}
): TrackedSignal[] {
  const localSignal = signals.find((signal) => signal.id === localId);
  const existingNextSignal = signals.find((signal) => signal.id === nextId);
  if (!localSignal && !existingNextSignal) return signals;

  const mergedSignal: TrackedSignal = {
    ...(existingNextSignal ?? {}),
    ...(localSignal ?? {}),
    ...patch,
    id: nextId,
  } as TrackedSignal;

  return sortAndClampSignals(
    [
      mergedSignal,
      ...signals.filter((signal) => signal.id !== localId && signal.id !== nextId),
    ]
  );
}

async function resolveServerSignalId(signalId: string): Promise<string | null> {
  const pending = _pendingTrackedSignalSyncs.get(signalId);
  if (!pending) return _localTrackedSignalIds.has(signalId) ? null : signalId;
  const synced = await pending;
  return synced?.id ?? null;
}

export async function hydrateTrackedSignals(force = false): Promise<void> {
  if (typeof window === 'undefined') return;
  if (_trackedSignalsHydrated && !force) return;
  if (_trackedSignalsHydratePromise) return _trackedSignalsHydratePromise;

  _trackedSignalsHydratePromise = (async () => {
    const records = await fetchTrackedSignalsApi({ limit: MAX_SIGNALS, offset: 0 });
    if (!records) return;

    trackedSignalStore.update((state) => ({
      signals: mergeServerAndLocalSignals(records.map(mapApiTrackedSignal), state.signals),
    }));
    pruneLocalSignalIds(get(trackedSignalStore).signals);

    _trackedSignalsHydrated = true;
  })();

  try {
    await _trackedSignalsHydratePromise;
  } finally {
    _trackedSignalsHydratePromise = null;
  }
}

export function replaceTrackedSignalId(localId: string, nextId: string, patch: Partial<TrackedSignal> = {}) {
  _localTrackedSignalIds.delete(localId);
  trackedSignalStore.update((state) => ({
    signals: replaceSignalIdInList(state.signals, localId, nextId, patch),
  }));
}

export function trackSignal(
  pair: string,
  dir: 'LONG' | 'SHORT',
  entryPrice: number,
  source = 'manual',
  confidence = 75,
  note = '',
  sync = true
): string {
  const localId = crypto.randomUUID();
  const now = Date.now();
  const signal: TrackedSignal = {
    id: localId,
    pair,
    dir,
    source,
    confidence,
    trackedAt: now,
    currentPrice: entryPrice,
    entryPrice,
    pnlPercent: 0,
    status: 'tracking',
    expiresAt: now + EXPIRE_MS,
    note,
  };

  _localTrackedSignalIds.add(localId);
  trackedSignalStore.update((state) => ({
    signals: sortAndClampSignals([signal, ...state.signals]),
  }));

  if (sync && typeof window !== 'undefined') {
    const pending = trackSignalApi({
      pair: signal.pair,
      dir: signal.dir,
      confidence: signal.confidence,
      entryPrice: signal.entryPrice,
      currentPrice: signal.currentPrice,
      source: signal.source,
      note: signal.note,
      ttlHours: 24,
      clientMutationId: localId,
    }).then((serverSignal) => {
      if (!serverSignal || !serverSignal.id) return null;
      const mappedSignal = mapApiTrackedSignal(serverSignal);
      const localTrackedSignal = get(trackedSignalStore).signals.find((tracked) => tracked.id === localId);
      const convertedLocally = Boolean(localTrackedSignal && localTrackedSignal.status !== 'tracking');

      replaceTrackedSignalId(localId, serverSignal.id, {
        pair: mappedSignal.pair,
        dir: mappedSignal.dir,
        source: mappedSignal.source,
        confidence: mappedSignal.confidence,
        trackedAt: mappedSignal.trackedAt,
        expiresAt: mappedSignal.expiresAt,
        note: mappedSignal.note,
        currentPrice: convertedLocally ? (localTrackedSignal?.currentPrice ?? mappedSignal.currentPrice) : mappedSignal.currentPrice,
        pnlPercent: convertedLocally ? (localTrackedSignal?.pnlPercent ?? mappedSignal.pnlPercent) : mappedSignal.pnlPercent,
        status: convertedLocally ? (localTrackedSignal?.status ?? mappedSignal.status) : mappedSignal.status,
      });

      return serverSignal;
    }).finally(() => {
      _pendingTrackedSignalSyncs.delete(localId);
    });

    _pendingTrackedSignalSyncs.set(localId, pending);
  }

  return signal.id;
}

export function removeTracked(signalId: string) {
  _localTrackedSignalIds.delete(signalId);
  trackedSignalStore.update((state) => ({
    signals: state.signals.filter((signal) => signal.id !== signalId),
  }));

  if (typeof window !== 'undefined') {
    void (async () => {
      const serverSignalId = await resolveServerSignalId(signalId);
      if (!serverSignalId) return;
      void untrackSignalApi(serverSignalId);
    })();
  }
}

export function convertToTrade(signalId: string, currentPrice: number): string | null {
  let tradeId: string | null = null;
  let targetSignal: TrackedSignal | null = null;

  trackedSignalStore.update((state) => ({
    signals: state.signals.map((signal) => {
      if (signal.id !== signalId || signal.status !== 'tracking') return signal;
      targetSignal = signal;
      tradeId = openQuickTrade(
        signal.pair,
        signal.dir as TradeDirection,
        currentPrice,
        null,
        null,
        `tracked:${signal.source}`,
        signal.note,
        false
      );
      return { ...signal, status: 'converted' as SignalStatus };
    }),
  }));

  if (typeof window === 'undefined' || !targetSignal || !tradeId) return tradeId;

  const syncedSignal: TrackedSignal = targetSignal;
  const optimisticTradeId: string = tradeId;

  void (async () => {
    const serverSignalId = await resolveServerSignalId(signalId);
    if (serverSignalId) {
      if (serverSignalId !== signalId) {
        replaceTrackedSignalId(signalId, serverSignalId, {
          status: 'converted',
          currentPrice,
        });
      }
      const serverTrade = await convertSignalApi(serverSignalId, {
        entry: currentPrice,
        note: syncedSignal.note,
      });
      if (!serverTrade || !serverTrade.id) return;
      replaceQuickTradeId(optimisticTradeId, serverTrade.id, {
        currentPrice: serverTrade.currentPrice,
        pnlPercent: serverTrade.pnlPercent,
        status: serverTrade.status,
        openedAt: serverTrade.openedAt,
      });
      return;
    }

    const fallbackTrade = await openQuickTradeApi({
      pair: syncedSignal.pair,
      dir: syncedSignal.dir,
      entry: currentPrice,
      tp: null,
      sl: null,
      currentPrice,
      source: `tracked:${syncedSignal.source}`,
      note: syncedSignal.note,
    });
    if (!fallbackTrade || !fallbackTrade.id) return;
    replaceQuickTradeId(optimisticTradeId, fallbackTrade.id, {
      currentPrice: fallbackTrade.currentPrice,
      pnlPercent: fallbackTrade.pnlPercent,
      status: fallbackTrade.status,
      openedAt: fallbackTrade.openedAt,
    });
  })();

  return tradeId;
}

let _lastTrackedPriceSnap = '';
export function updateTrackedPrices(priceInput: PriceLikeMap) {
  const state = get(trackedSignalStore);
  const hasTracking = state.signals.some((signal) => signal.status === 'tracking');
  if (!hasTracking) return;

  const now = Date.now();
  const hasExpired = state.signals.some((signal) => signal.status === 'tracking' && signal.expiresAt < now);
  const prices = toNumericPriceMap(priceInput);
  const snapshot = buildPriceMapHash(prices);
  if (!hasExpired && snapshot === _lastTrackedPriceSnap) return;
  _lastTrackedPriceSnap = snapshot;

  let changed = false;
  const signals = state.signals.map((signal) => {
    if (signal.status === 'tracking' && signal.expiresAt < now) {
      changed = true;
      return { ...signal, status: 'expired' as SignalStatus };
    }
    if (signal.status !== 'tracking') return signal;

    const token = getBaseSymbolFromPair(signal.pair);
    const price = prices[token];
    if (!price || price === signal.currentPrice) return signal;

    changed = true;
    const pnl = signal.dir === 'LONG'
      ? +((price - signal.entryPrice) / signal.entryPrice * 100).toFixed(2)
      : +((signal.entryPrice - price) / signal.entryPrice * 100).toFixed(2);

    return { ...signal, currentPrice: price, pnlPercent: pnl };
  });

  if (changed) trackedSignalStore.set({ signals });
}

export function clearExpired() {
  trackedSignalStore.update((state) => ({
    signals: state.signals.filter((signal) => signal.status === 'tracking'),
  }));
  pruneLocalSignalIds(get(trackedSignalStore).signals);
}

export function clearAll() {
  _localTrackedSignalIds.clear();
  trackedSignalStore.update(() => ({ signals: [] }));
}

// 자동 hydration은 hydrateDomainStores() 단일 진입점에서 수행한다.
