import { hydrateQuickTrades } from './quickTradeStore';
import { hydrateTrackedSignals } from './trackedSignalStore';
import { hydrateMatchHistory } from './matchHistoryStore';
import { hydrateUserProfile } from './userProfileStore';
import { hydrateCommunityPosts } from './communityStore';
import { notifications } from './notificationStore';

export async function hydrateDomainStores(force = false): Promise<void> {
  if (typeof window === 'undefined') return;

  await Promise.allSettled([
    hydrateQuickTrades(force),
    hydrateTrackedSignals(force),
    hydrateMatchHistory(force),
    hydrateUserProfile(force),
    hydrateCommunityPosts(force),
    notifications.hydrate(force)
  ]);
}
