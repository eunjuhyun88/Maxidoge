<script lang="ts">
  import { onMount } from 'svelte';
  import { userProfileStore, earnedBadges, lockedBadges, profileTier, profileStats, setAvatar, setUsername, hydrateUserProfile } from '$lib/stores/userProfileStore';
  import { activeSignalCount, activeSignals, expiredSignals } from '$lib/stores/trackedSignalStore';
  import { openTradeCount, totalQuickPnL, openTrades, closedTrades } from '$lib/stores/quickTradeStore';
  import { matchHistoryStore, winRate, bestStreak } from '$lib/stores/matchHistoryStore';
  import { walletStore, openWalletModal } from '$lib/stores/walletStore';
  import { agentStats, hydrateAgentStats } from '$lib/stores/agentData';
  import { AGDEFS, CHARACTER_ART } from '$lib/data/agents';
  import { HOLDINGS_DATA, calcPnL, type HoldingAsset } from '$lib/data/holdings';
  import { gameState } from '$lib/stores/gameState';
  import { fetchUiStateApi, updateUiStateApi } from '$lib/api/preferencesApi';
  import { fetchHoldings } from '$lib/api/portfolioApi';
  import { livePrices } from '$lib/stores/priceStore';
  import EmptyState from '../../components/shared/EmptyState.svelte';

  $: profile = $userProfileStore;
  $: wallet = $walletStore;
  $: stats = $profileStats;
  $: tier = $profileTier;
  $: earned = $earnedBadges;
  $: locked = $lockedBadges;
  $: agStats = $agentStats;
  $: gState = $gameState;
  $: openPos = $openTradeCount;
  $: trackedCount = $activeSignalCount;
  $: pnl = $totalQuickPnL;
  $: opens = $openTrades;
  $: closed = $closedTrades;
  $: tracked = $activeSignals;
  $: expired = $expiredSignals;
  $: records = $matchHistoryStore.records;
  $: wr = $winRate;
  $: bStreak = $bestStreak;

  // Holdings: live API data with static fallback
  let liveHoldings: HoldingAsset[] = [];
  let holdingsLoaded = false;
  let holdingsState: 'loading' | 'live' | 'fallback' = 'loading';
  let holdingsStatusMessage = 'Syncing wallet holdings...';
  let holdingsSyncAddress: string | null = null;
  let baseHoldings: HoldingAsset[] = HOLDINGS_DATA;
  let effectiveHoldings: HoldingAsset[] = HOLDINGS_DATA;
  $: liveP = $livePrices;

  function withLivePrices(holdings: HoldingAsset[], prices: Record<string, number>): HoldingAsset[] {
    const repriced = holdings.map((asset) => {
      const livePrice = prices[asset.symbol];
      const currentPrice = Number.isFinite(livePrice) && livePrice > 0 ? livePrice : asset.currentPrice;
      return { ...asset, currentPrice };
    });

    const totalValue = repriced.reduce((sum, asset) => sum + asset.amount * asset.currentPrice, 0);
    if (totalValue <= 0) {
      return repriced.map((asset) => ({ ...asset, allocation: 0 }));
    }

    return repriced.map((asset) => ({
      ...asset,
      allocation: (asset.amount * asset.currentPrice) / totalValue,
    }));
  }

  function toHoldingAsset(item: {
    symbol: string;
    name: string;
    amount: number;
    avgPrice: number;
    currentPrice: number;
  }): HoldingAsset {
    return {
      symbol: item.symbol,
      name: item.name,
      icon: ASSET_ICONS[item.symbol] || item.symbol[0],
      color: ASSET_COLORS[item.symbol] || '#888',
      amount: item.amount,
      avgPrice: item.avgPrice,
      currentPrice: item.currentPrice,
      allocation: 0,
    };
  }

  async function hydrateHoldings() {
    holdingsState = 'loading';
    holdingsStatusMessage = 'Syncing wallet holdings...';

    try {
      const res = await fetchHoldings();
      if (res?.ok && res.data.holdings.length > 0) {
        liveHoldings = res.data.holdings.map(toHoldingAsset);
        holdingsLoaded = true;
        holdingsState = 'live';
        holdingsStatusMessage = `Live holdings synced (${liveHoldings.length} assets)`;
        return;
      }
    } catch {
      // handled below with fallback state
    }

    liveHoldings = [];
    holdingsLoaded = false;
    holdingsState = 'fallback';
    holdingsStatusMessage = wallet.connected
      ? 'Live holdings unavailable. Showing demo holdings.'
      : 'Connect wallet to load live holdings.';
  }

  // Build effective holdings array: live API → static fallback + live price overlay
  $: baseHoldings = holdingsLoaded && liveHoldings.length > 0 ? liveHoldings : HOLDINGS_DATA;
  $: effectiveHoldings = withLivePrices(baseHoldings, liveP);

  // Holdings calculations
  $: total = effectiveHoldings.reduce((s, h) => s + h.amount * h.currentPrice, 0);
  $: totalCost = effectiveHoldings.reduce((s, h) => s + h.amount * h.avgPrice, 0);
  $: totalPnl = total - totalCost;
  $: totalPnlPct = totalCost > 0 ? ((totalPnl / totalCost) * 100) : 0;
  $: unrealizedPnl = opens.reduce((s, t) => s + t.pnlPercent, 0);

  // Tab state
  type TabType = 'profile' | 'wallet' | 'positions' | 'arena';
  let activeTab: TabType = 'profile';

  const TABS: { id: TabType; label: string; icon: string }[] = [
    { id: 'profile', label: 'PROFILE', icon: '📋' },
    { id: 'wallet', label: 'WALLET', icon: '💰' },
    { id: 'positions', label: 'POSITIONS', icon: '📊' },
    { id: 'arena', label: 'ARENA', icon: '⚔️' },
  ];

  // Avatar options
  const AVATAR_OPTIONS = [
    '/doge/doge-confident.jpg', '/doge/doge-happy.jpg', '/doge/doge-cute.jpg', '/doge/doge-default.jpg',
    '/doge/doge-think.jpg', '/doge/doge-alert.jpg', '/doge/doge-angry.jpg', '/doge/doge-win.jpg',
    '/doge/sticker-grin.png', '/doge/sticker-love.png', '/doge/sticker-heart.png', '/doge/sticker-laugh.png',
    '/doge/meme-buff.png', '/doge/meme-bodybuilder.png', '/doge/meme-greedy.png', '/doge/meme-money.png',
    '/doge/badge-verified.png', '/doge/badge-shield.png', '/doge/badge-rocket.png', '/doge/badge-diamond.png',
  ];

  let showAvatarPicker = false;
  let editingName = false;
  let nameInput = '';

  function pickAvatar(path: string) { setAvatar(path); showAvatarPicker = false; }
  function startEditName() { nameInput = profile.username; editingName = true; }
  function saveName() { if (nameInput.trim().length >= 2) setUsername(nameInput.trim()); editingName = false; }

  function tierColor(t: string): string {
    if (t === 'diamond') return '#00d4ff';
    if (t === 'gold') return '#ffd060';
    if (t === 'silver') return '#c0c0c0';
    return '#cd7f32';
  }
  function tierEmoji(t: string): string {
    if (t === 'diamond') return '💎';
    if (t === 'gold') return '🏆';
    if (t === 'silver') return '🌙';
    return '🐶';
  }
  function tierLabel(t: string): string {
    if (t === 'diamond') return 'DIAMOND PAWS';
    if (t === 'gold') return 'GOLD DOGE';
    if (t === 'silver') return 'SILVER MOON';
    return 'BRONZE WOW';
  }
  function pnlColor(v: number): string { return v >= 0 ? '#00ff88' : '#ff2d55'; }
  function pnlPrefix(v: number): string { return v >= 0 ? '+' : ''; }
  function timeSince(ts: number): string {
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 60) return `${sec}s ago`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    return `${Math.floor(sec / 86400)}d ago`;
  }

  function isPassportTab(value: string): value is TabType {
    return value === 'profile' || value === 'wallet' || value === 'positions' || value === 'arena';
  }

  function setActiveTab(tab: TabType) {
    if (tab === activeTab) return;
    activeTab = tab;
    void updateUiStateApi({ passportActiveTab: tab });
  }

  // Color map for known assets (donut chart)
  const ASSET_COLORS: Record<string, string> = {
    BTC: '#f7931a', ETH: '#627eea', SOL: '#14f195', AVAX: '#e84142',
    DOGE: '#c2a633', USDC: '#2775ca', USDT: '#26a17b', BNB: '#f3ba2f',
    ADA: '#0d1e30', MATIC: '#8247e5', DOT: '#e6007a', LINK: '#2a5ada',
  };
  const ASSET_ICONS: Record<string, string> = {
    BTC: '₿', ETH: 'Ξ', SOL: 'S', AVAX: 'A', DOGE: 'Ð',
    USDC: '$', USDT: '$', BNB: 'B', ADA: 'A', MATIC: 'M', DOT: 'D', LINK: 'L',
  };

  $: if (wallet.connected && wallet.address && wallet.address !== holdingsSyncAddress) {
    holdingsSyncAddress = wallet.address;
    void hydrateHoldings();
  }

  $: if (!wallet.connected && holdingsSyncAddress !== null) {
    holdingsSyncAddress = null;
  }

  // If wallet is disconnected after a live sync, clear cached live holdings
  // to avoid showing stale wallet data from a previous connection.
  $: if (
    (!wallet.connected || !wallet.address) &&
    (holdingsLoaded || liveHoldings.length > 0 || holdingsState === 'live')
  ) {
    holdingsSyncAddress = null;
    liveHoldings = [];
    holdingsLoaded = false;
    holdingsState = 'fallback';
    holdingsStatusMessage = 'Connect wallet to load live holdings.';
  }

  onMount(() => {
    hydrateUserProfile();
    hydrateAgentStats();
    void (async () => {
      const ui = await fetchUiStateApi();
      if (ui?.passportActiveTab && isPassportTab(ui.passportActiveTab)) {
        activeTab = ui.passportActiveTab;
      }
    })();

    if (!wallet.connected || !wallet.address) {
      void hydrateHoldings();
    }
  });
</script>

<div class="passport-page">
  <div class="sunburst"></div>
  <div class="halftone"></div>

  <div class="passport-scroll">
    <div class="passport-card">
      <!-- ═══ RIBBON ═══ -->
      <div class="card-ribbon">
        <span class="ribbon-text">MAXI⚡DOGE TRADER PASSPORT</span>
      </div>

      <!-- ═══ UNIFIED HEADER: PROFILE + PORTFOLIO ═══ -->
      <div class="unified-header">
        <div class="uh-left">
          <button class="doge-avatar" on:click={() => showAvatarPicker = !showAvatarPicker}>
            <img src={profile.avatar} alt="avatar" class="doge-img" />
            <span class="avatar-edit">✏️</span>
          </button>

          <div class="player-info">
            {#if editingName}
              <div class="name-edit">
                <input class="name-input" type="text" bind:value={nameInput} maxlength="16" on:keydown={(e) => e.key === 'Enter' && saveName()} />
                <button class="name-save" on:click={saveName}>✓</button>
              </div>
            {:else}
              <button class="player-name" on:click={startEditName}>
                {profile.username} <span class="name-pen">✏️</span>
              </button>
            {/if}
            <div class="player-tier" style="color:{tierColor(tier)}">
              {tierEmoji(tier)} {tierLabel(tier)}
            </div>
            {#if wallet.connected}
              <div class="player-addr">{wallet.shortAddr} · {wallet.chain}</div>
            {:else}
              <button class="connect-mini" on:click={openWalletModal}>🔗 CONNECT WALLET</button>
            {/if}
          </div>
        </div>

        <div class="uh-right">
          <div class="port-val">
            <div class="pv-label">PORTFOLIO</div>
            <div class="pv-amount">${(profile.balance.virtual + total).toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
            <div class="pv-pnl" class:up={totalPnl >= 0} class:down={totalPnl < 0}>
              {totalPnl >= 0 ? '▲' : '▼'} {pnlPrefix(totalPnlPct)}{totalPnlPct.toFixed(2)}%
            </div>
          </div>
          <div class="uh-stats">
            <div class="uhs">
              <span class="uhs-val" style="color:{pnlColor(pnl)}">{pnlPrefix(pnl)}{pnl.toFixed(1)}%</span>
              <span class="uhs-lbl">PnL</span>
            </div>
            <div class="uhs">
              <span class="uhs-val">{openPos}</span>
              <span class="uhs-lbl">OPEN</span>
            </div>
            <div class="uhs">
              <span class="uhs-val" style="color:#ff8c3b">{trackedCount}</span>
              <span class="uhs-lbl">TRACKED</span>
            </div>
            <div class="uhs">
              <span class="uhs-val">{wr}%</span>
              <span class="uhs-lbl">WIN RATE</span>
            </div>
          </div>
        </div>

        <div class="passport-stamp">
          <span class="stamp-text">{wallet.connected ? 'VERIFIED' : 'UNVERIFIED'}</span>
          <span class="stamp-icon">🐕</span>
        </div>
      </div>

      <!-- Avatar Picker -->
      {#if showAvatarPicker}
        <div class="avatar-picker">
          <div class="ap-title">SELECT AVATAR</div>
          <div class="ap-grid">
            {#each AVATAR_OPTIONS as opt}
              <button class="ap-opt" class:selected={profile.avatar === opt} on:click={() => pickAvatar(opt)}>
                <img src={opt} alt="avatar option" />
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <!-- ═══ TAB BAR ═══ -->
      <div class="tab-bar">
        {#each TABS as tab}
          <button
            class="tab-btn"
            class:active={activeTab === tab.id}
            on:click={() => setActiveTab(tab.id)}
          >
            <span class="tab-icon">{tab.icon}</span>
            <span class="tab-label">{tab.label}</span>
            {#if tab.id === 'positions' && openPos > 0}
              <span class="tab-badge">{openPos}</span>
            {/if}
            {#if tab.id === 'arena' && records.length > 0}
              <span class="tab-badge">{records.length}</span>
            {/if}
          </button>
        {/each}
      </div>

      <div class="quick-actions">
        <a class="qa-btn qa-terminal" href="/terminal" data-gtm-area="passport" data-gtm-action="open_terminal">
          ⚡ QUICK TRADE
        </a>
        <a class="qa-btn qa-arena" href="/arena" data-gtm-area="passport" data-gtm-action="open_arena">
          ⚔️ START ARENA
        </a>
        {#if wallet.connected}
          <div class="qa-chip connected" data-gtm-area="passport" data-gtm-action="wallet_status">
            <span class="qa-dot"></span>{wallet.shortAddr} CONNECTED
          </div>
        {:else}
          <button class="qa-btn qa-wallet" on:click={openWalletModal} data-gtm-area="passport" data-gtm-action="connect_wallet">
            🔗 CONNECT WALLET
          </button>
        {/if}
      </div>

      <!-- ═══ TAB CONTENT ═══ -->
      <div class="tab-content">

        <!-- ════ PROFILE TAB ════ -->
        {#if activeTab === 'profile'}
          <div class="profile-tab">
            <section class="content-panel">
              <div class="section-header">PERFORMANCE SNAPSHOT</div>
              <div class="metrics-grid metrics-primary">
                <div class="metric-card"><div class="mc-icon">🎯</div><div class="mc-value" class:up={stats.winRate >= 50}>{stats.winRate}%</div><div class="mc-label">WIN RATE</div></div>
                <div class="metric-card"><div class="mc-icon">💰</div><div class="mc-value" style="color:{pnlColor(stats.totalPnL)}">{pnlPrefix(stats.totalPnL)}{stats.totalPnL.toFixed(1)}%</div><div class="mc-label">TOTAL PnL</div></div>
                <div class="metric-card"><div class="mc-icon">⚔️</div><div class="mc-value">{stats.totalMatches}</div><div class="mc-label">MATCHES</div></div>
                <div class="metric-card"><div class="mc-icon">🔥</div><div class="mc-value fire">{stats.bestStreak}</div><div class="mc-label">BEST STREAK</div></div>
              </div>

              <details class="detail-block">
                <summary>MORE PERFORMANCE METRICS</summary>
                <div class="metrics-grid metrics-detail">
                  <div class="metric-card"><div class="mc-icon">🧭</div><div class="mc-value">{stats.directionAccuracy}%</div><div class="mc-label">DIRECTION ACC</div></div>
                  <div class="metric-card"><div class="mc-icon">💡</div><div class="mc-value">{stats.avgConfidence}%</div><div class="mc-label">AVG CONFIDENCE</div></div>
                  <div class="metric-card"><div class="mc-icon">📌</div><div class="mc-value">{stats.trackedSignals}</div><div class="mc-label">TRACKED</div></div>
                  <div class="metric-card"><div class="mc-icon">🤖</div><div class="mc-value">{stats.agentWins}</div><div class="mc-label">AGENT WINS</div></div>
                </div>
              </details>

              <div class="summary-line">
                {stats.totalMatches > 0
                  ? `${gState.wins}W-${gState.losses}L | ${pnlPrefix(stats.totalPnL)}${stats.totalPnL.toFixed(1)}% PnL | 🔥 ${stats.streak}-streak`
                  : 'No matches yet — Start an Arena battle!'}
              </div>
            </section>

            <section class="content-panel">
              <details class="detail-block">
                <summary>AGENT SQUAD ({AGDEFS.length})</summary>
                <div class="agent-perf-grid">
                  {#each AGDEFS as ag}
                    {@const ags = agStats[ag.id]}
                    <div class="agent-perf-card" style="border-left-color:{ag.color}">
                      <div class="apc-head">
                        {#if ag.img?.def}
                          <img src={ag.img.def} alt={ag.name} class="apc-img" />
                        {:else}
                          <span class="apc-icon">{ag.icon}</span>
                        {/if}
                        <div>
                          <div class="apc-name" style="color:{ag.color}">{ag.name}</div>
                          <div class="apc-role">{ag.role}</div>
                        </div>
                        <div class="apc-level">Lv.{ags?.level || 1}</div>
                      </div>
                      <div class="apc-bar-wrap">
                        <div class="apc-bar" style="width:{Math.min((ags?.xp || 0) / (((ags?.level || 1) + 1) * 100) * 100, 100)}%;background:{ag.color}"></div>
                      </div>
                      <div class="apc-xp">XP: {ags?.xp || 0} / {((ags?.level || 1) + 1) * 100}</div>
                    </div>
                  {/each}
                </div>
              </details>
            </section>

            <section class="content-panel">
              <details class="detail-block">
                <summary>BADGES ({earned.length}/{earned.length + locked.length})</summary>
                <div class="badges-grid">
                  {#each earned as badge}
                    <div class="badge-card earned">
                      <span class="badge-icon">{badge.icon}</span>
                      <span class="badge-name">{badge.name}</span>
                      <span class="badge-date">{badge.earnedAt ? new Date(badge.earnedAt).toLocaleDateString() : ''}</span>
                    </div>
                  {/each}
                  {#each locked as badge}
                    <div class="badge-card locked">
                      <span class="badge-icon">🔒</span>
                      <span class="badge-name">{badge.name}</span>
                      <span class="badge-desc">{badge.description}</span>
                    </div>
                  {/each}
                </div>
              </details>
            </section>
          </div>

        <!-- ════ WALLET TAB ════ -->
        {:else if activeTab === 'wallet'}
          <div class="wallet-tab">
            <section class="content-panel">
              <div class="vb-card">
                <div class="vb-header"><span class="vb-icon">🏦</span><span class="vb-title">VIRTUAL BALANCE</span></div>
                <div class="vb-amount">${profile.balance.virtual.toLocaleString()}</div>
                {#if !wallet.connected}
                  <button class="vb-connect" on:click={openWalletModal}>🔗 CONNECT WALLET FOR DEFI</button>
                {:else}
                  <div class="vb-connected"><span class="vbc-dot"></span>{wallet.shortAddr} · {wallet.chain} · {wallet.balance.toLocaleString()} USDT</div>
                {/if}
              </div>
            </section>

            <section class="content-panel">
              <div class="holdings-status" class:live={holdingsState === 'live'}>
                <span class="hs-dot"></span>
                <span>{holdingsStatusMessage}</span>
              </div>

              <div class="wallet-kpis">
                <div class="wk-item"><span class="wk-k">ASSETS</span><span class="wk-v">{effectiveHoldings.length}</span></div>
                <div class="wk-item"><span class="wk-k">TOTAL VALUE</span><span class="wk-v">${total.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span></div>
                <div class="wk-item"><span class="wk-k">HOLDINGS PnL</span><span class="wk-v" style="color:{pnlColor(totalPnl)}">{pnlPrefix(totalPnlPct)}{totalPnlPct.toFixed(2)}%</span></div>
              </div>

              <details class="detail-block">
                <summary>HOLDINGS BREAKDOWN</summary>
                <div class="holdings-body">
                  <div class="donut-section">
                    <div class="st">ALLOCATION</div>
                    <div class="donut-wrap">
                      <svg viewBox="0 0 200 200">
                        {#each effectiveHoldings as asset, i}
                          {@const offset = effectiveHoldings.slice(0, i).reduce((s, a) => s + a.allocation * 100, 0)}
                          {@const pct = asset.allocation * 100}
                          <circle cx="100" cy="100" r="70" fill="none" stroke={asset.color} stroke-width="30"
                            stroke-dasharray="{pct * 4.4} {(100 - pct) * 4.4}"
                            stroke-dashoffset="{-offset * 4.4}" transform="rotate(-90 100 100)" />
                        {/each}
                        <circle cx="100" cy="100" r="55" fill="#0a0a1a" />
                        <text x="100" y="95" text-anchor="middle" fill="#fff" font-size="16" font-weight="900" font-family="var(--fd)">{effectiveHoldings.length}</text>
                        <text x="100" y="112" text-anchor="middle" fill="#888" font-size="9" font-family="var(--fm)">ASSETS</text>
                      </svg>
                    </div>
                    <div class="legend">
                      {#each effectiveHoldings as asset}
                        <div class="legend-item"><span class="li-dot" style="background:{asset.color}"></span><span class="li-name">{asset.symbol}</span><span class="li-pct">{(asset.allocation * 100).toFixed(0)}%</span></div>
                      {/each}
                    </div>
                  </div>

                  <div class="table-section">
                    <div class="st">HOLDINGS</div>
                    <div class="htable">
                      <div class="hrow header-row"><span class="hc asset-col">ASSET</span><span class="hc">AMOUNT</span><span class="hc">VALUE</span><span class="hc">PnL</span></div>
                      {#each effectiveHoldings as asset}
                        {@const assetPnl = calcPnL(asset)}
                        {@const value = asset.amount * asset.currentPrice}
                        <div class="hrow">
                          <div class="hc asset-col"><span class="ai" style="background:{asset.color}">{asset.icon}</span><div><div class="an">{asset.symbol}</div><div class="af">{asset.name}</div></div></div>
                          <span class="hc num">{asset.amount.toLocaleString()}</span>
                          <span class="hc num">${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                          <span class="hc num" style="color:{pnlColor(assetPnl.amount)}">{pnlPrefix(assetPnl.percent)}{assetPnl.percent.toFixed(1)}%</span>
                        </div>
                      {/each}
                    </div>
                  </div>
                </div>
              </details>
            </section>
          </div>

        <!-- ════ POSITIONS TAB ════ -->
        {:else if activeTab === 'positions'}
          <div class="positions-tab">
            <section class="content-panel">
              <div class="pos-summary">
                <div class="ps-item"><div class="psi-label">OPEN</div><div class="psi-value">{opens.length}</div></div>
                <div class="ps-item"><div class="psi-label">UNREALIZED</div><div class="psi-value" style="color:{pnlColor(unrealizedPnl)}">{pnlPrefix(unrealizedPnl)}{unrealizedPnl.toFixed(2)}%</div></div>
                <div class="ps-item"><div class="psi-label">TRACKED</div><div class="psi-value" style="color:#ff8c3b">{tracked.length}</div></div>
                <div class="ps-item"><div class="psi-label">TOTAL PnL</div><div class="psi-value" style="color:{pnlColor(pnl)}">{pnlPrefix(pnl)}{pnl.toFixed(2)}%</div></div>
              </div>
            </section>

            <section class="content-panel list-panel">
              {#if opens.length > 0}
                <div class="pos-section-title">OPEN TRADES</div>
                {#each opens as trade (trade.id)}
                  <div class="pos-row">
                    <div class="pr-left">
                      <span class="pr-dir" class:long={trade.dir === 'LONG'} class:short={trade.dir === 'SHORT'}>{trade.dir === 'LONG' ? '▲' : '▼'}{trade.dir}</span>
                      <span class="pr-pair">{trade.pair}</span>
                      <span class="pr-src">{trade.source}</span>
                    </div>
                    <div class="pr-right">
                      <span class="pr-entry">${Math.round(trade.entry).toLocaleString()}</span>
                      <span class="pr-pnl" style="color:{pnlColor(trade.pnlPercent)}">{pnlPrefix(trade.pnlPercent)}{trade.pnlPercent.toFixed(2)}%</span>
                      <span class="pr-time">{timeSince(trade.openedAt)}</span>
                    </div>
                  </div>
                {/each}
              {:else}
                <EmptyState image={CHARACTER_ART.tradeActions} title="NO OPEN POSITIONS" subtitle="Use QUICK LONG/SHORT in the Terminal to start trading" ctaText="GO TO TERMINAL →" ctaHref="/terminal" icon="📊" variant="cyan" compact />
              {/if}

              {#if tracked.length > 0}
                <details class="detail-block" style="margin-top: 12px;">
                  <summary>TRACKED SIGNALS ({tracked.length})</summary>
                  {#each tracked as sig (sig.id)}
                    <div class="pos-row tracked">
                      <div class="pr-left">
                        <span class="pr-dir" class:long={sig.dir === 'LONG'} class:short={sig.dir === 'SHORT'}>{sig.dir === 'LONG' ? '▲' : '▼'}{sig.dir}</span>
                        <span class="pr-pair">{sig.pair}</span>
                        <span class="pr-src">📌 {sig.source}</span>
                      </div>
                      <div class="pr-right">
                        <span class="pr-pnl" style="color:{pnlColor(sig.pnlPercent)}">{pnlPrefix(sig.pnlPercent)}{sig.pnlPercent.toFixed(2)}%</span>
                        <span class="pr-time">{timeSince(sig.trackedAt)}</span>
                      </div>
                    </div>
                  {/each}
                </details>
              {/if}

              {#if closed.length > 0}
                <details class="detail-block" style="margin-top: 12px;">
                  <summary>RECENTLY CLOSED ({closed.length})</summary>
                  {#each closed.slice(0, 10) as trade (trade.id)}
                    <div class="pos-row closed">
                      <div class="pr-left">
                        <span class="pr-dir" class:long={trade.dir === 'LONG'} class:short={trade.dir === 'SHORT'}>{trade.dir === 'LONG' ? '▲' : '▼'}</span>
                        <span class="pr-pair">{trade.pair}</span>
                      </div>
                      <div class="pr-right">
                        <span class="pr-pnl" style="color:{pnlColor(trade.closePnl || 0)}">{pnlPrefix(trade.closePnl || 0)}{(trade.closePnl || 0).toFixed(2)}%</span>
                      </div>
                    </div>
                  {/each}
                </details>
              {/if}
            </section>
          </div>

        <!-- ════ ARENA TAB ════ -->
        {:else if activeTab === 'arena'}
          <div class="arena-tab">
            <section class="content-panel">
              <div class="arena-stats">
                <div class="as-item"><div class="asi-val">{records.length}</div><div class="asi-label">MATCHES</div></div>
                <div class="as-item"><div class="asi-val" style="color:#00ff88">{wr}%</div><div class="asi-label">WIN RATE</div></div>
                <div class="as-item"><div class="asi-val" style="color:#ff8c3b">🔥 {bStreak}</div><div class="asi-label">BEST STREAK</div></div>
                <div class="as-item"><div class="asi-val" style="color:#ffd060">{gState.lp.toLocaleString()}</div><div class="asi-label">LP EARNED</div></div>
              </div>
            </section>

            <section class="content-panel list-panel">
              {#if records.length > 0}
                <details class="detail-block">
                  <summary>MATCH HISTORY ({Math.min(records.length, 20)})</summary>
                  {#each records.slice(0, 20) as match (match.id)}
                    <div class="match-row" class:win={match.win} class:loss={!match.win}>
                      <div class="mr-left">
                        <span class="mr-result" class:win={match.win}>{match.win ? 'WIN' : 'LOSS'}</span>
                        <span class="mr-num">#{match.matchN}</span>
                        <span class="mr-time">{timeSince(match.timestamp)}</span>
                      </div>
                      <div class="mr-right">
                        <span class="mr-lp" class:plus={match.lp >= 0} class:minus={match.lp < 0}>{match.lp >= 0 ? '+' : ''}{match.lp} LP</span>
                        {#if match.hypothesis}
                          <span class="mr-hyp" class:long={match.hypothesis.dir === 'LONG'} class:short={match.hypothesis.dir === 'SHORT'}>{match.hypothesis.dir}</span>
                        {/if}
                        <span class="mr-agents">
                          {#each (match.agentVotes || []).slice(0, 3) as vote}
                            <span class="mr-agent-dot" style="background:{vote.color}" title="{vote.name}: {vote.dir}"></span>
                          {/each}
                        </span>
                      </div>
                    </div>
                  {/each}
                </details>
              {:else}
                <EmptyState image={CHARACTER_ART.actionVictory} title="NO ARENA MATCHES YET" subtitle="Challenge the AI agents!" ctaText="GO TO ARENA →" ctaHref="/arena" icon="⚔️" variant="pink" compact />
              {/if}
            </section>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .passport-page {
    --shell-dark: #0d0e1d;
    --shell-mid: #171936;
    --panel-line: rgba(255, 255, 255, 0.12);
    --panel-soft: rgba(255, 255, 255, 0.06);
    --text-soft: rgba(255, 255, 255, 0.72);
    --text-dim: rgba(255, 255, 255, 0.45);
    --ink: #090909;
    height: 100%;
    overflow: hidden;
    background:
      radial-gradient(circle at 14% 22%, rgba(255, 235, 120, 0.75) 0%, rgba(255, 230, 0, 0) 36%),
      radial-gradient(circle at 88% 8%, rgba(255, 180, 0, 0.58) 0%, rgba(255, 180, 0, 0) 26%),
      repeating-conic-gradient(#ffcc00 0deg 10deg, #ffe600 10deg 20deg);
    display: flex;
    justify-content: center;
    position: relative;
  }

  .sunburst {
    position: absolute;
    inset: -50%;
    z-index: 0;
    pointer-events: none;
    background: repeating-conic-gradient(transparent 0deg 8deg, rgba(255, 180, 0, 0.08) 8deg 16deg);
    animation: spin 60s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .halftone {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    background-image: radial-gradient(circle, rgba(0, 0, 0, 0.05) 1px, transparent 1px);
    background-size: 8px 8px;
  }

  .passport-scroll {
    position: relative;
    z-index: 10;
    width: 100%;
    max-width: 1120px;
    height: 100%;
    overflow-y: auto;
    padding: 18px;
    box-sizing: border-box;
  }

  .passport-scroll::-webkit-scrollbar {
    width: 4px;
  }

  .passport-scroll::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.24);
    border-radius: 3px;
  }

  .passport-card {
    position: relative;
    overflow: hidden;
    border: 4px solid #000;
    border-radius: 20px;
    box-shadow: 7px 7px 0 #000;
    background:
      linear-gradient(180deg, #fffce8 0%, #fff7cb 24%, var(--shell-mid) 24.01%, #10142a 100%);
  }

  .passport-card::before {
    content: '';
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 200px;
    height: 200px;
    background: url('/doge/trade-sheet.png') center/cover no-repeat;
    opacity: 0.05;
    pointer-events: none;
    z-index: 0;
  }

  .card-ribbon {
    position: relative;
    z-index: 2;
    background: linear-gradient(90deg, #070711 0%, #12172f 55%, #1e2853 100%);
    padding: 10px 18px;
    border-bottom: 2px solid #000;
  }

  .ribbon-text {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--fd);
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 2.8px;
    color: var(--yel);
  }

  .unified-header {
    position: relative;
    z-index: 2;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 18px;
    padding: 16px 18px 14px;
    border-bottom: 2px solid #000;
  }

  .uh-left {
    display: flex;
    gap: 14px;
    align-items: center;
    min-width: 0;
  }

  .uh-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 10px;
    min-width: 248px;
  }

  .doge-avatar {
    position: relative;
    width: 74px;
    height: 74px;
    border-radius: 16px;
    border: 4px solid #000;
    overflow: hidden;
    box-shadow: 4px 4px 0 #000;
    flex-shrink: 0;
    cursor: pointer;
    background: none;
    padding: 0;
    transition: transform 0.16s ease;
  }

  .doge-avatar:hover {
    transform: scale(1.045);
  }

  .doge-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .avatar-edit {
    position: absolute;
    bottom: 2px;
    right: 2px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2px solid #000;
    background: var(--yel);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
  }

  .player-info {
    flex: 1;
    min-width: 0;
  }

  .player-name {
    font-family: var(--fc);
    font-size: 24px;
    color: var(--ink);
    letter-spacing: 0.9px;
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
    text-align: left;
    transition: opacity 0.15s;
  }

  .player-name:hover {
    opacity: 0.72;
  }

  .name-pen {
    font-size: 12px;
    opacity: 0.46;
  }

  .name-edit {
    display: flex;
    gap: 6px;
  }

  .name-input {
    font-family: var(--fb);
    font-size: 15px;
    color: #151515;
    border: 2px solid #000;
    border-radius: 8px;
    padding: 6px 8px;
    width: 170px;
    outline: none;
    background: #fffef5;
  }

  .name-save {
    background: var(--yel);
    border: 2px solid #000;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 900;
    cursor: pointer;
    padding: 4px 10px;
  }

  .player-tier {
    font-family: var(--fd);
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 1.4px;
  }

  .player-addr {
    margin-top: 5px;
    font-family: var(--fm);
    font-size: 11px;
    color: #6f6f76;
    word-break: break-word;
  }

  .connect-mini {
    margin-top: 5px;
    font-family: var(--fm);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.8px;
    color: #111;
    background: var(--yel);
    border: 2px solid #000;
    border-radius: 8px;
    padding: 5px 10px;
    cursor: pointer;
    transition: transform 0.14s ease;
  }

  .connect-mini:hover {
    transform: translateY(-1px);
  }

  .port-val {
    text-align: right;
  }

  .pv-label {
    font-family: var(--fm);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 1.6px;
    color: #5d5d64;
  }

  .pv-amount {
    margin-top: 2px;
    font-family: var(--fd);
    font-size: clamp(24px, 2.7vw, 32px);
    font-weight: 900;
    color: #050505;
    letter-spacing: 0.5px;
    line-height: 1.05;
  }

  .pv-pnl {
    margin-top: 4px;
    font-family: var(--fm);
    font-size: 11px;
    font-weight: 800;
  }

  .pv-pnl.up {
    color: #00a550;
  }

  .pv-pnl.down {
    color: #cc0033;
  }

  .uh-stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(56px, 1fr));
    gap: 8px;
  }

  .uhs {
    padding: 8px 7px;
    text-align: center;
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.44);
  }

  .uhs-val {
    display: block;
    font-family: var(--fd);
    font-size: 13px;
    font-weight: 900;
    color: #111;
    line-height: 1.1;
  }

  .uhs-lbl {
    display: block;
    margin-top: 4px;
    font-family: var(--fm);
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.8px;
    color: #5f6068;
  }

  .passport-stamp {
    position: absolute;
    top: 10px;
    right: 12px;
    display: flex;
    align-items: center;
    gap: 4px;
    transform: rotate(10deg);
    border: 2px solid #c5002f;
    border-radius: 12px;
    padding: 4px 10px;
    font-family: var(--fd);
    color: #c5002f;
    background: rgba(255, 255, 255, 0.62);
    opacity: 0.76;
  }

  .stamp-text {
    font-size: 9px;
    letter-spacing: 1.4px;
    font-weight: 800;
  }

  .stamp-icon {
    font-size: 12px;
  }

  .avatar-picker {
    position: relative;
    z-index: 3;
    margin: 0 18px 12px;
    padding: 12px;
    border: 2px solid #000;
    border-radius: 12px;
    background: linear-gradient(180deg, #fffef7, #fff6cf);
    box-shadow: 3px 3px 0 #000;
  }

  .ap-title {
    margin-bottom: 8px;
    font-family: var(--fd);
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 1.4px;
    color: #53545d;
  }

  .ap-grid {
    display: grid;
    grid-template-columns: repeat(10, minmax(0, 1fr));
    gap: 6px;
  }

  .ap-opt {
    width: 100%;
    aspect-ratio: 1;
    border-radius: 10px;
    border: 2px solid transparent;
    overflow: hidden;
    cursor: pointer;
    padding: 0;
    background: none;
    transition: all 0.15s;
  }

  .ap-opt:hover {
    border-color: #000;
    transform: translateY(-1px);
  }

  .ap-opt.selected {
    border-color: #000;
    box-shadow: 2px 2px 0 #000;
  }

  .ap-opt img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .tab-bar {
    position: sticky;
    top: 0;
    z-index: 4;
    display: flex;
    background: linear-gradient(90deg, #070810 0%, #12152a 48%, #1f2550 100%);
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
    backdrop-filter: blur(8px);
  }

  .tab-btn {
    position: relative;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 44px;
    padding: 10px 8px;
    background: transparent;
    border: none;
    border-bottom: 3px solid transparent;
    color: rgba(255, 255, 255, 0.5);
    font-family: var(--fm);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 1px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .tab-btn:hover {
    color: rgba(255, 255, 255, 0.86);
    background: rgba(255, 255, 255, 0.04);
  }

  .tab-btn.active {
    color: var(--yel);
    border-bottom-color: var(--yel);
    background: rgba(255, 230, 0, 0.08);
  }

  .tab-icon {
    font-size: 13px;
  }

  .tab-badge {
    position: absolute;
    top: 6px;
    right: 10px;
    min-width: 16px;
    height: 16px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 5px;
    background: var(--yel);
    color: #000;
    font-family: var(--fd);
    font-size: 8px;
    font-weight: 900;
  }

  .quick-actions {
    position: relative;
    z-index: 2;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: linear-gradient(90deg, #0c0f20 0%, #161c38 100%);
  }

  .qa-btn,
  .qa-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 32px;
    padding: 0 12px;
    border-radius: 999px;
    font-family: var(--fm);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.8px;
    text-decoration: none;
    white-space: nowrap;
  }

  .qa-btn {
    border: 1px solid rgba(255, 255, 255, 0.22);
    color: #eef0ff;
    background: rgba(255, 255, 255, 0.03);
    cursor: pointer;
    transition: transform 0.14s ease, border-color 0.14s ease, background 0.14s ease;
  }

  .qa-btn:hover {
    transform: translateY(-1px);
    border-color: rgba(255, 255, 255, 0.42);
    background: rgba(255, 255, 255, 0.09);
  }

  .qa-terminal {
    border-color: rgba(255, 230, 0, 0.44);
    color: #fff8b2;
    background: rgba(255, 230, 0, 0.08);
  }

  .qa-arena {
    border-color: rgba(255, 45, 155, 0.44);
    color: #ffd2ec;
    background: rgba(255, 45, 155, 0.1);
  }

  .qa-wallet {
    border-color: rgba(0, 212, 255, 0.44);
    color: #d5f6ff;
    background: rgba(0, 212, 255, 0.12);
  }

  .qa-chip {
    margin-left: auto;
    border: 1px solid rgba(0, 255, 136, 0.4);
    color: #ceffe8;
    background: rgba(0, 255, 136, 0.09);
  }

  .qa-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--grn);
    box-shadow: 0 0 5px rgba(0, 255, 136, 0.7);
  }

  .tab-content {
    position: relative;
    z-index: 1;
    padding: 14px;
    background: linear-gradient(180deg, var(--shell-mid), var(--shell-dark));
  }

  .profile-tab,
  .wallet-tab,
  .positions-tab,
  .arena-tab {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .content-panel {
    border: 1px solid var(--panel-line);
    border-radius: 14px;
    padding: 12px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.015) 100%),
      rgba(3, 6, 22, 0.7);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.02);
  }

  .list-panel {
    padding-top: 10px;
  }

  .section-header {
    margin-bottom: 10px;
    font-family: var(--fd);
    font-size: 12px;
    color: rgba(255, 255, 255, 0.96);
    letter-spacing: 1.2px;
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
  }

  .metric-card {
    border: 1px solid var(--panel-line);
    border-radius: 10px;
    padding: 10px 8px;
    text-align: center;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03));
    transition: transform 0.14s ease, border-color 0.14s ease;
  }

  .metric-card:hover {
    transform: translateY(-1px);
    border-color: rgba(255, 255, 255, 0.26);
  }

  .mc-icon {
    font-size: 15px;
    margin-bottom: 3px;
  }

  .mc-value {
    font-family: var(--fd);
    font-size: 18px;
    font-weight: 900;
    color: #fff;
    line-height: 1.1;
  }

  .mc-value.up {
    color: var(--grn);
  }

  .mc-value.fire {
    color: #ff8c3b;
  }

  .mc-label {
    margin-top: 5px;
    font-family: var(--fm);
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.8px;
    color: var(--text-dim);
  }

  .summary-line {
    margin-top: 10px;
    text-align: center;
    font-family: var(--fm);
    font-size: 11px;
    font-weight: 700;
    color: var(--text-soft);
    padding: 8px 10px;
    border-radius: 10px;
    border: 1px dashed rgba(255, 255, 255, 0.24);
    background: rgba(255, 255, 255, 0.04);
  }

  .agent-perf-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .agent-perf-card {
    border: 1px solid var(--panel-line);
    border-left-width: 4px;
    border-radius: 10px;
    padding: 10px;
    background: rgba(255, 255, 255, 0.03);
  }

  .apc-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .apc-img {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    object-fit: cover;
  }

  .apc-icon {
    font-size: 20px;
  }

  .apc-name {
    font-family: var(--fm);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.5px;
  }

  .apc-role {
    font-family: var(--fm);
    font-size: 9px;
    color: var(--text-dim);
  }

  .apc-level {
    margin-left: auto;
    font-family: var(--fd);
    font-size: 10px;
    font-weight: 900;
    color: var(--pk);
    background: rgba(255, 45, 155, 0.09);
    border: 1px solid rgba(255, 45, 155, 0.32);
    border-radius: 8px;
    padding: 2px 7px;
  }

  .apc-bar-wrap {
    height: 6px;
    border-radius: 999px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.08);
    margin-bottom: 4px;
  }

  .apc-bar {
    height: 100%;
    border-radius: 999px;
    transition: width 0.5s;
  }

  .apc-xp {
    font-family: var(--fm);
    font-size: 10px;
    color: var(--text-dim);
  }

  .badges-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
  }

  .badge-card {
    border: 1px solid var(--panel-line);
    border-radius: 10px;
    padding: 10px 8px;
    text-align: center;
    transition: transform 0.14s ease;
  }

  .badge-card:hover {
    transform: translateY(-1px);
  }

  .badge-card.earned {
    background: linear-gradient(145deg, rgba(255, 230, 0, 0.18), rgba(255, 170, 0, 0.06));
    border-color: rgba(255, 230, 0, 0.3);
  }

  .badge-card.locked {
    background: rgba(255, 255, 255, 0.02);
    opacity: 0.62;
  }

  .badge-icon {
    display: block;
    font-size: 22px;
    margin-bottom: 4px;
  }

  .badge-name {
    display: block;
    font-family: var(--fm);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.3px;
    color: rgba(255, 255, 255, 0.8);
  }

  .badge-date,
  .badge-desc {
    display: block;
    margin-top: 3px;
    font-family: var(--fm);
    font-size: 9px;
    color: var(--text-dim);
  }

  .vb-card {
    border: 1px solid rgba(255, 230, 0, 0.34);
    border-radius: 12px;
    padding: 14px;
    background: linear-gradient(145deg, rgba(255, 230, 0, 0.12), rgba(255, 230, 0, 0.03));
  }

  .vb-header {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-bottom: 4px;
  }

  .vb-icon {
    font-size: 16px;
  }

  .vb-title {
    font-family: var(--fm);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 1.4px;
    color: rgba(255, 255, 255, 0.66);
  }

  .vb-amount {
    font-family: var(--fd);
    font-size: clamp(26px, 3vw, 34px);
    font-weight: 900;
    color: var(--yel);
    letter-spacing: 0.8px;
  }

  .vb-connect {
    margin-top: 10px;
    font-family: var(--fm);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.8px;
    color: #000;
    background: var(--yel);
    border: 2px solid #000;
    border-radius: 8px;
    padding: 7px 12px;
    cursor: pointer;
    transition: transform 0.14s ease;
  }

  .vb-connect:hover {
    transform: translateY(-1px);
  }

  .vb-connected {
    margin-top: 8px;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-family: var(--fm);
    font-size: 11px;
    color: var(--text-soft);
  }

  .vbc-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--grn);
    box-shadow: 0 0 6px rgba(0, 255, 136, 0.75);
  }

  .holdings-status {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    margin-bottom: 12px;
    padding: 5px 10px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: rgba(255, 255, 255, 0.03);
    color: var(--text-soft);
    font-family: var(--fm);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.55px;
  }

  .holdings-status.live {
    border-color: rgba(0, 255, 136, 0.42);
    color: rgba(223, 255, 236, 0.95);
  }

  .hs-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #ff8c3b;
    box-shadow: 0 0 5px rgba(255, 140, 59, 0.65);
    flex-shrink: 0;
  }

  .holdings-status.live .hs-dot {
    background: var(--grn);
    box-shadow: 0 0 6px rgba(0, 255, 136, 0.75);
  }

  .holdings-body {
    display: grid;
    grid-template-columns: minmax(230px, 280px) minmax(0, 1fr);
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--panel-soft);
    border-radius: 12px;
    overflow: hidden;
  }

  .st {
    font-family: var(--fd);
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 1.4px;
    color: var(--text-soft);
    padding: 10px 12px;
    border-bottom: 1px solid var(--panel-soft);
  }

  .donut-section {
    border-right: 1px solid var(--panel-soft);
  }

  .donut-wrap {
    padding: 8px 16px;
  }

  .donut-wrap svg {
    width: 100%;
    max-width: 176px;
    display: block;
    margin: 0 auto;
  }

  .legend {
    padding: 0 12px 12px;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-family: var(--fm);
    color: #d2d5df;
  }

  .li-dot {
    width: 8px;
    height: 8px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .li-name {
    font-weight: 700;
  }

  .li-pct {
    margin-left: auto;
    color: #a4a8b5;
    font-weight: 700;
  }

  .table-section {
    overflow-x: auto;
  }

  .htable {
    padding: 0 10px 10px;
    min-width: 460px;
  }

  .hrow {
    display: grid;
    grid-template-columns: 1.6fr 1fr 1fr 1fr;
    gap: 8px;
    padding: 9px 6px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    align-items: center;
  }

  .hrow:not(.header-row):hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .header-row {
    font-family: var(--fm);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 1px;
    color: #9fa4b3;
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  }

  .hc {
    font-size: 11px;
    font-family: var(--fm);
    color: #d6d9e3;
  }

  .hc.num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .asset-col {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .ai {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 900;
    color: #fff;
    flex-shrink: 0;
  }

  .an {
    font-size: 11px;
    font-weight: 900;
    font-family: var(--fd);
    color: #fff;
    letter-spacing: 0.3px;
  }

  .af {
    font-size: 9px;
    color: #99a0b1;
    font-family: var(--fm);
    margin-top: 2px;
  }

  .pos-summary,
  .arena-stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
  }

  .ps-item,
  .as-item {
    text-align: center;
    padding: 10px 8px;
    border: 1px solid var(--panel-line);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.03);
  }

  .psi-label,
  .asi-label {
    font-family: var(--fm);
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 1px;
    color: var(--text-dim);
    margin-bottom: 4px;
  }

  .psi-value,
  .asi-val {
    font-family: var(--fd);
    font-size: 19px;
    font-weight: 900;
    color: #fff;
    line-height: 1.1;
  }

  .pos-section-title {
    margin-bottom: 6px;
    font-family: var(--fd);
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 1.4px;
    color: rgba(255, 255, 255, 0.72);
  }

  .pos-row,
  .match-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 9px 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    transition: background 0.12s ease;
  }

  .pos-row:hover,
  .match-row:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .pos-row.tracked {
    background: rgba(255, 140, 59, 0.05);
  }

  .pos-row.closed {
    opacity: 0.62;
  }

  .pr-left,
  .mr-left {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .pr-dir,
  .mr-result {
    font-family: var(--fm);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.6px;
    padding: 3px 6px;
    border-radius: 5px;
    border: 1px solid;
    flex-shrink: 0;
  }

  .pr-dir.long {
    color: var(--grn);
    border-color: rgba(0, 255, 136, 0.35);
    background: rgba(0, 255, 136, 0.09);
  }

  .pr-dir.short {
    color: var(--red);
    border-color: rgba(255, 45, 85, 0.35);
    background: rgba(255, 45, 85, 0.09);
  }

  .pr-pair {
    font-family: var(--fm);
    font-size: 12px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.82);
  }

  .pr-src {
    font-family: var(--fm);
    font-size: 10px;
    color: var(--text-dim);
    background: rgba(255, 255, 255, 0.05);
    padding: 2px 6px;
    border-radius: 999px;
    white-space: nowrap;
  }

  .pr-right,
  .mr-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .pr-entry,
  .mr-time {
    font-family: var(--fm);
    font-size: 10px;
    color: var(--text-dim);
  }

  .pr-pnl,
  .mr-lp {
    font-family: var(--fd);
    font-size: 13px;
    font-weight: 900;
    min-width: 62px;
    text-align: right;
  }

  .pr-time {
    font-family: var(--fm);
    font-size: 10px;
    color: var(--text-dim);
  }

  .match-row.win {
    border-left: 3px solid var(--grn);
  }

  .match-row.loss {
    border-left: 3px solid var(--red);
  }

  .mr-result {
    border: none;
  }

  .mr-result.win {
    color: var(--grn);
    background: rgba(0, 255, 136, 0.1);
  }

  .mr-result:not(.win) {
    color: var(--red);
    background: rgba(255, 45, 85, 0.1);
  }

  .mr-num {
    font-family: var(--fd);
    font-size: 11px;
    color: var(--text-soft);
  }

  .mr-lp.plus {
    color: var(--grn);
  }

  .mr-lp.minus {
    color: var(--red);
  }

  .mr-hyp {
    font-family: var(--fm);
    font-size: 10px;
    font-weight: 800;
    padding: 2px 6px;
    border-radius: 5px;
    border: 1px solid;
  }

  .mr-hyp.long {
    color: var(--grn);
    border-color: rgba(0, 255, 136, 0.4);
  }

  .mr-hyp.short {
    color: var(--red);
    border-color: rgba(255, 45, 85, 0.4);
  }

  .mr-agents {
    display: flex;
    gap: 4px;
  }

  .mr-agent-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    display: inline-block;
  }

  @media (max-width: 980px) {
    .passport-scroll {
      padding: 12px;
    }

    .unified-header {
      grid-template-columns: 1fr;
      gap: 14px;
    }

    .uh-right {
      min-width: 0;
      align-items: flex-start;
    }

    .port-val {
      text-align: left;
    }

    .uh-stats {
      width: 100%;
    }

    .qa-chip {
      margin-left: 0;
    }

    .ap-grid {
      grid-template-columns: repeat(8, minmax(0, 1fr));
    }
  }

  @media (max-width: 720px) {
    .metrics-grid,
    .pos-summary,
    .arena-stats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .agent-perf-grid,
    .badges-grid {
      grid-template-columns: 1fr;
    }

    .holdings-body {
      grid-template-columns: 1fr;
    }

    .donut-section {
      border-right: none;
      border-bottom: 1px solid var(--panel-soft);
    }

    .ap-grid {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }

    .pos-row,
    .match-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 7px;
    }

    .pr-right,
    .mr-right {
      width: 100%;
      justify-content: space-between;
    }

    .passport-stamp {
      position: static;
      justify-self: start;
      transform: rotate(0deg);
      margin-top: 4px;
      opacity: 0.78;
    }
  }
</style>
