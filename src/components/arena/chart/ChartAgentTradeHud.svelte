<script lang="ts">
  import type { ChartAgentTradeHudProps } from './chartAgentOverlayChromeContracts';

  let {
    activeTradeSetup = null,
    drawingsVisible = true,
    hasScanned = false,
    onCloseActiveTradeSetup = () => {},
    onRequestAgentScan = () => {},
    onExecuteActiveTrade = () => {},
    onPublishTradeSignal = () => {},
  }: ChartAgentTradeHudProps = $props();
</script>

{#if activeTradeSetup && drawingsVisible}
  <button class="overlay-close-btn" onclick={onCloseActiveTradeSetup} title="Close overlay">&#x2715;</button>
{/if}

{#if !hasScanned && !activeTradeSetup}
  <div class="first-scan-cta">
    <button class="fsc-btn" onclick={onRequestAgentScan}>
      <span class="fsc-icon">&#x25C9;</span>
      <span class="fsc-label">RUN FIRST SCAN</span>
      <span class="fsc-sub">Generate agent consensus</span>
    </button>
  </div>
{/if}

{#if activeTradeSetup}
  <div class="trade-cta-bar">
    <span class="tcb-dir" class:long={activeTradeSetup.dir === 'LONG'} class:short={activeTradeSetup.dir === 'SHORT'}>
      {activeTradeSetup.dir === 'LONG' ? '▲' : '▼'} {activeTradeSetup.dir}
    </span>
    <span class="tcb-conf">{activeTradeSetup.conf}%</span>
    <span class="tcb-rr">R:R 1:{activeTradeSetup.rr.toFixed(1)}</span>
    <button class="tcb-execute" class:long={activeTradeSetup.dir === 'LONG'} class:short={activeTradeSetup.dir === 'SHORT'} onclick={onExecuteActiveTrade}>
      EXECUTE {activeTradeSetup.dir}
    </button>
    <button class="tcb-copy" onclick={onPublishTradeSignal} title="커뮤니티에 시그널 공유">
      📡 공유
    </button>
  </div>
{/if}

<style>
  .overlay-close-btn {
    position: absolute;
    top: 8px;
    right: 80px;
    z-index: 10;
    width: 22px;
    height: 22px;
    border-radius: 4px;
    background: rgba(10,9,8,.8);
    border: 1px solid rgba(232,150,125,.35);
    color: rgba(232,150,125,.9);
    font-size: 11px;
    line-height: 1;
    cursor: pointer;
    transition: all .15s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .overlay-close-btn:hover { background: rgba(232,150,125,.15); border-color: #e8967d; color: #e8967d; }

  .first-scan-cta {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 12;
  }

  .fsc-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    border-radius: 999px;
    background: rgba(10,9,8,.76);
    border: 1.5px solid rgba(232,150,125,.3);
    cursor: pointer;
    transition: all .2s;
    backdrop-filter: blur(4px);
  }

  .fsc-btn:hover { border-color: #e8967d; box-shadow: 0 0 12px rgba(232,150,125,.15); background: rgba(232,150,125,.14); }

  .fsc-icon { font-size: 11px; color: #e8967d; animation: fscPulse 2s ease infinite; }

  @keyframes fscPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.92)} }

  .fsc-label { font-family: var(--fm); font-size: 9px; font-weight: 900; letter-spacing: 1px; color: #e8967d; }
  .fsc-sub { font-family: var(--fm); font-size: 9px; color: rgba(240,237,228,.62); letter-spacing: .3px; }

  .trade-cta-bar {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 14;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 12px;
    background: rgba(10,9,8,.9);
    border-top: 1px solid rgba(232,150,125,.2);
    backdrop-filter: blur(4px);
  }

  .tcb-dir { font-family: var(--fm); font-size: 11px; font-weight: 900; letter-spacing: 1px; }
  .tcb-dir.long { color: var(--grn, #00ff88); }
  .tcb-dir.short { color: var(--red, #ff2d55); }
  .tcb-conf { font-family: var(--fd); font-size: 12px; font-weight: 800; color: rgba(240,237,228,.6); }
  .tcb-rr { font-family: var(--fm); font-size: 9px; color: rgba(240,237,228,.55); letter-spacing: .5px; }

  .tcb-execute {
    margin-left: auto;
    padding: 5px 16px;
    border-radius: 4px;
    font-family: var(--fm);
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 1px;
    cursor: pointer;
    transition: all .15s;
    border: 1px solid;
  }

  .tcb-execute.long { color: #0a0908; background: var(--grn, #00ff88); border-color: var(--grn, #00ff88); }
  .tcb-execute.long:hover { box-shadow: 0 0 12px rgba(0,255,136,.3); }
  .tcb-execute.short { color: #fff; background: var(--red, #ff2d55); border-color: var(--red, #ff2d55); }
  .tcb-execute.short:hover { box-shadow: 0 0 12px rgba(255,45,85,.3); }

  .tcb-copy {
    padding: 5px 10px;
    border-radius: 4px;
    border: 1px solid rgba(232,150,125,.45);
    background: rgba(232,150,125,.16);
    color: #ffe8d8;
    font-family: var(--fm);
    font-size: 9px;
    font-weight: 900;
    letter-spacing: .8px;
    cursor: pointer;
    transition: all .15s;
  }

  .tcb-copy:hover {
    border-color: rgba(232,150,125,.65);
    background: rgba(232,150,125,.24);
    color: #fff5ee;
    box-shadow: 0 0 10px rgba(232,150,125,.24);
  }

  @media (max-width: 768px) {
    .first-scan-cta { top: 6px; right: 6px; }
    .fsc-sub { display: none; }
    .fsc-btn { padding: 4px 8px; }
    .trade-cta-bar { display: none; }
  }
</style>
