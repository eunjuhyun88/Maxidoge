// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — Community Posts Store (localStorage persisted)
// ═══════════════════════════════════════════════════════════════

import { writable, derived } from 'svelte/store';
import { STORAGE_KEYS } from './storageKeys';
import {
  createCommunityPostApi,
  fetchCommunityPostsApi,
  reactCommunityPostApi,
  type ApiCommunityPost
} from '$lib/api/communityApi';

export interface CommunityPost {
  id: string;
  author: string;
  avatar: string;
  avatarColor: string;
  text: string;
  signal: 'long' | 'short' | null;
  timestamp: number;
  likes: number;
}

interface CommunityState {
  posts: CommunityPost[];
  hydrated: boolean;
}

const STORAGE_KEY = STORAGE_KEYS.community;

function loadPosts(): CommunityState {
  if (typeof window === 'undefined') return { posts: [], hydrated: false };
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...JSON.parse(saved), hydrated: false };
  } catch {}
  return { posts: [], hydrated: false };
}

export const communityStore = writable<CommunityState>(loadPosts());

// Persist to localStorage (debounced)
let _commSaveTimer: ReturnType<typeof setTimeout> | null = null;
communityStore.subscribe(s => {
  if (typeof window === 'undefined') return;
  if (_commSaveTimer) clearTimeout(_commSaveTimer);
  _commSaveTimer = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ posts: s.posts }));
  }, 300);
});

export const communityPosts = derived(communityStore, $s => $s.posts);

function mapApiPost(post: ApiCommunityPost): CommunityPost {
  return {
    id: post.id,
    author: post.author,
    avatar: post.avatar || '🐕',
    avatarColor: post.avatarColor || '#ffe600',
    text: post.body,
    signal: post.signal,
    timestamp: Number(post.createdAt ?? Date.now()),
    likes: Number(post.likes ?? 0)
  };
}

export async function hydrateCommunityPosts(force = false) {
  if (typeof window === 'undefined') return;

  let shouldLoad = force;
  communityStore.update((s) => {
    shouldLoad = shouldLoad || !s.hydrated;
    return s;
  });
  if (!shouldLoad) return;

  const records = await fetchCommunityPostsApi({ limit: 100, offset: 0 });
  if (!records) return;

  communityStore.update((s) => ({
    ...s,
    posts: records.map(mapApiPost),
    hydrated: true
  }));
}

export async function addCommunityPost(text: string, signal: 'long' | 'short' | null) {
  const tempId = `tmp-${crypto.randomUUID()}`;
  const post: CommunityPost = {
    id: tempId,
    author: 'You',
    avatar: '🐕',
    avatarColor: '#ffe600',
    text: text.trim(),
    signal,
    timestamp: Date.now(),
    likes: 0
  };
  communityStore.update(s => ({
    ...s,
    posts: [post, ...s.posts].slice(0, 100)
  }));

  const created = await createCommunityPostApi({
    body: post.text,
    signal
  });
  if (!created) return;

  const mapped = mapApiPost(created);
  communityStore.update((s) => ({
    ...s,
    posts: s.posts.map((p) => p.id === tempId ? mapped : p)
  }));
}

export async function likeCommunityPost(postId: string) {
  communityStore.update(s => ({
    ...s,
    posts: s.posts.map(p => p.id === postId ? { ...p, likes: p.likes + 1 } : p)
  }));

  if (postId.startsWith('tmp-')) return;
  const likes = await reactCommunityPostApi(postId, { emoji: '👍' });
  if (likes == null) return;

  communityStore.update((s) => ({
    ...s,
    posts: s.posts.map((p) => p.id === postId ? { ...p, likes } : p)
  }));
}
