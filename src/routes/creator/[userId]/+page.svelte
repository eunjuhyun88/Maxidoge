<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { fetchCreatorProfileApi } from '$lib/api/creatorApi';
  import { trackSignal } from '$lib/stores/trackedSignalStore';
  import { incrementTrackedSignals } from '$lib/stores/userProfileProjectionStore';
  import { notifySignalTracked } from '$lib/stores/notificationEvents';
  import { toggleReaction, type SignalAttachment, type CommunityPost as StoreCommunityPost } from '$lib/stores/communityStore';
  import { tierColor, tierEmoji, tierLabel } from '../../../components/passport/passportHelpers';
  import SignalPostCard from '../../../components/community/SignalPostCard.svelte';
  import type { CreatorProfile } from '$lib/contracts/creator';
  import type { CommunityPost as ContractPost } from '$lib/contracts/community';

  /** Map contract CommunityPost → store CommunityPost for SignalPostCard */
  function toStorePost(p: ContractPost): StoreCommunityPost {
    return {
      id: p.id,
      userId: p.userId ?? null,
      author: p.author,
      avatar: p.avatar || '🐕',
      avatarColor: p.avatarColor || '#E8967D',
      text: p.body,
      signal: p.signal,
      timestamp: Number(p.createdAt ?? Date.now()),
      likes: Number(p.likes ?? 0),
      signalAttachment: p.signalAttachment ?? null,
      userReacted: Boolean(p.userReacted),
      commentCount: Number(p.commentCount ?? 0),
      copyCount: Number(p.copyCount ?? 0),
      allowCopyTrade: Boolean(p.allowCopyTrade),
    };
  }

  let creator: CreatorProfile | null = $state(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  const userId = $derived($page.params.userId);

  function handleTrack(att: SignalAttachment) {
    trackSignal(att.pair, att.dir, att.entry, 'community', att.conf);
    incrementTrackedSignals();
    notifySignalTracked(att.pair, att.dir);
  }

  function handleCopyTrade(att: SignalAttachment) {
    const params = new URLSearchParams({
      copyTrade: '1',
      pair: att.pair,
      dir: att.dir,
      entry: String(Math.round(att.entry)),
      tp: String(Math.round(att.tp)),
      sl: String(Math.round(att.sl)),
      conf: String(Math.round(att.conf)),
      source: 'community',
      reason: att.reason || '',
    });
    goto(`/terminal?${params.toString()}`);
  }

  function formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  onMount(async () => {
    if (!userId) { error = '유효하지 않은 사용자 ID'; loading = false; return; }
    try {
      const result = await fetchCreatorProfileApi(userId);
      if (!result) {
        error = '크리에이터를 찾을 수 없습니다';
      } else {
        creator = result;
      }
    } catch {
      error = '프로필을 불러오는데 실패했습니다';
    } finally {
      loading = false;
    }
  });
</script>

<div class="page">
  <!-- ═══ BACK NAV ═══ -->
  <nav class="back-nav">
    <button class="back-link" onclick={() => history.back()}>← 뒤로</button>
  </nav>

  {#if loading}
    <div class="state-box">
      <span class="spinner"></span>
      <span class="state-text">불러오는 중...</span>
    </div>
  {:else if error || !creator}
    <div class="state-box">
      <span class="state-icon">⚠️</span>
      <span class="state-text">{error || '크리에이터를 찾을 수 없습니다'}</span>
      <a class="back-btn" href="/signals">시그널 목록으로</a>
    </div>
  {:else}
    {@const s = creator.stats}
    {@const tc = tierColor(s.displayTier)}

    <!-- ═══ PROFILE HEADER ═══ -->
    <header class="profile-header">
      <div class="profile-bg" style="background: linear-gradient(135deg, {tc}15 0%, transparent 60%)"></div>
      <div class="profile-inner">
        <div class="avatar-wrap">
          <span class="p-avatar" style="background:{creator.avatarColor}15;color:{creator.avatarColor};border-color:{tc}">
            {creator.avatar || '🐕'}
          </span>
          <span class="tier-badge" style="background:{tc};color:#000">
            {tierEmoji(s.displayTier)}
          </span>
        </div>
        <div class="profile-info">
          <h1 class="p-name">{creator.nickname}</h1>
          <div class="p-meta">
            <span class="p-tier" style="color:{tc}">{tierLabel(s.displayTier)}</span>
            {#if creator.joinedAt}
              <span class="p-joined">가입 {formatDate(creator.joinedAt)}</span>
            {/if}
          </div>
        </div>
      </div>
    </header>

    <!-- ═══ STATS GRID ═══ -->
    <section class="stats-section">
      <div class="stats-grid">
        <div class="stat">
          <span class="stat-val">{s.totalMatches}</span>
          <span class="stat-label">매치</span>
        </div>
        <div class="stat">
          <span class="stat-val good">{s.wins}</span>
          <span class="stat-label">승리</span>
        </div>
        <div class="stat">
          <span class="stat-val bad">{s.losses}</span>
          <span class="stat-label">패배</span>
        </div>
        <div class="stat">
          <span class="stat-val" class:good={s.winRate >= 50} class:bad={s.winRate < 50}>
            {s.winRate}%
          </span>
          <span class="stat-label">승률</span>
        </div>
        <div class="stat">
          <span class="stat-val accent">🔥 {s.streak}</span>
          <span class="stat-label">연승</span>
        </div>
        <div class="stat">
          <span class="stat-val accent">⚡ {s.bestStreak}</span>
          <span class="stat-label">최고 연승</span>
        </div>
        <div class="stat">
          <span class="stat-val" class:good={s.totalPnl >= 0} class:bad={s.totalPnl < 0}>
            {s.totalPnl >= 0 ? '+' : ''}{s.totalPnl.toFixed(2)}
          </span>
          <span class="stat-label">PnL</span>
        </div>
        <div class="stat">
          <span class="stat-val">{s.totalLp.toLocaleString()}</span>
          <span class="stat-label">LP</span>
        </div>
      </div>
    </section>

    <!-- ═══ BADGES ═══ -->
    {#if s.badges && s.badges.length > 0}
      <section class="badges-section">
        <h3 class="section-title">🏅 뱃지</h3>
        <div class="badge-row">
          {#each s.badges as badge}
            <div class="badge-chip" title={badge.name ?? badge.id}>
              <span class="badge-icon">{badge.icon ?? '🏅'}</span>
              <span class="badge-name">{badge.name ?? badge.id}</span>
            </div>
          {/each}
        </div>
      </section>
    {/if}

    <!-- ═══ RECENT SIGNALS ═══ -->
    <section class="signals-section">
      <h3 class="section-title">
        📡 최근 시그널
        <span class="sig-count">{s.signalCount}</span>
      </h3>
      {#if creator.recentSignals.length === 0}
        <div class="empty">
          <span class="empty-text">아직 공유한 시그널이 없습니다</span>
        </div>
      {:else}
        <div class="card-list">
          {#each creator.recentSignals.map(toStorePost) as post (post.id)}
            <SignalPostCard
              {post}
              onReact={(id) => toggleReaction(id)}
              onCopyTrade={(att) => handleCopyTrade(att)}
              onTrack={(att) => handleTrack(att)}
              onClick={(id) => goto(`/signals/${id}`)}
              onAuthorClick={(uid) => goto(`/creator/${uid}`)}
              compact
            />
          {/each}
        </div>
      {/if}
    </section>
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
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
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

  /* ═══ PROFILE HEADER ═══ */
  .profile-header {
    position: relative;
    padding: var(--sc-sp-6) var(--sc-sp-4);
    overflow: hidden;
  }
  .profile-bg {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .profile-inner {
    position: relative;
    z-index: var(--sc-z-base);
    max-width: 680px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    gap: var(--sc-sp-4);
  }
  .avatar-wrap {
    position: relative;
    flex-shrink: 0;
  }
  .p-avatar {
    width: 64px; height: 64px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: var(--sc-fs-2xl);
    font-weight: 700;
    border: 2.5px solid;
  }
  .tier-badge {
    position: absolute;
    bottom: -2px;
    right: -4px;
    width: 22px; height: 22px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: var(--sc-fs-xs);
    border: 2px solid var(--sc-bg-0);
  }
  .profile-info {
    display: flex;
    flex-direction: column;
    gap: var(--sc-sp-1);
    min-width: 0;
  }
  .p-name {
    font-family: var(--sc-font-display);
    font-size: var(--sc-fs-2xl);
    font-weight: 900;
    color: var(--sc-text-0);
    letter-spacing: 0.5px;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .p-meta {
    display: flex;
    align-items: center;
    gap: var(--sc-sp-2);
    flex-wrap: wrap;
  }
  .p-tier {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-xs);
    font-weight: 900;
    letter-spacing: 0.8px;
  }
  .p-joined {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-2xs);
    color: var(--sc-text-3);
    letter-spacing: 0.3px;
  }

  /* ═══ STATS ═══ */
  .stats-section {
    max-width: 680px;
    margin: 0 auto;
    padding: 0 var(--sc-sp-4);
  }
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--sc-sp-2);
    padding: var(--sc-sp-3);
    background: var(--sc-surface);
    border: 1px solid var(--sc-line-soft);
    border-radius: var(--sc-radius-xl);
  }
  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: var(--sc-sp-2) var(--sc-sp-1);
  }
  .stat-val {
    font-family: var(--sc-font-display);
    font-size: var(--sc-fs-lg);
    font-weight: 900;
    color: var(--sc-text-0);
  }
  .stat-val.good { color: var(--sc-good); }
  .stat-val.bad { color: var(--sc-bad); }
  .stat-val.accent { color: var(--sc-accent); }
  .stat-label {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-2xs);
    font-weight: 700;
    color: var(--sc-text-3);
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  /* ═══ BADGES ═══ */
  .badges-section {
    max-width: 680px;
    margin: var(--sc-sp-4) auto 0;
    padding: 0 var(--sc-sp-4);
  }
  .section-title {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-base);
    font-weight: 900;
    color: var(--sc-text-0);
    letter-spacing: 0.3px;
    margin: 0 0 var(--sc-sp-2);
    display: flex;
    align-items: center;
    gap: var(--sc-sp-1);
  }
  .sig-count {
    font-size: var(--sc-fs-2xs);
    font-weight: 700;
    color: var(--sc-text-3);
    background: var(--sc-accent-bg-subtle);
    padding: 0 var(--sc-sp-1);
    border-radius: var(--sc-radius-pill);
  }
  .badge-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sc-sp-1);
  }
  .badge-chip {
    display: inline-flex;
    align-items: center;
    gap: var(--sc-sp-1);
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-xs);
    font-weight: 700;
    color: var(--sc-text-1);
    background: var(--sc-surface);
    border: 1px solid var(--sc-line-soft);
    border-radius: var(--sc-radius-pill);
    padding: var(--sc-sp-1) var(--sc-sp-3);
  }
  .badge-icon { font-size: var(--sc-fs-base); }
  .badge-name { letter-spacing: 0.2px; }

  /* ═══ SIGNALS ═══ */
  .signals-section {
    max-width: 680px;
    margin: var(--sc-sp-4) auto 0;
    padding: 0 var(--sc-sp-4) var(--sc-sp-8);
  }
  .card-list {
    display: flex;
    flex-direction: column;
    gap: var(--sc-sp-2);
  }
  .empty {
    display: flex;
    justify-content: center;
    padding: var(--sc-sp-6) 0;
  }
  .empty-text {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-sm);
    color: var(--sc-text-3);
  }

  /* ═══ RESPONSIVE ═══ */
  @media (max-width: 768px) {
    .stats-grid { grid-template-columns: repeat(4, 1fr); gap: var(--sc-sp-1); }
    .stat-val { font-size: var(--sc-fs-base); }
  }

  @media (max-width: 480px) {
    .profile-header { padding: var(--sc-sp-4) var(--sc-sp-3); }
    .profile-inner { gap: var(--sc-sp-3); }
    .p-avatar { width: 48px; height: 48px; font-size: var(--sc-fs-xl); }
    .p-name { font-size: var(--sc-fs-xl); }
    .tier-badge { width: 18px; height: 18px; font-size: 10px; }
    .stats-section, .badges-section, .signals-section { padding-left: var(--sc-sp-3); padding-right: var(--sc-sp-3); }
    .stats-grid { grid-template-columns: repeat(2, 1fr); }
    .stat-val { font-size: var(--sc-fs-base); }
    .back-nav { padding: var(--sc-sp-2) var(--sc-sp-3); }
    .back-link { font-size: var(--sc-fs-xs); }
  }
</style>
