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
  import ChartPanel from '../../components/arena/ChartPanel.svelte';
  import HypothesisPanel from '../../components/arena/HypothesisPanel.svelte';
  import ArenaRewardModal from '../../components/arena/ArenaRewardModal.svelte';
  import SquadConfig from '../../components/arena/SquadConfig.svelte';
  import MatchHistory from '../../components/arena/MatchHistory.svelte';
  import { pushFeedItem, clearFeed } from '$lib/stores/battleFeedStore';
  import { addMatchRecord } from '$lib/stores/matchHistoryStore';
  import { addPnLEntry } from '$lib/stores/pnlStore';
  import type { Direction } from '$lib/stores/gameState';
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
  import { btcPrice } from '$lib/stores/priceStore';
  import ViewPicker from '../../components/arena/ViewPicker.svelte';
  import PhaseGuide from '../../components/arena/PhaseGuide.svelte';
  import ResultPanel from '../../components/arena/ResultPanel.svelte';
  import ChartWarView from '../../components/arena/views/ChartWarView.svelte';
  import MissionControlView from '../../components/arena/views/MissionControlView.svelte';
  import CardDuelView from '../../components/arena/views/CardDuelView.svelte';
  import type { ArenaResultState } from '$lib/arena/state/arenaTypes';
  import { createArenaTimerRegistry } from '$lib/arena/state/arenaTimerRegistry';
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
  let hypothesisInterval: ReturnType<typeof setInterval> | null = null;

  // ═══════ PREVIEW STATE ═══════
  let previewVisible = $state(false);
  let previewAutoTimer: ReturnType<typeof setTimeout> | null = null;

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

  let pvpShowTimer: ReturnType<typeof setTimeout> | null = null;
  let _arenaDestroyed = false; // guard for fire-and-forget timers after unmount
  const arenaTimerRegistry = createArenaTimerRegistry({
    isDestroyed: () => _arenaDestroyed,
  });
  const safeTimeout = arenaTimerRegistry.scheduleTimeout;

  function addFeed(icon: string, name: string, color: string, text: string, dir?: string) {
    pushFeedItem({
      agentId: name.toLowerCase(),
      agentName: name,
      agentIcon: icon,
      agentColor: color,
      text,
      dir: dir as Direction | undefined,
      phase: gs.phase,
    });
  }

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

  function clearHypothesisCountdown() {
    if (hypothesisInterval) {
      clearInterval(hypothesisInterval);
      hypothesisInterval = null;
    }
  }

  function clearPreviewAutoAdvance() {
    if (previewAutoTimer) {
      clearTimeout(previewAutoTimer);
      previewAutoTimer = null;
    }
  }

  function clearPvpShowTimer() {
    pvpShowTimer = arenaTimerRegistry.clearTimeoutHandle(pvpShowTimer);
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
    clearFeed,
    pushSystemFeed: (text) => {
      pushFeedItem({
        agentId: 'system',
        agentName: 'SYSTEM',
        agentIcon: '🐕',
        agentColor: '#E8967D',
        text,
        phase: 'DRAFT',
      });
    },
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
    clearHypothesisInterval: clearHypothesisCountdown,
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
      clearPvpShowTimer();
      pvpShowTimer = arenaTimerRegistry.scheduleTimeout(() => {
        pvpShowTimer = null;
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
    clearHypothesisInterval: clearHypothesisCountdown,
    setHypothesisInterval: (interval) => {
      hypothesisInterval = interval;
    },
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
    clearPreviewAutoTimer: clearPreviewAutoAdvance,
    setPreviewAutoTimer: (timer) => {
      previewAutoTimer = timer;
    },
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
    if (hypothesisInterval) clearInterval(hypothesisInterval);
    if (previewAutoTimer) clearTimeout(previewAutoTimer);
    clearPvpShowTimer();
    liveEventRuntime.destroy();
    arenaBattleController.destroy();
    arenaAgentRuntime.destroy();
    battlePresentationRuntime.destroy();
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
      <div class="battle-layout">
      <!-- ═══════ LEFT: CHART ═══════ -->
      <div class="chart-side">
        <ChartPanel
          {...arenaChartPanelProps}
          onDragTP={arenaChartController.onDragTP}
          onDragSL={arenaChartController.onDragSL}
          onDragEntry={arenaChartController.onDragEntry}
        />

        <!-- Hypothesis Panel on right side during hypothesis phase -->
        {#if hypothesisVisible}
          <div class="hypo-sidebar">
            <HypothesisPanel timeLeft={hypothesisTimer} onsubmit={arenaPhaseController.submitHypothesis} />
          </div>
        {/if}

        <!-- Floating LONG/SHORT Direction Bar (hypothesis phase) -->
        {#if hypothesisVisible}
          <div class="dir-float-bar">
            <button class="dfb-btn long" class:sel={floatDir === 'LONG'} onclick={() => arenaShellController.selectFloatDir('LONG')}>
              ▲ LONG
            </button>
            <div class="dfb-divider"></div>
            <button class="dfb-btn short" class:sel={floatDir === 'SHORT'} onclick={() => arenaShellController.selectFloatDir('SHORT')}>
              ▼ SHORT
            </button>
          </div>
        {/if}

        <!-- Position Preview Overlay -->
        {#if previewVisible && arenaPreviewDisplay}
          <div class="preview-overlay">
            <div class="preview-card">
              <div class="preview-header">
                <span class="prev-icon">👁</span>
                <span class="prev-title">POSITION PREVIEW</span>
              </div>
              <div class="preview-dir {arenaPreviewDisplay.dirClass}">
                {arenaPreviewDisplay.dirIcon} {arenaPreviewDisplay.dirLabel}
              </div>
              <div class="preview-levels">
                <div class="prev-row">
                  <span class="prev-lbl">ENTRY</span>
                  <span class="prev-val">{arenaPreviewDisplay.entryLabel}</span>
                </div>
                <div class="prev-row tp">
                  <span class="prev-lbl">TP</span>
                  <span class="prev-val">{arenaPreviewDisplay.tpLabel}</span>
                </div>
                <div class="prev-row sl">
                  <span class="prev-lbl">SL</span>
                  <span class="prev-val">{arenaPreviewDisplay.slLabel}</span>
                </div>
              </div>
              <div class="preview-rr">
                R:R <span class="prev-rr-val">{arenaPreviewDisplay.rrLabel}</span>
              </div>
              <div class="preview-config">
                {arenaPreviewDisplay.configLabel}
              </div>
              <button class="preview-confirm" onclick={arenaPhaseController.confirmPreview}>
                ✅ CONFIRM & SCOUT
              </button>
            </div>
          </div>
        {/if}

        <div class="score-bar">
          <div class="sr">
            <svg viewBox="0 0 44 44">
              <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="3"/>
              <circle cx="22" cy="22" r="18" fill="none" stroke={gs.score >= 60 ? '#00CC88' : '#FF5E7A'} stroke-width="3"
                stroke-dasharray="{gs.score * 1.13} 200" stroke-linecap="round" transform="rotate(-90 22 22)"/>
            </svg>
            <span class="n">{gs.score}</span>
          </div>
          <div>
            <div class="sdir" style="color:{arenaScoreSummary.directionColor}">{arenaScoreSummary.directionLabel}</div>
            <div class="smeta">{arenaScoreSummary.meta}</div>
          </div>
          <div class="score-stats">
            <span class="ss-item">🔥{gs.streak}</span>
            <span class="ss-item">{gs.wins}W-{gs.losses}L</span>
            <span class="ss-item lp">⚡{gs.lp} LP</span>
          </div>
          <div class="mode-badge" class:tour={gs.arenaMode === 'TOURNAMENT'} class:pvp={gs.arenaMode === 'PVP'}>
            {arenaModeDisplay.fullLabel}
          </div>
          {#if arenaHypothesisBadge && gs.hypothesis}
            <div class="hypo-badge {gs.hypothesis.dir.toLowerCase()}">
              {arenaHypothesisBadge}
            </div>
          {/if}
          <!-- Chart Toggle Buttons -->
          <div class="chart-toggles">
            <button class="ct-btn" class:on={showMarkers} onclick={arenaChartController.toggleMarkers} title="에이전트 마커">🏷</button>
            <button class="ct-btn" class:on={chartBridge.position.visible} onclick={arenaChartController.togglePositionVisibility} title="TP/SL 라인">📏</button>
          </div>
          <button class="mbtn" onclick={arenaShellController.goLobby}>↺ LOBBY</button>
        </div>
      </div>

      <!-- ═══════ RIGHT: SPATIAL BATTLE ARENA ═══════ -->
      <div class="arena-sidebar">
        <!-- ── MISSION BAR + CLOSE ── -->
        <div class="mission-bar">
          <div class="mission-top">
            <div class="mission-phase">
              <span class="mp-dot" style="background:{arenaBattlePhaseDisplay.color}"></span>
              <span class="mp-label" style="color:{arenaBattlePhaseDisplay.color}">{arenaBattlePhaseDisplay.label}</span>
              {#if arenaBattlePhaseDisplay.timerLabel}<span class="mp-timer">{arenaBattlePhaseDisplay.timerLabel}</span>{/if}
            </div>
            <button class="mission-close" onclick={arenaShellController.goLobby} title="LOBBY">✕</button>
          </div>
          <div class="mission-text">{missionText}</div>
        </div>

        <!-- ── COMBAT HUD ── -->
        <div class="combat-hud">
          <!-- VS Meter -->
          <div class="hud-vs">
            <span class="hud-side long-side">LONG</span>
            <div class="hud-vs-track">
              <div class="hud-vs-fill" style="width:{vsMeter}%"></div>
              <div class="hud-vs-pip" style="left:{vsMeter}%">⚡</div>
            </div>
            <span class="hud-side short-side">SHORT</span>
          </div>
          <!-- Enemy HP -->
          <div class="hud-enemy">
            <span class="hud-enemy-label">MARKET</span>
            <div class="hud-hp-track">
              <div class="hud-hp-fill" style="width:{enemyHP}%;background:linear-gradient(90deg,#ff5e7a,{arenaBattleHudDisplay.enemyHpAccent})"></div>
            </div>
            <span class="hud-hp-num">{arenaBattleHudDisplay.enemyHpLabel}</span>
          </div>
          <!-- Price -->
          <div class="hud-price">{arenaBattleHudDisplay.priceLabel}</div>
        </div>

        <!-- ═══ SPATIAL ARENA (THE GAME WORLD) ═══ -->
        <div class="game-arena">
          <!-- Grid background -->
          <div class="arena-grid-bg"></div>

          <!-- Floating particles -->
          {#each arenaParticles as p (p.id)}
            <div class="arena-particle"
              style="left:{p.x}%;top:{p.y}%;width:{p.size}px;height:{p.size}px;opacity:{p.opacity};animation-duration:{p.speed * 4}s">
            </div>
          {/each}

          <!-- SVG Connection lines between agents and center -->
          <svg class="arena-connections" viewBox="0 0 100 100" preserveAspectRatio="none">
            {#each activeAgents as ag}
              {@const cs = charSprites[ag.id]}
              {#if cs}
                <line x1={cs.x} y1={cs.y} x2="50" y2="50"
                  stroke={ag.color} stroke-width="0.3" stroke-opacity="0.2"
                  stroke-dasharray="1 1" />
              {/if}
            {/each}
          </svg>

          <!-- Center battle node -->
          <div class="arena-center-node">
            <div class="acn-icon">⚔</div>
            <div class="acn-price">{arenaBattleHudDisplay.priceLabel}</div>
          </div>

          <!-- CHARACTER SPRITES -->
          {#each activeAgents as ag, i}
            {@const cs = charSprites[ag.id] || { charState: 'idle', x: 50, y: 50, actionEmoji: '', actionLabel: '', flipX: false, hp: 100, energy: 0, showHit: false, hitText: '', hitColor: '' }}
            {@const isActiveTurn = currentTurnIdx >= 0 && battleTurns[currentTurnIdx]?.agent.id === ag.id}
            <div class="char-sprite cs-{cs.charState}"
              class:active-turn={isActiveTurn}
              style="left:{cs.x}%;top:{cs.y}%;--ag-color:{ag.color};--ag-delay:{i * 0.15}s;{cs.flipX ? 'transform:translate(-50%,-50%) scaleX(-1)' : ''}"
            >
              <!-- Action emoji popup -->
              {#if cs.actionEmoji}
                <div class="char-action-popup">
                  <span class="cap-emoji">{cs.actionEmoji}</span>
                  <span class="cap-label">{cs.actionLabel}</span>
                </div>
              {/if}

              <!-- Hit text flyout -->
              {#if cs.showHit}
                <div class="char-hit-fly" style="color:{cs.hitColor}">{cs.hitText}</div>
              {/if}

              <!-- Character body -->
              <div class="char-body">
                {#if isActiveTurn}
                  <div class="char-turn-ring"></div>
                {/if}
                <div class="char-img-wrap" style="border-color:{ag.color}">
                  {#if ag.img.def}
                    <img src={ag.img.def} alt={ag.name} class="char-img" />
                  {:else}
                    <span class="char-emoji">{ag.icon}</span>
                  {/if}
                </div>
                <!-- Energy aura -->
                <div class="char-aura" style="--aura-color:{ag.color};opacity:{cs.energy > 50 ? 0.3 : 0.1}"></div>
              </div>

              <!-- Name tag -->
              <div class="char-nametag" style="border-color:{ag.color}">{ag.name}</div>

              <!-- HP + Energy bars -->
              <div class="char-bars">
                <div class="char-hpbar"><div class="char-hpfill" style="width:{cs.hp}%;background:{cs.hp > 50 ? '#00ff88' : cs.hp > 25 ? '#ffaa00' : '#ff2d55'}"></div></div>
                <div class="char-ebar"><div class="char-efill" style="width:{cs.energy}%;background:{ag.color}"></div></div>
              </div>

              <!-- Vote direction badge -->
              {#if agentStates[ag.id]?.voteDir}
                <div class="char-vote-badge {agentStates[ag.id].voteDir.toLowerCase()}">{agentStates[ag.id].voteDir === 'LONG' ? '▲' : '▼'}</div>
              {/if}
            </div>
          {/each}

          <!-- VS SPLASH OVERLAY -->
          {#if showVsSplash}
            <div class="arena-vs-splash">
              <span class="avs-team long">LONG</span>
              <span class="avs-x">⚔</span>
              <span class="avs-team short">SHORT</span>
            </div>
          {/if}

          <!-- CRITICAL POPUP -->
          {#if showCritical}
            <div class="arena-critical-popup">{criticalText}</div>
          {/if}

          <!-- COMBO COUNTER -->
          {#if showCombo && comboCount >= 2}
            <div class="arena-combo">COMBO x{comboCount}</div>
          {/if}
        </div>

        <!-- ── NARRATION BAR ── -->
        <div class="sb-narration">
          <div class="narr-icon">⚡</div>
          <div class="narr-text">{arenaBattleHudDisplay.narration}</div>
        </div>

        <!-- ── BATTLE LOG (mini chat) ── -->
        <div class="battle-log">
          {#each arenaBattleLogPreview as msg (msg.id)}
            <div class="bl-line" class:action={msg.isAction}>
              <span class="bl-icon" style="color:{msg.color}">{msg.icon}</span>
              <span class="bl-name" style="color:{msg.color}">{msg.name}</span>
              <span class="bl-text">{msg.text}</span>
            </div>
          {/each}
          {#if chatMessages.length === 0}
            <div class="bl-empty">대기 중...</div>
          {/if}
        </div>

        <!-- ═══════ REWARD MODAL ═══════ -->
        <ArenaRewardModal
          visible={rewardState.visible}
          xpGain={rewardState.xpGain}
          streak={rewardState.streak}
          badges={rewardState.badges}
          onclose={arenaResultController.closeReward}
        />

        <!-- Result Overlay -->
        {#if resultVisible}
          <div class="result-overlay" class:win={resultData.win} class:lose={!resultData.win}>
            <div class="result-text">{resultData.win ? 'VERY WIN WOW!' : 'SUCH SAD'}</div>
            <div class="result-lp">{resultData.tag}<br>{resultData.lp >= 0 ? '+' : ''}{resultData.lp} LP</div>
            {#if gs.streak >= 3}
              <div class="result-streak">🔥×{gs.streak} MUCH STREAK</div>
            {/if}
            {#if gs.fbScore}
              <div class="fbs-card">
                <div class="fbs-title">FBS SCORECARD</div>
                <div class="fbs-row">
                  <span class="fbs-label">DS</span>
                  <div class="fbs-bar"><div class="fbs-fill" style="width:{gs.fbScore.ds}%;background:#e8967d"></div></div>
                  <span class="fbs-val">{gs.fbScore.ds}</span>
                </div>
                <div class="fbs-row">
                  <span class="fbs-label">RE</span>
                  <div class="fbs-bar"><div class="fbs-fill" style="width:{gs.fbScore.re}%;background:#66cce6"></div></div>
                  <span class="fbs-val">{gs.fbScore.re}</span>
                </div>
                <div class="fbs-row">
                  <span class="fbs-label">CI</span>
                  <div class="fbs-bar"><div class="fbs-fill" style="width:{gs.fbScore.ci}%;background:#00cc88"></div></div>
                  <span class="fbs-val">{gs.fbScore.ci}</span>
                </div>
                <div class="fbs-total">
                  <span>FBS</span>
                  <span class="fbs-total-val">{gs.fbScore.fbs}</span>
                </div>
              </div>
            {/if}
            <div class="result-motto">{resultData.motto}</div>
          </div>
        {/if}

        <!-- PvP Result Screen -->
        {#if pvpVisible}
          <div class="pvp-overlay">
            <div class="pvp-card">
              <div class="pvp-title">{resultOverlayTitle}</div>
              {#if arenaModeDisplay.tournamentMeta}
                <div class="pvp-label tour-meta">
                  {arenaModeDisplay.tournamentMeta}
                </div>
              {/if}
              <div class="pvp-scores">
                <div class="pvp-side">
                  <div class="pvp-label">YOUR SCORE</div>
                  <div class="pvp-score">{Math.round(gs.score)}</div>
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
              {#if gs.hypothesis}
                <div class="pvp-hypo">
                  Your call: <span class="{gs.hypothesis.dir.toLowerCase()}">{gs.hypothesis.dir}</span>
                  · R:R 1:{gs.hypothesis.rr.toFixed(1)}
                  {#if gs.hypothesis.consensusType}
                    · <span class="pvp-consensus">{gs.hypothesis.consensusType.toUpperCase()}</span>
                  {/if}
                </div>
              {/if}
              <div class="pvp-btns">
                <button class="pvp-btn lobby" onclick={arenaShellController.goLobby}>↺ LOBBY</button>
                <button class="pvp-btn again" onclick={arenaShellController.playAgain}>🐕 PLAY AGAIN</button>
              </div>
            </div>
          </div>
        {/if}

        <!-- Floating Doge Words (Game Juice) -->
        {#each floatingWords as w (w.id)}
          <div class="doge-float" style="left:{w.x}%;color:{w.color};animation-duration:{w.dur}s">{w.text}</div>
        {/each}
      </div>
    </div>
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

  .battle-layout { display: grid; grid-template-columns: 1fr 380px; flex: 1; min-height: 0; overflow: hidden; }

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

  .chart-side { display: flex; flex-direction: column; background: #07130d; overflow: hidden; border-right: 1px solid rgba(232,150,125,.15); position: relative; }

  /* ═══════ SPATIAL BATTLE ARENA ═══════ */
  .arena-sidebar {
    position: relative;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: linear-gradient(180deg, #0a0a12 0%, #0d0a14 50%, #0a0a12 100%);
    border-left: 1px solid rgba(255,105,180,.15);
  }

  /* ── MISSION BAR ── */
  .mission-bar {
    padding: 8px 12px;
    border-bottom: 1px solid rgba(255,105,180,.2);
    background: linear-gradient(90deg, rgba(255,105,180,.06), rgba(255,105,180,.02));
    flex-shrink: 0;
  }
  .mission-top {
    display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;
  }
  .mission-phase {
    display: flex; align-items: center; gap: 6px;
    font: 800 9px/1 var(--fd); letter-spacing: 1.5px;
  }
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
  .mission-text {
    font: 700 8px/1.3 var(--fm); color: rgba(255,255,255,.5);
    letter-spacing: 0.5px;
  }

  /* ── COMBAT HUD ── */
  .combat-hud {
    padding: 6px 10px;
    border-bottom: 1px solid rgba(255,105,180,.15);
    background: rgba(0,0,0,.3);
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .hud-vs {
    display: flex; align-items: center; gap: 6px;
  }
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
    font-size: 9px;
    filter: drop-shadow(0 0 4px rgba(255,200,0,.6));
    transition: left .5s cubic-bezier(.4,0,.2,1);
    z-index: 2;
  }
  .hud-enemy {
    display: flex; align-items: center; gap: 6px;
  }
  .hud-enemy-label {
    font: 800 6px/1 var(--fd); letter-spacing: 1.5px; color: #ff5e7a; width: 36px;
  }
  .hud-hp-track {
    flex: 1; height: 6px; background: rgba(255,94,122,.1); border-radius: 3px;
    overflow: hidden; border: 1px solid rgba(255,94,122,.2);
  }
  .hud-hp-fill { height: 100%; border-radius: 3px; transition: width .5s ease; }
  .hud-hp-num {
    font: 800 8px/1 var(--fd); color: #ff5e7a; width: 24px; text-align: right;
  }
  .hud-price {
    font: 900 10px/1 var(--fd); color: rgba(255,255,255,.5); text-align: center; letter-spacing: 1px;
    flex-shrink: 0;
  }

  /* ═══ GAME ARENA (THE SPATIAL WORLD) ═══ */
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
  .arena-connections {
    position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1;
  }
  /* Center battle node */
  .arena-center-node {
    position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%);
    z-index: 5; text-align: center;
    width: 52px; height: 52px;
    border-radius: 50%;
    border: 2px solid rgba(255,105,180,.3);
    background: rgba(10,10,20,.8);
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

  /* ── CHARACTER SPRITES ── */
  .char-sprite {
    position: absolute; z-index: 10;
    transform: translate(-50%, -50%);
    transition: left .6s cubic-bezier(.4,0,.2,1), top .6s cubic-bezier(.4,0,.2,1);
    cursor: pointer;
    text-align: center;
  }
  .char-body { position: relative; display: inline-flex; flex-direction: column; align-items: center; }
  .char-img-wrap {
    width: 52px; height: 52px; border-radius: 14px;
    border: 3px solid; overflow: hidden;
    background: #fff;
    box-shadow: 3px 3px 0 rgba(0,0,0,.5);
    transition: all .15s;
  }
  .char-img {
    width: 100%; height: 100%; object-fit: cover; border-radius: 11px;
    filter: hue-rotate(330deg) saturate(1.2);
  }
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
    margin-top: 3px;
    font: 900 7px/1 var(--fd); letter-spacing: 1.5px;
    background: rgba(0,0,0,.7); color: #fff;
    padding: 2px 6px; border-radius: 4px;
    border: 1px solid; white-space: nowrap;
  }
  .char-bars {
    display: flex; flex-direction: column; gap: 1px; margin-top: 2px; width: 42px;
  }
  .char-hpbar {
    height: 4px; background: rgba(255,255,255,.1); border-radius: 2px; overflow: hidden;
    border: 1px solid rgba(255,255,255,.15);
  }
  .char-hpfill { height: 100%; border-radius: 2px; transition: width .5s; }
  .char-ebar {
    height: 3px; background: rgba(255,255,255,.08); border-radius: 2px; overflow: hidden;
  }
  .char-efill { height: 100%; border-radius: 2px; transition: width .3s; }
  .char-vote-badge {
    position: absolute; top: -4px; right: -8px;
    font: 900 8px/1 var(--fd); padding: 2px 4px; border-radius: 4px;
    border: 1px solid #000; z-index: 15;
  }
  .char-vote-badge.long { background: #00ff88; color: #000; }
  .char-vote-badge.short { background: #ff2d55; color: #fff; }

  /* ── Action popup (above character) ── */
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
    background: rgba(0,0,0,.7); padding: 2px 6px; border-radius: 4px;
    white-space: nowrap;
  }

  /* ── Hit text flyout ── */
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

  /* ── CHARACTER STATE ANIMATIONS ── */
  /* IDLE: gentle float */
  .cs-idle .char-body { animation: csIdle 1.4s ease-in-out infinite; animation-delay: var(--ag-delay, 0s); }
  @keyframes csIdle {
    0%,100% { transform: translateY(0); }
    50% { transform: translateY(-4px); }
  }
  /* PATROL: walking bounce */
  .cs-patrol .char-body { animation: csPatrol .4s ease-in-out infinite; }
  @keyframes csPatrol {
    0%,100% { transform: translateY(0) rotate(0); }
    25% { transform: translateY(-5px) rotate(-2deg); }
    75% { transform: translateY(-3px) rotate(2deg); }
  }
  /* LOCK: focused stillness + glow */
  .cs-lock .char-body { animation: csLock .6s ease infinite; }
  .cs-lock .char-img-wrap { box-shadow: 0 0 16px var(--ag-color, #ff69b4) !important; }
  @keyframes csLock {
    0%,100% { transform: scale(1); }
    50% { transform: scale(1.04); }
  }
  /* WINDUP: charging vibrate */
  .cs-windup .char-body { animation: csWindup .08s linear infinite; }
  .cs-windup .char-img-wrap { box-shadow: 0 0 22px var(--ag-color, #ffcc00) !important; }
  @keyframes csWindup {
    0% { transform: translate(-2px, 1px); }
    25% { transform: translate(2px, -1px); }
    50% { transform: translate(-1px, -2px); }
    75% { transform: translate(1px, 2px); }
  }
  /* CAST: lunge forward */
  .cs-cast .char-body { animation: csCast .4s ease; }
  .cs-cast .char-img-wrap { box-shadow: 0 0 28px var(--ag-color, #ff5e7a) !important; border-color: #fff !important; }
  @keyframes csCast {
    0% { transform: scale(1); }
    30% { transform: scale(1.15) translateY(-8px); }
    60% { transform: scale(1.1) translateY(-4px); }
    100% { transform: scale(1); }
  }
  /* IMPACT: flash + bounce */
  .cs-impact .char-body { animation: csImpact .3s ease; }
  @keyframes csImpact {
    0% { transform: scale(1.2); filter: brightness(2); }
    50% { transform: scale(0.95); filter: brightness(1.5); }
    100% { transform: scale(1); filter: brightness(1); }
  }
  /* RECOVER: shrink back */
  .cs-recover .char-body { animation: csRecover .4s ease; }
  @keyframes csRecover {
    0% { transform: scale(.9); opacity: .7; }
    100% { transform: scale(1); opacity: 1; }
  }
  /* CELEBRATE: happy jump */
  .cs-celebrate .char-body { animation: csCelebrate .4s ease-in-out infinite; }
  @keyframes csCelebrate {
    0%,100% { transform: translateY(0) rotate(0) scale(1); }
    25% { transform: translateY(-14px) rotate(-5deg) scale(1.08); }
    75% { transform: translateY(-6px) rotate(3deg) scale(1.04); }
  }
  /* PANIC: shaky sad */
  .cs-panic .char-body { animation: csPanic .2s ease infinite; }
  .cs-panic .char-img-wrap { filter: saturate(.4) brightness(.7); }
  @keyframes csPanic {
    0%,100% { transform: translateX(0) rotate(0); }
    25% { transform: translateX(-3px) rotate(-3deg); }
    75% { transform: translateX(3px) rotate(3deg); }
  }

  /* ── VS Splash (in-arena overlay) ── */
  .arena-vs-splash {
    position: absolute; inset: 0; z-index: 50;
    display: flex; align-items: center; justify-content: center; gap: 16px;
    background: rgba(0,0,0,.85);
    animation: vsSplashIn .4s ease;
  }
  .avs-team {
    font: 900 24px/1 var(--fc); letter-spacing: 4px;
    text-shadow: 0 0 20px currentColor;
  }
  .avs-team.long { color: #00ff88; }
  .avs-team.short { color: #ff5e7a; }
  .avs-x { font-size: 28px; animation: vsXPulse .3s ease infinite alternate; }
  @keyframes vsSplashIn { from { opacity: 0; transform: scale(1.5); } to { opacity: 1; transform: scale(1); } }
  @keyframes vsXPulse { from { transform: scale(1) rotate(-5deg); } to { transform: scale(1.2) rotate(5deg); } }

  /* ── Critical + Combo popups ── */
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

  /* ═══ NARRATION BOX ═══ */
  .sb-narration {
    display: flex; align-items: center; gap: 8px;
    padding: 6px 10px;
    border-top: 1px solid rgba(255,105,180,.15);
    background: rgba(255,105,180,.04);
    flex-shrink: 0; min-height: 32px;
  }
  .narr-icon { font-size: 11px; flex-shrink: 0; }
  .narr-text {
    font: 700 9px/1.3 var(--fm); color: rgba(255,255,255,.7);
    flex: 1; animation: narrFade .3s ease;
  }
  @keyframes narrFade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

  /* ═══ BATTLE LOG (mini chat) ═══ */
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

  /* ═══════ HYPOTHESIS SIDEBAR ═══════ */
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

  /* Score Bar */
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
    font-size: 9px;
    font-family: var(--fd);
    font-weight: 900;
    letter-spacing: 1px;
    border-radius: 7px;
    white-space: nowrap;
  }
  .mode-badge.pvp {
    border-color: rgba(102,204,230,.55);
    background: rgba(102,204,230,.1);
    color: #66cce6;
  }
  .mode-badge.tour {
    border-color: rgba(220,185,112,.65);
    background: rgba(220,185,112,.12);
    color: #dcb970;
  }

  /* Hypothesis Badge in score bar */
  .hypo-badge {
    padding: 3px 10px; border-radius: 8px; font-size: 9px; font-weight: 900;
    font-family: var(--fd); letter-spacing: 1px; border: 2px solid;
  }
  .hypo-badge.long { background: rgba(0,255,136,.15); border-color: #00ff88; color: #00ff88; }
  .hypo-badge.short { background: rgba(255,45,85,.15); border-color: #ff2d55; color: #ff2d55; }
  .hypo-badge.neutral { background: rgba(255,170,0,.15); border-color: #ffaa00; color: #ffaa00; }

  /* Chart Toggle Buttons */
  .chart-toggles {
    display: flex;
    gap: 3px;
    margin-left: 4px;
  }
  .ct-btn {
    width: 26px;
    height: 26px;
    border: 1px solid rgba(255,105,180,.2);
    border-radius: 6px;
    background: rgba(255,105,180,.05);
    font-size: 11px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all .15s;
    opacity: .5;
  }
  .ct-btn.on {
    border-color: rgba(255,105,180,.5);
    background: rgba(255,105,180,.15);
    opacity: 1;
  }
  .ct-btn:hover { opacity: .8; background: rgba(255,105,180,.1); }

  .mbtn { padding: 6px 16px; border-radius: 16px; background: #E8967D; border: 3px solid #000; color: #000; font-family: var(--fd); font-size: 9px; font-weight: 900; letter-spacing: 2px; cursor: pointer; box-shadow: 3px 3px 0 #000; }
  .mbtn:hover { background: #d07a64; }

  /* Result Overlay */
  .result-overlay { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 35; text-align: center; animation: popIn .3s ease; padding: 16px 28px; border-radius: 16px; border: 1px solid rgba(232,150,125,.3); box-shadow: 0 8px 32px rgba(0,0,0,.5); backdrop-filter: blur(8px); }
  .result-overlay.win { background: linear-gradient(135deg, rgba(0,204,136,.25), rgba(0,180,100,.2)); border-color: rgba(0,204,136,.4); }
  .result-overlay.lose { background: linear-gradient(135deg, rgba(255,94,122,.25), rgba(200,50,70,.2)); border-color: rgba(255,94,122,.4); }
  .result-text { font-size: 22px; font-weight: 900; font-family: var(--fc); color: #f0ede4; letter-spacing: 3px; text-shadow: 0 0 12px rgba(232,150,125,.3); }
  .result-lp { font-size: 14px; font-weight: 900; font-family: var(--fd); color: #f0ede4; margin-top: 4px; }
  .result-streak { font-size: 10px; font-weight: 700; color: #e8967d; margin-top: 4px; }
  .result-motto { font-size: 9px; font-family: var(--fc); color: rgba(240,237,228,.6); margin-top: 8px; font-style: italic; }

  /* FBS Scorecard */
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

  /* PvP Result */
  .pvp-overlay { position: absolute; inset: 0; z-index: 40; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.6); backdrop-filter: blur(4px); animation: fadeIn .3s ease; }
  .pvp-card { background: rgba(10,26,18,.95); border: 1px solid rgba(232,150,125,.3); border-radius: 16px; padding: 20px 30px; text-align: center; box-shadow: 0 8px 32px rgba(0,0,0,.5); min-width: 260px; }
  .pvp-title { font-size: 18px; font-weight: 900; font-family: var(--fc); letter-spacing: 3px; color: #f0ede4; }
  .pvp-scores { display: flex; align-items: center; justify-content: center; gap: 16px; margin: 12px 0; }
  .pvp-side { text-align: center; }
  .pvp-label { font-size: 9px; color: #888; font-family: var(--fd); letter-spacing: 2px; }
  .pvp-label.tour-meta {
    margin-top: 2px;
    margin-bottom: 8px;
    font-size: 9px;
    color: #8b6c27;
    letter-spacing: 1px;
  }
  .pvp-score { font-size: 28px; font-weight: 900; font-family: var(--fc); }
  .pvp-vs { font-size: 14px; font-weight: 900; font-family: var(--fc); color: #888; }
  .pvp-lp { font-size: 16px; font-weight: 900; font-family: var(--fd); margin: 8px 0; }
  .pvp-lp.pos { color: #00cc66; }
  .pvp-lp.neg { color: #ff2d55; }
  .pvp-hypo {
    font-size: 9px; font-family: var(--fm); font-weight: 700;
    color: #666; margin: 4px 0 8px;
  }
  .pvp-hypo .long { color: #00cc66; }
  .pvp-hypo .short { color: #ff2d55; }
  .pvp-hypo .neutral { color: #ffaa00; }
  .pvp-consensus { color: #c840ff; }
  .pvp-btns { display: flex; gap: 8px; justify-content: center; margin-top: 12px; }
  .pvp-btn { padding: 8px 20px; border-radius: 12px; border: 3px solid #000; font-family: var(--fd); font-size: 9px; font-weight: 900; letter-spacing: 2px; cursor: pointer; box-shadow: 3px 3px 0 #000; }
  .pvp-btn.lobby { background: #eee; color: #000; }
  .pvp-btn.again { background: #E8967D; color: #000; }
  .pvp-btn:hover { transform: translate(-1px, -1px); box-shadow: 4px 4px 0 #000; }

  /* Doge Float */
  .doge-float { position: absolute; z-index: 25; font-family: var(--fc); font-weight: 900; font-style: italic; font-size: 16px; letter-spacing: 2px; pointer-events: none; animation: dogeUp ease forwards; text-shadow: 2px 2px 0 #000, -1px -1px 0 #000; -webkit-text-stroke: 1px #000; }
  @keyframes dogeUp { 0% { opacity: 1; transform: translateY(0) rotate(-5deg) scale(1); } 100% { opacity: 0; transform: translateY(-100px) rotate(15deg) scale(1.5); } }

  /* ═══════ FLOATING DIRECTION BAR ═══════ */
  .dir-float-bar {
    position: absolute;
    bottom: 55px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 25;
    display: flex;
    align-items: center;
    gap: 0;
    background: #fff;
    border: 3px solid #000;
    border-radius: 20px;
    box-shadow: 4px 4px 0 #000;
    overflow: hidden;
    animation: floatBarIn .3s ease;
  }
  @keyframes floatBarIn {
    from { opacity: 0; transform: translateX(-50%) translateY(20px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
  .dfb-btn {
    padding: 10px 28px;
    border: none;
    font-family: var(--fd);
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 2px;
    cursor: pointer;
    transition: all .15s;
    background: #fafafa;
    color: #888;
  }
  .dfb-btn.long:hover { background: #e8fff0; color: #00aa44; }
  .dfb-btn.short:hover { background: #ffe8ec; color: #cc0033; }
  .dfb-btn.long.sel { background: #00ff88; color: #000; }
  .dfb-btn.short.sel { background: #ff2d55; color: #fff; }
  .dfb-divider { width: 2px; height: 28px; background: #000; }

  /* ═══════ POSITION PREVIEW OVERLAY ═══════ */
  .preview-overlay {
    position: absolute;
    inset: 0;
    z-index: 28;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,.15);
    animation: fadeIn .3s ease;
  }
  .preview-card {
    background: #fff;
    border: 4px solid #000;
    border-radius: 16px;
    padding: 16px 22px;
    box-shadow: 6px 6px 0 #000;
    text-align: center;
    min-width: 240px;
    animation: popIn .3s ease;
  }
  .preview-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border-bottom: 3px solid #000;
    padding-bottom: 8px;
    margin-bottom: 10px;
  }
  .prev-icon { font-size: 18px; }
  .prev-title {
    font-family: var(--fc);
    font-size: 14px;
    font-weight: 900;
    letter-spacing: 2px;
    color: #000;
  }
  .preview-dir {
    font-family: var(--fc);
    font-size: 24px;
    font-weight: 900;
    letter-spacing: 3px;
    margin-bottom: 8px;
  }
  .preview-dir.long { color: #00cc66; }
  .preview-dir.short { color: #ff2d55; }
  .preview-dir.neutral { color: #ffaa00; }
  .preview-levels {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 8px;
  }
  .prev-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 10px;
    border-radius: 6px;
    background: #f8f8f8;
  }
  .prev-row.tp { background: rgba(0,255,136,.1); }
  .prev-row.sl { background: rgba(255,45,85,.08); }
  .prev-lbl {
    font-family: var(--fd);
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 2px;
    color: #888;
  }
  .prev-val {
    font-family: var(--fd);
    font-size: 12px;
    font-weight: 900;
    color: #000;
  }
  .preview-rr {
    font-family: var(--fd);
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 2px;
    color: #888;
    background: #000;
    border-radius: 8px;
    padding: 4px 12px;
    margin-bottom: 6px;
    display: inline-block;
  }
  .prev-rr-val { font-size: 14px; color: #E8967D; }
  .preview-config {
    font-family: var(--fm);
    font-size: 9px;
    font-weight: 700;
    color: #aaa;
    letter-spacing: 1px;
    margin-bottom: 10px;
  }
  .preview-confirm {
    font-family: var(--fd);
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 2px;
    padding: 10px 28px;
    border: 3px solid #000;
    border-radius: 14px;
    background: linear-gradient(180deg, #00ff88, #00cc66);
    color: #000;
    cursor: pointer;
    box-shadow: 3px 3px 0 #000;
    transition: all .15s;
  }
  .preview-confirm:hover {
    transform: translate(-1px, -1px);
    box-shadow: 4px 4px 0 #000;
    background: linear-gradient(180deg, #33ffaa, #00dd77);
  }
  .preview-confirm:active {
    transform: translate(1px, 1px);
    box-shadow: 1px 1px 0 #000;
  }

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

  @keyframes popIn { from { transform: translate(-50%, -50%) scale(.8); opacity: 0 } to { transform: translate(-50%, -50%) scale(1); opacity: 1 } }
  @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }

  @media (max-width: 768px) {
    .battle-layout { grid-template-columns: 1fr; grid-template-rows: 45% 1fr; }
    .chart-side { border-right: none; border-bottom: 4px solid #000; }
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

    /* ═══ HYPOTHESIS BOTTOM SHEET (mobile) ═══ */
    .hypo-sidebar {
      position: fixed;
      top: auto;
      right: 0;
      bottom: 0;
      left: 0;
      max-height: 55vh;
      z-index: 60;
      border-radius: 16px 16px 0 0;
      background: rgba(7, 19, 13, 0.97);
      border-top: 2px solid rgba(232, 150, 125, 0.35);
      box-shadow: 0 -8px 40px rgba(0, 0, 0, 0.6);
      animation: hypoSlideUp 0.3s ease;
      filter: none;
    }
    .hypo-sidebar::before {
      content: '';
      display: block;
      width: 36px;
      height: 4px;
      background: rgba(255, 255, 255, 0.25);
      border-radius: 2px;
      margin: 10px auto 4px;
      flex-shrink: 0;
    }

    /* Direction float bar: above bottom sheet */
    .dir-float-bar {
      position: fixed;
      bottom: calc(55vh + 8px);
      left: 50%;
      transform: translateX(-50%);
      z-index: 61;
    }

    /* Score bar compact */
    .score-bar {
      padding: 4px 8px;
      gap: 6px;
      flex-wrap: wrap;
    }
    .score-stats { gap: 5px; }
    .chart-toggles { gap: 3px; }
    .ct-btn { width: 28px; height: 28px; font-size: 11px; }
    .mbtn { font-size: 8px; padding: 4px 8px; }

    /* Preview overlay: full-screen on mobile */
    .preview-overlay {
      position: fixed;
      inset: 0;
      z-index: 65;
    }
    .preview-card {
      width: calc(100% - 32px);
      max-width: 340px;
    }
  }

  @keyframes hypoSlideUp {
    from { opacity: 0; transform: translateY(100%); }
    to { opacity: 1; transform: translateY(0); }
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
