<!--
  STOCKCLAW — Decision Window Overlay
  BUY/SELL/HOLD 3-button prompt during BATTLE phase
  Shows countdown timer per window (10s default)
-->
<script lang="ts">
  import type { DecisionAction } from '$lib/engine/types';

  interface Props {
    visible: boolean;
    windowN: number;
    totalWindows: number;
    timerSec: number;
    currentPrice: number;
    onDecision: (action: DecisionAction) => void;
  }

  let { visible, windowN, totalWindows, timerSec, currentPrice, onDecision }: Props = $props();

  function handleClick(action: DecisionAction) {
    onDecision(action);
  }
</script>

{#if visible}
  <div class="dw-overlay">
    <div class="dw-card">
      <div class="dw-header">
        <span class="dw-label">DECISION WINDOW</span>
        <span class="dw-count">{windowN}/{totalWindows}</span>
      </div>

      <div class="dw-timer">
        <div class="dw-timer-bar" style="width: {(timerSec / 10) * 100}%"></div>
        <span class="dw-timer-text">{timerSec}s</span>
      </div>

      <div class="dw-price">
        <span class="dw-price-label">CURRENT</span>
        <span class="dw-price-value">${currentPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
      </div>

      <div class="dw-actions">
        <button class="dw-btn dw-buy" onclick={() => handleClick('BUY')}>
          <span class="dw-btn-icon">📈</span>
          <span class="dw-btn-text">BUY</span>
        </button>
        <button class="dw-btn dw-hold" onclick={() => handleClick('HOLD')}>
          <span class="dw-btn-icon">⏸</span>
          <span class="dw-btn-text">HOLD</span>
        </button>
        <button class="dw-btn dw-sell" onclick={() => handleClick('SELL')}>
          <span class="dw-btn-icon">📉</span>
          <span class="dw-btn-text">SELL</span>
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .dw-overlay {
    position: fixed;
    inset: 0;
    z-index: 900;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    animation: dwFadeIn 0.2s ease-out;
  }
  @keyframes dwFadeIn { from { opacity: 0; } to { opacity: 1; } }

  .dw-card {
    background: linear-gradient(135deg, #1a1c2e 0%, #12131f 100%);
    border: 1px solid rgba(255, 94, 122, 0.3);
    border-radius: 16px;
    padding: 24px;
    width: 340px;
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.6);
    animation: dwSlideUp 0.3s ease-out;
  }
  @keyframes dwSlideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

  .dw-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  .dw-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.2px;
    color: #ff5e7a;
    text-transform: uppercase;
  }
  .dw-count {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    font-weight: 600;
  }

  .dw-timer {
    position: relative;
    height: 6px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 3px;
    margin-bottom: 16px;
    overflow: hidden;
  }
  .dw-timer-bar {
    height: 100%;
    background: linear-gradient(90deg, #ff5e7a, #ff9b7f);
    border-radius: 3px;
    transition: width 1s linear;
  }
  .dw-timer-text {
    position: absolute;
    right: 0;
    top: -18px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
    font-weight: 600;
  }

  .dw-price {
    text-align: center;
    margin-bottom: 20px;
  }
  .dw-price-label {
    display: block;
    font-size: 10px;
    color: rgba(255, 255, 255, 0.35);
    letter-spacing: 1px;
    margin-bottom: 4px;
  }
  .dw-price-value {
    font-size: 24px;
    font-weight: 700;
    color: #fff;
    font-variant-numeric: tabular-nums;
  }

  .dw-actions {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 10px;
  }
  .dw-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 14px 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.04);
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .dw-btn:hover { transform: translateY(-2px); }
  .dw-btn-icon { font-size: 22px; }
  .dw-btn-text { font-size: 11px; font-weight: 700; letter-spacing: 1px; }

  .dw-buy:hover { background: rgba(76, 217, 100, 0.15); border-color: rgba(76, 217, 100, 0.4); }
  .dw-buy .dw-btn-text { color: #4cd964; }
  .dw-hold:hover { background: rgba(255, 204, 0, 0.15); border-color: rgba(255, 204, 0, 0.4); }
  .dw-hold .dw-btn-text { color: #ffcc00; }
  .dw-sell:hover { background: rgba(255, 59, 48, 0.15); border-color: rgba(255, 59, 48, 0.4); }
  .dw-sell .dw-btn-text { color: #ff3b30; }
</style>
