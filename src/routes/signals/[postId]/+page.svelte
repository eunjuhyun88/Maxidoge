<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { fetchCommunityPostApi } from '$lib/api/communityApi';
  import { toggleReaction } from '$lib/stores/communityStore';
  import { trackSignal } from '$lib/stores/trackedSignalStore';
  import { incrementTrackedSignals } from '$lib/stores/userProfileProjectionStore';
  import { notifySignalTracked } from '$lib/stores/notificationEvents';
  import type { CommunityPost } from '$lib/contracts/community';
  import type { CommunitySignalAttachment } from '$lib/contracts/community';
  import EvidenceChip from '../../../components/community/EvidenceChip.svelte';
  import CommentSection from '../../../components/community/CommentSection.svelte';

  let post = $state<CommunityPost | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  const postId = $derived($page.params.postId ?? '');
  const att = $derived(post?.signalAttachment ?? null);
  const rr = $derived(att && Math.abs(att.entry - att.sl) > 0
    ? Math.abs((att.tp - att.entry) / (att.entry - att.sl)).toFixed(1)
    : null
  );

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

  function formatDate(ts: number): string {
    return new Date(ts).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function handleTrack(a: CommunitySignalAttachment) {
    trackSignal(a.pair, a.dir, a.entry, 'community', a.conf);
    incrementTrackedSignals();
    notifySignalTracked(a.pair, a.dir);
  }

  function handleCopyTrade(a: CommunitySignalAttachment) {
    const params = new URLSearchParams({
      copyTrade: '1',
      pair: a.pair,
      dir: a.dir,
      entry: String(Math.round(a.entry)),
      tp: String(Math.round(a.tp)),
      sl: String(Math.round(a.sl)),
      conf: String(Math.round(a.conf)),
      source: 'community',
      reason: a.reason || '',
    });
    goto(`/terminal?${params.toString()}`);
  }

  async function handleReact() {
    if (!post) return;
    await toggleReaction(post.id);
    // Refetch to get updated count
    const updated = await fetchCommunityPostApi(post.id);
    if (updated) post = updated;
  }

  function handleCommentCountChange(count: number) {
    if (post) {
      post = { ...post, commentCount: count };
    }
  }

  onMount(async () => {
    try {
      const result = await fetchCommunityPostApi(postId);
      if (!result) {
        error = '시그널을 찾을 수 없습니다';
      } else {
        post = result;
      }
    } catch {
      error = '시그널을 불러오는데 실패했습니다';
    } finally {
      loading = false;
    }
  });
</script>

<div class="page">
  <!-- ═══ BACK NAV ═══ -->
  <nav class="back-nav">
    <a class="back-link" href="/signals">← 시그널 목록</a>
  </nav>

  {#if loading}
    <div class="state-box">
      <span class="spinner"></span>
      <span class="state-text">불러오는 중...</span>
    </div>
  {:else if error || !post}
    <div class="state-box">
      <span class="state-icon">⚠️</span>
      <span class="state-text">{error || '시그널을 찾을 수 없습니다'}</span>
      <a class="back-btn" href="/signals">목록으로 돌아가기</a>
    </div>
  {:else}
    <article class="detail">
      <!-- ═══ AUTHOR HEADER ═══ -->
      <header class="author-header">
        <button
          class="avatar"
          style="background:{post.avatarColor}15;color:{post.avatarColor};border-color:{post.avatarColor}30"
          onclick={() => post?.userId && goto(`/creator/${post.userId}`)}
          disabled={!post.userId}
        >
          {post.avatar}
        </button>
        <div class="author-info">
          <button
            class="author-name"
            class:clickable={!!post.userId}
            onclick={() => post?.userId && goto(`/creator/${post.userId}`)}
            disabled={!post.userId}
          >
            {post.author}
          </button>
          <div class="author-meta">
            {#if post.signal}
              <span class="dir-pill" class:long={post.signal === 'long'} class:short={post.signal === 'short'}>
                {post.signal === 'long' ? '▲' : '▼'} {post.signal.toUpperCase()}
              </span>
            {/if}
            <time class="time" title={formatDate(post.createdAt)}>{timeSince(post.createdAt)}</time>
          </div>
        </div>
      </header>

      <!-- ═══ BODY TEXT ═══ -->
      {#if post.body}
        <p class="body-text">{post.body}</p>
      {/if}

      <!-- ═══ SIGNAL ATTACHMENT (expanded) ═══ -->
      {#if att}
        <div class="signal-block">
          <div class="sig-header">
            <span class="sig-pair">{att.pair}</span>
            <span class="sig-dir" class:long={att.dir === 'LONG'} class:short={att.dir === 'SHORT'}>
              {att.dir === 'LONG' ? '▲' : '▼'} {att.dir}
            </span>
            <span class="sig-conf">{att.conf}%</span>
            {#if rr}
              <span class="sig-rr">R:R {rr}</span>
            {/if}
            {#if att.timeframe}
              <span class="sig-tf">{att.timeframe}</span>
            {/if}
          </div>

          <div class="sig-levels">
            <div class="lv">
              <span class="lv-label">ENTRY</span>
              <span class="lv-val entry">${att.entry.toLocaleString()}</span>
            </div>
            <div class="lv-sep"></div>
            <div class="lv">
              <span class="lv-label">TP</span>
              <span class="lv-val tp">${att.tp.toLocaleString()}</span>
            </div>
            <div class="lv-sep"></div>
            <div class="lv">
              <span class="lv-label">SL</span>
              <span class="lv-val sl">${att.sl.toLocaleString()}</span>
            </div>
          </div>

          {#if att.reason}
            <div class="sig-reason">
              <span class="reason-label">💡 근거</span>
              <p class="reason-text">{att.reason}</p>
            </div>
          {/if}
        </div>
      {/if}

      <!-- ═══ EVIDENCE (full, no limit) ═══ -->
      {#if att?.evidence?.items?.length}
        <div class="evidence-section">
          <div class="ev-header">
            <span class="ev-icon">{att.evidence.source === 'ai-scan' ? '🤖' : '📊'}</span>
            <span class="ev-label">{att.evidence.source === 'ai-scan' ? 'AI 분석 근거' : '차트 관찰 근거'}</span>
            <span class="ev-cnt">{att.evidence.items.length}개</span>
          </div>
          <div class="ev-chips">
            {#each att.evidence.items as item}
              <EvidenceChip {item} />
            {/each}
          </div>
        </div>
      {/if}

      <!-- ═══ ACTION BAR ═══ -->
      <div class="action-bar">
        <button
          class="react-btn"
          class:reacted={post.userReacted}
          onclick={handleReact}
        >
          <span class="react-icon">👍</span>
          {#if post.likes > 0}<span class="react-count">{post.likes}</span>{/if}
        </button>

        <span class="meta-pill">💬 {post.commentCount}</span>

        {#if post.copyCount > 0}
          <span class="meta-pill copy">📋 {post.copyCount}</span>
        {/if}

        <div class="action-right">
          {#if att}
            <button class="btn-track" onclick={() => att && handleTrack(att)}>
              📌 Track
            </button>
            {#if post.allowCopyTrade}
              <button class="btn-copy" onclick={() => att && handleCopyTrade(att)}>
                🚀 카피 트레이드
              </button>
            {/if}
          {/if}
        </div>
      </div>

      <!-- ═══ COMMENTS ═══ -->
      <CommentSection
        postId={post.id}
        initialCount={post.commentCount}
        onCountChange={handleCommentCountChange}
      />
    </article>
  {/if}
</div>

<style>
  /* ═══ PAGE ═══ */
  .page {
    height: 100%;
    overflow-y: auto;
    background: var(--sc-bg-0);
    padding-bottom: var(--sc-bottom-bar-h);
  }

  /* ═══ BACK NAV ═══ */
  .back-nav {
    position: sticky;
    top: 0;
    z-index: var(--sc-z-sticky);
    padding: var(--sc-sp-2) var(--sc-sp-4);
    background: var(--sc-bg-0);
    border-bottom: 1px solid var(--sc-line-soft);
  }
  .back-link {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-sm);
    font-weight: 700;
    color: var(--sc-text-2);
    text-decoration: none;
    letter-spacing: 0.3px;
    transition: color var(--sc-duration-fast);
  }
  .back-link:hover { color: var(--sc-accent); }

  /* ═══ STATES ═══ */
  .state-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sc-sp-3);
    padding: var(--sc-sp-8) var(--sc-sp-4);
    text-align: center;
  }
  .spinner {
    width: 24px; height: 24px;
    border: 2px solid var(--sc-line-soft);
    border-top-color: var(--sc-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .state-icon { font-size: var(--sc-fs-2xl); }
  .state-text {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-sm);
    color: var(--sc-text-2);
  }
  .back-btn {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-sm);
    font-weight: 700;
    color: var(--sc-accent);
    text-decoration: none;
    padding: var(--sc-sp-2) var(--sc-sp-4);
    border: 1px solid var(--sc-accent);
    border-radius: var(--sc-radius-md);
    transition: all var(--sc-duration-fast);
  }
  .back-btn:hover { background: var(--sc-accent-bg-subtle); }

  /* ═══ DETAIL ═══ */
  .detail {
    max-width: 680px;
    margin: 0 auto;
    padding: var(--sc-sp-4);
    display: flex;
    flex-direction: column;
    gap: var(--sc-sp-4);
  }

  /* ═══ AUTHOR HEADER ═══ */
  .author-header {
    display: flex;
    align-items: center;
    gap: var(--sc-sp-3);
  }
  .avatar {
    width: 40px; height: 40px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: var(--sc-fs-lg);
    font-weight: 700;
    border: 1.5px solid;
    flex-shrink: 0;
    cursor: pointer;
    background: transparent;
    transition: transform var(--sc-duration-fast);
  }
  .avatar:disabled { cursor: default; }
  .avatar:not(:disabled):hover { transform: scale(1.08); }
  .author-info {
    display: flex;
    flex-direction: column;
    gap: var(--sc-sp-0_5);
    min-width: 0;
  }
  .author-name {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-lg);
    font-weight: 900;
    color: var(--sc-text-0);
    background: none;
    border: none;
    padding: 0;
    cursor: default;
    text-align: left;
  }
  .author-name.clickable {
    cursor: pointer;
  }
  .author-name.clickable:hover { color: var(--sc-accent); }
  .author-meta {
    display: flex;
    align-items: center;
    gap: var(--sc-sp-2);
  }
  .dir-pill {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-2xs);
    font-weight: 900;
    letter-spacing: 0.8px;
    padding: 1px 6px;
    border: 1px solid;
    border-radius: var(--sc-radius-sm);
  }
  .dir-pill.long {
    color: var(--sc-good);
    border-color: var(--sc-good-bg);
    background: var(--sc-good-bg);
  }
  .dir-pill.short {
    color: var(--sc-bad);
    border-color: var(--sc-bad-bg);
    background: var(--sc-bad-bg);
  }
  .time {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-2xs);
    color: var(--sc-text-3);
    letter-spacing: 0.3px;
  }

  /* ═══ BODY TEXT ═══ */
  .body-text {
    font-family: var(--sc-font-body);
    font-size: var(--sc-fs-md);
    line-height: var(--sc-lh-relaxed, 1.7);
    color: var(--sc-text-1);
    word-break: break-word;
    margin: 0;
    white-space: pre-wrap;
  }

  /* ═══ SIGNAL BLOCK (expanded) ═══ */
  .signal-block {
    background: var(--sc-surface);
    border: 1px solid var(--sc-line-soft);
    border-radius: var(--sc-radius-xl);
    padding: var(--sc-sp-4);
    display: flex;
    flex-direction: column;
    gap: var(--sc-sp-3);
  }
  .sig-header {
    display: flex;
    align-items: center;
    gap: var(--sc-sp-2);
    flex-wrap: wrap;
  }
  .sig-pair {
    font-family: var(--sc-font-display);
    font-size: var(--sc-fs-xl);
    font-weight: 900;
    color: var(--sc-text-0);
    letter-spacing: 0.5px;
  }
  .sig-dir {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-sm);
    font-weight: 900;
    letter-spacing: 0.8px;
    padding: 3px 10px;
    border: 1.5px solid;
    border-radius: var(--sc-radius-sm);
  }
  .sig-dir.long {
    color: var(--sc-good);
    border-color: rgba(0, 204, 136, 0.35);
    background: var(--sc-good-bg);
  }
  .sig-dir.short {
    color: var(--sc-bad);
    border-color: rgba(255, 94, 122, 0.35);
    background: var(--sc-bad-bg);
  }
  .sig-conf {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-sm);
    font-weight: 700;
    color: var(--sc-warn);
  }
  .sig-rr {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-sm);
    color: var(--sc-text-2);
  }
  .sig-tf {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-xs);
    font-weight: 800;
    padding: 2px 8px;
    border-radius: var(--sc-radius-pill);
    background: var(--sc-accent-bg);
    color: var(--sc-accent);
  }

  /* levels */
  .sig-levels {
    display: flex;
    align-items: center;
    gap: var(--sc-sp-4);
  }
  .lv { display: flex; flex-direction: column; gap: 2px; }
  .lv-label {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-2xs);
    color: var(--sc-text-3);
    letter-spacing: 0.6px;
  }
  .lv-val {
    font-family: var(--sc-font-display);
    font-size: var(--sc-fs-lg);
    font-weight: 900;
  }
  .lv-val.entry { color: var(--sc-text-0); }
  .lv-val.tp { color: var(--sc-good); }
  .lv-val.sl { color: var(--sc-bad); }
  .lv-sep {
    width: 1px;
    height: 32px;
    background: var(--sc-line-soft);
    flex-shrink: 0;
  }

  /* reason */
  .sig-reason {
    border-top: 1px solid var(--sc-line-soft);
    padding-top: var(--sc-sp-2);
    display: flex;
    flex-direction: column;
    gap: var(--sc-sp-1);
  }
  .reason-label {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-xs);
    font-weight: 700;
    color: var(--sc-text-2);
    letter-spacing: 0.3px;
  }
  .reason-text {
    font-family: var(--sc-font-body);
    font-size: var(--sc-fs-sm);
    line-height: var(--sc-lh-normal);
    color: var(--sc-text-1);
    margin: 0;
    white-space: pre-wrap;
  }

  /* ═══ EVIDENCE ═══ */
  .evidence-section {
    display: flex;
    flex-direction: column;
    gap: var(--sc-sp-2);
    padding: var(--sc-sp-3);
    background: var(--sc-surface);
    border: 1px solid var(--sc-line-soft);
    border-radius: var(--sc-radius-lg);
  }
  .ev-header {
    display: flex;
    align-items: center;
    gap: var(--sc-sp-1);
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-xs);
  }
  .ev-icon { font-size: var(--sc-fs-base); }
  .ev-label { font-weight: 700; color: var(--sc-text-2); letter-spacing: 0.3px; }
  .ev-cnt {
    font-weight: 800;
    color: var(--sc-text-3);
    background: var(--sc-bg-0);
    padding: 0 var(--sc-sp-1);
    border-radius: var(--sc-radius-pill);
    font-size: var(--sc-fs-2xs);
  }
  .ev-chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sc-sp-1);
    align-items: center;
  }

  /* ═══ ACTION BAR ═══ */
  .action-bar {
    display: flex;
    align-items: center;
    gap: var(--sc-sp-3);
    padding: var(--sc-sp-3) 0;
    border-top: 1px solid var(--sc-line-soft);
    border-bottom: 1px solid var(--sc-line-soft);
  }
  .react-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--sc-sp-1);
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-sm);
    background: var(--sc-surface);
    border: 1px solid var(--sc-line-soft);
    border-radius: var(--sc-radius-md);
    padding: var(--sc-sp-2) var(--sc-sp-3);
    cursor: pointer;
    color: var(--sc-text-2);
    transition: all var(--sc-duration-fast);
  }
  .react-btn:hover {
    background: var(--sc-surface-2);
    border-color: var(--sc-line);
  }
  .react-btn.reacted {
    background: rgba(59, 130, 246, 0.12);
    border-color: rgba(59, 130, 246, 0.35);
    color: #93c5fd;
  }
  .react-icon { font-size: var(--sc-fs-base); line-height: 1; }
  .react-count { font-weight: 700; font-size: var(--sc-fs-sm); }

  .meta-pill {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-sm);
    color: var(--sc-text-3);
    display: inline-flex;
    align-items: center;
    gap: var(--sc-sp-1);
  }
  .meta-pill.copy { color: var(--sc-text-2); }

  .action-right {
    margin-left: auto;
    display: flex;
    gap: var(--sc-sp-2);
  }

  .btn-track, .btn-copy {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-sm);
    font-weight: 800;
    letter-spacing: 0.5px;
    padding: var(--sc-sp-2) var(--sc-sp-4);
    min-height: 40px;
    border-radius: var(--sc-radius-md);
    cursor: pointer;
    transition: all var(--sc-duration-fast);
    border: none;
    display: inline-flex;
    align-items: center;
    gap: var(--sc-sp-1);
  }
  .btn-track {
    background: transparent;
    color: var(--sc-good);
    border: 1.5px solid var(--sc-good);
  }
  .btn-track:hover { background: var(--sc-good-bg); }
  .btn-copy {
    background: var(--sc-accent);
    color: #000;
    font-weight: 900;
    box-shadow: 1px 1px 0 rgba(0,0,0,0.4);
  }
  .btn-copy:hover {
    background: var(--sc-accent-hover, var(--sc-accent));
    transform: translateY(-1px);
    box-shadow: 2px 2px 0 rgba(0,0,0,0.5);
  }
  .btn-copy:active { transform: translateY(0); box-shadow: none; }

  /* ═══ RESPONSIVE ═══ */
  @media (max-width: 768px) {
    .detail { padding: var(--sc-sp-3); gap: var(--sc-sp-3); }
    .sig-levels { gap: var(--sc-sp-2); }
    .lv-sep { display: none; }
    .action-right { margin-left: 0; width: 100%; margin-top: var(--sc-sp-1); }
    .btn-track, .btn-copy { flex: 1; justify-content: center; }
    .action-bar { flex-wrap: wrap; }
  }

  @media (max-width: 480px) {
    .back-nav { padding: var(--sc-sp-2) var(--sc-sp-3); }
    .back-link { font-size: var(--sc-fs-xs); }
    .detail { padding: var(--sc-sp-2); gap: var(--sc-sp-2); }
    .avatar { width: 32px; height: 32px; font-size: var(--sc-fs-base); }
    .author-name { font-size: var(--sc-fs-base); }
    .body-text { font-size: var(--sc-fs-base); }
    .signal-block { padding: var(--sc-sp-3); }
    .sig-pair { font-size: var(--sc-fs-lg); }
    .lv-val { font-size: var(--sc-fs-base); }
    .btn-track, .btn-copy {
      font-size: var(--sc-fs-2xs);
      padding: var(--sc-sp-1_5) var(--sc-sp-2);
      min-height: var(--sc-touch-sm, 36px);
    }
  }
</style>
