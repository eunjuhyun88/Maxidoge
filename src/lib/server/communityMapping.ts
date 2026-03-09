// ═══════════════════════════════════════════════════════════════
// STOCKCLAW — Shared Community Post Row Mapping
// Extracted from /api/community/posts to share with detail endpoint
// ═══════════════════════════════════════════════════════════════

export interface PostRow {
  id: string;
  user_id: string | null;
  author: string;
  avatar: string;
  avatar_color: string;
  body: string;
  signal: 'long' | 'short' | null;
  likes: number;
  created_at: string;
  signal_attachment: Record<string, unknown> | null;
  comment_count: number;
  copy_count: number;
  allow_copy_trade: boolean;
  user_reacted: boolean;
}

export function mapPostRow(row: PostRow) {
  const att = row.signal_attachment;
  return {
    id: row.id,
    userId: row.user_id,
    author: row.author,
    avatar: row.avatar,
    avatarColor: row.avatar_color,
    body: row.body,
    signal: row.signal,
    likes: Number(row.likes ?? 0),
    createdAt: new Date(row.created_at).getTime(),
    signalAttachment: att ? {
      pair: String(att.pair ?? ''),
      dir: String(att.dir ?? 'LONG') as 'LONG' | 'SHORT',
      entry: Number(att.entry ?? 0),
      tp: Number(att.tp ?? 0),
      sl: Number(att.sl ?? 0),
      conf: Number(att.conf ?? 50),
      timeframe: att.timeframe ? String(att.timeframe) : undefined,
      reason: att.reason ? String(att.reason) : undefined,
      evidence: att.evidence && typeof att.evidence === 'object'
        ? (att.evidence as Record<string, unknown>)
        : undefined,
    } : null,
    userReacted: Boolean(row.user_reacted),
    commentCount: Number(row.comment_count ?? 0),
    copyCount: Number(row.copy_count ?? 0),
    allowCopyTrade: Boolean(row.allow_copy_trade),
  };
}

export interface CommentRow {
  id: string;
  post_id: string;
  user_id: string;
  author: string;
  avatar: string;
  avatar_color: string;
  tier: string;
  body: string;
  created_at: string;
}

export function mapCommentRow(row: CommentRow, currentUserId: string | null) {
  return {
    id: row.id,
    postId: row.post_id,
    userId: row.user_id,
    author: row.author,
    avatar: row.avatar,
    avatarColor: row.avatar_color,
    tier: row.tier,
    body: row.body,
    createdAt: new Date(row.created_at).getTime(),
    isOwn: currentUserId ? row.user_id === currentUserId : false,
  };
}

/** Standard SELECT columns for community_posts queries */
export const POST_SELECT_COLUMNS = `
  p.id, p.user_id, p.author, p.avatar, p.avatar_color, p.body,
  p.signal, p.likes, p.created_at,
  p.signal_attachment, p.comment_count, p.copy_count, p.allow_copy_trade
`;
