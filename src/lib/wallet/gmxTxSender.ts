// ═══════════════════════════════════════════════════════════════
// STOCKCLAW — GMX Transaction Sender (Browser Wallet)
// ═══════════════════════════════════════════════════════════════
// Sends actual on-chain transactions from the user's wallet.
// Used for GMX V2 orders (multicall), USDC approvals, etc.
//
// This runs in the BROWSER only — it uses the wallet provider
// to call eth_sendTransaction.

import { resolveEvmProvider, type WalletProviderKey } from './providers';
import type { GmxCalldata } from '$lib/contracts/positions';

export type TxCalldata = GmxCalldata;

/**
 * Send a transaction using the user's wallet.
 * Returns the transaction hash.
 */
export async function sendTransaction(
  providerKey: WalletProviderKey,
  from: string,
  calldata: GmxCalldata,
): Promise<string> {
  const provider = await resolveEvmProvider(providerKey);
  if (!provider) {
    throw new Error('Wallet provider not available');
  }

  try {
    const txHash = await provider.request({
      method: 'eth_sendTransaction',
      params: [{
        from,
        to: calldata.to,
        data: calldata.data,
        value: calldata.value,
      }],
    });

    if (typeof txHash !== 'string' || !txHash.startsWith('0x')) {
      throw new Error('Invalid transaction hash returned');
    }

    return txHash;
  } catch (err: unknown) {
    // User rejected
    if ((err as {code?:number})?.code === 4001) {
      throw new Error('트랜잭션이 거부되었습니다.');
    }
    throw err;
  }
}

/**
 * Send USDC approve transaction for GMX SyntheticsRouter.
 * This is a one-time approval — MaxUint256 so user doesn't
 * need to approve again.
 */
export async function approveUsdc(
  providerKey: WalletProviderKey,
  from: string,
  approveCalldata: GmxCalldata,
): Promise<string> {
  return sendTransaction(providerKey, from, approveCalldata);
}

/**
 * Send GMX multicall transaction (open/close position).
 */
export async function sendGmxOrder(
  providerKey: WalletProviderKey,
  from: string,
  calldata: GmxCalldata,
): Promise<string> {
  return sendTransaction(providerKey, from, calldata);
}
