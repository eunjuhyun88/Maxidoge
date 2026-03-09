// ═══════════════════════════════════════════════════════════════
// STOCKCLAW — Community Posts Store (localStorage persisted)
// ═══════════════════════════════════════════════════════════════

import { writable, derived, get } from 'svelte/store';
import { STORAGE_KEYS } from './storageKeys';
import { loadFromStorage, autoSave } from '$lib/utils/storage';
import {
  createCommunityPostApi,
  fetchCommunityPostsApi,
  reactCommunityPostApi,
  unreactCommunityPostApi,
  type ApiCommunityPost,
  type SignalAttachment
} from '$lib/api/communityApi';

export type { SignalAttachment } from '$lib/api/communityApi';

export interface CommunityPost {
  id: string;
  userId: string | null;
  author: string;
  avatar: string;
  avatarColor: string;
  text: string;
  signal: 'long' | 'short' | null;
  timestamp: number;
  likes: number;
  signalAttachment: SignalAttachment | null;
  userReacted: boolean;
  commentCount: number;
  copyCount: number;
  allowCopyTrade: boolean;
}

interface CommunityState {
  posts: CommunityPost[];
  hydrated: boolean;
}

const loaded = loadFromStorage<{ posts: CommunityPost[] }>(STORAGE_KEYS.community, { posts: [] });
export const communityStore = writable<CommunityState>({ ...loaded, hydrated: false });
let _communityHydratePromise: Promise<void> | null = null;

autoSave(communityStore, STORAGE_KEYS.community, (s) => ({ posts: s.posts }));

export const communityPosts = derived(communityStore, $s => $s.posts);

function mapApiPost(post: ApiCommunityPost): CommunityPost {
  return {
    id: post.id,
    userId: post.userId ?? null,
    author: post.author,
    avatar: post.avatar || '🐕',
    avatarColor: post.avatarColor || '#E8967D',
    text: post.body,
    signal: post.signal,
    timestamp: Number(post.createdAt ?? Date.now()),
    likes: Number(post.likes ?? 0),
    signalAttachment: post.signalAttachment ?? null,
    userReacted: Boolean(post.userReacted),
    commentCount: Number(post.commentCount ?? 0),
    copyCount: Number(post.copyCount ?? 0),
    allowCopyTrade: Boolean(post.allowCopyTrade),
  };
}

export async function hydrateCommunityPosts(force = false) {
  if (typeof window === 'undefined') return;
  if (_communityHydratePromise) return _communityHydratePromise;

  const state = get(communityStore);
  if (state.hydrated && !force) return;

  _communityHydratePromise = (async () => {
    const records = await fetchCommunityPostsApi({ limit: 100, offset: 0 });
    if (!records) return;

    communityStore.update((s) => ({
      ...s,
      posts: records.map(mapApiPost),
      hydrated: true
    }));
  })();

  try {
    await _communityHydratePromise;
  } finally {
    _communityHydratePromise = null;
  }
}

/** Toggle like reaction (optimistic + API sync) */
export async function toggleReaction(postId: string) {
  if (postId.startsWith('tmp-')) return;

  const state = get(communityStore);
  const post = state.posts.find(p => p.id === postId);
  if (!post) return;

  if (post.userReacted) {
    // Optimistic unreact
    communityStore.update(s => ({
      ...s,
      posts: s.posts.map(p => p.id === postId
        ? { ...p, likes: Math.max(0, p.likes - 1), userReacted: false }
        : p)
    }));
    const likes = await unreactCommunityPostApi(postId, { emoji: '👍' });
    if (likes != null) {
      communityStore.update(s => ({
        ...s,
        posts: s.posts.map(p => p.id === postId ? { ...p, likes } : p)
      }));
    }
  } else {
    // Optimistic react
    communityStore.update(s => ({
      ...s,
      posts: s.posts.map(p => p.id === postId
        ? { ...p, likes: p.likes + 1, userReacted: true }
        : p)
    }));
    const likes = await reactCommunityPostApi(postId, { emoji: '👍' });
    if (likes != null) {
      communityStore.update(s => ({
        ...s,
        posts: s.posts.map(p => p.id === postId ? { ...p, likes } : p)
      }));
    }
  }
}

/** Legacy alias for backward compatibility */
export async function likeCommunityPost(postId: string) {
  return toggleReaction(postId);
}

/** Add a community post with optional signal attachment */
export async function addCommunityPost(
  text: string,
  signal: 'long' | 'short' | null,
  signalAttachment?: SignalAttachment | null,
  allowCopyTrade = false,
) {
  const tempId = `tmp-${crypto.randomUUID()}`;
  const post: CommunityPost = {
    id: tempId,
    userId: null,
    author: 'You',
    avatar: '🐕',
    avatarColor: '#E8967D',
    text: text.trim(),
    signal,
    timestamp: Date.now(),
    likes: 0,
    signalAttachment: signalAttachment ?? null,
    userReacted: false,
    commentCount: 0,
    copyCount: 0,
    allowCopyTrade,
  };
  communityStore.update(s => ({
    ...s,
    posts: [post, ...s.posts].slice(0, 100)
  }));

  const created = await createCommunityPostApi({
    body: post.text,
    signal,
    signalAttachment: signalAttachment ?? undefined,
    allowCopyTrade,
  });
  if (!created) return;

  const mapped = mapApiPost(created);
  communityStore.update((s) => ({
    ...s,
    posts: s.posts.map((p) => p.id === tempId ? mapped : p)
  }));
}
