import type { LegacyBooleanEnvelope, LegacySuccessEnvelope } from '$lib/contracts/http';
import type {
  CreateNotificationRequest,
  DeleteNotificationData,
  MarkNotificationsReadData,
  NotificationListData,
  NotificationListQuery,
  NotificationRecord,
  NotificationType,
} from '$lib/contracts/notifications';

export type ApiNotificationType = NotificationType;
export type ApiNotification = NotificationRecord;

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
      const payload = (await res.json()) as { error?: string };
      if (payload?.error) message = payload.error;
    } catch {
      // ignore parse error
    }
    throw new Error(message);
  }

  return (await res.json()) as T;
}

export async function fetchNotificationsApi(params?: NotificationListQuery): Promise<NotificationListData | null> {
  if (!canUseBrowserFetch()) return null;
  try {
    const search = new URLSearchParams();
    if (params?.limit != null) search.set('limit', String(params.limit));
    if (params?.offset != null) search.set('offset', String(params.offset));
    if (params?.unreadOnly != null) search.set('unreadOnly', String(params.unreadOnly));

    const query = search.toString();
    const url = query ? `/api/notifications?${query}` : '/api/notifications';
    const result = await requestJson<
      LegacySuccessEnvelope<'records', ApiNotification[]> & {
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
        limit: Number(result.pagination?.limit ?? params?.limit ?? 50),
        offset: Number(result.pagination?.offset ?? params?.offset ?? 0),
      },
    };
  } catch {
    return null;
  }
}

export async function createNotificationApi(payload: CreateNotificationRequest): Promise<ApiNotification | null> {
  if (!canUseBrowserFetch()) return null;
  try {
    const result = await requestJson<LegacySuccessEnvelope<'notification', ApiNotification>>(
      '/api/notifications',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
    return result.notification || null;
  } catch {
    return null;
  }
}

export async function markNotificationsReadApi(ids?: string[]): Promise<MarkNotificationsReadData | null> {
  if (!canUseBrowserFetch()) return null;
  try {
    const result = await requestJson<LegacySuccessEnvelope<'updated', number>>('/api/notifications/read', {
      method: 'POST',
      body: JSON.stringify(ids && ids.length ? { ids } : {}),
    });
    return {
      updated: Number(result.updated ?? 0),
    };
  } catch {
    return null;
  }
}

export async function deleteNotificationApi(id: string): Promise<DeleteNotificationData | null> {
  if (!canUseBrowserFetch()) return null;
  try {
    const result = await requestJson<LegacyBooleanEnvelope & { deleted?: boolean }>(`/api/notifications/${id}`, {
      method: 'DELETE',
    });
    return {
      deleted: result.deleted === true,
    };
  } catch {
    return null;
  }
}
