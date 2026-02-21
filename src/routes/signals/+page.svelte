<script lang="ts">
  import { AGDEFS, CHARACTER_ART } from '$lib/data/agents';
  import { gameState } from '$lib/stores/gameState';
  import { matchHistoryStore } from '$lib/stores/matchHistoryStore';
  import { openTrades } from '$lib/stores/quickTradeStore';
  import { activeSignals, trackSignal } from '$lib/stores/trackedSignalStore';
  import { incrementTrackedSignals } from '$lib/stores/userProfileStore';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { notifySignalTracked } from '$lib/stores/notificationStore';
  import EmptyState from '../../components/shared/EmptyState.svelte';
  import ContextBanner from '../../components/shared/ContextBanner.svelte';

  $: state = $gameState;
  $: records = $matchHistoryStore.records;
  $: opens = $openTrades;
  $: tracked = $activeSignals;

  interface Signal {
    id: string;
    agent: typeof AGDEFS[0] | null;
    pair: string;
    dir: 'LONG' | 'SHORT';
    conf: number;
    entry: number;
    tp: number;
    sl: number;
    rr: string;
    time: string;
    priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    source: 'arena' | 'trade' | 'tracked' | 'agent';
    reason: string;
    active: boolean;
  }

  let filter: string = 'all';

  // Build signals from real data sources
  $: arenaSignals = buildArenaSignals(records);
  $: tradeSignals = buildTradeSignals(opens);
  $: trackedSignals = buildTrackedSignals(tracked);
  $: agentSignals = buildAgentSignals();
  $: allSignals = [...arenaSignals, ...tradeSignals, ...trackedSignals, ...agentSignals];
  $: filteredSignals = filter === 'all' ? allSignals
    : filter === 'active' ? allSignals.filter(s => s.active)
    : filter === 'arena' ? arenaSignals
    : filter === 'trade' ? tradeSignals
    : filter === 'tracked' ? trackedSignals
    : allSignals.filter(s => s.priority === filter);

  function buildArenaSignals(recs: typeof records): Signal[] {
    return recs.slice(0, 10).flatMap(r => {
      if (!r.agentVotes) return [];
      return r.agentVotes.map(v => {
        const ag = AGDEFS.find(a => a.id === v.agentId) || AGDEFS[0];
        const base = state.prices?.BTC || 97000;
        return {
          id: `arena-${r.id}-${v.agentId}`,
          agent: ag,
          pair: 'BTC/USDT',
          dir: v.dir as 'LONG' | 'SHORT',
          conf: v.conf,
          entry: Math.round(base),
          tp: Math.round(v.dir === 'LONG' ? base * 1.02 : base * 0.98),
          sl: Math.round(v.dir === 'LONG' ? base * 0.99 : base * 1.01),
          rr: '1:2.0',
          time: timeSince(r.timestamp),
          priority: v.conf >= 80 ? 'CRITICAL' as const : v.conf >= 70 ? 'HIGH' as const : 'MEDIUM' as const,
          source: 'arena' as const,
          reason: `Arena Match #${r.matchN} — ${r.win ? 'WIN' : 'LOSS'} (${v.name}: ${v.dir} ${v.conf}%)`,
          active: true,
        };
      });
    });
  }

  function buildTradeSignals(trades: typeof opens): Signal[] {
    return trades.map(t => ({
      id: `trade-${t.id}`,
      agent: null,
      pair: t.pair,
      dir: t.dir,
      conf: 75,
      entry: Math.round(t.entry),
      tp: t.tp ? Math.round(t.tp) : Math.round(t.dir === 'LONG' ? t.entry * 1.02 : t.entry * 0.98),
      sl: t.sl ? Math.round(t.sl) : Math.round(t.dir === 'LONG' ? t.entry * 0.99 : t.entry * 1.01),
      rr: '1:2.0',
      time: timeSince(t.openedAt),
      priority: Math.abs(t.pnlPercent) > 3 ? 'HIGH' as const : 'MEDIUM' as const,
      source: 'trade' as const,
      reason: `Open position: ${t.dir} ${t.pair} @ $${Math.round(t.entry).toLocaleString()} (PnL: ${t.pnlPercent >= 0 ? '+' : ''}${t.pnlPercent.toFixed(2)}%)`,
      active: true,
    }));
  }

  function buildTrackedSignals(sigs: typeof tracked): Signal[] {
    return sigs.map(s => ({
      id: `tracked-${s.id}`,
      agent: AGDEFS.find(a => a.name === s.source) || null,
      pair: s.pair,
      dir: s.dir,
      conf: s.confidence,
      entry: Math.round(s.entryPrice),
      tp: Math.round(s.dir === 'LONG' ? s.entryPrice * 1.02 : s.entryPrice * 0.98),
      sl: Math.round(s.dir === 'LONG' ? s.entryPrice * 0.99 : s.entryPrice * 1.01),
      rr: '1:2.0',
      time: timeSince(s.trackedAt),
      priority: s.confidence >= 80 ? 'HIGH' as const : 'MEDIUM' as const,
      source: 'tracked' as const,
      reason: `Tracked signal from ${s.source}: ${s.dir} ${s.pair} (PnL: ${s.pnlPercent >= 0 ? '+' : ''}${s.pnlPercent.toFixed(2)}%)`,
      active: true,
    }));
  }

  function buildAgentSignals(): Signal[] {
    // Generate fresh signals from agents based on current state
    return AGDEFS.slice(0, 5).map((ag, i) => {
      const pairs = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];
      const pair = pairs[i % pairs.length];
      const base = pair.startsWith('BTC') ? (state.prices?.BTC || 97000)
        : pair.startsWith('ETH') ? (state.prices?.ETH || 3400)
        : (state.prices?.SOL || 190);
      const dir = ag.dir as 'LONG' | 'SHORT';
      const spread = base * 0.02;
      return {
        id: `agent-${ag.id}`,
        agent: ag,
        pair,
        dir,
        conf: ag.conf,
        entry: Math.round(base),
        tp: Math.round(dir === 'LONG' ? base + spread : base - spread),
        sl: Math.round(dir === 'LONG' ? base - spread * 0.5 : base + spread * 0.5),
        rr: `1:${(1.5 + Math.random()).toFixed(1)}`,
        time: 'LIVE',
        priority: ag.conf >= 78 ? 'CRITICAL' as const : ag.conf >= 70 ? 'HIGH' as const : 'MEDIUM' as const,
        source: 'agent' as const,
        reason: ag.finding.title + ' — ' + ag.finding.detail,
        active: true,
      };
    });
  }

  function timeSince(ts: number): string {
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 60) return `${sec}s ago`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    return `${Math.floor(sec / 86400)}d ago`;
  }

  function handleTrack(sig: Signal) {
    trackSignal(sig.pair, sig.dir, sig.entry, sig.agent?.name || 'manual', sig.conf);
    incrementTrackedSignals();
    notifySignalTracked(sig.pair, sig.dir);
  }

  function handleTrade(sig: Signal) {
    const params = new URLSearchParams({
      copyTrade: '1',
      pair: sig.pair,
      dir: sig.dir,
      entry: String(Math.round(sig.entry)),
      tp: String(Math.round(sig.tp)),
      sl: String(Math.round(sig.sl)),
      conf: String(Math.round(sig.conf)),
      source: sig.agent?.name || sig.source.toUpperCase(),
      reason: sig.reason,
    });
    goto(`/terminal?${params.toString()}`);
  }

  function priorityColor(p: string): string {
    return p === 'CRITICAL' ? '#ff2d55' : p === 'HIGH' ? '#ff8c3b' : p === 'MEDIUM' ? '#ffe600' : '#00ff88';
  }

  function sourceLabel(s: string): string {
    return s === 'arena' ? '⚔️ ARENA' : s === 'trade' ? '📊 TRADE' : s === 'tracked' ? '📌 TRACKED' : '🤖 AGENT';
  }

  function sourceColor(s: string): string {
    return s === 'arena' ? '#ff2d9b' : s === 'trade' ? '#3b9eff' : s === 'tracked' ? '#ff8c3b' : '#8b5cf6';
  }
</script>

<div class="signals-page">
  <ContextBanner page="signals" />
  <div class="sig-header">
    <div class="sh-bg"></div>
    <div class="sh-content">
      <div class="sh-top-row">
        <h1 class="sh-title">SIGNAL ROOM</h1>
        <div class="sh-live"><span class="sh-live-dot"></span> LIVE</div>
      </div>
      <p class="sh-sub">AI 에이전트 분석 기반 트레이딩 시그널</p>
      <div class="sh-flow">
        <span class="sh-flow-step">🧠 WAR ROOM</span>
        <span class="sh-flow-arrow">→</span>
        <span class="sh-flow-step active">📡 SIGNAL ROOM</span>
        <span class="sh-flow-arrow">→</span>
        <span class="sh-flow-step">🚀 COPY TRADE</span>
      </div>
      <div class="sh-counts">
        <span class="sh-count">{allSignals.filter(s => s.active).length} ACTIVE</span>
        <span class="sh-count arena">{arenaSignals.length} ARENA</span>
        <span class="sh-count trade">{tradeSignals.length} TRADE</span>
        <span class="sh-count tracked">{trackedSignals.length} TRACKED</span>
      </div>
    </div>
  </div>

  <div class="filter-bar">
    {#each [['all', 'ALL'], ['active', 'ACTIVE'], ['arena', '⚔️ ARENA'], ['trade', '📊 TRADE'], ['tracked', '📌 TRACKED'], ['CRITICAL', '🔴 CRITICAL'], ['HIGH', '🟠 HIGH']] as [key, label]}
      <button class="filter-btn" class:active={filter === key} on:click={() => filter = key}>{label}</button>
    {/each}
  </div>

  <div class="signal-list">
    {#if filteredSignals.length === 0}
      <EmptyState
        image={CHARACTER_ART.tradeSurge}
        title="NO SIGNALS YET"
        subtitle="Start an Arena battle or open trades to generate signals"
        ctaText="⚔️ GO TO ARENA"
        ctaHref="/arena"
        icon="🔍"
        variant="orange"
      />
    {:else}
      {#each filteredSignals as sig (sig.id)}
        <div class="signal-card" class:inactive={!sig.active}>
          <div class="sig-strip" style="background:{priorityColor(sig.priority)}"></div>
          <div class="sig-body">
            <div class="sig-top">
              <span class="sig-source" style="color:{sourceColor(sig.source)};border-color:{sourceColor(sig.source)}">{sourceLabel(sig.source)}</span>
              {#if sig.agent}
                <div class="sig-agent">
                  {#if sig.agent.img?.def}
                    <img src={sig.agent.img.def} alt={sig.agent.name} class="sig-agent-img" />
                  {/if}
                  <span class="sig-agent-name" style="color:{sig.agent.color}">{sig.agent.name}</span>
                </div>
              {/if}
              <span class="sig-pair">{sig.pair}</span>
              <span class="sig-priority" style="color:{priorityColor(sig.priority)};border-color:{priorityColor(sig.priority)}">{sig.priority}</span>
              <span class="sig-time">{sig.time}</span>
            </div>

            <div class="sig-direction">
              <span class="sig-dir-badge" class:long={sig.dir === 'LONG'} class:short={sig.dir === 'SHORT'}>
                {sig.dir === 'LONG' ? '▲' : '▼'} {sig.dir}
              </span>
              <span class="sig-conf">{sig.conf}% CONF</span>
              <span class="sig-rr">R:R {sig.rr}</span>
            </div>

            <div class="sig-levels">
              <div class="sig-level"><span class="sl-label">ENTRY</span><span class="sl-val entry">${sig.entry.toLocaleString()}</span></div>
              <div class="sig-level"><span class="sl-label">TP</span><span class="sl-val tp">${sig.tp.toLocaleString()}</span></div>
              <div class="sig-level"><span class="sl-label">SL</span><span class="sl-val sl">${sig.sl.toLocaleString()}</span></div>
            </div>

            <div class="sig-reason">{sig.reason}</div>

            {#if sig.active}
              <div class="sig-actions">
                {#if sig.source !== 'tracked'}
                  <button class="sig-btn track" on:click={() => handleTrack(sig)}>📌 TRACK</button>
                {/if}
                <button class="sig-btn copy-trade" on:click={() => handleTrade(sig)}>
                  🚀 COPY TRADE
                </button>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .signals-page {
    height: 100%;
    overflow-y: auto;
    background: linear-gradient(180deg, #1a1a0a, #0a0a1a);
  }

  .sig-header {
    position: relative;
    padding: 20px 24px;
    border-bottom: 4px solid #000;
    background: linear-gradient(135deg, #ff8c3b, #ff6600);
    overflow: hidden;
  }
  .sig-header::after {
    content: '';
    position: absolute;
    right: -10px; top: -10px;
    width: 110px; height: 110px;
    background: url('/doge/trade-expressions.png') center/cover no-repeat;
    opacity: .15;
    border-radius: 50%;
    pointer-events: none;
    filter: blur(1px);
  }
  .sh-bg { position: absolute; inset: 0; background: radial-gradient(circle at 70% 30%, rgba(255,255,255,.2), transparent 60%); }
  .sh-content { position: relative; z-index: 2; }
  .sh-title {
    font-family: var(--fc);
    font-size: 28px;
    color: #fff;
    -webkit-text-stroke: 1px #000;
    text-shadow: 3px 3px 0 rgba(0,0,0,.3);
    letter-spacing: 3px;
  }
  .sh-top-row { display: flex; align-items: center; gap: 8px; }
  .sh-live {
    font-family: var(--fm); font-size: 7px; font-weight: 900; letter-spacing: 2px;
    color: #000; background: var(--grn); padding: 2px 6px;
    display: flex; align-items: center; gap: 3px; border-radius: 4px;
  }
  .sh-live-dot { width: 4px; height: 4px; border-radius: 50%; background: #000; animation: sh-blink .9s infinite; }
  @keyframes sh-blink { 0%,100%{opacity:1} 50%{opacity:.2} }
  .sh-sub { font-family: var(--fm); font-size: 9px; color: rgba(255,255,255,.7); letter-spacing: 2px; margin-top: 2px; }
  .sh-flow {
    display: flex; align-items: center; gap: 4px;
    margin-top: 6px; margin-bottom: 2px;
  }
  .sh-flow-step {
    font-family: var(--fm); font-size: 7px; font-weight: 700; letter-spacing: 1px;
    color: rgba(255,255,255,.4); padding: 2px 6px;
    border: 1px solid rgba(255,255,255,.1); border-radius: 4px;
    background: rgba(255,255,255,.03);
  }
  .sh-flow-step.active {
    color: #fff; border-color: var(--pk); background: rgba(255,45,155,.15);
  }
  .sh-flow-arrow { font-size: 8px; color: rgba(255,255,255,.2); }
  .sh-counts { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
  .sh-count {
    font-family: var(--fm); font-size: 7px; font-weight: 900; letter-spacing: 1.5px;
    background: #000; color: var(--grn); padding: 2px 8px; border-radius: 4px;
  }
  .sh-count.arena { color: #ff2d9b; }
  .sh-count.trade { color: #3b9eff; }
  .sh-count.tracked { color: #ff8c3b; }

  .filter-bar {
    display: flex; gap: 4px; padding: 8px 16px;
    border-bottom: 2px solid rgba(255,255,255,.05);
    overflow-x: auto;
  }
  .filter-btn {
    font-family: var(--fm); font-size: 7px; font-weight: 700; letter-spacing: 1px;
    padding: 3px 8px; border-radius: 6px;
    border: 1.5px solid rgba(255,255,255,.1);
    background: rgba(255,255,255,.03);
    color: rgba(255,255,255,.4);
    cursor: pointer; transition: all .15s; white-space: nowrap;
  }
  .filter-btn.active {
    background: var(--ora); color: #000; border-color: var(--ora);
    box-shadow: 0 0 8px rgba(255,140,59,.3);
  }

  .signal-list { padding: 10px 16px; display: flex; flex-direction: column; gap: 6px; }

  .signal-card {
    display: flex;
    border: 2px solid rgba(255,255,255,.06);
    border-radius: 10px;
    background: rgba(255,255,255,.02);
    overflow: hidden;
    transition: all .15s;
  }
  .signal-card:hover { background: rgba(255,255,255,.04); border-color: rgba(255,255,255,.1); }
  .signal-card.inactive { opacity: .5; }
  .sig-strip { width: 3px; flex-shrink: 0; }
  .sig-body { flex: 1; padding: 8px 10px; }

  .sig-top { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; flex-wrap: wrap; }
  .sig-source {
    font-family: var(--fm); font-size: 6px; font-weight: 900; letter-spacing: 1px;
    padding: 1px 5px; border: 1px solid; border-radius: 3px;
  }
  .sig-agent { display: flex; align-items: center; gap: 3px; }
  .sig-agent-img { width: 16px; height: 16px; border-radius: 4px; border: 1px solid rgba(255,255,255,.1); object-fit: cover; }
  .sig-agent-name { font-family: var(--fm); font-size: 7px; font-weight: 900; letter-spacing: .5px; }
  .sig-pair { font-family: var(--fd); font-size: 11px; font-weight: 900; color: #fff; }
  .sig-priority {
    font-family: var(--fm); font-size: 6px; font-weight: 900; letter-spacing: 1px;
    padding: 1px 5px; border: 1px solid; border-radius: 3px;
  }
  .sig-time { font-family: var(--fm); font-size: 7px; color: rgba(255,255,255,.2); margin-left: auto; }

  .sig-direction { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
  .sig-dir-badge {
    font-family: var(--fm); font-size: 9px; font-weight: 900; letter-spacing: 1px;
    padding: 2px 6px; border: 1.5px solid; border-radius: 4px;
  }
  .sig-dir-badge.long { color: var(--grn); border-color: rgba(0,255,136,.4); background: rgba(0,255,136,.08); }
  .sig-dir-badge.short { color: var(--red); border-color: rgba(255,45,85,.4); background: rgba(255,45,85,.08); }
  .sig-conf { font-family: var(--fm); font-size: 8px; font-weight: 700; color: var(--yel); }
  .sig-rr { font-family: var(--fm); font-size: 8px; color: rgba(255,255,255,.4); }

  .sig-levels {
    display: flex; gap: 12px; margin-bottom: 4px;
    padding: 4px 6px; background: rgba(255,255,255,.02); border-radius: 4px;
  }
  .sig-level { display: flex; flex-direction: column; }
  .sl-label { font-family: var(--fm); font-size: 6px; color: rgba(255,255,255,.25); }
  .sl-val { font-family: var(--fd); font-size: 11px; font-weight: 900; }
  .sl-val.entry { color: #fff; }
  .sl-val.tp { color: var(--grn); }
  .sl-val.sl { color: var(--red); }

  .sig-reason { font-family: var(--fm); font-size: 7px; color: rgba(255,255,255,.4); line-height: 1.4; margin-bottom: 4px; }

  .sig-actions { display: flex; gap: 4px; }
  .sig-btn {
    font-family: var(--fm); font-size: 7px; font-weight: 900; letter-spacing: 1px;
    padding: 4px 10px; border-radius: 5px;
    cursor: pointer; transition: all .15s;
  }
  .sig-btn.track {
    background: rgba(255,140,59,.1); color: var(--ora);
    border: 1.5px solid rgba(255,140,59,.3);
  }
  .sig-btn.track:hover { background: rgba(255,140,59,.2); }
  .sig-btn.copy-trade {
    background: var(--grn); color: #000;
    border: 2px solid #000;
    font-weight: 900; letter-spacing: 1.5px;
    padding: 5px 14px; border-radius: 6px;
    box-shadow: 2px 2px 0 #000;
    transition: all .12s;
  }
  .sig-btn.copy-trade:hover { transform: translate(-1px,-1px); box-shadow: 3px 3px 0 #000; }

  /* Empty state handled by EmptyState component */
</style>
