<script lang="ts">
  import ChartPanel from './ChartPanel.svelte';
  import HypothesisPanel from './HypothesisPanel.svelte';
  import ArenaRewardModal from './ArenaRewardModal.svelte';
  import type {
    ArenaBattleHudDisplay,
    ArenaBattlePhaseDisplay,
    ArenaModeDisplay,
    ArenaPreviewDisplay,
    ArenaResultState,
    ArenaScoreSummary,
  } from '$lib/arena/state/arenaTypes';
  import type { ArenaChartAnnotation, ArenaChartMarker } from '$lib/arena/adapters/arenaChartBridge';
  import type { ArenaBattleChatMessage } from '$lib/arena/battle/arenaBattlePresentationRuntime';
  import type { ArenaRewardState } from '$lib/arena/reward/arenaRewardRuntime';
  import type { ArenaAgentUiState } from '$lib/arena/controllers/arenaAgentRuntime';
  import type { AgentDef } from '$lib/data/agents';
  import type { BattleTurn, CharSpriteState } from '$lib/engine/arenaCharacters';
  import type { FBScore } from '$lib/engine/types';
  import type { ArenaHypothesisSubmitInput } from '$lib/arena/controllers/arenaPhaseController';
  import type { ArenaMode, Direction, Hypothesis } from '$lib/stores/gameState';

  interface ArenaChartPanelProps {
    showPosition: boolean;
    posEntry: number | null;
    posTp: number | null;
    posSl: number | null;
    posDir: Direction;
    agentAnnotations: ArenaChartAnnotation[];
    agentMarkers: ArenaChartMarker[];
  }

  interface Props {
    chartPanelProps: ArenaChartPanelProps;
    onDragTP?: (detail: { price: number }) => void;
    onDragSL?: (detail: { price: number }) => void;
    onDragEntry?: (detail: { price: number }) => void;
    hypothesisVisible?: boolean;
    hypothesisTimer?: number;
    onHypothesisSubmit?: (selection: ArenaHypothesisSubmitInput) => void;
    floatDir?: 'LONG' | 'SHORT' | null;
    onSelectFloatDir?: (value: 'LONG' | 'SHORT' | null) => void;
    previewVisible?: boolean;
    previewDisplay?: ArenaPreviewDisplay | null;
    onConfirmPreview?: () => void;
    score?: number;
    scoreSummary?: ArenaScoreSummary;
    streak?: number;
    wins?: number;
    losses?: number;
    lp?: number;
    arenaMode?: ArenaMode;
    arenaModeDisplay?: ArenaModeDisplay;
    hypothesisBadge?: string | null;
    hypothesisDir?: Direction | null;
    showMarkers?: boolean;
    onToggleMarkers?: () => void;
    onTogglePositionVisibility?: () => void;
    onGoLobby?: () => void;
    missionText?: string;
    battlePhaseDisplay?: ArenaBattlePhaseDisplay;
    vsMeter?: number;
    enemyHp?: number;
    battleHudDisplay?: ArenaBattleHudDisplay;
    arenaParticles?: Array<{ id: number; x: number; y: number; size: number; speed: number; opacity: number }>;
    activeAgents?: AgentDef[];
    charSprites?: Record<string, CharSpriteState>;
    currentTurnIdx?: number;
    battleTurns?: BattleTurn[];
    agentStates?: Record<string, ArenaAgentUiState>;
    showVsSplash?: boolean;
    showCritical?: boolean;
    criticalText?: string;
    showCombo?: boolean;
    comboCount?: number;
    battleLogPreview?: Array<ArenaBattleChatMessage & { id: number }>;
    battleLogCount?: number;
    rewardState?: ArenaRewardState;
    onCloseReward?: () => void;
    resultVisible?: boolean;
    resultData?: ArenaResultState;
    fbScore?: FBScore | null;
    pvpVisible?: boolean;
    resultOverlayTitle?: string;
    hypothesis?: Hypothesis | null;
    onPlayAgain?: () => void;
    floatingWords?: Array<{ id: number; text: string; color: string; x: number; dur: number }>;
  }

  let {
    chartPanelProps,
    onDragTP = () => {},
    onDragSL = () => {},
    onDragEntry = () => {},
    hypothesisVisible = false,
    hypothesisTimer = 45,
    onHypothesisSubmit = () => {},
    floatDir = null,
    onSelectFloatDir = () => {},
    previewVisible = false,
    previewDisplay = null,
    onConfirmPreview = () => {},
    score = 0,
    scoreSummary = { directionLabel: 'LONG', directionColor: '#00CC88', meta: '' },
    streak = 0,
    wins = 0,
    losses = 0,
    lp = 0,
    arenaMode = 'PVE',
    arenaModeDisplay = { label: 'PVE', roundBadge: null, fullLabel: 'PVE', tournamentMeta: null },
    hypothesisBadge = null,
    hypothesisDir = null,
    showMarkers = true,
    onToggleMarkers = () => {},
    onTogglePositionVisibility = () => {},
    onGoLobby = () => {},
    missionText = '',
    battlePhaseDisplay = { label: 'STANDBY', color: '#ffffff', timerLabel: null },
    vsMeter = 50,
    enemyHp = 100,
    battleHudDisplay = { enemyHpAccent: '#ff2d55', enemyHpLabel: '100', narration: '에이전트 대기 중...', priceLabel: '--' },
    arenaParticles = [],
    activeAgents = [],
    charSprites = {},
    currentTurnIdx = -1,
    battleTurns = [],
    agentStates = {},
    showVsSplash = false,
    showCritical = false,
    criticalText = '',
    showCombo = false,
    comboCount = 0,
    battleLogPreview = [],
    battleLogCount = 0,
    rewardState = { visible: false, xpGain: 0, streak: 0, badges: [] },
    onCloseReward = () => {},
    resultVisible = false,
    resultData = { win: false, lp: 0, tag: '', motto: '', opponentScore: 0 },
    fbScore = null,
    pvpVisible = false,
    resultOverlayTitle = '',
    hypothesis = null,
    onPlayAgain = () => {},
    floatingWords = [],
  }: Props = $props();

  const activeTurnAgentId = $derived(
    currentTurnIdx >= 0 ? battleTurns[currentTurnIdx]?.agent.id ?? null : null,
  );

  function getCharSprite(agentId: string): CharSpriteState {
    return charSprites[agentId] ?? {
      charState: 'idle',
      x: 50,
      y: 50,
      targetX: 50,
      targetY: 50,
      actionEmoji: '',
      actionLabel: '',
      flipX: false,
      hp: 100,
      energy: 0,
      showHit: false,
      hitText: '',
      hitColor: '',
    };
  }
</script>

<div class="battle-layout">
  <div class="chart-side">
    <ChartPanel
      {...chartPanelProps}
      onDragTP={onDragTP}
      onDragSL={onDragSL}
      onDragEntry={onDragEntry}
    />

    {#if hypothesisVisible}
      <div class="hypo-sidebar">
        <HypothesisPanel timeLeft={hypothesisTimer} onsubmit={onHypothesisSubmit} />
      </div>
    {/if}

    {#if hypothesisVisible}
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

    {#if previewVisible && previewDisplay}
      <div class="preview-overlay">
        <div class="preview-card">
          <div class="preview-header">
            <span class="prev-icon">👁</span>
            <span class="prev-title">POSITION PREVIEW</span>
          </div>
          <div class="preview-dir {previewDisplay.dirClass}">
            {previewDisplay.dirIcon} {previewDisplay.dirLabel}
          </div>
          <div class="preview-levels">
            <div class="prev-row">
              <span class="prev-lbl">ENTRY</span>
              <span class="prev-val">{previewDisplay.entryLabel}</span>
            </div>
            <div class="prev-row tp">
              <span class="prev-lbl">TP</span>
              <span class="prev-val">{previewDisplay.tpLabel}</span>
            </div>
            <div class="prev-row sl">
              <span class="prev-lbl">SL</span>
              <span class="prev-val">{previewDisplay.slLabel}</span>
            </div>
          </div>
          <div class="preview-rr">
            R:R <span class="prev-rr-val">{previewDisplay.rrLabel}</span>
          </div>
          <div class="preview-config">{previewDisplay.configLabel}</div>
          <button class="preview-confirm" onclick={onConfirmPreview}>
            ✅ CONFIRM & SCOUT
          </button>
        </div>
      </div>
    {/if}

    <div class="score-bar">
      <div class="sr">
        <svg viewBox="0 0 44 44">
          <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="3" />
          <circle
            cx="22"
            cy="22"
            r="18"
            fill="none"
            stroke={score >= 60 ? '#00CC88' : '#FF5E7A'}
            stroke-width="3"
            stroke-dasharray="{score * 1.13} 200"
            stroke-linecap="round"
            transform="rotate(-90 22 22)"
          />
        </svg>
        <span class="n">{score}</span>
      </div>
      <div>
        <div class="sdir" style="color:{scoreSummary.directionColor}">{scoreSummary.directionLabel}</div>
        <div class="smeta">{scoreSummary.meta}</div>
      </div>
      <div class="score-stats">
        <span class="ss-item">🔥{streak}</span>
        <span class="ss-item">{wins}W-{losses}L</span>
        <span class="ss-item lp">⚡{lp} LP</span>
      </div>
      <div class="mode-badge" class:tour={arenaMode === 'TOURNAMENT'} class:pvp={arenaMode === 'PVP'}>
        {arenaModeDisplay.fullLabel}
      </div>
      {#if hypothesisBadge && hypothesisDir}
        <div class="hypo-badge {hypothesisDir.toLowerCase()}">{hypothesisBadge}</div>
      {/if}
      <div class="chart-toggles">
        <button class="ct-btn" class:on={showMarkers} onclick={onToggleMarkers} title="에이전트 마커">🏷</button>
        <button class="ct-btn" class:on={chartPanelProps.showPosition} onclick={onTogglePositionVisibility} title="TP/SL 라인">📏</button>
      </div>
      <button class="mbtn" onclick={onGoLobby}>↺ LOBBY</button>
    </div>
  </div>

  <div class="arena-sidebar">
    <div class="mission-bar">
      <div class="mission-top">
        <div class="mission-phase">
          <span class="mp-dot" style="background:{battlePhaseDisplay.color}"></span>
          <span class="mp-label" style="color:{battlePhaseDisplay.color}">{battlePhaseDisplay.label}</span>
          {#if battlePhaseDisplay.timerLabel}
            <span class="mp-timer">{battlePhaseDisplay.timerLabel}</span>
          {/if}
        </div>
        <button class="mission-close" onclick={onGoLobby} title="LOBBY">✕</button>
      </div>
      <div class="mission-text">{missionText}</div>
    </div>

    <div class="combat-hud">
      <div class="hud-vs">
        <span class="hud-side long-side">LONG</span>
        <div class="hud-vs-track">
          <div class="hud-vs-fill" style="width:{vsMeter}%"></div>
          <div class="hud-vs-pip" style="left:{vsMeter}%">⚡</div>
        </div>
        <span class="hud-side short-side">SHORT</span>
      </div>
      <div class="hud-enemy">
        <span class="hud-enemy-label">MARKET</span>
        <div class="hud-hp-track">
          <div class="hud-hp-fill" style="width:{enemyHp}%;background:linear-gradient(90deg,#ff5e7a,{battleHudDisplay.enemyHpAccent})"></div>
        </div>
        <span class="hud-hp-num">{battleHudDisplay.enemyHpLabel}</span>
      </div>
      <div class="hud-price">{battleHudDisplay.priceLabel}</div>
    </div>

    <div class="game-arena">
      <div class="arena-grid-bg"></div>

      {#each arenaParticles as p (p.id)}
        <div
          class="arena-particle"
          style="left:{p.x}%;top:{p.y}%;width:{p.size}px;height:{p.size}px;opacity:{p.opacity};animation-duration:{p.speed * 4}s"
        ></div>
      {/each}

      <svg class="arena-connections" viewBox="0 0 100 100" preserveAspectRatio="none">
        {#each activeAgents as ag}
          {@const cs = charSprites[ag.id]}
          {#if cs}
            <line
              x1={cs.x}
              y1={cs.y}
              x2="50"
              y2="50"
              stroke={ag.color}
              stroke-width="0.3"
              stroke-opacity="0.2"
              stroke-dasharray="1 1"
            />
          {/if}
        {/each}
      </svg>

      <div class="arena-center-node">
        <div class="acn-icon">⚔</div>
        <div class="acn-price">{battleHudDisplay.priceLabel}</div>
      </div>

      {#each activeAgents as ag, i}
        {@const cs = getCharSprite(ag.id)}
        <div
          class="char-sprite cs-{cs.charState}"
          class:active-turn={activeTurnAgentId === ag.id}
          style="left:{cs.x}%;top:{cs.y}%;--ag-color:{ag.color};--ag-delay:{i * 0.15}s;{cs.flipX ? 'transform:translate(-50%,-50%) scaleX(-1)' : ''}"
        >
          {#if cs.actionEmoji}
            <div class="char-action-popup">
              <span class="cap-emoji">{cs.actionEmoji}</span>
              <span class="cap-label">{cs.actionLabel}</span>
            </div>
          {/if}

          {#if cs.showHit}
            <div class="char-hit-fly" style="color:{cs.hitColor}">{cs.hitText}</div>
          {/if}

          <div class="char-body">
            {#if activeTurnAgentId === ag.id}
              <div class="char-turn-ring"></div>
            {/if}
            <div class="char-img-wrap" style="border-color:{ag.color}">
              {#if ag.img.def}
                <img src={ag.img.def} alt={ag.name} class="char-img" />
              {:else}
                <span class="char-emoji">{ag.icon}</span>
              {/if}
            </div>
            <div class="char-aura" style="--aura-color:{ag.color};opacity:{cs.energy > 50 ? 0.3 : 0.1}"></div>
          </div>

          <div class="char-nametag" style="border-color:{ag.color}">{ag.name}</div>

          <div class="char-bars">
            <div class="char-hpbar">
              <div class="char-hpfill" style="width:{cs.hp}%;background:{cs.hp > 50 ? '#00ff88' : cs.hp > 25 ? '#ffaa00' : '#ff2d55'}"></div>
            </div>
            <div class="char-ebar">
              <div class="char-efill" style="width:{cs.energy}%;background:{ag.color}"></div>
            </div>
          </div>

          {#if agentStates[ag.id]?.voteDir}
            <div class="char-vote-badge {agentStates[ag.id].voteDir?.toLowerCase()}">
              {agentStates[ag.id].voteDir === 'LONG' ? '▲' : '▼'}
            </div>
          {/if}
        </div>
      {/each}

      {#if showVsSplash}
        <div class="arena-vs-splash">
          <span class="avs-team long">LONG</span>
          <span class="avs-x">⚔</span>
          <span class="avs-team short">SHORT</span>
        </div>
      {/if}

      {#if showCritical}
        <div class="arena-critical-popup">{criticalText}</div>
      {/if}

      {#if showCombo && comboCount >= 2}
        <div class="arena-combo">COMBO x{comboCount}</div>
      {/if}
    </div>

    <div class="sb-narration">
      <div class="narr-icon">⚡</div>
      <div class="narr-text">{battleHudDisplay.narration}</div>
    </div>

    <div class="battle-log">
      {#each battleLogPreview as msg (msg.id)}
        <div class="bl-line" class:action={msg.isAction}>
          <span class="bl-icon" style="color:{msg.color}">{msg.icon}</span>
          <span class="bl-name" style="color:{msg.color}">{msg.name}</span>
          <span class="bl-text">{msg.text}</span>
        </div>
      {/each}
      {#if battleLogCount === 0}
        <div class="bl-empty">대기 중...</div>
      {/if}
    </div>

    <ArenaRewardModal
      visible={rewardState.visible}
      xpGain={rewardState.xpGain}
      streak={rewardState.streak}
      badges={rewardState.badges}
      onclose={onCloseReward}
    />

    {#if resultVisible}
      <div class="result-overlay" class:win={resultData.win} class:lose={!resultData.win}>
        <div class="result-text">{resultData.win ? 'VERY WIN WOW!' : 'SUCH SAD'}</div>
        <div class="result-lp">{resultData.tag}<br />{resultData.lp >= 0 ? '+' : ''}{resultData.lp} LP</div>
        {#if streak >= 3}
          <div class="result-streak">🔥×{streak} MUCH STREAK</div>
        {/if}
        {#if fbScore}
          <div class="fbs-card">
            <div class="fbs-title">FBS SCORECARD</div>
            <div class="fbs-row">
              <span class="fbs-label">DS</span>
              <div class="fbs-bar"><div class="fbs-fill" style="width:{fbScore.ds}%;background:#e8967d"></div></div>
              <span class="fbs-val">{fbScore.ds}</span>
            </div>
            <div class="fbs-row">
              <span class="fbs-label">RE</span>
              <div class="fbs-bar"><div class="fbs-fill" style="width:{fbScore.re}%;background:#66cce6"></div></div>
              <span class="fbs-val">{fbScore.re}</span>
            </div>
            <div class="fbs-row">
              <span class="fbs-label">CI</span>
              <div class="fbs-bar"><div class="fbs-fill" style="width:{fbScore.ci}%;background:#00cc88"></div></div>
              <span class="fbs-val">{fbScore.ci}</span>
            </div>
            <div class="fbs-total">
              <span>FBS</span>
              <span class="fbs-total-val">{fbScore.fbs}</span>
            </div>
          </div>
        {/if}
        <div class="result-motto">{resultData.motto}</div>
      </div>
    {/if}

    {#if pvpVisible}
      <div class="pvp-overlay">
        <div class="pvp-card">
          <div class="pvp-title">{resultOverlayTitle}</div>
          {#if arenaModeDisplay.tournamentMeta}
            <div class="pvp-label tour-meta">{arenaModeDisplay.tournamentMeta}</div>
          {/if}
          <div class="pvp-scores">
            <div class="pvp-side">
              <div class="pvp-label">YOUR SCORE</div>
              <div class="pvp-score">{Math.round(score)}</div>
            </div>
            <div class="pvp-vs">VS</div>
            <div class="pvp-side">
              <div class="pvp-label">OPPONENT</div>
              <div class="pvp-score">{resultData.opponentScore}</div>
            </div>
          </div>
          <div class="pvp-lp" class:pos={resultData.lp >= 0} class:neg={resultData.lp < 0}>
            {resultData.lp >= 0 ? '+' : ''}{resultData.lp} LP
          </div>
          {#if hypothesis}
            <div class="pvp-hypo">
              Your call: <span class="{hypothesis.dir.toLowerCase()}">{hypothesis.dir}</span>
              · R:R 1:{hypothesis.rr.toFixed(1)}
              {#if hypothesis.consensusType}
                · <span class="pvp-consensus">{hypothesis.consensusType.toUpperCase()}</span>
              {/if}
            </div>
          {/if}
          <div class="pvp-btns">
            <button class="pvp-btn lobby" onclick={onGoLobby}>↺ LOBBY</button>
            <button class="pvp-btn again" onclick={onPlayAgain}>🐕 PLAY AGAIN</button>
          </div>
        </div>
      </div>
    {/if}

    {#each floatingWords as w (w.id)}
      <div class="doge-float" style="left:{w.x}%;color:{w.color};animation-duration:{w.dur}s">{w.text}</div>
    {/each}
  </div>
</div>

<style>
  .battle-layout { display: grid; grid-template-columns: 1fr 380px; flex: 1; min-height: 0; overflow: hidden; }

  .chart-side { display: flex; flex-direction: column; background: #07130d; overflow: hidden; border-right: 1px solid rgba(232,150,125,.15); position: relative; }

  .arena-sidebar {
    position: relative;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: linear-gradient(180deg, #0a0a12 0%, #0d0a14 50%, #0a0a12 100%);
    border-left: 1px solid rgba(255,105,180,.15);
  }

  .mission-bar {
    padding: 8px 12px;
    border-bottom: 1px solid rgba(255,105,180,.2);
    background: linear-gradient(90deg, rgba(255,105,180,.06), rgba(255,105,180,.02));
    flex-shrink: 0;
  }
  .mission-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
  .mission-phase { display: flex; align-items: center; gap: 6px; font: 800 9px/1 var(--fd); letter-spacing: 1.5px; }
  .mp-dot { width: 6px; height: 6px; border-radius: 50%; box-shadow: 0 0 8px currentColor; flex-shrink: 0; }
  .mp-label { text-transform: uppercase; }
  .mp-timer { color: rgba(255,255,255,.4); font-size: 9px; margin-left: 8px; }
  .mission-close {
    width: 24px; height: 24px; border-radius: 6px;
    border: 1px solid rgba(255,105,180,.35);
    background: rgba(255,105,180,.1);
    color: rgba(255,255,255,.7);
    font-size: 12px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: all .15s; flex-shrink: 0;
  }
  .mission-close:hover { background: rgba(255,105,180,.25); color: #fff; }
  .mission-text { font: 700 8px/1.3 var(--fm); color: rgba(255,255,255,.5); letter-spacing: 0.5px; }

  .combat-hud {
    padding: 6px 10px;
    border-bottom: 1px solid rgba(255,105,180,.15);
    background: rgba(0,0,0,.3);
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .hud-vs { display: flex; align-items: center; gap: 6px; }
  .hud-side {
    font: 900 9px/1 var(--fd); letter-spacing: 2px; width: 42px; text-align: center;
    text-shadow: 0 0 8px currentColor;
  }
  .hud-side.long-side { color: #00ff88; }
  .hud-side.short-side { color: #ff5e7a; }
  .hud-vs-track {
    flex: 1; height: 8px; background: rgba(255,94,122,.15); border-radius: 4px;
    position: relative; overflow: visible; border: 1px solid rgba(255,105,180,.2);
  }
  .hud-vs-fill {
    height: 100%; background: linear-gradient(90deg, #00ff88, #00cc66);
    border-radius: 4px 0 0 4px; transition: width .5s cubic-bezier(.4,0,.2,1);
  }
  .hud-vs-pip {
    position: absolute; top: 50%; transform: translate(-50%,-50%);
    font-size: 9px; filter: drop-shadow(0 0 4px rgba(255,200,0,.6));
    transition: left .5s cubic-bezier(.4,0,.2,1); z-index: 2;
  }
  .hud-enemy { display: flex; align-items: center; gap: 6px; }
  .hud-enemy-label { font: 800 6px/1 var(--fd); letter-spacing: 1.5px; color: #ff5e7a; width: 36px; }
  .hud-hp-track {
    flex: 1; height: 6px; background: rgba(255,94,122,.1); border-radius: 3px;
    overflow: hidden; border: 1px solid rgba(255,94,122,.2);
  }
  .hud-hp-fill { height: 100%; border-radius: 3px; transition: width .5s ease; }
  .hud-hp-num { font: 800 8px/1 var(--fd); color: #ff5e7a; width: 24px; text-align: right; }
  .hud-price { font: 900 10px/1 var(--fd); color: rgba(255,255,255,.5); text-align: center; letter-spacing: 1px; flex-shrink: 0; }

  .game-arena {
    flex: 1;
    position: relative;
    overflow: hidden;
    min-height: 200px;
    background:
      radial-gradient(circle at 50% 45%, rgba(255,105,180,.06), transparent 50%),
      radial-gradient(circle at 20% 80%, rgba(0,255,136,.04), transparent 40%),
      radial-gradient(circle at 80% 20%, rgba(102,204,230,.04), transparent 40%);
  }
  .arena-grid-bg {
    position: absolute; inset: 0; pointer-events: none;
    background-image:
      linear-gradient(rgba(255,105,180,.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,105,180,.06) 1px, transparent 1px);
    background-size: 28px 28px;
    opacity: .4;
  }
  .arena-particle {
    position: absolute; border-radius: 50%;
    background: rgba(255,105,180,.3);
    animation: particleFloat linear infinite alternate;
    pointer-events: none;
  }
  @keyframes particleFloat {
    0% { transform: translateY(0) translateX(0); opacity: .1; }
    50% { transform: translateY(-15px) translateX(8px); opacity: .3; }
    100% { transform: translateY(5px) translateX(-5px); opacity: .15; }
  }
  .arena-connections { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1; }
  .arena-center-node {
    position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%);
    z-index: 5; text-align: center;
    width: 52px; height: 52px; border-radius: 50%;
    border: 2px solid rgba(255,105,180,.3); background: rgba(10,10,20,.8);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    box-shadow: 0 0 20px rgba(255,105,180,.15);
    animation: centerPulse 2s ease-in-out infinite alternate;
  }
  @keyframes centerPulse {
    from { box-shadow: 0 0 12px rgba(255,105,180,.1); }
    to { box-shadow: 0 0 28px rgba(255,105,180,.25); }
  }
  .acn-icon { font-size: 16px; }
  .acn-price { font: 800 7px/1 var(--fd); color: rgba(255,255,255,.5); letter-spacing: 0.5px; }

  .char-sprite {
    position: absolute; z-index: 10;
    transform: translate(-50%, -50%);
    transition: left .6s cubic-bezier(.4,0,.2,1), top .6s cubic-bezier(.4,0,.2,1);
    cursor: pointer; text-align: center;
  }
  .char-body { position: relative; display: inline-flex; flex-direction: column; align-items: center; }
  .char-img-wrap {
    width: 52px; height: 52px; border-radius: 14px; border: 3px solid; overflow: hidden;
    background: #fff; box-shadow: 3px 3px 0 rgba(0,0,0,.5); transition: all .15s;
  }
  .char-img { width: 100%; height: 100%; object-fit: cover; border-radius: 11px; filter: hue-rotate(330deg) saturate(1.2); }
  .char-emoji { font-size: 28px; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
  .char-aura {
    position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
    width: 72px; height: 72px; border-radius: 50%;
    background: radial-gradient(circle, var(--aura-color) 0%, transparent 70%);
    z-index: -1; pointer-events: none;
    animation: charAuraPulse 1.5s ease-in-out infinite;
  }
  @keyframes charAuraPulse {
    0%,100% { transform: translate(-50%,-50%) scale(1); opacity: .15; }
    50% { transform: translate(-50%,-50%) scale(1.3); opacity: .3; }
  }
  .char-turn-ring {
    position: absolute; inset: -6px; border-radius: 18px;
    border: 2px solid var(--ag-color, #ff69b4);
    animation: turnRingSpin 1s linear infinite;
    box-shadow: 0 0 12px var(--ag-color, #ff69b4);
  }
  @keyframes turnRingSpin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .char-nametag {
    margin-top: 3px; font: 900 7px/1 var(--fd); letter-spacing: 1.5px;
    background: rgba(0,0,0,.7); color: #fff; padding: 2px 6px; border-radius: 4px;
    border: 1px solid; white-space: nowrap;
  }
  .char-bars { display: flex; flex-direction: column; gap: 1px; margin-top: 2px; width: 42px; }
  .char-hpbar { height: 4px; background: rgba(255,255,255,.1); border-radius: 2px; overflow: hidden; border: 1px solid rgba(255,255,255,.15); }
  .char-hpfill { height: 100%; border-radius: 2px; transition: width .5s; }
  .char-ebar { height: 3px; background: rgba(255,255,255,.08); border-radius: 2px; overflow: hidden; }
  .char-efill { height: 100%; border-radius: 2px; transition: width .3s; }
  .char-vote-badge {
    position: absolute; top: -4px; right: -8px;
    font: 900 8px/1 var(--fd); padding: 2px 4px; border-radius: 4px;
    border: 1px solid #000; z-index: 15;
  }
  .char-vote-badge.long { background: #00ff88; color: #000; }
  .char-vote-badge.short { background: #ff2d55; color: #fff; }

  .char-action-popup {
    position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%);
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    animation: actionPopIn .3s ease;
    z-index: 20; pointer-events: none;
  }
  @keyframes actionPopIn {
    from { opacity: 0; transform: translateX(-50%) translateY(8px) scale(.7); }
    to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
  }
  .cap-emoji { font-size: 20px; filter: drop-shadow(0 0 8px rgba(255,200,0,.6)); }
  .cap-label {
    font: 900 8px/1 var(--fd); letter-spacing: 1px; color: #ffcc00;
    background: rgba(0,0,0,.7); padding: 2px 6px; border-radius: 4px; white-space: nowrap;
  }

  .char-hit-fly {
    position: absolute; top: -20px; left: 50%; transform: translateX(-50%);
    font: 900 14px/1 var(--fd); letter-spacing: 2px;
    text-shadow: 0 2px 6px rgba(0,0,0,.7);
    animation: hitFlyUp 1.2s ease-out forwards;
    z-index: 25; pointer-events: none; white-space: nowrap;
  }
  @keyframes hitFlyUp {
    0% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
    100% { opacity: 0; transform: translateX(-50%) translateY(-40px) scale(1.3); }
  }

  .cs-idle .char-body { animation: csIdle 1.4s ease-in-out infinite; animation-delay: var(--ag-delay, 0s); }
  @keyframes csIdle {
    0%,100% { transform: translateY(0); }
    50% { transform: translateY(-4px); }
  }
  .cs-patrol .char-body { animation: csPatrol .4s ease-in-out infinite; }
  @keyframes csPatrol {
    0%,100% { transform: translateY(0) rotate(0); }
    25% { transform: translateY(-5px) rotate(-2deg); }
    75% { transform: translateY(-3px) rotate(2deg); }
  }
  .cs-lock .char-body { animation: csLock .6s ease infinite; }
  .cs-lock .char-img-wrap { box-shadow: 0 0 16px var(--ag-color, #ff69b4) !important; }
  @keyframes csLock {
    0%,100% { transform: scale(1); }
    50% { transform: scale(1.04); }
  }
  .cs-windup .char-body { animation: csWindup .08s linear infinite; }
  .cs-windup .char-img-wrap { box-shadow: 0 0 22px var(--ag-color, #ffcc00) !important; }
  @keyframes csWindup {
    0% { transform: translate(-2px, 1px); }
    25% { transform: translate(2px, -1px); }
    50% { transform: translate(-1px, -2px); }
    75% { transform: translate(1px, 2px); }
  }
  .cs-cast .char-body { animation: csCast .4s ease; }
  .cs-cast .char-img-wrap { box-shadow: 0 0 28px var(--ag-color, #ff5e7a) !important; border-color: #fff !important; }
  @keyframes csCast {
    0% { transform: scale(1); }
    30% { transform: scale(1.15) translateY(-8px); }
    60% { transform: scale(1.1) translateY(-4px); }
    100% { transform: scale(1); }
  }
  .cs-impact .char-body { animation: csImpact .3s ease; }
  @keyframes csImpact {
    0% { transform: scale(1.2); filter: brightness(2); }
    50% { transform: scale(0.95); filter: brightness(1.5); }
    100% { transform: scale(1); filter: brightness(1); }
  }
  .cs-recover .char-body { animation: csRecover .4s ease; }
  @keyframes csRecover {
    0% { transform: scale(.9); opacity: .7; }
    100% { transform: scale(1); opacity: 1; }
  }
  .cs-celebrate .char-body { animation: csCelebrate .4s ease-in-out infinite; }
  @keyframes csCelebrate {
    0%,100% { transform: translateY(0) rotate(0) scale(1); }
    25% { transform: translateY(-14px) rotate(-5deg) scale(1.08); }
    75% { transform: translateY(-6px) rotate(3deg) scale(1.04); }
  }
  .cs-panic .char-body { animation: csPanic .2s ease infinite; }
  .cs-panic .char-img-wrap { filter: saturate(.4) brightness(.7); }
  @keyframes csPanic {
    0%,100% { transform: translateX(0) rotate(0); }
    25% { transform: translateX(-3px) rotate(-3deg); }
    75% { transform: translateX(3px) rotate(3deg); }
  }

  .arena-vs-splash {
    position: absolute; inset: 0; z-index: 50;
    display: flex; align-items: center; justify-content: center; gap: 16px;
    background: rgba(0,0,0,.85);
    animation: vsSplashIn .4s ease;
  }
  .avs-team { font: 900 24px/1 var(--fc); letter-spacing: 4px; text-shadow: 0 0 20px currentColor; }
  .avs-team.long { color: #00ff88; }
  .avs-team.short { color: #ff5e7a; }
  .avs-x { font-size: 28px; animation: vsXPulse .3s ease infinite alternate; }
  @keyframes vsSplashIn { from { opacity: 0; transform: scale(1.5); } to { opacity: 1; transform: scale(1); } }
  @keyframes vsXPulse { from { transform: scale(1) rotate(-5deg); } to { transform: scale(1.2) rotate(5deg); } }

  .arena-critical-popup {
    position: absolute; top: 20%; left: 50%; transform: translateX(-50%);
    z-index: 60; pointer-events: none;
    font: 900 18px/1 var(--fc); color: #ffcc00; letter-spacing: 3px;
    text-shadow: 0 0 16px rgba(255,200,0,.8), 0 4px 8px rgba(0,0,0,.5);
    animation: criticalBoom .8s ease forwards;
  }
  @keyframes criticalBoom {
    0% { opacity: 0; transform: translateX(-50%) scale(2); }
    20% { opacity: 1; transform: translateX(-50%) scale(1); }
    80% { opacity: 1; transform: translateX(-50%) scale(1.05); }
    100% { opacity: 0; transform: translateX(-50%) translateY(-20px) scale(.8); }
  }
  .arena-combo {
    position: absolute; top: 32%; right: 8%; z-index: 55; pointer-events: none;
    font: 900 14px/1 var(--fc); color: #ff69b4; letter-spacing: 2px;
    text-shadow: 0 0 12px rgba(255,105,180,.6);
    animation: comboPopIn .4s ease;
  }
  @keyframes comboPopIn {
    from { opacity: 0; transform: scale(2) rotate(-10deg); }
    to { opacity: 1; transform: scale(1) rotate(0); }
  }

  .sb-narration {
    display: flex; align-items: center; gap: 8px;
    padding: 6px 10px;
    border-top: 1px solid rgba(255,105,180,.15);
    background: rgba(255,105,180,.04);
    flex-shrink: 0; min-height: 32px;
  }
  .narr-icon { font-size: 11px; flex-shrink: 0; }
  .narr-text { font: 700 9px/1.3 var(--fm); color: rgba(255,255,255,.7); flex: 1; animation: narrFade .3s ease; }
  @keyframes narrFade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

  .battle-log {
    max-height: 80px; overflow-y: auto; padding: 4px 8px;
    border-top: 1px solid rgba(255,105,180,.1);
    background: rgba(0,0,0,.2); flex-shrink: 0;
  }
  .battle-log::-webkit-scrollbar { width: 2px; }
  .battle-log::-webkit-scrollbar-thumb { background: rgba(255,105,180,.2); }
  .bl-line {
    display: flex; align-items: center; gap: 4px;
    font: 600 8px/1.3 var(--fm); color: rgba(255,255,255,.5);
    padding: 2px 0; animation: blSlideIn .3s ease;
  }
  .bl-line.action { color: rgba(255,105,180,.7); }
  @keyframes blSlideIn { from { opacity: 0; transform: translateX(-6px); } to { opacity: 1; transform: none; } }
  .bl-icon { font-size: 9px; flex-shrink: 0; }
  .bl-name { font: 800 7px/1 var(--fd); letter-spacing: .5px; flex-shrink: 0; }
  .bl-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bl-empty { text-align: center; color: rgba(255,255,255,.15); font: 600 8px/1 var(--fm); padding: 8px 0; }

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

  .score-bar {
    padding: 6px 12px; border-top: 1px solid rgba(232,150,125,.15);
    background: linear-gradient(90deg, rgba(10,26,18,.95), rgba(8,19,13,.95));
    display: flex; align-items: center; gap: 10px; flex-shrink: 0;
  }
  .sr { position: relative; width: 40px; height: 40px; flex-shrink: 0; }
  .sr svg { width: 40px; height: 40px; }
  .sr .n { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 900; font-family: var(--fd); color: #fff; }
  .sdir { font-size: 13px; font-weight: 900; font-family: var(--fd); letter-spacing: 2px; text-shadow: 0 0 10px currentColor; }
  .smeta { font-size: 9px; color: #888; font-family: var(--fm); }
  .score-stats { display: flex; gap: 8px; margin-left: auto; }
  .ss-item { font-size: 9px; font-weight: 700; font-family: var(--fm); color: #aaa; }
  .ss-item.lp { color: #e8967d; }
  .mode-badge {
    padding: 3px 8px;
    border: 1.5px solid rgba(232,150,125,.55);
    background: rgba(232,150,125,.09);
    color: #e8967d;
    font-size: 9px; font-family: var(--fd); font-weight: 900; letter-spacing: 1px;
    border-radius: 7px; white-space: nowrap;
  }
  .mode-badge.pvp { border-color: rgba(102,204,230,.55); background: rgba(102,204,230,.1); color: #66cce6; }
  .mode-badge.tour { border-color: rgba(220,185,112,.65); background: rgba(220,185,112,.12); color: #dcb970; }
  .hypo-badge {
    padding: 3px 10px; border-radius: 8px; font-size: 9px; font-weight: 900;
    font-family: var(--fd); letter-spacing: 1px; border: 2px solid;
  }
  .hypo-badge.long { background: rgba(0,255,136,.15); border-color: #00ff88; color: #00ff88; }
  .hypo-badge.short { background: rgba(255,45,85,.15); border-color: #ff2d55; color: #ff2d55; }
  .hypo-badge.neutral { background: rgba(255,170,0,.15); border-color: #ffaa00; color: #ffaa00; }
  .chart-toggles { display: flex; gap: 3px; margin-left: 4px; }
  .ct-btn {
    width: 26px; height: 26px; border: 1px solid rgba(255,105,180,.2); border-radius: 6px;
    background: rgba(255,105,180,.05); font-size: 11px; cursor: pointer;
    display: flex; align-items: center; justify-content: center; transition: all .15s; opacity: .5;
  }
  .ct-btn.on { border-color: rgba(255,105,180,.5); background: rgba(255,105,180,.15); opacity: 1; }
  .ct-btn:hover { opacity: .8; background: rgba(255,105,180,.1); }
  .mbtn {
    padding: 6px 16px; border-radius: 16px; background: #E8967D; border: 3px solid #000; color: #000;
    font-family: var(--fd); font-size: 9px; font-weight: 900; letter-spacing: 2px; cursor: pointer; box-shadow: 3px 3px 0 #000;
  }
  .mbtn:hover { background: #d07a64; }

  .result-overlay { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 35; text-align: center; animation: popIn .3s ease; padding: 16px 28px; border-radius: 16px; border: 1px solid rgba(232,150,125,.3); box-shadow: 0 8px 32px rgba(0,0,0,.5); backdrop-filter: blur(8px); }
  .result-overlay.win { background: linear-gradient(135deg, rgba(0,204,136,.25), rgba(0,180,100,.2)); border-color: rgba(0,204,136,.4); }
  .result-overlay.lose { background: linear-gradient(135deg, rgba(255,94,122,.25), rgba(200,50,70,.2)); border-color: rgba(255,94,122,.4); }
  .result-text { font-size: 22px; font-weight: 900; font-family: var(--fc); color: #f0ede4; letter-spacing: 3px; text-shadow: 0 0 12px rgba(232,150,125,.3); }
  .result-lp { font-size: 14px; font-weight: 900; font-family: var(--fd); color: #f0ede4; margin-top: 4px; }
  .result-streak { font-size: 10px; font-weight: 700; color: #e8967d; margin-top: 4px; }
  .result-motto { font-size: 9px; font-family: var(--fc); color: rgba(240,237,228,.6); margin-top: 8px; font-style: italic; }

  .fbs-card {
    margin-top: 10px; padding: 8px 12px; border-radius: 10px;
    background: rgba(10,26,18,.85); border: 1px solid rgba(232,150,125,.2);
    text-align: left; min-width: 180px;
  }
  .fbs-title { font-size: 9px; font-weight: 900; letter-spacing: 2px; color: rgba(240,237,228,.5); font-family: var(--fd); margin-bottom: 6px; text-align: center; }
  .fbs-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
  .fbs-label { font-size: 9px; font-weight: 900; font-family: var(--fd); letter-spacing: 1px; width: 22px; color: rgba(240,237,228,.6); }
  .fbs-bar { flex: 1; height: 5px; background: rgba(240,237,228,.08); border-radius: 3px; overflow: hidden; }
  .fbs-fill { height: 100%; border-radius: 3px; transition: width .6s ease; }
  .fbs-val { font-size: 9px; font-weight: 900; font-family: var(--fd); width: 24px; text-align: right; color: #f0ede4; }
  .fbs-total { display: flex; justify-content: space-between; align-items: center; padding-top: 6px; border-top: 1px solid rgba(232,150,125,.15); margin-top: 4px; font-size: 9px; font-weight: 900; font-family: var(--fd); color: rgba(240,237,228,.5); letter-spacing: 1px; }
  .fbs-total-val { font-size: 16px; color: #e8967d; text-shadow: 0 0 8px rgba(232,150,125,.3); }

  .pvp-overlay { position: absolute; inset: 0; z-index: 40; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.6); backdrop-filter: blur(4px); animation: fadeIn .3s ease; }
  .pvp-card { background: rgba(10,26,18,.95); border: 1px solid rgba(232,150,125,.3); border-radius: 16px; padding: 20px 30px; text-align: center; box-shadow: 0 8px 32px rgba(0,0,0,.5); min-width: 260px; }
  .pvp-title { font-size: 18px; font-weight: 900; font-family: var(--fc); letter-spacing: 3px; color: #f0ede4; }
  .pvp-scores { display: flex; align-items: center; justify-content: center; gap: 16px; margin: 12px 0; }
  .pvp-side { text-align: center; }
  .pvp-label { font-size: 9px; color: #888; font-family: var(--fd); letter-spacing: 2px; }
  .pvp-label.tour-meta { margin-top: 2px; margin-bottom: 8px; font-size: 9px; color: #8b6c27; letter-spacing: 1px; }
  .pvp-score { font-size: 28px; font-weight: 900; font-family: var(--fc); }
  .pvp-vs { font-size: 14px; font-weight: 900; font-family: var(--fc); color: #888; }
  .pvp-lp { font-size: 16px; font-weight: 900; font-family: var(--fd); margin: 8px 0; }
  .pvp-lp.pos { color: #00cc66; }
  .pvp-lp.neg { color: #ff2d55; }
  .pvp-hypo { font-size: 9px; font-family: var(--fm); font-weight: 700; color: #666; margin: 4px 0 8px; }
  .pvp-hypo .long { color: #00cc66; }
  .pvp-hypo .short { color: #ff2d55; }
  .pvp-hypo .neutral { color: #ffaa00; }
  .pvp-consensus { color: #c840ff; }
  .pvp-btns { display: flex; gap: 8px; justify-content: center; margin-top: 12px; }
  .pvp-btn { padding: 8px 20px; border-radius: 12px; border: 3px solid #000; font-family: var(--fd); font-size: 9px; font-weight: 900; letter-spacing: 2px; cursor: pointer; box-shadow: 3px 3px 0 #000; }
  .pvp-btn.lobby { background: #eee; color: #000; }
  .pvp-btn.again { background: #E8967D; color: #000; }
  .pvp-btn:hover { transform: translate(-1px, -1px); box-shadow: 4px 4px 0 #000; }

  .doge-float {
    position: absolute; z-index: 25; font-family: var(--fc); font-weight: 900; font-style: italic; font-size: 16px;
    letter-spacing: 2px; pointer-events: none; animation: dogeUp ease forwards; text-shadow: 2px 2px 0 #000, -1px -1px 0 #000; -webkit-text-stroke: 1px #000;
  }
  @keyframes dogeUp { 0% { opacity: 1; transform: translateY(0) rotate(-5deg) scale(1); } 100% { opacity: 0; transform: translateY(-100px) rotate(15deg) scale(1.5); } }

  .dir-float-bar {
    position: absolute; bottom: 55px; left: 50%; transform: translateX(-50%); z-index: 25;
    display: flex; align-items: center; gap: 0; background: #fff; border: 3px solid #000; border-radius: 20px;
    box-shadow: 4px 4px 0 #000; overflow: hidden; animation: floatBarIn .3s ease;
  }
  @keyframes floatBarIn {
    from { opacity: 0; transform: translateX(-50%) translateY(20px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
  .dfb-btn {
    padding: 10px 28px; border: none; font-family: var(--fd); font-size: 12px; font-weight: 900; letter-spacing: 2px;
    cursor: pointer; transition: all .15s; background: #fafafa; color: #888;
  }
  .dfb-btn.long:hover { background: #e8fff0; color: #00aa44; }
  .dfb-btn.short:hover { background: #ffe8ec; color: #cc0033; }
  .dfb-btn.long.sel { background: #00ff88; color: #000; }
  .dfb-btn.short.sel { background: #ff2d55; color: #fff; }
  .dfb-divider { width: 2px; height: 28px; background: #000; }

  .preview-overlay {
    position: absolute; inset: 0; z-index: 28; display: flex; align-items: center; justify-content: center;
    background: rgba(0,0,0,.15); animation: fadeIn .3s ease;
  }
  .preview-card {
    background: #fff; border: 4px solid #000; border-radius: 16px; padding: 16px 22px;
    box-shadow: 6px 6px 0 #000; text-align: center; min-width: 240px; animation: popIn .3s ease;
  }
  .preview-header { display: flex; align-items: center; justify-content: center; gap: 8px; border-bottom: 3px solid #000; padding-bottom: 8px; margin-bottom: 10px; }
  .prev-icon { font-size: 18px; }
  .prev-title { font-family: var(--fc); font-size: 14px; font-weight: 900; letter-spacing: 2px; color: #000; }
  .preview-dir { font-family: var(--fc); font-size: 24px; font-weight: 900; letter-spacing: 3px; margin-bottom: 8px; }
  .preview-dir.long { color: #00cc66; }
  .preview-dir.short { color: #ff2d55; }
  .preview-dir.neutral { color: #ffaa00; }
  .preview-levels { display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; }
  .prev-row { display: flex; align-items: center; justify-content: space-between; padding: 4px 10px; border-radius: 6px; background: #f8f8f8; }
  .prev-row.tp { background: rgba(0,255,136,.1); }
  .prev-row.sl { background: rgba(255,45,85,.08); }
  .prev-lbl { font-family: var(--fd); font-size: 9px; font-weight: 900; letter-spacing: 2px; color: #888; }
  .prev-val { font-family: var(--fd); font-size: 12px; font-weight: 900; color: #000; }
  .preview-rr {
    font-family: var(--fd); font-size: 10px; font-weight: 900; letter-spacing: 2px; color: #888;
    background: #000; border-radius: 8px; padding: 4px 12px; margin-bottom: 6px; display: inline-block;
  }
  .prev-rr-val { font-size: 14px; color: #E8967D; }
  .preview-config { font-family: var(--fm); font-size: 9px; font-weight: 700; color: #aaa; letter-spacing: 1px; margin-bottom: 10px; }
  .preview-confirm {
    font-family: var(--fd); font-size: 11px; font-weight: 900; letter-spacing: 2px; padding: 10px 28px;
    border: 3px solid #000; border-radius: 14px; background: linear-gradient(180deg, #00ff88, #00cc66); color: #000;
    cursor: pointer; box-shadow: 3px 3px 0 #000; transition: all .15s;
  }
  .preview-confirm:hover { transform: translate(-1px, -1px); box-shadow: 4px 4px 0 #000; background: linear-gradient(180deg, #33ffaa, #00dd77); }
  .preview-confirm:active { transform: translate(1px, 1px); box-shadow: 1px 1px 0 #000; }

  @keyframes popIn { from { transform: translate(-50%, -50%) scale(.8); opacity: 0 } to { transform: translate(-50%, -50%) scale(1); opacity: 1 } }
  @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
  @keyframes hypoSlideUp { from { opacity: 0; transform: translateY(100%); } to { opacity: 1; transform: translateY(0); } }

  @media (max-width: 768px) {
    .battle-layout { grid-template-columns: 1fr; grid-template-rows: 45% 1fr; }
    .chart-side { border-right: none; border-bottom: 4px solid #000; }
    .hypo-sidebar {
      position: fixed; top: auto; right: 0; bottom: 0; left: 0; max-height: 55vh; z-index: 60;
      border-radius: 16px 16px 0 0; background: rgba(7, 19, 13, 0.97);
      border-top: 2px solid rgba(232, 150, 125, 0.35); box-shadow: 0 -8px 40px rgba(0, 0, 0, 0.6);
      animation: hypoSlideUp 0.3s ease; filter: none;
    }
    .hypo-sidebar::before {
      content: ''; display: block; width: 36px; height: 4px; background: rgba(255, 255, 255, 0.25);
      border-radius: 2px; margin: 10px auto 4px; flex-shrink: 0;
    }
    .dir-float-bar { position: fixed; bottom: calc(55vh + 8px); left: 50%; transform: translateX(-50%); z-index: 61; }
    .score-bar { padding: 4px 8px; gap: 6px; flex-wrap: wrap; }
    .score-stats { gap: 5px; }
    .chart-toggles { gap: 3px; }
    .ct-btn { width: 28px; height: 28px; font-size: 11px; }
    .mbtn { font-size: 8px; padding: 4px 8px; }
    .preview-overlay { position: fixed; inset: 0; z-index: 65; }
    .preview-card { width: calc(100% - 32px); max-width: 340px; }
  }
</style>
