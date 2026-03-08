<script lang="ts">
  interface Props {
    showVsSplash?: boolean;
    showCritical?: boolean;
    criticalText?: string;
    showCombo?: boolean;
    comboCount?: number;
  }

  let {
    showVsSplash = false,
    showCritical = false,
    criticalText = '',
    showCombo = false,
    comboCount = 0,
  }: Props = $props();
</script>

{#if showVsSplash}
  <div class="arena-vs-splash">
    <span class="avs-team long">LONG</span>
    <span class="avs-x">⚔</span>
    <span class="avs-team short">SHORT</span>
  </div>
{/if}

{#if showCritical}
  <div class="arena-critical-popup">{criticalText}</div>
{/if}

{#if showCombo && comboCount >= 2}
  <div class="arena-combo">COMBO x{comboCount}</div>
{/if}

<style>
  .arena-vs-splash {
    position: absolute;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    background: rgba(0,0,0,.85);
    animation: vsSplashIn .4s ease;
  }

  .avs-team {
    font: 900 24px/1 var(--fc);
    letter-spacing: 4px;
    text-shadow: 0 0 20px currentColor;
  }

  .avs-team.long { color: #00ff88; }
  .avs-team.short { color: #ff5e7a; }
  .avs-x { font-size: 28px; animation: vsXPulse .3s ease infinite alternate; }

  @keyframes vsSplashIn {
    from { opacity: 0; transform: scale(1.5); }
    to { opacity: 1; transform: scale(1); }
  }

  @keyframes vsXPulse {
    from { transform: scale(1) rotate(-5deg); }
    to { transform: scale(1.2) rotate(5deg); }
  }

  .arena-critical-popup {
    position: absolute;
    top: 20%;
    left: 50%;
    transform: translateX(-50%);
    z-index: 60;
    pointer-events: none;
    font: 900 18px/1 var(--fc);
    color: #ffcc00;
    letter-spacing: 3px;
    text-shadow: 0 0 16px rgba(255,200,0,.8), 0 4px 8px rgba(0,0,0,.5);
    animation: criticalBoom .8s ease forwards;
  }

  @keyframes criticalBoom {
    0% { opacity: 0; transform: translateX(-50%) scale(2); }
    20% { opacity: 1; transform: translateX(-50%) scale(1); }
    80% { opacity: 1; transform: translateX(-50%) scale(1.05); }
    100% { opacity: 0; transform: translateX(-50%) translateY(-20px) scale(.8); }
  }

  .arena-combo {
    position: absolute;
    top: 32%;
    right: 8%;
    z-index: 55;
    pointer-events: none;
    font: 900 14px/1 var(--fc);
    color: #ff69b4;
    letter-spacing: 2px;
    text-shadow: 0 0 12px rgba(255,105,180,.6);
    animation: comboPopIn .4s ease;
  }

  @keyframes comboPopIn {
    from { opacity: 0; transform: scale(2) rotate(-10deg); }
    to { opacity: 1; transform: scale(1) rotate(0); }
  }
</style>
