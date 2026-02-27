// ═══════════════════════════════════════════════════════════════
// STOCKCLAW — Live Session Store
// SSE EventSource management + session listing
// ═══════════════════════════════════════════════════════════════

import { writable, derived } from 'svelte/store';
import {
  createLiveSession,
  listLiveSessions,
  connectLiveStream,
  sendLiveReaction,
} from '$lib/api/arenaApi';
import type { LiveSession, LiveReaction, SSEEvent } from '$lib/engine/types';

interface LiveSessionStoreState {
  sessions: LiveSession[];
  activeSessionId: string | null;
  spectatorCount: number;
  events: SSEEvent[];
  connected: boolean;
  loading: boolean;
  error: string | null;
}

const store = writable<LiveSessionStoreState>({
  sessions: [],
  activeSessionId: null,
  spectatorCount: 0,
  events: [],
  connected: false,
  loading: false,
  error: null,
});

let eventSource: EventSource | null = null;
const MAX_EVENTS = 100;

/** Load available live sessions */
export async function loadLiveSessions(limit = 20) {
  store.update(s => ({ ...s, loading: true, error: null }));
  try {
    const res = await listLiveSessions(limit);
    store.update(s => ({ ...s, sessions: res.sessions }));
  } catch (err: unknown) {
    store.update(s => ({ ...s, error: err instanceof Error ? err.message : 'Failed to load sessions' }));
  } finally {
    store.update(s => ({ ...s, loading: false }));
  }
}

/** Create a new live session for a match */
export async function createSession(matchId: string) {
  store.update(s => ({ ...s, loading: true, error: null }));
  try {
    const res = await createLiveSession(matchId);
    store.update(s => ({ ...s, activeSessionId: res.sessionId }));
    return res;
  } catch (err: unknown) {
    store.update(s => ({ ...s, error: err instanceof Error ? err.message : 'Failed to create session' }));
    throw err;
  } finally {
    store.update(s => ({ ...s, loading: false }));
  }
}

/** Connect to a live session's SSE stream */
export function connectToStream(sessionId: string) {
  disconnectStream(); // close any existing connection

  try {
    eventSource = connectLiveStream(sessionId);

    eventSource.onopen = () => {
      store.update(s => ({ ...s, connected: true, activeSessionId: sessionId, error: null }));
    };

    eventSource.onmessage = (ev) => {
      try {
        const event: SSEEvent = JSON.parse(ev.data);
        store.update(s => {
          const events = [event, ...s.events].slice(0, MAX_EVENTS);
          const spectatorCount = event.type === 'live:spectator_count'
            ? (event.data.count as number ?? s.spectatorCount)
            : s.spectatorCount;
          return { ...s, events, spectatorCount };
        });
      } catch {
        // ignore malformed SSE data
      }
    };

    eventSource.onerror = () => {
      store.update(s => ({ ...s, connected: false, error: 'Stream connection lost' }));
      // Auto-reconnect after 3s
      setTimeout(() => {
        let currentSession: string | null = null;
        store.subscribe(s => { currentSession = s.activeSessionId; })();
        if (currentSession) connectToStream(currentSession);
      }, 3000);
    };
  } catch (err: unknown) {
    store.update(s => ({ ...s, error: err instanceof Error ? err.message : 'Failed to connect' }));
  }
}

/** Disconnect from current SSE stream */
export function disconnectStream() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  store.update(s => ({ ...s, connected: false, activeSessionId: null, events: [], spectatorCount: 0 }));
}

/** Send a reaction to the active session */
export async function sendReaction(reaction: LiveReaction) {
  let sessionId: string | null = null;
  store.subscribe(s => { sessionId = s.activeSessionId; })();
  if (!sessionId) return;

  try {
    await sendLiveReaction(sessionId, reaction);
  } catch {
    // silent — reactions are best-effort
  }
}

// Derived convenience
export const liveSessions = derived(store, $s => $s.sessions);
export const liveConnected = derived(store, $s => $s.connected);
export const liveEvents = derived(store, $s => $s.events);
export const liveSpectators = derived(store, $s => $s.spectatorCount);
export const liveLoading = derived(store, $s => $s.loading);
export const liveError = derived(store, $s => $s.error);

export { store as liveSessionStore };
