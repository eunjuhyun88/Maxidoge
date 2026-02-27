// Stockclaw — LIVE Stream API (SSE)
// GET /api/arena/live/stream/[sessionId] — Server-Sent Events spectator stream

import type { RequestHandler } from './$types';
import { getAuthUserFromCookies } from '$lib/server/authGuard';
import { liveConnectionManager, encodeSSEEvent } from '$lib/server/liveConnectionManager';
import type { SSEEvent } from '$lib/engine/types';

export const GET: RequestHandler = async ({ params, cookies }) => {
  const sessionId = params.sessionId;
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'sessionId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Auth (optional for spectators — can be anonymous)
  const user = await getAuthUserFromCookies(cookies).catch(() => null);
  const userId = user?.id ?? 'anonymous';

  let sendRef: ((event: SSEEvent) => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: SSEEvent) => {
        try {
          controller.enqueue(encodeSSEEvent(event));
        } catch {
          // Controller closed
        }
      };

      sendRef = send;
      liveConnectionManager.addConnection(sessionId, userId, send);

      // Send initial heartbeat
      const heartbeat: SSEEvent = {
        type: 'live:spectator_count',
        data: {
          count: liveConnectionManager.getSpectatorCount(sessionId),
          sessionId,
          connected: true,
        },
        timestamp: Date.now(),
      };
      controller.enqueue(encodeSSEEvent(heartbeat));
    },
    cancel() {
      if (sendRef) {
        liveConnectionManager.removeConnection(sessionId, sendRef);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',   // Nginx SSE support
    },
  });
};
