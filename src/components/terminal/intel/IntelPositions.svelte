<script lang="ts">
  import type { PositionTradeRow, PositionMarketRow } from '$lib/terminal/intel/intelTypes';
  import { parseOutcomePrices } from '$lib/api/polymarket';
  import { positionsLoading, positionsError, pendingPositions } from '$lib/stores/positionStore';
  import { predictMarkets } from '$lib/stores/predictStore';
  import { CRYPTO_RX } from '$lib/terminal/intel/intelTypes';
  import PolymarketBetPanel from '../PolymarketBetPanel.svelte';
  import GmxTradePanel from '../GmxTradePanel.svelte';

  interface Props {
    displayTrades?: PositionTradeRow[];
    displayGmxPositions?: PositionMarketRow[];
    displayPolymarketPositions?: PositionMarketRow[];
    displayOpenCount?: number;
    displayGmxCount?: number;
    displayPolymarketCount?: number;
    positionCount?: number;
    pendingCount?: number;
    positionsSyncStatus?: string;
    useDemoPositions?: boolean;
    onClosePos?: (id: string) => void;
    onRefresh?: () => void;
  }

  let {
    displayTrades = [],
    displayGmxPositions = [],
    displayPolymarketPositions = [],
    displayOpenCount = 0,
    displayGmxCount = 0,
    displayPolymarketCount = 0,
    positionCount = 0,
    pendingCount = 0,
    positionsSyncStatus = 'NOT SYNCED',
    useDemoPositions = false,
    onClosePos = () => {},
    onRefresh = () => {},
  }: Props = $props();

  let posView = $state<'mine' | 'markets'>('mine');
  let betMarket = $state<any>(null);
  let showGmxPanel = $state(false);

  const cryptoMarkets = $derived(
    $predictMarkets
      .filter(m => CRYPTO_RX.test(m.question))
      .slice(0, 8)
  );
</script>

<div class="pos-view-tabs">
  <button class="pos-view-tab" class:active={posView === 'mine'} onclick={() => posView = 'mine'}>
    MY POSITIONS
    {#if positionCount > 0}<span class="pos-view-cnt">{positionCount}</span>{/if}
  </button>
  <button class="pos-view-tab" class:active={posView === 'markets'} onclick={() => posView = 'markets'}>
    MARKETS
  </button>
</div>

<div class="rp-body">
  {#if posView === 'mine'}
    <div class="pos-sync-row">
      <span
        class="pos-sync-badge"
        class:loading={$positionsLoading}
        class:error={!!$positionsError && !useDemoPositions}
        class:ok={!$positionsLoading && !$positionsError}
        class:demo={useDemoPositions}
      >
        {positionsSyncStatus}
      </span>
      {#if pendingCount > 0}
        <span class="pos-sync-pending">{pendingCount} pending</span>
      {/if}
      <span class="pos-sync-total">{positionCount} total</span>
      <button class="pos-sync-btn" onclick={onRefresh} disabled={$positionsLoading}>REFRESH</button>
    </div>

    {#if $positionsError}
      <div class="pos-sync-error-msg" class:demo={useDemoPositions}>
        <div class="pos-sync-error-text">
          <span class="pos-sync-error-title">
            {useDemoPositions ? '라이브 연결 지연 · DEMO 포지션 표시 중' : '포지션 동기화에 실패했습니다'}
          </span>
          <span class="pos-sync-error-body">
            {useDemoPositions ? '연결 복구 시 실 포지션으로 자동 전환됩니다.' : $positionsError}
          </span>
          {#if useDemoPositions}
            <span class="pos-sync-error-note">연결 복구 전까지 데모 포지션을 표시합니다.</span>
          {/if}
        </div>
        <div class="pos-sync-error-actions">
          {#if !$positionsLoading}
            <button class="pos-sync-inline-btn" onclick={onRefresh}>RETRY</button>
          {/if}
          <button class="pos-sync-inline-btn ghost" onclick={() => { posView = 'markets'; }}>MARKETS</button>
        </div>
      </div>
    {/if}

    {#if displayOpenCount > 0}
      <div class="pos-header">
        <span class="pos-title">📊 TRADES</span>
        <span class="pos-cnt">{displayOpenCount}</span>
      </div>
      {#each displayTrades as trade (trade.id)}
        <div class="pos-row" class:demo={!!trade.demo}>
          <span class="pos-dir" class:long={trade.dir === 'LONG'} class:short={trade.dir === 'SHORT'}>
            {trade.dir === 'LONG' ? '▲' : '▼'}
          </span>
          <div class="pos-info">
            <span class="pos-pair">{trade.pair}</span>
            <span class="pos-entry">${Math.round(trade.entry).toLocaleString()}</span>
          </div>
          <span class="pos-pnl" style="color:{trade.pnlPercent >= 0 ? 'var(--grn)' : 'var(--red)'}">
            {trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(1)}%
          </span>
          {#if trade.demo}
            <span class="pos-status-badge demo">DEMO</span>
          {:else}
            <button class="pos-close" onclick={() => onClosePos(trade.id)}>CLOSE</button>
          {/if}
        </div>
      {/each}
    {/if}

    {#if displayGmxCount > 0}
      <div class="pos-header">
        <span class="pos-title">⚡ PERPS</span>
        <span class="pos-cnt">{displayGmxCount}</span>
      </div>
      {#each displayGmxPositions as pos (pos.id)}
        <div class="pos-row gmx-row" class:demo={!!pos.demo}>
          <span class="pos-dir" class:long={pos.direction === 'LONG'} class:short={pos.direction === 'SHORT'}>
            {pos.direction === 'LONG' ? '▲' : '▼'}
          </span>
          <div class="pos-info">
            <span class="pos-pair">{pos.asset}</span>
            <span class="pos-entry">
              {pos.direction} · {pos.meta?.leverage ?? ''}x · ${pos.amountUsdc?.toFixed(0) ?? '0'} USDC
            </span>
          </div>
          <div class="gmx-pnl-col">
            <span class="pos-pnl" style="color:{pos.pnlPercent >= 0 ? 'var(--grn)' : 'var(--red)'}">
              {pos.pnlPercent >= 0 ? '+' : ''}{pos.pnlPercent.toFixed(2)}%
            </span>
            {#if pos.pnlUsdc != null}
              <span class="gmx-pnl-usd" style="color:{pos.pnlUsdc >= 0 ? 'var(--grn)' : 'var(--red)'}">
                {pos.pnlUsdc >= 0 ? '+' : ''}{pos.pnlUsdc.toFixed(2)}$
              </span>
            {/if}
          </div>
          <span class="pos-status-badge gmx-status" class:demo={!!pos.demo}>{pos.demo ? 'DEMO' : pos.status}</span>
        </div>
      {/each}
    {/if}
    <button class="gmx-open-btn" onclick={() => showGmxPanel = true}>⚡ OPEN PERP POSITION</button>

    {#if displayPolymarketCount > 0}
      <div class="pos-header">
        <span class="pos-title">🔮 MARKET BETS</span>
        <span class="pos-cnt">{displayPolymarketCount}</span>
      </div>
      {#each displayPolymarketPositions as pos (pos.id)}
        <div class="pos-row poly-row" class:demo={!!pos.demo}>
          <span class="pos-dir" class:long={pos.direction === 'YES'} class:short={pos.direction === 'NO'}>
            {pos.direction === 'YES' ? '↑' : '↓'}
          </span>
          <div class="pos-info">
            <span class="pos-pair pos-market-q">{pos.asset.length > 40 ? pos.asset.slice(0, 40) + '…' : pos.asset}</span>
            <span class="pos-entry">{pos.direction} · ${pos.amountUsdc?.toFixed(0)} USDC</span>
          </div>
          <span class="pos-pnl" style="color:{(pos.pnlUsdc ?? 0) >= 0 ? 'var(--grn)' : 'var(--red)'}">
            {(pos.pnlUsdc ?? 0) >= 0 ? '+' : ''}{(pos.pnlUsdc ?? 0).toFixed(2)}$
          </span>
          <span class="pos-status-badge" class:demo={!!pos.demo}>{pos.demo ? 'DEMO' : pos.status}</span>
        </div>
      {/each}
    {/if}

    {#if !useDemoPositions && displayOpenCount === 0 && displayPolymarketCount === 0 && displayGmxCount === 0}
      <div class="pos-empty-state">
        <span class="pos-empty-icon">📊</span>
        <span class="pos-empty-txt">NO OPEN POSITIONS</span>
        <span class="pos-empty-sub">War Room 시그널을 차트에 적용하거나 바로 포지션을 생성할 수 있습니다.</span>
        <div class="pos-empty-actions">
          <button class="pos-empty-btn primary" onclick={() => showGmxPanel = true}>OPEN PERP</button>
          <button class="pos-empty-btn" onclick={() => { posView = 'markets'; }}>BROWSE MARKETS</button>
        </div>
      </div>
    {/if}

  {:else}
    {#if cryptoMarkets.length > 0}
      {#each cryptoMarkets.slice(0, 6) as market}
        {@const outcome = parseOutcomePrices(market.outcomePrices)}
        <div class="market-browse-card">
          <div class="mb-q">{market.question.length > 60 ? market.question.slice(0, 60) + '…' : market.question}</div>
          <div class="mb-odds">
            <span class="mb-yes">YES {outcome.yes}¢</span>
            <span class="mb-no">NO {outcome.no}¢</span>
          </div>
          <div class="mb-actions">
            <button class="mb-bet" onclick={() => { betMarket = market; }}>BET USDC</button>
            <a class="mb-link" href="https://polymarket.com/event/{market.slug}" target="_blank" rel="noopener noreferrer">↗</a>
          </div>
        </div>
      {/each}
    {:else}
      <div class="pp-empty">Loading markets...</div>
    {/if}
  {/if}
</div>

<PolymarketBetPanel market={betMarket} onClose={() => { betMarket = null; }} />
{#if showGmxPanel}
  <GmxTradePanel onClose={() => { showGmxPanel = false; }} />
{/if}

<style>
  .pos-view-tabs {
    display: flex; gap: 0; flex-shrink: 0;
    border-bottom: 1px solid rgba(255,255,255,.08);
  }
  .pos-view-tab {
    flex: 1; padding: 7px 0; text-align: center;
    font-family: var(--fm); font-size: 9px; font-weight: 700; letter-spacing: 0.8px;
    color: rgba(255,255,255,.4); background: none; border: none; cursor: pointer;
    border-bottom: 2px solid transparent; transition: all .12s;
    display: flex; align-items: center; justify-content: center; gap: 5px;
  }
  .pos-view-tab:hover { color: rgba(255,255,255,.6); background: rgba(255,255,255,.02); }
  .pos-view-tab.active { color: #fff; border-bottom-color: var(--yel, var(--term-accent, #e8967d)); }
  .pos-view-cnt {
    font-size: 9px; font-weight: 800;
    background: rgba(var(--t-accent-rgb),.15); color: var(--yel, var(--term-accent, #e8967d));
    padding: 1px 5px; border-radius: 8px; min-width: 16px;
  }

  .rp-body {
    flex: 1; min-height: 0; overflow-y: auto; padding: 10px;
    display: flex; flex-direction: column; gap: 8px;
    scroll-behavior: smooth; -webkit-overflow-scrolling: touch;
    overscroll-behavior-y: contain; scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,.08) transparent; resize: none;
  }
  .rp-body::-webkit-scrollbar { width: 3px; }
  .rp-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 3px; }
  .rp-body::-webkit-scrollbar-track { background: transparent; }

  .pos-header {
    display: flex; align-items: center; gap: 6px;
    padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,.06);
  }
  .pos-title {
    font-family: var(--fm); font-size: 10px; font-weight: 900;
    letter-spacing: 2px; color: var(--yel);
  }
  .pos-cnt {
    font-family: var(--fm); font-size: 9px; font-weight: 900;
    background: var(--yel); color: #000;
    padding: 1px 6px; border-radius: 8px;
  }
  .pos-row {
    display: flex; align-items: center; gap: 6px; padding: 8px 6px;
    background: rgba(255,255,255,.02); border: 1px solid rgba(255,255,255,.06);
  }
  .pos-row.demo {
    border-color: rgba(var(--t-accent-rgb),.22);
    background: rgba(var(--t-accent-rgb),.06);
  }
  .pos-dir {
    font-family: var(--fm); font-size: 12px; font-weight: 900;
    width: 20px; text-align: center;
  }
  .pos-dir.long { color: var(--grn); }
  .pos-dir.short { color: var(--red); }
  .pos-info { flex: 1; display: flex; flex-direction: column; gap: 1px; }
  .pos-pair { font-family: var(--fd); font-size: 11px; font-weight: 900; color: #fff; letter-spacing: .5px; }
  .pos-entry { font-family: var(--fm); font-size: 10px; color: rgba(255,255,255,.6); }
  .pos-pnl {
    font-family: var(--fd); font-size: 13px; font-weight: 900;
    letter-spacing: .5px; min-width: 50px; text-align: right;
  }
  .pos-close {
    font-family: var(--fm); font-size: 9px; font-weight: 900;
    letter-spacing: 1px; padding: 4px 8px;
    background: rgba(255,45,85,.1); color: var(--red);
    border: 1px solid rgba(255,45,85,.3); border-radius: 3px;
    cursor: pointer; transition: all .12s;
  }
  .pos-close:hover { background: rgba(255,45,85,.25); border-color: var(--red); }

  .pos-empty-state {
    display: flex; flex-direction: column; align-items: flex-start; gap: 6px;
    padding: 12px 10px; border: 1px dashed rgba(var(--t-accent-rgb),.22);
    background: rgba(var(--t-accent-rgb),.05); border-radius: 8px;
    color: rgba(255,255,255,.3);
  }
  .pos-empty-icon { font-size: 14px; opacity: .6; }
  .pos-empty-txt { font-family: var(--fm); font-size: 10px; font-weight: 700; letter-spacing: 1.5px; }
  .pos-empty-sub { font-family: var(--fm); font-size: 9px; color: rgba(255,255,255,.58); line-height: 1.4; }
  .pos-empty-actions { display: flex; gap: 6px; flex-wrap: wrap; }
  .pos-empty-btn {
    font: 700 8px/1 var(--fm); letter-spacing: .8px; padding: 6px 9px;
    border: 1px solid rgba(255,255,255,.2); border-radius: 5px;
    background: rgba(255,255,255,.05); color: rgba(255,255,255,.82); cursor: pointer;
  }
  .pos-empty-btn.primary {
    border-color: rgba(0,230,138,.34); background: rgba(0,230,138,.14); color: #d8ffef;
  }
  .pos-empty-btn:hover { background: rgba(var(--t-accent-rgb),.12); border-color: rgba(var(--t-accent-rgb),.34); }

  .pos-sync-row { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; min-height: 20px; }
  .pos-sync-badge {
    font: 700 8px/1 var(--fm); letter-spacing: .7px; padding: 2px 6px;
    border-radius: 8px; border: 1px solid rgba(255,255,255,.16);
    color: rgba(255,255,255,.65); background: rgba(255,255,255,.04); white-space: nowrap;
  }
  .pos-sync-badge.loading { color: rgba(var(--t-accent-rgb),.88); border-color: rgba(var(--t-accent-rgb),.28); background: rgba(var(--t-accent-rgb),.1); }
  .pos-sync-badge.error { color: rgba(255,95,130,.9); border-color: rgba(255,95,130,.34); background: rgba(255,95,130,.12); }
  .pos-sync-badge.demo { color: rgba(var(--t-accent-rgb),.95); border-color: rgba(var(--t-accent-rgb),.38); background: rgba(var(--t-accent-rgb),.16); }
  .pos-sync-badge.ok { color: rgba(0,230,138,.86); border-color: rgba(0,230,138,.26); background: rgba(0,230,138,.1); }
  .pos-sync-pending, .pos-sync-total { font: 700 8px/1 var(--fm); letter-spacing: .7px; color: rgba(255,255,255,.56); white-space: nowrap; }
  .pos-sync-total { margin-right: auto; }
  .pos-sync-btn {
    font: 700 8px/1 var(--fm); letter-spacing: .8px; padding: 4px 7px;
    color: rgba(var(--t-accent-rgb),.84); background: rgba(var(--t-accent-rgb),.08);
    border: 1px solid rgba(var(--t-accent-rgb),.24); border-radius: 4px;
    cursor: pointer; transition: all .12s;
  }
  .pos-sync-btn:hover:not(:disabled) { background: rgba(var(--t-accent-rgb),.16); border-color: rgba(var(--t-accent-rgb),.38); }
  .pos-sync-btn:disabled { opacity: .55; cursor: not-allowed; }

  .pos-sync-error-msg {
    margin-top: -2px; margin-bottom: 6px; font: 400 9px/1.35 var(--fm);
    color: rgba(255,120,120,.9); border-left: 2px solid rgba(255,120,120,.45);
    background: rgba(255,120,120,.08); padding: 5px 7px;
    display: flex; align-items: center; gap: 10px; word-break: break-word;
  }
  .pos-sync-error-msg.demo { color: rgba(255,210,170,.9); border-left-color: rgba(var(--t-accent-rgb),.42); background: rgba(var(--t-accent-rgb),.12); }
  .pos-sync-error-text { display: flex; flex-direction: column; gap: 2px; }
  .pos-sync-error-title { font: 700 8px/1 var(--fm); letter-spacing: .7px; color: rgba(255,180,180,.95); }
  .pos-sync-error-body { font: 400 9px/1.35 var(--fm); color: rgba(255,150,150,.9); }
  .pos-sync-error-msg.demo .pos-sync-error-body { color: rgba(255,222,194,.92); }
  .pos-sync-error-note { font: 700 8px/1.25 var(--fm); letter-spacing: .5px; color: rgba(255,210,170,.92); }
  .pos-sync-error-actions { margin-left: auto; display: inline-flex; align-items: center; gap: 5px; }
  .pos-sync-inline-btn {
    font: 700 8px/1 var(--fm); letter-spacing: .6px;
    border: 1px solid rgba(255,120,120,.34); border-radius: 3px;
    background: rgba(255,120,120,.14); color: rgba(255,160,160,.95); padding: 2px 6px; cursor: pointer;
  }
  .pos-sync-inline-btn.ghost { border-color: rgba(255,255,255,.24); background: rgba(255,255,255,.08); color: rgba(255,255,255,.84); }
  .pos-sync-inline-btn:hover { background: rgba(255,120,120,.2); }
  .pos-sync-error-msg.demo .pos-sync-inline-btn { border-color: rgba(var(--t-accent-rgb),.42); background: rgba(var(--t-accent-rgb),.18); color: rgba(255,233,208,.95); }
  .pos-sync-error-msg.demo .pos-sync-inline-btn:hover { background: rgba(var(--t-accent-rgb),.28); }

  .poly-row .pos-entry { font-size: 9px; color: rgba(255,255,255,.35); }
  .pos-market-q { font-size: 10px; line-height: 1.2; }
  .pos-status-badge {
    font: 700 8px/1 var(--fm); padding: 2px 5px; border-radius: 3px;
    background: rgba(var(--t-accent-rgb),.1); color: rgba(var(--t-accent-rgb),.7);
    letter-spacing: .5px; text-transform: uppercase; flex-shrink: 0;
  }
  .pos-status-badge.demo { background: rgba(var(--t-accent-rgb),.2); color: rgba(255,227,196,.95); border: 1px solid rgba(var(--t-accent-rgb),.3); }

  .market-browse-card {
    padding: 8px; background: rgba(139,92,246,.05);
    border: 1px solid rgba(139,92,246,.15); border-radius: 6px;
    display: flex; flex-direction: column; gap: 5px;
  }
  .market-browse-card:hover { border-color: rgba(139,92,246,.3); }
  .mb-q { font: 400 10px/1.3 var(--fm); color: rgba(255,255,255,.7); }
  .mb-odds { display: flex; gap: 8px; font: 700 10px/1 var(--fm); }
  .mb-yes { color: #00CC88; }
  .mb-no { color: #FF5E7A; }
  .mb-actions { display: flex; gap: 6px; align-items: center; }
  .mb-bet {
    flex: 1; padding: 5px 8px; border: 1px solid rgba(var(--t-accent-rgb),.3);
    border-radius: 4px; background: rgba(var(--t-accent-rgb),.08);
    color: var(--yel); font: 700 9px/1 var(--fm); cursor: pointer;
    letter-spacing: 1px; transition: all .15s;
  }
  .mb-bet:hover { background: rgba(var(--t-accent-rgb),.15); }
  .mb-link {
    padding: 4px 8px; font: 400 12px/1 var(--fm); color: rgba(255,255,255,.3);
    text-decoration: none; border-radius: 4px;
  }
  .mb-link:hover { color: rgba(255,255,255,.6); background: rgba(255,255,255,.05); }
  .pp-empty { font-family: var(--fm); font-size: 9px; color: rgba(255,255,255,.5); padding: 8px 0; }

  .gmx-row { border-left: 2px solid rgba(255,140,0,.25); }
  .gmx-pnl-col { display: flex; flex-direction: column; align-items: flex-end; flex-shrink: 0; min-width: 50px; }
  .gmx-pnl-usd { font-family: var(--fm); font-size: 9px; font-weight: 700; }
  .gmx-status { background: rgba(255,140,0,.1); color: rgba(255,140,0,.7); }
  .gmx-open-btn {
    width: 100%; padding: 8px 12px; margin-top: 4px;
    font-family: var(--fm); font-size: 10px; font-weight: 900;
    letter-spacing: 1.5px; text-align: center;
    background: rgba(255,140,0,.08); border: 1px solid rgba(255,140,0,.25);
    border-radius: 5px; color: #ff8c00; cursor: pointer; transition: all .15s;
  }
  .gmx-open-btn:hover { background: rgba(255,140,0,.15); border-color: rgba(255,140,0,.4); color: #ffa033; }

  @supports (animation-timeline: view()) {
    .pos-row { animation: intelReveal 1ms both; animation-timeline: view(); animation-range: entry 0% cover 24%; }
  }
  @keyframes intelReveal {
    from { opacity: 0.4; transform: translateY(10px) scale(0.985); filter: saturate(0.88); }
    to { opacity: 1; transform: translateY(0) scale(1); filter: saturate(1); }
  }
</style>
