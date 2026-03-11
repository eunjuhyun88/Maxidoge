<script lang="ts">
  import type { ArenaBattleHudDisplay } from '$lib/arena/state/arenaTypes';

  interface Props {
    vsMeter?: number;
    enemyHp?: number;
    battleHudDisplay?: ArenaBattleHudDisplay;
  }

  let {
    vsMeter = 50,
    enemyHp = 100,
    battleHudDisplay = { enemyHpAccent: '#ff2d55', enemyHpLabel: '100', narration: '에이전트 대기 중...', priceLabel: '--' },
  }: Props = $props();
</script>

<div class="combat-hud">
  <div class="hud-vs">
    <span class="hud-side long-side">LONG</span>
    <div class="hud-vs-track">
      <div class="hud-vs-fill" style="width:{vsMeter}%"></div>
      <div class="hud-vs-pip" style="left:{vsMeter}%">⚡</div>
    </div>
    <span class="hud-side short-side">SHORT</span>
  </div>
  <div class="hud-enemy">
    <span class="hud-enemy-label">MARKET</span>
    <div class="hud-hp-track">
      <div class="hud-hp-fill" style="width:{enemyHp}%;background:linear-gradient(90deg,#ff5e7a,{battleHudDisplay.enemyHpAccent})"></div>
    </div>
    <span class="hud-hp-num">{battleHudDisplay.enemyHpLabel}</span>
  </div>
  <div class="hud-price">{battleHudDisplay.priceLabel}</div>
</div>

<style>
  .combat-hud {
    padding: 6px 10px;
    border-bottom: 1px solid rgba(255,105,180,.15);
    background: rgba(0,0,0,.3);
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .hud-vs { display: flex; align-items: center; gap: 6px; }
  .hud-side {
    font: 900 9px/1 var(--fd);
    letter-spacing: 2px;
    width: 42px;
    text-align: center;
    text-shadow: 0 0 8px currentColor;
  }
  .hud-side.long-side { color: #00ff88; }
  .hud-side.short-side { color: #ff5e7a; }
  .hud-vs-track {
    flex: 1;
    height: 8px;
    background: rgba(255,94,122,.15);
    border-radius: 4px;
    position: relative;
    overflow: visible;
    border: 1px solid rgba(255,105,180,.2);
  }
  .hud-vs-fill {
    height: 100%;
    background: linear-gradient(90deg, #00ff88, #00cc66);
    border-radius: 4px 0 0 4px;
    transition: width .5s cubic-bezier(.4,0,.2,1);
  }
  .hud-vs-pip {
    position: absolute;
    top: 50%;
    transform: translate(-50%,-50%);
    font-size: 9px;
    filter: drop-shadow(0 0 4px rgba(255,200,0,.6));
    transition: left .5s cubic-bezier(.4,0,.2,1);
    z-index: 2;
  }
  .hud-enemy { display: flex; align-items: center; gap: 6px; }
  .hud-enemy-label { font: 800 6px/1 var(--fd); letter-spacing: 1.5px; color: #ff5e7a; width: 36px; }
  .hud-hp-track {
    flex: 1;
    height: 6px;
    background: rgba(255,94,122,.1);
    border-radius: 3px;
    overflow: hidden;
    border: 1px solid rgba(255,94,122,.2);
  }
  .hud-hp-fill { height: 100%; border-radius: 3px; transition: width .5s ease; }
  .hud-hp-num { font: 800 8px/1 var(--fd); color: #ff5e7a; width: 24px; text-align: right; }
  .hud-price { font: 900 10px/1 var(--fd); color: rgba(255,255,255,.5); text-align: center; letter-spacing: 1px; flex-shrink: 0; }
</style>
