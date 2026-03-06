<script lang="ts">
  import '../../components/terminal/terminalShell.css';
  import TerminalMobileLayout from '../../components/terminal/TerminalMobileLayout.svelte';
  import TerminalTabletLayout from '../../components/terminal/TerminalTabletLayout.svelte';
  import TerminalDesktopLayout from '../../components/terminal/TerminalDesktopLayout.svelte';
  import CopyTradeModal from '../../components/modals/CopyTradeModal.svelte';
  import {
    type MobileTab,
    buildAgentMeta,
    detectMentionedAgent as detectMentionedAgentLocal,
    inferSuggestedDirection,
    isPatternScanIntent,
    patternKindLabel,
    patternStatusLabel,
    formatPatternChatReply,
    TERMINAL_BREAKPOINTS,
    TABLET_SPLIT_LIMITS,
    getDefaultTabletLeftWidth,
    getDefaultTabletBottomHeight,
    clampTabletLeftWidth,
    clampTabletBottomHeight,
    wheelAxisDelta,
    isHorizontalResizeGesture,
  } from '../../components/terminal/terminalHelpers';
  import {
    buildOfflineAgentReply,
    buildSharedChartPanelProps,
    buildSharedIntelPanelProps,
    buildTerminalControlBarProps,
    deriveTerminalDecisionState,
    tickerSegmentClass,
    type TerminalDecisionState,
  } from '../../components/terminal/terminalViewModel';
  import type {
    DragTarget,
    TabletSplitResizeAxis,
    TabletSplitResizeState,
    ChatMsg,
    ScanIntelDetail,
    AgentTradeSetup,
    ChartCommunitySignal,
    ChatTradeDirection,
    WarRoomHandle,
    ChartPanelHandle,
    TerminalControlBarProps,
    SharedChartPanelProps,
    SharedIntelPanelProps,
  } from './terminalTypes';

  let liveTickerStr = $state('');
  let tickerLoaded = $state(false);
  const tickerText = $derived(tickerLoaded && liveTickerStr ? liveTickerStr : 'Loading market data...');
  const tickerSegments = $derived(tickerText.split(' | ').filter(Boolean));
  import { gameState } from '$lib/stores/gameState';
  import { livePrices } from '$lib/stores/priceStore';
  import { openTradeCount } from '$lib/stores/quickTradeStore';
  import { activeSignalCount, trackSignal } from '$lib/stores/trackedSignalStore';
  import { copyTradeStore } from '$lib/stores/copyTradeStore';
  import { addCommunityPost } from '$lib/stores/communityStore';
  import { incrementTrackedSignals } from '$lib/stores/userProfileStore';
  import { notifySignalTracked } from '$lib/stores/notificationStore';
  import { formatTimeframeLabel } from '$lib/utils/timeframe';
  import { alertEngine } from '$lib/services/alertEngine';
  import { onMount, onDestroy, tick } from 'svelte';

  // ── Page-level abort controller (cancels pending fetches on unmount) ──
  const _pageAbort = new AbortController();

  // ── Panel resize state ──
  let leftW = $state(308);       // War Room width
  let rightW = $state(332);      // Intel Panel width
  let windowWidth = $state(1200);

  const MIN_LEFT = 240;
  const MAX_LEFT = 450;
  const MIN_RIGHT = 260;
  const MAX_RIGHT = 500;

  // Collapse state
  let leftCollapsed = $state(false);
  let rightCollapsed = $state(false);
  let savedLeftW = $state(308);
  let savedRightW = $state(332);

  function toggleLeft() {
    if (leftCollapsed) {
      leftW = savedLeftW;
      leftCollapsed = false;
    } else {
      savedLeftW = leftW;
      leftW = 0;
      leftCollapsed = true;
    }
  }
  function toggleRight() {
    if (rightCollapsed) {
      rightW = savedRightW;
      rightCollapsed = false;
    } else {
      savedRightW = rightW;
      rightW = 0;
      rightCollapsed = true;
    }
  }

  // Responsive breakpoints
  const BP_MOBILE = TERMINAL_BREAKPOINTS.mobile;
  const BP_TABLET = TERMINAL_BREAKPOINTS.tablet;

  let dragTarget: DragTarget = $state(null);
  let dragStartX = $state(0);
  let dragStartVal = $state(0);

  // Responsive layout mode
  const isMobile = $derived(windowWidth < BP_MOBILE);
  const isTablet = $derived(windowWidth >= BP_MOBILE && windowWidth < BP_TABLET);
  const isDesktop = $derived(windowWidth >= BP_TABLET);

  // Mobile tab control
  let mobileTab: MobileTab = $state('chart');
  const MAX_CHAT_MESSAGES = 200;
  const DENSITY_STORAGE_KEY = 'stockclaw:terminal:densityMode';
  let densityMode: 'essential' | 'pro' = $state((typeof localStorage !== 'undefined' && localStorage.getItem(DENSITY_STORAGE_KEY) === 'pro') ? 'pro' : 'essential');
  let mobileViewTracked = $state(false);
  let mobileNavTracked = $state(false);
  const TABLET_SPLIT_STEP = TABLET_SPLIT_LIMITS.step;
  let tabletLeftWidth = $state(232);
  let tabletBottomHeight = $state(260);
  const tabletLayoutStyle = $derived(`--tab-left-width: ${tabletLeftWidth}px; --tab-bottom-height: ${tabletBottomHeight}px;`);
  let tabletSplitResizeState: TabletSplitResizeState | null = $state(null);

  function viewportWidth() {
    return typeof window === 'undefined' ? undefined : window.innerWidth;
  }

  function viewportHeight() {
    return typeof window === 'undefined' ? undefined : window.innerHeight;
  }

  function applyTabletSplitDelta(axis: TabletSplitResizeAxis, signedDelta: number) {
    if (axis === 'x') {
      tabletLeftWidth = clampTabletLeftWidth(tabletLeftWidth + signedDelta, viewportWidth());
      return;
    }
    tabletBottomHeight = clampTabletBottomHeight(tabletBottomHeight + signedDelta, viewportHeight());
  }

  function startTabletSplitDrag(axis: TabletSplitResizeAxis, e: PointerEvent) {
    if (!isTablet) return;
    const source = e.currentTarget as HTMLElement | null;
    source?.setPointerCapture?.(e.pointerId);
    tabletSplitResizeState = {
      axis,
      pointerId: e.pointerId,
      startClient: axis === 'x' ? e.clientX : e.clientY,
      startValue: axis === 'x' ? tabletLeftWidth : tabletBottomHeight,
    };
    e.preventDefault();
    document.body.style.cursor = axis === 'x' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  }

  function onTabletSplitPointerMove(e: PointerEvent) {
    const state = tabletSplitResizeState;
    if (!state || e.pointerId !== state.pointerId) return;
    const currentClient = state.axis === 'x' ? e.clientX : e.clientY;
    const delta = currentClient - state.startClient;
    if (state.axis === 'x') {
      tabletLeftWidth = clampTabletLeftWidth(state.startValue + delta, viewportWidth());
    } else {
      // Separator up => bottom panel grows, separator down => bottom panel shrinks.
      tabletBottomHeight = clampTabletBottomHeight(state.startValue - delta, viewportHeight());
    }
    e.preventDefault();
  }

  function finishTabletSplitDrag(e?: PointerEvent) {
    if (!tabletSplitResizeState) return;
    if (e && e.pointerId !== tabletSplitResizeState.pointerId) return;
    tabletSplitResizeState = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }

  function resizeTabletSplitByWheel(axis: TabletSplitResizeAxis, e: WheelEvent) {
    if (!isTablet) return;
    const rawDelta = wheelAxisDelta(axis, e);
    if (rawDelta == null) return;

    const step = e.shiftKey ? TABLET_SPLIT_STEP + 8 : TABLET_SPLIT_STEP;
    const signed = rawDelta > 0 ? step : -step;
    e.preventDefault();
    e.stopPropagation();

    applyTabletSplitDelta(axis, signed);
  }

  function resetTabletSplit(axis: TabletSplitResizeAxis) {
    if (axis === 'y') {
      tabletBottomHeight = getDefaultTabletBottomHeight(viewportHeight());
      return;
    }
    tabletLeftWidth = getDefaultTabletLeftWidth(viewportWidth());
  }

  function gtmEvent(event: string, payload: Record<string, unknown> = {}) {
    if (typeof window === 'undefined') return;
    const w = window as any;
    if (!Array.isArray(w.dataLayer)) return;
    w.dataLayer.push({
      event,
      page: 'terminal',
      component: 'terminal-shell',
      viewport: isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop',
      ...payload,
    });
  }

  const densityLabel = $derived(densityMode === 'essential' ? 'ESSENTIAL' : 'PRO');

  function toggleDensityMode() {
    const nextMode = densityMode === 'essential' ? 'pro' : 'essential';
    densityMode = nextMode;
    try { localStorage.setItem(DENSITY_STORAGE_KEY, nextMode); } catch {}
    gtmEvent('terminal_density_mode_toggle', {
      mode: nextMode,
      pair: $gameState.pair,
      timeframe: $gameState.timeframe,
    });
  }

  function setMobileTab(tab: MobileTab) {
    if (mobileTab === tab) return;
    const fromTab = mobileTab;
    mobileTab = tab;
    gtmEvent('terminal_mobile_tab_change', {
      tab,
      from_tab: fromTab,
      source: 'bottom-nav',
      pair: $gameState.pair,
      timeframe: $gameState.timeframe,
    });
  }

  $effect(() => {
    if (isMobile && !mobileViewTracked) {
      mobileViewTracked = true;
      gtmEvent('terminal_mobile_view', {
        tab: mobileTab,
        pair: $gameState.pair,
        timeframe: $gameState.timeframe,
      });
    } else if (!isMobile && mobileViewTracked) {
      mobileViewTracked = false;
    }
  });

  $effect(() => {
    if (isMobile && !mobileNavTracked) {
      mobileNavTracked = true;
      gtmEvent('terminal_mobile_nav_impression', {
        tab: mobileTab,
        pair: $gameState.pair,
        timeframe: $gameState.timeframe,
      });
    } else if (!isMobile && mobileNavTracked) {
      mobileNavTracked = false;
    }
  });

  function startDrag(target: DragTarget, e: MouseEvent) {
    if (isMobile || isTablet) return;
    dragTarget = target;
    dragStartX = e.clientX;
    if (target === 'left') dragStartVal = leftW;
    else if (target === 'right') dragStartVal = rightW;
    e.preventDefault();
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  function onMouseMove(e: MouseEvent) {
    if (!dragTarget) return;
    if (dragTarget === 'left') {
      const delta = e.clientX - dragStartX;
      leftW = Math.min(MAX_LEFT, Math.max(MIN_LEFT, dragStartVal + delta));
    } else if (dragTarget === 'right') {
      const delta = dragStartX - e.clientX;
      rightW = Math.min(MAX_RIGHT, Math.max(MIN_RIGHT, dragStartVal + delta));
    }
  }

  function onMouseUp() {
    if (!dragTarget) return;
    dragTarget = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }

  function clampLeftWidth(next: number) {
    return Math.min(MAX_LEFT, Math.max(MIN_LEFT, next));
  }

  function clampRightWidth(next: number) {
    return Math.min(MAX_RIGHT, Math.max(MIN_RIGHT, next));
  }

  // isHorizontalResizeGesture — imported from terminalHelpers

  function resizePanelByWheel(target: 'left' | 'right' | 'center', e: WheelEvent, options?: { force?: boolean }) {
    if (!isDesktop) return;

    const force = options?.force === true;
    const horizontalGesture = isHorizontalResizeGesture(e);
    const wantsResize = force || horizontalGesture || e.altKey || e.ctrlKey || e.metaKey;
    if (!wantsResize) return;

    const delta = horizontalGesture ? e.deltaX : (e.deltaY === 0 ? e.deltaX : e.deltaY);
    if (!Number.isFinite(delta) || delta === 0) return;
    e.preventDefault();

    const step = e.shiftKey ? 26 : 14;
    const signed = delta > 0 ? step : -step;

    if (target === 'left') {
      if (leftCollapsed) {
        leftCollapsed = false;
        leftW = savedLeftW;
      }
      leftW = clampLeftWidth(leftW + signed);
      savedLeftW = leftW;
      return;
    }

    if (target === 'right') {
      if (rightCollapsed) {
        rightCollapsed = false;
        rightW = savedRightW;
      }
      rightW = clampRightWidth(rightW + signed);
      savedRightW = rightW;
      return;
    }

    if (target === 'center') {
      if (leftCollapsed || rightCollapsed) return;
      const half = Math.round(signed / 2);
      // Wheel down: widen side panels (center narrower). Wheel up: opposite.
      const nextLeft = clampLeftWidth(leftW + half);
      const nextRight = clampRightWidth(rightW + half);
      leftW = nextLeft;
      rightW = nextRight;
      savedLeftW = leftW;
      savedRightW = rightW;
    }
  }

  function handleResize() {
    const wasTablet = windowWidth >= BP_MOBILE && windowWidth < BP_TABLET;
    windowWidth = window.innerWidth;
    const nowTablet = windowWidth >= BP_MOBILE && windowWidth < BP_TABLET;
    if (!nowTablet) return;
    if (!wasTablet) {
      tabletLeftWidth = getDefaultTabletLeftWidth(viewportWidth());
      tabletBottomHeight = getDefaultTabletBottomHeight(viewportHeight());
      return;
    }
    tabletLeftWidth = clampTabletLeftWidth(tabletLeftWidth, viewportWidth());
    tabletBottomHeight = clampTabletBottomHeight(tabletBottomHeight, viewportHeight());
  }

  async function fetchLiveTicker() {
    try {
      const [fgRes, cgRes] = await Promise.all([
        fetch('/api/feargreed?limit=1', { signal: AbortSignal.any([AbortSignal.timeout(5000), _pageAbort.signal]) }).then(r => r.json()).catch(() => null),
        fetch('/api/coingecko/global', { signal: AbortSignal.any([AbortSignal.timeout(5000), _pageAbort.signal]) }).then(r => r.json()).catch(() => null),
      ]);

      const parts: string[] = [];
      if (cgRes?.ok && cgRes.data?.global) {
        const g = cgRes.data.global;
        if (g.btcDominance) parts.push(`BTC_DOM: ${g.btcDominance.toFixed(1)}%`);
        if (g.totalVolumeUsd) parts.push(`VOL_24H: $${(g.totalVolumeUsd / 1e9).toFixed(1)}B`);
        if (g.totalMarketCapUsd) parts.push(`MCAP: $${(g.totalMarketCapUsd / 1e12).toFixed(2)}T`);
        if (g.ethDominance) parts.push(`ETH_DOM: ${g.ethDominance.toFixed(1)}%`);
        if (g.marketCapChange24hPct != null) parts.push(`MCAP_24H: ${g.marketCapChange24hPct >= 0 ? '+' : ''}${g.marketCapChange24hPct.toFixed(2)}%`);
      }
      if (fgRes?.ok && fgRes.data?.current) {
        const fg = fgRes.data.current;
        parts.push(`FEAR_GREED: ${fg.value} (${fg.classification})`);
      }
      if (cgRes?.ok && cgRes.data?.stablecoin) {
        const s = cgRes.data.stablecoin;
        if (s.totalMcapUsd) parts.push(`STABLE_MCAP: $${(s.totalMcapUsd / 1e9).toFixed(1)}B`);
      }

      if (parts.length > 0) {
        parts.push(`UPDATED: ${new Date().toTimeString().slice(0, 5)}`);
        liveTickerStr = parts.join(' | ');
        tickerLoaded = true;
      }
    } catch (e) {
      console.warn('[Terminal] Live ticker fetch failed, using fallback');
    }
  }

  onMount(() => {
    windowWidth = window.innerWidth;
    if (windowWidth >= BP_MOBILE && windowWidth < BP_TABLET) {
      tabletLeftWidth = getDefaultTabletLeftWidth(viewportWidth());
      tabletBottomHeight = getDefaultTabletBottomHeight(viewportHeight());
    }
    window.addEventListener('resize', handleResize);
    window.addEventListener('pointermove', onTabletSplitPointerMove, { passive: false });
    window.addEventListener('pointerup', finishTabletSplitDrag);
    window.addEventListener('pointercancel', finishTabletSplitDrag);

    // ── Load live ticker data ──
    fetchLiveTicker();

    // Background alert engine — scans every 5min, fires notifications
    alertEngine.start();

    const params = new URLSearchParams(window.location.search);
    if (params.get('copyTrade') === '1') {
      const pair = params.get('pair') || 'BTC/USDT';
      const dir = params.get('dir') === 'SHORT' ? 'SHORT' : 'LONG';
      const entry = Number(params.get('entry') || 0);
      const tp = Number(params.get('tp') || 0);
      const sl = Number(params.get('sl') || 0);
      const conf = Number(params.get('conf') || 70);
      const source = params.get('source') || 'SIGNAL ROOM';
      const reason = params.get('reason') || '';

      if (pair && Number.isFinite(entry) && entry > 0 && Number.isFinite(tp) && Number.isFinite(sl)) {
        copyTradeStore.openFromSignal({
          pair,
          dir,
          entry,
          tp,
          sl,
          conf: Number.isFinite(conf) ? conf : 70,
          source,
          reason,
        });
      }

      params.delete('copyTrade');
      params.delete('pair');
      params.delete('dir');
      params.delete('entry');
      params.delete('tp');
      params.delete('sl');
      params.delete('conf');
      params.delete('source');
      params.delete('reason');
      const nextQuery = params.toString();
      const nextUrl = nextQuery ? `${window.location.pathname}?${nextQuery}` : window.location.pathname;
      history.replaceState({}, '', nextUrl);
    }
  });

  onDestroy(() => {
    _pageAbort.abort();
    finishTabletSplitDrag();
    alertEngine.stop();
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointermove', onTabletSplitPointerMove);
      window.removeEventListener('pointerup', finishTabletSplitDrag);
      window.removeEventListener('pointercancel', finishTabletSplitDrag);
    }
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

  function tryTriggerWarRoomScan(): boolean {
    if (!warRoomRef || typeof warRoomRef.triggerScanFromChart !== 'function') return false;
    warRoomRef.triggerScanFromChart();
    return true;
  }

  function requestTerminalScan(source: string, pairHint?: string, timeframeHint?: string) {
    gtmEvent('terminal_scan_request_shell', {
      source,
      pair: pairHint || $gameState.pair,
      timeframe: timeframeHint || $gameState.timeframe,
    });

    if (tryTriggerWarRoomScan()) return;

    pendingChartScan = true;
    if (isDesktop && leftCollapsed) {
      toggleLeft();
    }
    if (isMobile && mobileTab !== 'warroom') {
      gtmEvent('terminal_mobile_tab_auto_switch', {
        from_tab: mobileTab,
        to_tab: 'warroom',
        reason: 'scan_request',
      });
      setMobileTab('warroom');
    }
  }

  function handleChartScanRequest(detail: { source?: string; pair?: string; timeframe?: string }) {
    requestTerminalScan(detail.source || 'chart-panel', detail.pair, detail.timeframe);
  }

  $effect(() => {
    if (pendingChartScan && tryTriggerWarRoomScan()) {
      pendingChartScan = false;
    }
  });


  let chatMessages: ChatMsg[] = $state([
    { from: 'SYSTEM', icon: '🤖', color: '#E8967D', text: 'Stockclaw Orchestrator v8 online. 8 agents standing by. Scan first, then ask questions about the results.', time: '—', isUser: false, isSystem: true },
    { from: 'ORCHESTRATOR', icon: '🧠', color: '#ff2d9b',
      text: '💡 Try these:\n• "BTC 전망 분석해줘" — I\'ll route to the right agents\n• "차트패턴 찾아봐" — 보이는 구간 패턴을 차트에 바로 표시\n• "@STRUCTURE MA, RSI 분석" — Direct to Structure agent\n• "@DERIV 펀딩 + OI 어때?" — Derivatives analysis\n• "@FLOW 고래 움직임?" — On-chain + whale flow\n• "@SENTI 소셜 센티먼트" — F&G + LunarCrush social\n• "@MACRO DXY, 금리 영향?" — Macro regime check',
      time: '—', isUser: false },
  ]);
  let isTyping = $state(false);
  let latestScan: ScanIntelDetail | null = $state(null);
  let terminalScanning = $state(false);
  let chatTradeReady = $state(false);
  let chatSuggestedDir: ChatTradeDirection = $state('LONG');
  let chatFocusKey = $state(0);
  let activeTradeSetup: AgentTradeSetup | null = $state(null);
  const terminalDecisionState = $derived(deriveTerminalDecisionState({
    terminalScanning,
    latestScan,
    chatTradeReady,
    chatSuggestedDir,
  }));
  $effect(() => {
    if (chatMessages.length > MAX_CHAT_MESSAGES) {
      chatMessages = chatMessages.slice(-MAX_CHAT_MESSAGES);
    }
  });

  function handleDecisionPrimaryClick() {
    void handleDecisionPrimaryAction();
  }

  function clearActiveTradeSetup() {
    activeTradeSetup = null;
  }


  const terminalControlBarProps = $derived(buildTerminalControlBarProps({
    pair,
    timeframeLabel,
    densityLabel,
    decisionState: terminalDecisionState,
    onPrimaryAction: handleDecisionPrimaryClick,
    onToggleDensity: toggleDensityMode,
  }));

  const sharedChartPanelProps = $derived(buildSharedChartPanelProps({
    chatTradeReady,
    chatSuggestedDir,
    activeTradeSetup,
    latestScan,
  }));

  // Agent/error/direction helpers — imported from terminalHelpers.ts
  const AGENT_META = buildAgentMeta();

  // Chat connection status for UI dot indicator
  let chatConnectionStatus: 'connected' | 'degraded' | 'disconnected' = $state('connected');
  let lastChatSuccess = $state(0);

  const sharedIntelPanelProps = $derived(buildSharedIntelPanelProps({
    densityMode,
    chatMessages,
    isTyping,
    chatTradeReady,
    chatFocusKey,
    chatConnectionStatus,
  }));

  // isPatternScanIntent, patternKindLabel, patternStatusLabel, formatPatternChatReply
  // — imported from terminalHelpers.ts

  async function triggerPatternScanFromChat(source: string, time: string) {
    if (isMobile && mobileTab !== 'chart') {
      gtmEvent('terminal_mobile_tab_auto_switch', {
        from_tab: mobileTab,
        to_tab: 'chart',
        reason: 'pattern_scan_from_chat',
      });
      setMobileTab('chart');
      await tick();
    }

    await tick();
    const chartPanel = getActiveChartPanel();
    if (!chartPanel || typeof chartPanel.runPatternScanFromIntel !== 'function') {
      gtmEvent('terminal_pattern_scan_request_failed', {
        source,
        reason: 'chart_panel_unavailable',
        pair: $gameState.pair,
        timeframe: $gameState.timeframe,
      });
      chatMessages = [...chatMessages, {
        from: 'SYSTEM',
        icon: '⚠️',
        color: '#ff8c3b',
        text: '차트가 준비되지 않아 패턴 스캔을 실행하지 못했습니다.',
        time,
        isUser: false,
        isSystem: true,
      }];
      return;
    }

    try {
      const report = await chartPanel.runPatternScanFromIntel({ scope: 'visible', focus: true });
      gtmEvent('terminal_pattern_scan_request', {
        source,
        pair: $gameState.pair,
        timeframe: $gameState.timeframe,
        scope: report.scope,
        candle_count: report.candleCount,
        pattern_count: report.patternCount,
        ok: report.ok,
      });
      chatMessages = [...chatMessages, {
        from: 'ORCHESTRATOR',
        icon: '🧠',
        color: '#ff2d9b',
        text: formatPatternChatReply(report),
        time,
        isUser: false,
      }];
    } catch (error) {
      gtmEvent('terminal_pattern_scan_request_failed', {
        source,
        reason: 'runtime_error',
        pair: $gameState.pair,
        timeframe: $gameState.timeframe,
      });
      chatMessages = [...chatMessages, {
        from: 'SYSTEM',
        icon: '⚠️',
        color: '#ff8c3b',
        text: '패턴 스캔 실행 중 오류가 발생했습니다.',
        time,
        isUser: false,
        isSystem: true,
      }];
      console.error('[terminal] pattern scan from chat failed:', error);
    }
  }

  function getActiveChartPanel(): ChartPanelHandle | null {
    if (isMobile) return mobileChartRef;
    if (isTablet) return tabletChartRef;
    return desktopChartRef;
  }

  function focusIntelChat(source: string) {
    if (isDesktop && rightCollapsed) toggleRight();
    if (isMobile && mobileTab !== 'intel') {
      gtmEvent('terminal_mobile_tab_auto_switch', {
        from_tab: mobileTab,
        to_tab: 'intel',
        reason: source,
      });
      setMobileTab('intel');
    }
    chatFocusKey += 1;
  }

  function handleChartChatRequest(detail: { source?: string; pair?: string; timeframe?: string }) {
    gtmEvent('terminal_chat_request_shell', {
      source: detail.source || 'chart-panel',
      pair: detail.pair || $gameState.pair,
      timeframe: detail.timeframe || $gameState.timeframe,
      trade_ready: chatTradeReady,
    });
    focusIntelChat(detail.source || 'chart-panel');
  }

  async function triggerTradePlanFromChat(source: string) {
    if (!chatTradeReady) {
      gtmEvent('terminal_trade_plan_request_blocked', {
        source,
        reason: 'chat_answer_required',
        pair: $gameState.pair,
        timeframe: $gameState.timeframe,
      });
      focusIntelChat(`${source}-chat-first`);
      return;
    }

    if (isDesktop && rightCollapsed) toggleRight();
    if (isMobile && mobileTab !== 'chart') {
      gtmEvent('terminal_mobile_tab_auto_switch', {
        from_tab: mobileTab,
        to_tab: 'chart',
        reason: 'trade_plan_from_chat',
      });
      setMobileTab('chart');
      await tick();
    }

    await tick();
    const chartPanel = getActiveChartPanel();
    if (!chartPanel || typeof chartPanel.activateTradeDrawing !== 'function') {
      gtmEvent('terminal_trade_plan_request_failed', {
        source,
        reason: 'chart_panel_unavailable',
        pair: $gameState.pair,
        timeframe: $gameState.timeframe,
      });
      return;
    }

    gtmEvent('terminal_trade_plan_request', {
      source,
      pair: $gameState.pair,
      timeframe: $gameState.timeframe,
      suggested_dir: chatSuggestedDir,
    });
    await chartPanel.activateTradeDrawing(chatSuggestedDir);
  }

  function handleIntelGoTrade() {
    void triggerTradePlanFromChat('intel-panel');
  }

  async function handleDecisionPrimaryAction() {
    if (terminalScanning) return;
    if (!latestScan) {
      requestTerminalScan('decision-rail');
      return;
    }
    if (chatTradeReady) {
      await triggerTradePlanFromChat('decision-rail');
      return;
    }
    focusIntelChat('decision-rail-chat');
  }

  async function handleSendChat(detail: { text: string }) {
    const text = detail.text;
    if (!text.trim()) return;
    const now = new Date();
    const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;

    // 유저 메시지 즉시 표시
    chatMessages = [...chatMessages, { from: 'YOU', icon: '🐕', color: '#E8967D', text, time, isUser: true }];
    isTyping = true;

    // 멘션된 에이전트 감지 (없으면 서버에서 ORCHESTRATOR로 기본 처리)
    const mentionedAgent = detectMentionedAgentLocal(text) || undefined;
    const patternIntent = isPatternScanIntent(text);
    chatTradeReady = false;
    gtmEvent('terminal_chat_question_sent', {
      source: 'intel-chat',
      pair: $gameState.pair || 'BTC/USDT',
      timeframe: $gameState.timeframe || '4h',
      chars: text.length,
      mentioned_agent: mentionedAgent || 'auto',
      intent: patternIntent ? 'pattern_scan' : 'agent_chat',
    });

    if (patternIntent) {
      isTyping = false;
      await triggerPatternScanFromChat('intel-chat', time);
      return;
    }

    isTyping = true;

    try {
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'terminal',
          senderKind: 'user',
          senderName: 'YOU',
          message: text,
          meta: {
            pair: $gameState.pair || 'BTC/USDT',
            timeframe: $gameState.timeframe || '4h',
            mentionedAgent,
            livePrices: { ...$livePrices },
          },
        }),
        signal: AbortSignal.any([AbortSignal.timeout(20000), _pageAbort.signal]),
      });

      isTyping = false;

      if (res.ok) {
        chatConnectionStatus = 'connected';
        lastChatSuccess = Date.now();
        const data = await res.json();
        if (data.agentResponse) {
          const r = data.agentResponse;
          const agMeta = AGENT_META[r.senderName] || AGENT_META['ORCHESTRATOR'];
          chatMessages = [...chatMessages, {
            from: r.senderName,
            icon: agMeta.icon,
            color: agMeta.color,
            text: r.message,
            time,
            isUser: false,
          }];
          const inferred = inferSuggestedDirection(String(r.message || ''));
          if (inferred) chatSuggestedDir = inferred;
          chatTradeReady = true;
          gtmEvent('terminal_chat_answer_received', {
            source: 'intel-chat',
            pair: $gameState.pair || 'BTC/USDT',
            timeframe: $gameState.timeframe || '4h',
            responder: r.senderName || 'ORCHESTRATOR',
            chars: String(r.message || '').length,
            suggested_dir: inferred || chatSuggestedDir,
          });
        }
      } else {
        let statusLabel = String(res.status);
        try {
          const errBody = await res.json();
          const errMsg = typeof errBody?.error === 'string' ? errBody.error : '';
          if (errMsg) statusLabel = `${res.status} ${errMsg}`;
        } catch {
          // noop
        }
        const offline = buildOfflineAgentReply({
          userText: text,
          statusLabel,
          pair: $gameState.pair || 'BTC/USDT',
          timeframe: $gameState.timeframe || '4h',
          latestScan,
        });
        chatConnectionStatus = offline.connectionStatus;
        const fallbackMeta = AGENT_META[offline.sender] || AGENT_META.ORCHESTRATOR;
        if (offline.tradeDir) {
          chatSuggestedDir = offline.tradeDir;
          chatTradeReady = true;
        } else {
          chatTradeReady = false;
        }
        gtmEvent('terminal_chat_answer_error', {
          source: 'intel-chat',
          pair: $gameState.pair || 'BTC/USDT',
          timeframe: $gameState.timeframe || '4h',
          status: res.status,
          mode: 'offline_fallback',
        });
        chatMessages = [...chatMessages, {
          from: offline.sender,
          icon: fallbackMeta.icon,
          color: fallbackMeta.color,
          text: offline.text,
          time,
          isUser: false,
        }];
      }
    } catch (err) {
      isTyping = false;
      const errorLabel = err instanceof DOMException && err.name === 'TimeoutError' ? 'timeout' : 'network';
      const offline = buildOfflineAgentReply({
        userText: text,
        statusLabel: errorLabel,
        err,
        pair: $gameState.pair || 'BTC/USDT',
        timeframe: $gameState.timeframe || '4h',
        latestScan,
      });
      chatConnectionStatus = offline.connectionStatus;
      const fallbackMeta = AGENT_META[offline.sender] || AGENT_META.ORCHESTRATOR;
      if (offline.tradeDir) {
        chatSuggestedDir = offline.tradeDir;
        chatTradeReady = true;
      } else {
        chatTradeReady = false;
      }
      gtmEvent('terminal_chat_answer_error', {
        source: 'intel-chat',
        pair: $gameState.pair || 'BTC/USDT',
        timeframe: $gameState.timeframe || '4h',
        status: 'network',
        mode: 'offline_fallback',
      });
      chatMessages = [...chatMessages, {
        from: offline.sender,
        icon: fallbackMeta.icon,
        color: fallbackMeta.color,
        text: offline.text,
        time,
        isUser: false,
      }];
    }
  }

  function handleScanStart() {
    terminalScanning = true;
  }

  function handleScanComplete(payload: ScanIntelDetail | CustomEvent<ScanIntelDetail>) {
    terminalScanning = false;
    const d = 'detail' in payload ? payload.detail : payload;
    latestScan = d;
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // 1) 스캔 완료 시스템 메시지
    chatMessages = [...chatMessages, {
      from: 'SYSTEM', icon: '⚡', color: '#E8967D',
      text: `SCAN COMPLETE — ${d.pair} ${d.timeframe.toUpperCase()} (${d.label})`,
      time, isUser: false, isSystem: true,
    }];

    // 2) COMMANDER 종합 판정만 표시 (개별 에이전트는 WarRoom에서 확인)
    const dirEmoji = d.consensus === 'long' ? '🟢' : d.consensus === 'short' ? '🔴' : '⚪';
    chatMessages = [...chatMessages, {
      from: 'COMMANDER',
      icon: '🧠',
      color: '#ff2d9b',
      text: `${dirEmoji} VERDICT: ${d.consensus.toUpperCase()} — Confidence ${d.avgConfidence}%\n${d.summary}\n📊 차트에 TP/SL 표시됨 · 왼쪽 시그널 카드에서 개별 에이전트 확인`,
      time, isUser: false,
    }];

    // 3) consensus 방향 에이전트들의 평균 entry/tp/sl → 차트 오버레이
    if (d.signals && d.signals.length > 0 && d.consensus !== 'neutral') {
      const dirSignals = d.signals.filter(s => s.vote === d.consensus);
      if (dirSignals.length > 0) {
        const avgEntry = dirSignals.reduce((sum, s) => sum + s.entry, 0) / dirSignals.length;
        const avgTp = dirSignals.reduce((sum, s) => sum + s.tp, 0) / dirSignals.length;
        const avgSl = dirSignals.reduce((sum, s) => sum + s.sl, 0) / dirSignals.length;
        const risk = Math.abs(avgEntry - avgSl);
        const reward = Math.abs(avgTp - avgEntry);
        activeTradeSetup = {
          source: 'consensus',
          dir: d.consensus === 'long' ? 'LONG' : 'SHORT',
          entry: avgEntry,
          tp: avgTp,
          sl: avgSl,
          rr: risk > 0 ? reward / risk : 2,
          conf: d.avgConfidence,
          pair: d.pair,
        };
      }
    } else {
      activeTradeSetup = null;
    }

    // 방향 추론 → 트레이드 버튼 활성화
    if (d.consensus === 'long' || d.consensus === 'short') {
      chatSuggestedDir = d.consensus === 'long' ? 'LONG' : 'SHORT';
      chatTradeReady = true;
    }
  }

  function handleShowOnChart(payload: { signal: { vote: string; conf: number; entry: number; tp: number; sl: number; name: string; pair: string } } | CustomEvent<{ signal: { vote: string; conf: number; entry: number; tp: number; sl: number; name: string; pair: string } }>) {
    const sig = 'detail' in payload ? payload.detail.signal : payload.signal;
    if (sig.vote === 'neutral' || !sig.entry || !sig.tp || !sig.sl) return;
    const risk = Math.abs(sig.entry - sig.sl);
    const reward = Math.abs(sig.tp - sig.entry);
    activeTradeSetup = {
      source: 'agent',
      agentName: sig.name,
      dir: sig.vote === 'long' ? 'LONG' : 'SHORT',
      entry: sig.entry,
      tp: sig.tp,
      sl: sig.sl,
      rr: risk > 0 ? reward / risk : 2,
      conf: sig.conf,
      pair: sig.pair,
    };
  }

  function formatCommunitySignalPost(detail: ChartCommunitySignal): string {
    const rr = Math.abs(detail.entry - detail.sl) > 0
      ? Math.abs(detail.tp - detail.entry) / Math.abs(detail.entry - detail.sl)
      : 2;
    const timeframe = formatTimeframeLabel($gameState.timeframe);
    return [
      `[${detail.source}] ${detail.dir} ${detail.pair}`,
      `Entry ${Math.round(detail.entry).toLocaleString()} | TP ${Math.round(detail.tp).toLocaleString()} | SL ${Math.round(detail.sl).toLocaleString()}`,
      `Conf ${Math.round(detail.conf)}% | RR 1:${rr.toFixed(1)} | TF ${timeframe}`,
      detail.reason,
    ].join('\n');
  }

  function handleChartCommunitySignal(detail: ChartCommunitySignal) {
    if (!detail || !detail.pair || !detail.dir) return;
    if (![detail.entry, detail.tp, detail.sl].every((v) => Number.isFinite(v) && v > 0)) return;

    const confidence = Math.max(1, Math.min(100, Math.round(detail.conf || 68)));
    const signalNote = `${detail.source} | ${detail.reason}`;
    trackSignal(detail.pair, detail.dir, detail.entry, detail.source || 'CHART VIEW', confidence, signalNote);
    incrementTrackedSignals();
    notifySignalTracked(detail.pair, detail.dir);

    void addCommunityPost(
      formatCommunitySignalPost(detail),
      detail.dir === 'LONG' ? 'long' : 'short'
    );

    if (detail.openCopyTrade !== false) {
      copyTradeStore.openFromSignal({
        pair: detail.pair,
        dir: detail.dir,
        entry: detail.entry,
        tp: detail.tp,
        sl: detail.sl,
        conf: confidence,
        source: detail.source || 'CHART VIEW',
        reason: detail.reason,
      });
    }

    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    chatMessages = [...chatMessages, {
      from: 'SYSTEM',
      icon: '📡',
      color: '#E8967D',
      text: `COMMUNITY SIGNAL CREATED — ${detail.dir} ${detail.pair} (${confidence}%)${detail.openCopyTrade !== false ? '\nCopy Trade modal opened.' : ''}`,
      time,
      isUser: false,
      isSystem: true,
    }];
  }
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
      {terminalControlBarProps}
      {sharedChartPanelProps}
      {sharedIntelPanelProps}
      {mobileTab}
      {mobileOpenTrades}
      {mobileTrackedSignals}
      {latestScan}
      {terminalScanning}
      onSetMobileTab={setMobileTab}
      onScanStart={handleScanStart}
      onScanComplete={handleScanComplete}
      onShowOnChart={handleShowOnChart}
      onChartScanRequest={(detail) => handleChartScanRequest(detail)}
      onChartChatRequest={(detail) => handleChartChatRequest(detail)}
      onChartCommunitySignal={(detail) => handleChartCommunitySignal(detail)}
      onClearTradeSetup={clearActiveTradeSetup}
      onSendChat={handleSendChat}
      onGoToTrade={handleIntelGoTrade}
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
      onScanStart={handleScanStart}
      onScanComplete={handleScanComplete}
      onShowOnChart={handleShowOnChart}
      onChartScanRequest={(detail) => handleChartScanRequest(detail)}
      onChartChatRequest={(detail) => handleChartChatRequest(detail)}
      onChartCommunitySignal={(detail) => handleChartCommunitySignal(detail)}
      onClearTradeSetup={clearActiveTradeSetup}
      onSendChat={handleSendChat}
      onGoToTrade={handleIntelGoTrade}
      onResizeSplitByWheel={resizeTabletSplitByWheel}
      onStartSplitDrag={startTabletSplitDrag}
      onResetSplit={resetTabletSplit}
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
      onScanStart={handleScanStart}
      onScanComplete={handleScanComplete}
      onShowOnChart={handleShowOnChart}
      onChartScanRequest={(detail) => handleChartScanRequest(detail)}
      onChartChatRequest={(detail) => handleChartChatRequest(detail)}
      onChartCommunitySignal={(detail) => handleChartCommunitySignal(detail)}
      onClearTradeSetup={clearActiveTradeSetup}
      onSendChat={handleSendChat}
      onGoToTrade={handleIntelGoTrade}
      onStartDrag={startDrag}
      onResizePanelByWheel={resizePanelByWheel}
    />
  {/if}
</div>

<!-- Copy Trade Modal (shared across all layouts) -->
<CopyTradeModal />
