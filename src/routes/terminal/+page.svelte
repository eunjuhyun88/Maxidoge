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
  import { createTerminalSessionRuntime } from '$lib/terminal/terminalSessionRuntime';
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
    TerminalPanelResizeTarget,
    WarRoomHandle,
    ChartPanelHandle,
  } from '$lib/terminal/terminalTypes';

  import { gameState } from '$lib/stores/gameState';
  import { livePrice, livePrices } from '$lib/stores/priceStore';
  import { isCopyTradeOpen, copyTradeStore, prefillFromScan } from '$lib/stores/copyTradeStore';
  import { formatTimeframeLabel } from '$lib/utils/timeframe';
  import { alertEngine } from '$lib/services/alertEngine';
  import { onMount, onDestroy, tick } from 'svelte';

  // ── Page-level abort controller (cancels pending fetches on unmount) ──
  const _pageAbort = new AbortController();

  // Responsive breakpoints
  const BP_MOBILE = TERMINAL_BREAKPOINTS.mobile;
  const BP_TABLET = TERMINAL_BREAKPOINTS.tablet;

  // Mobile tab control
  const MAX_CHAT_MESSAGES = 200;
  const DENSITY_STORAGE_KEY = 'stockclaw:terminal:densityMode';
  const {
    viewportWidth,
    leftPanelWidth,
    rightPanelWidth,
    leftPanelCollapsed,
    rightPanelCollapsed,
    panelDragTarget,
    tabletIntelWidth,
    ...terminalLayoutRuntime
  } = createTerminalLayoutRuntime();

  // Responsive layout mode
  const isMobile = $derived($viewportWidth < BP_MOBILE);
  const isTablet = $derived($viewportWidth >= BP_MOBILE && $viewportWidth < BP_TABLET);
  const tabletLayoutStyle = $derived(`--tab-intel-width: ${$tabletIntelWidth}px;`);

  const gtmEvent = createTerminalGtmEmitter({
    component: 'terminal-shell',
    getViewport: () => isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop',
  });

  const {
    liveTicker,
    tickerLoaded,
    ...terminalShellRuntime
  } = createTerminalShellRuntime({
    getAbortSignal: () => _pageAbort.signal,
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
  const tickerText = $derived($tickerLoaded && $liveTicker ? $liveTicker : 'Loading market data...');
  const tickerSegments = $derived(tickerText.split(' | ').filter(Boolean));

  const {
    mobileTab,
    densityMode,
    ...terminalEngagementRuntime
  } = createTerminalEngagementRuntime({
    emitGtm: gtmEvent,
    getPair: () => $gameState.pair,
    getTimeframe: () => $gameState.timeframe,
    getIsMobile: () => isMobile,
    densityStorageKey: DENSITY_STORAGE_KEY,
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

  const densityLabel = $derived($densityMode === 'essential' ? 'ESSENTIAL' : 'PRO');
  const toggleDensityMode = () => terminalEngagementRuntime.toggleDensityMode();
  const setMobileTab = (tab: MobileTab) => terminalEngagementRuntime.setMobileTab(tab);

  $effect(() => {
    isMobile;
    $mobileTab;
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
  const {
    isTyping,
    latestScan,
    terminalScanning,
    scanStale,
    chatTradeReady,
    chatSuggestedDir,
    activeTradeSetup,
    chatConnectionStatus,
    ...terminalSessionRuntime
  } = createTerminalSessionRuntime();
  const {
    chatMessages,
    chatFocusKey,
    ...terminalMessageRuntime
  } = createTerminalMessageRuntime({
    initialChatMessages: buildInitialTerminalChatMessages(),
    maxChatMessages: MAX_CHAT_MESSAGES,
  });
  const terminalDecisionState = $derived(deriveTerminalDecisionState({
    terminalScanning: terminalSessionRuntime.getTerminalScanning(),
    latestScan: terminalSessionRuntime.getLatestScan(),
    chatTradeReady: terminalSessionRuntime.getChatTradeReady(),
    chatSuggestedDir: terminalSessionRuntime.getChatSuggestedDir(),
    scanStale: terminalSessionRuntime.getScanStale(),
  }));

  // Mark scan as stale when pair or timeframe changes after a scan
  let lastScanPair = $state('');
  let lastScanTf = $state('');
  $effect(() => {
    const scan = $latestScan;
    if (scan) {
      lastScanPair = scan.pair;
      lastScanTf = scan.timeframe ?? '';
    }
  });
  $effect(() => {
    const currentPair = $gameState.pair;
    const currentTf = $gameState.timeframe;
    if (lastScanPair && lastScanTf) {
      const pairChanged = currentPair !== lastScanPair;
      const tfChanged = currentTf !== lastScanTf;
      if (pairChanged || tfChanged) {
        terminalSessionRuntime.setScanStale(true);
      }
    }
  });

  $effect(() => {
    $chatMessages;
    terminalMessageRuntime.trimChatMessages();
  });

  const terminalControlBarProps = $derived(buildTerminalControlBarProps({
    pair,
    timeframeLabel,
    densityLabel,
    decisionState: terminalDecisionState,
    onPrimaryAction: () => {
      void terminalActionRuntime.handleDecisionPrimaryAction({
        terminalScanning: $terminalScanning,
        hasLatestScan: !!$latestScan,
      });
    },
    onToggleDensity: toggleDensityMode,
  }));

  const sharedChartPanelProps = $derived(buildSharedChartPanelProps({
    chatTradeReady: terminalSessionRuntime.getChatTradeReady(),
    chatSuggestedDir: terminalSessionRuntime.getChatSuggestedDir(),
    activeTradeSetup: terminalSessionRuntime.getActiveTradeSetup(),
    latestScan: terminalSessionRuntime.getLatestScan(),
  }));

  const sharedIntelPanelProps = $derived(buildSharedIntelPanelProps({
    densityMode: $densityMode,
    chatMessages: $chatMessages,
    isTyping: $isTyping,
    chatTradeReady: terminalSessionRuntime.getChatTradeReady(),
    chatFocusKey: $chatFocusKey,
    chatConnectionStatus: $chatConnectionStatus,
  }));

  const terminalActionRuntime = createTerminalActionRuntime({
    emitGtm: gtmEvent,
    getPair: () => $gameState.pair || 'BTC/USDT',
    getTimeframe: () => $gameState.timeframe || '4h',
    getViewport: () => isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop',
    getMobileTab: () => $mobileTab,
    setMobileTab,
    isLeftCollapsed: () => $leftPanelCollapsed,
    toggleLeft,
    isRightCollapsed: () => $rightPanelCollapsed,
    toggleRight,
    tryTriggerWarRoomScan: terminalPanelRuntime.tryTriggerWarRoomScan,
    hasPendingChartScan: terminalPanelRuntime.hasPendingChartScan,
    setPendingChartScan: terminalPanelRuntime.setPendingChartScan,
    getActiveChartPanel: terminalPanelRuntime.getActiveChartPanel,
    waitForUi: tick,
    appendChatMessage: terminalMessageRuntime.appendChatMessage,
    focusChatInput: terminalMessageRuntime.focusChatInput,
    getChatTradeReady: terminalSessionRuntime.getChatTradeReady,
    getChatSuggestedDir: terminalSessionRuntime.getChatSuggestedDir,
  });

  const terminalChatRuntime = createTerminalChatRuntime({
    emitGtm: gtmEvent,
    getPair: () => $gameState.pair || 'BTC/USDT',
    getTimeframe: () => $gameState.timeframe || '4h',
    getLivePrices: () => ({ ...$livePrices }),
    getLatestScan: terminalSessionRuntime.getLatestScan,
    getChatSuggestedDir: terminalSessionRuntime.getChatSuggestedDir,
    setChatSuggestedDir: terminalSessionRuntime.setChatSuggestedDir,
    setChatTradeReady: terminalSessionRuntime.setChatTradeReady,
    setChatConnectionStatus: terminalSessionRuntime.setChatConnectionStatus,
    setIsTyping: terminalSessionRuntime.setIsTyping,
    appendChatMessage: terminalMessageRuntime.appendChatMessage,
    triggerPatternScanFromChat: (source, time) => terminalActionRuntime.triggerPatternScanFromChat(source, time),
    getAbortSignal: () => AbortSignal.any([AbortSignal.timeout(20000), _pageAbort.signal]),
  });

  const {
    shareModalOpen,
    sharePrefill,
    ...terminalCommunityRuntime
  } = createTerminalCommunityRuntime({
    getTimeframeLabel: () => timeframeLabel,
    getCurrentPair: () => $gameState.pair || 'BTC/USDT',
    getLivePrice: (p) => {
      const base = (p.split('/')[0] || 'BTC').toUpperCase();
      return $livePrices[base] ?? 0;
    },
  });

  const terminalScanRuntime = createTerminalScanRuntime({
    setTerminalScanning: terminalSessionRuntime.setTerminalScanning,
    setLatestScan: terminalSessionRuntime.setLatestScan,
    setActiveTradeSetup: terminalSessionRuntime.setActiveTradeSetup,
    setChatSuggestedDir: terminalSessionRuntime.setChatSuggestedDir,
    setChatTradeReady: terminalSessionRuntime.setChatTradeReady,
    appendChatMessages: terminalMessageRuntime.appendChatMessages,
  });

  const handleIntelGoTrade = () => {
    void terminalActionRuntime.triggerTradePlanFromChat('intel-panel');
  };

  const handleCopyTradeFromVerdict = () => {
    const scan = terminalSessionRuntime.getLatestScan();
    if (!scan) return;
    prefillFromScan(scan);
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
      densityMode={$densityMode}
      {sharedChartPanelProps}
      {sharedIntelPanelProps}
      mobileTab={$mobileTab}
      latestScan={$latestScan}
      terminalScanning={$terminalScanning}
      scanStale={$scanStale}
      onCopyTrade={handleCopyTradeFromVerdict}
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
      chatMessages={$chatMessages}
      isTyping={$isTyping}
    />
  {:else if isTablet}
    <TerminalTabletLayout
      bind:warRoomRef
      bind:chartRef={tabletChartRef}
      densityMode={$densityMode}
      {tabletLayoutStyle}
      {terminalControlBarProps}
      {sharedChartPanelProps}
      {sharedIntelPanelProps}
      latestScan={$latestScan}
      terminalScanning={$terminalScanning}
      scanStale={$scanStale}
      onCopyTrade={handleCopyTradeFromVerdict}
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
      densityMode={$densityMode}
      leftCollapsed={$leftPanelCollapsed}
      rightCollapsed={$rightPanelCollapsed}
      leftW={$leftPanelWidth}
      rightW={$rightPanelWidth}
      dragTarget={$panelDragTarget}
      {terminalControlBarProps}
      {sharedChartPanelProps}
      {sharedIntelPanelProps}
      latestScan={$latestScan}
      terminalScanning={$terminalScanning}
      scanStale={$scanStale}
      onCopyTrade={handleCopyTradeFromVerdict}
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
  show={$shareModalOpen}
  prefill={$sharePrefill}
  livePrices={$livePrice}
  onClose={terminalCommunityRuntime.closeShareModal}
  onPosted={(attachment) => {
    terminalCommunityRuntime.handlePostCompleted(attachment);
    goto('/signals');
  }}
/>
