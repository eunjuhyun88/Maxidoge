<script lang="ts">
  import type { AgentSignal } from '$lib/data/warroom';
  import { createTerminalMobileSplitRuntime } from '$lib/terminal/terminalMobileSplitRuntime';
  import type {
    MobileTab,
    ScanIntelDetail,
    ChartCommunitySignal,
    ChartPanelHandle,
    ChatMsg,
    SharedChartPanelProps,
    SharedIntelPanelProps,
    TerminalChartRequestDetail,
    TerminalDensityMode,
    WarRoomHandle,
  } from '$lib/terminal/terminalTypes';
  import WarRoom from './WarRoom.svelte';
  import TerminalChartViewport from './TerminalChartViewport.svelte';
  import IntelPanel from './IntelPanel.svelte';
  import MobileActionBar from './MobileActionBar.svelte';
  import MobileChatSheet from './MobileChatSheet.svelte';

  interface Props {
    densityMode?: TerminalDensityMode;
    sharedChartPanelProps: SharedChartPanelProps;
    sharedIntelPanelProps: SharedIntelPanelProps;
    mobileTab?: MobileTab;
    latestScan?: ScanIntelDetail | null;
    terminalScanning?: boolean;
    scanStale?: boolean;
    warRoomRef?: WarRoomHandle | null;
    chartRef?: ChartPanelHandle | null;
    onSetMobileTab?: (tab: MobileTab) => void;
    onScanStart?: () => void;
    onScanComplete?: (detail: ScanIntelDetail) => void;
    onShowOnChart?: (detail: { signal: AgentSignal }) => void;
    onChartScanRequest?: (detail: TerminalChartRequestDetail) => void;
    onChartChatRequest?: (detail: TerminalChartRequestDetail) => void;
    onChartCommunitySignal?: (detail: ChartCommunitySignal) => void;
    onChartScanStale?: () => void;
    onClearTradeSetup?: () => void;
    onCopyTrade?: () => void;
    onSendChat?: (detail: { text: string }) => void | Promise<void>;
    onGoToTrade?: () => void | Promise<void>;
    chatMessages?: ChatMsg[];
    isTyping?: boolean;
  }
  let {
    densityMode = 'essential',
    sharedChartPanelProps,
    sharedIntelPanelProps,
    mobileTab = 'chart',
    latestScan = null,
    terminalScanning = false,
    scanStale = false,
    warRoomRef = $bindable(null),
    chartRef = $bindable(null),
    onSetMobileTab = () => {},
    onScanStart = () => {},
    onScanComplete = () => {},
    onShowOnChart = () => {},
    onChartScanRequest = () => {},
    onChartChatRequest = () => {},
    onChartCommunitySignal = () => {},
    onChartScanStale = () => {},
    onClearTradeSetup = () => {},
    onCopyTrade,
    onSendChat = () => {},
    onGoToTrade = () => {},
    chatMessages = [],
    isTyping = false,
  }: Props = $props();

  let splitContainerEl = $state<HTMLDivElement | null>(null);
  const {
    chatPercent,
    resizing,
    ...terminalMobileSplitRuntime
  } = createTerminalMobileSplitRuntime();

  $effect(() => {
    terminalMobileSplitRuntime.setContainer(splitContainerEl);
  });
</script>

<div class="terminal-mobile">
  {#if mobileTab === 'chart'}
    <!-- ══ Split view: chart (top) + divider + chat (bottom) ══ -->
    <div
      class="mob-split"
      class:mob-split-resizing={$resizing}
      bind:this={splitContainerEl}
    >
      <div class="mob-chart-pane" style="flex: {100 - $chatPercent}">
        <TerminalChartViewport
          bind:chartRef
          shellClass="mob-chart-section"
          areaClass="mob-chart-area"
          {sharedChartPanelProps}
          showVerdictOverlay
          {latestScan}
          {terminalScanning}
          {scanStale}
          {onCopyTrade}
          onVerdictTap={() => onSetMobileTab('warroom')}
          onChartScanRequest={onChartScanRequest}
          onChartChatRequest={onChartChatRequest}
          onChartCommunitySignal={onChartCommunitySignal}
          onChartScanStale={onChartScanStale}
          onClearTradeSetup={onClearTradeSetup}
        />
      </div>

      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        class="mob-divider"
        class:mob-divider-active={$resizing}
        role="separator"
        aria-orientation="horizontal"
        aria-valuenow={$chatPercent}
        aria-valuemin={15}
        aria-valuemax={80}
        tabindex="0"
        onpointerdown={terminalMobileSplitRuntime.startResize}
        onpointermove={terminalMobileSplitRuntime.moveResize}
        onpointerup={terminalMobileSplitRuntime.endResize}
        onpointercancel={terminalMobileSplitRuntime.endResize}
      >
        <span class="mob-divider-bar"></span>
      </div>

      <div class="mob-chat-pane" style="flex: {$chatPercent}">
        <MobileChatSheet
          splitMode
          sheetState={'half'}
          {chatMessages}
          {isTyping}
          onSendChat={onSendChat}
          onGoToTrade={onGoToTrade}
          onSheetStateChange={() => {}}
          onGoToFullChat={() => onSetMobileTab('intel')}
        />
      </div>
    </div>

  {:else if mobileTab === 'warroom'}
    <div class="mob-content">
      <div class="mob-panel-wrap">
        <WarRoom
          bind:this={warRoomRef}
          {densityMode}
          onScanStart={onScanStart}
          onScanComplete={onScanComplete}
          onShowOnChart={onShowOnChart}
          onShareToCommunity={onChartCommunitySignal}
        />
      </div>
    </div>
  {:else if mobileTab === 'intel'}
    <div class="mob-content">
      <div class="mob-panel-wrap">
        <IntelPanel
          {...sharedIntelPanelProps}
          prioritizeChat
          onSendChat={onSendChat}
          onGoToTrade={onGoToTrade}
        />
      </div>
    </div>
  {/if}

  <!-- ══ Scan/trade action bar — only on chart tab ══ -->
  {#if mobileTab === 'chart'}
    <MobileActionBar
      scan={latestScan}
      scanning={terminalScanning}
      onScanStart={onScanStart}
      onGoToTrade={onGoToTrade}
      onShowWarRoom={() => onSetMobileTab('warroom')}
    />
  {/if}

  <!-- ══ Tab nav — always visible at bottom ══ -->
  <div class="mob-tab-strip">
    <button class="mob-tab-btn" class:active={mobileTab === 'chart'} onclick={() => onSetMobileTab('chart')}>CHART</button>
    <button class="mob-tab-btn" class:active={mobileTab === 'warroom'} onclick={() => onSetMobileTab('warroom')}>WAR</button>
    <button class="mob-tab-btn" class:active={mobileTab === 'intel'} onclick={() => onSetMobileTab('intel')}>INTEL</button>
  </div>
</div>
