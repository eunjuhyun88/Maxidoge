import type {
  AuthSessionData,
  AuthUser,
  LoginAuthData,
  LoginAuthRequest,
  LogoutData,
  RegisterAuthData,
  RegisterAuthRequest,
  VerifyWalletData,
  VerifyWalletRequest,
  WalletNonceData,
  WalletNonceRequest,
} from '$lib/contracts/auth';
import type { LegacyBooleanEnvelope, LegacySuccessEnvelope } from '$lib/contracts/http';

export type RegisterAuthPayload = RegisterAuthRequest;
export type LoginAuthPayload = LoginAuthRequest;
export type AuthUserPayload = AuthUser;
export type AuthSessionResponse = AuthSessionData;
export type WalletNoncePayload = WalletNonceRequest;
export type VerifyWalletPayload = VerifyWalletRequest;

interface ApiErrorPayload {
  error?: string;
}

interface LegacyAuthUserPayload {
  id?: unknown;
  email?: unknown;
  nickname?: unknown;
  tier?: unknown;
  phase?: unknown;
  walletAddress?: unknown;
  wallet?: unknown;
}

function parseTimestampMs(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) return asNumber;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeAuthUser(payload: LegacyAuthUserPayload | null | undefined): AuthUser | null {
  if (!payload || typeof payload !== 'object') return null;

  return {
    id: typeof payload.id === 'string' ? payload.id : '',
    email: typeof payload.email === 'string' ? payload.email : '',
    nickname: typeof payload.nickname === 'string' ? payload.nickname : '',
    tier: typeof payload.tier === 'string' ? payload.tier : 'guest',
    phase: Number.isFinite(Number(payload.phase)) ? Number(payload.phase) : 0,
    walletAddress: typeof payload.walletAddress === 'string'
      ? payload.walletAddress
      : typeof payload.wallet === 'string'
        ? payload.wallet
        : null,
    wallet: typeof payload.wallet === 'string' ? payload.wallet : null,
  };
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

export function registerAuth(payload: RegisterAuthPayload) {
  return postJson<LegacySuccessEnvelope<'user', LegacyAuthUserPayload> & {
    walletVerified?: boolean;
    createdAt?: string | number | null;
  }>('/api/auth/register', payload).then((result): RegisterAuthData => ({
    user: normalizeAuthUser(result.user) ?? {
      id: '',
      email: payload.email,
      nickname: payload.nickname,
      tier: 'registered',
      phase: 1,
      walletAddress: payload.walletAddress ?? null,
      wallet: payload.walletAddress ?? null,
    },
    walletVerified: result.walletVerified === true,
    createdAtMs: parseTimestampMs(result.createdAt),
  }));
}

export function loginAuth(payload: LoginAuthPayload) {
  return postJson<LegacySuccessEnvelope<'user', LegacyAuthUserPayload> & {
    loggedInAt?: string | number | null;
  }>('/api/auth/login', payload).then((result): LoginAuthData => ({
    user: normalizeAuthUser(result.user) ?? {
      id: '',
      email: payload.email,
      nickname: payload.nickname,
      tier: 'connected',
      phase: 1,
      walletAddress: payload.walletAddress,
      wallet: payload.walletAddress,
    },
    loggedInAtMs: parseTimestampMs(result.loggedInAt),
  }));
}

export function fetchAuthSession() {
  return getJson<{
    authenticated: boolean;
    user: LegacyAuthUserPayload | null;
  }>('/api/auth/session').then((result): AuthSessionData => ({
    authenticated: result.authenticated === true,
    user: normalizeAuthUser(result.user),
  }));
}

export function requestWalletNonce(payload: WalletNoncePayload) {
  return postJson<LegacySuccessEnvelope<'address', string> & {
    chain?: string | null;
    nonce: string;
    message: string;
    expiresAt?: string | number | null;
  }>('/api/auth/nonce', payload).then((result): WalletNonceData => ({
    address: result.address,
    chain: typeof result.chain === 'string' ? result.chain : null,
    nonce: result.nonce,
    message: result.message,
    expiresAtMs: parseTimestampMs(result.expiresAt),
  }));
}

export function verifyWalletSignature(payload: VerifyWalletPayload) {
  return postJson<LegacyBooleanEnvelope & {
    verified?: boolean;
    linkedToUser?: boolean;
    userId?: string | null;
    wallet?: {
      address?: string;
      shortAddr?: string;
      chain?: string;
      provider?: string;
      verified?: boolean;
    } | null;
  }>('/api/auth/verify-wallet', payload).then((result): VerifyWalletData => ({
    verified: result.verified === true,
    linkedToUser: result.linkedToUser === true,
    userId: typeof result.userId === 'string' ? result.userId : null,
    wallet: result.wallet
      ? {
          address: typeof result.wallet.address === 'string' ? result.wallet.address : '',
          shortAddr: typeof result.wallet.shortAddr === 'string' ? result.wallet.shortAddr : '',
          chain: typeof result.wallet.chain === 'string' ? result.wallet.chain : '',
          provider: typeof result.wallet.provider === 'string' ? result.wallet.provider : '',
          verified: result.wallet.verified === true,
        }
      : null,
  }));
}

export function logoutAuth() {
  return postJson<LegacyBooleanEnvelope>('/api/auth/logout', {}).then((result): LogoutData => ({
    loggedOut: result.success === true,
  }));
}
