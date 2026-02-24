<script lang="ts">
  import { onMount } from 'svelte';
  import { userProfileStore, earnedBadges, lockedBadges, profileTier, profileStats, setAvatar, setUsername, hydrateUserProfile } from '$lib/stores/userProfileStore';
  import { activeSignalCount, activeSignals, expiredSignals } from '$lib/stores/trackedSignalStore';
  import { openTradeCount, totalQuickPnL, openTrades, closedTrades } from '$lib/stores/quickTradeStore';
  import { matchHistoryStore, winRate, bestStreak } from '$lib/stores/matchHistoryStore';
  import { walletStore, openWalletModal } from '$lib/stores/walletStore';
  import { agentStats, hydrateAgentStats } from '$lib/stores/agentData';
  import { AGDEFS, CHARACTER_ART } from '$lib/data/agents';
  import { HOLDINGS_DATA, calcTotal, calcPnL, type HoldingAsset } from '$lib/data/holdings';
  import { gameState } from '$lib/stores/gameState';
  import { fetchUiStateApi, updateUiStateApi } from '$lib/api/preferencesApi';
  import { fetchHoldings, type PortfolioHolding } from '$lib/api/portfolioApi';
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
  $: liveP = $livePrices;

  // Build effective holdings array: live API → static fallback
  $: effectiveHoldings = holdingsLoaded && liveHoldings.length > 0 ? liveHoldings : HOLDINGS_DATA;

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

  onMount(() => {
    hydrateUserProfile();
    hydrateAgentStats();
    void (async () => {
      const ui = await fetchUiStateApi();
      if (ui?.passportActiveTab && isPassportTab(ui.passportActiveTab)) {
        activeTab = ui.passportActiveTab;
      }
    })();

    // Holdings: fire-and-forget API fetch
    void (async () => {
      try {
        const res = await fetchHoldings();
        if (res?.ok && res.data.holdings.length > 0) {
          const totalVal = res.data.totalValue || 1;
          liveHoldings = res.data.holdings.map((h) => ({
            symbol: h.symbol,
            name: h.name,
            icon: ASSET_ICONS[h.symbol] || h.symbol[0],
            color: ASSET_COLORS[h.symbol] || '#888',
            amount: h.amount,
            avgPrice: h.avgPrice,
            // Use live price from priceStore if available
            currentPrice: liveP[h.symbol] || h.currentPrice,
            allocation: (h.amount * h.currentPrice) / totalVal,
          }));
          holdingsLoaded = true;
        }
      } catch {
        // Fallback to static data — no action needed
      }
    })();
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

      <!-- ═══ TAB CONTENT ═══ -->
      <div class="tab-content">

        <!-- ════ PROFILE TAB ════ -->
        {#if activeTab === 'profile'}
          <div class="profile-tab">
            <div class="section-header">📊 PERFORMANCE</div>
            <div class="metrics-grid">
              <div class="metric-card"><div class="mc-icon">🎯</div><div class="mc-value" class:up={stats.winRate >= 50}>{stats.winRate}%</div><div class="mc-label">WIN RATE</div></div>
              <div class="metric-card"><div class="mc-icon">🧭</div><div class="mc-value">{stats.directionAccuracy}%</div><div class="mc-label">DIRECTION ACC</div></div>
              <div class="metric-card"><div class="mc-icon">💡</div><div class="mc-value">{stats.avgConfidence}%</div><div class="mc-label">AVG CONFIDENCE</div></div>
              <div class="metric-card"><div class="mc-icon">💰</div><div class="mc-value" style="color:{pnlColor(stats.totalPnL)}">{pnlPrefix(stats.totalPnL)}{stats.totalPnL.toFixed(1)}%</div><div class="mc-label">TOTAL PnL</div></div>
              <div class="metric-card"><div class="mc-icon">⚔️</div><div class="mc-value">{stats.totalMatches}</div><div class="mc-label">MATCHES</div></div>
              <div class="metric-card"><div class="mc-icon">🔥</div><div class="mc-value fire">{stats.bestStreak}</div><div class="mc-label">BEST STREAK</div></div>
              <div class="metric-card"><div class="mc-icon">📌</div><div class="mc-value">{stats.trackedSignals}</div><div class="mc-label">TRACKED</div></div>
              <div class="metric-card"><div class="mc-icon">🤖</div><div class="mc-value">{stats.agentWins}</div><div class="mc-label">AGENT WINS</div></div>
            </div>

            <div class="summary-line">
              {stats.totalMatches > 0
                ? `${gState.wins}W-${gState.losses}L | ${pnlPrefix(stats.totalPnL)}${stats.totalPnL.toFixed(1)}% PnL | 🔥 ${stats.streak}-streak`
                : 'No matches yet — Start an Arena battle!'}
            </div>

            <div class="section-header">🐕 AGENT SQUAD</div>
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

            <div class="section-header">🏆 BADGES ({earned.length}/{earned.length + locked.length})</div>
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
          </div>

        <!-- ════ WALLET TAB ════ -->
        {:else if activeTab === 'wallet'}
          <div class="wallet-tab">
            <div class="vb-card">
              <div class="vb-header"><span class="vb-icon">🏦</span><span class="vb-title">VIRTUAL BALANCE</span></div>
              <div class="vb-amount">${profile.balance.virtual.toLocaleString()}</div>
              {#if !wallet.connected}
                <button class="vb-connect" on:click={openWalletModal}>🔗 CONNECT WALLET FOR DEFI</button>
              {:else}
                <div class="vb-connected"><span class="vbc-dot"></span>{wallet.shortAddr} · {wallet.chain} · {wallet.balance.toLocaleString()} USDT</div>
              {/if}
            </div>

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
          </div>

        <!-- ════ POSITIONS TAB ════ -->
        {:else if activeTab === 'positions'}
          <div class="positions-tab">
            <div class="pos-summary">
              <div class="ps-item"><div class="psi-label">OPEN</div><div class="psi-value">{opens.length}</div></div>
              <div class="ps-item"><div class="psi-label">UNREALIZED</div><div class="psi-value" style="color:{pnlColor(unrealizedPnl)}">{pnlPrefix(unrealizedPnl)}{unrealizedPnl.toFixed(2)}%</div></div>
              <div class="ps-item"><div class="psi-label">TRACKED</div><div class="psi-value" style="color:#ff8c3b">{tracked.length}</div></div>
              <div class="ps-item"><div class="psi-label">TOTAL PnL</div><div class="psi-value" style="color:{pnlColor(pnl)}">{pnlPrefix(pnl)}{pnl.toFixed(2)}%</div></div>
            </div>

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
              <div class="pos-section-title" style="margin-top:12px">TRACKED SIGNALS</div>
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
            {/if}

            {#if closed.length > 0}
              <div class="pos-section-title" style="margin-top:12px">RECENTLY CLOSED ({closed.length})</div>
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
            {/if}
          </div>

        <!-- ════ ARENA TAB ════ -->
        {:else if activeTab === 'arena'}
          <div class="arena-tab">
            <div class="arena-stats">
              <div class="as-item"><div class="asi-val">{records.length}</div><div class="asi-label">MATCHES</div></div>
              <div class="as-item"><div class="asi-val" style="color:#00ff88">{wr}%</div><div class="asi-label">WIN RATE</div></div>
              <div class="as-item"><div class="asi-val" style="color:#ff8c3b">🔥 {bStreak}</div><div class="asi-label">BEST STREAK</div></div>
              <div class="as-item"><div class="asi-val" style="color:#ffd060">{gState.lp.toLocaleString()}</div><div class="asi-label">LP EARNED</div></div>
            </div>

            {#if records.length > 0}
              <div class="pos-section-title">MATCH HISTORY</div>
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
            {:else}
              <EmptyState image={CHARACTER_ART.actionVictory} title="NO ARENA MATCHES YET" subtitle="Challenge the AI agents!" ctaText="GO TO ARENA →" ctaHref="/arena" icon="⚔️" variant="pink" compact />
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .passport-page {
    height: 100%; overflow: hidden;
    background: #ffe600;
    background-image: repeating-conic-gradient(#ffcc00 0deg 10deg, #ffe600 10deg 20deg);
    display: flex; justify-content: center; position: relative;
  }
  .sunburst {
    position: absolute; inset: -50%; z-index: 0; pointer-events: none;
    background: repeating-conic-gradient(transparent 0deg 8deg, rgba(255,180,0,.08) 8deg 16deg);
    animation: spin 60s linear infinite;
  }
  @keyframes spin { from { transform: rotate(0) } to { transform: rotate(360deg) } }
  .halftone {
    position: absolute; inset: 0; z-index: 1; pointer-events: none;
    background-image: radial-gradient(circle, rgba(0,0,0,.04) 1px, transparent 1px);
    background-size: 8px 8px;
  }

  .passport-scroll {
    position: relative; z-index: 10; width: 100%; max-width: 800px;
    height: 100%; overflow-y: auto; padding: 16px; box-sizing: border-box;
  }
  .passport-scroll::-webkit-scrollbar { width: 4px; }
  .passport-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,.2); border-radius: 3px; }

  .passport-card {
    background: #fff; border: 4px solid #000; border-radius: 16px;
    box-shadow: 6px 6px 0 #000; overflow: hidden; position: relative;
  }
  .passport-card::before {
    content: ''; position: absolute; bottom: 0; right: 0;
    width: 120px; height: 120px;
    background: url('/doge/trade-sheet.png') center/cover no-repeat;
    opacity: .06; border-radius: 16px 0 0 0; pointer-events: none; z-index: 0;
  }

  .card-ribbon { background: linear-gradient(90deg, #0a0a1a, #1a1a2e); padding: 6px 16px; border-bottom: 3px solid #000; }
  .ribbon-text { font-family: var(--fd); font-size: 8px; font-weight: 900; letter-spacing: 4px; color: var(--yel); }

  /* ═══ UNIFIED HEADER ═══ */
  .unified-header {
    display: flex; gap: 14px; padding: 14px 16px;
    border-bottom: 3px solid #000; position: relative;
    flex-wrap: wrap; align-items: flex-start;
  }
  .uh-left { display: flex; gap: 12px; align-items: center; flex: 1; min-width: 200px; }
  .uh-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }

  .doge-avatar {
    position: relative; width: 64px; height: 64px; border-radius: 14px;
    border: 4px solid #000; overflow: hidden; box-shadow: 4px 4px 0 #000;
    flex-shrink: 0; cursor: pointer; background: none; padding: 0; transition: transform .15s;
  }
  .doge-avatar:hover { transform: scale(1.05); }
  .doge-img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .avatar-edit { position: absolute; bottom: 2px; right: 2px; background: var(--yel); border-radius: 50%; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; font-size: 8px; border: 2px solid #000; }

  .player-info { flex: 1; min-width: 0; }
  .player-name { font-family: var(--fc); font-size: 18px; color: #000; letter-spacing: 1.5px; cursor: pointer; background: none; border: none; padding: 0; text-align: left; transition: opacity .15s; }
  .player-name:hover { opacity: .7; }
  .name-pen { font-size: 10px; opacity: .4; }
  .name-edit { display: flex; gap: 4px; }
  .name-input { font-family: var(--fc); font-size: 16px; color: #000; border: 2px solid var(--yel); border-radius: 6px; padding: 2px 6px; width: 130px; outline: none; background: #fff8e1; }
  .name-save { background: var(--yel); border: 2px solid #000; border-radius: 6px; font-size: 14px; cursor: pointer; padding: 2px 8px; font-weight: 900; }
  .player-tier { font-family: var(--fd); font-size: 11px; font-weight: 900; letter-spacing: 2px; margin-top: 1px; }
  .player-addr { font-family: var(--fm); font-size: 8px; color: #888; margin-top: 1px; }
  .connect-mini { font-family: var(--fm); font-size: 7px; font-weight: 700; letter-spacing: 1px; color: #000; background: var(--yel); border: 2px solid #000; border-radius: 6px; padding: 2px 6px; cursor: pointer; margin-top: 2px; transition: all .15s; }
  .connect-mini:hover { transform: scale(1.05); box-shadow: 2px 2px 0 #000; }

  .port-val { text-align: right; }
  .pv-label { font-family: var(--fm); font-size: 6px; font-weight: 900; letter-spacing: 2px; color: #888; }
  .pv-amount { font-family: var(--fd); font-size: 22px; font-weight: 900; color: #000; letter-spacing: 1px; }
  .pv-pnl { font-family: var(--fm); font-size: 9px; font-weight: 700; }
  .pv-pnl.up { color: #00aa44; } .pv-pnl.down { color: #cc0033; }

  .uh-stats { display: flex; gap: 10px; }
  .uhs { text-align: center; min-width: 36px; }
  .uhs-val { font-family: var(--fd); font-size: 12px; font-weight: 900; color: #000; display: block; }
  .uhs-lbl { font-family: var(--fm); font-size: 5px; font-weight: 900; letter-spacing: 1.5px; color: #888; }

  .passport-stamp { position: absolute; top: -4px; right: -4px; transform: rotate(12deg); border: 3px solid #cc0033; border-radius: 10px; padding: 3px 10px; font-family: var(--fc); color: #cc0033; display: flex; align-items: center; gap: 4px; opacity: .5; }
  .stamp-text { font-size: 7px; letter-spacing: 2px; } .stamp-icon { font-size: 10px; }

  /* ═══ AVATAR PICKER ═══ */
  .avatar-picker { background: #fff8e1; border: 2px solid #000; border-radius: 10px; padding: 10px; margin: 0 16px 8px; box-shadow: 3px 3px 0 #000; }
  .ap-title { font-family: var(--fd); font-size: 8px; font-weight: 900; letter-spacing: 2px; color: #555; margin-bottom: 6px; }
  .ap-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 4px; }
  .ap-opt { width: 100%; aspect-ratio: 1; border-radius: 8px; border: 3px solid transparent; overflow: hidden; cursor: pointer; padding: 0; background: none; transition: all .15s; }
  .ap-opt:hover { border-color: var(--yel); transform: scale(1.1); }
  .ap-opt.selected { border-color: #000; box-shadow: 2px 2px 0 #000; }
  .ap-opt img { width: 100%; height: 100%; object-fit: cover; display: block; }

  /* ═══ TAB BAR ═══ */
  .tab-bar { display: flex; background: #0d0d1e; border-bottom: 2px solid rgba(255,255,255,.06); }
  .tab-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px; padding: 8px 6px; background: none; border: none; border-bottom: 3px solid transparent; color: rgba(255,255,255,.35); font-family: var(--fm); font-size: 8px; font-weight: 900; letter-spacing: 1.5px; cursor: pointer; transition: all .15s; position: relative; }
  .tab-btn:hover { color: rgba(255,255,255,.6); background: rgba(255,255,255,.02); }
  .tab-btn.active { color: var(--yel); border-bottom-color: var(--yel); background: rgba(255,230,0,.03); }
  .tab-icon { font-size: 11px; } .tab-label { letter-spacing: 1.5px; }
  .tab-badge { position: absolute; top: 2px; right: 8px; background: var(--yel); color: #000; font-family: var(--fd); font-size: 6px; font-weight: 900; min-width: 12px; height: 12px; border-radius: 6px; display: flex; align-items: center; justify-content: center; padding: 0 2px; }

  /* ═══ TAB CONTENT ═══ */
  .tab-content { padding: 12px; background: linear-gradient(180deg, #0a0a1a, #080818); }

  /* ═══ PROFILE TAB ═══ */
  .section-header { font-family: var(--fc); font-size: 13px; color: #fff; letter-spacing: 2px; margin-bottom: 6px; -webkit-text-stroke: .5px rgba(255,255,255,.5); }
  .metrics-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; margin-bottom: 6px; }
  .metric-card { background: rgba(255,255,255,.04); border: 2px solid rgba(255,255,255,.08); border-radius: 8px; padding: 6px 4px; text-align: center; transition: transform .15s; }
  .metric-card:hover { transform: translateY(-1px); background: rgba(255,255,255,.06); }
  .mc-icon { font-size: 14px; margin-bottom: 1px; }
  .mc-value { font-family: var(--fd); font-size: 16px; font-weight: 900; color: #fff; line-height: 1; }
  .mc-value.up { color: var(--grn); } .mc-value.fire { color: #ff8c3b; }
  .mc-label { font-family: var(--fm); font-size: 5px; font-weight: 900; letter-spacing: 1.5px; color: rgba(255,255,255,.35); margin-top: 1px; }

  .summary-line { text-align: center; font-family: var(--fm); font-size: 8px; font-weight: 700; color: rgba(255,255,255,.4); padding: 5px 8px; background: rgba(255,255,255,.03); border: 1px dashed rgba(255,255,255,.1); border-radius: 6px; margin-bottom: 10px; }

  .agent-perf-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 5px; margin-bottom: 10px; }
  .agent-perf-card { border: 2px solid rgba(255,255,255,.08); border-left-width: 4px; border-radius: 8px; padding: 6px; background: rgba(255,255,255,.03); }
  .apc-head { display: flex; align-items: center; gap: 5px; margin-bottom: 3px; }
  .apc-img { width: 24px; height: 24px; border-radius: 6px; border: 1.5px solid rgba(255,255,255,.15); object-fit: cover; }
  .apc-icon { font-size: 16px; }
  .apc-name { font-family: var(--fm); font-size: 7px; font-weight: 900; letter-spacing: 1px; }
  .apc-role { font-family: var(--fm); font-size: 5px; color: rgba(255,255,255,.3); }
  .apc-level { margin-left: auto; font-family: var(--fd); font-size: 9px; font-weight: 900; color: var(--pk); background: rgba(255,45,155,.08); border: 1.5px solid rgba(255,45,155,.3); border-radius: 5px; padding: 1px 5px; }
  .apc-bar-wrap { height: 3px; background: rgba(255,255,255,.06); border-radius: 2px; overflow: hidden; margin-bottom: 1px; }
  .apc-bar { height: 100%; border-radius: 2px; transition: width .5s; }
  .apc-xp { font-family: var(--fm); font-size: 5px; color: rgba(255,255,255,.25); }

  .badges-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin-bottom: 10px; }
  .badge-card { border: 2px solid rgba(255,255,255,.1); border-radius: 8px; padding: 6px 3px; text-align: center; transition: transform .15s; }
  .badge-card:hover { transform: translateY(-1px); }
  .badge-card.earned { background: linear-gradient(135deg, rgba(255,230,0,.1), rgba(255,200,0,.05)); border-color: rgba(255,230,0,.25); }
  .badge-card.locked { background: rgba(255,255,255,.02); opacity: .5; }
  .badge-icon { font-size: 18px; display: block; margin-bottom: 1px; }
  .badge-name { font-family: var(--fm); font-size: 6px; font-weight: 900; letter-spacing: .5px; color: rgba(255,255,255,.6); display: block; }
  .badge-date { font-family: var(--fm); font-size: 5px; color: rgba(255,255,255,.2); display: block; }
  .badge-desc { font-family: var(--fm); font-size: 4px; color: rgba(255,255,255,.2); display: block; margin-top: 1px; }

  /* ═══ WALLET TAB ═══ */
  .vb-card { background: rgba(255,230,0,.05); border: 2px solid rgba(255,230,0,.15); border-radius: 10px; padding: 12px; margin-bottom: 10px; }
  .vb-header { display: flex; align-items: center; gap: 5px; margin-bottom: 3px; }
  .vb-icon { font-size: 14px; } .vb-title { font-family: var(--fm); font-size: 7px; font-weight: 900; letter-spacing: 2px; color: rgba(255,255,255,.4); }
  .vb-amount { font-family: var(--fd); font-size: 24px; font-weight: 900; color: var(--yel); letter-spacing: 1px; }
  .vb-connect { margin-top: 6px; font-family: var(--fm); font-size: 7px; font-weight: 700; letter-spacing: 1px; color: #000; background: var(--yel); border: 2px solid #000; border-radius: 6px; padding: 4px 10px; cursor: pointer; transition: all .15s; }
  .vb-connect:hover { transform: scale(1.03); box-shadow: 2px 2px 0 #000; }
  .vb-connected { font-family: var(--fm); font-size: 8px; color: rgba(255,255,255,.4); margin-top: 3px; display: flex; align-items: center; gap: 5px; }
  .vbc-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--grn); box-shadow: 0 0 4px var(--grn); }

  .holdings-body { display: grid; grid-template-columns: 200px 1fr; gap: 0; background: rgba(255,255,255,.02); border: 1px solid rgba(255,255,255,.06); border-radius: 10px; overflow: hidden; }
  .st { font-size: 8px; font-family: var(--fd); font-weight: 900; letter-spacing: 2px; color: rgba(255,255,255,.5); padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,.06); }
  .donut-section { border-right: 1px solid rgba(255,255,255,.06); }
  .donut-wrap { padding: 6px 16px; }
  .donut-wrap svg { width: 100%; max-width: 160px; display: block; margin: 0 auto; }
  .legend { padding: 0 10px 8px; display: flex; flex-direction: column; gap: 3px; }
  .legend-item { display: flex; align-items: center; gap: 5px; font-size: 8px; font-family: var(--fm); color: #ccc; }
  .li-dot { width: 7px; height: 7px; border-radius: 2px; flex-shrink: 0; } .li-name { font-weight: 700; } .li-pct { margin-left: auto; color: #888; font-weight: 600; }
  .table-section { overflow-x: auto; }
  .htable { padding: 0 8px 8px; }
  .hrow { display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr; gap: 5px; padding: 6px 4px; border-bottom: 1px solid rgba(255,255,255,.04); align-items: center; }
  .hrow:not(.header-row):hover { background: rgba(255,255,255,.02); }
  .header-row { font-size: 6px; font-family: var(--fd); font-weight: 900; letter-spacing: 2px; color: #555; border-bottom: 1px solid rgba(255,255,255,.08); }
  .hc { font-size: 8px; font-family: var(--fm); color: #ccc; } .hc.num { text-align: right; font-variant-numeric: tabular-nums; }
  .asset-col { display: flex; align-items: center; gap: 5px; }
  .ai { width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 900; color: #fff; flex-shrink: 0; }
  .an { font-size: 9px; font-weight: 900; font-family: var(--fd); color: #fff; letter-spacing: 1px; }
  .af { font-size: 6px; color: #666; font-family: var(--fm); }

  /* ═══ POSITIONS TAB ═══ */
  .pos-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; margin-bottom: 10px; }
  .ps-item { text-align: center; padding: 8px 4px; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.06); border-radius: 8px; }
  .psi-label { font-family: var(--fm); font-size: 5px; font-weight: 900; letter-spacing: 1.5px; color: rgba(255,255,255,.35); margin-bottom: 1px; }
  .psi-value { font-family: var(--fd); font-size: 14px; font-weight: 900; color: #fff; }
  .pos-section-title { font-family: var(--fm); font-size: 6px; font-weight: 900; letter-spacing: 2px; color: rgba(255,255,255,.3); margin-bottom: 3px; }

  .pos-row { display: flex; align-items: center; justify-content: space-between; padding: 6px 6px; border-bottom: 1px solid rgba(255,255,255,.04); border-radius: 5px; transition: background .1s; }
  .pos-row:hover { background: rgba(255,255,255,.03); }
  .pos-row.tracked { background: rgba(255,140,59,.03); }
  .pos-row.closed { opacity: .5; }
  .pr-left { display: flex; align-items: center; gap: 5px; }
  .pr-dir { font-family: var(--fm); font-size: 6px; font-weight: 900; letter-spacing: .5px; padding: 2px 5px; border-radius: 3px; border: 1px solid; }
  .pr-dir.long { color: var(--grn); border-color: rgba(0,255,136,.3); background: rgba(0,255,136,.08); }
  .pr-dir.short { color: var(--red); border-color: rgba(255,45,85,.3); background: rgba(255,45,85,.08); }
  .pr-pair { font-family: var(--fm); font-size: 9px; font-weight: 700; color: rgba(255,255,255,.7); }
  .pr-src { font-family: var(--fm); font-size: 6px; color: rgba(255,255,255,.25); background: rgba(255,255,255,.04); padding: 1px 3px; border-radius: 3px; }
  .pr-right { display: flex; align-items: center; gap: 6px; }
  .pr-entry { font-family: var(--fm); font-size: 7px; color: rgba(255,255,255,.4); }
  .pr-pnl { font-family: var(--fd); font-size: 10px; font-weight: 900; min-width: 44px; text-align: right; }
  .pr-time { font-family: var(--fm); font-size: 6px; color: rgba(255,255,255,.2); }

  /* ═══ ARENA TAB ═══ */
  .arena-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; margin-bottom: 10px; }
  .as-item { text-align: center; padding: 8px 4px; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.06); border-radius: 8px; }
  .asi-val { font-family: var(--fd); font-size: 16px; font-weight: 900; color: #fff; }
  .asi-label { font-family: var(--fm); font-size: 5px; font-weight: 900; letter-spacing: 1.5px; color: rgba(255,255,255,.35); margin-top: 1px; }

  .match-row { display: flex; align-items: center; justify-content: space-between; padding: 6px 6px; border-bottom: 1px solid rgba(255,255,255,.04); border-radius: 5px; transition: background .1s; }
  .match-row:hover { background: rgba(255,255,255,.03); }
  .match-row.win { border-left: 3px solid var(--grn); } .match-row.loss { border-left: 3px solid var(--red); }
  .mr-left { display: flex; align-items: center; gap: 5px; }
  .mr-result { font-family: var(--fm); font-size: 7px; font-weight: 900; letter-spacing: 1px; padding: 2px 5px; border-radius: 3px; }
  .mr-result.win { color: var(--grn); background: rgba(0,255,136,.1); }
  .mr-result:not(.win) { color: var(--red); background: rgba(255,45,85,.1); }
  .mr-num { font-family: var(--fd); font-size: 9px; color: rgba(255,255,255,.5); }
  .mr-time { font-family: var(--fm); font-size: 6px; color: rgba(255,255,255,.2); }
  .mr-right { display: flex; align-items: center; gap: 6px; }
  .mr-lp { font-family: var(--fd); font-size: 10px; font-weight: 900; }
  .mr-lp.plus { color: var(--grn); } .mr-lp.minus { color: var(--red); }
  .mr-hyp { font-family: var(--fm); font-size: 6px; font-weight: 900; padding: 1px 3px; border-radius: 3px; border: 1px solid; }
  .mr-hyp.long { color: var(--grn); border-color: rgba(0,255,136,.3); }
  .mr-hyp.short { color: var(--red); border-color: rgba(255,45,85,.3); }
  .mr-agents { display: flex; gap: 2px; }
  .mr-agent-dot { width: 5px; height: 5px; border-radius: 50%; display: inline-block; }

  /* ═══ RESPONSIVE ═══ */
  @media (max-width: 640px) {
    .passport-scroll { padding: 10px; }
    .unified-header { flex-direction: column; }
    .uh-right { align-items: flex-start; width: 100%; flex-direction: row; justify-content: space-between; gap: 10px; }
    .port-val { text-align: left; }
    .metrics-grid { grid-template-columns: repeat(2, 1fr); }
    .badges-grid { grid-template-columns: repeat(3, 1fr); }
    .agent-perf-grid { grid-template-columns: 1fr; }
    .holdings-body { grid-template-columns: 1fr; }
    .donut-section { border-right: none; border-bottom: 1px solid rgba(255,255,255,.06); }
    .pos-summary { grid-template-columns: repeat(2, 1fr); }
    .arena-stats { grid-template-columns: repeat(2, 1fr); }
    .ap-grid { grid-template-columns: repeat(4, 1fr); }
  }
</style>
