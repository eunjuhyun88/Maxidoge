import type { IPriceLine, ISeriesApi } from 'lightweight-charts';
import type { ChartTheme } from '../ChartTheme';
import {
  getNextPositionWheelPrice,
  resolvePositionInteractionTarget,
  type PositionInteractionTarget,
} from './chartPositionInteraction';

export interface ChartPositionRuntimeController {
  syncPositionLines(): void;
  clearPositionLines(): void;
  handleMouseDown(event: MouseEvent): void;
  handleMouseMove(event: MouseEvent): void;
  handleMouseUp(): void;
  handleWheel(event: WheelEvent): void;
  dispose(): void;
}

export interface CreateChartPositionRuntimeOptions {
  getSeries: () => ISeriesApi<'Candlestick'> | null;
  getChartContainer: () => HTMLDivElement | null;
  getTheme: () => ChartTheme;
  getShowPosition: () => boolean;
  getPositionLevels: () => { entry: number | null; tp: number | null; sl: number | null; dir: string };
  getLivePrice: () => number;
  getDragState: () => PositionInteractionTarget | null;
  setDragState: (target: PositionInteractionTarget | null) => void;
  getHoverState: () => PositionInteractionTarget | null;
  setHoverState: (target: PositionInteractionTarget | null) => void;
  emitDrag: (target: PositionInteractionTarget, detail: { price: number }) => void;
}

export function createChartPositionRuntime(
  options: CreateChartPositionRuntimeOptions,
): ChartPositionRuntimeController {
  let tpLine: IPriceLine | null = null;
  let entryLine: IPriceLine | null = null;
  let slLine: IPriceLine | null = null;

  function priceFromY(y: number): number | null {
    const series = options.getSeries();
    if (!series) return null;
    try {
      return series.coordinateToPrice(y);
    } catch {
      return null;
    }
  }

  function clearPositionLines() {
    const series = options.getSeries();
    if (tpLine && series) {
      try {
        series.removePriceLine(tpLine);
      } catch {}
      tpLine = null;
    }
    if (entryLine && series) {
      try {
        series.removePriceLine(entryLine);
      } catch {}
      entryLine = null;
    }
    if (slLine && series) {
      try {
        series.removePriceLine(slLine);
      } catch {}
      slLine = null;
    }
  }

  function syncPositionLines() {
    const series = options.getSeries();
    const { entry, tp, sl, dir } = options.getPositionLevels();
    if (!series || !options.getShowPosition() || entry === null || tp === null || sl === null) {
      clearPositionLines();
      return;
    }

    clearPositionLines();
    const chartTheme = options.getTheme();
    const isLong = dir === 'LONG';
    tpLine = series.createPriceLine({
      price: tp,
      color: chartTheme.tp,
      lineWidth: 2,
      lineStyle: 2,
      axisLabelVisible: true,
      title: `TP ${isLong ? '▲' : '▼'} $${Math.round(tp).toLocaleString()}`,
    });
    entryLine = series.createPriceLine({
      price: entry,
      color: chartTheme.entry,
      lineWidth: 2,
      lineStyle: 1,
      axisLabelVisible: true,
      title: `ENTRY $${Math.round(entry).toLocaleString()}`,
    });
    slLine = series.createPriceLine({
      price: sl,
      color: chartTheme.sl,
      lineWidth: 2,
      lineStyle: 2,
      axisLabelVisible: true,
      title: `SL ${isLong ? '▼' : '▲'} $${Math.round(sl).toLocaleString()}`,
    });
  }

  function handleMouseDown(event: MouseEvent) {
    const chartContainer = options.getChartContainer();
    const { entry, tp, sl } = options.getPositionLevels();
    if (!chartContainer || !options.getSeries() || !options.getShowPosition() || entry === null || tp === null || sl === null) return;

    const y = event.clientY - chartContainer.getBoundingClientRect().top;
    const price = priceFromY(y);
    if (price === null) return;
    const target = resolvePositionInteractionTarget(price, { entry, tp, sl });
    if (!target) return;
    options.setDragState(target);
    chartContainer.style.cursor = 'ns-resize';
    event.preventDefault();
  }

  function handleMouseMove(event: MouseEvent) {
    const chartContainer = options.getChartContainer();
    const { entry, tp, sl } = options.getPositionLevels();
    if (!chartContainer || !options.getSeries()) return;

    const y = event.clientY - chartContainer.getBoundingClientRect().top;
    const price = priceFromY(y);
    if (price === null) return;

    const dragState = options.getDragState();
    if (dragState) {
      options.emitDrag(dragState, { price: Math.round(price) });
      return;
    }

    if (options.getShowPosition() && entry !== null && tp !== null && sl !== null) {
      const target = resolvePositionInteractionTarget(price, { entry, tp, sl });
      if (target) {
        options.setHoverState(target);
        chartContainer.style.cursor = 'ns-resize';
      } else {
        options.setHoverState(null);
        chartContainer.style.cursor = '';
      }
    }
  }

  function handleMouseUp() {
    const chartContainer = options.getChartContainer();
    if (!options.getDragState()) return;
    options.setDragState(null);
    options.setHoverState(null);
    if (chartContainer) {
      chartContainer.style.cursor = '';
    }
  }

  function handleWheel(event: WheelEvent) {
    const { entry, tp, sl } = options.getPositionLevels();
    if (!options.getSeries() || !options.getShowPosition() || entry === null || tp === null || sl === null) return;

    const target = options.getHoverState() || options.getDragState();
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    const basePrice = entry || options.getLivePrice();
    const nextPrice = getNextPositionWheelPrice({
      target,
      levels: { entry, tp, sl },
      basePrice,
      deltaY: event.deltaY,
    });
    options.emitDrag(target, { price: nextPrice });
  }

  function dispose() {
    clearPositionLines();
    options.setDragState(null);
    options.setHoverState(null);
    const chartContainer = options.getChartContainer();
    if (chartContainer) {
      chartContainer.style.cursor = '';
    }
  }

  return {
    syncPositionLines,
    clearPositionLines,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
    dispose,
  };
}
