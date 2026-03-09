<script lang="ts">
  import { onMount } from 'svelte';
  import { userProfileStore, profileStats } from '$lib/stores/userProfileStore';
  import { earnedBadges, lockedBadges, profileTier, setAvatar, setUsername, hydrateUserProfile } from '$lib/stores/userProfileProjectionStore';
  import { activeSignalCount, activeSignals, expiredSignals } from '$lib/stores/trackedSignalStore';
  import { openTradeCount, totalQuickPnL, openTrades, closedTrades } from '$lib/stores/quickTradeStore';
  import { matchHistoryStore, winRate, bestStreak } from '$lib/stores/matchHistoryStore';
  import { walletStore } from '$lib/stores/walletStore';
  import { openWalletModal } from '$lib/stores/walletModalStore';
  import { agentStats, hydrateAgentStats } from '$lib/stores/agentData';
  import { AGDEFS, CHARACTER_ART } from '$lib/data/agents';
  import { HOLDINGS_DATA, calcPnL, type HoldingAsset } from '$lib/data/holdings';
  import { gameState } from '$lib/stores/gameState';
  import { fetchUiStateApi, updateUiStateApi } from '$lib/api/preferencesApi';
  import {
    createPassportHoldingsRuntime,
    createPassportHoldingsState,
  } from '$lib/passport/passportHoldingsRuntime';
  import {
    createPassportLearningPanelController,
    createPassportLearningPanelState,
  } from '$lib/passport/passportLearningPanelController';
  import {
    buildPassportFocusCards,
    buildPassportHeaderStats,
    shouldShowPassportFocusInsights,
    type PassportFocusCard,
    type PassportHeaderStat,
  } from '$lib/passport/passportSummaryViewModel';
  import { livePrices } from '$lib/stores/priceStore';
  import EmptyState from '../../components/shared/EmptyState.svelte';
  import PassportHeaderSection from '../../components/passport/PassportHeaderSection.svelte';
  import PassportLearningPanel from '../../components/passport/PassportLearningPanel.svelte';
  import PassportNavChrome from '../../components/passport/PassportNavChrome.svelte';
  import {
    withLivePrices,
    toHoldingAsset,
    summarizeClosedTrades,
    countLongTrades,
    tierColor,
    tierEmoji,
    tierLabel,
    pnlColor,
    pnlPrefix,
    timeSince,
    isPassportTab,
    type PassportTabType,
  } from '../../components/passport/passportHelpers';

  const profile = $derived($userProfileStore);
  const wallet = $derived($walletStore);
  const stats = $derived($profileStats);
  const tier = $derived($profileTier);
  const earned = $derived($earnedBadges);
  const locked = $derived($lockedBadges);
  const agStats = $derived($agentStats);
  const gState = $derived($gameState);
  const openPos = $derived($openTradeCount);
  const trackedCount = $derived($activeSignalCount);
  const pnl = $derived($totalQuickPnL);
  const opens = $derived($openTrades);
  const closed = $derived($closedTrades);
  const tracked = $derived($activeSignals);
  const expired = $derived($expiredSignals);
  const records = $derived($matchHistoryStore.records);
  const wr = $derived($winRate);
  const bStreak = $derived($bestStreak);

  // Holdings: live API data with static fallback
  let holdingsPanel = $state(createPassportHoldingsState());
  const liveP = $derived($livePrices);

  // Build effective holdings array: live API → static fallback + live price overlay
  const baseHoldings = $derived(holdingsPanel.loaded && holdingsPanel.liveHoldings.length > 0 ? holdingsPanel.liveHoldings : HOLDINGS_DATA);
  const effectiveHoldings = $derived(withLivePrices(baseHoldings, liveP));

  // Holdings calculations
  const total = $derived(effectiveHoldings.reduce((s: number, h: HoldingAsset) => s + h.amount * h.currentPrice, 0));
  const totalCost = $derived(effectiveHoldings.reduce((s: number, h: HoldingAsset) => s + h.amount * h.avgPrice, 0));
  const totalPnl = $derived(total - totalCost);
  const totalPnlPct = $derived(totalCost > 0 ? ((totalPnl / totalCost) * 100) : 0);
  const portfolioValue = $derived((profile.balance.virtual + total).toLocaleString('en-US', { maximumFractionDigits: 0 }));
  const unrealizedPnl = $derived(opens.reduce((s: number, t: { pnlPercent: number }) => s + t.pnlPercent, 0));

  // Tab state
  type TabType = PassportTabType;
  let activeTab: TabType = $state<TabType>('wallet');

  const TABS: { id: TabType; label: string; icon: string }[] = [
    { id: 'wallet', label: 'WALLET', icon: '💼' },
    { id: 'positions', label: 'POSITIONS', icon: '📈' },
    { id: 'profile', label: 'PROFILE', icon: '👤' },
    { id: 'arena', label: 'ARENA', icon: '🏟️' },
  ];

  const OPEN_PREVIEW_LIMIT = 4;
  const MATCH_PREVIEW_LIMIT = 5;
  const HOLDINGS_PREVIEW_LIMIT = 6;
  const openPreview = $derived(opens.slice(0, OPEN_PREVIEW_LIMIT));
  const openOverflow = $derived(opens.slice(OPEN_PREVIEW_LIMIT));
  const holdingsPreview = $derived(effectiveHoldings.slice(0, HOLDINGS_PREVIEW_LIMIT));
  const holdingsOverflow = $derived(effectiveHoldings.slice(HOLDINGS_PREVIEW_LIMIT));
  const matchPreview = $derived(records.slice(0, MATCH_PREVIEW_LIMIT));

  const closedStats = $derived(summarizeClosedTrades(closed));
  const closedWins = $derived(closedStats.wins);
  const closedLosses = $derived(closedStats.losses);
  const closedWinRate = $derived(closed.length > 0 ? Math.round((closedWins / closed.length) * 100) : 0);
  const totalLongTrades = $derived(countLongTrades([...opens, ...closed]));
  const totalTradeDecisions = $derived(opens.length + closed.length);
  const longBiasPct = $derived(totalTradeDecisions > 0 ? Math.round((totalLongTrades / totalTradeDecisions) * 100) : 50);
  const avgWinPnl = $derived(closedStats.avgWinPnl);
  const avgLossPnl = $derived(closedStats.avgLossPnl);
  const resolvedSamples = $derived(closed.length + records.length);
  const learningSamples = $derived(closed.length + records.length + tracked.length + expired.length);
  const showFocusInsights = $derived(shouldShowPassportFocusInsights(resolvedSamples, learningSamples));
  const headerStats: PassportHeaderStat[] = $derived(buildPassportHeaderStats({
    openPos,
    effectiveHoldingCount: effectiveHoldings.length,
    walletConnected: wallet.connected,
    winRate: wr,
    trackedCount,
  }));

  let learningPanel = $state(createPassportLearningPanelState());
  const learningStatusRemote = $derived(learningPanel.statusRemote);
  const focusCards: PassportFocusCard[] = $derived(buildPassportFocusCards({
    closedCount: closed.length,
    recordCount: records.length,
    trackedCount: tracked.length,
    expiredCount: expired.length,
    openPos,
    winRate: wr,
    closedWinRate,
    closedLosses,
    avgWinPnl,
    avgLossPnl,
    longBiasPct,
    learningStatusRemote,
  }));

  const passportLearningPanelController = createPassportLearningPanelController({
    getState: () => learningPanel,
    setState: (next) => {
      learningPanel = next;
    },
    getSummary: () => ({
      closedWinRate,
      avgWinPnl,
      avgLossPnl,
      longBiasPct,
    }),
  });
  const passportHoldingsRuntime = createPassportHoldingsRuntime({
    getState: () => holdingsPanel,
    setState: (next) => {
      holdingsPanel = next;
    },
    toHoldingAsset,
  });

  function syncHoldingsNow() {
    void passportHoldingsRuntime.syncNow({
      connected: wallet.connected,
      address: wallet.address ?? null,
    });
  }

  // Avatar options
  const AVATAR_OPTIONS = [
    '/doge/doge-confident.jpg', '/doge/doge-happy.jpg', '/doge/doge-cute.jpg', '/doge/doge-default.jpg',
    '/doge/doge-think.jpg', '/doge/doge-alert.jpg', '/doge/doge-angry.jpg', '/doge/doge-win.jpg',
    '/doge/sticker-grin.png', '/doge/sticker-love.png', '/doge/sticker-heart.png', '/doge/sticker-laugh.png',
    '/doge/meme-buff.png', '/doge/meme-bodybuilder.png', '/doge/meme-greedy.png', '/doge/meme-money.png',
    '/doge/badge-verified.png', '/doge/badge-shield.png', '/doge/badge-rocket.png', '/doge/badge-diamond.png',
  ];

  let showAvatarPicker = $state(false);
  let editingName = $state(false);
  let nameInput = $state('');

  function pickAvatar(path: string) { setAvatar(path); showAvatarPicker = false; }
  function startEditName() { nameInput = profile.username; editingName = true; }
  function saveName() { if (nameInput.trim().length >= 2) setUsername(nameInput.trim()); editingName = false; }
  function setNameInput(value: string) { nameInput = value; }

  function setActiveTab(tab: TabType) {
    if (tab === activeTab) return;
    activeTab = tab;
    void updateUiStateApi({ passportActiveTab: tab });
  }

  $effect(() => {
    const connected = wallet.connected;
    const address = wallet.address ?? null;
    void passportHoldingsRuntime.syncForWallet({ connected, address });
  });

  $effect(() => {
    const connected = wallet.connected;
    const address = wallet.address ?? null;
    passportHoldingsRuntime.resetIfDisconnected({ connected, address });
  });

  onMount(() => {
    hydrateUserProfile();
    hydrateAgentStats();
    void (async () => {
      const ui = await fetchUiStateApi();
      if (ui?.passportActiveTab && isPassportTab(ui.passportActiveTab)) {
        activeTab = ui.passportActiveTab;
      }

      // First-time / low-data users should land on wallet view first.
      if (activeTab === 'profile' && !wallet.connected && openPos === 0 && records.length === 0) {
        activeTab = 'wallet';
      }
    })();

    if (!wallet.connected || !wallet.address) {
      void passportHoldingsRuntime.hydrate({
        connected: wallet.connected,
        address: wallet.address ?? null,
      });
    }

    void passportLearningPanelController.hydrate();
  });
</script>

<div class="passport-page">
  <div class="passport-sunburst"></div>
  <div class="passport-halftone"></div>

  <div class="passport-scroll">
    <div class="passport-card">
      <!-- ═══ RIBBON ═══ -->
      <div class="card-ribbon">
        <span class="ribbon-text">Stockclaw TRADER PASSPORT</span>
      </div>

      <PassportHeaderSection
        avatar={profile.avatar}
        username={profile.username}
        tierColor={tierColor(tier)}
        tierLabel={tierLabel(tier)}
        tierEmoji={tierEmoji(tier)}
        walletConnected={wallet.connected}
        walletShortAddr={wallet.shortAddr}
        walletChain={wallet.chain}
        portfolioValue={portfolioValue}
        totalPnlPct={totalPnlPct}
        headerStats={headerStats}
        showAvatarPicker={showAvatarPicker}
        avatarOptions={AVATAR_OPTIONS}
        editingName={editingName}
        nameInput={nameInput}
        onToggleAvatarPicker={() => showAvatarPicker = !showAvatarPicker}
        onPickAvatar={pickAvatar}
        onStartEditName={startEditName}
        onSaveName={saveName}
        onNameInput={setNameInput}
        onOpenWalletModal={openWalletModal}
      />

      <PassportNavChrome
        tabs={TABS}
        activeTab={activeTab}
        openPos={openPos}
        recordCount={records.length}
        walletConnected={wallet.connected}
        holdingsSyncing={holdingsPanel.syncing}
        showFocusInsights={showFocusInsights}
        focusCards={focusCards}
        onSelectTab={setActiveTab}
        onSyncHoldings={syncHoldingsNow}
        onOpenWalletModal={openWalletModal}
      />

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
                  <button class="vb-connect" onclick={openWalletModal}>CONNECT WALLET FOR DEFI</button>
                {:else}
                  <div class="vb-connected"><span class="vbc-dot"></span>Wallet Connected · {wallet.chain} · {wallet.balance.toLocaleString()} USDT</div>
                {/if}
              </div>
            </section>

            <section class="content-panel">
              <div class="holdings-status" class:live={holdingsPanel.state === 'live'}>
                <span class="hs-dot"></span>
                <span>{holdingsPanel.statusMessage}</span>
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
                      {#each holdingsPreview as asset}
                        <div class="legend-item"><span class="li-dot" style="background:{asset.color}"></span><span class="li-name">{asset.symbol}</span><span class="li-pct">{(asset.allocation * 100).toFixed(0)}%</span></div>
                      {/each}
                      {#if holdingsOverflow.length > 0}
                        <details class="detail-block nested-detail compact-detail">
                          <summary>MORE ASSETS ({holdingsOverflow.length})</summary>
                          <div class="legend overflow-legend">
                            {#each holdingsOverflow as asset}
                              <div class="legend-item"><span class="li-dot" style="background:{asset.color}"></span><span class="li-name">{asset.symbol}</span><span class="li-pct">{(asset.allocation * 100).toFixed(0)}%</span></div>
                            {/each}
                          </div>
                        </details>
                      {/if}
                    </div>
                  </div>

                  <div class="table-section">
                    <div class="st">HOLDINGS</div>
                    <div class="htable">
                      <div class="hrow header-row"><span class="hc asset-col">ASSET</span><span class="hc">AMOUNT</span><span class="hc">VALUE</span><span class="hc">PnL</span></div>
                      {#each holdingsPreview as asset}
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
                    {#if holdingsOverflow.length > 0}
                      <details class="detail-block nested-detail compact-detail">
                        <summary>MORE HOLDINGS ({holdingsOverflow.length})</summary>
                        <div class="htable">
                          {#each holdingsOverflow as asset}
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
                      </details>
                    {/if}
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
                {#each openPreview as trade (trade.id)}
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
                {#if openOverflow.length > 0}
                  <details class="detail-block detail-spaced">
                    <summary>MORE OPEN TRADES ({openOverflow.length})</summary>
                    {#each openOverflow as trade (trade.id)}
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
                  </details>
                {/if}
              {:else}
                <EmptyState image={CHARACTER_ART.tradeActions} title="NO OPEN POSITIONS" subtitle="Use QUICK LONG/SHORT in the Terminal to start trading" ctaText="GO TO TERMINAL →" ctaHref="/terminal" icon="📊" variant="cyan" compact />
              {/if}

              {#if tracked.length > 0}
                <details class="detail-block detail-spaced">
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
                <details class="detail-block detail-spaced">
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

            <PassportLearningPanel panelState={learningPanel} controller={passportLearningPanelController} />

            <section class="content-panel">
              <details class="detail-block">
                <summary>AGENT SQUAD ({AGDEFS.length})</summary>
                <div class="agent-perf-grid">
                  {#each AGDEFS as ag}
                    {@const ags = agStats[ag.id]}
                    <div class="agent-perf-card" style="border-left-color:{ag.color}">
                      <div class="apc-head">
                        {#if ag.img?.def}
                          <img src={ag.img.def} alt={ag.name} class="apc-img" loading="lazy" />
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

            <section class="content-panel list-panel">
              {#if records.length > 0}
                <details class="detail-block">
                  <summary>MATCH HISTORY ({Math.min(records.length, 20)})</summary>
                  {#each matchPreview as match (match.id)}
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
                  {#if records.length > MATCH_PREVIEW_LIMIT}
                    <details class="detail-block nested-detail">
                      <summary>OLDER MATCHES ({Math.min(records.length - MATCH_PREVIEW_LIMIT, 12)})</summary>
                      {#each records.slice(MATCH_PREVIEW_LIMIT, 20) as match (match.id)}
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
                  {/if}
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
    --sp-bg: #031611;
    --sp-bg2: #0a2b20;
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
    --sp-space-1: 4px;
    --sp-space-2: 6px;
    --sp-space-3: 8px;
    --sp-space-4: 10px;
    --sp-space-5: 12px;
    --sp-space-6: 14px;
    --sp-font-display: 'Orbitron', 'Space Grotesk', sans-serif;
    --sp-font-label: 'Space Grotesk', sans-serif;
    --sp-font-body: 'Space Grotesk', sans-serif;
    --fp: var(--sp-font-label);
    --fd: var(--sp-font-display);
    --fm: var(--sp-font-body);
    height: 100%;
    overflow: hidden;
    position: relative;
    display: flex;
    justify-content: center;
    background:
      radial-gradient(circle at 8% 12%, rgba(255, 140, 121, 0.2) 0%, rgba(255, 140, 121, 0) 38%),
      radial-gradient(circle at 84% 8%, rgba(157, 205, 185, 0.12) 0%, rgba(157, 205, 185, 0) 32%),
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
    opacity: 0.14;
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
    background: rgba(255, 140, 121, 0.42);
    box-shadow: 0 0 10px rgba(255, 140, 121, 0.28), 0 0 20px rgba(255, 140, 121, 0.14);
  }

  .passport-sunburst {
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    opacity: 0.14;
    background:
      radial-gradient(1px 1px at 11% 18%, rgba(255, 255, 255, 0.58) 50%, transparent 50%),
      radial-gradient(1px 1px at 29% 52%, rgba(255, 255, 255, 0.5) 50%, transparent 50%),
      radial-gradient(1px 1px at 41% 6%, rgba(255, 255, 255, 0.55) 50%, transparent 50%),
      radial-gradient(1.2px 1.2px at 66% 23%, rgba(255, 255, 255, 0.55) 50%, transparent 50%),
      radial-gradient(1px 1px at 84% 68%, rgba(255, 255, 255, 0.5) 50%, transparent 50%),
      radial-gradient(1.4px 1.4px at 7% 88%, rgba(255, 255, 255, 0.55) 50%, transparent 50%);
    background-size: 350px 350px;
  }

  .passport-halftone {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    background: repeating-linear-gradient(
      0deg,
      transparent 0px,
      transparent 4px,
      rgba(0, 0, 0, 0.06) 4px,
      rgba(0, 0, 0, 0.06) 5px
    );
    opacity: 0.14;
  }

  .passport-scroll {
    position: relative;
    z-index: 3;
    width: 100%;
    max-width: 1080px;
    height: 100%;
    overflow-y: auto;
    padding: var(--sp-space-5) var(--sp-space-4) calc(var(--sp-space-5) + var(--sc-bottom-bar-h));
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
    border-radius: 16px;
    background:
      radial-gradient(circle at 100% 0%, rgba(255, 140, 121, 0.16) 0%, rgba(255, 140, 121, 0) 35%),
      linear-gradient(180deg, rgba(9, 34, 25, 0.96) 0%, rgba(5, 20, 14, 0.98) 100%);
    box-shadow: 0 16px 34px rgba(0, 0, 0, 0.36), inset 0 0 0 1px rgba(255, 140, 121, 0.2);
  }

  .card-ribbon {
    position: relative;
    z-index: 2;
    padding: var(--sp-space-2) var(--sp-space-4);
    background: rgba(0, 0, 0, 0.22);
    border-bottom: 1px solid var(--sp-line);
  }

  .ribbon-text {
    font-family: var(--fp);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.32px;
    color: var(--sp-pk-l);
  }

  .tab-content {
    padding: var(--sp-space-5);
    background: linear-gradient(180deg, rgba(11, 32, 21, 0.66), rgba(7, 18, 13, 0.88));
  }

  .profile-tab,
  .wallet-tab,
  .positions-tab,
  .arena-tab {
    display: flex;
    flex-direction: column;
    gap: var(--sp-space-2);
  }

  .content-panel {
    border: 1px solid var(--sp-soft);
    border-radius: 12px;
    padding: var(--sp-space-5);
    background: rgba(0, 0, 0, 0.44);
  }

  .list-panel {
    padding-top: 8px;
  }

  .section-header {
    margin-bottom: var(--sp-space-3);
    color: var(--sp-pk-l);
    font-family: var(--fp);
    font-size: 12px;
    letter-spacing: 0.12px;
    border-left: 3px solid var(--sp-pk);
    padding-left: 8px;
  }

  .metrics-grid,
  .pos-summary,
  .arena-stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--sp-space-3);
  }

  .metric-card,
  .ps-item,
  .as-item,
  .wk-item {
    border: 1px solid var(--sp-soft);
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.02);
    padding: var(--sp-space-3) var(--sp-space-2);
    text-align: center;
  }

  .metrics-detail {
    margin-top: 8px;
  }

  .mc-icon {
    font-size: 16px;
    margin-bottom: 6px;
  }

  .mc-value,
  .psi-value,
  .asi-val,
  .wk-v {
    color: var(--sp-w);
    font-family: var(--fd);
    font-size: 18px;
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
    font-size: 9px;
    letter-spacing: 0.08px;
  }

  .summary-line {
    margin-top: var(--sp-space-3);
    padding: var(--sp-space-2) var(--sp-space-3);
    border-radius: 8px;
    border: 1px dashed var(--sp-soft);
    color: var(--sp-w);
    text-align: center;
    font-family: var(--fm);
    font-size: 12px;
  }

  .detail-block {
    margin-top: var(--sp-space-2);
    border: 1px solid var(--sp-soft);
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.02);
    overflow: hidden;
  }

  .detail-block summary {
    list-style: none;
    cursor: pointer;
    user-select: none;
    padding: var(--sp-space-2) var(--sp-space-3);
    color: var(--sp-pk-l);
    font-family: var(--fp);
    font-size: 11px;
    letter-spacing: 0.08px;
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

  .detail-spaced {
    margin-top: var(--sp-space-3);
  }

  .agent-perf-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    padding: 8px;
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
    font-size: 16px;
  }

  .apc-name {
    font-family: var(--fm);
    font-size: 11px;
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
    font-size: 9px;
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
    padding: 8px;
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
    font-size: 16px;
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
    font-size: 9px;
  }

  .vb-card {
    border: 1px solid var(--sp-line);
    border-radius: 10px;
    background: rgba(255, 140, 121, 0.08);
    padding: var(--sp-space-4);
  }

  .vb-header {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .vb-icon {
    font-size: 13px;
  }

  .vb-title {
    color: var(--sp-dim);
    font-family: var(--fp);
    font-size: 9px;
    letter-spacing: 0.2px;
  }

  .vb-amount {
    margin-top: 5px;
    color: var(--sp-pk-l);
    font-family: var(--sp-font-display);
    font-size: clamp(20px, 2.5vw, 26px);
    line-height: 1.1;
  }

  .vb-connect {
    margin-top: var(--sp-space-3);
    border: 1px solid var(--sp-pk);
    background: rgba(255, 140, 121, 0.16);
    color: var(--sp-pk-l);
    border-radius: 8px;
    padding: var(--sp-space-2) var(--sp-space-3);
    font-family: var(--fp);
    font-size: 9px;
    letter-spacing: 0.2px;
    cursor: pointer;
  }

  .vb-connected {
    margin-top: var(--sp-space-2);
    color: var(--sp-w);
    font-family: var(--fm);
    font-size: 11px;
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
    padding: 6px 12px;
    margin-bottom: var(--sp-space-2);
    border: 1px solid var(--sp-soft);
    border-radius: 999px;
    color: var(--sp-dim);
    font-family: var(--fm);
    font-size: 10px;
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
    gap: var(--sp-space-2);
  }

  .holdings-body {
    display: grid;
    grid-template-columns: minmax(230px, 280px) minmax(0, 1fr);
  }

  .st {
    padding: var(--sp-space-2) var(--sp-space-3);
    border-bottom: 1px solid var(--sp-soft);
    color: var(--sp-dim);
    font-family: var(--fp);
    font-size: 9px;
    letter-spacing: 0.2px;
  }

  .donut-section {
    border-right: 1px solid var(--sp-soft);
  }

  .donut-wrap {
    padding: var(--sp-space-2) var(--sp-space-3);
  }

  .donut-wrap svg {
    width: 100%;
    max-width: 170px;
    display: block;
    margin: 0 auto;
  }

  .legend {
    padding: 0 var(--sp-space-2) var(--sp-space-2);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .overflow-legend {
    padding-top: 8px;
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
    padding: 0 var(--sp-space-2) var(--sp-space-2);
  }

  .hrow {
    display: grid;
    grid-template-columns: 1.8fr 1fr 1fr 1fr;
    gap: var(--sp-space-2);
    align-items: center;
    padding: var(--sp-space-2) var(--sp-space-2);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .hrow:not(.header-row):hover {
    background: rgba(255, 255, 255, 0.03);
  }

  .header-row {
    color: var(--sp-dim);
    font-family: var(--fp);
    font-size: 9px;
    letter-spacing: 0.08px;
  }

  .hc {
    color: var(--sp-w);
    font-family: var(--fm);
    font-size: 12px;
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
    width: 24px;
    height: 24px;
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
    font-size: 11px;
  }

  .af {
    color: var(--sp-dim);
    font-family: var(--fm);
    font-size: 10px;
    margin-top: 2px;
  }

  .pos-section-title {
    margin-bottom: 6px;
    color: var(--sp-pk-l);
    font-family: var(--fp);
    font-size: 10px;
    letter-spacing: 0.2px;
  }

  .pos-row,
  .match-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-space-2);
    padding: var(--sp-space-2) var(--sp-space-2);
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
    gap: var(--sp-space-2);
    min-width: 0;
  }

  .pr-dir,
  .mr-result {
    font-family: var(--fp);
    font-size: 9px;
    letter-spacing: 0.08px;
    border-radius: 6px;
    padding: 4px 8px;
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
    font-size: 12px;
    font-weight: 700;
  }

  .pr-src {
    color: var(--sp-dim);
    font-family: var(--fm);
    font-size: 10px;
    padding: 3px 8px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.05);
    white-space: nowrap;
  }

  .pr-right,
  .mr-right {
    display: flex;
    align-items: center;
    gap: var(--sp-space-2);
    flex-shrink: 0;
  }

  .pr-entry,
  .pr-time,
  .mr-time {
    color: var(--sp-dim);
    font-family: var(--fm);
    font-size: 11px;
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
    font-size: 9px;
    letter-spacing: 0.08px;
    padding: 3px 8px;
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
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
  }

  .nested-detail {
    margin: var(--sp-space-1) var(--sp-space-2) var(--sp-space-2);
    border-style: dashed;
  }

  .compact-detail {
    margin: var(--sp-space-1) 0 0;
  }

  /* ── Tablet ≤1024px ── */
  @media (max-width: 1024px) {
    .passport-scroll {
      padding: var(--sp-space-2);
    }

    .metrics-grid,
    .pos-summary,
    .arena-stats,
    .wallet-kpis {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .tab-content {
      padding: var(--sp-space-3);
    }

    .content-panel {
      padding: var(--sp-space-3);
    }
  }

  /* ── Mobile ≤768px ── */
  @media (max-width: 768px) {
    .passport-scroll {
      padding: var(--sp-space-1);
    }

    .passport-card {
      border-radius: 10px;
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
      border-bottom: 1px solid var(--sp-soft);
    }

    .pos-row,
    .match-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }

    .pr-right,
    .mr-right {
      width: 100%;
      justify-content: space-between;
    }

    .tab-content {
      padding: var(--sp-space-2);
    }

    .content-panel {
      padding: var(--sp-space-2);
      border-radius: 9px;
    }

    .htable {
      min-width: 360px;
    }

    .hc {
      font-size: 11px;
    }

    .mc-value,
    .psi-value,
    .asi-val,
    .wk-v {
      font-size: 15px;
    }

  }

  /* ── Small Mobile ≤480px ── */
  @media (max-width: 480px) {
    .passport-scroll {
      padding: 2px;
    }

    .passport-card {
      border-radius: 8px;
    }

    .card-ribbon {
      padding: 4px 8px;
    }

    .ribbon-text {
      font-size: 9px;
    }

    .metrics-grid,
    .pos-summary,
    .arena-stats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--sp-space-1);
    }

    .wallet-kpis {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--sp-space-1);
    }

    .metric-card,
    .ps-item,
    .as-item,
    .wk-item {
      padding: var(--sp-space-2) var(--sp-space-1);
    }

    .mc-value,
    .psi-value,
    .asi-val,
    .wk-v {
      font-size: 14px;
    }

    .mc-icon {
      font-size: 13px;
      margin-bottom: 4px;
    }

    .mc-label,
    .psi-label,
    .asi-label,
    .wk-k {
      font-size: var(--sc-fs-2xs, 9px);
    }

    .badges-grid {
      gap: 4px;
      padding: 4px;
    }

    .badge-card {
      padding: 6px 4px;
    }

    .badge-icon {
      font-size: 14px;
    }

    .badge-name {
      font-size: 9px;
    }

    .agent-perf-card {
      padding: 7px;
    }

    .apc-img {
      width: 24px;
      height: 24px;
      border-radius: 6px;
    }

    .htable {
      min-width: 320px;
      font-size: 10px;
    }

    .hrow {
      grid-template-columns: 1.5fr 0.8fr 0.8fr 0.8fr;
      gap: 3px;
      padding: var(--sp-space-1) var(--sp-space-1);
    }

    .hc {
      font-size: 10px;
    }

    .ai {
      width: 20px;
      height: 20px;
      font-size: 9px;
    }

    .an {
      font-size: 10px;
    }

    .af {
      font-size: 9px;
    }

    .donut-wrap svg {
      max-width: 140px;
    }

    .pr-pair {
      font-size: 11px;
    }

    .pr-src {
      font-size: 9px;
      padding: 2px 6px;
    }

    .pr-pnl,
    .mr-lp {
      font-size: 11px;
      min-width: 48px;
    }

    .summary-line {
      font-size: 11px;
      padding: var(--sp-space-1) var(--sp-space-2);
    }

    .section-header {
      font-size: 11px;
      margin-bottom: var(--sp-space-2);
    }

    .detail-block summary {
      font-size: 10px;
      padding: var(--sp-space-1) var(--sp-space-2);
    }

    .vb-amount {
      font-size: clamp(16px, 5vw, 22px);
    }

  }
</style>
