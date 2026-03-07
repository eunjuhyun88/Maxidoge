<script lang="ts">
  import '$lib/styles/arena-tone.css';
  import { gameState } from '$lib/stores/gameState';
  import { recordAgentMatch } from '$lib/stores/agentData';
  import { AGDEFS } from '$lib/data/agents';
  import { sfx } from '$lib/audio/sfx';
  import { PHASE_LABELS, DOGE_DEPLOYS, DOGE_BATTLE, DOGE_WIN, DOGE_LOSE, WIN_MOTTOS, LOSE_MOTTOS } from '$lib/engine/phases';
  import { startMatch as engineStartMatch, advancePhase, setPhaseInitCallback, resetPhaseInit, startAnalysisFromDraft } from '$lib/engine/gameLoop';
  import { determineActualDirection } from '$lib/engine/scoring';
  import {
    buildArenaApiSyncStatus,
    buildArenaBattleHudDisplay,
    buildArenaBattleLogPreview,
    buildArenaBattlePhaseDisplay,
    buildArenaHypothesisBadge,
    buildArenaMissionText,
    buildArenaModeDisplay,
    buildArenaPhaseTrack,
    buildArenaPreviewDisplay,
    buildArenaResultOverlayTitle,
    buildArenaResultStateSeed,
    buildArenaScoreSummary,
    buildArenaViewAgentSummaries,
  } from '$lib/arena/selectors/arenaViewModel';
  import Lobby from '../../components/arena/Lobby.svelte';
  import ArenaBattleLayout from '../../components/arena/ArenaBattleLayout.svelte';
  import SquadConfig from '../../components/arena/SquadConfig.svelte';
  import MatchHistory from '../../components/arena/MatchHistory.svelte';
  import { addMatchRecord } from '$lib/stores/matchHistoryStore';
  import { addPnLEntry } from '$lib/stores/pnlStore';
  import { onMount, onDestroy } from 'svelte';
  import { recordMatch as recordWalletMatch } from '$lib/stores/walletStore';
  import { runArenaAnalysis, submitArenaHypothesis, resolveArenaMatch } from '$lib/api/arenaApi';
  import type { AnalyzeResponse } from '$lib/api/arenaApi';
  import { mapAnalysisToC02 } from '../../components/arena/arenaState';
  import {
    buildArenaChartDecorations,
    buildArenaChartPositionFromHypothesis,
    createArenaChartBridgeState,
  } from '$lib/arena/adapters/arenaChartBridge';
  import { createArenaLiveEventRuntime } from '$lib/arena/feed/arenaLiveEventRuntime';
  import { createArenaBattleFeedRuntime } from '$lib/arena/feed/arenaBattleFeedRuntime';
  import { btcPrice } from '$lib/stores/priceStore';
  import ViewPicker from '../../components/arena/ViewPicker.svelte';
  import PhaseGuide from '../../components/arena/PhaseGuide.svelte';
  import ResultPanel from '../../components/arena/ResultPanel.svelte';
  import ChartWarView from '../../components/arena/views/ChartWarView.svelte';
  import MissionControlView from '../../components/arena/views/MissionControlView.svelte';
  import CardDuelView from '../../components/arena/views/CardDuelView.svelte';
  import type { ArenaResultState } from '$lib/arena/state/arenaTypes';
  import { createArenaTimerRegistry } from '$lib/arena/state/arenaTimerRegistry';
  import { createArenaPhaseTimerRuntime } from '$lib/arena/state/arenaPhaseTimerRuntime';
  import {
    createArenaVisualEffectsRuntime,
    type ArenaFloatingWord,
    type ArenaParticle,
  } from '$lib/arena/state/arenaVisualEffectsRuntime';
  import {
    createArenaBattlePresentationRuntime,
    type ArenaBattleChatMessage,
  } from '$lib/arena/battle/arenaBattlePresentationRuntime';
  import { createArenaRewardState } from '$lib/arena/reward/arenaRewardRuntime';
  import {
    createArenaLobbyTournamentSeed,
    createArenaShellController,
  } from '$lib/arena/controllers/arenaShellController';
  import {
    createArenaMatchController,
  } from '$lib/arena/controllers/arenaMatchController';
  import {
    createArenaAgentRuntime,
    type ArenaAgentChatAuthor,
    type ArenaAgentUiState,
  } from '$lib/arena/controllers/arenaAgentRuntime';
  import {
    createArenaChartController,
  } from '$lib/arena/controllers/arenaChartController';
  import {
    createArenaBattleController,
  } from '$lib/arena/controllers/arenaBattleController';
  import {
    createArenaPhaseController,
  } from '$lib/arena/controllers/arenaPhaseController';
  import { createArenaAnalysisPresentationRuntime } from '$lib/arena/controllers/arenaAnalysisPresentationRuntime';
  import {
    createArenaResultController,
  } from '$lib/arena/controllers/arenaResultController';
  import type { CharSpriteState, BattleTurn } from '$lib/engine/arenaCharacters';
  import { juice_shake, juice_flash, juice_confetti } from '$lib/engine/arenaGameJuice';

  const gs = $derived($gameState);
  const currentBtcPrice = $derived($btcPrice || gs.bases.BTC || 97000);
  const arenaModeDisplay = $derived(buildArenaModeDisplay(gs.arenaMode, gs.tournament, gs.pair));
  // Active agents for this match
  const activeAgents = $derived(AGDEFS.filter(a => gs.selectedAgents.includes(a.id)));
  const arenaViewAgents = $derived(buildArenaViewAgentSummaries(activeAgents));
  const arenaScoreSummary = $derived(buildArenaScoreSummary(gs.score, activeAgents.length, gs.matchN));
  const arenaHypothesisBadge = $derived(buildArenaHypothesisBadge(gs.hypothesis));
  const arenaPhaseTrack = $derived(buildArenaPhaseTrack(gs.phase));
  const arenaPreviewDisplay = $derived(buildArenaPreviewDisplay(gs.hypothesis, gs.squadConfig));
  let resultData = $state<ArenaResultState>(buildArenaResultStateSeed());
  const arenaAltViewProps = $derived({
    phase: gs.phase,
    battleTick: gs.battleTick,
    hypothesis: gs.hypothesis,
    prices: { BTC: currentBtcPrice },
    battleResult: gs.battleResult,
    battlePriceHistory: gs.battlePriceHistory,
    activeAgents: arenaViewAgents,
  });
  const arenaResultPanelProps = $derived({
    win: resultData.win,
    battleResult: gs.battleResult || '',
    entryPrice: gs.hypothesis?.entry || gs.bases.BTC,
    exitPrice: gs.battleExitPrice || currentBtcPrice,
    tpPrice: gs.hypothesis?.tp || 0,
    slPrice: gs.hypothesis?.sl || 0,
    direction: gs.hypothesis?.dir || 'LONG',
    priceHistory: gs.battlePriceHistory,
    duration: gs.battleTick?.elapsed || 0,
    maxRunup: gs.battleTick?.maxRunup || 0,
    maxDrawdown: gs.battleTick?.maxDrawdown || 0,
    rAchieved: gs.battleTick?.rAchieved || 0,
    fbScore: gs.fbScore,
    lpChange: resultData.lp,
    streak: gs.streak,
    agents: arenaViewAgents,
    actualDirection: determineActualDirection(currentBtcPrice > (gs.hypothesis?.entry || 0) ? 0.01 : -0.01),
  });

  // UI state
  let agentStates = $state<Record<string, ArenaAgentUiState>>({});
  let resultVisible = $state(false);
  const resultOverlayTitle = $derived(buildArenaResultOverlayTitle(gs.arenaMode, resultData.win));
  let floatingWords = $state<ArenaFloatingWord[]>([]);

  // ═══════ CHARACTER-CENTERED ARENA STATE ═══════
  // Character sprite state per agent
  let charSprites = $state<Record<string, CharSpriteState>>({});
  // Arena combat state
  let vsMeter = $state(50);
  let vsMeterTarget = $state(50);
  let battleTurns = $state<BattleTurn[]>([]);
  let currentTurnIdx = $state(-1);
  let battleNarration = $state('');
  let showVsSplash = $state(false);
  let showMarkers = $state(true);
  // Game HUD state
  const missionText = $derived(buildArenaMissionText(gs.hypothesis));
  let enemyHP = $state(100);
  let comboCount = $state(0);
  let showCritical = $state(false);
  let showCombo = $state(false);
  let criticalText = $state('');
  let battlePhaseLabel = $state('STANDBY');
  // Arena chat log (secondary)
  let chatMessages = $state<Array<ArenaBattleChatMessage & {id: number}>>([]);
  // Particles floating in arena
  let arenaParticles = $state<ArenaParticle[]>([]);

  const phaseLabel = $derived(PHASE_LABELS[gs.phase] || PHASE_LABELS.DRAFT);
  const arenaBattlePhaseDisplay = $derived(buildArenaBattlePhaseDisplay(phaseLabel, battlePhaseLabel, gs.timer));
  const arenaBattleHudDisplay = $derived(buildArenaBattleHudDisplay(currentBtcPrice, enemyHP, battleNarration));
  const arenaBattleLogPreview = $derived(buildArenaBattleLogPreview(chatMessages));
  let pvpVisible = $state(false);
  let matchHistoryOpen = $state(false);

  let rewardState = $state(createArenaRewardState());

  // ═══════ SERVER SYNC STATE ═══════
  let serverMatchId = $state<string | null>(null);
  let serverAnalysis = $state<AnalyzeResponse | null>(null);
  let apiError = $state<string | null>(null);
  const arenaSyncStatus = $derived(buildArenaApiSyncStatus(apiError, serverMatchId));

  // Squad Config handlers
  async function onSquadDeploy(e: { config: import('$lib/stores/gameState').SquadConfig }) {
    await arenaMatchController.deploySquad(e.config);
  }

  function onSquadBack() {
    arenaShellController.goLobby();
  }

  // ═══════ HYPOTHESIS STATE ═══════
  let hypothesisVisible = $state(false);
  let hypothesisTimer = $state(45);
  // ═══════ PREVIEW STATE ═══════
  let previewVisible = $state(false);

  // ═══════ FLOATING DIR BAR STATE ═══════
  let floatDir = $state<'LONG' | 'SHORT' | null>(null);

  // Keep chart interaction state in one adapter-shaped object so the page shell
  // only coordinates phases and server sync.
  let chartBridge = $state(createArenaChartBridgeState());
  const arenaChartPanelProps = $derived({
    showPosition: chartBridge.position.visible,
    posEntry: chartBridge.position.entry,
    posTp: chartBridge.position.tp,
    posSl: chartBridge.position.sl,
    posDir: chartBridge.position.dir,
    agentAnnotations: showMarkers ? chartBridge.annotations : [],
    agentMarkers: showMarkers ? chartBridge.markers : [],
  });

  let _arenaDestroyed = false; // guard for fire-and-forget timers after unmount
  const arenaTimerRegistry = createArenaTimerRegistry({
    isDestroyed: () => _arenaDestroyed,
  });
  const safeTimeout = arenaTimerRegistry.scheduleTimeout;
  const arenaPhaseTimerRuntime = createArenaPhaseTimerRuntime({
    scheduleTimeout: arenaTimerRegistry.scheduleTimeout,
    clearTimeoutHandle: arenaTimerRegistry.clearTimeoutHandle,
  });
  const arenaBattleFeedRuntime = createArenaBattleFeedRuntime({
    getPhase: () => gs.phase,
  });
  const addFeed = arenaBattleFeedRuntime.addFeed;

  const arenaVisualEffectsRuntime = createArenaVisualEffectsRuntime({
    scheduleTimeout: arenaTimerRegistry.scheduleTimeout,
    getFloatingWords: () => floatingWords,
    setFloatingWords: (next) => {
      floatingWords = next;
    },
    setArenaParticles: (next) => {
      arenaParticles = next;
    },
  });

  const arenaAgentRuntime = createArenaAgentRuntime({
    getActiveAgents: () => activeAgents,
    getAgentStates: () => agentStates,
    setAgentStates: (next) => {
      agentStates = next;
    },
    getChatMessages: () => chatMessages,
    setChatMessages: (next) => {
      chatMessages = next;
    },
    safeTimeout,
  });

  function setSpeech(agentId: string, text: string, dur = 1500) {
    arenaAgentRuntime.setSpeech(agentId, text, dur);
  }

  // Keep legacy agent state and sprite state aligned through the battle runtime.
  function setAgentState(agentId: string, st: string) {
    arenaAgentRuntime.setAgentState(agentId, st);
    battlePresentationRuntime.syncAgentState(agentId, st);
  }

  function setAgentEnergy(agentId: string, e: number) {
    arenaAgentRuntime.setAgentEnergy(agentId, e);
    battlePresentationRuntime.syncAgentEnergy(agentId, e);
  }

  function addChatMsg(author: ArenaAgentChatAuthor, text: string, isAction = false) {
    arenaAgentRuntime.addChatMessage(author, text, isAction);
  }

  const battlePresentationRuntime = createArenaBattlePresentationRuntime({
    getActiveAgents: () => activeAgents,
    getHypothesisDir: () => gs.hypothesis?.dir,
    getCharSprites: () => charSprites,
    getVsMeterTarget: () => vsMeterTarget,
    getEnemyHP: () => enemyHP,
    getAgentEnergy: (agentId) => agentStates[agentId]?.energy || 0,
    setCharSprites: (sprites) => {
      charSprites = sprites;
    },
    setAgentState,
    setAgentEnergy,
    setBattleTurns: (turns) => {
      battleTurns = turns;
    },
    setCurrentTurnIdx: (idx) => {
      currentTurnIdx = idx;
    },
    clearChatMessages: () => {
      chatMessages = [];
    },
    appendChatMessage: arenaAgentRuntime.appendChatMessage,
    setBattleNarration: (text) => {
      battleNarration = text;
    },
    setBattlePhaseLabel: (text) => {
      battlePhaseLabel = text;
    },
    setVsMeter: (value) => {
      vsMeter = value;
    },
    setVsMeterTarget: (value) => {
      vsMeterTarget = value;
    },
    setEnemyHP: (value) => {
      enemyHP = value;
    },
    setComboCount: (value) => {
      comboCount = value;
    },
    setShowCombo: (value) => {
      showCombo = value;
    },
    setShowCritical: (value) => {
      showCritical = value;
    },
    setCriticalText: (text) => {
      criticalText = text;
    },
    setShowVsSplash: (value) => {
      showVsSplash = value;
    },
    runChargeEffect: () => {
      sfx.charge();
    },
    runSplashEffect: () => {
      juice_shake('heavy');
      sfx.enter();
      arenaVisualEffectsRuntime.seedArenaParticles();
    },
    runImpactEffect: (variant) => {
      if (variant === 'critical') {
        juice_shake('heavy');
        juice_flash('gold');
        sfx.verdict();
        return;
      }
      if (variant === 'super') {
        juice_shake('medium');
        juice_flash('white');
        sfx.impact();
        return;
      }
      if (variant === 'weak') {
        sfx.step();
        return;
      }
      juice_shake('light');
      sfx.impact();
    },
    isDestroyed: () => _arenaDestroyed,
  });

  const liveEventRuntime = createArenaLiveEventRuntime({
    emitFeed: (message) => addFeed(message.icon, message.name, message.color, message.text),
    getSpeed: () => gs.speed || 1,
    isDestroyed: () => _arenaDestroyed,
  });

  function clearArenaDynamics() {
    liveEventRuntime.clear();
    rewardState = createArenaRewardState();
  }

  let confirmingExit = $state(false);
  let clearBattleSession = () => {};

  const arenaMatchController = createArenaMatchController({
    getCurrentState: () => ({
      pair: gs.pair,
      selectedAgents: gs.selectedAgents,
    }),
    applySquadConfig: (config) => {
      gameState.update((state) => ({ ...state, squadConfig: config }));
    },
    clearFeed: arenaBattleFeedRuntime.clear,
    pushSystemFeed: arenaBattleFeedRuntime.pushSystemFeed,
    setServerMatchId: (matchId) => {
      serverMatchId = matchId;
    },
    clearServerAnalysis: () => {
      serverAnalysis = null;
    },
    setApiError: (message) => {
      apiError = message;
    },
    startAnalysis: startAnalysisFromDraft,
  });

  const arenaShellController = createArenaShellController({
    getPhase: () => gs.phase,
    isInLobby: () => gs.inLobby,
    isPvpVisible: () => pvpVisible,
    isResultVisible: () => resultVisible,
    isConfirmingExit: () => confirmingExit,
    isMatchHistoryOpen: () => matchHistoryOpen,
    setConfirmingExit: (value) => {
      confirmingExit = value;
    },
    setMatchHistoryOpen: (value) => {
      matchHistoryOpen = value;
    },
    safeTimeout,
    clearArenaDynamics,
    clearBattleSession: () => {
      clearBattleSession();
    },
    getChartBridge: () => chartBridge,
    setChartBridge: (next) => {
      chartBridge = next;
    },
    setResultVisible: (value) => {
      resultVisible = value;
    },
    setPreviewVisible: (value) => {
      previewVisible = value;
    },
    setPvpVisible: (value) => {
      pvpVisible = value;
    },
    setHypothesisVisible: (value) => {
      hypothesisVisible = value;
    },
    setFloatDir: (value) => {
      floatDir = value;
    },
    clearServerSyncState: arenaMatchController.clearServerSyncState,
    clearHypothesisInterval: arenaPhaseTimerRuntime.clearHypothesisInterval,
    setAgentsIdle: () => {
      activeAgents.forEach((ag) => {
        setAgentState(ag.id, 'idle');
        setAgentEnergy(ag.id, 0);
      });
    },
    stopRunning: () => {
      gameState.update((state) => ({ ...state, running: false }));
    },
    enterLobby: () => {
      gameState.update((state) => ({
        ...state,
        inLobby: true,
        running: false,
        phase: 'DRAFT',
        timer: 0,
        tournament: createArenaLobbyTournamentSeed(),
      }));
    },
    restartMatch: () => {
      resetPhaseInit();
      engineStartMatch();
    },
    setArenaView: (view) => {
      gameState.update((state) => ({ ...state, arenaView: view }));
    },
  });

  const arenaResultController = createArenaResultController({
    getSnapshot: () => ({
      score: Math.round(gs.score),
      battleResult: gs.battleResult,
      currentPrice: currentBtcPrice,
      basePrice: gs.bases.BTC,
      matchN: gs.matchN,
      streak: gs.streak,
      selectedAgents: gs.selectedAgents,
      activeAgents,
      hypothesis: gs.hypothesis,
      orpoOutput: gs.orpoOutput,
      guardianViolations: gs.guardianCheck?.violations || [],
      serverAnalysis,
      serverMatchId,
    }),
    getRewardState: () => rewardState,
    clearLiveEvents: () => {
      liveEventRuntime.clear();
    },
    clearBattleTurnTimers: () => {
      battlePresentationRuntime.clearTurnTimers();
    },
    applyResolvedGameState: (resolvedResult) => {
      gameState.update((state) => ({
        ...state,
        matchN: resolvedResult.nextMatchN,
        wins: resolvedResult.win ? state.wins + 1 : state.wins,
        losses: resolvedResult.win ? state.losses : state.losses + 1,
        streak: resolvedResult.nextStreak,
        lp: Math.max(0, state.lp + resolvedResult.lpChange),
        fbScore: resolvedResult.fbsResult,
        running: false,
        timer: 0,
      }));
    },
    setResultData: (next) => {
      resultData = next;
    },
    setRewardState: (next) => {
      rewardState = next;
    },
    setResultVisible: (value) => {
      resultVisible = value;
    },
    revealPvpResult: () => {
      arenaPhaseTimerRuntime.schedulePvpReveal(() => {
        pvpVisible = true;
      }, 1500);
    },
    addFeed,
    recordWalletMatch,
    recordAgentMatch,
    addMatchRecord,
    addPnLEntry,
    resolveServerMatch: resolveArenaMatch,
    onResolveError: (error) => {
      console.warn('[Arena] Resolve sync failed:', error);
    },
    onWinEffects: () => {
      sfx.win();
      arenaVisualEffectsRuntime.emitDogeFloatBurst();
      juice_confetti(40);
      juice_flash('green');
      juice_shake('medium');
    },
    onLoseEffects: () => {
      sfx.lose();
      juice_shake('light');
      juice_flash('red');
    },
    setBattleNarration: (text) => {
      battleNarration = text;
    },
    addSystemChat: (icon, color, text) => {
      addChatMsg({ id: 'SYS', name: 'SYSTEM', icon, color } as any, text, true);
    },
    setAgentState,
    setCharState: battlePresentationRuntime.setCharState,
    showCharAction: battlePresentationRuntime.showCharAction,
    setSpeech,
    pickOpponentScore: () => Math.round(50 + Math.random() * 35),
    pickWinMotto: () => WIN_MOTTOS[Math.floor(Math.random() * WIN_MOTTOS.length)],
    pickLoseMotto: () => LOSE_MOTTOS[Math.floor(Math.random() * LOSE_MOTTOS.length)],
    pickWinSpeech: () => DOGE_WIN[Math.floor(Math.random() * DOGE_WIN.length)],
    pickLoseSpeech: () => DOGE_LOSE[Math.floor(Math.random() * DOGE_LOSE.length)],
  });

  const arenaBattleController = createArenaBattleController({
    getSnapshot: () => ({
      activeAgents,
      speed: gs.speed || 3,
      pos: gs.pos,
      hypothesis: gs.hypothesis,
    }),
    isDestroyed: () => _arenaDestroyed,
    onBattleEnter: () => {
      liveEventRuntime.start('BATTLE');
      addFeed('⚔', 'BATTLE', '#FF5E7A', 'Battle in progress!');
      activeAgents.forEach((ag, i) => {
        setAgentState(ag.id, 'alert');
        setSpeech(ag.id, DOGE_BATTLE[i % DOGE_BATTLE.length], 400);
      });
      battlePresentationRuntime.startBattleTurnSequence();
    },
    onMissingPosition: () => {
      gameState.update((state) => ({ ...state, battleResult: null, running: false }));
      safeTimeout(() => {
        advancePhase();
      }, 3000);
    },
    applyBattleBootstrapState: () => {
      gameState.update((state) => ({
        ...state,
        battleTick: null,
        battlePriceHistory: [],
        battleEntryTime: Date.now(),
        battleExitTime: 0,
        battleExitPrice: 0,
      }));
    },
    applyBattleTick: (tick) => {
      gameState.update((state) => ({
        ...state,
        battleTick: tick,
        battlePriceHistory: tick.priceHistory,
      }));
    },
    applyResolvedBattleState: (result, exitTime, exitPrice) => {
      gameState.update((state) => ({
        ...state,
        battleResult: result,
        battleExitTime: exitTime,
        battleExitPrice: exitPrice,
      }));
    },
    setAgentState,
    setSpeech,
    setVsMeter: (value) => {
      vsMeter = value;
    },
    setVsMeterTarget: (value) => {
      vsMeterTarget = value;
    },
    setEnemyHP: (value) => {
      enemyHP = value;
    },
    addFeed,
    advancePhase,
    safeTimeout,
  });

  const arenaChartController = createArenaChartController({
    getHypothesis: () => gs.hypothesis,
    getChartBridge: () => chartBridge,
    setChartBridge: (next) => {
      chartBridge = next;
    },
    setHypothesis: (next) => {
      gameState.update((state) => ({ ...state, hypothesis: next }));
    },
    getShowMarkers: () => showMarkers,
    setShowMarkers: (value) => {
      showMarkers = value;
    },
  });
  clearBattleSession = () => {
    arenaBattleController.clearBattleSession();
    battlePresentationRuntime.clearTurnTimers();
  };

  const arenaPhaseController = createArenaPhaseController({
    onDraftEnter: () => {
      clearArenaDynamics();
      resultVisible = false;
      pvpVisible = false;
      hypothesisVisible = false;
      gameState.update((state) => ({ ...state, arenaView: 'arena' }));
      previewVisible = false;
      floatDir = null;
      chartBridge = createArenaChartBridgeState();
      arenaAgentRuntime.initAgentStates();
      sfx.enter();
      arenaVisualEffectsRuntime.emitDogeFloatBurst();
      addFeed('🐕', 'ARENA', '#E8967D', 'Draft locked. Preparing analysis...');
      activeAgents.forEach((ag, i) => {
        safeTimeout(() => {
          setAgentState(ag.id, 'alert');
          setSpeech(ag.id, DOGE_DEPLOYS[i % DOGE_DEPLOYS.length], 800);
        }, i * 200);
      });
    },
    getSpeed: () => gs.speed || 3,
    getCurrentPrice: () => currentBtcPrice,
    getServerMatchId: () => serverMatchId,
    runAnalysisSync: runArenaAnalysis,
    setServerAnalysis: (analysis) => {
      serverAnalysis = analysis;
    },
    applyAnalysisProjection: (analysis) => {
      const c02 = mapAnalysisToC02(analysis);
      gameState.update((state) => ({
        ...state,
        orpoOutput: c02.orpo,
        ctxBeliefs: c02.ctx,
        guardianCheck: c02.guardian,
        commanderVerdict: c02.commander,
      }));
    },
    onAnalysisEnter: () => {
      liveEventRuntime.start('ANALYSIS');
      battlePresentationRuntime.initCharSprites();
      arenaVisualEffectsRuntime.seedArenaParticles();
      arenaAnalysisPresentationRuntime.runScoutSequence();
      arenaAnalysisPresentationRuntime.runGatherSequence();
      arenaAnalysisPresentationRuntime.runCouncilSequence();
      addFeed('🔍', 'ANALYSIS', '#66CCE6', '5-agent analysis pipeline running...');
    },
    onAnalysisError: (error) => {
      console.warn('[Arena] Server analysis failed:', error);
    },
    onHypothesisEnter: () => {
      liveEventRuntime.start('HYPOTHESIS');
      juice_shake('light');
      sfx.charge();
      battleNarration = '🎯 포지션을 설정하세요!';
      addChatMsg({ id:'SYS', name:'SYSTEM', icon:'🎯', color:'#ffcc00' } as any, '배팅 타임! LONG or SHORT?', true);
      addFeed('🐕', 'ARENA', '#66CCE6', 'HYPOTHESIS: pick direction and set TP/SL.');
      activeAgents.forEach((ag, i) => {
        safeTimeout(() => {
          setAgentState(ag.id, 'think');
          setSpeech(ag.id, '🤔...', 600);
        }, i * 300);
      });
    },
    setHypothesisVisible: (value) => {
      hypothesisVisible = value;
    },
    setFloatDir: (value) => {
      floatDir = value;
    },
    getHypothesisTimer: () => hypothesisTimer,
    setHypothesisTimer: (value) => {
      hypothesisTimer = value;
    },
    clearHypothesisInterval: arenaPhaseTimerRuntime.clearHypothesisInterval,
    setHypothesisInterval: arenaPhaseTimerRuntime.setHypothesisInterval,
    applyNeutralTimeoutSelection: (price) => {
      gameState.update((state) => ({
        ...state,
        hypothesis: {
          dir: 'NEUTRAL', conf: 1, tags: new Set(), tf: '1h', vmode: 'tpsl', closeN: 3,
          entry: price, tp: price * 1.02, sl: price * 0.985, rr: 1.3,
        },
        pos: {
          entry: price,
          tp: price * 1.02,
          sl: price * 0.985,
          dir: 'NEUTRAL',
          rr: 1.3,
          size: 0,
          lev: 0,
        },
      }));
      chartBridge = {
        ...chartBridge,
        position: buildArenaChartPositionFromHypothesis({
          entry: price,
          tp: price * 1.02,
          sl: price * 0.985,
          dir: 'NEUTRAL',
        }),
      };
      addFeed('⏰', 'TIMEOUT', '#93A699', 'Time expired — auto-skip');
    },
    applySubmittedHypothesis: (hypothesis) => {
      gameState.update((state) => ({
        ...state,
        hypothesis: {
          dir: hypothesis.dir,
          conf: hypothesis.conf,
          tags: new Set(),
          tf: hypothesis.tf,
          vmode: hypothesis.vmode,
          closeN: hypothesis.closeN,
          entry: hypothesis.entry,
          tp: hypothesis.tp,
          sl: hypothesis.sl,
          rr: hypothesis.rr,
        },
        pos: {
          entry: hypothesis.entry,
          tp: hypothesis.tp,
          sl: hypothesis.sl,
          dir: hypothesis.dir,
          rr: hypothesis.rr,
          size: 0,
          lev: 0,
        },
      }));
      chartBridge = {
        ...chartBridge,
        position: buildArenaChartPositionFromHypothesis(hypothesis),
      };
      addFeed(
        '🐕',
        'YOU',
        '#E8967D',
        `${hypothesis.dir} · TP $${hypothesis.tp.toLocaleString()} · SL $${hypothesis.sl.toLocaleString()} · R:R 1:${hypothesis.rr}`,
        hypothesis.dir,
      );
      sfx.vote();
    },
    submitHypothesisSync: async (dir, conf) => {
      await submitArenaHypothesis(serverMatchId!, dir, conf);
    },
    onHypothesisSyncError: (error) => {
      console.warn('[Arena] Hypothesis sync failed:', error);
    },
    advancePhase,
    setPreviewVisible: (value) => {
      previewVisible = value;
    },
    onPreviewEnter: () => {
      const hypothesis = gs.hypothesis;
      addFeed('👁', 'PREVIEW', '#DCB970', `Position: ${hypothesis?.dir || 'NEUTRAL'} · Entry $${(hypothesis?.entry || 0).toLocaleString()} · R:R 1:${(hypothesis?.rr || 1).toFixed(1)}`);
      activeAgents.forEach((ag, i) => {
        safeTimeout(() => {
          setAgentState(ag.id, 'think');
          setSpeech(ag.id, '📋 reviewing...', 600);
        }, i * 200);
      });
    },
    clearPreviewAutoTimer: arenaPhaseTimerRuntime.clearPreviewAutoTimer,
    setPreviewAutoTimer: arenaPhaseTimerRuntime.setPreviewAutoTimer,
    onPreviewConfirm: () => {
      sfx.charge();
      addFeed('✅', 'CONFIRMED', '#00CC88', 'Position confirmed — scouting begins!');
    },
    onBattleEnter: () => {
      arenaBattleController.initBattle();
    },
    onResultEnter: () => {
      arenaResultController.initResult();
    },
  });

  const arenaAnalysisPresentationRuntime = createArenaAnalysisPresentationRuntime({
    getActiveAgents: () => activeAgents,
    getSpeed: () => gs.speed || 3,
    safeTimeout,
    addFeed,
    setBattleNarration: (text) => {
      battleNarration = text;
    },
    addChatMessage: addChatMsg,
    setAgentState,
    setAgentEnergy,
    setSpeech,
    setVoteDir: (agentId, dir) => {
      agentStates[agentId] = { ...agentStates[agentId], voteDir: dir };
      agentStates = { ...agentStates };
    },
    showCharAction: battlePresentationRuntime.showCharAction,
    moveChar: battlePresentationRuntime.moveChar,
    applyScoutDecorations: () => {
      chartBridge = {
        ...chartBridge,
        ...buildArenaChartDecorations(activeAgents),
      };
    },
    playScanSound: () => {
      sfx.scan();
    },
    playChargeSound: () => {
      sfx.charge();
    },
    playVoteSound: () => {
      sfx.vote();
    },
  });

  onMount(() => {
    setPhaseInitCallback((phase) => {
      arenaPhaseController.onPhaseInit(phase);
    });
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', arenaShellController.handleKeydown);
    }
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', arenaShellController.handleKeydown);
    }
    _arenaDestroyed = true;
    liveEventRuntime.destroy();
    arenaBattleController.destroy();
    arenaAgentRuntime.destroy();
    battlePresentationRuntime.destroy();
    arenaPhaseTimerRuntime.destroy();
    arenaTimerRegistry.destroy();
  });
</script>

<div class="arena-page arena-space-theme">
  <!-- API Sync Status -->
  {#if arenaSyncStatus}
    <div class="api-status {arenaSyncStatus.tone}">{arenaSyncStatus.label}</div>
  {/if}

  {#if gs.inLobby}
    <Lobby />
  {:else if gs.phase === 'DRAFT'}
    <SquadConfig selectedAgents={gs.selectedAgents} ondeploy={onSquadDeploy} onback={onSquadBack} />
  {:else}
    <!-- ═══════ TOP ARENA NAV BAR ═══════ -->
    <div class="arena-topbar">
      <button class="atb-back" onclick={arenaShellController.confirmGoLobby}>
        {#if confirmingExit}
          <span class="atb-confirm-pulse">EXIT? CLICK AGAIN</span>
        {:else}
          <span class="atb-arrow">←</span> LOBBY
        {/if}
      </button>
      <div class="atb-phase-track">
        {#each arenaPhaseTrack as step, idx}
          <div class="atb-phase" class:active={step.active} class:done={step.done}>
            <span class="atp-dot"></span><span class="atp-label">{step.label}</span>
          </div>
          {#if idx < arenaPhaseTrack.length - 1}
            <div class="atb-connector"></div>
          {/if}
        {/each}
      </div>
      <div class="atb-right">
        <div class="atb-mode" class:pvp={gs.arenaMode === 'PVP'} class:tour={gs.arenaMode === 'TOURNAMENT'}>
          {arenaModeDisplay.fullLabel}
        </div>
        <div class="atb-stats">
          <span class="atb-lp">⚡{gs.lp}</span>
          <span class="atb-wl">{gs.wins}W-{gs.losses}L</span>
        </div>
        <button class="atb-hist" onclick={arenaShellController.toggleMatchHistory}>📋</button>
      </div>
    </div>
    <MatchHistory visible={matchHistoryOpen} onclose={arenaShellController.closeMatchHistory} />

    <!-- ═══════ PHASE GUIDE (all views) ═══════ -->
    <div class="phase-guide-wrap">
      <PhaseGuide phase={gs.phase} pair={gs.pair} timeframe={gs.timeframe} />
    </div>

    <!-- ═══════ VIEW PICKER (always visible) ═══════ -->
    <div class="view-picker-bar">
      <ViewPicker current={gs.arenaView} onselect={arenaShellController.selectArenaView} />
    </div>

    <!-- ═══════ VIEW SWITCHING ═══════ -->
    {#if gs.arenaView !== 'arena'}
      <div class="view-container">
        {#if gs.arenaView === 'chart'}
          <ChartWarView {...arenaAltViewProps} />
        {:else if gs.arenaView === 'mission'}
          <MissionControlView {...arenaAltViewProps} />
        {:else if gs.arenaView === 'card'}
          <CardDuelView {...arenaAltViewProps} />
        {/if}

        <!-- Result Panel for new views -->
        {#if gs.phase === 'RESULT' && resultVisible}
          <div class="result-panel-wrap">
            <ResultPanel
              {...arenaResultPanelProps}
              onPlayAgain={arenaShellController.playAgain}
              onLobby={arenaShellController.goLobby}
            />
          </div>
        {/if}
      </div>
    {:else}
      <ArenaBattleLayout
        chartPanelProps={arenaChartPanelProps}
        onDragTP={arenaChartController.onDragTP}
        onDragSL={arenaChartController.onDragSL}
        onDragEntry={arenaChartController.onDragEntry}
        hypothesisVisible={hypothesisVisible}
        hypothesisTimer={hypothesisTimer}
        onHypothesisSubmit={arenaPhaseController.submitHypothesis}
        floatDir={floatDir}
        onSelectFloatDir={arenaShellController.selectFloatDir}
        previewVisible={previewVisible}
        previewDisplay={arenaPreviewDisplay}
        onConfirmPreview={arenaPhaseController.confirmPreview}
        score={gs.score}
        scoreSummary={arenaScoreSummary}
        streak={gs.streak}
        wins={gs.wins}
        losses={gs.losses}
        lp={gs.lp}
        arenaMode={gs.arenaMode}
        arenaModeDisplay={arenaModeDisplay}
        hypothesisBadge={arenaHypothesisBadge}
        hypothesisDir={gs.hypothesis?.dir ?? null}
        showMarkers={showMarkers}
        onToggleMarkers={arenaChartController.toggleMarkers}
        onTogglePositionVisibility={arenaChartController.togglePositionVisibility}
        onGoLobby={arenaShellController.goLobby}
        missionText={missionText}
        battlePhaseDisplay={arenaBattlePhaseDisplay}
        vsMeter={vsMeter}
        enemyHp={enemyHP}
        battleHudDisplay={arenaBattleHudDisplay}
        arenaParticles={arenaParticles}
        activeAgents={activeAgents}
        charSprites={charSprites}
        currentTurnIdx={currentTurnIdx}
        battleTurns={battleTurns}
        agentStates={agentStates}
        showVsSplash={showVsSplash}
        showCritical={showCritical}
        criticalText={criticalText}
        showCombo={showCombo}
        comboCount={comboCount}
        battleLogPreview={arenaBattleLogPreview}
        battleLogCount={chatMessages.length}
        rewardState={rewardState}
        onCloseReward={arenaResultController.closeReward}
        resultVisible={resultVisible}
        resultData={resultData}
        fbScore={gs.fbScore}
        pvpVisible={pvpVisible}
        resultOverlayTitle={resultOverlayTitle}
        hypothesis={gs.hypothesis}
        onPlayAgain={arenaShellController.playAgain}
        floatingWords={floatingWords}
      />
    {/if}
  {/if}
</div>

<style>
  /* ═══ View Switching + New Components ═══ */
  .lobby-view-picker {
    position: relative;
    z-index: 20;
    padding: 0 16px 16px;
  }
  .view-picker-bar {
    position: relative;
    z-index: 20;
    padding: 0 12px;
    border-bottom: 1px solid rgba(255,105,180,.08);
  }
  .phase-guide-wrap {
    position: relative;
    z-index: 35;
    padding: 0 10px;
  }
  .view-container {
    flex: 1;
    min-height: 0;
    overflow: auto;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 12px;
    gap: 12px;
  }
  .result-panel-wrap {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,.7);
    backdrop-filter: blur(8px);
  }

  .arena-page { width: 100%; height: 100%; position: relative; overflow: hidden; display: flex; flex-direction: column; }
  .arena-space-theme {
    --space-line: rgba(232, 150, 125, 0.25);
    --space-line-strong: rgba(232, 150, 125, 0.45);
    --space-surface: rgba(10, 26, 18, 0.9);
    --space-surface-soft: rgba(10, 26, 18, 0.65);
    --space-text: #f0ede4;
    --space-text-soft: rgba(240, 237, 228, 0.75);
    --space-accent: #e8967d;
    --space-accent-2: #66cce6;
    --space-good: #00cc88;
    --space-bad: #ff5e7a;
  }
  .arena-space-theme::before {
    content: '';
    position: absolute;
    inset: -20% -10%;
    pointer-events: none;
    z-index: 0;
    background:
      radial-gradient(circle at 16% 18%, rgba(232, 150, 125, 0.12), transparent 36%),
      radial-gradient(circle at 85% 12%, rgba(102, 204, 230, 0.08), transparent 34%),
      radial-gradient(circle at 70% 82%, rgba(0, 204, 136, 0.06), transparent 38%);
    animation: spaceDrift 30s linear infinite alternate;
  }
  .arena-space-theme::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    background-image: radial-gradient(circle at center, rgba(255,255,255,.55) 0 1px, transparent 1.5px);
    background-size: 3px 3px;
    opacity: 0.065;
    mix-blend-mode: screen;
  }
  @keyframes spaceDrift {
    from { transform: translate3d(-2%, 0, 0) scale(1); }
    to { transform: translate3d(2%, -2%, 0) scale(1.03); }
  }

  .arena-topbar {
    position: relative;
    z-index: 40;
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-bottom: 1px solid var(--space-line);
    background:
      linear-gradient(180deg, rgba(8, 19, 13, 0.95), rgba(7, 16, 11, 0.9)),
      radial-gradient(circle at 8% -20%, rgba(232, 150, 125, 0.12), transparent 40%);
    backdrop-filter: blur(10px);
  }
  .atb-back {
    border: 1px solid var(--space-line-strong);
    border-radius: 999px;
    background: rgba(10, 26, 18, 0.72);
    color: var(--space-text);
    font: 800 10px/1 var(--fd);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    padding: 7px 13px;
    cursor: pointer;
    transition: transform .16s ease, border-color .16s ease, background .16s ease;
  }
  .atb-back:hover {
    transform: translateY(-1px);
    border-color: rgba(232, 150, 125, 0.7);
    background: rgba(10, 26, 18, 0.84);
  }
  .atb-arrow {
    margin-right: 5px;
  }
  .atb-confirm-pulse {
    color: #ff9c89;
    animation: pulseWarn .9s ease-in-out infinite;
  }
  @keyframes pulseWarn {
    0%, 100% { opacity: .8; }
    50% { opacity: 1; }
  }
  .atb-phase-track {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
  }
  .atb-phase {
    display: flex;
    align-items: center;
    gap: 4px;
    opacity: .62;
    transition: opacity .2s ease, filter .2s ease;
  }
  .atb-phase.active,
  .atb-phase.done {
    opacity: 1;
  }
  .atp-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 1px solid rgba(232, 150, 125, 0.35);
    background: rgba(232, 150, 125, 0.2);
    box-shadow: 0 0 0 rgba(232, 150, 125, 0);
  }
  .atb-phase.active .atp-dot {
    background: #e8967d;
    box-shadow: 0 0 10px rgba(232, 150, 125, 0.7);
  }
  .atb-phase.done .atp-dot {
    background: #1effa0;
    border-color: rgba(130, 255, 207, 0.9);
  }
  .atp-label {
    font: 800 8px/1 var(--fd);
    letter-spacing: 1.3px;
    color: var(--space-text-soft);
    white-space: nowrap;
  }
  .atb-connector {
    width: 20px;
    height: 1px;
    margin: 0 4px;
    background: linear-gradient(90deg, rgba(232, 150, 125, 0.1), rgba(232, 150, 125, 0.35), rgba(232, 150, 125, 0.1));
  }
  .atb-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .atb-mode {
    border: 1px solid rgba(232, 150, 125, 0.4);
    border-radius: 999px;
    background: rgba(232, 150, 125, 0.1);
    color: #e8967d;
    font: 800 8px/1 var(--fd);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    padding: 4px 8px;
  }
  .atb-mode.pvp {
    border-color: rgba(255, 158, 112, 0.7);
    background: rgba(198, 93, 52, 0.18);
    color: #ffd7bb;
  }
  .atb-mode.tour {
    border-color: rgba(249, 199, 127, 0.72);
    background: rgba(186, 133, 54, 0.18);
    color: #ffdeb2;
  }
  .atb-stats {
    display: flex;
    gap: 6px;
    align-items: center;
    font: 700 8px/1 var(--fm);
    color: var(--space-text-soft);
  }
  .atb-lp {
    color: #ffd39e;
  }
  .atb-hist {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: 1px solid rgba(232, 150, 125, 0.4);
    background: rgba(10, 26, 18, 0.8);
    color: #f0ede4;
    font-size: 13px;
    cursor: pointer;
  }
  .atb-hist:hover {
    border-color: rgba(232, 150, 125, 0.6);
    background: rgba(232, 150, 125, 0.12);
  }

  .live-event-stack {
    position: absolute;
    z-index: 21;
    top: 70px;
    left: 10px;
    width: min(328px, calc(100% - 220px));
    display: grid;
    gap: 7px;
    pointer-events: none;
  }

  /* ═══ GAME JUICE KEYFRAMES ═══ */
  :global(.jc-shake-light) { animation: jcShakeL .3s ease; }
  :global(.jc-shake-medium) { animation: jcShakeM .35s ease; }
  :global(.jc-shake-heavy) { animation: jcShakeH .4s ease; }
  @keyframes jcShakeL { 0%,100% { transform: none; } 25% { transform: translate(-2px, 1px); } 75% { transform: translate(2px, -1px); } }
  @keyframes jcShakeM { 0%,100% { transform: none; } 20% { transform: translate(-4px, 2px) rotate(-0.5deg); } 40% { transform: translate(3px, -2px); } 60% { transform: translate(-3px, 1px) rotate(0.3deg); } 80% { transform: translate(2px, -1px); } }
  @keyframes jcShakeH { 0%,100% { transform: none; } 10% { transform: translate(-6px, 3px) rotate(-1deg); } 30% { transform: translate(5px, -4px) rotate(0.8deg); } 50% { transform: translate(-4px, 2px) rotate(-0.5deg); } 70% { transform: translate(6px, -3px) rotate(1deg); } 90% { transform: translate(-3px, 1px); } }
  :global(.jc-flash) { position: fixed; inset: 0; z-index: 9999; pointer-events: none; animation: jcFlash .35s ease forwards; }
  :global(.jc-flash-white) { background: rgba(255,255,255,.6); }
  :global(.jc-flash-green) { background: rgba(0,255,136,.4); }
  :global(.jc-flash-red) { background: rgba(255,50,80,.4); }
  :global(.jc-flash-gold) { background: rgba(255,200,0,.5); }
  @keyframes jcFlash { from { opacity: 1; } to { opacity: 0; } }
  :global(.jc-fly-number) { position: fixed; z-index: 9998; pointer-events: none; font: 900 18px/1 var(--fd); letter-spacing: 2px; text-shadow: 0 2px 6px rgba(0,0,0,.5); animation: jcFly 1.2s ease-out forwards; }
  @keyframes jcFly { 0% { opacity: 1; transform: translateY(0) scale(1); } 100% { opacity: 0; transform: translateY(-60px) scale(1.3); } }
  :global(.jc-confetti) { position: fixed; top: -10px; z-index: 9997; pointer-events: none; animation: jcConfettiFall ease-out forwards; }
  @keyframes jcConfettiFall { 0% { opacity: 1; transform: translateY(0) rotate(0deg); } 100% { opacity: 0; transform: translateY(100vh) rotate(720deg); } }

  @media (max-width: 1024px) {
    .atb-phase-track {
      justify-content: flex-start;
      overflow-x: auto;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
    }
    .atb-phase-track::-webkit-scrollbar {
      display: none;
    }
    .live-event-stack {
      width: min(288px, calc(100% - 190px));
    }
  }
  @media (max-width: 1024px) {
    .arena-topbar {
      grid-template-columns: 1fr auto;
      grid-template-areas:
        'back right'
        'track track';
      row-gap: 8px;
    }
    .atb-back {
      grid-area: back;
      justify-self: start;
    }
    .atb-right {
      grid-area: right;
      justify-self: end;
    }
    .atb-phase-track {
      grid-area: track;
      justify-content: flex-start;
      width: 100%;
    }
    .live-event-stack {
      width: min(300px, calc(100% - 18px));
      top: 106px;
    }
  }

  @media (max-width: 768px) {
    .atp-label {
      font-size: 9px;
      letter-spacing: 1px;
    }
    .atb-connector {
      width: 12px;
      margin: 0 3px;
    }
    .atb-back {
      font-size: 9px;
      padding: 6px 10px;
    }
    .atb-hist {
      width: 28px;
      height: 28px;
    }
    .live-event-stack {
      top: 98px;
    }
  }

  /* ── Wallet Gate ── */
  .wallet-gate {
    position: absolute;
    inset: 0;
    z-index: 90;
    background: rgba(0,0,0,.85);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .wg-card {
    background: #111;
    border: 4px solid var(--yel);
    border-radius: 16px;
    box-shadow: 0 0 40px rgba(232,150,125,.15), 8px 8px 0 #000;
    padding: 40px 48px;
    text-align: center;
    max-width: 400px;
    position: relative;
    overflow: hidden;
  }
  .wg-card::before {
    content: '';
    position: absolute;
    inset: -50%;
    background: repeating-conic-gradient(transparent 0deg 8deg, rgba(232,150,125,.04) 8deg 16deg);
    animation: spin 60s linear infinite;
    z-index: 0;
  }
  .wg-icon { font-size: 48px; margin-bottom: 12px; position: relative; z-index: 1; }
  .wg-title {
    font-family: var(--fd);
    font-size: 22px;
    font-weight: 900;
    letter-spacing: 4px;
    color: var(--yel);
    margin-bottom: 8px;
    position: relative; z-index: 1;
  }
  .wg-sub {
    font-family: var(--fm);
    font-size: 11px;
    color: rgba(255,255,255,.5);
    line-height: 1.5;
    margin-bottom: 20px;
    position: relative; z-index: 1;
  }
  .wg-btn {
    font-family: var(--fd);
    font-size: 13px;
    font-weight: 900;
    letter-spacing: 3px;
    padding: 12px 32px;
    border-radius: 24px;
    border: 3px solid #000;
    box-shadow: 4px 4px 0 #000;
    cursor: pointer;
    background: var(--pk);
    color: #fff;
    transition: all .2s;
    position: relative; z-index: 1;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .wg-btn:hover { transform: translate(-2px, -2px); box-shadow: 6px 6px 0 #000; background: #ff1a8a; }
  .wg-btn:active { transform: translate(1px, 1px); box-shadow: 2px 2px 0 #000; }
  .wg-hint {
    font-family: var(--fm);
    font-size: 9px;
    color: rgba(255,255,255,.5);
    margin-top: 14px;
    letter-spacing: .5px;
    position: relative; z-index: 1;
  }

  /* ═══════ API SYNC STATUS ═══════ */
  .api-status {
    position: fixed;
    bottom: 8px;
    right: 8px;
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 8px;
    z-index: 100;
    opacity: 0.7;
    font-family: monospace;
  }
  .api-status.synced { background: rgba(0,170,68,0.2); color: #00aa44; }
  .api-status.error { background: rgba(255,45,85,0.15); color: #ff6666; }
</style>
