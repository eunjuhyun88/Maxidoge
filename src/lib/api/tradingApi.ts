import type {
  CloseQuickTradeRequest,
  ConvertSignalRequest,
  CopyTradeRun,
  OpenQuickTradeRequest,
  PublishCopyTradeData,
  PublishCopyTradeRequest,
  QuickTrade,
  QuickTradeListData,
  QuickTradeListParams,
  TrackSignalRequest,
  TrackedSignal,
  TrackedSignalListData,
  TrackedSignalListParams,
  UntrackSignalData,
  UpdateQuickTradePricesData,
  UpdateQuickTradePricesRequest,
} from '$lib/contracts/trading';
import type { LegacyBooleanEnvelope, LegacySuccessEnvelope } from '$lib/contracts/http';

export type ApiQuickTrade = QuickTrade;
export type ApiTrackedSignal = TrackedSignal;
export type ApiCopyTradeRun = CopyTradeRun;

interface ApiErrorPayload {
  error?: string;
}

interface LegacyQuickTradePayload {
  id?: unknown;
  userId?: unknown;
  pair?: unknown;
  dir?: unknown;
  entry?: unknown;
  tp?: unknown;
  sl?: unknown;
  currentPrice?: unknown;
  pnlPercent?: unknown;
  status?: unknown;
  openedAt?: unknown;
  closedAt?: unknown;
  closePnl?: unknown;
  source?: unknown;
  note?: unknown;
}

interface LegacyTrackedSignalPayload {
  id?: unknown;
  userId?: unknown;
  pair?: unknown;
  dir?: unknown;
  confidence?: unknown;
  entryPrice?: unknown;
  currentPrice?: unknown;
  pnlPercent?: unknown;
  status?: unknown;
  source?: unknown;
  note?: unknown;
  trackedAt?: unknown;
  expiresAt?: unknown;
  clientMutationId?: unknown;
}

interface LegacyCopyTradeRunPayload {
  id?: unknown;
  userId?: unknown;
  selectedSignalIds?: unknown;
  draft?: unknown;
  published?: unknown;
  publishedTradeId?: unknown;
  publishedSignalId?: unknown;
  createdAt?: unknown;
  publishedAt?: unknown;
}

function asFiniteNumber(value: unknown, fallback = 0): number {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function asNullableNumber(value: unknown): number | null {
  if (value == null) return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function normalizeQuickTrade(payload: LegacyQuickTradePayload | null | undefined): QuickTrade | null {
  if (!payload || typeof payload !== 'object') return null;

  return {
    id: typeof payload.id === 'string' ? payload.id : '',
    userId: typeof payload.userId === 'string' ? payload.userId : null,
    pair: typeof payload.pair === 'string' ? payload.pair : '',
    dir: payload.dir === 'SHORT' ? 'SHORT' : 'LONG',
    entry: asFiniteNumber(payload.entry),
    tp: asNullableNumber(payload.tp),
    sl: asNullableNumber(payload.sl),
    currentPrice: asFiniteNumber(payload.currentPrice),
    pnlPercent: asFiniteNumber(payload.pnlPercent),
    status: payload.status === 'closed' || payload.status === 'stopped' ? payload.status : 'open',
    openedAt: asFiniteNumber(payload.openedAt),
    closedAt: asNullableNumber(payload.closedAt),
    closePnl: asNullableNumber(payload.closePnl),
    source: typeof payload.source === 'string' ? payload.source : 'manual',
    note: typeof payload.note === 'string' ? payload.note : '',
  };
}

function normalizeTrackedSignal(payload: LegacyTrackedSignalPayload | null | undefined): TrackedSignal | null {
  if (!payload || typeof payload !== 'object') return null;

  return {
    id: typeof payload.id === 'string' ? payload.id : '',
    userId: typeof payload.userId === 'string' ? payload.userId : null,
    pair: typeof payload.pair === 'string' ? payload.pair : '',
    dir: payload.dir === 'SHORT' ? 'SHORT' : 'LONG',
    confidence: asFiniteNumber(payload.confidence),
    entryPrice: asFiniteNumber(payload.entryPrice),
    currentPrice: asFiniteNumber(payload.currentPrice),
    pnlPercent: asFiniteNumber(payload.pnlPercent),
    status:
      payload.status === 'expired' || payload.status === 'converted'
        ? payload.status
        : 'tracking',
    source: typeof payload.source === 'string' ? payload.source : 'manual',
    note: typeof payload.note === 'string' ? payload.note : '',
    trackedAt: asFiniteNumber(payload.trackedAt),
    expiresAt: asFiniteNumber(payload.expiresAt),
    clientMutationId: typeof payload.clientMutationId === 'string' ? payload.clientMutationId : null,
  };
}

function normalizeCopyTradeRun(payload: LegacyCopyTradeRunPayload | null | undefined): CopyTradeRun | null {
  if (!payload || typeof payload !== 'object') return null;

  return {
    id: typeof payload.id === 'string' ? payload.id : '',
    userId: typeof payload.userId === 'string' ? payload.userId : '',
    selectedSignalIds: Array.isArray(payload.selectedSignalIds)
      ? payload.selectedSignalIds.filter((value): value is string => typeof value === 'string')
      : [],
    draft: payload.draft && typeof payload.draft === 'object' && !Array.isArray(payload.draft)
      ? (payload.draft as Record<string, unknown>)
      : {},
    published: payload.published === true,
    publishedTradeId: typeof payload.publishedTradeId === 'string' ? payload.publishedTradeId : null,
    publishedSignalId: typeof payload.publishedSignalId === 'string' ? payload.publishedSignalId : null,
    createdAt: asFiniteNumber(payload.createdAt),
    publishedAt: asNullableNumber(payload.publishedAt),
  };
}

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const payload = (await res.json()) as ApiErrorPayload;
      if (payload?.error) message = payload.error;
    } catch {
      // ignore parse
    }
    throw new Error(message);
  }

  return (await res.json()) as T;
}

function canUseBrowserFetch(): boolean {
  return typeof window !== 'undefined' && typeof fetch === 'function';
}

export async function fetchQuickTradesApi(params?: QuickTradeListParams): Promise<ApiQuickTrade[] | null> {
  if (!canUseBrowserFetch()) return null;
  try {
    const query = new URLSearchParams();
    if (typeof params?.limit === 'number') query.set('limit', String(params.limit));
    if (typeof params?.offset === 'number') query.set('offset', String(params.offset));
    if (params?.status) query.set('status', params.status);
    const qs = query.toString();
    const result = await requestJson<LegacySuccessEnvelope<'records', LegacyQuickTradePayload[]> & QuickTradeListData>(
      `/api/quick-trades${qs ? `?${qs}` : ''}`,
      {
        method: 'GET',
      }
    );
    return Array.isArray(result.records)
      ? result.records.map(normalizeQuickTrade).filter((trade): trade is QuickTrade => Boolean(trade))
      : [];
  } catch {
    return null;
  }
}

export async function fetchTrackedSignalsApi(params?: TrackedSignalListParams): Promise<ApiTrackedSignal[] | null> {
  if (!canUseBrowserFetch()) return null;
  try {
    const query = new URLSearchParams();
    if (typeof params?.limit === 'number') query.set('limit', String(params.limit));
    if (typeof params?.offset === 'number') query.set('offset', String(params.offset));
    if (params?.status) query.set('status', params.status);
    const qs = query.toString();
    const result = await requestJson<LegacySuccessEnvelope<'records', LegacyTrackedSignalPayload[]> & TrackedSignalListData>(
      `/api/signals${qs ? `?${qs}` : ''}`,
      {
        method: 'GET',
      }
    );
    return Array.isArray(result.records)
      ? result.records.map(normalizeTrackedSignal).filter((signal): signal is TrackedSignal => Boolean(signal))
      : [];
  } catch {
    return null;
  }
}

export async function openQuickTradeApi(payload: OpenQuickTradeRequest): Promise<ApiQuickTrade | null> {
  if (!canUseBrowserFetch()) return null;
  try {
    const result = await requestJson<LegacySuccessEnvelope<'trade', LegacyQuickTradePayload>>('/api/quick-trades/open', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return normalizeQuickTrade(result.trade);
  } catch {
    return null;
  }
}

export async function closeQuickTradeApi(
  tradeId: string,
  payload: CloseQuickTradeRequest
): Promise<ApiQuickTrade | null> {
  if (!canUseBrowserFetch()) return null;
  try {
    const result = await requestJson<LegacySuccessEnvelope<'trade', LegacyQuickTradePayload>>(
      `/api/quick-trades/${tradeId}/close`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    return normalizeQuickTrade(result.trade);
  } catch {
    return null;
  }
}

export async function updateQuickTradePricesApi(
  payload: UpdateQuickTradePricesRequest
): Promise<number | null> {
  if (!canUseBrowserFetch()) return null;
  try {
    const result = await requestJson<LegacySuccessEnvelope<'updated', number> & UpdateQuickTradePricesData>(
      '/api/quick-trades/prices',
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }
    );
    return Number(result.updated ?? 0);
  } catch {
    return null;
  }
}

export async function trackSignalApi(payload: TrackSignalRequest): Promise<ApiTrackedSignal | null> {
  if (!canUseBrowserFetch()) return null;
  try {
    const result = await requestJson<LegacySuccessEnvelope<'signal', LegacyTrackedSignalPayload>>('/api/signals/track', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return normalizeTrackedSignal(result.signal);
  } catch {
    return null;
  }
}

export async function convertSignalApi(
  signalId: string,
  payload: ConvertSignalRequest
): Promise<ApiQuickTrade | null> {
  if (!canUseBrowserFetch()) return null;
  try {
    const result = await requestJson<LegacySuccessEnvelope<'trade', LegacyQuickTradePayload>>(
      `/api/signals/${signalId}/convert`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    return normalizeQuickTrade(result.trade);
  } catch {
    return null;
  }
}

export async function untrackSignalApi(signalId: string): Promise<boolean> {
  if (!canUseBrowserFetch()) return false;
  try {
    const result = await requestJson<LegacyBooleanEnvelope & UntrackSignalData>(`/api/signals/${signalId}`, {
      method: 'DELETE',
    });
    return result.success === true;
  } catch {
    return false;
  }
}

export async function publishCopyTradeApi(
  payload: PublishCopyTradeRequest
): Promise<PublishCopyTradeData | null> {
  if (!canUseBrowserFetch()) return null;
  try {
    const result = await requestJson<
      LegacyBooleanEnvelope & {
        run?: LegacyCopyTradeRunPayload;
        trade?: LegacyQuickTradePayload;
        signal?: LegacyTrackedSignalPayload;
        reused?: boolean;
      }
    >('/api/copy-trades/publish', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const run = normalizeCopyTradeRun(result.run);
    const trade = normalizeQuickTrade(result.trade);
    const signal = normalizeTrackedSignal(result.signal);
    if (!run || !trade || !signal) return null;
    return {
      run,
      trade,
      signal,
      reused: result.reused === true,
    };
  } catch {
    return null;
  }
}
