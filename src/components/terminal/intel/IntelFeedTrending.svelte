<script lang="ts">
  import type { TrendingCoin, GainerLoser, DexHot, OpScore, OpAlert, TrendTab } from '$lib/terminal/intel/intelTypes';
  import { scoreColor, dirIcon, dirColor, fmtTrendPrice, fmtTrendVol, safeExternalUrl } from '$lib/terminal/intel/intelHelpers';

  interface Props {
    trendSubTab?: TrendTab;
    trendTabOptions?: Array<{ key: TrendTab; label: string; icon: string }>;
    trendBasisText?: string;
    trendBasisCompactText?: string;
    trendUpdatedLabel?: string;
    densityMode?: 'essential' | 'pro';
    picksLoading?: boolean;
    topPicks?: OpScore[];
    visibleTopPicks?: OpScore[];
    opAlerts?: OpAlert[];
    macroRegime?: string;
    picksScanTime?: number;
    trendLoading?: boolean;
    visibleTrendingCoins?: TrendingCoin[];
    visibleTrendGainers?: GainerLoser[];
    visibleTrendLosers?: GainerLoser[];
    visibleDexHot?: DexHot[];
    dexChains?: string[];
    dexChainFilter?: string;
    onActivateTrendTab?: (tab: TrendTab) => void;
    onRescan?: () => void;
    onSetDexChainFilter?: (chain: string) => void;
  }

  let {
    trendSubTab = 'picks',
    trendTabOptions = [],
    trendBasisText = '',
    trendBasisCompactText = '',
    trendUpdatedLabel = '',
    densityMode = 'essential',
    picksLoading = false,
    topPicks = [],
    visibleTopPicks = [],
    opAlerts = [],
    macroRegime = '',
    picksScanTime = 0,
    trendLoading = false,
    visibleTrendingCoins = [],
    visibleTrendGainers = [],
    visibleTrendLosers = [],
    visibleDexHot = [],
    dexChains = ['all'],
    dexChainFilter = 'all',
    onActivateTrendTab = () => {},
    onRescan = () => {},
    onSetDexChainFilter = () => {},
  }: Props = $props();
</script>

<div class="trend-panel">
  <div class="trend-sub-tabs">
    {#each trendTabOptions as option (option.key)}
      <button class="trend-sub" class:active={trendSubTab === option.key} onclick={() => onActivateTrendTab(option.key)}>{option.icon} {option.label}</button>
    {/each}
  </div>
  <div class="trend-meta">
    <span class="trend-basis">{densityMode === 'essential' ? trendBasisCompactText : trendBasisText}</span>
    {#if trendUpdatedLabel}
      <span class="trend-updated">updated {trendUpdatedLabel}</span>
    {/if}
  </div>

  {#if trendSubTab === 'picks'}
    <div class="picks-panel">
      {#if picksLoading}
        <div class="trend-loading">⏳ 멀티-에셋 스캔 중... ({topPicks.length > 0 ? '갱신' : '분석'})</div>
      {:else if topPicks.length > 0}
        <div class="picks-macro" class:risk-on={macroRegime === 'risk-on'} class:risk-off={macroRegime === 'risk-off'}>
          매크로: <strong>{macroRegime === 'risk-on' ? '🟢 RISK-ON' : macroRegime === 'risk-off' ? '🔴 RISK-OFF' : '🟡 NEUTRAL'}</strong>
          {#if picksScanTime > 0}<span class="picks-time">({(picksScanTime / 1000).toFixed(1)}s)</span>{/if}
        </div>

        {#if opAlerts.length > 0}
          <div class="picks-alerts">
            {#each opAlerts.slice(0, 3) as alert}
              <div class="pa-row" class:critical={alert.severity === 'critical'} class:warning={alert.severity === 'warning'}>
                <span class="pa-msg">{alert.message}</span>
              </div>
            {/each}
          </div>
        {/if}

        <div class="picks-section-lbl">🎯 TOP OPPORTUNITIES</div>
        {#each visibleTopPicks as pick, i (pick.symbol)}
          <div class="pick-card">
            <div class="pick-head">
              <span class="pick-rank" style="color:{scoreColor(pick.totalScore)}">#{i + 1}</span>
              <span class="pick-sym">{pick.symbol}</span>
              <span class="pick-dir" style="color:{dirColor(pick.direction)}">{dirIcon(pick.direction)} {pick.direction.toUpperCase()}</span>
              <span class="pick-score" style="color:{scoreColor(pick.totalScore)}">{pick.totalScore}/100</span>
            </div>
            <div class="pick-price">
              {fmtTrendPrice(pick.price)}
              <span class="trend-chg" class:up={pick.change24h >= 0} class:dn={pick.change24h < 0}>
                {pick.change24h >= 0 ? '+' : ''}{pick.change24h.toFixed(1)}%
              </span>
            </div>
            <div class="pick-bar">
              <div class="pb-seg mom" style="width:{pick.momentumScore}px" title="Momentum {pick.momentumScore}/25"></div>
              <div class="pb-seg vol" style="width:{pick.volumeScore}px" title="Volume {pick.volumeScore}/20"></div>
              <div class="pb-seg soc" style="width:{pick.socialScore}px" title="Social {pick.socialScore}/20"></div>
              <div class="pb-seg mac" style="width:{pick.macroScore}px" title="Macro {pick.macroScore}/15"></div>
              <div class="pb-seg onc" style="width:{pick.onchainScore}px" title="OnChain {pick.onchainScore}/20"></div>
            </div>
            <div class="pick-reasons">
              {#each pick.reasons as reason}
                <span class="pr-tag">{reason}</span>
              {/each}
            </div>
            {#if pick.alerts.length > 0}
              <div class="pick-alerts">
                {#each pick.alerts.slice(0, 2) as a}<span class="pa-mini">{a}</span>{/each}
              </div>
            {/if}
          </div>
        {/each}

        <button class="picks-rescan" onclick={onRescan}>🔄 다시 스캔</button>
      {:else}
        <div class="trend-empty">🎯 PICKS 탭을 누르면 자동으로 트렌딩 코인을 분석합니다</div>
      {/if}
    </div>

  {:else if trendLoading}
    <div class="trend-loading">Loading trending data...</div>

  {:else if trendSubTab === 'hot'}
    <div class="trend-list">
      {#each visibleTrendingCoins as coin, i (coin.symbol + i)}
        <div class="trend-row">
          <span class="trend-rank">#{coin.rank}</span>
          <div class="trend-coin">
            <span class="trend-sym">{coin.symbol}</span>
            <span class="trend-name">{coin.name}</span>
          </div>
          <div class="trend-data">
            <span class="trend-price">{fmtTrendPrice(coin.price)}</span>
            <span class="trend-chg" class:up={coin.change24h >= 0} class:dn={coin.change24h < 0}>
              {coin.change24h >= 0 ? '+' : ''}{coin.change24h.toFixed(1)}%
            </span>
          </div>
          {#if densityMode === 'pro'}
            <div class="trend-social">
              {#if coin.socialVolume != null && coin.socialVolume > 0}
                <span class="trend-soc" title="Social volume">💬 {coin.socialVolume > 1000 ? (coin.socialVolume / 1000).toFixed(0) + 'K' : coin.socialVolume}</span>
              {/if}
              {#if coin.galaxyScore != null && coin.galaxyScore > 0}
                <span class="trend-galaxy" title="Galaxy Score">⭐ {coin.galaxyScore}</span>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
      {#if visibleTrendingCoins.length === 0}
        <div class="trend-empty">No trending data available</div>
      {/if}
    </div>

  {:else if trendSubTab === 'gainers'}
    <div class="trend-list">
      {#if visibleTrendGainers.length > 0}
        <div class="trend-section-lbl up">▲ TOP GAINERS 24H</div>
        {#each visibleTrendGainers as coin, i (coin.symbol + '-g-' + i)}
          <div class="trend-row gainer">
            <span class="trend-rank">#{i + 1}</span>
            <div class="trend-coin">
              <span class="trend-sym">{coin.symbol}</span>
              <span class="trend-name">{coin.name}</span>
            </div>
            <div class="trend-data">
              <span class="trend-price">{fmtTrendPrice(coin.price)}</span>
              <span class="trend-chg up">+{coin.change24h.toFixed(1)}%</span>
            </div>
            <span class="trend-vol">{fmtTrendVol(coin.volume24h)}</span>
          </div>
        {/each}
      {/if}
      {#if visibleTrendLosers.length > 0}
        <div class="trend-section-lbl dn">▼ TOP LOSERS 24H</div>
        {#each visibleTrendLosers as coin, i (coin.symbol + '-l-' + i)}
          <div class="trend-row loser">
            <span class="trend-rank">#{i + 1}</span>
            <div class="trend-coin">
              <span class="trend-sym">{coin.symbol}</span>
              <span class="trend-name">{coin.name}</span>
            </div>
            <div class="trend-data">
              <span class="trend-price">{fmtTrendPrice(coin.price)}</span>
              <span class="trend-chg dn">{coin.change24h.toFixed(1)}%</span>
            </div>
            <span class="trend-vol">{fmtTrendVol(coin.volume24h)}</span>
          </div>
        {/each}
      {/if}
      {#if visibleTrendGainers.length === 0 && visibleTrendLosers.length === 0}
        <div class="trend-empty">No gainers/losers data</div>
      {/if}
    </div>

  {:else if trendSubTab === 'dex'}
    <div class="trend-list">
      <div class="trend-section-lbl">💎 DEX HOT TOKENS</div>
      <div class="dex-chain-filters">
        {#each dexChains as chainId}
          <button class="dex-chain-btn" class:active={dexChainFilter === chainId} onclick={() => onSetDexChainFilter(chainId)}>
            {chainId.toUpperCase()}
          </button>
        {/each}
      </div>
      {#each visibleDexHot as token, i (token.chainId + token.tokenAddress)}
        {@const safeDexUrl = safeExternalUrl(token.url)}
        {@const safeDexIcon = safeExternalUrl(token.icon)}
        <a
          class="trend-row dex-row"
          class:disabled={!safeDexUrl}
          href={safeDexUrl || undefined}
          target={safeDexUrl ? '_blank' : undefined}
          rel={safeDexUrl ? 'noopener noreferrer' : undefined}
          aria-disabled={!safeDexUrl}
        >
          <span class="trend-rank">#{i + 1}</span>
          {#if safeDexIcon}
            <img class="dex-icon" src={safeDexIcon} alt="" width="18" height="18" loading="lazy" />
          {/if}
          <div class="trend-coin">
            <span class="trend-sym">{token.symbol || token.chainId.toUpperCase()}</span>
            <span class="trend-name">{token.name || `${token.tokenAddress.slice(0, 6)}...${token.tokenAddress.slice(-4)}`}</span>
            <span class="dex-addr">{token.chainId}:{token.tokenAddress.slice(0, 6)}...{token.tokenAddress.slice(-4)}</span>
          </div>
          <div class="dex-metrics">
            {#if token.priceUsd != null}
              <span class="dex-price">{fmtTrendPrice(Number(token.priceUsd))}</span>
            {/if}
            {#if token.change24h != null}
              <span class="trend-chg" class:up={Number(token.change24h) >= 0} class:dn={Number(token.change24h) < 0}>
                {Number(token.change24h) >= 0 ? '+' : ''}{Number(token.change24h).toFixed(1)}%
              </span>
            {/if}
            {#if token.volume24h != null}
              <span class="dex-vol">Vol {fmtTrendVol(Number(token.volume24h))}</span>
            {/if}
          </div>
          {#if token.description}
            <span class="dex-desc">{token.description.slice(0, 40)}{token.description.length > 40 ? '...' : ''}</span>
          {/if}
          <span class="dex-source">{token.source === 'boost' ? 'BOOST' : 'PROFILE'}</span>
          <span class="dex-link">{safeDexUrl ? '↗' : '—'}</span>
        </a>
      {/each}
      {#if visibleDexHot.length === 0}
        <div class="trend-empty">No DEX trending data</div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .trend-panel { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
  .trend-sub-tabs {
    display: flex; gap: 4px; padding: 6px 8px;
    border-bottom: 1px solid rgba(255,255,255,.06);
  }
  .trend-sub {
    flex: 1; background: transparent; border: 1px solid rgba(255,255,255,.08); border-radius: 6px;
    color: rgba(255,255,255,.55); font-size: 9px; font-family: var(--fm); font-weight: 700;
    letter-spacing: .5px; padding: 5px 0; cursor: pointer; transition: all .15s;
  }
  .trend-sub:hover { background: rgba(255,255,255,.04); color: rgba(255,255,255,.8); }
  .trend-sub.active { background: rgba(var(--t-accent-rgb),.08); color: var(--yel); border-color: rgba(var(--t-accent-rgb),.25); }

  .trend-meta {
    display: flex; align-items: center; gap: 8px;
    padding: 4px 6px 5px; border-bottom: 1px solid rgba(255,255,255,.05);
    background: rgba(255,255,255,.02); position: sticky; top: 0; z-index: 2;
  }
  .trend-basis {
    font-family: var(--fm); font-size: 9px; color: rgba(255,255,255,.55);
    letter-spacing: .25px; line-height: 1.35; flex: 1; min-width: 0;
  }
  .trend-updated {
    font-family: var(--fm); font-size: 9px; color: rgba(255,255,255,.42); white-space: nowrap;
  }

  .trend-list {
    flex: 1; overflow-y: auto; padding: 6px 8px;
    scroll-behavior: smooth; -webkit-overflow-scrolling: touch;
    overscroll-behavior-y: contain; resize: none;
  }
  .trend-loading, .trend-empty {
    padding: 20px; text-align: center; color: rgba(255,255,255,.35);
    font-size: 10px; font-family: var(--fm);
  }

  .trend-row {
    display: flex; align-items: center; gap: 8px; padding: 8px 6px;
    border-bottom: 1px solid rgba(255,255,255,.03); transition: background .1s;
  }
  .trend-row:hover { background: rgba(255,255,255,.03); }
  .trend-rank {
    width: 22px; flex-shrink: 0; font-family: var(--fm); font-size: 9px;
    font-weight: 700; color: rgba(255,255,255,.3); text-align: right;
  }
  .trend-coin { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .trend-sym { font-family: var(--fm); font-size: 10px; font-weight: 800; color: #fff; letter-spacing: .3px; }
  .trend-name { font-size: 9px; color: rgba(255,255,255,.48); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .trend-data { display: flex; flex-direction: column; align-items: flex-end; flex-shrink: 0; }
  .trend-price { font-family: var(--fm); font-size: 10px; color: rgba(255,255,255,.8); }
  .trend-chg { font-family: var(--fm); font-size: 9px; font-weight: 700; }
  .trend-chg.up { color: #00e676; }
  .trend-chg.dn { color: #ff1744; }
  .trend-vol { font-family: var(--fm); font-size: 9px; color: rgba(255,255,255,.3); flex-shrink: 0; width: 48px; text-align: right; }
  .trend-social { display: flex; flex-direction: column; align-items: flex-end; flex-shrink: 0; gap: 1px; }
  .trend-soc, .trend-galaxy { font-size: 9px; color: rgba(255,255,255,.4); white-space: nowrap; }
  .trend-section-lbl {
    font-family: var(--fm); font-size: 9px; font-weight: 800; letter-spacing: 1px;
    padding: 6px 2px 3px; color: rgba(255,255,255,.45);
  }
  .trend-section-lbl.up { color: #00e676; }
  .trend-section-lbl.dn { color: #ff1744; }
  .trend-row.gainer { border-left: 2px solid rgba(0,230,118,.2); }
  .trend-row.loser { border-left: 2px solid rgba(255,23,68,.2); }

  /* DEX */
  .dex-row { text-decoration: none; color: inherit; }
  .dex-row:hover { background: rgba(var(--t-accent-rgb),.04); }
  .dex-row.disabled { cursor: default; opacity: 0.72; }
  .dex-row.disabled:hover { background: transparent; }
  .dex-icon { border-radius: 50%; flex-shrink: 0; }
  .dex-chain-filters { display: flex; gap: 4px; margin: 2px 0 6px; overflow-x: auto; padding-bottom: 2px; }
  .dex-chain-btn {
    border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.03);
    color: rgba(255,255,255,.5); font: 700 8px/1 var(--fm); letter-spacing: .6px;
    padding: 4px 7px; border-radius: 999px; cursor: pointer; white-space: nowrap;
  }
  .dex-chain-btn.active { color: var(--yel); border-color: rgba(var(--t-accent-rgb),.3); background: rgba(var(--t-accent-rgb),.1); }
  .dex-addr { font-family: var(--fm); font-size: 9px; color: rgba(255,255,255,.32); line-height: 1.2; }
  .dex-metrics { display: flex; flex-direction: column; align-items: flex-end; flex-shrink: 0; gap: 1px; min-width: 58px; }
  .dex-price { font: 700 9px/1 var(--fm); color: rgba(255,255,255,.85); }
  .dex-vol { font: 400 8px/1 var(--fm); color: rgba(255,255,255,.42); }
  .dex-source {
    font: 700 7px/1 var(--fm); letter-spacing: .5px; color: rgba(var(--t-accent-rgb),.55);
    border: 1px solid rgba(var(--t-accent-rgb),.2); border-radius: 999px;
    padding: 2px 5px; flex-shrink: 0;
  }
  .dex-desc { font-size: 9px; color: rgba(255,255,255,.3); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .dex-link { color: rgba(var(--t-accent-rgb),.5); font-size: 10px; flex-shrink: 0; }

  /* Picks */
  .picks-panel {
    flex: 1; overflow-y: auto; padding: 6px; display: flex; flex-direction: column; gap: 6px;
    scroll-behavior: smooth; -webkit-overflow-scrolling: touch;
    overscroll-behavior-y: contain; resize: none;
  }
  .picks-panel::-webkit-scrollbar { width: 2px; }
  .picks-panel::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }

  .picks-macro {
    display: flex; align-items: center; gap: 6px; padding: 5px 8px; border-radius: 4px;
    font-family: var(--fm); font-size: 9px; font-weight: 700; letter-spacing: .5px;
    color: rgba(255,255,255,.7); background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08);
  }
  .picks-macro.risk-on { background: rgba(0,230,118,.08); border-color: rgba(0,230,118,.2); color: #00e676; }
  .picks-macro.risk-off { background: rgba(255,23,68,.08); border-color: rgba(255,23,68,.2); color: #ff1744; }
  .picks-time { font-size: 9px; opacity: .5; margin-left: 4px; font-weight: 400; }

  .picks-alerts { display: flex; flex-direction: column; gap: 3px; }
  .pa-row {
    display: flex; align-items: center; gap: 4px; padding: 3px 6px; border-radius: 3px;
    font-family: var(--fm); font-size: 9px; font-weight: 600;
    background: rgba(255,140,59,.06); border-left: 2px solid rgba(255,140,59,.4); color: rgba(255,140,59,.85);
  }
  .pa-row.critical { background: rgba(255,23,68,.08); border-left-color: #ff1744; color: #ff5252; }
  .pa-row.warning { background: rgba(255,193,7,.06); border-left-color: rgba(255,193,7,.5); color: rgba(255,193,7,.85); }
  .pa-msg { line-height: 1.35; }

  .picks-section-lbl {
    font-family: var(--fm); font-size: 9px; font-weight: 800; letter-spacing: 1.2px;
    color: rgba(var(--t-accent-rgb),.65); padding: 2px 0;
  }

  .pick-card {
    padding: 7px 8px; border-radius: 5px;
    background: rgba(255,255,255,.025); border: 1px solid rgba(255,255,255,.06);
    transition: background .12s, border-color .12s;
  }
  .pick-card:hover { background: rgba(var(--t-accent-rgb),.04); border-color: rgba(var(--t-accent-rgb),.15); }
  .pick-head { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; }
  .pick-rank { font-family: var(--fd); font-size: 12px; font-weight: 900; min-width: 22px; }
  .pick-sym { font-family: var(--fm); font-size: 11px; font-weight: 900; color: #fff; letter-spacing: .5px; }
  .pick-dir { font-family: var(--fm); font-size: 9px; font-weight: 800; letter-spacing: .5px; margin-left: auto; }
  .pick-score { font-family: var(--fd); font-size: 12px; font-weight: 900; letter-spacing: .3px; }
  .pick-price {
    font-family: var(--fm); font-size: 9px; color: rgba(255,255,255,.55);
    display: flex; align-items: center; gap: 6px; margin-bottom: 4px;
  }
  .pick-bar {
    display: flex; gap: 1px; height: 6px; border-radius: 3px; overflow: hidden;
    background: rgba(255,255,255,.04); margin-bottom: 4px;
  }
  .pb-seg { height: 100%; min-width: 1px; border-radius: 1px; }
  .pb-seg.mom { background: #ff9800; }
  .pb-seg.vol { background: #2196f3; }
  .pb-seg.soc { background: #e040fb; }
  .pb-seg.mac { background: #00e676; }
  .pb-seg.onc { background: #ffd600; }
  .pick-reasons { display: flex; flex-wrap: wrap; gap: 3px; margin-bottom: 2px; }
  .pr-tag {
    font-family: var(--fm); font-size: 9px; font-weight: 600; letter-spacing: .3px;
    padding: 1px 5px; border-radius: 3px;
    background: rgba(255,255,255,.05); color: rgba(255,255,255,.55); border: 1px solid rgba(255,255,255,.06);
  }
  .pick-alerts { display: flex; flex-wrap: wrap; gap: 3px; }
  .pa-mini {
    font-family: var(--fm); font-size: 9px; font-weight: 700;
    padding: 1px 4px; border-radius: 2px;
    background: rgba(255,140,59,.08); color: rgba(255,140,59,.75); border: 1px solid rgba(255,140,59,.15);
  }
  .picks-rescan {
    width: 100%; padding: 6px; margin-top: 2px;
    font-family: var(--fm); font-size: 9px; font-weight: 700; letter-spacing: .8px;
    background: rgba(var(--t-accent-rgb),.06); border: 1px solid rgba(var(--t-accent-rgb),.15);
    border-radius: 4px; color: rgba(var(--t-accent-rgb),.7); cursor: pointer; transition: all .15s;
  }
  .picks-rescan:hover { background: rgba(var(--t-accent-rgb),.12); color: var(--yel); border-color: rgba(var(--t-accent-rgb),.3); }

  @supports (animation-timeline: view()) {
    .pick-card { animation: intelReveal 1ms both; animation-timeline: view(); animation-range: entry 0% cover 24%; }
  }
  @keyframes intelReveal {
    from { opacity: 0.4; transform: translateY(10px) scale(0.985); filter: saturate(0.88); }
    to { opacity: 1; transform: translateY(0) scale(1); filter: saturate(1); }
  }
</style>
