import {
  fetchCurrentFunding,
  fetchCurrentOI,
  fetchLSRatioHistory,
  fetchPredictedFunding,
} from '$lib/api/coinalyze';

export type WarRoomDerivativesSnapshot = {
  oi: number | null;
  funding: number | null;
  predFunding: number | null;
  lsRatio: number | null;
};

function buildMarketKey(pair: string, timeframe: string): string {
  return `${pair}|${timeframe}`;
}

async function fetchWarRoomDerivativesSnapshot(
  pair: string,
  timeframe: string,
): Promise<WarRoomDerivativesSnapshot> {
  const [oi, funding, predFunding, lsRatio] = await Promise.allSettled([
    fetchCurrentOI(pair),
    fetchCurrentFunding(pair),
    fetchPredictedFunding(pair),
    fetchLSRatioHistory(pair, timeframe, 2),
  ]);

  return {
    oi: oi.status === 'fulfilled' && oi.value ? oi.value.value : null,
    funding: funding.status === 'fulfilled' && funding.value ? funding.value.value : null,
    predFunding: predFunding.status === 'fulfilled' && predFunding.value ? predFunding.value.value : null,
    lsRatio:
      lsRatio.status === 'fulfilled' && lsRatio.value.length > 0
        ? lsRatio.value[lsRatio.value.length - 1].value
        : null,
  };
}

export function createWarRoomDerivativesRuntime(params: {
  getPair: () => string;
  getTimeframe: () => string;
  applySnapshot: (snapshot: WarRoomDerivativesSnapshot) => void;
  setLoading: (loading: boolean) => void;
  onError?: (error: unknown) => void;
  cacheTtlMs?: number;
  refreshMs?: number;
  debounceMs?: number;
}) {
  const cacheTtlMs = params.cacheTtlMs ?? 60_000;
  const refreshMs = params.refreshMs ?? 30_000;
  const debounceMs = params.debounceMs ?? 200;

  const cache = new Map<string, { ts: number; data: WarRoomDerivativesSnapshot }>();
  let refreshTimer: ReturnType<typeof setInterval> | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let removeVisibilityListener: (() => void) | null = null;
  let lastMarketKey = '';
  let queuedMarketKey = '';
  let inFlightMarketKey = '';

  const isDocumentVisible = () =>
    typeof document === 'undefined' || document.visibilityState === 'visible';

  const stop = () => {
    if (refreshTimer) clearInterval(refreshTimer);
    if (debounceTimer) clearTimeout(debounceTimer);
    refreshTimer = null;
    debounceTimer = null;
    queuedMarketKey = '';
    removeVisibilityListener?.();
    removeVisibilityListener = null;
  };

  const refresh = async () => {
    const pair = params.getPair();
    const timeframe = params.getTimeframe();
    if (!pair) return;

    const marketKey = buildMarketKey(pair, timeframe);
    if (inFlightMarketKey === marketKey) return;

    const cached = cache.get(marketKey);
    if (cached && Date.now() - cached.ts < cacheTtlMs) {
      params.applySnapshot(cached.data);
      lastMarketKey = marketKey;
      return;
    }

    params.setLoading(true);
    inFlightMarketKey = marketKey;
    try {
      const snapshot = await fetchWarRoomDerivativesSnapshot(pair, timeframe);
      cache.set(marketKey, { ts: Date.now(), data: snapshot });
      params.applySnapshot(snapshot);
      lastMarketKey = marketKey;
    } catch (error) {
      params.onError?.(error);
    } finally {
      inFlightMarketKey = '';
      params.setLoading(false);
    }
  };

  const queueRefreshForMarket = () => {
    const pair = params.getPair();
    const timeframe = params.getTimeframe();
    if (!pair) return;

    const marketKey = buildMarketKey(pair, timeframe);
    if (marketKey === lastMarketKey || marketKey === queuedMarketKey) return;

    if (debounceTimer) clearTimeout(debounceTimer);
    queuedMarketKey = marketKey;
    debounceTimer = setTimeout(() => {
      queuedMarketKey = '';
      void refresh();
    }, debounceMs);
  };

  const start = () => {
    stop();
    void refresh();

    refreshTimer = setInterval(() => {
      if (!isDocumentVisible()) return;
      void refresh();
    }, refreshMs);

    if (typeof document !== 'undefined') {
      const handleVisibility = () => {
        if (isDocumentVisible()) void refresh();
      };
      document.addEventListener('visibilitychange', handleVisibility);
      removeVisibilityListener = () =>
        document.removeEventListener('visibilitychange', handleVisibility);
    }
  };

  return {
    start,
    stop,
    refresh,
    queueRefreshForMarket,
  };
}
