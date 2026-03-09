<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import {
    fetchCommentsApi,
    createCommentApi,
    deleteCommentApi,
  } from '$lib/api/communityApi';
  import type { CommunityComment } from '$lib/contracts/comment';

  interface Props {
    postId: string;
    initialCount?: number;
    onCountChange?: (count: number) => void;
  }

  let { postId, initialCount = 0, onCountChange }: Props = $props();

  let comments: CommunityComment[] = $state([]);
  let total = $state(0);
  let loading = $state(true);
  let posting = $state(false);
  let newBody = $state('');
  let deleting = $state<string | null>(null);

  const charCount = $derived(newBody.trim().length);
  const canPost = $derived(charCount >= 1 && charCount <= 1000 && !posting);

  async function loadComments() {
    loading = true;
    try {
      const result = await fetchCommentsApi(postId, { limit: 100 });
      if (result) {
        comments = result.comments;
        total = result.total;
      }
    } finally {
      loading = false;
    }
  }

  async function handlePost() {
    if (!canPost) return;
    posting = true;
    try {
      const result = await createCommentApi(postId, newBody.trim());
      if (result) {
        comments = [...comments, result.comment];
        total = result.commentCount;
        newBody = '';
        onCountChange?.(result.commentCount);
      }
    } finally {
      posting = false;
    }
  }

  async function handleDelete(commentId: string) {
    deleting = commentId;
    try {
      const result = await deleteCommentApi(postId, commentId);
      if (result) {
        comments = comments.filter(c => c.id !== commentId);
        total = result.commentCount;
        onCountChange?.(result.commentCount);
      }
    } finally {
      deleting = null;
    }
  }

  function timeSince(ts: number): string {
    const diff = Math.max(0, Date.now() - ts);
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return `${sec}초 전`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}분 전`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}시간 전`;
    const day = Math.floor(hr / 24);
    return `${day}일 전`;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      handlePost();
    }
  }

  onMount(() => {
    total = initialCount;
    loadComments();
  });
</script>

<section class="comment-section">
  <h3 class="section-title">💬 댓글 <span class="count">{total}</span></h3>

  <!-- ═══ COMMENT INPUT ═══ -->
  <div class="input-area">
    <textarea
      class="input-box"
      placeholder="댓글을 입력하세요... (Cmd/Ctrl+Enter로 전송)"
      bind:value={newBody}
      rows="3"
      maxlength="1000"
      onkeydown={handleKeydown}
      disabled={posting}
    ></textarea>
    <div class="input-footer">
      <span class="char-count" class:warn={charCount > 900} class:over={charCount > 1000}>
        {charCount}/1000
      </span>
      <button
        class="post-btn"
        onclick={handlePost}
        disabled={!canPost}
      >
        {#if posting}
          전송 중...
        {:else}
          전송
        {/if}
      </button>
    </div>
  </div>

  <!-- ═══ COMMENTS LIST ═══ -->
  {#if loading}
    <div class="loading">
      <span class="spinner"></span>
      <span class="loading-text">댓글 불러오는 중...</span>
    </div>
  {:else if comments.length === 0}
    <div class="empty">
      <span class="empty-icon">💭</span>
      <span class="empty-text">아직 댓글이 없습니다. 첫 댓글을 남겨보세요!</span>
    </div>
  {:else}
    <div class="comment-list">
      {#each comments as comment (comment.id)}
        <div class="comment" class:own={comment.isOwn}>
          <button
            class="c-avatar"
            style="background:{comment.avatarColor}15;color:{comment.avatarColor};border-color:{comment.avatarColor}30"
            onclick={() => goto(`/creator/${comment.userId}`)}
          >
            {comment.avatar}
          </button>
          <div class="c-body">
            <div class="c-header">
              <button
                class="c-author"
                onclick={() => goto(`/creator/${comment.userId}`)}
              >
                {comment.author}
              </button>
              {#if comment.tier && comment.tier !== 'guest'}
                <span class="c-tier">{comment.tier}</span>
              {/if}
              <time class="c-time">{timeSince(comment.createdAt)}</time>
              {#if comment.isOwn}
                <button
                  class="c-delete"
                  onclick={() => handleDelete(comment.id)}
                  disabled={deleting === comment.id}
                  title="삭제"
                >
                  {deleting === comment.id ? '...' : '✕'}
                </button>
              {/if}
            </div>
            <p class="c-text">{comment.body}</p>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</section>

<style>
  /* ═══ SECTION ═══ */
  .comment-section {
    display: flex;
    flex-direction: column;
    gap: var(--sc-sp-3);
  }
  .section-title {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-base);
    font-weight: 900;
    color: var(--sc-text-0);
    letter-spacing: 0.3px;
    margin: 0;
    display: flex;
    align-items: center;
    gap: var(--sc-sp-1);
  }
  .count {
    font-size: var(--sc-fs-2xs);
    font-weight: 700;
    color: var(--sc-text-3);
    background: var(--sc-accent-bg-subtle);
    padding: 0 var(--sc-sp-1);
    border-radius: var(--sc-radius-pill);
  }

  /* ═══ INPUT AREA ═══ */
  .input-area {
    display: flex;
    flex-direction: column;
    gap: var(--sc-sp-1);
    background: var(--sc-surface);
    border: 1px solid var(--sc-line-soft);
    border-radius: var(--sc-radius-lg);
    padding: var(--sc-sp-2);
    transition: border-color var(--sc-duration-fast);
  }
  .input-area:focus-within {
    border-color: var(--sc-accent);
  }
  .input-box {
    font-family: var(--sc-font-body);
    font-size: var(--sc-fs-sm);
    color: var(--sc-text-1);
    background: transparent;
    border: none;
    outline: none;
    resize: vertical;
    min-height: 60px;
    max-height: 200px;
    line-height: var(--sc-lh-normal);
  }
  .input-box::placeholder {
    color: var(--sc-text-3);
  }
  .input-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .char-count {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-2xs);
    color: var(--sc-text-3);
  }
  .char-count.warn { color: var(--sc-warn); }
  .char-count.over { color: var(--sc-bad); }
  .post-btn {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-sm);
    font-weight: 800;
    color: #000;
    background: var(--sc-accent);
    border: none;
    border-radius: var(--sc-radius-md);
    padding: var(--sc-sp-1_5) var(--sc-sp-4);
    cursor: pointer;
    transition: all var(--sc-duration-fast);
  }
  .post-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .post-btn:not(:disabled):hover {
    background: var(--sc-accent-hover, var(--sc-accent));
    transform: translateY(-1px);
  }

  /* ═══ LOADING / EMPTY ═══ */
  .loading, .empty {
    display: flex;
    align-items: center;
    gap: var(--sc-sp-2);
    padding: var(--sc-sp-4) 0;
    justify-content: center;
  }
  .spinner {
    width: 16px; height: 16px;
    border: 2px solid var(--sc-line-soft);
    border-top-color: var(--sc-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .loading-text, .empty-text {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-sm);
    color: var(--sc-text-3);
  }
  .empty-icon { font-size: var(--sc-fs-lg); }

  /* ═══ COMMENT LIST ═══ */
  .comment-list {
    display: flex;
    flex-direction: column;
    gap: var(--sc-sp-1);
  }
  .comment {
    display: flex;
    gap: var(--sc-sp-2);
    padding: var(--sc-sp-2) var(--sc-sp-2);
    border-radius: var(--sc-radius-md);
    transition: background var(--sc-duration-fast);
  }
  .comment:hover {
    background: var(--sc-surface);
  }
  .comment.own {
    background: var(--sc-accent-bg-subtle);
  }

  /* avatar */
  .c-avatar {
    width: 28px; height: 28px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: var(--sc-fs-xs);
    font-weight: 700;
    border: 1px solid;
    flex-shrink: 0;
    cursor: pointer;
    background: transparent;
    transition: transform var(--sc-duration-fast);
  }
  .c-avatar:hover { transform: scale(1.08); }

  /* body */
  .c-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--sc-sp-0_5);
  }
  .c-header {
    display: flex;
    align-items: center;
    gap: var(--sc-sp-1_5);
    flex-wrap: wrap;
  }
  .c-author {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-sm);
    font-weight: 800;
    color: var(--sc-text-0);
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    transition: color var(--sc-duration-fast);
  }
  .c-author:hover { color: var(--sc-accent); }
  .c-tier {
    font-family: var(--sc-font-mono);
    font-size: 9px;
    font-weight: 800;
    color: var(--sc-text-3);
    background: var(--sc-surface);
    padding: 0 var(--sc-sp-1);
    border-radius: var(--sc-radius-pill);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .c-time {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-2xs);
    color: var(--sc-text-3);
  }
  .c-delete {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-2xs);
    color: var(--sc-text-3);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0 var(--sc-sp-1);
    margin-left: auto;
    transition: color var(--sc-duration-fast);
  }
  .c-delete:hover { color: var(--sc-bad); }
  .c-delete:disabled { opacity: 0.4; cursor: not-allowed; }
  .c-text {
    font-family: var(--sc-font-body);
    font-size: var(--sc-fs-sm);
    color: var(--sc-text-1);
    line-height: var(--sc-lh-normal);
    margin: 0;
    word-break: break-word;
    white-space: pre-wrap;
  }

  /* ═══ RESPONSIVE ═══ */
  @media (max-width: 480px) {
    .input-box { font-size: var(--sc-fs-xs); min-height: 48px; }
    .post-btn { font-size: var(--sc-fs-xs); padding: var(--sc-sp-1) var(--sc-sp-3); }
    .c-avatar { width: 24px; height: 24px; font-size: 10px; }
    .c-author { font-size: var(--sc-fs-xs); }
    .c-text { font-size: var(--sc-fs-xs); }
  }
</style>
