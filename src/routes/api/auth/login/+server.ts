import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createAuthSession, findAuthUserForLogin } from '$lib/server/authRepository';
import {
  buildSessionCookieValue,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  SESSION_MAX_AGE_SEC,
} from '$lib/server/session';

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const email = typeof body?.email === 'string' ? body.email.trim() : '';
    const nickname = typeof body?.nickname === 'string' ? body.nickname.trim() : '';
    const walletAddress = typeof body?.walletAddress === 'string' ? body.walletAddress.trim() : '';

    if (!email || !email.includes('@')) {
      return json({ error: 'Valid email required' }, { status: 400 });
    }
    if (!nickname || nickname.length < 2) {
      return json({ error: 'Nickname must be 2+ characters' }, { status: 400 });
    }
    if (!walletAddress) {
      return json({ error: 'Wallet connection is required for login' }, { status: 400 });
    }

    const user = await findAuthUserForLogin(email, nickname, walletAddress);
    if (!user) {
      return json({ error: 'Invalid login credentials or wallet mismatch' }, { status: 401 });
    }

    const sessionToken = crypto.randomUUID().toLowerCase();
    const createdAt = Date.now();
    const expiresAtMs = createdAt + SESSION_MAX_AGE_SEC * 1000;
    await createAuthSession({
      token: sessionToken,
      userId: user.id,
      expiresAtIso: new Date(expiresAtMs).toISOString(),
    });

    cookies.set(
      SESSION_COOKIE_NAME,
      buildSessionCookieValue(sessionToken, user.id),
      SESSION_COOKIE_OPTIONS
    );

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
  } catch (error: any) {
    if (typeof error?.message === 'string' && error.message.includes('DATABASE_URL is not set')) {
      return json({ error: 'Server database is not configured' }, { status: 500 });
    }
    if (error instanceof SyntaxError) {
      return json({ error: 'Invalid request body' }, { status: 400 });
    }
    console.error('[auth/login] unexpected error:', error);
    return json({ error: 'Failed to login' }, { status: 500 });
  }
};
