// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — Wallet Verification API (dbStore backed)
// POST /api/auth/wallet
// Body: { address: string, signature?: string, provider: string }
// ═══════════════════════════════════════════════════════════════

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { address, signature, provider } = body;

    // Validate
    if (!address || address.length < 10) {
      return json({ error: 'Valid wallet address required' }, { status: 400 });
    }

    // Verify signature (simulated — replace with ethers.js verifyMessage)
    const verified = !!signature && signature.length > 20;

    // In production: verify signature against address using ethers.js
    // const signerAddress = ethers.verifyMessage(message, signature);
    // if (signerAddress.toLowerCase() !== address.toLowerCase()) ...

    return json({
      success: true,
      wallet: {
        address,
        shortAddr: address.slice(0, 6) + '...' + address.slice(-4),
        chain: 'ARB',
        provider: provider || 'unknown',
        verified,
        linkedAt: new Date().toISOString()
      }
    });
  } catch {
    return json({ error: 'Invalid request body' }, { status: 400 });
  }
};
