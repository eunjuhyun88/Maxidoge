import { pairToSymbol } from '$lib/api/binance';
import { buildCommunitySignalDraft } from '$lib/chart/chartTradePlanner';
import type { AgentTradeSetup, DrawingMode } from '$lib/chart/chartTypes';
import type { CanonicalTimeframe } from '$lib/utils/timeframe';
import { normalizeTimeframe, toBinanceInterval } from '$lib/utils/timeframe';

export interface ChartActionRuntimeController {
  changePair(pair: string): void;
  changeTimeframe(timeframe: string): void;
  requestAgentScan(): void;
  publishCommunitySignal(
    dir: 'LONG' | 'SHORT',
    options?: { openCopyTrade?: boolean; sourceContext?: string },
  ): void;
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
  }) => void;
  emitGtm: (event: string, payload?: Record<string, unknown>) => void;
  pushChartNotice: (message: string) => void;
}

export function createChartActionRuntime(
  options: CreateChartActionRuntimeOptions,
): ChartActionRuntimeController {
  async function activateTradeDrawing(dir?: 'LONG' | 'SHORT') {
    if (!options.getEnableTradeLineEntry()) return;

    if (options.getChartMode() !== 'agent') {
      await options.setChartMode('agent');
    }

    const mode: DrawingMode =
      dir === 'SHORT' ? 'shortentry' : dir === 'LONG' ? 'longentry' : 'trade';
    options.setDrawingMode(mode);
    options.emitGtm('terminal_trade_drawing_activate', {
      source: dir ? 'chat-first' : 'unified-tool',
      dir: dir ?? 'auto',
      pair: options.getPair(),
      timeframe: options.getTimeframe(),
    });

    if (dir) {
      options.pushChartNotice(`${dir} mode — drag on chart to set ENTRY/TP/SL`);
    } else {
      options.pushChartNotice('Position mode — drag down LONG · drag up SHORT');
    }
  }

  function changePair(pair: string) {
    options.emitGtm('terminal_pair_change', { pair });
    options.clearPendingTradePlan();
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
    const draft = buildCommunitySignalDraft({
      pair: options.getPair() || 'BTC/USDT',
      dir,
      livePrice: options.getLivePrice(),
      activeTradeSetup: options.getActiveTradeSetup(),
      timeframe: options.getTimeframe(),
      chatTradeReady: options.getChatTradeReady(),
      chatTradeDir: options.getChatTradeDir(),
    });
    if (!draft) {
      options.pushChartNotice('시그널 생성 실패: 가격 데이터가 부족합니다');
      return;
    }

    const openCopyTrade = runtimeOptions?.openCopyTrade !== false;
    options.emitCommunitySignal({
      pair: draft.pair,
      dir: draft.dir,
      entry: draft.entry,
      tp: draft.tp,
      sl: draft.sl,
      conf: draft.conf,
      source: draft.source,
      reason: draft.reason,
      openCopyTrade,
    });

    options.emitGtm('terminal_chart_community_signal', {
      source: runtimeOptions?.sourceContext || 'chart-action',
      pair: draft.pair,
      dir: draft.dir,
      entry: draft.entry,
      tp: draft.tp,
      sl: draft.sl,
      conf: draft.conf,
      openCopyTrade,
    });

    options.pushChartNotice(`${draft.dir} 시그널 생성 완료 · COMMUNITY${openCopyTrade ? ' + COPY' : ''}`);
  }

  async function requestChatAssist() {
    options.emitGtm('terminal_chat_request_chart', {
      source: 'chart-bar',
      pair: options.getPair(),
      timeframe: options.getTimeframe(),
      tradeReady: options.getChatTradeReady(),
      tradeDir: options.getChatTradeDir(),
    });

    if (options.getChatTradeReady()) {
      await activateTradeDrawing(options.getChatTradeDir());
      options.pushChartNotice(`${options.getChatTradeDir()} draw mode active`);
      return;
    }

    options.emitChatRequest({
      source: 'chart-bar',
      pair: options.getPair(),
      timeframe: options.getTimeframe(),
    });
    options.pushChartNotice('채팅 탭에서 질문 후 거래를 시작하세요');
  }

  function dispose() {}

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
