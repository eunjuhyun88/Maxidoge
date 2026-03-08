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
