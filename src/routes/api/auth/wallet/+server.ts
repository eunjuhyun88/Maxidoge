// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — Wallet Verification API (PostgreSQL backed)
// POST /api/auth/wallet
// Body: { address: string, signature?: string, provider: string }
// ═══════════════════════════════════════════════════════════════

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthenticatedUser } from '$lib/server/authRepository';
import { query } from '$lib/server/db';
import { parseSessionCookie, SESSION_COOKIE_NAME } from '$lib/server/session';

const GENERIC_WALLET_RE = /^0x[0-9a-fA-F]{40}$|^[A-Za-z0-9]{20,64}$/;

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const address = typeof body?.address === 'string' ? body.address.trim() : '';
    const signature = typeof body?.signature === 'string' ? body.signature.trim() : '';
    const provider = typeof body?.provider === 'string' ? body.provider.trim() : 'unknown';

    if (!address || !GENERIC_WALLET_RE.test(address)) {
      return json({ error: 'Valid wallet address required' }, { status: 400 });
    }

    const sessionCookie = cookies.get(SESSION_COOKIE_NAME);
    const parsed = parseSessionCookie(sessionCookie);
    if (!parsed) {
      return json({ error: 'Authentication required' }, { status: 401 });
    }

    const user = await getAuthenticatedUser(parsed.token, parsed.userId);
    if (!user) {
      cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
      return json({ error: 'Authentication required' }, { status: 401 });
    }

    // Temporary verification rule (replace with real wallet signature verification)
    const verified = signature.length > 20;
    const requestedTier = verified ? 'verified' : 'connected';

    await query(
      `
        UPDATE users
        SET
          wallet_address = $1,
          wallet_signature = $2,
          tier = CASE
            WHEN tier = 'verified' THEN 'verified'
            WHEN $3 = 'verified' THEN 'verified'
            ELSE 'connected'
          END,
          phase = GREATEST(phase, 2),
          updated_at = now()
        WHERE id = $4
      `,
      [address, signature || null, requestedTier, user.id]
    );

    return json({
      success: true,
      wallet: {
        address,
        shortAddr: address.slice(0, 6) + '...' + address.slice(-4),
        chain: 'ARB',
        provider,
        verified,
        linkedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    if (typeof error?.message === 'string' && error.message.includes('DATABASE_URL is not set')) {
      return json({ error: 'Server database is not configured' }, { status: 500 });
    }
    if (error instanceof SyntaxError) {
      return json({ error: 'Invalid request body' }, { status: 400 });
    }
    console.error('[auth/wallet] unexpected error:', error);
    return json({ error: 'Failed to link wallet' }, { status: 500 });
  }
};
