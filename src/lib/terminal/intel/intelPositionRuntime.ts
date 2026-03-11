import {
  POSITIONS_FULL_REFRESH_MS,
  POSITIONS_MIN_REFRESH_MS,
  POSITIONS_PENDING_POLL_MS,
  type IntelPanelTab,
} from './intelTypes';

export function createIntelPositionSyncRuntime(params: {
  getActiveTab: () => IntelPanelTab;
  hydratePositions: () => Promise<unknown>;
  pollPendingPositions: () => Promise<unknown>;
}) {
  let positionsPollTimer: ReturnType<typeof setInterval> | null = null;
  let positionsRefreshTimer: ReturnType<typeof setInterval> | null = null;
  let positionsLastRefreshAt = 0;
  let removeVisibilityListener: (() => void) | null = null;

  const isDocumentHidden = () => typeof document !== 'undefined' && document.hidden;

  const syncPositions = async (force = false) => {
    const now = Date.now();
    if (!force && now - positionsLastRefreshAt < POSITIONS_MIN_REFRESH_MS) return;
    positionsLastRefreshAt = now;
    await params.hydratePositions();
    await params.pollPendingPositions();
  };

  const stop = () => {
    if (positionsPollTimer) clearInterval(positionsPollTimer);
    if (positionsRefreshTimer) clearInterval(positionsRefreshTimer);
    positionsPollTimer = null;
    positionsRefreshTimer = null;
    removeVisibilityListener?.();
    removeVisibilityListener = null;
  };

  const start = () => {
    stop();

    positionsPollTimer = setInterval(() => {
      if (params.getActiveTab() !== 'positions' || isDocumentHidden()) return;
      void params.pollPendingPositions();
    }, POSITIONS_PENDING_POLL_MS);

    positionsRefreshTimer = setInterval(() => {
      if (params.getActiveTab() !== 'positions' || isDocumentHidden()) return;
      void syncPositions(true);
    }, POSITIONS_FULL_REFRESH_MS);

    if (typeof document !== 'undefined') {
      const handleVisibility = () => {
        if (!document.hidden && params.getActiveTab() === 'positions') {
          void syncPositions(true);
        }
      };
      document.addEventListener('visibilitychange', handleVisibility);
      removeVisibilityListener = () => document.removeEventListener('visibilitychange', handleVisibility);
    }
  };

  return {
    start,
    stop,
    syncPositions,
  };
}
