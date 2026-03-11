// ═══════════════════════════════════════════════════════════════
// Stockclaw — Data Fetch Infrastructure (shared)
// ═══════════════════════════════════════════════════════════════
// Shared utilities for marketSnapshotService + scanEngine.
// Eliminates duplicated withTimeout, cachedFetch, TTL config.

import { getCached, setCache } from '$lib/server/providers/cache';

// ── Unified source cache TTL (superset of snapshot + scan) ───

export const SOURCE_CACHE_TTL = {
  binance: 10_000,       // 10초 (가격 데이터)
  coinalyze: 300_000,    // 5분 (50 req/day 제한)
  feargreed: 120_000,    // 2분
  coingecko: 60_000,     // 1분
  defillama: 120_000,    // 2분
  yahoo: 300_000,        // 5분 (매크로 변동 느림)
  news: 120_000,         // 2분
  cmc: 120_000,          // 2분
  cryptoquant: 300_000,  // 5분
  etherscan: 120_000,    // 2분
  lunarcrush: 120_000,   // 2분
  santiment: 120_000,    // 2분
  coinmetrics: 300_000,  // 5분 (무료 API)
  fred: 600_000,         // 10분 (일일 데이터)
} as const;

export type SourceKey = keyof typeof SOURCE_CACHE_TTL;

// ── Timeout wrapper ──────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 5_000;

export function withTimeout<T>(
  promise: Promise<T>,
  label: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`[dataFetch] ${label} timed out (${timeoutMs}ms)`)),
        timeoutMs,
      );
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

// ── Cached fetch (cache-first, then fetch with timeout) ──────

export function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number,
  label: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const hit = getCached<T>(key);
  if (hit !== null) return Promise.resolve(hit);

  return withTimeout(fetcher(), label, timeoutMs).then((r) => {
    if (r !== null && r !== undefined) setCache(key, r, ttlMs);
    return r;
  });
}

// ── Inflight request deduplication factory ────────────────────

export function createInflightDedup<T>(safetyTtlMs = 30_000) {
  const map = new Map<string, Promise<T>>();

  return {
    get(key: string): Promise<T> | undefined {
      return map.get(key);
    },
    set(key: string, promise: Promise<T>): void {
      map.set(key, promise);
      // Safety net: auto-delete if promise never settles
      const timer = setTimeout(() => map.delete(key), safetyTtlMs);
      if (typeof timer === 'object' && 'unref' in timer) (timer as NodeJS.Timeout).unref();
      // Normal path: delete immediately on settle
      promise.finally(() => { clearTimeout(timer); map.delete(key); });
    },
    delete(key: string): void {
      map.delete(key);
    },
  };
}
