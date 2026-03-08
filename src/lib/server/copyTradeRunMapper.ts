import type { CopyTradeRun } from '$lib/contracts/trading';

export interface CopyTradeRunRow {
  id: string;
  user_id: string;
  selected_signal_ids: string[] | null;
  draft: Record<string, unknown> | null;
  published: boolean;
  published_trade_id: string | null;
  published_signal_id: string | null;
  created_at: string | Date;
  published_at: string | Date | null;
}

export function mapCopyTradeRunRow(row: CopyTradeRunRow): CopyTradeRun {
  return {
    id: row.id,
    userId: row.user_id,
    selectedSignalIds: row.selected_signal_ids ?? [],
    draft: row.draft ?? {},
    published: Boolean(row.published),
    publishedTradeId: row.published_trade_id,
    publishedSignalId: row.published_signal_id,
    createdAt: new Date(row.created_at).getTime(),
    publishedAt: row.published_at ? new Date(row.published_at).getTime() : null,
  };
}
