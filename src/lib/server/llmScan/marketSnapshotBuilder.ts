// ═══════════════════════════════════════════════════════════════
// STOCKCLAW — LLM Scan Engine (C-02) Market Snapshot Builder
// ═══════════════════════════════════════════════════════════════
//
// Extracts Phase 1-3 data collection from scanEngine.ts
// and structures it as a MarketSnapshot for LLM consumption.
//
// IMPORTANT: This duplicates data fetching from scanEngine.ts
// intentionally. B-02 (scanEngine) remains untouched.
// Both pipelines share the same cachedFetch layer, so
// duplicate API calls do NOT occur within the TTL window.

import type { BinanceKline } from '$lib/server/binance';
import type { MarketSnapshot } from './types';

// ── Server-side data fetchers (identical imports to scanEngine) ──
import { fetchKlinesServer, fetch24hrServer, pairToSymbol } from '$lib/server/binance';
import {
  fetchCurrentOIServer,
  fetchCurrentFundingServer,
  fetchPredictedFundingServer,
  fetchLSRatioHistoryServer,
  fetchLiquidationHistoryServer,
  fetchOIHistoryServer,
} from '$lib/server/coinalyze';
import { fetchFearGreed as fetchFearGreedServer } from '$lib/server/feargreed';
import { fetchCoinGeckoGlobal } from '$lib/server/coingecko';
import { fetchTopicSocial } from '$lib/server/lunarcrush';
import { fetchSantimentSocial } from '$lib/server/santiment';
import { fetchCoinMetricsData } from '$lib/server/coinmetrics';
import { fetchFredMacroData } from '$lib/server/fred';
import { fetchCryptoQuantData as fetchCQServer } from '$lib/server/cryptoquant';
import {
  SOURCE_CACHE_TTL as CACHE_TTL,
  cachedFetch,
} from '$lib/server/dataFetchInfra';
import {
  fetchEthOnchainServer,
  fetchMacroIndicatorsServer,
} from '$lib/server/compositeDataFetchers';
import { smaLast } from '$lib/chart/chartIndicators';
import { calcRSI } from '$lib/engine/indicators';
import { calcSRLevels } from '$lib/engine/supportResistance';
import { getMultiTimeframeIndicatorContext } from '$lib/server/multiTimeframeContext';

// ═══════════════════════════════════════════════════════════════
// Computation Helpers
// ═══════════════════════════════════════════════════════════════

function computeAtrPct(klines: BinanceKline[], period = 14): number | null {
  if (klines.length < period + 1) return null;
  const range = klines.slice(-(period + 1));
  let totalTR = 0;
  for (let i = 1; i < range.length; i++) {
    const prevClose = range[i - 1].close;
    const cur = range[i];
    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prevClose),
      Math.abs(cur.low - prevClose),
    );
    totalTR += tr;
  }
  const atr = totalTR / period;
  const lastClose = range[range.length - 1].close;
  if (!Number.isFinite(lastClose) || lastClose <= 0) return null;
  return (atr / lastClose) * 100;
}

function computeBollingerPosition(
  closes: number[],
  sma20: number | null,
  period = 20,
): MarketSnapshot['candles']['priceVsBollinger'] {
  if (sma20 == null || closes.length < period) return 'mid';

  const slice = closes.slice(-period);
  const mean = sma20;
  const variance = slice.reduce((sum, c) => sum + (c - mean) ** 2, 0) / period;
  const stdDev = Math.sqrt(variance);
  const upper = mean + 2 * stdDev;
  const lower = mean - 2 * stdDev;
  const latest = closes[closes.length - 1];

  if (latest > upper) return 'above_upper';
  if (latest > mean + stdDev) return 'upper_zone';
  if (latest < lower) return 'below_lower';
  if (latest < mean - stdDev) return 'lower_zone';
  return 'mid';
}

function detectTrendStructure(klines: BinanceKline[]): MarketSnapshot['candles']['trendStructure'] {
  if (klines.length < 20) return 'ranging';

  const recent10 = klines.slice(-10);
  const prev10 = klines.slice(-20, -10);

  const recentHigh = Math.max(...recent10.map((k) => k.high));
  const prevHigh = Math.max(...prev10.map((k) => k.high));
  const recentLow = Math.min(...recent10.map((k) => k.low));
  const prevLow = Math.min(...prev10.map((k) => k.low));

  const higherHigh = recentHigh > prevHigh;
  const higherLow = recentLow > prevLow;
  const lowerHigh = recentHigh < prevHigh;
  const lowerLow = recentLow < prevLow;

  if (higherHigh && higherLow) return 'HH_HL';
  if (lowerHigh && lowerLow) return 'LH_LL';
  return 'ranging';
}

function detectRecentPattern(klines: BinanceKline[]): string | null {
  if (klines.length < 3) return null;

  const last = klines[klines.length - 1];
  const prev = klines[klines.length - 2];

  const lastBody = last.close - last.open;
  const prevBody = prev.close - prev.open;
  const lastRange = last.high - last.low;

  // Doji
  if (lastRange > 0 && Math.abs(lastBody) / lastRange < 0.1) return 'doji';

  // Engulfing
  if (prevBody < 0 && lastBody > 0 && Math.abs(lastBody) > Math.abs(prevBody) * 1.2) {
    return 'bullish_engulfing';
  }
  if (prevBody > 0 && lastBody < 0 && Math.abs(lastBody) > Math.abs(prevBody) * 1.2) {
    return 'bearish_engulfing';
  }

  // Hammer / Shooting star
  if (lastRange > 0) {
    const upperWick = last.high - Math.max(last.open, last.close);
    const lowerWick = Math.min(last.open, last.close) - last.low;
    const body = Math.abs(lastBody);

    if (lowerWick > body * 2 && upperWick < body * 0.5) return 'hammer';
    if (upperWick > body * 2 && lowerWick < body * 0.5) return 'shooting_star';
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════

/**
 * Build a MarketSnapshot from 15 data sources.
 * Same data as B-02 scanEngine Phase 1-3, structured for LLM.
 */
export async function buildMarketSnapshot(
  pair: string,
  timeframe: string,
): Promise<MarketSnapshot> {
  const marketPair = (pair || 'BTC/USDT').toUpperCase();
  const tf = String(timeframe || '4h');
  const token = (marketPair.split('/')[0] || 'BTC').toUpperCase();
  const symbol = pairToSymbol(marketPair);

  // ── Phase 1: Core data (Binance klines + ticker) ──
  const [klinesRes, tickerRes] = await Promise.allSettled([
    fetchKlinesServer(symbol, tf, 240),
    fetch24hrServer(symbol),
  ]);

  if (klinesRes.status !== 'fulfilled') {
    throw new Error(
      '[C-02:snapshot] Failed to load candle data from Binance.\n수정: Binance API 상태 확인\n예시: fetchKlinesServer("BTCUSDT", "4h", 240)',
    );
  }

  const klines = klinesRes.value;
  const ticker =
    tickerRes.status === 'fulfilled'
      ? tickerRes.value
      : { priceChangePercent: '0', quoteVolume: '0' };

  if (!Array.isArray(klines) || klines.length < 60) {
    throw new Error(
      '[C-02:snapshot] Insufficient candle data for scan.\n수정: 최소 60개 캔들 필요\n예시: klines.length >= 60',
    );
  }

  // ── Phase 2: 13+ data sources + MTF + S/R klines (parallel, cached) ──
  const cqAsset = token === 'ETH' ? 'eth' : 'btc';
  const [
    oiRaw, fundingRaw, predFundingRaw, lsRaw, liqRaw,
    fngRaw, cgGlobalRaw, ethOnchainRaw,
    macroRaw, socialRaw, oiHistRaw,
    fredRaw, cqRaw,
    santimentRaw, coinMetricsRaw,
    mtfContextRaw, srKlines1dRaw, srKlines1wRaw,
  ] = await Promise.allSettled([
    cachedFetch(`ca:oi:${marketPair}`, () => fetchCurrentOIServer(marketPair), CACHE_TTL.coinalyze, 'Coinalyze OI'),
    cachedFetch(`ca:fr:${marketPair}`, () => fetchCurrentFundingServer(marketPair), CACHE_TTL.coinalyze, 'Coinalyze FR'),
    cachedFetch(`ca:pfr:${marketPair}`, () => fetchPredictedFundingServer(marketPair), CACHE_TTL.coinalyze, 'Coinalyze PredFR'),
    cachedFetch(`ca:ls:${marketPair}:${tf}`, () => fetchLSRatioHistoryServer(marketPair, tf, 24), CACHE_TTL.coinalyze, 'Coinalyze LS'),
    cachedFetch(`ca:liq:${marketPair}:${tf}`, () => fetchLiquidationHistoryServer(marketPair, tf, 24), CACHE_TTL.coinalyze, 'Coinalyze Liq'),
    cachedFetch('fng:latest', () => fetchFearGreedServer(), CACHE_TTL.feargreed, 'FearGreed'),
    cachedFetch('cg:global', () => fetchCoinGeckoGlobal(), CACHE_TTL.coingecko, 'CoinGecko'),
    cachedFetch('eth:onchain', () => fetchEthOnchainServer(), CACHE_TTL.etherscan, 'Etherscan'),
    cachedFetch('yahoo:macro', () => fetchMacroIndicatorsServer(), CACHE_TTL.yahoo, 'Yahoo Macro'),
    cachedFetch(`lc:${token}`, () => fetchTopicSocial(token.toLowerCase()), CACHE_TTL.lunarcrush, 'LunarCrush'),
    cachedFetch(`ca:oih:${marketPair}:${tf}`, () => fetchOIHistoryServer(marketPair, tf, 24), CACHE_TTL.coinalyze, 'Coinalyze OIHist'),
    cachedFetch('fred:macro', () => fetchFredMacroData(), CACHE_TTL.fred, 'FRED'),
    cachedFetch(`cq:${cqAsset}`, () => fetchCQServer(cqAsset), CACHE_TTL.cryptoquant, 'CryptoQuant'),
    cachedFetch(`san:${token}`, () => fetchSantimentSocial(token.toLowerCase()), CACHE_TTL.santiment, 'Santiment'),
    cachedFetch(`cm:${cqAsset}`, () => fetchCoinMetricsData(cqAsset), CACHE_TTL.coinmetrics, 'CoinMetrics'),
    // MTF context (5 timeframes, cached 20s inside getMultiTimeframeIndicatorContext)
    getMultiTimeframeIndicatorContext(marketPair),
    // S/R用 higher-TF klines (fetchKlinesServer has internal cache)
    fetchKlinesServer(symbol, '1d', 120),
    fetchKlinesServer(symbol, '1w', 60),
  ]);

  // ── Phase 3: Data Consolidation ──
  const now = Date.now();
  const latest = klines[klines.length - 1];
  const closes = klines.map((k) => k.close);

  const latestClose = latest.close;
  const latestVolume = latest.volume;
  const avgVolume20 = klines.slice(-20).reduce((sum, k) => sum + k.volume, 0) / Math.max(1, Math.min(20, klines.length));
  const volumeRatio = avgVolume20 > 0 ? latestVolume / avgVolume20 : 1;
  const rsiArr = calcRSI(closes, 14);
  const rsiLast = rsiArr.length > 0 ? rsiArr[rsiArr.length - 1] : Number.NaN;
  const rsi14 = Number.isFinite(rsiLast) ? rsiLast : null;
  const sma20 = smaLast(closes, 20);
  const sma60 = smaLast(closes, 60);
  const sma120 = smaLast(closes, 120);
  const atrPct = computeAtrPct(klines, 14);
  const change24 = Number(ticker.priceChangePercent || 0);

  // Derivatives
  const oi = oiRaw.status === 'fulfilled' && oiRaw.value ? oiRaw.value.value : null;
  const funding = fundingRaw.status === 'fulfilled' && fundingRaw.value ? fundingRaw.value.value : null;
  const predFunding = predFundingRaw.status === 'fulfilled' && predFundingRaw.value ? predFundingRaw.value.value : null;
  const lsRatio = lsRaw.status === 'fulfilled' && lsRaw.value.length > 0
    ? lsRaw.value[lsRaw.value.length - 1].value : null;
  const liqLong = liqRaw.status === 'fulfilled' && liqRaw.value.length > 0
    ? liqRaw.value.reduce((sum, d) => sum + d.long, 0) : 0;
  const liqShort = liqRaw.status === 'fulfilled' && liqRaw.value.length > 0
    ? liqRaw.value.reduce((sum, d) => sum + d.short, 0) : 0;

  // OI change
  let oiChangePercent: number | null = null;
  const oiHist = oiHistRaw.status === 'fulfilled' ? oiHistRaw.value : null;
  if (oi != null && oiHist != null && Array.isArray(oiHist) && oiHist.length >= 2) {
    const oiFirst = oiHist[0]?.value ?? null;
    const oiLast = oiHist[oiHist.length - 1]?.value ?? null;
    if (oiFirst != null && oiLast != null && oiFirst > 0) {
      oiChangePercent = ((oiLast - oiFirst) / oiFirst) * 100;
    }
  }

  // Sentiment
  const fngSnapshot = fngRaw.status === 'fulfilled' ? fngRaw.value : null;
  const fng = fngSnapshot?.current
    ? { value: fngSnapshot.current.value, classification: fngSnapshot.current.classification }
    : null;

  // Social: Santiment primary → LunarCrush fallback
  const santiment = santimentRaw.status === 'fulfilled' ? santimentRaw.value : null;
  const lunarcrush = socialRaw.status === 'fulfilled' ? socialRaw.value : null;
  const social = santiment ?? lunarcrush;

  // CoinGecko global
  const cgGlobalRawData = cgGlobalRaw.status === 'fulfilled' ? cgGlobalRaw.value : null;
  const cgGlobal = cgGlobalRawData ? {
    btcDominance: cgGlobalRawData.btcDominance,
    marketCapChange24h: cgGlobalRawData.marketCapChange24hPct,
  } : null;

  // On-chain: CoinMetrics primary → CryptoQuant fallback
  const coinMetrics = coinMetricsRaw.status === 'fulfilled' ? coinMetricsRaw.value : null;
  const cqFallback = cqRaw.status === 'fulfilled' ? cqRaw.value : null;
  const cq = (coinMetrics?.onchainMetrics?.mvrv != null) ? coinMetrics : cqFallback;

  // ETH on-chain
  const ethOnchain = ethOnchainRaw.status === 'fulfilled' ? ethOnchainRaw.value : null;

  // Macro
  const macro = macroRaw.status === 'fulfilled' ? macroRaw.value : null;
  const fred = fredRaw.status === 'fulfilled' ? fredRaw.value : null;

  // ── VPA computation ──
  const recentK20 = klines.slice(-20);
  const cvd = recentK20.reduce((sum, k) => sum + (k.close >= k.open ? k.volume : -k.volume), 0);
  const totalVol20 = recentK20.reduce((sum, k) => sum + k.volume, 0);
  const cvdRatio = totalVol20 > 0 ? cvd / totalVol20 : 0;
  const buyVol = recentK20.filter((k) => k.close >= k.open).reduce((s, k) => s + k.volume, 0);
  const sellVol = recentK20.filter((k) => k.close < k.open).reduce((s, k) => s + k.volume, 0);
  const bsRatio = buyVol + sellVol > 0 ? buyVol / (buyVol + sellVol) : 0.5;

  const last5 = klines.slice(-5);
  let absorptionCount = 0;
  for (const k of last5) {
    const body = Math.abs(k.close - k.open);
    const range = k.high - k.low;
    if (range > 0 && body / range < 0.3 && k.volume > avgVolume20 * 1.2) absorptionCount++;
  }

  // ── ICT computation ──
  const high50 = Math.max(...klines.slice(-50).map((k) => k.high));
  const low50 = Math.min(...klines.slice(-50).map((k) => k.low));
  const range50 = high50 - low50;
  const pricePosition50 = range50 > 0 ? (latestClose - low50) / range50 : 0.5;

  const recent10 = klines.slice(-10);
  const prev10 = klines.slice(-20, -10);
  const recentHigh = Math.max(...recent10.map((k) => k.high));
  const prevHigh = Math.max(...prev10.map((k) => k.high));
  const recentLow = Math.min(...recent10.map((k) => k.low));
  const prevLow = Math.min(...prev10.map((k) => k.low));

  let bullFVG = 0;
  let bearFVG = 0;
  for (let i = klines.length - 3; i >= Math.max(klines.length - 12, 2); i--) {
    if (klines[i].low > klines[i - 2].high) bullFVG++;
    if (klines[i].high < klines[i - 2].low) bearFVG++;
  }

  // ── MTF context ──
  const mtfRaw = mtfContextRaw.status === 'fulfilled' ? mtfContextRaw.value : null;
  const mtf = mtfRaw ? {
    consensusBias: mtfRaw.consensusBias,
    consensusConfidence: mtfRaw.consensusConfidence,
    alignmentPct: mtfRaw.alignmentPct,
    weightedScore: mtfRaw.weightedScore,
    snapshots: mtfRaw.snapshots.map((s) => ({
      timeframe: s.timeframe,
      bias: s.bias,
      confidence: s.confidence,
      emaTrend: s.emaTrend,
      rsi14: s.rsi14,
      macdState: s.macdState,
      atrPct: s.atrPct,
    })),
  } : null;

  // ── S/R levels (user TF + 1D + 1W, merged by distance to current price) ──
  const srUserTf = calcSRLevels(klines, tf.toUpperCase(), 3);
  const sr1dKlines = srKlines1dRaw.status === 'fulfilled' ? srKlines1dRaw.value : [];
  const sr1wKlines = srKlines1wRaw.status === 'fulfilled' ? srKlines1wRaw.value : [];
  const sr1d = calcSRLevels(sr1dKlines, '1D', 2);
  const sr1w = calcSRLevels(sr1wKlines, '1W', 2);
  const srLevels = [...srUserTf, ...sr1d, ...sr1w]
    .sort((a, b) => Math.abs(a.price - latestClose) - Math.abs(b.price - latestClose))
    .slice(0, 6);

  // ── Build snapshot ──
  return {
    pair: marketPair,
    timeframe: tf,
    token,
    latestClose,
    timestamp: now,

    candles: {
      rsi14,
      sma20,
      sma60,
      sma120,
      atrPct,
      volumeRatio,
      change24h: change24,
      priceVsBollinger: computeBollingerPosition(closes, sma20),
      recentPattern: detectRecentPattern(klines),
      trendStructure: detectTrendStructure(klines),
    },

    derivatives: {
      openInterest: oi,
      funding,
      predictedFunding: predFunding,
      lsRatio,
      liqLong24h: liqLong,
      liqShort24h: liqShort,
      oiChangePercent,
    },

    onchain: {
      exchangeNetflow: ethOnchain?.exchangeNetflowEth ?? null,
      whaleNetflow: cq?.whaleData?.whaleNetflow ?? null,
      minerOutflow: cq?.minerData?.minerOutflow24h ?? null,
      mvrv: cq?.onchainMetrics?.mvrv ?? null,
      nupl: cq?.onchainMetrics?.nupl ?? null,
      exchangeReserve: cq?.exchangeReserve?.netflow24h ?? null,
      exchangeReserveChange7dPct: cq?.exchangeReserve?.change7dPct ?? null,
    },

    sentiment: {
      fearGreedIndex: fng?.value ?? null,
      fearGreedLabel: fng?.classification ?? null,
      socialSentiment: social?.sentiment ?? null,
      socialDominance: social?.socialDominance ?? null,
      galaxyScore: social?.galaxyScore ?? null,
      socialInteractions24h: social?.interactions24h ?? null,
    },

    macro: {
      dxy: macro?.dxy ? {
        value: macro.dxy.price,
        change1d: macro.dxy.changePct ?? 0,
        trend1m: macro.dxy.trend1m,
      } : null,
      spx: macro?.spx ? {
        value: macro.spx.price,
        change1d: macro.spx.changePct ?? 0,
        trend1m: macro.spx.trend1m,
      } : null,
      us10y: macro?.us10y ? {
        value: macro.us10y.price,
        change1d: macro.us10y.changePct ?? 0,
      } : null,
      fedFundsRate: fred?.fedFundsRate?.latest?.value ?? null,
      yieldCurve: fred?.yieldCurve?.latest?.value ?? null,
      m2ChangePercent: fred?.m2?.changePct ?? null,
      btcDominance: cgGlobal?.btcDominance ?? null,
      totalMarketCapChange24h: cgGlobal?.marketCapChange24h ?? null,
    },

    vpa: {
      cvdRatio,
      buyVolPercent: bsRatio * 100,
      volumeRatio,
      absorptionCount,
    },

    ict: {
      pricePosition50,
      bullFvgCount: bullFVG,
      bearFvgCount: bearFVG,
      recentHighBreak: recentHigh > prevHigh,
      recentLowBreak: recentLow < prevLow,
      range50High: high50,
      range50Low: low50,
    },

    ethOnchain: ethOnchain ? {
      gasStandard: ethOnchain.gas?.standard ?? null,
      activeAddresses: ethOnchain.activeAddresses,
      exchangeBalance: ethOnchain.exchangeBalance,
      whaleActivity: ethOnchain.whaleActivity,
    } : null,

    mtf,
    srLevels,
  };
}
