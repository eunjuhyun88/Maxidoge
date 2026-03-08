import { hasWalletAuthProof, validateAuthEmail, validateAuthNickname } from '$lib/contracts/auth';
import type { WalletModalStep } from '$lib/stores/walletModalStore';

export type AuthMode = 'signup' | 'login';

type WalletFormParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function resolveWalletAuthStartStep(args: {
  mode: AuthMode;
  walletConnected: boolean;
  walletAddress: string | null;
  walletMessage: string;
  walletSignature: string;
}): WalletModalStep {
  if (!args.walletConnected || !args.walletAddress) {
    return 'wallet-select';
  }

  return hasWalletAuthProof(args.walletMessage, args.walletSignature)
    ? args.mode
    : 'sign-message';
}

export function parseWalletSignupForm(args: {
  emailInput: string;
  nicknameInput: string;
}): WalletFormParseResult<{ email: string; nickname: string }> {
  const email = args.emailInput.trim();
  const emailError = validateAuthEmail(email);
  if (emailError) {
    return { ok: false, error: emailError };
  }

  const nickname = args.nicknameInput.trim();
  const nicknameError = validateAuthNickname(nickname, true);
  if (nicknameError) {
    return { ok: false, error: nicknameError };
  }

  return {
    ok: true,
    value: {
      email,
      nickname,
    },
  };
}

export function parseWalletLoginForm(args: {
  emailInput: string;
  nicknameInput: string;
}): WalletFormParseResult<{ email: string; nickname?: string }> {
  const email = args.emailInput.trim();
  const emailError = validateAuthEmail(email);
  if (emailError) {
    return { ok: false, error: emailError };
  }

  const nickname = args.nicknameInput.trim();
  const nicknameError = validateAuthNickname(nickname, false);
  if (nicknameError) {
    return { ok: false, error: nicknameError };
  }

  return {
    ok: true,
    value: nickname ? { email, nickname } : { email },
  };
}

export function getWalletFunnelErrorReason(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (!message) return 'unknown';
  if (message.includes('reject') || message.includes('denied')) return 'user_rejected';
  if (message.includes('timeout')) return 'timeout';
  if (message.includes('network')) return 'network';
  if (message.includes('wallet')) return 'wallet';
  if (message.includes('signature') || message.includes('sign')) return 'signature';
  if (message.includes('email') || message.includes('nickname')) return 'form_validation';
  return 'unexpected';
}
