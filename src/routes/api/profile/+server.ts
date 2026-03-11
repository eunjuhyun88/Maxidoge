import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { query } from '$lib/server/db';
import { getAuthUserFromCookies } from '$lib/server/authGuard';
import { syncUserProfileProjection } from '$lib/server/profileProjection';
import { runIpRateLimitGuard } from '$lib/server/authSecurity';
import { profileMutationLimiter } from '$lib/server/rateLimit';
import { readJsonBodySafely } from '$lib/server/requestGuards';
import { getErrorMessage, getErrorCode } from '$lib/utils/errorUtils';

const PROFILE_PATCH_FIELDS = new Set(['nickname', 'avatar']);
const PROFILE_PATCH_MAX_BYTES = 8 * 1024;

function hasOwn(body: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key);
}

export const GET: RequestHandler = async ({ cookies }) => {
  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    const [userRow, projection] = await Promise.all([
      query(
        `SELECT id, email, nickname, wallet_address, tier, phase, avatar, created_at, updated_at
         FROM users WHERE id = $1 LIMIT 1`,
        [user.id]
      ),
      syncUserProfileProjection(user.id),
    ]);

    const u: any = userRow.rows[0] || {};

    return json({
      success: true,
      profile: {
        id: u.id,
        email: u.email,
        nickname: u.nickname,
        walletAddress: u.wallet_address,
        tier: u.tier,
        phase: Number(u.phase ?? 0),
        avatar: u.avatar || null,
        createdAt: u.created_at ? new Date(u.created_at).getTime() : null,
        updatedAt: u.updated_at ? new Date(u.updated_at).getTime() : null,
        stats: {
          displayTier: projection.tier,
          totalMatches: projection.totalMatches,
          wins: projection.wins,
          losses: projection.losses,
          streak: projection.streak,
          bestStreak: projection.bestStreak,
          totalLp: projection.totalLp,
          totalPnl: projection.totalPnl,
          badges: projection.badges,
          trackedSignals: projection.trackedSignals,
          updatedAt: projection.updatedAt,
        },
      },
    });
  } catch (error: unknown) {
    if (getErrorMessage(error).includes('DATABASE_URL is not set')) {
      return json({ error: 'Server database is not configured' }, { status: 500 });
    }
    console.error('[profile/get] unexpected error:', error);
    return json({ error: 'Failed to load profile' }, { status: 500 });
  }
};

export const PATCH: RequestHandler = async ({ cookies, request, getClientAddress }) => {
  const guard = await runIpRateLimitGuard({
    request,
    fallbackIp: getClientAddress(),
    limiter: profileMutationLimiter,
    scope: 'profile:patch',
    max: 12,
    tooManyMessage: 'Too many profile update requests.',
  });
  if (!guard.ok) return guard.response;

  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    const bodyResult = await readJsonBodySafely<Record<string, unknown>>(request, PROFILE_PATCH_MAX_BYTES);
    if (!bodyResult.ok) return bodyResult.response;

    const body = bodyResult.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json({ error: 'Invalid request body' }, { status: 400 });
    }

    const unknownFields = Object.keys(body).filter((field) => !PROFILE_PATCH_FIELDS.has(field));
    if (unknownFields.length > 0) {
      return json({ error: `Unsupported profile fields: ${unknownFields.join(', ')}` }, { status: 400 });
    }

    const wantsNickname = hasOwn(body, 'nickname');
    const wantsAvatar = hasOwn(body, 'avatar');

    const nickname = wantsNickname && typeof body.nickname === 'string' ? body.nickname.trim() : '';
    const avatar = wantsAvatar && typeof body.avatar === 'string' ? body.avatar.trim() : '';

    if (wantsNickname && (!nickname || nickname.length < 2 || nickname.length > 40)) {
      return json({ error: 'nickname must be at least 2 characters' }, { status: 400 });
    }
    if (wantsAvatar && (!avatar || avatar.length > 512)) {
      return json({ error: 'avatar must be between 1 and 512 characters' }, { status: 400 });
    }

    const updates: string[] = [];
    const params: Array<string> = [];

    if (wantsNickname) {
      params.push(nickname);
      updates.push(`nickname = $${params.length}`);
    }
    if (wantsAvatar) {
      params.push(avatar);
      updates.push(`avatar = $${params.length}`);
    }

    if (updates.length > 0) {
      params.push(user.id);
      await query(
        `
          UPDATE users
          SET ${updates.join(', ')}, updated_at = now()
          WHERE id = $${params.length}
        `,
        params
      );
    }

    return json({ success: true });
  } catch (error: unknown) {
    if (getErrorCode(error) === '23505') {
      return json({ error: 'Nickname is already taken' }, { status: 409 });
    }
    if (getErrorMessage(error).includes('DATABASE_URL is not set')) {
      return json({ error: 'Server database is not configured' }, { status: 500 });
    }
    console.error('[profile/patch] unexpected error:', error);
    return json({ error: 'Failed to update profile' }, { status: 500 });
  }
};
