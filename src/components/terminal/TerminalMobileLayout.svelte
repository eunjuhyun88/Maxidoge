<script lang="ts">
  import type { AgentSignal } from '$lib/data/warroom';
  import type {
    MobileTab,
    ScanIntelDetail,
    ChartCommunitySignal,
    ChartPanelHandle,
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

  type ChartRequestDetail = { source?: string; pair?: string; timeframe?: string };

  interface Props {
    densityMode?: 'essential' | 'pro';
    terminalControlBarProps: TerminalControlBarProps;
    sharedChartPanelProps: SharedChartPanelProps;
    sharedIntelPanelProps: SharedIntelPanelProps;
    mobileTab?: MobileTab;
    mobileOpenTrades?: number;
    mobileTrackedSignals?: number;
    latestScan?: ScanIntelDetail | null;
    terminalScanning?: boolean;
    warRoomRef?: WarRoomHandle | null;
    chartRef?: ChartPanelHandle | null;
    onSetMobileTab?: (tab: MobileTab) => void;
    onScanStart?: () => void;
    onScanComplete?: (detail: ScanIntelDetail) => void;
    onShowOnChart?: (detail: { signal: AgentSignal }) => void;
    onChartScanRequest?: (detail: ChartRequestDetail) => void;
    onChartChatRequest?: (detail: ChartRequestDetail) => void;
    onChartCommunitySignal?: (detail: ChartCommunitySignal) => void;
    onClearTradeSetup?: () => void;
    onSendChat?: (detail: { text: string }) => void | Promise<void>;
    onGoToTrade?: () => void | Promise<void>;
  }
  let {
    densityMode = 'essential',
    terminalControlBarProps,
    sharedChartPanelProps,
    sharedIntelPanelProps,
    mobileTab = 'chart',
    mobileOpenTrades = 0,
    mobileTrackedSignals = 0,
    latestScan = null,
    terminalScanning = false,
    warRoomRef = $bindable(null),
    chartRef = $bindable(null),
    onSetMobileTab = () => {},
    onScanStart = () => {},
    onScanComplete = () => {},
    onShowOnChart = () => {},
    onChartScanRequest = () => {},
    onChartChatRequest = () => {},
    onChartCommunitySignal = () => {},
    onClearTradeSetup = () => {},
    onSendChat = () => {},
    onGoToTrade = () => {},
  }: Props = $props();
</script>

<div class="terminal-mobile">
  <div class="mob-inline-rail">
    <TerminalControlBar
      {...terminalControlBarProps}
      variant="inline"
      showMarket={false}
      showPrimaryHint={false}
    />
  </div>

  <div class="mob-content" class:chart-only={mobileTab === 'chart'}>
    {#if mobileTab === 'warroom'}
      <div class="mob-panel-wrap">
        <WarRoom
          bind:this={warRoomRef}
          {densityMode}
          onScanStart={onScanStart}
          onScanComplete={onScanComplete}
          onShowOnChart={onShowOnChart}
        />
      </div>
    {:else if mobileTab === 'chart'}
      <div class="mob-chart-stack">
        <div class="mob-chart-section">
          <VerdictBanner verdict={latestScan} scanning={terminalScanning} />
          <div class="mob-chart-area">
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
    {:else if mobileTab === 'intel'}
      <div class="mob-panel-wrap">
        <IntelPanel
          {...sharedIntelPanelProps}
          prioritizeChat
          onSendChat={onSendChat}
          onGoToTrade={onGoToTrade}
        />
      </div>
    {/if}
  </div>

  <div class="mob-bottom-nav">
    <button class="mob-nav-btn" class:active={mobileTab === 'warroom'} onclick={() => onSetMobileTab('warroom')}>
      <span class="mob-nav-label">WAR ROOM</span>
      {#if mobileOpenTrades > 0}
        <span class="mob-nav-badge">{mobileOpenTrades > 9 ? '9+' : mobileOpenTrades}</span>
      {/if}
    </button>
    <button class="mob-nav-btn" class:active={mobileTab === 'chart'} onclick={() => onSetMobileTab('chart')}>
      <span class="mob-nav-label">CHART</span>
    </button>
    <button class="mob-nav-btn" class:active={mobileTab === 'intel'} onclick={() => onSetMobileTab('intel')}>
      <span class="mob-nav-label">CHAT</span>
      {#if mobileTrackedSignals > 0}
        <span class="mob-nav-badge">{mobileTrackedSignals > 9 ? '9+' : mobileTrackedSignals}</span>
      {/if}
    </button>
  </div>
</div>
