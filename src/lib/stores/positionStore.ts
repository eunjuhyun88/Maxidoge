// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — Unified Position Store
// ═══════════════════════════════════════════════════════════════
// Aggregates QuickTrades + Polymarket + GMX positions for the POSITION tab.
// Hydrates from /api/positions/unified, provides derived stores.

import { writable, derived, get } from 'svelte/store';
import {
  fetchUnifiedPositions,
  getPolymarketPositionStatus,
  type UnifiedPosition,
} from '$lib/api/positionsApi';

// ── Store ────────────────────────────────────────────────────

export const unifiedPositions = writable<UnifiedPosition[]>([]);
export const positionsLoading = writable(false);
export const positionsError = writable<string | null>(null);

// ── Derived ──────────────────────────────────────────────────

/** All open positions (both types) */
export const openPositions = derived(unifiedPositions, ($p) =>
  $p.filter((p) => !['closed', 'stopped', 'cancelled', 'failed'].includes(p.status)),
);

/** Quick trade positions only */
export const quickTradePositions = derived(unifiedPositions, ($p) =>
  $p.filter((p) => p.type === 'quick_trade'),
);

/** Polymarket positions only */
export const polymarketPositions = derived(unifiedPositions, ($p) =>
  $p.filter((p) => p.type === 'polymarket'),
);

/** GMX on-chain positions only */
export const gmxPositions = derived(unifiedPositions, ($p) =>
  $p.filter((p) => p.type === 'gmx'),
);

/** Positions with pending status (needs polling) */
export const pendingPositions = derived(unifiedPositions, ($p) =>
  $p.filter(
    (p) =>
      (p.type === 'polymarket' &&
        ['pending_signature', 'submitted', 'partially_filled'].includes(p.status)) ||
      (p.type === 'gmx' &&
        ['pending_tx', 'tx_sent', 'order_created'].includes(p.status)),
  ),
);

/** Total unrealized P&L across all positions */
export const totalPnlPercent = derived(unifiedPositions, ($p) => {
  const open = $p.filter((p) => !['closed', 'stopped', 'cancelled', 'failed'].includes(p.status));
  if (open.length === 0) return 0;
  const sum = open.reduce((acc, p) => acc + p.pnlPercent, 0);
  return Math.round((sum / open.length) * 100) / 100;
});

/** Total USDC P&L (Polymarket + GMX — real money) */
export const totalPnlUsdc = derived(unifiedPositions, ($p) =>
  $p
    .filter((p) => (p.type === 'polymarket' || p.type === 'gmx') && p.pnlUsdc != null)
    .reduce((acc, p) => acc + (p.pnlUsdc ?? 0), 0),
);

/** Position count by type */
export const positionCounts = derived(unifiedPositions, ($p) => ({
  total: $p.length,
  quickTrade: $p.filter((p) => p.type === 'quick_trade').length,
  polymarket: $p.filter((p) => p.type === 'polymarket').length,
  gmx: $p.filter((p) => p.type === 'gmx').length,
}));

// ── Actions ──────────────────────────────────────────────────

/**
 * Hydrate positions from the server API.
 */
export async function hydratePositions(type?: 'all' | 'quick_trade' | 'polymarket' | 'gmx'): Promise<void> {
  positionsLoading.set(true);
  positionsError.set(null);

  try {
    const result = await fetchUnifiedPositions({ type, limit: 100 });
    if (result?.ok) {
      unifiedPositions.set(result.positions);
    } else {
      positionsError.set('Failed to load positions');
    }
  } catch (err) {
    positionsError.set((err as Error).message);
  } finally {
    positionsLoading.set(false);
  }
}

/**
 * Add a new position to the store (optimistic update).
 */
export function addPosition(position: UnifiedPosition): void {
  unifiedPositions.update(($p) => [position, ...$p]);
}

/**
 * Update a position in the store by ID.
 */
export function updatePosition(id: string, updates: Partial<UnifiedPosition>): void {
  unifiedPositions.update(($p) =>
    $p.map((p) => (p.id === id ? { ...p, ...updates } : p)),
  );
}

/**
 * Remove a position from the store.
 */
export function removePosition(id: string): void {
  unifiedPositions.update(($p) => $p.filter((p) => p.id !== id));
}

/**
 * Poll status for all pending Polymarket positions.
 * Called periodically from the UI.
 */
export async function pollPendingPositions(): Promise<void> {
  const pending = get(pendingPositions);
  if (pending.length === 0) return;

  for (const pos of pending) {
    try {
      const result = await getPolymarketPositionStatus(pos.id);
      if (result?.ok && result.position) {
        const p = result.position;
        updatePosition(pos.id, {
          status: p.orderStatus,
          currentPrice: p.currentPrice ?? pos.currentPrice,
          pnlUsdc: p.pnlUsdc ?? pos.pnlUsdc,
          pnlPercent:
            p.currentPrice && pos.entryPrice > 0
              ? ((p.currentPrice - pos.entryPrice) / pos.entryPrice) * 100
              : pos.pnlPercent,
        });
      }
    } catch {
      // Silent fail on individual poll
    }
  }
}
