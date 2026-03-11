import { pairToSymbol } from '$lib/api/binance';
import type { AgentTradeSetup, DrawingMode } from '$lib/chart/chartTypes';
import type { CanonicalTimeframe } from '$lib/utils/timeframe';
import { normalizeTimeframe, toBinanceInterval } from '$lib/utils/timeframe';
import type { IndicatorSnapshot, PatternDetection } from '$lib/terminal/signalEvidence';
import type {
  ChartInteractiveActionRuntimeController,
  CreateChartInteractiveActionRuntimeOptions,
} from './chartInteractiveActionRuntime';

export interface ChartActionRuntimeController {
  changePair(pair: string): void;
  changeTimeframe(timeframe: string): void;
  requestAgentScan(): void;
  publishCommunitySignal(
    dir: 'LONG' | 'SHORT',
    options?: { openCopyTrade?: boolean; sourceContext?: string },
  ): Promise<void>;
  requestChatAssist(): Promise<void>;
  activateTradeDrawing(dir?: 'LONG' | 'SHORT'): Promise<void>;
  dispose(): void;
}

export interface CreateChartActionRuntimeOptions {
  getPair: () => string;
  getTimeframe: () => string;
  getLivePrice: () => number;
  getActiveTradeSetup: () => AgentTradeSetup | null;
  getChatTradeReady: () => boolean;
  getChatTradeDir: () => 'LONG' | 'SHORT';
  getEnableTradeLineEntry: () => boolean;
  getChartMode: () => 'agent' | 'trading';
  clearPendingTradePlan: () => void;
  updateGameState: (patch: { pair?: string; timeframe?: CanonicalTimeframe }) => void;
  reloadChartData: (options?: { symbol?: string; interval?: string; pairBase?: string }) => Promise<void> | void;
  setChartMode: (mode: 'agent' | 'trading') => Promise<void>;
  setDrawingMode: (mode: DrawingMode) => void;
  emitScanRequest: (detail: { source: string; pair: string; timeframe: string }) => void;
  emitChatRequest: (detail: { source: string; pair: string; timeframe: string }) => void;
  emitCommunitySignal: (detail: {
    pair: string;
    dir: 'LONG' | 'SHORT';
    entry: number;
    tp: number;
    sl: number;
    conf: number;
    source: string;
    reason: string;
    openCopyTrade: boolean;
    evidence?: import('$lib/terminal/signalEvidence').SignalEvidence;
  }) => void;
  /** 차트 인디케이터 스냅샷 (evidence 조립용) */
  getIndicatorSnapshot?: () => IndicatorSnapshot;
  /** 차트 패턴 감지 결과 (evidence 조립용) */
  getOverlayPatterns?: () => PatternDetection[];
  emitGtm: (event: string, payload?: Record<string, unknown>) => void;
  pushChartNotice: (message: string) => void;
  /** Mark scan result as stale when TF/pair changes after a scan */
  markScanStale?: () => void;
}

export function createChartActionRuntime(
  options: CreateChartActionRuntimeOptions,
): ChartActionRuntimeController {
  let interactiveRuntimePromise: Promise<ChartInteractiveActionRuntimeController> | null = null;

  function buildInteractiveOptions(): CreateChartInteractiveActionRuntimeOptions {
    return {
      getPair: options.getPair,
      getTimeframe: options.getTimeframe,
      getLivePrice: options.getLivePrice,
      getActiveTradeSetup: options.getActiveTradeSetup,
      getChatTradeReady: options.getChatTradeReady,
      getChatTradeDir: options.getChatTradeDir,
      getEnableTradeLineEntry: options.getEnableTradeLineEntry,
      getChartMode: options.getChartMode,
      setChartMode: options.setChartMode,
      setDrawingMode: options.setDrawingMode,
      emitChatRequest: options.emitChatRequest,
      emitCommunitySignal: options.emitCommunitySignal,
      getIndicatorSnapshot: options.getIndicatorSnapshot,
      getOverlayPatterns: options.getOverlayPatterns,
      emitGtm: options.emitGtm,
      pushChartNotice: options.pushChartNotice,
    };
  }

  function loadInteractiveRuntime() {
    if (!interactiveRuntimePromise) {
      interactiveRuntimePromise = import('./chartInteractiveActionRuntime').then((module) =>
        module.createChartInteractiveActionRuntime(buildInteractiveOptions()),
      );
    }
    return interactiveRuntimePromise;
  }

  function changePair(pair: string) {
    options.emitGtm('terminal_pair_change', { pair });
    options.clearPendingTradePlan();
    options.markScanStale?.();
    options.updateGameState({ pair });
    void options.reloadChartData({
      symbol: pairToSymbol(pair),
      interval: toBinanceInterval(options.getTimeframe()),
      pairBase: (pair.split('/')[0] || 'BTC').toUpperCase(),
    });
  }

  function changeTimeframe(timeframe: string) {
    const normalized = normalizeTimeframe(timeframe);
    options.emitGtm('terminal_timeframe_change', { timeframe: normalized });
    options.clearPendingTradePlan();
    options.markScanStale?.();
    options.updateGameState({ timeframe: normalized });
    void options.reloadChartData({
      symbol: pairToSymbol(options.getPair()),
      interval: toBinanceInterval(normalized),
    });
  }

  function requestAgentScan() {
    const pair = options.getPair();
    const timeframe = options.getTimeframe();
    options.emitGtm('terminal_scan_request_chart', {
      source: 'chart-bar',
      pair,
      timeframe,
    });
    options.emitScanRequest({
      source: 'chart-bar',
      pair,
      timeframe,
    });
  }

  function publishCommunitySignal(
    dir: 'LONG' | 'SHORT',
    runtimeOptions?: { openCopyTrade?: boolean; sourceContext?: string },
  ) {
    return loadInteractiveRuntime().then((runtime) =>
      runtime.publishCommunitySignal(dir, runtimeOptions),
    );
  }

  function requestChatAssist() {
    return loadInteractiveRuntime().then((runtime) => runtime.requestChatAssist());
  }

  function activateTradeDrawing(dir?: 'LONG' | 'SHORT') {
    return loadInteractiveRuntime().then((runtime) => runtime.activateTradeDrawing(dir));
  }

  function dispose() {
    void interactiveRuntimePromise?.then((runtime) => runtime.dispose());
    interactiveRuntimePromise = null;
  }

  return {
    changePair,
    changeTimeframe,
    requestAgentScan,
    publishCommunitySignal,
    requestChatAssist,
    activateTradeDrawing,
    dispose,
  };
}
