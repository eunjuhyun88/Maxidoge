import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isValidEthAddress, issueWalletNonce, normalizeEthAddress } from '$lib/server/walletAuthRepository';
import { authNonceLimiter } from '$lib/server/rateLimit';
import { checkDistributedRateLimit } from '$lib/server/distributedRateLimit';
import { evaluateIpReputation } from '$lib/server/ipReputation';
import { isBodyTooLarge, readTurnstileToken } from '$lib/server/requestGuards';
import { verifyTurnstile } from '$lib/server/turnstile';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
  const fallbackIp = getClientAddress();
  const reputation = evaluateIpReputation(request, fallbackIp);
  if (!reputation.allowed) {
    return json({ error: 'Request blocked by security policy' }, { status: 403 });
  }

  const ip = reputation.clientIp || fallbackIp || 'unknown';
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
  if (isBodyTooLarge(request, 8 * 1024)) {
    return json({ error: 'Request body too large' }, { status: 413 });
  }

  try {
    const body = await request.json();
    const turnstile = await verifyTurnstile({
      token: readTurnstileToken(body),
      remoteIp: reputation.clientIp || fallbackIp || null,
    });
    if (!turnstile.ok) {
      return json({ error: 'Bot verification failed' }, { status: 403 });
    }

    const addressField = typeof body?.address === 'string' ? body.address.trim() : '';
    const walletAddressField = typeof body?.walletAddress === 'string' ? body.walletAddress.trim() : '';
    if (
      addressField &&
      walletAddressField &&
      normalizeEthAddress(addressField) !== normalizeEthAddress(walletAddressField)
    ) {
      return json({ error: 'Conflicting wallet address fields' }, { status: 400 });
    }
    const addressRaw = addressField || walletAddressField;
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
      issuedIp: reputation.clientIp || fallbackIp || null,
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
  } catch (error: unknown) {
    if (error?.code === '42P01') {
      return json({ error: 'auth_nonces table is missing. Run migration 0003 first.' }, { status: 500 });
    }
    if (error?.code === '42501') {
      return json({ error: 'Database role lacks permissions for auth_nonces setup. Run migration 0003 with owner role.' }, { status: 500 });
    }
    if (errorContains(error, 'DATABASE_URL is not set')) {
      return json({ error: 'Server database is not configured' }, { status: 500 });
    }
    if (error instanceof SyntaxError) {
      return json({ error: 'Invalid request body' }, { status: 400 });
    }
    console.error('[auth/nonce] unexpected error:', error);
    return json({ error: 'Failed to issue wallet nonce' }, { status: 500 });
  }
};
