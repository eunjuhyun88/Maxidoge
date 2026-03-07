<script lang="ts">
  import '../../components/terminal/terminalShell.css';
  import { goto } from '$app/navigation';
  import CopyTradeModalHost from '../../components/terminal/CopyTradeModalHost.svelte';
  import TerminalMobileLayout from '../../components/terminal/TerminalMobileLayout.svelte';
  import TerminalShareModalHost from '../../components/terminal/TerminalShareModalHost.svelte';
  import TerminalTabletLayout from '../../components/terminal/TerminalTabletLayout.svelte';
  import TerminalDesktopLayout from '../../components/terminal/TerminalDesktopLayout.svelte';
  import { buildInitialTerminalChatMessages } from '$lib/terminal/terminalChatSeed';
  import { createTerminalActionRuntime } from '$lib/terminal/terminalActionRuntime';
  import { createTerminalChatRuntime } from '$lib/terminal/terminalChatRuntime';
  import { createTerminalCommunityRuntime } from '$lib/terminal/terminalCommunityRuntime';
  import {
    createTerminalEngagementRuntime,
    readTerminalDensityMode,
  } from '$lib/terminal/terminalEngagementRuntime';
  import { createTerminalLayoutRuntime } from '$lib/terminal/terminalLayoutRuntime';
  import {
    type MobileTab,
    TERMINAL_BREAKPOINTS,
  } from '$lib/terminal/terminalHelpers';
  import {
    createTerminalGtmEmitter,
    createTerminalShellRuntime,
  } from '$lib/terminal/terminalShellRuntime';
  import { createTerminalMessageRuntime } from '$lib/terminal/terminalMessageRuntime';
  import { createTerminalPanelRuntime } from '$lib/terminal/terminalPanelRuntime';
  import { createTerminalScanRuntime } from '$lib/terminal/terminalScanRuntime';
  import {
    buildSharedChartPanelProps,
    buildSharedIntelPanelProps,
    buildTerminalControlBarProps,
    deriveTerminalDecisionState,
    tickerSegmentClass,
  } from '$lib/terminal/terminalViewModel';
  import type {
    DragTarget,
    ChatMsg,
    ScanIntelDetail,
    AgentTradeSetup,
    ChartCommunitySignal,
    ChatTradeDirection,
    TerminalChatConnectionStatus,
    TerminalDensityMode,
    TerminalPanelResizeTarget,
    TerminalSharePrefill,
    WarRoomHandle,
    ChartPanelHandle,
  } from '$lib/terminal/terminalTypes';

  let liveTickerStr = $state('');
  let tickerLoaded = $state(false);
  let showShareModal = $state(false);
  let sharePrefill: TerminalSharePrefill | null = $state(null);
  const tickerText = $derived(tickerLoaded && liveTickerStr ? liveTickerStr : 'Loading market data...');
  const tickerSegments = $derived(tickerText.split(' | ').filter(Boolean));
  import { gameState } from '$lib/stores/gameState';
  import { livePrice, livePrices } from '$lib/stores/priceStore';
  import { openTradeCount } from '$lib/stores/quickTradeStore';
  import { activeSignalCount } from '$lib/stores/trackedSignalStore';
  import { isCopyTradeOpen, copyTradeStore } from '$lib/stores/copyTradeStore';
  import { formatTimeframeLabel } from '$lib/utils/timeframe';
  import { alertEngine } from '$lib/services/alertEngine';
  import { onMount, onDestroy, tick } from 'svelte';

  // ── Page-level abort controller (cancels pending fetches on unmount) ──
  const _pageAbort = new AbortController();

  // ── Panel resize state (chart-centric: maximize chart area) ──
  let leftW = $state(272);       // War Room width — compact to prioritize chart
  let rightW = $state(288);      // Intel Panel width — compact to prioritize chart
  let windowWidth = $state(1200);

  let leftCollapsed = $state(false);
  let rightCollapsed = $state(false);
  let savedLeftW = $state(308);
  let savedRightW = $state(332);

  // Responsive breakpoints
  const BP_MOBILE = TERMINAL_BREAKPOINTS.mobile;
  const BP_TABLET = TERMINAL_BREAKPOINTS.tablet;

  let dragTarget: DragTarget = $state(null);

  // Responsive layout mode
  const isMobile = $derived(windowWidth < BP_MOBILE);
  const isTablet = $derived(windowWidth >= BP_MOBILE && windowWidth < BP_TABLET);

  // Mobile tab control
  let mobileTab: MobileTab = $state('chart');
  const MAX_CHAT_MESSAGES = 200;
  const DENSITY_STORAGE_KEY = 'stockclaw:terminal:densityMode';
  let densityMode: TerminalDensityMode = $state(readTerminalDensityMode(DENSITY_STORAGE_KEY));
  let tabletIntelWidth = $state(320);    // new: intel panel width for horizontal split
  const tabletLayoutStyle = $derived(`--tab-intel-width: ${tabletIntelWidth}px;`);

  const gtmEvent = createTerminalGtmEmitter({
    component: 'terminal-shell',
    getViewport: () => isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop',
  });

  const terminalShellRuntime = createTerminalShellRuntime({
    getAbortSignal: () => _pageAbort.signal,
    setLiveTicker: (ticker) => {
      liveTickerStr = ticker;
    },
    setTickerLoaded: (loaded) => {
      tickerLoaded = loaded;
    },
    startAlertEngine: () => {
      alertEngine.start();
    },
    stopAlertEngine: () => {
      alertEngine.stop();
    },
    openCopyTradeDraft: (draft) => {
      copyTradeStore.openFromSignal(draft);
    },
    warn: (message) => {
      console.warn(message);
    },
  });

  const terminalEngagementRuntime = createTerminalEngagementRuntime({
    emitGtm: gtmEvent,
    getPair: () => $gameState.pair,
    getTimeframe: () => $gameState.timeframe,
    getIsMobile: () => isMobile,
    getMobileTab: () => mobileTab,
    setMobileTab: (tab) => {
      mobileTab = tab;
    },
    getDensityMode: () => densityMode,
    setDensityMode: (mode) => {
      densityMode = mode;
    },
    densityStorageKey: DENSITY_STORAGE_KEY,
  });

  const terminalLayoutRuntime = createTerminalLayoutRuntime({
    getViewport: () => isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop',
    getWindowWidth: () => windowWidth,
    setWindowWidth: (width) => {
      windowWidth = width;
    },
    getLeftWidth: () => leftW,
    setLeftWidth: (width) => {
      leftW = width;
    },
    getRightWidth: () => rightW,
    setRightWidth: (width) => {
      rightW = width;
    },
    getSavedLeftWidth: () => savedLeftW,
    setSavedLeftWidth: (width) => {
      savedLeftW = width;
    },
    getSavedRightWidth: () => savedRightW,
    setSavedRightWidth: (width) => {
      savedRightW = width;
    },
    getLeftCollapsed: () => leftCollapsed,
    setLeftCollapsed: (collapsed) => {
      leftCollapsed = collapsed;
    },
    getRightCollapsed: () => rightCollapsed,
    setRightCollapsed: (collapsed) => {
      rightCollapsed = collapsed;
    },
    setDragTarget: (target) => {
      dragTarget = target;
    },
    getTabletIntelWidth: () => tabletIntelWidth,
    setTabletIntelWidth: (width) => {
      tabletIntelWidth = width;
    },
  });

  const toggleLeft = () => terminalLayoutRuntime.toggleLeft();
  const toggleRight = () => terminalLayoutRuntime.toggleRight();
  const startDrag = (target: DragTarget, event: MouseEvent) => terminalLayoutRuntime.startDesktopDrag(target, event);
  const resizePanelByWheel = (
    target: TerminalPanelResizeTarget,
    event: WheelEvent,
    options?: { force?: boolean },
  ) => terminalLayoutRuntime.resizeDesktopPanelsByWheel(target, event, options);
  const startTabletIntelDrag = (event: PointerEvent) => terminalLayoutRuntime.startTabletIntelDrag(event);
  const resizeTabletIntelByWheel = (event: WheelEvent) => terminalLayoutRuntime.resizeTabletIntelByWheel(event);
  const resetTabletIntelWidth = () => terminalLayoutRuntime.resetTabletIntelWidth();

  const densityLabel = $derived(densityMode === 'essential' ? 'ESSENTIAL' : 'PRO');
  const toggleDensityMode = () => terminalEngagementRuntime.toggleDensityMode();
  const setMobileTab = (tab: MobileTab) => terminalEngagementRuntime.setMobileTab(tab);

  $effect(() => {
    isMobile;
    mobileTab;
    $gameState.pair;
    $gameState.timeframe;
    terminalEngagementRuntime.syncMobileViewportTracking();
  });

  onMount(() => {
    terminalLayoutRuntime.mount();
    terminalShellRuntime.mount();
  });

  onDestroy(() => {
    _pageAbort.abort();
    terminalLayoutRuntime.destroy();
    terminalShellRuntime.destroy();
  });

  // Selected pair display
  const pair = $derived($gameState.pair || 'BTC/USDT');
  const timeframeLabel = $derived(formatTimeframeLabel($gameState.timeframe));
  const mobileOpenTrades = $derived($openTradeCount);
  const mobileTrackedSignals = $derived($activeSignalCount);

  let warRoomRef: WarRoomHandle | null = $state(null);
  let mobileChartRef: ChartPanelHandle | null = $state(null);
  let tabletChartRef: ChartPanelHandle | null = $state(null);
  let desktopChartRef: ChartPanelHandle | null = $state(null);
  let pendingChartScan = $state(false);

  const terminalPanelRuntime = createTerminalPanelRuntime({
    getViewport: () => isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop',
    getWarRoomRef: () => warRoomRef,
    getMobileChartRef: () => mobileChartRef,
    getTabletChartRef: () => tabletChartRef,
    getDesktopChartRef: () => desktopChartRef,
    hasPendingChartScan: () => pendingChartScan,
    setPendingChartScan: (pending) => {
      pendingChartScan = pending;
    },
  });

  $effect(() => {
    pendingChartScan;
    warRoomRef;
    terminalPanelRuntime.flushPendingChartScan();
  });
  let chatMessages: ChatMsg[] = $state(buildInitialTerminalChatMessages());
  let isTyping = $state(false);
  let latestScan: ScanIntelDetail | null = $state(null);
  let terminalScanning = $state(false);
  let chatTradeReady = $state(false);
  let chatSuggestedDir: ChatTradeDirection = $state('LONG');
  let chatFocusKey = $state(0);
  let activeTradeSetup: AgentTradeSetup | null = $state(null);
  const terminalMessageRuntime = createTerminalMessageRuntime({
    getChatMessages: () => chatMessages,
    setChatMessages: (messages) => {
      chatMessages = messages;
    },
    maxChatMessages: MAX_CHAT_MESSAGES,
    bumpChatFocusKey: () => {
      chatFocusKey += 1;
    },
  });
  const terminalDecisionState = $derived(deriveTerminalDecisionState({
    terminalScanning,
    latestScan,
    chatTradeReady,
    chatSuggestedDir,
  }));
  $effect(() => {
    chatMessages;
    terminalMessageRuntime.trimChatMessages();
  });

  const terminalControlBarProps = $derived(buildTerminalControlBarProps({
    pair,
    timeframeLabel,
    densityLabel,
    decisionState: terminalDecisionState,
    onPrimaryAction: () => {
      void terminalActionRuntime.handleDecisionPrimaryAction({
        terminalScanning,
        hasLatestScan: !!latestScan,
      });
    },
    onToggleDensity: toggleDensityMode,
  }));

  const sharedChartPanelProps = $derived(buildSharedChartPanelProps({
    chatTradeReady,
    chatSuggestedDir,
    activeTradeSetup,
    latestScan,
  }));

  // Chat connection status for UI dot indicator
  let chatConnectionStatus: TerminalChatConnectionStatus = $state('connected');

  const sharedIntelPanelProps = $derived(buildSharedIntelPanelProps({
    densityMode,
    chatMessages,
    isTyping,
    chatTradeReady,
    chatFocusKey,
    chatConnectionStatus,
  }));

  const terminalActionRuntime = createTerminalActionRuntime({
    emitGtm: gtmEvent,
    getPair: () => $gameState.pair || 'BTC/USDT',
    getTimeframe: () => $gameState.timeframe || '4h',
    getViewport: () => isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop',
    getMobileTab: () => mobileTab,
    setMobileTab,
    isLeftCollapsed: () => leftCollapsed,
    toggleLeft,
    isRightCollapsed: () => rightCollapsed,
    toggleRight,
    tryTriggerWarRoomScan: terminalPanelRuntime.tryTriggerWarRoomScan,
    hasPendingChartScan: terminalPanelRuntime.hasPendingChartScan,
    setPendingChartScan: terminalPanelRuntime.setPendingChartScan,
    getActiveChartPanel: terminalPanelRuntime.getActiveChartPanel,
    waitForUi: tick,
    appendChatMessage: terminalMessageRuntime.appendChatMessage,
    focusChatInput: terminalMessageRuntime.focusChatInput,
    getChatTradeReady: () => chatTradeReady,
    getChatSuggestedDir: () => chatSuggestedDir,
  });

  const terminalChatRuntime = createTerminalChatRuntime({
    emitGtm: gtmEvent,
    getPair: () => $gameState.pair || 'BTC/USDT',
    getTimeframe: () => $gameState.timeframe || '4h',
    getLivePrices: () => ({ ...$livePrices }),
    getLatestScan: () => latestScan,
    getChatSuggestedDir: () => chatSuggestedDir,
    setChatSuggestedDir: (dir) => {
      chatSuggestedDir = dir;
    },
    setChatTradeReady: (ready) => {
      chatTradeReady = ready;
    },
    setChatConnectionStatus: (status) => {
      chatConnectionStatus = status;
    },
    setIsTyping: (typing) => {
      isTyping = typing;
    },
    appendChatMessage: terminalMessageRuntime.appendChatMessage,
    triggerPatternScanFromChat: (source, time) => terminalActionRuntime.triggerPatternScanFromChat(source, time),
    getAbortSignal: () => AbortSignal.any([AbortSignal.timeout(20000), _pageAbort.signal]),
  });

  const terminalCommunityRuntime = createTerminalCommunityRuntime({
    getTimeframeLabel: () => timeframeLabel,
    setShareModalOpen: (open) => {
      showShareModal = open;
    },
    setSharePrefill: (prefill) => {
      sharePrefill = prefill;
    },
    getCurrentPair: () => $gameState.pair || 'BTC/USDT',
    getLivePrice: (p) => {
      const base = (p.split('/')[0] || 'BTC').toUpperCase();
      return $livePrices[base] ?? 0;
    },
  });

  const terminalScanRuntime = createTerminalScanRuntime({
    setTerminalScanning: (scanning) => {
      terminalScanning = scanning;
    },
    setLatestScan: (detail) => {
      latestScan = detail;
    },
    setActiveTradeSetup: (setup) => {
      activeTradeSetup = setup;
    },
    setChatSuggestedDir: (dir) => {
      chatSuggestedDir = dir;
    },
    setChatTradeReady: (ready) => {
      chatTradeReady = ready;
    },
    appendChatMessages: terminalMessageRuntime.appendChatMessages,
  });

  const handleIntelGoTrade = () => {
    void terminalActionRuntime.triggerTradePlanFromChat('intel-panel');
  };
</script>

<div class="terminal-shell">
  <div class="term-stars" aria-hidden="true"></div>
  <div class="term-stars term-stars-soft" aria-hidden="true"></div>
  <div class="term-grain" aria-hidden="true"></div>

  {#if isMobile}
    <TerminalMobileLayout
      bind:warRoomRef
      bind:chartRef={mobileChartRef}
      {densityMode}
      {sharedChartPanelProps}
      {sharedIntelPanelProps}
      {mobileTab}
      {mobileOpenTrades}
      {mobileTrackedSignals}
      {latestScan}
      {terminalScanning}
      onSetMobileTab={setMobileTab}
      onScanStart={terminalScanRuntime.handleScanStart}
      onScanComplete={terminalScanRuntime.handleScanComplete}
      onShowOnChart={terminalScanRuntime.handleShowOnChart}
      onChartScanRequest={terminalActionRuntime.handleChartScanRequest}
      onChartChatRequest={terminalActionRuntime.handleChartChatRequest}
      onChartCommunitySignal={terminalCommunityRuntime.handleChartCommunitySignal}
      onClearTradeSetup={terminalScanRuntime.clearActiveTradeSetup}
      onSendChat={terminalChatRuntime.handleSendChat}
      onGoToTrade={handleIntelGoTrade}
      onShareToCommunity={terminalCommunityRuntime.openShareModal}
      {chatMessages}
      {isTyping}
    />
  {:else if isTablet}
    <TerminalTabletLayout
      bind:warRoomRef
      bind:chartRef={tabletChartRef}
      {densityMode}
      {tabletLayoutStyle}
      {terminalControlBarProps}
      {sharedChartPanelProps}
      {sharedIntelPanelProps}
      {latestScan}
      {terminalScanning}
      {tickerSegments}
      {tickerSegmentClass}
      onScanStart={terminalScanRuntime.handleScanStart}
      onScanComplete={terminalScanRuntime.handleScanComplete}
      onShowOnChart={terminalScanRuntime.handleShowOnChart}
      onChartScanRequest={terminalActionRuntime.handleChartScanRequest}
      onChartChatRequest={terminalActionRuntime.handleChartChatRequest}
      onChartCommunitySignal={terminalCommunityRuntime.handleChartCommunitySignal}
      onClearTradeSetup={terminalScanRuntime.clearActiveTradeSetup}
      onSendChat={terminalChatRuntime.handleSendChat}
      onGoToTrade={handleIntelGoTrade}
      onResizeIntelByWheel={resizeTabletIntelByWheel}
      onStartIntelDrag={startTabletIntelDrag}
      onResetIntelWidth={resetTabletIntelWidth}
      onShareToCommunity={terminalCommunityRuntime.openShareModal}
    />
  {:else}
    <TerminalDesktopLayout
      bind:warRoomRef
      bind:chartRef={desktopChartRef}
      {densityMode}
      {leftCollapsed}
      {rightCollapsed}
      {leftW}
      {rightW}
      {dragTarget}
      {terminalControlBarProps}
      {sharedChartPanelProps}
      {sharedIntelPanelProps}
      {latestScan}
      {terminalScanning}
      {tickerSegments}
      {tickerSegmentClass}
      onToggleLeft={toggleLeft}
      onToggleRight={toggleRight}
      onScanStart={terminalScanRuntime.handleScanStart}
      onScanComplete={terminalScanRuntime.handleScanComplete}
      onShowOnChart={terminalScanRuntime.handleShowOnChart}
      onChartScanRequest={terminalActionRuntime.handleChartScanRequest}
      onChartChatRequest={terminalActionRuntime.handleChartChatRequest}
      onChartCommunitySignal={terminalCommunityRuntime.handleChartCommunitySignal}
      onClearTradeSetup={terminalScanRuntime.clearActiveTradeSetup}
      onSendChat={terminalChatRuntime.handleSendChat}
      onGoToTrade={handleIntelGoTrade}
      onStartDrag={startDrag}
      onResizePanelByWheel={resizePanelByWheel}
      onShareToCommunity={terminalCommunityRuntime.openShareModal}
    />
  {/if}
</div>

<CopyTradeModalHost isOpen={$isCopyTradeOpen} />

<TerminalShareModalHost
  show={showShareModal}
  prefill={sharePrefill}
  livePrices={$livePrice}
  onClose={terminalCommunityRuntime.closeShareModal}
  onPosted={(attachment) => {
    terminalCommunityRuntime.handlePostCompleted(attachment);
    goto('/signals');
  }}
/>
