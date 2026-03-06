import { query } from '$lib/server/db';
import {
  buildProfileBadges,
  deriveProfileTier,
  serializeEarnedBadges,
  type Badge,
  type ProfileTier,
} from '$lib/profile/profileAuthority';

interface Queryable {
  query: <T>(text: string, params?: unknown[]) => Promise<{ rows: T[] }>;
}

interface UserProfileRow {
  user_id: string;
  display_tier: string | null;
  total_matches: number | string | null;
  wins: number | string | null;
  losses: number | string | null;
  streak: number | string | null;
  best_streak: number | string | null;
  total_lp: number | string | null;
  total_pnl: number | string | null;
  badges: unknown[] | null;
  updated_at: string | null;
}

interface CountRow {
  count: string;
}

interface MatchSummaryRow {
  count: string;
  wins: string;
}

interface SumRow {
  total: string | null;
}

export interface UserProfileProjection {
  tier: ProfileTier;
  totalMatches: number;
  wins: number;
  losses: number;
  streak: number;
  bestStreak: number;
  totalLp: number;
  totalPnl: number;
  trackedSignals: number;
  openTrades: number;
  winRate: number;
  badges: Badge[];
  updatedAt: number | null;
}

interface UserProfileProjectionWithSource extends UserProfileProjection {
  row: UserProfileRow | null;
}

function toNumber(value: unknown, fallback = 0): number {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function runner(client?: Queryable): Queryable {
  return client ?? { query };
}

async function loadProjection(userId: string, client?: Queryable): Promise<UserProfileProjectionWithSource> {
  const db = runner(client);
  const [profileResult, openTrades, trackedSignals, matchSummary, closePnl] = await Promise.all([
    db.query<UserProfileRow>(
      `SELECT user_id, display_tier, total_matches, wins, losses, streak, best_streak, total_lp, total_pnl, badges, updated_at
       FROM user_profiles WHERE user_id = $1 LIMIT 1`,
      [userId]
    ),
    db.query<CountRow>(`SELECT count(*)::text AS count FROM quick_trades WHERE user_id = $1 AND status = 'open'`, [userId]),
    db.query<CountRow>(`SELECT count(*)::text AS count FROM tracked_signals WHERE user_id = $1 AND status = 'tracking'`, [userId]),
    db.query<MatchSummaryRow>(
      `SELECT count(*)::text AS count, COALESCE(sum(CASE WHEN win THEN 1 ELSE 0 END), 0)::text AS wins
       FROM matches WHERE user_id = $1`,
      [userId]
    ),
    db.query<SumRow>(
      `SELECT COALESCE(sum(close_pnl), 0)::text AS total
       FROM quick_trades
       WHERE user_id = $1 AND status IN ('closed', 'stopped') AND close_pnl IS NOT NULL`,
      [userId]
    ),
  ]);

  const row = profileResult.rows[0] ?? null;
  const totalMatches = toNumber(matchSummary.rows[0]?.count, toNumber(row?.total_matches));
  const wins = toNumber(matchSummary.rows[0]?.wins, toNumber(row?.wins));
  const losses = toNumber(row?.losses, Math.max(0, totalMatches - wins));
  const streak = toNumber(row?.streak);
  const bestStreak = toNumber(row?.best_streak);
  const totalLp = Math.max(0, toNumber(row?.total_lp));
  const totalPnl = Number(toNumber(closePnl.rows[0]?.total, toNumber(row?.total_pnl)).toFixed(2));
  const trackedCount = toNumber(trackedSignals.rows[0]?.count);
  const openTradeCount = toNumber(openTrades.rows[0]?.count);
  const tier = deriveProfileTier(totalLp, row?.display_tier);
  const winRate = totalMatches > 0 ? Number(((wins / totalMatches) * 100).toFixed(2)) : 0;
  const updatedAt = row?.updated_at ? new Date(row.updated_at).getTime() : null;
  const badges = buildProfileBadges(
    {
      wins,
      winRate,
      totalMatches,
      totalPnl,
      bestStreak,
      trackedSignals: trackedCount,
      tier,
    },
    row?.badges ?? [],
    Date.now()
  );

  return {
    row,
    tier,
    totalMatches,
    wins,
    losses,
    streak,
    bestStreak,
    totalLp,
    totalPnl,
    trackedSignals: trackedCount,
    openTrades: openTradeCount,
    winRate,
    badges,
    updatedAt,
  };
}

export async function getUserProfileProjection(userId: string, client?: Queryable): Promise<UserProfileProjection> {
  const projection = await loadProjection(userId, client);
  return projection;
}

export async function syncUserProfileProjection(userId: string, client?: Queryable): Promise<UserProfileProjection> {
  const db = runner(client);
  const projection = await loadProjection(userId, client);
  if (!projection.row) return projection;

  const nextBadges = serializeEarnedBadges(projection.badges);
  const prevBadges = Array.isArray(projection.row.badges) ? projection.row.badges : [];
  const badgesChanged = JSON.stringify(prevBadges) !== JSON.stringify(nextBadges);
  const tierChanged = (projection.row.display_tier ?? 'bronze') !== projection.tier;
  const pnlChanged = Number(toNumber(projection.row.total_pnl).toFixed(2)) !== projection.totalPnl;

  if (badgesChanged || tierChanged || pnlChanged) {
    await db.query(
      `UPDATE user_profiles
       SET display_tier = $2,
           total_pnl = $3,
           badges = $4::jsonb,
           updated_at = now()
       WHERE user_id = $1`,
      [userId, projection.tier, projection.totalPnl, JSON.stringify(nextBadges)]
    );
    projection.updatedAt = Date.now();
  }

  return projection;
}
