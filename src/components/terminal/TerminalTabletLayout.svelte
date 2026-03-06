<script lang="ts">
  import type { AgentSignal } from '$lib/data/warroom';
  import type {
    ChartCommunitySignal,
    ChartPanelHandle,
    ScanIntelDetail,
    SharedChartPanelProps,
    SharedIntelPanelProps,
    TabletSplitResizeAxis,
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
    tabletLayoutStyle?: string;
    terminalControlBarProps: TerminalControlBarProps;
    sharedChartPanelProps: SharedChartPanelProps;
    sharedIntelPanelProps: SharedIntelPanelProps;
    latestScan?: ScanIntelDetail | null;
    terminalScanning?: boolean;
    tickerSegments?: string[];
    tickerSegmentClass?: (segment: string) => string;
    warRoomRef?: WarRoomHandle | null;
    chartRef?: ChartPanelHandle | null;
    onScanStart?: () => void;
    onScanComplete?: (detail: ScanIntelDetail) => void;
    onShowOnChart?: (detail: { signal: AgentSignal }) => void;
    onChartScanRequest?: (detail: ChartRequestDetail) => void;
    onChartChatRequest?: (detail: ChartRequestDetail) => void;
    onChartCommunitySignal?: (detail: ChartCommunitySignal) => void;
    onClearTradeSetup?: () => void;
    onSendChat?: (detail: { text: string }) => void | Promise<void>;
    onGoToTrade?: () => void | Promise<void>;
    onResizeSplitByWheel?: (axis: TabletSplitResizeAxis, event: WheelEvent) => void;
    onStartSplitDrag?: (axis: TabletSplitResizeAxis, event: PointerEvent) => void;
    onResetSplit?: (axis: TabletSplitResizeAxis) => void;
  }
  let {
    densityMode = 'essential',
    tabletLayoutStyle = '',
    terminalControlBarProps,
    sharedChartPanelProps,
    sharedIntelPanelProps,
    latestScan = null,
    terminalScanning = false,
    tickerSegments = [],
    tickerSegmentClass = () => 'ticker-chip',
    warRoomRef = $bindable(null),
    chartRef = $bindable(null),
    onScanStart = () => {},
    onScanComplete = () => {},
    onShowOnChart = () => {},
    onChartScanRequest = () => {},
    onChartChatRequest = () => {},
    onChartCommunitySignal = () => {},
    onClearTradeSetup = () => {},
    onSendChat = () => {},
    onGoToTrade = () => {},
    onResizeSplitByWheel = () => {},
    onStartSplitDrag = () => {},
    onResetSplit = () => {},
  }: Props = $props();
</script>

<div class="terminal-tablet" style={tabletLayoutStyle}>
  <div class="tab-top">
    <div class="tab-left">
      <div class="tab-panel-resizable">
        <div class="tab-panel-body">
          <WarRoom
            bind:this={warRoomRef}
            {densityMode}
            onScanStart={onScanStart}
            onScanComplete={onScanComplete}
            onShowOnChart={onShowOnChart}
          />
        </div>
      </div>
    </div>
    <button
      type="button"
      class="tab-layout-split tab-layout-split-v"
      title="WAR ROOM / CHART 분할 조절: 스크롤/드래그/더블클릭 리셋"
      aria-label="Resize tablet left and chart split"
      onwheel={(event) => onResizeSplitByWheel('x', event)}
      onpointerdown={(event) => onStartSplitDrag('x', event)}
      ondblclick={() => onResetSplit('x')}
    >
      <span></span>
    </button>
    <div class="tab-center">
      <div class="tab-panel-resizable">
        <div class="tab-chart-rail">
          <TerminalControlBar
            {...terminalControlBarProps}
            variant="inline"
            showMarket={false}
            showPrimaryHint={false}
          />
        </div>
        <VerdictBanner verdict={latestScan} scanning={terminalScanning} />
        <div class="tab-panel-body tab-chart-area">
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
  <button
    type="button"
    class="tab-layout-split tab-layout-split-h"
    title="CHART / INTEL 높이 조절: 스크롤/드래그/더블클릭 리셋"
    aria-label="Resize tablet chart and intel split"
    onwheel={(event) => onResizeSplitByWheel('y', event)}
    onpointerdown={(event) => onStartSplitDrag('y', event)}
    ondblclick={() => onResetSplit('y')}
  >
    <span></span>
  </button>
  <div class="tab-bottom">
    <div class="tab-panel-resizable">
      <div class="tab-panel-body">
        <IntelPanel
          {...sharedIntelPanelProps}
          onSendChat={onSendChat}
          onGoToTrade={onGoToTrade}
        />
      </div>
    </div>
  </div>

  <div class="ticker-slot">
    <TerminalTicker segments={tickerSegments} idPrefix="tab" segmentClass={tickerSegmentClass} />
  </div>
</div>
