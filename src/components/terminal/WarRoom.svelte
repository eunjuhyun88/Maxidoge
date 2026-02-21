<script lang="ts">
  import { AGENT_SIGNALS, getSignalsByToken, type AgentSignal } from '$lib/data/warroom';
  import { gameState, setView } from '$lib/stores/gameState';
  import { openQuickTrade } from '$lib/stores/quickTradeStore';
  import { trackSignal as trackSignalStore, activeSignalCount } from '$lib/stores/trackedSignalStore';
  import { incrementTrackedSignals } from '$lib/stores/userProfileStore';
  import { notifySignalTracked } from '$lib/stores/notificationStore';
  import { copyTradeStore } from '$lib/stores/copyTradeStore';
  import {
    fetchCurrentOI, fetchCurrentFunding, fetchPredictedFunding,
    fetchLiquidationHistory, fetchLSRatioHistory,
    formatOI, formatFunding, tfToCoinalyzeInterval
  } from '$lib/api/coinalyze';
  import { goto } from '$app/navigation';
  import { onMount, onDestroy } from 'svelte';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  // ── Token filter (pre-computed counts) ──
  type TokenFilter = 'ALL' | 'BTC' | 'ETH' | 'SOL';
  const TOKEN_TABS: TokenFilter[] = ['ALL', 'BTC', 'ETH', 'SOL'];
  const TOKEN_COUNTS: Record<TokenFilter, number> = {
    ALL: AGENT_SIGNALS.length,
    BTC: AGENT_SIGNALS.filter(s => s.token === 'BTC').length,
    ETH: AGENT_SIGNALS.filter(s => s.token === 'ETH').length,
    SOL: AGENT_SIGNALS.filter(s => s.token === 'SOL').length,
  };
  let activeToken: TokenFilter = 'ALL';
  $: filteredSignals = getSignalsByToken(activeToken);

  // ── Selection state ──
  let selectedIds: Set<string> = new Set();
  $: selectedCount = selectedIds.size;

  function toggleSelect(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedIds = next;
  }

  function selectAll() {
    if (selectedCount === filteredSignals.length) {
      selectedIds = new Set();
    } else {
      selectedIds = new Set(filteredSignals.map(s => s.id));
    }
  }

  function openCopyTrade() {
    if (selectedCount === 0) return;
    copyTradeStore.openModal([...selectedIds]);
  }

  // ── Derivatives Data (real-time from Coinalyze) ──
  let derivOI: number | null = null;
  let derivFunding: number | null = null;
  let derivPredFunding: number | null = null;
  let derivLSRatio: number | null = null;
  let derivLiqLong: number = 0;
  let derivLiqShort: number = 0;
  let derivLoading = false;
  let derivLastPair = '';
  let derivRefreshTimer: ReturnType<typeof setInterval> | null = null;

  $: currentPair = $gameState.pair;
  $: currentTF = $gameState.timeframe;

  async function fetchDerivativesData() {
    const pair = currentPair;
    if (!pair) return;
    derivLoading = true;

    try {
      const [oi, funding, predFunding, lsRatio, liqs] = await Promise.allSettled([
        fetchCurrentOI(pair),
        fetchCurrentFunding(pair),
        fetchPredictedFunding(pair),
        fetchLSRatioHistory(pair, currentTF, 2),
        fetchLiquidationHistory(pair, currentTF, 24),
      ]);

      if (oi.status === 'fulfilled' && oi.value) derivOI = oi.value.value;
      if (funding.status === 'fulfilled' && funding.value) derivFunding = funding.value.value;
      if (predFunding.status === 'fulfilled' && predFunding.value) derivPredFunding = predFunding.value.value;
      if (lsRatio.status === 'fulfilled' && lsRatio.value.length > 0) {
        derivLSRatio = lsRatio.value[lsRatio.value.length - 1].value;
      }
      if (liqs.status === 'fulfilled' && liqs.value.length > 0) {
        derivLiqLong = liqs.value.reduce((s, d) => s + d.long, 0);
        derivLiqShort = liqs.value.reduce((s, d) => s + d.short, 0);
      }
      derivLastPair = pair;
    } catch (err) {
      console.error('[WarRoom] Derivatives fetch error:', err);
    }
    derivLoading = false;
  }

  // Refetch when pair changes
  $: if (currentPair && currentPair !== derivLastPair) {
    fetchDerivativesData();
  }

  // ── Volatility alert ──
  let volatilityAlert = false;
  let volatilityInterval: ReturnType<typeof setInterval> | null = null;

  $: trackedCount = $activeSignalCount;


  function handleTrack(sig: AgentSignal) {
    trackSignalStore(sig.pair, sig.vote === 'long' ? 'LONG' : sig.vote === 'short' ? 'SHORT' : 'LONG', sig.entry, sig.name, sig.conf);
    incrementTrackedSignals();
    notifySignalTracked(sig.pair, sig.vote.toUpperCase());
    dispatch('tracked', { dir: sig.vote, pair: sig.pair });
  }

  function goArena() {
    setView('arena');
    goto('/arena');
  }

  function quickTrade(dir: 'LONG' | 'SHORT', sig: AgentSignal) {
    openQuickTrade(sig.pair, dir, sig.entry, sig.tp, sig.sl, sig.name);
    dispatch('quicktrade', { dir, pair: sig.pair, price: sig.entry });
  }

  function fmtPrice(p: number): string {
    if (p >= 1000) return '$' + p.toLocaleString();
    return '$' + p;
  }

  onMount(() => {
    volatilityInterval = setInterval(() => {
      if (Math.random() < 0.2) {
        volatilityAlert = true;
        setTimeout(() => { volatilityAlert = false; }, 8000);
      }
    }, 30000);

    // Initial derivatives fetch
    fetchDerivativesData();
    // Auto-refresh every 30s
    derivRefreshTimer = setInterval(fetchDerivativesData, 30000);
  });

  onDestroy(() => {
    if (volatilityInterval) clearInterval(volatilityInterval);
    if (derivRefreshTimer) clearInterval(derivRefreshTimer);
  });
</script>

<div class="war-room">
  <!-- Volatility Alert Banner -->
  {#if volatilityAlert}
    <div class="vol-alert">
      <div class="vol-pulse"></div>
      <span class="vol-text">⚡ VOLATILITY SPIKE DETECTED</span>
      <button class="vol-arena-btn" on:click={goArena}>🐕 OPEN ARENA</button>
    </div>
  {/if}

  <!-- Header -->
  <div class="wr-header">
    <span class="wr-title">WAR ROOM</span>
    <div class="wr-header-right">
      <button class="signal-link" on:click={() => goto('/signals')}>📡 SIGNALS</button>
      <button class="arena-trigger" on:click={goArena}>🐕 ARENA</button>
      <span class="wr-auto-badge">⚡AUTO</span>
      <span class="wr-live"><span class="wr-live-dot"></span> LIVE</span>
      <button class="wr-collapse-btn" on:click={() => dispatch('collapse')} title="Collapse">
        <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="1" y="2" width="14" height="12" rx="1.5"/>
          <line x1="6" y1="2" x2="6" y2="14"/>
        </svg>
      </button>
    </div>
  </div>

  <!-- Token Filter Tabs -->
  <div class="token-tabs">
    {#each TOKEN_TABS as tok (tok)}
      <button
        class="token-tab"
        class:active={activeToken === tok}
        class:btc={tok === 'BTC'}
        class:eth={tok === 'ETH'}
        class:sol={tok === 'SOL'}
        on:click={() => { activeToken = tok; selectedIds = new Set(); }}
      >
        {tok}
        <span class="token-tab-count">{TOKEN_COUNTS[tok]}</span>
      </button>
    {/each}
  </div>

  <!-- ═══ Derivatives Data Strip ═══ -->
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

  <!-- Select All bar -->
  <div class="select-bar">
    <button class="select-all-btn" on:click={selectAll}>
      <span class="sa-check" class:checked={selectedCount === filteredSignals.length && filteredSignals.length > 0}>
        {selectedCount === filteredSignals.length && filteredSignals.length > 0 ? '☑' : '☐'}
      </span>
      SELECT ALL
    </button>
    {#if selectedCount > 0}
      <span class="select-count">{selectedCount} selected</span>
    {/if}
  </div>

  <!-- Signal Feed (selectable cards) -->
  <div class="wr-msgs">
    {#each filteredSignals as sig (sig.id)}
      {@const isSelected = selectedIds.has(sig.id)}
      <div
        class="wr-msg"
        class:selected={isSelected}
        on:click={() => toggleSelect(sig.id)}
        role="button"
        tabindex="0"
        on:keydown={(e) => e.key === 'Enter' && toggleSelect(sig.id)}
      >
        <div class="wr-msg-strip" style="background:{sig.color}"></div>
        <div class="wr-msg-checkbox">
          <span class="msg-check" class:checked={isSelected}>
            {isSelected ? '☑' : '☐'}
          </span>
        </div>
        <div class="wr-msg-body">
          <div class="wr-msg-head">
            <span class="wr-msg-icon">{sig.icon}</span>
            <span class="wr-msg-name" style="color:{sig.color}">{sig.name}</span>
            <span class="wr-msg-token">{sig.token}</span>
            <span class="wr-msg-vote {sig.vote}">{sig.vote.toUpperCase()}</span>
            <span class="wr-msg-conf">{sig.conf}%</span>
            <span class="wr-msg-time">{sig.time}</span>
          </div>
          <div class="wr-msg-text">{sig.text}</div>
          <div class="wr-msg-signal-row">
            <span class="wr-msg-entry">{fmtPrice(sig.entry)}</span>
            <span class="wr-msg-arrow-price">→</span>
            <span class="wr-msg-tp">TP {fmtPrice(sig.tp)}</span>
            <span class="wr-msg-sl">SL {fmtPrice(sig.sl)}</span>
          </div>
          <div class="wr-msg-actions">
            <span class="wr-msg-src">{sig.src}</span>
            <button class="wr-act-btn long" on:click|stopPropagation={() => quickTrade('LONG', sig)}>▲ LONG</button>
            <button class="wr-act-btn short" on:click|stopPropagation={() => quickTrade('SHORT', sig)}>▼ SHORT</button>
            <button class="wr-act-btn track" on:click|stopPropagation={() => handleTrack(sig)}>📌</button>
          </div>
        </div>
      </div>
    {/each}
  </div>

  <!-- CREATE COPY TRADE CTA -->
  {#if selectedCount > 0}
    <button class="copy-trade-cta" on:click={openCopyTrade}>
      <span class="ctc-icon">⚡</span>
      <span class="ctc-text">CREATE COPY TRADE</span>
      <span class="ctc-count">{selectedCount} selected</span>
      <span class="ctc-arrow">→</span>
    </button>
  {/if}

  <!-- Signal Room Link -->
  <button class="signal-room-cta" on:click={() => goto('/signals')}>
    <span class="src-icon">📡</span>
    <span class="src-text">SIGNAL ROOM</span>
    <span class="src-count">{AGENT_SIGNALS.length} SIGNALS</span>
    {#if trackedCount > 0}
      <span class="src-tracked">📌 {trackedCount}</span>
    {/if}
    <span class="src-arrow">→</span>
  </button>

  <!-- Stats Footer -->
  <div class="wr-stats">
    <div class="stat-cell"><div class="stat-lbl">SIG</div><div class="stat-val" style="color:var(--yel)">847</div></div>
    <div class="stat-cell"><div class="stat-lbl">WIN</div><div class="stat-val" style="color:var(--grn)">65%</div></div>
    <div class="stat-cell"><div class="stat-lbl">R:R</div><div class="stat-val" style="color:var(--ora)">1:1.8</div></div>
    <div class="stat-cell"><div class="stat-lbl">STK</div><div class="stat-val" style="color:var(--pk)">W3</div></div>
  </div>
</div>

<style>
  /* Volatility Alert */
  .vol-alert {
    flex-shrink: 0; display: flex; align-items: center; gap: 6px;
    padding: 6px 10px;
    background: linear-gradient(90deg, rgba(255,45,85,.15), rgba(255,45,85,.05));
    border-bottom: 2px solid rgba(255,45,85,.4);
    animation: volPulse 1s ease infinite;
    position: relative; z-index: 3;
  }
  @keyframes volPulse { 0%,100%{opacity:1} 50%{opacity:.7} }
  .vol-pulse {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--red); box-shadow: 0 0 8px var(--red);
    animation: blink .6s infinite;
  }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.2} }
  .vol-text { font-family: var(--fm); font-size: 9px; font-weight: 900; letter-spacing: 1px; color: var(--red); flex: 1; }
  .vol-arena-btn {
    font-family: var(--fm); font-size: 8px; font-weight: 900; letter-spacing: 1px;
    padding: 3px 8px; border-radius: 4px; background: var(--red); color: #fff;
    border: 1.5px solid #000; cursor: pointer; box-shadow: 2px 2px 0 #000;
  }

  .war-room {
    background: #0A0908; display: flex; flex-direction: column; overflow: hidden;
    height: 100%; border-right: 3px solid var(--yel); position: relative;
  }
  .war-room::after {
    content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 0;
    background: repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(0,0,0,.18) 2px, rgba(0,0,0,.18) 3px);
    contain: strict; will-change: auto;
  }

  .wr-header {
    height: 34px; padding: 0 10px; flex-shrink: 0;
    background: var(--yel); border-bottom: 3px solid #000;
    display: flex; align-items: center; gap: 8px; position: relative; z-index: 2;
  }
  .wr-title { font-family: var(--fdisplay); font-size: 16px; letter-spacing: 3px; color: #000; }
  .wr-header-right { display: flex; align-items: center; gap: 5px; margin-left: auto; }
  .arena-trigger {
    font-family: var(--fm); font-size: 7px; font-weight: 700;
    color: var(--pk); background: rgba(255,45,155,.1);
    border: 1.5px solid rgba(255,45,155,.4);
    padding: 2px 6px; cursor: pointer; letter-spacing: 1px; transition: all .15s;
  }
  .arena-trigger:hover { background: rgba(255,45,155,.25); }
  .wr-live {
    font-family: var(--fm); font-size: 6.5px; font-weight: 700; letter-spacing: 2px;
    color: #000; background: var(--grn); padding: 2px 6px;
    display: flex; align-items: center; gap: 3px;
  }
  .wr-live-dot { width: 4px; height: 4px; border-radius: 50%; background: #000; animation: wr-blink .9s infinite; }
  @keyframes wr-blink { 0%,100%{opacity:1} 50%{opacity:.2} }
  .wr-auto-badge {
    font-family: var(--fm); font-size: 6px; font-weight: 700; letter-spacing: 1px;
    background: #000; color: var(--yel); padding: 2px 5px; border: 1px solid #000;
  }
  .wr-collapse-btn {
    display: flex; align-items: center; justify-content: center;
    width: 18px; height: 18px; padding: 0;
    background: rgba(0,0,0,.4); border: 1px solid rgba(0,0,0,.3);
    border-radius: 3px; cursor: pointer; color: rgba(0,0,0,.5);
    transition: all .12s;
  }
  .wr-collapse-btn:hover { background: rgba(0,0,0,.6); color: #000; }

  /* Token Filter Tabs */
  .token-tabs {
    display: flex; flex-shrink: 0; border-bottom: 2px solid rgba(255,230,0,.15);
    position: relative; z-index: 2; background: rgba(0,0,0,.6);
  }
  .token-tab {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px;
    padding: 6px 4px; font-family: var(--fm); font-size: 9px; font-weight: 900;
    letter-spacing: 1.5px; color: rgba(255,255,255,.35);
    background: none; border: none; border-bottom: 2px solid transparent;
    cursor: pointer; transition: color .15s, border-color .15s;
  }
  .token-tab:hover { color: rgba(255,255,255,.6); }
  .token-tab.active { color: var(--yel); border-bottom-color: var(--yel); background: rgba(255,230,0,.05); }
  .token-tab.active.btc { color: #f7931a; border-bottom-color: #f7931a; }
  .token-tab.active.eth { color: #627eea; border-bottom-color: #627eea; }
  .token-tab.active.sol { color: #9945ff; border-bottom-color: #9945ff; }
  .token-tab-count {
    font-size: 7px; font-weight: 700; padding: 1px 4px; border-radius: 6px;
    background: rgba(255,255,255,.06); color: rgba(255,255,255,.3);
  }
  .token-tab.active .token-tab-count { background: rgba(255,230,0,.12); color: var(--yel); }

  /* Derivatives Data Strip */
  .deriv-strip {
    flex-shrink: 0; position: relative; z-index: 2;
    background: rgba(0,0,0,.5); border-bottom: 1px solid rgba(255,230,0,.1);
    padding: 4px 8px;
  }
  .deriv-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; }
  .deriv-row + .deriv-row { margin-top: 2px; }
  .deriv-cell { text-align: center; padding: 2px 0; }
  .deriv-lbl {
    display: block; font-family: var(--fm); font-size: 6px; font-weight: 700;
    letter-spacing: 1px; color: rgba(255,255,255,.25); line-height: 1;
  }
  .deriv-val {
    display: block; font-family: var(--fd); font-size: 11px; font-weight: 900;
    color: rgba(255,255,255,.7); line-height: 1.3;
  }
  .deriv-val.loading { opacity: .4; }
  .deriv-val.pos { color: var(--grn); }
  .deriv-val.neg { color: var(--red); }
  .deriv-val.long-liq { color: var(--grn); font-size: 9px; }
  .deriv-val.short-liq { color: var(--red); font-size: 9px; }

  /* Select All Bar */
  .select-bar {
    display: flex; align-items: center; gap: 6px; padding: 4px 10px;
    background: rgba(255,230,0,.02); border-bottom: 1px solid rgba(255,230,0,.08);
    flex-shrink: 0; position: relative; z-index: 1;
  }
  .select-all-btn {
    display: flex; align-items: center; gap: 4px;
    font-family: var(--fm); font-size: 7px; font-weight: 900; letter-spacing: 1px;
    color: rgba(255,255,255,.4); background: none; border: none;
    cursor: pointer; padding: 2px 0; transition: color .12s;
  }
  .select-all-btn:hover { color: rgba(255,255,255,.7); }
  .sa-check { font-size: 11px; color: rgba(255,255,255,.3); }
  .sa-check.checked { color: var(--yel); }
  .select-count {
    font-family: var(--fm); font-size: 7px; font-weight: 700;
    color: var(--yel); background: rgba(255,230,0,.1); padding: 1px 6px; border-radius: 8px;
  }

  /* Signal Feed */
  .wr-msgs { flex: 1; overflow-y: auto; position: relative; z-index: 1; }
  .wr-msgs::-webkit-scrollbar { width: 2px; }
  .wr-msgs::-webkit-scrollbar-thumb { background: var(--yel); }
  .wr-msg {
    display: flex; gap: 0; border-bottom: 1px solid rgba(255,255,255,.035);
    transition: background .1s; cursor: pointer;
  }
  .wr-msg:hover { background: rgba(255,255,255,.02); }
  .wr-msg.selected { background: rgba(255,230,0,.04); border-left: 2px solid var(--yel); }
  .wr-msg-strip { width: 2px; flex-shrink: 0; }
  .wr-msg.selected .wr-msg-strip { width: 0; }
  .wr-msg-checkbox { display: flex; align-items: flex-start; padding: 8px 2px 0 6px; flex-shrink: 0; }
  .msg-check { font-size: 13px; color: rgba(255,255,255,.2); line-height: 1; }
  .msg-check.checked { color: var(--yel); }
  .wr-msg-body { flex: 1; padding: 7px 10px 6px 4px; }
  .wr-msg-head { display: flex; align-items: center; gap: 4px; margin-bottom: 3px; flex-wrap: wrap; }
  .wr-msg-icon { font-size: 11px; line-height: 1; flex-shrink: 0; }
  .wr-msg-name { font-family: var(--fm); font-size: 9px; font-weight: 700; }
  .wr-msg-token {
    font-family: var(--fm); font-size: 7px; font-weight: 900; letter-spacing: .5px;
    padding: 1px 4px; border-radius: 3px; background: rgba(255,255,255,.06); color: rgba(255,255,255,.5);
  }
  .wr-msg-vote { font-family: var(--fm); font-size: 8px; font-weight: 700; padding: 1px 5px; border: 1px solid; }
  .wr-msg-vote.short { color: var(--red); border-color: rgba(255,45,85,.4); background: rgba(255,45,85,.08); }
  .wr-msg-vote.long { color: var(--grn); border-color: rgba(0,255,136,.4); background: rgba(0,255,136,.08); }
  .wr-msg-vote.neutral { color: rgba(255,255,255,.35); border-color: rgba(255,255,255,.1); }
  .wr-msg-conf { font-family: var(--fm); font-size: 8px; font-weight: 900; color: var(--yel); }
  .wr-msg-time { font-family: var(--fm); font-size: 7px; color: rgba(255,255,255,.25); margin-left: auto; }
  .wr-msg-text { font-family: var(--fm); font-size: 9px; line-height: 1.5; color: rgba(255,255,255,.7); }
  .wr-msg-signal-row {
    display: flex; align-items: center; gap: 6px; margin-top: 3px;
    font-family: var(--fm); font-size: 8px; font-weight: 700;
  }
  .wr-msg-entry { color: rgba(255,255,255,.6); }
  .wr-msg-arrow-price { color: rgba(255,255,255,.2); font-size: 7px; }
  .wr-msg-tp { color: var(--grn); }
  .wr-msg-sl { color: var(--red); }
  .wr-msg-src { font-family: var(--fm); font-size: 7px; color: rgba(255,230,0,.25); }
  .wr-msg-actions { display: flex; align-items: center; gap: 4px; margin-top: 4px; }
  .wr-act-btn {
    font-family: var(--fm); font-size: 7px; font-weight: 800; letter-spacing: .5px;
    padding: 2px 6px; border-radius: 3px; cursor: pointer; transition: background .12s; border: 1px solid;
  }
  .wr-act-btn.long { color: var(--grn); border-color: rgba(0,255,136,.3); background: rgba(0,255,136,.06); }
  .wr-act-btn.long:hover { background: rgba(0,255,136,.2); }
  .wr-act-btn.short { color: var(--red); border-color: rgba(255,45,85,.3); background: rgba(255,45,85,.06); }
  .wr-act-btn.short:hover { background: rgba(255,45,85,.2); }
  .wr-act-btn.track { color: #00ccff; border-color: rgba(0,204,255,.3); background: rgba(0,204,255,.06); }
  .wr-act-btn.track:hover { background: rgba(0,204,255,.2); }

  /* Copy Trade CTA */
  .copy-trade-cta {
    width: 100%; display: flex; align-items: center; gap: 6px;
    padding: 10px 12px;
    background: linear-gradient(90deg, rgba(255,230,0,.12), rgba(255,230,0,.04));
    border: none; border-top: 2px solid var(--yel);
    cursor: pointer; transition: background .15s;
    flex-shrink: 0; position: relative; z-index: 2;
  }
  .copy-trade-cta:hover { background: linear-gradient(90deg, rgba(255,230,0,.22), rgba(255,230,0,.08)); }
  .ctc-icon { font-size: 14px; }
  .ctc-text { font-family: var(--fd); font-size: 10px; font-weight: 900; letter-spacing: 2px; color: var(--yel); }
  .ctc-count {
    font-family: var(--fm); font-size: 7px; font-weight: 700;
    color: #000; background: var(--yel); padding: 2px 6px; border-radius: 8px;
  }
  .ctc-arrow { margin-left: auto; font-family: var(--fm); font-size: 12px; color: var(--yel); }

  /* Signal Link / Signal Room CTA */
  .signal-link {
    font-family: var(--fm); font-size: 7px; font-weight: 700;
    color: var(--pk); background: rgba(255,45,155,.1);
    border: 1.5px solid rgba(255,45,155,.4);
    padding: 2px 6px; cursor: pointer; letter-spacing: 1px; transition: all .15s;
  }
  .signal-link:hover { background: rgba(255,45,155,.25); }
  .signal-room-cta {
    width: 100%; display: flex; align-items: center; gap: 6px; padding: 8px 10px;
    background: linear-gradient(90deg, rgba(255,45,155,.1), rgba(255,45,155,.03));
    border: none; border-top: 2px solid rgba(255,45,155,.3);
    cursor: pointer; transition: background .12s; flex-shrink: 0; position: relative; z-index: 1;
  }
  .signal-room-cta:hover { background: linear-gradient(90deg, rgba(255,45,155,.18), rgba(255,45,155,.06)); }
  .src-icon { font-size: 12px; }
  .src-text { font-family: var(--fm); font-size: 8px; font-weight: 900; letter-spacing: 1.5px; color: var(--pk); }
  .src-count { font-family: var(--fm); font-size: 7px; font-weight: 700; color: rgba(255,255,255,.4); }
  .src-tracked { font-family: var(--fm); font-size: 7px; font-weight: 900; color: var(--ora); background: rgba(255,140,59,.1); padding: 1px 5px; border-radius: 4px; }
  .src-arrow { margin-left: auto; font-family: var(--fm); font-size: 10px; color: var(--pk); }

  /* Stats Footer */
  .wr-stats {
    border-top: 3px solid var(--yel); display: grid; grid-template-columns: repeat(4, 1fr);
    flex-shrink: 0; position: relative; z-index: 1; background: rgba(255,230,0,.02);
  }
  .stat-cell { padding: 5px 4px; text-align: center; border-right: 1px solid rgba(255,230,0,.1); }
  .stat-cell:last-child { border-right: none; }
  .stat-lbl { font-family: var(--fm); font-size: 7px; color: rgba(255,230,0,.4); letter-spacing: 1.5px; margin-bottom: 1px; }
  .stat-val { font-family: var(--fdisplay); font-size: 16px; letter-spacing: 1px; line-height: 1.1; }
</style>
