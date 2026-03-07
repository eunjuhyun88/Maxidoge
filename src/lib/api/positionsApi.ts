// ═══════════════════════════════════════════════════════════════
// STOCKCLAW — Positions API Client (Frontend)
// ═══════════════════════════════════════════════════════════════
// All Polymarket + unified position API calls.
// Frontend → Our API → Backend (never calls Polymarket directly).

import type {
  PolymarketAuthData,
  PolymarketPosition,
  PolymarketPositionStatusData,
  PolymarketPositionsData,
  PolymarketPositionsParams,
  PreparePolymarketOrderData,
  PreparePolymarketOrderRequest,
  SubmitPolymarketAuthRequest,
  SubmitPolymarketOrderData,
  SubmitPolymarketOrderRequest,
  UnifiedPosition,
  UnifiedPositionsData,
  UnifiedPositionsParams,
} from '$lib/contracts/positions';

export type { UnifiedPosition, PolymarketPosition };
export type PrepareOrderResponse = PreparePolymarketOrderData;
export type SubmitOrderResponse = SubmitPolymarketOrderData;
export type PolyAuthResponse = PolymarketAuthData;

// ── Helpers ──────────────────────────────────────────────────

async function requestJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...init?.headers,
      },
      signal: init?.signal ?? AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      console.error(`[positionsApi] ${url}:`, err);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error(`[positionsApi] ${url}:`, err);
    return null;
  }
}

// ── Polymarket Auth ──────────────────────────────────────────

/**
 * Step 1: Get ClobAuth typed data for wallet signing.
 */
export async function getPolymarketAuthData(walletAddress: string): Promise<PolyAuthResponse | null> {
  return requestJson<PolyAuthResponse>(
    `/api/positions/polymarket/auth?walletAddress=${walletAddress}`,
  );
}

/**
 * Step 2: Submit wallet signature to derive L2 API credentials.
 */
export async function submitPolymarketAuth(params: {
  walletAddress: string;
  signature: string;
  timestamp: number;
  nonce?: number;
}): Promise<PolyAuthResponse | null> {
  const payload: SubmitPolymarketAuthRequest = params;
  return requestJson<PolyAuthResponse>('/api/positions/polymarket/auth', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ── Order Lifecycle ──────────────────────────────────────────

/**
 * Prepare a new Polymarket order (Step 1 of 2).
 * Returns EIP-712 typed data for wallet signing.
 */
export async function preparePolymarketOrder(
  params: PreparePolymarketOrderRequest
): Promise<PrepareOrderResponse | null> {
  return requestJson<PrepareOrderResponse>('/api/positions/polymarket/prepare', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * Submit a signed order to CLOB (Step 2 of 2).
 */
export async function submitPolymarketOrder(
  params: SubmitPolymarketOrderRequest
): Promise<SubmitOrderResponse | null> {
  return requestJson<SubmitOrderResponse>('/api/positions/polymarket/submit', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * Get position status (polls CLOB for updates).
 */
export async function getPolymarketPositionStatus(
  positionId: string,
): Promise<PolymarketPositionStatusData | null> {
  return requestJson<PolymarketPositionStatusData>(`/api/positions/polymarket/status/${positionId}`);
}

/**
 * Prepare a close (SELL) order for an existing position.
 */
export async function closePolymarketPosition(
  positionId: string,
): Promise<PrepareOrderResponse | null> {
  return requestJson<PrepareOrderResponse>(
    `/api/positions/polymarket/${positionId}/close`,
    { method: 'POST' },
  );
}

// ── Position Lists ───────────────────────────────────────────

/**
 * Fetch unified positions (QuickTrades + Polymarket).
 */
export async function fetchUnifiedPositions(
  params?: UnifiedPositionsParams
): Promise<UnifiedPositionsData | null> {
  const qs = new URLSearchParams();
  if (params?.type) qs.set('type', params.type);
  if (params?.limit) qs.set('limit', String(params.limit));
  return requestJson<UnifiedPositionsData>(`/api/positions/unified?${qs}`);
}

/**
 * Fetch Polymarket positions only.
 */
export async function fetchPolymarketPositions(
  params?: PolymarketPositionsParams
): Promise<PolymarketPositionsData | null> {
  const qs = new URLSearchParams();
  if (params?.settled !== undefined) qs.set('settled', String(params.settled));
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.offset) qs.set('offset', String(params.offset));
  return requestJson<PolymarketPositionsData>(`/api/positions/polymarket?${qs}`);
}
