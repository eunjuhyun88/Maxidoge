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

  // Derive active route from actual URL
  $: activePath = $page.url.pathname;

  // Navigation items
  const NAV_ITEMS = [
    { path: '/terminal', label: 'TERMINAL', desc: '실시간 차트와 스캔' },
    { path: '/arena', label: 'ARENA', desc: '드래프트와 배틀', accent: true },
    { path: '/signals', label: 'COMMUNITY', desc: '시그널, 오라클 리더보드, 라이브 피드' },
    { path: '/passport', label: 'PASSPORT', desc: '내 기록과 포트폴리오' },
  ];

  // ─── 페어 변경 시 priceStore에 없는 토큰 가격 자동 fetch ────
  let _lastFetchedToken = '';
  $: {
    const token = state.pair.split('/')[0] || 'BTC';
    if (token !== _lastFetchedToken && !(token in liveP)) {
      _lastFetchedToken = token;
      const tokDef = TOKEN_MAP.get(token);
      if (tokDef) {
        fetchPrice(tokDef.binanceSymbol).then(price => {
          if (Number.isFinite(price) && price > 0) {
            updatePrice(token, price, 'rest');
          }
        }).catch(() => {/* 실패 시 ChartPanel에서 kline 로드 후 업데이트됨 */});
      }
    }
  }

  onMount(() => {
    void hydrateAuthSession();
    void hydrateDomainStores();
    // NOTE: WS 가격 구독은 +layout.svelte에서 전역으로 관리 (S-03)
    // Header는 priceStore를 읽기만 함
    // 페어 변경 시 위의 reactive block이 REST fetch 보완
  });

  function nav(path: string) {
    goto(path);
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
  // 선택된 토큰의 가격만 표시. 없으면 0 (BTC 가격으로 폴백하지 않음)
  $: selectedPrice = liveP[selectedToken] || 0;
  $: selectedBase = state.bases[selectedToken as keyof typeof state.bases] || state.bases.BTC;
  $: selectedPriceText = selectedPrice > 0
    ? Number(selectedPrice).toLocaleString('en-US', {
        minimumFractionDigits: selectedPrice >= 1000 ? 2 : 4,
        maximumFractionDigits: selectedPrice >= 1000 ? 2 : 4
      })
    : '---';
</script>

<nav id="nav">
  <div class="nav-main">
    <button class="nav-logo" on:click={() => nav('/')}>
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
          class="nav-tab nav-tab-desktop"
          class:active={isActive(item.path)}
          class:arena-accent={item.accent}
          title={`${item.label} · ${item.desc}`}
          aria-label={`${item.label}: ${item.desc}`}
          on:click={() => nav(item.path)}
        >
          {item.label}
        </button>
      {/each}
    </div>

    <div class="nav-right">
      <div class="score-badge">
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

      <button class="settings-btn" title="SETTINGS" aria-label="SETTINGS" on:click={() => nav('/settings')}>SET</button>
    </div>

  <!-- Mobile bottom tab bar -->
  <div class="nav-tabs-mobile">
    {#each NAV_ITEMS as item}
      <button
        class="nav-tab-m"
        class:active={isActive(item.path)}
        on:click={() => nav(item.path)}
      >
        {item.label}
      </button>
    {/each}
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
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 110;
    font-family: var(--fp, 'Press Start 2P', monospace);
    color: #F0EDE4;
  }

  /* Desktop: single row */
  .nav-top {
    display: flex;
    align-items: center;
    height: 42px;
    padding: 0 12px;
    gap: 0;
  }

  .nav-main {
    display: flex;
    align-items: center;
    min-width: 0;
    flex: 1 1 auto;
    overflow: hidden;
    height: 100%;
  }

  /* Removed: .nav-back (BACK button removed) */
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

  /* ── Desktop Nav Tabs ── */
  .nav-tab-desktop {
    font-family: var(--fp);
    font-size: 8px;
    letter-spacing: 1px;
    color: rgba(240,237,228,0.45);
    padding: 0 8px;
    height: 100%;
    display: flex;
    align-items: center;
    border: none;
    border-right: 1px solid rgba(232,150,125,0.06);
    background: none;
    cursor: pointer;
    transition: color .15s, background .15s;
    white-space: nowrap;
    position: relative;
  }
  .nav-tab-desktop:last-of-type { border-right: none; }
  .nav-tab-desktop:hover { color: #F0EDE4; background: rgba(232,150,125,0.04); }
  .nav-tab-desktop.active {
    color: #E8967D;
    background: rgba(232,150,125,0.08);
    text-shadow: 0 0 8px rgba(232,150,125,0.4);
  }
  .nav-tab-desktop.active::after {
    content: '';
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 2px;
    background: #E8967D;
    box-shadow: 0 0 8px rgba(232,150,125,0.5);
  }
  .nav-tab-desktop.arena-accent { letter-spacing: 1.5px; }
  .nav-tab-desktop.arena-accent.active {
    color: #E8967D;
    background: rgba(232,150,125,0.12);
  }

  /* ── Right Section ── */
  .nav-right {
    margin-left: 8px;
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
    font-family: var(--fp);
    font-size: 8px;
    letter-spacing: 1px;
    color: rgba(240,237,228,0.55);
    background: none;
    border: 1px solid rgba(232,150,125,0.2);
    border-radius: 4px;
    cursor: pointer;
    padding: 3px 7px;
    transition: all .15s;
    line-height: 1.1;
  }
  .settings-btn:hover {
    color: #F0EDE4;
    border-color: rgba(232,150,125,0.45);
    background: rgba(232,150,125,0.08);
  }

  /* ── Mobile tab bar: hidden on desktop ── */
  .nav-tabs-mobile {
    display: none;
  }

  /* ═══ MOBILE ═══ */
  @media (max-width: 900px) {
    .nav-logo {
      font-size: 10px;
      letter-spacing: 0.8px;
    }

    /* Hide desktop elements */
    .nav-sep { display: none; }
    .selected-ticker { display: none; }
    .nav-tab-desktop { display: none; }
    .score-badge { display: none; }
    .settings-btn { display: none; }

    .nav-back {
      font-size: 10px;
      padding: 3px 8px;
      margin-right: 8px;
    }
    .nav-logo {
      font-size: 11px;
      letter-spacing: 1.5px;
    }

    .nav-right {
      margin-left: auto;
    }
    .wallet-btn {
      font-size: 9px;
      padding: 5px 14px;
      border-radius: 6px;
    }
    .wallet-btn.connected {
      font-size: 8px;
      padding: 5px 10px;
    }

    /* Show mobile tab bar */
    .nav-tabs-mobile {
      display: flex;
      align-items: stretch;
      border-top: 1px solid rgba(232,150,125,0.08);
      height: 36px;
    }
    .nav-tab-m {
      flex: 1;
      font-family: var(--fp, 'Press Start 2P', monospace);
      font-size: 8px;
      letter-spacing: 1px;
      color: rgba(240,237,228,0.4);
      background: none;
      border: none;
      border-right: 1px solid rgba(232,150,125,0.06);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color .15s, background .15s;
      position: relative;
    }
    .nav-tab-m:last-child { border-right: none; }
    .nav-tab-m:active { background: rgba(232,150,125,0.06); }
    .nav-tab-m.active {
      color: #E8967D;
      background: rgba(232,150,125,0.06);
      text-shadow: 0 0 6px rgba(232,150,125,0.3);
    }
    .nav-tab-m.active::after {
      content: '';
      position: absolute;
      bottom: 0; left: 20%; right: 20%;
      height: 2px;
      background: #E8967D;
      box-shadow: 0 0 6px rgba(232,150,125,0.4);
      border-radius: 1px;
    }
  }

  @media (max-width: 640px) {
    .nav-top {
      height: 40px;
      padding: 0 12px;
    }
    .nav-logo {
      font-size: 10px;
      letter-spacing: 1.2px;
    }
    .nav-tabs-mobile {
      height: 34px;
    }
    .nav-tab-m {
      font-size: 7px;
      letter-spacing: 0.8px;
    }
    .wallet-btn {
      font-size: 8px;
      padding: 4px 10px;
    }
    .wallet-btn.connected {
      font-size: 7px;
      padding: 4px 8px;
    }
  }
</style>
