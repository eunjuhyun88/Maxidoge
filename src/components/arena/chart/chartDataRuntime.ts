import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import {
  fetch24hr,
  fetchKlines,
  subscribeKlines,
  subscribeMiniTicker,
  type BinanceKline,
} from '$lib/api/binance';
import {
  computeRSI,
  computeSMA,
  computeBB,
  computeMACD,
  computeStochastic,
  MAX_KLINE_CACHE,
  updateRSIIncremental,
} from '$lib/chart/chartIndicators';
import type { ChartTheme } from '../ChartTheme';
import { compute24hStatsFromKlines } from './chartPatternEngine';

interface Chart24hStatsPatch {
  priceChange24h?: number;
  high24h?: number;
  low24h?: number;
  quoteVolume24h?: number;
}

interface MaPeriodBinding {
  p: number;
  s: ISeriesApi<'Line'> | null;
  setVal: (value: number) => void;
}

interface ChartDataSeriesContext {
  chart: IChartApi | null;
  series: ISeriesApi<'Candlestick'> | null;
  volumeSeries: ISeriesApi<'Histogram'> | null;
  rsiSeries: ISeriesApi<'Line'> | null;
  bbUpperSeries: ISeriesApi<'Line'> | null;
  bbMiddleSeries: ISeriesApi<'Line'> | null;
  bbLowerSeries: ISeriesApi<'Line'> | null;
  macdLineSeries: ISeriesApi<'Line'> | null;
  macdSignalSeries: ISeriesApi<'Line'> | null;
  macdHistSeries: ISeriesApi<'Histogram'> | null;
  stochKSeries: ISeriesApi<'Line'> | null;
  stochDSeries: ISeriesApi<'Line'> | null;
  maPeriods: MaPeriodBinding[];
  chartTheme: ChartTheme;
}

interface ChartIndicatorRuntimeState {
  rsiAvgGain: number;
  rsiAvgLoss: number;
  maRunSum: Record<number, number>;
}

export interface ChartDataLoadOptions {
  symbol: string;
  interval: string;
  pairBase: string;
}

export interface ChartDataRuntimeController {
  load(options: ChartDataLoadOptions): Promise<void>;
  loadMoreHistory(): Promise<void>;
  dispose(): void;
}

export interface ChartDataRuntimeOptions {
  getSeriesContext: () => ChartDataSeriesContext;
  getKlineCache: () => BinanceKline[];
  setKlineCache: (next: BinanceKline[]) => void;
  getIndicatorState: () => ChartIndicatorRuntimeState;
  setIndicatorState: (next: ChartIndicatorRuntimeState) => void;
  setRsiValue: (value: number) => void;
  setLatestVolume: (value: number) => void;
  setLivePrice: (value: number) => void;
  set24hStats: (next: Chart24hStatsPatch) => void;
  setLoading: (value: boolean) => void;
  setError: (value: string) => void;
  clearDetectedPatterns: () => void;
  onPatternRefresh: () => void;
  onFlushPriceUpdate: (price: number, pairBase: string) => void;
  onThrottledPriceUpdate: (price: number, pairBase: string) => void;
  onEmitPriceUpdate: (detail: { price: number }) => void;
  getFallbackPrice: () => number | null;
  onError: (context: 'loadMoreHistory' | 'load', error: unknown) => void;
}

function toCandleData(klines: BinanceKline[]) {
  return klines.map((kline) => ({
    time: kline.time as never,
    open: kline.open,
    high: kline.high,
    low: kline.low,
    close: kline.close,
  }));
}

function toVolumeData(klines: BinanceKline[], chartTheme: ChartTheme) {
  return klines.map((kline) => ({
    time: kline.time as never,
    value: kline.volume,
    color: kline.close >= kline.open ? chartTheme.volumeUp : chartTheme.volumeDown,
  }));
}

function computeChart24hPatch(klines: BinanceKline[]): Chart24hStatsPatch {
  const stats = compute24hStatsFromKlines(klines);
  const lastKline = klines[klines.length - 1];
  const weekBack = klines.length > 6 ? klines[klines.length - 7] : null;
  return {
    priceChange24h:
      lastKline && weekBack && Number.isFinite(weekBack.close) && weekBack.close > 0
        ? ((lastKline.close - weekBack.close) / weekBack.close) * 100
        : undefined,
    high24h: stats.high ?? undefined,
    low24h: stats.low ?? undefined,
    quoteVolume24h: stats.quoteVolume ?? undefined,
  };
}

export function createChartDataRuntime(
  options: ChartDataRuntimeOptions,
): ChartDataRuntimeController {
  let wsCleanup: (() => void) | null = null;
  let priceWsCleanup: (() => void) | null = null;
  let currentSymbol = '';
  let currentInterval = '';
  let isLoadingMore = false;
  let noMoreHistory = false;
  let loadVersion = 0;

  function clearLiveSubscriptions() {
    if (wsCleanup) {
      wsCleanup();
      wsCleanup = null;
    }
    if (priceWsCleanup) {
      priceWsCleanup();
      priceWsCleanup = null;
    }
  }

  function syncSeriesFromKlines(
    klines: BinanceKline[],
    refs: ChartDataSeriesContext,
  ): ChartIndicatorRuntimeState {
    refs.series?.setData(toCandleData(klines) as never);
    refs.volumeSeries?.setData(toVolumeData(klines, refs.chartTheme) as never);

    const closes = klines.map((kline) => ({ time: kline.time, close: kline.close }));
    const nextMaRunSum: Record<number, number> = {};

    for (const binding of refs.maPeriods) {
      const smaData = computeSMA(closes, binding.p);
      binding.s?.setData(smaData as never);
      binding.setVal(smaData.length > 0 ? smaData[smaData.length - 1].value : 0);

      if (klines.length >= binding.p) {
        let sum = 0;
        for (let i = klines.length - binding.p; i < klines.length; i += 1) {
          sum += klines[i].close;
        }
        nextMaRunSum[binding.p] = sum;
      }
    }

    let rsiAvgGain = 0;
    let rsiAvgLoss = 0;
    let lastRsi = 0;
    if (refs.rsiSeries) {
      const { result: rsiData, state: rsiState } = computeRSI(closes, 14);
      refs.rsiSeries.setData(rsiData as never);
      rsiAvgGain = rsiState.avgGain;
      rsiAvgLoss = rsiState.avgLoss;
      lastRsi = rsiData.length > 0 ? rsiData[rsiData.length - 1].value : 0;
    }
    options.setRsiValue(lastRsi);
    options.setLatestVolume(klines[klines.length - 1]?.volume || 0);

    // ── Bollinger Bands ──────────────────────────────────────
    if (refs.bbUpperSeries && refs.bbMiddleSeries && refs.bbLowerSeries) {
      const bbData = computeBB(closes, 20, 2);
      refs.bbUpperSeries.setData(bbData.map((p) => ({ time: p.time as never, value: p.upper })));
      refs.bbMiddleSeries.setData(bbData.map((p) => ({ time: p.time as never, value: p.middle })));
      refs.bbLowerSeries.setData(bbData.map((p) => ({ time: p.time as never, value: p.lower })));
    }

    // ── MACD ─────────────────────────────────────────────────
    if (refs.macdLineSeries && refs.macdSignalSeries && refs.macdHistSeries) {
      const macdData = computeMACD(closes, 12, 26, 9);
      refs.macdLineSeries.setData(macdData.map((p) => ({ time: p.time as never, value: p.macd })));
      refs.macdSignalSeries.setData(macdData.map((p) => ({ time: p.time as never, value: p.signal })));
      refs.macdHistSeries.setData(macdData.map((p) => ({
        time: p.time as never,
        value: p.histogram,
        color: p.histogram >= 0 ? refs.chartTheme.macdHistUp : refs.chartTheme.macdHistDown,
      })));
    }

    // ── Stochastic ───────────────────────────────────────────
    if (refs.stochKSeries && refs.stochDSeries) {
      const ohlc = klines.map((k) => ({ time: k.time, high: k.high, low: k.low, close: k.close }));
      const stochData = computeStochastic(ohlc, 14, 3, 3);
      refs.stochKSeries.setData(stochData.map((p) => ({ time: p.time as never, value: p.k })));
      refs.stochDSeries.setData(stochData.map((p) => ({ time: p.time as never, value: p.d })));
    }

    return { maRunSum: nextMaRunSum, rsiAvgGain, rsiAvgLoss };
  }

  function applyBootstrapStats(
    klines: BinanceKline[],
    ticker24: Record<string, unknown> | null,
  ) {
    if (ticker24 && Number.isFinite(Number(ticker24.priceChangePercent))) {
      const parsedHigh = Number(ticker24.highPrice);
      const parsedLow = Number(ticker24.lowPrice);
      const parsedQuoteVol = Number(ticker24.quoteVolume);
      options.set24hStats({
        priceChange24h: Number(ticker24.priceChangePercent),
        high24h: Number.isFinite(parsedHigh) && parsedHigh > 0 ? parsedHigh : undefined,
        low24h: Number.isFinite(parsedLow) && parsedLow > 0 ? parsedLow : undefined,
        quoteVolume24h:
          Number.isFinite(parsedQuoteVol) && parsedQuoteVol > 0 ? parsedQuoteVol : undefined,
      });
      return;
    }

    options.set24hStats(computeChart24hPatch(klines));
  }

  function subscribeRealtime(symbol: string, interval: string, pairBase: string) {
    clearLiveSubscriptions();

    wsCleanup = subscribeKlines(symbol, interval, (kline: BinanceKline) => {
      const refs = options.getSeriesContext();
      if (!refs.series) return;

      refs.series.update({
        time: kline.time as never,
        open: kline.open,
        high: kline.high,
        low: kline.low,
        close: kline.close,
      });
      refs.volumeSeries?.update({
        time: kline.time as never,
        value: kline.volume,
        color: kline.close >= kline.open ? refs.chartTheme.volumeUp : refs.chartTheme.volumeDown,
      });

      const previousCache = options.getKlineCache();
      const isUpdate =
        previousCache.length > 0 &&
        previousCache[previousCache.length - 1].time === kline.time;
      const prevClose = isUpdate
        ? previousCache.length > 1
          ? previousCache[previousCache.length - 2].close
          : kline.open
        : previousCache[previousCache.length - 1]?.close ?? kline.open;
      const nextCache = isUpdate
        ? [...previousCache.slice(0, -1), kline]
        : [...previousCache, kline].slice(-MAX_KLINE_CACHE);
      options.setKlineCache(nextCache);
      options.onPatternRefresh();

      const indicatorState = options.getIndicatorState();
      const nextMaRunSum = { ...indicatorState.maRunSum };
      for (const binding of refs.maPeriods) {
        if (!binding.s || nextCache.length < binding.p) continue;
        if (isUpdate) {
          nextMaRunSum[binding.p] = (nextMaRunSum[binding.p] ?? 0) - prevClose + kline.close;
        } else {
          nextMaRunSum[binding.p] =
            (nextMaRunSum[binding.p] ?? 0) -
            (nextCache[nextCache.length - binding.p - 1]?.close ?? 0) +
            kline.close;
        }
        const value = nextMaRunSum[binding.p] / binding.p;
        binding.setVal(value);
        binding.s.update({ time: kline.time as never, value });
      }

      let nextRsiAvgGain = indicatorState.rsiAvgGain;
      let nextRsiAvgLoss = indicatorState.rsiAvgLoss;
      if (refs.rsiSeries && nextCache.length > 14) {
        const { value: rsi, state: rsiState } = updateRSIIncremental(
          {
            avgGain: indicatorState.rsiAvgGain,
            avgLoss: indicatorState.rsiAvgLoss,
          },
          kline.close - prevClose,
        );
        nextRsiAvgGain = rsiState.avgGain;
        nextRsiAvgLoss = rsiState.avgLoss;
        refs.rsiSeries.update({ time: kline.time as never, value: rsi });
        options.setRsiValue(rsi);
      }

      options.setIndicatorState({
        maRunSum: nextMaRunSum,
        rsiAvgGain: nextRsiAvgGain,
        rsiAvgLoss: nextRsiAvgLoss,
      });
      options.setLivePrice(kline.close);
      options.setLatestVolume(kline.volume);
      options.onThrottledPriceUpdate(kline.close, pairBase);
      options.onEmitPriceUpdate({ price: kline.close });
    });

    priceWsCleanup = subscribeMiniTicker(
      [symbol],
      (updates) => {
        const tick = updates[symbol];
        if (!Number.isFinite(tick) || tick <= 0) return;
        options.setLivePrice(tick);
        options.onThrottledPriceUpdate(tick, pairBase);
        options.onEmitPriceUpdate({ price: tick });
      },
      (updates) => {
        const full = updates[symbol];
        if (!full) return;
        options.set24hStats({
          priceChange24h: Number.isFinite(full.change24h) ? full.change24h : undefined,
          high24h: Number.isFinite(full.high24h) && full.high24h > 0 ? full.high24h : undefined,
          low24h: Number.isFinite(full.low24h) && full.low24h > 0 ? full.low24h : undefined,
          quoteVolume24h:
            Number.isFinite(full.volume24h) && full.volume24h > 0
              ? full.volume24h
              : undefined,
        });
      },
    );
  }

  async function load(optionsInput: ChartDataLoadOptions) {
    const refs = options.getSeriesContext();
    if (!refs.series || !refs.chart) return;

    const requestVersion = ++loadVersion;
    currentSymbol = optionsInput.symbol;
    currentInterval = optionsInput.interval;
    noMoreHistory = false;
    options.clearDetectedPatterns();
    options.setLoading(true);
    options.setError('');
    clearLiveSubscriptions();

    try {
      const [klines, ticker24] = await Promise.all([
        fetchKlines(optionsInput.symbol, optionsInput.interval, 1000),
        fetch24hr(optionsInput.symbol).catch(() => null),
      ]);

      if (requestVersion !== loadVersion) return;

      const nextRefs = options.getSeriesContext();
      if (!nextRefs.series || !nextRefs.chart) return;
      if (klines.length === 0) {
        options.setError('No data received');
        return;
      }

      options.setKlineCache(klines);
      options.setIndicatorState(syncSeriesFromKlines(klines, nextRefs));
      options.onPatternRefresh();

      const lastKline = klines[klines.length - 1];
      options.setLatestVolume(lastKline.volume);
      options.setLivePrice(lastKline.close);
      applyBootstrapStats(klines, ticker24 as Record<string, unknown> | null);

      options.onFlushPriceUpdate(lastKline.close, optionsInput.pairBase);
      options.onEmitPriceUpdate({ price: lastKline.close });
      nextRefs.chart.timeScale().fitContent();
      subscribeRealtime(
        optionsInput.symbol,
        optionsInput.interval,
        optionsInput.pairBase,
      );
    } catch (error) {
      if (requestVersion !== loadVersion) return;
      options.onError('load', error);
      options.setError(
        `API Error: ${
          error instanceof Error && error.message ? error.message : 'Failed'
        }`,
      );
      if (options.getKlineCache().length === 0) {
        const fallback = options.getFallbackPrice();
        if (Number.isFinite(fallback) && (fallback as number) > 0) {
          options.setLivePrice(fallback as number);
        }
      }
    } finally {
      if (requestVersion === loadVersion) {
        options.setLoading(false);
      }
    }
  }

  async function loadMoreHistory() {
    const refs = options.getSeriesContext();
    if (!refs.series || !refs.chart || isLoadingMore || noMoreHistory) return;

    const existing = options.getKlineCache();
    if (existing.length === 0) return;

    isLoadingMore = true;
    const requestVersion = loadVersion;

    try {
      const earliest = existing[0];
      const endTimeMs = earliest.time * 1000 - 1;
      const older = await fetchKlines(currentSymbol, currentInterval, 1000, endTimeMs);
      if (requestVersion !== loadVersion) return;

      const nextRefs = options.getSeriesContext();
      if (!nextRefs.series || !nextRefs.chart || older.length === 0) {
        noMoreHistory = true;
        return;
      }

      const unique = older.filter((kline) => kline.time < earliest.time);
      if (unique.length === 0) {
        noMoreHistory = true;
        return;
      }

      const nextCache = [...unique, ...options.getKlineCache()].slice(-MAX_KLINE_CACHE);
      options.setKlineCache(nextCache);
      options.setIndicatorState(syncSeriesFromKlines(nextCache, nextRefs));
      options.onPatternRefresh();
    } catch (error) {
      options.onError('loadMoreHistory', error);
    } finally {
      isLoadingMore = false;
    }
  }

  function dispose() {
    loadVersion += 1;
    isLoadingMore = false;
    noMoreHistory = false;
    currentSymbol = '';
    currentInterval = '';
    clearLiveSubscriptions();
  }

  return {
    load,
    loadMoreHistory,
    dispose,
  };
}
