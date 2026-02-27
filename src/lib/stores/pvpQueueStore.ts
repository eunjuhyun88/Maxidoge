// ═══════════════════════════════════════════════════════════════
// STOCKCLAW — PvP Queue Store
// 3-second polling while in queue, auto-start on match
// ═══════════════════════════════════════════════════════════════

import { writable, derived } from 'svelte/store';
import { gameState } from './gameState';
import { joinPvPQueue, getPvPQueueStatus, leavePvPQueue } from '$lib/api/arenaApi';
import type { DraftSelection, Tier } from '$lib/engine/types';

interface PvPQueueStoreState {
  loading: boolean;
  error: string | null;
}

const store = writable<PvPQueueStoreState>({ loading: false, error: null });

let pollTimer: ReturnType<typeof setInterval> | null = null;

/** Join the PvP matching queue */
export async function enqueue(pair: string, timeframe: string, draft: DraftSelection[], tier: Tier = 'GOLD') {
  store.update(s => ({ ...s, loading: true, error: null }));
  try {
    const res = await joinPvPQueue({ pair, timeframe, tier, draft });
    if (res.matched && res.matchId) {
      // Instant match
      gameState.update(s => ({
        ...s,
        pvpQueue: { inQueue: false, poolEntryId: res.poolEntryId ?? null, matched: true, matchId: res.matchId! },
      }));
    } else {
      gameState.update(s => ({
        ...s,
        pvpQueue: { inQueue: true, poolEntryId: res.poolEntryId ?? null, matched: false, matchId: null },
      }));
      startQueuePolling();
    }
  } catch (err: unknown) {
    store.update(s => ({ ...s, error: err instanceof Error ? err.message : 'Queue join failed' }));
  } finally {
    store.update(s => ({ ...s, loading: false }));
  }
}

/** Leave the PvP matching queue */
export async function dequeue() {
  store.update(s => ({ ...s, loading: true, error: null }));
  stopQueuePolling();
  try {
    let entryId: string | null = null;
    gameState.subscribe(s => { entryId = s.pvpQueue.poolEntryId; })();
    if (entryId) await leavePvPQueue(entryId);
    gameState.update(s => ({
      ...s,
      pvpQueue: { inQueue: false, poolEntryId: null, matched: false, matchId: null },
    }));
  } catch (err: unknown) {
    store.update(s => ({ ...s, error: err instanceof Error ? err.message : 'Queue leave failed' }));
  } finally {
    store.update(s => ({ ...s, loading: false }));
  }
}

/** Start 3-second polling for match status */
export function startQueuePolling() {
  stopQueuePolling();
  pollTimer = setInterval(async () => {
    try {
      const status = await getPvPQueueStatus();
      const matchedEntry = status.entries.find(e => e.status === 'MATCHED' && e.matchId);
      if (matchedEntry) {
        gameState.update(s => ({
          ...s,
          pvpQueue: { ...s.pvpQueue, matched: true, matchId: matchedEntry.matchId! },
        }));
        stopQueuePolling();
      }
    } catch {
      // silent — retry on next poll
    }
  }, 3000);
}

/** Stop polling */
export function stopQueuePolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

// Derived convenience
export const pvpQueueLoading = derived(store, $s => $s.loading);
export const pvpQueueError = derived(store, $s => $s.error);
export const isInQueue = derived(gameState, $g => $g.pvpQueue.inQueue);
export const isMatched = derived(gameState, $g => $g.pvpQueue.matched);

export { store as pvpQueueStore };
