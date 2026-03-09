<script lang="ts">
  import ChartPanel from '../arena/ChartPanel.svelte';
  import ChartVerdictOverlay from './ChartVerdictOverlay.svelte';
  import type {
    ChartCommunitySignal,
    ChartPanelHandle,
    ScanIntelDetail,
    SharedChartPanelProps,
    TerminalChartRequestDetail,
  } from '$lib/terminal/terminalTypes';

  interface Props {
    sharedChartPanelProps: SharedChartPanelProps;
    chartRef?: ChartPanelHandle | null;
    shellClass?: string;
    areaClass?: string;
    latestScan?: ScanIntelDetail | null;
    terminalScanning?: boolean;
    scanStale?: boolean;
    showVerdictOverlay?: boolean;
    onVerdictTap?: () => void;
    onCopyTrade?: () => void;
    onChartScanRequest?: (detail: TerminalChartRequestDetail) => void;
    onChartChatRequest?: (detail: TerminalChartRequestDetail) => void;
    onChartCommunitySignal?: (detail: ChartCommunitySignal) => void;
    onClearTradeSetup?: () => void;
    onConnectionStatusChange?: (status: 'live' | 'offline') => void;
  }

  let {
    sharedChartPanelProps,
    chartRef = $bindable(null),
    shellClass = '',
    areaClass = '',
    latestScan = null,
    terminalScanning = false,
    scanStale = false,
    showVerdictOverlay = false,
    onVerdictTap = () => {},
    onCopyTrade,
    onChartScanRequest = () => {},
    onChartChatRequest = () => {},
    onChartCommunitySignal = () => {},
    onClearTradeSetup = () => {},
    onConnectionStatusChange = () => {},
  }: Props = $props();
</script>

<div class={shellClass}>
  {#if areaClass}
    <div class={areaClass}>
      <ChartPanel
        bind:this={chartRef}
        {...sharedChartPanelProps}
        onScanRequest={(detail) => onChartScanRequest(detail)}
        onChatRequest={(detail) => onChartChatRequest(detail)}
        onCommunitySignal={(detail) => onChartCommunitySignal(detail)}
        onClearTradeSetup={() => onClearTradeSetup()}
        onConnectionStatusChange={(s) => onConnectionStatusChange(s)}
      />
    </div>
  {:else}
    <ChartPanel
      bind:this={chartRef}
      {...sharedChartPanelProps}
      onScanRequest={(detail) => onChartScanRequest(detail)}
      onChatRequest={(detail) => onChartChatRequest(detail)}
      onCommunitySignal={(detail) => onChartCommunitySignal(detail)}
      onClearTradeSetup={() => onClearTradeSetup()}
      onConnectionStatusChange={(s) => onConnectionStatusChange(s)}
    />
  {/if}

  {#if showVerdictOverlay}
    <ChartVerdictOverlay
      verdict={latestScan}
      scanning={terminalScanning}
      stale={scanStale}
      onTap={onVerdictTap}
      {onCopyTrade}
    />
  {/if}
</div>
