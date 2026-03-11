import {
  TERMINAL_BREAKPOINTS,
  clampTabletIntelWidth,
  getDefaultTabletIntelWidth,
  isHorizontalResizeGesture,
} from './terminalHelpers';
import { get, readonly, writable } from 'svelte/store';
import type { DragTarget, TerminalPanelResizeTarget } from './terminalTypes';

const DESKTOP_LIMITS = {
  leftMin: 240,
  leftMax: 450,
  rightMin: 260,
  rightMax: 500,
} as const;

const TABLET_INTEL_STEP = 12;

interface DesktopDragState {
  target: DragTarget;
  startClientX: number;
  startValue: number;
}

interface TabletIntelDragState {
  pointerId: number;
  startClientX: number;
  startValue: number;
}

function viewportWidth() {
  return typeof window === 'undefined' ? undefined : window.innerWidth;
}

function isTabletWidth(width: number) {
  return width >= TERMINAL_BREAKPOINTS.mobile && width < TERMINAL_BREAKPOINTS.tablet;
}

function resolveViewport(width: number): 'mobile' | 'tablet' | 'desktop' {
  if (width < TERMINAL_BREAKPOINTS.mobile) return 'mobile';
  if (width < TERMINAL_BREAKPOINTS.tablet) return 'tablet';
  return 'desktop';
}

function clampLeftWidth(next: number) {
  return Math.min(DESKTOP_LIMITS.leftMax, Math.max(DESKTOP_LIMITS.leftMin, next));
}

function clampRightWidth(next: number) {
  return Math.min(DESKTOP_LIMITS.rightMax, Math.max(DESKTOP_LIMITS.rightMin, next));
}

export function createTerminalLayoutRuntime() {
  const viewportWidthStore = writable(1200);
  const leftPanelWidthStore = writable(272);
  const rightPanelWidthStore = writable(288);
  const savedLeftPanelWidthStore = writable(308);
  const savedRightPanelWidthStore = writable(332);
  const leftPanelCollapsedStore = writable(false);
  const rightPanelCollapsedStore = writable(false);
  const panelDragTargetStore = writable<DragTarget>(null);
  const tabletIntelWidthStore = writable(320);
  let desktopDragState: DesktopDragState | null = null;
  let tabletIntelDragState: TabletIntelDragState | null = null;
  let cleanupResizeListener: (() => void) | null = null;

  function toggleLeft() {
    if (get(leftPanelCollapsedStore)) {
      leftPanelWidthStore.set(get(savedLeftPanelWidthStore));
      leftPanelCollapsedStore.set(false);
      return;
    }
    savedLeftPanelWidthStore.set(get(leftPanelWidthStore));
    leftPanelWidthStore.set(0);
    leftPanelCollapsedStore.set(true);
  }

  function toggleRight() {
    if (get(rightPanelCollapsedStore)) {
      rightPanelWidthStore.set(get(savedRightPanelWidthStore));
      rightPanelCollapsedStore.set(false);
      return;
    }
    savedRightPanelWidthStore.set(get(rightPanelWidthStore));
    rightPanelWidthStore.set(0);
    rightPanelCollapsedStore.set(true);
  }

  function getViewport() {
    return resolveViewport(get(viewportWidthStore));
  }

  function finishDesktopDrag() {
    if (!desktopDragState) return;
    desktopDragState = null;
    panelDragTargetStore.set(null);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    window.removeEventListener('mousemove', onDesktopPointerMove);
    window.removeEventListener('mouseup', finishDesktopDrag);
  }

  function onDesktopPointerMove(e: MouseEvent) {
    const state = desktopDragState;
    if (!state || !state.target) return;

    if (state.target === 'left') {
      const delta = e.clientX - state.startClientX;
      leftPanelWidthStore.set(clampLeftWidth(state.startValue + delta));
      return;
    }

    const delta = state.startClientX - e.clientX;
    rightPanelWidthStore.set(clampRightWidth(state.startValue + delta));
  }

  function startDesktopDrag(target: DragTarget, e: MouseEvent) {
    if (getViewport() !== 'desktop' || !target) return;

    desktopDragState = {
      target,
      startClientX: e.clientX,
      startValue: target === 'left' ? get(leftPanelWidthStore) : get(rightPanelWidthStore),
    };
    panelDragTargetStore.set(target);
    e.preventDefault();
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onDesktopPointerMove);
    window.addEventListener('mouseup', finishDesktopDrag);
  }

  function resizeDesktopPanelsByWheel(
    target: TerminalPanelResizeTarget,
    e: WheelEvent,
    options?: { force?: boolean },
  ) {
    if (getViewport() !== 'desktop') return;

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
      if (get(leftPanelCollapsedStore)) {
        leftPanelCollapsedStore.set(false);
        leftPanelWidthStore.set(get(savedLeftPanelWidthStore));
      }
      const nextLeft = clampLeftWidth(get(leftPanelWidthStore) + signed);
      leftPanelWidthStore.set(nextLeft);
      savedLeftPanelWidthStore.set(nextLeft);
      return;
    }

    if (target === 'right') {
      if (get(rightPanelCollapsedStore)) {
        rightPanelCollapsedStore.set(false);
        rightPanelWidthStore.set(get(savedRightPanelWidthStore));
      }
      const nextRight = clampRightWidth(get(rightPanelWidthStore) + signed);
      rightPanelWidthStore.set(nextRight);
      savedRightPanelWidthStore.set(nextRight);
      return;
    }

    if (get(leftPanelCollapsedStore) || get(rightPanelCollapsedStore)) return;
    const half = Math.round(signed / 2);
    const nextLeft = clampLeftWidth(get(leftPanelWidthStore) + half);
    const nextRight = clampRightWidth(get(rightPanelWidthStore) + half);
    leftPanelWidthStore.set(nextLeft);
    rightPanelWidthStore.set(nextRight);
    savedLeftPanelWidthStore.set(nextLeft);
    savedRightPanelWidthStore.set(nextRight);
  }

  function finishTabletIntelDrag(e?: PointerEvent) {
    if (!tabletIntelDragState) return;
    if (e && e.pointerId !== tabletIntelDragState.pointerId) return;

    tabletIntelDragState = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    window.removeEventListener('pointermove', onTabletIntelPointerMove);
    window.removeEventListener('pointerup', finishTabletIntelDrag);
    window.removeEventListener('pointercancel', finishTabletIntelDrag);
  }

  function onTabletIntelPointerMove(e: PointerEvent) {
    const state = tabletIntelDragState;
    if (!state || e.pointerId !== state.pointerId) return;

    const delta = state.startClientX - e.clientX;
    tabletIntelWidthStore.set(clampTabletIntelWidth(state.startValue + delta, viewportWidth()));
    e.preventDefault();
  }

  function startTabletIntelDrag(e: PointerEvent) {
    if (getViewport() !== 'tablet') return;

    (e.currentTarget as HTMLElement | null)?.setPointerCapture?.(e.pointerId);
    tabletIntelDragState = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startValue: get(tabletIntelWidthStore),
    };
    e.preventDefault();
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onTabletIntelPointerMove, { passive: false });
    window.addEventListener('pointerup', finishTabletIntelDrag);
    window.addEventListener('pointercancel', finishTabletIntelDrag);
  }

  function resizeTabletIntelByWheel(e: WheelEvent) {
    if (getViewport() !== 'tablet') return;

    const rawDelta = Math.abs(e.deltaX) > 0 ? e.deltaX : e.deltaY;
    if (!Number.isFinite(rawDelta) || rawDelta === 0) return;
    const step = e.shiftKey ? TABLET_INTEL_STEP + 8 : TABLET_INTEL_STEP;
    const signed = rawDelta > 0 ? step : -step;
    e.preventDefault();
    e.stopPropagation();
    tabletIntelWidthStore.set(clampTabletIntelWidth(get(tabletIntelWidthStore) + signed, viewportWidth()));
  }

  function resetTabletIntelWidth() {
    tabletIntelWidthStore.set(getDefaultTabletIntelWidth(viewportWidth()));
  }

  function handleResize() {
    const previousWidth = get(viewportWidthStore);
    const nextWidth = window.innerWidth;
    viewportWidthStore.set(nextWidth);

    const wasTablet = isTabletWidth(previousWidth);
    const nowTablet = isTabletWidth(nextWidth);
    if (!nowTablet) return;

    if (!wasTablet) {
      tabletIntelWidthStore.set(getDefaultTabletIntelWidth(nextWidth));
      return;
    }

    tabletIntelWidthStore.set(clampTabletIntelWidth(get(tabletIntelWidthStore), nextWidth));
  }

  function mount() {
    if (typeof window === 'undefined') return;

    viewportWidthStore.set(window.innerWidth);
    if (isTabletWidth(window.innerWidth)) {
      tabletIntelWidthStore.set(getDefaultTabletIntelWidth(window.innerWidth));
    }

    window.addEventListener('resize', handleResize);
    cleanupResizeListener = () => {
      window.removeEventListener('resize', handleResize);
    };
  }

  function destroy() {
    finishDesktopDrag();
    finishTabletIntelDrag();
    cleanupResizeListener?.();
    cleanupResizeListener = null;
  }

  return {
    destroy,
    leftPanelCollapsed: readonly(leftPanelCollapsedStore),
    leftPanelWidth: readonly(leftPanelWidthStore),
    mount,
    panelDragTarget: readonly(panelDragTargetStore),
    resetTabletIntelWidth,
    rightPanelCollapsed: readonly(rightPanelCollapsedStore),
    rightPanelWidth: readonly(rightPanelWidthStore),
    resizeDesktopPanelsByWheel,
    resizeTabletIntelByWheel,
    startDesktopDrag,
    startTabletIntelDrag,
    tabletIntelWidth: readonly(tabletIntelWidthStore),
    toggleLeft,
    toggleRight,
    viewportWidth: readonly(viewportWidthStore),
  };
}
