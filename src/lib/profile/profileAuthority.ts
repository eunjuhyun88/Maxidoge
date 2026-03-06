import { getTier, tierToDisplay } from '$lib/stores/progressionRules';

export type ProfileTier = 'bronze' | 'silver' | 'gold' | 'diamond' | 'master';

export interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  earnedAt: number | null;
  condition: string;
}

export interface BadgeRuleInput {
  wins: number;
  winRate: number;
  totalMatches: number;
  totalPnl: number;
  bestStreak: number;
  trackedSignals: number;
  tier: ProfileTier;
}

export interface PersistedBadgeInput {
  id?: unknown;
  earnedAt?: unknown;
}

export const PROFILE_BADGE_DEFS: Omit<Badge, 'earnedAt'>[] = [
  { id: 'first_win', name: 'First Blood', icon: '🎯', description: 'Win your first Arena match', condition: 'wins >= 1' },
  { id: 'streak_5', name: 'On Fire', icon: '🔥', description: '5-win streak', condition: 'bestStreak >= 5' },
  { id: 'streak_10', name: 'Unstoppable', icon: '💥', description: '10-win streak', condition: 'bestStreak >= 10' },
  { id: 'matches_10', name: 'Rookie Trader', icon: '📈', description: 'Complete 10 matches', condition: 'totalMatches >= 10' },
  { id: 'matches_50', name: 'Veteran', icon: '⚔️', description: 'Complete 50 matches', condition: 'totalMatches >= 50' },
  { id: 'matches_100', name: 'Legend', icon: '👑', description: 'Complete 100 matches', condition: 'totalMatches >= 100' },
  { id: 'pnl_10', name: 'In Profit', icon: '💰', description: 'Reach +10% total PnL', condition: 'totalPnl >= 10' },
  { id: 'pnl_50', name: 'Diamond Hands', icon: '💎', description: 'Reach +50% total PnL', condition: 'totalPnl >= 50' },
  { id: 'winrate_70', name: 'Sharpshooter', icon: '🎯', description: 'Maintain 70%+ win rate (min 10 matches)', condition: 'winRate >= 70 && totalMatches >= 10' },
  { id: 'tier_gold', name: 'Gold Rank', icon: '🥇', description: 'Reach Gold tier', condition: 'tier === gold' },
  { id: 'tier_diamond', name: 'Diamond Rank', icon: '💎', description: 'Reach Diamond tier', condition: 'tier === diamond' },
  { id: 'first_track', name: 'Signal Scout', icon: '📌', description: 'Track your first signal', condition: 'trackedSignals >= 1' },
];

export function normalizeProfileTier(value: unknown): ProfileTier {
  const tier = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (tier === 'master' || tier === 'diamond' || tier === 'gold' || tier === 'silver') return tier;
  return 'bronze';
}

export function deriveProfileTier(totalLp: number, fallback?: unknown): ProfileTier {
  const lp = Number(totalLp);
  if (!Number.isFinite(lp) || lp < 0) return normalizeProfileTier(fallback);
  return normalizeProfileTier(tierToDisplay(getTier(lp).tier));
}

export function createDefaultBadges(): Badge[] {
  return PROFILE_BADGE_DEFS.map((badge) => ({ ...badge, earnedAt: null }));
}

function normalizeEarnedAt(value: unknown): number | null {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
}

function readPersistedBadges(items: unknown[]): Map<string, number | null> {
  const result = new Map<string, number | null>();
  for (const item of items) {
    if (typeof item === 'string' && item.trim()) {
      result.set(item.trim(), null);
      continue;
    }
    if (!item || typeof item !== 'object') continue;

    const badge = item as PersistedBadgeInput;
    const id = typeof badge.id === 'string' ? badge.id.trim() : '';
    if (!id) continue;
    result.set(id, normalizeEarnedAt(badge.earnedAt));
  }
  return result;
}

function isBadgeEarned(id: string, input: BadgeRuleInput): boolean {
  switch (id) {
    case 'first_win':
      return input.wins >= 1;
    case 'streak_5':
      return input.bestStreak >= 5;
    case 'streak_10':
      return input.bestStreak >= 10;
    case 'matches_10':
      return input.totalMatches >= 10;
    case 'matches_50':
      return input.totalMatches >= 50;
    case 'matches_100':
      return input.totalMatches >= 100;
    case 'pnl_10':
      return input.totalPnl >= 10;
    case 'pnl_50':
      return input.totalPnl >= 50;
    case 'winrate_70':
      return input.winRate >= 70 && input.totalMatches >= 10;
    case 'tier_gold':
      return input.tier === 'gold' || input.tier === 'diamond' || input.tier === 'master';
    case 'tier_diamond':
      return input.tier === 'diamond' || input.tier === 'master';
    case 'first_track':
      return input.trackedSignals >= 1;
    default:
      return false;
  }
}

export function buildProfileBadges(
  input: BadgeRuleInput,
  persistedBadges: unknown[] = [],
  fallbackEarnedAt = Date.now()
): Badge[] {
  const persisted = readPersistedBadges(Array.isArray(persistedBadges) ? persistedBadges : []);

  return PROFILE_BADGE_DEFS.map((badge) => {
    const persistedEarnedAt = persisted.get(badge.id);
    const earned = persisted.has(badge.id) || isBadgeEarned(badge.id, input);
    return {
      ...badge,
      earnedAt: earned ? (persistedEarnedAt ?? fallbackEarnedAt) : null,
    };
  });
}

export function mergeProfileBadges(remoteBadges: unknown[], fallbackBadges?: Badge[]): Badge[] {
  const persisted = readPersistedBadges(Array.isArray(remoteBadges) ? remoteBadges : []);
  const fallbackMap = new Map((fallbackBadges ?? []).map((badge) => [badge.id, badge]));

  return createDefaultBadges().map((badge) => {
    const persistedEarnedAt = persisted.get(badge.id);
    const fallback = fallbackMap.get(badge.id);
    if (!persisted.has(badge.id)) return { ...badge, earnedAt: null };
    return { ...badge, earnedAt: persistedEarnedAt ?? fallback?.earnedAt ?? Date.now() };
  });
}

export function serializeEarnedBadges(badges: Badge[]): Array<{ id: string; earnedAt: number }> {
  return badges
    .filter((badge) => badge.earnedAt !== null)
    .map((badge) => ({
      id: badge.id,
      earnedAt: badge.earnedAt ?? Date.now(),
    }));
}
