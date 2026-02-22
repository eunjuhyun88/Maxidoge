// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — Market Snapshot + Context Assembler (B-05)
// ═══════════════════════════════════════════════════════════════

import type { MarketContext } from '$lib/engine/factorEngine';
import { analyzeTrend, detectDivergence } from '$lib/engine/trend';
import type { DivergenceSignal, TrendAnalysis } from '$lib/engine/types';
import { calcEMA, calcRSI } from '$lib/engine/indicators';
import { fetch24hr, fetchKlines, pairToSymbol, type Binance24hr, type BinanceKline } from '$lib/api/binance';
import { fetchDerivatives, fetchNews, normalizePair, normalizeTimeframe } from '$lib/server/marketFeedService';
import { fetchFearGreed } from '$lib/server/feargreed';
import { fetchCoinGeckoGlobal, fetchStablecoinMcap } from '$lib/server/coingecko';
import { fetchDefiLlamaStableMcap } from '$lib/server/defillama';
import { fetchYahooSeries } from '$lib/server/yahooFinance';
import { fetchCoinMarketCapQuote } from '$lib/server/coinmarketcap';
import { withTransaction } from '$lib/server/db';

const SNAPSHOT_UNAVAILABLE_CODES = new Set(['42P01', '42703', '23503']);

type SnapshotSource = {
  source: string;
  dataType: string;
  payload: unknown;
  ttlMs: number;
};

type IndicatorRow = {
  indicator: string;
  timestamps: number[];
  values: number[];
  divergence?: DivergenceSignal | null;
};

export type MarketSnapshotResult = {
  pair: string;
  timeframe: string;
  at: number;
  updated: string[];
  persisted: boolean;
  warning?: string;
  context: MarketContext;
  sources: {
    binance: boolean;
    derivatives: boolean;
    fearGreed: boolean;
    coingecko: boolean;
    defillama: boolean;
    yahoo: boolean;
    coinmarketcap: boolean;
    news: boolean;
  };
};

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

function normalizeSeries(
  timestamps: number[],
  values: number[],
  maxPoints = 200
): { timestamps: number[]; values: number[] } {
  const outTs: number[] = [];
  const outVals: number[] = [];
  const n = Math.min(timestamps.length, values.length);
  for (let i = 0; i < n; i += 1) {
    const ts = Number(timestamps[i]);
    const val = Number(values[i]);
    if (!Number.isFinite(ts) || !Number.isFinite(val)) continue;
    outTs.push(Math.trunc(ts));
    outVals.push(val);
  }
  if (outVals.length <= maxPoints) return { timestamps: outTs, values: outVals };
  return {
    timestamps: outTs.slice(-maxPoints),
    values: outVals.slice(-maxPoints),
  };
}

function trendFromValueAndPct(value: number | null, changePct: number | null): TrendAnalysis | null {
  if (!isFiniteNumber(Number(value)) || !isFiniteNumber(Number(changePct))) return null;
  const v = Number(value);
  const pct = Number(changePct);
  const prev = Math.abs(100 + pct) < 0.000001 ? v : v / (1 + pct / 100);
  return analyzeTrend([prev, v]);
}

function pseudoTrendAroundMidpoint(value: number | null, midpoint = 50, scale = 12): TrendAnalysis | null {
  if (!isFiniteNumber(Number(value))) return null;
  const v = Number(value);
  const slope = Math.max(-1, Math.min(1, (v - midpoint) / scale));
  const direction = slope > 0.08 ? 'RISING' : slope < -0.08 ? 'FALLING' : 'FLAT';
  return {
    direction,
    slope,
    acceleration: 0,
    strength: Math.min(100, Math.abs(slope) * 100),
    duration: 1,
    fromValue: v,
    toValue: v,
    changePct: 0,
  };
}

function buildNewsImpact(newsItems: Array<{ sentiment: 'bullish' | 'bearish' | 'neutral' }>): number | null {
  if (!newsItems.length) return null;
  let bull = 0;
  let bear = 0;
  for (const row of newsItems) {
    if (row.sentiment === 'bullish') bull += 1;
    if (row.sentiment === 'bearish') bear += 1;
  }
  if (bull === 0 && bear === 0) return 0;
  const ratio = (bull - bear) / Math.max(bull + bear, 1);
  return Math.round(ratio * 70);
}

function buildRsiDivergence(closes: number[], rsi: number[]): DivergenceSignal | null {
  const p: number[] = [];
  const i: number[] = [];
  const n = Math.min(closes.length, rsi.length);
  for (let idx = 0; idx < n; idx += 1) {
    const c = closes[idx];
    const r = rsi[idx];
    if (!Number.isFinite(c) || !Number.isFinite(r)) continue;
    p.push(c);
    i.push(r);
  }
  if (p.length < 8) return null;
  return detectDivergence(p.slice(-96), i.slice(-96));
}

function isPersistenceUnavailableError(error: any): boolean {
  const code = typeof error?.code === 'string' ? error.code : '';
  if (SNAPSHOT_UNAVAILABLE_CODES.has(code)) return true;
  return typeof error?.message === 'string' && error.message.includes('DATABASE_URL is not set');
}

async function persistSnapshots(
  pair: string,
  timeframe: string,
  at: number,
  sources: SnapshotSource[],
  indicators: IndicatorRow[]
): Promise<string[]> {
  const nowIso = new Date(at).toISOString();
  await withTransaction(async (client) => {
    for (const row of sources) {
      const expiresIso = new Date(at + row.ttlMs).toISOString();
      await client.query(
        `
          INSERT INTO market_snapshots (pair, source, data_type, payload, fetched_at, expires_at)
          VALUES ($1, $2, $3, $4::jsonb, $5::timestamptz, $6::timestamptz)
          ON CONFLICT (pair, source, data_type)
          DO UPDATE SET
            payload = EXCLUDED.payload,
            fetched_at = EXCLUDED.fetched_at,
            expires_at = EXCLUDED.expires_at
        `,
        [pair, row.source, row.dataType, JSON.stringify(row.payload ?? {}), nowIso, expiresIso]
      );
    }

    for (const row of indicators) {
      const normalized = normalizeSeries(row.timestamps, row.values, 200);
      if (normalized.values.length === 0) continue;

      const trend = analyzeTrend(normalized.values);
      const div = row.divergence ?? null;

      await client.query(
        `
          INSERT INTO indicator_series (
            pair, timeframe, indicator, timestamps, vals,
            trend_dir, trend_slope, trend_accel, trend_strength, trend_duration,
            divergence_type, divergence_conf, computed_at
          )
          VALUES (
            $1, $2, $3, $4::bigint[], $5::numeric[],
            $6::trend_dir_enum, $7::numeric, $8::numeric, $9::numeric, $10::int,
            $11::text, $12::numeric, $13::timestamptz
          )
          ON CONFLICT (pair, timeframe, indicator)
          DO UPDATE SET
            timestamps = EXCLUDED.timestamps,
            vals = EXCLUDED.vals,
            trend_dir = EXCLUDED.trend_dir,
            trend_slope = EXCLUDED.trend_slope,
            trend_accel = EXCLUDED.trend_accel,
            trend_strength = EXCLUDED.trend_strength,
            trend_duration = EXCLUDED.trend_duration,
            divergence_type = EXCLUDED.divergence_type,
            divergence_conf = EXCLUDED.divergence_conf,
            computed_at = EXCLUDED.computed_at
        `,
        [
          pair,
          timeframe,
          row.indicator,
          normalized.timestamps,
          normalized.values,
          trend.direction,
          trend.slope,
          trend.acceleration,
          trend.strength,
          trend.duration,
          div?.type ?? null,
          div?.confidence ?? null,
          nowIso,
        ]
      );
    }
  });

  return indicators.map((row) => row.indicator);
}

function requireKlines(value: PromiseSettledResult<BinanceKline[]>): BinanceKline[] {
  if (value.status === 'fulfilled' && Array.isArray(value.value) && value.value.length > 0) return value.value;
  throw new Error('binance klines unavailable');
}

function toTicker(value: PromiseSettledResult<Binance24hr>): Binance24hr | null {
  return value.status === 'fulfilled' ? value.value : null;
}

export async function collectMarketSnapshot(
  eventFetch: typeof fetch,
  input: { pair?: unknown; timeframe?: unknown; persist?: boolean } = {}
): Promise<MarketSnapshotResult> {
  const pair = normalizePair(input.pair);
  const timeframe = normalizeTimeframe(input.timeframe);
  const persist = input.persist !== false;
  const at = Date.now();
  const symbol = pairToSymbol(pair);
  const token = pair.split('/')[0];

  const [
    klinesRes,
    klines1hRes,
    klines1dRes,
    tickerRes,
    derivRes,
    fearGreedRes,
    geckoGlobalRes,
    geckoStableRes,
    llamaStableRes,
    dxyRes,
    spxRes,
    us10yRes,
    newsRes,
    cmcRes,
  ] = await Promise.allSettled([
    fetchKlines(symbol, timeframe, 300),
    fetchKlines(symbol, '1h', 300),
    fetchKlines(symbol, '1d', 300),
    fetch24hr(symbol),
    fetchDerivatives(eventFetch, pair, timeframe),
    fetchFearGreed(60),
    fetchCoinGeckoGlobal(),
    fetchStablecoinMcap(),
    fetchDefiLlamaStableMcap(),
    fetchYahooSeries('DX-Y.NYB', '1mo', '1d'),
    fetchYahooSeries('^GSPC', '1mo', '1d'),
    fetchYahooSeries('^TNX', '1mo', '1d'),
    fetchNews(20),
    fetchCoinMarketCapQuote(token),
  ]);

  const klines = requireKlines(klinesRes);
  const klines1h = klines1hRes.status === 'fulfilled' ? klines1hRes.value : undefined;
  const klines1d = klines1dRes.status === 'fulfilled' ? klines1dRes.value : undefined;
  const ticker = toTicker(tickerRes);
  const derivatives = derivRes.status === 'fulfilled' ? derivRes.value : null;
  const fearGreed = fearGreedRes.status === 'fulfilled' ? fearGreedRes.value : { current: null, points: [] };
  const geckoGlobal = geckoGlobalRes.status === 'fulfilled' ? geckoGlobalRes.value : null;
  const geckoStable = geckoStableRes.status === 'fulfilled' ? geckoStableRes.value : null;
  const llamaStable = llamaStableRes.status === 'fulfilled' ? llamaStableRes.value : null;
  const dxy = dxyRes.status === 'fulfilled' ? dxyRes.value : null;
  const spx = spxRes.status === 'fulfilled' ? spxRes.value : null;
  const us10y = us10yRes.status === 'fulfilled' ? us10yRes.value : null;
  const news = newsRes.status === 'fulfilled' ? newsRes.value : [];
  const cmc = cmcRes.status === 'fulfilled' ? cmcRes.value : null;

  const stableMcap = llamaStable?.totalMcapUsd ?? geckoStable?.totalMcapUsd ?? null;
  const stableMcapChange24h = llamaStable?.change24hPct ?? geckoStable?.change24hPct ?? null;
  const dxyTrend = dxy?.points?.length ? analyzeTrend(dxy.points.map((p) => p.close)) : null;
  const equityTrend = spx?.points?.length ? analyzeTrend(spx.points.map((p) => p.close)) : null;
  const yieldTrend = us10y?.points?.length ? analyzeTrend(us10y.points.map((p) => p.close)) : null;
  const btcDomTrend =
    trendFromValueAndPct(geckoGlobal?.btcDominance ?? null, geckoGlobal?.marketCapChange24hPct ?? null) ??
    pseudoTrendAroundMidpoint(geckoGlobal?.btcDominance ?? null, 50, 12);
  const stableMcapTrend =
    trendFromValueAndPct(stableMcap, stableMcapChange24h) ?? pseudoTrendAroundMidpoint(stableMcapChange24h, 0, 5);

  const closes = klines.map((k) => k.close);
  const volumes = klines.map((k) => k.volume);
  const highs = klines.map((k) => k.high);
  const lows = klines.map((k) => k.low);
  const timesMs = klines.map((k) => k.time * 1000);
  const rsi14 = calcRSI(closes, 14);
  const ema20 = calcEMA(closes, 20);
  const ema60 = calcEMA(closes, 60);
  const ema120 = calcEMA(closes, 120);
  const rsiDiv = buildRsiDivergence(closes, rsi14);

  const context: MarketContext = {
    pair,
    timeframe,
    klines,
    klines1h,
    klines1d,
    ticker: ticker
      ? {
          change24h: Number(ticker.priceChangePercent ?? 0),
          volume24h: Number(ticker.quoteVolume ?? 0),
          high24h: Number(ticker.highPrice ?? 0),
          low24h: Number(ticker.lowPrice ?? 0),
        }
      : undefined,
    derivatives: derivatives
      ? {
          oi: derivatives.oi,
          funding: derivatives.funding,
          predFunding: derivatives.predFunding,
          lsRatio: derivatives.lsRatio,
          liqLong: derivatives.liqLong24h,
          liqShort: derivatives.liqShort24h,
        }
      : undefined,
    onchain: {
      stablecoinFlow: stableMcapChange24h,
      realizedCap: cmc?.marketCap ?? null,
    },
    sentiment: {
      fearGreed: fearGreed.current?.value ?? null,
      newsImpact: buildNewsImpact(news),
    },
    macro: {
      dxy: dxy?.points?.length ? dxy.points[dxy.points.length - 1].close : null,
      dxyTrend,
      equityTrend,
      yieldTrend,
      btcDominance: geckoGlobal?.btcDominance ?? null,
      btcDomTrend,
      stablecoinMcap: stableMcap,
      stableMcapTrend,
      eventProximity: 0,
    },
  };

  const fearGreedSeriesTs = fearGreed.points.map((row) => row.timestampMs).reverse();
  const fearGreedSeriesVals = fearGreed.points.map((row) => row.value).reverse();
  const dxyTs = dxy?.points?.map((row) => row.timestampMs) ?? [];
  const dxyVals = dxy?.points?.map((row) => row.close) ?? [];
  const spxTs = spx?.points?.map((row) => row.timestampMs) ?? [];
  const spxVals = spx?.points?.map((row) => row.close) ?? [];
  const us10yTs = us10y?.points?.map((row) => row.timestampMs) ?? [];
  const us10yVals = us10y?.points?.map((row) => row.close) ?? [];

  const indicators: IndicatorRow[] = [
    { indicator: 'CLOSE', timestamps: timesMs, values: closes },
    { indicator: 'VOLUME', timestamps: timesMs, values: volumes },
    { indicator: 'EMA_20', timestamps: timesMs, values: ema20 },
    { indicator: 'EMA_60', timestamps: timesMs, values: ema60 },
    { indicator: 'EMA_120', timestamps: timesMs, values: ema120 },
    { indicator: 'RSI_14', timestamps: timesMs, values: rsi14, divergence: rsiDiv },
    {
      indicator: 'OI',
      timestamps: derivatives?.oi != null ? [at] : [],
      values: derivatives?.oi != null ? [Number(derivatives.oi)] : [],
    },
    {
      indicator: 'FUNDING_RATE',
      timestamps: derivatives?.funding != null ? [at] : [],
      values: derivatives?.funding != null ? [Number(derivatives.funding)] : [],
    },
    {
      indicator: 'LS_RATIO',
      timestamps: derivatives?.lsRatio != null ? [at] : [],
      values: derivatives?.lsRatio != null ? [Number(derivatives.lsRatio)] : [],
    },
    {
      indicator: 'FEAR_GREED',
      timestamps: fearGreedSeriesTs,
      values: fearGreedSeriesVals,
    },
    {
      indicator: 'BTC_DOM',
      timestamps: geckoGlobal?.updatedAt ? [geckoGlobal.updatedAt] : [],
      values: geckoGlobal?.btcDominance != null ? [geckoGlobal.btcDominance] : [],
    },
    {
      indicator: 'STABLE_MCAP',
      timestamps: stableMcap != null ? [at] : [],
      values: stableMcap != null ? [stableMcap] : [],
    },
    { indicator: 'DXY', timestamps: dxyTs, values: dxyVals },
    { indicator: 'SP500', timestamps: spxTs, values: spxVals },
    { indicator: 'US10Y', timestamps: us10yTs, values: us10yVals },
  ];

  const snapshotSources: SnapshotSource[] = [
    { source: 'binance', dataType: 'klines', payload: { pair, timeframe, rows: klines }, ttlMs: 30_000 },
    { source: 'binance', dataType: 'ticker24h', payload: ticker, ttlMs: 15_000 },
    { source: 'coinalyze', dataType: 'derivatives', payload: derivatives, ttlMs: 30_000 },
    { source: 'feargreed', dataType: 'index', payload: fearGreed.current, ttlMs: 300_000 },
    { source: 'coingecko', dataType: 'global', payload: geckoGlobal, ttlMs: 300_000 },
    {
      source: llamaStable ? 'defillama' : 'coingecko',
      dataType: 'stablecoin_mcap',
      payload: llamaStable ?? geckoStable,
      ttlMs: 300_000,
    },
    {
      source: 'yahoo',
      dataType: 'macro',
      payload: {
        dxy: dxy?.points?.slice(-30) ?? [],
        spx: spx?.points?.slice(-30) ?? [],
        us10y: us10y?.points?.slice(-30) ?? [],
      },
      ttlMs: 300_000,
    },
    {
      source: 'news',
      dataType: 'rss',
      payload: news.slice(0, 20),
      ttlMs: 120_000,
    },
    { source: 'coinmarketcap', dataType: 'quote', payload: cmc, ttlMs: 180_000 },
  ];

  let updated = indicators.map((row) => row.indicator);
  let persisted = false;
  let warning: string | undefined;
  if (persist) {
    try {
      updated = await persistSnapshots(pair, timeframe, at, snapshotSources, indicators);
      persisted = true;
    } catch (error: any) {
      if (isPersistenceUnavailableError(error)) {
        persisted = false;
        warning = 'market snapshot tables unavailable; returning non-persistent snapshot';
      } else {
        throw error;
      }
    }
  }

  return {
    pair,
    timeframe,
    at,
    updated,
    persisted,
    warning,
    context,
    sources: {
      binance: Boolean(klines.length),
      derivatives: Boolean(derivatives),
      fearGreed: Boolean(fearGreed.current),
      coingecko: Boolean(geckoGlobal),
      defillama: Boolean(llamaStable),
      yahoo: Boolean(dxy || spx || us10y),
      coinmarketcap: Boolean(cmc),
      news: Array.isArray(news) && news.length > 0,
    },
  };
}
