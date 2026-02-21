// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — User Registration API (PostgreSQL backed)
// POST /api/auth/register
// Body: { email: string, nickname: string, walletAddress?: string }
// ═══════════════════════════════════════════════════════════════

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createAuthSession, createAuthUser, findAuthUserConflict } from '$lib/server/authRepository';
import {
  buildSessionCookieValue,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  SESSION_MAX_AGE_SEC,
} from '$lib/server/session';

const GENERIC_WALLET_RE = /^0x[0-9a-fA-F]{40}$|^[A-Za-z0-9]{20,64}$/;

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const email = typeof body?.email === 'string' ? body.email.trim() : '';
    const nickname = typeof body?.nickname === 'string' ? body.nickname.trim() : '';
    const walletAddressRaw = typeof body?.walletAddress === 'string' ? body.walletAddress.trim() : '';
    const walletAddress = walletAddressRaw || null;

    // Validate
    if (!email || !email.includes('@')) {
      return json({ error: 'Valid email required' }, { status: 400 });
    }
    if (!nickname || nickname.length < 2) {
      return json({ error: 'Nickname must be 2+ characters' }, { status: 400 });
    }
    if (walletAddress && !GENERIC_WALLET_RE.test(walletAddress)) {
      return json({ error: 'Invalid wallet address format' }, { status: 400 });
    }

    const conflict = await findAuthUserConflict(email, nickname);
    if (conflict.emailTaken) {
      return json({ error: 'Email already registered' }, { status: 409 });
    }
    if (conflict.nicknameTaken) {
      return json({ error: 'Nickname already taken' }, { status: 409 });
    }

    // Create user record
    const user = await createAuthUser({
      email,
      nickname,
      walletAddress,
    });

    // Create session
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
        email,
        nickname,
        walletAddress,
        tier: user.tier,
        phase: user.phase,
        createdAt: new Date(createdAt).toISOString()
      }
    });
  } catch (error: any) {
    if (error?.code === '23505') {
      return json({ error: 'Email or nickname already exists' }, { status: 409 });
    }
    if (typeof error?.message === 'string' && error.message.includes('DATABASE_URL is not set')) {
      return json({ error: 'Server database is not configured' }, { status: 500 });
    }
    if (error instanceof SyntaxError) {
      return json({ error: 'Invalid request body' }, { status: 400 });
    }
    console.error('[auth/register] unexpected error:', error);
    return json({ error: 'Failed to register user' }, { status: 500 });
  }
};
