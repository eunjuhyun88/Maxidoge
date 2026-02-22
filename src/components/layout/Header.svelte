<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { gameState } from '$lib/stores/gameState';
  import { walletStore, isWalletConnected, openWalletModal } from '$lib/stores/walletStore';
  import { hydrateDomainStores } from '$lib/stores/hydration';
  import { fetchPrices, subscribeMiniTicker } from '$lib/api/binance';

  $: state = $gameState;
  $: wallet = $walletStore;
  $: connected = $isWalletConnected;

  // Derive active route from actual URL
  $: activePath = $page.url.pathname;

  let wsCleanup: (() => void) | null = null;
  function normalizePrice(price: number): number {
    if (!Number.isFinite(price)) return 0;
    const abs = Math.abs(price);
    if (abs >= 1000) return Number(price.toFixed(2));
    if (abs >= 1) return Number(price.toFixed(4));
    return Number(price.toFixed(6));
  }

  // Navigation items
  const NAV_ITEMS = [
    { path: '/terminal', label: 'TERMINAL', icon: '//'},
    { path: '/arena', label: 'ARENA', icon: '>>', accent: true },
    { path: '/signals', label: 'COMMUNITY', icon: '::' },
    { path: '/oracle', label: 'ORACLE', icon: '**' },
    { path: '/passport', label: 'HOLDING', icon: '##' },
  ];

  onMount(async () => {
    void hydrateDomainStores();

    try {
      const prices = await fetchPrices(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']);
      const btc = prices['BTCUSDT'] || state.prices.BTC;
      const eth = prices['ETHUSDT'] || state.prices.ETH;
      const sol = prices['SOLUSDT'] || state.prices.SOL;
      gameState.update(s => ({
        ...s,
        prices: {
          BTC: normalizePrice(btc),
          ETH: normalizePrice(eth),
          SOL: normalizePrice(sol)
        },
        bases: {
          BTC: normalizePrice(btc),
          ETH: normalizePrice(eth),
          SOL: normalizePrice(sol)
        }
      }));
    } catch (e) {
      console.warn('[Header] Failed to fetch initial prices, using defaults');
    }

    try {
      let _pendingPrices: Record<string, number> = {};
      let _priceFlushTimer: ReturnType<typeof setTimeout> | null = null;
      wsCleanup = subscribeMiniTicker(['BTCUSDT', 'ETHUSDT', 'SOLUSDT'], (update) => {
        Object.assign(_pendingPrices, update);
        if (_priceFlushTimer) return;
        _priceFlushTimer = setTimeout(() => {
          _priceFlushTimer = null;
          const batch = _pendingPrices;
          _pendingPrices = {};
          gameState.update(s => {
            const newPrices = { ...s.prices };
            if (batch['BTCUSDT']) newPrices.BTC = normalizePrice(batch['BTCUSDT']);
            if (batch['ETHUSDT']) newPrices.ETH = normalizePrice(batch['ETHUSDT']);
            if (batch['SOLUSDT']) newPrices.SOL = normalizePrice(batch['SOLUSDT'] || s.prices.SOL);
            return { ...s, prices: newPrices };
          });
        }, 350);
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

  $: selectedToken = state.pair.split('/')[0] || 'BTC';
  $: selectedPrice = state.prices[selectedToken as keyof typeof state.prices] || state.prices.BTC;
  $: selectedBase = state.bases[selectedToken as keyof typeof state.bases] || state.bases.BTC;
  $: selectedPriceText = Number(selectedPrice || 0).toLocaleString('en-US', {
    minimumFractionDigits: selectedPrice >= 1000 ? 2 : 4,
    maximumFractionDigits: selectedPrice >= 1000 ? 2 : 4
  });
</script>

<nav id="nav">
  {#if activePath !== '/'}
    <button class="nav-back" on:click={handleBack}>←</button>
  {/if}

  <button class="nav-logo" on:click={() => nav('/')}>
    MAXI<span class="bolt">⚡</span>DOGE
  </button>

  <div class="nav-sep"></div>

  <div class="selected-ticker">
    <span class="st-pair">{state.pair}</span>
    <span class="st-price">${selectedPriceText}</span>
  </div>

  <div class="nav-sep"></div>

  {#each NAV_ITEMS as item}
    <button
      class="nav-tab"
      class:active={isActive(item.path)}
      class:arena-accent={item.accent}
      on:click={() => nav(item.path)}
    >
      <span class="tab-icon">{item.icon}</span>
      {item.label}
    </button>
  {/each}

  <div class="nav-right">
    <div class="score-badge">
      <span class="score-bolt">⚡</span>
      SCORE <b>{Math.round(state.score)}</b>
    </div>

    {#if connected}
      <button class="wallet-btn connected" on:click={openWalletModal}>
        <span class="wallet-dot"></span>
        {wallet.shortAddr}
      </button>
    {:else}
      <button class="wallet-btn" on:click={openWalletModal}>
        CONNECT
      </button>
    {/if}

    <button class="settings-btn" on:click={() => nav('/settings')}>⚙</button>
  </div>
</nav>

<style>
  /* ═══════════════════════════════════════
     HEADER — LOOX SPACE THEME
     Dark green-black + salmon pink
     ═══════════════════════════════════════ */
  #nav {
    background: #0a1a0d;
    border-bottom: 1px solid rgba(232,150,125,0.15);
    display: flex;
    align-items: center;
    padding: 0 12px;
    gap: 0;
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 110;
    flex-shrink: 0;
    height: 42px;
    font-family: var(--fp, 'Press Start 2P', monospace);
    color: #F0EDE4;
  }

  .nav-back {
    font-family: var(--fp);
    font-size: 12px;
    color: #E8967D;
    background: none;
    border: 1px solid rgba(232,150,125,0.3);
    border-radius: 4px;
    padding: 2px 8px;
    cursor: pointer;
    margin-right: 6px;
    transition: all .15s;
  }
  .nav-back:hover {
    background: rgba(232,150,125,0.1);
    border-color: #E8967D;
  }

  .nav-logo {
    font-family: var(--fp);
    font-size: 12px;
    letter-spacing: 1px;
    color: #F0EDE4;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
    line-height: 1;
    transition: opacity .15s;
  }
  .nav-logo:hover { opacity: 0.8; }
  .bolt {
    color: #E8967D;
    text-shadow: 0 0 8px rgba(232,150,125,0.5);
  }

  .nav-sep {
    width: 1px;
    height: 18px;
    background: rgba(232,150,125,0.15);
    margin: 0 8px;
    flex-shrink: 0;
  }

  /* ── Ticker ── */
  .selected-ticker {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 4px;
    flex-shrink: 0;
  }
  .st-pair {
    font-family: var(--fp);
    font-size: 9px;
    color: rgba(240,237,228,0.4);
    letter-spacing: 1px;
  }
  .st-price {
    font-family: var(--fp);
    font-size: 11px;
    color: #F0EDE4;
  }

  /* ── Nav Tabs ── */
  .nav-tab {
    font-family: var(--fp);
    font-size: 8px;
    letter-spacing: 1px;
    color: rgba(240,237,228,0.45);
    padding: 0 8px;
    height: 100%;
    display: flex;
    align-items: center;
    gap: 4px;
    border: none;
    border-right: 1px solid rgba(232,150,125,0.06);
    background: none;
    cursor: pointer;
    transition: color .15s, background .15s;
    white-space: nowrap;
    position: relative;
  }
  .nav-tab:last-of-type { border-right: none; }
  .nav-tab:hover { color: #F0EDE4; background: rgba(232,150,125,0.04); }
  .nav-tab.active {
    color: #E8967D;
    background: rgba(232,150,125,0.08);
    text-shadow: 0 0 8px rgba(232,150,125,0.4);
  }
  .nav-tab.active::after {
    content: '';
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 2px;
    background: #E8967D;
    box-shadow: 0 0 8px rgba(232,150,125,0.5);
  }

  .nav-tab.arena-accent { letter-spacing: 1.5px; }
  .nav-tab.arena-accent.active {
    color: #E8967D;
    background: rgba(232,150,125,0.12);
  }

  .tab-icon {
    font-size: 8px;
    opacity: 0.5;
    line-height: 1;
  }
  .nav-tab.active .tab-icon { opacity: 1; }

  /* ── Right Section ── */
  .nav-right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .score-badge {
    font-family: var(--fp);
    font-size: 8px;
    background: rgba(232,150,125,0.08);
    color: #E8967D;
    border: 1px solid rgba(232,150,125,0.2);
    border-radius: 4px;
    padding: 3px 8px;
    letter-spacing: 1px;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .score-badge b {
    font-family: var(--fp);
    font-size: 10px;
    color: #F0EDE4;
  }
  .score-bolt {
    font-size: 10px;
    text-shadow: 0 0 6px rgba(232,150,125,0.5);
  }

  /* ── Wallet ── */
  .wallet-btn {
    font-family: var(--fp);
    font-size: 9px;
    background: #E8967D;
    color: #0a1a0d;
    border: none;
    border-radius: 4px;
    padding: 4px 12px;
    cursor: pointer;
    letter-spacing: 1px;
    transition: all .15s;
    box-shadow: 0 0 10px rgba(232,150,125,0.2);
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .wallet-btn:hover {
    box-shadow: 0 0 16px rgba(232,150,125,0.4);
    transform: translateY(-1px);
  }
  .wallet-btn.connected {
    background: rgba(0,204,102,0.1);
    color: #00cc66;
    border: 1px solid rgba(0,204,102,0.3);
    box-shadow: none;
    font-size: 8px;
  }
  .wallet-dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: #00cc66;
    box-shadow: 0 0 6px #00cc66;
  }

  .settings-btn {
    font-size: 14px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px 4px;
    transition: all .15s;
    line-height: 1;
    opacity: 0.4;
    filter: grayscale(1);
  }
  .settings-btn:hover { opacity: 0.8; filter: none; }
</style>
