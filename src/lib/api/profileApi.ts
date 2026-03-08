import type { LegacyBooleanEnvelope, LegacySuccessEnvelope } from '$lib/contracts/http';
import type {
  PassportProjection,
  ProfileBadge,
  ProfileProjection,
  UpdateProfileRequest,
} from '$lib/contracts/profile';

export type ApiProfileBadgePayload = ProfileBadge;
export type ApiProfilePayload = ProfileProjection;
export type ApiPassportPayload = PassportProjection;

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

export async function fetchProfileApi(): Promise<ApiProfilePayload | null> {
  if (!canUseBrowserFetch()) return null;
  try {
    const result = await requestJson<LegacySuccessEnvelope<'profile', ApiProfilePayload>>('/api/profile', {
      method: 'GET',
    });
    return result.profile || null;
  } catch {
    return null;
  }
}

export async function updateProfileApi(payload: UpdateProfileRequest): Promise<boolean> {
  if (!canUseBrowserFetch()) return false;
  try {
    await requestJson<LegacyBooleanEnvelope>('/api/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return true;
  } catch {
    return false;
  }
}

export async function fetchPassportApi(): Promise<ApiPassportPayload | null> {
  if (!canUseBrowserFetch()) return null;
  try {
    const result = await requestJson<LegacySuccessEnvelope<'passport', ApiPassportPayload>>(
      '/api/profile/passport',
      {
        method: 'GET',
      },
    );
    return result.passport || null;
  } catch {
    return null;
  }
}
