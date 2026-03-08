import type { Cookies } from '@sveltejs/kit';
import {
  EVM_WALLET_SIGNATURE_RE,
  validateAuthEmail,
  validateAuthNickname,
} from '$lib/contracts/auth';
import { createAuthSession } from './authRepository';
import {
  buildSessionCookieValue,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  SESSION_MAX_AGE_SEC,
} from './session';
import {
  isValidEthAddress,
  normalizeEthAddress,
  verifyAndConsumeEvmNonce,
} from './walletAuthRepository';

export interface AuthIdentityFields {
  email: string;
  nickname: string;
}

export interface WalletProofFields {
  walletAddressRaw: string;
  walletMessage: string;
  walletSignature: string;
}

export interface WalletProofVerifyOptionalResult {
  walletAddress: string | null;
  walletSignature: string | null;
}

export interface WalletProofVerifyRequiredResult {
  walletAddress: string;
  walletSignature: string;
}

export interface WalletProofError {
  ok: false;
  status: number;
  error: string;
}

export interface WalletProofSuccess<TValue> {
  ok: true;
  value: TValue;
}

interface WalletProofVerifyArgs<TRequired extends boolean> {
  walletAddressRaw: string;
  walletMessage: string;
  walletSignature: string;
  required: TRequired;
  invalidAddressMessage: string;
  missingMessageMessage: string;
  signatureRequiredMessage: string;
  missingNonceMessage: string;
  invalidSignatureMessage: string;
  invalidNonceMessage: string;
}

export function readAuthIdentityFields(body: unknown): AuthIdentityFields {
  return {
    email: typeof (body as { email?: unknown })?.email === 'string'
      ? (body as { email: string }).email.trim()
      : '',
    nickname: typeof (body as { nickname?: unknown })?.nickname === 'string'
      ? (body as { nickname: string }).nickname.trim()
      : '',
  };
}

export function readWalletProofFields(body: unknown): WalletProofFields {
  return {
    walletAddressRaw: typeof (body as { walletAddress?: unknown })?.walletAddress === 'string'
      ? (body as { walletAddress: string }).walletAddress.trim()
      : '',
    walletMessage: typeof (body as { walletMessage?: unknown })?.walletMessage === 'string'
      ? (body as { walletMessage: string }).walletMessage.trim()
      : typeof (body as { message?: unknown })?.message === 'string'
        ? (body as { message: string }).message.trim()
        : '',
    walletSignature: typeof (body as { walletSignature?: unknown })?.walletSignature === 'string'
      ? (body as { walletSignature: string }).walletSignature.trim()
      : typeof (body as { signature?: unknown })?.signature === 'string'
        ? (body as { signature: string }).signature.trim()
        : '',
  };
}

export const validateEmail = validateAuthEmail;
export const validateNickname = validateAuthNickname;

export function verifyWalletProof(
  args: WalletProofVerifyArgs<true>
): Promise<WalletProofSuccess<WalletProofVerifyRequiredResult> | WalletProofError>;
export function verifyWalletProof(
  args: WalletProofVerifyArgs<false>
): Promise<WalletProofSuccess<WalletProofVerifyOptionalResult> | WalletProofError>;
export async function verifyWalletProof(
  args: WalletProofVerifyArgs<boolean>
): Promise<
  | WalletProofSuccess<WalletProofVerifyRequiredResult>
  | WalletProofSuccess<WalletProofVerifyOptionalResult>
  | WalletProofError
> {
  const {
    walletAddressRaw,
    walletMessage,
    walletSignature,
    required,
    invalidAddressMessage,
    missingMessageMessage,
    signatureRequiredMessage,
    missingNonceMessage,
    invalidSignatureMessage,
    invalidNonceMessage,
  } = args;

  if (!walletAddressRaw) {
    return required
      ? { ok: false, status: 400, error: invalidAddressMessage }
      : { ok: true, value: { walletAddress: null, walletSignature: null } };
  }

  if (!isValidEthAddress(walletAddressRaw)) {
    return { ok: false, status: 400, error: invalidAddressMessage };
  }
  if (!walletMessage) {
    return { ok: false, status: 400, error: missingMessageMessage };
  }
  if (walletMessage.length > 2048) {
    return { ok: false, status: 400, error: 'Signed wallet message is too long' };
  }
  if (!EVM_WALLET_SIGNATURE_RE.test(walletSignature)) {
    return { ok: false, status: 400, error: signatureRequiredMessage };
  }

  const walletAddress = normalizeEthAddress(walletAddressRaw);
  const verification = await verifyAndConsumeEvmNonce({
    address: walletAddress,
    message: walletMessage,
    signature: walletSignature,
  });

  if (verification === 'missing_nonce') {
    return { ok: false, status: 400, error: missingNonceMessage };
  }
  if (verification === 'invalid_signature') {
    return { ok: false, status: 401, error: invalidSignatureMessage };
  }
  if (verification === 'invalid_nonce') {
    return { ok: false, status: 401, error: invalidNonceMessage };
  }

  return {
    ok: true,
    value: {
      walletAddress,
      walletSignature,
    },
  };
}

export async function issueAuthSessionCookie(args: {
  cookies: Cookies;
  userId: string;
  request: Request;
  ipAddress?: string | null;
}): Promise<{ createdAt: number; expiresAtIso: string }> {
  const sessionToken = crypto.randomUUID().toLowerCase();
  const createdAt = Date.now();
  const expiresAtIso = new Date(createdAt + SESSION_MAX_AGE_SEC * 1000).toISOString();

  await createAuthSession({
    token: sessionToken,
    userId: args.userId,
    expiresAtIso,
    userAgent: args.request.headers.get('user-agent'),
    ipAddress: args.ipAddress,
  });

  args.cookies.set(
    SESSION_COOKIE_NAME,
    buildSessionCookieValue(sessionToken, args.userId),
    SESSION_COOKIE_OPTIONS
  );

  return { createdAt, expiresAtIso };
}
