import { BINANCE_MAP } from '$lib/data/tokens';
import { calculateHeatScore, type HeatScoreInput, type HeatScoreResult } from '$lib/engine/marketHeatScore';
import { detectMacroRegime, type MacroRegimeInput, type MacroRegimeResult } from '$lib/engine/macroRegime';

export interface MarketPulseRaw {
  updatedAt: number;
  fearGreed: number | null;
  fearGreedClassification: string | null;
  dxy: { price: number; changePct: number | null; trend1m: number | null } | null;
  spx: { price: number; changePct: number | null; trend1m: number | null } | null;
  us10y: { price: number; changePct: number | null } | null;
  mvrv: number | null;
  nupl: number | null;
  exchangeReserveChange7d: number | null;
  exchangeNetflow24h: number | null;
  fundingRate: number | null;
  oiChange24hPct: number | null;
  lsRatio: number | null;
  liqLong24h: number | null;
  liqShort24h: number | null;
  btcDominance: number | null;
}

export interface MarketPulseData {
  pair: string;
  raw: MarketPulseRaw;
  heatScore: HeatScoreResult;
  macroRegime: MacroRegimeResult;
}

export function normalizeMarketPulsePair(pairRaw: string | null | undefined): string {
  if (!pairRaw) return 'BTC/USDT';

  const normalized = pairRaw.trim().toUpperCase().replace(/[-_]/g, '/');
  if (!normalized) return 'BTC/USDT';
  if (normalized.includes('/')) return normalized;

  const token = BINANCE_MAP.get(normalized);
  if (token) return `${token.symbol}/USDT`;

  const quoteMatches = ['USDT', 'USDC', 'BUSD']
    .map((quote) => ({ quote, matched: normalized.endsWith(quote) }))
    .find((entry) => entry.matched);

  if (!quoteMatches) return 'BTC/USDT';
  const base = normalized.slice(0, -quoteMatches.quote.length);
  return base ? `${base}/${quoteMatches.quote}` : 'BTC/USDT';
}

export function buildMarketPulseData(pairRaw: string | null | undefined, raw: MarketPulseRaw): MarketPulseData {
  const pair = normalizeMarketPulsePair(pairRaw);

  const heatInput: HeatScoreInput = {
    fundingRate: raw.fundingRate,
    oiChange24hPct: raw.oiChange24hPct,
    lsRatio: raw.lsRatio,
    liqLong24h: raw.liqLong24h,
    liqShort24h: raw.liqShort24h,
    mvrv: raw.mvrv,
    nupl: raw.nupl,
    exchangeNetflow7d: raw.exchangeReserveChange7d,
    fearGreed: raw.fearGreed,
  };

  const regimeInput: MacroRegimeInput = {
    fearGreed: raw.fearGreed,
    mvrv: raw.mvrv,
    nupl: raw.nupl,
    dxyChangePct: raw.dxy?.changePct ?? null,
    dxyTrend1m: raw.dxy?.trend1m ?? null,
    spxChangePct: raw.spx?.changePct ?? null,
    spxTrend1m: raw.spx?.trend1m ?? null,
    us10yChangePct: raw.us10y?.changePct ?? null,
    fundingRate: raw.fundingRate,
    oiChange24hPct: raw.oiChange24hPct,
    btcDominance: raw.btcDominance,
  };

  return {
    pair,
    raw,
    heatScore: calculateHeatScore(heatInput),
    macroRegime: detectMacroRegime(regimeInput),
  };
}
