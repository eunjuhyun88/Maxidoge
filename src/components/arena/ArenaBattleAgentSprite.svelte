<script lang="ts">
  import type { AgentDef } from '$lib/data/agents';
  import type { CharSpriteState } from '$lib/engine/arenaCharacters';

  interface Props {
    agent: AgentDef;
    sprite?: CharSpriteState;
    isActiveTurn?: boolean;
    voteDir?: string | null;
    delayIndex?: number;
  }

  const defaultSprite: CharSpriteState = {
    charState: 'idle',
    x: 50,
    y: 50,
    targetX: 50,
    targetY: 50,
    actionEmoji: '',
    actionLabel: '',
    flipX: false,
    hp: 100,
    energy: 0,
    showHit: false,
    hitText: '',
    hitColor: '',
  };

  let {
    agent,
    sprite = defaultSprite,
    isActiveTurn = false,
    voteDir = null,
    delayIndex = 0,
  }: Props = $props();
</script>

<div
  class="char-sprite cs-{sprite.charState}"
  class:active-turn={isActiveTurn}
  style="left:{sprite.x}%;top:{sprite.y}%;--ag-color:{agent.color};--ag-delay:{delayIndex * 0.15}s;{sprite.flipX ? 'transform:translate(-50%,-50%) scaleX(-1)' : ''}"
>
  {#if sprite.actionEmoji}
    <div class="char-action-popup">
      <span class="cap-emoji">{sprite.actionEmoji}</span>
      <span class="cap-label">{sprite.actionLabel}</span>
    </div>
  {/if}

  {#if sprite.showHit}
    <div class="char-hit-fly" style="color:{sprite.hitColor}">{sprite.hitText}</div>
  {/if}

  <div class="char-body">
    {#if isActiveTurn}
      <div class="char-turn-ring"></div>
    {/if}
    <div class="char-img-wrap" style="border-color:{agent.color}">
      {#if agent.img.def}
        <img src={agent.img.def} alt={agent.name} class="char-img" />
      {:else}
        <span class="char-emoji">{agent.icon}</span>
      {/if}
    </div>
    <div class="char-aura" style="--aura-color:{agent.color};opacity:{sprite.energy > 50 ? 0.3 : 0.1}"></div>
  </div>

  <div class="char-nametag" style="border-color:{agent.color}">{agent.name}</div>

  <div class="char-bars">
    <div class="char-hpbar">
      <div class="char-hpfill" style="width:{sprite.hp}%;background:{sprite.hp > 50 ? '#00ff88' : sprite.hp > 25 ? '#ffaa00' : '#ff2d55'}"></div>
    </div>
    <div class="char-ebar">
      <div class="char-efill" style="width:{sprite.energy}%;background:{agent.color}"></div>
    </div>
  </div>

  {#if voteDir}
    <div class="char-vote-badge {voteDir.toLowerCase()}">
      {voteDir === 'LONG' ? '▲' : '▼'}
    </div>
  {/if}
</div>

<style>
  .char-sprite {
    position: absolute;
    z-index: 10;
    transform: translate(-50%, -50%);
    transition: left .6s cubic-bezier(.4,0,.2,1), top .6s cubic-bezier(.4,0,.2,1);
    cursor: pointer;
    text-align: center;
  }

  .char-body {
    position: relative;
    display: inline-flex;
    flex-direction: column;
    align-items: center;
  }

  .char-img-wrap {
    width: 52px;
    height: 52px;
    border-radius: 14px;
    border: 3px solid;
    overflow: hidden;
    background: #fff;
    box-shadow: 3px 3px 0 rgba(0,0,0,.5);
    transition: all .15s;
  }

  .char-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 11px;
    filter: hue-rotate(330deg) saturate(1.2);
  }

  .char-emoji {
    font-size: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }

  .char-aura {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: radial-gradient(circle, var(--aura-color) 0%, transparent 70%);
    z-index: -1;
    pointer-events: none;
    animation: charAuraPulse 1.5s ease-in-out infinite;
  }

  @keyframes charAuraPulse {
    0%,100% { transform: translate(-50%,-50%) scale(1); opacity: .15; }
    50% { transform: translate(-50%,-50%) scale(1.3); opacity: .3; }
  }

  .char-turn-ring {
    position: absolute;
    inset: -6px;
    border-radius: 18px;
    border: 2px solid var(--ag-color, #ff69b4);
    animation: turnRingSpin 1s linear infinite;
    box-shadow: 0 0 12px var(--ag-color, #ff69b4);
  }

  @keyframes turnRingSpin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .char-nametag {
    margin-top: 3px;
    font: 900 7px/1 var(--fd);
    letter-spacing: 1.5px;
    background: rgba(0,0,0,.7);
    color: #fff;
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid;
    white-space: nowrap;
  }

  .char-bars {
    display: flex;
    flex-direction: column;
    gap: 1px;
    margin-top: 2px;
    width: 42px;
  }

  .char-hpbar {
    height: 4px;
    background: rgba(255,255,255,.1);
    border-radius: 2px;
    overflow: hidden;
    border: 1px solid rgba(255,255,255,.15);
  }

  .char-hpfill { height: 100%; border-radius: 2px; transition: width .5s; }

  .char-ebar {
    height: 3px;
    background: rgba(255,255,255,.08);
    border-radius: 2px;
    overflow: hidden;
  }

  .char-efill { height: 100%; border-radius: 2px; transition: width .3s; }

  .char-vote-badge {
    position: absolute;
    top: -4px;
    right: -8px;
    font: 900 8px/1 var(--fd);
    padding: 2px 4px;
    border-radius: 4px;
    border: 1px solid #000;
    z-index: 15;
  }

  .char-vote-badge.long { background: #00ff88; color: #000; }
  .char-vote-badge.short { background: #ff2d55; color: #fff; }

  .char-action-popup {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    animation: actionPopIn .3s ease;
    z-index: 20;
    pointer-events: none;
  }

  @keyframes actionPopIn {
    from { opacity: 0; transform: translateX(-50%) translateY(8px) scale(.7); }
    to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
  }

  .cap-emoji { font-size: 20px; filter: drop-shadow(0 0 8px rgba(255,200,0,.6)); }

  .cap-label {
    font: 900 8px/1 var(--fd);
    letter-spacing: 1px;
    color: #ffcc00;
    background: rgba(0,0,0,.7);
    padding: 2px 6px;
    border-radius: 4px;
    white-space: nowrap;
  }

  .char-hit-fly {
    position: absolute;
    top: -20px;
    left: 50%;
    transform: translateX(-50%);
    font: 900 14px/1 var(--fd);
    letter-spacing: 2px;
    text-shadow: 0 2px 6px rgba(0,0,0,.7);
    animation: hitFlyUp 1.2s ease-out forwards;
    z-index: 25;
    pointer-events: none;
    white-space: nowrap;
  }

  @keyframes hitFlyUp {
    0% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
    100% { opacity: 0; transform: translateX(-50%) translateY(-40px) scale(1.3); }
  }

  .cs-idle .char-body { animation: csIdle 1.4s ease-in-out infinite; animation-delay: var(--ag-delay, 0s); }

  @keyframes csIdle {
    0%,100% { transform: translateY(0); }
    50% { transform: translateY(-4px); }
  }

  .cs-patrol .char-body { animation: csPatrol .4s ease-in-out infinite; }

  @keyframes csPatrol {
    0%,100% { transform: translateY(0) rotate(0); }
    25% { transform: translateY(-5px) rotate(-2deg); }
    75% { transform: translateY(-3px) rotate(2deg); }
  }

  .cs-lock .char-body { animation: csLock .6s ease infinite; }
  .cs-lock .char-img-wrap { box-shadow: 0 0 16px var(--ag-color, #ff69b4) !important; }

  @keyframes csLock {
    0%,100% { transform: scale(1); }
    50% { transform: scale(1.04); }
  }

  .cs-windup .char-body { animation: csWindup .08s linear infinite; }
  .cs-windup .char-img-wrap { box-shadow: 0 0 22px var(--ag-color, #ffcc00) !important; }

  @keyframes csWindup {
    0% { transform: translate(-2px, 1px); }
    25% { transform: translate(2px, -1px); }
    50% { transform: translate(-1px, -2px); }
    75% { transform: translate(1px, 2px); }
  }

  .cs-cast .char-body { animation: csCast .4s ease; }
  .cs-cast .char-img-wrap { box-shadow: 0 0 28px var(--ag-color, #ff5e7a) !important; border-color: #fff !important; }

  @keyframes csCast {
    0% { transform: scale(1); }
    30% { transform: scale(1.15) translateY(-8px); }
    60% { transform: scale(1.1) translateY(-4px); }
    100% { transform: scale(1); }
  }

  .cs-impact .char-body { animation: csImpact .3s ease; }

  @keyframes csImpact {
    0% { transform: scale(1.2); filter: brightness(2); }
    50% { transform: scale(0.95); filter: brightness(1.5); }
    100% { transform: scale(1); filter: brightness(1); }
  }

  .cs-recover .char-body { animation: csRecover .4s ease; }

  @keyframes csRecover {
    0% { transform: scale(.9); opacity: .7; }
    100% { transform: scale(1); opacity: 1; }
  }

  .cs-celebrate .char-body { animation: csCelebrate .4s ease-in-out infinite; }

  @keyframes csCelebrate {
    0%,100% { transform: translateY(0) rotate(0) scale(1); }
    25% { transform: translateY(-14px) rotate(-5deg) scale(1.08); }
    75% { transform: translateY(-6px) rotate(3deg) scale(1.04); }
  }

  .cs-panic .char-body { animation: csPanic .2s ease infinite; }
  .cs-panic .char-img-wrap { filter: saturate(.4) brightness(.7); }

  @keyframes csPanic {
    0%,100% { transform: translateX(0) rotate(0); }
    25% { transform: translateX(-3px) rotate(-3deg); }
    75% { transform: translateX(3px) rotate(3deg); }
  }
</style>
