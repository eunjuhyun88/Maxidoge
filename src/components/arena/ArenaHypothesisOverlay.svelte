<script lang="ts">
  import HypothesisPanel from './HypothesisPanel.svelte';
  import type { ArenaHypothesisSubmitInput } from '$lib/arena/controllers/arenaPhaseController';

  interface Props {
    hypothesisVisible?: boolean;
    hypothesisTimer?: number;
    onHypothesisSubmit?: (selection: ArenaHypothesisSubmitInput) => void;
    floatDir?: 'LONG' | 'SHORT' | null;
    onSelectFloatDir?: (value: 'LONG' | 'SHORT' | null) => void;
  }

  let {
    hypothesisVisible = false,
    hypothesisTimer = 45,
    onHypothesisSubmit = () => {},
    floatDir = null,
    onSelectFloatDir = () => {},
  }: Props = $props();
</script>

{#if hypothesisVisible}
  <div class="hypo-sidebar">
    <HypothesisPanel timeLeft={hypothesisTimer} onsubmit={onHypothesisSubmit} />
  </div>

  <div class="dir-float-bar">
    <button class="dfb-btn long" class:sel={floatDir === 'LONG'} onclick={() => onSelectFloatDir('LONG')}>
      ▲ LONG
    </button>
    <div class="dfb-divider"></div>
    <button class="dfb-btn short" class:sel={floatDir === 'SHORT'} onclick={() => onSelectFloatDir('SHORT')}>
      ▼ SHORT
    </button>
  </div>
{/if}

<style>
  .hypo-sidebar {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 50px;
    z-index: 30;
    overflow-y: auto;
    animation: hypoSlideIn .3s ease;
    filter: drop-shadow(-4px 0 20px rgba(0,0,0,.3));
  }
  @keyframes hypoSlideIn {
    from { opacity: 0; transform: translateX(20px); }
    to { opacity: 1; transform: translateX(0); }
  }

  .dir-float-bar {
    position: absolute;
    bottom: 55px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 25;
    display: flex;
    align-items: center;
    gap: 0;
    background: #fff;
    border: 3px solid #000;
    border-radius: 20px;
    box-shadow: 4px 4px 0 #000;
    overflow: hidden;
    animation: floatBarIn .3s ease;
  }
  @keyframes floatBarIn {
    from { opacity: 0; transform: translateX(-50%) translateY(20px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
  .dfb-btn {
    padding: 10px 28px;
    border: none;
    font-family: var(--fd);
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 2px;
    cursor: pointer;
    transition: all .15s;
    background: #fafafa;
    color: #888;
  }
  .dfb-btn.long:hover { background: #e8fff0; color: #00aa44; }
  .dfb-btn.short:hover { background: #ffe8ec; color: #cc0033; }
  .dfb-btn.long.sel { background: #00ff88; color: #000; }
  .dfb-btn.short.sel { background: #ff2d55; color: #fff; }
  .dfb-divider { width: 2px; height: 28px; background: #000; }

  @keyframes hypoSlideUp { from { opacity: 0; transform: translateY(100%); } to { opacity: 1; transform: translateY(0); } }

  @media (max-width: 768px) {
    .hypo-sidebar {
      position: fixed;
      top: auto;
      right: 0;
      bottom: 0;
      left: 0;
      max-height: 55vh;
      z-index: 60;
      border-radius: 16px 16px 0 0;
      background: rgba(7, 19, 13, 0.97);
      border-top: 2px solid rgba(232, 150, 125, 0.35);
      box-shadow: 0 -8px 40px rgba(0, 0, 0, 0.6);
      animation: hypoSlideUp 0.3s ease;
      filter: none;
    }
    .hypo-sidebar::before {
      content: '';
      display: block;
      width: 36px;
      height: 4px;
      background: rgba(255, 255, 255, 0.25);
      border-radius: 2px;
      margin: 10px auto 4px;
      flex-shrink: 0;
    }
    .dir-float-bar { position: fixed; bottom: calc(55vh + 8px); left: 50%; transform: translateX(-50%); z-index: 61; }
  }
</style>
