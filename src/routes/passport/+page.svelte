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
  import { HOLDINGS_DATA, type HoldingAsset } from '$lib/data/holdings';
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
  import PassportArenaTab from '../../components/passport/PassportArenaTab.svelte';
  import PassportHeaderSection from '../../components/passport/PassportHeaderSection.svelte';
  import PassportNavChrome from '../../components/passport/PassportNavChrome.svelte';
  import PassportProfileTab from '../../components/passport/PassportProfileTab.svelte';
  import PassportPositionsTab from '../../components/passport/PassportPositionsTab.svelte';
  import PassportWalletTab from '../../components/passport/PassportWalletTab.svelte';
  import {
    withLivePrices,
    toHoldingAsset,
    summarizeClosedTrades,
    countLongTrades,
    tierColor,
    tierEmoji,
    tierLabel,
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
          <PassportProfileTab
            stats={stats}
            wins={gState.wins}
            losses={gState.losses}
            earnedBadges={earned}
            lockedBadges={locked}
          />

        <!-- ════ WALLET TAB ════ -->
        {:else if activeTab === 'wallet'}
          <PassportWalletTab
            virtualBalance={profile.balance.virtual}
            walletConnected={wallet.connected}
            walletChain={wallet.chain}
            walletBalance={wallet.balance}
            holdingsState={holdingsPanel.state}
            holdingsStatusMessage={holdingsPanel.statusMessage}
            effectiveHoldings={effectiveHoldings}
            total={total}
            totalPnlPct={totalPnlPct}
            onOpenWalletModal={openWalletModal}
          />

        <!-- ════ POSITIONS TAB ════ -->
        {:else if activeTab === 'positions'}
          <PassportPositionsTab
            opens={opens}
            tracked={tracked}
            closed={closed}
            unrealizedPnl={unrealizedPnl}
            totalPnl={pnl}
          />

        <!-- ════ ARENA TAB ════ -->
        {:else if activeTab === 'arena'}
          <PassportArenaTab
            records={records}
            winRate={wr}
            bestStreak={bStreak}
            lp={gState.lp}
            agentStats={agStats}
            learningPanelState={learningPanel}
            learningPanelController={passportLearningPanelController}
          />
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

  /* ── Tablet ≤1024px ── */
  @media (max-width: 1024px) {
    .passport-scroll {
      padding: var(--sp-space-2);
    }

    .tab-content {
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

    .tab-content {
      padding: var(--sp-space-2);
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
  }
</style>
