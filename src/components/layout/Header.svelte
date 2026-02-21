<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { gameState, type ViewMode } from '$lib/stores/gameState';
  import { walletStore, isWalletConnected, openWalletModal, disconnectWallet } from '$lib/stores/walletStore';
  import { fetchPrices, subscribeMiniTicker } from '$lib/api/binance';
  import { formatTimeframeLabel } from '$lib/utils/timeframe';

  $: state = $gameState;
  $: wallet = $walletStore;
  $: connected = $isWalletConnected;

  // Derive active route from actual URL
  $: activePath = $page.url.pathname;

  let wsCleanup: (() => void) | null = null;

  // Navigation items (v7 style)
  const NAV_ITEMS = [
    { path: '/terminal', label: 'TERMINAL', icon: '📊' },
    { path: '/arena', label: '🐕 ARENA', icon: '', accent: true },
    { path: '/passport', label: 'PASSPORT', icon: '📋' },
    { path: '/oracle', label: 'ORACLE', icon: '🔮' },
    { path: '/live', label: 'LIVE', icon: '👀' },
    { path: '/signals', label: 'SIGNALS', icon: '🔔' },
  ];

  onMount(async () => {
    try {
      const prices = await fetchPrices(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']);
      const btc = prices['BTCUSDT'] || state.prices.BTC;
      const eth = prices['ETHUSDT'] || state.prices.ETH;
      const sol = prices['SOLUSDT'] || state.prices.SOL;
      gameState.update(s => ({
        ...s,
        prices: { BTC: Math.round(btc), ETH: Math.round(eth), SOL: +sol.toFixed(2) },
        bases: { BTC: Math.round(btc), ETH: Math.round(eth), SOL: +sol.toFixed(2) }
      }));
    } catch (e) {
      console.warn('[Header] Failed to fetch initial prices, using defaults');
    }

    // Throttle WebSocket price updates to max 1/sec to reduce store churn
    try {
      let _pendingPrices: Record<string, number> = {};
      let _priceFlushTimer: ReturnType<typeof setTimeout> | null = null;
      wsCleanup = subscribeMiniTicker(['BTCUSDT', 'ETHUSDT', 'SOLUSDT'], (update) => {
        Object.assign(_pendingPrices, update);
        if (_priceFlushTimer) return; // already scheduled
        _priceFlushTimer = setTimeout(() => {
          _priceFlushTimer = null;
          const batch = _pendingPrices;
          _pendingPrices = {};
          gameState.update(s => {
            const newPrices = { ...s.prices };
            if (batch['BTCUSDT']) newPrices.BTC = Math.round(batch['BTCUSDT']);
            if (batch['ETHUSDT']) newPrices.ETH = Math.round(batch['ETHUSDT']);
            if (batch['SOLUSDT']) newPrices.SOL = +(batch['SOLUSDT'] || s.prices.SOL).toFixed(2);
            return { ...s, prices: newPrices };
          });
        }, 1000);
      });
    } catch (e) {
      console.warn('[Header] WebSocket connection failed');
    }
  });

  onDestroy(() => {
    if (wsCleanup) wsCleanup();
  });

  function nav(path: string) {
    goto(path);
  }

  function handleBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
      return;
    }
    goto('/');
  }

  function isActive(path: string): boolean {
    if (path === '/arena') return activePath.startsWith('/arena');
    return activePath.startsWith(path);
  }

  function pctClass(val: number): string {
    return val >= 0 ? 'up' : 'dn';
  }

  function pctStr(base: number, cur: number): string {
    if (base === 0) return '+0.00%';
    const pct = ((cur - base) / base * 100).toFixed(2);
    return (Number(pct) >= 0 ? '+' : '') + pct + '%';
  }

  // Selected pair → derive token name and price
  $: selectedToken = state.pair.split('/')[0] || 'BTC';
  $: selectedPrice = state.prices[selectedToken as keyof typeof state.prices] || state.prices.BTC;
  $: selectedBase = state.bases[selectedToken as keyof typeof state.bases] || state.bases.BTC;
</script>

<nav id="nav">
  <!-- Back Button (hidden on home) -->
  {#if activePath !== '/'}
    <button class="nav-back" on:click={handleBack}>←</button>
  {/if}

  <!-- Logo -->
  <button class="nav-logo" on:click={() => nav('/')}>
    MAXI<span class="pk">⚡</span>DOGE
  </button>

  <div class="nav-divider"></div>

  <!-- ★ Selected Token Ticker (FRONT AND CENTER) -->
  <div class="selected-ticker">
    <span class="st-pair">{state.pair}</span>
    <span class="st-price">${Math.round(selectedPrice).toLocaleString()}</span>
    <span class="st-chg {pctClass(selectedPrice - selectedBase)}">{pctStr(selectedBase, selectedPrice)}</span>
    <span class="st-tf">{formatTimeframeLabel(state.timeframe)}</span>
  </div>

  <div class="nav-divider"></div>

  <!-- Navigation Tabs (v7 style) -->
  {#each NAV_ITEMS as item}
    <button
      class="nav-tab"
      class:active={isActive(item.path)}
      class:arena-accent={item.accent}
      on:click={() => nav(item.path)}
    >
      {#if item.icon}<span class="tab-icon">{item.icon}</span>{/if}
      {item.label}
    </button>
  {/each}

  <!-- Right Section -->
  <div class="nav-right">
    <div class="score-badge">
      <span class="score-icon">⚡</span>
      SCORE <b>{Math.round(state.score)}</b>
    </div>

    <!-- Wallet Button -->
    {#if connected}
      <button class="wallet-btn connected" on:click={openWalletModal}>
        <span class="wallet-dot"></span>
        {wallet.shortAddr}
      </button>
    {:else}
      <button class="wallet-btn" on:click={openWalletModal}>
        🔗 CONNECT
      </button>
    {/if}

    <button class="settings-btn" on:click={() => nav('/settings')}>⚙️</button>
  </div>
</nav>

<style>
  #nav {
    background: var(--yel);
    border-bottom: 3px solid #000;
    display: flex;
    align-items: center;
    padding: 0 10px;
    gap: 0;
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 110;
    flex-shrink: 0;
    height: 36px;
    font-family: var(--fm);
    color: #000;
  }

  .nav-back {
    font-family: var(--fm);
    font-size: 12px;
    font-weight: 700;
    color: var(--blk);
    background: none;
    border: 2px solid var(--blk);
    padding: 1px 8px;
    cursor: pointer;
    letter-spacing: 1px;
    margin-right: 4px;
    transition: all .15s;
  }
  .nav-back:hover {
    background: var(--blk);
    color: var(--yel);
  }

  .nav-logo {
    font-family: var(--fd);
    font-size: 16px;
    letter-spacing: 2px;
    color: var(--blk);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
    line-height: 1;
    transition: transform .12s;
  }
  .nav-logo:hover { transform: scale(1.03); }
  .nav-logo .pk { color: var(--pk); }

  .nav-divider {
    width: 1px;
    height: 18px;
    background: #000;
    opacity: .3;
    margin: 0 6px;
    flex-shrink: 0;
  }

  /* ── ★ Selected Token Ticker ── */
  .selected-ticker {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 0 4px;
    flex-shrink: 0;
  }
  .st-pair {
    font-family: var(--fd);
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 1.5px;
    color: var(--blk);
  }
  .st-price {
    font-family: var(--fd);
    font-size: 13px;
    font-weight: 900;
    color: var(--blk);
    letter-spacing: .5px;
  }
  .st-chg {
    font-family: var(--fm);
    font-size: 8px;
    font-weight: 700;
    padding: 1px 5px;
    border: 1.5px solid;
    border-radius: 3px;
  }
  .st-chg.up {
    color: #006633;
    background: rgba(0,255,136,.2);
    border-color: rgba(0,100,50,.5);
  }
  .st-chg.dn {
    color: #cc0033;
    background: rgba(255,45,85,.2);
    border-color: rgba(200,0,50,.5);
  }
  .st-tf {
    font-family: var(--fm);
    font-size: 8px;
    font-weight: 700;
    color: rgba(0,0,0,.4);
    letter-spacing: 1px;
    border: 1px solid rgba(0,0,0,.15);
    padding: 1px 4px;
    border-radius: 2px;
  }

  /* ── v7-style Nav Tabs ── */
  .nav-tab {
    font-family: var(--fm);
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 1.5px;
    color: var(--blk);
    padding: 0 10px;
    height: 100%;
    display: flex;
    align-items: center;
    gap: 3px;
    border: none;
    border-right: 1px solid rgba(0,0,0,.12);
    background: none;
    cursor: pointer;
    transition: background .15s, color .15s;
    white-space: nowrap;
    position: relative;
  }
  .nav-tab:last-of-type {
    border-right: none;
  }
  .nav-tab:hover {
    background: rgba(0,0,0,.06);
  }
  .nav-tab.active {
    background: var(--blk);
    color: var(--yel);
  }
  .nav-tab.active::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--pk);
  }

  /* Arena accent tab */
  .nav-tab.arena-accent {
    font-weight: 900;
    letter-spacing: 2px;
  }
  .nav-tab.arena-accent.active {
    background: var(--pk);
    color: #fff;
  }
  .nav-tab.arena-accent.active::after {
    background: var(--yel);
  }

  .tab-icon {
    font-size: 9px;
    line-height: 1;
  }

  /* ── Right Section ── */
  .nav-right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 5px;
    flex-shrink: 0;
  }

  .score-badge {
    font-family: var(--fm);
    font-size: 9px;
    font-weight: 700;
    background: var(--blk);
    color: var(--yel);
    border: 2px solid var(--blk);
    padding: 2px 8px;
    letter-spacing: 1.5px;
    display: flex;
    align-items: center;
    gap: 3px;
  }
  .score-badge b {
    font-family: var(--fd);
    font-size: 11px;
  }
  .score-icon {
    font-size: 9px;
  }

  /* ── Wallet Button ── */
  .wallet-btn {
    font-family: var(--fm);
    font-size: 9px;
    font-weight: 700;
    background: var(--pk);
    color: #fff;
    border: 2px solid #000;
    padding: 2px 10px;
    cursor: pointer;
    letter-spacing: 1px;
    transition: all .15s;
    box-shadow: 2px 2px 0 #000;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .wallet-btn:hover {
    transform: translate(-1px, -1px);
    box-shadow: 3px 3px 0 #000;
  }
  .wallet-btn.connected {
    background: var(--blk);
    color: var(--grn);
    font-size: 8px;
  }
  .wallet-dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: var(--grn);
    box-shadow: 0 0 6px var(--grn);
  }

  .settings-btn {
    font-size: 13px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px 4px;
    transition: transform .15s;
    line-height: 1;
  }
  .settings-btn:hover { transform: scale(1.15); }
</style>
