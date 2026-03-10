<script lang="ts">
  import type { DrawingMode } from '$lib/chart/chartTypes';
  import type { ChartTheme } from '../ChartTheme';
  import ChartHeaderControls from './ChartHeaderControls.svelte';
  import ChartHeaderMetaStrip from './ChartHeaderMetaStrip.svelte';
  import ChartHeaderSummary from './ChartHeaderSummary.svelte';

  interface Props {
    chartMode: 'agent' | 'trading';
    pair: string;
    timeframe: string;
    pairBaseLabel: string;
    pairQuoteLabel: string;
    livePrice: number;
    priceChange24h: number;
    low24h: number;
    high24h: number;
    quoteVolume24h: number;
    error?: string;
    isTvLikePreset?: boolean;
    advancedMode?: boolean;
    chatFirstMode?: boolean;
    chatTradeReady?: boolean;
    chatTradeDir?: 'LONG' | 'SHORT';
    indicatorStripState?: 'expanded' | 'collapsed' | 'hidden';
    drawingMode: DrawingMode;
    hasActiveTradeSetup?: boolean;
    klineCount?: number;
    ma7Val: number;
    ma25Val: number;
    ma99Val: number;
    rsiVal: number;
    latestVolume: number;
    chartTheme: ChartTheme;
    onChangePair?: (pair: string) => void;
    onChangeTimeframe?: (timeframe: string) => void;
    onSetChartMode?: (mode: 'agent' | 'trading') => void;
    onSetDrawingMode?: (mode: DrawingMode) => void;
    onRequestChatAssist?: () => void;
    onRequestAgentScan?: () => void;
    onForcePatternScan?: () => void;
    onPublishCommunitySignal?: (dir: 'LONG' | 'SHORT') => void;
    onRestoreIndicatorStrip?: () => void;
  }

  let {
    chartMode,
    pair,
    timeframe,
    pairBaseLabel,
    pairQuoteLabel,
    livePrice,
    priceChange24h,
    low24h,
    high24h,
    quoteVolume24h,
    isTvLikePreset = false,
    advancedMode = false,
    chatFirstMode = false,
    chatTradeReady = false,
    chatTradeDir = 'LONG',
    indicatorStripState = 'collapsed',
    drawingMode,
    hasActiveTradeSetup = false,
    klineCount = 0,
    ma7Val,
    ma25Val,
    ma99Val,
    rsiVal,
    latestVolume,
    chartTheme,
    onChangePair = () => {},
    onChangeTimeframe = () => {},
    onSetChartMode = () => {},
    onSetDrawingMode = () => {},
    onRequestChatAssist = () => {},
    onRequestAgentScan = () => {},
    onForcePatternScan = () => {},
    onPublishCommunitySignal = () => {},
    onRestoreIndicatorStrip = () => {},
  }: Props = $props();
</script>

<div class="chart-bar" class:tv-like={isTvLikePreset}>
  <div class="bar-tools">
    <ChartHeaderSummary
      {chartMode}
      {pair}
      {timeframe}
      {pairBaseLabel}
      {pairQuoteLabel}
      {livePrice}
      {priceChange24h}
      {low24h}
      {high24h}
      {quoteVolume24h}
      onChangePair={onChangePair}
      onChangeTimeframe={onChangeTimeframe}
    />

    <ChartHeaderControls
      {chartMode}
      {isTvLikePreset}
      {advancedMode}
      {chatFirstMode}
      {chatTradeReady}
      {chatTradeDir}
      {indicatorStripState}
      {drawingMode}
      hasActiveTradeSetup={hasActiveTradeSetup}
      onSetChartMode={onSetChartMode}
      onSetDrawingMode={onSetDrawingMode}
      onRequestChatAssist={onRequestChatAssist}
      onRequestAgentScan={onRequestAgentScan}
      onForcePatternScan={onForcePatternScan}
      onPublishCommunitySignal={onPublishCommunitySignal}
      onRestoreIndicatorStrip={onRestoreIndicatorStrip}
    />
  </div>

  <ChartHeaderMetaStrip
    {chartMode}
    {advancedMode}
    {klineCount}
    {ma7Val}
    {ma25Val}
    {ma99Val}
    {rsiVal}
    {latestVolume}
    {chartTheme}
  />
</div>

<style>
  .chart-bar {
    padding: 0 8px;
    border-bottom: 1px solid #2a2e39;
    display: flex;
    flex-direction: column;
    gap: 0;
    background: #131722;
    font-size: 11px;
    font-family: var(--fm);
    flex-shrink: 0;
  }

  .chart-bar.tv-like {
    background: #131722;
    border-bottom: 1px solid #2a2e39;
  }

  .bar-tools {
    display: flex;
    align-items: center;
    gap: 0;
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    padding: 4px 0;
  }

  .bar-tools::-webkit-scrollbar {
    height: 3px;
  }

  .bar-tools::-webkit-scrollbar-thumb {
    background: #363a45;
    border-radius: 999px;
  }

  @media (max-width: 768px) {
    .chart-bar {
      padding: 0 6px;
    }

    .bar-tools {
      gap: 0;
    }
  }
</style>
