// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — Unified User Profile Store
// Wallet + Passport + Holdings 통합 프로필
// walletStore, matchHistoryStore, quickTradeStore에서 자동 sync
// ═══════════════════════════════════════════════════════════════

import { writable, derived, get } from 'svelte/store';
import { walletStore } from './walletStore';
import { matchHistoryStore, winRate, bestStreak } from './matchHistoryStore';
import { totalQuickPnL, openTradeCount } from './quickTradeStore';
import { STORAGE_KEYS } from './storageKeys';

export type ProfileTier = 'bronze' | 'silver' | 'gold' | 'diamond';

export interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  earnedAt: number | null;  // null = not yet earned
  condition: string;
}

export interface UserProfile {
  address: string | null;
  username: string;
  tier: ProfileTier;
  avatar: string;
  stats: {
    winRate: number;
    totalMatches: number;
    totalPnL: number;
    streak: number;
    bestStreak: number;
    directionAccuracy: number;
    avgConfidence: number;
    trackedSignals: number;
    agentWins: number;
  };
  badges: Badge[];
  balance: { virtual: number };
  joinedAt: number;
}

// ═══ Badge Definitions ═══
const BADGE_DEFS: Omit<Badge, 'earnedAt'>[] = [
  { id: 'first_win', name: 'First Blood', icon: '🎯', description: 'Win your first Arena match', condition: 'wins >= 1' },
  { id: 'streak_5', name: 'On Fire', icon: '🔥', description: '5-win streak', condition: 'bestStreak >= 5' },
  { id: 'streak_10', name: 'Unstoppable', icon: '💥', description: '10-win streak', condition: 'bestStreak >= 10' },
  { id: 'matches_10', name: 'Rookie Trader', icon: '📈', description: 'Complete 10 matches', condition: 'totalMatches >= 10' },
  { id: 'matches_50', name: 'Veteran', icon: '⚔️', description: 'Complete 50 matches', condition: 'totalMatches >= 50' },
  { id: 'matches_100', name: 'Legend', icon: '👑', description: 'Complete 100 matches', condition: 'totalMatches >= 100' },
  { id: 'pnl_10', name: 'In Profit', icon: '💰', description: 'Reach +10% total PnL', condition: 'totalPnL >= 10' },
  { id: 'pnl_50', name: 'Diamond Hands', icon: '💎', description: 'Reach +50% total PnL', condition: 'totalPnL >= 50' },
  { id: 'winrate_70', name: 'Sharpshooter', icon: '🎯', description: 'Maintain 70%+ win rate (min 10 matches)', condition: 'winRate >= 70 && totalMatches >= 10' },
  { id: 'tier_gold', name: 'Gold Rank', icon: '🥇', description: 'Reach Gold tier', condition: 'tier === gold' },
  { id: 'tier_diamond', name: 'Diamond Rank', icon: '💎', description: 'Reach Diamond tier', condition: 'tier === diamond' },
  { id: 'first_track', name: 'Signal Scout', icon: '📌', description: 'Track your first signal', condition: 'trackedSignals >= 1' },
];

const STORAGE_KEY = STORAGE_KEYS.profile;

function loadProfile(): UserProfile {
  if (typeof window === 'undefined') return createDefault();
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...createDefault(), ...parsed };
    }
  } catch {}
  return createDefault();
}

function createDefault(): UserProfile {
  return {
    address: null,
    username: 'Anonymous Doge',
    tier: 'bronze',
    avatar: '/doge/doge-default.jpg',
    stats: {
      winRate: 0,
      totalMatches: 0,
      totalPnL: 0,
      streak: 0,
      bestStreak: 0,
      directionAccuracy: 0,
      avgConfidence: 0,
      trackedSignals: 0,
      agentWins: 0,
    },
    badges: BADGE_DEFS.map(b => ({ ...b, earnedAt: null })),
    balance: { virtual: 10000 },
    joinedAt: Date.now(),
  };
}

export const userProfileStore = writable<UserProfile>(loadProfile());

// Persist (debounced)
let _profileSave: ReturnType<typeof setTimeout> | null = null;
userProfileStore.subscribe(p => {
  if (typeof window === 'undefined') return;
  if (_profileSave) clearTimeout(_profileSave);
  _profileSave = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  }, 500);
});

// ═══ Auto-sync from walletStore ═══
walletStore.subscribe(w => {
  userProfileStore.update(p => {
    if (w.address !== p.address || w.nickname !== p.username) {
      return {
        ...p,
        address: w.address,
        username: w.nickname || p.username,
      };
    }
    return p;
  });
});

// ═══ Auto-sync from matchHistoryStore ═══
matchHistoryStore.subscribe($mh => {
  const records = $mh.records;
  const totalMatches = records.length;
  if (totalMatches === 0) return;

  const wins = records.filter(r => r.win).length;
  const wr = Math.round((wins / totalMatches) * 100);

  // Direction accuracy: how often user hypothesis matched result
  const withHypothesis = records.filter(r => r.hypothesis);
  const dirAccuracy = withHypothesis.length > 0
    ? Math.round((withHypothesis.filter(r => r.win).length / withHypothesis.length) * 100)
    : 0;

  // Average confidence
  const avgConf = withHypothesis.length > 0
    ? Math.round(withHypothesis.reduce((s, r) => s + (r.hypothesis?.conf || 0), 0) / withHypothesis.length)
    : 0;

  // Current streak
  let curStreak = 0;
  for (const r of records) {
    if (r.win) curStreak++;
    else break;
  }

  // Best streak
  let best = 0;
  let cur = 0;
  for (const r of records) {
    if (r.win) { cur++; if (cur > best) best = cur; }
    else cur = 0;
  }

  // Agent wins (from agentVotes that matched result)
  let agentWins = 0;
  for (const r of records) {
    if (r.agentVotes) {
      for (const v of r.agentVotes) {
        if ((v.dir === 'LONG' && r.win) || (v.dir === 'SHORT' && !r.win)) agentWins++;
      }
    }
  }

  userProfileStore.update(p => ({
    ...p,
    stats: {
      ...p.stats,
      winRate: wr,
      totalMatches,
      directionAccuracy: dirAccuracy,
      avgConfidence: avgConf,
      streak: curStreak,
      bestStreak: best,
      agentWins,
    }
  }));
});

// ═══ Tier Calculation ═══
function calcTier(stats: UserProfile['stats']): ProfileTier {
  if (stats.totalMatches >= 50 && stats.winRate >= 65 && stats.totalPnL >= 30) return 'diamond';
  if (stats.totalMatches >= 25 && stats.winRate >= 55 && stats.totalPnL >= 10) return 'gold';
  if (stats.totalMatches >= 10 && stats.winRate >= 45) return 'silver';
  return 'bronze';
}

// ═══ Badge Check ═══
function checkBadges(profile: UserProfile): Badge[] {
  const s = profile.stats;
  return profile.badges.map(badge => {
    if (badge.earnedAt) return badge; // Already earned
    let earned = false;
    switch (badge.id) {
      case 'first_win': earned = s.totalMatches > 0 && s.winRate > 0; break;
      case 'streak_5': earned = s.bestStreak >= 5; break;
      case 'streak_10': earned = s.bestStreak >= 10; break;
      case 'matches_10': earned = s.totalMatches >= 10; break;
      case 'matches_50': earned = s.totalMatches >= 50; break;
      case 'matches_100': earned = s.totalMatches >= 100; break;
      case 'pnl_10': earned = s.totalPnL >= 10; break;
      case 'pnl_50': earned = s.totalPnL >= 50; break;
      case 'winrate_70': earned = s.winRate >= 70 && s.totalMatches >= 10; break;
      case 'tier_gold': earned = profile.tier === 'gold' || profile.tier === 'diamond'; break;
      case 'tier_diamond': earned = profile.tier === 'diamond'; break;
      case 'first_track': earned = s.trackedSignals >= 1; break;
    }
    return earned ? { ...badge, earnedAt: Date.now() } : badge;
  });
}

// ═══ Actions ═══

export function syncPnL(pnl: number) {
  userProfileStore.update(p => {
    const newStats = { ...p.stats, totalPnL: +pnl.toFixed(2) };
    const newTier = calcTier(newStats);
    const updated = { ...p, stats: newStats, tier: newTier };
    updated.badges = checkBadges(updated);
    return updated;
  });
}

export function incrementTrackedSignals() {
  userProfileStore.update(p => {
    const newStats = { ...p.stats, trackedSignals: p.stats.trackedSignals + 1 };
    const updated = { ...p, stats: newStats };
    updated.badges = checkBadges(updated);
    return updated;
  });
}

export function setAvatar(path: string) {
  userProfileStore.update(p => ({ ...p, avatar: path }));
}

export function setUsername(name: string) {
  userProfileStore.update(p => ({ ...p, username: name }));
}

export function adjustBalance(delta: number) {
  userProfileStore.update(p => ({
    ...p,
    balance: { virtual: Math.max(0, p.balance.virtual + delta) }
  }));
}

// ═══ Derived ═══
export const earnedBadges = derived(userProfileStore, $p =>
  $p.badges.filter(b => b.earnedAt !== null)
);

export const lockedBadges = derived(userProfileStore, $p =>
  $p.badges.filter(b => b.earnedAt === null)
);

export const profileTier = derived(userProfileStore, $p => $p.tier);
export const profileStats = derived(userProfileStore, $p => $p.stats);
