import { writable, get, derived } from 'svelte/store';
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

export interface UserProfileServerStats {
  winRate: number;
  totalMatches: number;
  totalPnL: number;
  streak: number;
  bestStreak: number;
  trackedSignals: number;
}

export interface UserProfileProjection {
  address: string | null;
  username: string;
  tier: ProfileTier;
  avatar: string;
  stats: UserProfileServerStats;
  badges: Badge[];
  balance: { virtual: number };
  joinedAt: number;
}

const STORAGE_KEY = STORAGE_KEYS.profile;
const PROFILE_REFRESH_DEBOUNCE_MS = 900;

function createDefaultProjection(): UserProfileProjection {
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
      trackedSignals: 0,
    },
    badges: createDefaultBadges(),
    balance: { virtual: 10000 },
    joinedAt: Date.now(),
  };
}

function loadProfileProjection(): UserProfileProjection {
  if (typeof window === 'undefined') return createDefaultProjection();
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...createDefaultProjection(),
        ...parsed,
        tier: normalizeProfileTier(parsed?.tier),
        badges: mergeProfileBadges(parsed?.badges ?? []),
      };
    }
  } catch {
    // ignore invalid cache
  }
  return createDefaultProjection();
}

export const userProfileProjectionStore = writable<UserProfileProjection>(loadProfileProjection());

let _profileSave: ReturnType<typeof setTimeout> | null = null;
userProfileProjectionStore.subscribe((profile) => {
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
  userProfileProjectionStore.update((profile) => {
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

    userProfileProjectionStore.update((current) => {
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

export function syncPnL(_pnl: number) {
  scheduleUserProfileRefresh();
}

export function syncLP(_lp: number) {
  scheduleUserProfileRefresh();
}

export function incrementTrackedSignals() {
  userProfileProjectionStore.update((profile) => ({
    ...profile,
    stats: {
      ...profile.stats,
      trackedSignals: profile.stats.trackedSignals + 1,
    },
  }));
  scheduleUserProfileRefresh();
}

export async function setAvatar(path: string) {
  const prev = get(userProfileProjectionStore).avatar;
  userProfileProjectionStore.update((profile) => ({ ...profile, avatar: path }));
  const ok = await updateProfileApi({ avatar: path });
  if (!ok) userProfileProjectionStore.update((profile) => ({ ...profile, avatar: prev }));
  else scheduleUserProfileRefresh();
}

export async function setUsername(name: string) {
  const next = name.trim();
  if (next.length < 2) return;
  const prev = get(userProfileProjectionStore).username;
  userProfileProjectionStore.update((profile) => ({ ...profile, username: next }));
  const ok = await updateProfileApi({ nickname: next });
  if (!ok) userProfileProjectionStore.update((profile) => ({ ...profile, username: prev }));
  else scheduleUserProfileRefresh();
}

export function adjustBalance(delta: number) {
  userProfileProjectionStore.update((profile) => ({
    ...profile,
    balance: { virtual: Math.max(0, profile.balance.virtual + delta) },
  }));
}

export const earnedBadges = derived(userProfileProjectionStore, ($profile) =>
  $profile.badges.filter((badge) => badge.earnedAt !== null)
);

export const lockedBadges = derived(userProfileProjectionStore, ($profile) =>
  $profile.badges.filter((badge) => badge.earnedAt === null)
);

export const profileTier = derived(userProfileProjectionStore, ($profile) => $profile.tier);
