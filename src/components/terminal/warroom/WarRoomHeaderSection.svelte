<script lang="ts">
  import type { TokenFilter, ScanTab } from './types';

  interface Props {
    currentPair?: string;
    currentTF?: string;
    activeScanTab?: ScanTab | null;
    activeScanId?: string;
    scanTabs?: ScanTab[];
    tokenTabs?: string[];
    activeToken?: TokenFilter;
    tokenCounts?: Record<string, number>;
    derivOI?: number | null;
    derivFunding?: number | null;
    derivPredFunding?: number | null;
    derivLSRatio?: number | null;
    derivLoading?: boolean;
    scanRunning?: boolean;
    scanStep?: string;
    scanError?: string;
    formatOI?: (value: number) => string;
    formatFunding?: (value: number) => string;
    onWheel?: (event: WheelEvent) => void;
    onCollapse?: () => void;
    onRunScan?: () => void;
    onActivateScanTab?: (id: string) => void;
    onSetActiveToken?: (token: TokenFilter) => void;
  }

  let {
    currentPair = 'BTC/USDT',
    currentTF = '4h',
    activeScanTab = null,
    activeScanId = 'preset',
    scanTabs = [],
    tokenTabs = [],
    activeToken = 'ALL',
    tokenCounts = {},
    derivOI = null,
    derivFunding = null,
    derivPredFunding = null,
    derivLSRatio = null,
    derivLoading = false,
    scanRunning = false,
    scanStep = '',
    scanError = '',
    formatOI = (v: number) => String(v),
    formatFunding = (v: number) => String(v),
    onWheel = () => {},
    onCollapse = () => {},
    onRunScan = () => {},
    onActivateScanTab = () => {},
    onSetActiveToken = () => {},
  }: Props = $props();
</script>

<!-- Row 1: Pair + TF + Scan status + Collapse -->
<div class="wr-header-compact">
  <span class="wr-pair">{currentPair}</span>
  <span class="wr-tf">{String(currentTF).toUpperCase()}</span>
  {#if scanRunning}
    <span class="wr-scan-dot scanning"></span>
    <span class="wr-scan-label">{scanStep || 'SCANNING...'}</span>
  {:else if scanError}
    <span class="wr-scan-dot error"></span>
    <span class="wr-scan-label wr-scan-error">{scanError}</span>
  {:else if activeScanTab}
    <span class="wr-scan-dot done"></span>
    <span class="wr-scan-label">{activeScanTab.label}</span>
  {/if}
  <span class="wr-spacer"></span>
  <button class="wr-scan-btn" onclick={onRunScan} disabled={scanRunning} title="Run scan">
    ⚡ {scanRunning ? 'SCANNING' : 'SCAN'}
  </button>
  <button class="wr-collapse-btn" onclick={onCollapse} title="Collapse panel" aria-label="Collapse panel">
    <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <rect x="1" y="2" width="14" height="12" rx="1.5"/>
      <line x1="6" y1="2" x2="6" y2="14"/>
    </svg>
  </button>
</div>

<!-- Row 2: Derivatives (single compact line) -->
<div class="wr-deriv-compact" onwheel={onWheel}>
  {#if derivLoading}
    <span class="wr-deriv-skel"></span>
  {:else}
    <span class="wr-dc"><span class="wr-dc-lbl">OI</span> <span class="wr-dc-val">{derivOI != null ? formatOI(derivOI) : '—'}</span></span>
    <span class="wr-dc"><span class="wr-dc-lbl">FUND</span> <span class="wr-dc-val" class:pos={derivFunding != null && derivFunding > 0} class:neg={derivFunding != null && derivFunding < 0}>{derivFunding != null ? formatFunding(derivFunding) : '—'}</span></span>
    <span class="wr-dc"><span class="wr-dc-lbl">L/S</span> <span class="wr-dc-val" class:pos={derivLSRatio != null && derivLSRatio > 1} class:neg={derivLSRatio != null && derivLSRatio < 1}>{derivLSRatio != null ? Number(derivLSRatio).toFixed(2) : '—'}</span></span>
    <span class="wr-dc"><span class="wr-dc-lbl">PRED</span> <span class="wr-dc-val">{derivPredFunding != null ? formatFunding(derivPredFunding) : '—'}</span></span>
  {/if}
</div>

<!-- Row 3: Scan tabs (only if there are tabs) -->
{#if scanTabs.length > 0}
  <div class="scan-tabs" onwheel={onWheel}>
    <button class="scan-tab scan-tab-history" class:active={activeScanId === 'preset'} onclick={() => onActivateScanTab('preset')}>
      HISTORY
    </button>
    {#each scanTabs as tab (tab.id)}
      {@const longs = tab.signals.filter(s => s.vote === 'long').length}
      {@const shorts = tab.signals.filter(s => s.vote === 'short').length}
      {@const consensus = longs > shorts ? 'long' : shorts > longs ? 'short' : 'neutral'}
      <button class="scan-tab" class:active={activeScanId === tab.id} onclick={() => onActivateScanTab(tab.id)}>
        <span class="scan-tab-dir {consensus}">{consensus === 'long' ? '▲' : consensus === 'short' ? '▼' : '—'}</span>
        <span class="scan-tab-token">{tab.token}</span>
        <span class="scan-tab-meta">{tab.label}</span>
      </button>
    {/each}
  </div>
{/if}

<!-- Token filter chips (inline with signal feed, only if multiple tokens) -->
{#if tokenTabs.length > 2}
  <div class="token-tabs" onwheel={onWheel}>
    {#each tokenTabs as tok (tok)}
      <button
        class="token-tab"
        class:active={activeToken === tok}
        onclick={() => onSetActiveToken(tok)}
      >
        {tok}
        <span class="token-tab-count">{tokenCounts[tok] || 0}</span>
      </button>
    {/each}
  </div>
{/if}
