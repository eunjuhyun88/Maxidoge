<script lang="ts">
  import { arenaWarStore } from '$lib/stores/arenaWarStore';

  let ws = $derived($arenaWarStore);
  let progress = $derived(ws.judgeAnimProgress / 100);

  // Animated score values
  let humanDS = $derived(Math.round((ws.humanFBS?.ds ?? 0) * progress));
  let humanRE = $derived(Math.round((ws.humanFBS?.re ?? 0) * progress));
  let humanCI = $derived(Math.round((ws.humanFBS?.ci ?? 0) * progress));
  let humanFBS = $derived(Math.round((ws.humanFBS?.fbs ?? 0) * progress));

  let aiDS = $derived(Math.round((ws.aiFBS?.ds ?? 0) * progress));
  let aiRE = $derived(Math.round((ws.aiFBS?.re ?? 0) * progress));
  let aiCI = $derived(Math.round((ws.aiFBS?.ci ?? 0) * progress));
  let aiFBS = $derived(Math.round((ws.aiFBS?.fbs ?? 0) * progress));

  let humanLeading = $derived(humanFBS > aiFBS);
  let aiLeading = $derived(aiFBS > humanFBS);
</script>

<div class="judge-phase">
  <div class="judge-title">⚖ JUDGE</div>

  <div class="score-grid">
    <!-- Human -->
    <div class="score-column" class:leading={humanLeading}>
      <div class="column-header">👤 YOU</div>

      <div class="score-item">
        <span class="score-label">DS (방향)</span>
        <div class="score-bar-wrap">
          <div class="score-bar" style="width: {humanDS}%; background: var(--arena-good, #00cc88)"></div>
        </div>
        <span class="score-val">{humanDS}</span>
      </div>

      <div class="score-item">
        <span class="score-label">RE (리스크)</span>
        <div class="score-bar-wrap">
          <div class="score-bar" style="width: {humanRE}%; background: #3b9eff"></div>
        </div>
        <span class="score-val">{humanRE}</span>
      </div>

      <div class="score-item">
        <span class="score-label">CI (확신)</span>
        <div class="score-bar-wrap">
          <div class="score-bar" style="width: {humanCI}%; background: #a78bfa"></div>
        </div>
        <span class="score-val">{humanCI}</span>
      </div>

      <div class="fbs-total" class:leading={humanLeading}>
        <span class="fbs-label">FBS</span>
        <span class="fbs-value">{humanFBS}</span>
      </div>
    </div>

    <!-- VS -->
    <div class="judge-vs">
      <span class="vs-icon">⚖</span>
    </div>

    <!-- AI -->
    <div class="score-column" class:leading={aiLeading}>
      <div class="column-header">🤖 AI</div>

      <div class="score-item">
        <span class="score-label">DS (방향)</span>
        <div class="score-bar-wrap">
          <div class="score-bar" style="width: {aiDS}%; background: var(--arena-good, #00cc88)"></div>
        </div>
        <span class="score-val">{aiDS}</span>
      </div>

      <div class="score-item">
        <span class="score-label">RE (리스크)</span>
        <div class="score-bar-wrap">
          <div class="score-bar" style="width: {aiRE}%; background: #3b9eff"></div>
        </div>
        <span class="score-val">{aiRE}</span>
      </div>

      <div class="score-item">
        <span class="score-label">CI (확신)</span>
        <div class="score-bar-wrap">
          <div class="score-bar" style="width: {aiCI}%; background: #a78bfa"></div>
        </div>
        <span class="score-val">{aiCI}</span>
      </div>

      <div class="fbs-total" class:leading={aiLeading}>
        <span class="fbs-label">FBS</span>
        <span class="fbs-value">{aiFBS}</span>
      </div>
    </div>
  </div>

  <div class="judge-hint">
    FBS = 0.5·DS + 0.3·RE + 0.2·CI
  </div>
</div>

<style>
  .judge-phase {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    padding: 2rem;
    max-width: 600px;
    margin: 0 auto;
  }

  .judge-title {
    font-family: 'Bebas Neue', 'Orbitron', sans-serif;
    font-size: 2rem;
    color: var(--arena-accent, #e8967d);
    letter-spacing: 5px;
  }

  .score-grid {
    display: flex;
    align-items: stretch;
    gap: 1rem;
    width: 100%;
  }

  .score-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 1rem;
    background: var(--arena-bg-1, #0d2118);
    border: 2px solid var(--arena-line, #1a3d2e);
    border-radius: 8px;
    transition: border-color 0.3s ease;
  }

  .score-column.leading {
    border-color: var(--arena-accent, #e8967d);
  }

  .column-header {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8rem;
    color: var(--arena-text-1, #8ba59e);
    text-align: center;
    letter-spacing: 2px;
    padding-bottom: 0.3rem;
    border-bottom: 1px solid var(--arena-line, #1a3d2e);
  }

  .score-item {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .score-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.6rem;
    color: var(--arena-text-2, #5a7d6e);
    width: 70px;
    white-space: nowrap;
  }

  .score-bar-wrap {
    flex: 1;
    height: 12px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 3px;
    overflow: hidden;
  }

  .score-bar {
    height: 100%;
    border-radius: 3px;
    transition: width 0.3s ease;
  }

  .score-val {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8rem;
    color: var(--arena-text-0, #e0f0e8);
    width: 28px;
    text-align: right;
    font-weight: 700;
  }

  .fbs-total {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    margin-top: 0.3rem;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 4px;
    border: 1px solid var(--arena-line, #1a3d2e);
  }

  .fbs-total.leading {
    border-color: var(--arena-accent, #e8967d);
    background: rgba(232, 150, 125, 0.08);
  }

  .fbs-label {
    font-family: 'Bebas Neue', 'Orbitron', sans-serif;
    font-size: 1rem;
    color: var(--arena-text-1, #8ba59e);
    letter-spacing: 2px;
  }

  .fbs-value {
    font-family: 'Bebas Neue', 'Orbitron', sans-serif;
    font-size: 1.8rem;
    color: var(--arena-text-0, #e0f0e8);
  }

  .fbs-total.leading .fbs-value {
    color: var(--arena-accent, #e8967d);
  }

  .judge-vs {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .vs-icon {
    font-size: 2rem;
    animation: judgeSwing 1s ease-in-out infinite alternate;
  }

  @keyframes judgeSwing {
    from { transform: rotate(-5deg); }
    to { transform: rotate(5deg); }
  }

  .judge-hint {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.6rem;
    color: var(--arena-text-2, #5a7d6e);
  }
</style>
