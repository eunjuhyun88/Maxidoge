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

  $: state = $gameState;
  $: wallet = $walletStore;
  $: connected = $isWalletConnected;
  $: liveP = $livePrices;
  $: activePath = $page.url.pathname;

  const NAV_ITEMS = [
    { path: '/terminal', label: 'TERMINAL', desc: '실시간 차트와 스캔' },
    { path: '/arena', label: 'ARENA', desc: '드래프트와 배틀' },
    { path: '/signals', label: 'COMMUNITY', desc: '시그널, 오라클 리더보드, 라이브 피드' },
    { path: '/passport', label: 'PASSPORT', desc: '내 기록과 포트폴리오' },
  ] as const;

  let mobileMenuOpen = false;

  let _lastFetchedToken = '';
  $: {
    const token = state.pair.split('/')[0] || 'BTC';
    if (token !== _lastFetchedToken && !(token in liveP)) {
      _lastFetchedToken = token;
      const tokDef = TOKEN_MAP.get(token);
      if (tokDef) {
        fetchPrice(tokDef.binanceSymbol)
          .then((price) => {
            if (Number.isFinite(price) && price > 0) updatePrice(token, price, 'rest');
          })
          .catch(() => {
            // no-op: chart panel path also hydrates prices
          });
      }
    }
  }

  onMount(() => {
    void hydrateAuthSession();
    void hydrateDomainStores();

    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') mobileMenuOpen = false;
    };
    window.addEventListener('keydown', onEsc);

    return () => {
      window.removeEventListener('keydown', onEsc);
    };
  });

  function nav(path: string) {
    mobileMenuOpen = false;
    goto(path);
  }

  function handleBack() {
    mobileMenuOpen = false;
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
    if (!Number.isFinite(base) || base === 0 || !Number.isFinite(cur) || cur === 0) return '+0.00%';
    const pct = ((cur - base) / base * 100).toFixed(2);
    return `${Number(pct) >= 0 ? '+' : ''}${pct}%`;
  }

  $: selectedToken = state.pair.split('/')[0] || 'BTC';
  $: selectedPrice = liveP[selectedToken] || 0;
  $: selectedBase = state.bases[selectedToken as keyof typeof state.bases] || state.bases.BTC;
  $: selectedPriceText = selectedPrice > 0
    ? Number(selectedPrice).toLocaleString('en-US', {
        minimumFractionDigits: selectedPrice >= 1000 ? 2 : 4,
        maximumFractionDigits: selectedPrice >= 1000 ? 2 : 4
      })
    : '---';

  function openWalletFromMenu() {
    mobileMenuOpen = false;
    openWalletModal();
  }
</script>

<nav id="nav" aria-label="Global">
  <div class="nav-main">
    {#if activePath !== '/'}
      <button class="nav-back" on:click={handleBack} aria-label="Go back">←</button>
    {/if}

    <button class="nav-logo" on:click={() => nav('/')} aria-label="Go to home">
      MAXIDOGE
    </button>

    <div class="selected-ticker" aria-live="polite">
      <span class="st-pair">{state.pair}</span>
      <span class="st-price">${selectedPriceText}</span>
      <span class="st-pct" class:up={selectedPrice >= selectedBase} class:dn={selectedPrice < selectedBase}>
        {pctStr(selectedBase, selectedPrice)}
      </span>
    </div>

    <div class="desktop-tabs" role="tablist" aria-label="Primary routes">
      {#each NAV_ITEMS as item}
        <button
          class="nav-tab"
          class:active={isActive(item.path)}
          title={`${item.label} · ${item.desc}`}
          aria-label={`${item.label}: ${item.desc}`}
          on:click={() => nav(item.path)}
        >
          {item.label}
        </button>
      {/each}
    </div>
  </div>

  <div class="nav-right">
    <div class="score-badge" title="Current score">
      SCORE <b>{Math.round(state.score)}</b>
    </div>

    {#if connected}
      <button class="wallet-btn connected" on:click={openWalletModal} aria-label="Open wallet modal">
        <span class="wallet-dot"></span>
        {wallet.shortAddr}
      </button>
    {:else}
      <button class="wallet-btn" on:click={openWalletModal} aria-label="Connect wallet">
        CONNECT
      </button>
    {/if}

    <button class="settings-btn" title="Settings" aria-label="Settings" on:click={() => nav('/settings')}>SET</button>

    <button
      class="menu-btn"
      aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
      aria-expanded={mobileMenuOpen}
      aria-controls="mobile-nav-panel"
      on:click={() => { mobileMenuOpen = !mobileMenuOpen; }}
    >
      {mobileMenuOpen ? 'CLOSE' : 'MENU'}
    </button>
  </div>
</nav>

{#if mobileMenuOpen}
  <button class="mobile-backdrop" aria-label="Close menu" on:click={() => { mobileMenuOpen = false; }}></button>
  <div id="mobile-nav-panel" class="mobile-panel" role="dialog" aria-modal="true" aria-label="Navigation menu">
    <div class="mobile-panel-head">
      <h2>NAVIGATION</h2>
      <button class="mobile-close" on:click={() => { mobileMenuOpen = false; }} aria-label="Close menu">✕</button>
    </div>

    <div class="mobile-pair">
      <span>{state.pair}</span>
      <strong>${selectedPriceText}</strong>
      <em class={pctClass(selectedPrice - selectedBase)}>{pctStr(selectedBase, selectedPrice)}</em>
    </div>

    <div class="mobile-tabs">
      {#each NAV_ITEMS as item}
        <button class="mobile-tab" class:active={isActive(item.path)} on:click={() => nav(item.path)}>
          <span>{item.label}</span>
          <small>{item.desc}</small>
        </button>
      {/each}
    </div>

    <div class="mobile-actions">
      {#if connected}
        <button class="mobile-wallet connected" on:click={openWalletFromMenu}>
          CONNECTED · {wallet.shortAddr}
        </button>
      {:else}
        <button class="mobile-wallet" on:click={openWalletFromMenu}>CONNECT WALLET</button>
      {/if}
      <button class="mobile-settings" on:click={() => nav('/settings')}>OPEN SETTINGS</button>
    </div>
  </div>
{/if}

<style>
  #nav {
    background: var(--nav-bg);
    border-bottom: 1px solid var(--nav-border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
    position: fixed;
    inset: 0 0 auto 0;
    z-index: 120;
    flex-shrink: 0;
    height: var(--app-header-h, 46px);
    font-family: var(--fp, 'Press Start 2P', monospace);
    color: var(--nav-fg);
    backdrop-filter: blur(8px);
  }

  .nav-main {
    display: flex;
    align-items: center;
    min-width: 0;
    flex: 1 1 auto;
    gap: 10px;
  }

  .nav-back,
  .settings-btn,
  .menu-btn {
    font-size: 9px;
    letter-spacing: 0.8px;
    color: var(--nav-accent);
    background: rgba(232, 150, 125, 0.08);
    border: 1px solid rgba(232, 150, 125, 0.35);
    border-radius: 5px;
    padding: 4px 8px;
    cursor: pointer;
    line-height: 1;
  }

  .nav-back:hover,
  .settings-btn:hover,
  .menu-btn:hover {
    background: rgba(232, 150, 125, 0.16);
    color: #ffe9df;
  }

  .menu-btn {
    display: none;
  }

  .nav-logo {
    font-family: var(--fp);
    font-size: 12px;
    letter-spacing: 1.2px;
    color: var(--nav-fg);
    background: none;
    border: none;
    cursor: pointer;
    white-space: nowrap;
  }

  .selected-ticker {
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid rgba(232, 150, 125, 0.2);
    border-radius: 999px;
    padding: 4px 10px;
    background: rgba(0, 0, 0, 0.2);
    min-width: 0;
  }

  .st-pair {
    font-size: 8px;
    color: rgba(240, 237, 228, 0.55);
    white-space: nowrap;
  }

  .st-price {
    font-size: 10px;
    color: #fff;
  }

  .st-pct {
    font-size: 8px;
    font-weight: 700;
  }

  .st-pct.up {
    color: #00e676;
  }

  .st-pct.dn {
    color: #ff5f6d;
  }

  .desktop-tabs {
    display: flex;
    align-items: stretch;
    margin-left: 4px;
    height: 100%;
  }

  .nav-tab {
    font-family: var(--fp);
    font-size: 8px;
    letter-spacing: 1px;
    color: rgba(240, 237, 228, 0.58);
    padding: 0 10px;
    height: 100%;
    display: flex;
    align-items: center;
    border: none;
    border-left: 1px solid rgba(232, 150, 125, 0.08);
    background: none;
    cursor: pointer;
    position: relative;
    white-space: nowrap;
  }

  .nav-tab:hover {
    color: var(--nav-fg);
    background: rgba(232, 150, 125, 0.08);
  }

  .nav-tab.active {
    color: var(--nav-accent);
    background: rgba(232, 150, 125, 0.12);
  }

  .nav-tab.active::after {
    content: '';
    position: absolute;
    left: 6px;
    right: 6px;
    bottom: 4px;
    height: 2px;
    background: var(--nav-accent);
    border-radius: 2px;
  }

  .nav-right {
    margin-left: 8px;
    display: flex;
    align-items: center;
    gap: 7px;
    flex-shrink: 0;
  }

  .score-badge {
    font-size: 8px;
    background: rgba(232, 150, 125, 0.1);
    color: var(--nav-accent);
    border: 1px solid rgba(232, 150, 125, 0.22);
    border-radius: 6px;
    padding: 4px 8px;
    letter-spacing: 0.8px;
    display: flex;
    align-items: center;
    gap: 5px;
    line-height: 1;
  }

  .score-badge b {
    font-size: 10px;
    color: var(--nav-fg);
  }

  .wallet-btn {
    font-size: 8px;
    background: var(--nav-accent);
    color: #0a1a0d;
    border: none;
    border-radius: 6px;
    padding: 5px 10px;
    cursor: pointer;
    letter-spacing: 0.8px;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    box-shadow: 0 0 10px rgba(232, 150, 125, 0.22);
    display: flex;
    align-items: center;
    gap: 5px;
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .wallet-btn:hover {
    box-shadow: 0 0 16px rgba(232, 150, 125, 0.38);
    transform: translateY(-1px);
  }

  .wallet-btn.connected {
    background: rgba(0, 204, 102, 0.12);
    color: #00df75;
    border: 1px solid rgba(0, 204, 102, 0.28);
    box-shadow: none;
  }

  .wallet-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #00df75;
    box-shadow: 0 0 6px #00df75;
  }

  .mobile-backdrop {
    position: fixed;
    inset: var(--app-header-h, 46px) 0 0;
    border: none;
    background: rgba(0, 0, 0, 0.58);
    z-index: 118;
  }

  .mobile-panel {
    position: fixed;
    top: var(--app-header-h, 46px);
    right: 0;
    width: min(360px, 92vw);
    max-height: calc(100dvh - var(--app-header-h, 46px));
    overflow: auto;
    background: #111f14;
    border-left: 1px solid rgba(232, 150, 125, 0.3);
    border-top: 1px solid rgba(232, 150, 125, 0.2);
    z-index: 119;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .mobile-panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .mobile-panel-head h2 {
    font-size: 11px;
    letter-spacing: 1px;
    color: #fff;
  }

  .mobile-close {
    border: 1px solid rgba(232, 150, 125, 0.28);
    background: rgba(232, 150, 125, 0.08);
    color: var(--nav-accent);
    border-radius: 6px;
    padding: 4px 8px;
    cursor: pointer;
  }

  .mobile-pair {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 10px;
    border: 1px solid rgba(232, 150, 125, 0.18);
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.25);
    font-size: 10px;
  }

  .mobile-pair strong {
    color: #fff;
    font-size: 11px;
  }

  .mobile-pair em {
    font-style: normal;
    font-size: 10px;
    font-weight: 700;
  }

  .mobile-pair em.up {
    color: #00e676;
  }

  .mobile-pair em.dn {
    color: #ff5f6d;
  }

  .mobile-tabs {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .mobile-tab {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    width: 100%;
    text-align: left;
    border: 1px solid rgba(232, 150, 125, 0.2);
    background: rgba(232, 150, 125, 0.04);
    color: #ffe9df;
    border-radius: 8px;
    padding: 10px;
    cursor: pointer;
  }

  .mobile-tab span {
    font-size: 10px;
    letter-spacing: 0.8px;
  }

  .mobile-tab small {
    font-family: var(--fm);
    font-size: 11px;
    color: rgba(255, 255, 255, 0.72);
  }

  .mobile-tab.active {
    border-color: rgba(232, 150, 125, 0.62);
    background: rgba(232, 150, 125, 0.12);
    color: #fff;
  }

  .mobile-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .mobile-wallet,
  .mobile-settings {
    border: none;
    border-radius: 8px;
    padding: 10px;
    cursor: pointer;
    text-align: left;
    font-size: 9px;
    letter-spacing: 0.7px;
  }

  .mobile-wallet {
    background: var(--nav-accent);
    color: #0a1a0d;
  }

  .mobile-wallet.connected {
    background: rgba(0, 204, 102, 0.15);
    border: 1px solid rgba(0, 204, 102, 0.38);
    color: #00df75;
  }

  .mobile-settings {
    background: rgba(232, 150, 125, 0.08);
    border: 1px solid rgba(232, 150, 125, 0.24);
    color: #ffe9df;
  }

  @media (max-width: 1180px) {
    .score-badge {
      display: none;
    }

    .selected-ticker {
      padding: 4px 8px;
    }
  }

  @media (max-width: 900px) {
    #nav {
      padding: 0 8px;
      gap: 6px;
    }

    .desktop-tabs,
    .settings-btn,
    .wallet-btn,
    .selected-ticker {
      display: none;
    }

    .menu-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 64px;
    }

    .nav-logo {
      font-size: 11px;
      letter-spacing: 1px;
    }

    .score-badge {
      display: inline-flex;
      padding: 4px 6px;
      font-size: 7px;
    }

    .score-badge b {
      font-size: 9px;
    }
  }

  @media (max-width: 640px) {
    #nav {
      padding: 0 6px;
    }

    .nav-main {
      gap: 6px;
    }

    .nav-back,
    .menu-btn {
      font-size: 8px;
      padding: 4px 6px;
    }

    .nav-logo {
      font-size: 10px;
      letter-spacing: 0.8px;
    }

    .score-badge {
      display: none;
    }
  }
</style>
