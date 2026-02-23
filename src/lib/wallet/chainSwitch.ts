// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — Chain Switching (Polygon for Polymarket)
// ═══════════════════════════════════════════════════════════════
// Ensures the user's wallet is on Polygon before signing
// Polymarket orders. Falls back to add chain if not configured.

import { resolveEvmProvider, type WalletProviderKey } from './providers';

const POLYGON_CHAIN_ID = '0x89'; // 137 in hex
const POLYGON_CHAIN_CONFIG = {
  chainId: POLYGON_CHAIN_ID,
  chainName: 'Polygon PoS',
  nativeCurrency: {
    name: 'MATIC',
    symbol: 'POL',
    decimals: 18,
  },
  rpcUrls: ['https://polygon-rpc.com', 'https://rpc-mainnet.maticvigil.com'],
  blockExplorerUrls: ['https://polygonscan.com'],
};

/**
 * Ensure the user's wallet is connected to Polygon.
 *
 * @param providerKey Which wallet to use
 * @returns true if successfully on Polygon, false if user rejected
 */
export async function ensurePolygonChain(providerKey: WalletProviderKey): Promise<boolean> {
  const provider = await resolveEvmProvider(providerKey);
  if (!provider) return false;

  try {
    // Check current chain
    const currentChainId = await provider.request({ method: 'eth_chainId' }) as string;
    if (currentChainId?.toLowerCase() === POLYGON_CHAIN_ID) {
      return true; // Already on Polygon
    }

    // Try switching to Polygon
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: POLYGON_CHAIN_ID }],
    });
    return true;
  } catch (switchError: any) {
    // Chain not added to wallet — try adding it
    if (switchError?.code === 4902) {
      try {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [POLYGON_CHAIN_CONFIG],
        });
        return true;
      } catch {
        return false; // User rejected add chain
      }
    }
    // User rejected switch
    if (switchError?.code === 4001) return false;
    return false;
  }
}

/**
 * Get the current chain ID from the wallet.
 */
export async function getCurrentChainId(providerKey: WalletProviderKey): Promise<number | null> {
  const provider = await resolveEvmProvider(providerKey);
  if (!provider) return null;

  try {
    const chainId = await provider.request({ method: 'eth_chainId' }) as string;
    return parseInt(chainId, 16);
  } catch {
    return null;
  }
}

/**
 * Check if the wallet is currently on Polygon.
 */
export async function isOnPolygon(providerKey: WalletProviderKey): Promise<boolean> {
  const chainId = await getCurrentChainId(providerKey);
  return chainId === 137;
}
