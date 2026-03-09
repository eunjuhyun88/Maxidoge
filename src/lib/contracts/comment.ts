// ═══════════════════════════════════════════════════════════════
// STOCKCLAW — Community Comment Contracts
// ═══════════════════════════════════════════════════════════════

export interface CommunityComment {
  id: string;
  postId: string;
  userId: string;
  author: string;
  avatar: string;
  avatarColor: string;
  tier: string;
  body: string;
  createdAt: number;
  isOwn: boolean;
}

export interface CommunityCommentListData {
  comments: CommunityComment[];
  total: number;
}

export interface CreateCommentRequest {
  body: string;
}

export interface CreateCommentData {
  comment: CommunityComment;
  commentCount: number;
}

export interface DeleteCommentData {
  deleted: boolean;
  commentCount: number;
}
