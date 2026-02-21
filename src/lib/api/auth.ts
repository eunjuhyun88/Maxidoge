export interface RegisterAuthPayload {
  email: string;
  nickname: string;
  walletAddress?: string;
  walletSignature?: string;
}

export interface WalletNoncePayload {
  address: string;
  provider?: string;
}

export interface VerifyWalletPayload {
  address: string;
  message: string;
  signature: string;
  provider?: string;
}

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
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(await parseApiError(res));
  }

  return (await res.json()) as TResponse;
}

export function registerAuth(payload: RegisterAuthPayload) {
  return postJson<{ success: boolean; user: { id: string } }>('/api/auth/register', payload);
}

export function requestWalletNonce(payload: WalletNoncePayload) {
  return postJson<{
    success: boolean;
    address: string;
    nonce: string;
    message: string;
    expiresAt: string;
  }>('/api/auth/nonce', payload);
}

export function verifyWalletSignature(payload: VerifyWalletPayload) {
  return postJson<{
    success: boolean;
    verified: boolean;
    linkedToUser: boolean;
    wallet: {
      address: string;
      shortAddr: string;
      chain: string;
      provider: string;
      verified: boolean;
    };
  }>('/api/auth/verify-wallet', payload);
}

export function logoutAuth() {
  return postJson<{ success: boolean }>('/api/auth/logout', {});
}
