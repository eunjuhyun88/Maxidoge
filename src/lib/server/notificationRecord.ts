import type { NotificationRecord } from '$lib/contracts/notifications';

export interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationRecord['type'];
  title: string;
  body: string;
  is_read: boolean | null;
  dismissable: boolean | null;
  created_at: string | Date;
  read_at: string | Date | null;
}

export function mapNotificationRow(row: NotificationRow): NotificationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    isRead: Boolean(row.is_read),
    dismissable: Boolean(row.dismissable),
    createdAt: new Date(row.created_at).getTime(),
    readAt: row.read_at ? new Date(row.read_at).getTime() : null,
  };
}
