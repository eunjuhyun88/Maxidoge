<script lang="ts">
  import '$lib/styles/arena-tone.css';
  import { gameState } from '$lib/stores/gameState';
  import { recordAgentMatch } from '$lib/stores/agentData';
  import { AGDEFS } from '$lib/data/agents';
  import { sfx } from '$lib/audio/sfx';
  import { PHASE_LABELS, DOGE_WIN, DOGE_LOSE, WIN_MOTTOS, LOSE_MOTTOS } from '$lib/engine/phases';
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
  import {
    buildArenaAltViewProps,
    buildArenaBattleLayoutProps,
    buildArenaChartPanelProps,
    buildArenaMatchSceneProps,
    buildArenaResultPanelProps,
  } from '$lib/arena/selectors/arenaSceneProps';
  import Lobby from '../../components/arena/Lobby.svelte';
  import SquadConfig from '../../components/arena/SquadConfig.svelte';
  import { addMatchRecord } from '$lib/stores/matchHistoryStore';
  import { addPnLEntry } from '$lib/stores/pnlStore';
  import { onMount, onDestroy } from 'svelte';
  import { recordMatch as recordWalletMatch } from '$lib/stores/walletStore';
  import { runArenaAnalysis, submitArenaHypothesis, resolveArenaMatch } from '$lib/api/arenaApi';
  import type { AnalyzeResponse } from '$lib/api/arenaApi';
  import { mapAnalysisToC02 } from '../../components/arena/arenaState';
  import {
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
  import type { ArenaBattleChatMessage } from '$lib/arena/battle/arenaBattlePresentationRuntime';
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
    type ArenaAgentUiState,
  } from '$lib/arena/controllers/arenaAgentRuntime';
  import { createArenaAgentBridge } from '$lib/arena/controllers/arenaAgentBridge';
  import {
    createArenaChartController,
  } from '$lib/arena/controllers/arenaChartController';
  import { createArenaBattleStateBridge } from '$lib/arena/controllers/arenaBattleStateBridge';
  import { createArenaPageStateBridge } from '$lib/arena/controllers/arenaPageStateBridge';
  import { createArenaGameStateBridge } from '$lib/arena/controllers/arenaGameStateBridge';
  import { createArenaUiStateBridge } from '$lib/arena/controllers/arenaUiStateBridge';
  import { createArenaPhaseRuntimeBundle } from '$lib/arena/controllers/arenaPhaseRuntimeBundle';
  import {
    createArenaResultController,
  } from '$lib/arena/controllers/arenaResultController';
  import type { CharSpriteState, BattleTurn } from '$lib/engine/arenaCharacters';
  import { juice_shake, juice_flash, juice_confetti } from '$lib/engine/arenaGameJuice';

  type ArenaMatchSceneComponentType = typeof import('../../components/arena/ArenaMatchScene.svelte').default;

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
  const arenaAltViewProps = $derived(buildArenaAltViewProps({
    phase: gs.phase,
    battleTick: gs.battleTick,
    hypothesis: gs.hypothesis,
    prices: { BTC: currentBtcPrice },
    battleResult: gs.battleResult,
    battlePriceHistory: gs.battlePriceHistory,
    activeAgents: arenaViewAgents,
  }));
  const arenaResultPanelProps = $derived(buildArenaResultPanelProps({
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
  }));

  // UI state
  let agentStates = $state<Record<string, ArenaAgentUiState>>({});
  let resultVisible = $state(false);
  const resultOverlayTitle = $derived(buildArenaResultOverlayTitle(gs.arenaMode, resultData.win));
  let floatingWords = $state<ArenaFloatingWord[]>([]);
  let ArenaMatchSceneComponent = $state<ArenaMatchSceneComponentType | null>(null);

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
  const arenaChartPanelProps = $derived(buildArenaChartPanelProps({
    showPosition: chartBridge.position.visible,
    posEntry: chartBridge.position.entry,
    posTp: chartBridge.position.tp,
    posSl: chartBridge.position.sl,
    posDir: chartBridge.position.dir,
    agentAnnotations: showMarkers ? chartBridge.annotations : [],
    agentMarkers: showMarkers ? chartBridge.markers : [],
  }));

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
  const arenaUiStateBridge = createArenaUiStateBridge({
    getFloatingWords: () => floatingWords,
    setFloatingWords: (next: ArenaFloatingWord[]) => {
      floatingWords = next;
    },
    setArenaParticles: (next: ArenaParticle[]) => {
      arenaParticles = next;
    },
    getRewardState: () => rewardState,
    setRewardState: (next) => {
      rewardState = next;
    },
    setResultData: (next) => {
      resultData = next;
    },
    getShowMarkers: () => showMarkers,
    setShowMarkers: (value) => {
      showMarkers = value;
    },
    createRewardState: createArenaRewardState,
  });

  const arenaVisualEffectsRuntime = createArenaVisualEffectsRuntime({
    scheduleTimeout: arenaTimerRegistry.scheduleTimeout,
    getFloatingWords: arenaUiStateBridge.getFloatingWords,
    setFloatingWords: arenaUiStateBridge.setFloatingWords,
    setArenaParticles: arenaUiStateBridge.setArenaParticles,
  });

  const arenaAgentRuntime = createArenaAgentRuntime({
    getActiveAgents: () => activeAgents,
    getAgentStates: () => agentStates,
    setAgentStates: (next: Record<string, ArenaAgentUiState>) => {
      agentStates = next;
    },
    getChatMessages: () => chatMessages,
    setChatMessages: (next: Array<ArenaBattleChatMessage & { id: number }>) => {
      chatMessages = next;
    },
    safeTimeout,
  });
  const arenaAgentBridge = createArenaAgentBridge({
    runtime: arenaAgentRuntime,
    getAgentStates: () => agentStates,
    setAgentStates: (next: Record<string, ArenaAgentUiState>) => {
      agentStates = next;
    },
  });
  const arenaBattleStateBridge = createArenaBattleStateBridge({
    getCharSprites: () => charSprites,
    getVsMeterTarget: () => vsMeterTarget,
    getEnemyHp: () => enemyHP,
    setCharSprites: (next: Record<string, CharSpriteState>) => (charSprites = next),
    setBattleTurns: (next: BattleTurn[]) => (battleTurns = next),
    setCurrentTurnIdx: (next: number) => (currentTurnIdx = next),
    setBattleNarration: (next: string) => (battleNarration = next),
    setBattlePhaseLabel: (next: string) => (battlePhaseLabel = next),
    setVsMeter: (next: number) => (vsMeter = next),
    setVsMeterTarget: (next: number) => (vsMeterTarget = next),
    setEnemyHp: (next: number) => (enemyHP = next),
    setComboCount: (next: number) => (comboCount = next),
    setShowCombo: (next: boolean) => (showCombo = next),
    setShowCritical: (next: boolean) => (showCritical = next),
    setCriticalText: (next: string) => (criticalText = next),
    setShowVsSplash: (next: boolean) => (showVsSplash = next),
  });
  const arenaPageStateBridge = createArenaPageStateBridge({
    getApiError: () => apiError,
    getChartBridge: () => chartBridge,
    getConfirmingExit: () => confirmingExit,
    getHypothesisTimer: () => hypothesisTimer,
    getMatchHistoryOpen: () => matchHistoryOpen,
    getPvpVisible: () => pvpVisible,
    getResultVisible: () => resultVisible,
    getServerAnalysis: () => serverAnalysis,
    getServerMatchId: () => serverMatchId,
    setApiError: (next) => (apiError = next),
    setChartBridge: (next) => (chartBridge = next),
    setConfirmingExit: (next) => (confirmingExit = next),
    setFloatDir: (next) => (floatDir = next),
    setHypothesisTimer: (next) => (hypothesisTimer = next),
    setHypothesisVisible: (next) => (hypothesisVisible = next),
    setMatchHistoryOpen: (next) => (matchHistoryOpen = next),
    setPreviewVisible: (next) => (previewVisible = next),
    setPvpVisible: (next) => (pvpVisible = next),
    setResultVisible: (next) => (resultVisible = next),
    setServerAnalysis: (next) => (serverAnalysis = next),
    setServerMatchId: (next) => (serverMatchId = next),
  });

  const liveEventRuntime = createArenaLiveEventRuntime({
    emitFeed: (message) => addFeed(message.icon, message.name, message.color, message.text),
    getSpeed: () => gs.speed || 1,
    isDestroyed: () => _arenaDestroyed,
  });

  function clearArenaDynamics() {
    liveEventRuntime.clear();
    arenaUiStateBridge.resetRewardState();
  }

  let confirmingExit = $state(false);
  const arenaGameStateBridge = createArenaGameStateBridge({
    updateGameState: gameState.update,
    createLobbyTournamentSeed: createArenaLobbyTournamentSeed,
  });
  let arenaResultController: {
    closeReward: () => void;
    initResult: () => void;
  };
  const arenaPhaseRuntimeBundle = createArenaPhaseRuntimeBundle({
    getActiveAgents: () => activeAgents,
    getAgentStates: () => agentStates,
    getCurrentPrice: () => currentBtcPrice,
    getHypothesis: () => gs.hypothesis,
    getPosition: () => gs.pos,
    getSpeed: () => gs.speed || 3,
    isDestroyed: () => _arenaDestroyed,
    safeTimeout,
    addFeed,
    advancePhase,
    clearArenaDynamics,
    liveEventStart: (phase) => {
      liveEventRuntime.start(phase);
    },
    onAnalysisError: (error) => {
      console.warn('[Arena] Server analysis failed:', error);
    },
    onHypothesisSyncError: (error) => {
      console.warn('[Arena] Hypothesis sync failed:', error);
    },
    onResultEnter: () => {
      arenaResultController.initResult();
    },
    runAnalysisSync: runArenaAnalysis,
    submitHypothesisSync: async (dir, conf) => {
      await submitArenaHypothesis(arenaPageStateBridge.getServerMatchId()!, dir, conf);
    },
    mapAnalysisToProjection: (analysis) => {
      const c02 = mapAnalysisToC02(analysis);
      return {
        orpoOutput: c02.orpo,
        ctxBeliefs: c02.ctx,
        guardianCheck: c02.guardian,
        commanderVerdict: c02.commander,
      };
    },
    clearChatMessages: () => {
      chatMessages = [];
    },
    agentRuntime: arenaAgentRuntime,
    agentBridge: arenaAgentBridge,
    battleStateBridge: arenaBattleStateBridge,
    pageStateBridge: arenaPageStateBridge,
    gameStateBridge: arenaGameStateBridge,
    phaseTimerRuntime: arenaPhaseTimerRuntime,
    visualEffectsRuntime: arenaVisualEffectsRuntime,
  });
  const arenaPhaseController = arenaPhaseRuntimeBundle.phaseController;
  const battlePresentationRuntime = arenaPhaseRuntimeBundle.battlePresentationRuntime;

  const arenaMatchController = createArenaMatchController({
    getCurrentState: () => ({
      pair: gs.pair,
      selectedAgents: gs.selectedAgents,
    }),
    applySquadConfig: arenaGameStateBridge.applySquadConfig,
    clearFeed: arenaBattleFeedRuntime.clear,
    pushSystemFeed: arenaBattleFeedRuntime.pushSystemFeed,
    setServerMatchId: arenaPageStateBridge.setServerMatchId,
    clearServerAnalysis: arenaPageStateBridge.clearServerAnalysis,
    setApiError: arenaPageStateBridge.setApiError,
    startAnalysis: startAnalysisFromDraft,
  });

  const arenaShellController = createArenaShellController({
    getPhase: () => gs.phase,
    isInLobby: () => gs.inLobby,
    isPvpVisible: arenaPageStateBridge.isPvpVisible,
    isResultVisible: arenaPageStateBridge.isResultVisible,
    isConfirmingExit: arenaPageStateBridge.isConfirmingExit,
    isMatchHistoryOpen: arenaPageStateBridge.isMatchHistoryOpen,
    setConfirmingExit: arenaPageStateBridge.setConfirmingExit,
    setMatchHistoryOpen: arenaPageStateBridge.setMatchHistoryOpen,
    safeTimeout,
    clearArenaDynamics,
    clearBattleSession: arenaPhaseRuntimeBundle.clearBattleSession,
    getChartBridge: arenaPageStateBridge.getChartBridge,
    setChartBridge: arenaPageStateBridge.setChartBridge,
    setResultVisible: arenaPageStateBridge.setResultVisible,
    setPreviewVisible: arenaPageStateBridge.setPreviewVisible,
    setPvpVisible: arenaPageStateBridge.setPvpVisible,
    setHypothesisVisible: arenaPageStateBridge.setHypothesisVisible,
    setFloatDir: arenaPageStateBridge.setFloatDir,
    clearServerSyncState: arenaMatchController.clearServerSyncState,
    clearHypothesisInterval: arenaPhaseTimerRuntime.clearHypothesisInterval,
    setAgentsIdle: () => {
      activeAgents.forEach((ag) => {
        arenaAgentBridge.setAgentState(ag.id, 'idle');
        arenaAgentBridge.setAgentEnergy(ag.id, 0);
      });
    },
    stopRunning: arenaGameStateBridge.stopRunning,
    enterLobby: arenaGameStateBridge.enterLobby,
    restartMatch: () => {
      resetPhaseInit();
      engineStartMatch();
    },
    setArenaView: arenaGameStateBridge.setArenaView,
  });

  arenaResultController = createArenaResultController({
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
      serverAnalysis: arenaPageStateBridge.getServerAnalysis(),
      serverMatchId: arenaPageStateBridge.getServerMatchId(),
    }),
    getRewardState: arenaUiStateBridge.getRewardState,
    clearLiveEvents: () => {
      liveEventRuntime.clear();
    },
    clearBattleTurnTimers: () => {
      battlePresentationRuntime.clearTurnTimers();
    },
    applyResolvedGameState: arenaGameStateBridge.applyResolvedGameState,
    setResultData: arenaUiStateBridge.setResultData,
    setRewardState: arenaUiStateBridge.setRewardState,
    setResultVisible: arenaPageStateBridge.setResultVisible,
    revealPvpResult: () => {
      arenaPhaseTimerRuntime.schedulePvpReveal(() => {
        arenaPageStateBridge.setPvpVisible(true);
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
    setBattleNarration: arenaBattleStateBridge.setBattleNarration,
    addSystemChat: arenaAgentBridge.addSystemChat,
    setAgentState: arenaAgentBridge.setAgentState,
    setCharState: battlePresentationRuntime.setCharState,
    showCharAction: battlePresentationRuntime.showCharAction,
    setSpeech: arenaAgentBridge.setSpeech,
    pickOpponentScore: () => Math.round(50 + Math.random() * 35),
    pickWinMotto: () => WIN_MOTTOS[Math.floor(Math.random() * WIN_MOTTOS.length)],
    pickLoseMotto: () => LOSE_MOTTOS[Math.floor(Math.random() * LOSE_MOTTOS.length)],
    pickWinSpeech: () => DOGE_WIN[Math.floor(Math.random() * DOGE_WIN.length)],
    pickLoseSpeech: () => DOGE_LOSE[Math.floor(Math.random() * DOGE_LOSE.length)],
  });

  const arenaChartController = createArenaChartController({
    getHypothesis: () => gs.hypothesis,
    getChartBridge: arenaPageStateBridge.getChartBridge,
    setChartBridge: arenaPageStateBridge.setChartBridge,
    setHypothesis: arenaGameStateBridge.setHypothesis,
    getShowMarkers: arenaUiStateBridge.getShowMarkers,
    setShowMarkers: arenaUiStateBridge.setShowMarkers,
  });

  const arenaBattleLayoutProps = $derived(buildArenaBattleLayoutProps({
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
  }));
  const arenaMatchSceneProps = $derived(buildArenaMatchSceneProps({
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
    matchHistoryOpen,
    onCloseMatchHistory: arenaShellController.closeMatchHistory,
    phase: gs.phase,
    pair: gs.pair,
    timeframe: gs.timeframe,
    arenaView: gs.arenaView,
    onSelectArenaView: arenaShellController.selectArenaView,
    altViewProps: arenaAltViewProps,
    resultVisible: gs.phase === 'RESULT' && resultVisible,
    resultPanelProps: arenaResultPanelProps,
    onPlayAgain: arenaShellController.playAgain,
    onLobby: arenaShellController.goLobby,
    battleLayoutProps: arenaBattleLayoutProps,
  }));

  function ensureArenaMatchSceneComponent() {
    if (ArenaMatchSceneComponent || typeof window === 'undefined') return;
    void import('../../components/arena/ArenaMatchScene.svelte').then((module) => {
      ArenaMatchSceneComponent = module.default;
    });
  }

  $effect(() => {
    if (gs.inLobby || gs.phase === 'DRAFT') return;
    ensureArenaMatchSceneComponent();
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
    arenaAgentRuntime.destroy();
    arenaPhaseRuntimeBundle.destroy();
    arenaPhaseTimerRuntime.destroy();
    arenaTimerRegistry.destroy();
  });
</script>

<div class="arena-page arena-space-theme">
  {#if gs.inLobby}
    <Lobby />
  {:else if gs.phase === 'DRAFT'}
    <SquadConfig selectedAgents={gs.selectedAgents} ondeploy={onSquadDeploy} onback={onSquadBack} />
  {:else if ArenaMatchSceneComponent}
    <ArenaMatchSceneComponent {...arenaMatchSceneProps} />
  {:else}
    <div class="arena-scene-loading" aria-hidden="true"></div>
  {/if}
</div>

<style>
  /* ═══ View Switching + New Components ═══ */
  .arena-page { width: 100%; height: 100%; position: relative; overflow: hidden; display: flex; flex-direction: column; }
  .arena-scene-loading {
    flex: 1;
    min-height: 0;
  }
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
