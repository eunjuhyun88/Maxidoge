// ═══════════════════════════════════════════════════════════════
// Stockclaw — Derivatives Data Runtime (OI / Funding / Liquidations)
// ═══════════════════════════════════════════════════════════════
// Fetches derivatives data from Coinalyze and syncs to chart series.
// Panes are created LAZILY on first enable to avoid wasting vertical space.
// Swap import source to switch data provider (e.g. Velo.xyz).

import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import type { IndicatorKey } from '$lib/chart/chartTypes';
import type { LWCModule } from '$lib/chart/chartTypes';
import {
  fetchOIHistory,
  fetchFundingHistory,
  fetchLiquidationHistory,
} from '$lib/api/coinalyze';
import type { ChartTheme } from '../ChartTheme';

export interface DerivativesPaneRefs {
  oiSeries: ISeriesApi<'Line'> | null;
  oiPaneIndex: number | null;
  fundingSeries: ISeriesApi<'Histogram'> | null;
  fundingPaneIndex: number | null;
  liqLongSeries: ISeriesApi<'Histogram'> | null;
  liqShortSeries: ISeriesApi<'Histogram'> | null;
  liqPaneIndex: number | null;
}

export interface ChartDerivativesRuntimeController {
  /** Fetch derivatives data for given pair/timeframe and push to chart series */
  sync(pair: string, timeframe: string): void;
  /** Force re-sync (e.g. when indicator toggled on) */
  forceSync(pair: string, timeframe: string): void;
  /** Get current pane refs (for viewport runtime) */
  getPaneRefs(): DerivativesPaneRefs;
  dispose(): void;
}

export interface CreateChartDerivativesRuntimeOptions {
  getChart: () => IChartApi | null;
  getLwc: () => LWCModule | null;
  getIndicatorEnabled: () => Record<IndicatorKey, boolean>;
  getTheme: () => ChartTheme;
  /** Called after panes are lazily created so viewport runtime can update layout */
  onPanesChanged: () => void;
}

export function createChartDerivativesRuntime(
  options: CreateChartDerivativesRuntimeOptions,
): ChartDerivativesRuntimeController {
  let syncTimer: ReturnType<typeof setTimeout> | null = null;
  let abortController: AbortController | null = null;
  let lastSyncKey = '';

  // Lazily created pane/series refs
  let oiSeries: ISeriesApi<'Line'> | null = null;
  let oiPaneIndex: number | null = null;
  let fundingSeries: ISeriesApi<'Histogram'> | null = null;
  let fundingPaneIndex: number | null = null;
  let liqLongSeries: ISeriesApi<'Histogram'> | null = null;
  let liqShortSeries: ISeriesApi<'Histogram'> | null = null;
  let liqPaneIndex: number | null = null;

  function ensureOiPane() {
    if (oiSeries) return;
    const chart = options.getChart();
    const lwc = options.getLwc();
    if (!chart || !lwc) return;
    const theme = options.getTheme();

    chart.addPane();
    oiPaneIndex = chart.panes().length - 1;
    oiSeries = chart.addSeries(
      lwc.LineSeries,
      {
        color: theme.oiLine,
        lineWidth: 1.5 as any,
        priceLineVisible: false,
        lastValueVisible: true,
        crosshairMarkerVisible: false,
        visible: true,
        priceFormat: { type: 'volume' },
      },
      oiPaneIndex,
    );
    options.onPanesChanged();
  }

  function ensureFundingPane() {
    if (fundingSeries) return;
    const chart = options.getChart();
    const lwc = options.getLwc();
    if (!chart || !lwc) return;

    chart.addPane();
    fundingPaneIndex = chart.panes().length - 1;
    fundingSeries = chart.addSeries(
      lwc.HistogramSeries,
      {
        priceFormat: { type: 'price', precision: 6, minMove: 0.000001 },
        lastValueVisible: true,
        priceLineVisible: false,
        visible: true,
      },
      fundingPaneIndex,
    );
    fundingSeries.createPriceLine({
      price: 0,
      color: 'rgba(255,255,255,.08)',
      lineWidth: 1,
      lineStyle: 1,
      axisLabelVisible: false,
      title: '',
    });
    options.onPanesChanged();
  }

  function ensureLiqPane() {
    if (liqLongSeries) return;
    const chart = options.getChart();
    const lwc = options.getLwc();
    if (!chart || !lwc) return;
    const theme = options.getTheme();

    chart.addPane();
    liqPaneIndex = chart.panes().length - 1;
    liqLongSeries = chart.addSeries(
      lwc.HistogramSeries,
      {
        color: theme.liqLong,
        priceFormat: { type: 'volume' },
        lastValueVisible: false,
        priceLineVisible: false,
        visible: true,
      },
      liqPaneIndex,
    );
    liqShortSeries = chart.addSeries(
      lwc.HistogramSeries,
      {
        color: theme.liqShort,
        priceFormat: { type: 'volume' },
        lastValueVisible: false,
        priceLineVisible: false,
        visible: true,
      },
      liqPaneIndex,
    );
    options.onPanesChanged();
  }

  async function doSync(pair: string, timeframe: string) {
    abortController?.abort();
    abortController = new AbortController();

    const enabled = options.getIndicatorEnabled();
    const anyEnabled = enabled.oi || enabled.funding || enabled.liq;
    if (!anyEnabled || !pair || !timeframe) return;

    const theme = options.getTheme();

    // Ensure panes exist for enabled indicators
    if (enabled.oi) ensureOiPane();
    if (enabled.funding) ensureFundingPane();
    if (enabled.liq) ensureLiqPane();

    try {
      const [oiData, fundingData, liqData] = await Promise.all([
        enabled.oi ? fetchOIHistory(pair, timeframe) : Promise.resolve([]),
        enabled.funding ? fetchFundingHistory(pair, timeframe) : Promise.resolve([]),
        enabled.liq ? fetchLiquidationHistory(pair, timeframe) : Promise.resolve([]),
      ]);

      if (abortController.signal.aborted) return;

      // ── OI series ──
      if (oiSeries && oiData.length > 0) {
        oiSeries.setData(
          oiData.map((d) => ({
            time: d.time as UTCTimestamp,
            value: d.value,
          })),
        );
      }

      // ── Funding series (color per bar) ──
      if (fundingSeries && fundingData.length > 0) {
        fundingSeries.setData(
          fundingData.map((d) => ({
            time: d.time as UTCTimestamp,
            value: d.value,
            color: d.value >= 0 ? theme.fundingUp : theme.fundingDown,
          })),
        );
      }

      // ── Liquidation series ──
      if (liqLongSeries && liqData.length > 0) {
        liqLongSeries.setData(
          liqData.map((d) => ({
            time: d.time as UTCTimestamp,
            value: d.long,
          })),
        );
      }
      if (liqShortSeries && liqData.length > 0) {
        liqShortSeries.setData(
          liqData.map((d) => ({
            time: d.time as UTCTimestamp,
            value: -d.short,
          })),
        );
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        console.warn('[DerivativesRuntime] Sync error:', err);
      }
    }
  }

  function sync(pair: string, timeframe: string) {
    const key = `${pair}|${timeframe}`;
    if (key === lastSyncKey) return;
    lastSyncKey = key;

    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      doSync(pair, timeframe);
    }, 300);
  }

  function forceSync(pair: string, timeframe: string) {
    lastSyncKey = ''; // reset to force
    sync(pair, timeframe);
  }

  function getPaneRefs(): DerivativesPaneRefs {
    return {
      oiSeries,
      oiPaneIndex,
      fundingSeries,
      fundingPaneIndex,
      liqLongSeries,
      liqShortSeries,
      liqPaneIndex,
    };
  }

  function dispose() {
    if (syncTimer) {
      clearTimeout(syncTimer);
      syncTimer = null;
    }
    abortController?.abort();
    abortController = null;
    lastSyncKey = '';
  }

  return { sync, forceSync, getPaneRefs, dispose };
}
