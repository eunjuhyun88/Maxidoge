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
  $: phaseLabel = PHASE_LABELS[state.phase] || PHASE_LABELS.standby;
  $: openPos = $openTradeCount;
  $: trackedSigs = $activeSignalCount;
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
    <div class="cdir" class:vis={state.running}>LONG</div>
  </div>

  <!-- Phase Badge + Feed -->
  {#if state.running}
    <div class="phase-badge" style="background:{phaseLabel.color}">
      {phaseLabel.emoji} {phaseLabel.name}
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
    padding: 0 14px;
    gap: 6px;
    border-top: 4px solid #000;
    background: linear-gradient(90deg, #ffe600, #ffcc00);
    z-index: 20;
    overflow: hidden;
    color: #000;
    box-shadow: 0 -3px 0 rgba(0,0,0,.2);
    height: 54px;
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
    border: 2px solid #000;
    background: #fff;
    font-family: var(--fm);
    font-size: 7px;
    font-weight: 900;
    cursor: pointer;
    transition: all .12s;
    box-shadow: 1px 1px 0 #000;
    color: #000;
  }
  .ctx-badge:hover {
    transform: translate(-1px, -1px);
    box-shadow: 2px 2px 0 #000;
  }
  .ctx-icon { font-size: 10px; }
  .ctx-count {
    min-width: 12px;
    height: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    font-size: 7px;
    font-weight: 900;
    color: #fff;
    padding: 0 2px;
  }
  .ctx-pos .ctx-count { background: #00aa44; }
  .ctx-tracked .ctx-count { background: #ff8c3b; }

  .chain { display: flex; align-items: center; gap: 3px; flex: 1; overflow: hidden; }
  .cslot {
    display: flex; align-items: center; gap: 3px; padding: 3px 6px; border-radius: 8px;
    background: rgba(255,255,255,.4); border: 2px solid rgba(0,0,0,.1);
    font-size: 7px; font-family: var(--fm);
    opacity: .4; transition: all .2s; white-space: nowrap; flex-shrink: 0;
  }
  .cslot.vis { opacity: 1; border-color: #000; background: #fff; box-shadow: 2px 2px 0 #000; }
  .cslot .ci { font-size: 9px; }
  .cslot .cn { font-weight: 900; letter-spacing: .5px; color: #000; }
  .cslot .cd { font-weight: 900; letter-spacing: .5px; margin-left: 2px; }
  .cd.long { color: #00aa44; } .cd.short { color: #cc0033; }
  .cslot .cc { font-size: 6px; color: #555; font-weight: 700; }
  .carrow { color: #aaa; font-size: 9px; flex-shrink: 0; opacity: .3; transition: all .2s; }
  .carrow.vis { opacity: 1; color: #000; font-weight: 900; }
  .cscore {
    padding: 4px 8px; border-radius: 10px;
    font-family: var(--fd); font-size: 11px; font-weight: 900; letter-spacing: 1px;
    opacity: .3; transition: all .2s; flex-shrink: 0;
  }
  .cscore.vis { opacity: 1; border: 2px solid #000; box-shadow: 2px 2px 0 #000; }
  .cdir {
    padding: 3px 8px; border-radius: 10px;
    font-family: var(--fd); font-size: 9px; font-weight: 900; letter-spacing: 2px;
    opacity: .3; transition: all .2s; flex-shrink: 0;
  }
  .cdir.vis { opacity: 1; border: 2px solid #000; box-shadow: 2px 2px 0 #000; }
  .bstats { display: flex; align-items: center; gap: 6px; margin-left: auto; font-size: 8px; font-family: var(--fm); color: #555; flex-shrink: 0; font-weight: 700; }
  .bstats span { color: #000; font-weight: 900; }
  .lpm { display: flex; align-items: center; gap: 4px; }
  .lpt { width: 60px; height: 4px; border-radius: 3px; background: rgba(0,0,0,.1); border: 1px solid #000; }
  .lpf { height: 100%; border-radius: 2px; background: linear-gradient(90deg, #ff2d9b, #ff2d55); transition: width .5s; }
  .lpv { font-size: 8px; color: #000; font-family: var(--fm); font-weight: 900; }

  /* Phase Badge */
  .phase-badge {
    padding: 3px 8px; border-radius: 6px;
    font-family: var(--fd); font-size: 7px; font-weight: 900;
    letter-spacing: 1.5px; color: #fff;
    border: 2px solid #000; box-shadow: 2px 2px 0 #000;
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
</style>
