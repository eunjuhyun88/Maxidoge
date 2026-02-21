import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthenticatedUser } from '$lib/server/authRepository';
import {
  consumeWalletNonce,
  extractNonceFromMessage,
  isValidEthAddress,
  isValidSolAddress,
  linkWalletToUser,
  normalizeEthAddress,
} from '$lib/server/walletAuthRepository';
import { parseSessionCookie, SESSION_COOKIE_NAME } from '$lib/server/session';

const EVM_SIGNATURE_RE = /^0x[0-9a-fA-F]{130}$/;
const SOL_SIGNATURE_RE = /^0x[0-9a-fA-F]{64,512}$/;
const SOL_MAX_AGE_MS = 15 * 60 * 1000;
const SOL_FUTURE_ALLOWANCE_MS = 2 * 60 * 1000;

function normalizeChain(chainRaw: string | null, address: string): string {
  const normalized = chainRaw?.trim().toUpperCase() || '';
  if (!normalized) {
    return address.startsWith('0x') ? 'ARB' : 'SOL';
  }
  if (normalized === 'SOLANA') return 'SOL';
  return normalized;
}

function extractIssuedAtFromMessage(message: string): Date | null {
  const match = message.match(/Issued At:\s*(.+)$/im);
  if (!match?.[1]) return null;
  const issuedAt = new Date(match[1].trim());
  return Number.isNaN(issuedAt.getTime()) ? null : issuedAt;
}

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const addressRaw = typeof body?.address === 'string' ? body.address.trim() : '';
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const signature = typeof body?.signature === 'string' ? body.signature.trim() : '';
    const provider = typeof body?.provider === 'string' ? body.provider.trim() : null;
    const chain = normalizeChain(
      typeof body?.chain === 'string' ? body.chain : null,
      addressRaw
    );
    const isEvm = chain !== 'SOL';

    if (isEvm) {
      if (!isValidEthAddress(addressRaw)) {
        return json({ error: 'Valid EVM wallet address required' }, { status: 400 });
      }
    } else if (!isValidSolAddress(addressRaw)) {
      return json({ error: 'Valid Solana wallet address required' }, { status: 400 });
    }

    if (!message || message.length < 20) {
      return json({ error: 'Message is required' }, { status: 400 });
    }
    if (isEvm) {
      if (!EVM_SIGNATURE_RE.test(signature)) {
        return json({ error: 'Invalid EVM signature format' }, { status: 400 });
      }
    } else if (!SOL_SIGNATURE_RE.test(signature)) {
      return json({ error: 'Invalid Solana signature format' }, { status: 400 });
    }

    const address = isEvm ? normalizeEthAddress(addressRaw) : addressRaw;

    if (isEvm) {
      const nonce = extractNonceFromMessage(message);
      if (!nonce) {
        return json({ error: 'Nonce not found in message' }, { status: 400 });
      }

      const validNonce = await consumeWalletNonce({ address, nonce, message });
      if (!validNonce) {
        return json({ error: 'Nonce is invalid, expired, or already used' }, { status: 401 });
      }
    } else {
      if (!message.includes(`Address: ${address}`)) {
        return json({ error: 'Solana verification message is invalid for this address' }, { status: 400 });
      }

      const issuedAt = extractIssuedAtFromMessage(message);
      if (!issuedAt) {
        return json({ error: 'Issued At timestamp is required for Solana verification' }, { status: 400 });
      }

      const age = Date.now() - issuedAt.getTime();
      if (age > SOL_MAX_AGE_MS || age < -SOL_FUTURE_ALLOWANCE_MS) {
        return json({ error: 'Solana verification message is expired or not yet valid' }, { status: 401 });
      }
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
          chain,
          meta: {
            chain,
            issuedAt: new Date().toISOString(),
          },
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
        chain,
        provider: provider || (isEvm ? 'metamask' : 'phantom'),
        verified: true,
      },
    });
  } catch (error: any) {
    if (error?.code === '42P01') {
      return json({ error: 'auth_nonces table is missing. Run migration 0003 first.' }, { status: 500 });
    }
    if (error?.code === '42501') {
      return json({ error: 'Database role lacks permissions for auth_nonces setup. Run migration 0003 with owner role.' }, { status: 500 });
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
