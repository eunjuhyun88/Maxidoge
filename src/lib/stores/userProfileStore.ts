// ═══════════════════════════════════════════════════════════════
// STOCKCLAW — Unified User Profile Store
// Server-authoritative profile with local cache and light UI optimism
// ═══════════════════════════════════════════════════════════════

import { writable, derived, get } from 'svelte/store';
import { matchHistoryStore } from './matchHistoryStore';
import { walletStore } from './walletStore';
import { STORAGE_KEYS } from './storageKeys';
import { fetchPassportApi, fetchProfileApi, updateProfileApi } from '$lib/api/profileApi';
import {
  createDefaultBadges,
  mergeProfileBadges,
  normalizeProfileTier,
  type Badge,
  type ProfileTier,
} from '$lib/profile/profileAuthority';

export type { Badge, ProfileTier };

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

const STORAGE_KEY = STORAGE_KEYS.profile;
const PROFILE_REFRESH_DEBOUNCE_MS = 900;

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
    badges: createDefaultBadges(),
    balance: { virtual: 10000 },
    joinedAt: Date.now(),
  };
}

function loadProfile(): UserProfile {
  if (typeof window === 'undefined') return createDefault();
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...createDefault(),
        ...parsed,
        tier: normalizeProfileTier(parsed?.tier),
        badges: mergeProfileBadges(parsed?.badges ?? []),
      };
    }
  } catch {
    // ignore invalid cache
  }
  return createDefault();
}

export const userProfileStore = writable<UserProfile>(loadProfile());

let _profileSave: ReturnType<typeof setTimeout> | null = null;
userProfileStore.subscribe((profile) => {
  if (typeof window === 'undefined') return;
  if (_profileSave) clearTimeout(_profileSave);
  _profileSave = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  }, 500);
});

let _profileRefreshTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleUserProfileRefresh(force = true) {
  if (typeof window === 'undefined') return;
  if (_profileRefreshTimer) clearTimeout(_profileRefreshTimer);
  _profileRefreshTimer = setTimeout(() => {
    _profileRefreshTimer = null;
    void hydrateUserProfile(force);
  }, PROFILE_REFRESH_DEBOUNCE_MS);
}

walletStore.subscribe((wallet) => {
  userProfileStore.update((profile) => {
    if (!wallet.address || wallet.address === profile.address) return profile;
    return { ...profile, address: wallet.address };
  });
});

let _profileHydrated = false;
let _profileHydratePromise: Promise<void> | null = null;
export async function hydrateUserProfile(force = false) {
  if (typeof window === 'undefined') return;
  if (_profileHydrated && !force) return;
  if (_profileHydratePromise) return _profileHydratePromise;

  _profileHydratePromise = (async () => {
    const [profile, passport] = await Promise.all([fetchProfileApi(), fetchPassportApi()]);
    if (!profile && !passport) return;

    userProfileStore.update((current) => {
      const remoteBadges = passport?.badges ?? profile?.stats?.badges ?? [];
      return {
        ...current,
        address: profile?.walletAddress ?? current.address,
        username: profile?.nickname || current.username,
        tier: normalizeProfileTier(passport?.tier ?? profile?.stats?.displayTier ?? current.tier),
        avatar: profile?.avatar || current.avatar,
        joinedAt: Number(profile?.createdAt ?? current.joinedAt),
        stats: {
          ...current.stats,
          winRate: Number(passport?.winRate ?? current.stats.winRate),
          totalMatches: Number(passport?.totalMatches ?? profile?.stats?.totalMatches ?? current.stats.totalMatches),
          totalPnL: Number(passport?.totalPnl ?? profile?.stats?.totalPnl ?? current.stats.totalPnL),
          streak: Number(passport?.streak ?? profile?.stats?.streak ?? current.stats.streak),
          bestStreak: Number(passport?.bestStreak ?? profile?.stats?.bestStreak ?? current.stats.bestStreak),
          trackedSignals: Number(passport?.trackedSignals ?? profile?.stats?.trackedSignals ?? current.stats.trackedSignals),
        },
        badges: mergeProfileBadges(remoteBadges, current.badges),
      };
    });

    _profileHydrated = true;
  })();

  try {
    await _profileHydratePromise;
  } finally {
    _profileHydratePromise = null;
  }
}

// Secondary metrics remain client-derived for now.
matchHistoryStore.subscribe((history) => {
  const records = history.records;
  const withHypothesis = records.filter((record) => record.hypothesis);
  const directionAccuracy = withHypothesis.length > 0
    ? Math.round((withHypothesis.filter((record) => record.win).length / withHypothesis.length) * 100)
    : 0;
  const avgConfidence = withHypothesis.length > 0
    ? Math.round(withHypothesis.reduce((sum, record) => sum + (record.hypothesis?.conf || 0), 0) / withHypothesis.length)
    : 0;

  let agentWins = 0;
  for (const record of records) {
    if (!record.agentVotes) continue;
    for (const vote of record.agentVotes) {
      if ((vote.dir === 'LONG' && record.win) || (vote.dir === 'SHORT' && !record.win)) agentWins++;
    }
  }

  userProfileStore.update((profile) => ({
    ...profile,
    stats: {
      ...profile.stats,
      directionAccuracy,
      avgConfidence,
      agentWins,
    },
  }));
});

export function syncPnL(_pnl: number) {
  scheduleUserProfileRefresh();
}

export function syncLP(_lp: number) {
  scheduleUserProfileRefresh();
}

export function incrementTrackedSignals() {
  userProfileStore.update((profile) => ({
    ...profile,
    stats: {
      ...profile.stats,
      trackedSignals: profile.stats.trackedSignals + 1,
    },
  }));
  scheduleUserProfileRefresh();
}

export async function setAvatar(path: string) {
  const prev = get(userProfileStore).avatar;
  userProfileStore.update((profile) => ({ ...profile, avatar: path }));
  const ok = await updateProfileApi({ avatar: path });
  if (!ok) userProfileStore.update((profile) => ({ ...profile, avatar: prev }));
  else scheduleUserProfileRefresh();
}

export async function setUsername(name: string) {
  const next = name.trim();
  if (next.length < 2) return;
  const prev = get(userProfileStore).username;
  userProfileStore.update((profile) => ({ ...profile, username: next }));
  const ok = await updateProfileApi({ nickname: next });
  if (!ok) userProfileStore.update((profile) => ({ ...profile, username: prev }));
  else scheduleUserProfileRefresh();
}

export function adjustBalance(delta: number) {
  userProfileStore.update((profile) => ({
    ...profile,
    balance: { virtual: Math.max(0, profile.balance.virtual + delta) },
  }));
}

export const earnedBadges = derived(userProfileStore, ($profile) =>
  $profile.badges.filter((badge) => badge.earnedAt !== null)
);

export const lockedBadges = derived(userProfileStore, ($profile) =>
  $profile.badges.filter((badge) => badge.earnedAt === null)
);

export const profileTier = derived(userProfileStore, ($profile) => $profile.tier);
export const profileStats = derived(userProfileStore, ($profile) => $profile.stats);
