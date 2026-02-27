// ═══════════════════════════════════════════════════════════════
// Stockclaw — LIVE Connection Manager (B-01)
// SSE-based spectator streaming for arena matches.
// SvelteKit doesn't support WebSocket natively — SSE via ReadableStream.
// ═══════════════════════════════════════════════════════════════

import { query } from '$lib/server/db';
import type { SSEEvent, SSEEventType, LiveReaction } from '$lib/engine/types';
import { LIVE_ALLOWED_REACTIONS } from '$lib/engine/constants';

// ── Types ───────────────────────────────────────────────────

type SendFn = (event: SSEEvent) => void;

interface ConnectionEntry {
  send: SendFn;
  userId: string;
  connectedAt: number;
}

// ── Singleton Manager ───────────────────────────────────────

class LiveConnectionManager {
  // sessionId → Set<ConnectionEntry>
  private connections = new Map<string, Set<ConnectionEntry>>();

  // ── Connection Management ─────────────────────────────────

  addConnection(sessionId: string, userId: string, send: SendFn): void {
    let conns = this.connections.get(sessionId);
    if (!conns) {
      conns = new Set();
      this.connections.set(sessionId, conns);
    }
    conns.add({ send, userId, connectedAt: Date.now() });

    // Broadcast updated spectator count
    this.broadcastSpectatorCount(sessionId);
  }

  removeConnection(sessionId: string, send: SendFn): void {
    const conns = this.connections.get(sessionId);
    if (!conns) return;

    for (const entry of conns) {
      if (entry.send === send) {
        conns.delete(entry);
        break;
      }
    }

    if (conns.size === 0) {
      this.connections.delete(sessionId);
    } else {
      this.broadcastSpectatorCount(sessionId);
    }
  }

  // ── Broadcasting ──────────────────────────────────────────

  broadcast(sessionId: string, event: SSEEvent): void {
    const conns = this.connections.get(sessionId);
    if (!conns) return;

    for (const entry of conns) {
      try {
        entry.send(event);
      } catch {
        // Connection dead, will be cleaned up on next interaction
      }
    }
  }

  private broadcastSpectatorCount(sessionId: string): void {
    const count = this.getSpectatorCount(sessionId);
    this.broadcast(sessionId, {
      type: 'live:spectator_count',
      data: { count, sessionId },
      timestamp: Date.now(),
    });
  }

  // ── Queries ───────────────────────────────────────────────

  getSpectatorCount(sessionId: string): number {
    return this.connections.get(sessionId)?.size ?? 0;
  }

  getActiveSessions(): string[] {
    return Array.from(this.connections.keys());
  }

  // ── Cleanup ───────────────────────────────────────────────

  cleanup(): void {
    // Remove sessions with no connections
    for (const [sessionId, conns] of this.connections.entries()) {
      if (conns.size === 0) {
        this.connections.delete(sessionId);
      }
    }
  }
}

// ── Singleton Export ─────────────────────────────────────────

export const liveConnectionManager = new LiveConnectionManager();

// ── SSE Encoder Helper ──────────────────────────────────────

const encoder = new TextEncoder();

/**
 * Encode an SSE event as a UTF-8 byte array.
 */
export function encodeSSEEvent(event: SSEEvent): Uint8Array {
  return encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
}

// ── LIVE Session DB Helpers ─────────────────────────────────

const TABLE_UNAVAILABLE = new Set(['42P01', '42703', '23503']);
function isTableError(err: unknown): boolean {
  const errObj = err as Record<string, unknown> | null | undefined;
  const code = typeof errObj?.code === 'string' ? errObj.code : '';
  return TABLE_UNAVAILABLE.has(code) || (typeof errObj?.message === 'string' && (errObj.message as string).includes('DATABASE_URL is not set'));
}

export async function createLiveSession(
  matchId: string,
  creatorId: string,
  pair: string,
): Promise<{ sessionId: string }> {
  const { randomUUID } = await import('node:crypto');
  const sessionId = randomUUID();

  try {
    await query(
      `INSERT INTO live_sessions (id, match_id, creator_id, pair, stage, is_live)
       VALUES ($1, $2, $3, $4, 'WAITING', true)`,
      [sessionId, matchId, creatorId, pair],
    );
  } catch (err: unknown) {
    if (!isTableError(err)) throw err;
  }

  return { sessionId };
}

export async function getActiveLiveSessions(
  limit = 20,
): Promise<{ id: string; matchId: string; creatorId: string; pair: string; stage: string; spectatorCount: number; createdAt: string }[]> {
  try {
    const res = await query<any>(
      `SELECT id, match_id, creator_id, pair, stage, spectator_count, created_at
       FROM live_sessions
       WHERE is_live = true
       ORDER BY spectator_count DESC, created_at DESC
       LIMIT $1`,
      [limit],
    );
    return res.rows.map((r: any) => ({
      id: r.id,
      matchId: r.match_id,
      creatorId: r.creator_id,
      pair: r.pair,
      stage: r.stage,
      spectatorCount: liveConnectionManager.getSpectatorCount(r.id),
      createdAt: r.created_at,
    }));
  } catch (err: unknown) {
    if (isTableError(err)) return [];
    throw err;
  }
}

export async function endLiveSession(sessionId: string, creatorId: string): Promise<boolean> {
  try {
    const res = await query(
      `UPDATE live_sessions SET is_live = false, ended_at = now()
       WHERE id = $1 AND creator_id = $2 AND is_live = true`,
      [sessionId, creatorId],
    );
    return (res.rowCount ?? 0) > 0;
  } catch (err: unknown) {
    if (isTableError(err)) return false;
    throw err;
  }
}

// ── Store LIVE Reaction ─────────────────────────────────────

export async function storeLiveReaction(
  sessionId: string,
  userId: string,
  reaction: string,
): Promise<boolean> {
  if (!(LIVE_ALLOWED_REACTIONS as readonly string[]).includes(reaction)) return false;

  try {
    await query(
      `INSERT INTO live_reactions (session_id, user_id, reaction)
       VALUES ($1, $2, $3)`,
      [sessionId, userId, reaction],
    );
  } catch (err: unknown) {
    if (!isTableError(err)) console.warn('[live] reaction store failed:', err);
    return false;
  }

  // Broadcast reaction to all spectators
  liveConnectionManager.broadcast(sessionId, {
    type: 'live:reaction',
    data: { userId, reaction, sessionId },
    timestamp: Date.now(),
  });

  return true;
}
