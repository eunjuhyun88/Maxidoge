// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — Session Check API
// GET /api/auth/session
// Returns current user session status from cookie
// ═══════════════════════════════════════════════════════════════

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
  const sessionCookie = cookies.get('maxidoge_session');

  if (!sessionCookie) {
    return json({
      authenticated: false,
      user: null
    });
  }

  // Parse session: "token:userId"
  const parts = sessionCookie.split(':');
  if (parts.length < 2) {
    return json({
      authenticated: false,
      user: null
    });
  }

  const userId = parts.slice(1).join(':');

  // In production: validate token against DB
  // For now: return basic session info
  return json({
    authenticated: true,
    user: {
      id: userId,
      tier: 'connected',
      phase: 2,
      wallet: null // Would lookup from DB
    }
  });
};
