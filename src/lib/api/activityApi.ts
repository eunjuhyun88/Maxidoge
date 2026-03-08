import type {
  ActivityFeedData,
  ActivityFeedQuery,
  ActivityRecord,
  CreateActivityReactionData,
  CreateActivityReactionRequest,
} from '$lib/contracts/activity';
import type { LegacySuccessEnvelope } from '$lib/contracts/http';

type ApiErrorPayload = {
  error?: string;
};

function canUseBrowserFetch(): boolean {
  return typeof window !== 'undefined' && typeof fetch === 'function';
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
      // ignore parse error
    }
    throw new Error(message);
  }

  return (await res.json()) as T;
}

export async function fetchActivityFeedApi(query?: ActivityFeedQuery): Promise<ActivityFeedData | null> {
  if (!canUseBrowserFetch()) return null;
  try {
    const search = new URLSearchParams();
    if (query?.limit != null) search.set('limit', String(query.limit));
    if (query?.offset != null) search.set('offset', String(query.offset));
    if (query?.eventType) search.set('eventType', query.eventType);
    if (query?.sourcePage) search.set('sourcePage', query.sourcePage);

    const suffix = search.toString();
    const url = suffix ? `/api/activity?${suffix}` : '/api/activity';
    const result = await requestJson<
      LegacySuccessEnvelope<'records', ActivityRecord[]> & {
        total: number;
        pagination?: {
          limit?: number;
          offset?: number;
        };
      }
    >(url, { method: 'GET' });

    return {
      total: Number(result.total ?? 0),
      records: Array.isArray(result.records) ? result.records : [],
      pagination: {
        limit: Number(result.pagination?.limit ?? query?.limit ?? 50),
        offset: Number(result.pagination?.offset ?? query?.offset ?? 0),
      },
    };
  } catch {
    return null;
  }
}

export async function createActivityReactionApi(
  payload: CreateActivityReactionRequest,
): Promise<CreateActivityReactionData | null> {
  if (!canUseBrowserFetch()) return null;
  try {
    const result = await requestJson<LegacySuccessEnvelope<'reaction', ActivityRecord>>('/api/activity/reaction', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return {
      reaction: result.reaction,
    };
  } catch {
    return null;
  }
}
