<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { gameState } from '$lib/stores/gameState';
  import { walletStore, isWalletConnected } from '$lib/stores/walletStore';
  import { openWalletModal } from '$lib/stores/walletModalStore';
  import { hydrateAuthSession } from '$lib/stores/authSessionStore';
  import { hydrateDomainStores } from '$lib/stores/hydration';
  import { livePrices } from '$lib/stores/priceStore';
  import { updatePrice } from '$lib/stores/priceStore';
  import { fetchPrice } from '$lib/api/binance';
  import { TOKEN_MAP } from '$lib/data/tokens';
  import { buildArenaLink, buildDeepLink, buildPassportLink, buildSignalsLink, buildTerminalLink } from '$lib/utils/deepLinks';

  const gState = $derived($gameState);
  const wallet = $derived($walletStore);
  const connected = $derived($isWalletConnected);
  const liveP = $derived($livePrices);
  const activePath = $derived($page.url.pathname);

  const NAV_ITEMS = [
    { path: '/terminal', href: buildTerminalLink(), label: 'TERMINAL', desc: '실시간 차트와 스캔' },
    { path: '/arena', href: buildArenaLink(), label: 'ARENA', desc: '드래프트와 배틀' },
    { path: '/signals', href: buildSignalsLink(), label: 'SIGNALS', desc: '시그널, 오라클, 커뮤니티' },
    { path: '/passport', href: buildPassportLink(), label: 'PASSPORT', desc: '내 기록과 포트폴리오' },
  ];

  let _lastFetchedToken = '';

  $effect(() => {
    const token = gState.pair.split('/')[0] || 'BTC';
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

  function nav(href: string) { goto(href); }

  function isActive(path: string): boolean {
    if (path === '/arena') {
      return activePath === '/arena' || activePath.startsWith('/arena-v2') || activePath.startsWith('/arena-war');
    }
    if (path === '/passport') {
      return activePath.startsWith('/passport') || activePath.startsWith('/settings') || activePath.startsWith('/agents');
    }
    return activePath.startsWith(path);
  }

  let profileDropdownOpen = $state(false);

  function toggleProfileDropdown() {
    profileDropdownOpen = !profileDropdownOpen;
  }

  function closeProfileDropdown() {
    profileDropdownOpen = false;
  }

  function handleProfileNav(path: string) {
    closeProfileDropdown();
    goto(path);
  }

  $effect(() => {
    activePath;
    if (profileDropdownOpen) {
      closeProfileDropdown();
    }
  });

  $effect(() => {
    connected;
    if (!connected && profileDropdownOpen) {
      closeProfileDropdown();
    }
  });

  async function handleLogout() {
    closeProfileDropdown();
    const { logoutWalletSession } = await import('$lib/auth/walletModalTransport');
    const { clearAuthenticatedUser } = await import('$lib/stores/authSessionStore');
    const { disconnectWallet } = await import('$lib/stores/walletStore');
    await logoutWalletSession();
    clearAuthenticatedUser();
    disconnectWallet();
  }

  const selectedToken = $derived(gState.pair.split('/')[0] || 'BTC');
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
    <button class="nav-logo" onclick={() => nav(buildDeepLink('/'))} aria-label="Home">
      Stockclaw
    </button>

    <div class="nav-sep"></div>

    <div class="selected-ticker">
      <span class="st-pair">{gState.pair}</span>
      <span class="st-price">${selectedPriceText}</span>
    </div>

    <div class="nav-sep"></div>

    {#each NAV_ITEMS as item}
      <button
        class="nav-tab-desktop"
        class:active={isActive(item.path)}
        title={`${item.label} · ${item.desc}`}
        aria-label={`${item.label}: ${item.desc}`}
        onclick={() => nav(item.href)}
      >
        {item.label}
      </button>
    {/each}
  </div>

  <div class="nav-right">
    <div class="score-badge">
      <span class="score-label">SCORE</span>
      <span class="score-value">{Math.round(gState.score)}</span>
    </div>

    <button
      class="settings-btn"
      title="Settings"
      aria-label="Settings"
      onclick={() => nav(buildDeepLink('/settings'))}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
      </svg>
    </button>

    {#if connected}
      <div class="profile-dropdown-wrap">
        <button class="wallet-btn connected" onclick={toggleProfileDropdown}>
          <span class="wallet-dot"></span>
          {wallet.shortAddr}
        </button>
        {#if profileDropdownOpen}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="dropdown-backdrop" onclick={closeProfileDropdown}></div>
          <div class="profile-dropdown">
            <button class="dropdown-item" onclick={() => handleProfileNav('/passport')}>Profile</button>
            <button class="dropdown-item" onclick={() => handleProfileNav('/settings')}>Settings</button>
            <button class="dropdown-item" onclick={() => { closeProfileDropdown(); openWalletModal(); }}>Wallet</button>
            <div class="dropdown-sep"></div>
            <button class="dropdown-item dropdown-item-danger" onclick={handleLogout}>Disconnect</button>
          </div>
        {/if}
      </div>
    {:else}
      <button class="wallet-btn" onclick={openWalletModal}>
        CONNECT
      </button>
    {/if}
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
    flex-wrap: nowrap;
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
    padding: 0 var(--sc-sp-2);
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
    min-height: var(--sc-touch-sm, 36px);
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

  /* ── Profile Dropdown ── */
  .profile-dropdown-wrap {
    position: relative;
  }
  .dropdown-backdrop {
    position: fixed;
    inset: 0;
    z-index: 99;
  }
  .profile-dropdown {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    z-index: 100;
    min-width: 150px;
    background: var(--sc-bg-1);
    border: 1px solid var(--sc-line-hard);
    border-radius: var(--sc-radius-md);
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    padding: var(--sc-sp-1) 0;
    display: flex;
    flex-direction: column;
  }
  .dropdown-item {
    font-family: var(--sc-font-pixel);
    font-size: var(--sc-fs-2xs);
    letter-spacing: 0.8px;
    color: var(--sc-text-1);
    background: none;
    border: none;
    padding: var(--sc-sp-2) var(--sc-sp-3);
    text-align: left;
    cursor: pointer;
    transition: background var(--sc-duration-fast), color var(--sc-duration-fast);
  }
  .dropdown-item:hover {
    background: var(--sc-accent-bg-subtle);
    color: var(--sc-text-0);
  }
  .dropdown-item-danger:hover {
    background: rgba(255, 89, 89, 0.1);
    color: #ff6b6b;
  }
  .dropdown-sep {
    height: 1px;
    background: var(--sc-line-soft);
    margin: var(--sc-sp-1) 0;
  }

  /* ── Active States (Apple-tier touch feedback) ── */
  .nav-logo:active { opacity: 0.6; transform: scale(0.95); }
  .nav-tab-desktop:active { background: var(--sc-accent-bg); }
  .settings-btn:active {
    background: var(--sc-accent-bg);
    transform: scale(0.92);
  }
  .wallet-btn:active {
    transform: scale(0.96);
    opacity: 0.85;
  }

  /* ═══ COMPACT DESKTOP (769–1024px) ═══
     한 줄 유지, 티커/스코어 숨김, 탭 패딩 축소 */
  @media (max-width: 1024px) and (min-width: 769px) {
    .nav-sep { display: none; }
    .selected-ticker { display: none; }
    .score-badge { display: none; }
    .nav-tab-desktop {
      padding: 0 var(--sc-sp-2);
      font-size: var(--sc-fs-2xs);
      letter-spacing: 0.5px;
    }
    .nav-logo {
      font-size: var(--sc-fs-sm);
      letter-spacing: 1px;
    }
    .nav-right { gap: var(--sc-sp-1); }
  }

  /* ═══ MOBILE (≤ 768px) — compact top chrome, primary nav moves to bottom bar ═══ */
  @media (max-width: 768px) {
    #nav {
      height: var(--sc-header-h-mobile, 40px);
      flex-wrap: nowrap;
    }
    .nav-sep { display: none; }
    .selected-ticker { display: none; }
    .nav-tab-desktop { display: none; }
    .score-badge { display: none; }

    .nav-main {
      height: var(--sc-header-h-mobile, 40px);
    }
    .nav-logo {
      font-size: var(--sc-fs-sm);
      letter-spacing: 1.5px;
    }
    .nav-right {
      margin-left: auto;
      height: var(--sc-header-h-mobile, 40px);
    }
    .settings-btn {
      padding: var(--sc-sp-2);
      min-width: var(--sc-touch-sm, 36px);
      min-height: var(--sc-touch-sm, 36px);
    }
    .wallet-btn {
      padding: var(--sc-sp-1) var(--sc-sp-3);
      border-radius: var(--sc-radius-md);
    }
  }

  /* ═══ SMALL MOBILE (≤ 480px) ═══ */
  @media (max-width: 480px) {
    .nav-main {
      height: var(--sc-touch-sm, 36px);
    }
    .nav-right {
      height: var(--sc-touch-sm, 36px);
    }
    .nav-logo {
      font-size: var(--sc-fs-xs);
      letter-spacing: 1px;
    }
    .wallet-btn {
      padding: var(--sc-sp-1) var(--sc-sp-2);
      min-height: var(--sc-touch-sm, 36px);
    }
  }
</style>
