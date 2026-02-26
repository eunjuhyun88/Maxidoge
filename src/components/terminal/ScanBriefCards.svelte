<!--
  ScanBriefCards.svelte
  C02 Architecture Card Layout (Agent Architecture C02 v1.0 §6.1)

  Layout:
    Desktop: ORPO Card (full width) → 2x2 CTX grid → COMMANDER Score (full width)
    Mobile:  Vertical stack, each card collapsible (ORPO + COMMANDER always open)
-->
<script lang="ts">
  import type { C02Cards, CtxCardData, CtxFlag } from '$lib/terminal/scanCardMapper';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher<{
    track: void;
    long: void;
    short: void;
    dismiss: void;
  }>();

  export let cards: C02Cards;
  export let compact = false;

  let expandedCtx: Record<string, boolean> = { DERIV: true, FLOW: true, MACRO: true, SENTI: true };

  function toggleCtx(id: string) {
    expandedCtx[id] = !expandedCtx[id];
    expandedCtx = expandedCtx;
  }

  function dirClass(dir: string): string {
    if (dir === 'LONG') return 'dir-long';
    if (dir === 'SHORT') return 'dir-short';
    return 'dir-neutral';
  }

  function flagClass(flag: CtxFlag): string {
    if (flag === 'GREEN') return 'flag-green';
    if (flag === 'RED') return 'flag-red';
    return 'flag-neutral';
  }

  function confBar(conf: number): string {
    return `${Math.min(Math.max(conf, 0), 100)}%`;
  }
</script>

<div class="scan-cards" class:compact>
  <!-- ① ORPO Card (Primary, Full Width) -->
  <div class="card card-orpo">
    <div class="card-head">
      <span class="card-badge">ORPO</span>
      <span class="card-label">Chart Analysis</span>
      <span class="dir-badge {dirClass(cards.orpo.direction)}">{cards.orpo.direction}</span>
      <span class="conf-value">{cards.orpo.confidence}%</span>
    </div>
    <div class="conf-bar"><div class="conf-fill {dirClass(cards.orpo.direction)}" style="width:{confBar(cards.orpo.confidence)}"></div></div>
    <div class="card-body">
      <div class="orpo-pattern">{cards.orpo.patternName}</div>
      {#if cards.orpo.keyLevels}
        <div class="orpo-levels">
          <span class="level"><span class="level-label">Entry</span><span class="level-value">${cards.orpo.keyLevels.entry.toLocaleString()}</span></span>
          <span class="level"><span class="level-label">TP</span><span class="level-value tp">${cards.orpo.keyLevels.tp.toLocaleString()}</span></span>
          <span class="level"><span class="level-label">SL</span><span class="level-value sl">${cards.orpo.keyLevels.sl.toLocaleString()}</span></span>
        </div>
      {/if}
      <div class="orpo-agents">
        {#each cards.orpo.sourceAgents as agent}
          <span class="agent-chip">{agent}</span>
        {/each}
      </div>
    </div>
  </div>

  <!-- ②③④⑤ CTX Grid (2x2 Desktop, Stack Mobile) -->
  <div class="ctx-grid">
    {#each [cards.deriv, cards.flow, cards.macro, cards.senti] as ctx (ctx.agentId)}
      <div class="card card-ctx">
        <button class="ctx-head" on:click={() => toggleCtx(ctx.agentId)}>
          <span class="flag-dot {flagClass(ctx.flag)}"></span>
          <span class="ctx-label">{ctx.label}</span>
          <span class="dir-badge dir-badge-sm {dirClass(ctx.direction)}">{ctx.direction}</span>
          <span class="conf-value conf-sm">{ctx.confidence}%</span>
          <span class="ctx-toggle">{expandedCtx[ctx.agentId] ? '−' : '+'}</span>
        </button>
        {#if expandedCtx[ctx.agentId]}
          <div class="ctx-body">
            <div class="ctx-evidence">{ctx.keyEvidence}</div>
            {#if Object.keys(ctx.metrics).length > 0}
              <div class="ctx-metrics">
                {#each Object.entries(ctx.metrics) as [key, val]}
                  <span class="metric"><span class="metric-key">{key}</span><span class="metric-val">{val}</span></span>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/each}
  </div>

  <!-- ⑥ COMMANDER Score (Full Width) -->
  <div class="card card-commander">
    <div class="card-head">
      <span class="card-badge badge-cmd">COMMANDER</span>
      <span class="card-label">Entry Score</span>
      <span class="dir-badge {dirClass(cards.commander.finalDirection)}">{cards.commander.finalDirection}</span>
      <span class="conf-value conf-lg">{cards.commander.entryScore}%</span>
    </div>
    <div class="conf-bar"><div class="conf-fill {dirClass(cards.commander.finalDirection)}" style="width:{confBar(cards.commander.entryScore)}"></div></div>
    <div class="card-body cmd-body">
      <span class="cmd-risk">{cards.commander.riskAssessment}</span>
      {#if cards.commander.conflictType}
        <span class="cmd-conflict">⚠ {cards.commander.conflictType}</span>
      {/if}
      <span class="cmd-agents">{cards.commander.agentCount} agents</span>
    </div>
  </div>

  <!-- Action Buttons (C02 §6.1) -->
  {#if !compact}
    <div class="scan-actions">
      <button class="action-btn action-track" on:click={() => dispatch('track')}>TRACK</button>
      <button class="action-btn action-long" on:click={() => dispatch('long')}>LONG</button>
      <button class="action-btn action-short" on:click={() => dispatch('short')}>SHORT</button>
      <button class="action-btn action-dismiss" on:click={() => dispatch('dismiss')}>DISMISS</button>
    </div>
  {/if}
</div>

<style>
  .scan-cards {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 4px;
    font-family: var(--fm);
  }
  .scan-cards.compact { gap: 2px; padding: 2px; }

  /* Card base */
  .card {
    background: rgba(255,255,255,.03);
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 6px;
    overflow: hidden;
  }
  .card-head {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 8px 3px;
  }
  .card-body {
    padding: 3px 8px 6px;
  }
  .card-badge {
    font-size: 7px;
    font-weight: 900;
    letter-spacing: 1.2px;
    padding: 1px 5px;
    border-radius: 3px;
    background: rgba(255,230,0,.15);
    color: var(--yel, #ffe600);
    border: 1px solid rgba(255,230,0,.3);
  }
  .badge-cmd {
    background: rgba(255,45,155,.15);
    color: #ff2d9b;
    border-color: rgba(255,45,155,.3);
  }
  .card-label {
    font-size: 8px;
    font-weight: 700;
    color: rgba(255,255,255,.5);
    letter-spacing: .5px;
  }

  /* Direction badges */
  .dir-badge {
    font-size: 7px;
    font-weight: 900;
    letter-spacing: 1px;
    padding: 1px 5px;
    border-radius: 3px;
    border: 1px solid;
  }
  .dir-badge-sm { font-size: 6px; padding: 0 4px; }
  .dir-long { color: var(--grn, #00ff88); border-color: rgba(0,255,136,.3); background: rgba(0,255,136,.1); }
  .dir-short { color: var(--red, #ff2d55); border-color: rgba(255,45,85,.3); background: rgba(255,45,85,.1); }
  .dir-neutral { color: rgba(255,255,255,.4); border-color: rgba(255,255,255,.15); background: rgba(255,255,255,.05); }

  /* Confidence */
  .conf-value {
    margin-left: auto;
    font-family: var(--fd, monospace);
    font-size: 11px;
    font-weight: 900;
    color: rgba(255,255,255,.85);
  }
  .conf-sm { font-size: 9px; }
  .conf-lg { font-size: 14px; }
  .conf-bar {
    height: 2px;
    background: rgba(255,255,255,.06);
    margin: 0 8px;
  }
  .conf-fill {
    height: 100%;
    border-radius: 1px;
    transition: width .3s ease;
  }
  .conf-fill.dir-long { background: var(--grn, #00ff88); }
  .conf-fill.dir-short { background: var(--red, #ff2d55); }
  .conf-fill.dir-neutral { background: rgba(255,255,255,.3); }

  /* ORPO Card */
  .card-orpo {
    border-color: rgba(255,230,0,.2);
    background: rgba(255,230,0,.04);
  }
  .orpo-pattern {
    font-size: 9px;
    font-weight: 800;
    color: rgba(255,255,255,.75);
    margin-bottom: 3px;
  }
  .orpo-levels {
    display: flex;
    gap: 10px;
    margin-bottom: 3px;
  }
  .level {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .level-label {
    font-size: 6px;
    font-weight: 700;
    letter-spacing: 1px;
    color: rgba(255,255,255,.35);
  }
  .level-value {
    font-family: var(--fd, monospace);
    font-size: 9px;
    font-weight: 700;
    color: rgba(255,255,255,.7);
  }
  .level-value.tp { color: var(--grn, #00ff88); }
  .level-value.sl { color: var(--red, #ff2d55); }
  .orpo-agents {
    display: flex;
    gap: 3px;
    flex-wrap: wrap;
  }
  .agent-chip {
    font-size: 6px;
    font-weight: 700;
    letter-spacing: .5px;
    padding: 0 4px;
    border-radius: 3px;
    background: rgba(255,255,255,.06);
    color: rgba(255,255,255,.35);
  }

  /* CTX Grid */
  .ctx-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
  }
  @media (max-width: 768px) {
    .ctx-grid { grid-template-columns: 1fr; }
  }
  .card-ctx { border-color: rgba(255,255,255,.06); }
  .ctx-head {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 6px;
    width: 100%;
    background: none;
    border: none;
    cursor: pointer;
    color: inherit;
    font-family: inherit;
  }
  .ctx-head:hover { background: rgba(255,255,255,.02); }
  .flag-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .flag-green { background: var(--grn, #00ff88); box-shadow: 0 0 4px rgba(0,255,136,.5); }
  .flag-red { background: var(--red, #ff2d55); box-shadow: 0 0 4px rgba(255,45,85,.5); }
  .flag-neutral { background: rgba(255,255,255,.3); }
  .ctx-label {
    font-size: 8px;
    font-weight: 800;
    letter-spacing: .5px;
    color: rgba(255,255,255,.6);
  }
  .ctx-toggle {
    margin-left: auto;
    font-size: 10px;
    color: rgba(255,255,255,.25);
  }
  .ctx-body {
    padding: 2px 6px 5px;
    border-top: 1px solid rgba(255,255,255,.04);
  }
  .ctx-evidence {
    font-size: 7px;
    color: rgba(255,255,255,.5);
    line-height: 1.4;
    margin-bottom: 3px;
  }
  .ctx-metrics {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .metric {
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .metric-key {
    font-size: 5px;
    font-weight: 700;
    letter-spacing: .8px;
    color: rgba(255,255,255,.3);
    text-transform: uppercase;
  }
  .metric-val {
    font-family: var(--fd, monospace);
    font-size: 8px;
    font-weight: 700;
    color: rgba(255,255,255,.65);
  }

  /* COMMANDER Card */
  .card-commander {
    border-color: rgba(255,45,155,.2);
    background: rgba(255,45,155,.04);
  }
  .cmd-body {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .cmd-risk {
    font-size: 8px;
    font-weight: 700;
    color: rgba(255,255,255,.6);
  }
  .cmd-conflict {
    font-size: 7px;
    font-weight: 800;
    color: var(--ora, #ffaa00);
    padding: 0 4px;
    border-radius: 3px;
    background: rgba(255,170,0,.1);
    border: 1px solid rgba(255,170,0,.2);
  }
  .cmd-agents {
    font-size: 7px;
    color: rgba(255,255,255,.25);
    margin-left: auto;
  }

  /* Action Buttons */
  .scan-actions {
    display: flex;
    gap: 4px;
    padding: 2px 0 0;
  }
  .action-btn {
    flex: 1;
    font-family: var(--fm);
    font-size: 8px;
    font-weight: 900;
    letter-spacing: 1px;
    padding: 6px 4px;
    border-radius: 4px;
    cursor: pointer;
    transition: all .15s;
    border: 1px solid;
    min-height: 32px;
  }
  .action-track {
    background: rgba(0,200,255,.1);
    color: var(--cyan, #00c8ff);
    border-color: rgba(0,200,255,.3);
  }
  .action-track:hover { background: rgba(0,200,255,.2); }
  .action-long {
    background: rgba(0,255,136,.1);
    color: var(--grn, #00ff88);
    border-color: rgba(0,255,136,.3);
  }
  .action-long:hover { background: rgba(0,255,136,.25); }
  .action-short {
    background: rgba(255,45,85,.1);
    color: var(--red, #ff2d55);
    border-color: rgba(255,45,85,.3);
  }
  .action-short:hover { background: rgba(255,45,85,.25); }
  .action-dismiss {
    background: rgba(255,255,255,.04);
    color: rgba(255,255,255,.3);
    border-color: rgba(255,255,255,.1);
    flex: 0.6;
  }
  .action-dismiss:hover { color: rgba(255,255,255,.6); }
</style>
