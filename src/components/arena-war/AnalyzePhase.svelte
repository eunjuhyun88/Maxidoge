<script lang="ts">
  import { arenaWarStore } from '$lib/stores/arenaWarStore';

  let progress = $derived($arenaWarStore.analyzeProgress);

  const agents = [
    { id: 'STRUCTURE', icon: '📊', name: '차트구조', role: 'OFFENSE' },
    { id: 'VPA', icon: '📈', name: '볼륨분석', role: 'OFFENSE' },
    { id: 'ICT', icon: '⚡', name: '스마트머니', role: 'OFFENSE' },
    { id: 'DERIV', icon: '💰', name: '파생상품', role: 'DEFENSE' },
    { id: 'VALUATION', icon: '💎', name: '밸류에이션', role: 'DEFENSE' },
    { id: 'FLOW', icon: '🐋', name: '자금흐름', role: 'DEFENSE' },
    { id: 'SENTI', icon: '🧠', name: '센티먼트', role: 'CONTEXT' },
    { id: 'MACRO', icon: '🌍', name: '매크로', role: 'CONTEXT' },
  ];

  let activeAgent = $derived(Math.floor(progress / 12.5));
</script>

<div class="analyze-phase">
  <div class="analyze-header">
    <h3>AI ANALYZING</h3>
    <p class="pair">{$arenaWarStore.setup.pair} · {$arenaWarStore.setup.timeframe}</p>
  </div>

  <div class="agent-grid">
    {#each agents as agent, i}
      <div
        class="agent-card"
        class:active={i === activeAgent}
        class:done={i < activeAgent}
      >
        <span class="agent-icon">{agent.icon}</span>
        <span class="agent-name">{agent.name}</span>
        <span class="agent-role" class:offense={agent.role === 'OFFENSE'}
              class:defense={agent.role === 'DEFENSE'}
              class:context={agent.role === 'CONTEXT'}>
          {agent.role}
        </span>
        {#if i < activeAgent}
          <span class="checkmark">✓</span>
        {:else if i === activeAgent}
          <span class="spinner"></span>
        {/if}
      </div>
    {/each}
  </div>

  <div class="progress-bar">
    <div class="progress-fill" style="width: {progress}%"></div>
  </div>

  <div class="analyze-status">
    {#if progress < 40}
      C02 Pipeline: ORPO 분석 중...
    {:else if progress < 60}
      CTX 검증 중...
    {:else if progress < 80}
      Guardian 체크 중...
    {:else if progress < 100}
      Commander 판정 중...
    {:else}
      분석 완료!
    {/if}
  </div>
</div>

<style>
  .analyze-phase {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    padding: 2rem;
    max-width: 520px;
    margin: 0 auto;
  }

  .analyze-header {
    text-align: center;
  }

  .analyze-header h3 {
    font-family: 'Bebas Neue', 'Orbitron', sans-serif;
    font-size: 1.8rem;
    color: var(--arena-accent, #e8967d);
    margin: 0;
    letter-spacing: 3px;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  .pair {
    color: var(--arena-text-1, #8ba59e);
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8rem;
    margin: 0.25rem 0 0;
  }

  .agent-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    width: 100%;
  }

  .agent-card {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 0.8rem;
    background: var(--arena-bg-1, #0d2118);
    border: 1px solid var(--arena-line, #1a3d2e);
    border-radius: 6px;
    opacity: 0.4;
    transition: all 0.3s ease;
    position: relative;
  }

  .agent-card.active {
    opacity: 1;
    border-color: var(--arena-accent, #e8967d);
    background: rgba(232, 150, 125, 0.08);
  }

  .agent-card.done {
    opacity: 0.8;
    border-color: var(--arena-good, #00cc88);
  }

  .agent-icon {
    font-size: 1.1rem;
  }

  .agent-name {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    color: var(--arena-text-0, #e0f0e8);
    flex: 1;
  }

  .agent-role {
    font-size: 0.55rem;
    padding: 1px 4px;
    border-radius: 3px;
    font-family: 'JetBrains Mono', monospace;
    letter-spacing: 1px;
  }

  .agent-role.offense { color: #3b9eff; border: 1px solid #3b9eff33; }
  .agent-role.defense { color: #ff8c3b; border: 1px solid #ff8c3b33; }
  .agent-role.context { color: #a78bfa; border: 1px solid #a78bfa33; }

  .checkmark {
    color: var(--arena-good, #00cc88);
    font-weight: bold;
    font-size: 0.85rem;
  }

  .spinner {
    width: 12px;
    height: 12px;
    border: 2px solid var(--arena-accent, #e8967d);
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .progress-bar {
    width: 100%;
    height: 4px;
    background: var(--arena-bg-1, #0d2118);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--arena-accent, #e8967d), var(--arena-good, #00cc88));
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .analyze-status {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.7rem;
    color: var(--arena-text-2, #5a7d6e);
    letter-spacing: 1px;
  }
</style>
