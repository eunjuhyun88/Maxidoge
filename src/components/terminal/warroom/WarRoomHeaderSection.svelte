<script lang="ts">
  import type { TokenFilter, ScanTab } from './types';

  export let volatilityAlert = false;
  export let currentPair = 'BTC/USDT';
  export let currentTF = '4h';
  export let activeScanTab: ScanTab | null = null;
  export let activeScanId = 'preset';
  export let scanTabs: ScanTab[] = [];
  export let tokenTabs: string[] = [];
  export let activeToken: TokenFilter = 'ALL';
  export let tokenCounts: Record<string, number> = {};
  export let derivOI: number | null = null;
  export let derivFunding: number | null = null;
  export let derivPredFunding: number | null = null;
  export let derivLSRatio: number | null = null;
  export let derivLiqLong = 0;
  export let derivLiqShort = 0;
  export let derivLoading = false;
  export let scanRunning = false;
  export let scanStep = '';
  export let scanError = '';

  export let formatOI: (value: number) => string;
  export let formatFunding: (value: number) => string;
  export let onWheel: (event: WheelEvent) => void;
  export let onGoSignals: () => void;
  export let onGoArena: () => void;
  export let onCollapse: () => void;
  export let onActivateScanTab: (id: string) => void;
  export let onSetActiveToken: (token: TokenFilter) => void;
</script>

{#if volatilityAlert}
  <div class="vol-alert">
    <div class="vol-pulse"></div>
    <span class="vol-text">VOLATILITY SPIKE DETECTED</span>
    <button class="vol-arena-btn" on:click={onGoArena}>OPEN ARENA</button>
  </div>
{/if}

<div class="wr-header">
  <div class="wr-title-wrap">
    <span class="wr-title">WAR ROOM</span>
  </div>
  <div class="wr-header-right" on:wheel={onWheel}>
    <button class="wr-chip signal-link" on:click={onGoSignals}>SIGNALS</button>
    <button class="wr-chip arena-trigger" on:click={onGoArena}>ARENA</button>
  </div>
  <button class="wr-collapse-btn" on:click={onCollapse} title="Collapse panel" aria-label="Collapse panel">
    <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <rect x="1" y="2" width="14" height="12" rx="1.5"/>
      <line x1="6" y1="2" x2="6" y2="14"/>
    </svg>
  </button>
</div>

<div class="ticker-flow" on:wheel={onWheel}>
  <span class="ticker-chip ticker-pair">{currentPair}</span>
  <span class="ticker-chip ticker-tf">{String(currentTF).toUpperCase()}</span>
  {#if activeScanTab}
    <span class="ticker-chip ticker-stamp">SCANNED {activeScanTab.label}</span>
  {/if}
  {#if !activeScanTab && activeScanId === 'preset'}
    <span class="ticker-chip ticker-hint">RUN SCAN ↓</span>
  {/if}
</div>

<div class="scan-tabs" on:wheel={onWheel}>
  {#if scanTabs.length > 0}
    <button class="scan-tab scan-tab-history" class:active={activeScanId === 'preset'} on:click={() => onActivateScanTab('preset')}>
      HISTORY
    </button>
    {#each scanTabs as tab (tab.id)}
      <button class="scan-tab" class:active={activeScanId === tab.id} on:click={() => onActivateScanTab(tab.id)}>
        <span class="scan-tab-token">{tab.token}</span>
        <span class="scan-tab-meta">{tab.label}</span>
      </button>
    {/each}
  {:else}
    <button class="scan-tab active" disabled>
      SCAN TO START
    </button>
  {/if}
</div>

{#if tokenTabs.length > 2}
  <div class="token-tabs" on:wheel={onWheel}>
    {#each tokenTabs as tok (tok)}
      <button
        class="token-tab"
        class:active={activeToken === tok}
        class:btc={tok === 'BTC'}
        class:eth={tok === 'ETH'}
        class:sol={tok === 'SOL'}
        on:click={() => onSetActiveToken(tok)}
      >
        {tok}
        <span class="token-tab-count">{tokenCounts[tok] || 0}</span>
      </button>
    {/each}
  </div>
{/if}

<div class="deriv-strip">
  <div class="deriv-row">
    <div class="deriv-cell">
      <span class="deriv-lbl">OI</span>
      <span class="deriv-val" class:loading={derivLoading}>
        {derivOI != null ? formatOI(derivOI) : '—'}
      </span>
    </div>
    <div class="deriv-cell">
      <span class="deriv-lbl">FUNDING</span>
      <span class="deriv-val" class:pos={derivFunding != null && derivFunding > 0} class:neg={derivFunding != null && derivFunding < 0}>
        {derivFunding != null ? formatFunding(derivFunding) : '—'}
      </span>
    </div>
    <div class="deriv-cell">
      <span class="deriv-lbl">PRED</span>
      <span class="deriv-val" class:pos={derivPredFunding != null && derivPredFunding > 0} class:neg={derivPredFunding != null && derivPredFunding < 0}>
        {derivPredFunding != null ? formatFunding(derivPredFunding) : '—'}
      </span>
    </div>
  </div>
  <div class="deriv-row">
    <div class="deriv-cell">
      <span class="deriv-lbl">L/S</span>
      <span class="deriv-val" class:pos={derivLSRatio != null && derivLSRatio > 1} class:neg={derivLSRatio != null && derivLSRatio < 1}>
        {derivLSRatio != null ? Number(derivLSRatio).toFixed(2) : '—'}
      </span>
    </div>
    <div class="deriv-cell">
      <span class="deriv-lbl">LIQ ▲</span>
      <span class="deriv-val long-liq">{derivLiqLong > 0 ? formatOI(derivLiqLong) : '—'}</span>
    </div>
    <div class="deriv-cell">
      <span class="deriv-lbl">LIQ ▼</span>
      <span class="deriv-val short-liq">{derivLiqShort > 0 ? formatOI(derivLiqShort) : '—'}</span>
    </div>
  </div>
</div>

{#if scanRunning || scanStep || scanError}
  <div class="scan-status" class:error={Boolean(scanError)}>
    <span class="scan-status-dot"></span>
    <span class="scan-status-text">
      {#if scanError}
        {scanError}
      {:else}
        {scanStep || 'SCANNING...'}
      {/if}
    </span>
  </div>
{/if}
