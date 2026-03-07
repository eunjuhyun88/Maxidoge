<script lang="ts">
  import { communityPosts, hydrateCommunityPosts, likeCommunityPost } from '$lib/stores/communityStore';
  import { openTrades, closeQuickTrade, hydrateQuickTrades } from '$lib/stores/quickTradeStore';
  import { gameState } from '$lib/stores/gameState';
  import { livePrices } from '$lib/stores/priceStore';
  import { predictMarkets, loadPolymarkets } from '$lib/stores/predictStore';
  import {
    polymarketPositions,
    gmxPositions,
    pendingPositions,
    hydratePositions,
    pollPendingPositions,
    positionsLoading,
    positionsError,
    positionsLastSyncedAt,
  } from '$lib/stores/positionStore';
  import {
    executeIntelShadowTradeApi,
    fetchIntelEventsApi,
    fetchIntelFlowApi,
    fetchIntelNewsPageApi,
    fetchIntelOnchainApi,
    fetchIntelOpportunityScanApi,
    fetchIntelPolicyApi,
    fetchIntelShadowPolicyApi,
    fetchIntelTrendingApi,
  } from '$lib/api/intelApi';
  import { fetchUiStateApi, updateUiStateApi } from '$lib/api/preferencesApi';
  import { onMount, onDestroy } from 'svelte';
  import { createIntelPositionSyncRuntime } from '$lib/terminal/intel/intelPositionRuntime';
  import {
    mapIntelFlowPayloadToRows,
    mapIntelNewsRecordsToHeadlines,
  } from '$lib/terminal/intel/intelFeedMappers';
  import { normalizeIntelPolicyPayload } from '$lib/terminal/intel/intelPolicyMappers';
  import { createUiStateSaveQueue, loadInitialIntelPanelState } from '$lib/terminal/intel/intelUiState';
  import {
    deriveIntelFeedOptions,
    deriveIntelHeadlineState,
    deriveIntelPositionState,
    deriveIntelTrendState,
    derivePolicyCardsForTab,
    normalizeFeedFilterForDensity,
    normalizeTrendTabForDensity,
  } from '$lib/terminal/intel/intelViewModel';
  import type {
    TerminalChatConnectionStatus,
    TerminalDensityMode,
  } from '$lib/terminal/terminalTypes';
  import type {
    FeedFilter,
    HeadlineSort,
    IntelPanelTab,
    LiveEventItem,
    LiveFlowItem,
    PolicySummary,
    PositionTradeRow,
    PositionMarketRow,
    HeadlineEx,
    OnchainData,
    TrendingCoin,
    GainerLoser,
    TrendTab,
    DexHot,
    OpScore,
    OpAlert,
    PolicyPanel,
    PolicyCard,
    PolicyDecision,
    ShadowDecision,
    ShadowRuntime,
  } from '$lib/terminal/intel/intelTypes';
  import { getPairPrice } from '$lib/utils/price';
  import {
    DEMO_QUICK_TRADES,
    DEMO_GMX_POSITIONS,
    DEMO_POLYMARKET_POSITIONS,
    FEED_FILTER_OPTIONS_ALL,
    FEED_FILTER_OPTIONS_ESSENTIAL,
    TREND_TAB_OPTIONS_ALL,
    TREND_TAB_OPTIONS_ESSENTIAL,
    TREND_BASIS,
    TREND_BASIS_COMPACT,
  } from '$lib/terminal/intel/intelTypes';

  // Sub-components
  import IntelChatSection from './intel/IntelChatSection.svelte';
  import IntelFeedNews from './intel/IntelFeedNews.svelte';
  import IntelFeedTrending from './intel/IntelFeedTrending.svelte';
  import IntelFeedOnchain from './intel/IntelFeedOnchain.svelte';
  import IntelPositions from './intel/IntelPositions.svelte';

  // ═══ Props (from terminal page) ═══
  interface Props {
    chatMessages?: { from: string; icon: string; color: string; text: string; time: string; isUser: boolean; isSystem?: boolean }[];
    isTyping?: boolean;
    prioritizeChat?: boolean;
    chatFocusKey?: number;
    chatTradeReady?: boolean;
    chatConnectionStatus?: TerminalChatConnectionStatus;
    densityMode?: TerminalDensityMode;
    onSendChat?: (detail: { text: string }) => void;
    onGoToTrade?: () => void;
    onCollapse?: () => void;
  }
  let {
    chatMessages = [],
    isTyping = false,
    prioritizeChat = false,
    chatFocusKey = 0,
    chatTradeReady = false,
    chatConnectionStatus = 'connected',
    densityMode = 'essential',
    onSendChat = () => {},
    onGoToTrade = () => {},
    onCollapse = () => {},
  }: Props = $props();

  // ═══ Tab state ═══
  let activeTab: IntelPanelTab = $state('chat');
  let feedFilter: FeedFilter = $state('trending');
  let tabCollapsed = $state(false);

  // ═══ Headlines ═══
  let liveHeadlines = $state<HeadlineEx[]>([]);
  let headlineOffset = $state(0);
  let headlineHasMore = $state(true);
  let headlineLoading = $state(false);
  let headlineSortBy = $state<HeadlineSort>('importance');

  // ═══ Events & Flows ═══
  let liveEvents = $state<LiveEventItem[]>([]);
  let liveFlows = $state<LiveFlowItem[]>([]);
  let dataLoaded = $state({ headlines: false, events: false, flow: false, trending: false });

  // ═══ Onchain ═══
  let onchainData = $state<OnchainData | null>(null);
  let onchainLoading = $state(false);
  let _onchainTimer: ReturnType<typeof setInterval> | null = null;

  // ═══ Trending ═══
  let trendingCoins = $state<TrendingCoin[]>([]);
  let trendGainers = $state<GainerLoser[]>([]);
  let trendLosers = $state<GainerLoser[]>([]);
  let trendDexHot = $state<DexHot[]>([]);
  let trendSubTab = $state<TrendTab>('picks');
  let trendLoading = $state(false);
  let trendUpdatedAt = $state(0);
  let dexChainFilter = $state('all');

  // ═══ Opportunity Scanner ═══
  let topPicks = $state<OpScore[]>([]);
  let opAlerts = $state<OpAlert[]>([]);
  let macroRegime = $state('');
  let picksLoading = $state(false);
  let picksScanTime = $state(0);
  let picksLoaded = $state(false);

  // ═══ Policy & Shadow ═══
  let policyDecision = $state<PolicyDecision | null>(null);
  let policyPanels = $state<Record<PolicyPanel, PolicyCard[]>>({
    headlines: [], events: [], flow: [], trending: [], picks: [],
  });
  let policyLoading = $state(false);
  let policyLoaded = $state(false);
  let policyUpdatedAt = $state(0);
  let policySummary = $state<PolicySummary | null>(null);
  let shadowDecision = $state<ShadowDecision | null>(null);
  let shadowRuntime = $state<ShadowRuntime | null>(null);
  let shadowExecutionEnabled = $state(false);
  let shadowLoading = $state(false);
  let shadowExecLoading = $state(false);
  let shadowExecMessage = $state('');
  let shadowExecError = $state('');

  let showDebugModel = $state(false);
  let _lastChatFocusKey = 0;
  let opens = $state<PositionTradeRow[]>([]);
  let openCount = $state(0);
  let livePositionCount = $state(0);
  let hasLivePositions = $state(false);
  let useDemoPositions = $state(false);
  let displayTrades = $state<PositionTradeRow[]>([]);
  let displayGmxPositions = $state<PositionMarketRow[]>([]);
  let displayPolymarketPositions = $state<PositionMarketRow[]>([]);
  let displayOpenCount = $state(0);
  let displayGmxCount = $state(0);
  let displayPolymarketCount = $state(0);
  let positionCount = $state(0);
  let pendingCount = $state(0);
  let positionsSyncStatus = $state('NOT SYNCED');
  let trendBasisText = $state('');
  let trendBasisCompactText = $state('');
  let trendUpdatedLabel = $state('');
  let dexChains = $state<string[]>(['all']);
  let filteredDexHot = $state<DexHot[]>([]);
  let visibleTopPicks = $state<OpScore[]>([]);
  let visibleTrendingCoins = $state<TrendingCoin[]>([]);
  let visibleTrendGainers = $state<GainerLoser[]>([]);
  let visibleTrendLosers = $state<GainerLoser[]>([]);
  let visibleDexHot = $state<DexHot[]>([]);
  let feedFilterOptions = $state(FEED_FILTER_OPTIONS_ESSENTIAL);
  let trendTabOptions = $state(TREND_TAB_OPTIONS_ESSENTIAL);
  let currentToken = $state('BTC');
  let tokenAliases = $state<string[]>(['btc']);
  let filteredHeadlines = $state<HeadlineEx[]>([]);
  let displayHeadlines = $state<HeadlineEx[]>([]);
  let visibleHeadlines = $state<HeadlineEx[]>([]);
  let policyCardsForTab = $state<PolicyCard[]>([]);
  const uiStateSaveQueue = createUiStateSaveQueue((partial) => updateUiStateApi(partial));
  const positionSyncRuntime = createIntelPositionSyncRuntime({
    getActiveTab: () => activeTab,
    hydratePositions,
    pollPendingPositions,
  });

  // ═══ Derived state ═══
  $effect(() => {
    ({
    opens,
    openCount,
    livePositionCount,
    hasLivePositions,
    useDemoPositions,
    displayTrades,
    displayGmxPositions,
    displayPolymarketPositions,
    displayOpenCount,
    displayGmxCount,
    displayPolymarketCount,
    positionCount,
    pendingCount,
    positionsSyncStatus,
  } = deriveIntelPositionState({
    openTrades: $openTrades,
    gmxPositions: $gmxPositions,
    polymarketPositions: $polymarketPositions,
    pendingPositions: $pendingPositions,
    positionsLoading: $positionsLoading,
    positionsError: $positionsError,
    positionsLastSyncedAt: $positionsLastSyncedAt,
  }));
  });

  // Trending derived
  $effect(() => {
    ({
    trendBasisText,
    trendBasisCompactText,
    trendUpdatedLabel,
    dexChains,
    dexChainFilter,
    filteredDexHot,
    visibleTopPicks,
    visibleTrendingCoins,
    visibleTrendGainers,
    visibleTrendLosers,
    visibleDexHot,
  } = deriveIntelTrendState({
    densityMode,
    trendSubTab,
    trendUpdatedAt,
    trendDexHot,
    dexChainFilter,
    topPicks,
    trendingCoins,
    trendGainers,
    trendLosers,
  }));
  });

  // Feed options
  $effect(() => {
    ({ feedFilterOptions, trendTabOptions } = deriveIntelFeedOptions(densityMode));
  });
  $effect(() => {
    const nextFeedFilter = normalizeFeedFilterForDensity(densityMode, feedFilter);
    if (nextFeedFilter !== feedFilter) {
      setFeedFilter(nextFeedFilter);
    }
  });
  $effect(() => {
    const nextTrendTab = normalizeTrendTabForDensity(densityMode, trendSubTab);
    if (nextTrendTab !== trendSubTab) {
      trendSubTab = nextTrendTab;
    }
  });

  // Headlines derived
  $effect(() => {
    ({
    currentToken,
    tokenAliases,
    filteredHeadlines,
    displayHeadlines,
    visibleHeadlines,
  } = deriveIntelHeadlineState({
    pair: $gameState.pair || 'BTC/USDT',
      liveHeadlines,
      densityMode,
  }));
  });

  // Policy cards for current feed tab
  $effect(() => {
    policyCardsForTab = derivePolicyCardsForTab({ feedFilter, trendSubTab, policyPanels });
  });

  // Chat focus trigger
  $effect(() => {
    if (chatFocusKey !== _lastChatFocusKey) {
      _lastChatFocusKey = chatFocusKey;
      activeTab = 'chat';
      tabCollapsed = false;
    }
  });

  // Auto-sync positions on tab switch
  let _prevActiveTab = $state<IntelPanelTab>('chat');
  $effect(() => {
    if (activeTab === 'positions' && _prevActiveTab !== 'positions') {
      void syncPositions(true);
    }
    _prevActiveTab = activeTab;
  });

  // ═══ Tab keyboard navigation (roving tabindex) ═══
  const TAB_ORDER: IntelPanelTab[] = ['chat', 'feed', 'positions'];
  function handleTabKeydown(e: KeyboardEvent) {
    const idx = TAB_ORDER.indexOf(activeTab);
    let next = idx;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { next = (idx + 1) % TAB_ORDER.length; e.preventDefault(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { next = (idx - 1 + TAB_ORDER.length) % TAB_ORDER.length; e.preventDefault(); }
    else if (e.key === 'Home') { next = 0; e.preventDefault(); }
    else if (e.key === 'End') { next = TAB_ORDER.length - 1; e.preventDefault(); }
    else return;
    setTab(TAB_ORDER[next]);
    // Focus the newly active tab button
    const tabList = (e.currentTarget as HTMLElement);
    const buttons = tabList.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons[next]?.focus();
  }

  // ═══ Tab actions ═══
  function setTab(tab: IntelPanelTab) {
    if (activeTab === tab) {
      tabCollapsed = !tabCollapsed;
    } else {
      activeTab = tab;
      tabCollapsed = false;
      queueUiStateSave({ terminalActiveTab: activeTab });
    }
  }

  function setFeedFilter(f: FeedFilter) {
    feedFilter = f;
    queueUiStateSave({ terminalFeedFilter: feedFilter });
    if (f === 'trending') { fetchTopPicks(); fetchTrendingData(); }
  }

  function activateTrendTab(tab: TrendTab) {
    trendSubTab = tab;
    if (tab === 'picks') fetchTopPicks();
  }

  function queueUiStateSave(partial: Record<string, unknown>) {
    uiStateSaveQueue.queue(partial);
  }

  // ═══ Position sync ═══
  async function syncPositions(force = false) {
    await positionSyncRuntime.syncPositions(force);
  }

  function startPositionSyncLoop() {
    positionSyncRuntime.start();
  }

  function handleClosePos(id: string) {
    const trade = $openTrades.find((t) => t.id === id);
    if (!trade) return;
    const price = getPairPrice($livePrices, trade.pair, 'BTC', trade.currentPrice || trade.entry);
    closeQuickTrade(id, price);
  }

  // ═══ Data fetching ═══
  async function fetchOnchainData() {
    try {
      onchainLoading = !onchainData;
      const nextOnchainData = await fetchIntelOnchainApi();
      if (nextOnchainData) onchainData = nextOnchainData;
    } catch { /* silent */ }
    onchainLoading = false;
  }

  async function fetchLiveHeadlines(append = false) {
    if (headlineLoading) return;
    headlineLoading = true;
    try {
      const token = ($gameState.pair || 'BTC/USDT').split('/')[0];
      const offset = append ? headlineOffset : 0;
      const page = await fetchIntelNewsPageApi({ token, offset, sort: headlineSortBy });
      if (!page) return;
      const newItems = mapIntelNewsRecordsToHeadlines(page.records);
      liveHeadlines = append ? [...liveHeadlines, ...newItems] : newItems;
      headlineOffset = (page.offset ?? 0) + newItems.length;
      headlineHasMore = page.hasMore ?? false;
      dataLoaded.headlines = true;
      dataLoaded = dataLoaded;
    } catch { console.warn('[IntelPanel] Headlines API unavailable'); }
    finally { headlineLoading = false; }
  }

  function toggleHeadlineSort() {
    headlineSortBy = headlineSortBy === 'importance' ? 'time' : 'importance';
    headlineOffset = 0;
    headlineHasMore = true;
    fetchLiveHeadlines(false);
  }

  function loadMoreHeadlines() {
    if (headlineHasMore && !headlineLoading) fetchLiveHeadlines(true);
  }

  function applyPolicyPayload(raw: any) {
    const normalized = normalizeIntelPolicyPayload(raw);
    policyPanels = normalized.policyPanels;
    policyDecision = normalized.policyDecision;
    policySummary = normalized.policySummary;
    policyUpdatedAt = normalized.policyUpdatedAt;
    policyLoaded = normalized.policyLoaded;
  }

  async function fetchIntelPolicy() {
    if (policyLoading) return;
    policyLoading = true;
    shadowLoading = true;
    try {
      const pair = $gameState.pair || 'BTC/USDT';
      const timeframe = $gameState.timeframe || '4h';
      const shadowPayload = await fetchIntelShadowPolicyApi(pair, timeframe);
      if (shadowPayload?.policy) {
        applyPolicyPayload(shadowPayload.policy);
        shadowDecision = shadowPayload.shadow ?? null;
        shadowRuntime = shadowPayload.llm ?? null;
        shadowExecutionEnabled = shadowPayload.executionEnabled;
        shadowLoading = false;
        return;
      }

      const policyPayload = await fetchIntelPolicyApi(pair, timeframe);
      if (policyPayload) {
        applyPolicyPayload(policyPayload);
        shadowDecision = null;
        shadowRuntime = null;
        shadowExecutionEnabled = false;
      }
    } catch { console.warn('[IntelPanel] Intel policy API unavailable'); }
    finally { policyLoading = false; shadowLoading = false; }
  }

  async function executeShadowTrade() {
    if (shadowExecLoading) return;
    if (!shadowDecision || !shadowDecision.enforced.shouldExecute) {
      shadowExecError = '실행 게이트를 통과한 상태가 아닙니다.';
      shadowExecMessage = '';
      return;
    }
    shadowExecLoading = true;
    shadowExecError = '';
    shadowExecMessage = '';
    try {
      const pair = $gameState.pair || 'BTC/USDT';
      const timeframe = $gameState.timeframe || '4h';
      const currentPrice = getPairPrice($livePrices, pair, 'BTC', 0);
      if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
        throw new Error('현재가를 확인할 수 없습니다. 차트 로딩 후 다시 시도하세요.');
      }
      const payload = await executeIntelShadowTradeApi({
        pair,
        timeframe,
        currentPrice,
        entry: currentPrice,
        refresh: true,
      });
      await hydrateQuickTrades(true);
      const dir = String(payload?.data?.dir ?? '').toUpperCase();
      shadowExecMessage = `${dir || 'TRADE'} 실행 완료 · ${pair} @ ${currentPrice.toLocaleString()}`;
      shadowExecError = '';
      await fetchIntelPolicy();
    } catch (error: unknown) {
      shadowExecError = error instanceof Error ? error.message : 'Shadow 실행 중 오류가 발생했습니다.';
      shadowExecMessage = '';
    } finally { shadowExecLoading = false; }
  }

  async function fetchLiveEvents() {
    try {
      const pair = $gameState.pair || 'BTC/USDT';
      const events = await fetchIntelEventsApi(pair);
      if (events && events.length > 0) {
        liveEvents = events;
        dataLoaded.events = true;
        dataLoaded = dataLoaded;
      }
    } catch { console.warn('[IntelPanel] Events API unavailable'); }
  }

  async function fetchLiveFlow() {
    try {
      const pair = $gameState.pair || 'BTC/USDT';
      const flowPayload = await fetchIntelFlowApi(pair);
      if (!flowPayload) return;
      const flows = mapIntelFlowPayloadToRows(flowPayload);
      if (flows.length > 0) {
        liveFlows = flows;
        dataLoaded.flow = true;
        dataLoaded = dataLoaded;
      }
    } catch { console.warn('[IntelPanel] Flow API unavailable'); }
  }

  async function fetchTrendingData() {
    if (dataLoaded.trending || trendLoading) return;
    trendLoading = true;
    try {
      const trendingPayload = await fetchIntelTrendingApi(15);
      if (trendingPayload) {
        trendingCoins = trendingPayload.trending ?? [];
        trendGainers = trendingPayload.gainers ?? [];
        trendLosers = trendingPayload.losers ?? [];
        trendDexHot = trendingPayload.dexHot ?? [];
        trendUpdatedAt = Number(trendingPayload.updatedAt ?? Date.now());
        dataLoaded.trending = true;
        dataLoaded = dataLoaded;
      }
    } catch { console.warn('[IntelPanel] Trending API unavailable'); }
    finally { trendLoading = false; }
  }

  async function fetchTopPicks() {
    if (picksLoaded || picksLoading) return;
    picksLoading = true;
    try {
      const opportunityPayload = await fetchIntelOpportunityScanApi(15);
      if (opportunityPayload) {
        topPicks = opportunityPayload.coins ?? [];
        opAlerts = opportunityPayload.alerts ?? [];
        macroRegime = opportunityPayload.macroBackdrop?.regime ?? '';
        picksScanTime = opportunityPayload.scanDurationMs ?? 0;
        picksLoaded = true;
      }
    } catch { console.warn('[IntelPanel] Opportunity scan unavailable'); }
    finally { picksLoading = false; }
  }

  // ═══ Pair change refetch ═══
  let _prevPair = '';
  let _pairRefetchTimer: ReturnType<typeof setTimeout> | null = null;
  $effect(() => {
    const pair = $gameState.pair || 'BTC/USDT';
    if (_prevPair && pair !== _prevPair) {
      if (_pairRefetchTimer) clearTimeout(_pairRefetchTimer);
      _pairRefetchTimer = setTimeout(() => {
        headlineOffset = 0;
        headlineHasMore = true;
        void Promise.allSettled([
          fetchIntelPolicy(),
          fetchLiveHeadlines(false),
          fetchLiveEvents(),
          fetchLiveFlow(),
        ]);
      }, 300);
    }
    _prevPair = pair;
  });

  // ═══ Lifecycle ═══
  onMount(() => {
    loadPolymarkets();
    hydrateCommunityPosts();
    void syncPositions(true);
    startPositionSyncLoop();

    void (async () => {
      activeTab = await loadInitialIntelPanelState({
        prioritizeChat,
        fetchUiState: fetchUiStateApi,
      });
      tabCollapsed = false;
    })();

    void Promise.allSettled([
      fetchIntelPolicy(),
      fetchLiveHeadlines(),
      fetchLiveEvents(),
      fetchLiveFlow(),
      fetchOnchainData(),
    ]);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      showDebugModel = params.get('debug') === '1' || params.get('debug') === 'true';
    }
    _onchainTimer = setInterval(() => void fetchOnchainData(), 120_000);
  });

  onDestroy(() => {
    if (_pairRefetchTimer) clearTimeout(_pairRefetchTimer);
    if (_onchainTimer) clearInterval(_onchainTimer);
    uiStateSaveQueue.dispose();
    positionSyncRuntime.stop();
  });
</script>

<div class="intel-panel">
  <!-- Main Tabs -->
  <div class="rp-tabs" role="tablist" tabindex="0" onkeydown={handleTabKeydown}>
    <button class="rp-tab" class:active={activeTab === 'chat'} onclick={() => setTab('chat')}
      role="tab" aria-selected={activeTab === 'chat'} aria-controls="intel-panel-chat"
      tabindex={activeTab === 'chat' ? 0 : -1}>CHAT</button>
    <button class="rp-tab" class:active={activeTab === 'feed'} onclick={() => setTab('feed')}
      role="tab" aria-selected={activeTab === 'feed'} aria-controls="intel-panel-feed"
      tabindex={activeTab === 'feed' ? 0 : -1}>FEED</button>
    <button class="rp-tab" class:active={activeTab === 'positions'} onclick={() => setTab('positions')}
      role="tab" aria-selected={activeTab === 'positions'} aria-controls="intel-panel-positions"
      tabindex={activeTab === 'positions' ? 0 : -1}>POSITIONS</button>
    <span class="rp-density-chip">{densityMode === 'essential' ? 'ESSENTIAL VIEW' : 'PRO VIEW'}</span>
    <button class="rp-collapse" onclick={() => tabCollapsed = !tabCollapsed} title={tabCollapsed ? 'Expand' : 'Collapse'}>
      {tabCollapsed ? '▲' : '▼'}
    </button>
    <button class="rp-panel-collapse" onclick={onCollapse} title="Collapse panel">
      <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="1" y="2" width="14" height="12" rx="1.5"/>
        <line x1="10" y1="2" x2="10" y2="14"/>
      </svg>
    </button>
  </div>

  {#if !tabCollapsed}
    <div class="rp-body-wrap" role="tabpanel" id="intel-panel-{activeTab}" aria-label="{activeTab} panel">
      {#if activeTab === 'chat'}
        <IntelChatSection
          {chatMessages}
          {isTyping}
          {chatTradeReady}
          {chatConnectionStatus}
          {policyDecision}
          {policyLoading}
          {shadowDecision}
          {shadowLoading}
          {shadowExecutionEnabled}
          {showDebugModel}
          onSendChat={(text) => onSendChat({ text })}
          {onGoToTrade}
          onExecuteShadow={executeShadowTrade}
        />

      {:else if activeTab === 'feed'}
        <div class="feed-chips">
          {#each feedFilterOptions as option (option.key)}
            <button class="feed-chip" class:active={feedFilter === option.key} onclick={() => setFeedFilter(option.key)}>{option.label}</button>
          {/each}
        </div>

        <div class="rp-body">
          {#if feedFilter === 'all' || feedFilter === 'news'}
            <IntelFeedNews
              {visibleHeadlines}
              {headlineLoading}
              {headlineHasMore}
              {headlineSortBy}
              {currentToken}
              {policyCardsForTab}
              {densityMode}
              onToggleSort={toggleHeadlineSort}
              onLoadMore={loadMoreHeadlines}
            />
          {/if}

          {#if feedFilter === 'all' || feedFilter === 'trending'}
            <IntelFeedTrending
              {trendSubTab}
              {trendTabOptions}
              {trendBasisText}
              {trendBasisCompactText}
              {trendUpdatedLabel}
              {densityMode}
              {picksLoading}
              {topPicks}
              {visibleTopPicks}
              {opAlerts}
              {macroRegime}
              {picksScanTime}
              {trendLoading}
              {visibleTrendingCoins}
              {visibleTrendGainers}
              {visibleTrendLosers}
              visibleDexHot={visibleDexHot}
              {dexChains}
              {dexChainFilter}
              onActivateTrendTab={activateTrendTab}
              onRescan={() => { picksLoaded = false; fetchTopPicks(); }}
              onSetDexChainFilter={(chain) => { dexChainFilter = chain; }}
            />
          {/if}

          {#if feedFilter === 'all' || feedFilter === 'flow' || feedFilter === 'events' || feedFilter === 'community'}
            <IntelFeedOnchain
              {onchainData}
              {onchainLoading}
              {liveFlows}
              {liveEvents}
              {feedFilter}
              {densityMode}
            />
          {/if}
        </div>

      {:else if activeTab === 'positions'}
        <IntelPositions
          {displayTrades}
          {displayGmxPositions}
          {displayPolymarketPositions}
          {displayOpenCount}
          {displayGmxCount}
          {displayPolymarketCount}
          {positionCount}
          {pendingCount}
          {positionsSyncStatus}
          {useDemoPositions}
          onClosePos={handleClosePos}
          onRefresh={() => void syncPositions(true)}
        />
      {/if}
    </div>
  {/if}
</div>

<style>
  .intel-panel { display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--blk); overflow: hidden; }

  .intel-panel :global(::-webkit-scrollbar) { width: 3px; height: 3px; }
  .intel-panel :global(::-webkit-scrollbar-thumb) { background: rgba(255,255,255,.1); border-radius: 3px; }
  .intel-panel :global(::-webkit-scrollbar-track) { background: transparent; }

  .rp-tabs { display: flex; border-bottom: 3px solid var(--yel); flex-shrink: 0; }
  .rp-tab {
    flex: 1; padding: 8px 3px;
    font-family: var(--fm); font-size: 11px; font-weight: 800; letter-spacing: 1.8px; text-align: center;
    background: none; border: none; cursor: pointer; transition: all .15s;
  }
  .rp-tab.active { background: rgba(var(--t-accent-rgb),0.15); color: var(--term-accent, #e8967d); }
  .rp-tab:not(.active) { color: rgba(255,255,255,.6); }
  .rp-tab:not(.active):hover { color: var(--yel); }
  .rp-tab:focus-visible { outline: 2px solid rgba(var(--t-accent-rgb), 0.7); outline-offset: -2px; }
  .rp-density-chip {
    margin-left: auto; align-self: center; margin-right: 4px;
    font: 700 8px/1 var(--fm); letter-spacing: .7px; color: rgba(255,255,255,.56);
    border: 1px solid rgba(255,255,255,.14); border-radius: 999px;
    background: rgba(255,255,255,.05); padding: 2px 6px; white-space: nowrap;
  }
  .rp-collapse {
    width: 28px; flex-shrink: 0;
    background: rgba(var(--t-accent-rgb),.08); border: none; border-left: 1px solid rgba(var(--t-accent-rgb),.15);
    color: var(--yel); font-size: 10px; cursor: pointer;
    display: flex; align-items: center; justify-content: center; transition: background .12s;
  }
  .rp-collapse:hover { background: rgba(var(--t-accent-rgb),.2); }
  .rp-panel-collapse {
    width: 24px; flex-shrink: 0;
    background: rgba(255,255,255,.03); border: none; border-left: 1px solid rgba(var(--t-accent-rgb),.1);
    color: rgba(var(--t-accent-rgb),.68); cursor: pointer;
    display: flex; align-items: center; justify-content: center; transition: all .12s; padding: 0;
  }
  .rp-panel-collapse:hover { background: rgba(var(--t-accent-rgb),.15); color: var(--yel); }

  .feed-chips {
    display: flex; gap: 4px; padding: 6px 8px; flex-shrink: 0;
    border-bottom: 1px solid rgba(var(--t-accent-rgb),.1);
    overflow-x: auto; scrollbar-width: none;
  }
  .feed-chips::-webkit-scrollbar { display: none; }
  .feed-chip {
    padding: 3px 10px; border-radius: 12px;
    font-family: var(--fm); font-size: 9px; font-weight: 700; letter-spacing: 0.8px;
    background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.1);
    color: rgba(255,255,255,.5); cursor: pointer; white-space: nowrap; transition: all .15s;
  }
  .feed-chip:hover { background: rgba(var(--t-accent-rgb),.06); color: rgba(255,255,255,.7); }
  .feed-chip.active { background: rgba(var(--t-accent-rgb),.12); color: var(--yel); border-color: rgba(var(--t-accent-rgb),.3); }

  .rp-body-wrap { flex: 1 1 auto; overflow: hidden; display: flex; flex-direction: column; min-height: 72px; }
  .rp-body {
    flex: 1; min-height: 0; overflow-y: auto; padding: 10px;
    display: flex; flex-direction: column; gap: 8px;
    scroll-behavior: smooth; -webkit-overflow-scrolling: touch;
    overscroll-behavior-y: contain; scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,.08) transparent; resize: none;
  }
  .rp-body::-webkit-scrollbar { width: 3px; }
  .rp-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 3px; }
  .rp-body::-webkit-scrollbar-track { background: transparent; }
</style>
