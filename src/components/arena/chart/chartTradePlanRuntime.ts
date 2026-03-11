import { clampRatio } from '$lib/chart/chartHelpers';
import {
  getPlannedTradeOrder,
  withTradePlanRatio,
} from '$lib/chart/chartTradePlanner';
import type { TradePlanDraft } from '$lib/chart/chartTypes';

export interface ChartTradePlanRuntimeController {
  setTradePlanRatio(nextLongRatio: number): void;
  openTradeFromPlan(): void;
  cancelTradePlan(): void;
  handleRatioPointerDown(event: PointerEvent): void;
  sync(): void;
  dispose(): void;
}

export interface CreateChartTradePlanRuntimeOptions {
  getPendingTradePlan: () => TradePlanDraft | null;
  setPendingTradePlan: (plan: TradePlanDraft | null) => void;
  getRatioTrackElement: () => HTMLButtonElement | null;
  openQuickTrade: (detail: {
    pair: string;
    dir: 'LONG' | 'SHORT';
    entry: number;
    tp: number;
    sl: number;
    source: string;
    note: string;
  }) => void;
  emitGtm: (event: string, payload?: Record<string, unknown>) => void;
  pushChartNotice: (message: string) => void;
  formatPrice: (value: number) => string;
}

export function createChartTradePlanRuntime(
  options: CreateChartTradePlanRuntimeOptions,
): ChartTradePlanRuntimeController {
  let ratioDragPointerId: number | null = null;
  let ratioDragBound = false;

  function setTradePlanRatio(nextLongRatio: number) {
    const pendingTradePlan = options.getPendingTradePlan();
    if (!pendingTradePlan) return;
    const nextPlan = withTradePlanRatio(pendingTradePlan, nextLongRatio);
    if (nextPlan === pendingTradePlan) return;
    options.setPendingTradePlan(nextPlan);
  }

  function ratioFromClientX(clientX: number): number | null {
    const ratioTrackEl = options.getRatioTrackElement();
    if (!ratioTrackEl) return null;
    const rect = ratioTrackEl.getBoundingClientRect();
    if (!Number.isFinite(rect.width) || rect.width <= 0) return null;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    return clampRatio(pct);
  }

  function onRatioPointerMove(event: PointerEvent) {
    if (ratioDragPointerId === null || event.pointerId !== ratioDragPointerId) return;
    const ratio = ratioFromClientX(event.clientX);
    if (ratio === null) return;
    setTradePlanRatio(ratio);
  }

  function unbindRatioDrag() {
    if (!ratioDragBound || typeof window === 'undefined') return;
    window.removeEventListener('pointermove', onRatioPointerMove);
    window.removeEventListener('pointerup', onRatioPointerUp);
    ratioDragBound = false;
    ratioDragPointerId = null;
  }

  function onRatioPointerUp(event: PointerEvent) {
    if (ratioDragPointerId !== null && event.pointerId === ratioDragPointerId) {
      unbindRatioDrag();
    }
  }

  function bindRatioDrag() {
    if (ratioDragBound || typeof window === 'undefined') return;
    window.addEventListener('pointermove', onRatioPointerMove);
    window.addEventListener('pointerup', onRatioPointerUp);
    ratioDragBound = true;
  }

  function openTradeFromPlan() {
    const pendingTradePlan = options.getPendingTradePlan();
    if (!pendingTradePlan) return;
    const planned = getPlannedTradeOrder(pendingTradePlan);
    options.openQuickTrade({
      pair: planned.pair,
      dir: planned.dir,
      entry: planned.entry,
      tp: planned.tp,
      sl: planned.sl,
      source: 'chart-plan',
      note: `ratio L${planned.longRatio}:S${planned.shortRatio}`,
    });
    options.emitGtm('terminal_chart_plan_open', {
      pair: planned.pair,
      dir: planned.dir,
      entry: planned.entry,
      tp: planned.tp,
      sl: planned.sl,
      rr: planned.rr,
      longRatio: planned.longRatio,
      shortRatio: planned.shortRatio,
    });
    options.pushChartNotice(
      `OPEN ${planned.dir} · ${planned.longRatio}:${planned.shortRatio} · ENTRY ${options.formatPrice(planned.entry)}`,
    );
    options.setPendingTradePlan(null);
  }

  function cancelTradePlan() {
    options.setPendingTradePlan(null);
    options.pushChartNotice('Trade cancelled');
  }

  function handleRatioPointerDown(event: PointerEvent) {
    if (!options.getPendingTradePlan()) return;
    ratioDragPointerId = event.pointerId;
    const ratio = ratioFromClientX(event.clientX);
    if (ratio !== null) setTradePlanRatio(ratio);
    bindRatioDrag();
  }

  function sync() {
    if (!options.getPendingTradePlan()) {
      unbindRatioDrag();
    }
  }

  function dispose() {
    unbindRatioDrag();
  }

  return {
    setTradePlanRatio,
    openTradeFromPlan,
    cancelTradePlan,
    handleRatioPointerDown,
    sync,
    dispose,
  };
}
