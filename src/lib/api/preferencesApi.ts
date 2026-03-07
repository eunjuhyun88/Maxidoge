import type { LegacySuccessEnvelope } from '$lib/contracts/http';
import type {
  UpdatePreferencesRequest,
  UpdateUiStateRequest,
  UserPreferences,
  UserUiState,
} from '$lib/contracts/preferences';

export type ApiUserPreferences = UserPreferences;
export type ApiUserUiState = UserUiState;

type JsonHeaders = Record<string, string>;

function canUseBrowserFetch(): boolean {
  return typeof window !== 'undefined' && typeof fetch === 'function';
}

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  const headers: JsonHeaders = {
    'content-type': 'application/json',
    ...(init.headers as JsonHeaders | undefined),
  };

  const res = await fetch(url, { ...init, headers, signal: init?.signal ?? AbortSignal.timeout(10_000) });
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

export async function fetchPreferencesApi(): Promise<ApiUserPreferences | null> {
  if (!canUseBrowserFetch()) return null;
  try {
    const result = await requestJson<LegacySuccessEnvelope<'preferences', ApiUserPreferences>>(
      '/api/preferences',
      {
        method: 'GET',
      },
    );
    return result.preferences || null;
  } catch {
    return null;
  }
}

export async function updatePreferencesApi(
  payload: UpdatePreferencesRequest,
): Promise<ApiUserPreferences | null> {
  if (!canUseBrowserFetch()) return null;
  try {
    const result = await requestJson<LegacySuccessEnvelope<'preferences', ApiUserPreferences>>(
      '/api/preferences',
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
    );
    return result.preferences || null;
  } catch {
    return null;
  }
}

export async function fetchUiStateApi(): Promise<ApiUserUiState | null> {
  if (!canUseBrowserFetch()) return null;
  try {
    const result = await requestJson<LegacySuccessEnvelope<'uiState', ApiUserUiState>>('/api/ui-state', {
      method: 'GET',
    });
    return result.uiState || null;
  } catch {
    return null;
  }
}

export async function updateUiStateApi(payload: UpdateUiStateRequest): Promise<ApiUserUiState | null> {
  if (!canUseBrowserFetch()) return null;
  try {
    const result = await requestJson<LegacySuccessEnvelope<'uiState', ApiUserUiState>>('/api/ui-state', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return result.uiState || null;
  } catch {
    return null;
  }
}
