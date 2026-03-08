import type {
  LoginAuthRequest,
  RegisterAuthRequest,
  VerifyWalletRequest,
  WalletNonceRequest,
} from '$lib/contracts/auth';
import type { LegacyBooleanEnvelope } from '$lib/contracts/http';
import {
  normalizeAuthSessionData,
  normalizeLoginAuthData,
  normalizeLogoutData,
  normalizeRegisterAuthData,
  normalizeVerifyWalletData,
  normalizeWalletNonceData,
  type AuthSessionApiResult,
  type LoginAuthApiResult,
  type RegisterAuthApiResult,
  type VerifyWalletApiResult,
  type WalletNonceApiResult,
} from '$lib/auth/authApiNormalizer';

interface ApiErrorPayload {
  error?: string;
}

async function parseApiError(res: Response): Promise<string> {
  try {
    const payload = (await res.json()) as ApiErrorPayload;
    if (payload?.error) return payload.error;
  } catch {
    // ignore parse error
  }
  return `Request failed (${res.status})`;
}

async function postJson<TResponse>(url: string, body: unknown): Promise<TResponse> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(await parseApiError(res));
  }

  return (await res.json()) as TResponse;
}

async function getJson<TResponse>(url: string): Promise<TResponse> {
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    throw new Error(await parseApiError(res));
  }
  return (await res.json()) as TResponse;
}

export function registerAuth(payload: RegisterAuthRequest) {
  return postJson<RegisterAuthApiResult>('/api/auth/register', payload).then((result) =>
    normalizeRegisterAuthData(payload, result)
  );
}

export function loginAuth(payload: LoginAuthRequest) {
  return postJson<LoginAuthApiResult>('/api/auth/login', payload).then((result) =>
    normalizeLoginAuthData(payload, result)
  );
}

export function fetchAuthSession() {
  return getJson<AuthSessionApiResult>('/api/auth/session').then(normalizeAuthSessionData);
}

export function requestWalletNonce(payload: WalletNonceRequest) {
  return postJson<WalletNonceApiResult>('/api/auth/nonce', payload).then(normalizeWalletNonceData);
}

export function verifyWalletSignature(payload: VerifyWalletRequest) {
  return postJson<VerifyWalletApiResult>('/api/auth/verify-wallet', payload).then(
    normalizeVerifyWalletData
  );
}

export function logoutAuth() {
  return postJson<LegacyBooleanEnvelope>('/api/auth/logout', {}).then(normalizeLogoutData);
}
