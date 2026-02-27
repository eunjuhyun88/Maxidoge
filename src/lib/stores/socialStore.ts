// ═══════════════════════════════════════════════════════════════
// STOCKCLAW — Social Store
// Social feed + follow/unfollow
// ═══════════════════════════════════════════════════════════════

import { writable, derived } from 'svelte/store';
import {
  followUser,
  unfollowUser,
  getSocialFeed,
  getSocialProfile,
} from '$lib/api/arenaApi';
import type { ArenaSignal, UserFollowStats } from '$lib/engine/types';

interface SocialProfile {
  userId: string;
  displayName: string;
  tier: string;
  lp: number;
  winRate: number;
  followStats: UserFollowStats;
  recentSignals: ArenaSignal[];
}

interface SocialStoreState {
  feed: ArenaSignal[];
  feedOffset: number;
  feedHasMore: boolean;
  viewedProfile: SocialProfile | null;
  loading: boolean;
  error: string | null;
}

const store = writable<SocialStoreState>({
  feed: [],
  feedOffset: 0,
  feedHasMore: true,
  viewedProfile: null,
  loading: false,
  error: null,
});

const FEED_PAGE_SIZE = 20;

/** Load social feed (paginated) */
export async function loadFeed(pair?: string, reset = false) {
  store.update(s => ({ ...s, loading: true, error: null }));
  try {
    let offset = 0;
    if (!reset) {
      store.subscribe(s => { offset = s.feedOffset; })();
    }
    const res = await getSocialFeed(FEED_PAGE_SIZE, offset, pair);
    store.update(s => ({
      ...s,
      feed: reset ? res.signals : [...s.feed, ...res.signals],
      feedOffset: (reset ? 0 : s.feedOffset) + res.signals.length,
      feedHasMore: res.signals.length >= FEED_PAGE_SIZE,
    }));
  } catch (err: unknown) {
    store.update(s => ({ ...s, error: err instanceof Error ? err.message : 'Failed to load feed' }));
  } finally {
    store.update(s => ({ ...s, loading: false }));
  }
}

/** Follow a user */
export async function follow(userId: string) {
  try {
    await followUser(userId);
    // Update profile if viewing this user
    store.update(s => {
      if (s.viewedProfile?.userId === userId) {
        return {
          ...s,
          viewedProfile: {
            ...s.viewedProfile,
            followStats: {
              ...s.viewedProfile.followStats,
              followersCount: s.viewedProfile.followStats.followersCount + 1,
              isFollowing: true,
            },
          },
        };
      }
      return s;
    });
  } catch (err: unknown) {
    store.update(s => ({ ...s, error: err instanceof Error ? err.message : 'Failed to follow' }));
  }
}

/** Unfollow a user */
export async function unfollow(userId: string) {
  try {
    await unfollowUser(userId);
    store.update(s => {
      if (s.viewedProfile?.userId === userId) {
        return {
          ...s,
          viewedProfile: {
            ...s.viewedProfile,
            followStats: {
              ...s.viewedProfile.followStats,
              followersCount: Math.max(0, s.viewedProfile.followStats.followersCount - 1),
              isFollowing: false,
            },
          },
        };
      }
      return s;
    });
  } catch (err: unknown) {
    store.update(s => ({ ...s, error: err instanceof Error ? err.message : 'Failed to unfollow' }));
  }
}

/** Load a user's social profile */
export async function loadProfile(userId: string) {
  store.update(s => ({ ...s, loading: true, error: null }));
  try {
    const res = await getSocialProfile(userId);
    store.update(s => ({
      ...s,
      viewedProfile: {
        userId: res.userId,
        displayName: res.displayName,
        tier: res.tier,
        lp: res.lpTotal,
        winRate: res.winRate,
        followStats: res.followStats,
        recentSignals: res.recentSignals,
      },
    }));
  } catch (err: unknown) {
    store.update(s => ({ ...s, error: err instanceof Error ? err.message : 'Failed to load profile' }));
  } finally {
    store.update(s => ({ ...s, loading: false }));
  }
}

// Derived convenience
export const socialFeed = derived(store, $s => $s.feed);
export const socialLoading = derived(store, $s => $s.loading);
export const socialError = derived(store, $s => $s.error);
export const socialProfile = derived(store, $s => $s.viewedProfile);
export const socialHasMore = derived(store, $s => $s.feedHasMore);

export { store as socialStore };
