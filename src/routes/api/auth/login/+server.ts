import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { findAuthUserForLogin } from '$lib/server/authRepository';
import {
  issueAuthSessionCookie,
  readAuthIdentityFields,
  readWalletProofFields,
  validateEmail,
  validateNickname,
  verifyWalletProof,
} from '$lib/server/authService';
import { authLoginLimiter } from '$lib/server/rateLimit';
import { readAuthBodyWithTurnstile, runAuthAbuseGuard } from '$lib/server/authSecurity';
import { getErrorMessage } from '$lib/utils/errorUtils';

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
  const fallbackIp = getClientAddress();
  const guard = await runAuthAbuseGuard({
    request,
    fallbackIp,
    limiter: authLoginLimiter,
    scope: 'auth:login',
    max: 10,
    tooManyMessage: 'Too many login attempts. Please wait.',
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

    const { email, nickname } = readAuthIdentityFields(body);
    const emailError = validateEmail(email);
    if (emailError) return json({ error: emailError }, { status: 400 });
    const nicknameError = validateNickname(nickname, true);
    if (nicknameError) return json({ error: nicknameError }, { status: 400 });

    const walletProof = readWalletProofFields(body);
    const walletProofResult = await verifyWalletProof({
      ...walletProof,
      required: true,
      invalidAddressMessage: 'Valid EVM wallet address required for login',
      missingMessageMessage: 'Signed wallet message is required for login',
      signatureRequiredMessage: 'Valid wallet signature is required for login',
      missingNonceMessage: 'Nonce not found in signed message',
      invalidSignatureMessage: 'Signature does not match wallet address',
      invalidNonceMessage: 'Login challenge is expired or already used',
    });
    if (!walletProofResult.ok) {
      return json({ error: walletProofResult.error }, { status: walletProofResult.status });
    }
    const { walletAddress } = walletProofResult.value;

    const user = await findAuthUserForLogin(email, nickname, walletAddress);
    if (!user) {
      return json({ error: 'Invalid login credentials or wallet mismatch' }, { status: 401 });
    }

    const { createdAt } = await issueAuthSessionCookie({
      cookies,
      userId: user.id,
      request,
      ipAddress: guard.ip,
    });

    return json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        tier: user.tier,
        phase: user.phase,
        walletAddress: user.wallet_address,
        loggedInAt: new Date(createdAt).toISOString(),
      },
    });
  } catch (error: unknown) {
    if (getErrorMessage(error).includes('DATABASE_URL is not set')) {
      return json({ error: 'Server database is not configured' }, { status: 500 });
    }
    console.error('[auth/login] unexpected error:', error);
    return json({ error: 'Failed to login' }, { status: 500 });
  }
};
