<script lang="ts">
  import '$lib/styles/arena-tone.css';
  import { AGDEFS } from '$lib/data/agents';
  import {
    type WarPhase, WAR_PHASE_DURATION,
    getAIRival, getRandomTaunt, drawAdvantageCards,
    generateMockAIDecision, generateMockCandles, generateMockFBS,
    rollBonusSpin, getRandomNewsEvent,
    type MockAIDecision, type MockFBS, type AdvantageCard, type SpinResult, type MockCandle,
  } from '../../components/arena-war/warMockData';
  import WarSetup from '../../components/arena-war/WarSetup.svelte';
  import WarAnalyzing from '../../components/arena-war/WarAnalyzing.svelte';
  import WarHumanCall from '../../components/arena-war/WarHumanCall.svelte';
  import WarReveal from '../../components/arena-war/WarReveal.svelte';
  import WarBattle from '../../components/arena-war/WarBattle.svelte';
  import WarJudge from '../../components/arena-war/WarJudge.svelte';
  import WarResult from '../../components/arena-war/WarResult.svelte';
  import type { Direction } from '$lib/engine/types';
  import { onDestroy } from 'svelte';

  // ─── War State ───────────────────────────────────────────
  let phase: WarPhase = $state('SETUP');
  let timer = $state(0);
  let timerInterval: ReturnType<typeof setInterval> | null = null;

  // Player persistent state
  let lp = $state(847);
  let wins = $state(8);
  let losses = $state(2);
  let draws = $state(5);
  let streak = $state(3);
  let tier = $state<'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND'>('BRONZE');

  // Match config
  let pair = $state('BTC/USDT');
  let timeframe = $state('4h');
  let battleMode = $state<'quick' | 'live'>('quick');
  let wager = $state(10);

  // AI
  let rival = $derived(getAIRival(tier));
  let aiTaunt = $state('');
  let aiDecision: MockAIDecision | null = $state(null);

  // Human decision
  let humanDir: Direction = $state('NEUTRAL');
  let humanConf = $state(65);
  let humanEntry = $state(0);
  let humanTP = $state(0);
  let humanSL = $state(0);
  let humanRR = $derived(
    humanEntry > 0 && humanSL !== humanEntry
      ? Math.abs(humanTP - humanEntry) / Math.abs(humanEntry - humanSL)
      : 0
  );

  // Cards
  let advantageCards: AdvantageCard[] = $state([]);

  // REVEAL
  let consensusType: 'CONSENSUS' | 'DISSENT' = $state('CONSENSUS');
  let doubleDown = $state(false);

  // BATTLE
  let battleCandles: MockCandle[] = $state([]);
  let currentCandleIdx = $state(0);

  // JUDGE
  let humanFBS: MockFBS = $state({ ds: 0, re: 0, ci: 0, fbs: 0 });
  let aiFBS: MockFBS = $state({ ds: 0, re: 0, ci: 0, fbs: 0 });

  // RESULT
  let matchWon: boolean | null = $state(null);
  let lpDelta = $state(0);
  let bonusSpin: SpinResult | null = $state(null);
  let nearMissDiff = $state(0);

  // ─── Timer ───────────────────────────────────────────────
  function startTimer(duration: number) {
    timer = duration;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      timer -= 1;
      if (timer <= 0) {
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = null;
        onTimerEnd();
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  onDestroy(() => stopTimer());

  // ─── Phase Transitions ──────────────────────────────────
  function setPhase(next: WarPhase) {
    stopTimer();
    phase = next;
    const dur = WAR_PHASE_DURATION[next];
    if (dur > 0) startTimer(dur);
    onPhaseEnter(next);
  }

  function onPhaseEnter(p: WarPhase) {
    switch (p) {
      case 'SETUP':
        aiTaunt = getRandomTaunt(rival, streak >= 5 ? 'streak5' : streak >= 3 ? 'streak3' : 'greet');
        advantageCards = drawAdvantageCards(2);
        break;

      case 'AI_ANALYZE':
        aiDecision = generateMockAIDecision(pair);
        break;

      case 'HUMAN_CALL': {
        const base = pair.includes('BTC') ? 97450 : pair.includes('ETH') ? 3420 : 195;
        humanEntry = base;
        humanTP = Math.round(base * 1.018);
        humanSL = Math.round(base * 0.989);
        humanDir = 'NEUTRAL';
        humanConf = 65;
        break;
      }

      case 'REVEAL':
        if (aiDecision) {
          consensusType = humanDir === aiDecision.direction ? 'CONSENSUS' : 'DISSENT';
          aiTaunt = getRandomTaunt(rival, consensusType === 'CONSENSUS' ? 'consensus' : 'dissent');
        }
        doubleDown = false;
        break;

      case 'BATTLE':
        if (aiDecision) {
          const actualDir = Math.random() > 0.5 ? 'LONG' : 'SHORT';
          battleCandles = generateMockCandles(humanEntry, actualDir as Direction, 24);
        }
        currentCandleIdx = 0;
        break;

      case 'JUDGE': {
        const won = Math.random() > 0.45;
        humanFBS = generateMockFBS(won);
        aiFBS = generateMockFBS(!won);
        matchWon = humanFBS.fbs > aiFBS.fbs;
        nearMissDiff = Math.abs(humanFBS.fbs - aiFBS.fbs);
        break;
      }

      case 'RESULT': {
        if (matchWon) {
          const base = 8;
          const streakBonus = streak >= 3 ? Math.min((streak - 2) * 2, 10) : 0;
          const dissentBonus = consensusType === 'DISSENT' ? 5 : 0;
          lpDelta = base + streakBonus + dissentBonus + wager;
          streak += 1;
          wins += 1;
          bonusSpin = rollBonusSpin();
          if (bonusSpin.lp > 0) lpDelta += bonusSpin.lp;
          aiTaunt = getRandomTaunt(rival, 'playerWin');
        } else if (matchWon === false) {
          lpDelta = -3 - (humanFBS.fbs >= 70 ? 0 : 0) + (humanFBS.fbs >= 80 ? 3 : humanFBS.fbs >= 70 ? 2 : 0);
          // Honorable defeat: FBS 70+ = -1, FBS 80+ = 0
          if (humanFBS.fbs >= 80) lpDelta = 0;
          else if (humanFBS.fbs >= 70) lpDelta = -1;
          else lpDelta = -3;
          lpDelta -= wager;
          streak = 0;
          losses += 1;
          bonusSpin = null;
          aiTaunt = getRandomTaunt(rival, losses >= 3 ? 'losing3' : 'playerLose');
        } else {
          lpDelta = 0;
          draws += 1;
          bonusSpin = null;
        }
        lp = Math.max(0, lp + lpDelta);
        break;
      }
    }
  }

  function onTimerEnd() {
    switch (phase) {
      case 'AI_ANALYZE': setPhase('HUMAN_CALL'); break;
      case 'HUMAN_CALL': setPhase('REVEAL'); break;
      case 'REVEAL': setPhase('BATTLE'); break;
      case 'BATTLE': setPhase('JUDGE'); break;
      case 'JUDGE': setPhase('RESULT'); break;
    }
  }

  // ─── User Actions ───────────────────────────────────────
  function onStartWar() {
    setPhase('AI_ANALYZE');
  }

  function onSubmitCall() {
    stopTimer();
    setPhase('REVEAL');
  }

  function onRematch() {
    matchWon = null;
    lpDelta = 0;
    bonusSpin = null;
    setPhase('SETUP');
  }

  function onLobby() {
    stopTimer();
    phase = 'SETUP';
  }

  // ─── Phase Progress ─────────────────────────────────────
  let phaseProgress = $derived(
    ({ SETUP: 0, AI_ANALYZE: 0.15, HUMAN_CALL: 0.35, REVEAL: 0.55, BATTLE: 0.7, JUDGE: 0.88, RESULT: 1 })[phase] ?? 0
  );

  let phaseLabel = $derived(
    ({ SETUP: 'SETUP', AI_ANALYZE: 'ANALYZING', HUMAN_CALL: 'YOUR CALL', REVEAL: 'REVEAL', BATTLE: 'BATTLE', JUDGE: 'JUDGING', RESULT: 'RESULT' })[phase] ?? ''
  );
</script>

<div class="war-page arena-page">
  <!-- Top Bar -->
  <header class="war-header">
    <div class="war-logo">
      <span class="war-icon">🧠</span>
      <span class="war-title">ARENA WAR</span>
    </div>
    <div class="war-phase-bar">
      <div class="phase-label">{phaseLabel}</div>
      <div class="phase-track">
        <div class="phase-fill" style="width:{phaseProgress * 100}%"></div>
      </div>
      {#if timer > 0}
        <div class="phase-timer" class:urgent={timer <= 5}>{timer}s</div>
      {/if}
    </div>
    <div class="war-stats">
      <span class="stat-badge tier-{tier.toLowerCase()}">{tier}</span>
      <span class="stat-lp">LP {lp}</span>
    </div>
  </header>

  <!-- Main Content -->
  <main class="war-main">
    {#if phase === 'SETUP'}
      <WarSetup
        {pair} {timeframe} {battleMode} {wager}
        {wins} {losses} {draws} {streak} {lp} {tier}
        {aiTaunt} rival={rival}
        cards={advantageCards}
        onpairchange={(p) => pair = p}
        ontfchange={(t) => timeframe = t}
        onmodechange={(m) => battleMode = m}
        onwagerchange={(w) => wager = w}
        onstart={onStartWar}
      />
    {:else if phase === 'AI_ANALYZE'}
      <WarAnalyzing {timer} rival={rival} />
    {:else if phase === 'HUMAN_CALL'}
      <WarHumanCall
        {pair} {timeframe} {timer}
        bind:direction={humanDir}
        bind:confidence={humanConf}
        bind:entry={humanEntry}
        bind:tp={humanTP}
        bind:sl={humanSL}
        rr={humanRR}
        cards={advantageCards}
        aiDecision={aiDecision}
        onsubmit={onSubmitCall}
      />
    {:else if phase === 'REVEAL'}
      <WarReveal
        humanDir={humanDir} humanConf={humanConf} humanEntry={humanEntry} humanTP={humanTP} humanSL={humanSL} humanRR={humanRR}
        aiDecision={aiDecision}
        {consensusType} {timer}
        rival={rival}
        taunt={aiTaunt}
        bind:doubleDown={doubleDown}
      />
    {:else if phase === 'BATTLE'}
      <WarBattle
        {pair} {timer}
        candles={battleCandles}
        bind:currentCandleIdx={currentCandleIdx}
        humanEntry={humanEntry} humanTP={humanTP} humanSL={humanSL} humanDir={humanDir} humanConf={humanConf}
        aiDecision={aiDecision}
      />
    {:else if phase === 'JUDGE'}
      <WarJudge {humanFBS} {aiFBS} {timer} {matchWon} {nearMissDiff} />
    {:else if phase === 'RESULT'}
      <WarResult
        {matchWon} {lpDelta} {bonusSpin} {humanFBS} {aiFBS}
        {streak} {wins} {losses} {draws} {wager} {consensusType} {nearMissDiff}
        taunt={aiTaunt} rival={rival}
        onrematch={onRematch}
        onlobby={onLobby}
      />
    {/if}
  </main>
</div>

<style>
  .war-page {
    min-height: 100vh;
    background: var(--arena-bg-0, #07130d);
    color: var(--arena-text, #f0ede4);
    display: flex;
    flex-direction: column;
    --war-accent: #c840ff;
    --war-accent-dim: rgba(200, 64, 255, 0.3);
    --war-accent-glow: rgba(200, 64, 255, 0.15);
  }

  .war-header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 20px;
    background: var(--arena-bg-1, #0a1a0d);
    border-bottom: 1px solid var(--war-accent-dim);
    z-index: 20;
  }

  .war-logo {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .war-icon { font-size: 20px; }
  .war-title {
    font-family: var(--fc, 'Impact', sans-serif);
    font-size: 16px;
    font-weight: 900;
    letter-spacing: 3px;
    color: var(--war-accent);
    text-shadow: 0 0 12px var(--war-accent-dim);
  }

  .war-phase-bar {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .phase-label {
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 2px;
    color: var(--war-accent);
    font-family: var(--fm, monospace);
    min-width: 90px;
  }
  .phase-track {
    flex: 1;
    height: 4px;
    background: rgba(200, 64, 255, 0.1);
    border-radius: 4px;
    overflow: hidden;
  }
  .phase-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--war-accent), #e8967d);
    border-radius: 4px;
    transition: width 0.5s ease;
  }
  .phase-timer {
    font-size: 14px;
    font-weight: 900;
    font-family: var(--fm, monospace);
    color: var(--arena-text);
    min-width: 36px;
    text-align: right;
  }
  .phase-timer.urgent {
    color: var(--arena-bad, #ff5e7a);
    animation: timerPulse 0.5s ease-in-out infinite;
  }
  @keyframes timerPulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.7; transform: scale(1.1); }
  }

  .war-stats {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .stat-badge {
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 1.5px;
    padding: 3px 10px;
    border-radius: 20px;
    border: 1px solid;
  }
  .stat-badge.tier-bronze { color: #cd7f32; border-color: rgba(205,127,50,.4); background: rgba(205,127,50,.1); }
  .stat-badge.tier-silver { color: #c0c0c0; border-color: rgba(192,192,192,.4); background: rgba(192,192,192,.1); }
  .stat-badge.tier-gold { color: #ffd060; border-color: rgba(255,208,96,.4); background: rgba(255,208,96,.1); }
  .stat-badge.tier-diamond { color: #66cce6; border-color: rgba(102,204,230,.4); background: rgba(102,204,230,.1); }
  .stat-lp {
    font-size: 13px;
    font-weight: 700;
    font-family: var(--fm, monospace);
    color: var(--arena-warn, #dcb970);
  }

  .war-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
</style>
