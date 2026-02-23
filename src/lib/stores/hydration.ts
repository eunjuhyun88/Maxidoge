import { hydrateQuickTrades } from './quickTradeStore';
import { hydrateTrackedSignals } from './trackedSignalStore';
import { hydrateMatchHistory } from './matchHistoryStore';
import { hydrateUserProfile } from './userProfileStore';
import { hydrateCommunityPosts } from './communityStore';
import { notifications } from './notificationStore';
import { ensureLivePriceSyncStarted } from '$lib/services/livePriceSyncService';

let _domainHydrationPromise: Promise<void> | null = null;

export async function hydrateDomainStores(force = false): Promise<void> {
  if (typeof window === 'undefined') return;
  ensureLivePriceSyncStarted();
  if (_domainHydrationPromise) return _domainHydrationPromise;

  _domainHydrationPromise = Promise.allSettled([
    hydrateQuickTrades(force),
    hydrateTrackedSignals(force),
    hydrateMatchHistory(force),
    hydrateUserProfile(force),
    hydrateCommunityPosts(force),
    notifications.hydrate(force)
  ]).then(() => undefined);

  try {
    await _domainHydrationPromise;
  } finally {
    _domainHydrationPromise = null;
  }
}
