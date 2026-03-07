import { updatePrice } from '$lib/stores/priceStore';
import { getPairPrice } from '$lib/utils/price';
import { normalizeMarketPrice } from '$lib/chart/chartHelpers';

export interface ChartPriceRuntimeController {
  update24hStats(next: {
    priceChange24h?: number;
    high24h?: number;
    low24h?: number;
    quoteVolume24h?: number;
  }): void;
  flushPriceUpdate(price: number, pairBase: string): void;
  throttledPriceUpdate(price: number, pairBase: string): void;
  resetTransientState(): void;
  getFallbackLivePrice(): number | null;
  dispose(): void;
}

export interface CreateChartPriceRuntimeOptions {
  getCurrentPair: () => string;
  getLivePrices: () => Record<string, number>;
  getPairBaseFallbackSymbol: () => string;
  getPairBaseFallbackPrice: () => number;
  clearScheduledPatternScan: () => void;
  setPriceChange24h: (value: number) => void;
  setHigh24h: (value: number) => void;
  setLow24h: (value: number) => void;
  setQuoteVolume24h: (value: number) => void;
}

export function createChartPriceRuntime(
  options: CreateChartPriceRuntimeOptions,
): ChartPriceRuntimeController {
  let _priceUpdateTimer: ReturnType<typeof setTimeout> | null = null;
  let _pendingPrice: number | null = null;
  let _pendingPairBase: string | null = null;

  function update24hStats(next: {
    priceChange24h?: number;
    high24h?: number;
    low24h?: number;
    quoteVolume24h?: number;
  }) {
    if (Number.isFinite(next.priceChange24h)) options.setPriceChange24h(next.priceChange24h!);
    if (Number.isFinite(next.high24h) && next.high24h! > 0) options.setHigh24h(next.high24h!);
    if (Number.isFinite(next.low24h) && next.low24h! > 0) options.setLow24h(next.low24h!);
    if (Number.isFinite(next.quoteVolume24h) && next.quoteVolume24h! > 0) {
      options.setQuoteVolume24h(next.quoteVolume24h!);
    }
  }

  function flushPriceUpdate(price: number, pairBase: string) {
    const normalized = normalizeMarketPrice(price);
    updatePrice(pairBase, normalized, 'rest');
  }

  function throttledPriceUpdate(price: number, pairBase: string) {
    _pendingPrice = price;
    _pendingPairBase = pairBase;
    if (_priceUpdateTimer) return;

    _priceUpdateTimer = setTimeout(() => {
      if (_pendingPrice !== null && _pendingPairBase !== null) {
        const normalized = normalizeMarketPrice(_pendingPrice);
        updatePrice(_pendingPairBase, normalized, 'ws');
      }
      _priceUpdateTimer = null;
      _pendingPrice = null;
      _pendingPairBase = null;
    }, 2000);
  }

  function resetTransientState() {
    options.clearScheduledPatternScan();
    if (_priceUpdateTimer) {
      clearTimeout(_priceUpdateTimer);
      _priceUpdateTimer = null;
      _pendingPrice = null;
      _pendingPairBase = null;
    }
  }

  function getFallbackLivePrice() {
    const fallback = getPairPrice(
      options.getLivePrices(),
      options.getCurrentPair(),
      options.getPairBaseFallbackSymbol(),
      options.getPairBaseFallbackPrice(),
    );
    return Number.isFinite(fallback) && fallback > 0 ? fallback : null;
  }

  function dispose() {
    resetTransientState();
  }

  return {
    update24hStats,
    flushPriceUpdate,
    throttledPriceUpdate,
    resetTransientState,
    getFallbackLivePrice,
    dispose,
  };
}
