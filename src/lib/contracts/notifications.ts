import type { PaginationMeta } from './http';

export const NOTIFICATION_TYPES = ['alert', 'critical', 'info', 'success'] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface NotificationRecord {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  dismissable: boolean;
  createdAt: number;
  readAt: number | null;
}

export interface NotificationListQuery {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}

export interface NotificationListData {
  total: number;
  records: NotificationRecord[];
  pagination: PaginationMeta;
}

export interface CreateNotificationRequest {
  type: NotificationType;
  title: string;
  body: string;
  dismissable?: boolean;
}

export interface MarkNotificationsReadData {
  updated: number;
}

export interface DeleteNotificationData {
  deleted: boolean;
}
