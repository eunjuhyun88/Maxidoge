// ═══════════════════════════════════════════════════════════════
// STOCKCLAW — Community API Client
// ═══════════════════════════════════════════════════════════════

import type {
  CommunityPost,
  CommunityPostReactionData,
  CommunityPostsListData,
  CommunityPostsListParams,
  CreateCommunityPostRequest,
  CreateCommunityPostData,
  ReactCommunityPostRequest,
  CommunitySignalAttachment,
} from '$lib/contracts/community';
import type { LegacySuccessEnvelope } from '$lib/contracts/http';

export type SignalAttachment = CommunitySignalAttachment;
export type ApiCommunityPost = CommunityPost;

interface ApiErrorPayload {
  error?: string;
}

interface LegacyCommunitySignalAttachmentPayload {
  pair?: unknown;
  dir?: unknown;
  entry?: unknown;
  tp?: unknown;
  sl?: unknown;
  conf?: unknown;
  timeframe?: unknown;
  reason?: unknown;
  evidence?: unknown;
}

interface LegacyCommunityPostPayload {
  id?: unknown;
  userId?: unknown;
  author?: unknown;
  avatar?: unknown;
  avatarColor?: unknown;
  body?: unknown;
  signal?: unknown;
  likes?: unknown;
  createdAt?: unknown;
  signalAttachment?: LegacyCommunitySignalAttachmentPayload | null;
  userReacted?: unknown;
  commentCount?: unknown;
  copyCount?: unknown;
  allowCopyTrade?: unknown;
}

function asFiniteNumber(value: unknown, fallback = 0): number {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function normalizeSignalAttachment(
  payload: LegacyCommunitySignalAttachmentPayload | null | undefined
): CommunitySignalAttachment | null {
  if (!payload || typeof payload !== 'object') return null;

  return {
    pair: typeof payload.pair === 'string' ? payload.pair : '',
    dir: payload.dir === 'SHORT' ? 'SHORT' : 'LONG',
    entry: asFiniteNumber(payload.entry),
    tp: asFiniteNumber(payload.tp),
    sl: asFiniteNumber(payload.sl),
    conf: asFiniteNumber(payload.conf, 50),
    timeframe: typeof payload.timeframe === 'string' ? payload.timeframe : undefined,
    reason: typeof payload.reason === 'string' ? payload.reason : undefined,
    evidence:
      payload.evidence && typeof payload.evidence === 'object'
        ? (payload.evidence as CommunitySignalAttachment['evidence'])
        : undefined,
  };
}

function normalizeCommunityPost(payload: LegacyCommunityPostPayload | null | undefined): CommunityPost | null {
  if (!payload || typeof payload !== 'object') return null;

  return {
    id: typeof payload.id === 'string' ? payload.id : '',
    userId: typeof payload.userId === 'string' ? payload.userId : null,
    author: typeof payload.author === 'string' ? payload.author : '',
    avatar: typeof payload.avatar === 'string' ? payload.avatar : '🐕',
    avatarColor: typeof payload.avatarColor === 'string' ? payload.avatarColor : '#E8967D',
    body: typeof payload.body === 'string' ? payload.body : '',
    signal: payload.signal === 'long' || payload.signal === 'short' ? payload.signal : null,
    likes: asFiniteNumber(payload.likes),
    createdAt: asFiniteNumber(payload.createdAt),
    signalAttachment: normalizeSignalAttachment(payload.signalAttachment),
    userReacted: payload.userReacted === true,
    commentCount: asFiniteNumber(payload.commentCount),
    copyCount: asFiniteNumber(payload.copyCount),
    allowCopyTrade: payload.allowCopyTrade === true,
  };
}

function canUseBrowserFetch(): boolean {
  return typeof window !== 'undefined' && typeof fetch === 'function';
}

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const payload = (await res.json()) as ApiErrorPayload;
      if (payload?.error) message = payload.error;
    } catch {
      // ignore parse error
    }
    throw new Error(message);
  }

  return (await res.json()) as T;
}

export async function fetchCommunityPostsApi(
  params?: CommunityPostsListParams
): Promise<ApiCommunityPost[] | null> {
  if (!canUseBrowserFetch()) return null;
  try {
    const search = new URLSearchParams();
    if (params?.limit != null) search.set('limit', String(params.limit));
    if (params?.offset != null) search.set('offset', String(params.offset));
    if (params?.signal) search.set('signal', params.signal);

    const query = search.toString();
    const url = query ? `/api/community/posts?${query}` : '/api/community/posts';
    const result = await requestJson<LegacySuccessEnvelope<'records', LegacyCommunityPostPayload[]> & CommunityPostsListData>(
      url,
      { method: 'GET' }
    );
    return Array.isArray(result.records)
      ? result.records.map(normalizeCommunityPost).filter((post): post is CommunityPost => Boolean(post))
      : [];
  } catch {
    return null;
  }
}

export async function createCommunityPostApi(
  payload: CreateCommunityPostRequest
): Promise<ApiCommunityPost | null> {
  if (!canUseBrowserFetch()) return null;
  try {
    const result = await requestJson<LegacySuccessEnvelope<'post', LegacyCommunityPostPayload> & CreateCommunityPostData>(
      '/api/community/posts',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    return normalizeCommunityPost(result.post);
  } catch {
    return null;
  }
}

export async function reactCommunityPostApi(
  postId: string,
  payload?: ReactCommunityPostRequest
): Promise<number | null> {
  if (!canUseBrowserFetch()) return null;
  try {
    const result = await requestJson<LegacySuccessEnvelope<'likes', number> & CommunityPostReactionData>(
      `/api/community/posts/${postId}/react`,
      {
        method: 'POST',
        body: JSON.stringify(payload || {}),
      }
    );
    return Number(result.likes ?? 0);
  } catch {
    return null;
  }
}

export async function unreactCommunityPostApi(
  postId: string,
  payload?: ReactCommunityPostRequest
): Promise<number | null> {
  if (!canUseBrowserFetch()) return null;
  try {
    const result = await requestJson<LegacySuccessEnvelope<'likes', number> & CommunityPostReactionData>(
      `/api/community/posts/${postId}/react`,
      {
        method: 'DELETE',
        body: JSON.stringify(payload || {}),
      }
    );
    return Number(result.likes ?? 0);
  } catch {
    return null;
  }
}
