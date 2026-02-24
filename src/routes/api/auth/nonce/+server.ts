import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isValidEthAddress, issueWalletNonce, normalizeEthAddress } from '$lib/server/walletAuthRepository';
import { authNonceLimiter } from '$lib/server/rateLimit';
import { checkDistributedRateLimit } from '$lib/server/distributedRateLimit';

function getClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (!forwardedFor) return null;
  const ip = forwardedFor.split(',')[0]?.trim() || null;
  return ip || null;
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
  const ip = getClientAddress();
  if (!authNonceLimiter.check(ip)) {
    return json({ error: 'Too many nonce requests. Please wait.' }, { status: 429 });
  }
  const distributedAllowed = await checkDistributedRateLimit({
    scope: 'auth:nonce',
    key: ip,
    windowMs: 60_000,
    max: 8,
  });
  if (!distributedAllowed) {
    return json({ error: 'Too many nonce requests. Please wait.' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const addressRaw = typeof body?.address === 'string' ? body.address.trim() : '';
    const provider = typeof body?.provider === 'string' ? body.provider.trim() : null;
    const chainRaw = typeof body?.chain === 'string' ? body.chain.trim().toUpperCase() : '';
    const chain = chainRaw === 'SOLANA' ? 'SOL' : chainRaw || 'ARB';

    if (chain === 'SOL') {
      return json({ error: 'Nonce challenge is only used for EVM wallet verification' }, { status: 400 });
    }

    if (!isValidEthAddress(addressRaw)) {
      return json({ error: 'Valid Ethereum wallet address required' }, { status: 400 });
    }

    const issued = await issueWalletNonce({
      address: normalizeEthAddress(addressRaw),
      provider,
      userAgent: request.headers.get('user-agent'),
      issuedIp: getClientIp(request),
      ttlMinutes: 10,
    });

    return json({
      success: true,
      address: normalizeEthAddress(addressRaw),
      chain,
      nonce: issued.nonce,
      message: issued.message,
      expiresAt: issued.expiresAt,
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
    console.error('[auth/nonce] unexpected error:', error);
    return json({ error: 'Failed to issue wallet nonce' }, { status: 500 });
  }
};
