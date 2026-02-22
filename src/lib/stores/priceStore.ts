// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — Unified Price Contract (S-03)
// ═══════════════════════════════════════════════════════════════
//
// 단일 소스: 모든 컴포넌트(Header, Chart, Terminal, QuickTrade)는
// 이 스토어를 통해 가격을 구독한다.
// 외부 소스(Binance WS/REST, 시뮬레이션)는 이 스토어에 쓴다.
//
// FE(F-03)에서 Header/Chart/Terminal의 개별 WS/interval을 제거하고
// 이 단일 스토어를 구독하도록 교체 예정.

import { writable, derived } from 'svelte/store';

// ─── Types ───────────────────────────────────────────────────

export type PriceSource = 'ws' | 'rest' | 'simulation';

export interface PriceEntry {
  price: number;
  ts: number;              // Unix ms timestamp
  source: PriceSource;
  change24h?: number;      // 24h 변동 % (optional)
  high24h?: number;
  low24h?: number;
  volume24h?: number;
}

export type PriceMap = Record<string, PriceEntry>;

// ─── Default symbols ─────────────────────────────────────────

const DEFAULT_SYMBOLS = ['BTC', 'ETH', 'SOL'] as const;

function createDefaults(): PriceMap {
  const now = Date.now();
  return {
    BTC: { price: 97420, ts: now, source: 'simulation' },
    ETH: { price: 3481,  ts: now, source: 'simulation' },
    SOL: { price: 198.46, ts: now, source: 'simulation' },
  };
}

// ─── Store ───────────────────────────────────────────────────

export const priceStore = writable<PriceMap>(createDefaults());

// ─── Derived: 단순 가격 숫자 (레거시 호환) ──────────────────
export const livePrices = derived(priceStore, ($p) => {
  const result: Record<string, number> = {};
  for (const [sym, entry] of Object.entries($p)) {
    result[sym] = entry.price;
  }
  return result;
});

// 24h 변동률 derived (심볼 → %)
export const priceChanges = derived(priceStore, ($p) => {
  const result: Record<string, number> = {};
  for (const [sym, entry] of Object.entries($p)) {
    result[sym] = entry.change24h ?? 0;
  }
  return result;
});

// 개별 심볼 derived
export const btcPrice = derived(priceStore, ($p) => $p.BTC?.price ?? 0);
export const ethPrice = derived(priceStore, ($p) => $p.ETH?.price ?? 0);
export const solPrice = derived(priceStore, ($p) => $p.SOL?.price ?? 0);

// ─── Actions ─────────────────────────────────────────────────

/** 단일 심볼 가격 업데이트 */
export function updatePrice(symbol: string, price: number, source: PriceSource = 'ws') {
  priceStore.update(($p) => ({
    ...$p,
    [symbol]: {
      ...($p[symbol] || {}),
      price,
      ts: Date.now(),
      source,
    },
  }));
}

/** 여러 심볼 한꺼번에 업데이트 */
export function updatePrices(updates: Record<string, number>, source: PriceSource = 'ws') {
  priceStore.update(($p) => {
    const next = { ...$p };
    const ts = Date.now();
    for (const [sym, price] of Object.entries(updates)) {
      next[sym] = { ...($p[sym] || {}), price, ts, source };
    }
    return next;
  });
}

/** 24h 통계 포함 업데이트 */
export function updatePriceFull(symbol: string, entry: PriceEntry) {
  priceStore.update(($p) => ({
    ...$p,
    [symbol]: entry,
  }));
}

/** 시뮬레이션 지터 (gameState.updatePrices 대체) */
export function simulatePriceJitter() {
  priceStore.update(($p) => {
    const next = { ...$p };
    const ts = Date.now();
    for (const [sym, entry] of Object.entries(next)) {
      const jitter = 1 + (Math.random() - 0.5) * 0.0014;
      const decimals = entry.price > 100 ? 0 : entry.price > 1 ? 2 : 4;
      next[sym] = {
        ...entry,
        price: +(entry.price * jitter).toFixed(decimals),
        ts,
        source: 'simulation',
      };
    }
    return next;
  });
}

// ─── Helpers ─────────────────────────────────────────────────

/** 심볼의 최신 가격 (동기적) */
export function getPrice(symbol: string): number {
  let price = 0;
  priceStore.subscribe(($p) => { price = $p[symbol]?.price ?? 0; })();
  return price;
}

/** 가격 데이터 신선도 확인 (ms) */
export function getPriceAge(symbol: string): number {
  let age = Infinity;
  priceStore.subscribe(($p) => {
    const entry = $p[symbol];
    age = entry ? Date.now() - entry.ts : Infinity;
  })();
  return age;
}
