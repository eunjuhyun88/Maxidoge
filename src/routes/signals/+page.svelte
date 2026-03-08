<script lang="ts">
  import { AGDEFS, CHARACTER_ART } from '$lib/data/agents';
  import { matchHistoryStore } from '$lib/stores/matchHistoryStore';
  import { livePrices } from '$lib/stores/priceStore';
  import { openTrades } from '$lib/stores/quickTradeStore';
  import { activeSignals, trackSignal } from '$lib/stores/trackedSignalStore';
  import { incrementTrackedSignals } from '$lib/stores/userProfileStore';
  import {
    communityPosts,
    hydrateCommunityPosts,
    toggleReaction,
    type SignalAttachment,
  } from '$lib/stores/communityStore';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { notifySignalTracked } from '$lib/stores/notificationEvents';
  import {
    buildAgentSignals,
    buildArenaSignals,
    buildTrackedSignals,
    buildTradeSignals,
  } from '$lib/signals/communitySignals';
  import EmptyState from '../../components/shared/EmptyState.svelte';
  import ContextBanner from '../../components/shared/ContextBanner.svelte';
  import OracleLeaderboard from '../../components/community/OracleLeaderboard.svelte';
  import SignalPostCard from '../../components/community/SignalPostCard.svelte';
  // SignalPostForm removed — signal creation happens from terminal only

  const records = $derived($matchHistoryStore.records);
  const opens = $derived($openTrades);
  const tracked = $derived($activeSignals);

  // Signal counts (used only for header stats)
  const agentSignals = $derived(buildAgentSignals(AGDEFS, { livePrices: $livePrices }));

  // --- View state: 3 focused tabs ---
  type ViewTab = 'feed' | 'trending' | 'ai';
  let activeTab: ViewTab = $state<ViewTab>('feed');
  let feedFilter: 'all' | 'long' | 'short' = $state<'all' | 'long' | 'short'>('all');

  // --- Feed data ---
  const feedPosts = $derived(
    feedFilter === 'all' ? $communityPosts
    : $communityPosts.filter(p => p.signal === feedFilter)
  );

  // --- Trending: sort by engagement ---
  const trendingPosts = $derived(
    [...$communityPosts]
      .filter(p => p.signalAttachment)
      .sort((a, b) => (b.likes + b.copyCount * 3) - (a.likes + a.copyCount * 3))
      .slice(0, 30)
  );

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

  function setTab(next: ViewTab) {
    activeTab = next;
    const query = new URLSearchParams($page.url.searchParams);
    if (next === 'feed') query.delete('view');
    else query.set('view', next);
    const qs = query.toString();
    goto(`/signals${qs ? `?${qs}` : ''}`, {
      replaceState: true,
      noScroll: true,
      keepFocus: true,
      invalidateAll: false
    });
  }

  onMount(() => {
    const v = $page.url.searchParams.get('view');
    if (v === 'ai' || v === 'trending') {
      activeTab = v;
    } else {
      activeTab = 'feed';
    }
    void hydrateCommunityPosts();
  });

  /* Tab definitions — 3 focused tabs */
  const TABS: Array<{ key: ViewTab; icon: string; label: string; count?: number }> = $derived([
    { key: 'feed', icon: '💬', label: '피드', count: $communityPosts.length },
    { key: 'trending', icon: '🔥', label: '인기', count: trendingPosts.length },
    { key: 'ai', icon: '🤖', label: 'AI 시그널', count: agentSignals.length },
  ]);

  /** render shared card list (DRY) */
  function renderCardProps(post: (typeof $communityPosts)[number]) {
    return {
      post,
      onReact: (id: string) => toggleReaction(id),
      onCopyTrade: (att: SignalAttachment) => handleCopyTrade(att),
      onTrack: (att: SignalAttachment) => handleTrack(att),
    };
  }
</script>

<div class="page">
  <ContextBanner page="signals" />

  <!-- ═══ HEADER — minimal, focused ═══ -->
  <header class="header">
    <div class="header-bg"></div>
    <div class="header-inner">
      <h1 class="header-title">COMMUNITY</h1>
      <span class="header-count">{$communityPosts.length} posts</span>
    </div>
  </header>

  <!-- ═══ TAB BAR ═══ -->
  <div class="tab-bar" role="tablist" aria-label="Community views">
    {#each TABS as tab (tab.key)}
      <button
        class="tab"
        class:active={activeTab === tab.key}
        role="tab"
        aria-selected={activeTab === tab.key}
        onclick={() => setTab(tab.key)}
      >
        <span class="tab-icon">{tab.icon}</span>
        <span class="tab-text">{tab.label}</span>
        {#if tab.count != null && tab.count > 0}
          <span class="tab-badge">{tab.count}</span>
        {/if}
      </button>
    {/each}
  </div>

  <!-- ═══ CONTENT ═══ -->
  <main class="content">

    <!-- ── FEED TAB ── -->
    {#if activeTab === 'feed'}
      <div class="feed">
        <!-- CTA: signal creation happens in terminal -->
        <a class="create-cta" href="/terminal">
          <span class="cta-icon">📡</span>
          <span class="cta-body">
            <span class="cta-title">터미널에서 시그널을 공유하세요</span>
            <span class="cta-sub">차트 분석 · AI 에이전트 시그널에서 바로 공유</span>
          </span>
          <span class="cta-arrow">→</span>
        </a>

        <!-- Direction filter (inline, compact) -->
        <div class="feed-bar">
          <div class="dir-chips">
            <button class="chip" class:active={feedFilter === 'all'} onclick={() => feedFilter = 'all'}>All</button>
            <button class="chip" class:active={feedFilter === 'long'} onclick={() => feedFilter = 'long'}>▲ Long</button>
            <button class="chip" class:active={feedFilter === 'short'} onclick={() => feedFilter = 'short'}>▼ Short</button>
          </div>
          <a class="terminal-link" href="/terminal">🧠 터미널 →</a>
        </div>

        {#if feedPosts.length === 0}
          <EmptyState
            image={CHARACTER_ART.tradeSurge}
            title="No signals yet"
            subtitle="Analyze in Terminal and share with the community"
            ctaText="🧠 터미널 열기"
            ctaHref="/terminal"
            icon="💡"
            variant="orange"
            compact
          />
        {:else}
          <div class="card-list">
            {#each feedPosts as post (post.id)}
              <SignalPostCard
                {post}
                onReact={(id) => toggleReaction(id)}
                onCopyTrade={(att) => handleCopyTrade(att)}
                onTrack={(att) => handleTrack(att)}
              />
            {/each}
          </div>
        {/if}
      </div>

    <!-- ── TRENDING TAB ── -->
    {:else if activeTab === 'trending'}
      <div class="feed">
        {#if trendingPosts.length === 0}
          <EmptyState
            image={CHARACTER_ART.tradeSurge}
            title="No trending signals"
            subtitle="Share signals and get likes from the community"
            ctaText="💬 피드로 가기"
            ctaHref="/signals"
            icon="🔥"
            variant="orange"
            compact
          />
        {:else}
          <div class="card-list">
            {#each trendingPosts as post (post.id)}
              <SignalPostCard
                {post}
                onReact={(id) => toggleReaction(id)}
                onCopyTrade={(att) => handleCopyTrade(att)}
                onTrack={(att) => handleTrack(att)}
              />
            {/each}
          </div>
        {/if}
      </div>

    <!-- ── AI SIGNAL TAB ── -->
    {:else if activeTab === 'ai'}
      <section class="ai-section">
        <OracleLeaderboard embedded={true} />
      </section>
    {/if}
  </main>
</div>

<style>
  /* ═══ PAGE ═══ */
  .page {
    height: 100%;
    overflow-y: auto;
    background: var(--sc-bg-0);
    padding-bottom: var(--sc-bottom-bar-h);
  }

  /* ═══ HEADER — compact, one-line ═══ */
  .header {
    position: relative;
    padding: var(--sc-sp-3) var(--sc-sp-4);
    border-bottom: 1px solid var(--sc-line-soft);
    overflow: hidden;
  }
  .header-bg {
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, var(--sc-accent-bg-subtle) 0%, transparent 50%);
    pointer-events: none;
  }
  .header-inner {
    position: relative;
    z-index: var(--sc-z-base);
    display: flex;
    align-items: baseline;
    gap: var(--sc-sp-2);
  }
  .header-title {
    font-family: var(--sc-font-display);
    font-size: var(--sc-fs-xl);
    color: var(--sc-accent);
    letter-spacing: 2px;
    margin: 0;
  }
  .header-count {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-2xs);
    color: var(--sc-text-3);
    letter-spacing: 0.5px;
  }

  /* ═══ TAB BAR ═══ */
  .tab-bar {
    display: flex;
    padding: 0 var(--sc-sp-4);
    border-bottom: 1px solid var(--sc-line-soft);
    background: var(--sc-bg-0);
    position: sticky;
    top: 0;
    z-index: var(--sc-z-sticky);
  }
  .tab {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: var(--sc-sp-1);
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-sm);
    font-weight: 700;
    letter-spacing: 0.4px;
    border: none;
    background: transparent;
    color: var(--sc-text-3);
    padding: var(--sc-sp-3) var(--sc-sp-3);
    min-height: var(--sc-touch-min, 44px);
    cursor: pointer;
    transition: color var(--sc-duration-fast) var(--sc-ease);
    white-space: nowrap;
  }
  .tab:active {
    background: var(--sc-accent-bg-subtle);
  }
  .tab::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: var(--sc-sp-2);
    right: var(--sc-sp-2);
    height: 2px;
    background: transparent;
    border-radius: var(--sc-radius-pill);
    transition: background var(--sc-duration-fast) var(--sc-ease);
  }
  .tab:hover { color: var(--sc-text-1); }
  .tab.active {
    color: var(--sc-accent);
  }
  .tab.active::after {
    background: var(--sc-accent);
  }
  .tab-icon { font-size: var(--sc-fs-base); }
  .tab-badge {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-2xs);
    font-weight: 800;
    color: var(--sc-text-3);
    background: var(--sc-accent-bg-subtle);
    padding: 0 var(--sc-sp-1);
    border-radius: var(--sc-radius-pill);
    min-width: 16px;
    text-align: center;
  }
  .tab.active .tab-badge {
    color: var(--sc-accent);
    background: var(--sc-accent-bg);
  }

  /* ═══ CONTENT ═══ */
  .content {
    max-width: 680px;
    margin: 0 auto;
    padding: var(--sc-sp-4) var(--sc-sp-4) var(--sc-sp-8);
  }

  /* ── CTA Banner ── */
  .create-cta {
    display: flex;
    align-items: center;
    gap: var(--sc-sp-3);
    padding: var(--sc-sp-3) var(--sc-sp-4);
    background: var(--sc-surface);
    border: 1px solid var(--sc-line-soft);
    border-radius: var(--sc-radius-xl);
    text-decoration: none;
    transition: all var(--sc-duration-fast) var(--sc-ease);
  }
  .create-cta:hover {
    border-color: var(--sc-accent);
    background: var(--sc-accent-bg-subtle);
    box-shadow: var(--sc-shadow-sm);
  }
  .cta-icon {
    font-size: var(--sc-fs-xl);
    flex-shrink: 0;
  }
  .cta-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .cta-title {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-sm);
    font-weight: 800;
    color: var(--sc-text-0);
    letter-spacing: 0.3px;
  }
  .cta-sub {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-2xs);
    color: var(--sc-text-3);
    letter-spacing: 0.2px;
  }
  .cta-arrow {
    margin-left: auto;
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-lg);
    font-weight: 900;
    color: var(--sc-accent);
    flex-shrink: 0;
    transition: transform var(--sc-duration-fast) var(--sc-ease);
  }
  .create-cta:hover .cta-arrow {
    transform: translateX(3px);
  }

  /* ── Feed ── */
  .feed {
    display: flex;
    flex-direction: column;
    gap: var(--sc-sp-3);
  }
  .feed-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sc-sp-2);
  }
  .dir-chips {
    display: flex;
    gap: var(--sc-sp-1);
  }
  .chip {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-xs);
    font-weight: 700;
    border-radius: var(--sc-radius-pill);
    border: 1px solid var(--sc-line-soft);
    padding: var(--sc-sp-1) var(--sc-sp-3);
    min-height: var(--sc-touch-sm, 36px);
    display: inline-flex;
    align-items: center;
    cursor: pointer;
    background: transparent;
    color: var(--sc-text-3);
    transition: all var(--sc-duration-fast) var(--sc-ease);
  }
  .chip:active {
    transform: scale(0.96);
  }
  .chip:hover { color: var(--sc-text-1); border-color: var(--sc-line); }
  .chip.active {
    background: var(--sc-accent-bg);
    color: var(--sc-accent);
    border-color: var(--sc-line);
  }
  .terminal-link {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-2xs);
    font-weight: 700;
    color: var(--sc-text-3);
    text-decoration: none;
    letter-spacing: 0.5px;
    transition: color var(--sc-duration-fast);
    flex-shrink: 0;
  }
  .terminal-link:hover { color: var(--sc-accent); }

  .card-list {
    display: flex;
    flex-direction: column;
    gap: var(--sc-sp-2);
  }

  /* ── AI Section ── */
  .ai-section {
    min-height: 400px;
  }

  /* ═══ RESPONSIVE ═══ */
  @media (max-width: 768px) {
    .page { padding-bottom: 0; }
    .header { padding: var(--sc-sp-2) var(--sc-sp-3); }
    .header-title { font-size: var(--sc-fs-lg); }

    .tab-bar { padding: 0 var(--sc-sp-3); }
    .tab {
      flex: 1;
      justify-content: center;
      padding: var(--sc-sp-2) var(--sc-sp-1);
      font-size: var(--sc-fs-xs);
    }
    .tab-icon { display: none; }

    .content {
      padding: var(--sc-sp-3) var(--sc-sp-3) var(--sc-sp-6);
    }
    .feed-bar { flex-wrap: wrap; }

    .create-cta {
      padding: var(--sc-sp-2) var(--sc-sp-3);
      gap: var(--sc-sp-2);
    }
    .cta-title { font-size: var(--sc-fs-xs); }
    .cta-sub { font-size: 9px; }
  }

  /* ═══ SMALL MOBILE (≤ 480px) ═══ */
  @media (max-width: 480px) {
    .header {
      padding: var(--sc-sp-1_5) var(--sc-sp-2);
    }
    .header-title {
      font-size: var(--sc-fs-base);
      letter-spacing: 1px;
    }
    .header-count { font-size: 9px; }

    .tab-bar {
      padding: 0 var(--sc-sp-2);
      gap: 0;
    }
    .tab {
      padding: var(--sc-sp-2) var(--sc-sp-1);
      font-size: 9px;
      gap: 2px;
    }
    .tab-badge { font-size: 8px; min-width: 14px; padding: 0 3px; }

    .content {
      padding: var(--sc-sp-2) var(--sc-sp-2) var(--sc-sp-4);
    }

    .create-cta {
      padding: var(--sc-sp-2);
      border-radius: var(--sc-radius-lg);
    }
    .cta-icon { font-size: var(--sc-fs-base); }
    .cta-title { font-size: var(--sc-fs-2xs); }
    .cta-sub { display: none; }
    .cta-arrow { font-size: var(--sc-fs-base); }

    .chip {
      padding: var(--sc-sp-1) var(--sc-sp-2);
      font-size: 9px;
    }
    .terminal-link { display: none; }
  }
</style>
