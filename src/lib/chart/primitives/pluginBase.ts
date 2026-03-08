// ═══════════════════════════════════════════════════════════════
// Stockclaw — PluginBase (lightweight-charts v5 Series Primitive)
// ═══════════════════════════════════════════════════════════════
// Official pattern from TradingView plugin examples.
// All drawing primitives extend this class.

import type {
  IChartApi,
  ISeriesApi,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  SeriesType,
  Time,
  DataChangedScope,
} from 'lightweight-charts';

function ensureDefined<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error(
      '[PLUGIN_BASE] Value is undefined\n수정: attached() 이후에만 chart/series 접근\n예시: this.chart (getter)',
    );
  }
  return value;
}

export abstract class PluginBase implements ISeriesPrimitive<Time> {
  private _chart: IChartApi | undefined;
  private _series: ISeriesApi<SeriesType> | undefined;
  private _requestUpdate?: () => void;

  // Subclass hook: called when underlying data changes
  protected dataUpdated?(_scope: DataChangedScope): void;

  // ── Lifecycle ──────────────────────────────────────
  public attached({ chart, series, requestUpdate }: SeriesAttachedParameter<Time>) {
    this._chart = chart;
    this._series = series;
    this._requestUpdate = requestUpdate;
    if (this._series && this.dataUpdated) {
      this._series.subscribeDataChanged(this._fireDataUpdated);
    }
    this.requestUpdate();
  }

  public detached() {
    if (this._series && this.dataUpdated) {
      this._series.unsubscribeDataChanged(this._fireDataUpdated);
    }
    this._chart = undefined;
    this._series = undefined;
    this._requestUpdate = undefined;
  }

  // ── Accessors ──────────────────────────────────────
  public get chart(): IChartApi {
    return ensureDefined(this._chart);
  }

  public get series(): ISeriesApi<SeriesType> {
    return ensureDefined(this._series);
  }

  // ── Request redraw ─────────────────────────────────
  public requestUpdate(): void {
    this._requestUpdate?.();
  }

  // ── Data change forwarding ─────────────────────────
  private _fireDataUpdated = (scope: DataChangedScope) => {
    this.dataUpdated?.(scope);
  };
}
