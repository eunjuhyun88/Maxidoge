<script lang="ts">
  import type { HeadlineEx, PolicyCard } from '$lib/terminal/intel/intelTypes';
  import { policyBiasLabel, policyBiasClass, scoreBreakdownText, safeExternalUrl } from '$lib/terminal/intel/intelHelpers';

  interface Props {
    visibleHeadlines?: HeadlineEx[];
    headlineLoading?: boolean;
    headlineHasMore?: boolean;
    headlineSortBy?: 'importance' | 'time';
    currentToken?: string;
    policyCardsForTab?: PolicyCard[];
    densityMode?: 'essential' | 'pro';
    onToggleSort?: () => void;
    onLoadMore?: () => void;
  }

  let {
    visibleHeadlines = [],
    headlineLoading = false,
    headlineHasMore = true,
    headlineSortBy = 'importance',
    currentToken = 'BTC',
    policyCardsForTab = [],
    densityMode = 'essential',
    onToggleSort = () => {},
    onLoadMore = () => {},
  }: Props = $props();

  function handleScroll(e: Event) {
    const el = e.target as HTMLElement;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 60) {
      onLoadMore();
    }
  }
</script>

{#if policyCardsForTab.length > 0}
  <div class="policy-cards-wrap">
    {#each policyCardsForTab as card (card.id)}
      <div class="policy-card">
        <div class="policy-card-head">
          <span class="policy-card-title">{card.title}</span>
          <span class="policy-card-bias {policyBiasClass(card.bias)}">{policyBiasLabel(card.bias)}</span>
        </div>
        <div class="policy-card-row"><strong>What:</strong> {card.what}</div>
        <div class="policy-card-row"><strong>So What:</strong> {card.soWhat}</div>
        <div class="policy-card-row"><strong>Now What:</strong> {card.nowWhat}</div>
        <div class="policy-card-row"><strong>Why:</strong> {card.why}</div>
        <div class="policy-card-row"><strong>Help WHY:</strong> {card.helpfulnessWhy}</div>
        <div class="policy-card-score">
          <span>Gate {card.gate.weightedScore.toFixed(1)}</span>
          <span>{scoreBreakdownText(card.gate.scores)}</span>
        </div>
      </div>
    {/each}
  </div>
{/if}

<div class="hl-header-bar">
  <span class="hl-ticker-badge">{currentToken} NEWS</span>
  <button class="hl-sort-btn" onclick={onToggleSort} title="Toggle sort">
    {headlineSortBy === 'importance' ? '🔥 HOT' : '🕐 NEW'}
  </button>
</div>
<div class="hl-list hl-scrollable" onscroll={handleScroll}>
  {#if visibleHeadlines.length === 0 && !headlineLoading}
    <div class="flow-empty">No headlines yet</div>
  {/if}
  {#each visibleHeadlines as hl}
    {@const safeHeadlineUrl = safeExternalUrl(hl.link)}
    {#if safeHeadlineUrl}
      <a class="hl-row hl-linked" href={safeHeadlineUrl} target="_blank" rel="noopener noreferrer">
        <span class="hl-icon">{hl.icon}</span>
        <div class="hl-main">
          <span class="hl-txt" class:bull={hl.bull}>{hl.text}</span>
          <div class="hl-meta">
            <span class="hl-time">{hl.time}</span>
            {#if hl.network && hl.network !== 'rss'}
              <span class="hl-net">{hl.network}</span>
            {/if}
            {#if densityMode === 'pro' && hl.interactions && hl.interactions > 0}
              <span class="hl-engage">🔥 {hl.interactions > 1000 ? `${(hl.interactions / 1000).toFixed(1)}K` : hl.interactions}</span>
            {/if}
            {#if densityMode === 'pro' && hl.creator && hl.network !== 'rss'}
              <span class="hl-creator">@{hl.creator.slice(0, 15)}</span>
            {/if}
          </div>
        </div>
        <span class="hl-ext">&#8599;</span>
      </a>
    {:else}
      <div class="hl-row">
        <span class="hl-icon">{hl.icon}</span>
        <div class="hl-main">
          <span class="hl-txt" class:bull={hl.bull}>{hl.text}</span>
          <div class="hl-meta">
            <span class="hl-time">{hl.time}</span>
            {#if hl.network && hl.network !== 'rss'}
              <span class="hl-net">{hl.network}</span>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  {/each}
  {#if headlineLoading}
    <div class="hl-loading">Loading more...</div>
  {/if}
  {#if densityMode === 'pro' && !headlineHasMore && visibleHeadlines.length > 0}
    <div class="hl-end">— end of headlines —</div>
  {/if}
</div>

<style>
  .policy-cards-wrap {
    display: grid; gap: 6px; padding: 6px 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.02);
    max-height: 240px; overflow: auto;
  }
  .policy-card {
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(0, 0, 0, 0.2); border-radius: 8px;
    padding: 7px 8px; display: grid; gap: 4px;
  }
  .policy-card-head {
    display: flex; justify-content: space-between; align-items: center; gap: 6px;
  }
  .policy-card-title {
    font-size: 10px; letter-spacing: 0.9px; font-weight: 700;
    color: rgba(255, 255, 255, 0.86);
  }
  .policy-card-bias {
    font-size: 10px; font-weight: 700; padding: 1px 6px;
    border-radius: 999px; border: 1px solid rgba(255, 255, 255, 0.2);
  }
  .policy-card-bias.long { color: #00e676; border-color: rgba(0, 230, 118, 0.4); }
  .policy-card-bias.short { color: #ff5252; border-color: rgba(255, 82, 82, 0.4); }
  .policy-card-bias.wait { color: #ffd54f; border-color: rgba(255, 213, 79, 0.4); }
  .policy-card-row {
    font-size: 11px; line-height: 1.35; color: rgba(255, 255, 255, 0.82);
  }
  .policy-card-row :global(strong) {
    color: rgba(var(--t-accent-rgb), 0.84); font-weight: 700; margin-right: 4px;
  }
  .policy-card-score {
    margin-top: 2px; display: flex; flex-wrap: wrap; gap: 6px;
    font-size: 10px; color: rgba(255, 255, 255, 0.68);
  }

  .hl-header-bar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 4px 8px; background: rgba(var(--t-accent-rgb),.06);
    border-bottom: 1px solid rgba(var(--t-accent-rgb),.1);
  }
  .hl-ticker-badge {
    font-family: var(--fm); font-size: 9px; font-weight: 900;
    letter-spacing: 1.5px; color: var(--yel);
  }
  .hl-sort-btn {
    font-family: var(--fm); font-size: 9px; font-weight: 800;
    letter-spacing: .5px; padding: 2px 6px;
    background: rgba(255,255,255,.05); border: 1px solid rgba(var(--t-accent-rgb),.2);
    border-radius: 3px; color: rgba(var(--t-accent-rgb),.7); cursor: pointer;
    transition: all .12s;
  }
  .hl-sort-btn:hover { background: rgba(var(--t-accent-rgb),.12); color: var(--yel); }

  .hl-list { display: flex; flex-direction: column; min-height: 0; }
  .hl-scrollable {
    flex: 1 1 auto; min-height: 140px; overflow-y: auto; max-height: none;
    scroll-behavior: smooth; -webkit-overflow-scrolling: touch;
    overscroll-behavior-y: contain;
  }
  .hl-scrollable::-webkit-scrollbar { width: 2px; }
  .hl-scrollable::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }

  .hl-row {
    display: flex; gap: 6px; padding: 7px 8px;
    border-bottom: 1px solid rgba(var(--t-accent-rgb),.08);
    cursor: pointer; align-items: flex-start;
  }
  .hl-row:hover { background: rgba(var(--t-accent-rgb),.03); }
  .hl-icon { font-size: 10px; flex-shrink: 0; width: 16px; padding-top: 1px; }
  .hl-main { flex: 1; min-width: 0; }
  .hl-txt { font-family: var(--fm); font-size: 11px; line-height: 1.45; color: rgba(255,255,255,.8); display: block; }
  .hl-txt.bull { color: var(--grn); }
  .hl-meta { display: flex; gap: 6px; align-items: center; margin-top: 2px; flex-wrap: wrap; }
  .hl-time { font-family: var(--fm); font-size: 9px; color: rgba(255,255,255,.3); }
  .hl-net {
    font-family: var(--fm); font-size: 9px; font-weight: 700; letter-spacing: .5px;
    color: rgba(139,92,246,.7); background: rgba(139,92,246,.1);
    padding: 0 4px; border-radius: 2px;
  }
  .hl-engage { font-family: var(--fm); font-size: 9px; font-weight: 700; color: rgba(255,140,59,.8); }
  .hl-creator { font-family: var(--fm); font-size: 9px; color: rgba(255,255,255,.3); }
  a.hl-linked { text-decoration: none; color: inherit; }
  .hl-linked:hover .hl-txt { text-decoration: underline; }
  .hl-ext { font-size: 10px; opacity: 0; transition: opacity .15s; flex-shrink: 0; color: rgba(var(--t-accent-rgb),.6); padding-top: 1px; }
  .hl-linked:hover .hl-ext { opacity: 1; }
  .hl-loading, .hl-end {
    font-family: var(--fm); font-size: 9px; color: rgba(255,255,255,.3);
    text-align: center; padding: 10px 0; letter-spacing: 1px;
  }
  .flow-empty { font-family: var(--fm); font-size: 9px; color: rgba(255,255,255,.4); text-align: center; padding: 16px 0; letter-spacing: .5px; }

  @supports (animation-timeline: view()) {
    .hl-row { animation: intelReveal 1ms both; animation-timeline: view(); animation-range: entry 0% cover 24%; }
  }
  @keyframes intelReveal {
    from { opacity: 0.4; transform: translateY(10px) scale(0.985); filter: saturate(0.88); }
    to { opacity: 1; transform: translateY(0) scale(1); filter: saturate(1); }
  }
</style>
