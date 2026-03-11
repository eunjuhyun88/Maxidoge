// ═══════════════════════════════════════════════════════════════
// Stockclaw — WebSocket Reconnect Factory
// ═══════════════════════════════════════════════════════════════
// Shared auto-reconnect with exponential backoff.
// Used by Binance kline + miniTicker subscriptions.

export interface ReconnectingWSOptions {
  url: string;
  label: string;
  onMessage: (event: MessageEvent) => void;
  maxRetryDelay?: number;
}

export function createReconnectingWS(options: ReconnectingWSOptions): () => void {
  const maxDelay = options.maxRetryDelay ?? 30_000;

  let ws: WebSocket | null = null;
  let destroyed = false;
  let retryDelay = 1000;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  function connect() {
    if (destroyed) return;
    ws = new WebSocket(options.url);

    ws.onopen = () => {
      retryDelay = 1000;
    };

    ws.onmessage = options.onMessage;

    ws.onerror = (err) => console.error(`[${options.label}] Error:`, err);

    ws.onclose = () => {
      if (destroyed) return;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(() => {
        retryTimer = null;
        retryDelay = Math.min(retryDelay * 2, maxDelay);
        connect();
      }, retryDelay);
    };
  }

  connect();

  return () => {
    destroyed = true;
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    if (ws) { try { ws.close(); } catch {} }
    ws = null;
  };
}
