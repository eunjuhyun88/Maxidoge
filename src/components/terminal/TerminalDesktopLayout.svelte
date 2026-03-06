<script lang="ts">
  import type { AgentSignal } from '$lib/data/warroom';
  import type {
    ChartCommunitySignal,
    ChartPanelHandle,
    DragTarget,
    ScanIntelDetail,
    SharedChartPanelProps,
    SharedIntelPanelProps,
    TerminalControlBarProps,
    WarRoomHandle,
  } from '../../routes/terminal/terminalTypes';
  import WarRoom from './WarRoom.svelte';
  import ChartPanel from '../arena/ChartPanel.svelte';
  import VerdictBanner from './VerdictBanner.svelte';
  import IntelPanel from './IntelPanel.svelte';
  import TerminalControlBar from './TerminalControlBar.svelte';
  import TerminalTicker from './TerminalTicker.svelte';

  type ChartRequestDetail = { source?: string; pair?: string; timeframe?: string };

  interface Props {
    densityMode?: 'essential' | 'pro';
    leftCollapsed?: boolean;
    rightCollapsed?: boolean;
    leftW?: number;
    rightW?: number;
    dragTarget?: DragTarget;
    terminalControlBarProps: TerminalControlBarProps;
    sharedChartPanelProps: SharedChartPanelProps;
    sharedIntelPanelProps: SharedIntelPanelProps;
    latestScan?: ScanIntelDetail | null;
    terminalScanning?: boolean;
    tickerSegments?: string[];
    tickerSegmentClass?: (segment: string) => string;
    warRoomRef?: WarRoomHandle | null;
    chartRef?: ChartPanelHandle | null;
    onToggleLeft?: () => void;
    onToggleRight?: () => void;
    onScanStart?: () => void;
    onScanComplete?: (detail: ScanIntelDetail) => void;
    onShowOnChart?: (detail: { signal: AgentSignal }) => void;
    onChartScanRequest?: (detail: ChartRequestDetail) => void;
    onChartChatRequest?: (detail: ChartRequestDetail) => void;
    onChartCommunitySignal?: (detail: ChartCommunitySignal) => void;
    onClearTradeSetup?: () => void;
    onSendChat?: (detail: { text: string }) => void | Promise<void>;
    onGoToTrade?: () => void | Promise<void>;
    onStartDrag?: (target: DragTarget, event: MouseEvent) => void;
    onResizePanelByWheel?: (target: 'left' | 'right' | 'center', event: WheelEvent, options?: { force?: boolean }) => void;
  }
  let {
    densityMode = 'essential',
    leftCollapsed = false,
    rightCollapsed = false,
    leftW = 308,
    rightW = 332,
    dragTarget = null,
    terminalControlBarProps,
    sharedChartPanelProps,
    sharedIntelPanelProps,
    latestScan = null,
    terminalScanning = false,
    tickerSegments = [],
    tickerSegmentClass = () => 'ticker-chip',
    warRoomRef = $bindable(null),
    chartRef = $bindable(null),
    onToggleLeft = () => {},
    onToggleRight = () => {},
    onScanStart = () => {},
    onScanComplete = () => {},
    onShowOnChart = () => {},
    onChartScanRequest = () => {},
    onChartChatRequest = () => {},
    onChartCommunitySignal = () => {},
    onClearTradeSetup = () => {},
    onSendChat = () => {},
    onGoToTrade = () => {},
    onStartDrag = () => {},
    onResizePanelByWheel = () => {},
  }: Props = $props();
</script>

<div
  class="terminal-page"
  style="grid-template-columns: {leftCollapsed ? 30 : leftW}px 4px 1fr 4px {rightCollapsed ? 30 : rightW}px"
>
  {#if !leftCollapsed}
    <div class="tl" onwheel={(event) => onResizePanelByWheel('left', event)}>
      <div class="desk-panel-resizable">
        <div class="desk-panel-body">
          <WarRoom
            bind:this={warRoomRef}
            {densityMode}
            onCollapse={onToggleLeft}
            onScanStart={onScanStart}
            onScanComplete={onScanComplete}
            onShowOnChart={onShowOnChart}
          />
        </div>
      </div>
    </div>
  {:else}
    <button
      class="panel-strip panel-strip-left"
      onclick={onToggleLeft}
      onwheel={(event) => onResizePanelByWheel('left', event, { force: true })}
      title="Show War Room"
    >
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="1" y="2" width="14" height="12" rx="1.5" />
        <line x1="6" y1="2" x2="6" y2="14" />
      </svg>
      <span class="strip-label">WAR</span>
    </button>
  {/if}

  {#if !leftCollapsed}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="resizer resizer-h resizer-left" onmousedown={(event) => onStartDrag('left', event)}>
    </div>
  {:else}
    <div class="resizer-spacer"></div>
  {/if}

  <div class="tc">
    <div class="desk-panel-resizable">
      <div class="desk-panel-body">
        <div class="desk-chart-rail">
          <TerminalControlBar
            {...terminalControlBarProps}
            variant="inline"
            showMarket={false}
            showPrimaryHint={false}
          />
        </div>
        <VerdictBanner verdict={latestScan} scanning={terminalScanning} />
        <div class="chart-area chart-area-full">
          <ChartPanel
            bind:this={chartRef}
            {...sharedChartPanelProps}
            onScanRequest={(detail) => onChartScanRequest(detail)}
            onChatRequest={(detail) => onChartChatRequest(detail)}
            onCommunitySignal={(detail) => onChartCommunitySignal(detail)}
            onClearTradeSetup={() => onClearTradeSetup()}
          />
        </div>
      </div>
    </div>
  </div>

  {#if !rightCollapsed}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="resizer resizer-h resizer-right"
      onwheel={(event) => onResizePanelByWheel('right', event, { force: true })}
      title="스크롤/드래그로 INTEL 너비 조절"
    >
      <div class="resizer-drag" onmousedown={(event) => onStartDrag('right', event)}></div>
    </div>
  {:else}
    <div class="resizer-spacer"></div>
  {/if}

  {#if !rightCollapsed}
    <div class="tr" onwheel={(event) => onResizePanelByWheel('right', event)}>
      <div class="desk-panel-resizable">
        <div class="desk-panel-body">
          <IntelPanel
            {...sharedIntelPanelProps}
            onSendChat={onSendChat}
            onGoToTrade={onGoToTrade}
            onCollapse={onToggleRight}
          />
        </div>
      </div>
    </div>
  {:else}
    <button
      class="panel-strip panel-strip-right"
      onclick={onToggleRight}
      onwheel={(event) => onResizePanelByWheel('right', event, { force: true })}
      title="Show Intel"
    >
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="1" y="2" width="14" height="12" rx="1.5" />
        <line x1="10" y1="2" x2="10" y2="14" />
      </svg>
      <span class="strip-label">INTEL</span>
    </button>
  {/if}

  <div class="ticker-slot">
    <TerminalTicker segments={tickerSegments} idPrefix="desk" segmentClass={tickerSegmentClass} />
  </div>

  {#if dragTarget}
    <div class="drag-overlay col"></div>
  {/if}
</div>
