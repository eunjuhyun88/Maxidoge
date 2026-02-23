<script lang="ts">
  export let phaseName = 'ANALYSIS';
  export let timer = 0;
  export let score = 50;
  export let streak = 0;
  export let lp = 0;
  export let mode = 'PVE';
  export let phaseProgress = 0;

  $: safeProgress = Math.max(0, Math.min(1, phaseProgress));
  $: scoreSafe = Math.max(0, Math.min(100, Math.round(score)));
  $: dash = `${Math.round(safeProgress * 220)} 220`;
  $: timerText = timer > 0 ? `${Math.ceil(timer)}s` : '--';
  $: biasLabel = scoreSafe >= 60 ? 'LONG BIAS' : 'SHORT BIAS';
  $: biasColor = scoreSafe >= 60 ? '#1fff9f' : '#ff637a';
</script>

<section class="arena-hud" aria-label="Arena HUD">
  <div class="hud-left">
    <div class="hud-phase">{phaseName}</div>
    <div class="hud-mode">{mode} MODE</div>
  </div>

  <div class="hud-ring">
    <svg viewBox="0 0 76 76" aria-hidden="true">
      <circle cx="38" cy="38" r="35" />
      <circle class="progress" cx="38" cy="38" r="35" stroke-dasharray={dash} />
    </svg>
    <div class="hud-time">{timerText}</div>
  </div>

  <div class="hud-right">
    <div class="hud-score">{scoreSafe}</div>
    <div class="hud-bias" style="color:{biasColor}">{biasLabel}</div>
    <div class="hud-meta">🔥 {streak} · ⚡ {lp}</div>
  </div>
</section>

<style>
  .arena-hud {
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 22;
    display: grid;
    grid-template-columns: auto auto auto;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 14px;
    border: 1px solid rgba(134, 221, 255, 0.45);
    background:
      linear-gradient(140deg, rgba(7, 14, 36, 0.9), rgba(6, 10, 24, 0.78)),
      radial-gradient(circle at 80% 0%, rgba(255, 106, 152, 0.2), transparent 52%);
    box-shadow:
      inset 0 1px 0 rgba(167, 229, 255, 0.32),
      0 12px 30px rgba(0, 0, 0, 0.35);
    backdrop-filter: blur(8px);
  }

  .hud-left {
    display: grid;
    gap: 2px;
    min-width: 86px;
  }

  .hud-phase {
    font: 900 10px/1 var(--fd);
    letter-spacing: 2px;
    color: #e8f8ff;
    text-transform: uppercase;
  }

  .hud-mode {
    font: 700 8px/1 var(--fm);
    letter-spacing: 1px;
    color: rgba(160, 204, 255, 0.85);
  }

  .hud-ring {
    width: 44px;
    height: 44px;
    position: relative;
  }

  .hud-ring svg {
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
  }

  .hud-ring circle {
    fill: none;
    stroke: rgba(146, 194, 255, 0.2);
    stroke-width: 4;
    stroke-linecap: round;
  }

  .hud-ring circle.progress {
    stroke: #63d8ff;
    filter: drop-shadow(0 0 6px rgba(99, 216, 255, 0.6));
    transition: stroke-dasharray 0.35s ease;
  }

  .hud-time {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font: 800 10px/1 var(--fm);
    color: #eaf6ff;
    letter-spacing: .3px;
  }

  .hud-right {
    display: grid;
    gap: 1px;
    min-width: 82px;
    text-align: right;
  }

  .hud-score {
    font: 900 16px/1 var(--fc);
    letter-spacing: 1px;
    color: #ffffff;
    text-shadow: 0 0 16px rgba(94, 211, 255, 0.55);
  }

  .hud-bias {
    font: 800 8px/1 var(--fd);
    letter-spacing: 1.4px;
    text-transform: uppercase;
  }

  .hud-meta {
    font: 700 8px/1 var(--fm);
    color: rgba(184, 213, 255, 0.8);
  }

  @media (max-width: 900px) {
    .arena-hud {
      top: 8px;
      left: 8px;
      gap: 8px;
      padding: 7px 8px;
    }

    .hud-left {
      min-width: 72px;
    }

    .hud-phase {
      font-size: 9px;
      letter-spacing: 1.4px;
    }

    .hud-score {
      font-size: 14px;
    }
  }

  @media (max-width: 640px) {
    .arena-hud {
      grid-template-columns: auto auto;
      grid-template-areas:
        "left ring"
        "right right";
    }

    .hud-left {
      grid-area: left;
    }

    .hud-ring {
      grid-area: ring;
      justify-self: end;
    }

    .hud-right {
      grid-area: right;
      text-align: left;
    }
  }
</style>
