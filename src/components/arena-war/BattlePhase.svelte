<script lang="ts">
  import { arenaWarStore, arenaWarTimer, addBattleAction } from '$lib/stores/arenaWarStore';
  import type { Direction } from '$lib/engine/types';

  let ws = $derived($arenaWarStore);
  let timer = $derived($arenaWarTimer);

  let currentCandle = $derived(ws.battleKlines[ws.battleCurrentIndex]);
  let prevCandles = $derived(ws.battleKlines.slice(0, ws.battleCurrentIndex + 1));

  let currentPnl = $derived(() => {
    if (!currentCandle || !ws.humanEntryPrice) return 0;
    const dir = ws.humanDirection;
    if (dir === 'LONG') return (currentCandle.close - ws.humanEntryPrice) / ws.humanEntryPrice;
    if (dir === 'SHORT') return (ws.humanEntryPrice - currentCandle.close) / ws.humanEntryPrice;
    return 0;
  });

  let aiPnl = $derived(() => {
    if (!currentCandle || !ws.aiDecision) return 0;
    const dir = ws.aiDecision.direction;
    const entry = ws.aiDecision.entryPrice;
    if (dir === 'LONG') return (currentCandle.close - entry) / entry;
    if (dir === 'SHORT') return (entry - currentCandle.close) / entry;
    return 0;
  });

  let pnlPct = $derived(currentPnl() * 100);
  let aiPnlPct = $derived(aiPnl() * 100);

  // Simple candle rendering
  let candleHeight = 200;
  let candleWidth = $derived(Math.min(20, 480 / Math.max(1, prevCandles.length)));

  let priceRange = $derived(() => {
    if (prevCandles.length === 0) return { min: 0, max: 1 };
    const highs = prevCandles.map(c => c.high);
    const lows = prevCandles.map(c => c.low);
    const min = Math.min(...lows) * 0.999;
    const max = Math.max(...highs) * 1.001;
    return { min, max };
  });

  function priceToY(price: number): number {
    const range = priceRange();
    const pct = (price - range.min) / (range.max - range.min);
    return candleHeight - pct * candleHeight;
  }

  function handleAdjustTp() {
    if (!currentCandle) return;
    const offset = ws.humanDirection === 'LONG' ? 50 : -50;
    addBattleAction('ADJUST_TP', ws.humanTp + offset);
  }

  function handleAdjustSl() {
    if (!currentCandle) return;
    const offset = ws.humanDirection === 'LONG' ? 50 : -50;
    addBattleAction('ADJUST_SL', ws.humanSl + offset);
  }

  function handleCut() {
    addBattleAction('CUT');
  }

  function handleHold() {
    addBattleAction('HOLD');
  }

  // Decision point every 8 candles
  let isDecisionPoint = $derived(
    ws.battleCurrentIndex > 0 &&
    ws.battleCurrentIndex % 8 === 0 &&
    ws.battleCurrentIndex < 24
  );
</script>

<div class="battle-phase">
  <!-- Header -->
  <div class="battle-header">
    <div class="battle-title">⚔ BATTLE</div>
    <div class="battle-progress">
      {ws.battleCurrentIndex}/{ws.battleKlines.length} candles
    </div>
    <div class="battle-timer">{timer}s</div>
  </div>

  <!-- PnL Display -->
  <div class="pnl-row">
    <div class="pnl-card" class:positive={pnlPct > 0} class:negative={pnlPct < 0}>
      <span class="pnl-label">👤 YOU</span>
      <span class="pnl-value">{pnlPct > 0 ? '+' : ''}{pnlPct.toFixed(2)}%</span>
      <span class="pnl-dir">{ws.humanDirection}</span>
    </div>
    <div class="pnl-vs">VS</div>
    <div class="pnl-card" class:positive={aiPnlPct > 0} class:negative={aiPnlPct < 0}>
      <span class="pnl-label">🤖 AI</span>
      <span class="pnl-value">{aiPnlPct > 0 ? '+' : ''}{aiPnlPct.toFixed(2)}%</span>
      <span class="pnl-dir">{ws.aiDecision?.direction}</span>
    </div>
  </div>

  <!-- Candle Chart (Simplified) -->
  <div class="chart-area">
    <svg width="100%" height={candleHeight} viewBox="0 0 {prevCandles.length * candleWidth} {candleHeight}" preserveAspectRatio="none">
      <!-- TP/SL lines -->
      <line
        x1="0" x2={prevCandles.length * candleWidth}
        y1={priceToY(ws.humanTp)} y2={priceToY(ws.humanTp)}
        stroke="var(--arena-good, #00cc88)" stroke-width="1" stroke-dasharray="4,2" opacity="0.5"
      />
      <line
        x1="0" x2={prevCandles.length * candleWidth}
        y1={priceToY(ws.humanSl)} y2={priceToY(ws.humanSl)}
        stroke="var(--arena-bad, #ff5e7a)" stroke-width="1" stroke-dasharray="4,2" opacity="0.5"
      />
      <!-- Entry line -->
      <line
        x1="0" x2={prevCandles.length * candleWidth}
        y1={priceToY(ws.humanEntryPrice)} y2={priceToY(ws.humanEntryPrice)}
        stroke="var(--arena-text-2, #5a7d6e)" stroke-width="1" stroke-dasharray="2,2" opacity="0.4"
      />

      <!-- Candles -->
      {#each prevCandles as candle, i}
        {@const isGreen = candle.close >= candle.open}
        {@const bodyTop = priceToY(Math.max(candle.open, candle.close))}
        {@const bodyBottom = priceToY(Math.min(candle.open, candle.close))}
        {@const bodyHeight = Math.max(1, bodyBottom - bodyTop)}
        {@const wickTop = priceToY(candle.high)}
        {@const wickBottom = priceToY(candle.low)}
        {@const x = i * candleWidth + candleWidth / 2}

        <!-- Wick -->
        <line
          x1={x} x2={x}
          y1={wickTop} y2={wickBottom}
          stroke={isGreen ? 'var(--arena-good, #00cc88)' : 'var(--arena-bad, #ff5e7a)'}
          stroke-width="1"
        />
        <!-- Body -->
        <rect
          x={i * candleWidth + 2}
          y={bodyTop}
          width={Math.max(1, candleWidth - 4)}
          height={bodyHeight}
          fill={isGreen ? 'var(--arena-good, #00cc88)' : 'var(--arena-bad, #ff5e7a)'}
          opacity={i === ws.battleCurrentIndex ? 1 : 0.7}
        />
      {/each}
    </svg>

    <div class="chart-labels">
      <span class="label-tp">TP {ws.humanTp.toLocaleString()}</span>
      <span class="label-entry">Entry {ws.humanEntryPrice.toLocaleString()}</span>
      <span class="label-sl">SL {ws.humanSl.toLocaleString()}</span>
    </div>
  </div>

  <!-- Current Price -->
  {#if currentCandle}
    <div class="current-price">
      현재가: <span class="price">{currentCandle.close.toLocaleString()}</span>
    </div>
  {/if}

  <!-- Decision Point -->
  {#if isDecisionPoint}
    <div class="decision-point">
      <div class="dp-header">🔔 DECISION POINT — Checkpoint {ws.battleCurrentIndex}</div>
      <div class="dp-buttons">
        <button class="dp-btn hold" onclick={handleHold}>유지</button>
        <button class="dp-btn adjust" onclick={handleAdjustTp}>TP 조정</button>
        <button class="dp-btn adjust" onclick={handleAdjustSl}>SL 조정</button>
        <button class="dp-btn cut" onclick={handleCut}>청산</button>
      </div>
    </div>
  {/if}

  <!-- Battle Actions Log -->
  {#if ws.battleActions.length > 0}
    <div class="action-log">
      {#each ws.battleActions as action}
        <span class="action-chip">
          #{action.checkpoint} {action.action}
          {#if action.newValue} → {action.newValue.toLocaleString()}{/if}
        </span>
      {/each}
    </div>
  {/if}
</div>

<style>
  .battle-phase {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    max-width: 640px;
    margin: 0 auto;
  }

  .battle-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .battle-title {
    font-family: 'Bebas Neue', 'Orbitron', sans-serif;
    font-size: 1.5rem;
    color: var(--arena-accent, #e8967d);
    letter-spacing: 3px;
  }

  .battle-progress {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.7rem;
    color: var(--arena-text-2, #5a7d6e);
  }

  .battle-timer {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.85rem;
    color: var(--arena-text-0, #e0f0e8);
    font-weight: 700;
  }

  .pnl-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .pnl-card {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.6rem;
    background: var(--arena-bg-1, #0d2118);
    border: 2px solid var(--arena-line, #1a3d2e);
    border-radius: 6px;
  }

  .pnl-card.positive { border-color: rgba(0, 204, 136, 0.4); }
  .pnl-card.negative { border-color: rgba(255, 94, 122, 0.4); }

  .pnl-label {
    font-size: 0.65rem;
    color: var(--arena-text-2, #5a7d6e);
  }

  .pnl-value {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1.3rem;
    font-weight: 700;
  }

  .pnl-card.positive .pnl-value { color: var(--arena-good, #00cc88); }
  .pnl-card.negative .pnl-value { color: var(--arena-bad, #ff5e7a); }

  .pnl-dir {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.6rem;
    color: var(--arena-text-2, #5a7d6e);
  }

  .pnl-vs {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 1rem;
    color: var(--arena-accent, #e8967d);
  }

  .chart-area {
    position: relative;
    background: var(--arena-bg-1, #0d2118);
    border: 1px solid var(--arena-line, #1a3d2e);
    border-radius: 6px;
    padding: 0.5rem;
    overflow: hidden;
  }

  .chart-labels {
    position: absolute;
    right: 8px;
    top: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    pointer-events: none;
  }

  .label-tp {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.5rem;
    color: var(--arena-good, #00cc88);
  }

  .label-entry {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.5rem;
    color: var(--arena-text-2, #5a7d6e);
  }

  .label-sl {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.5rem;
    color: var(--arena-bad, #ff5e7a);
  }

  .current-price {
    text-align: center;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8rem;
    color: var(--arena-text-1, #8ba59e);
  }

  .price {
    color: var(--arena-text-0, #e0f0e8);
    font-weight: 700;
  }

  .decision-point {
    background: rgba(232, 150, 125, 0.08);
    border: 2px solid var(--arena-accent, #e8967d);
    border-radius: 8px;
    padding: 0.75rem;
    animation: dpPulse 0.8s ease-in-out infinite;
  }

  @keyframes dpPulse {
    0%, 100% { border-color: var(--arena-accent, #e8967d); }
    50% { border-color: rgba(232, 150, 125, 0.4); }
  }

  .dp-header {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    color: var(--arena-accent, #e8967d);
    margin-bottom: 0.5rem;
    text-align: center;
    font-weight: 700;
  }

  .dp-buttons {
    display: flex;
    gap: 0.4rem;
  }

  .dp-btn {
    flex: 1;
    padding: 0.5rem;
    border: 2px solid var(--arena-line, #1a3d2e);
    background: var(--arena-bg-1, #0d2118);
    border-radius: 4px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.7rem;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: center;
  }

  .dp-btn.hold { color: var(--arena-text-1, #8ba59e); }
  .dp-btn.hold:hover { border-color: var(--arena-text-1, #8ba59e); }

  .dp-btn.adjust { color: #f59e0b; }
  .dp-btn.adjust:hover { border-color: #f59e0b; }

  .dp-btn.cut { color: var(--arena-bad, #ff5e7a); }
  .dp-btn.cut:hover { border-color: var(--arena-bad, #ff5e7a); }

  .action-log {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }

  .action-chip {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.55rem;
    padding: 2px 6px;
    background: var(--arena-bg-1, #0d2118);
    border: 1px solid var(--arena-line, #1a3d2e);
    border-radius: 8px;
    color: var(--arena-text-2, #5a7d6e);
  }
</style>
