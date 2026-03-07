<script lang="ts">
  import type { AgentSignal } from '$lib/data/warroom';
  import type {
    ChartCommunitySignal,
    ChartPanelHandle,
    ScanIntelDetail,
    SharedChartPanelProps,
    SharedIntelPanelProps,
    TerminalChartRequestDetail,
    TerminalControlBarProps,
    TerminalDensityMode,
    WarRoomHandle,
  } from '$lib/terminal/terminalTypes';
  import { buildTerminalVerdictMeta } from '$lib/terminal/terminalViewModel';
  import TerminalChartViewport from './TerminalChartViewport.svelte';
  import IntelPanel from './IntelPanel.svelte';
  import TerminalControlBar from './TerminalControlBar.svelte';
  import TerminalTicker from './TerminalTicker.svelte';
  import TabletWarRoomDrawer from './TabletWarRoomDrawer.svelte';

  interface Props {
    densityMode?: TerminalDensityMode;
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
    onChartScanRequest?: (detail: TerminalChartRequestDetail) => void;
    onChartChatRequest?: (detail: TerminalChartRequestDetail) => void;
    onChartCommunitySignal?: (detail: ChartCommunitySignal) => void;
    onClearTradeSetup?: () => void;
    onSendChat?: (detail: { text: string }) => void | Promise<void>;
    onGoToTrade?: () => void | Promise<void>;
    onResizeIntelByWheel?: (event: WheelEvent) => void;
    onStartIntelDrag?: (event: PointerEvent) => void;
    onResetIntelWidth?: () => void;
    onShareToCommunity?: () => void;
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
    onResizeIntelByWheel = () => {},
    onStartIntelDrag = () => {},
    onResetIntelWidth = () => {},
    onShareToCommunity = () => {},
  }: Props = $props();

  // WarRoom drawer state (local to tablet layout)
  let warRoomDrawerOpen = $state(false);

  const verdictMeta = $derived(buildTerminalVerdictMeta(latestScan));
</script>

<div class="terminal-tablet" style={tabletLayoutStyle}>
  <!-- ── Control bar row ── -->
  <div class="tab-chart-rail">
    <TerminalControlBar
      {...terminalControlBarProps}
      variant="inline"
      showMarket={false}
      showPrimaryHint={false}
      verdictAgree={verdictMeta.agree}
      verdictTime={verdictMeta.time}
    />
    <button class="share-to-community-btn" onclick={onShareToCommunity} title="커뮤니티에 공유">
      📡 공유
    </button>
  </div>

  <!-- ── Main: Chart | resizer | Intel ── -->
  <div class="tab-main">
    <TerminalChartViewport
      bind:chartRef
      shellClass="tab-chart-wrap"
      areaClass="tab-panel-body tab-chart-area"
      {sharedChartPanelProps}
      showVerdictOverlay
      {latestScan}
      {terminalScanning}
      onVerdictTap={() => { warRoomDrawerOpen = true; }}
      onChartScanRequest={onChartScanRequest}
      onChartChatRequest={onChartChatRequest}
      onChartCommunitySignal={onChartCommunitySignal}
      onClearTradeSetup={onClearTradeSetup}
    />

    <button
      type="button"
      class="tab-layout-split tab-layout-split-v"
      title="CHART / INTEL 너비 조절: 스크롤/드래그/더블클릭 리셋"
      aria-label="Resize chart and intel split"
      onwheel={(event) => onResizeIntelByWheel(event)}
      onpointerdown={(event) => onStartIntelDrag(event)}
      ondblclick={() => onResetIntelWidth()}
    >
      <span></span>
    </button>

    <div class="tab-intel-wrap">
      <div class="tab-panel-body">
        <IntelPanel
          {...sharedIntelPanelProps}
          onSendChat={onSendChat}
          onGoToTrade={onGoToTrade}
        />
      </div>
    </div>
  </div>

  <!-- ── Ticker ── -->
  <div class="ticker-slot">
    <TerminalTicker segments={tickerSegments} idPrefix="tab" segmentClass={tickerSegmentClass} />
  </div>

  <!-- ── WarRoom overlay drawer ── -->
  <TabletWarRoomDrawer
    open={warRoomDrawerOpen}
    {densityMode}
    bind:warRoomRef
    onToggle={() => { warRoomDrawerOpen = !warRoomDrawerOpen; }}
    onScanStart={onScanStart}
    onScanComplete={onScanComplete}
    onShowOnChart={onShowOnChart}
    onShareToCommunity={onChartCommunitySignal}
  />
</div>
