import {
  TERMINAL_BREAKPOINTS,
  clampTabletIntelWidth,
  getDefaultTabletIntelWidth,
  isHorizontalResizeGesture,
} from './terminalHelpers';
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

function clampLeftWidth(next: number) {
  return Math.min(DESKTOP_LIMITS.leftMax, Math.max(DESKTOP_LIMITS.leftMin, next));
}

function clampRightWidth(next: number) {
  return Math.min(DESKTOP_LIMITS.rightMax, Math.max(DESKTOP_LIMITS.rightMin, next));
}

export function createTerminalLayoutRuntime(params: {
  getViewport: () => 'mobile' | 'tablet' | 'desktop';
  getWindowWidth: () => number;
  setWindowWidth: (width: number) => void;
  getLeftWidth: () => number;
  setLeftWidth: (width: number) => void;
  getRightWidth: () => number;
  setRightWidth: (width: number) => void;
  getSavedLeftWidth: () => number;
  setSavedLeftWidth: (width: number) => void;
  getSavedRightWidth: () => number;
  setSavedRightWidth: (width: number) => void;
  getLeftCollapsed: () => boolean;
  setLeftCollapsed: (collapsed: boolean) => void;
  getRightCollapsed: () => boolean;
  setRightCollapsed: (collapsed: boolean) => void;
  setDragTarget: (target: DragTarget) => void;
  getTabletIntelWidth: () => number;
  setTabletIntelWidth: (width: number) => void;
}) {
  let desktopDragState: DesktopDragState | null = null;
  let tabletIntelDragState: TabletIntelDragState | null = null;
  let cleanupResizeListener: (() => void) | null = null;

  function toggleLeft() {
    if (params.getLeftCollapsed()) {
      params.setLeftWidth(params.getSavedLeftWidth());
      params.setLeftCollapsed(false);
      return;
    }
    params.setSavedLeftWidth(params.getLeftWidth());
    params.setLeftWidth(0);
    params.setLeftCollapsed(true);
  }

  function toggleRight() {
    if (params.getRightCollapsed()) {
      params.setRightWidth(params.getSavedRightWidth());
      params.setRightCollapsed(false);
      return;
    }
    params.setSavedRightWidth(params.getRightWidth());
    params.setRightWidth(0);
    params.setRightCollapsed(true);
  }

  function finishDesktopDrag() {
    if (!desktopDragState) return;
    desktopDragState = null;
    params.setDragTarget(null);
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
      params.setLeftWidth(clampLeftWidth(state.startValue + delta));
      return;
    }

    const delta = state.startClientX - e.clientX;
    params.setRightWidth(clampRightWidth(state.startValue + delta));
  }

  function startDesktopDrag(target: DragTarget, e: MouseEvent) {
    if (params.getViewport() !== 'desktop' || !target) return;

    desktopDragState = {
      target,
      startClientX: e.clientX,
      startValue: target === 'left' ? params.getLeftWidth() : params.getRightWidth(),
    };
    params.setDragTarget(target);
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
    if (params.getViewport() !== 'desktop') return;

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
      if (params.getLeftCollapsed()) {
        params.setLeftCollapsed(false);
        params.setLeftWidth(params.getSavedLeftWidth());
      }
      const nextLeft = clampLeftWidth(params.getLeftWidth() + signed);
      params.setLeftWidth(nextLeft);
      params.setSavedLeftWidth(nextLeft);
      return;
    }

    if (target === 'right') {
      if (params.getRightCollapsed()) {
        params.setRightCollapsed(false);
        params.setRightWidth(params.getSavedRightWidth());
      }
      const nextRight = clampRightWidth(params.getRightWidth() + signed);
      params.setRightWidth(nextRight);
      params.setSavedRightWidth(nextRight);
      return;
    }

    if (params.getLeftCollapsed() || params.getRightCollapsed()) return;
    const half = Math.round(signed / 2);
    const nextLeft = clampLeftWidth(params.getLeftWidth() + half);
    const nextRight = clampRightWidth(params.getRightWidth() + half);
    params.setLeftWidth(nextLeft);
    params.setRightWidth(nextRight);
    params.setSavedLeftWidth(nextLeft);
    params.setSavedRightWidth(nextRight);
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
    params.setTabletIntelWidth(clampTabletIntelWidth(state.startValue + delta, viewportWidth()));
    e.preventDefault();
  }

  function startTabletIntelDrag(e: PointerEvent) {
    if (params.getViewport() !== 'tablet') return;

    (e.currentTarget as HTMLElement | null)?.setPointerCapture?.(e.pointerId);
    tabletIntelDragState = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startValue: params.getTabletIntelWidth(),
    };
    e.preventDefault();
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onTabletIntelPointerMove, { passive: false });
    window.addEventListener('pointerup', finishTabletIntelDrag);
    window.addEventListener('pointercancel', finishTabletIntelDrag);
  }

  function resizeTabletIntelByWheel(e: WheelEvent) {
    if (params.getViewport() !== 'tablet') return;

    const rawDelta = Math.abs(e.deltaX) > 0 ? e.deltaX : e.deltaY;
    if (!Number.isFinite(rawDelta) || rawDelta === 0) return;
    const step = e.shiftKey ? TABLET_INTEL_STEP + 8 : TABLET_INTEL_STEP;
    const signed = rawDelta > 0 ? step : -step;
    e.preventDefault();
    e.stopPropagation();
    params.setTabletIntelWidth(clampTabletIntelWidth(params.getTabletIntelWidth() + signed, viewportWidth()));
  }

  function resetTabletIntelWidth() {
    params.setTabletIntelWidth(getDefaultTabletIntelWidth(viewportWidth()));
  }

  function handleResize() {
    const previousWidth = params.getWindowWidth();
    const nextWidth = window.innerWidth;
    params.setWindowWidth(nextWidth);

    const wasTablet = isTabletWidth(previousWidth);
    const nowTablet = isTabletWidth(nextWidth);
    if (!nowTablet) return;

    if (!wasTablet) {
      params.setTabletIntelWidth(getDefaultTabletIntelWidth(nextWidth));
      return;
    }

    params.setTabletIntelWidth(clampTabletIntelWidth(params.getTabletIntelWidth(), nextWidth));
  }

  function mount() {
    if (typeof window === 'undefined') return;

    params.setWindowWidth(window.innerWidth);
    if (isTabletWidth(window.innerWidth)) {
      params.setTabletIntelWidth(getDefaultTabletIntelWidth(window.innerWidth));
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
    mount,
    resetTabletIntelWidth,
    resizeDesktopPanelsByWheel,
    resizeTabletIntelByWheel,
    startDesktopDrag,
    startTabletIntelDrag,
    toggleLeft,
    toggleRight,
  };
}
