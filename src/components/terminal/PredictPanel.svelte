<script lang="ts">
  import { onMount } from 'svelte';
  import { predictMarkets, predictLoading, loadPolymarkets, setCategoryFilter, voteMarket } from '$lib/stores/predictStore';
  import { parseOutcomePrices, formatVolume } from '$lib/api/polymarket';

  let filter = '';
  let loaded = false;

  const CATEGORIES = [
    { label: 'ALL', value: '' },
    { label: 'CRYPTO', value: 'crypto' },
    { label: 'POLITICS', value: 'politics' },
    { label: 'SPORTS', value: 'sports' },
    { label: 'TECH', value: 'tech' },
    { label: 'POP', value: 'pop-culture' }
  ];

  onMount(() => {
    if (!loaded) {
      loadPolymarkets();
      loaded = true;
    }
  });

  function handleFilter(val: string) {
    filter = val;
    setCategoryFilter(val);
  }

  function handleVote(marketId: string, vote: 'YES' | 'NO') {
    voteMarket(marketId, vote);
  }

  function formatEndDate(dateStr: string): string {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diff = d.getTime() - now.getTime();
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      if (days <= 0) return 'Ended';
      if (days === 1) return '1 day';
      if (days < 30) return `${days}d`;
      if (days < 365) return `${Math.floor(days / 30)}mo`;
      return `${Math.floor(days / 365)}y`;
    } catch {
      return '';
    }
  }
</script>

<div class="predict-panel">
  <!-- Category Filter -->
  <div class="pm-filters">
    {#each CATEGORIES as cat}
      <button
        class="pm-filter-btn"
        class:active={filter === cat.value}
        on:click={() => handleFilter(cat.value)}
      >{cat.label}</button>
    {/each}
  </div>

  <!-- Loading state -->
  {#if $predictLoading}
    <div class="pm-loading">
      <div class="pm-spinner"></div>
      <span class="pm-load-text">FETCHING MARKETS...</span>
    </div>

  <!-- Markets list -->
  {:else if $predictMarkets.length > 0}
    <div class="pm-list">
      {#each $predictMarkets as market (market.id)}
        {@const prices = parseOutcomePrices(market.outcomePrices)}
        {@const yesPct = Math.round(prices.yes * 100)}
        {@const noPct = Math.round(prices.no * 100)}
        {@const userVote = null}

        <a class="pm-card pm-linked" href="https://polymarket.com/event/{market.slug}" target="_blank" rel="noopener noreferrer">
          <!-- Header with category + end date -->
          <div class="pm-card-head">
            {#if market.category}
              <span class="pm-cat">{market.category.toUpperCase()}</span>
            {/if}
            {#if market.endDate}
              <span class="pm-end">⏳ {formatEndDate(market.endDate)}</span>
            {/if}
          </div>

          <!-- Question -->
          <div class="pm-question">{market.question}</div>

          <!-- Probability bar -->
          <div class="pm-prob-wrap">
            <div class="pm-prob-yes" style="width:{yesPct}%"></div>
            <div class="pm-prob-no" style="width:{noPct}%"></div>
          </div>

          <!-- Percentage labels -->
          <div class="pm-pct-row">
            <span class="pm-pct yes">YES {yesPct}¢</span>
            <span class="pm-pct no">NO {noPct}¢</span>
          </div>

          <!-- Volume & Liquidity -->
          <div class="pm-meta">
            <span class="pm-vol">VOL {formatVolume(market.volume)}</span>
            {#if market.liquidity > 0}
              <span class="pm-liq">LIQ {formatVolume(market.liquidity)}</span>
            {/if}
          </div>

          <!-- Vote buttons + Polymarket link -->
          <div class="pm-vote-row">
            <button
              class="pm-vote-btn yes"
              on:click|preventDefault|stopPropagation={() => handleVote(market.id, 'YES')}
            >↑ YES</button>
            <button
              class="pm-vote-btn no"
              on:click|preventDefault|stopPropagation={() => handleVote(market.id, 'NO')}
            >↓ NO</button>
          </div>
          <div class="pm-polylink">&#8599; TRADE ON POLYMARKET</div>
        </a>
      {/each}
    </div>

  <!-- Empty state -->
  {:else}
    <div class="pm-empty">
      <div class="pm-empty-icon">📊</div>
      <div class="pm-empty-title">NO MARKETS FOUND</div>
      <div class="pm-empty-sub">Try a different category or check back later</div>
      <button class="pm-retry-btn" on:click={() => loadPolymarkets()}>↻ RETRY</button>
    </div>
  {/if}
</div>

<style>
  .predict-panel {
    display: flex;
    flex-direction: column;
    gap: 6px;
    height: 100%;
  }

  /* Filter chips */
  .pm-filters {
    display: flex;
    gap: 3px;
    flex-wrap: wrap;
    padding-bottom: 4px;
    border-bottom: 1px solid rgba(232,150,125,.1);
  }
  .pm-filter-btn {
    font-family: var(--fm);
    font-size: 7px;
    font-weight: 800;
    letter-spacing: .5px;
    padding: 3px 7px;
    background: rgba(255,255,255,.04);
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 3px;
    color: rgba(255,255,255,.4);
    cursor: pointer;
    transition: all .12s;
  }
  .pm-filter-btn:hover {
    color: var(--yel);
    border-color: rgba(232,150,125,.3);
  }
  .pm-filter-btn.active {
    background: rgba(232,150,125,.12);
    border-color: rgba(232,150,125,.4);
    color: var(--yel);
  }

  /* Loading */
  .pm-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 30px 0;
    gap: 10px;
  }
  .pm-spinner {
    width: 24px;
    height: 24px;
    border: 2px solid rgba(232,150,125,.15);
    border-top-color: var(--yel);
    border-radius: 50%;
    animation: pm-spin .8s linear infinite;
  }
  @keyframes pm-spin {
    to { transform: rotate(360deg); }
  }
  .pm-load-text {
    font-family: var(--fm);
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 2px;
    color: rgba(255,255,255,.35);
  }

  /* Market list */
  .pm-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  /* Market card */
  .pm-card {
    border: 2px solid rgba(255,255,255,.08);
    background: rgba(255,255,255,.02);
    padding: 10px;
    transition: border-color .15s;
    position: relative;
    overflow: hidden;
  }
  .pm-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1.5px;
    background: linear-gradient(90deg, var(--grn), var(--red));
    opacity: .4;
  }
  .pm-card:hover {
    border-color: rgba(232,150,125,.2);
  }
  .pm-linked {
    display: block;
    text-decoration: none;
    color: inherit;
    cursor: pointer;
  }
  .pm-linked:hover .pm-question { text-decoration: underline; }
  .pm-polylink {
    margin-top: 6px;
    font-family: var(--fm);
    font-size: 7px;
    font-weight: 800;
    letter-spacing: 1px;
    color: rgba(139,92,246,.45);
    text-align: right;
    transition: color .15s;
  }
  .pm-linked:hover .pm-polylink { color: rgba(139,92,246,.9); }

  .pm-card-head {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 5px;
  }
  .pm-cat {
    font-family: var(--fm);
    font-size: 7px;
    font-weight: 800;
    letter-spacing: 1px;
    color: var(--yel);
    background: rgba(232,150,125,.1);
    border: 1px solid rgba(232,150,125,.2);
    padding: 1px 5px;
  }
  .pm-end {
    font-family: var(--fm);
    font-size: 7px;
    color: rgba(255,255,255,.3);
    margin-left: auto;
  }

  .pm-question {
    font-family: var(--fm);
    font-size: 10px;
    font-weight: 700;
    color: #fff;
    line-height: 1.4;
    margin-bottom: 8px;
  }

  /* Probability bar */
  .pm-prob-wrap {
    height: 5px;
    background: rgba(255,255,255,.06);
    display: flex;
    border-radius: 2px;
    overflow: hidden;
    margin-bottom: 4px;
  }
  .pm-prob-yes {
    background: linear-gradient(90deg, #00cc6a, var(--grn));
    height: 100%;
    transition: width .6s ease;
  }
  .pm-prob-no {
    background: linear-gradient(90deg, var(--red), #cc0033);
    height: 100%;
    transition: width .6s ease;
  }

  .pm-pct-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 4px;
  }
  .pm-pct {
    font-family: var(--fm);
    font-size: 9px;
    font-weight: 800;
    letter-spacing: .5px;
  }
  .pm-pct.yes { color: var(--grn); }
  .pm-pct.no { color: var(--red); }

  /* Meta */
  .pm-meta {
    display: flex;
    gap: 8px;
    margin-bottom: 6px;
  }
  .pm-vol, .pm-liq {
    font-family: var(--fm);
    font-size: 7px;
    font-weight: 700;
    letter-spacing: .5px;
    color: rgba(255,255,255,.35);
  }

  /* Vote buttons */
  .pm-vote-row {
    display: flex;
    gap: 4px;
  }
  .pm-vote-btn {
    flex: 1;
    padding: 6px;
    font-family: var(--fm);
    font-size: 8px;
    font-weight: 800;
    letter-spacing: 1px;
    cursor: pointer;
    transition: all .15s;
  }
  .pm-vote-btn.yes {
    background: rgba(0,255,136,.08);
    color: var(--grn);
    border: 1.5px solid rgba(0,255,136,.25);
  }
  .pm-vote-btn.yes:hover {
    background: rgba(0,255,136,.18);
    border-color: rgba(0,255,136,.5);
  }
  .pm-vote-btn.no {
    background: rgba(255,45,85,.08);
    color: var(--red);
    border: 1.5px solid rgba(255,45,85,.25);
  }
  .pm-vote-btn.no:hover {
    background: rgba(255,45,85,.18);
    border-color: rgba(255,45,85,.5);
  }

  /* Empty state */
  .pm-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 30px 10px;
    gap: 6px;
  }
  .pm-empty-icon {
    font-size: 24px;
    opacity: .6;
  }
  .pm-empty-title {
    font-family: var(--fm);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 2px;
    color: rgba(255,255,255,.4);
  }
  .pm-empty-sub {
    font-family: var(--fm);
    font-size: 8px;
    color: rgba(255,255,255,.25);
  }
  .pm-retry-btn {
    margin-top: 6px;
    font-family: var(--fm);
    font-size: 8px;
    font-weight: 800;
    letter-spacing: 1px;
    padding: 5px 14px;
    background: rgba(232,150,125,.1);
    color: var(--yel);
    border: 1.5px solid rgba(232,150,125,.3);
    cursor: pointer;
    transition: all .15s;
  }
  .pm-retry-btn:hover {
    background: rgba(232,150,125,.2);
    border-color: var(--yel);
  }
</style>
