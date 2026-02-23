// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — Etherscan On-chain Client (B-05)
// ═══════════════════════════════════════════════════════════════
// Client-side wrapper for /api/etherscan/onchain proxy
// Maps to: FLOW agent → EXCHANGE_FLOW, VALUATION agent → network activity

export interface EthOnchainData {
  gas: {
    safe: number;
    standard: number;
    fast: number;
    baseFee: number;
  } | null;
  ethSupply: number | null;
  ethPrice: { ethbtc: number; ethusd: number } | null;
  exchangeNetflowEth: number | null;
  updatedAt: number;
}

/** Fetch on-chain data from our Etherscan proxy */
export async function fetchEthOnchain(): Promise<EthOnchainData | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch('/api/etherscan/onchain', { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? null;
  } catch (err) {
    console.error('[EthOnchain] fetch error:', err);
    return null;
  }
}

/**
 * Convert gas price to network activity score.
 * High gas → high demand → bullish signal
 * Low gas → low activity → neutral/bearish
 * Range: -30 to +30
 */
export function gasToActivityScore(gasPriceGwei: number): number {
  if (gasPriceGwei > 50) return 30;   // extreme demand
  if (gasPriceGwei > 25) return 15;   // high demand
  if (gasPriceGwei > 10) return 5;    // moderate
  if (gasPriceGwei > 5) return 0;     // normal
  return -15;                          // very low activity
}

/**
 * Convert exchange netflow to flow score.
 * Large balance on exchange → potential sell pressure → bearish
 * Declining balance → accumulation → bullish
 * Returns -50 to +50
 */
export function netflowToScore(netflowEth: number): number {
  // Simple heuristic based on absolute exchange balance
  // Higher balance = more supply on exchanges = bearish
  // This is a snapshot, not a delta — we estimate based on known ranges
  // Binance top addresses typically hold 1-5M ETH
  const midpoint = 2_000_000; // 2M ETH as neutral benchmark
  const deviation = (netflowEth - midpoint) / midpoint;
  return Math.round(Math.max(-50, Math.min(50, -deviation * 80)));
}
