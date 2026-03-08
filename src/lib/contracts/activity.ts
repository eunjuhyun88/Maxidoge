import type { PaginationMeta } from './http';

export type ActivitySeverity = 'info' | 'warning' | 'critical';

export const ACTIVITY_SOURCE_PAGES = [
  'arena',
  'terminal',
  'signals',
  'live',
  'oracle',
  'passport',
  'settings',
  'wallet',
  'system',
] as const;

export type ActivitySourcePage = (typeof ACTIVITY_SOURCE_PAGES)[number];

export interface ActivityRecord {
  id: string;
  userId: string;
  eventType: string;
  sourcePage: string;
  sourceId: string | null;
  severity: ActivitySeverity;
  payload: Record<string, unknown>;
  createdAt: number;
}

export interface ActivityFeedQuery {
  limit?: number;
  offset?: number;
  eventType?: string;
  sourcePage?: ActivitySourcePage;
}

export interface ActivityFeedData {
  total: number;
  records: ActivityRecord[];
  pagination: PaginationMeta;
}

export interface CreateActivityReactionRequest {
  emoji: string;
  sourcePage?: ActivitySourcePage;
  sourceId?: string | null;
  payload?: Record<string, unknown>;
}

export interface CreateActivityReactionData {
  reaction: ActivityRecord;
}
