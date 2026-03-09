<script lang="ts">
  import { calcPnL, type HoldingAsset } from '$lib/data/holdings';
  import { pnlColor, pnlPrefix } from './passportHelpers';

  interface Props {
    virtualBalance: number;
    walletConnected: boolean;
    walletChain: string | null;
    walletBalance: number;
    holdingsState: string;
    holdingsStatusMessage: string;
    effectiveHoldings: HoldingAsset[];
    total: number;
    totalPnlPct: number;
    onOpenWalletModal: () => void;
  }

  const HOLDINGS_PREVIEW_LIMIT = 6;

  let {
    virtualBalance,
    walletConnected,
    walletChain,
    walletBalance,
    holdingsState,
    holdingsStatusMessage,
    effectiveHoldings,
    total,
    totalPnlPct,
    onOpenWalletModal,
  }: Props = $props();

  const holdingsPreview = $derived(effectiveHoldings.slice(0, HOLDINGS_PREVIEW_LIMIT));
  const holdingsOverflow = $derived(effectiveHoldings.slice(HOLDINGS_PREVIEW_LIMIT));
</script>

<div class="wallet-tab">
  <section class="content-panel">
    <div class="vb-card">
      <div class="vb-header"><span class="vb-icon">🏦</span><span class="vb-title">VIRTUAL BALANCE</span></div>
      <div class="vb-amount">${virtualBalance.toLocaleString()}</div>
      {#if !walletConnected}
        <button class="vb-connect" onclick={onOpenWalletModal}>CONNECT WALLET FOR DEFI</button>
      {:else}
        <div class="vb-connected"><span class="vbc-dot"></span>Wallet Connected · {walletChain} · {walletBalance.toLocaleString()} USDT</div>
      {/if}
    </div>
  </section>

  <section class="content-panel">
    <div class="holdings-status" class:live={holdingsState === 'live'}>
      <span class="hs-dot"></span>
      <span>{holdingsStatusMessage}</span>
    </div>

    <div class="wallet-kpis">
      <div class="wk-item"><span class="wk-k">ASSETS</span><span class="wk-v">{effectiveHoldings.length}</span></div>
      <div class="wk-item"><span class="wk-k">TOTAL VALUE</span><span class="wk-v">${total.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span></div>
      <div class="wk-item"><span class="wk-k">HOLDINGS PnL</span><span class="wk-v" style="color:{pnlColor(totalPnlPct)}">{pnlPrefix(totalPnlPct)}{totalPnlPct.toFixed(2)}%</span></div>
    </div>

    <details class="detail-block">
      <summary>HOLDINGS BREAKDOWN</summary>
      <div class="holdings-body">
        <div class="donut-section">
          <div class="st">ALLOCATION</div>
          <div class="donut-wrap">
            <svg viewBox="0 0 200 200">
              {#each effectiveHoldings as asset, i}
                {@const offset = effectiveHoldings.slice(0, i).reduce((s, a) => s + a.allocation * 100, 0)}
                {@const pct = asset.allocation * 100}
                <circle
                  cx="100"
                  cy="100"
                  r="70"
                  fill="none"
                  stroke={asset.color}
                  stroke-width="30"
                  stroke-dasharray="{pct * 4.4} {(100 - pct) * 4.4}"
                  stroke-dashoffset="{-offset * 4.4}"
                  transform="rotate(-90 100 100)"
                />
              {/each}
              <circle cx="100" cy="100" r="55" fill="#0a0a1a" />
              <text x="100" y="95" text-anchor="middle" fill="#fff" font-size="16" font-weight="900" font-family="var(--fd)">{effectiveHoldings.length}</text>
              <text x="100" y="112" text-anchor="middle" fill="#888" font-size="9" font-family="var(--fm)">ASSETS</text>
            </svg>
          </div>
          <div class="legend">
            {#each holdingsPreview as asset}
              <div class="legend-item"><span class="li-dot" style="background:{asset.color}"></span><span class="li-name">{asset.symbol}</span><span class="li-pct">{(asset.allocation * 100).toFixed(0)}%</span></div>
            {/each}
            {#if holdingsOverflow.length > 0}
              <details class="detail-block nested-detail compact-detail">
                <summary>MORE ASSETS ({holdingsOverflow.length})</summary>
                <div class="legend overflow-legend">
                  {#each holdingsOverflow as asset}
                    <div class="legend-item"><span class="li-dot" style="background:{asset.color}"></span><span class="li-name">{asset.symbol}</span><span class="li-pct">{(asset.allocation * 100).toFixed(0)}%</span></div>
                  {/each}
                </div>
              </details>
            {/if}
          </div>
        </div>

        <div class="table-section">
          <div class="st">HOLDINGS</div>
          <div class="htable">
            <div class="hrow header-row"><span class="hc asset-col">ASSET</span><span class="hc">AMOUNT</span><span class="hc">VALUE</span><span class="hc">PnL</span></div>
            {#each holdingsPreview as asset}
              {@const assetPnl = calcPnL(asset)}
              {@const value = asset.amount * asset.currentPrice}
              <div class="hrow">
                <div class="hc asset-col"><span class="ai" style="background:{asset.color}">{asset.icon}</span><div><div class="an">{asset.symbol}</div><div class="af">{asset.name}</div></div></div>
                <span class="hc num">{asset.amount.toLocaleString()}</span>
                <span class="hc num">${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                <span class="hc num" style="color:{pnlColor(assetPnl.amount)}">{pnlPrefix(assetPnl.percent)}{assetPnl.percent.toFixed(1)}%</span>
              </div>
            {/each}
          </div>
          {#if holdingsOverflow.length > 0}
            <details class="detail-block nested-detail compact-detail">
              <summary>MORE HOLDINGS ({holdingsOverflow.length})</summary>
              <div class="htable">
                {#each holdingsOverflow as asset}
                  {@const assetPnl = calcPnL(asset)}
                  {@const value = asset.amount * asset.currentPrice}
                  <div class="hrow">
                    <div class="hc asset-col"><span class="ai" style="background:{asset.color}">{asset.icon}</span><div><div class="an">{asset.symbol}</div><div class="af">{asset.name}</div></div></div>
                    <span class="hc num">{asset.amount.toLocaleString()}</span>
                    <span class="hc num">${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                    <span class="hc num" style="color:{pnlColor(assetPnl.amount)}">{pnlPrefix(assetPnl.percent)}{assetPnl.percent.toFixed(1)}%</span>
                  </div>
                {/each}
              </div>
            </details>
          {/if}
        </div>
      </div>
    </details>
  </section>
</div>

<style>
  @import './passportTabShared.css';

  .wallet-tab {
    display: flex;
    flex-direction: column;
    gap: var(--sp-space-2);
  }

  .vb-card {
    border: 1px solid var(--sp-line);
    border-radius: 10px;
    background: rgba(255, 140, 121, 0.08);
    padding: var(--sp-space-4);
  }

  .vb-header {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .vb-icon {
    font-size: 13px;
  }

  .vb-title {
    color: var(--sp-dim);
    font-family: var(--fp);
    font-size: 9px;
    letter-spacing: 0.2px;
  }

  .vb-amount {
    margin-top: 5px;
    color: var(--sp-pk-l);
    font-family: var(--sp-font-display);
    font-size: clamp(20px, 2.5vw, 26px);
    line-height: 1.1;
  }

  .vb-connect {
    margin-top: var(--sp-space-3);
    border: 1px solid var(--sp-pk);
    background: rgba(255, 140, 121, 0.16);
    color: var(--sp-pk-l);
    border-radius: 8px;
    padding: var(--sp-space-2) var(--sp-space-3);
    font-family: var(--fp);
    font-size: 9px;
    letter-spacing: 0.2px;
    cursor: pointer;
  }

  .vb-connected {
    margin-top: var(--sp-space-2);
    color: var(--sp-w);
    font-family: var(--fm);
    font-size: 11px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .vbc-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--sp-green);
    box-shadow: 0 0 5px rgba(157, 205, 185, 0.7);
  }

  .holdings-status {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 6px 12px;
    margin-bottom: var(--sp-space-2);
    border: 1px solid var(--sp-soft);
    border-radius: 999px;
    color: var(--sp-dim);
    font-family: var(--fm);
    font-size: 10px;
  }

  .holdings-status.live {
    border-color: rgba(157, 205, 185, 0.32);
    color: var(--sp-green);
  }

  .hs-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--sp-pk);
  }

  .holdings-status.live .hs-dot {
    background: var(--sp-green);
  }

  .wallet-kpis {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--sp-space-2);
  }

  .wk-item {
    border: 1px solid var(--sp-soft);
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.02);
    padding: var(--sp-space-3) var(--sp-space-2);
    text-align: center;
  }

  .wk-v {
    color: var(--sp-w);
    font-family: var(--fd);
    font-size: 18px;
    font-weight: 800;
    line-height: 1.1;
  }

  .wk-k {
    margin-top: 4px;
    color: var(--sp-dim);
    font-family: var(--fp);
    font-size: 9px;
    letter-spacing: 0.08px;
  }

  .holdings-body {
    display: grid;
    grid-template-columns: minmax(230px, 280px) minmax(0, 1fr);
  }

  .st {
    padding: var(--sp-space-2) var(--sp-space-3);
    border-bottom: 1px solid var(--sp-soft);
    color: var(--sp-dim);
    font-family: var(--fp);
    font-size: 9px;
    letter-spacing: 0.2px;
  }

  .donut-section {
    border-right: 1px solid var(--sp-soft);
  }

  .donut-wrap {
    padding: var(--sp-space-2) var(--sp-space-3);
  }

  .donut-wrap svg {
    width: 100%;
    max-width: 170px;
    display: block;
    margin: 0 auto;
  }

  .legend {
    padding: 0 var(--sp-space-2) var(--sp-space-2);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .overflow-legend {
    padding-top: 8px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--sp-w);
    font-family: var(--fm);
    font-size: 10px;
  }

  .li-dot {
    width: 8px;
    height: 8px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .li-name {
    font-weight: 700;
  }

  .li-pct {
    margin-left: auto;
    color: var(--sp-dim);
  }

  .table-section {
    overflow-x: auto;
  }

  .htable {
    min-width: 450px;
    padding: 0 var(--sp-space-2) var(--sp-space-2);
  }

  .hrow {
    display: grid;
    grid-template-columns: 1.8fr 1fr 1fr 1fr;
    gap: var(--sp-space-2);
    align-items: center;
    padding: var(--sp-space-2) var(--sp-space-2);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .hrow:not(.header-row):hover {
    background: rgba(255, 255, 255, 0.03);
  }

  .header-row {
    color: var(--sp-dim);
    font-family: var(--fp);
    font-size: 9px;
    letter-spacing: 0.08px;
  }

  .hc {
    color: var(--sp-w);
    font-family: var(--fm);
    font-size: 12px;
  }

  .hc.num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .asset-col {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .ai {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-family: var(--fp);
    font-size: 10px;
    flex-shrink: 0;
  }

  .an {
    color: var(--sp-w);
    font-family: var(--fm);
    font-size: 11px;
    font-weight: 700;
  }

  .af {
    color: var(--sp-dim);
    font-family: var(--fm);
    font-size: 9px;
  }

  @media (max-width: 1024px) {
    .wallet-kpis {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 768px) {
    .holdings-body {
      grid-template-columns: 1fr;
    }

    .donut-section {
      border-right: none;
      border-bottom: 1px solid var(--sp-soft);
    }

    .htable {
      min-width: 360px;
    }

    .hc {
      font-size: 11px;
    }

    .wk-v {
      font-size: 15px;
    }
  }

  @media (max-width: 480px) {
    .wallet-kpis {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--sp-space-1);
    }

    .wk-item {
      padding: var(--sp-space-2) var(--sp-space-1);
    }

    .wk-v {
      font-size: 14px;
    }

    .wk-k {
      font-size: var(--sc-fs-2xs, 9px);
    }

    .htable {
      min-width: 320px;
      font-size: 10px;
    }

    .hrow {
      grid-template-columns: 1.5fr 0.8fr 0.8fr 0.8fr;
      gap: 3px;
      padding: var(--sp-space-1) var(--sp-space-1);
    }

    .hc {
      font-size: 10px;
    }

    .ai {
      width: 20px;
      height: 20px;
      font-size: 9px;
    }

    .an {
      font-size: 10px;
    }

    .af {
      font-size: 9px;
    }

    .donut-wrap svg {
      max-width: 140px;
    }

    .vb-amount {
      font-size: clamp(16px, 5vw, 22px);
    }
  }
</style>
