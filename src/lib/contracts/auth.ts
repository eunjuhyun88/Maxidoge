export interface RegisterAuthRequest {
  email: string;
  nickname: string;
  walletAddress?: string;
  walletMessage?: string;
  walletSignature?: string;
}

export interface LoginAuthRequest {
  email: string;
  nickname: string;
  walletAddress: string;
  walletMessage: string;
  walletSignature: string;
}

export interface AuthUser {
  id: string;
  email: string;
  nickname: string;
  tier: 'guest' | 'registered' | 'connected' | 'verified' | string;
  phase: number;
  walletAddress?: string | null;
  wallet?: string | null;
}

export interface AuthSessionData {
  authenticated: boolean;
  user: AuthUser | null;
}

export interface RegisterAuthData {
  user: AuthUser;
  walletVerified: boolean;
  createdAtMs: number | null;
}

export interface LoginAuthData {
  user: AuthUser;
  loggedInAtMs: number | null;
}

export interface WalletNonceRequest {
  address: string;
  provider?: string;
  chain?: string;
}

export interface WalletNonceData {
  address: string;
  chain: string | null;
  nonce: string;
  message: string;
  expiresAtMs: number | null;
}

export interface VerifyWalletRequest {
  address: string;
  message: string;
  signature: string;
  provider?: string;
  chain?: string;
}

export interface VerifiedWallet {
  address: string;
  shortAddr: string;
  chain: string;
  provider: string;
  verified: boolean;
}

export interface VerifyWalletData {
  verified: boolean;
  linkedToUser: boolean;
  userId: string | null;
  wallet: VerifiedWallet | null;
}

export interface LogoutData {
  loggedOut: boolean;
}

export const EVM_WALLET_SIGNATURE_RE = /^0x[0-9a-f]{130}$/i;

export function validateAuthEmail(rawEmail: string): string | null {
  const email = rawEmail.trim();
  if (!email || !email.includes('@')) return 'Valid email required';
  if (email.length > 254) return 'Email is too long';
  return null;
}

export function validateAuthNickname(rawNickname: string, required = true): string | null {
  const nickname = rawNickname.trim();
  if (!nickname) return required ? 'Nickname must be 2+ characters' : null;
  if (nickname.length < 2) {
    return required
      ? 'Nickname must be 2+ characters'
      : 'Nickname must be 2+ characters if provided';
  }
  if (nickname.length > 32) return 'Nickname must be 32 characters or less';
  return null;
}

export function hasWalletAuthProof(walletMessage: string, walletSignature: string): boolean {
  return Boolean(walletMessage.trim() && EVM_WALLET_SIGNATURE_RE.test(walletSignature.trim()));
}
