<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { btcPrice } from '$lib/stores/priceStore';
  import {
    arenaV2State,
    v2StartRound,
    v2SetPhase,
    v2SetView,
    v2Reset,
    type V2Phase,
    type V2ArenaView,
  } from '$lib/stores/arenaV2State';

  // Components
  import PhaseBar from '../../components/arena-v2/shared/PhaseBar.svelte';
  import DraftScreen from '../../components/arena-v2/DraftScreen.svelte';
  import AnalysisScreen from '../../components/arena-v2/AnalysisScreen.svelte';
  import HypothesisScreen from '../../components/arena-v2/HypothesisScreen.svelte';
  import BattleScreen from '../../components/arena-v2/BattleScreen.svelte';
  import ResultScreen from '../../components/arena-v2/ResultScreen.svelte';

  // ── Local reactive state (from store) ──
  const arenaState = $derived($arenaV2State);
  const phase = $derived(arenaState.phase);
  const subPhase = $derived(arenaState.subPhase);
  const currentView = $derived(arenaState.currentView);

  // ── Price feed ──
  const livePrice = $derived($btcPrice ?? 0);
  $effect(() => {
    if (livePrice > 0) {
      arenaV2State.update(s => ({ ...s, btcPrice: livePrice }));
    }
  });

  // ── Lobby ──
  function handleStartRound() {
    v2StartRound();
  }

  function handleGoLobby() {
    v2Reset();
  }

  function handlePlayAgain() {
    v2StartRound();
  }

  // ── View switching (keyboard shortcuts) ──
  function handleKeydown(e: KeyboardEvent) {
    if (phase !== 'BATTLE') return;
    const viewMap: Record<string, V2ArenaView> = {
      '1': 'arena', '2': 'chart', '3': 'mission', '4': 'card',
    };
    if (viewMap[e.key]) {
      v2SetView(viewMap[e.key]);
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    if (browser) window.removeEventListener('keydown', handleKeydown);
  });
</script>

<svelte:head>
  <title>STOCKCLAW Arena v2</title>
</svelte:head>

<div class="arena-v2">
  <!-- Phase Bar (always visible) -->
  <PhaseBar
    {phase}
    {subPhase}
    timer={arenaState.timer}
    btcPrice={arenaState.btcPrice}
  />

  <!-- Main Content Area -->
  <div class="arena-main">
    {#if phase === 'LOBBY'}
      <div class="lobby">
        <div class="lobby-content">
          <div class="lobby-logo">STOCKCLAW</div>
          <div class="lobby-subtitle">ARENA v2</div>
          <div class="lobby-price">
            {#if livePrice > 0}
              <span class="price-label">BTC</span>
              <span class="price-value">${livePrice.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
            {:else}
              <span class="price-loading">connecting to price feed...</span>
            {/if}
          </div>
          <button class="btn-start" onclick={handleStartRound}>
            <span class="btn-icon">⚔</span>
            <span class="btn-text">START ROUND</span>
          </button>
        </div>
      </div>

    {:else if phase === 'DRAFT'}
      <DraftScreen
        selectedAgents={arenaState.selectedAgents}
        weights={arenaState.weights}
        squadConfig={arenaState.squadConfig}
      />

    {:else if phase === 'ANALYSIS'}
      <AnalysisScreen
        subPhase={arenaState.subPhase}
        findings={arenaState.findings}
        chatMessages={arenaState.chatMessages}
        selectedAgents={arenaState.selectedAgents}
        timer={arenaState.timer}
        speed={arenaState.speed}
      />

    {:else if phase === 'HYPOTHESIS'}
      <HypothesisScreen
        hypothesis={arenaState.hypothesis}
        btcPrice={arenaState.btcPrice}
        timer={arenaState.timer}
        consensusDir={arenaState.consensusDir}
        consensusConf={arenaState.consensusConf}
        findings={arenaState.findings}
        councilVotes={arenaState.councilVotes}
        selectedAgents={arenaState.selectedAgents}
      />

    {:else if phase === 'BATTLE'}
      <BattleScreen
        battleState={arenaState.battleState}
        {currentView}
      />

    {:else if phase === 'RESULT'}
      <ResultScreen
        battleResult={arenaState.battleResult}
        lpDelta={arenaState.lpDelta}
        lpBreakdown={arenaState.lpBreakdown}
        fbsScore={arenaState.fbsScore}
        badges={arenaState.badges}
        onGoLobby={handleGoLobby}
        onPlayAgain={handlePlayAgain}
      />
    {/if}
  </div>
</div>

<style>
  .arena-v2 {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100%;
    background: #0A0908;
    color: #F0EDE4;
    font-family: var(--fm, 'JetBrains Mono', monospace);
    overflow: hidden;
  }

  .arena-main {
    flex: 1;
    display: flex;
    position: relative;
    overflow: hidden;
  }

  /* ── Lobby ── */
  .lobby {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .lobby-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    animation: fadeIn 0.5s ease;
  }
  .lobby-logo {
    font-size: 32px;
    font-weight: 900;
    letter-spacing: 8px;
    color: #E8967D;
    font-family: var(--fb, 'Space Grotesk', sans-serif);
  }
  .lobby-subtitle {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 6px;
    color: rgba(240, 237, 228, 0.5);
    margin-top: -8px;
  }
  .lobby-price {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin: 12px 0;
  }
  .price-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 2px;
    color: rgba(240, 237, 228, 0.55);
  }
  .price-value {
    font-size: 24px;
    font-weight: 800;
    color: #F0EDE4;
    font-variant-numeric: tabular-nums;
  }
  .price-loading {
    font-size: 10px;
    color: rgba(240, 237, 228, 0.5);
    animation: blink 2s ease-in-out infinite;
  }

  .btn-start {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 36px;
    border: 2px solid #E8967D;
    border-radius: 12px;
    background: rgba(232, 150, 125, 0.08);
    color: #E8967D;
    font-family: var(--fb, 'Space Grotesk', sans-serif);
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 4px;
    cursor: pointer;
    transition: all 0.2s;
    animation: pulse 2s ease-in-out infinite;
    margin-top: 8px;
  }
  .btn-start:hover {
    background: rgba(232, 150, 125, 0.15);
    transform: scale(1.02);
    box-shadow: 0 0 30px rgba(232, 150, 125, 0.2);
  }
  .btn-icon { font-size: 18px; }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(232, 150, 125, 0); }
    50% { box-shadow: 0 0 20px 0 rgba(232, 150, 125, 0.15); }
  }
  @keyframes blink {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 0.8; }
  }
</style>
