import { derived } from 'svelte/store';
import {
  adjustBalance,
  earnedBadges,
  hydrateUserProfile,
  incrementTrackedSignals,
  lockedBadges,
  profileTier,
  setAvatar,
  setUsername,
  syncLP,
  syncPnL,
  type Badge,
  type ProfileTier,
  type UserProfileProjection,
  userProfileProjectionStore,
} from './userProfileProjectionStore';
import {
  type UserProfileDerivedStats,
  userProfileDerivedStatsStore,
} from './userProfileDerivedStatsStore';

export type { Badge, ProfileTier };

export interface UserProfile extends Omit<UserProfileProjection, 'stats'> {
  stats: UserProfileProjection['stats'] & UserProfileDerivedStats;
}

export const userProfileStore = derived(
  [userProfileProjectionStore, userProfileDerivedStatsStore],
  ([$projection, $derived]): UserProfile => ({
    ...$projection,
    stats: {
      ...$projection.stats,
      ...$derived,
    },
  }),
);
export const profileStats = derived(userProfileStore, ($profile) => $profile.stats);

export {
  adjustBalance,
  hydrateUserProfile,
  incrementTrackedSignals,
  earnedBadges,
  setAvatar,
  setUsername,
  lockedBadges,
  profileTier,
  syncLP,
  syncPnL,
};
