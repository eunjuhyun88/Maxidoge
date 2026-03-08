import type {
  AuthSessionData,
  AuthUser,
  LoginAuthData,
  LoginAuthRequest,
  LogoutData,
  RegisterAuthData,
  RegisterAuthRequest,
  VerifyWalletData,
  WalletNonceData,
} from '$lib/contracts/auth';
import type { LegacyBooleanEnvelope, LegacySuccessEnvelope } from '$lib/contracts/http';

export interface LegacyAuthUserPayload {
  id?: unknown;
  email?: unknown;
  nickname?: unknown;
  tier?: unknown;
  phase?: unknown;
  walletAddress?: unknown;
  wallet?: unknown;
}

export interface AuthSessionApiResult {
  authenticated: boolean;
  user: LegacyAuthUserPayload | null;
}

export type RegisterAuthApiResult = LegacySuccessEnvelope<'user', LegacyAuthUserPayload> & {
  walletVerified?: boolean;
  createdAt?: string | number | null;
};

export type LoginAuthApiResult = LegacySuccessEnvelope<'user', LegacyAuthUserPayload> & {
  loggedInAt?: string | number | null;
};

export type WalletNonceApiResult = LegacySuccessEnvelope<'address', string> & {
  chain?: string | null;
  nonce: string;
  message: string;
  expiresAt?: string | number | null;
};

export type VerifyWalletApiResult = LegacyBooleanEnvelope & {
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
};

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

export function normalizeAuthUser(payload: LegacyAuthUserPayload | null | undefined): AuthUser | null {
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

export function normalizeRegisterAuthData(
  payload: RegisterAuthRequest,
  result: RegisterAuthApiResult
): RegisterAuthData {
  return {
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
  };
}

export function normalizeLoginAuthData(
  payload: LoginAuthRequest,
  result: LoginAuthApiResult
): LoginAuthData {
  return {
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
  };
}

export function normalizeAuthSessionData(result: AuthSessionApiResult): AuthSessionData {
  return {
    authenticated: result.authenticated === true,
    user: normalizeAuthUser(result.user),
  };
}

export function normalizeWalletNonceData(result: WalletNonceApiResult): WalletNonceData {
  return {
    address: result.address,
    chain: typeof result.chain === 'string' ? result.chain : null,
    nonce: result.nonce,
    message: result.message,
    expiresAtMs: parseTimestampMs(result.expiresAt),
  };
}

export function normalizeVerifyWalletData(result: VerifyWalletApiResult): VerifyWalletData {
  return {
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
  };
}

export function normalizeLogoutData(result: LegacyBooleanEnvelope): LogoutData {
  return {
    loggedOut: result.success === true,
  };
}
