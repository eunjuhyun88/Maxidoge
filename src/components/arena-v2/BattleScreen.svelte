<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { AGDEFS } from '$lib/data/agents';
  import type {
    V2BattleState,
    V2BattleConfig,
    V2BattleAgent,
    BattleLogEntry,
    BattleMilestone,
    TickResult,
    AgentBattleState,
    AgentAbilities,
  } from '$lib/engine/v2BattleTypes';
  import { V2_BATTLE_CONSTANTS as C, TIER_DIFFICULTY } from '$lib/engine/v2BattleTypes';
  import { initBattle, processTick, applyPlayerAction } from '$lib/engine/v2BattleEngine';
  import { findTeamSynergies } from '$lib/engine/teamSynergy';
  import {
    arenaV2State,
    v2UpdateBattleState,
    v2SetBattleResult,
    v2SetView,
    type V2ArenaView,
  } from '$lib/stores/arenaV2State';

  // Sub-views
  import BattleChartView from './BattleChartView.svelte';
  import BattleMissionView from './BattleMissionView.svelte';
  import BattleCardView from './BattleCardView.svelte';
  import type { Direction, AgentId, AgentRole } from '$lib/engine/types';

  // ── Props ──
  export let battleState: V2BattleState | null = null;
  export let currentView: V2ArenaView = 'arena';

  // ── Local state ──
  let tickInterval: ReturnType<typeof setInterval> | null = null;
  let resultTimeout: ReturnType<typeof setTimeout> | null = null;
  let initialized = false;

  // Screen shake
  let shakeX = 0;
  let shakeY = 0;
  let shakeTimer: ReturnType<typeof setTimeout> | null = null;

  // Floating damage numbers
  let damageNumbers: Array<{
    id: string;
    value: number;
    color: string;
    agentId: string;
  }> = [];

  // Milestone banner
  let activeMilestone: string | null = null;
  let milestoneColor = '#FFD700';
  let milestoneTimer: ReturnType<typeof setTimeout> | null = null;

  // End overlay
  let endOverlay: { text: string; sub: string; color: string } | null = null;

  // Combo flash
  let comboFlash = false;

  // ── Derived battle data ──
  $: bs = battleState;
  $: tickN = bs?.tickN ?? 0;
  $: maxTicks = bs?.maxTicks ?? 24;
  $: vs = bs?.vsMeter.value ?? 50;
  $: combo = bs?.combo.count ?? 0;
  $: maxCombo = bs?.combo.maxCombo ?? 0;
  $: currentPrice = bs?.currentPrice ?? 0;
  $: entryPrice = bs?.config.entryPrice ?? 0;
  $: direction = bs?.config.direction ?? 'LONG';
  $: agentStates = bs ? Object.values(bs.agentStates) : [];
  $: log = bs?.log.slice(-5) ?? [];
  $: status = bs?.status ?? 'waiting';
  $: pnl = entryPrice > 0
    ? (direction === 'LONG'
      ? ((currentPrice - entryPrice) / entryPrice) * 100
      : ((entryPrice - currentPrice) / entryPrice) * 100)
    : 0;

  $: tpPrice = bs?.config.tpPrice ?? 0;
  $: slPrice = bs?.config.slPrice ?? 0;
  $: tpDistPct = entryPrice > 0 ? ((Math.abs(tpPrice - entryPrice) / entryPrice) * 100) : 0;
  $: slDistPct = entryPrice > 0 ? ((Math.abs(slPrice - entryPrice) / entryPrice) * 100) : 0;
  $: tpProgress = tpDistPct > 0 ? Math.min(1, Math.max(0, Math.max(0, pnl) / tpDistPct)) : 0;
  $: slProgress = slDistPct > 0 ? Math.min(1, Math.max(0, Math.abs(Math.min(0, pnl)) / slDistPct)) : 0;

  // Player actions
  $: focusLeft = bs?.playerActions.tacticalFocusUsesLeft ?? 0;
  $: recallLeft = bs?.playerActions.emergencyRecallUsesLeft ?? 0;
  $: focusCooldown = bs ? bs.playerActions.tacticalFocusCooldownTick >= bs.tickN : false;
  $: activeFocusAgent = bs?.playerActions.activeFocusAgentId ?? null;

  // VS sparkline
  $: vsHistory = bs?.vsMeter.history ?? [50];

  // Tick progress as percentage
  $: tickPct = maxTicks > 0 ? (tickN / maxTicks) * 100 : 0;

  // Latest tick info
  $: latestTick = bs?.tickResults[bs.tickResults.length - 1] ?? null;
  $: tickClass = latestTick?.classifiedTick.tickClass ?? 'NEUTRAL';

  // ── Agent lookup helpers ──
  function getAgentDef(agentId: string) {
    return AGDEFS.find(a => a.id === agentId.toLowerCase());
  }

  function getAgentImg(agentId: string, animState: string): string {
    const def = getAgentDef(agentId);
    if (!def) return '/doge/char-structure.png';
    switch (animState) {
      case 'CELEBRATE': return def.img.win;
      case 'PANIC': case 'IMPACT': return def.img.alt;
      default: return def.img.def;
    }
  }

  function getAgentName(agentId: string): string {
    const def = getAgentDef(agentId);
    return def?.name ?? agentId;
  }

  function getAgentIcon(agentId: string): string {
    const def = getAgentDef(agentId);
    return def?.icon ?? '🐕';
  }

  function getRoleColor(role: string): string {
    switch (role) {
      case 'OFFENSE': return '#ff4444';
      case 'DEFENSE': return '#4488ff';
      case 'CONTEXT': return '#aa44ff';
      default: return '#F0EDE4';
    }
  }

  function getActionIcon(action: string): string {
    const icons: Record<string, string> = {
      DASH: '⚡', BURST: '💥', FINISHER: '🌟', SHIELD: '🛡',
      PING: '📡', HOOK: '🪝', ASSIST: '✨', TAUNT: '😤',
      IDLE: '💤', RECOVER: '💚',
    };
    return icons[action] ?? '·';
  }

  function getRole(roleStr: string): AgentRole {
    const roleMap: Record<string, AgentRole> = {
      'Chart Structure': 'OFFENSE', 'Volume Profile': 'OFFENSE',
      'ICT Concepts': 'OFFENSE', 'Smart Money': 'OFFENSE',
      'Derivatives': 'DEFENSE', 'On-Chain Value': 'DEFENSE',
      'Fund Flow': 'DEFENSE', 'Capital Flow': 'DEFENSE',
      'Sentiment': 'CONTEXT', 'Social Sentiment': 'CONTEXT',
      'Macro Global': 'CONTEXT', 'Macro': 'CONTEXT',
    };
    return roleMap[roleStr] ?? 'CONTEXT';
  }

  // ── VS sparkline SVG path ──
  function vsSparkline(history: number[]): string {
    if (history.length < 2) return '';
    const w = 120;
    const h = 28;
    const step = w / Math.max(history.length - 1, 1);
    return history.map((v, i) => {
      const x = i * step;
      const y = h - (v / 100) * h;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }

  // ── Initialize battle on mount ──
  function initializeBattle() {
    if (initialized) return;
    const state = $arenaV2State;
    if (!state.hypothesis || state.selectedAgents.length < 3 || state.btcPrice <= 0) return;

    const hyp = state.hypothesis;

    // Build V2BattleAgent array (convert lowercase IDs → uppercase)
    const agents: V2BattleAgent[] = state.selectedAgents.map(lowerId => {
      const upperId = lowerId.toUpperCase() as AgentId;
      const def = AGDEFS.find(a => a.id === lowerId);
      const weight = state.weights[lowerId] ?? 33;
      const role: AgentRole = getRole(def?.role ?? '');
      const abilities: AgentAbilities = def?.abilities ?? { analysis: 65, accuracy: 65, speed: 65, instinct: 65 };
      return {
        agentId: upperId,
        role,
        weight,
        abilities,
        specBonuses: { primaryActionBonus: 0, secondaryActionPenalty: 0, critBonus: 0, targetActions: [] },
      };
    });

    const agentIds = agents.map(a => a.agentId);
    const synergies = findTeamSynergies(agentIds);

    // Finding directions from analysis
    const findingDirections: Record<string, Direction> = {};
    for (const f of state.findings) {
      findingDirections[f.agentId.toUpperCase()] = f.direction;
    }

    // ATR estimate (0.1% of price)
    const atr1m = state.btcPrice * 0.001;
    const tier = TIER_DIFFICULTY['BRONZE'];

    const config: V2BattleConfig = {
      entryPrice: hyp.entry || state.btcPrice,
      tpPrice: hyp.tp,
      slPrice: hyp.sl,
      direction: hyp.dir === 'NEUTRAL' ? 'LONG' : hyp.dir,
      agents,
      synergyIds: synergies.map(s => s.id),
      councilConsensus: state.consensusType ?? 'split',
      hypothesisRR: hyp.rr,
      findingDirections: findingDirections as Record<AgentId, Direction>,
      tierVSStart: tier.vsStart,
      tierTickCount: tier.maxTicks,
      tierAIBonus: tier.aiBonus,
      atr1m,
    };

    const initial = initBattle(config);
    v2UpdateBattleState(initial);
    initialized = true;
    startTickLoop();
  }

  function startTickLoop() {
    if (tickInterval) clearInterval(tickInterval);

    tickInterval = setInterval(() => {
      const state = $arenaV2State;
      if (!state.battleState || state.battleState.status !== 'running') {
        if (tickInterval) clearInterval(tickInterval);
        return;
      }

      const price = state.btcPrice;
      if (price <= 0) return;

      const newState = processTick(state.battleState, price);
      v2UpdateBattleState(newState);

      // Handle visual effects
      const latest = newState.tickResults[newState.tickResults.length - 1];
      if (latest) handleTickEffects(latest);

      // Check battle end
      if (newState.status === 'finished' && newState.result) {
        if (tickInterval) clearInterval(tickInterval);

        // Show end overlay
        const r = newState.result;
        if (r.outcome === 'tp_hit') {
          endOverlay = { text: 'TARGET ACHIEVED', sub: `+${r.finalPnL.toFixed(2)}%`, color: '#00ff88' };
        } else if (r.outcome === 'sl_hit') {
          endOverlay = { text: 'STOPPED OUT', sub: `${r.finalPnL.toFixed(2)}%`, color: '#ff2d55' };
        } else if (r.outcome === 'timeout_win') {
          endOverlay = { text: 'TIME UP — WIN', sub: `+${r.finalPnL.toFixed(2)}%`, color: '#00ff88' };
        } else {
          endOverlay = { text: 'TIME UP — LOSS', sub: `${r.finalPnL.toFixed(2)}%`, color: '#ff2d55' };
        }

        // Transition to RESULT after delay
        resultTimeout = setTimeout(() => {
          v2SetBattleResult(newState.result!);
          resultTimeout = null;
        }, 2500);
      }
    }, C.TICK_INTERVAL_MS);
  }

  // ── Visual effects ──
  function handleTickEffects(tick: TickResult) {
    // Milestones
    for (const ms of tick.milestones) {
      if (ms.screenShakeIntensity > 0) {
        triggerShake(ms.screenShakeIntensity, ms.screenShakeDuration);
      }
      const isRed = ms.type === 'DANGER_ZONE' || ms.type === 'FINDING_CHALLENGED' || ms.type === 'EXHAUSTED';
      showMilestone(ms.detail, isRed ? '#ff2d55' : '#FFD700');
    }

    // Damage numbers
    for (const action of tick.agentActions) {
      if (action.damageNumber !== null) {
        addDamageNumber(action.agentId, action.damageNumber, action.damageColor);
      }
    }

    // Screen shake on strong ticks
    if (tick.classifiedTick.tickClass === 'STRONG_FAVORABLE' || tick.classifiedTick.tickClass === 'STRONG_UNFAVORABLE') {
      triggerShake(5, 200);
    }

    // Combo flash
    if (tick.comboAfter > tick.comboBefore && tick.comboAfter >= 2) {
      comboFlash = true;
      setTimeout(() => { comboFlash = false; }, 600);
    }
  }

  function triggerShake(intensity: number, duration: number) {
    if (shakeTimer) clearTimeout(shakeTimer);
    shakeX = (Math.random() - 0.5) * intensity * 2;
    shakeY = (Math.random() - 0.5) * intensity * 2;
    shakeTimer = setTimeout(() => { shakeX = 0; shakeY = 0; }, duration);
  }

  function addDamageNumber(agentId: string, value: number, color: string) {
    const id = crypto.randomUUID();
    damageNumbers = [...damageNumbers, { id, value, color, agentId }];
    setTimeout(() => {
      damageNumbers = damageNumbers.filter(d => d.id !== id);
    }, 1200);
  }

  function showMilestone(text: string, color: string) {
    activeMilestone = text;
    milestoneColor = color;
    if (milestoneTimer) clearTimeout(milestoneTimer);
    milestoneTimer = setTimeout(() => { activeMilestone = null; }, 2500);
  }

  // ── Player actions ──
  function handleTacticalFocus(agentId: string) {
    if (!bs || focusLeft <= 0 || focusCooldown) return;
    const newState = applyPlayerAction(bs, 'TACTICAL_FOCUS', agentId as AgentId);
    v2UpdateBattleState(newState);
    showMilestone(`FOCUS → ${agentId}!`, '#FFD700');
  }

  function handleEmergencyRecall(agentId: string) {
    if (!bs || recallLeft <= 0) return;
    const newState = applyPlayerAction(bs, 'EMERGENCY_RECALL', agentId as AgentId);
    v2UpdateBattleState(newState);
    showMilestone(`RECALL ${agentId}!`, '#FF6B6B');
  }

  // ── View switching ──
  const views: { key: V2ArenaView; icon: string; label: string }[] = [
    { key: 'arena', icon: '⚔', label: 'Arena' },
    { key: 'chart', icon: '📊', label: 'Chart' },
    { key: 'mission', icon: '🖥', label: 'Mission' },
    { key: 'card', icon: '🃏', label: 'Card' },
  ];

  // ── Reactive init retry (for when btcPrice arrives after mount) ──
  $: if ($arenaV2State.hypothesis && $arenaV2State.btcPrice > 0 && !initialized) {
    initializeBattle();
  }

  // ── Lifecycle ──
  onMount(() => {
    initializeBattle();
  });

  onDestroy(() => {
    if (tickInterval) clearInterval(tickInterval);
    if (resultTimeout) clearTimeout(resultTimeout);
    if (shakeTimer) clearTimeout(shakeTimer);
    if (milestoneTimer) clearTimeout(milestoneTimer);
  });
</script>

<!-- ═══════════════════════════════════════════════ -->
<!-- BATTLE SCREEN — Agent Arena View               -->
<!-- ═══════════════════════════════════════════════ -->

<div class="battle-screen" style:transform="translate({shakeX}px, {shakeY}px)">

  <!-- ── Top Bar ── -->
  <div class="top-bar">
    <div class="top-left">
      <span class="tick-label">TICK</span>
      <span class="tick-val">{tickN}<span class="tick-max">/{maxTicks}</span></span>
      <div class="tick-bar">
        <div class="tick-fill" style:width="{tickPct}%" />
      </div>
    </div>

    <div class="top-center">
      {#if combo >= 2}
        <span class="combo-badge" class:combo-flash={comboFlash}>
          🔥 {combo}-HIT COMBO
        </span>
      {/if}
    </div>

    <div class="top-right">
      <div class="view-picker">
        {#each views as v, i}
          <button
            class="view-btn"
            class:active={currentView === v.key}
            on:click={() => v2SetView(v.key)}
            title="{v.label} ({i + 1})"
          >
            <span class="view-icon">{v.icon}</span>
            <span class="view-key">{i + 1}</span>
          </button>
        {/each}
      </div>
    </div>
  </div>

  <!-- ═══ VIEW CONTENT AREA ═══ -->
  {#if currentView === 'chart'}
    <BattleChartView {battleState} />
  {:else if currentView === 'mission'}
    <BattleMissionView {battleState} />
  {:else if currentView === 'card'}
    <BattleCardView {battleState} />
  {:else}
    <!-- ── Arena View (default) ── -->

    <!-- VS Meter Bar -->
    <div class="vs-bar">
      <span class="vs-label-left" class:winning={vs > 55}>YOU</span>
      <div class="vs-track">
        <div class="vs-fill" style:width="{vs}%"
          class:vs-winning={vs >= 60}
          class:vs-losing={vs <= 40}
          class:vs-danger={vs <= 25}
        />
        <div class="vs-center-mark" />
        <span class="vs-value">{vs.toFixed(0)}</span>
      </div>
      <span class="vs-label-right" class:winning={vs < 45}>MKT</span>
    </div>

    <!-- Main Area (2 columns) -->
    <div class="main-area">
    <!-- Left: Price + TP/SL + Sparkline -->
    <div class="info-panel">
      <!-- Price info -->
      <div class="price-block">
        <div class="price-current">
          <span class="price-dir">{direction === 'LONG' ? '▲' : '▼'}</span>
          <span class="price-val">${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
        </div>
        <div class="price-entry">
          Entry: ${entryPrice.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
        </div>
        <div class="price-pnl" class:positive={pnl >= 0} class:negative={pnl < 0}>
          {pnl >= 0 ? '+' : ''}{pnl.toFixed(3)}%
        </div>
      </div>

      <!-- TP/SL Progress -->
      <div class="tp-sl-block">
        <div class="tp-row">
          <span class="tp-label">TP</span>
          <div class="tp-track">
            <div class="tp-fill" style:width="{tpProgress * 100}%" />
          </div>
          <span class="tp-val">{tpDistPct.toFixed(2)}%</span>
        </div>
        <div class="sl-row">
          <span class="sl-label">SL</span>
          <div class="sl-track">
            <div class="sl-fill" style:width="{slProgress * 100}%" />
          </div>
          <span class="sl-val">{slDistPct.toFixed(2)}%</span>
        </div>
      </div>

      <!-- VS Sparkline -->
      <div class="sparkline-block">
        <span class="sparkline-label">VS TREND</span>
        <svg class="sparkline-svg" viewBox="0 0 120 28" preserveAspectRatio="none">
          <line x1="0" y1="14" x2="120" y2="14" stroke="rgba(240,237,228,0.1)" stroke-width="0.5" />
          <path d={vsSparkline(vsHistory)} fill="none" stroke={vs >= 50 ? '#00ff88' : '#ff2d55'} stroke-width="1.5" />
        </svg>
      </div>

      <!-- Player Actions (per-agent buttons in agent cards below) -->
      <div class="player-actions-summary">
        <span class="pa-stat">🎯 FOCUS: {focusLeft}</span>
        <span class="pa-stat">🚨 RECALL: {recallLeft}</span>
      </div>
    </div>

    <!-- Right: Battle Zone -->
    <div class="battle-zone">
      <!-- Market (Top) -->
      <div class="market-side">
        <div class="market-entity" class:market-attacking={tickClass === 'UNFAVORABLE' || tickClass === 'STRONG_UNFAVORABLE'}>
          <span class="market-icon">📉</span>
          <span class="market-label">MARKET</span>
        </div>
        {#if tickClass === 'UNFAVORABLE' || tickClass === 'STRONG_UNFAVORABLE'}
          <div class="market-attack-line" />
        {/if}
      </div>

      <!-- Center: Combat effects + tick class indicator -->
      <div class="combat-center">
        <div class="tick-class-badge"
          class:fav={tickClass === 'FAVORABLE' || tickClass === 'STRONG_FAVORABLE'}
          class:unfav={tickClass === 'UNFAVORABLE' || tickClass === 'STRONG_UNFAVORABLE'}
          class:neutral={tickClass === 'NEUTRAL'}
        >
          {#if tickClass === 'STRONG_FAVORABLE'}⚡ STRONG{:else if tickClass === 'FAVORABLE'}▲ FAV{:else if tickClass === 'NEUTRAL'}— HOLD{:else if tickClass === 'UNFAVORABLE'}▼ UNFAV{:else}⚡ DANGER{/if}
        </div>
      </div>

      <!-- Agents (Bottom) -->
      <div class="agent-row">
        {#each agentStates as agent (agent.agentId)}
          {@const def = getAgentDef(agent.agentId)}
          {@const isFocused = activeFocusAgent === agent.agentId}
          <div
            class="agent-card"
            class:agent-attacking={agent.animState === 'CAST' || agent.animState === 'WINDUP'}
            class:agent-shielding={agent.currentAction === 'SHIELD'}
            class:agent-exhausted={agent.isExhausted}
            class:agent-focused={isFocused}
          >
            <!-- Action icon -->
            <div class="agent-action-badge">
              {getActionIcon(agent.currentAction)}
              <span class="action-label">{agent.currentAction}</span>
            </div>

            <!-- Speech bubble -->
            {#each (bs?.tickResults.slice(-1) ?? []) as tr}
              {#each tr.agentActions.filter(a => a.agentId === agent.agentId && a.speechBubble) as act}
                <div class="speech-bubble">
                  {act.speechBubble}
                </div>
              {/each}
            {/each}

            <!-- Damage numbers -->
            {#each damageNumbers.filter(d => d.agentId === agent.agentId) as dmg (dmg.id)}
              <div class="damage-number" class:dmg-green={dmg.color === 'green'} class:dmg-red={dmg.color === 'red'} class:dmg-gold={dmg.color === 'gold'}>
                {dmg.color === 'red' ? '-' : '+'}{dmg.value.toFixed(1)}
              </div>
            {/each}

            <!-- Character image -->
            <div class="agent-sprite" style:border-color={getRoleColor(agent.role)}>
              <img
                src={getAgentImg(agent.agentId, agent.animState)}
                alt={agent.agentId}
                class="agent-img"
                class:img-attacking={agent.animState === 'CAST'}
                class:img-windup={agent.animState === 'WINDUP'}
                class:img-shielding={agent.currentAction === 'SHIELD'}
                class:img-recover={agent.animState === 'RECOVER'}
                class:img-exhausted={agent.isExhausted}
              />
              {#if agent.currentAction === 'SHIELD'}
                <div class="shield-overlay" />
              {/if}
              {#if agent.findingValidated === true}
                <div class="validated-badge">✓</div>
              {:else if agent.findingValidated === false}
                <div class="challenged-badge">✗</div>
              {/if}
            </div>

            <!-- Name + role -->
            <div class="agent-name">{agent.agentId}</div>

            <!-- Energy bar -->
            <div class="energy-bar">
              <div class="energy-fill"
                style:width="{(agent.energy / agent.maxEnergy) * 100}%"
                class:energy-low={agent.energy < 25}
                class:energy-crit={agent.energy < 10}
              />
            </div>
            <div class="energy-val">{Math.round(agent.energy)}</div>

            <!-- Focus/Recall target buttons -->
            {#if status === 'running'}
              <div class="agent-target-btns">
                {#if focusLeft > 0 && !focusCooldown}
                  <button class="micro-btn" on:click={() => handleTacticalFocus(agent.agentId)} title="Focus">🎯</button>
                {/if}
                {#if recallLeft > 0 && agent.energy < 40}
                  <button class="micro-btn recall" on:click={() => handleEmergencyRecall(agent.agentId)} title="Recall">🚨</button>
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </div>

    <!-- Battle Log -->
    <div class="battle-log">
      {#each log as entry (entry.timestamp + entry.message)}
        <div class="log-entry" style:color={entry.color ?? '#F0EDE4'}>
          {#if entry.icon}<span class="log-icon">{entry.icon}</span>{/if}
          <span class="log-msg">{entry.message}</span>
        </div>
      {/each}
    </div>
  {/if}
  <!-- ═══ END VIEW CONTENT ═══ -->

  <!-- ── Milestone Banner Overlay ── -->
  {#if activeMilestone}
    <div class="milestone-banner" style:color={milestoneColor} style:text-shadow="0 0 20px {milestoneColor}">
      {activeMilestone}
    </div>
  {/if}

  <!-- ── End Overlay ── -->
  {#if endOverlay}
    <div class="end-overlay">
      <div class="end-text" style:color={endOverlay.color}>
        {endOverlay.text}
      </div>
      <div class="end-sub" style:color={endOverlay.color}>
        {endOverlay.sub}
      </div>
    </div>
  {/if}

  <!-- ── Loading state ── -->
  {#if !bs}
    <div class="loading-overlay">
      <span class="loading-text">INITIALIZING BATTLE...</span>
    </div>
  {/if}
</div>

<style>
  .battle-screen {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: #0A0908;
    color: #F0EDE4;
    font-family: var(--fm, 'JetBrains Mono', monospace);
    overflow: hidden;
    position: relative;
    transition: transform 50ms ease-out;
  }

  /* ── Top Bar ── */
  .top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    border-bottom: 1px solid rgba(240,237,228,0.06);
    height: 40px;
    flex-shrink: 0;
  }
  .top-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .tick-label {
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 2px;
    color: rgba(240,237,228,0.4);
  }
  .tick-val {
    font-size: 14px;
    font-weight: 900;
    color: #F0EDE4;
  }
  .tick-max {
    font-size: 10px;
    color: rgba(240,237,228,0.3);
  }
  .tick-bar {
    width: 80px;
    height: 4px;
    background: rgba(240,237,228,0.08);
    border-radius: 2px;
    overflow: hidden;
  }
  .tick-fill {
    height: 100%;
    background: linear-gradient(90deg, #E8967D, #cc0033);
    border-radius: 2px;
    transition: width 300ms ease;
  }

  .top-center {
    display: flex;
    align-items: center;
  }
  .combo-badge {
    font-size: 12px;
    font-weight: 900;
    color: #FFD700;
    letter-spacing: 2px;
    padding: 3px 12px;
    border: 1px solid rgba(255,215,0,0.3);
    border-radius: 4px;
    background: rgba(255,215,0,0.06);
    transition: all 200ms;
  }
  .combo-flash {
    background: rgba(255,215,0,0.2);
    box-shadow: 0 0 20px rgba(255,215,0,0.3);
    transform: scale(1.1);
  }

  .top-right { display: flex; }
  .view-picker { display: flex; gap: 4px; }
  .view-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    padding: 4px 10px;
    border: 1px solid rgba(240,237,228,0.1);
    border-radius: 6px;
    background: transparent;
    color: rgba(240,237,228,0.3);
    cursor: pointer;
    transition: all 150ms;
    font-family: inherit;
  }
  .view-btn:hover {
    border-color: rgba(240,237,228,0.2);
    color: rgba(240,237,228,0.6);
  }
  .view-btn.active {
    border-color: #E8967D;
    color: #E8967D;
    background: rgba(232,150,125,0.08);
  }
  .view-icon { font-size: 14px; }
  .view-key {
    font-size: 7px;
    font-weight: 700;
    letter-spacing: 1px;
    opacity: 0.5;
  }

  /* ── VS Meter ── */
  .vs-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 16px;
    flex-shrink: 0;
  }
  .vs-label-left, .vs-label-right {
    font-size: 8px;
    font-weight: 900;
    letter-spacing: 2px;
    color: rgba(240,237,228,0.3);
    width: 32px;
    text-align: center;
    transition: color 300ms;
  }
  .vs-label-left.winning { color: #00ff88; }
  .vs-label-right.winning { color: #ff2d55; }
  .vs-track {
    flex: 1;
    height: 8px;
    background: rgba(240,237,228,0.06);
    border-radius: 4px;
    position: relative;
    overflow: hidden;
  }
  .vs-fill {
    height: 100%;
    background: linear-gradient(90deg, #00ff88, #00cc66);
    border-radius: 4px;
    transition: width 400ms ease;
  }
  .vs-fill.vs-winning {
    background: linear-gradient(90deg, #00ff88, #44ffaa);
    box-shadow: 0 0 8px rgba(0,255,136,0.3);
  }
  .vs-fill.vs-losing {
    background: linear-gradient(90deg, #ff6644, #cc3300);
  }
  .vs-fill.vs-danger {
    background: linear-gradient(90deg, #ff2d55, #cc0033);
    animation: vsPulse 0.8s ease-in-out infinite;
  }
  .vs-center-mark {
    position: absolute;
    left: 50%;
    top: -1px;
    bottom: -1px;
    width: 2px;
    background: rgba(240,237,228,0.2);
    transform: translateX(-50%);
  }
  .vs-value {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 7px;
    font-weight: 800;
    color: rgba(240,237,228,0.5);
  }

  @keyframes vsPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  /* ── Main Area ── */
  .main-area {
    flex: 1;
    display: flex;
    overflow: hidden;
    min-height: 0;
  }

  /* ── Info Panel (Left) ── */
  .info-panel {
    width: 240px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px 16px;
    border-right: 1px solid rgba(240,237,228,0.06);
    flex-shrink: 0;
    overflow-y: auto;
  }

  .price-block {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .price-current {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .price-dir {
    font-size: 14px;
    color: #00ff88;
  }
  .price-val {
    font-size: 20px;
    font-weight: 900;
    color: #F0EDE4;
    font-variant-numeric: tabular-nums;
  }
  .price-entry {
    font-size: 9px;
    color: rgba(240,237,228,0.3);
  }
  .price-pnl {
    font-size: 16px;
    font-weight: 900;
    font-variant-numeric: tabular-nums;
  }
  .price-pnl.positive { color: #00ff88; }
  .price-pnl.negative { color: #ff2d55; }

  /* TP/SL bars */
  .tp-sl-block {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .tp-row, .sl-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .tp-label, .sl-label {
    font-size: 8px;
    font-weight: 900;
    letter-spacing: 1px;
    width: 18px;
  }
  .tp-label { color: #00ff88; }
  .sl-label { color: #ff2d55; }
  .tp-track, .sl-track {
    flex: 1;
    height: 6px;
    background: rgba(240,237,228,0.06);
    border-radius: 3px;
    overflow: hidden;
  }
  .tp-fill {
    height: 100%;
    background: #00ff88;
    border-radius: 3px;
    transition: width 400ms;
  }
  .sl-fill {
    height: 100%;
    background: #ff2d55;
    border-radius: 3px;
    transition: width 400ms;
  }
  .tp-val, .sl-val {
    font-size: 9px;
    font-weight: 700;
    color: rgba(240,237,228,0.4);
    width: 42px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  /* Sparkline */
  .sparkline-block {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px;
    background: rgba(240,237,228,0.02);
    border-radius: 6px;
    border: 1px solid rgba(240,237,228,0.04);
  }
  .sparkline-label {
    font-size: 7px;
    font-weight: 700;
    letter-spacing: 2px;
    color: rgba(240,237,228,0.3);
  }
  .sparkline-svg {
    width: 100%;
    height: 28px;
  }

  /* Player Actions Summary */
  .player-actions-summary {
    display: flex;
    gap: 12px;
    margin-top: auto;
    padding: 6px 0;
  }
  .pa-stat {
    font-size: 8px;
    font-weight: 700;
    color: rgba(240,237,228,0.35);
    letter-spacing: 1px;
  }

  /* ── Battle Zone (Right) ── */
  .battle-zone {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 12px;
    gap: 8px;
    min-width: 0;
  }

  /* Market side */
  .market-side {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    padding: 8px;
    position: relative;
  }
  .market-entity {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 16px;
    border: 1px solid rgba(255,45,85,0.15);
    border-radius: 8px;
    background: rgba(255,45,85,0.04);
    transition: all 300ms;
  }
  .market-entity.market-attacking {
    border-color: rgba(255,45,85,0.5);
    background: rgba(255,45,85,0.12);
    box-shadow: 0 0 20px rgba(255,45,85,0.2);
    animation: marketPulse 300ms ease;
  }
  .market-icon { font-size: 20px; }
  .market-label {
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 3px;
    color: #ff2d55;
  }
  .market-attack-line {
    position: absolute;
    bottom: -4px;
    left: 50%;
    width: 2px;
    height: 20px;
    background: linear-gradient(180deg, #ff2d55, transparent);
    transform: translateX(-50%);
    animation: attackSlash 300ms ease;
  }

  @keyframes marketPulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
  }
  @keyframes attackSlash {
    from { height: 0; opacity: 0; }
    to { height: 20px; opacity: 1; }
  }

  /* Combat center */
  .combat-center {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 4px;
  }
  .tick-class-badge {
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 2px;
    padding: 3px 12px;
    border-radius: 4px;
    border: 1px solid rgba(240,237,228,0.1);
    transition: all 300ms;
  }
  .tick-class-badge.fav {
    color: #00ff88;
    border-color: rgba(0,255,136,0.3);
    background: rgba(0,255,136,0.06);
  }
  .tick-class-badge.unfav {
    color: #ff2d55;
    border-color: rgba(255,45,85,0.3);
    background: rgba(255,45,85,0.06);
  }
  .tick-class-badge.neutral {
    color: rgba(240,237,228,0.4);
    border-color: rgba(240,237,228,0.08);
  }

  /* Agent row */
  .agent-row {
    display: flex;
    justify-content: center;
    gap: 16px;
    flex: 1;
    align-items: flex-end;
    padding-bottom: 8px;
  }

  .agent-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    position: relative;
    padding: 8px;
    border-radius: 10px;
    border: 1px solid rgba(240,237,228,0.06);
    background: rgba(240,237,228,0.02);
    transition: all 300ms;
    width: 120px;
  }
  .agent-card.agent-attacking {
    border-color: rgba(0,255,136,0.3);
    background: rgba(0,255,136,0.04);
    box-shadow: 0 0 12px rgba(0,255,136,0.1);
  }
  .agent-card.agent-shielding {
    border-color: rgba(68,136,255,0.4);
    background: rgba(68,136,255,0.06);
    box-shadow: 0 0 12px rgba(68,136,255,0.15);
  }
  .agent-card.agent-exhausted {
    border-color: rgba(255,45,85,0.2);
    opacity: 0.5;
  }
  .agent-card.agent-focused {
    border-color: rgba(255,215,0,0.5);
    box-shadow: 0 0 16px rgba(255,215,0,0.15);
  }

  .agent-action-badge {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
  }
  .action-label {
    font-size: 7px;
    font-weight: 700;
    letter-spacing: 1px;
    color: rgba(240,237,228,0.5);
  }

  .speech-bubble {
    position: absolute;
    top: -24px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(10,9,8,0.9);
    border: 1px solid rgba(240,237,228,0.15);
    border-radius: 6px;
    padding: 3px 8px;
    font-size: 7px;
    color: rgba(240,237,228,0.7);
    white-space: nowrap;
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
    animation: speechPop 300ms ease;
    z-index: 10;
    pointer-events: none;
  }
  @keyframes speechPop {
    from { opacity: 0; transform: translateX(-50%) translateY(4px) scale(0.9); }
    to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
  }

  .damage-number {
    position: absolute;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 14px;
    font-weight: 900;
    pointer-events: none;
    animation: dmgFloat 1.2s ease-out forwards;
    z-index: 20;
    text-shadow: 0 0 8px currentColor;
  }
  .dmg-green { color: #00ff88; }
  .dmg-red { color: #ff2d55; }
  .dmg-gold { color: #FFD700; }
  @keyframes dmgFloat {
    0% { opacity: 1; transform: translateX(-50%) translateY(0); }
    80% { opacity: 0.8; }
    100% { opacity: 0; transform: translateX(-50%) translateY(-40px); }
  }

  .agent-sprite {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    border: 2px solid rgba(240,237,228,0.15);
    overflow: hidden;
    position: relative;
    background: rgba(240,237,228,0.03);
    transition: all 200ms;
  }
  .agent-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: all 200ms;
  }
  .img-attacking {
    transform: scale(1.1);
    filter: brightness(1.3);
  }
  .img-windup {
    animation: windupPulse 400ms ease infinite;
  }
  .img-shielding {
    filter: brightness(0.8) saturate(1.5) hue-rotate(200deg);
  }
  .img-recover {
    filter: brightness(0.7) saturate(0.5);
    animation: recoverGlow 800ms ease infinite;
  }
  .img-exhausted {
    filter: grayscale(0.8) brightness(0.5);
  }
  @keyframes windupPulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.15); filter: brightness(1.5); }
  }
  @keyframes recoverGlow {
    0%, 100% { filter: brightness(0.7) saturate(0.5); }
    50% { filter: brightness(0.9) saturate(0.7); }
  }

  .shield-overlay {
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    border: 2px solid rgba(68,136,255,0.6);
    background: rgba(68,136,255,0.1);
    animation: shieldPulse 600ms ease infinite;
  }
  @keyframes shieldPulse {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
  }

  .validated-badge, .challenged-badge {
    position: absolute;
    top: 0;
    right: 0;
    font-size: 10px;
    font-weight: 900;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .validated-badge {
    background: #00ff88;
    color: #0A0908;
  }
  .challenged-badge {
    background: #ff2d55;
    color: #0A0908;
  }

  .agent-name {
    font-size: 8px;
    font-weight: 900;
    letter-spacing: 2px;
    color: rgba(240,237,228,0.6);
  }

  .energy-bar {
    width: 100%;
    height: 4px;
    background: rgba(240,237,228,0.06);
    border-radius: 2px;
    overflow: hidden;
  }
  .energy-fill {
    height: 100%;
    background: #00ff88;
    border-radius: 2px;
    transition: width 300ms;
  }
  .energy-fill.energy-low {
    background: #ffaa00;
  }
  .energy-fill.energy-crit {
    background: #ff2d55;
    animation: energyBlink 400ms ease infinite;
  }
  @keyframes energyBlink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
  .energy-val {
    font-size: 7px;
    font-weight: 700;
    color: rgba(240,237,228,0.3);
    font-variant-numeric: tabular-nums;
  }

  .agent-target-btns {
    display: flex;
    gap: 4px;
    margin-top: 2px;
  }
  .micro-btn {
    font-size: 10px;
    padding: 2px 6px;
    border: 1px solid rgba(255,215,0,0.2);
    border-radius: 4px;
    background: rgba(255,215,0,0.04);
    cursor: pointer;
    transition: all 150ms;
  }
  .micro-btn:hover {
    border-color: rgba(255,215,0,0.5);
    background: rgba(255,215,0,0.1);
  }
  .micro-btn.recall {
    border-color: rgba(255,107,107,0.2);
    background: rgba(255,107,107,0.04);
  }
  .micro-btn.recall:hover {
    border-color: rgba(255,107,107,0.5);
    background: rgba(255,107,107,0.1);
  }

  /* ── Battle Log ── */
  .battle-log {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px 16px;
    border-top: 1px solid rgba(240,237,228,0.06);
    max-height: 80px;
    overflow-y: auto;
    flex-shrink: 0;
  }
  .log-entry {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 9px;
    font-weight: 600;
    animation: logSlide 200ms ease;
  }
  .log-icon { font-size: 11px; }
  .log-msg { opacity: 0.8; }
  @keyframes logSlide {
    from { opacity: 0; transform: translateX(-8px); }
    to { opacity: 1; transform: translateX(0); }
  }

  /* ── Milestone Banner ── */
  .milestone-banner {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 20px;
    font-weight: 900;
    letter-spacing: 4px;
    font-family: var(--fb, 'Space Grotesk', sans-serif);
    pointer-events: none;
    z-index: 50;
    animation: milestonePop 2.5s ease forwards;
    white-space: nowrap;
  }
  @keyframes milestonePop {
    0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
    15% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
    25% { transform: translate(-50%, -50%) scale(1); }
    75% { opacity: 1; }
    100% { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
  }

  /* ── End Overlay ── */
  .end-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    background: rgba(10,9,8,0.85);
    z-index: 100;
    animation: endFade 500ms ease;
  }
  .end-text {
    font-size: 32px;
    font-weight: 900;
    letter-spacing: 6px;
    font-family: var(--fb, 'Space Grotesk', sans-serif);
    text-shadow: 0 0 40px currentColor;
    animation: endPulse 1s ease infinite;
  }
  .end-sub {
    font-size: 24px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  @keyframes endFade {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes endPulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.03); }
  }

  /* ── Loading Overlay ── */
  .loading-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0A0908;
    z-index: 200;
  }
  .loading-text {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 4px;
    color: rgba(240,237,228,0.4);
    animation: loadBlink 1.5s ease infinite;
  }
  @keyframes loadBlink {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 1; }
  }
</style>
