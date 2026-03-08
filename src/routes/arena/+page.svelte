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
  import ArenaMatchScene from '../../components/arena/ArenaMatchScene.svelte';
  import SquadConfig from '../../components/arena/SquadConfig.svelte';
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

  type MatchHistoryComponentType = typeof import('../../components/arena/MatchHistory.svelte').default;
  type ResultPanelComponentType = typeof import('../../components/arena/ResultPanel.svelte').default;
  type ChartWarViewComponentType = typeof import('../../components/arena/views/ChartWarView.svelte').default;
  type MissionControlViewComponentType = typeof import('../../components/arena/views/MissionControlView.svelte').default;
  type CardDuelViewComponentType = typeof import('../../components/arena/views/CardDuelView.svelte').default;

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
  let MatchHistoryComponent = $state<MatchHistoryComponentType | null>(null);
  let ResultPanelComponent = $state<ResultPanelComponentType | null>(null);
  let ChartWarViewComponent = $state<ChartWarViewComponentType | null>(null);
  let MissionControlViewComponent = $state<MissionControlViewComponentType | null>(null);
  let CardDuelViewComponent = $state<CardDuelViewComponentType | null>(null);
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

  function ensureMatchHistoryComponent() {
    if (MatchHistoryComponent || typeof window === 'undefined') return;
    void import('../../components/arena/MatchHistory.svelte').then((module) => {
      MatchHistoryComponent = module.default;
    });
  }

  function ensureResultPanelComponent() {
    if (ResultPanelComponent || typeof window === 'undefined') return;
    void import('../../components/arena/ResultPanel.svelte').then((module) => {
      ResultPanelComponent = module.default;
    });
  }

  function ensureAltArenaViewComponent(view: 'chart' | 'mission' | 'card') {
    if (typeof window === 'undefined') return;

    if (view === 'chart') {
      if (ChartWarViewComponent) return;
      void import('../../components/arena/views/ChartWarView.svelte').then((module) => {
        ChartWarViewComponent = module.default;
      });
      return;
    }

    if (view === 'mission') {
      if (MissionControlViewComponent) return;
      void import('../../components/arena/views/MissionControlView.svelte').then((module) => {
        MissionControlViewComponent = module.default;
      });
      return;
    }

    if (CardDuelViewComponent) return;
    void import('../../components/arena/views/CardDuelView.svelte').then((module) => {
      CardDuelViewComponent = module.default;
    });
  }

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

  const arenaBattleLayoutProps = $derived({
    chartRailProps: {
      chartPanelProps: arenaChartPanelProps,
      onDragTP: arenaChartController.onDragTP,
      onDragSL: arenaChartController.onDragSL,
      onDragEntry: arenaChartController.onDragEntry,
      hypothesisVisible,
      hypothesisTimer,
      onHypothesisSubmit: arenaPhaseController.submitHypothesis,
      floatDir,
      onSelectFloatDir: arenaShellController.selectFloatDir,
      previewVisible,
      previewDisplay: arenaPreviewDisplay,
      onConfirmPreview: arenaPhaseController.confirmPreview,
      score: gs.score,
      scoreSummary: arenaScoreSummary,
      streak: gs.streak,
      wins: gs.wins,
      losses: gs.losses,
      lp: gs.lp,
      arenaMode: gs.arenaMode,
      arenaModeDisplay,
      hypothesisBadge: arenaHypothesisBadge,
      hypothesisDir: gs.hypothesis?.dir ?? null,
      showMarkers,
      onToggleMarkers: arenaChartController.toggleMarkers,
      onTogglePositionVisibility: arenaChartController.togglePositionVisibility,
      onGoLobby: arenaShellController.goLobby,
    },
    battleSidebarProps: {
      missionText,
      battlePhaseDisplay: arenaBattlePhaseDisplay,
      vsMeter,
      enemyHp: enemyHP,
      battleHudDisplay: arenaBattleHudDisplay,
      arenaParticles,
      activeAgents,
      charSprites,
      currentTurnIdx,
      battleTurns,
      agentStates,
      showVsSplash,
      showCritical,
      criticalText,
      showCombo,
      comboCount,
      battleLogPreview: arenaBattleLogPreview,
      battleLogCount: chatMessages.length,
      rewardState,
      onCloseReward: arenaResultController.closeReward,
      resultVisible,
      resultData,
      streak: gs.streak,
      fbScore: gs.fbScore,
      pvpVisible,
      resultOverlayTitle,
      arenaModeDisplay,
      score: gs.score,
      hypothesis: gs.hypothesis,
      onGoLobby: arenaShellController.goLobby,
      onPlayAgain: arenaShellController.playAgain,
      floatingWords,
    },
  });
  const arenaMatchSceneProps = $derived({
    arenaSyncStatus,
    confirmingExit,
    phaseTrack: arenaPhaseTrack,
    arenaMode: gs.arenaMode,
    arenaModeDisplay,
    lp: gs.lp,
    wins: gs.wins,
    losses: gs.losses,
    onConfirmGoLobby: arenaShellController.confirmGoLobby,
    onToggleMatchHistory: arenaShellController.toggleMatchHistory,
    MatchHistoryComponent,
    matchHistoryOpen,
    onCloseMatchHistory: arenaShellController.closeMatchHistory,
    phase: gs.phase,
    pair: gs.pair,
    timeframe: gs.timeframe,
    arenaView: gs.arenaView,
    onSelectArenaView: arenaShellController.selectArenaView,
    ChartWarViewComponent,
    MissionControlViewComponent,
    CardDuelViewComponent,
    altViewProps: arenaAltViewProps,
    resultVisible: gs.phase === 'RESULT' && resultVisible,
    ResultPanelComponent,
    resultPanelProps: arenaResultPanelProps,
    onPlayAgain: arenaShellController.playAgain,
    onLobby: arenaShellController.goLobby,
    battleLayoutProps: arenaBattleLayoutProps,
  });

  $effect(() => {
    if (matchHistoryOpen) {
      ensureMatchHistoryComponent();
    }
  });

  $effect(() => {
    if (gs.arenaView === 'chart' || gs.arenaView === 'mission' || gs.arenaView === 'card') {
      ensureAltArenaViewComponent(gs.arenaView);
      if (gs.phase === 'RESULT' && resultVisible) {
        ensureResultPanelComponent();
      }
    }
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
  {#if gs.inLobby}
    <Lobby />
  {:else if gs.phase === 'DRAFT'}
    <SquadConfig selectedAgents={gs.selectedAgents} ondeploy={onSquadDeploy} onback={onSquadBack} />
  {:else}
    <ArenaMatchScene {...arenaMatchSceneProps} />
  {/if}
</div>

<style>
  /* ═══ View Switching + New Components ═══ */
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
</style>
