import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthenticatedUser } from '$lib/server/authRepository';
import {
  consumeWalletNonce,
  extractNonceFromMessage,
  isValidEthAddress,
  linkWalletToUser,
  normalizeEthAddress,
} from '$lib/server/walletAuthRepository';
import { parseSessionCookie, SESSION_COOKIE_NAME } from '$lib/server/session';

const SIGNATURE_RE = /^0x[0-9a-fA-F]{130}$/;

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const addressRaw = typeof body?.address === 'string' ? body.address.trim() : '';
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const signature = typeof body?.signature === 'string' ? body.signature.trim() : '';
    const provider = typeof body?.provider === 'string' ? body.provider.trim() : null;

    if (!isValidEthAddress(addressRaw)) {
      return json({ error: 'Valid Ethereum wallet address required' }, { status: 400 });
    }
    if (!message || message.length < 20) {
      return json({ error: 'Message is required' }, { status: 400 });
    }
    if (!SIGNATURE_RE.test(signature)) {
      return json({ error: 'Invalid signature format' }, { status: 400 });
    }

    const nonce = extractNonceFromMessage(message);
    if (!nonce) {
      return json({ error: 'Nonce not found in message' }, { status: 400 });
    }

    const address = normalizeEthAddress(addressRaw);
    const validNonce = await consumeWalletNonce({ address, nonce, message });
    if (!validNonce) {
      return json({ error: 'Nonce is invalid, expired, or already used' }, { status: 401 });
    }

    const sessionCookie = cookies.get(SESSION_COOKIE_NAME);
    const parsed = parseSessionCookie(sessionCookie);

    let linkedToUser = false;
    let userId: string | null = null;

    if (parsed) {
      const user = await getAuthenticatedUser(parsed.token, parsed.userId);
      if (user) {
        await linkWalletToUser({
          userId: user.id,
          address,
          signature,
          provider,
        });
        linkedToUser = true;
        userId = user.id;
      }
    }

    return json({
      success: true,
      verified: true,
      linkedToUser,
      userId,
      wallet: {
        address,
        shortAddr: address.slice(0, 6) + '...' + address.slice(-4),
        chain: 'ARB',
        provider: provider || 'metamask',
        verified: true,
      },
    });
  } catch (error: any) {
    if (error?.code === '42P01') {
      return json({ error: 'auth_nonces table is missing. Run migration 0003 first.' }, { status: 500 });
    }
    if (typeof error?.message === 'string' && error.message.includes('DATABASE_URL is not set')) {
      return json({ error: 'Server database is not configured' }, { status: 500 });
    }
    if (error instanceof SyntaxError) {
      return json({ error: 'Invalid request body' }, { status: 400 });
    }
    console.error('[auth/verify-wallet] unexpected error:', error);
    return json({ error: 'Failed to verify wallet signature' }, { status: 500 });
  }
};
