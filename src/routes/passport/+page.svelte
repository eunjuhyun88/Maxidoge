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
    --sp-bg: #00120a;
    --sp-bg2: #003122;
    --sp-pk: #ff8c79;
    --sp-pk-l: #ffc8c1;
    --sp-w: #f7dcd6;
    --sp-dim: rgba(247, 220, 214, 0.5);
    --sp-soft: rgba(255, 140, 121, 0.15);
    --sp-soft-2: rgba(255, 140, 121, 0.1);
    --sp-line: rgba(255, 140, 121, 0.3);
    --sp-green: #9dcdb9;
    --sp-red: #ff725d;
    --sp-gold: #f7dcd6;
    --sp-font-display: 'Sixtyfour', 'Racing Sans One', 'Press Start 2P', monospace;
    --sp-font-label: 'Racing Sans One', 'Press Start 2P', monospace;
    --sp-font-body: 'JetBrains Mono', monospace;
    --fp: var(--sp-font-label);
    --fd: var(--sp-font-label);
    --fm: var(--sp-font-body);
    height: 100%;
    overflow: hidden;
    position: relative;
    display: flex;
    justify-content: center;
    background:
      radial-gradient(circle at 10% 14%, rgba(255, 140, 121, 0.2) 0%, rgba(255, 140, 121, 0) 34%),
      radial-gradient(circle at 86% 6%, rgba(157, 205, 185, 0.16) 0%, rgba(157, 205, 185, 0) 28%),
      linear-gradient(180deg, var(--sp-bg2), var(--sp-bg));
  }

  .passport-page::before {
    content: '';
    position: absolute;
    left: -20%;
    right: -20%;
    bottom: -14px;
    height: 32%;
    pointer-events: none;
    z-index: 0;
    background:
      linear-gradient(90deg, rgba(255, 140, 121, 0.14) 1px, transparent 1px),
      linear-gradient(0deg, rgba(255, 140, 121, 0.14) 1px, transparent 1px);
    background-size: 56px 34px;
    transform: perspective(420px) rotateX(56deg);
    transform-origin: center top;
    opacity: 0.45;
  }

  .passport-page::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 31%;
    height: 2px;
    pointer-events: none;
    z-index: 1;
    background: rgba(255, 140, 121, 0.72);
    box-shadow: 0 0 14px rgba(255, 140, 121, 0.4), 0 0 28px rgba(255, 140, 121, 0.18);
  }

  .sunburst {
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    opacity: 0.42;
    background:
      radial-gradient(1px 1px at 11% 18%, rgba(255, 255, 255, 0.58) 50%, transparent 50%),
      radial-gradient(1px 1px at 29% 52%, rgba(255, 255, 255, 0.5) 50%, transparent 50%),
      radial-gradient(1px 1px at 41% 6%, rgba(255, 255, 255, 0.55) 50%, transparent 50%),
      radial-gradient(1.2px 1.2px at 66% 23%, rgba(255, 255, 255, 0.55) 50%, transparent 50%),
      radial-gradient(1px 1px at 84% 68%, rgba(255, 255, 255, 0.5) 50%, transparent 50%),
      radial-gradient(1.4px 1.4px at 7% 88%, rgba(255, 255, 255, 0.55) 50%, transparent 50%);
    background-size: 350px 350px;
  }

  .halftone {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    background: repeating-linear-gradient(
      0deg,
      transparent 0px,
      transparent 3px,
      rgba(0, 0, 0, 0.08) 3px,
      rgba(0, 0, 0, 0.08) 4px
    );
    opacity: 0.5;
  }

  .passport-scroll {
    position: relative;
    z-index: 3;
    width: 100%;
    max-width: 1040px;
    height: 100%;
    overflow-y: auto;
    padding: 14px;
    box-sizing: border-box;
  }

  .passport-scroll::-webkit-scrollbar {
    width: 4px;
  }

  .passport-scroll::-webkit-scrollbar-thumb {
    background: var(--sp-pk);
    border-radius: 4px;
  }

  .passport-card {
    position: relative;
    overflow: hidden;
    border: 1px solid var(--sp-line);
    border-radius: 14px;
    background:
      radial-gradient(circle at 100% 0%, rgba(255, 140, 121, 0.18) 0%, rgba(255, 140, 121, 0) 35%),
      linear-gradient(180deg, rgba(3, 33, 24, 0.92) 0%, rgba(1, 18, 10, 0.96) 100%);
    box-shadow: 0 14px 30px rgba(0, 0, 0, 0.34), inset 0 0 0 1px rgba(255, 140, 121, 0.14);
  }

  .card-ribbon {
    position: relative;
    z-index: 2;
    padding: 10px 14px;
    background: rgba(0, 0, 0, 0.22);
    border-bottom: 1px solid var(--sp-line);
  }

  .ribbon-text {
    font-family: var(--fp);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1.3px;
    color: var(--sp-pk-l);
  }

  .unified-header {
    position: relative;
    z-index: 2;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    padding: 14px;
    border-bottom: 1px solid var(--sp-line);
    background: rgba(8, 20, 12, 0.54);
  }

  .uh-left {
    display: flex;
    gap: 12px;
    min-width: 0;
    align-items: center;
  }

  .uh-right {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 245px;
    align-items: flex-end;
  }

  .doge-avatar {
    position: relative;
    width: 72px;
    height: 72px;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid var(--sp-line);
    background: rgba(255, 255, 255, 0.04);
    cursor: pointer;
    padding: 0;
    transition: transform 0.15s ease;
  }

  .doge-avatar:hover {
    transform: translateY(-1px);
  }

  .doge-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .avatar-edit {
    position: absolute;
    right: 4px;
    bottom: 4px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    font-size: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--sp-pk);
    color: #111;
  }

  .player-info {
    min-width: 0;
  }

  .player-name {
    border: none;
    background: none;
    padding: 0;
    text-align: left;
    cursor: pointer;
    color: var(--sp-w);
    font-family: var(--sp-font-display);
    font-size: clamp(13px, 1.6vw, 17px);
    font-weight: 400;
    letter-spacing: 0.4px;
  }

  .name-pen {
    font-size: 11px;
    opacity: 0.55;
  }

  .name-edit {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .name-input {
    width: 160px;
    border-radius: 7px;
    border: 1px solid var(--sp-line);
    background: rgba(0, 0, 0, 0.35);
    color: var(--sp-w);
    font-family: var(--fm);
    font-size: 12px;
    padding: 6px 8px;
    outline: none;
  }

  .name-save {
    border: 1px solid var(--sp-pk);
    background: rgba(255, 140, 121, 0.15);
    color: var(--sp-pk-l);
    border-radius: 7px;
    padding: 5px 8px;
    font-family: var(--fp);
    font-size: 10px;
    cursor: pointer;
  }

  .player-tier {
    margin-top: 2px;
    font-family: var(--fp);
    font-size: 9px;
    letter-spacing: 1px;
  }

  .player-addr {
    margin-top: 5px;
    color: var(--sp-dim);
    font-family: var(--fm);
    font-size: 10px;
  }

  .connect-mini {
    margin-top: 5px;
    border: 1px solid var(--sp-pk);
    background: rgba(255, 140, 121, 0.12);
    color: var(--sp-pk-l);
    border-radius: 7px;
    padding: 5px 10px;
    font-family: var(--fp);
    font-size: 9px;
    letter-spacing: 0.8px;
    cursor: pointer;
  }

  .port-val {
    text-align: right;
  }

  .pv-label {
    color: var(--sp-dim);
    font-family: var(--fp);
    font-size: 8px;
    letter-spacing: 1.2px;
  }

  .pv-amount {
    margin-top: 4px;
    color: var(--sp-w);
    font-family: var(--sp-font-display);
    font-size: clamp(18px, 2vw, 24px);
    font-weight: 400;
    line-height: 1.08;
  }

  .pv-pnl {
    margin-top: 4px;
    font-family: var(--fp);
    font-size: 9px;
    letter-spacing: 0.8px;
  }

  .pv-pnl.up {
    color: var(--sp-green);
  }

  .pv-pnl.down {
    color: var(--sp-red);
  }

  .uh-stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(48px, 1fr));
    gap: 6px;
  }

  .uhs {
    padding: 7px 6px;
    border-radius: 8px;
    border: 1px solid var(--sp-soft);
    background: rgba(0, 0, 0, 0.25);
    text-align: center;
  }

  .uhs-val {
    display: block;
    color: var(--sp-w);
    font-family: var(--fd);
    font-size: 12px;
    line-height: 1;
  }

  .uhs-lbl {
    display: block;
    margin-top: 4px;
    color: var(--sp-dim);
    font-family: var(--fp);
    font-size: 7px;
    letter-spacing: 1px;
  }

  .passport-stamp {
    position: absolute;
    top: 10px;
    right: 12px;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border: 1px solid rgba(255, 140, 121, 0.42);
    border-radius: 8px;
    color: var(--sp-pk-l);
    background: rgba(255, 140, 121, 0.08);
    transform: rotate(8deg);
    font-family: var(--fp);
  }

  .stamp-text {
    font-size: 7px;
    letter-spacing: 1px;
  }

  .stamp-icon {
    font-size: 10px;
  }

  .avatar-picker {
    margin: 10px 14px 12px;
    padding: 10px;
    border-radius: 10px;
    border: 1px solid var(--sp-line);
    background: rgba(0, 0, 0, 0.22);
  }

  .ap-title {
    margin-bottom: 8px;
    color: var(--sp-dim);
    font-family: var(--fp);
    font-size: 8px;
    letter-spacing: 1px;
  }

  .ap-grid {
    display: grid;
    grid-template-columns: repeat(8, minmax(0, 1fr));
    gap: 6px;
  }

  .ap-opt {
    border: 1px solid transparent;
    border-radius: 8px;
    overflow: hidden;
    padding: 0;
    background: none;
    cursor: pointer;
    aspect-ratio: 1;
  }

  .ap-opt:hover,
  .ap-opt.selected {
    border-color: var(--sp-pk);
  }

  .ap-opt img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .tab-bar {
    display: flex;
    background: rgba(0, 0, 0, 0.22);
    border-top: 1px solid var(--sp-line);
    border-bottom: 1px solid var(--sp-line);
  }

  .tab-btn {
    position: relative;
    flex: 1;
    min-height: 42px;
    border: none;
    border-bottom: 2px solid transparent;
    background: transparent;
    color: var(--sp-dim);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    font-family: var(--fp);
    font-size: 9px;
    letter-spacing: 1px;
    cursor: pointer;
  }

  .tab-btn:hover {
    color: var(--sp-w);
    background: rgba(255, 140, 121, 0.06);
  }

  .tab-btn.active {
    color: var(--sp-pk-l);
    border-bottom-color: var(--sp-pk);
    background: rgba(255, 140, 121, 0.08);
  }

  .tab-icon {
    font-size: 12px;
  }

  .tab-label {
    letter-spacing: 1px;
  }

  .tab-badge {
    position: absolute;
    top: 5px;
    right: 8px;
    min-width: 14px;
    height: 14px;
    padding: 0 4px;
    border-radius: 999px;
    background: var(--sp-pk);
    color: #111;
    font-family: var(--fp);
    font-size: 7px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .quick-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--sp-soft);
    background: rgba(0, 0, 0, 0.16);
  }

  .qa-btn,
  .qa-chip {
    min-height: 30px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    padding: 0 12px;
    text-decoration: none;
    white-space: nowrap;
    font-family: var(--fp);
    font-size: 9px;
    letter-spacing: 0.8px;
  }

  .qa-btn {
    border: 1px solid var(--sp-line);
    color: var(--sp-w);
    background: rgba(0, 0, 0, 0.25);
    cursor: pointer;
  }

  .qa-btn:hover {
    background: rgba(255, 140, 121, 0.12);
    border-color: rgba(255, 140, 121, 0.42);
  }

  .qa-terminal {
    color: var(--sp-pk-l);
  }

  .qa-arena {
    color: var(--sp-green);
  }

  .qa-wallet {
    color: #cbefff;
  }

  .qa-chip {
    margin-left: auto;
    color: var(--sp-green);
    border: 1px solid rgba(157, 205, 185, 0.3);
    background: rgba(157, 205, 185, 0.06);
  }

  .qa-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--sp-green);
    box-shadow: 0 0 6px rgba(157, 205, 185, 0.8);
  }

  .tab-content {
    padding: 12px;
    background: linear-gradient(180deg, rgba(14, 37, 21, 0.56), rgba(8, 20, 12, 0.82));
  }

  .profile-tab,
  .wallet-tab,
  .positions-tab,
  .arena-tab {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .content-panel {
    border: 1px solid var(--sp-soft);
    border-radius: 12px;
    padding: 12px;
    background: rgba(0, 0, 0, 0.24);
  }

  .list-panel {
    padding-top: 10px;
  }

  .section-header {
    margin-bottom: 10px;
    color: var(--sp-pk-l);
    font-family: var(--fp);
    font-size: 9px;
    letter-spacing: 1.2px;
  }

  .metrics-grid,
  .pos-summary,
  .arena-stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
  }

  .metric-card,
  .ps-item,
  .as-item,
  .wk-item {
    border: 1px solid var(--sp-soft);
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.02);
    padding: 10px 8px;
    text-align: center;
  }

  .metrics-detail {
    margin-top: 8px;
  }

  .mc-icon {
    font-size: 14px;
    margin-bottom: 3px;
  }

  .mc-value,
  .psi-value,
  .asi-val,
  .wk-v {
    color: var(--sp-w);
    font-family: var(--fd);
    font-size: 16px;
    font-weight: 800;
    line-height: 1.1;
  }

  .mc-value.up {
    color: var(--sp-green);
  }

  .mc-value.fire {
    color: var(--sp-gold);
  }

  .mc-label,
  .psi-label,
  .asi-label,
  .wk-k {
    margin-top: 4px;
    color: var(--sp-dim);
    font-family: var(--fp);
    font-size: 7px;
    letter-spacing: 0.9px;
  }

  .summary-line {
    margin-top: 10px;
    padding: 9px 10px;
    border-radius: 8px;
    border: 1px dashed var(--sp-soft);
    color: var(--sp-dim);
    text-align: center;
    font-family: var(--fm);
    font-size: 10px;
  }

  .detail-block {
    margin-top: 10px;
    border: 1px solid var(--sp-soft);
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.02);
    overflow: hidden;
  }

  .detail-block summary {
    list-style: none;
    cursor: pointer;
    user-select: none;
    padding: 10px 12px;
    color: var(--sp-pk-l);
    font-family: var(--fp);
    font-size: 8px;
    letter-spacing: 1px;
    border-bottom: 1px solid transparent;
  }

  .detail-block[open] summary {
    border-bottom-color: var(--sp-soft);
    background: rgba(255, 140, 121, 0.08);
  }

  .detail-block summary::-webkit-details-marker {
    display: none;
  }

  .detail-block summary::before {
    content: '▸';
    margin-right: 7px;
    display: inline-block;
    transition: transform 0.12s ease;
  }

  .detail-block[open] summary::before {
    transform: rotate(90deg);
  }

  .agent-perf-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    padding: 10px;
  }

  .agent-perf-card {
    border: 1px solid var(--sp-soft);
    border-left-width: 3px;
    border-radius: 8px;
    padding: 9px;
    background: rgba(0, 0, 0, 0.2);
  }

  .apc-head {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-bottom: 6px;
  }

  .apc-img {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    object-fit: cover;
  }

  .apc-icon {
    font-size: 18px;
  }

  .apc-name {
    font-family: var(--fm);
    font-size: 10px;
    font-weight: 700;
  }

  .apc-role {
    color: var(--sp-dim);
    font-family: var(--fm);
    font-size: 9px;
  }

  .apc-level {
    margin-left: auto;
    border-radius: 7px;
    padding: 2px 6px;
    color: var(--sp-pk-l);
    border: 1px solid var(--sp-soft);
    font-family: var(--fp);
    font-size: 8px;
  }

  .apc-bar-wrap {
    height: 5px;
    border-radius: 999px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.08);
    margin-bottom: 4px;
  }

  .apc-bar {
    height: 100%;
    border-radius: 999px;
  }

  .apc-xp {
    color: var(--sp-dim);
    font-family: var(--fm);
    font-size: 9px;
  }

  .badges-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
    padding: 10px;
  }

  .badge-card {
    border: 1px solid var(--sp-soft);
    border-radius: 8px;
    text-align: center;
    padding: 9px 6px;
    background: rgba(0, 0, 0, 0.2);
  }

  .badge-card.earned {
    background: rgba(157, 205, 185, 0.09);
    border-color: rgba(157, 205, 185, 0.26);
  }

  .badge-card.locked {
    opacity: 0.62;
  }

  .badge-icon {
    display: block;
    font-size: 18px;
    margin-bottom: 3px;
  }

  .badge-name {
    display: block;
    color: var(--sp-w);
    font-family: var(--fm);
    font-size: 10px;
  }

  .badge-date,
  .badge-desc {
    display: block;
    margin-top: 3px;
    color: var(--sp-dim);
    font-family: var(--fm);
    font-size: 8px;
  }

  .vb-card {
    border: 1px solid var(--sp-line);
    border-radius: 10px;
    background: rgba(255, 140, 121, 0.08);
    padding: 12px;
  }

  .vb-header {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .vb-icon {
    font-size: 14px;
  }

  .vb-title {
    color: var(--sp-dim);
    font-family: var(--fp);
    font-size: 8px;
    letter-spacing: 1px;
  }

  .vb-amount {
    margin-top: 5px;
    color: var(--sp-pk-l);
    font-family: var(--sp-font-display);
    font-size: clamp(18px, 2.1vw, 24px);
    line-height: 1.1;
  }

  .vb-connect {
    margin-top: 10px;
    border: 1px solid var(--sp-pk);
    background: rgba(255, 140, 121, 0.16);
    color: var(--sp-pk-l);
    border-radius: 8px;
    padding: 7px 10px;
    font-family: var(--fp);
    font-size: 8px;
    letter-spacing: 0.8px;
    cursor: pointer;
  }

  .vb-connected {
    margin-top: 8px;
    color: var(--sp-w);
    font-family: var(--fm);
    font-size: 10px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .vbc-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--sp-green);
    box-shadow: 0 0 5px rgba(157, 205, 185, 0.7);
  }

  .holdings-status {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 5px 10px;
    margin-bottom: 10px;
    border: 1px solid var(--sp-soft);
    border-radius: 999px;
    color: var(--sp-dim);
    font-family: var(--fm);
    font-size: 9px;
  }

  .holdings-status.live {
    border-color: rgba(157, 205, 185, 0.32);
    color: var(--sp-green);
  }

  .hs-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--sp-pk);
  }

  .holdings-status.live .hs-dot {
    background: var(--sp-green);
  }

  .wallet-kpis {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .holdings-body {
    display: grid;
    grid-template-columns: minmax(230px, 280px) minmax(0, 1fr);
  }

  .st {
    padding: 9px 10px;
    border-bottom: 1px solid var(--sp-soft);
    color: var(--sp-dim);
    font-family: var(--fp);
    font-size: 8px;
    letter-spacing: 1px;
  }

  .donut-section {
    border-right: 1px solid var(--sp-soft);
  }

  .donut-wrap {
    padding: 8px 12px;
  }

  .donut-wrap svg {
    width: 100%;
    max-width: 170px;
    display: block;
    margin: 0 auto;
  }

  .legend {
    padding: 0 10px 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--sp-w);
    font-family: var(--fm);
    font-size: 10px;
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
    color: var(--sp-dim);
  }

  .table-section {
    overflow-x: auto;
  }

  .htable {
    min-width: 450px;
    padding: 0 8px 8px;
  }

  .hrow {
    display: grid;
    grid-template-columns: 1.6fr 1fr 1fr 1fr;
    gap: 7px;
    align-items: center;
    padding: 8px 6px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .hrow:not(.header-row):hover {
    background: rgba(255, 255, 255, 0.03);
  }

  .header-row {
    color: var(--sp-dim);
    font-family: var(--fp);
    font-size: 7px;
    letter-spacing: 1px;
  }

  .hc {
    color: var(--sp-w);
    font-family: var(--fm);
    font-size: 10px;
  }

  .hc.num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .asset-col {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .ai {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 11px;
    font-weight: 800;
  }

  .an {
    color: var(--sp-w);
    font-family: var(--fd);
    font-size: 10px;
  }

  .af {
    color: var(--sp-dim);
    font-family: var(--fm);
    font-size: 8px;
    margin-top: 2px;
  }

  .pos-section-title {
    margin-bottom: 6px;
    color: var(--sp-pk-l);
    font-family: var(--fp);
    font-size: 8px;
    letter-spacing: 1px;
  }

  .pos-row,
  .match-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 6px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 7px;
  }

  .pos-row:hover,
  .match-row:hover {
    background: rgba(255, 255, 255, 0.03);
  }

  .pos-row.tracked {
    background: rgba(255, 140, 121, 0.08);
  }

  .pos-row.closed {
    opacity: 0.67;
  }

  .pr-left,
  .mr-left {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
  }

  .pr-dir,
  .mr-result {
    font-family: var(--fp);
    font-size: 8px;
    letter-spacing: 0.8px;
    border-radius: 6px;
    padding: 3px 6px;
    border: 1px solid;
    flex-shrink: 0;
  }

  .pr-dir.long {
    color: var(--sp-green);
    border-color: rgba(157, 205, 185, 0.35);
    background: rgba(157, 205, 185, 0.1);
  }

  .pr-dir.short {
    color: var(--sp-red);
    border-color: rgba(255, 114, 93, 0.35);
    background: rgba(255, 114, 93, 0.1);
  }

  .pr-pair {
    color: var(--sp-w);
    font-family: var(--fm);
    font-size: 11px;
    font-weight: 700;
  }

  .pr-src {
    color: var(--sp-dim);
    font-family: var(--fm);
    font-size: 9px;
    padding: 2px 6px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.05);
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
  .pr-time,
  .mr-time {
    color: var(--sp-dim);
    font-family: var(--fm);
    font-size: 9px;
  }

  .pr-pnl,
  .mr-lp {
    font-family: var(--fd);
    font-size: 12px;
    min-width: 56px;
    text-align: right;
  }

  .match-row.win {
    border-left: 2px solid var(--sp-green);
  }

  .match-row.loss {
    border-left: 2px solid var(--sp-red);
  }

  .mr-result {
    border: none;
  }

  .mr-result.win {
    color: var(--sp-green);
    background: rgba(157, 205, 185, 0.1);
  }

  .mr-result:not(.win) {
    color: var(--sp-red);
    background: rgba(255, 114, 93, 0.12);
  }

  .mr-num {
    color: var(--sp-w);
    font-family: var(--fm);
    font-size: 10px;
  }

  .mr-lp.plus {
    color: var(--sp-green);
  }

  .mr-lp.minus {
    color: var(--sp-red);
  }

  .mr-hyp {
    font-family: var(--fp);
    font-size: 8px;
    letter-spacing: 0.8px;
    padding: 2px 6px;
    border-radius: 6px;
    border: 1px solid;
  }

  .mr-hyp.long {
    color: var(--sp-green);
    border-color: rgba(157, 205, 185, 0.36);
  }

  .mr-hyp.short {
    color: var(--sp-red);
    border-color: rgba(255, 114, 93, 0.36);
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
      padding: 10px;
    }

    .unified-header {
      grid-template-columns: 1fr;
    }

    .uh-right {
      min-width: 0;
      align-items: flex-start;
    }

    .port-val {
      text-align: left;
    }

    .uh-stats,
    .metrics-grid,
    .pos-summary,
    .arena-stats,
    .wallet-kpis {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .qa-chip {
      margin-left: 0;
    }

    .ap-grid {
      grid-template-columns: repeat(6, minmax(0, 1fr));
    }
  }

  @media (max-width: 720px) {
    .agent-perf-grid,
    .badges-grid {
      grid-template-columns: 1fr;
    }

    .holdings-body {
      grid-template-columns: 1fr;
    }

    .donut-section {
      border-right: none;
      border-bottom: 1px solid var(--sp-soft);
    }

    .ap-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .pos-row,
    .match-row {
      flex-direction: column;
      align-items: flex-start;
    }

    .pr-right,
    .mr-right {
      width: 100%;
      justify-content: space-between;
    }

    .passport-stamp {
      position: static;
      transform: rotate(0deg);
      align-self: flex-start;
      margin-top: 6px;
    }
  }
</style>
