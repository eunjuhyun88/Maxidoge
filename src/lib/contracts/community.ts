import type { SignalEvidence } from '$lib/terminal/signalEvidence';

export type CommunitySignal = 'long' | 'short';

export interface CommunitySignalAttachment {
  pair: string;
  dir: 'LONG' | 'SHORT';
  entry: number;
  tp: number;
  sl: number;
  conf: number;
  timeframe?: string;
  reason?: string;
  evidence?: SignalEvidence;
}

export interface CommunityPost {
  id: string;
  userId: string | null;
  author: string;
  avatar: string;
  avatarColor: string;
  body: string;
  signal: CommunitySignal | null;
  likes: number;
  createdAt: number;
  signalAttachment: CommunitySignalAttachment | null;
  userReacted: boolean;
  commentCount: number;
  copyCount: number;
  allowCopyTrade: boolean;
}

export interface CommunityPostsListParams {
  limit?: number;
  offset?: number;
  signal?: CommunitySignal | null;
}

export interface CommunityPostsListData {
  total: number;
  records: CommunityPost[];
  pagination?: {
    limit: number;
    offset: number;
  };
}

export interface CreateCommunityPostRequest {
  body: string;
  signal?: CommunitySignal | null;
  author?: string;
  avatar?: string;
  avatarColor?: string;
  signalAttachment?: CommunitySignalAttachment | null;
  allowCopyTrade?: boolean;
}

export interface CreateCommunityPostData {
  post: CommunityPost;
}

export interface ReactCommunityPostRequest {
  emoji?: string;
}

export interface CommunityPostReactionData {
  likes: number;
  inserted?: boolean;
  removed?: number;
}
