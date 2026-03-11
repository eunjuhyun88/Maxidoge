import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { findAuthUserByWallet } from '$lib/server/authRepository';
import {
  issueAuthSessionCookie,
  readWalletProofFields,
  verifyWalletProof,
} from '$lib/server/authService';
import { authLoginLimiter } from '$lib/server/rateLimit';
import { readAuthBodyWithTurnstile, runAuthAbuseGuard } from '$lib/server/authSecurity';
import { getErrorMessage } from '$lib/utils/errorUtils';

/**
 * POST /api/auth/resolve
 *
 * Wallet-first authentication endpoint.
 * Verifies wallet signature → checks if user exists → auto-login or signals signup needed.
 *
 * Input:  { walletAddress, walletMessage, walletSignature }
 * Output: { action: 'logged_in', user } | { action: 'needs_signup', walletAddress }
 */
export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
  const fallbackIp = getClientAddress();
  const guard = await runAuthAbuseGuard({
    request,
    fallbackIp,
    limiter: authLoginLimiter,
    scope: 'auth:resolve',
    max: 10,
    tooManyMessage: 'Too many auth attempts. Please wait.',
  });
  if (!guard.ok) return guard.response;

  try {
    const bodyResult = await readAuthBodyWithTurnstile({
      request,
      remoteIp: guard.remoteIp,
      maxBytes: 16 * 1024,
    });
    if (!bodyResult.ok) return bodyResult.response;
    const body = bodyResult.body;

    const walletProof = readWalletProofFields(body);
    const walletProofResult = await verifyWalletProof({
      ...walletProof,
      required: true,
      invalidAddressMessage: 'Valid EVM wallet address required',
      missingMessageMessage: 'Signed wallet message is required',
      signatureRequiredMessage: 'Valid wallet signature is required',
      missingNonceMessage: 'Nonce not found in signed message',
      invalidSignatureMessage: 'Signature does not match wallet address',
      invalidNonceMessage: 'Verification challenge is expired or already used',
    });
    if (!walletProofResult.ok) {
      return json({ error: walletProofResult.error }, { status: walletProofResult.status });
    }
    const { walletAddress } = walletProofResult.value;

    // ── Server Resolution: check if wallet belongs to existing user ──
    const existingUser = await findAuthUserByWallet(walletAddress);

    if (existingUser) {
      // Existing user → auto-login (issue session)
      const { createdAt } = await issueAuthSessionCookie({
        cookies,
        userId: existingUser.id,
        request,
        ipAddress: guard.ip,
      });

      return json({
        success: true,
        action: 'logged_in',
        user: {
          id: existingUser.id,
          email: existingUser.email,
          nickname: existingUser.nickname,
          tier: existingUser.tier,
          phase: existingUser.phase,
          walletAddress: existingUser.wallet_address,
          loggedInAt: new Date(createdAt).toISOString(),
        },
      });
    }

    // New wallet → needs signup (email + nickname form)
    return json({
      success: true,
      action: 'needs_signup',
      walletAddress,
    });
  } catch (error: unknown) {
    if (getErrorMessage(error).includes('DATABASE_URL is not set')) {
      return json({ error: 'Server database is not configured' }, { status: 500 });
    }
    console.error('[auth/resolve] unexpected error:', error);
    return json({ error: 'Failed to resolve wallet authentication' }, { status: 500 });
  }
};
