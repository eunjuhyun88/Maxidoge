// ═══════════════════════════════════════════════════════════════
// Stockclaw — User Registration API (PostgreSQL backed)
// POST /api/auth/register
// Body: { email, nickname, walletAddress?, walletMessage?, walletSignature? }
// ═══════════════════════════════════════════════════════════════

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createAuthUser, findAuthUserConflict } from '$lib/server/authRepository';
import {
  issueAuthSessionCookie,
  readAuthIdentityFields,
  readWalletProofFields,
  validateEmail,
  validateNickname,
  verifyWalletProof,
} from '$lib/server/authService';
import { authRegisterLimiter } from '$lib/server/rateLimit';
import { readAuthBodyWithTurnstile, runAuthAbuseGuard } from '$lib/server/authSecurity';
import { getErrorMessage, getErrorCode } from '$lib/utils/errorUtils';

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
  const fallbackIp = getClientAddress();
  const guard = await runAuthAbuseGuard({
    request,
    fallbackIp,
    limiter: authRegisterLimiter,
    scope: 'auth:register',
    max: 8,
    tooManyMessage: 'Too many registration attempts. Please wait.',
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
      required: false,
      invalidAddressMessage: 'Valid EVM wallet address required',
      missingMessageMessage: 'Signed wallet message is required when walletAddress is provided',
      signatureRequiredMessage: 'Valid wallet signature is required when walletAddress is provided',
      missingNonceMessage: 'Nonce not found in signed message',
      invalidSignatureMessage: 'Signature does not match wallet address',
      invalidNonceMessage: 'Signup challenge is expired or already used',
    });
    if (!walletProofResult.ok) {
      return json({ error: walletProofResult.error }, { status: walletProofResult.status });
    }
    const { walletAddress, walletSignature } = walletProofResult.value;

    const conflict = await findAuthUserConflict(email, nickname);
    if (conflict.emailTaken) {
      return json({ error: 'Email already registered' }, { status: 409 });
    }
    if (conflict.nicknameTaken) {
      return json({ error: 'Nickname already taken' }, { status: 409 });
    }

    const user = await createAuthUser({
      email,
      nickname,
      walletAddress,
      walletSignature,
    });

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
        email,
        nickname,
        walletAddress,
        walletVerified: Boolean(walletAddress && walletSignature),
        tier: user.tier,
        phase: user.phase,
        createdAt: new Date(createdAt).toISOString(),
      },
    });
  } catch (error: unknown) {
    if (getErrorCode(error) === '23505') {
      return json({ error: 'Email or nickname already exists' }, { status: 409 });
    }
    if (getErrorMessage(error).includes('DATABASE_URL is not set')) {
      return json({ error: 'Server database is not configured' }, { status: 500 });
    }
    console.error('[auth/register] unexpected error:', error);
    return json({ error: 'Failed to register user' }, { status: 500 });
  }
};
