<script lang="ts">
  import { arenaWarStore, rematch, resetArenaWar } from '$lib/stores/arenaWarStore';

  let ws = $derived($arenaWarStore);
  let record = $derived(ws.gameRecord);

  let winnerLabel = $derived(
    ws.winner === 'human' ? '🏆 YOU WIN!' :
    ws.winner === 'ai' ? '🤖 AI WINS' :
    '🤝 DRAW'
  );

  let winnerColor = $derived(
    ws.winner === 'human' ? 'var(--arena-good, #00cc88)' :
    ws.winner === 'ai' ? 'var(--arena-bad, #ff5e7a)' :
    'var(--arena-text-1, #8ba59e)'
  );

  let pairQuality = $derived(record?.derived.orpoPair.quality ?? 'noise');
  let qualityColor = $derived(
    pairQuality === 'strong' ? '#00cc88' :
    pairQuality === 'medium' ? '#3b9eff' :
    pairQuality === 'boundary' ? '#f59e0b' :
    pairQuality === 'weak' ? '#a78bfa' :
    '#5a7d6e'
  );
</script>

<div class="result-phase">
  <!-- Winner Banner -->
  <div class="winner-banner" style="border-color: {winnerColor}">
    <div class="winner-text" style="color: {winnerColor}">{winnerLabel}</div>
    {#if ws.fbsMargin <= 5}
      <div class="razor-close">RAZOR CLOSE! {ws.fbsMargin.toFixed(1)}점 차이!</div>
    {/if}
  </div>

  <!-- FBS Summary -->
  <div class="fbs-summary">
    <div class="fbs-card">
      <span class="fbs-who">👤</span>
      <span class="fbs-score">{ws.humanFBS?.fbs ?? 0}</span>
    </div>
    <span class="fbs-vs">vs</span>
    <div class="fbs-card">
      <span class="fbs-who">🤖</span>
      <span class="fbs-score">{ws.aiFBS?.fbs ?? 0}</span>
    </div>
  </div>

  <!-- LP Delta -->
  <div class="lp-delta" class:positive={ws.lpDelta > 0} class:negative={ws.lpDelta < 0}>
    <span class="lp-label">LP</span>
    <span class="lp-value">{ws.lpDelta > 0 ? '+' : ''}{ws.lpDelta}</span>
    {#if ws.consensusType === 'dissent' && ws.winner === 'human'}
      <span class="lp-bonus">DISSENT WIN +5!</span>
    {/if}
  </div>

  <!-- Feedback -->
  {#if record}
    <div class="feedback-section">
      <div class="feedback-title">📋 피드백</div>
      <p class="feedback-text">{record.derived.feedback.immediate}</p>
    </div>

    <!-- Data Quality -->
    <div class="data-quality">
      <div class="dq-title">📊 ORPO 데이터 품질</div>
      <div class="dq-row">
        <span class="dq-label">Pair Quality</span>
        <span class="dq-value" style="color: {qualityColor}">{pairQuality.toUpperCase()}</span>
      </div>
      <div class="dq-row">
        <span class="dq-label">FBS Margin</span>
        <span class="dq-value">{ws.fbsMargin.toFixed(1)}</span>
      </div>
      <div class="dq-row">
        <span class="dq-label">Reason Tags</span>
        <span class="dq-value">{ws.humanReasonTags.length}개</span>
      </div>
      <div class="dq-row">
        <span class="dq-label">Consensus</span>
        <span class="dq-value">{ws.consensusType?.toUpperCase()}</span>
      </div>
      {#if record.human.battleActions.length > 0}
        <div class="dq-row">
          <span class="dq-label">Battle Actions</span>
          <span class="dq-value">{record.human.battleActions.length}회</span>
        </div>
      {/if}
    </div>

    <!-- Detected Patterns -->
    {#if record.context.detectedPatterns.length > 0}
      <div class="patterns">
        <span class="pat-label">감지 패턴:</span>
        {#each record.context.detectedPatterns as p}
          <span class="pat-chip">{p.replace(/_/g, ' ')}</span>
        {/each}
      </div>
    {/if}
  {/if}

  <!-- Actions -->
  <div class="result-actions">
    <button class="action-btn rematch" onclick={rematch}>
      ⚔ 한 판 더
    </button>
    <button class="action-btn lobby" onclick={resetArenaWar}>
      🏠 로비
    </button>
  </div>

  <!-- ORPO Contribution -->
  <div class="orpo-contribution">
    이 판의 데이터가 AI 학습에 반영됩니다.
  </div>
</div>

<style>
  .result-phase {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.2rem;
    padding: 1.5rem;
    max-width: 520px;
    margin: 0 auto;
    animation: slideUp 0.5s ease;
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .winner-banner {
    text-align: center;
    padding: 1rem 2rem;
    border: 3px solid;
    border-radius: 12px;
    width: 100%;
  }

  .winner-text {
    font-family: 'Bebas Neue', 'Orbitron', sans-serif;
    font-size: 2.5rem;
    letter-spacing: 5px;
  }

  .razor-close {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8rem;
    color: #f59e0b;
    margin-top: 0.3rem;
    animation: flashRazor 0.5s ease-in-out infinite;
  }

  @keyframes flashRazor {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .fbs-summary {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .fbs-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
    padding: 0.5rem 1.5rem;
    background: var(--arena-bg-1, #0d2118);
    border-radius: 8px;
    border: 1px solid var(--arena-line, #1a3d2e);
  }

  .fbs-who { font-size: 1.2rem; }

  .fbs-score {
    font-family: 'Bebas Neue', 'Orbitron', sans-serif;
    font-size: 2rem;
    color: var(--arena-text-0, #e0f0e8);
  }

  .fbs-vs {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8rem;
    color: var(--arena-text-2, #5a7d6e);
  }

  .lp-delta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1.2rem;
    border-radius: 8px;
    font-family: 'JetBrains Mono', monospace;
  }

  .lp-delta.positive {
    background: rgba(0, 204, 136, 0.1);
    border: 1px solid rgba(0, 204, 136, 0.3);
  }

  .lp-delta.negative {
    background: rgba(255, 94, 122, 0.1);
    border: 1px solid rgba(255, 94, 122, 0.3);
  }

  .lp-label {
    font-size: 0.7rem;
    color: var(--arena-text-2, #5a7d6e);
  }

  .lp-value {
    font-size: 1.3rem;
    font-weight: 700;
  }

  .lp-delta.positive .lp-value { color: var(--arena-good, #00cc88); }
  .lp-delta.negative .lp-value { color: var(--arena-bad, #ff5e7a); }

  .lp-bonus {
    font-size: 0.65rem;
    color: var(--arena-accent, #e8967d);
    background: rgba(232, 150, 125, 0.15);
    padding: 2px 6px;
    border-radius: 8px;
  }

  .feedback-section {
    width: 100%;
    padding: 0.8rem;
    background: var(--arena-bg-1, #0d2118);
    border: 1px solid var(--arena-line, #1a3d2e);
    border-radius: 6px;
  }

  .feedback-title {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.7rem;
    color: var(--arena-accent, #e8967d);
    letter-spacing: 1px;
    margin-bottom: 0.4rem;
  }

  .feedback-text {
    font-size: 0.8rem;
    color: var(--arena-text-0, #e0f0e8);
    line-height: 1.5;
    margin: 0;
  }

  .data-quality {
    width: 100%;
    padding: 0.8rem;
    background: var(--arena-bg-1, #0d2118);
    border: 1px solid var(--arena-line, #1a3d2e);
    border-radius: 6px;
  }

  .dq-title {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.7rem;
    color: var(--arena-accent, #e8967d);
    letter-spacing: 1px;
    margin-bottom: 0.4rem;
  }

  .dq-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.2rem 0;
  }

  .dq-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.65rem;
    color: var(--arena-text-2, #5a7d6e);
  }

  .dq-value {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.7rem;
    color: var(--arena-text-0, #e0f0e8);
    font-weight: 600;
  }

  .patterns {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.3rem;
    width: 100%;
  }

  .pat-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.65rem;
    color: var(--arena-text-2, #5a7d6e);
  }

  .pat-chip {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.55rem;
    padding: 2px 6px;
    background: rgba(59, 158, 255, 0.1);
    border: 1px solid rgba(59, 158, 255, 0.3);
    color: #3b9eff;
    border-radius: 8px;
  }

  .result-actions {
    display: flex;
    gap: 0.75rem;
    width: 100%;
    margin-top: 0.5rem;
  }

  .action-btn {
    flex: 1;
    padding: 0.8rem;
    border: 3px solid #000;
    border-radius: 6px;
    font-family: 'Bebas Neue', 'Orbitron', sans-serif;
    font-size: 1.2rem;
    letter-spacing: 2px;
    cursor: pointer;
    box-shadow: 3px 3px 0 #000;
    transition: all 0.1s ease;
    text-align: center;
  }

  .action-btn:hover {
    transform: translate(-1px, -1px);
    box-shadow: 4px 4px 0 #000;
  }

  .action-btn:active {
    transform: translate(2px, 2px);
    box-shadow: 1px 1px 0 #000;
  }

  .action-btn.rematch {
    background: var(--arena-accent, #e8967d);
    color: #000;
  }

  .action-btn.lobby {
    background: var(--arena-bg-1, #0d2118);
    color: var(--arena-text-1, #8ba59e);
    border-color: var(--arena-line, #1a3d2e);
    box-shadow: 3px 3px 0 var(--arena-line, #1a3d2e);
  }

  .orpo-contribution {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.6rem;
    color: var(--arena-text-2, #5a7d6e);
    text-align: center;
    padding-top: 0.5rem;
    border-top: 1px solid var(--arena-line, #1a3d2e);
    width: 100%;
  }
</style>
