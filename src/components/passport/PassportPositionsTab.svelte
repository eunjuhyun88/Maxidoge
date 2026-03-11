<script lang="ts">
  import EmptyState from '../shared/EmptyState.svelte';
  import { CHARACTER_ART } from '$lib/data/agents';
  import { pnlColor, pnlPrefix, timeSince } from './passportHelpers';

  interface OpenTradeItem {
    id: string;
    dir: 'LONG' | 'SHORT';
    pair: string;
    source: string;
    entry: number;
    pnlPercent: number;
    openedAt: number;
  }

  interface TrackedSignalItem {
    id: string;
    dir: 'LONG' | 'SHORT';
    pair: string;
    source: string;
    pnlPercent: number;
    trackedAt: number;
  }

  interface ClosedTradeItem {
    id: string;
    dir: 'LONG' | 'SHORT';
    pair: string;
    closePnl?: number | null;
  }

  interface Props {
    opens: OpenTradeItem[];
    tracked: TrackedSignalItem[];
    closed: ClosedTradeItem[];
    unrealizedPnl: number;
    totalPnl: number;
  }

  const OPEN_PREVIEW_LIMIT = 4;

  let {
    opens,
    tracked,
    closed,
    unrealizedPnl,
    totalPnl,
  }: Props = $props();

  const openPreview = $derived(opens.slice(0, OPEN_PREVIEW_LIMIT));
  const openOverflow = $derived(opens.slice(OPEN_PREVIEW_LIMIT));
</script>

<div class="positions-tab">
  <section class="content-panel">
    <div class="pos-summary">
      <div class="ps-item"><div class="psi-label">OPEN</div><div class="psi-value">{opens.length}</div></div>
      <div class="ps-item"><div class="psi-label">UNREALIZED</div><div class="psi-value" style="color:{pnlColor(unrealizedPnl)}">{pnlPrefix(unrealizedPnl)}{unrealizedPnl.toFixed(2)}%</div></div>
      <div class="ps-item"><div class="psi-label">TRACKED</div><div class="psi-value" style="color:#ff8c3b">{tracked.length}</div></div>
      <div class="ps-item"><div class="psi-label">TOTAL PnL</div><div class="psi-value" style="color:{pnlColor(totalPnl)}">{pnlPrefix(totalPnl)}{totalPnl.toFixed(2)}%</div></div>
    </div>
  </section>

  <section class="content-panel list-panel">
    {#if opens.length > 0}
      <div class="pos-section-title">OPEN TRADES</div>
      {#each openPreview as trade (trade.id)}
        <div class="pos-row">
          <div class="pr-left">
            <span class="pr-dir" class:long={trade.dir === 'LONG'} class:short={trade.dir === 'SHORT'}>{trade.dir === 'LONG' ? '▲' : '▼'}{trade.dir}</span>
            <span class="pr-pair">{trade.pair}</span>
            <span class="pr-src">{trade.source}</span>
          </div>
          <div class="pr-right">
            <span class="pr-entry">${Math.round(trade.entry).toLocaleString()}</span>
            <span class="pr-pnl" style="color:{pnlColor(trade.pnlPercent)}">{pnlPrefix(trade.pnlPercent)}{trade.pnlPercent.toFixed(2)}%</span>
            <span class="pr-time">{timeSince(trade.openedAt)}</span>
          </div>
        </div>
      {/each}
      {#if openOverflow.length > 0}
        <details class="detail-block detail-spaced">
          <summary>MORE OPEN TRADES ({openOverflow.length})</summary>
          {#each openOverflow as trade (trade.id)}
            <div class="pos-row">
              <div class="pr-left">
                <span class="pr-dir" class:long={trade.dir === 'LONG'} class:short={trade.dir === 'SHORT'}>{trade.dir === 'LONG' ? '▲' : '▼'}{trade.dir}</span>
                <span class="pr-pair">{trade.pair}</span>
                <span class="pr-src">{trade.source}</span>
              </div>
              <div class="pr-right">
                <span class="pr-entry">${Math.round(trade.entry).toLocaleString()}</span>
                <span class="pr-pnl" style="color:{pnlColor(trade.pnlPercent)}">{pnlPrefix(trade.pnlPercent)}{trade.pnlPercent.toFixed(2)}%</span>
                <span class="pr-time">{timeSince(trade.openedAt)}</span>
              </div>
            </div>
          {/each}
        </details>
      {/if}
    {:else}
      <EmptyState image={CHARACTER_ART.tradeActions} title="NO OPEN POSITIONS" subtitle="Use QUICK LONG/SHORT in the Terminal to start trading" ctaText="GO TO TERMINAL →" ctaHref="/terminal" icon="📊" variant="cyan" compact />
    {/if}

    {#if tracked.length > 0}
      <details class="detail-block detail-spaced">
        <summary>TRACKED SIGNALS ({tracked.length})</summary>
        {#each tracked as sig (sig.id)}
          <div class="pos-row tracked">
            <div class="pr-left">
              <span class="pr-dir" class:long={sig.dir === 'LONG'} class:short={sig.dir === 'SHORT'}>{sig.dir === 'LONG' ? '▲' : '▼'}{sig.dir}</span>
              <span class="pr-pair">{sig.pair}</span>
              <span class="pr-src">📌 {sig.source}</span>
            </div>
            <div class="pr-right">
              <span class="pr-pnl" style="color:{pnlColor(sig.pnlPercent)}">{pnlPrefix(sig.pnlPercent)}{sig.pnlPercent.toFixed(2)}%</span>
              <span class="pr-time">{timeSince(sig.trackedAt)}</span>
            </div>
          </div>
        {/each}
      </details>
    {/if}

    {#if closed.length > 0}
      <details class="detail-block detail-spaced">
        <summary>RECENTLY CLOSED ({closed.length})</summary>
        {#each closed.slice(0, 10) as trade (trade.id)}
          <div class="pos-row closed">
            <div class="pr-left">
              <span class="pr-dir" class:long={trade.dir === 'LONG'} class:short={trade.dir === 'SHORT'}>{trade.dir === 'LONG' ? '▲' : '▼'}</span>
              <span class="pr-pair">{trade.pair}</span>
            </div>
            <div class="pr-right">
              <span class="pr-pnl" style="color:{pnlColor(trade.closePnl || 0)}">{pnlPrefix(trade.closePnl || 0)}{(trade.closePnl || 0).toFixed(2)}%</span>
            </div>
          </div>
        {/each}
      </details>
    {/if}
  </section>
</div>

<style>
  @import './passportTabShared.css';

  .positions-tab {
    display: flex;
    flex-direction: column;
    gap: var(--sp-space-2);
  }

  .pos-summary {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--sp-space-3);
  }

  .ps-item {
    border: 1px solid var(--sp-soft);
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.02);
    padding: var(--sp-space-3) var(--sp-space-2);
    text-align: center;
  }

  .psi-value {
    color: var(--sp-w);
    font-family: var(--fd);
    font-size: 18px;
    font-weight: 800;
    line-height: 1.1;
  }

  .psi-label {
    margin-top: 4px;
    color: var(--sp-dim);
    font-family: var(--fp);
    font-size: 9px;
    letter-spacing: 0.08px;
  }

  .pos-section-title {
    color: var(--sp-pk-l);
    font-family: var(--fp);
    font-size: 10px;
    letter-spacing: 0.08px;
    margin-bottom: 6px;
  }

  .pos-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 2px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .pos-row.tracked {
    border-color: rgba(255, 140, 121, 0.14);
  }

  .pos-row.closed {
    opacity: 0.82;
  }

  .pr-left,
  .pr-right {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .pr-right {
    flex-shrink: 0;
  }

  .pr-dir {
    min-width: 54px;
    height: 22px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    font-family: var(--fp);
    font-size: 9px;
    letter-spacing: 0.08px;
    border: 1px solid var(--sp-soft);
    color: var(--sp-w);
  }

  .pr-dir.long {
    color: #9dffcf;
    border-color: rgba(157, 255, 207, 0.35);
    background: rgba(157, 255, 207, 0.08);
  }

  .pr-dir.short {
    color: #ff9f93;
    border-color: rgba(255, 114, 93, 0.35);
    background: rgba(255, 114, 93, 0.08);
  }

  .pr-pair {
    font-family: var(--fd);
    font-size: 12px;
    color: var(--sp-w);
  }

  .pr-src,
  .pr-time {
    color: var(--sp-dim);
    font-family: var(--fm);
    font-size: 10px;
  }

  .pr-entry,
  .pr-pnl {
    font-family: var(--fd);
    font-size: 12px;
  }

  @media (max-width: 1024px) {
    .pos-summary {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 768px) {
    .pos-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }

    .pr-right {
      width: 100%;
      justify-content: space-between;
    }

    .psi-value {
      font-size: 15px;
    }
  }

  @media (max-width: 480px) {
    .pos-summary {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--sp-space-1);
    }

    .ps-item {
      padding: var(--sp-space-2) var(--sp-space-1);
    }

    .psi-value {
      font-size: 14px;
    }

    .psi-label {
      font-size: var(--sc-fs-2xs, 9px);
    }

    .pr-pair {
      font-size: 11px;
    }

    .pr-src {
      font-size: 9px;
      padding: 2px 6px;
    }

    .pr-pnl {
      font-size: 11px;
      min-width: 48px;
    }
  }
</style>
