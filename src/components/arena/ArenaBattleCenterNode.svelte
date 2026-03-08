<script lang="ts">
  import type { ArenaBattleHudDisplay } from '$lib/arena/state/arenaTypes';

  interface Props {
    battleHudDisplay?: ArenaBattleHudDisplay;
  }

  let {
    battleHudDisplay = {
      enemyHpAccent: '#ff2d55',
      enemyHpLabel: '100',
      narration: '에이전트 대기 중...',
      priceLabel: '--',
    },
  }: Props = $props();
</script>

<div class="arena-center-node">
  <div class="acn-icon">⚔</div>
  <div class="acn-price">{battleHudDisplay.priceLabel}</div>
</div>

<style>
  .arena-center-node {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    z-index: 5;
    text-align: center;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    border: 2px solid rgba(255,105,180,.3);
    background: rgba(10,10,20,.8);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 20px rgba(255,105,180,.15);
    animation: centerPulse 2s ease-in-out infinite alternate;
  }

  @keyframes centerPulse {
    from { box-shadow: 0 0 12px rgba(255,105,180,.1); }
    to { box-shadow: 0 0 28px rgba(255,105,180,.25); }
  }

  .acn-icon { font-size: 16px; }

  .acn-price {
    font: 800 7px/1 var(--fd);
    color: rgba(255,255,255,.5);
    letter-spacing: 0.5px;
  }
</style>
