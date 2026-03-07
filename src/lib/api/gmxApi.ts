// ═══════════════════════════════════════════════════════════════
// STOCKCLAW — GMX V2 Frontend API Client
// ═══════════════════════════════════════════════════════════════
// All GMX interactions go through our API (Frontend → API → Backend).
// The only exception is wallet transactions (eth_sendTransaction).

import type {
  GmxBalanceInfo,
  GmxCloseResponse,
  GmxMarket,
  GmxPosition,
  GmxPositionsData,
  GmxPrepareOrderRequest,
  GmxPrepareResponse,
} from '$lib/contracts/positions';

export type {
  GmxBalanceInfo,
  GmxCloseResponse,
  GmxMarket,
  GmxPosition,
  GmxPrepareResponse,
} from '$lib/contracts/positions';

// ── Helpers ─────────────────────────────────────────────────

const TIMEOUT = 15_000;

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T | null> {
  if (typeof window === 'undefined') return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);

    const res = await fetch(url, {
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      ...init,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err instanceof Error ? err.message : 'Unknown error');
    }

    return (await res.json()) as T;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') throw new Error('Request timed out');
    throw err;
  }
}

// ── API Functions ───────────────────────────────────────────

/** Fetch available GMX markets */
export async function fetchGmxMarkets(): Promise<GmxMarket[]> {
  const result = await apiFetch<{ ok: boolean; markets: GmxMarket[] }>('/api/gmx/markets');
  return result?.markets ?? [];
}

/** Fetch USDC balance, ETH balance, and approval status */
export async function fetchGmxBalance(address: string): Promise<GmxBalanceInfo | null> {
  return apiFetch<GmxBalanceInfo>(`/api/gmx/balance?address=${encodeURIComponent(address)}`);
}

/** Prepare GMX order — returns calldata for wallet to send */
export async function prepareGmxOrder(
  params: GmxPrepareOrderRequest,
): Promise<GmxPrepareResponse | null> {
  return apiFetch<GmxPrepareResponse>('/api/gmx/prepare', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/** Confirm tx hash after user sends transaction */
export async function confirmGmxOrder(positionId: string, txHash: string): Promise<boolean> {
  const result = await apiFetch<{ ok: boolean }>('/api/gmx/confirm', {
    method: 'POST',
    body: JSON.stringify({ positionId, txHash }),
  });
  return result?.ok ?? false;
}

/** Fetch user's GMX positions */
export async function fetchGmxPositions(status = 'open'): Promise<GmxPosition[]> {
  const result = await apiFetch<GmxPositionsData>(
    `/api/gmx/positions?status=${status}`
  );
  return result?.positions ?? [];
}

/** Prepare close position calldata */
export async function closeGmxPosition(
  positionId: string,
  sizePercent = 100,
): Promise<GmxCloseResponse | null> {
  return apiFetch<GmxCloseResponse>('/api/gmx/close', {
    method: 'POST',
    body: JSON.stringify({ positionId, sizePercent }),
  });
}
