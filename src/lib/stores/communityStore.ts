// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — Community Posts Store (localStorage persisted)
// ═══════════════════════════════════════════════════════════════

import { writable, derived } from 'svelte/store';

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
}

const STORAGE_KEY = 'maxidoge_community';

function loadPosts(): CommunityState {
  if (typeof window === 'undefined') return { posts: [] };
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return { posts: [] };
}

export const communityStore = writable<CommunityState>(loadPosts());

// Persist to localStorage (debounced)
let _commSaveTimer: ReturnType<typeof setTimeout> | null = null;
communityStore.subscribe(s => {
  if (typeof window === 'undefined') return;
  if (_commSaveTimer) clearTimeout(_commSaveTimer);
  _commSaveTimer = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  }, 300);
});

export const communityPosts = derived(communityStore, $s => $s.posts);

export function addCommunityPost(text: string, signal: 'long' | 'short' | null) {
  const post: CommunityPost = {
    id: crypto.randomUUID(),
    author: 'You',
    avatar: '🐕',
    avatarColor: '#ffe600',
    text: text.trim(),
    signal,
    timestamp: Date.now(),
    likes: 0
  };
  communityStore.update(s => ({
    posts: [post, ...s.posts].slice(0, 100)
  }));
}

export function likeCommunityPost(postId: string) {
  communityStore.update(s => ({
    posts: s.posts.map(p => p.id === postId ? { ...p, likes: p.likes + 1 } : p)
  }));
}
