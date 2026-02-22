<script lang="ts">
  import { gameState } from '$lib/stores/gameState';
  import { AGDEFS } from '$lib/data/agents';
  import { latestFeed } from '$lib/stores/battleFeedStore';
  import { PHASE_LABELS } from '$lib/engine/phases';
  import { openTradeCount } from '$lib/stores/quickTradeStore';
  import { activeSignalCount } from '$lib/stores/trackedSignalStore';
  import { goto } from '$app/navigation';

  let state = $gameState;
  $: state = $gameState;

  $: feed = $latestFeed;
  $: phaseLabel = PHASE_LABELS[state.phase] || PHASE_LABELS.DRAFT;
  $: openPos = $openTradeCount;
  $: trackedSigs = $activeSignalCount;
  $: finalDir = state.score >= 60 ? 'LONG' : 'SHORT';
</script>

<div id="bot">
  <!-- Quick context badges -->
  <div class="ctx-badges">
    <button class="ctx-badge" on:click={() => goto('/')}>
      <span class="ctx-icon">🏠</span>
    </button>
    {#if openPos > 0}
      <button class="ctx-badge ctx-pos" on:click={() => goto('/passport')}>
        <span class="ctx-icon">📊</span>
        <span class="ctx-count">{openPos}</span>
      </button>
    {/if}
    {#if trackedSigs > 0}
      <button class="ctx-badge ctx-tracked" on:click={() => goto('/signals')}>
        <span class="ctx-icon">📌</span>
        <span class="ctx-count">{trackedSigs}</span>
      </button>
    {/if}
  </div>

  <div class="chain">
    {#each AGDEFS.slice(0, 5) as ag, i}
      <div class="cslot" class:vis={state.running}>
        <span class="ci">{ag.icon}</span>
        <span class="cn">{ag.name}</span>
        <span class="cd" class:long={ag.dir === 'LONG'} class:short={ag.dir === 'SHORT'}>{ag.dir}</span>
        <span class="cc">{ag.conf}%</span>
      </div>
      {#if i < 4}
        <span class="carrow" class:vis={state.running}>→</span>
      {/if}
    {/each}
    <span class="carrow" class:vis={state.running}>→</span>
    <div class="cscore" class:vis={state.running}>{state.score}</div>
    <div class="cdir" class:vis={state.running} class:long={finalDir === 'LONG'} class:short={finalDir === 'SHORT'}>{finalDir}</div>
  </div>

  <!-- Phase Badge + Feed -->
  {#if state.running}
    <div class="phase-badge" style="background:{phaseLabel.color}">
      {phaseLabel.name}
    </div>
    {#if feed.length > 0}
      <div class="feed-scroll">
        {#each feed.slice(0, 3) as item (item.id)}
          <span class="feed-item" style="color:{item.agentColor}">
            {item.agentIcon} {item.text}
          </span>
        {/each}
      </div>
    {/if}
  {/if}

  <div class="bstats">
    <span>M:{state.matchN}</span>
    <span>W:{state.wins}</span>
    <span>🔥{state.streak}</span>
    <div class="lpm">
      <div class="lpt">
        <div class="lpf" style="width:{Math.min(state.lp / 50, 100)}%"></div>
      </div>
      <span class="lpv">{state.lp.toLocaleString()}</span>
    </div>
  </div>
</div>

<style>
  #bot {
    display: flex;
    align-items: center;
    padding: 0 12px;
    gap: 6px;
    border-top: 1px solid rgba(232, 150, 125, 0.34);
    background:
      radial-gradient(circle at 14% 120%, rgba(232, 150, 125, 0.12), transparent 38%),
      radial-gradient(circle at 86% -20%, rgba(102, 204, 230, 0.08), transparent 36%),
      linear-gradient(90deg, #0b1b13, #0a1711 48%, #09150f);
    z-index: 20;
    overflow: hidden;
    color: #f0ede4;
    box-shadow: 0 -8px 26px rgba(0, 0, 0, .35);
    height: 52px;
    flex-shrink: 0;
  }
  /* Context badges */
  .ctx-badges {
    display: flex;
    align-items: center;
    gap: 3px;
    flex-shrink: 0;
    margin-right: 4px;
  }
  .ctx-badge {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 3px 5px;
    border-radius: 6px;
    border: 1px solid rgba(232, 150, 125, 0.34);
    background: rgba(10, 22, 16, 0.86);
    font-family: var(--fm);
    font-size: 7px;
    font-weight: 900;
    cursor: pointer;
    transition: all .12s;
    box-shadow: none;
    color: #f0ede4;
  }
  .ctx-badge:hover {
    background: rgba(232, 150, 125, 0.16);
    border-color: rgba(232, 150, 125, 0.52);
  }
  .ctx-icon { font-size: 10px; opacity: .88; }
  .ctx-count {
    min-width: 12px;
    height: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    font-size: 7px;
    font-weight: 900;
    color: #07130d;
    padding: 0 2px;
  }
  .ctx-pos .ctx-count { background: #00cc88; }
  .ctx-tracked .ctx-count { background: #dcb970; }

  .chain { display: flex; align-items: center; gap: 3px; flex: 1; overflow: hidden; }
  .cslot {
    display: flex; align-items: center; gap: 3px; padding: 3px 6px; border-radius: 8px;
    background: rgba(9, 20, 14, .86); border: 1px solid rgba(232, 150, 125, .22);
    font-size: 7px; font-family: var(--fm);
    opacity: .5; transition: all .2s; white-space: nowrap; flex-shrink: 0;
  }
  .cslot.vis { opacity: 1; border-color: rgba(232, 150, 125, .44); background: rgba(11, 24, 17, .94); box-shadow: none; }
  .cslot .ci { font-size: 9px; }
  .cslot .cn { font-weight: 900; letter-spacing: .5px; color: #f0ede4; }
  .cslot .cd { font-weight: 900; letter-spacing: .5px; margin-left: 2px; }
  .cd.long { color: #00cc88; } .cd.short { color: #ff5e7a; }
  .cslot .cc { font-size: 6px; color: rgba(240, 237, 228, .74); font-weight: 700; }
  .carrow { color: rgba(240, 237, 228, .45); font-size: 9px; flex-shrink: 0; opacity: .3; transition: all .2s; }
  .carrow.vis { opacity: 1; color: rgba(240, 237, 228, .82); font-weight: 900; }
  .cscore {
    padding: 4px 8px; border-radius: 10px;
    font-family: var(--fd); font-size: 11px; font-weight: 900; letter-spacing: 1px;
    opacity: .3; transition: all .2s; flex-shrink: 0;
  }
  .cscore.vis {
    opacity: 1;
    color: #f0ede4;
    border: 1px solid rgba(232, 150, 125, .42);
    background: rgba(12, 27, 19, .92);
    box-shadow: none;
  }
  .cdir {
    padding: 3px 8px; border-radius: 10px;
    font-family: var(--fd); font-size: 9px; font-weight: 900; letter-spacing: 2px;
    opacity: .3; transition: all .2s; flex-shrink: 0;
  }
  .cdir.vis {
    opacity: 1;
    border: 1px solid rgba(232, 150, 125, .42);
    box-shadow: none;
  }
  .cdir.long.vis { color: #00cc88; background: rgba(0, 204, 136, .12); border-color: rgba(0, 204, 136, .36); }
  .cdir.short.vis { color: #ff5e7a; background: rgba(255, 94, 122, .14); border-color: rgba(255, 94, 122, .34); }
  .bstats {
    display: flex; align-items: center; gap: 6px; margin-left: auto; font-size: 8px;
    font-family: var(--fm); color: rgba(240, 237, 228, .72); flex-shrink: 0; font-weight: 700;
  }
  .bstats span { color: #f0ede4; font-weight: 900; }
  .lpm { display: flex; align-items: center; gap: 4px; }
  .lpt {
    width: 60px; height: 4px; border-radius: 3px;
    background: rgba(7, 15, 11, .9);
    border: 1px solid rgba(232, 150, 125, .3);
  }
  .lpf {
    height: 100%;
    border-radius: 2px;
    background: linear-gradient(90deg, #00cc88, #66cce6);
    transition: width .5s;
  }
  .lpv { font-size: 8px; color: #e8967d; font-family: var(--fm); font-weight: 900; }

  /* Phase Badge */
  .phase-badge {
    padding: 3px 8px; border-radius: 6px;
    font-family: var(--fd); font-size: 7px; font-weight: 900;
    letter-spacing: 1.5px; color: #07130d;
    border: 1px solid rgba(240, 237, 228, .32); box-shadow: none;
    white-space: nowrap; flex-shrink: 0;
    animation: phasePulse 3s ease infinite;
    will-change: opacity;
  }
  @keyframes phasePulse { 0%,100% { opacity: 1; } 50% { opacity: .8; } }

  /* Feed Scroll */
  .feed-scroll {
    display: flex; gap: 8px; overflow: hidden;
    flex: 0 1 auto; min-width: 0;
    mask-image: linear-gradient(90deg, transparent, black 10%, black 90%, transparent);
    -webkit-mask-image: linear-gradient(90deg, transparent, black 10%, black 90%, transparent);
  }
  .feed-item {
    font-family: var(--fm); font-size: 7px; font-weight: 700;
    white-space: nowrap; flex-shrink: 0;
    animation: feedFadeIn .3s ease;
  }
  @keyframes feedFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

  @media (max-width: 980px) {
    #bot {
      height: 50px;
      padding: 0 10px;
      gap: 5px;
    }
    .chain { display: none; }
    .feed-scroll { max-width: 42vw; }
  }

  @media (max-width: 700px) {
    .ctx-badges { gap: 2px; margin-right: 2px; }
    .ctx-badge { padding: 2px 4px; }
    .ctx-icon { font-size: 9px; }
    .bstats { gap: 4px; font-size: 7px; }
    .lpt { width: 46px; }
    .phase-badge { font-size: 6px; letter-spacing: 1px; padding: 2px 6px; }
    .feed-scroll { display: none; }
  }
</style>
