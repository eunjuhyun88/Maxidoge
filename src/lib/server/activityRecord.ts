import type { ActivityRecord } from '$lib/contracts/activity';

export interface ActivityRow {
  id: string;
  user_id: string;
  event_type: string;
  source_page: string;
  source_id: string | null;
  severity: ActivityRecord['severity'];
  payload: Record<string, unknown> | null;
  created_at: string | Date;
}

export function mapActivityRow(row: ActivityRow): ActivityRecord {
  return {
    id: row.id,
    userId: row.user_id,
    eventType: row.event_type,
    sourcePage: row.source_page,
    sourceId: row.source_id,
    severity: row.severity,
    payload: row.payload ?? {},
    createdAt: new Date(row.created_at).getTime(),
  };
}
