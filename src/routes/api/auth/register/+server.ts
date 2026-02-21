// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — User Registration API (dbStore backed)
// POST /api/auth/register
// Body: { email: string, nickname: string, walletAddress?: string }
// ═══════════════════════════════════════════════════════════════

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Server-side in-memory user store (replace with real DB in production)
const users = new Map<string, any>();

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const { email, nickname, walletAddress } = body;

    // Validate
    if (!email || !email.includes('@')) {
      return json({ error: 'Valid email required' }, { status: 400 });
    }
    if (!nickname || nickname.trim().length < 2) {
      return json({ error: 'Nickname must be 2+ characters' }, { status: 400 });
    }

    // Check if email already exists
    for (const [, u] of users) {
      if (u.email === email) {
        return json({ error: 'Email already registered' }, { status: 409 });
      }
      if (u.nickname === nickname.trim()) {
        return json({ error: 'Nickname already taken' }, { status: 409 });
      }
    }

    // Create user record
    const userId = crypto.randomUUID();
    const user = {
      id: userId,
      email,
      nickname: nickname.trim(),
      walletAddress: walletAddress || null,
      walletSignature: null,
      tier: walletAddress ? 'connected' : 'registered',
      phase: walletAddress ? 2 : 1,
      matchesPlayed: 0,
      totalLP: 0,
      createdAt: Date.now()
    };
    users.set(userId, user);

    // Create session
    const sessionToken = crypto.randomUUID();
    cookies.set('maxidoge_session', `${sessionToken}:${userId}`, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    });

    return json({
      success: true,
      user: {
        id: userId,
        email,
        nickname: nickname.trim(),
        walletAddress: walletAddress || null,
        tier: user.tier,
        phase: user.phase,
        createdAt: new Date(user.createdAt).toISOString()
      }
    });
  } catch {
    return json({ error: 'Invalid request body' }, { status: 400 });
  }
};
