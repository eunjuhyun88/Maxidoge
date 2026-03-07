<script lang="ts">
  import type { CommunityPost, SignalAttachment } from '$lib/stores/communityStore';

  interface Props {
    post: CommunityPost;
    onReact?: (postId: string) => void;
    onCopyTrade?: (attachment: SignalAttachment) => void;
    onTrack?: (attachment: SignalAttachment) => void;
    onClick?: (postId: string) => void;
    compact?: boolean;
  }

  let {
    post,
    onReact,
    onCopyTrade,
    onTrack,
    onClick,
    compact = false,
  }: Props = $props();

  const att = $derived(post.signalAttachment);
  const rr = $derived(att && Math.abs(att.entry - att.sl) > 0
    ? Math.abs((att.tp - att.entry) / (att.entry - att.sl)).toFixed(1)
    : null
  );

  /** live price gap vs entry */
  const entryGap = $derived(att ? ((att.tp - att.entry) / att.entry * 100).toFixed(2) : null);

  function timeSince(ts: number): string {
    const diff = Math.max(0, Date.now() - ts);
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h`;
    const day = Math.floor(hr / 24);
    return `${day}d`;
  }

  function handleCardKeydown(event: KeyboardEvent) {
    if (!onClick) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick(post.id);
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="card"
  class:compact
  class:has-signal={!!att}
  onclick={() => onClick?.(post.id)}
  role={onClick ? 'button' : undefined}
  tabindex={onClick ? 0 : undefined}
  onkeydown={handleCardKeydown}
>
  <!-- Left accent strip -->
  {#if att}
    <div class="strip" class:long={att.dir === 'LONG'} class:short={att.dir === 'SHORT'}></div>
  {:else}
    <div class="strip neutral"></div>
  {/if}

  <div class="body">
    <!-- ── Header ── -->
    <header class="head">
      <div class="avatar" style="background:{post.avatarColor}15;color:{post.avatarColor};border-color:{post.avatarColor}30">
        {post.avatar}
      </div>
      <div class="author-col">
        <span class="author">{post.author}</span>
        {#if post.signal}
          <span class="dir-pill" class:long={post.signal === 'long'} class:short={post.signal === 'short'}>
            {post.signal === 'long' ? '▲' : '▼'} {post.signal.toUpperCase()}
          </span>
        {/if}
      </div>
      <time class="time">{timeSince(post.timestamp)}</time>
    </header>

    <!-- ── Body text ── -->
    {#if post.text}
      <p class="text">{post.text}</p>
    {/if}

    <!-- ── Signal Attachment ── -->
    {#if att}
      <div class="signal">
        <div class="sig-row-1">
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
      </div>
    {/if}

    <!-- ── Actions ── -->
    <footer class="actions">
      <button
        class="react-btn"
        class:reacted={post.userReacted}
        onclick={(event) => {
          event.stopPropagation();
          onReact?.(post.id);
        }}
      >
        <span class="react-icon">👍</span>
        {#if post.likes > 0}<span class="react-count">{post.likes}</span>{/if}
      </button>

      <span class="meta-pill">💬{#if post.commentCount > 0}<span>{post.commentCount}</span>{/if}</span>

      {#if post.copyCount > 0}
        <span class="meta-pill copy">📋 <span>{post.copyCount}</span></span>
      {/if}

      <div class="actions-r">
        {#if att}
          <button class="btn-track" onclick={(event) => {
            event.stopPropagation();
            onTrack?.(att);
          }}>
            📌 Track
          </button>
          {#if post.allowCopyTrade}
            <button class="btn-copy" onclick={(event) => {
              event.stopPropagation();
              onCopyTrade?.(att);
            }}>
              🚀 카피
            </button>
          {/if}
        {/if}
      </div>
    </footer>
  </div>
</div>

<style>
  /* ═══ CARD SHELL ═══ */
  .card {
    display: flex;
    border: 1px solid var(--sc-line-soft);
    border-radius: var(--sc-radius-xl);
    background: var(--sc-bg-1);
    overflow: hidden;
    transition: all var(--sc-duration-fast) var(--sc-ease);
    cursor: default;
  }
  .card[role='button'] { cursor: pointer; }
  .card:hover {
    background: var(--sc-surface);
    border-color: var(--sc-line);
    box-shadow: var(--sc-shadow-sm);
  }

  /* accent strip */
  .strip { width: 3px; flex-shrink: 0; transition: background var(--sc-duration-fast); }
  .strip.long { background: var(--sc-good); }
  .strip.short { background: var(--sc-bad); }
  .strip.neutral { background: var(--sc-line-soft); }

  /* body */
  .body {
    flex: 1;
    padding: var(--sc-sp-3) var(--sc-sp-4);
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--sc-sp-2);
  }

  /* ═══ HEADER ═══ */
  .head {
    display: flex;
    align-items: center;
    gap: var(--sc-sp-2);
  }
  .avatar {
    width: 28px; height: 28px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: var(--sc-fs-sm);
    font-weight: 700;
    border: 1px solid;
    flex-shrink: 0;
    transition: transform var(--sc-duration-fast) var(--sc-ease);
  }
  .card:hover .avatar { transform: scale(1.05); }

  .author-col {
    display: flex;
    align-items: center;
    gap: var(--sc-sp-1_5);
    min-width: 0;
  }
  .author {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-base);
    font-weight: 800;
    color: var(--sc-text-0);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .dir-pill {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-2xs);
    font-weight: 900;
    letter-spacing: 0.8px;
    padding: 1px 6px;
    border: 1px solid;
    border-radius: var(--sc-radius-sm);
    flex-shrink: 0;
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
    margin-left: auto;
    flex-shrink: 0;
    letter-spacing: 0.3px;
  }

  /* ═══ BODY TEXT ═══ */
  .text {
    font-family: var(--sc-font-body);
    font-size: var(--sc-fs-base);
    line-height: var(--sc-lh-normal);
    color: var(--sc-text-1);
    word-break: break-word;
    margin: 0;
  }

  /* ═══ SIGNAL ATTACHMENT ═══ */
  .signal {
    background: var(--sc-surface);
    border: 1px solid var(--sc-line-soft);
    border-radius: var(--sc-radius-lg);
    padding: var(--sc-sp-2) var(--sc-sp-3);
    display: flex;
    flex-direction: column;
    gap: var(--sc-sp-2);
  }
  .sig-row-1 {
    display: flex;
    align-items: center;
    gap: var(--sc-sp-2);
    flex-wrap: wrap;
  }
  .sig-pair {
    font-family: var(--sc-font-display);
    font-size: var(--sc-fs-md);
    font-weight: 900;
    color: var(--sc-text-0);
    letter-spacing: 0.5px;
  }
  .sig-dir {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-xs);
    font-weight: 900;
    letter-spacing: 0.8px;
    padding: 2px 8px;
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
    font-size: var(--sc-fs-xs);
    font-weight: 700;
    color: var(--sc-warn);
  }
  .sig-rr {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-xs);
    color: var(--sc-text-2);
  }
  .sig-tf {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-2xs);
    font-weight: 800;
    padding: 2px 7px;
    border-radius: var(--sc-radius-pill);
    background: var(--sc-accent-bg);
    color: var(--sc-accent);
  }

  /* levels row */
  .sig-levels {
    display: flex;
    align-items: center;
    gap: var(--sc-sp-3);
  }
  .lv { display: flex; flex-direction: column; gap: 1px; }
  .lv-label {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-2xs);
    color: var(--sc-text-3);
    letter-spacing: 0.6px;
  }
  .lv-val {
    font-family: var(--sc-font-display);
    font-size: var(--sc-fs-base);
    font-weight: 900;
  }
  .lv-val.entry { color: var(--sc-text-0); }
  .lv-val.tp { color: var(--sc-good); }
  .lv-val.sl { color: var(--sc-bad); }
  .lv-sep {
    width: 1px;
    height: 24px;
    background: var(--sc-line-soft);
    flex-shrink: 0;
  }

  /* ═══ ACTIONS ═══ */
  .actions {
    display: flex;
    align-items: center;
    gap: var(--sc-sp-2);
    padding-top: var(--sc-sp-1);
  }

  /* react button */
  .react-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--sc-sp-1);
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-sm);
    background: var(--sc-surface);
    border: 1px solid var(--sc-line-soft);
    border-radius: var(--sc-radius-md);
    padding: var(--sc-sp-1) var(--sc-sp-2);
    cursor: pointer;
    color: var(--sc-text-2);
    transition: all var(--sc-duration-fast) var(--sc-ease);
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
  .react-count { font-weight: 700; font-size: var(--sc-fs-xs); }

  /* meta pills */
  .meta-pill {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-sm);
    color: var(--sc-text-3);
    display: inline-flex;
    align-items: center;
    gap: var(--sc-sp-0_5);
  }
  .meta-pill span { font-weight: 700; }
  .meta-pill.copy { color: var(--sc-text-2); }

  /* right-side action buttons */
  .actions-r {
    margin-left: auto;
    display: flex;
    gap: var(--sc-sp-1_5);
  }

  .btn-track, .btn-copy {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-sm);
    font-weight: 800;
    letter-spacing: 0.5px;
    padding: var(--sc-sp-2) var(--sc-sp-4);
    min-height: 38px;
    border-radius: var(--sc-radius-md);
    cursor: pointer;
    transition: all var(--sc-duration-fast) var(--sc-ease);
    border: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--sc-sp-1);
  }
  .btn-track {
    background: transparent;
    color: var(--sc-good);
    border: 1.5px solid var(--sc-good);
  }
  .btn-track:hover {
    background: var(--sc-good-bg);
    border-color: var(--sc-good);
    color: var(--sc-good);
  }
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

  /* ═══ COMPACT MODE ═══ */
  .compact { border-radius: var(--sc-radius-lg); }
  .compact .body { padding: var(--sc-sp-2) var(--sc-sp-2); gap: var(--sc-sp-1); }
  .compact .avatar { width: 22px; height: 22px; font-size: var(--sc-fs-2xs); }
  .compact .author { font-size: var(--sc-fs-sm); }
  .compact .text { font-size: var(--sc-fs-sm); }
  .compact .sig-pair { font-size: var(--sc-fs-base); }
  .compact .signal { padding: var(--sc-sp-1_5) var(--sc-sp-2); }
  .compact .lv-val { font-size: var(--sc-fs-sm); }

  /* ═══ RESPONSIVE ═══ */
  @media (max-width: 768px) {
    .sig-levels { gap: var(--sc-sp-2); }
    .lv-sep { display: none; }
    .actions-r { margin-left: 0; width: 100%; margin-top: var(--sc-sp-1); }
    .btn-track, .btn-copy { flex: 1; text-align: center; }
    .actions { flex-wrap: wrap; }
  }
</style>
