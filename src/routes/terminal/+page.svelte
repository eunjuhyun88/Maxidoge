<script lang="ts">
  import WarRoom from '../../components/terminal/WarRoom.svelte';
  import ChartPanel from '../../components/arena/ChartPanel.svelte';
  import IntelPanel from '../../components/terminal/IntelPanel.svelte';
  import TokenDropdown from '../../components/shared/TokenDropdown.svelte';
  import CopyTradeModal from '../../components/modals/CopyTradeModal.svelte';
  import { AGDEFS } from '$lib/data/agents';

  let liveTickerStr = '';
  let tickerLoaded = false;
  $: TICKER_STR = tickerLoaded && liveTickerStr
    ? liveTickerStr
    : 'Loading market data...';
  import { gameState } from '$lib/stores/gameState';
  import { livePrices } from '$lib/stores/priceStore';
  import { hydrateQuickTrades, openTradeCount } from '$lib/stores/quickTradeStore';
  import { activeSignalCount } from '$lib/stores/trackedSignalStore';
  import { copyTradeStore } from '$lib/stores/copyTradeStore';
  import { formatTimeframeLabel } from '$lib/utils/timeframe';
  import { alertEngine } from '$lib/services/alertEngine';
  import { onMount, onDestroy, tick } from 'svelte';

  // ── Panel resize state ──
  let leftW = 280;       // War Room width
  let rightW = 300;      // Intel Panel width
  let containerEl: HTMLDivElement;
  let windowWidth = 1200;

  const MIN_LEFT = 200;
  const MAX_LEFT = 450;
  const MIN_RIGHT = 220;
  const MAX_RIGHT = 500;

  // Collapse state
  let leftCollapsed = false;
  let rightCollapsed = false;
  let savedLeftW = 280;
  let savedRightW = 300;

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
  const BP_MOBILE = 768;
  const BP_TABLET = 1024;

  type DragTarget = 'left' | 'right' | null;
  let dragTarget: DragTarget = null;
  let dragStartX = 0;
  let dragStartVal = 0;

  // Responsive layout mode
  $: isMobile = windowWidth < BP_MOBILE;
  $: isTablet = windowWidth >= BP_MOBILE && windowWidth < BP_TABLET;
  $: isDesktop = windowWidth >= BP_TABLET;

  // Mobile tab control
  type MobileTab = 'warroom' | 'chart' | 'intel';
  const MOBILE_TAB_META: Record<MobileTab, { label: string; icon: string; desc: string }> = {
    warroom: { label: 'War Room', icon: '🎖', desc: 'Signal stream and quick trade actions' },
    chart: { label: 'Chart', icon: '📊', desc: 'Execution chart with drawing and indicators' },
    intel: { label: 'Intel', icon: '🧠', desc: 'News, community and agent chat' },
  };
  let mobileTab: MobileTab = 'chart';
  let mobileViewTracked = false;
  let mobileNavTracked = false;
  type MobilePanelSize = { widthPct: number; heightPct: number };
  const MOBILE_PANEL_MIN_W = 72;
  const MOBILE_PANEL_MAX_W = 100;
  const MOBILE_PANEL_MIN_H = 58;
  const MOBILE_PANEL_MAX_H = 100;
  const MOBILE_PANEL_STEP = 3;
  type MobileResizeAxis = 'x' | 'y';
  type MobileResizeState = {
    tab: MobileTab;
    axis: MobileResizeAxis;
    pointerId: number;
    startClient: number;
    startPct: number;
    basisPx: number;
  };
  type MobileTouchResizeState = {
    tab: MobileTab;
    axis: MobileResizeAxis;
    touchId: number;
    startClient: number;
    startPct: number;
    basisPx: number;
  };
  let mobileResizeState: MobileResizeState | null = null;
  let mobileTouchResizeState: MobileTouchResizeState | null = null;
  let mobilePanelSizes: Record<MobileTab, MobilePanelSize> = {
    warroom: { widthPct: 100, heightPct: 100 },
    chart: { widthPct: 100, heightPct: 100 },
    intel: { widthPct: 100, heightPct: 100 },
  };
  type DesktopPanelKey = 'left' | 'center' | 'right';
  type DesktopPanelSize = { widthPct: number; heightPct: number };
  const DESKTOP_PANEL_MIN_W = 72;
  const DESKTOP_PANEL_MAX_W = 100;
  const DESKTOP_PANEL_MIN_H = 64;
  const DESKTOP_PANEL_MAX_H = 100;
  const DESKTOP_PANEL_STEP = 3;
  let desktopPanelSizes: Record<DesktopPanelKey, DesktopPanelSize> = {
    left: { widthPct: 100, heightPct: 100 },
    center: { widthPct: 100, heightPct: 100 },
    right: { widthPct: 100, heightPct: 100 },
  };
  type TabletPanelKey = 'left' | 'center' | 'bottom';
  type TabletPanelSize = { widthPct: number; heightPct: number };
  const TABLET_LEFT_MIN = 188;
  const TABLET_LEFT_MAX = 360;
  const TABLET_BOTTOM_MIN = 200;
  const TABLET_BOTTOM_MAX = 360;
  const TABLET_SPLIT_STEP = 12;
  let tabletPanelSizes: Record<TabletPanelKey, TabletPanelSize> = {
    left: { widthPct: 100, heightPct: 100 },
    center: { widthPct: 100, heightPct: 100 },
    bottom: { widthPct: 100, heightPct: 100 },
  };
  let tabletLeftWidth = 232;
  let tabletBottomHeight = 260;
  $: tabletLayoutStyle = `--tab-left-width: ${tabletLeftWidth}px; --tab-bottom-height: ${tabletBottomHeight}px;`;
  type TabletSplitResizeAxis = 'x' | 'y';
  type TabletSplitResizeState = {
    axis: TabletSplitResizeAxis;
    pointerId: number;
    startClient: number;
    startValue: number;
  };
  let tabletSplitResizeState: TabletSplitResizeState | null = null;

  function clampPercent(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }

  function getDesktopPanelStyle(panel: DesktopPanelKey) {
    const size = desktopPanelSizes[panel];
    return `--desk-panel-width: ${size.widthPct}%; --desk-panel-height: ${size.heightPct}%`;
  }

  function resizeDesktopPanelByWheel(panel: DesktopPanelKey, axis: 'x' | 'y', e: WheelEvent) {
    if (!isDesktop) return;
    const rawDelta = axis === 'x' ? (Math.abs(e.deltaX) > 0 ? e.deltaX : e.deltaY) : e.deltaY;
    if (!Number.isFinite(rawDelta) || rawDelta === 0) return;

    const step = e.shiftKey ? DESKTOP_PANEL_STEP * 2 : DESKTOP_PANEL_STEP;
    const signed = rawDelta > 0 ? step : -step;
    const current = desktopPanelSizes[panel];
    e.preventDefault();
    e.stopPropagation();

    if (axis === 'x') {
      const nextWidth = clampPercent(current.widthPct + signed, DESKTOP_PANEL_MIN_W, DESKTOP_PANEL_MAX_W);
      if (nextWidth === current.widthPct) return;
      desktopPanelSizes = {
        ...desktopPanelSizes,
        [panel]: { ...current, widthPct: nextWidth },
      };
      return;
    }

    const nextHeight = clampPercent(current.heightPct + signed, DESKTOP_PANEL_MIN_H, DESKTOP_PANEL_MAX_H);
    if (nextHeight === current.heightPct) return;
    desktopPanelSizes = {
      ...desktopPanelSizes,
      [panel]: { ...current, heightPct: nextHeight },
    };
  }

  function resetDesktopPanelSize(panel: DesktopPanelKey) {
    desktopPanelSizes = {
      ...desktopPanelSizes,
      [panel]: { widthPct: 100, heightPct: 100 },
    };
  }

  function getTabletPanelStyle(panel: TabletPanelKey) {
    const size = tabletPanelSizes[panel];
    return `--tab-panel-width: ${size.widthPct}%; --tab-panel-height: ${size.heightPct}%`;
  }

  function getDefaultTabletLeftWidth() {
    if (typeof window === 'undefined') return 232;
    return Math.round(Math.min(232, Math.max(196, window.innerWidth * 0.23)));
  }

  function getDefaultTabletBottomHeight() {
    if (typeof window === 'undefined') return 260;
    return Math.round(Math.min(280, Math.max(200, window.innerHeight * 0.28)));
  }

  function clampTabletLeftWidth(next: number) {
    if (typeof window === 'undefined') return Math.round(Math.min(TABLET_LEFT_MAX, Math.max(TABLET_LEFT_MIN, next)));
    const dynamicMax = Math.min(TABLET_LEFT_MAX, Math.max(220, Math.round(window.innerWidth * 0.36)));
    return Math.round(Math.min(dynamicMax, Math.max(TABLET_LEFT_MIN, next)));
  }

  function clampTabletBottomHeight(next: number) {
    if (typeof window === 'undefined') return Math.round(Math.min(TABLET_BOTTOM_MAX, Math.max(TABLET_BOTTOM_MIN, next)));
    const dynamicMax = Math.min(TABLET_BOTTOM_MAX, Math.max(196, Math.round(window.innerHeight * 0.42)));
    return Math.round(Math.min(dynamicMax, Math.max(TABLET_BOTTOM_MIN, next)));
  }

  function applyTabletSplitDelta(axis: TabletSplitResizeAxis, signedDelta: number) {
    if (axis === 'x') {
      tabletLeftWidth = clampTabletLeftWidth(tabletLeftWidth + signedDelta);
      return;
    }
    tabletBottomHeight = clampTabletBottomHeight(tabletBottomHeight + signedDelta);
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
      tabletLeftWidth = clampTabletLeftWidth(state.startValue + delta);
    } else {
      // Separator up => bottom panel grows, separator down => bottom panel shrinks.
      tabletBottomHeight = clampTabletBottomHeight(state.startValue - delta);
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

  function resizeTabletPanelByWheel(panel: TabletPanelKey, axis: 'x' | 'y', e: WheelEvent) {
    if (!isTablet) return;
    const rawDelta = axis === 'x' ? (Math.abs(e.deltaX) > 0 ? e.deltaX : e.deltaY) : e.deltaY;
    if (!Number.isFinite(rawDelta) || rawDelta === 0) return;

    const step = e.shiftKey ? TABLET_SPLIT_STEP + 8 : TABLET_SPLIT_STEP;
    const signed = rawDelta > 0 ? step : -step;
    e.preventDefault();
    e.stopPropagation();

    if (axis === 'x') {
      // Tablet horizontal split: adjust WAR ROOM vs CHART width.
      if (panel === 'bottom') return;
      applyTabletSplitDelta('x', signed);
      return;
    }

    // Tablet vertical split: adjust CHART block vs INTEL block height.
    applyTabletSplitDelta('y', signed);
  }

  function resetTabletPanelSize(panel: TabletPanelKey) {
    if (panel === 'bottom') {
      tabletBottomHeight = getDefaultTabletBottomHeight();
      return;
    }
    tabletLeftWidth = getDefaultTabletLeftWidth();
  }

  function getMobilePanelStyle(tab: MobileTab) {
    const panel = mobilePanelSizes[tab];
    return `--mob-panel-width: ${panel.widthPct}%; --mob-panel-height: ${panel.heightPct}%`;
  }

  function resizeMobilePanelByWheel(tab: MobileTab, axis: 'x' | 'y', e: WheelEvent) {
    if (!isMobile) return;
    const rawDelta = axis === 'x' ? (Math.abs(e.deltaX) > 0 ? e.deltaX : e.deltaY) : e.deltaY;
    if (!Number.isFinite(rawDelta) || rawDelta === 0) return;

    const step = e.shiftKey ? MOBILE_PANEL_STEP * 2 : MOBILE_PANEL_STEP;
    const signed = rawDelta > 0 ? step : -step;
    const current = mobilePanelSizes[tab];

    if (axis === 'x') {
      const nextWidth = clampPercent(current.widthPct + signed, MOBILE_PANEL_MIN_W, MOBILE_PANEL_MAX_W);
      if (nextWidth === current.widthPct) return;
      e.preventDefault();
      mobilePanelSizes = {
        ...mobilePanelSizes,
        [tab]: { ...current, widthPct: nextWidth },
      };
      return;
    }

    const nextHeight = clampPercent(current.heightPct + signed, MOBILE_PANEL_MIN_H, MOBILE_PANEL_MAX_H);
    if (nextHeight === current.heightPct) return;
    e.preventDefault();
    mobilePanelSizes = {
      ...mobilePanelSizes,
      [tab]: { ...current, heightPct: nextHeight },
    };
  }

  function resetMobilePanelSize(tab: MobileTab) {
    mobilePanelSizes = {
      ...mobilePanelSizes,
      [tab]: { widthPct: 100, heightPct: 100 },
    };
  }

  function supportsPointerDrag() {
    return typeof window !== 'undefined' && 'PointerEvent' in window;
  }

  function clearBodySelectionIfIdle() {
    if (!mobileResizeState && !mobileTouchResizeState) {
      document.body.style.userSelect = '';
    }
  }

  function applyMobilePanelDrag(tab: MobileTab, axis: MobileResizeAxis, startPct: number, deltaPct: number) {
    const current = mobilePanelSizes[tab];

    if (axis === 'x') {
      const nextWidth = clampPercent(startPct + deltaPct, MOBILE_PANEL_MIN_W, MOBILE_PANEL_MAX_W);
      if (nextWidth === current.widthPct) return false;
      mobilePanelSizes = {
        ...mobilePanelSizes,
        [tab]: { ...current, widthPct: nextWidth },
      };
      return true;
    }

    const nextHeight = clampPercent(startPct + deltaPct, MOBILE_PANEL_MIN_H, MOBILE_PANEL_MAX_H);
    if (nextHeight === current.heightPct) return false;
    mobilePanelSizes = {
      ...mobilePanelSizes,
      [tab]: { ...current, heightPct: nextHeight },
    };
    return true;
  }

  function startMobilePanelDrag(tab: MobileTab, axis: MobileResizeAxis, e: PointerEvent) {
    if (!isMobile) return;

    const handle = e.currentTarget as HTMLElement | null;
    const panel = handle?.closest('.mob-panel-resizable') as HTMLElement | null;
    if (!panel) return;

    const rect = panel.getBoundingClientRect();
    const basisPx = axis === 'x' ? rect.width : rect.height;
    if (!Number.isFinite(basisPx) || basisPx <= 1) return;

    const current = mobilePanelSizes[tab];
    mobileResizeState = {
      tab,
      axis,
      pointerId: e.pointerId,
      startClient: axis === 'x' ? e.clientX : e.clientY,
      startPct: axis === 'x' ? current.widthPct : current.heightPct,
      basisPx,
    };

    handle?.setPointerCapture?.(e.pointerId);
    if (!mobileTouchResizeState) document.body.style.userSelect = 'none';
    e.preventDefault();

    gtmEvent('terminal_mobile_panel_resize_start', {
      tab,
      axis,
      width_pct: current.widthPct,
      height_pct: current.heightPct,
    });
  }

  function onMobilePanelPointerMove(e: PointerEvent) {
    if (!mobileResizeState || e.pointerId !== mobileResizeState.pointerId) return;

    const { tab, axis, startClient, startPct, basisPx } = mobileResizeState;
    const currentClient = axis === 'x' ? e.clientX : e.clientY;
    const deltaPct = ((currentClient - startClient) / basisPx) * 100;
    const changed = applyMobilePanelDrag(tab, axis, startPct, deltaPct);
    if (!changed) return;
    e.preventDefault();
  }

  function finishMobilePanelDrag(e?: PointerEvent) {
    if (!mobileResizeState) return;
    if (e && e.pointerId !== mobileResizeState.pointerId) return;

    const { tab, axis } = mobileResizeState;
    const current = mobilePanelSizes[tab];
    mobileResizeState = null;
    clearBodySelectionIfIdle();

    gtmEvent('terminal_mobile_panel_resize_end', {
      tab,
      axis,
      width_pct: current.widthPct,
      height_pct: current.heightPct,
      input: 'pointer',
    });
  }

  function startMobilePanelTouchDrag(tab: MobileTab, axis: MobileResizeAxis, e: TouchEvent) {
    if (!isMobile || supportsPointerDrag()) return;
    const touch = e.changedTouches[0];
    if (!touch) return;

    const handle = e.currentTarget as HTMLElement | null;
    const panel = handle?.closest('.mob-panel-resizable') as HTMLElement | null;
    if (!panel) return;

    const rect = panel.getBoundingClientRect();
    const basisPx = axis === 'x' ? rect.width : rect.height;
    if (!Number.isFinite(basisPx) || basisPx <= 1) return;

    const current = mobilePanelSizes[tab];
    mobileTouchResizeState = {
      tab,
      axis,
      touchId: touch.identifier,
      startClient: axis === 'x' ? touch.clientX : touch.clientY,
      startPct: axis === 'x' ? current.widthPct : current.heightPct,
      basisPx,
    };

    if (!mobileResizeState) document.body.style.userSelect = 'none';
    e.preventDefault();

    gtmEvent('terminal_mobile_panel_resize_start', {
      tab,
      axis,
      width_pct: current.widthPct,
      height_pct: current.heightPct,
      input: 'touch',
    });
  }

  function onMobilePanelTouchMove(e: TouchEvent) {
    if (!mobileTouchResizeState) return;
    const touch = Array.from(e.touches).find(t => t.identifier === mobileTouchResizeState?.touchId);
    if (!touch) return;

    const { tab, axis, startClient, startPct, basisPx } = mobileTouchResizeState;
    const currentClient = axis === 'x' ? touch.clientX : touch.clientY;
    const deltaPct = ((currentClient - startClient) / basisPx) * 100;
    const changed = applyMobilePanelDrag(tab, axis, startPct, deltaPct);
    if (!changed) return;
    e.preventDefault();
  }

  function finishMobilePanelTouchDrag(e?: TouchEvent) {
    if (!mobileTouchResizeState) return;
    if (e) {
      const ended = Array.from(e.changedTouches).some(t => t.identifier === mobileTouchResizeState?.touchId);
      if (!ended) return;
    }

    const { tab, axis } = mobileTouchResizeState;
    const current = mobilePanelSizes[tab];
    mobileTouchResizeState = null;
    clearBodySelectionIfIdle();

    gtmEvent('terminal_mobile_panel_resize_end', {
      tab,
      axis,
      width_pct: current.widthPct,
      height_pct: current.heightPct,
      input: 'touch',
    });
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

  $: if (isMobile && !mobileViewTracked) {
    mobileViewTracked = true;
    gtmEvent('terminal_mobile_view', {
      tab: mobileTab,
      pair: $gameState.pair,
      timeframe: $gameState.timeframe,
    });
  }
  $: if (!isMobile && mobileViewTracked) mobileViewTracked = false;
  $: if (isMobile && !mobileNavTracked) {
    mobileNavTracked = true;
    gtmEvent('terminal_mobile_nav_impression', {
      tab: mobileTab,
      pair: $gameState.pair,
      timeframe: $gameState.timeframe,
    });
  }
  $: if (!isMobile && mobileNavTracked) mobileNavTracked = false;

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

  function isHorizontalResizeGesture(e: WheelEvent) {
    const absX = Math.abs(e.deltaX);
    const absY = Math.abs(e.deltaY);
    return absX >= 10 && absX > absY * 1.2;
  }

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
      tabletLeftWidth = getDefaultTabletLeftWidth();
      tabletBottomHeight = getDefaultTabletBottomHeight();
      return;
    }
    tabletLeftWidth = clampTabletLeftWidth(tabletLeftWidth);
    tabletBottomHeight = clampTabletBottomHeight(tabletBottomHeight);
  }

  async function fetchLiveTicker() {
    try {
      const [fgRes, cgRes] = await Promise.all([
        fetch('/api/feargreed?limit=1', { signal: AbortSignal.timeout(5000) }).then(r => r.json()).catch(() => null),
        fetch('/api/coingecko/global', { signal: AbortSignal.timeout(5000) }).then(r => r.json()).catch(() => null),
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
      tabletLeftWidth = getDefaultTabletLeftWidth();
      tabletBottomHeight = getDefaultTabletBottomHeight();
    }
    window.addEventListener('resize', handleResize);
    window.addEventListener('pointermove', onMobilePanelPointerMove, { passive: false });
    window.addEventListener('pointerup', finishMobilePanelDrag);
    window.addEventListener('pointercancel', finishMobilePanelDrag);
    window.addEventListener('touchmove', onMobilePanelTouchMove, { passive: false });
    window.addEventListener('touchend', finishMobilePanelTouchDrag);
    window.addEventListener('touchcancel', finishMobilePanelTouchDrag);
    window.addEventListener('pointermove', onTabletSplitPointerMove, { passive: false });
    window.addEventListener('pointerup', finishTabletSplitDrag);
    window.addEventListener('pointercancel', finishTabletSplitDrag);

    // ── Hydrate quick trades (터미널 페이지에서만 호출) ──
    void hydrateQuickTrades();

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
    finishMobilePanelDrag();
    finishMobilePanelTouchDrag();
    finishTabletSplitDrag();
    alertEngine.stop();
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointermove', onMobilePanelPointerMove);
      window.removeEventListener('pointerup', finishMobilePanelDrag);
      window.removeEventListener('pointercancel', finishMobilePanelDrag);
      window.removeEventListener('touchmove', onMobilePanelTouchMove);
      window.removeEventListener('touchend', finishMobilePanelTouchDrag);
      window.removeEventListener('touchcancel', finishMobilePanelTouchDrag);
      window.removeEventListener('pointermove', onTabletSplitPointerMove);
      window.removeEventListener('pointerup', finishTabletSplitDrag);
      window.removeEventListener('pointercancel', finishTabletSplitDrag);
    }
  });

  // Selected pair display
  $: pair = $gameState.pair || 'BTC/USDT';
  $: mobileMeta = MOBILE_TAB_META[mobileTab];
  $: mobileOpenTrades = $openTradeCount;
  $: mobileTrackedSignals = $activeSignalCount;

  function onTokenSelect(e: CustomEvent<{ pair: string }>) {
    gameState.update(s => ({ ...s, pair: e.detail.pair }));
    gtmEvent('terminal_pair_change_shell', {
      pair: e.detail.pair,
      source: isMobile ? 'mobile-topbar' : 'shell-token-control',
      timeframe: $gameState.timeframe,
    });
  }

  type WarRoomHandle = {
    triggerScanFromChart?: () => void;
  };
  type PatternScanScope = 'visible' | 'full';
  type PatternScanReport = {
    ok: boolean;
    scope: PatternScanScope;
    candleCount: number;
    patternCount: number;
    patterns: Array<{
      kind: 'head_and_shoulders' | 'falling_wedge';
      shortName: string;
      direction: 'BULLISH' | 'BEARISH';
      status: 'FORMING' | 'CONFIRMED';
      confidence: number;
      startTime: number;
      endTime: number;
    }>;
    message: string;
  };
  type ChartPanelHandle = {
    activateTradeDrawing?: (dir?: 'LONG' | 'SHORT') => Promise<void> | void;
    runPatternScanFromIntel?: (options?: { scope?: PatternScanScope; focus?: boolean }) => Promise<PatternScanReport>;
  };
  let warRoomRef: WarRoomHandle | null = null;
  let mobileChartRef: ChartPanelHandle | null = null;
  let tabletChartRef: ChartPanelHandle | null = null;
  let desktopChartRef: ChartPanelHandle | null = null;
  let pendingChartScan = false;

  function tryTriggerWarRoomScan(): boolean {
    if (!warRoomRef || typeof warRoomRef.triggerScanFromChart !== 'function') return false;
    warRoomRef.triggerScanFromChart();
    return true;
  }

  function handleChartScanRequest(e: CustomEvent<{ source?: string; pair?: string; timeframe?: string }>) {
    const detail = e.detail ?? {};
    gtmEvent('terminal_scan_request_shell', {
      source: detail.source || 'chart-panel',
      pair: detail.pair || $gameState.pair,
      timeframe: detail.timeframe || $gameState.timeframe,
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

  $: if (pendingChartScan && tryTriggerWarRoomScan()) {
    pendingChartScan = false;
  }

  // ── Agent Chat State ──
  interface ChatMsg {
    from: string;
    icon: string;
    color: string;
    text: string;
    time: string;
    isUser: boolean;
    isSystem?: boolean;
  }

  type ScanHighlight = {
    agent: string;
    vote: 'long' | 'short' | 'neutral';
    conf: number;
    note: string;
  };

  type ScanIntelDetail = {
    pair: string;
    timeframe: string;
    token: string;
    createdAt: number;
    label: string;
    consensus: 'long' | 'short' | 'neutral';
    avgConfidence: number;
    summary: string;
    highlights: ScanHighlight[];
  };

  let chatMessages: ChatMsg[] = [
    { from: 'SYSTEM', icon: '🤖', color: '#ffe600', text: 'Stockclaw Orchestrator v8 online. 8 agents standing by. Scan first, then ask questions about the results.', time: '—', isUser: false, isSystem: true },
    { from: 'ORCHESTRATOR', icon: '🧠', color: '#ff2d9b',
      text: '💡 Try these:\n• "BTC 전망 분석해줘" — I\'ll route to the right agents\n• "차트패턴 찾아봐" — 보이는 구간 패턴을 차트에 바로 표시\n• "@STRUCTURE MA, RSI 분석" — Direct to Structure agent\n• "@DERIV 펀딩 + OI 어때?" — Derivatives analysis\n• "@FLOW 고래 움직임?" — On-chain + whale flow\n• "@SENTI 소셜 센티먼트" — F&G + LunarCrush social\n• "@MACRO DXY, 금리 영향?" — Macro regime check',
      time: '—', isUser: false },
  ];
  let isTyping = false;
  let latestScan: ScanIntelDetail | null = null;
  type ChatTradeDirection = 'LONG' | 'SHORT';
  let chatTradeReady = false;
  let chatSuggestedDir: ChatTradeDirection = 'LONG';
  let chatFocusKey = 0;

  // 에이전트 정보 맵 (아이콘/컬러 lookup)
  const AGENT_META: Record<string, { icon: string; color: string }> = {};
  for (const ag of AGDEFS) AGENT_META[ag.name] = { icon: ag.icon, color: ag.color };
  AGENT_META['ORCHESTRATOR'] = { icon: '🧠', color: '#ff2d9b' };

  function inferSuggestedDirection(text: string): ChatTradeDirection | null {
    const lower = text.toLowerCase();
    let longScore = 0;
    let shortScore = 0;
    if (/\b(long|bull|bullish|breakout|uptrend|매수|롱|상승)\b/.test(lower)) longScore += 2;
    if (/\b(short|bear|bearish|breakdown|downtrend|매도|숏|하락)\b/.test(lower)) shortScore += 2;
    if (/\b(tp up|target up|higher high|support hold)\b/.test(lower)) longScore += 1;
    if (/\b(tp down|target down|lower low|resistance reject)\b/.test(lower)) shortScore += 1;
    if (longScore === shortScore) return null;
    return longScore > shortScore ? 'LONG' : 'SHORT';
  }

  function detectMentionedAgentLocal(text: string): string | null {
    const mention = text.match(/@([a-z0-9_]+)/i);
    if (!mention) return null;
    const token = String(mention[1] || '').toUpperCase();
    const exact = AGDEFS.find((ag) => ag.name.toUpperCase() === token);
    if (exact) return exact.name;
    if (token === 'ORCHESTRATOR' || token === 'SYSTEM' || token === 'AGENT') return 'ORCHESTRATOR';
    if (token === 'SENTIMENT') return 'SENTI';
    if (token === 'VALUE') return 'VALUATION';
    return null;
  }

  function inferAgentFromIntentLocal(text: string): string {
    const lower = text.toLowerCase();
    if (/차트|candle|캔들|패턴|pattern|bos|choch|ob|fvg|support|resist|지지|저항|추세|trend|구조|structure/.test(lower)) return 'STRUCTURE';
    if (/파생|deriv|펀딩|funding|oi|open.?interest|청산|liquid|옵션|option|선물|futures|숏|롱|레버/.test(lower)) return 'DERIV';
    if (/온체인|on.?chain|mvrv|nupl|sopr|nvt|valuation|밸류|네트워크|network|active.?addr|whale|고래/.test(lower)) return 'VALUATION';
    if (/자금|flow|플로우|넷플로우|netflow|거래소|exchange|inflow|outflow|유입|유출|이동/.test(lower)) return 'FLOW';
    if (/거래량|volume|볼륨|cvd|delta|vwap|profile|흡수|absorption/.test(lower)) return 'VPA';
    if (/스마트.?머니|smart.?money|ict|유동성|imbalance|breaker|mitigation/.test(lower)) return 'ICT';
    if (/센티|senti|감정|공포|탐욕|fear|greed|소셜|social|여론|분위기/.test(lower)) return 'SENTI';
    if (/매크로|macro|경제|금리|interest.?rate|연준|fed|cpi|gdp|달러|dollar|dxy|국채/.test(lower)) return 'MACRO';
    return 'ORCHESTRATOR';
  }

  type ChatErrorKind = 'network' | 'timeout' | 'llm_unavailable' | 'server_error' | 'unknown';

  function classifyError(statusLabel: string, err?: unknown): ChatErrorKind {
    const label = statusLabel.toLowerCase();
    if (err instanceof DOMException && err.name === 'TimeoutError') return 'timeout';
    if (label === 'network' || label.includes('failed to fetch') || label.includes('networkerror')) return 'network';
    if (label.startsWith('503') || label.includes('llm') || label.includes('provider')) return 'llm_unavailable';
    if (label.startsWith('5')) return 'server_error';
    if (label === 'timeout' || label.includes('timeout') || label.includes('abort')) return 'timeout';
    return 'unknown';
  }

  const ERROR_MESSAGES: Record<ChatErrorKind, string> = {
    network: '네트워크 연결이 끊어졌습니다. Wi-Fi/인터넷 상태를 확인해주세요.',
    timeout: 'LLM 응답이 20초를 초과했습니다. 서버 부하가 높거나 프롬프트가 길 수 있습니다. 잠시 후 다시 시도해주세요.',
    llm_unavailable: 'LLM 프로바이더에 연결할 수 없습니다. Settings에서 API 키(Groq/Gemini/DeepSeek)가 설정되어 있는지 확인해주세요.',
    server_error: '서버 내부 오류가 발생했습니다. 잠시 후 재시도해주세요.',
    unknown: '알 수 없는 오류가 발생했습니다.',
  };

  // Chat connection status for UI dot indicator
  let chatConnectionStatus: 'connected' | 'degraded' | 'disconnected' = 'connected';
  let lastChatSuccess = 0;

  function buildOfflineAgentReply(userText: string, statusLabel: string, err?: unknown): { sender: string; text: string; tradeDir: ChatTradeDirection | null } {
    const sender = detectMentionedAgentLocal(userText) || inferAgentFromIntentLocal(userText);
    const pair = $gameState.pair || 'BTC/USDT';
    const timeframe = ($gameState.timeframe || '4h').toUpperCase();
    const errorKind = classifyError(statusLabel, err);

    // Update connection status
    if (errorKind === 'network' || errorKind === 'llm_unavailable') {
      chatConnectionStatus = 'disconnected';
    } else {
      chatConnectionStatus = 'degraded';
    }

    const scanSummary = latestScan
      ? `최근 스캔: ${latestScan.pair} ${latestScan.timeframe.toUpperCase()} ${String(latestScan.consensus).toUpperCase()} ${Math.round(latestScan.avgConfidence)}%`
      : '';
    const tradeDirFromQuestion = inferSuggestedDirection(userText);
    const tradeDirFromScan = latestScan?.consensus === 'long'
      ? 'LONG'
      : latestScan?.consensus === 'short'
        ? 'SHORT'
        : null;
    const tradeDir = tradeDirFromQuestion || tradeDirFromScan;
    const tradeHint = tradeDir
      ? `\n💡 ${tradeDir} 관점 참고. START ${tradeDir}로 드래그 진입 가능.`
      : '';

    return {
      sender,
      tradeDir,
      text:
        `⚠️ ${ERROR_MESSAGES[errorKind]}\n` +
        `${pair} ${timeframe} 기준 로컬 폴백 응답입니다.` +
        (scanSummary ? `\n${scanSummary}` : '') +
        tradeHint,
    };
  }

  function isPatternScanIntent(text: string): boolean {
    const lower = text.toLowerCase();
    const compact = lower.replace(/\s+/g, '');
    if (compact.includes('차트패턴찾아봐')) return true;

    const hasPatternKeyword =
      /(차트패턴|패턴|헤드앤숄더|헤드숄더|하락쐐기|headandshoulders|fallingwedge|wedge|pattern)/.test(compact);
    const hasActionKeyword = /(찾|분석|스캔|봐|보여|detect|scan|find|show|draw)/.test(compact);
    return hasPatternKeyword && hasActionKeyword;
  }

  function patternKindLabel(kind: PatternScanReport['patterns'][number]['kind']): string {
    return kind === 'head_and_shoulders' ? '헤드앤숄더' : '하락쐐기';
  }

  function patternStatusLabel(status: PatternScanReport['patterns'][number]['status']): string {
    return status === 'CONFIRMED' ? '확정' : '형성중';
  }

  function formatPatternChatReply(report: PatternScanReport): string {
    const scopeLabel = report.scope === 'visible' ? '보이는 구간' : '전체 구간';
    if (report.patternCount === 0) {
      return `패턴 스캔 완료 (${scopeLabel}, ${report.candleCount}봉)\n결과: 조건에 맞는 패턴이 없습니다. 줌아웃 후 다시 시도해보세요.`;
    }
    const top = report.patterns
      .slice(0, 2)
      .map((p) => `• ${patternKindLabel(p.kind)} ${patternStatusLabel(p.status)} ${(p.confidence * 100).toFixed(0)}%`)
      .join('\n');
    return `패턴 스캔 완료 (${scopeLabel}, ${report.candleCount}봉)\n${top}\n차트에 가이드 라인을 표시했습니다.`;
  }

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

  function handleChartChatRequest(e: CustomEvent<{ source?: string; pair?: string; timeframe?: string }>) {
    const detail = e.detail ?? {};
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

  async function handleSendChat(e: CustomEvent<{ text: string }>) {
    const text = e.detail.text;
    if (!text.trim()) return;
    const now = new Date();
    const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;

    // 유저 메시지 즉시 표시
    chatMessages = [...chatMessages, { from: 'YOU', icon: '🐕', color: '#ffe600', text, time, isUser: true }];
    isTyping = true;

    // 멘션된 에이전트 감지 (없으면 서버에서 ORCHESTRATOR로 기본 처리)
    const agent = AGDEFS.find(ag => text.toLowerCase().includes(`@${ag.name.toLowerCase()}`));
    const mentionedAgent = agent?.name || undefined;
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
        signal: AbortSignal.timeout(20000), // 20s timeout for LLM responses
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
        const offline = buildOfflineAgentReply(text, statusLabel);
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
      const offline = buildOfflineAgentReply(text, errorLabel, err);
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

  function handleScanComplete(e: CustomEvent<ScanIntelDetail>) {
    // 스캔 컨텍스트만 저장 (채팅에 LLM이 참조할 수 있도록)
    // 스캔 결과를 채팅에 직접 표시하지 않음
    latestScan = e.detail;
  }
</script>

<div class="terminal-shell">
  <div class="term-stars" aria-hidden="true"></div>
  <div class="term-stars term-stars-soft" aria-hidden="true"></div>
  <div class="term-grain" aria-hidden="true"></div>

  <!-- ═══ MOBILE LAYOUT ═══ -->
  {#if isMobile}
  <div class="terminal-mobile">
    {#if mobileTab !== 'chart'}
      <div class="mob-topbar">
        <div class="mob-topline">
          <div class="mob-title-wrap">
            <span class="mob-eyebrow">TERMINAL MOBILE</span>
            <span class="mob-title">{mobileMeta.label}</span>
          </div>
          <span class="mob-live"><span class="ctb-dot"></span>LIVE</span>
        </div>
        <div class="mob-meta">
          <div class="mob-token">
            <TokenDropdown value={pair} compact on:select={onTokenSelect} />
          </div>
          <span class="mob-meta-chip">{formatTimeframeLabel($gameState.timeframe)}</span>
        </div>
        <div class="mob-desc">{mobileMeta.desc}</div>
      </div>
    {/if}

    <div class="mob-content" class:chart-only={mobileTab === 'chart'}>
      {#if mobileTab === 'warroom'}
        <div class="mob-panel-wrap mob-panel-resizable" style={getMobilePanelStyle('warroom')}>
          <WarRoom bind:this={warRoomRef} on:scancomplete={handleScanComplete} />
          <button
            type="button"
            class="mob-resize-handle mob-resize-handle-x"
            title="좌우 크기 조절: 스크롤 / 더블클릭 초기화"
            aria-label="Resize war room panel width with scroll"
            on:wheel={(e) => resizeMobilePanelByWheel('warroom', 'x', e)}
            on:pointerdown={(e) => startMobilePanelDrag('warroom', 'x', e)}
            on:touchstart={(e) => startMobilePanelTouchDrag('warroom', 'x', e)}
            on:dblclick={() => resetMobilePanelSize('warroom')}
          ></button>
          <button
            type="button"
            class="mob-resize-handle mob-resize-handle-y"
            title="위아래 크기 조절: 스크롤 / 더블클릭 초기화"
            aria-label="Resize war room panel height with scroll"
            on:wheel={(e) => resizeMobilePanelByWheel('warroom', 'y', e)}
            on:pointerdown={(e) => startMobilePanelDrag('warroom', 'y', e)}
            on:touchstart={(e) => startMobilePanelTouchDrag('warroom', 'y', e)}
            on:dblclick={() => resetMobilePanelSize('warroom')}
          ></button>
        </div>
      {:else if mobileTab === 'chart'}
        <div class="mob-chart-stack">
          <div class="mob-chart-section mob-panel-resizable" style={getMobilePanelStyle('chart')}>
            <div class="mob-chart-area">
              <ChartPanel
                bind:this={mobileChartRef}
                advancedMode
                enableTradeLineEntry
                uiPreset="tradingview"
                requireTradeConfirm
                chatFirstMode
                {chatTradeReady}
                chatTradeDir={chatSuggestedDir}
                on:scanrequest={handleChartScanRequest}
                on:chatrequest={handleChartChatRequest}
              />
            </div>
            <button
              type="button"
              class="mob-resize-handle mob-resize-handle-x"
              title="좌우 크기 조절: 스크롤 / 더블클릭 초기화"
              aria-label="Resize chart panel width with scroll"
              on:wheel={(e) => resizeMobilePanelByWheel('chart', 'x', e)}
              on:pointerdown={(e) => startMobilePanelDrag('chart', 'x', e)}
              on:touchstart={(e) => startMobilePanelTouchDrag('chart', 'x', e)}
              on:dblclick={() => resetMobilePanelSize('chart')}
            ></button>
            <button
              type="button"
              class="mob-resize-handle mob-resize-handle-y"
              title="위아래 크기 조절: 스크롤 / 더블클릭 초기화"
              aria-label="Resize chart panel height with scroll"
              on:wheel={(e) => resizeMobilePanelByWheel('chart', 'y', e)}
              on:pointerdown={(e) => startMobilePanelDrag('chart', 'y', e)}
              on:touchstart={(e) => startMobilePanelTouchDrag('chart', 'y', e)}
            on:dblclick={() => resetMobilePanelSize('chart')}
          ></button>
          </div>
        </div>
      {:else if mobileTab === 'intel'}
        <div class="mob-panel-wrap mob-panel-resizable" style={getMobilePanelStyle('intel')}>
          <IntelPanel
            {chatMessages}
            {isTyping}
            {latestScan}
            prioritizeChat
            {chatTradeReady}
            {chatFocusKey}
            {chatConnectionStatus}
            on:sendchat={handleSendChat}
            on:gototrade={handleIntelGoTrade}
          />
          <button
            type="button"
            class="mob-resize-handle mob-resize-handle-x"
            title="좌우 크기 조절: 스크롤 / 더블클릭 초기화"
            aria-label="Resize intel panel width with scroll"
            on:wheel={(e) => resizeMobilePanelByWheel('intel', 'x', e)}
            on:pointerdown={(e) => startMobilePanelDrag('intel', 'x', e)}
            on:touchstart={(e) => startMobilePanelTouchDrag('intel', 'x', e)}
            on:dblclick={() => resetMobilePanelSize('intel')}
          ></button>
          <button
            type="button"
            class="mob-resize-handle mob-resize-handle-y"
            title="위아래 크기 조절: 스크롤 / 더블클릭 초기화"
            aria-label="Resize intel panel height with scroll"
            on:wheel={(e) => resizeMobilePanelByWheel('intel', 'y', e)}
            on:pointerdown={(e) => startMobilePanelDrag('intel', 'y', e)}
            on:touchstart={(e) => startMobilePanelTouchDrag('intel', 'y', e)}
            on:dblclick={() => resetMobilePanelSize('intel')}
          ></button>
        </div>
      {/if}
    </div>

    <div class="mob-bottom-nav">
      <button class="mob-nav-btn" class:active={mobileTab === 'warroom'} on:click={() => setMobileTab('warroom')}>
        <span class="mob-nav-label">WAR ROOM</span>
        {#if mobileOpenTrades > 0}
          <span class="mob-nav-badge">{mobileOpenTrades > 9 ? '9+' : mobileOpenTrades}</span>
        {/if}
      </button>
      <button class="mob-nav-btn" class:active={mobileTab === 'chart'} on:click={() => setMobileTab('chart')}>
        <span class="mob-nav-label">CHART</span>
      </button>
      <button class="mob-nav-btn" class:active={mobileTab === 'intel'} on:click={() => setMobileTab('intel')}>
        <span class="mob-nav-label">CHAT</span>
        {#if mobileTrackedSignals > 0}
          <span class="mob-nav-badge">{mobileTrackedSignals > 9 ? '9+' : mobileTrackedSignals}</span>
        {/if}
      </button>
    </div>
  </div>

  <!-- ═══ TABLET LAYOUT (no side resizers, stacked) ═══ -->
  {:else if isTablet}
  <div class="terminal-tablet" style={tabletLayoutStyle}>
    <div class="tab-top">
      <div class="tab-left">
        <div class="tab-panel-resizable" style={getTabletPanelStyle('left')}>
          <div class="tab-panel-body">
            <WarRoom bind:this={warRoomRef} on:scancomplete={handleScanComplete} />
          </div>
          <button
            type="button"
            class="tab-resize-handle tab-resize-handle-x"
            title="WAR ROOM 좌우 크기 조절: 스크롤 / 더블클릭 초기화"
            aria-label="Resize tablet war room width with scroll"
            on:wheel={(e) => resizeTabletPanelByWheel('left', 'x', e)}
            on:pointerdown={(e) => startTabletSplitDrag('x', e)}
            on:dblclick={() => resetTabletPanelSize('left')}
          ></button>
          <button
            type="button"
            class="tab-resize-handle tab-resize-handle-y"
            title="WAR ROOM 위아래 크기 조절: 스크롤 / 더블클릭 초기화"
            aria-label="Resize tablet war room height with scroll"
            on:wheel={(e) => resizeTabletPanelByWheel('left', 'y', e)}
            on:pointerdown={(e) => startTabletSplitDrag('y', e)}
            on:dblclick={() => resetTabletPanelSize('left')}
          ></button>
        </div>
      </div>
      <button
        type="button"
        class="tab-layout-split tab-layout-split-v"
        title="WAR ROOM / CHART 분할 조절: 스크롤/드래그/더블클릭 리셋"
        aria-label="Resize tablet left and chart split"
        on:wheel={(e) => resizeTabletPanelByWheel('left', 'x', e)}
        on:pointerdown={(e) => startTabletSplitDrag('x', e)}
        on:dblclick={() => resetTabletPanelSize('left')}
      >
        <span></span>
      </button>
      <div class="tab-center">
        <div class="tab-panel-resizable" style={getTabletPanelStyle('center')}>
          <div class="tab-panel-body tab-chart-area">
            <ChartPanel
              bind:this={tabletChartRef}
              advancedMode
              enableTradeLineEntry
              uiPreset="tradingview"
              requireTradeConfirm
              chatFirstMode
              {chatTradeReady}
              chatTradeDir={chatSuggestedDir}
              on:scanrequest={handleChartScanRequest}
              on:chatrequest={handleChartChatRequest}
            />
          </div>
          <button
            type="button"
            class="tab-resize-handle tab-resize-handle-x"
            title="CHART 좌우 크기 조절: 스크롤 / 더블클릭 초기화"
            aria-label="Resize tablet chart width with scroll"
            on:wheel={(e) => resizeTabletPanelByWheel('center', 'x', e)}
            on:pointerdown={(e) => startTabletSplitDrag('x', e)}
            on:dblclick={() => resetTabletPanelSize('center')}
          ></button>
          <button
            type="button"
            class="tab-resize-handle tab-resize-handle-y"
            title="CHART 위아래 크기 조절: 스크롤 / 더블클릭 초기화"
            aria-label="Resize tablet chart height with scroll"
            on:wheel={(e) => resizeTabletPanelByWheel('center', 'y', e)}
            on:pointerdown={(e) => startTabletSplitDrag('y', e)}
            on:dblclick={() => resetTabletPanelSize('center')}
          ></button>
        </div>
      </div>
    </div>
    <button
      type="button"
      class="tab-layout-split tab-layout-split-h"
      title="CHART / INTEL 높이 조절: 스크롤/드래그/더블클릭 리셋"
      aria-label="Resize tablet chart and intel split"
      on:wheel={(e) => resizeTabletPanelByWheel('bottom', 'y', e)}
      on:pointerdown={(e) => startTabletSplitDrag('y', e)}
      on:dblclick={() => resetTabletPanelSize('bottom')}
    >
      <span></span>
    </button>
    <div class="tab-bottom">
      <div class="tab-panel-resizable" style={getTabletPanelStyle('bottom')}>
        <div class="tab-panel-body">
          <IntelPanel
            {chatMessages}
            {isTyping}
            {latestScan}
            {chatTradeReady}
            {chatFocusKey}
            {chatConnectionStatus}
            on:sendchat={handleSendChat}
            on:gototrade={handleIntelGoTrade}
          />
        </div>
        <button
          type="button"
          class="tab-resize-handle tab-resize-handle-x"
          title="좌우 패널 비율 조절: 스크롤 / 더블클릭 초기화"
          aria-label="Resize tablet left and chart split with scroll"
          on:wheel={(e) => resizeTabletPanelByWheel('left', 'x', e)}
          on:pointerdown={(e) => startTabletSplitDrag('x', e)}
          on:dblclick={() => resetTabletPanelSize('left')}
        ></button>
        <button
          type="button"
            class="tab-resize-handle tab-resize-handle-y"
            title="INTEL 위아래 크기 조절: 스크롤 / 더블클릭 초기화"
            aria-label="Resize tablet intel height with scroll"
            on:wheel={(e) => resizeTabletPanelByWheel('bottom', 'y', e)}
            on:pointerdown={(e) => startTabletSplitDrag('y', e)}
            on:dblclick={() => resetTabletPanelSize('bottom')}
          ></button>
      </div>
    </div>

    <div class="ticker-bar">
      <div class="ticker-inner">
        <span class="ticker-text">{TICKER_STR}</span>
        <span class="ticker-text" aria-hidden="true">{TICKER_STR}</span>
      </div>
    </div>
  </div>

  <!-- ═══ DESKTOP LAYOUT (full 3-panel with resizers) ═══ -->
  {:else}
  <div class="terminal-page" bind:this={containerEl}
    style="grid-template-columns: {leftCollapsed ? 30 : leftW}px 4px 1fr 4px {rightCollapsed ? 30 : rightW}px">

    <!-- Left: WAR ROOM or collapsed strip -->
    {#if !leftCollapsed}
      <div class="tl" on:wheel={(e) => resizePanelByWheel('left', e)}>
        <div class="desk-panel-resizable" style={getDesktopPanelStyle('left')}>
          <div class="desk-panel-body">
            <WarRoom bind:this={warRoomRef} on:collapse={toggleLeft} on:scancomplete={handleScanComplete} />
          </div>
          <button
            type="button"
            class="desk-resize-handle desk-resize-handle-x"
            title="WAR ROOM 좌우 크기 조절: 스크롤 / 더블클릭 초기화"
            aria-label="Resize war room panel width with scroll"
            on:wheel={(e) => resizeDesktopPanelByWheel('left', 'x', e)}
            on:dblclick={() => resetDesktopPanelSize('left')}
          ></button>
          <button
            type="button"
            class="desk-resize-handle desk-resize-handle-y"
            title="WAR ROOM 위아래 크기 조절: 스크롤 / 더블클릭 초기화"
            aria-label="Resize war room panel height with scroll"
            on:wheel={(e) => resizeDesktopPanelByWheel('left', 'y', e)}
            on:dblclick={() => resetDesktopPanelSize('left')}
          ></button>
        </div>
      </div>
    {:else}
      <button
        class="panel-strip panel-strip-left"
        on:click={toggleLeft}
        on:wheel={(e) => resizePanelByWheel('left', e, { force: true })}
        title="Show War Room"
      >
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="1" y="2" width="14" height="12" rx="1.5"/>
          <line x1="6" y1="2" x2="6" y2="14"/>
        </svg>
        <span class="strip-label">WAR</span>
      </button>
    {/if}

    <!-- Left Resizer (drag only, no toggle) -->
    {#if !leftCollapsed}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="resizer resizer-h resizer-left" on:wheel={(e) => resizePanelByWheel('left', e, { force: true })} title="스크롤/드래그로 WAR ROOM 너비 조절">
        <div class="resizer-drag" on:mousedown={(e) => startDrag('left', e)}></div>
      </div>
    {:else}
      <div class="resizer-spacer"></div>
    {/if}

    <!-- Center: Chart -->
    <div class="tc">
      <div class="desk-panel-resizable" style={getDesktopPanelStyle('center')}>
        <div class="desk-panel-body">
          <div class="chart-area chart-area-full">
            <ChartPanel
              bind:this={desktopChartRef}
              advancedMode
              enableTradeLineEntry
              uiPreset="tradingview"
              requireTradeConfirm
              chatFirstMode
              {chatTradeReady}
              chatTradeDir={chatSuggestedDir}
              on:scanrequest={handleChartScanRequest}
              on:chatrequest={handleChartChatRequest}
            />
          </div>
        </div>
        <button
          type="button"
          class="desk-resize-handle desk-resize-handle-x"
          title="CHART 좌우 크기 조절: 스크롤 / 더블클릭 초기화"
          aria-label="Resize chart panel width with scroll"
          on:wheel={(e) => resizeDesktopPanelByWheel('center', 'x', e)}
          on:dblclick={() => resetDesktopPanelSize('center')}
        ></button>
        <button
          type="button"
          class="desk-resize-handle desk-resize-handle-y"
          title="CHART 위아래 크기 조절: 스크롤 / 더블클릭 초기화"
          aria-label="Resize chart panel height with scroll"
          on:wheel={(e) => resizeDesktopPanelByWheel('center', 'y', e)}
          on:dblclick={() => resetDesktopPanelSize('center')}
        ></button>
      </div>
    </div>

    <!-- Right Resizer (drag only, no toggle) -->
    {#if !rightCollapsed}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="resizer resizer-h resizer-right" on:wheel={(e) => resizePanelByWheel('right', e, { force: true })} title="스크롤/드래그로 INTEL 너비 조절">
        <div class="resizer-drag" on:mousedown={(e) => startDrag('right', e)}></div>
      </div>
    {:else}
      <div class="resizer-spacer"></div>
    {/if}

    <!-- Right: Intel Panel or collapsed strip -->
    {#if !rightCollapsed}
      <div class="tr" on:wheel={(e) => resizePanelByWheel('right', e)}>
        <div class="desk-panel-resizable" style={getDesktopPanelStyle('right')}>
          <div class="desk-panel-body">
            <IntelPanel
              {chatMessages}
              {isTyping}
              {latestScan}
              {chatTradeReady}
              {chatFocusKey}
              on:sendchat={handleSendChat}
              on:gototrade={handleIntelGoTrade}
              on:collapse={toggleRight}
            />
          </div>
          <button
            type="button"
            class="desk-resize-handle desk-resize-handle-x"
            title="INTEL 좌우 크기 조절: 스크롤 / 더블클릭 초기화"
            aria-label="Resize intel panel width with scroll"
            on:wheel={(e) => resizeDesktopPanelByWheel('right', 'x', e)}
            on:dblclick={() => resetDesktopPanelSize('right')}
          ></button>
          <button
            type="button"
            class="desk-resize-handle desk-resize-handle-y"
            title="INTEL 위아래 크기 조절: 스크롤 / 더블클릭 초기화"
            aria-label="Resize intel panel height with scroll"
            on:wheel={(e) => resizeDesktopPanelByWheel('right', 'y', e)}
            on:dblclick={() => resetDesktopPanelSize('right')}
          ></button>
        </div>
      </div>
    {:else}
      <button
        class="panel-strip panel-strip-right"
        on:click={toggleRight}
        on:wheel={(e) => resizePanelByWheel('right', e, { force: true })}
        title="Show Intel"
      >
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="1" y="2" width="14" height="12" rx="1.5"/>
          <line x1="10" y1="2" x2="10" y2="14"/>
        </svg>
        <span class="strip-label">INTEL</span>
      </button>
    {/if}

    <!-- Ticker -->
    <div class="ticker-bar">
      <div class="ticker-inner">
        <span class="ticker-text">{TICKER_STR}</span>
        <span class="ticker-text" aria-hidden="true">{TICKER_STR}</span>
      </div>
    </div>

    <!-- Drag Overlay (prevents iframes/canvas from eating events) -->
    {#if dragTarget}
      <div class="drag-overlay col"></div>
    {/if}
  </div>
  {/if}
</div>

<!-- Copy Trade Modal (shared across all layouts) -->
<CopyTradeModal />

<style>
  .terminal-shell {
    --term-bg: #0a1a0d;
    --term-bg2: #0f2614;
    --term-bg3: #143620;
    --term-accent: #e8967d;
    --term-accent-soft: #f5c4b8;
    --term-live: #87dcbe;
    --term-danger: #d86b79;
    --term-text: #f0ede4;
    --term-text-dim: rgba(240, 237, 228, 0.56);
    --term-border: rgba(232, 150, 125, 0.2);
    --term-border-soft: rgba(232, 150, 125, 0.12);
    --term-panel: rgba(13, 35, 22, 0.9);
    --term-panel-2: rgba(10, 27, 17, 0.92);

    /* Override legacy terminal globals inside this route only */
    --yel: var(--term-accent);
    --pk: var(--term-accent);
    --grn: var(--term-live);
    --red: var(--term-danger);
    --ora: #d8a266;
    --cyan: #9fd5cb;
    --blk: #0a1a0d;

    position: absolute;
    inset: 0;
    width: auto;
    height: auto;
    min-height: 0;
    overflow: hidden;
    overflow-x: clip;
    overscroll-behavior: none;
    isolation: isolate;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    background:
      radial-gradient(110% 72% at 15% 0%, rgba(232, 150, 125, 0.1) 0%, rgba(232, 150, 125, 0) 58%),
      radial-gradient(96% 68% at 88% 6%, rgba(135, 220, 190, 0.14) 0%, rgba(135, 220, 190, 0) 62%),
      linear-gradient(180deg, var(--term-bg2) 0%, var(--term-bg) 72%);
  }
  .terminal-shell::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background:
      linear-gradient(180deg, rgba(240, 237, 228, 0.03) 0%, rgba(240, 237, 228, 0) 24%),
      repeating-linear-gradient(
        0deg,
        transparent 0,
        transparent 2px,
        rgba(0, 0, 0, 0.14) 2px,
        rgba(0, 0, 0, 0.14) 3px
      );
    opacity: 0.52;
  }
  .term-stars,
  .term-grain {
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
  }
  .term-stars {
    background:
      radial-gradient(1px 1px at 10% 15%, rgba(255, 255, 255, 0.65) 50%, transparent 50%),
      radial-gradient(1.2px 1.2px at 35% 30%, rgba(255, 255, 255, 0.5) 50%, transparent 50%),
      radial-gradient(1px 1px at 52% 8%, rgba(255, 255, 255, 0.45) 50%, transparent 50%),
      radial-gradient(1px 1px at 76% 46%, rgba(255, 255, 255, 0.6) 50%, transparent 50%),
      radial-gradient(1.2px 1.2px at 84% 18%, rgba(255, 255, 255, 0.42) 50%, transparent 50%),
      radial-gradient(1px 1px at 18% 64%, rgba(255, 255, 255, 0.5) 50%, transparent 50%),
      radial-gradient(1px 1px at 64% 74%, rgba(255, 255, 255, 0.38) 50%, transparent 50%),
      radial-gradient(1.3px 1.3px at 93% 82%, rgba(255, 255, 255, 0.56) 50%, transparent 50%);
    background-size: 320px 320px;
    opacity: 0.45;
  }
  .term-stars-soft {
    background:
      radial-gradient(1px 1px at 22% 22%, rgba(135, 220, 190, 0.55) 50%, transparent 50%),
      radial-gradient(1px 1px at 68% 36%, rgba(135, 220, 190, 0.45) 50%, transparent 50%),
      radial-gradient(1.5px 1.5px at 78% 66%, rgba(135, 220, 190, 0.45) 50%, transparent 50%),
      radial-gradient(1px 1px at 42% 84%, rgba(135, 220, 190, 0.35) 50%, transparent 50%);
    background-size: 520px 520px;
    opacity: 0.38;
    animation: termTwinkle 4.2s ease-in-out infinite alternate;
  }
  @keyframes termTwinkle {
    0% { opacity: 0.26; }
    100% { opacity: 0.52; }
  }
  .term-grain {
    opacity: 0.03;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size: 200px 200px;
    animation: termGrainShift 0.3s steps(3) infinite;
  }
  @keyframes termGrainShift {
    0% { transform: translate(0, 0); }
    33% { transform: translate(-1px, 1px); }
    66% { transform: translate(1px, -1px); }
    100% { transform: translate(0, 0); }
  }

  .terminal-page,
  .terminal-mobile,
  .terminal-tablet {
    position: relative;
    z-index: 1;
  }

  /* ═══════════════════════════════════════════
     DESKTOP — Full 5-column grid with resizers
     ═══════════════════════════════════════════ */
  .terminal-page {
    display: grid;
    grid-template-columns: 280px 4px 1fr 4px 300px; /* overridden by inline style */
    grid-template-rows: 1fr auto;
    height: 100%;
    overflow: hidden;
    overflow-x: clip;
    background: linear-gradient(180deg, var(--term-panel) 0%, var(--term-panel-2) 100%);
    box-shadow: inset 0 0 0 1px var(--term-border-soft);
  }
  .ticker-bar {
    grid-column: 1 / -1;
  }
  .tl,
  .tr,
  .tc {
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    min-width: 0;
    min-height: 0;
  }
  .tab-left {
    overflow-y: auto;
    overflow-x: hidden;
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-y: contain;
    min-width: 0;
  }
  .tl {
    grid-row: 1;
    grid-column: 1;
  }
  .tr {
    grid-row: 1;
    grid-column: 5;
  }
  .tab-left::-webkit-scrollbar { width: 3px; }
  .tab-left::-webkit-scrollbar-track { background: transparent; }
  .tab-left::-webkit-scrollbar-thumb {
    background: rgba(232, 150, 125, 0.45);
    border-radius: 2px;
  }

  .tc {
    grid-row: 1;
    grid-column: 3;
    flex-direction: column;
  }

  .desk-panel-resizable {
    --desk-panel-width: 100%;
    --desk-panel-height: 100%;
    position: relative;
    width: min(100%, var(--desk-panel-width));
    height: min(100%, var(--desk-panel-height));
    min-width: 0;
    min-height: 0;
    margin: auto;
    display: flex;
    flex-direction: column;
    transition: width .16s ease, height .16s ease, box-shadow .16s ease, border-color .16s ease;
    border: 1px solid transparent;
    border-radius: 8px;
  }
  .desk-panel-resizable:hover,
  .desk-panel-resizable:focus-within {
    border-color: rgba(232, 150, 125, 0.24);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.2);
  }
  .desk-panel-body {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .desk-resize-handle {
    position: absolute;
    z-index: 18;
    border: 0;
    background: transparent;
    padding: 0;
    margin: 0;
    opacity: 0.42;
    transition: opacity .12s ease;
  }
  .desk-resize-handle::before {
    content: '';
    position: absolute;
    inset: 50% auto auto 50%;
    transform: translate(-50%, -50%);
    border-radius: 999px;
    background: rgba(245, 196, 184, 0.45);
  }
  .desk-resize-handle:hover,
  .desk-resize-handle:focus-visible {
    opacity: 0.92;
    outline: none;
  }
  .desk-resize-handle-x {
    top: 12px;
    right: 0;
    width: 12px;
    height: calc(100% - 24px);
    cursor: ew-resize;
  }
  .desk-resize-handle-x::before {
    width: 2px;
    height: 46%;
  }
  .desk-resize-handle-y {
    left: 12px;
    bottom: 0;
    width: calc(100% - 24px);
    height: 12px;
    cursor: ns-resize;
  }
  .desk-resize-handle-y::before {
    width: 46%;
    height: 2px;
  }

  /* Shared live status dot */
  .ctb-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--term-live);
    box-shadow: 0 0 8px rgba(135, 220, 190, 0.8);
    animation: blink-dot 0.9s infinite;
  }
  @keyframes blink-dot {
    0%,100% { opacity: 1; }
    50% { opacity: .2; }
  }

  .chart-area {
    flex: 1;
    overflow: hidden;
    min-height: 180px;
  }
  .chart-area-full { flex: 1; }

  /* ── Resizers ── */
  .resizer {
    position: relative;
    z-index: 20;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    grid-row: 1;
  }
  .resizer-left { grid-column: 2; }
  .resizer-right { grid-column: 4; }
  .resizer-h {
    width: 4px;
    background: rgba(10, 24, 16, 0.82);
    border-left: 1px solid rgba(232, 150, 125, 0.1);
    border-right: 1px solid rgba(232, 150, 125, 0.1);
    transition: background .15s, border-color .15s;
  }
  .resizer-h:hover {
    background: rgba(232, 150, 125, 0.1);
    border-left-color: var(--term-border);
    border-right-color: var(--term-border);
  }
  .resizer-spacer {
    width: 1px;
    grid-row: 1;
  }
  .resizer-spacer:nth-of-type(1) { grid-column: 2; }

  .panel-strip {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    padding: 7px 0;
    background: rgba(12, 29, 19, 0.95);
    border: none;
    cursor: pointer;
    transition: background .15s;
    grid-row: 1;
  }
  .panel-strip:hover { background: rgba(232, 150, 125, 0.08); }
  .panel-strip svg {
    color: rgba(245, 196, 184, 0.62);
    transition: color .15s;
  }
  .panel-strip:hover svg { color: var(--term-accent-soft); }
  .strip-label {
    writing-mode: vertical-rl;
    font-family: var(--fm);
    font-size: 8px;
    font-weight: 900;
    letter-spacing: 1.8px;
    color: rgba(245, 196, 184, 0.62);
    transition: color .15s;
  }
  .panel-strip:hover .strip-label { color: rgba(245, 196, 184, 0.8); }
  .panel-strip-left {
    grid-column: 1;
    border-right: 1px solid var(--term-border);
  }
  .panel-strip-right {
    grid-column: 5;
    border-left: 1px solid var(--term-border);
  }

  .resizer-drag {
    position: absolute;
    inset: 0;
    cursor: col-resize;
  }

  /* Drag Overlay */
  .drag-overlay {
    position: absolute;
    inset: 0;
    z-index: 100;
  }
  .drag-overlay.col { cursor: col-resize; }

  /* ═══════════════════════════════════════════
     TICKER BAR — shared across all layouts
     ═══════════════════════════════════════════ */
  .ticker-bar {
    height: 22px;
    background: linear-gradient(180deg, rgba(15, 40, 24, 0.95) 0%, rgba(10, 27, 17, 0.98) 100%);
    border-top: 1px solid var(--term-border);
    overflow: hidden;
    position: relative;
    flex-shrink: 0;
  }
  .ticker-inner {
    display: flex;
    white-space: nowrap;
    animation: tickerScroll 40s linear infinite;
    will-change: transform;
    contain: layout style;
  }
  .ticker-text {
    font-size: 9px;
    font-family: var(--fm);
    color: var(--term-live);
    font-weight: 600;
    letter-spacing: 0.35px;
    line-height: 22px;
    padding: 0 20px;
  }
  @keyframes tickerScroll {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }

  /* ═══════════════════════════════════════════
     MOBILE — Context header + bottom nav
     ═══════════════════════════════════════════ */
  .terminal-mobile {
    --mob-nav-slot: calc(72px + env(safe-area-inset-bottom));
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: linear-gradient(180deg, var(--term-panel) 0%, var(--term-panel-2) 100%);
    box-shadow: inset 0 0 0 1px var(--term-border-soft);
    overflow: hidden;
    overscroll-behavior-y: contain;
  }
  .mob-topbar {
    flex-shrink: 0;
    padding: 8px 10px 6px;
    border-bottom: 1px solid var(--term-border);
    background:
      linear-gradient(135deg, rgba(232, 150, 125, 0.14), rgba(232, 150, 125, 0.04)),
      linear-gradient(180deg, rgba(14, 36, 23, 0.92), rgba(10, 27, 17, 0.94));
    backdrop-filter: blur(8px);
  }
  .mob-topline {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    margin-bottom: 6px;
  }
  .mob-title-wrap {
    display: flex;
    flex-direction: column;
    min-width: 0;
    gap: 1px;
  }
  .mob-eyebrow {
    font-family: var(--fm);
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 1.4px;
    color: rgba(240, 237, 228, 0.48);
  }
  .mob-title {
    font-family: var(--fd);
    font-size: 14px;
    font-weight: 900;
    letter-spacing: 0.35px;
    color: var(--term-text);
    line-height: 1.2;
  }
  .mob-live {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 8px;
    border-radius: 999px;
    border: 1px solid rgba(135, 220, 190, 0.26);
    background: rgba(135, 220, 190, 0.08);
    font-family: var(--fm);
    font-size: 8px;
    font-weight: 800;
    letter-spacing: 1.3px;
    color: var(--term-live);
    white-space: nowrap;
  }
  .mob-meta {
    display: flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
  }
  .mob-token {
    min-width: 0;
    flex: 1;
  }
  .mob-meta-chip {
    flex-shrink: 0;
    padding: 4px 8px;
    border-radius: 8px;
    border: 1px solid rgba(240, 237, 228, 0.2);
    background: rgba(240, 237, 228, 0.08);
    font-family: var(--fm);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.2px;
    color: rgba(240, 237, 228, 0.84);
    max-width: 44vw;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .mob-desc {
    margin-top: 6px;
    font-family: var(--fm);
    font-size: 9px;
    color: rgba(240, 237, 228, 0.56);
    letter-spacing: 0.15px;
    line-height: 1.35;
  }
  .mob-content {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-y: contain;
    touch-action: pan-y;
    padding: 8px 8px calc(10px + var(--mob-nav-slot));
    scroll-padding-bottom: calc(8px + var(--mob-nav-slot));
    display: flex;
    flex-direction: column;
  }
  .mob-content.chart-only {
    padding: 4px 6px calc(6px + var(--mob-nav-slot));
  }
  .mob-chart-stack {
    display: flex;
    flex-direction: column;
    min-height: 0;
    flex: 1 1 auto;
    gap: 0;
  }
  .mob-panel-wrap,
  .mob-chart-section {
    height: auto;
    min-height: 0;
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    border-radius: 12px;
    border: 1px solid rgba(232, 150, 125, 0.16);
    overflow: hidden;
    background: rgba(8, 22, 14, 0.58);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.26);
  }
  .mob-panel-resizable {
    position: relative;
    width: min(100%, var(--mob-panel-width, 100%));
    height: min(100%, var(--mob-panel-height, 100%));
    margin-inline: auto;
    transition: width .16s ease, height .16s ease, box-shadow .16s ease, border-color .16s ease;
  }
  .mob-panel-resizable:focus-within,
  .mob-panel-resizable:hover {
    border-color: rgba(232, 150, 125, 0.28);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  }
  .mob-resize-handle {
    position: absolute;
    z-index: 8;
    border: 0;
    background: transparent;
    padding: 0;
    margin: 0;
    opacity: 0.45;
    transition: opacity .12s ease;
    touch-action: none;
    user-select: none;
  }
  .mob-resize-handle::before {
    content: '';
    position: absolute;
    inset: 50% auto auto 50%;
    transform: translate(-50%, -50%);
    border-radius: 999px;
    background: rgba(245, 196, 184, 0.44);
  }
  .mob-resize-handle:hover,
  .mob-resize-handle:focus-visible {
    opacity: 0.95;
    outline: none;
  }
  .mob-resize-handle-x {
    top: 10px;
    right: 0;
    width: 12px;
    height: calc(100% - 20px);
    cursor: ew-resize;
  }
  .mob-resize-handle-x::before {
    width: 2px;
    height: 42%;
  }
  .mob-resize-handle-y {
    left: 10px;
    bottom: 0;
    width: calc(100% - 20px);
    height: 12px;
    cursor: ns-resize;
  }
  .mob-resize-handle-y::before {
    width: 42%;
    height: 2px;
  }
  .mob-chart-area {
    flex: 1 1 auto;
    min-height: 0;
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .mob-bottom-nav {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-auto-rows: minmax(44px, 44px);
    align-items: center;
    gap: 6px;
    padding: 7px 8px calc(5px + env(safe-area-inset-bottom));
    min-height: calc(60px + env(safe-area-inset-bottom));
    max-height: calc(72px + env(safe-area-inset-bottom));
    border-top: 1px solid var(--term-border);
    background: rgba(10, 26, 16, 0.92);
    backdrop-filter: blur(8px);
    margin-top: 0;
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 4;
    overflow: hidden;
  }
  .mob-nav-btn {
    height: 44px;
    min-height: 44px;
    max-height: 44px;
    align-self: center;
    border-radius: 12px;
    border: 1px solid rgba(232, 150, 125, 0.16);
    background: rgba(240, 237, 228, 0.03);
    color: rgba(240, 237, 228, 0.62);
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 0;
    font-family: var(--fm);
    cursor: pointer;
    transition: all .14s ease;
  }
  .mob-nav-btn.active {
    color: var(--term-accent-soft);
    border-color: rgba(232, 150, 125, 0.4);
    background: linear-gradient(135deg, rgba(232, 150, 125, 0.2), rgba(232, 150, 125, 0.08));
    box-shadow: inset 0 0 0 1px rgba(245, 196, 184, 0.18);
  }
  .mob-nav-label {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.8px;
    line-height: 1;
  }
  .mob-nav-badge {
    margin-left: 6px;
    min-width: 16px;
    height: 16px;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 4px;
    font-family: var(--fm);
    font-size: 8px;
    font-weight: 900;
    line-height: 1;
    color: #0b1b12;
    background: var(--term-live);
    box-shadow: 0 0 8px rgba(135, 220, 190, 0.45);
  }

  /* ═══════════════════════════════════════════
     TABLET — 2-col top + Intel bottom
     ═══════════════════════════════════════════ */
  .terminal-tablet {
    --tab-left-width: clamp(196px, 23vw, 232px);
    --tab-bottom-height: clamp(200px, 28vh, 280px);
    display: grid;
    grid-template-rows: minmax(0, 1fr) 6px var(--tab-bottom-height) auto;
    height: 100%;
    background: linear-gradient(180deg, var(--term-panel) 0%, var(--term-panel-2) 100%);
    box-shadow: inset 0 0 0 1px var(--term-border-soft);
    overflow: hidden;
  }
  .tab-top {
    grid-row: 1;
    display: grid;
    grid-template-columns: var(--tab-left-width) 6px minmax(0, 1fr);
    min-height: 0;
    overflow: hidden;
  }
  .tab-left {
    grid-column: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px 3px 4px 4px;
    overflow: hidden;
  }
  .tab-center {
    grid-column: 3;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px 4px 4px 3px;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }
  .tab-panel-resizable {
    --tab-panel-width: 100%;
    --tab-panel-height: 100%;
    position: relative;
    width: min(100%, var(--tab-panel-width));
    height: min(100%, var(--tab-panel-height));
    margin: auto;
    border-radius: 8px;
    border: 1px solid transparent;
    transition: width .16s ease, height .16s ease, box-shadow .16s ease, border-color .16s ease;
    min-width: 0;
    min-height: 0;
  }
  .tab-panel-resizable:hover,
  .tab-panel-resizable:focus-within {
    border-color: rgba(232, 150, 125, 0.24);
    box-shadow: 0 8px 26px rgba(0, 0, 0, 0.26);
  }
  .tab-panel-body {
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .tab-resize-handle {
    position: absolute;
    z-index: 16;
    border: 0;
    background: transparent;
    padding: 0;
    margin: 0;
    opacity: 0.42;
    transition: opacity .12s ease;
  }
  .tab-resize-handle::before {
    content: '';
    position: absolute;
    inset: 50% auto auto 50%;
    transform: translate(-50%, -50%);
    border-radius: 999px;
    background: rgba(245, 196, 184, 0.45);
  }
  .tab-resize-handle:hover,
  .tab-resize-handle:focus-visible {
    opacity: 0.92;
    outline: none;
  }
  .tab-resize-handle-x {
    top: 10px;
    right: 0;
    width: 20px;
    height: calc(100% - 20px);
    cursor: ew-resize;
  }
  .tab-resize-handle-x::before {
    width: 2px;
    height: 44%;
  }
  .tab-resize-handle-y {
    left: 10px;
    bottom: 0;
    width: calc(100% - 20px);
    height: 20px;
    cursor: ns-resize;
  }
  .tab-resize-handle-y::before {
    width: 44%;
    height: 2px;
  }
  .tab-chart-area {
    flex: 1;
    min-height: 200px;
    overflow: hidden;
  }
  .tab-layout-split {
    border: 0;
    background: rgba(8, 18, 13, 0.86);
    padding: 0;
    margin: 0;
    position: relative;
    z-index: 16;
    cursor: col-resize;
    transition: background .14s ease;
  }
  .tab-layout-split span {
    position: absolute;
    inset: 50% auto auto 50%;
    transform: translate(-50%, -50%);
    display: block;
    border-radius: 999px;
    background: rgba(245, 196, 184, 0.45);
  }
  .tab-layout-split:hover,
  .tab-layout-split:focus-visible {
    background: rgba(232, 150, 125, 0.14);
    outline: none;
  }
  .tab-layout-split-v {
    grid-column: 2;
  }
  .tab-layout-split-v span {
    width: 2px;
    height: 42px;
  }
  .tab-layout-split-h {
    grid-row: 2;
    width: 100%;
    cursor: row-resize;
  }
  .tab-layout-split-h span {
    width: 44px;
    height: 2px;
  }
  .tab-bottom {
    grid-row: 3;
    height: 100%;
    border-top: 1px solid var(--term-border);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    overflow: hidden;
  }
  .terminal-tablet .ticker-bar {
    grid-row: 4;
  }

  /* Route-scoped tone overrides for terminal child components */
  .terminal-shell :global(.war-room),
  .terminal-shell :global(.intel-panel) {
    background: var(--term-panel-2);
  }

  .terminal-shell :global(.war-room) {
    border-right: 1px solid var(--term-border-soft);
  }
  .terminal-shell :global(.war-room .wr-header) {
    background: linear-gradient(90deg, rgba(232, 150, 125, 0.94), rgba(245, 196, 184, 0.86));
    border-bottom: 1px solid rgba(10, 26, 13, 0.5);
  }
  .terminal-shell :global(.war-room .wr-title) {
    color: #112419;
    letter-spacing: 1.4px;
    white-space: nowrap;
  }
  .terminal-shell :global(.war-room .signal-link) {
    color: #132418;
    background: rgba(240, 237, 228, 0.55);
    border-color: rgba(10, 26, 13, 0.28);
  }
  .terminal-shell :global(.war-room .arena-trigger) {
    color: var(--term-accent-soft);
    background: rgba(10, 26, 16, 0.78);
    border-color: rgba(245, 196, 184, 0.34);
  }
  .terminal-shell :global(.war-room .arena-trigger:hover) {
    color: #fff4e9;
    background: rgba(10, 26, 16, 0.94);
    border-color: rgba(245, 196, 184, 0.58);
  }
  .terminal-shell :global(.war-room .ticker-flow) {
    border-bottom-color: var(--term-border-soft);
    background: rgba(9, 24, 16, 0.62);
  }
  .terminal-shell :global(.war-room .ticker-chip) {
    color: rgba(240, 237, 228, 0.78);
    border-color: rgba(232, 150, 125, 0.2);
    background: rgba(240, 237, 228, 0.03);
  }
  .terminal-shell :global(.war-room .ticker-label) {
    color: var(--term-accent-soft);
    border-color: rgba(232, 150, 125, 0.42);
    background: rgba(232, 150, 125, 0.16);
  }
  .terminal-shell :global(.war-room .ticker-tf) {
    color: var(--term-live);
    border-color: rgba(94, 203, 180, 0.44);
    background: rgba(94, 203, 180, 0.14);
  }
  .terminal-shell :global(.war-room .token-tabs) {
    border-bottom-color: var(--term-border-soft);
    background: rgba(9, 24, 16, 0.55);
  }
  .terminal-shell :global(.war-room .token-tab) {
    color: rgba(240, 237, 228, 0.78);
  }
  .terminal-shell :global(.war-room .token-tab.active) {
    color: var(--term-accent-soft);
    border-color: rgba(232, 150, 125, 0.52);
    background: rgba(232, 150, 125, 0.08);
  }
  .terminal-shell :global(.war-room .token-tab.active .token-tab-count) {
    background: rgba(232, 150, 125, 0.14);
    color: var(--term-accent-soft);
  }
  .terminal-shell :global(.war-room .deriv-strip) {
    background: rgba(10, 26, 16, 0.6);
    border-bottom-color: var(--term-border-soft);
  }
  .terminal-shell :global(.war-room .wr-msg) {
    border-bottom-color: rgba(232, 150, 125, 0.08);
  }
  .terminal-shell :global(.war-room .wr-msg:hover) {
    background: rgba(232, 150, 125, 0.04);
  }
  .terminal-shell :global(.war-room .wr-msg.selected) {
    background: rgba(232, 150, 125, 0.07);
    border-left-color: var(--term-accent);
  }
  .terminal-shell :global(.war-room .copy-trade-cta) {
    background: linear-gradient(90deg, rgba(232, 150, 125, 0.2), rgba(232, 150, 125, 0.09));
    border-top-color: var(--term-border);
  }
  .terminal-shell :global(.war-room .copy-trade-cta:hover) {
    background: linear-gradient(90deg, rgba(232, 150, 125, 0.3), rgba(232, 150, 125, 0.14));
  }
  .terminal-shell :global(.war-room .wr-stats) {
    border-top-color: var(--term-border);
    background: rgba(232, 150, 125, 0.04);
  }
  .terminal-shell :global(.war-room .stat-cell) {
    border-right-color: rgba(232, 150, 125, 0.14);
  }
  .terminal-shell :global(.war-room .stat-lbl) {
    color: rgba(245, 196, 184, 0.72);
  }

  .terminal-shell :global(.intel-panel) {
    border-left: 1px solid var(--term-border-soft);
  }
  .terminal-shell :global(.intel-panel .rp-tabs) {
    border-bottom-color: var(--term-border);
  }
  .terminal-shell :global(.intel-panel .rp-tab) {
    color: rgba(240, 237, 228, 0.8);
    background: rgba(240, 237, 228, 0.04);
  }
  .terminal-shell :global(.intel-panel .rp-tab.active) {
    background: rgba(232, 150, 125, 0.2);
    color: var(--term-accent-soft);
  }
  .terminal-shell :global(.intel-panel .rp-tab:not(.active):hover) {
    color: var(--term-accent-soft);
    background: rgba(232, 150, 125, 0.08);
  }
  .terminal-shell :global(.intel-panel .rp-collapse),
  .terminal-shell :global(.intel-panel .rp-panel-collapse) {
    border-left-color: var(--term-border-soft);
    color: rgba(245, 196, 184, 0.78);
  }
  .terminal-shell :global(.intel-panel .rp-collapse:hover),
  .terminal-shell :global(.intel-panel .rp-panel-collapse:hover) {
    background: rgba(232, 150, 125, 0.14);
    color: var(--term-accent-soft);
  }
  .terminal-shell :global(.intel-panel .rp-inner-tabs) {
    border-bottom-color: var(--term-border-soft);
  }
  .terminal-shell :global(.intel-panel .rp-inner-tab) {
    color: rgba(240, 237, 228, 0.72);
  }
  .terminal-shell :global(.intel-panel .rp-inner-tab.active) {
    color: var(--term-accent-soft);
    border-bottom-color: var(--term-accent);
  }
  .terminal-shell :global(.intel-panel .hl-ticker-badge) {
    color: var(--term-accent-soft);
    background: rgba(232, 150, 125, 0.1);
    border-bottom-color: var(--term-border-soft);
  }
  .terminal-shell :global(.intel-panel .hl-row),
  .terminal-shell :global(.intel-panel .ev-card) {
    border-bottom-color: rgba(232, 150, 125, 0.08);
  }
  .terminal-shell :global(.intel-panel .hl-time),
  .terminal-shell :global(.intel-panel .ev-etime),
  .terminal-shell :global(.intel-panel .comm-time),
  .terminal-shell :global(.intel-panel .flow-addr),
  .terminal-shell :global(.intel-panel .ac-name) {
    color: rgba(240, 237, 228, 0.68);
  }
  .terminal-shell :global(.war-room .wr-msg-text),
  .terminal-shell :global(.war-room .wr-msg-name),
  .terminal-shell :global(.intel-panel .hl-txt),
  .terminal-shell :global(.intel-panel .comm-txt),
  .terminal-shell :global(.intel-panel .ev-body),
  .terminal-shell :global(.intel-panel .ac-txt) {
    line-height: 1.4;
    letter-spacing: 0.08px;
  }
  .terminal-shell :global(.war-room .deriv-val),
  .terminal-shell :global(.war-room .wr-msg-price),
  .terminal-shell :global(.intel-panel .flow-amt),
  .terminal-shell :global(.intel-panel .hl-time),
  .terminal-shell :global(.intel-panel .ev-etime) {
    font-variant-numeric: tabular-nums;
  }
  .terminal-shell :global(.intel-panel .hl-row:hover),
  .terminal-shell :global(.intel-panel .comm-react:hover) {
    background: rgba(232, 150, 125, 0.08);
  }
  .terminal-shell :global(.intel-panel .user-post) {
    border-left-color: var(--term-accent);
  }
  .terminal-shell :global(.intel-panel .ac-send) {
    background: var(--term-accent);
    color: var(--term-bg);
    border-color: rgba(10, 26, 13, 0.45);
  }
  .terminal-shell :global(.intel-panel .ac-input input:focus) {
    border-color: rgba(232, 150, 125, 0.42);
  }

  /* Text density tuning (desktop/tablet): denser headers, clearer body hierarchy */
  .terminal-shell {
    --term-font-2xs: clamp(7px, 0.42vw, 8px);
    --term-font-xs: clamp(8px, 0.5vw, 9px);
    --term-font-sm: clamp(9px, 0.62vw, 10px);
    --term-font-md: clamp(10px, 0.78vw, 11.5px);
    --term-font-lg: clamp(11px, 0.9vw, 13px);
  }
  .terminal-shell :global(.war-room .wr-title) {
    font-size: var(--term-font-md);
    letter-spacing: 1.05px;
  }
  .terminal-shell :global(.war-room .wr-chip),
  .terminal-shell :global(.war-room .ticker-chip),
  .terminal-shell :global(.war-room .scan-tab),
  .terminal-shell :global(.war-room .token-tab),
  .terminal-shell :global(.intel-panel .rp-inner-tab),
  .terminal-shell :global(.intel-panel .ac-trade-btn) {
    font-size: var(--term-font-xs);
    letter-spacing: 0.42px;
  }
  .terminal-shell :global(.war-room .scan-tab-history),
  .terminal-shell :global(.war-room .token-tab-count),
  .terminal-shell :global(.war-room .wr-msg-time),
  .terminal-shell :global(.war-room .wr-msg-src),
  .terminal-shell :global(.intel-panel .hl-time),
  .terminal-shell :global(.intel-panel .ev-etime),
  .terminal-shell :global(.intel-panel .flow-addr),
  .terminal-shell :global(.intel-panel .ac-name) {
    font-size: var(--term-font-2xs);
    letter-spacing: 0.28px;
  }
  .terminal-shell :global(.war-room .deriv-lbl),
  .terminal-shell :global(.war-room .scan-status-text),
  .terminal-shell :global(.war-room .select-all-btn),
  .terminal-shell :global(.war-room .wr-act-btn),
  .terminal-shell :global(.war-room .src-count),
  .terminal-shell :global(.war-room .src-tracked),
  .terminal-shell :global(.intel-panel .hl-net),
  .terminal-shell :global(.intel-panel .hl-engage),
  .terminal-shell :global(.intel-panel .hl-creator),
  .terminal-shell :global(.intel-panel .trend-name),
  .terminal-shell :global(.intel-panel .trend-vol),
  .terminal-shell :global(.intel-panel .trend-soc),
  .terminal-shell :global(.intel-panel .trend-galaxy) {
    font-size: var(--term-font-xs);
    letter-spacing: 0.18px;
  }
  .terminal-shell :global(.war-room .wr-msg-name),
  .terminal-shell :global(.war-room .wr-msg-vote),
  .terminal-shell :global(.war-room .wr-msg-conf),
  .terminal-shell :global(.war-room .wr-msg-signal-row),
  .terminal-shell :global(.war-room .wr-msg-text),
  .terminal-shell :global(.war-room .src-text),
  .terminal-shell :global(.war-room .ctc-text),
  .terminal-shell :global(.intel-panel .rp-tab),
  .terminal-shell :global(.intel-panel .hl-txt),
  .terminal-shell :global(.intel-panel .flow-lbl),
  .terminal-shell :global(.intel-panel .flow-amt),
  .terminal-shell :global(.intel-panel .comm-name),
  .terminal-shell :global(.intel-panel .comm-txt),
  .terminal-shell :global(.intel-panel .ev-body),
  .terminal-shell :global(.intel-panel .ac-title),
  .terminal-shell :global(.intel-panel .ac-txt),
  .terminal-shell :global(.intel-panel .ac-input input),
  .terminal-shell :global(.intel-panel .trend-sym),
  .terminal-shell :global(.intel-panel .trend-price),
  .terminal-shell :global(.intel-panel .trend-chg) {
    font-size: var(--term-font-sm);
    letter-spacing: 0.12px;
  }
  .terminal-shell :global(.war-room .deriv-val),
  .terminal-shell :global(.war-room .stat-val),
  .terminal-shell :global(.war-room .wr-msg-entry),
  .terminal-shell :global(.war-room .wr-msg-tp),
  .terminal-shell :global(.war-room .wr-msg-sl),
  .terminal-shell :global(.intel-panel .pos-pnl),
  .terminal-shell :global(.intel-panel .pick-score) {
    font-size: var(--term-font-md);
    letter-spacing: 0.08px;
  }
  .terminal-shell :global(.war-room .wr-msg-text),
  .terminal-shell :global(.intel-panel .hl-txt),
  .terminal-shell :global(.intel-panel .comm-txt),
  .terminal-shell :global(.intel-panel .ev-body),
  .terminal-shell :global(.intel-panel .ac-txt) {
    line-height: 1.38;
  }
  .terminal-shell :global(.war-room .deriv-val),
  .terminal-shell :global(.war-room .wr-msg-conf),
  .terminal-shell :global(.war-room .wr-msg-time),
  .terminal-shell :global(.war-room .stat-val),
  .terminal-shell :global(.intel-panel .flow-amt),
  .terminal-shell :global(.intel-panel .trend-price),
  .terminal-shell :global(.intel-panel .trend-chg),
  .terminal-shell :global(.intel-panel .pick-score),
  .terminal-shell :global(.intel-panel .pos-pnl) {
    font-variant-numeric: tabular-nums lining-nums;
  }

  /* Mobile-only readability and touch ergonomics */
  .terminal-mobile :global(.war-room),
  .terminal-mobile :global(.intel-panel),
  .terminal-mobile :global(.chart-wrapper),
  .terminal-mobile :global(.tv-container) {
    border-radius: 12px;
    overflow: hidden;
  }
  .terminal-mobile :global(.chart-wrapper) {
    height: 100%;
    min-height: 0;
  }
  .terminal-mobile :global(.chart-wrapper .chart-container) {
    min-height: max(180px, 36vh);
  }
  .terminal-mobile :global(.war-room .wr-header) {
    height: 38px;
    padding: 0 12px;
  }
  .terminal-mobile :global(.war-room .wr-header-right) {
    flex: 0 0 auto;
    overflow: visible;
    padding-right: 0;
    margin-left: auto;
    scrollbar-width: none;
  }
  .terminal-mobile :global(.war-room .wr-header-right::-webkit-scrollbar) {
    display: none;
  }
  .terminal-mobile :global(.war-room .wr-title) {
    font-size: 13px;
    letter-spacing: 1.5px;
  }
  .terminal-mobile :global(.war-room .signal-link),
  .terminal-mobile :global(.war-room .wr-collapse-btn) {
    display: none;
  }
  .terminal-mobile :global(.war-room .arena-trigger) {
    min-height: 26px;
    height: 26px;
    min-width: 70px;
    padding: 0 10px;
    font-size: 9px;
    font-weight: 900;
    letter-spacing: .8px;
    color: rgba(245,196,184,.96);
    background: rgba(10,26,16,.8);
    border: 1px solid rgba(245,196,184,.35);
    box-shadow: inset 0 0 0 1px rgba(10,26,16,.45);
  }
  .terminal-mobile :global(.war-room .arena-trigger:hover),
  .terminal-mobile :global(.war-room .arena-trigger:active) {
    color: #fff4e9;
    background: rgba(10,26,16,.95);
    border-color: rgba(245,196,184,.62);
  }
  .terminal-mobile :global(.scan-btn) {
    min-height: 28px;
    padding: 4px 10px;
    font-size: 9px;
  }
  .terminal-mobile :global(.war-room .token-tab),
  .terminal-mobile :global(.intel-panel .rp-tab),
  .terminal-mobile :global(.intel-panel .rp-inner-tab) {
    min-height: 38px;
    font-size: 10px;
    letter-spacing: 0.9px;
  }
  .terminal-mobile :global(.war-room .token-tab-count) {
    font-size: 8px;
  }
  .terminal-mobile :global(.war-room .deriv-strip) {
    padding: 6px 8px;
  }
  .terminal-mobile :global(.war-room .ticker-flow) {
    padding: 4px 8px;
    gap: 4px;
  }
  .terminal-mobile :global(.war-room .ticker-chip) {
    height: 18px;
    padding: 0 6px;
    font-size: 7px;
    letter-spacing: .4px;
  }
  .terminal-mobile :global(.war-room .scan-tabs),
  .terminal-mobile :global(.war-room .token-tabs) {
    padding: 3px 6px;
    gap: 3px;
  }
  .terminal-mobile :global(.war-room .scan-tab),
  .terminal-mobile :global(.war-room .token-tab) {
    min-height: 28px;
    height: 28px;
    padding: 0 8px;
    border-radius: 12px;
    font-size: 9px;
  }
  .terminal-mobile :global(.war-room .scan-tab-meta),
  .terminal-mobile :global(.war-room .token-tab-count) {
    font-size: 7px;
  }
  .terminal-mobile :global(.war-room .deriv-val) {
    font-size: 12px;
  }
  .terminal-mobile :global(.war-room .wr-msg-body) {
    padding: 10px 12px 10px 6px;
  }
  .terminal-mobile :global(.war-room .wr-msg-head) {
    gap: 5px;
    margin-bottom: 4px;
  }
  .terminal-mobile :global(.war-room .wr-msg-name),
  .terminal-mobile :global(.war-room .wr-msg-text) {
    font-size: 10px;
  }
  .terminal-mobile :global(.war-room .wr-msg-signal-row),
  .terminal-mobile :global(.war-room .wr-msg-actions) {
    margin-top: 6px;
    gap: 6px;
  }
  .terminal-mobile :global(.war-room .wr-act-btn),
  .terminal-mobile :global(.war-room .copy-trade-cta),
  .terminal-mobile :global(.war-room .signal-room-cta) {
    min-height: 34px;
  }
  .terminal-mobile :global(.war-room .wr-act-btn) {
    font-size: 8px;
    padding: 4px 7px;
  }
  .terminal-mobile :global(.war-room .ctc-text),
  .terminal-mobile :global(.war-room .src-text) {
    font-size: 9px;
    letter-spacing: 1px;
  }

  .terminal-mobile :global(.intel-panel .rp-tabs) {
    border-bottom-width: 2px;
  }
  .terminal-mobile :global(.intel-panel .rp-collapse) {
    width: 34px;
    font-size: 10px;
  }
  .terminal-mobile :global(.intel-panel .rp-panel-collapse) {
    display: none;
  }
  .terminal-mobile :global(.intel-panel .rp-body) {
    padding: 10px;
    gap: 8px;
  }
  .terminal-mobile :global(.intel-panel .hl-row),
  .terminal-mobile :global(.intel-panel .ev-card),
  .terminal-mobile :global(.intel-panel .pos-row),
  .terminal-mobile :global(.intel-panel .comm-post) {
    padding-top: 10px;
    padding-bottom: 10px;
  }
  .terminal-mobile :global(.intel-panel .hl-txt),
  .terminal-mobile :global(.intel-panel .comm-txt),
  .terminal-mobile :global(.intel-panel .ev-body),
  .terminal-mobile :global(.intel-panel .ac-txt) {
    font-size: 10px;
    line-height: 1.45;
  }
  .terminal-mobile :global(.intel-panel .ac-section) {
    flex: 1 1 auto;
    min-height: 185px;
    max-height: none;
  }
  .terminal-mobile :global(.intel-panel .ac-title) {
    font-size: 10px;
    letter-spacing: 1.2px;
  }
  .terminal-mobile :global(.intel-panel .ac-input) {
    padding: 6px 8px 8px;
    gap: 6px;
  }
  .terminal-mobile :global(.intel-panel .ac-input input) {
    min-height: 36px;
    font-size: 10px;
    padding: 8px 10px;
  }
  .terminal-mobile :global(.intel-panel .ac-send) {
    width: 38px;
    min-height: 36px;
    border-radius: 8px;
  }

  .terminal-tablet :global(.intel-panel .rp-body-wrap) {
    min-height: 0;
  }
  .terminal-tablet :global(.intel-panel .ac-section) {
    flex: 0 0 132px;
    min-height: 120px;
    max-height: none;
  }

  .terminal-mobile :global(.chart-wrapper .chart-bar) {
    gap: 2px;
    padding: 3px 5px;
  }
  .terminal-mobile :global(.chart-wrapper .chart-bar .bar-top) { gap: 5px; }
  .terminal-mobile :global(.chart-wrapper .chart-bar .bar-tools) {
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    gap: 3px;
  }
  .terminal-mobile :global(.chart-wrapper .chart-bar .bar-left) {
    gap: 4px;
    width: auto;
  }
  .terminal-mobile :global(.chart-wrapper .chart-bar .pair-slot) {
    min-width: 124px;
    flex: 0 0 auto;
  }
  .terminal-mobile :global(.chart-wrapper .chart-bar .pair-slot .tdd-trigger) {
    min-height: 20px;
    padding: 1px 6px;
    gap: 3px;
    border-radius: 7px;
  }
  .terminal-mobile :global(.chart-wrapper .chart-bar .pair-slot .tdd-sym) {
    font-size: 10px;
    letter-spacing: .55px;
  }
  .terminal-mobile :global(.chart-wrapper .chart-bar .pair-slot .tdd-pair),
  .terminal-mobile :global(.chart-wrapper .chart-bar .pair-slot .tdd-arrow) {
    font-size: 8px;
  }
  .terminal-mobile :global(.chart-wrapper .chart-bar .pair-slot .tdd-panel:not(.mobile)) {
    width: min(92vw, 320px);
    max-height: min(62vh, 340px);
  }
  .terminal-mobile :global(.chart-wrapper .chart-bar .tf-btns) {
    width: auto;
    flex: 0 0 auto;
    min-width: max-content;
    padding-bottom: 1px;
  }
  .terminal-mobile :global(.chart-wrapper .chart-bar .tf-btns .tfbtn) {
    min-height: 20px;
    height: 20px;
    padding: 0 6px;
    font-size: 9px;
    letter-spacing: .25px;
    border-radius: 5px;
  }
  .terminal-mobile :global(.chart-wrapper .chart-bar .market-stats) {
    width: 100%;
    gap: 4px;
    overflow-x: auto;
    overflow-y: hidden;
    white-space: nowrap;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
  }
  .terminal-mobile :global(.chart-wrapper .chart-bar .market-stats .mstat) {
    height: 20px;
    padding: 0 6px;
    gap: 4px;
  }
  .terminal-mobile :global(.chart-wrapper .chart-bar .market-stats .mstat-k) {
    font-size: 8px;
    letter-spacing: .25px;
  }
  .terminal-mobile :global(.chart-wrapper .chart-bar .market-stats .mstat-v) {
    font-size: 9px;
    letter-spacing: .1px;
  }
  .terminal-mobile :global(.chart-wrapper .chart-bar .bar-right) {
    width: auto;
    justify-content: flex-end;
    align-items: center;
  }
  .terminal-mobile :global(.chart-wrapper .chart-bar .bar-controls) {
    width: auto;
    flex: 0 0 auto;
    min-width: max-content;
    gap: 4px;
    flex-wrap: nowrap;
    white-space: nowrap;
  }
  .terminal-mobile :global(.chart-wrapper .chart-bar .draw-tools) {
    display: flex;
    flex-wrap: nowrap;
    gap: 2px;
  }
  .terminal-mobile :global(.chart-wrapper .chart-bar .mode-toggle .mode-btn) {
    min-height: 20px;
    padding: 0 6px;
    font-size: 9px;
    letter-spacing: .25px;
  }
  .terminal-mobile :global(.chart-wrapper .chart-bar .draw-tools .draw-btn) {
    width: 20px;
    height: 20px;
    font-size: 8px;
  }
  .terminal-mobile :global(.chart-wrapper .chart-bar .scan-btn) {
    min-height: 20px;
    height: 20px;
    padding: 0 6px;
    font-size: 9px;
    letter-spacing: .2px;
  }
  .terminal-mobile :global(.chart-wrapper .chart-bar .price-info) {
    margin-left: auto;
    width: auto;
    justify-content: flex-end;
    border-left: 1px solid rgba(240, 237, 228, 0.12);
    padding-left: 4px;
    gap: 3px;
    order: initial;
  }
  .terminal-mobile :global(.chart-wrapper .chart-bar .price-info .cprc) {
    font-size: 11px;
    letter-spacing: .08px;
  }
  .terminal-mobile :global(.chart-wrapper .chart-bar .price-info .pchg) {
    font-size: 9px;
  }
  .terminal-mobile :global(.chart-wrapper .indicator-strip) {
    padding: 3px 5px;
    gap: 3px;
    max-height: none;
    flex-wrap: nowrap;
    white-space: nowrap;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
  }
  .terminal-mobile :global(.chart-wrapper .ind-chip),
  .terminal-mobile :global(.chart-wrapper .legend-chip),
  .terminal-mobile :global(.chart-wrapper .view-chip) {
    min-height: 18px;
    height: 18px;
    padding: 0 5px;
    font-size: 8px;
  }
  .terminal-mobile :global(.chart-wrapper .chart-footer) {
    gap: 6px;
    font-size: 8px;
    padding: 4px 8px;
  }

  .terminal-mobile :global(.war-room .wr-msgs),
  .terminal-mobile :global(.intel-panel .rp-body),
  .terminal-mobile :global(.intel-panel .hl-scrollable),
  .terminal-mobile :global(.intel-panel .ac-msgs),
  .terminal-mobile :global(.intel-panel .trend-list),
  .terminal-mobile :global(.intel-panel .picks-panel) {
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    touch-action: pan-y;
  }

  .terminal-mobile :global(.war-room .ticker-flow),
  .terminal-mobile :global(.war-room .scan-tabs),
  .terminal-mobile :global(.war-room .token-tabs),
  .terminal-mobile :global(.chart-wrapper .indicator-strip),
  .terminal-mobile :global(.chart-wrapper .chart-bar .bar-tools),
  .terminal-mobile :global(.chart-wrapper .chart-bar .tf-btns) {
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-x: contain;
    touch-action: pan-x;
  }

  .terminal-mobile :global(.chart-wrapper .chart-container),
  .terminal-mobile :global(.chart-wrapper .tv-container) {
    touch-action: pan-y pinch-zoom;
  }

  @media (max-width: 768px) {
    .terminal-shell::before { opacity: 0.2; }
    .term-stars-soft,
    .term-grain { display: none; }
    .term-stars {
      opacity: 0.28;
      animation: none;
      background-size: 420px 420px;
    }
  }

  @media (max-width: 768px) and (max-height: 760px) {
    .terminal-mobile {
      --mob-nav-slot: calc(64px + env(safe-area-inset-bottom));
    }
    .mob-topbar {
      padding: 8px 10px 6px;
    }
    .mob-topline {
      margin-bottom: 6px;
    }
    .mob-desc {
      display: none;
    }
    .mob-content {
      padding: 8px 8px calc(10px + var(--mob-nav-slot));
    }
    .mob-content.chart-only {
      padding: 4px 6px calc(6px + var(--mob-nav-slot));
    }
    .mob-bottom-nav {
      padding: 6px 8px calc(4px + env(safe-area-inset-bottom));
      min-height: calc(54px + env(safe-area-inset-bottom));
      max-height: calc(64px + env(safe-area-inset-bottom));
      grid-auto-rows: minmax(40px, 40px);
    }
    .mob-nav-btn {
      height: 40px;
      min-height: 40px;
      max-height: 40px;
    }
  }

  @media (max-width: 520px) {
    .mob-title {
      font-size: 13px;
    }
    .mob-meta {
      gap: 4px;
    }
    .mob-meta-chip {
      max-width: 36vw;
      padding: 4px 7px;
      font-size: 8px;
    }
    .mob-nav-label {
      font-size: 9px;
      letter-spacing: 0.9px;
    }
  }
</style>
