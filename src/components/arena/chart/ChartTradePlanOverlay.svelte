<script lang="ts">
  import { onDestroy } from 'svelte';
  import { formatPrice } from '$lib/chart/chartCoordinates';
  import { getPlannedTradeOrder } from '$lib/chart/chartTradePlanner';
  import type { TradePlanDraft } from '$lib/chart/chartTypes';

  interface Props {
    pendingTradePlan: TradePlanDraft | null;
    onCancel?: () => void;
    onOpen?: () => void;
    onSetRatio?: (nextLongRatio: number) => void;
    onRatioPointerDown?: (event: PointerEvent) => void;
    onRatioTrackReady?: (element: HTMLButtonElement | null) => void;
  }

  let {
    pendingTradePlan,
    onCancel = () => {},
    onOpen = () => {},
    onSetRatio = () => {},
    onRatioPointerDown = () => {},
    onRatioTrackReady = () => {},
  }: Props = $props();

  let ratioTrackEl: HTMLButtonElement | null = $state(null);

  $effect(() => {
    onRatioTrackReady(ratioTrackEl);
  });

  onDestroy(() => {
    onRatioTrackReady(null);
  });
</script>

{#if pendingTradePlan}
  {@const planned = getPlannedTradeOrder(pendingTradePlan)}
  <div class="trade-plan-overlay">
    <div class="trade-plan-header">
      <span class="plan-title">TRADE PLANNER</span>
      <button type="button" class="plan-close" onclick={onCancel}>✕</button>
    </div>
    <div class="trade-plan-grid">
      <div class="plan-row"><span>SIGNAL</span><strong>{pendingTradePlan.previewDir}</strong></div>
      <div class="plan-row"><span>ENTRY</span><strong>{formatPrice(planned.entry)}</strong></div>
      <div class="plan-row"><span>TP</span><strong class="tp">{formatPrice(planned.tp)}</strong></div>
      <div class="plan-row"><span>SL</span><strong class="sl">{formatPrice(planned.sl)}</strong></div>
      <div class="plan-row"><span>RISK</span><strong>{planned.riskPct.toFixed(2)}%</strong></div>
      <div class="plan-row"><span>R:R</span><strong>1:{planned.rr.toFixed(1)}</strong></div>
    </div>
    <div class="plan-ratio-meta">
      <span class:active={planned.dir === 'LONG'}>LONG {planned.longRatio}%</span>
      <span class:active={planned.dir === 'SHORT'}>SHORT {planned.shortRatio}%</span>
    </div>
    <button
      type="button"
      class="plan-ratio-track"
      bind:this={ratioTrackEl}
      onpointerdown={onRatioPointerDown}
      aria-label="Adjust long short ratio"
    >
      <div class="plan-ratio-long" style="width:{planned.longRatio}%"></div>
      <div class="plan-ratio-knob" style="left:calc({planned.longRatio}% - 8px)"></div>
    </button>
    <div class="plan-ratio-presets">
      <button type="button" onclick={() => onSetRatio(80)}>80/20</button>
      <button type="button" onclick={() => onSetRatio(65)}>65/35</button>
      <button type="button" onclick={() => onSetRatio(50)}>50/50</button>
      <button type="button" onclick={() => onSetRatio(35)}>35/65</button>
      <button type="button" onclick={() => onSetRatio(20)}>20/80</button>
    </div>
    <div class="plan-actions">
      <button type="button" class="plan-action ghost" onclick={onCancel}>CANCEL</button>
      <button
        type="button"
        class="plan-action primary"
        class:long={planned.dir === 'LONG'}
        class:short={planned.dir === 'SHORT'}
        onclick={onOpen}
      >
        OPEN {planned.dir}
      </button>
    </div>
  </div>
{/if}

<style>
  .trade-plan-overlay {
    position: absolute;
    right: 10px;
    bottom: 54px;
    z-index: 16;
    width: min(320px, calc(100% - 20px));
    border-radius: 12px;
    border: 1px solid rgba(138, 150, 172, 0.35);
    background: rgba(17, 23, 35, 0.92);
    backdrop-filter: blur(6px);
    box-shadow: 0 14px 34px rgba(0, 0, 0, 0.4);
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .trade-plan-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .plan-title {
    font-family: var(--fd);
    font-size: 10px;
    letter-spacing: 1px;
    font-weight: 900;
    color: #d8dfeb;
  }

  .plan-close {
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.75);
    border-radius: 6px;
    width: 22px;
    height: 20px;
    cursor: pointer;
  }

  .plan-close:hover {
    color: #fff;
    border-color: rgba(255, 255, 255, 0.5);
    background: rgba(255, 255, 255, 0.08);
  }

  .trade-plan-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4px 10px;
  }

  .plan-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-family: var(--fm);
    font-size: 9px;
    color: rgba(216, 223, 235, 0.82);
  }

  .plan-row strong {
    font-family: var(--fd);
    font-size: 10px;
    letter-spacing: 0.35px;
    color: #f5f7fb;
  }

  .plan-row strong.tp { color: #27c391; }
  .plan-row strong.sl { color: #e95b6a; }

  .plan-ratio-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-family: var(--fd);
    font-size: 9px;
    letter-spacing: 0.6px;
    color: rgba(255, 255, 255, 0.65);
  }

  .plan-ratio-meta span.active {
    color: #f0f3fb;
    text-shadow: 0 0 10px rgba(255, 255, 255, 0.22);
  }

  .plan-ratio-track {
    position: relative;
    height: 24px;
    border-radius: 999px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: linear-gradient(90deg, rgba(39, 195, 145, 0.2), rgba(233, 91, 106, 0.2));
    cursor: ew-resize;
    touch-action: none;
    appearance: none;
    display: block;
    width: 100%;
    padding: 0;
  }

  .plan-ratio-long {
    position: absolute;
    inset: 0 auto 0 0;
    background: linear-gradient(90deg, rgba(39, 195, 145, 0.45), rgba(39, 195, 145, 0.2));
    border-right: 1px solid rgba(0, 0, 0, 0.28);
  }

  .plan-ratio-knob {
    position: absolute;
    top: 3px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.8);
    background: #f4f7ff;
    box-shadow: 0 0 0 2px rgba(17, 23, 35, 0.6);
    pointer-events: none;
  }

  .plan-ratio-presets {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }

  .plan-ratio-presets button {
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.82);
    border-radius: 999px;
    padding: 2px 7px;
    font-family: var(--fd);
    font-size: 9px;
    letter-spacing: 0.5px;
    cursor: pointer;
  }

  .plan-ratio-presets button:hover {
    color: #fff;
    border-color: rgba(255, 255, 255, 0.36);
    background: rgba(255, 255, 255, 0.11);
  }

  .plan-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .plan-action {
    flex: 1;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    padding: 7px 10px;
    font-family: var(--fd);
    font-size: 9px;
    letter-spacing: 0.8px;
    font-weight: 900;
    cursor: pointer;
  }

  .plan-action.ghost {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.82);
  }

  .plan-action.ghost:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.12);
  }

  .plan-action.primary {
    color: #fff;
    border-color: transparent;
  }

  .plan-action.primary.long {
    background: linear-gradient(135deg, rgba(39, 195, 145, 0.45), rgba(39, 195, 145, 0.7));
  }

  .plan-action.primary.short {
    background: linear-gradient(135deg, rgba(233, 91, 106, 0.45), rgba(233, 91, 106, 0.7));
  }

  .plan-action.primary:hover {
    filter: brightness(1.08);
  }

  @media (max-width: 1024px) {
    .trade-plan-overlay {
      left: 8px;
      right: 8px;
      width: auto;
      bottom: 42px;
      padding: 8px;
    }

    .plan-ratio-track { height: 22px; }
    .plan-action { padding: 6px 8px; }
  }
</style>
