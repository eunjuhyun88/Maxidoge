<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { gameState } from '$lib/stores/gameState';
  import { walletStore, isWalletConnected, openWalletModal, hydrateAuthSession } from '$lib/stores/walletStore';
  import { hydrateDomainStores } from '$lib/stores/hydration';
  import { livePrices } from '$lib/stores/priceStore';
  import { updatePrice } from '$lib/stores/priceStore';
  import { fetchPrice } from '$lib/api/binance';
  import { TOKEN_MAP } from '$lib/data/tokens';

  const state = $derived($gameState);
  const wallet = $derived($walletStore);
  const connected = $derived($isWalletConnected);
  const liveP = $derived($livePrices);
  const activePath = $derived($page.url.pathname);

  const NAV_ITEMS = [
    { path: '/terminal', label: 'TERMINAL', icon: '~', desc: '실시간 차트와 스캔' },
    { path: '/arena', label: 'ARENA', icon: '>', desc: '드래프트와 배틀' },
    { path: '/arena-war', label: 'WAR', icon: '!', desc: 'AI와 1:1 분석 대결', accent: true },
    { path: '/signals', label: 'COMMUNITY', icon: '#', desc: '시그널, 오라클 리더보드, 라이브 피드' },
    { path: '/passport', label: 'PASSPORT', icon: '@', desc: '내 기록과 포트폴리오' },
  ];

  let _lastFetchedToken = '';

  $effect(() => {
    const token = state.pair.split('/')[0] || 'BTC';
    if (token !== _lastFetchedToken && !(token in liveP)) {
      _lastFetchedToken = token;
      const tokDef = TOKEN_MAP.get(token);
      if (tokDef) {
        fetchPrice(tokDef.binanceSymbol).then(price => {
          if (Number.isFinite(price) && price > 0) {
            updatePrice(token, price, 'rest');
          }
        }).catch(() => {});
      }
    }
  });

  onMount(() => {
    void hydrateAuthSession();
    void hydrateDomainStores();
  });

  function nav(path: string) { goto(path); }

  function isActive(path: string): boolean {
    if (path === '/arena') return activePath === '/arena' || activePath.startsWith('/arena-v2');
    if (path === '/arena-war') return activePath.startsWith('/arena-war');
    return activePath.startsWith(path);
  }

  const selectedToken = $derived(state.pair.split('/')[0] || 'BTC');
  const selectedPrice = $derived(liveP[selectedToken] || 0);
  const selectedPriceText = $derived(
    selectedPrice > 0
      ? Number(selectedPrice).toLocaleString('en-US', {
          minimumFractionDigits: selectedPrice >= 1000 ? 2 : 4,
          maximumFractionDigits: selectedPrice >= 1000 ? 2 : 4
        })
      : '---'
  );
</script>

<nav id="nav">
  <div class="nav-main">
    <button class="nav-logo" onclick={() => nav('/')} aria-label="Home">
      Stockclaw
    </button>

    <div class="nav-sep"></div>

    <div class="selected-ticker">
      <span class="st-pair">{state.pair}</span>
      <span class="st-price">${selectedPriceText}</span>
    </div>

    <div class="nav-sep"></div>

    {#each NAV_ITEMS as item}
      <button
        class="nav-tab-desktop"
        class:active={isActive(item.path)}
        class:accent={item.accent}
        title={`${item.label} · ${item.desc}`}
        aria-label={`${item.label}: ${item.desc}`}
        onclick={() => nav(item.path)}
      >
        {item.label}
      </button>
    {/each}
  </div>

  <div class="nav-right">
    <div class="score-badge">
      <span class="score-label">SCORE</span>
      <span class="score-value">{Math.round(state.score)}</span>
    </div>

    <button
      class="settings-btn"
      title="Settings"
      aria-label="Settings"
      onclick={() => nav('/settings')}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
      </svg>
    </button>

    {#if connected}
      <button class="wallet-btn connected" onclick={openWalletModal}>
        <span class="wallet-dot"></span>
        {wallet.shortAddr}
      </button>
    {:else}
      <button class="wallet-btn" onclick={openWalletModal}>
        CONNECT
      </button>
    {/if}
  </div>

  <div class="nav-tabs-mobile">
    {#each NAV_ITEMS as item}
      <button
        class="nav-tab-m"
        class:active={isActive(item.path)}
        onclick={() => nav(item.path)}
        aria-label={item.desc}
      >
        {item.label}
      </button>
    {/each}
  </div>
</nav>

<style>
  #nav {
    background: var(--sc-bg-1);
    border-bottom: 1px solid var(--sc-line-soft);
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: var(--sc-z-header);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    height: var(--sc-header-h);
    padding: 0 var(--sc-sp-3);
    font-family: var(--sc-font-pixel);
    color: var(--sc-text-0);
  }

  .nav-main {
    display: flex;
    align-items: center;
    min-width: 0;
    flex: 1 1 auto;
    overflow: hidden;
    height: 100%;
  }

  .nav-logo {
    font-family: var(--sc-font-pixel);
    font-size: var(--sc-fs-base);
    letter-spacing: 1px;
    color: var(--sc-text-0);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
    line-height: 1;
    transition: opacity var(--sc-duration-fast);
  }
  .nav-logo:hover { opacity: 0.8; }

  .nav-sep {
    width: 1px;
    height: 20px;
    background: var(--sc-line-soft);
    margin: 0 var(--sc-sp-2);
    flex-shrink: 0;
  }

  /* Ticker */
  .selected-ticker {
    display: flex;
    align-items: center;
    gap: var(--sc-sp-1_5);
    padding: 0 var(--sc-sp-1);
    flex-shrink: 0;
  }
  .st-pair {
    font-family: var(--sc-font-pixel);
    font-size: var(--sc-fs-2xs);
    color: var(--sc-text-3);
    letter-spacing: 1px;
  }
  .st-price {
    font-family: var(--sc-font-pixel);
    font-size: var(--sc-fs-sm);
    color: var(--sc-text-0);
  }

  /* Desktop Nav Tabs */
  .nav-tab-desktop {
    font-family: var(--sc-font-pixel);
    font-size: var(--sc-fs-2xs);
    letter-spacing: 1px;
    color: var(--sc-text-3);
    padding: 0 var(--sc-sp-3);
    height: 100%;
    display: flex;
    align-items: center;
    border: none;
    border-right: 1px solid var(--sc-accent-bg-subtle);
    background: none;
    cursor: pointer;
    transition: color var(--sc-duration-fast), background var(--sc-duration-fast);
    white-space: nowrap;
    position: relative;
  }
  .nav-tab-desktop:last-of-type { border-right: none; }
  .nav-tab-desktop:hover {
    color: var(--sc-text-0);
    background: var(--sc-accent-bg-subtle);
  }
  .nav-tab-desktop.active {
    color: var(--sc-accent);
    background: var(--sc-accent-bg);
    text-shadow: 0 0 8px rgba(232, 150, 125, 0.4);
  }
  .nav-tab-desktop.active::after {
    content: '';
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 2px;
    background: var(--sc-accent);
    box-shadow: 0 0 8px rgba(232, 150, 125, 0.5);
  }
  .nav-tab-desktop.accent { letter-spacing: 1.5px; }
  .nav-tab-desktop.accent.active {
    color: var(--sc-accent);
    background: var(--sc-accent-bg);
  }

  /* Right Section */
  .nav-right {
    margin-left: var(--sc-sp-2);
    display: flex;
    align-items: center;
    gap: var(--sc-sp-2);
    flex-shrink: 0;
  }

  .score-badge {
    font-family: var(--sc-font-pixel);
    font-size: var(--sc-fs-2xs);
    background: var(--sc-accent-bg);
    color: var(--sc-accent);
    border: 1px solid var(--sc-line-soft);
    border-radius: var(--sc-radius-sm);
    padding: var(--sc-sp-1) var(--sc-sp-2);
    letter-spacing: 1px;
    display: flex;
    align-items: center;
    gap: var(--sc-sp-1);
  }
  .score-value {
    font-size: var(--sc-fs-xs);
    color: var(--sc-text-0);
    font-weight: 700;
  }

  /* Settings */
  .settings-btn {
    color: var(--sc-text-2);
    background: none;
    border: 1px solid var(--sc-line-soft);
    border-radius: var(--sc-radius-sm);
    cursor: pointer;
    padding: var(--sc-sp-1);
    transition: all var(--sc-duration-fast);
    line-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .settings-btn:hover {
    color: var(--sc-text-0);
    border-color: var(--sc-line-hard);
    background: var(--sc-accent-bg);
  }

  /* Wallet */
  .wallet-btn {
    font-family: var(--sc-font-pixel);
    font-size: var(--sc-fs-2xs);
    background: var(--sc-accent);
    color: var(--sc-bg-1);
    border: none;
    border-radius: var(--sc-radius-sm);
    padding: var(--sc-sp-1) var(--sc-sp-3);
    cursor: pointer;
    letter-spacing: 1px;
    transition: all var(--sc-duration-fast);
    box-shadow: var(--sc-shadow-glow);
    display: flex;
    align-items: center;
    gap: var(--sc-sp-1);
  }
  .wallet-btn:hover {
    box-shadow: 0 0 20px rgba(232, 150, 125, 0.4);
    transform: translateY(-1px);
  }
  .wallet-btn.connected {
    background: var(--sc-good-bg);
    color: var(--sc-good);
    border: 1px solid rgba(0, 204, 102, 0.3);
    box-shadow: none;
    font-size: var(--sc-fs-2xs);
  }
  .wallet-dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: var(--sc-good);
    box-shadow: 0 0 6px var(--sc-good);
  }

  /* Mobile tab bar: hidden on desktop */
  .nav-tabs-mobile {
    display: none;
  }

  /* ═══ TABLET / MOBILE (< 1024px) ═══ */
  @media (max-width: 1024px) {
    #nav {
      height: auto;
    }
    .nav-main {
      height: var(--sc-header-h-mobile);
    }
    .nav-sep { display: none; }
    .selected-ticker { display: none; }
    .nav-tab-desktop { display: none; }
    .score-badge { display: none; }

    .nav-logo {
      font-size: var(--sc-fs-sm);
      letter-spacing: 1.5px;
    }
    .nav-right {
      margin-left: auto;
      height: var(--sc-header-h-mobile);
    }
    .wallet-btn {
      padding: var(--sc-sp-1) var(--sc-sp-3);
      border-radius: var(--sc-radius-md);
    }

    .nav-tabs-mobile {
      display: flex;
      align-items: stretch;
      width: 100%;
      border-top: 1px solid var(--sc-accent-bg-subtle);
      height: 36px;
    }
    .nav-tab-m {
      flex: 1;
      font-family: var(--sc-font-pixel);
      font-size: var(--sc-fs-2xs);
      letter-spacing: 0.5px;
      color: var(--sc-text-3);
      background: none;
      border: none;
      border-right: 1px solid var(--sc-accent-bg-subtle);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color var(--sc-duration-fast), background var(--sc-duration-fast);
      position: relative;
    }
    .nav-tab-m:last-child { border-right: none; }
    .nav-tab-m:active { background: var(--sc-accent-bg-subtle); }
    .nav-tab-m.active {
      color: var(--sc-accent);
      background: var(--sc-accent-bg-subtle);
      text-shadow: 0 0 6px rgba(232, 150, 125, 0.3);
    }
    .nav-tab-m.active::after {
      content: '';
      position: absolute;
      bottom: 0; left: 20%; right: 20%;
      height: 2px;
      background: var(--sc-accent);
      box-shadow: 0 0 6px rgba(232, 150, 125, 0.4);
      border-radius: 1px;
    }
  }

  /* ═══ SMALL MOBILE (< 480px) ═══ */
  @media (max-width: 480px) {
    .nav-logo {
      font-size: var(--sc-fs-xs);
      letter-spacing: 1px;
    }
    .nav-tabs-mobile {
      height: 34px;
    }
    .nav-tab-m {
      letter-spacing: 0;
    }
    .wallet-btn {
      padding: var(--sc-sp-1) var(--sc-sp-2);
    }
  }
</style>
