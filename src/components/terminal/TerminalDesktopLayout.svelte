<script lang="ts">
  import type { AgentSignal } from '$lib/data/warroom';
  import type {
    ChartCommunitySignal,
    ChartPanelHandle,
    DragTarget,
    ScanIntelDetail,
    SharedChartPanelProps,
    SharedIntelPanelProps,
    TerminalChartRequestDetail,
    TerminalControlBarProps,
    TerminalDensityMode,
    TerminalPanelResizeTarget,
    WarRoomHandle,
  } from '$lib/terminal/terminalTypes';
  import WarRoom from './WarRoom.svelte';
  import { buildTerminalVerdictMeta } from '$lib/terminal/terminalViewModel';
  import TerminalChartViewport from './TerminalChartViewport.svelte';
  import IntelPanel from './IntelPanel.svelte';
  import TerminalControlBar from './TerminalControlBar.svelte';
  import TerminalTicker from './TerminalTicker.svelte';

  interface Props {
    densityMode?: TerminalDensityMode;
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
    onChartScanRequest?: (detail: TerminalChartRequestDetail) => void;
    onChartChatRequest?: (detail: TerminalChartRequestDetail) => void;
    onChartCommunitySignal?: (detail: ChartCommunitySignal) => void;
    onClearTradeSetup?: () => void;
    onSendChat?: (detail: { text: string }) => void | Promise<void>;
    onGoToTrade?: () => void | Promise<void>;
    onStartDrag?: (target: DragTarget, event: MouseEvent) => void;
    onResizePanelByWheel?: (target: TerminalPanelResizeTarget, event: WheelEvent, options?: { force?: boolean }) => void;
    onShareToCommunity?: () => void;
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
    onShareToCommunity = () => {},
  }: Props = $props();

  let chartConnectionStatus = $state<'live' | 'offline'>('live');
  const verdictMeta = $derived(buildTerminalVerdictMeta(latestScan));
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
            onShareToCommunity={onChartCommunitySignal}
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
            verdictAgree={verdictMeta.agree}
            verdictTime={verdictMeta.time}
            connectionStatus={chartConnectionStatus}
          />
          <button class="share-to-community-btn" onclick={onShareToCommunity} title="커뮤니티에 공유">
            📡 공유
          </button>
        </div>
        <TerminalChartViewport
          bind:chartRef
          shellClass="chart-area chart-area-full"
          {sharedChartPanelProps}
          onChartScanRequest={onChartScanRequest}
          onChartChatRequest={onChartChatRequest}
          onChartCommunitySignal={onChartCommunitySignal}
          onClearTradeSetup={onClearTradeSetup}
          onConnectionStatusChange={(s) => { chartConnectionStatus = s; }}
        />
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
