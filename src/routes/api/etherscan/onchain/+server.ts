// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — Etherscan On-chain Data Proxy
// ═══════════════════════════════════════════════════════════════
// Exposes server-side Etherscan data to client via REST
// Gas oracle + exchange netflow + ETH supply/price

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  fetchGasOracle,
  fetchEthSupply,
  fetchEthPrice,
  estimateExchangeNetflow
} from '$lib/server/etherscan';

export const GET: RequestHandler = async () => {
  try {
    const [gasRes, supplyRes, priceRes, netflowRes] = await Promise.allSettled([
      fetchGasOracle(),
      fetchEthSupply(),
      fetchEthPrice(),
      estimateExchangeNetflow()
    ]);

    const gas = gasRes.status === 'fulfilled' ? gasRes.value : null;
    const supply = supplyRes.status === 'fulfilled' ? supplyRes.value : null;
    const price = priceRes.status === 'fulfilled' ? priceRes.value : null;
    const netflow = netflowRes.status === 'fulfilled' ? netflowRes.value : null;

    return json(
      {
        ok: true,
        data: {
          gas: gas
            ? {
                safe: Number(gas.SafeGasPrice),
                standard: Number(gas.ProposeGasPrice),
                fast: Number(gas.FastGasPrice),
                baseFee: Number(gas.suggestBaseFee || 0)
              }
            : null,
          ethSupply: supply,
          ethPrice: price,
          exchangeNetflowEth: netflow,
          updatedAt: Date.now()
        }
      },
      { headers: { 'Cache-Control': 'public, max-age=60' } }
    );
  } catch (error: any) {
    console.error('[etherscan/onchain] error:', error);
    return json({ error: 'Failed to fetch on-chain data' }, { status: 500 });
  }
};
