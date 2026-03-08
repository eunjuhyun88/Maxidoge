// ═══════════════════════════════════════════════════════════════
// Stockclaw — Composite Data Fetchers (shared)
// ═══════════════════════════════════════════════════════════════
// Reusable composite fetchers used by scanEngine (and available
// for marketSnapshotService if needed).

import { fetchGasOracle, estimateExchangeNetflow } from '$lib/server/etherscan';
import { fetchYahooSeries } from '$lib/server/yahooFinance';

// ── ETH On-chain Composite ───────────────────────────────────

export interface EthOnchainData {
  gas: { safe: number; standard: number; fast: number; baseFee: number } | null;
  exchangeNetflowEth: number | null;
  whaleActivity: number | null;
  activeAddresses: number | null;
  exchangeBalance: number | null;
}

export async function fetchEthOnchainServer(): Promise<EthOnchainData | null> {
  const [gasRes, netflowRes] = await Promise.allSettled([
    fetchGasOracle(),
    estimateExchangeNetflow(),
  ]);

  const gasOracle = gasRes.status === 'fulfilled' ? gasRes.value : null;
  const netflow = netflowRes.status === 'fulfilled' ? netflowRes.value : null;

  if (!gasOracle && netflow == null) return null;

  return {
    gas: gasOracle
      ? {
          safe: Number(gasOracle.SafeGasPrice),
          standard: Number(gasOracle.ProposeGasPrice),
          fast: Number(gasOracle.FastGasPrice),
          baseFee: Number(gasOracle.suggestBaseFee),
        }
      : null,
    exchangeNetflowEth: netflow,
    whaleActivity: null,
    activeAddresses: null,
    exchangeBalance: null,
  };
}

// ── Macro Indicators Composite (DXY, SPX, US10Y) ────────────

export interface MacroIndicator {
  price: number;
  prevClose: number | null;
  changePct: number | null;
  trend1m: number | null;
}

export interface MacroIndicators {
  dxy: MacroIndicator | null;
  spx: MacroIndicator | null;
  us10y: MacroIndicator | null;
}

export async function fetchMacroIndicatorsServer(): Promise<MacroIndicators | null> {
  const [dxyRes, spxRes, us10yRes] = await Promise.allSettled([
    fetchYahooSeries('DX-Y.NYB', '1mo', '1d'),
    fetchYahooSeries('^GSPC', '1mo', '1d'),
    fetchYahooSeries('^TNX', '1mo', '1d'),
  ]);

  function toMacroIndicator(
    series: PromiseSettledResult<Awaited<ReturnType<typeof fetchYahooSeries>>>,
  ): MacroIndicator | null {
    if (series.status !== 'fulfilled' || !series.value) return null;
    const s = series.value;
    const pts = s.points;
    const price =
      s.regularMarketPrice ?? (pts.length > 0 ? pts[pts.length - 1].close : 0);
    const changePct = s.regularMarketChangePercent ?? null;

    let trend1m: number | null = null;
    if (pts.length >= 2) {
      const first = pts[0].close;
      const last = pts[pts.length - 1].close;
      if (first > 0) trend1m = ((last - first) / first) * 100;
    }

    return { price, prevClose: s.previousClose, changePct, trend1m };
  }

  const dxy = toMacroIndicator(dxyRes);
  const spx = toMacroIndicator(spxRes);
  const us10y = toMacroIndicator(us10yRes);

  if (!dxy && !spx && !us10y) return null;
  return { dxy, spx, us10y };
}
