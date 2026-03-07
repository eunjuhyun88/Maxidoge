import type { TrackedSignal, TrackedSignalStatus, TradeDirection } from '$lib/contracts/trading';

export interface TrackedSignalRow {
  id: string;
  user_id?: string | null;
  pair: string;
  dir: TradeDirection;
  confidence: number | string;
  entry_price: number | string;
  current_price: number | string;
  pnl_percent?: number | string | null;
  status: TrackedSignalStatus;
  source: string | null;
  note: string | null;
  tracked_at?: string | Date;
  expires_at?: string | Date;
}

export function mapTrackedSignalRow(
  row: TrackedSignalRow,
  options: { defaultSource?: string } = {},
): TrackedSignal {
  return {
    id: row.id,
    userId: row.user_id ?? null,
    pair: row.pair,
    dir: row.dir,
    confidence: Number(row.confidence ?? 0),
    entryPrice: Number(row.entry_price),
    currentPrice: Number(row.current_price),
    pnlPercent: Number(row.pnl_percent ?? 0),
    status: row.status,
    source: row.source || options.defaultSource || 'manual',
    note: row.note || '',
    trackedAt: row.tracked_at ? new Date(row.tracked_at).getTime() : 0,
    expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : 0,
  };
}
