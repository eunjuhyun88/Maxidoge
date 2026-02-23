<!-- ═══════════════════════════════════════════════════════════════
     MAXI DOGE — Context Banner
     Cross-page navigation strip showing relevant context info
═══════════════════════════════════════════════════════════════ -->
<script lang="ts">
  import { openTradeCount, totalQuickPnL } from '$lib/stores/quickTradeStore';
  import { activeSignalCount } from '$lib/stores/trackedSignalStore';
  import { matchHistoryStore, winRate } from '$lib/stores/matchHistoryStore';
  import { userProfileStore, profileTier, hydrateUserProfile } from '$lib/stores/userProfileStore';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  // Current page context
  let { page = 'home' as 'terminal' | 'arena' | 'passport' | 'oracle' | 'signals' | 'live' | 'home' }: { page?: 'terminal' | 'arena' | 'passport' | 'oracle' | 'signals' | 'live' | 'home' } = $props();

  let openPos = $derived($openTradeCount);
  let trackedSigs = $derived($activeSignalCount);
  let pnl = $derived($totalQuickPnL);
  let records = $derived($matchHistoryStore.records);
  let wr = $derived($winRate);
  let profile = $derived($userProfileStore);
  let tier = $derived($profileTier);

  interface BannerItem {
    icon: string;
    text: string;
    href: string;
    color: string;
    show: boolean;
  }

  let items = $derived(getBannerItems(page, openPos, trackedSigs, pnl, records, wr, tier));

  function getBannerItems(
    p: string,
    pos: number,
    sigs: number,
    pnlVal: number,
    recs: typeof records,
    winR: number,
    t: string
  ): BannerItem[] {
    const all: BannerItem[] = [];

    if (p !== 'passport' && pos > 0) {
      all.push({
        icon: '📊',
        text: `${pos} open position${pos > 1 ? 's' : ''} · ${pnlVal >= 0 ? '+' : ''}${pnlVal.toFixed(1)}%`,
        href: '/passport',
        color: pnlVal >= 0 ? '#00ff88' : '#ff2d55',
        show: true,
      });
    }

    if (p !== 'signals' && sigs > 0) {
      all.push({
        icon: '📌',
        text: `${sigs} tracked signal${sigs > 1 ? 's' : ''}`,
        href: '/signals',
        color: '#ff8c3b',
        show: true,
      });
    }

    if (p !== 'arena' && p !== 'passport' && recs.length > 0) {
      const last = recs[0];
      all.push({
        icon: last.win ? '🏆' : '💀',
        text: `Last: ${last.win ? 'WIN' : 'LOSS'} #${last.matchN} · ${last.lp >= 0 ? '+' : ''}${last.lp} LP`,
        href: '/passport',
        color: last.win ? '#00ff88' : '#ff2d55',
        show: true,
      });
    }

    if (p !== 'oracle' && recs.length >= 3) {
      all.push({
        icon: '🔮',
        text: `Arena Win Rate: ${winR}%`,
        href: '/oracle',
        color: '#8b5cf6',
        show: true,
      });
    }

    return all.filter(i => i.show).slice(0, 2);
  }

  onMount(() => {
    hydrateUserProfile();
  });
</script>

{#if items.length > 0}
  <div class="ctx-strip">
    {#each items as item}
      <button class="ctx-item" on:click={() => goto(item.href)}>
        <span class="ctx-i">{item.icon}</span>
        <span class="ctx-t" style="color:{item.color}">{item.text}</span>
        <span class="ctx-arrow">→</span>
      </button>
    {/each}
  </div>
{/if}

<style>
  .ctx-strip {
    display: flex;
    gap: 4px;
    padding: 4px 12px;
    background: rgba(0,0,0,.4);
    border-bottom: 1px solid rgba(255,255,255,.06);
    overflow-x: auto;
    scrollbar-width: none;
  }
  .ctx-strip::-webkit-scrollbar { display: none; }

  .ctx-item {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 6px;
    border: 1px solid rgba(255,255,255,.08);
    background: rgba(255,255,255,.03);
    cursor: pointer;
    transition: all .15s;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .ctx-item:hover {
    background: rgba(255,255,255,.06);
    border-color: rgba(255,255,255,.15);
  }
  .ctx-i { font-size: 10px; }
  .ctx-t {
    font-family: var(--fm);
    font-size: 7px;
    font-weight: 700;
    letter-spacing: .5px;
  }
  .ctx-arrow {
    font-size: 8px;
    color: rgba(255,255,255,.25);
    transition: color .15s;
  }
  .ctx-item:hover .ctx-arrow { color: rgba(255,255,255,.5); }
</style>
