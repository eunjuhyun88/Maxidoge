<script lang="ts">
  import { AGDEFS } from '$lib/data/agents';
  import { gameState } from '$lib/stores/gameState';
  import { sfx } from '$lib/audio/sfx';
  import { startMatch as engineStartMatch, resetPhaseInit } from '$lib/engine/gameLoop';
  import { PHASE_DURATION } from '$lib/engine/phases';
  import TokenDropdown from '../shared/TokenDropdown.svelte';

  let selected: Set<string> = new Set(['structure', 'flow', 'deriv', 'senti', 'guardian']);
  let speed = 3;
  let pair = 'BTC/USDT';

  function toggleAgent(id: string) {
    if (selected.has(id)) {
      if (selected.size <= 3) return; // minimum 3
      selected.delete(id);
    } else {
      if (selected.size >= 5) return; // maximum 5
      selected.add(id);
    }
    selected = new Set(selected);
  }

  function teamPower(): number {
    let total = 0;
    for (const id of selected) {
      const ag = AGDEFS.find(a => a.id === id);
      if (ag) total += ag.conf;
    }
    return Math.round(total / selected.size);
  }

  function startMatch() {
    if (selected.size < 3 || selected.size > 5) return;
    sfx.enter();

    // Set lobby state first (agents, pair, speed)
    gameState.update(s => ({
      ...s,
      inLobby: false,
      selectedAgents: [...selected],
      speed,
      pair
    }));

    // Use engine to properly start game loop + set phase/timer
    resetPhaseInit();
    engineStartMatch();
  }
</script>

<div class="lobby">
  <div class="sunburst-bg"></div>
  <div class="halftone-overlay"></div>

  <div class="lobby-content">
    <h1 class="lobby-title">
      <span class="doge-emoji">🐕</span>
      MAXI<span class="accent">⚡</span>DOGE ARENA
      <span class="doge-emoji">🐕</span>
    </h1>
    <p class="lobby-subtitle">PICK YOUR SQUAD. FIGHT!</p>

    <!-- Agent Selection Grid -->
    <div class="agent-grid">
      {#each AGDEFS as ag}
        <button
          class="agent-card"
          class:selected={selected.has(ag.id)}
          style="--agent-color:{ag.color}"
          on:click={() => toggleAgent(ag.id)}
        >
          {#if selected.has(ag.id)}
            <div class="check-badge">✓</div>
          {/if}
          <div class="agent-avatar" style="border-color:{ag.color}">
            <span class="agent-icon-big">{ag.icon}</span>
          </div>
          <div class="agent-name">{ag.name}</div>
          <div class="agent-role">{ag.nameKR}</div>
          <div class="agent-level">Lv.1</div>
        </button>
      {/each}
    </div>

    <div class="lobby-info">SELECTED: {selected.size}/5</div>
    <div class="team-power">
      <span class="tp-label">TEAM POWER:</span>
      <div class="tp-bar">
        <div class="tp-fill" style="width:{teamPower()}%"></div>
      </div>
      <span class="tp-val">{teamPower()}</span>
    </div>

    <!-- Settings -->
    <div class="lobby-settings">
      <div class="setting-group">
        <span class="set-label">PAIR</span>
        <TokenDropdown value={pair} on:select={e => pair = e.detail.pair} />
      </div>
      <div class="setting-group">
        <span class="set-label">SPEED</span>
        <div class="speed-btns">
          {#each [1, 2, 3] as s}
            <button
              class="speed-btn"
              class:active={speed === s}
              on:click={() => speed = s}
            >{s}x</button>
          {/each}
        </div>
      </div>
    </div>

    <div class="lobby-stats">
      <span>LP: <b>{$gameState.lp.toLocaleString()}</b></span>
      <span>| W/L: <b>{$gameState.wins}-{$gameState.losses}</b></span>
      <span>| 🔥 {$gameState.streak > 0 ? $gameState.streak : '-'}</span>
    </div>

    <button class="start-btn" on:click={startMatch}>
      🚀 START MATCH!! 🚀
    </button>

    <div class="lobby-opponent">
      vs 🤖 OPPONENT: <b>Random Arena Bot</b>
    </div>
    <div class="lobby-motto">"IN GAINS WE TRUST" 🔱</div>
  </div>
</div>

<style>
  .lobby {
    position: absolute;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #ffe600;
    background-image: repeating-conic-gradient(#ffcc00 0deg 10deg, #ffe600 10deg 20deg);
    overflow: hidden;
  }
  .sunburst-bg {
    position: absolute; inset: -50%; z-index: 0; pointer-events: none;
    background: repeating-conic-gradient(transparent 0deg 8deg, rgba(255,180,0,.12) 8deg 16deg);
    animation: spin 60s linear infinite;
  }
  @keyframes spin { from { transform: rotate(0) } to { transform: rotate(360deg) } }
  .halftone-overlay {
    position: absolute; inset: 0; z-index: 1; pointer-events: none;
    background-image: radial-gradient(circle, rgba(0,0,0,.04) 1px, transparent 1px);
    background-size: 8px 8px;
  }
  .lobby-content {
    position: relative;
    z-index: 10;
    text-align: center;
    max-width: 800px;
    width: 100%;
    padding: 20px;
  }
  .lobby-title {
    font-family: var(--fc);
    font-size: 42px;
    color: #000;
    -webkit-text-stroke: 2px #000;
    text-shadow: 4px 4px 0 rgba(0,0,0,.2);
    letter-spacing: 3px;
    margin-bottom: 4px;
  }
  .accent { color: var(--pk); }
  .doge-emoji { font-size: 36px; -webkit-text-stroke: 0; }
  .lobby-subtitle {
    font-family: var(--fc);
    font-size: 18px;
    color: #333;
    letter-spacing: 3px;
    margin-bottom: 20px;
  }

  /* Agent Grid */
  .agent-grid {
    display: flex;
    gap: 8px;
    justify-content: center;
    flex-wrap: wrap;
    margin-bottom: 16px;
  }
  .agent-card {
    width: 90px;
    padding: 10px 6px 8px;
    background: #fff;
    border: 3px solid #000;
    border-radius: 12px;
    box-shadow: 3px 3px 0 #000;
    cursor: pointer;
    transition: all .2s;
    position: relative;
    text-align: center;
  }
  .agent-card:hover { transform: translateY(-2px); box-shadow: 4px 5px 0 #000; }
  .agent-card.selected {
    border-color: var(--agent-color);
    background: linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,200,200,.2) 100%);
    box-shadow: 0 0 0 3px var(--agent-color), 3px 3px 0 #000;
  }
  .check-badge {
    position: absolute; top: -6px; right: -6px;
    width: 20px; height: 20px;
    background: var(--agent-color);
    border: 2px solid #000;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 900; color: #fff;
    box-shadow: 2px 2px 0 #000;
  }
  .agent-avatar {
    width: 50px; height: 50px;
    border-radius: 12px;
    border: 3px solid;
    margin: 0 auto 4px;
    display: flex; align-items: center; justify-content: center;
    background: rgba(0,0,0,.03);
    box-shadow: 2px 2px 0 rgba(0,0,0,.15);
  }
  .agent-icon-big { font-size: 24px; }
  .agent-name { font-family: var(--fm); font-size: 8px; font-weight: 900; letter-spacing: 1px; color: #000; }
  .agent-role { font-family: var(--fm); font-size: 6px; color: #666; }
  .agent-level { font-family: var(--fm); font-size: 7px; color: var(--agent-color); font-weight: 700; }

  /* Info */
  .lobby-info { font-family: var(--fc); font-size: 16px; color: #000; letter-spacing: 2px; margin-bottom: 6px; }
  .team-power {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    font-family: var(--fm); font-size: 9px; font-weight: 900; color: #000;
    margin-bottom: 12px;
  }
  .tp-bar { width: 120px; height: 8px; background: #ddd; border: 2px solid #000; border-radius: 4px; overflow: hidden; }
  .tp-fill { height: 100%; background: linear-gradient(90deg, #ff2d9b, #ffe600); transition: width .3s; border-radius: 2px; }

  /* Settings */
  .lobby-settings {
    display: flex; gap: 16px; justify-content: center; margin-bottom: 10px;
  }
  .setting-group { display: flex; align-items: center; gap: 6px; }
  .set-label { font-family: var(--fm); font-size: 9px; font-weight: 900; color: #000; }
  /* Token dropdown styled via :global(.lobby) rules in TokenDropdown */
  .speed-btns { display: flex; gap: 3px; }
  .speed-btn {
    font-family: var(--fm); font-size: 9px; font-weight: 900;
    width: 28px; height: 24px;
    border: 2px solid #000; border-radius: 6px;
    background: #fff; cursor: pointer; transition: all .15s;
    box-shadow: 2px 2px 0 #000;
  }
  .speed-btn.active { background: var(--pk); color: #fff; }

  .lobby-stats {
    font-family: var(--fm); font-size: 10px; color: #333;
    margin-bottom: 14px;
  }
  .lobby-stats b { color: #000; }

  /* Start Button */
  .start-btn {
    font-family: var(--fc);
    font-size: 28px;
    letter-spacing: 3px;
    color: #fff;
    background: linear-gradient(180deg, #ff2d9b, #ff0066);
    border: 4px solid #000;
    border-radius: 30px;
    padding: 12px 60px;
    cursor: pointer;
    box-shadow: 4px 4px 0 #000;
    transition: all .2s;
    -webkit-text-stroke: 1px #000;
    text-shadow: 2px 2px 0 rgba(0,0,0,.3);
  }
  .start-btn:hover {
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0 #000;
    background: linear-gradient(180deg, #ff3dab, #ff1177);
  }
  .start-btn:active {
    transform: translate(2px, 2px);
    box-shadow: 1px 1px 0 #000;
  }

  .lobby-opponent {
    font-family: var(--fm); font-size: 9px; color: #555; margin-top: 12px;
  }
  .lobby-motto {
    font-family: var(--fcomic); font-size: 10px; color: #888; margin-top: 4px; font-style: italic;
  }
</style>
