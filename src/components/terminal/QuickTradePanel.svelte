<script lang="ts">
  import { quickTradeStore, openTrades, closedTrades, totalQuickPnL, closeQuickTrade, clearClosedTrades, toggleTradePanel } from '$lib/stores/quickTradeStore';
  import { gameState } from '$lib/stores/gameState';

  $: state = $gameState;
  $: panel = $quickTradeStore;
  $: opens = $openTrades;
  $: closed = $closedTrades;
  $: totalPnl = $totalQuickPnL;

  let showClosed = false;

  function handleClose(tradeId: string) {
    const trade = opens.find(t => t.id === tradeId);
    if (!trade) return;
    const token = trade.pair.split('/')[0] as keyof typeof state.prices;
    const currentPrice = state.prices[token] || state.prices.BTC;
    closeQuickTrade(tradeId, currentPrice);
  }

  function pnlColor(pnl: number): string {
    return pnl >= 0 ? 'var(--grn)' : 'var(--red)';
  }

  function pnlPrefix(pnl: number): string {
    return pnl >= 0 ? '+' : '';
  }

  function timeSince(ts: number): string {
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m`;
    return `${Math.floor(sec / 3600)}h`;
  }
</script>

{#if panel.showPanel}
<div class="qtp">
  <div class="qtp-header">
    <span class="qtp-title">📊 QUICK TRADES</span>
    <div class="qtp-header-right">
      <span class="qtp-pnl" style="color:{pnlColor(totalPnl)}">
        {pnlPrefix(totalPnl)}{totalPnl.toFixed(2)}%
      </span>
      <button class="qtp-close" on:click={toggleTradePanel}>✕</button>
    </div>
  </div>

  <!-- Open Positions -->
  {#if opens.length > 0}
    <div class="qtp-section">
      <div class="qtp-section-title">OPEN ({opens.length})</div>
      {#each opens as trade (trade.id)}
        <div class="qtp-trade">
          <div class="qtp-trade-left">
            <span class="qtp-dir" class:long={trade.dir === 'LONG'} class:short={trade.dir === 'SHORT'}>
              {trade.dir === 'LONG' ? '▲' : '▼'}{trade.dir}
            </span>
            <span class="qtp-pair">{trade.pair}</span>
            <span class="qtp-src">{trade.source}</span>
          </div>
          <div class="qtp-trade-right">
            <span class="qtp-entry">${Math.round(trade.entry).toLocaleString()}</span>
            <span class="qtp-pnl-val" style="color:{pnlColor(trade.pnlPercent)}">
              {pnlPrefix(trade.pnlPercent)}{trade.pnlPercent}%
            </span>
            <span class="qtp-time">{timeSince(trade.openedAt)}</span>
            <button class="qtp-close-btn" on:click={() => handleClose(trade.id)}>CLOSE</button>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="qtp-empty">No open positions. Use QUICK LONG/SHORT to start.</div>
  {/if}

  <!-- Closed Positions Toggle -->
  {#if closed.length > 0}
    <button class="qtp-toggle" on:click={() => showClosed = !showClosed}>
      CLOSED ({closed.length}) {showClosed ? '▲' : '▼'}
    </button>
    {#if showClosed}
      <div class="qtp-section qtp-closed-section">
        {#each closed.slice(0, 20) as trade (trade.id)}
          <div class="qtp-trade closed">
            <div class="qtp-trade-left">
              <span class="qtp-dir" class:long={trade.dir === 'LONG'} class:short={trade.dir === 'SHORT'}>
                {trade.dir === 'LONG' ? '▲' : '▼'}
              </span>
              <span class="qtp-pair">{trade.pair}</span>
            </div>
            <div class="qtp-trade-right">
              <span class="qtp-pnl-val" style="color:{pnlColor(trade.closePnl || 0)}">
                {pnlPrefix(trade.closePnl || 0)}{(trade.closePnl || 0).toFixed(2)}%
              </span>
            </div>
          </div>
        {/each}
        <button class="qtp-clear" on:click={clearClosedTrades}>CLEAR HISTORY</button>
      </div>
    {/if}
  {/if}
</div>
{/if}

<style>
  .qtp {
    position: absolute;
    bottom: 28px;
    left: 50%;
    transform: translateX(-50%);
    width: min(500px, 90%);
    background: #0c0c18;
    border: 3px solid var(--yel);
    border-radius: 10px;
    box-shadow: 0 -4px 20px rgba(255,230,0,.15), 4px 4px 0 #000;
    z-index: 50;
    max-height: 320px;
    overflow-y: auto;
    animation: qtSlideUp .2s ease;
  }
  @keyframes qtSlideUp {
    from { opacity: 0; transform: translateX(-50%) translateY(10px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  .qtp-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 2px solid rgba(255,230,0,.15);
    background: rgba(255,230,0,.04);
  }
  .qtp-title {
    font-family: var(--fd);
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 2px;
    color: var(--yel);
  }
  .qtp-header-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .qtp-pnl {
    font-family: var(--fd);
    font-size: 12px;
    font-weight: 900;
    letter-spacing: .5px;
  }
  .qtp-close {
    font-size: 12px;
    background: none;
    border: none;
    color: rgba(255,255,255,.4);
    cursor: pointer;
    padding: 2px 4px;
    transition: color .15s;
  }
  .qtp-close:hover { color: #fff; }

  .qtp-section {
    padding: 6px 10px;
  }
  .qtp-section-title {
    font-family: var(--fm);
    font-size: 7px;
    font-weight: 900;
    letter-spacing: 2px;
    color: rgba(255,255,255,.3);
    margin-bottom: 4px;
  }

  .qtp-trade {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 5px 4px;
    border-bottom: 1px solid rgba(255,255,255,.04);
    transition: background .1s;
  }
  .qtp-trade:hover { background: rgba(255,255,255,.02); }
  .qtp-trade.closed { opacity: .5; }

  .qtp-trade-left {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .qtp-dir {
    font-family: var(--fm);
    font-size: 7px;
    font-weight: 900;
    letter-spacing: .5px;
    padding: 2px 5px;
    border-radius: 3px;
    border: 1px solid;
  }
  .qtp-dir.long {
    color: var(--grn);
    border-color: rgba(0,255,136,.3);
    background: rgba(0,255,136,.08);
  }
  .qtp-dir.short {
    color: var(--red);
    border-color: rgba(255,45,85,.3);
    background: rgba(255,45,85,.08);
  }
  .qtp-pair {
    font-family: var(--fm);
    font-size: 9px;
    font-weight: 700;
    color: rgba(255,255,255,.7);
  }
  .qtp-src {
    font-family: var(--fm);
    font-size: 6px;
    color: rgba(255,255,255,.25);
    letter-spacing: .5px;
    background: rgba(255,255,255,.04);
    padding: 1px 4px;
    border-radius: 3px;
  }

  .qtp-trade-right {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .qtp-entry {
    font-family: var(--fm);
    font-size: 8px;
    color: rgba(255,255,255,.4);
  }
  .qtp-pnl-val {
    font-family: var(--fd);
    font-size: 10px;
    font-weight: 900;
    letter-spacing: .5px;
    min-width: 50px;
    text-align: right;
  }
  .qtp-time {
    font-family: var(--fm);
    font-size: 7px;
    color: rgba(255,255,255,.2);
  }
  .qtp-close-btn {
    font-family: var(--fm);
    font-size: 7px;
    font-weight: 900;
    letter-spacing: 1px;
    padding: 3px 8px;
    border-radius: 3px;
    background: rgba(255,45,85,.12);
    color: var(--red);
    border: 1px solid rgba(255,45,85,.3);
    cursor: pointer;
    transition: all .12s;
  }
  .qtp-close-btn:hover {
    background: rgba(255,45,85,.3);
  }

  .qtp-empty {
    padding: 16px;
    text-align: center;
    font-family: var(--fm);
    font-size: 8px;
    color: rgba(255,255,255,.25);
    letter-spacing: 1px;
  }

  .qtp-toggle {
    width: 100%;
    padding: 5px 10px;
    font-family: var(--fm);
    font-size: 7px;
    font-weight: 900;
    letter-spacing: 1.5px;
    color: rgba(255,255,255,.3);
    background: rgba(255,255,255,.02);
    border: none;
    border-top: 1px solid rgba(255,255,255,.06);
    cursor: pointer;
    text-align: left;
    transition: background .12s;
  }
  .qtp-toggle:hover { background: rgba(255,255,255,.05); }

  .qtp-closed-section {
    max-height: 120px;
    overflow-y: auto;
  }

  .qtp-clear {
    width: 100%;
    padding: 5px;
    font-family: var(--fm);
    font-size: 7px;
    font-weight: 700;
    letter-spacing: 1px;
    color: rgba(255,255,255,.2);
    background: none;
    border: none;
    cursor: pointer;
    text-align: center;
    margin-top: 4px;
  }
  .qtp-clear:hover { color: var(--red); }
</style>
