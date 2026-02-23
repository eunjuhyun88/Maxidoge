<script lang="ts">
  import '$lib/styles/arena-tone.css';
  import { gameState } from '$lib/stores/gameState';
  import { recordAgentMatch } from '$lib/stores/agentData';
  import { AGDEFS, SOURCES } from '$lib/data/agents';
  import { sfx } from '$lib/audio/sfx';
  import { PHASE_LABELS, DOGE_DEPLOYS, DOGE_GATHER, DOGE_BATTLE, DOGE_WIN, DOGE_LOSE, DOGE_VOTE_LONG, DOGE_WORDS, WIN_MOTTOS, LOSE_MOTTOS } from '$lib/engine/phases';
  import { normalizeAgentId } from '$lib/engine/agents';
  import { startMatch as engineStartMatch, advancePhase, setPhaseInitCallback, resetPhaseInit, startAnalysisFromDraft } from '$lib/engine/gameLoop';
  import { calculateLP, determineConsensus } from '$lib/engine/scoring';
  import Lobby from '../../components/arena/Lobby.svelte';
  import ChartPanel from '../../components/arena/ChartPanel.svelte';
  import HypothesisPanel from '../../components/arena/HypothesisPanel.svelte';
  import SquadConfig from '../../components/arena/SquadConfig.svelte';
  import MatchHistory from '../../components/arena/MatchHistory.svelte';
  import SpeechBubble from '../../components/arena/SpeechBubble.svelte';
  import { pushFeedItem, clearFeed } from '$lib/stores/battleFeedStore';
  import { addMatchRecord, type MatchRecord } from '$lib/stores/matchHistoryStore';
  import { matchRecordToReplayData, generateReplaySteps, createReplayState, type ReplayStep } from '$lib/engine/replay';
  import { addPnLEntry } from '$lib/stores/pnlStore';
  import type { Phase } from '$lib/stores/gameState';
  import { onMount, onDestroy } from 'svelte';
  import { isWalletConnected, connectWallet, recordMatch as recordWalletMatch } from '$lib/stores/walletStore';
  import { formatTimeframeLabel } from '$lib/utils/timeframe';
  import { createArenaMatch, submitArenaDraft, runArenaAnalysis, submitArenaHypothesis, resolveArenaMatch, getTournamentBracket } from '$lib/api/arenaApi';
  import type { AnalyzeResponse, TournamentBracketMatch } from '$lib/api/arenaApi';
  import type { DraftSelection } from '$lib/engine/types';

  $: walletOk = $isWalletConnected;

  $: state = $gameState;
  $: modeLabel = state.arenaMode;
  $: tournamentInfo = state.tournament;
  $: resultOverlayTitle = state.arenaMode === 'TOURNAMENT'
    ? (resultData.win ? '🏆 TOURNAMENT WIN 🏆' : '☠ TOURNAMENT LOSS ☠')
    : state.arenaMode === 'PVP'
      ? (resultData.win ? '🏆 YOU WIN! 🏆' : '💀 YOU LOSE 💀')
      : (resultData.win ? '🏁 PVE CLEAR' : '❌ PVE FAILED');
  // Active agents for this match
  $: activeAgents = AGDEFS.filter(a => state.selectedAgents.includes(a.id));
  $: railRank = [...activeAgents].sort((a, b) => b.conf - a.conf);
  $: longBalance = Math.max(0, Math.min(100, Math.round(state.score)));

  // UI state
  let findings: Array<{def: typeof AGDEFS[0]; visible: boolean}> = [];
  let agentStates: Record<string, {state: string; speech: string; energy: number; voteDir: string; posX?: number; posY?: number}> = {};
  let verdictVisible = false;
  let resultVisible = false;
  let resultData = { win: false, lp: 0, tag: '', motto: '' };
  let floatingWords: Array<{id: number; text: string; color: string; x: number; dur: number}> = [];
  let feedMessages: Array<{icon: string; name: string; color: string; text: string; dir?: string; isNew?: boolean}> = [];
  let councilActive = false;
  let phaseLabel = PHASE_LABELS.DRAFT;
  let pvpVisible = false;
  let matchHistory: Array<{n: number; win: boolean; lp: number; score: number; streak: number}> = [];
  let historyOpen = false;
  let matchHistoryOpen = false;
  let arenaRailTab: 'rank' | 'log' | 'map' = 'rank';

  // ═══════ SERVER SYNC STATE ═══════
  let serverMatchId: string | null = null;
  let serverAnalysis: AnalyzeResponse | null = null;
  let apiError: string | null = null;

  // Squad Config handlers
  async function onSquadDeploy(e: CustomEvent<{ config: import('$lib/stores/gameState').SquadConfig }>) {
    gameState.update(s => ({ ...s, squadConfig: e.detail.config }));
    clearFeed();
    pushFeedItem({
      agentId: 'system', agentName: 'SYSTEM', agentIcon: '🐕',
      agentColor: '#E8967D',
      text: `Squad configured! Risk: ${e.detail.config.riskLevel.toUpperCase()} · TF: ${formatTimeframeLabel(e.detail.config.timeframe)} · Analysis starting...`,
      phase: 'DRAFT'
    });

    // ── Server sync: create match + submit draft ──
    const currentState = $gameState;
    try {
      apiError = null;
      const matchRes = await createArenaMatch(currentState.pair, e.detail.config.timeframe);
      serverMatchId = matchRes.matchId;

      // Build draft from selected agents (equal weight for now)
      const agentCount = currentState.selectedAgents.length;
      if (agentCount <= 0) throw new Error('No agents selected for draft');
      const weight = Math.round(100 / agentCount);
      const draft: DraftSelection[] = currentState.selectedAgents.map((agentId, i) => ({
        agentId: normalizeAgentId(agentId),
        specId: 'base',
        weight: i === agentCount - 1 ? 100 - weight * (agentCount - 1) : weight,
      }));
      await submitArenaDraft(serverMatchId, draft);
    } catch (err) {
      console.warn('[Arena] Server sync failed (match continues locally):', err);
      apiError = (err as Error).message;
    }

    startAnalysisFromDraft();
  }

  function onSquadBack() {
    // Go back to lobby
    gameState.update(s => ({ ...s, inLobby: true, running: false, phase: 'DRAFT', timer: 0 }));
  }

  // ═══════ HYPOTHESIS STATE ═══════
  let hypothesisVisible = false;
  let hypothesisTimer = 45;
  let hypothesisInterval: ReturnType<typeof setInterval> | null = null;
  let _battleInterval: ReturnType<typeof setInterval> | null = null;

  // ═══════ REPLAY STATE ═══════
  let replayState = createReplayState();
  let replaySteps: ReplayStep[] = [];
  let replayTimer: ReturnType<typeof setTimeout> | null = null;

  function startReplay(record: MatchRecord) {
    const data = matchRecordToReplayData(record);
    replaySteps = generateReplaySteps(data);
    replayState = { active: true, data, currentStep: 0, totalSteps: replaySteps.length, paused: false };

    // Close history panel
    historyOpen = false;

    addFeed('🎬', 'REPLAY', '#66CCE6', `Replaying Match #${record.matchN}...`);
    executeReplayStep(0);
  }

  function executeReplayStep(stepIdx: number) {
    if (stepIdx >= replaySteps.length || !replayState.active) {
      // Replay finished
      replayState = { ...replayState, active: false };
      addFeed('🎬', 'REPLAY', '#66CCE6', 'Replay complete!');
      return;
    }

    replayState = { ...replayState, currentStep: stepIdx };
    const step = replaySteps[stepIdx];
    const speed = state.speed || 3;

    switch (step.type) {
      case 'deploy':
        addFeed('🐕', 'REPLAY', '#66CCE6', `Agents deployed: ${step.agents.length} agents`);
        break;
      case 'hypothesis':
        if (step.hypothesis) {
          addFeed('🐕', 'REPLAY', '#66CCE6', `Your call: ${step.hypothesis.dir} · R:R 1:${step.hypothesis.rr.toFixed(1)}`);
        }
        break;
      case 'scout':
        step.agentVotes.forEach((v, i) => {
          setTimeout(() => {
            addFeed(v.icon, v.name, v.color, `${v.dir} — ${v.conf}% confidence`);
          }, i * 300 / speed);
        });
        break;
      case 'council':
        addFeed('🗳', 'REPLAY', '#66CCE6', 'Council deliberation...');
        break;
      case 'verdict':
        addFeed('★', 'REPLAY', '#66CCE6', `Consensus: ${step.consensusType?.toUpperCase() || 'UNKNOWN'}`);
        break;
      case 'battle':
        addFeed('⚔', 'REPLAY', '#66CCE6', `Battle result: ${step.battleResult?.toUpperCase() || 'UNKNOWN'}`);
        break;
      case 'result':
        addFeed(step.win ? '🏆' : '😢', 'REPLAY', step.win ? '#00CC88' : '#FF5E7A',
          `${step.win ? 'WIN' : 'LOSS'} · ${step.lp > 0 ? '+' : ''}${step.lp} LP`);
        break;
    }

    // Auto-advance to next step
    replayTimer = setTimeout(() => {
      executeReplayStep(stepIdx + 1);
    }, 2000 / speed);
  }

  function exitReplay() {
    if (replayTimer) { clearTimeout(replayTimer); replayTimer = null; }
    replayState = createReplayState();
    replaySteps = [];
  }

  // ═══════ PREVIEW STATE ═══════
  let previewVisible = false;
  let previewAutoTimer: ReturnType<typeof setTimeout> | null = null;

  // ═══════ FLOATING DIR BAR STATE ═══════
  let floatDir: 'LONG' | 'SHORT' | null = null;

  // ═══════ COMPARE STATE ═══════
  let compareVisible = false;
  let compareData = {
    userDir: 'LONG' as string,
    agentDir: 'LONG' as string,
    userEntry: 0, userTp: 0, userSl: 0,
    agentScore: 0,
    consensus: { type: 'partial', lpMult: 1.0, badge: 'PARTIAL x1.0' },
    agentVotes: [] as Array<{name: string; icon: string; color: string; dir: string; conf: number}>
  };

  // ═══════ CHART POSITION STATE ═══════
  let showChartPosition = false;
  let chartPosEntry: number | null = null;
  let chartPosTp: number | null = null;
  let chartPosSl: number | null = null;
  let chartPosDir = 'LONG';

  // ═══════ CHART AGENT MARKERS ═══════
  let chartAgentMarkers: Array<{
    time: number;
    position: 'aboveBar' | 'belowBar';
    color: string;
    shape: 'circle' | 'square' | 'arrowUp' | 'arrowDown';
    text: string;
  }> = [];

  // ═══════ CHART ANNOTATIONS ═══════
  let chartAnnotations: Array<{
    id: string; icon: string; name: string; color: string;
    label: string; detail: string;
    yPercent: number; xPercent: number;
    type: 'ob' | 'funding' | 'whale' | 'signal';
  }> = [];

  function generateAnnotations() {
    const anns: typeof chartAnnotations = [];
    const agents = activeAgents;

    // STRUCTURE agent → OB zone
    const structAg = agents.find(a => a.id === 'structure');
    if (structAg) {
      anns.push({
        id: 'ob-zone', icon: '⚡', name: 'STRUCTURE', color: structAg.color,
        label: structAg.finding.title,
        detail: structAg.finding.detail,
        yPercent: 25 + Math.random() * 15,
        xPercent: 60 + Math.random() * 20,
        type: 'ob'
      });
    }

    // DERIV agent → Funding rate
    const derivAg = agents.find(a => a.id === 'deriv');
    if (derivAg) {
      anns.push({
        id: 'funding-zone', icon: '📊', name: 'DERIV', color: derivAg.color,
        label: derivAg.finding.title,
        detail: derivAg.finding.detail,
        yPercent: 15 + Math.random() * 10,
        xPercent: 75 + Math.random() * 15,
        type: 'funding'
      });
    }

    // FLOW agent → Whale deposit
    const flowAg = agents.find(a => a.id === 'flow');
    if (flowAg) {
      anns.push({
        id: 'whale-zone', icon: '💰', name: 'FLOW', color: flowAg.color,
        label: flowAg.finding.title,
        detail: flowAg.finding.detail,
        yPercent: 40 + Math.random() * 15,
        xPercent: 45 + Math.random() * 20,
        type: 'whale'
      });
    }

    // SENTI agent → Social signal
    const sentiAg = agents.find(a => a.id === 'senti');
    if (sentiAg) {
      anns.push({
        id: 'senti-zone', icon: '💜', name: 'SENTI', color: sentiAg.color,
        label: sentiAg.finding.title,
        detail: sentiAg.finding.detail,
        yPercent: 55 + Math.random() * 15,
        xPercent: 55 + Math.random() * 25,
        type: 'signal'
      });
    }

    // MACRO agent → Regime zone
    const macroAg = agents.find(a => a.id === 'macro');
    if (macroAg) {
      anns.push({
        id: 'macro-zone', icon: '🌍', name: 'MACRO', color: macroAg.color,
        label: macroAg.finding.title,
        detail: macroAg.finding.detail,
        yPercent: 70 + Math.random() * 10,
        xPercent: 30 + Math.random() * 15,
        type: 'signal'
      });
    }

    chartAnnotations = anns;
  }

  function generateAgentMarkers() {
    // Generate LWC markers from active agents' signals
    const now = Math.floor(Date.now() / 1000);
    const markers: typeof chartAgentMarkers = [];

    activeAgents.forEach((ag, i) => {
      const isLong = ag.dir === 'LONG';
      markers.push({
        time: now - (activeAgents.length - i) * 3600, // spread across recent candles
        position: isLong ? 'belowBar' : 'aboveBar',
        color: ag.color,
        shape: isLong ? 'arrowUp' : 'arrowDown',
        text: `${ag.icon} ${ag.name}`
      });
    });

    // Sort by time (required by LWC)
    markers.sort((a, b) => a.time - b.time);
    chartAgentMarkers = markers;
  }

  function initAgentStates() {
    agentStates = {};
    for (const ag of activeAgents) {
      agentStates[ag.id] = { state: 'idle', speech: '', energy: 0, voteDir: '' };
    }
  }

  // Typing animation state
  let speechTimers: Record<string, ReturnType<typeof setInterval>> = {};

  function setSpeech(agentId: string, text: string, dur = 1500) {
    // Clear any existing typing timer for this agent
    if (speechTimers[agentId]) { clearInterval(speechTimers[agentId]); delete speechTimers[agentId]; }

    // Start typing effect: reveal one char at a time
    let charIdx = 0;
    const fullText = text;
    agentStates[agentId] = { ...agentStates[agentId], speech: '' };
    agentStates = { ...agentStates };

    speechTimers[agentId] = setInterval(() => {
      charIdx++;
      if (charIdx >= fullText.length) {
        // Typing complete
        clearInterval(speechTimers[agentId]);
        delete speechTimers[agentId];
        agentStates[agentId] = { ...agentStates[agentId], speech: fullText };
        agentStates = { ...agentStates };

        // Clear after duration
        if (dur > 0) setTimeout(() => {
          if (agentStates[agentId]) {
            agentStates[agentId] = { ...agentStates[agentId], speech: '' };
            agentStates = { ...agentStates };
          }
        }, dur);
      } else {
        agentStates[agentId] = { ...agentStates[agentId], speech: fullText.slice(0, charIdx) + '|' };
        agentStates = { ...agentStates };
      }
    }, 30);
  }

  function setAgentState(agentId: string, st: string) {
    if (agentStates[agentId]) {
      agentStates[agentId] = { ...agentStates[agentId], state: st };
      agentStates = { ...agentStates };
    }
  }

  function setAgentEnergy(agentId: string, e: number) {
    if (agentStates[agentId]) {
      agentStates[agentId] = { ...agentStates[agentId], energy: e };
      agentStates = { ...agentStates };
    }
  }

  let feedCursorTimer: ReturnType<typeof setTimeout> | null = null;
  let compareAutoTimer: ReturnType<typeof setTimeout> | null = null;
  let pvpShowTimer: ReturnType<typeof setTimeout> | null = null;
  let _arenaDestroyed = false; // guard for fire-and-forget timers after unmount

  function addFeed(icon: string, name: string, color: string, text: string, dir?: string) {
    // Add with 'new' flag for slide-in animation + blinking cursor
    const msg = { icon, name, color, text, dir, isNew: true };
    feedMessages = [...feedMessages.map(m => ({ ...m, isNew: false })), msg].slice(-10);

    // Remove cursor after 500ms
    if (feedCursorTimer) clearTimeout(feedCursorTimer);
    feedCursorTimer = setTimeout(() => {
      feedMessages = feedMessages.map(m => ({ ...m, isNew: false }));
    }, 500);
  }

  function dogeFloat() {
    const colors = ['#FF5E7A', '#E8967D', '#66CCE6', '#00CC88', '#DCB970', '#F0EDE4'];
    const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      setTimeout(() => {
        const id = Date.now() + i;
        floatingWords = [...floatingWords, {
          id,
          text: DOGE_WORDS[Math.floor(Math.random() * DOGE_WORDS.length)],
          color: colors[Math.floor(Math.random() * colors.length)],
          x: 10 + Math.random() * 80,
          dur: 1.5 + Math.random() * 1
        }];
        setTimeout(() => { floatingWords = floatingWords.filter(w => w.id !== id); }, 2500);
      }, i * 200);
    }
  }

  // ═══════ HYPOTHESIS HANDLERS ═══════
  function onHypothesisSubmit(e: CustomEvent) {
    const h = e.detail;
    // Clear timer
    if (hypothesisInterval) { clearInterval(hypothesisInterval); hypothesisInterval = null; }
    hypothesisVisible = false;

    // Set hypothesis in game state
    gameState.update(s => ({
      ...s,
      hypothesis: {
        dir: h.dir,
        conf: h.conf,
        tags: new Set(),
        tf: h.tf,
        vmode: h.vmode,
        closeN: h.closeN,
        entry: h.entry,
        tp: h.tp,
        sl: h.sl,
        rr: h.rr
      },
      pos: {
        entry: h.entry,
        tp: h.tp,
        sl: h.sl,
        dir: h.dir,
        rr: h.rr,
        size: 0,
        lev: 0
      }
    }));

    // Show position on chart
    showChartPosition = true;
    chartPosEntry = h.entry;
    chartPosTp = h.tp;
    chartPosSl = h.sl;
    chartPosDir = h.dir;

    addFeed('🐕', 'YOU', '#E8967D', `${h.dir} · TP $${h.tp.toLocaleString()} · SL $${h.sl.toLocaleString()} · R:R 1:${h.rr}`, h.dir);
    sfx.vote();

    // ── Server sync: submit hypothesis ──
    if (serverMatchId) {
      const dirMap: Record<string, 'LONG' | 'SHORT' | 'NEUTRAL'> = { LONG: 'LONG', SHORT: 'SHORT', NEUTRAL: 'NEUTRAL' };
      submitArenaHypothesis(serverMatchId, dirMap[h.dir] || 'NEUTRAL', h.conf)
        .catch(err => console.warn('[Arena] Hypothesis sync failed:', err));
    }

    // HYPOTHESIS -> BATTLE
    advancePhase();
  }

  // Floating direction bar handler
  function selectFloatDir(d: 'LONG' | 'SHORT') {
    floatDir = d;
  }

  // Chart drag handlers
  function onDragTP(e: CustomEvent) {
    chartPosTp = e.detail.price;
    // Also update hypothesis panel if visible
    gameState.update(s => {
      if (s.hypothesis) {
        return { ...s, hypothesis: { ...s.hypothesis, tp: e.detail.price, rr: Math.abs(e.detail.price - (s.hypothesis.entry || 0)) / Math.max(1, Math.abs((s.hypothesis.entry || 0) - (s.hypothesis.sl || 0))) } };
      }
      return s;
    });
  }

  function onDragSL(e: CustomEvent) {
    chartPosSl = e.detail.price;
    gameState.update(s => {
      if (s.hypothesis) {
        return { ...s, hypothesis: { ...s.hypothesis, sl: e.detail.price, rr: Math.abs((s.hypothesis.tp || 0) - (s.hypothesis.entry || 0)) / Math.max(1, Math.abs((s.hypothesis.entry || 0) - e.detail.price)) } };
      }
      return s;
    });
  }

  function onDragEntry(e: CustomEvent) {
    chartPosEntry = e.detail.price;
    gameState.update(s => {
      if (s.hypothesis) {
        return { ...s, hypothesis: { ...s.hypothesis, entry: e.detail.price } };
      }
      return s;
    });
  }

  // ═══════ PHASE HANDLERS ═══════
  function onPhaseInit(phase: Phase) {
    phaseLabel = PHASE_LABELS[phase] || PHASE_LABELS.DRAFT;

    switch (phase) {
      case 'DRAFT': initDraft(); break;
      case 'ANALYSIS': initAnalysis(); break;
      case 'HYPOTHESIS': initHypothesis(); break;
      case 'BATTLE': initBattle(); break;
      case 'RESULT': initResult(); break;
    }
  }

  function initDraft() {
    findings = [];
    verdictVisible = false;
    resultVisible = false;
    pvpVisible = false;
    councilActive = false;
    hypothesisVisible = false;
    compareVisible = false;
    previewVisible = false;
    floatDir = null;
    showChartPosition = false;
    chartPosEntry = null;
    chartPosTp = null;
    chartPosSl = null;
    chartAnnotations = [];
    chartAgentMarkers = [];
    initAgentStates();
    sfx.enter();
    dogeFloat();
    addFeed('🐕', 'ARENA', '#E8967D', 'Draft locked. Preparing analysis...');
    activeAgents.forEach((ag, i) => {
      setTimeout(() => {
        setAgentState(ag.id, 'alert');
        setSpeech(ag.id, DOGE_DEPLOYS[i % DOGE_DEPLOYS.length], 800);
      }, i * 200);
    });
  }

  function initAnalysis() {
    initScout();
    initGather();
    initCouncil();
    addFeed('🔍', 'ANALYSIS', '#66CCE6', '5-agent analysis pipeline running...');

    // ── Server sync: run analysis in background ──
    if (serverMatchId) {
      runArenaAnalysis(serverMatchId)
        .then(res => {
          serverAnalysis = res;
          console.log('[Arena] Server analysis complete:', res.meta);
        })
        .catch(err => {
          console.warn('[Arena] Server analysis failed:', err);
        });
    }
  }

  function initHypothesis() {
    // Show hypothesis panel for user prediction
    hypothesisVisible = true;
    floatDir = null; // Reset floating dir bar
    const speed = state.speed || 3;
    hypothesisTimer = Math.round(30 / speed);

    // Countdown timer
    if (hypothesisInterval) clearInterval(hypothesisInterval);
    hypothesisInterval = setInterval(() => {
      hypothesisTimer -= 1;
      if (hypothesisTimer <= 0) {
        // Auto-skip if time runs out
        if (hypothesisInterval) { clearInterval(hypothesisInterval); hypothesisInterval = null; }
        hypothesisVisible = false;

        // Default: NEUTRAL (skip)
        const price = state.prices.BTC;
        gameState.update(s => ({
          ...s,
          hypothesis: {
            dir: 'NEUTRAL', conf: 1, tags: new Set(), tf: '1h', vmode: 'tpsl', closeN: 3,
            entry: price, tp: price * 1.02, sl: price * 0.985, rr: 1.3
          },
          pos: {
            entry: price,
            tp: price * 1.02,
            sl: price * 0.985,
            dir: 'NEUTRAL',
            rr: 1.3,
            size: 0,
            lev: 0
          }
        }));
        showChartPosition = true;
        chartPosEntry = price;
        chartPosTp = price * 1.02;
        chartPosSl = price * 0.985;
        chartPosDir = 'NEUTRAL';
        addFeed('⏰', 'TIMEOUT', '#93A699', 'Time expired — auto-skip');
        advancePhase();
      }
    }, 1000);

    addFeed('🐕', 'ARENA', '#66CCE6', 'HYPOTHESIS: pick direction and set TP/SL.');

    // Agents go into think state
    activeAgents.forEach((ag, i) => {
      setTimeout(() => {
        setAgentState(ag.id, 'think');
        setSpeech(ag.id, '🤔...', 600);
      }, i * 300);
    });
  }

  function initPreview() {
    previewVisible = true;
    const h = state.hypothesis;
    addFeed('👁', 'PREVIEW', '#DCB970', `Position: ${h?.dir || 'NEUTRAL'} · Entry $${(h?.entry || 0).toLocaleString()} · R:R 1:${(h?.rr || 1).toFixed(1)}`);

    // Agents look at the position
    activeAgents.forEach((ag, i) => {
      setTimeout(() => {
        setAgentState(ag.id, 'think');
        setSpeech(ag.id, '📋 reviewing...', 600);
      }, i * 200);
    });

    // Auto-advance after 5s if user doesn't confirm
    const speed = state.speed || 3;
    previewAutoTimer = setTimeout(() => {
      confirmPreview();
    }, 5000 / speed);
  }

  function confirmPreview() {
    if (previewAutoTimer) { clearTimeout(previewAutoTimer); previewAutoTimer = null; }
    previewVisible = false;
    sfx.charge();
    addFeed('✅', 'CONFIRMED', '#00CC88', 'Position confirmed — scouting begins!');
    advancePhase();
  }

  function initScout() {
    addFeed('🔍', 'SCOUT', '#66CCE6', 'Agents scouting data sources...');
    // Generate chart annotations from active agents
    generateAnnotations();
    // Generate agent signal markers on chart
    generateAgentMarkers();
    const speed = state.speed || 3;

    // Map agents to their nearest data source
    const sourceMap: Record<string, typeof SOURCES[0]> = {};
    const agentSourcePairs: Array<{agentId: string; source: typeof SOURCES[0]}> = [
      { agentId: 'structure', source: SOURCES.find(s => s.id === 'binance')! },
      { agentId: 'deriv', source: SOURCES.find(s => s.id === 'coinglass')! },
      { agentId: 'flow', source: SOURCES.find(s => s.id === 'onchain')! },
      { agentId: 'senti', source: SOURCES.find(s => s.id === 'social')! },
      { agentId: 'macro', source: SOURCES.find(s => s.id === 'feargreed')! },
    ];

    activeAgents.forEach((ag, i) => {
      const pair = agentSourcePairs.find(p => p.agentId === ag.id);
      const targetSource = pair?.source || SOURCES[i % SOURCES.length];

      setTimeout(() => {
        if (_arenaDestroyed) return;
        // Phase 1: Walk toward data source — move agent position
        setAgentState(ag.id, 'walk');
        if (targetSource) {
          agentStates[ag.id] = {
            ...agentStates[ag.id],
            posX: targetSource.x * 100,
            posY: targetSource.y * 100
          };
          agentStates = { ...agentStates };
        }
        sfx.scan();

        setTimeout(() => {
          if (_arenaDestroyed) return;
          // Phase 2: Arrive at source + charge up energy
          setAgentState(ag.id, 'charge');
          setAgentEnergy(ag.id, 30);
          setSpeech(ag.id, ag.speech.scout, 800 / speed);

          setTimeout(() => {
            if (_arenaDestroyed) return;
            // Phase 3: Energy full → show finding (at source)
            setAgentEnergy(ag.id, 75);
            addFeed(ag.icon, ag.name, ag.color, ag.finding.title, ag.dir);

            setTimeout(() => {
              if (_arenaDestroyed) return;
              // Phase 4: Full charge + decision — return to original position
              setAgentEnergy(ag.id, 100);
              sfx.charge();
              setAgentState(ag.id, 'alert');

              // Return to home position
              const homeX = 50 + (i - Math.floor(activeAgents.length / 2)) * 16;
              agentStates[ag.id] = {
                ...agentStates[ag.id],
                posX: homeX,
                posY: 44
              };
              agentStates = { ...agentStates };

              findings = [...findings, { def: ag, visible: true }];

              // Phase 5: Return to idle stance
              setTimeout(() => {
                if (!_arenaDestroyed) setAgentState(ag.id, 'idle');
              }, 500 / speed);
            }, 300 / speed);
          }, 300 / speed);
        }, 500 / speed);
      }, i * 500 / speed);
    });
  }

  function initGather() {
    councilActive = true;
    addFeed('📊', 'GATHER', '#66CCE6', 'Gathering analysis data...');
    activeAgents.forEach((ag, i) => {
      setTimeout(() => {
        setAgentState(ag.id, 'vote');
        setSpeech(ag.id, DOGE_GATHER[i % DOGE_GATHER.length], 400);
      }, i * 150);
    });
  }

  function initCouncil() {
    addFeed('🗳', 'COUNCIL', '#E8967D', 'Agents voting on direction...');
    activeAgents.forEach((ag, i) => {
      setTimeout(() => {
        const dir = ag.dir;
        agentStates[ag.id] = { ...agentStates[ag.id], voteDir: dir };
        agentStates = { ...agentStates };
        setSpeech(ag.id, ag.speech.vote, 600);
        sfx.vote();
        addFeed(ag.icon, ag.name, ag.color, `Vote: ${dir} (${ag.conf}%)`, dir);
      }, i * 400 / (state.speed || 3));
    });
  }

  function initVerdict() {
    const score = Math.round(state.score);
    const bullish = activeAgents.filter(a => a.dir === 'LONG').length;
    const agentDir = score >= 60 ? 'LONG' : 'WAIT';
    verdictVisible = true;

    // Set position from hypothesis
    const curPrice = state.prices.BTC;
    gameState.update(s => ({
      ...s,
      pos: s.hypothesis ? {
        entry: s.hypothesis.entry, tp: s.hypothesis.tp, sl: s.hypothesis.sl,
        dir: s.hypothesis.dir as any, rr: s.hypothesis.rr, size: 0, lev: 0
      } : {
        entry: curPrice, tp: curPrice * 1.02, sl: curPrice * 0.985,
        dir: 'LONG', rr: 1.3, size: 0, lev: 0
      }
    }));

    // Update chart position to match
    const h = state.hypothesis;
    if (h) {
      showChartPosition = true;
      chartPosEntry = h.entry;
      chartPosTp = h.tp;
      chartPosSl = h.sl;
      chartPosDir = h.dir;
    }

    sfx.verdict();
    dogeFloat();
    addFeed('⭐', 'VERDICT', '#E8967D', `Agent verdict: ${agentDir} · Score ${score} · ${bullish}/${activeAgents.length} agree`, agentDir);
    activeAgents.forEach((ag, i) => {
      setTimeout(() => {
        setAgentState(ag.id, 'jump');
        setSpeech(ag.id, DOGE_VOTE_LONG[i % DOGE_VOTE_LONG.length], 600);
      }, i * 100);
    });
  }

  function initCompare() {
    // Compare user hypothesis vs agent consensus
    const h = state.hypothesis;
    const userDir = h?.dir || 'NEUTRAL';
    const agentDirs = activeAgents.map(a => a.dir);
    const longs = agentDirs.filter(d => d === 'LONG').length;
    const agentDir = longs > agentDirs.length / 2 ? 'LONG' : 'SHORT';
    const consensus = determineConsensus(userDir, agentDirs, false);

    compareData = {
      userDir,
      agentDir,
      userEntry: h?.entry || 0,
      userTp: h?.tp || 0,
      userSl: h?.sl || 0,
      agentScore: Math.round(state.score),
      consensus,
      agentVotes: activeAgents.map(ag => ({
        name: ag.name,
        icon: ag.icon,
        color: ag.color,
        dir: ag.dir,
        conf: ag.conf
      }))
    };
    compareVisible = true;

    // Update consensus in game state
    gameState.update(s => ({
      ...s,
      hypothesis: s.hypothesis ? { ...s.hypothesis, consensusType: consensus.type, lpMult: consensus.lpMult } : s.hypothesis
    }));

    addFeed('⚔️', 'COMPARE', '#DCB970', `${consensus.badge} — You: ${userDir} vs Agents: ${agentDir}`);
    sfx.charge();

    // Auto-advance after compare display
    const speed = state.speed || 3;
    if (compareAutoTimer) clearTimeout(compareAutoTimer);
    compareAutoTimer = setTimeout(() => {
      compareAutoTimer = null;
      if (_arenaDestroyed) return;
      compareVisible = false;
      advancePhase();
    }, 4000 / speed);
  }

  function initBattle() {
    verdictVisible = false;
    compareVisible = false;
    addFeed('⚔', 'BATTLE', '#FF5E7A', 'Battle in progress!');
    activeAgents.forEach((ag, i) => {
      setAgentState(ag.id, 'alert');
      setSpeech(ag.id, DOGE_BATTLE[i % DOGE_BATTLE.length], 400);
    });

    // Simulate TP/SL hit
    const fallbackPos = state.hypothesis
      ? {
        entry: state.hypothesis.entry,
        tp: state.hypothesis.tp,
        sl: state.hypothesis.sl,
        dir: state.hypothesis.dir,
        rr: state.hypothesis.rr,
        size: 0,
        lev: 0
      }
      : null;
    const pos = state.pos || fallbackPos;
    if (!pos) {
      gameState.update(s => ({ ...s, battleResult: null, running: false }));
      setTimeout(() => advancePhase(), 3000);
      return;
    }

    let elapsed = 0;
    if (_battleInterval) clearInterval(_battleInterval);
    _battleInterval = setInterval(() => {
      elapsed += 500;
      gameState.update(s => {
        const price = s.prices.BTC * (1 + (Math.random() - 0.48) * 0.0015);
        const isLong = pos.dir === 'LONG';
        const tpHit = isLong ? price >= pos.tp : price <= pos.tp;
        const slHit = isLong ? price <= pos.sl : price >= pos.sl;
        if (tpHit || slHit || elapsed >= 8000) {
          if (_battleInterval) { clearInterval(_battleInterval); _battleInterval = null; }
          const result = tpHit ? 'tp' : slHit ? 'sl' : (price > pos.entry ? 'time_win' : 'time_loss');
          setTimeout(() => advancePhase(), 500);
          return { ...s, prices: { ...s.prices, BTC: price }, battleResult: result };
        }
        return { ...s, prices: { ...s.prices, BTC: price } };
      });
    }, 500);
  }

  function initResult() {
    const myScore = Math.round(state.score);
    const oppScore = Math.round(50 + Math.random() * 35);
    const br = state.battleResult;

    let win = false;
    let resultTag = '';
    if (br === 'tp') { win = true; resultTag = 'TP HIT! ✅'; }
    else if (br === 'sl') { win = false; resultTag = 'SL HIT ❌'; }
    else if (br === 'close_win' || br === 'time_win') { win = true; resultTag = 'Profit ✅'; }
    else if (br === 'close_loss' || br === 'time_loss') { win = false; resultTag = 'Loss ❌'; }
    else { win = myScore > oppScore; resultTag = 'Score'; }

    const consensus = determineConsensus(
      state.hypothesis?.dir || 'LONG',
      activeAgents.map(a => a.dir),
      false
    );
    const lpChange = calculateLP(win, state.streak, consensus.lpMult);

    gameState.update(s => ({
      ...s,
      matchN: s.matchN + 1,
      wins: win ? s.wins + 1 : s.wins,
      losses: win ? s.losses : s.losses + 1,
      streak: win ? s.streak + 1 : 0,
      lp: Math.max(0, s.lp + lpChange)
    }));

    // Update progression (wallet + per-agent)
    recordWalletMatch(win, lpChange);
    activeAgents.forEach(ag => {
      recordAgentMatch(ag.id, {
        matchN: state.matchN + 1,
        dir: ag.dir,
        conf: ag.conf,
        win,
        lp: lpChange
      });
    });

    // History (local + persistent store)
    matchHistory = [{ n: state.matchN + 1, win, lp: lpChange, score: myScore, streak: win ? state.streak + 1 : 0 }, ...matchHistory].slice(0, 30);

    // Persist to matchHistoryStore
    addMatchRecord({
      matchN: state.matchN + 1,
      win,
      lp: lpChange,
      score: myScore,
      streak: win ? state.streak + 1 : 0,
      agents: state.selectedAgents,
      agentVotes: activeAgents.map(ag => ({
        agentId: ag.id, name: ag.name, icon: ag.icon, color: ag.color, dir: ag.dir, conf: ag.conf
      })),
      hypothesis: state.hypothesis ? {
        dir: state.hypothesis.dir, conf: state.hypothesis.conf,
        tf: state.hypothesis.tf, entry: state.hypothesis.entry,
        tp: state.hypothesis.tp, sl: state.hypothesis.sl, rr: state.hypothesis.rr
      } : null,
      battleResult: state.battleResult,
      consensusType: consensus.type,
      lpMult: consensus.lpMult,
      signals: activeAgents.map(ag => `${ag.name}: ${ag.dir} ${ag.conf}%`)
    });

    // Record PnL entry
    addPnLEntry(
      'arena',
      `match-${state.matchN + 1}`,
      lpChange,
      `${win ? 'WIN' : 'LOSS'} · M${state.matchN + 1} · ${state.hypothesis?.dir || 'NEUTRAL'} · ${consensus.type}`
    );

    // ── Server sync: resolve match ──
    if (serverMatchId) {
      const exitP = state.prices.BTC;
      resolveArenaMatch(serverMatchId, exitP)
        .then(res => {
          console.log('[Arena] Match resolved on server:', res.result);
        })
        .catch(err => console.warn('[Arena] Resolve sync failed:', err));
    }

    resultData = {
      win,
      lp: lpChange,
      tag: resultTag,
      motto: win ? WIN_MOTTOS[Math.floor(Math.random() * WIN_MOTTOS.length)] : LOSE_MOTTOS[Math.floor(Math.random() * LOSE_MOTTOS.length)]
    };
    resultVisible = true;

    if (win) {
      sfx.win();
      dogeFloat();
      activeAgents.forEach(ag => { setAgentState(ag.id, 'jump'); setSpeech(ag.id, DOGE_WIN[Math.floor(Math.random() * DOGE_WIN.length)], 800); });
    } else {
      sfx.lose();
      activeAgents.forEach(ag => { setAgentState(ag.id, 'sad'); setSpeech(ag.id, DOGE_LOSE[Math.floor(Math.random() * DOGE_LOSE.length)], 800); });
    }

    addFeed(win ? '🏆' : '💀', 'RESULT', win ? '#00CC88' : '#FF5E7A',
      win ? `WIN! +${lpChange} LP [${resultTag}]` : `LOSE [${resultTag}] ${lpChange} LP`);

    if (pvpShowTimer) clearTimeout(pvpShowTimer);
    pvpShowTimer = setTimeout(() => { pvpShowTimer = null; if (!_arenaDestroyed) pvpVisible = true; }, 1500);
    gameState.update((s) => ({ ...s, running: false, timer: 0 }));
  }

  function initCooldown() {
    verdictVisible = false;
    resultVisible = false;
    councilActive = false;
    compareVisible = false;
    previewVisible = false;
    showChartPosition = false;
    activeAgents.forEach(ag => {
      setAgentState(ag.id, 'idle');
      setAgentEnergy(ag.id, 0);
    });
    gameState.update(s => ({ ...s, running: false }));
  }

  function goLobby() {
    serverMatchId = null;
    serverAnalysis = null;
    apiError = null;
    pvpVisible = false;
    resultVisible = false;
    verdictVisible = false;
    hypothesisVisible = false;
    compareVisible = false;
    previewVisible = false;
    floatDir = null;
    showChartPosition = false;
    if (hypothesisInterval) { clearInterval(hypothesisInterval); hypothesisInterval = null; }
    gameState.update(s => ({
      ...s,
      inLobby: true,
      running: false,
      phase: 'DRAFT',
      timer: 0,
      tournament: {
        tournamentId: null,
        round: null,
        type: null,
        pair: null,
        entryFeeLp: null,
      }
    }));
  }

  function playAgain() {
    serverMatchId = null;
    serverAnalysis = null;
    apiError = null;
    pvpVisible = false;
    resultVisible = false;
    verdictVisible = false;
    hypothesisVisible = false;
    compareVisible = false;
    previewVisible = false;
    floatDir = null;
    showChartPosition = false;
    findings = [];
    resetPhaseInit();
    engineStartMatch();
  }

  // ═══════ BRACKET STATE ═══════
  let bracketMatches: TournamentBracketMatch[] = [];
  let bracketRound = 1;
  let bracketLoading = false;

  async function loadBracket() {
    if (!state.tournament?.tournamentId) return;
    bracketLoading = true;
    try {
      const res = await getTournamentBracket(state.tournament.tournamentId);
      bracketMatches = res.matches;
      bracketRound = res.round;
    } catch (e) {
      console.warn('[Arena] bracket load failed:', e);
    } finally {
      bracketLoading = false;
    }
  }

  // Load bracket when switching to MAP tab in tournament mode
  $: if (arenaRailTab === 'map' && state.arenaMode === 'TOURNAMENT') {
    loadBracket();
  }

  // ═══════ ESC KEY HANDLER ═══════
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && !state.inLobby) {
      e.preventDefault();
      if (state.phase === 'RESULT' || pvpVisible || resultVisible) {
        goLobby();
      } else if (confirmingExit) {
        confirmingExit = false;
      } else {
        confirmingExit = true;
        setTimeout(() => { confirmingExit = false; }, 3000);
      }
    }
  }

  let confirmingExit = false;

  function confirmGoLobby() {
    if (state.phase === 'RESULT' || pvpVisible || state.phase === 'DRAFT') {
      goLobby();
    } else if (confirmingExit) {
      goLobby();
    } else {
      confirmingExit = true;
      setTimeout(() => { confirmingExit = false; }, 3000);
    }
  }

  onMount(() => {
    setPhaseInitCallback(onPhaseInit);
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeydown);
    }
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', handleKeydown);
    }
    _arenaDestroyed = true;
    if (hypothesisInterval) clearInterval(hypothesisInterval);
    if (_battleInterval) clearInterval(_battleInterval);
    if (previewAutoTimer) clearTimeout(previewAutoTimer);
    if (replayTimer) clearTimeout(replayTimer);
    if (feedCursorTimer) clearTimeout(feedCursorTimer);
    if (compareAutoTimer) clearTimeout(compareAutoTimer);
    if (pvpShowTimer) clearTimeout(pvpShowTimer);
    // Clean up typing timers
    Object.values(speechTimers).forEach(t => clearInterval(t));
  });
</script>

<div class="arena-page">
  <!-- Wallet Gate Overlay -->
  {#if !walletOk}
    <div class="wallet-gate">
      <div class="wg-card">
        <div class="wg-icon">🔗</div>
        <div class="wg-title">CONNECT WALLET</div>
        <div class="wg-sub">Connect your wallet to access the Arena and start trading battles</div>
        <button class="wg-btn" on:click={() => connectWallet()}>
          <span>⚡</span> CONNECT WALLET
        </button>
        <div class="wg-hint">Supported: MetaMask · WalletConnect · Coinbase</div>
      </div>
    </div>
  {/if}

  <!-- API Sync Status -->
  {#if apiError}
    <div class="api-status error">⚠️ Offline mode</div>
  {:else if serverMatchId}
    <div class="api-status synced">🟢 Synced</div>
  {/if}

  {#if state.inLobby}
    <Lobby />
  {:else if state.phase === 'DRAFT'}
    <SquadConfig selectedAgents={state.selectedAgents} on:deploy={onSquadDeploy} on:back={onSquadBack} />
  {:else}
    <!-- ═══════ TOP ARENA NAV BAR ═══════ -->
    <div class="arena-topbar">
      <button class="atb-back" on:click={confirmGoLobby}>
        {#if confirmingExit}
          <span class="atb-confirm-pulse">EXIT? CLICK AGAIN</span>
        {:else}
          <span class="atb-arrow">←</span> LOBBY
        {/if}
      </button>
      <div class="atb-phase-track">
        <div class="atb-phase done">
          <span class="atp-dot"></span><span class="atp-label">DRAFT</span>
        </div>
        <div class="atb-connector"></div>
        <div class="atb-phase" class:active={state.phase === 'ANALYSIS'} class:done={['HYPOTHESIS','BATTLE','RESULT'].includes(state.phase)}>
          <span class="atp-dot"></span><span class="atp-label">SCAN</span>
        </div>
        <div class="atb-connector"></div>
        <div class="atb-phase" class:active={state.phase === 'HYPOTHESIS'} class:done={['BATTLE','RESULT'].includes(state.phase)}>
          <span class="atp-dot"></span><span class="atp-label">HYPO</span>
        </div>
        <div class="atb-connector"></div>
        <div class="atb-phase" class:active={state.phase === 'BATTLE'} class:done={state.phase === 'RESULT'}>
          <span class="atp-dot"></span><span class="atp-label">BATTLE</span>
        </div>
        <div class="atb-connector"></div>
        <div class="atb-phase" class:active={state.phase === 'RESULT'}>
          <span class="atp-dot"></span><span class="atp-label">RESULT</span>
        </div>
      </div>
      <div class="atb-right">
        <div class="atb-mode" class:pvp={state.arenaMode === 'PVP'} class:tour={state.arenaMode === 'TOURNAMENT'}>
          {modeLabel}{#if state.arenaMode === 'TOURNAMENT' && tournamentInfo.round} · R{tournamentInfo.round}{/if}
        </div>
        <div class="atb-stats">
          <span class="atb-lp">⚡{state.lp}</span>
          <span class="atb-wl">{state.wins}W-{state.losses}L</span>
        </div>
        <button class="atb-hist" on:click={() => matchHistoryOpen = !matchHistoryOpen}>📋</button>
      </div>
    </div>
    <MatchHistory visible={matchHistoryOpen} on:close={() => matchHistoryOpen = false} />

      <div class="battle-layout">
      <!-- ═══════ LEFT: CHART ═══════ -->
      <div class="chart-side">
        <ChartPanel
          showPosition={showChartPosition}
          posEntry={chartPosEntry}
          posTp={chartPosTp}
          posSl={chartPosSl}
          posDir={chartPosDir}
          agentAnnotations={chartAnnotations}
          agentMarkers={chartAgentMarkers}
          on:dragTP={onDragTP}
          on:dragSL={onDragSL}
          on:dragEntry={onDragEntry}
        />

        <!-- Hypothesis Panel on right side during hypothesis phase -->
        {#if hypothesisVisible}
          <div class="hypo-sidebar">
            <HypothesisPanel timeLeft={hypothesisTimer} on:submit={onHypothesisSubmit} />
          </div>
        {/if}

        <!-- Floating LONG/SHORT Direction Bar (hypothesis phase) -->
        {#if hypothesisVisible}
          <div class="dir-float-bar">
            <button class="dfb-btn long" class:sel={floatDir === 'LONG'} on:click={() => selectFloatDir('LONG')}>
              ▲ LONG
            </button>
            <div class="dfb-divider"></div>
            <button class="dfb-btn short" class:sel={floatDir === 'SHORT'} on:click={() => selectFloatDir('SHORT')}>
              ▼ SHORT
            </button>
          </div>
        {/if}

        <!-- Position Preview Overlay -->
        {#if previewVisible && state.hypothesis}
          <div class="preview-overlay">
            <div class="preview-card">
              <div class="preview-header">
                <span class="prev-icon">👁</span>
                <span class="prev-title">POSITION PREVIEW</span>
              </div>
              <div class="preview-dir {state.hypothesis.dir.toLowerCase()}">
                {state.hypothesis.dir === 'LONG' ? '▲' : state.hypothesis.dir === 'SHORT' ? '▼' : '●'} {state.hypothesis.dir}
              </div>
              <div class="preview-levels">
                <div class="prev-row">
                  <span class="prev-lbl">ENTRY</span>
                  <span class="prev-val">${Math.round(state.hypothesis.entry).toLocaleString()}</span>
                </div>
                <div class="prev-row tp">
                  <span class="prev-lbl">TP</span>
                  <span class="prev-val">${Math.round(state.hypothesis.tp).toLocaleString()}</span>
                </div>
                <div class="prev-row sl">
                  <span class="prev-lbl">SL</span>
                  <span class="prev-val">${Math.round(state.hypothesis.sl).toLocaleString()}</span>
                </div>
              </div>
              <div class="preview-rr">
                R:R <span class="prev-rr-val">1:{state.hypothesis.rr.toFixed(1)}</span>
              </div>
              <div class="preview-config">
                {state.squadConfig.riskLevel.toUpperCase()} · {formatTimeframeLabel(state.squadConfig.timeframe)} · Lev {state.squadConfig.leverageBias}x
              </div>
              <button class="preview-confirm" on:click={confirmPreview}>
                ✅ CONFIRM & SCOUT
              </button>
            </div>
          </div>
        {/if}

        <div class="score-bar">
          <div class="sr">
            <svg viewBox="0 0 44 44">
              <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="3"/>
              <circle cx="22" cy="22" r="18" fill="none" stroke={state.score >= 60 ? '#00CC88' : '#FF5E7A'} stroke-width="3"
                stroke-dasharray="{state.score * 1.13} 200" stroke-linecap="round" transform="rotate(-90 22 22)"/>
            </svg>
            <span class="n">{state.score}</span>
          </div>
          <div>
            <div class="sdir" style="color:{state.score >= 60 ? '#00CC88' : '#FF5E7A'}">{state.score >= 60 ? 'LONG' : 'SHORT'}</div>
            <div class="smeta">{activeAgents.length} agents · M{state.matchN}</div>
          </div>
          <div class="score-stats">
            <span class="ss-item">🔥{state.streak}</span>
            <span class="ss-item">{state.wins}W-{state.losses}L</span>
            <span class="ss-item lp">⚡{state.lp} LP</span>
          </div>
          <div class="mode-badge" class:tour={state.arenaMode === 'TOURNAMENT'} class:pvp={state.arenaMode === 'PVP'}>
            {modeLabel}
            {#if state.arenaMode === 'TOURNAMENT' && tournamentInfo.tournamentId}
              · R{tournamentInfo.round ?? 1}
            {/if}
          </div>
          {#if state.hypothesis}
            <div class="hypo-badge {state.hypothesis.dir.toLowerCase()}">
              {state.hypothesis.dir} · R:R 1:{state.hypothesis.rr.toFixed(1)}
            </div>
          {/if}
          <button class="mbtn" on:click={goLobby}>↺ LOBBY</button>
        </div>
      </div>

      <!-- ═══════ RIGHT: BATTLE ARENA ═══════ -->
      <div class="arena-side">
        <!-- Retro collage background -->
        <div class="arena-texture arena-stars"></div>
        <div class="arena-texture arena-rainbow"></div>
        <div class="arena-texture arena-grid"></div>
        <div class="arena-texture arena-doodle"></div>
        <div class="arena-vignette"></div>
        <div class="battle-floor">
          <span>ARENA SIGNAL PLANE</span>
        </div>

        <!-- Data Sources -->
        {#each SOURCES as src}
          <div class="dsrc" style="left:{src.x * 100}%;top:{src.y * 100}%">
            <div class="dp"></div>
            <div class="di" style="border-color:{src.color}">{src.icon}</div>
            <div class="dl">{src.label}</div>
          </div>
        {/each}

        <!-- Council Table -->
        <div class="ctable" class:on={councilActive}>
          <span class="cl">COUNCIL</span>
        </div>

        <!-- Agent Sprites with Inline Findings -->
        {#each activeAgents as ag, i}
          {@const defaultX = 50 + (i - Math.floor(activeAgents.length / 2)) * 16}
          {@const agState = agentStates[ag.id] || { state: 'idle', speech: '', energy: 0, voteDir: '' }}
          {@const agFinding = findings.find(f => f.def.id === ag.id)}
          {@const xPos = agState.posX ?? defaultX}
          {@const yPos = agState.posY ?? 44}
          <div class="ag {agState.state}" style="left:{xPos}%;top:{yPos}%;--ag-delay:{i * 0.1}s;--ag-color:{ag.color}">
            <!-- Speech Bubble -->
            {#if agState.speech}
              <div class="sp v">
                <span>{agState.speech}</span>
              </div>
            {/if}
            <!-- Vote Badge -->
            {#if agState.voteDir}
              <div class="vb v {agState.voteDir === 'LONG' ? 'long' : agState.voteDir === 'SHORT' ? 'short' : 'neutral'}">{agState.voteDir} 🔥</div>
            {/if}
            <div class="sha"></div>
            <div class="wr">
              <!-- State Reaction Emoji -->
              <div class="react">
                {#if agState.state === 'walk'}SCOUT{:else if agState.state === 'think'}SYNC{:else if agState.state === 'charge'}PULSE{:else if agState.state === 'vote'}VOTE{:else if agState.state === 'jump'}BOOST{:else if agState.state === 'sad'}MISS{:else if agState.state === 'alert'}LOCK{/if}
              </div>

              <!-- Energy Aura (during charge/vote) -->
              {#if agState.state === 'charge' || agState.state === 'vote' || agState.state === 'jump'}
                <div class="energy-aura" style="--aura-color:{ag.color}"></div>
              {/if}

              <!-- Trail particles (during walk/charge) -->
              {#if agState.state === 'walk' || agState.state === 'charge'}
                <div class="trail-particles">
                  <span class="tp" style="--tp-d:0.2s;--tp-x:-8px">✦</span>
                  <span class="tp" style="--tp-d:0.5s;--tp-x:6px">✧</span>
                  <span class="tp" style="--tp-d:0.8s;--tp-x:-4px">✦</span>
                </div>
              {/if}

              <div class="agent-sprite" style="border-color:{ag.color};box-shadow:0 0 12px {ag.color}40">
                {#if ag.img.def}
                  <img class="sprite-img"
                    src={agState.state === 'jump' || agState.state === 'vote' ? ag.img.win : agState.state === 'sad' || agState.state === 'alert' ? ag.img.alt : ag.img.def}
                    alt={ag.name} />
                {:else}
                  <span class="sprite-icon">{ag.icon}</span>
                {/if}
              </div>
              <div class="rbadge" style="background:{ag.color};color:#fff">{ag.icon}</div>
              <div class="nm" style="color:{ag.color}">{ag.name}</div>

              <!-- Energy Bar -->
              <div class="ebar">
                <div class="efill" style="width:{agState.energy}%;background:{ag.color}"></div>
                {#if agState.energy >= 100}
                  <div class="ebar-glow" style="background:{ag.color}"></div>
                {/if}
              </div>

              <!-- Agent Decision Card (inline below agent) -->
              {#if agFinding && agFinding.visible}
                <div class="ag-decision" style="--ag-color:{ag.color}">
                  <div class="agd-dir {ag.dir.toLowerCase()}">{ag.dir} {ag.conf}%</div>
                  <div class="agd-finding">{ag.finding.title}</div>
                  <div class="agd-bar"><div class="agd-fill" style="width:{ag.conf}%;background:{ag.color}"></div></div>
                </div>
              {/if}
            </div>
          </div>
        {/each}

        <!-- Phase Display -->
        <div class="phase-display">
          <div class="phase-dot" style="background:{phaseLabel.color}"></div>
          <div class="phase-name" style="color:{phaseLabel.color}">{phaseLabel.name}</div>
          <div class="phase-timer">{state.timer > 0 ? Math.ceil(state.timer) + 's' : '--'}</div>
        </div>

        <!-- Right Rail (reference UI - partial) -->
        <aside class="arena-rail">
          <div class="rail-head">
            <div class="rail-pair">{state.pair} · {formatTimeframeLabel(state.squadConfig.timeframe)}</div>
            <div class="rail-price">${Number.isFinite(state.prices.BTC) ? Math.round(state.prices.BTC).toLocaleString() : '--'}</div>
          </div>
          <div class="rail-tabs">
            <button class:active={arenaRailTab === 'rank'} on:click={() => arenaRailTab = 'rank'}>RANK</button>
            <button class:active={arenaRailTab === 'log'} on:click={() => arenaRailTab = 'log'}>LOG</button>
            <button class:active={arenaRailTab === 'map'} on:click={() => arenaRailTab = 'map'}>MAP</button>
          </div>
          <div class="rail-body">
            {#if arenaRailTab === 'rank'}
              {#if railRank.length === 0}
                <div class="rail-empty">No agents in this round</div>
              {:else}
                {#each railRank as ag, idx}
                  <div class="rail-row">
                    <span class="rail-rank">{idx + 1}</span>
                    <span class="rail-name" style="color:{ag.color}">{ag.name}</span>
                    <span class="rail-dir {ag.dir.toLowerCase()}">{ag.dir}</span>
                    <span class="rail-conf">{ag.conf}%</span>
                  </div>
                {/each}
              {/if}
            {:else if arenaRailTab === 'log'}
              {#if feedMessages.length === 0}
                <div class="rail-empty">No logs yet</div>
              {:else}
                {#each feedMessages.slice(0, 10) as msg}
                  <div class="rail-log">
                    <span class="rl-name" style="color:{msg.color}">{msg.name}</span>
                    <span class="rl-text">{msg.text}</span>
                  </div>
                {/each}
              {/if}
            {:else}
              <div class="rail-map">
                <div class="rm-item"><span>MODE</span><b>{modeLabel}</b></div>
                <div class="rm-item"><span>AGENTS</span><b>{activeAgents.length}</b></div>
                <div class="rm-item"><span>SCORE</span><b>{Math.round(state.score)}</b></div>
                <div class="rm-item"><span>LP</span><b>{state.lp}</b></div>
              </div>
            {/if}
          </div>
        </aside>

        <!-- Feed Log -->
        <div class="feed-panel">
          {#each feedMessages as msg}
            <div class="feed-msg" class:feed-new={msg.isNew}>
              <span class="feed-icon">{msg.icon}</span>
              <span class="feed-name" style="color:{msg.color}">{msg.name}</span>
              <span class="feed-text">{msg.text}{#if msg.isNew}<span class="feed-cursor">|</span>{/if}</span>
              {#if msg.dir}
                <span class="feed-dir {msg.dir.toLowerCase()}">{msg.dir}</span>
              {/if}
            </div>
          {/each}
        </div>

        <!-- ═══════ COMPARE OVERLAY ═══════ -->
        {#if compareVisible}
          <div class="compare-overlay">
            <div class="compare-card">
              <div class="compare-header">
                <span class="compare-icon">⚔️</span>
                <span class="compare-title">COMPARE</span>
              </div>

              <!-- User vs Agents -->
              <div class="compare-vs">
                <div class="compare-side user">
                  <div class="compare-label">YOUR CALL</div>
                  <div class="compare-dir {compareData.userDir.toLowerCase()}">{compareData.userDir}</div>
                  <div class="compare-levels">
                    <span class="cmp-tp">TP ${Math.round(compareData.userTp).toLocaleString()}</span>
                    <span class="cmp-entry">Entry ${Math.round(compareData.userEntry).toLocaleString()}</span>
                    <span class="cmp-sl">SL ${Math.round(compareData.userSl).toLocaleString()}</span>
                  </div>
                </div>

                <div class="compare-badge-wrap">
                  <div class="compare-consensus-badge {compareData.consensus.type}">
                    {compareData.consensus.badge}
                  </div>
                  <div class="compare-vs-icon">VS</div>
                </div>

                <div class="compare-side agents">
                  <div class="compare-label">AGENT COUNCIL</div>
                  <div class="compare-dir {compareData.agentDir.toLowerCase()}">{compareData.agentDir}</div>
                  <div class="compare-score">Score: {compareData.agentScore}</div>
                  <div class="compare-votes">
                    {#each compareData.agentVotes as vote}
                      <div class="compare-vote">
                        <span style="color:{vote.color}">{vote.icon}</span>
                        <span class="cv-dir {vote.dir.toLowerCase()}">{vote.dir}</span>
                        <span class="cv-conf">{vote.conf}%</span>
                      </div>
                    {/each}
                  </div>
                </div>
              </div>

              <!-- LP Multiplier -->
              <div class="compare-mult">
                LP MULTIPLIER: <span class="mult-val" style="color:{compareData.consensus.lpMult >= 1.5 ? '#00CC88' : compareData.consensus.lpMult >= 1 ? '#DCB970' : '#FF5E7A'}">x{compareData.consensus.lpMult}</span>
              </div>
            </div>
          </div>
        {/if}

        <!-- Verdict Overlay -->
        {#if verdictVisible}
          <div class="verdict-overlay">
            <div class="verdict-card">
              <div class="verdict-score">
                <svg viewBox="0 0 44 44">
                  <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(0,0,0,.1)" stroke-width="3"/>
                  <circle cx="22" cy="22" r="18" fill="none" stroke={state.score >= 60 ? '#00CC88' : '#FF5E7A'} stroke-width="3"
                    stroke-dasharray="{state.score * 1.13} 200" stroke-linecap="round" transform="rotate(-90 22 22)"/>
                </svg>
                <span class="vs-num">{Math.round(state.score)}</span>
              </div>
              <div class="verdict-dir" class:long={state.score >= 60} class:short={state.score < 60}>
                {state.score >= 60 ? 'MUCH LONG' : 'SUCH WAIT'}
              </div>
              <div class="verdict-meta">
                Council: {activeAgents.filter(a => a.dir === 'LONG').length}/{activeAgents.length} · Score: {Math.round(state.score)}
              </div>
            </div>
          </div>
        {/if}

        <!-- Result Overlay -->
        {#if resultVisible}
          <div class="result-overlay" class:win={resultData.win} class:lose={!resultData.win}>
            <div class="result-text">{resultData.win ? 'VERY WIN WOW!' : 'SUCH SAD'}</div>
            <div class="result-lp">{resultData.tag}<br>{resultData.lp >= 0 ? '+' : ''}{resultData.lp} LP</div>
            {#if state.streak >= 3}
              <div class="result-streak">🔥×{state.streak} MUCH STREAK</div>
            {/if}
            <div class="result-motto">{resultData.motto}</div>
          </div>
        {/if}

        <!-- PvP Result Screen -->
        {#if pvpVisible}
          <div class="pvp-overlay">
            <div class="pvp-card">
              <div class="pvp-title">{resultOverlayTitle}</div>
              {#if state.arenaMode === 'TOURNAMENT' && tournamentInfo.tournamentId}
                <div class="pvp-label tour-meta">
                  {tournamentInfo.type ?? 'TOURNAMENT'} · {tournamentInfo.pair ?? state.pair} · ROUND {tournamentInfo.round ?? 1}
                </div>
              {/if}
              <div class="pvp-scores">
                <div class="pvp-side">
                  <div class="pvp-label">YOUR SCORE</div>
                  <div class="pvp-score">{Math.round(state.score)}</div>
                </div>
                <div class="pvp-vs">VS</div>
                <div class="pvp-side">
                  <div class="pvp-label">OPPONENT</div>
                  <div class="pvp-score">{Math.round(50 + Math.random() * 35)}</div>
                </div>
              </div>
              <div class="pvp-lp" class:pos={resultData.lp >= 0} class:neg={resultData.lp < 0}>
                {resultData.lp >= 0 ? '+' : ''}{resultData.lp} LP
              </div>
              {#if state.hypothesis}
                <div class="pvp-hypo">
                  Your call: <span class="{state.hypothesis.dir.toLowerCase()}">{state.hypothesis.dir}</span>
                  · R:R 1:{state.hypothesis.rr.toFixed(1)}
                  {#if state.hypothesis.consensusType}
                    · <span class="pvp-consensus">{state.hypothesis.consensusType.toUpperCase()}</span>
                  {/if}
                </div>
              {/if}
              <div class="pvp-btns">
                <button class="pvp-btn lobby" on:click={goLobby}>↺ LOBBY</button>
                <button class="pvp-btn again" on:click={playAgain}>🐕 PLAY AGAIN</button>
              </div>
            </div>
          </div>
        {/if}

        <!-- Replay Banner -->
        {#if replayState.active}
          <div class="replay-banner">
            <span class="replay-icon">🎬</span>
            <span class="replay-text">REPLAY — Match #{replayState.data?.matchN}</span>
            <span class="replay-step">{replayState.currentStep + 1}/{replayState.totalSteps}</span>
            <button class="replay-exit" on:click={exitReplay}>✕ EXIT REPLAY</button>
          </div>
        {/if}

        <!-- Floating Doge Words -->
        {#each floatingWords as w (w.id)}
          <div class="doge-float" style="left:{w.x}%;color:{w.color};animation-duration:{w.dur}s">{w.text}</div>
        {/each}

        <!-- History Button -->
        <button class="hist-btn" on:click={() => historyOpen = !historyOpen}>📜 {matchHistory.length}</button>

        <!-- History Panel -->
        {#if historyOpen}
          <div class="hist-panel">
            <div class="hist-header">
              <span>MATCH HISTORY</span>
              <button class="hist-close" on:click={() => historyOpen = false}>✕</button>
            </div>
            {#each matchHistory as h}
              <div class="hitem">
                <span class="hnum">M{h.n}</span>
                <span class="hres" class:w={h.win} class:l={!h.win}>{h.win ? 'WIN' : 'LOSE'}</span>
                <span class="hlp" class:pos={h.lp >= 0} class:neg={h.lp < 0}>{h.lp >= 0 ? '+' : ''}{h.lp} LP</span>
                <span class="hscore">{h.score}</span>
                {#if h.streak >= 3}<span class="hstreak">🔥{h.streak}</span>{/if}
              </div>
            {/each}
            {#if matchHistory.length === 0}
              <div class="hist-empty">No matches yet</div>
            {/if}
          </div>
        {/if}

        <div class="arena-balance">
          <span>LONG</span>
          <div class="ab-track">
            <div class="ab-fill" style="width:{longBalance}%"></div>
          </div>
          <span>SHORT</span>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .arena-page { width: 100%; height: 100%; position: relative; overflow: hidden; }
  .battle-layout { display: grid; grid-template-columns: 45% 1fr; height: 100%; overflow: hidden; }

  /* Match History Toggle */
  .mh-toggle {
    position: absolute;
    top: 8px; right: 8px;
    z-index: 55;
    padding: 4px 10px;
    border: 2px solid #000;
    border-radius: 8px;
    background: #fff;
    font-family: var(--fm);
    font-size: 8px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 2px 2px 0 #000;
    transition: all .15s;
  }
  .mh-toggle:hover { background: #ffe600; }
  .chart-side { display: flex; flex-direction: column; background: #05060a; overflow: hidden; border-right: 2px solid #2f3f66; position: relative; }
  .arena-side {
    position: relative;
    overflow: hidden;
    background:
      radial-gradient(circle at 45% 25%, rgba(122, 153, 255, .24), transparent 40%),
      radial-gradient(circle at 80% 70%, rgba(255, 86, 149, .18), transparent 45%),
      linear-gradient(180deg, #04070f 0%, #060b16 56%, #080f1b 100%);
  }

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
    padding: 6px 12px; border-top: 3px solid #000;
    background: linear-gradient(90deg, #1a1a3a, #0a0a2a);
    display: flex; align-items: center; gap: 10px; flex-shrink: 0;
  }
  .sr { position: relative; width: 40px; height: 40px; flex-shrink: 0; }
  .sr svg { width: 40px; height: 40px; }
  .sr .n { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 900; font-family: var(--fd); color: #fff; }
  .sdir { font-size: 13px; font-weight: 900; font-family: var(--fd); letter-spacing: 2px; text-shadow: 0 0 10px currentColor; }
  .smeta { font-size: 7px; color: #888; font-family: var(--fm); }
  .score-stats { display: flex; gap: 8px; margin-left: auto; }
  .ss-item { font-size: 8px; font-weight: 700; font-family: var(--fm); color: #aaa; }
  .ss-item.lp { color: #ffe600; }
  .mode-badge {
    padding: 3px 8px;
    border: 1.5px solid rgba(232,150,125,.55);
    background: rgba(232,150,125,.09);
    color: #e8967d;
    font-size: 8px;
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
    padding: 3px 10px; border-radius: 8px; font-size: 8px; font-weight: 900;
    font-family: var(--fd); letter-spacing: 1px; border: 2px solid;
  }
  .hypo-badge.long { background: rgba(0,255,136,.15); border-color: #00ff88; color: #00ff88; }
  .hypo-badge.short { background: rgba(255,45,85,.15); border-color: #ff2d55; color: #ff2d55; }
  .hypo-badge.neutral { background: rgba(255,170,0,.15); border-color: #ffaa00; color: #ffaa00; }

  .mbtn { padding: 6px 16px; border-radius: 16px; background: #ffe600; border: 3px solid #000; color: #000; font-family: var(--fd); font-size: 8px; font-weight: 900; letter-spacing: 2px; cursor: pointer; box-shadow: 3px 3px 0 #000; }
  .mbtn:hover { background: #ffcc00; }

  /* Arena Background — Retro Space + Collage */
  .arena-texture {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-position: center;
    background-size: cover;
    background-repeat: no-repeat;
    z-index: 0;
  }
  .arena-stars {
    background-image: url('/arena/references/14-o.png');
    opacity: .34;
    mix-blend-mode: screen;
    filter: saturate(1.1) contrast(1.12);
  }
  .arena-rainbow {
    background-image: url('/arena/references/03-o.png');
    opacity: .44;
    mix-blend-mode: screen;
    filter: saturate(1.2) contrast(1.06);
  }
  .arena-grid {
    background-image: url('/arena/references/02-o.png');
    opacity: .16;
    mix-blend-mode: lighten;
    transform: scale(1.05);
  }
  .arena-doodle {
    background-image: url('/arena/references/cs-robert-a1-o.png');
    opacity: .18;
    mix-blend-mode: soft-light;
    filter: grayscale(.12) contrast(1.2);
  }
  .arena-vignette {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 1;
    background:
      radial-gradient(circle at 50% 54%, transparent 18%, rgba(2, 7, 18, .4) 58%, rgba(1, 4, 12, .7) 100%),
      linear-gradient(180deg, rgba(5, 8, 18, .04) 0%, rgba(1, 3, 11, .62) 100%);
  }
  .battle-floor {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 2;
    height: 14%;
    border-top: 1px solid rgba(140, 176, 255, .34);
    background:
      linear-gradient(180deg, rgba(14, 18, 36, .2) 0%, rgba(7, 11, 24, .82) 35%, rgba(6, 10, 20, .95) 100%),
      repeating-linear-gradient(90deg, rgba(106, 143, 255, .08) 0 1px, transparent 1px 46px);
    backdrop-filter: blur(2px);
  }
  .battle-floor span {
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    font-family: var(--fd);
    font-size: 8px;
    letter-spacing: 4px;
    color: rgba(177, 204, 255, .72);
    text-transform: uppercase;
    white-space: nowrap;
  }

  /* Data Sources */
  .dsrc { position: absolute; z-index: 6; display: flex; flex-direction: column; align-items: center; gap: 2px; pointer-events: none; transform: translate(-50%, -50%); }
  .dp { position: absolute; width: 48px; height: 48px; border-radius: 50%; background: transparent; border: 1px solid rgba(146,181,255,.35); animation: dpPulse 2s ease infinite; will-change: transform, opacity; contain: strict; }
  @keyframes dpPulse { 0%,100% { transform: scale(1); opacity: .3 } 50% { transform: scale(1.3); opacity: 0 } }
  .di {
    width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px;
    background: rgba(8,13,28,.86);
    border: 2px solid;
    box-shadow: 0 0 0 1px rgba(153,189,255,.28), 0 10px 18px rgba(0,0,0,.34);
    backdrop-filter: blur(4px);
  }
  .dl {
    font-size: 7px; color: #d7e9ff; letter-spacing: 2px; font-family: var(--fd); font-weight: 900;
    background: rgba(7,12,26,.76); padding: 2px 6px; border-radius: 8px;
    border: 1px solid rgba(152,188,255,.35);
  }

  /* Council Table */
  .ctable {
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: 108px; height: 58px; border-radius: 999px;
    border: 1px dashed rgba(149,184,255,.45);
    background: rgba(5,11,24,.45);
    display: flex; align-items: center; justify-content: center;
    z-index: 4; transition: all .3s;
    backdrop-filter: blur(3px);
  }
  .ctable.on {
    border-color: rgba(152,193,255,.9);
    border-style: solid;
    background: rgba(7,13,28,.72);
    box-shadow: 0 0 28px rgba(113, 160, 255, .35);
  }
  .cl { font-size: 7px; color: rgba(176, 201, 255, .56); letter-spacing: 3px; font-family: var(--fd); font-weight: 900; }
  .ctable.on .cl { color: #dff1ff; }

  /* Agent Sprites */
  .ag {
    position: absolute; z-index: 10; width: 110px; text-align: center;
    transform: translate(-50%, -50%);
    cursor: pointer;
    transition: left .6s cubic-bezier(.4,0,.2,1), top .6s cubic-bezier(.4,0,.2,1);
    will-change: transform, left, top;
    contain: layout style;
  }
  .ag .sha {
    position: absolute; bottom: -4px; left: 50%; transform: translateX(-50%);
    width: 48px; height: 8px; background: rgba(0,0,0,.5);
    border-radius: 50%; filter: blur(2px);
    transition: width .3s, opacity .3s;
  }
  .ag.jump .sha { width: 36px; opacity: .3; }
  .ag .wr { position: relative; display: flex; flex-direction: column; align-items: center; animation-delay: var(--ag-delay, 0s); }

  /* ── Idle: gentle float ── */
  .ag.idle .wr { animation: aI 1.4s ease-in-out infinite; }
  @keyframes aI {
    0%,100% { transform: translateY(0) rotate(0) }
    25% { transform: translateY(-3px) rotate(-0.5deg) }
    75% { transform: translateY(-2px) rotate(0.5deg) }
  }

  /* ── Walk: energetic run ── */
  .ag.walk .wr { animation: aW .25s ease-in-out infinite; }
  @keyframes aW {
    0%   { transform: translateX(0) translateY(0) rotate(0) }
    25%  { transform: translateX(-4px) translateY(-5px) rotate(-3deg) }
    50%  { transform: translateX(0) translateY(-2px) rotate(0) }
    75%  { transform: translateX(4px) translateY(-5px) rotate(3deg) }
    100% { transform: translateX(0) translateY(0) rotate(0) }
  }

  /* ── Think: head bob ── */
  .ag.think .wr { animation: aT 1.5s ease-in-out infinite; }
  @keyframes aT {
    0%,100% { transform: rotate(0) scale(1) }
    20% { transform: rotate(-4deg) scale(.98) }
    40% { transform: rotate(3deg) scale(1.01) }
    60% { transform: rotate(-2deg) scale(.99) }
    80% { transform: rotate(4deg) scale(1) }
  }

  /* ── Alert: pulse glow ── */
  .ag.alert .wr { animation: aA .4s ease infinite; }
  .ag.alert .agent-sprite { box-shadow: 0 0 20px var(--ag-color, #ffe600) !important; }
  @keyframes aA {
    0%,100% { transform: scale(1) }
    50% { transform: scale(1.08) }
  }

  /* ── Charge: intense vibrate ── */
  .ag.charge .wr { animation: aC .1s linear infinite; }
  .ag.charge .agent-sprite { box-shadow: 0 0 24px var(--ag-color, #ff0) !important; }
  @keyframes aC {
    0%  { transform: translateX(-2px) translateY(1px) }
    25% { transform: translateX(2px) translateY(-1px) }
    50% { transform: translateX(-1px) translateY(-2px) }
    75% { transform: translateX(1px) translateY(2px) }
  }

  /* ── Vote: bounce up ── */
  .ag.vote .wr { animation: aV .5s ease infinite; }
  @keyframes aV {
    0%,100% { transform: translateY(0) scale(1) }
    30% { transform: translateY(-8px) scale(1.06) }
    60% { transform: translateY(-2px) scale(1.02) }
  }

  /* ── Jump: victory leap ── */
  .ag.jump .wr { animation: aJ .4s ease-in-out infinite; }
  @keyframes aJ {
    0%,100% { transform: translateY(0) rotate(0) scale(1) }
    20% { transform: translateY(-18px) rotate(-5deg) scale(1.1) }
    50% { transform: translateY(-22px) rotate(3deg) scale(1.12) }
    80% { transform: translateY(-8px) rotate(-2deg) scale(1.05) }
  }

  /* ── Sad: droopy wobble ── */
  .ag.sad .wr { animation: aS 2s ease infinite; }
  @keyframes aS {
    0%,100% { transform: translateY(0) rotate(0) }
    30% { transform: translateY(4px) rotate(-4deg) }
    70% { transform: translateY(3px) rotate(3deg) }
  }

  /* ══ Energy Aura ══ */
  .energy-aura {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 72px; height: 72px;
    border-radius: 50%;
    background: radial-gradient(circle, var(--aura-color) 0%, transparent 70%);
    opacity: .2;
    z-index: -1;
    animation: auraBreath 1.5s ease-in-out infinite;
    pointer-events: none;
    will-change: transform, opacity;
    contain: strict;
  }
  @keyframes auraBreath {
    0%,100% { transform: translate(-50%, -50%) scale(1); opacity: .15; }
    50% { transform: translate(-50%, -50%) scale(1.3); opacity: .3; }
  }

  /* ══ Trail Particles ══ */
  .trail-particles {
    position: absolute;
    bottom: -10px; left: 50%;
    transform: translateX(-50%);
    pointer-events: none;
  }
  .tp {
    position: absolute;
    font-size: 8px;
    color: var(--ag-color, #ffe600);
    opacity: 0;
    animation: tpFade .8s ease-out infinite;
    animation-delay: var(--tp-d, 0s);
    left: var(--tp-x, 0px);
    will-change: transform, opacity;
    contain: layout style;
  }
  @keyframes tpFade {
    0% { opacity: .8; transform: translateY(0) scale(1); }
    100% { opacity: 0; transform: translateY(12px) scale(.5); }
  }

  /* ══ Energy Bar Glow ══ */
  .ebar-glow {
    position: absolute;
    inset: 0;
    border-radius: 4px;
    opacity: .4;
    animation: ebarGlow .5s ease infinite;
  }
  @keyframes ebarGlow { 0%,100% { opacity: .3 } 50% { opacity: .6 } }

  /* Speech Bubble */
  .sp { position: absolute; top: -32px; left: 50%; transform: translateX(-50%); background: #fff; border: 2px solid #000; border-radius: 10px 10px 10px 2px; padding: 3px 8px; font-size: 7px; font-weight: 700; white-space: nowrap; opacity: 0; transition: opacity .2s; z-index: 20; box-shadow: 2px 2px 0 #000; font-family: var(--fm); }
  .sp.v { opacity: 1; }

  /* Vote Badge */
  .vb { position: absolute; top: -18px; right: -10px; background: #00ff88; border: 2px solid #000; border-radius: 8px; padding: 1px 6px; font-size: 7px; font-weight: 900; font-family: var(--fd); letter-spacing: 1px; opacity: 0; transition: opacity .2s; z-index: 19; box-shadow: 2px 2px 0 #000; }
  .vb.v { opacity: 1; }
  .vb.long { background: #00ff88; color: #000; }
  .vb.short { background: #ff2d55; color: #fff; }
  .vb.neutral { background: #ffaa00; color: #000; }

  .agent-sprite {
    width: 80px; height: 80px; border-radius: 20px; border: 4px solid;
    display: flex; align-items: center; justify-content: center;
    background: #fff; box-shadow: 5px 5px 0 #000; transition: all .15s; overflow: hidden;
  }
  .sprite-icon { font-size: 34px; }
  .sprite-img { width: 100%; height: 100%; object-fit: cover; border-radius: 16px; }
  .ag .rbadge {
    position: absolute; top: -6px; right: -6px; width: 24px; height: 24px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; font-size: 11px;
    border: 3px solid #000; z-index: 3; text-shadow: 0 1px 0 #000;
    box-shadow: 2px 2px 0 #000;
  }
  .ag .react {
    position: absolute; top: -13px; left: 50%; transform: translateX(-50%);
    font-size: 6px; z-index: 15;
    padding: 2px 6px;
    border-radius: 999px;
    border: 1px solid rgba(130, 175, 255, .52);
    background: rgba(4, 9, 20, .74);
    color: #b8dbff;
    letter-spacing: 1.5px;
    font-family: var(--fd);
    font-weight: 900;
    text-transform: uppercase;
    filter: drop-shadow(0 4px 6px rgba(0,0,0,.35));
  }
  .ag .nm {
    font-size: 8px; font-weight: 900; letter-spacing: 2px; margin-top: 4px;
    font-family: var(--fd); background: #fff; padding: 2px 8px; border-radius: 8px;
    border: 2px solid #000; box-shadow: 2px 2px 0 #000;
  }
  .ag .ebar { width: 60px; height: 6px; margin: 3px auto 0; border-radius: 4px; background: #ddd; overflow: hidden; border: 2px solid #000; position: relative; }
  .ag .efill { height: 100%; border-radius: 2px; transition: width .3s; }

  /* Phase Display */
  .phase-display {
    position: absolute; top: 8px; right: 8px; z-index: 15;
    background: rgba(5, 10, 23, .82);
    border-radius: 12px;
    padding: 8px 14px;
    border: 1px solid rgba(146,179,255,.58);
    box-shadow: 0 10px 24px rgba(0,0,0,.4);
    text-align: center;
    backdrop-filter: blur(5px);
  }
  .phase-dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    margin: 0 auto 6px;
    box-shadow: 0 0 10px currentColor;
  }
  .phase-name { font-size: 10px; font-weight: 900; font-family: var(--fd); letter-spacing: 2px; text-transform: uppercase; }
  .phase-timer { font-size: 9px; font-family: var(--fm); color: #8fb2ec; font-weight: 700; }

  /* Agent Decision Card (below sprite) */
  .ag-decision {
    margin-top: 3px;
    background: #fff;
    border: 2px solid #000;
    border-radius: 6px;
    padding: 3px 5px;
    box-shadow: 2px 2px 0 #000;
    font-family: var(--fm);
    animation: decisionSlideIn .3s ease;
    width: 80px;
  }
  @keyframes decisionSlideIn {
    from { opacity: 0; transform: translateY(-6px) scale(.9); }
    to { opacity: 1; transform: none; }
  }
  .agd-dir {
    font-size: 7px; font-weight: 900; letter-spacing: 1px;
    padding: 1px 4px; border-radius: 4px; text-align: center;
    border: 1.5px solid #000;
  }
  .agd-dir.long { background: #00ff88; color: #000; }
  .agd-dir.short { background: #ff2d55; color: #fff; }
  .agd-dir.neutral { background: #ffaa00; color: #000; }
  .agd-finding {
    font-size: 6px; color: #444; line-height: 1.3;
    margin-top: 2px; text-align: center;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .agd-bar {
    height: 3px; border-radius: 2px; background: #eee;
    overflow: hidden; margin-top: 2px; border: 1px solid rgba(0,0,0,.15);
  }
  .agd-fill { height: 100%; border-radius: 2px; transition: width .5s; }

  /* Feed */
  .feed-panel { position: absolute; bottom: 14%; left: 8px; right: 8px; z-index: 14; max-height: 70px; overflow-y: auto; display: flex; flex-direction: column; gap: 1px; }
  .feed-msg {
    display: flex; align-items: center; gap: 4px; font-size: 7px; font-family: var(--fm);
    background: rgba(4, 9, 20, .74);
    border: 1px solid rgba(141, 173, 255, .3);
    color: #a9c8ff;
    padding: 2px 6px;
    border-radius: 4px;
    backdrop-filter: blur(5px);
  }
  .feed-icon { font-size: 8px; }
  .feed-name { font-weight: 900; font-size: 7px; }
  .feed-text { color: #b9d4ff; flex: 1; }
  .feed-dir { font-size: 6px; padding: 1px 4px; border-radius: 4px; font-weight: 900; }
  .feed-dir.long { background: #00ff88; color: #000; }
  .feed-dir.short { background: #ff2d55; color: #fff; }
  .feed-new { animation: feedSlideIn .3s ease; }
  @keyframes feedSlideIn {
    from { opacity: 0; transform: translateX(-10px); }
    to { opacity: 1; transform: translateX(0); }
  }
  .feed-cursor {
    animation: feedBlink .5s step-end infinite;
    color: #000;
    font-weight: 900;
  }
  @keyframes feedBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

  /* ═══════ COMPARE OVERLAY ═══════ */
  .compare-overlay {
    position: absolute; inset: 0; z-index: 32;
    display: flex; align-items: center; justify-content: center;
    background: rgba(0,0,0,.25);
    animation: fadeIn .3s ease;
  }
  .compare-card {
    background: #fff; border: 4px solid #000; border-radius: 16px;
    padding: 14px 18px; box-shadow: 8px 8px 0 #000;
    min-width: 320px; animation: popIn .3s ease;
  }
  .compare-header {
    display: flex; align-items: center; gap: 8px;
    border-bottom: 3px solid #000; padding-bottom: 8px; margin-bottom: 10px;
  }
  .compare-icon { font-size: 18px; }
  .compare-title { font-size: 16px; font-weight: 900; font-family: var(--fc); letter-spacing: 3px; }
  .compare-vs {
    display: flex; align-items: flex-start; gap: 12px; justify-content: center;
  }
  .compare-side {
    flex: 1; text-align: center; padding: 8px;
    border: 2px solid #eee; border-radius: 10px;
  }
  .compare-side.user { background: rgba(255,230,0,.05); }
  .compare-side.agents { background: rgba(0,200,255,.05); }
  .compare-label {
    font-size: 7px; font-weight: 900; font-family: var(--fd);
    letter-spacing: 2px; color: #888; margin-bottom: 4px;
  }
  .compare-dir {
    font-size: 18px; font-weight: 900; font-family: var(--fc);
    letter-spacing: 2px;
  }
  .compare-dir.long { color: #00cc66; }
  .compare-dir.short { color: #ff2d55; }
  .compare-dir.neutral { color: #ffaa00; }
  .compare-levels {
    display: flex; flex-direction: column; gap: 1px;
    font-size: 7px; font-family: var(--fm); font-weight: 700;
    margin-top: 4px;
  }
  .cmp-tp { color: #00cc66; }
  .cmp-entry { color: #ffaa00; }
  .cmp-sl { color: #ff2d55; }
  .compare-score {
    font-size: 9px; font-weight: 900; font-family: var(--fd);
    color: #000; margin-top: 4px;
  }
  .compare-votes {
    display: flex; flex-wrap: wrap; gap: 3px; justify-content: center;
    margin-top: 4px;
  }
  .compare-vote {
    display: flex; align-items: center; gap: 2px;
    font-size: 7px; font-family: var(--fm);
    background: #f5f5f5; border-radius: 4px; padding: 2px 4px;
  }
  .cv-dir { font-weight: 900; font-size: 6px; padding: 1px 3px; border-radius: 3px; }
  .cv-dir.long { background: #00ff88; color: #000; }
  .cv-dir.short { background: #ff2d55; color: #fff; }
  .cv-conf { color: #888; font-size: 6px; }
  .compare-badge-wrap {
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
    min-width: 80px;
  }
  .compare-consensus-badge {
    padding: 4px 10px; border-radius: 8px; border: 3px solid #000;
    font-size: 8px; font-weight: 900; font-family: var(--fd); letter-spacing: 1px;
    box-shadow: 2px 2px 0 #000; text-align: center;
  }
  .compare-consensus-badge.consensus { background: #00ff88; color: #000; }
  .compare-consensus-badge.partial { background: #ffe600; color: #000; }
  .compare-consensus-badge.dissent { background: #ff2d55; color: #fff; }
  .compare-consensus-badge.override { background: #c840ff; color: #fff; }
  .compare-vs-icon {
    font-size: 14px; font-weight: 900; font-family: var(--fc); color: #000;
  }
  .compare-mult {
    text-align: center; margin-top: 10px; padding: 6px;
    background: #000; border-radius: 8px;
    font-size: 9px; font-weight: 900; font-family: var(--fd);
    letter-spacing: 2px; color: #888;
  }
  .mult-val { font-size: 16px; }

  /* Verdict Overlay */
  .verdict-overlay { position: absolute; inset: 0; z-index: 30; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.2); }
  .verdict-card { background: #fff; border: 4px solid #000; border-radius: 16px; padding: 16px 24px; text-align: center; box-shadow: 6px 6px 0 #000; animation: popIn .3s ease; }
  .verdict-score { position: relative; width: 60px; height: 60px; margin: 0 auto 8px; }
  .verdict-score svg { width: 60px; height: 60px; }
  .vs-num { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 900; font-family: var(--fc); }
  .verdict-dir { font-size: 20px; font-weight: 900; font-family: var(--fc); letter-spacing: 3px; }
  .verdict-dir.long { color: #00cc66; }
  .verdict-dir.short { color: #ff2d55; }
  .verdict-meta { font-size: 8px; color: #888; font-family: var(--fm); margin-top: 4px; }

  /* Result Overlay */
  .result-overlay { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 35; text-align: center; animation: popIn .3s ease; padding: 16px 28px; border-radius: 16px; border: 4px solid #000; box-shadow: 6px 6px 0 #000; }
  .result-overlay.win { background: linear-gradient(135deg, #00ff88, #00cc66); }
  .result-overlay.lose { background: linear-gradient(135deg, #ff2d55, #cc0033); }
  .result-text { font-size: 22px; font-weight: 900; font-family: var(--fc); color: #000; letter-spacing: 3px; text-shadow: 2px 2px 0 rgba(255,255,255,.3); }
  .result-lp { font-size: 14px; font-weight: 900; font-family: var(--fd); color: #000; margin-top: 4px; }
  .result-streak { font-size: 10px; font-weight: 700; color: #000; margin-top: 4px; }
  .result-motto { font-size: 8px; font-family: var(--fc); color: #000; margin-top: 8px; font-style: italic; opacity: .7; }

  /* PvP Result */
  .pvp-overlay { position: absolute; inset: 0; z-index: 40; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.6); backdrop-filter: blur(4px); animation: fadeIn .3s ease; }
  .pvp-card { background: #fff; border: 4px solid #000; border-radius: 16px; padding: 20px 30px; text-align: center; box-shadow: 8px 8px 0 #000; min-width: 260px; }
  .pvp-title { font-size: 18px; font-weight: 900; font-family: var(--fc); letter-spacing: 3px; color: #000; }
  .pvp-scores { display: flex; align-items: center; justify-content: center; gap: 16px; margin: 12px 0; }
  .pvp-side { text-align: center; }
  .pvp-label { font-size: 7px; color: #888; font-family: var(--fd); letter-spacing: 2px; }
  .pvp-label.tour-meta {
    margin-top: 2px;
    margin-bottom: 8px;
    font-size: 8px;
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
  .pvp-btn.again { background: #ffe600; color: #000; }
  .pvp-btn:hover { transform: translate(-1px, -1px); box-shadow: 4px 4px 0 #000; }

  /* Doge Float */
  .doge-float { position: absolute; z-index: 25; font-family: var(--fc); font-weight: 900; font-style: italic; font-size: 16px; letter-spacing: 2px; pointer-events: none; animation: dogeUp ease forwards; text-shadow: 2px 2px 0 #000, -1px -1px 0 #000; -webkit-text-stroke: 1px #000; }
  @keyframes dogeUp { 0% { opacity: 1; transform: translateY(0) rotate(-5deg) scale(1); } 100% { opacity: 0; transform: translateY(-100px) rotate(15deg) scale(1.5); } }

  /* History */
  .hist-btn {
    position: absolute; bottom: 14%; right: 8px; z-index: 16;
    padding: 4px 10px; border-radius: 8px;
    background: rgba(5, 11, 24, .8);
    border: 1px solid rgba(136, 171, 255, .5);
    color: #bdd8ff;
    font-size: 8px; font-weight: 700; cursor: pointer;
    box-shadow: 0 8px 18px rgba(0,0,0,.35);
  }
  .hist-panel {
    position: absolute; top: 0; right: 0; bottom: 0; width: 180px; z-index: 50;
    background: rgba(6, 11, 24, .94);
    border-left: 1px solid rgba(140, 174, 255, .42);
    color: #d4e7ff;
    padding: 10px; overflow-y: auto;
    box-shadow: -6px 0 20px rgba(0,0,0,.4);
    backdrop-filter: blur(4px);
  }
  .hist-header {
    display: flex; align-items: center; justify-content: space-between;
    font-size: 9px; font-weight: 900; font-family: var(--fd);
    letter-spacing: 2px; margin-bottom: 8px;
    border-bottom: 1px solid rgba(151, 184, 255, .35);
    padding-bottom: 6px;
    color: #cfe4ff;
  }
  .hist-close { background: none; border: none; font-size: 14px; cursor: pointer; color: #9fc2ff; }
  .hitem {
    display: flex; align-items: center; gap: 4px; padding: 3px 0;
    border-bottom: 1px solid rgba(134, 166, 235, .15);
    font-size: 8px; font-family: var(--fm);
  }
  .hnum { font-weight: 700; color: #83a8df; width: 24px; }
  .hres { font-weight: 900; font-size: 7px; padding: 1px 5px; border-radius: 4px; }
  .hres.w { background: #00ff88; color: #000; }
  .hres.l { background: #ff2d55; color: #fff; }
  .hlp { font-weight: 700; }
  .hlp.pos { color: #00cc66; }
  .hlp.neg { color: #ff2d55; }
  .hscore { color: #8caedc; margin-left: auto; }
  .hstreak { font-size: 7px; }
  .hist-empty { text-align: center; color: #7f99bf; font-size: 9px; padding: 20px 0; }

  /* ═══════ REPLAY BANNER ═══════ */
  .replay-banner {
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 8px;
    background: #c840ff;
    border: 3px solid #000;
    border-radius: 12px;
    padding: 6px 14px;
    box-shadow: 3px 3px 0 #000;
    animation: floatBarIn .3s ease;
  }
  .replay-icon { font-size: 14px; }
  .replay-text {
    font-family: var(--fd);
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 2px;
    color: #fff;
  }
  .replay-step {
    font-family: var(--fm);
    font-size: 8px;
    font-weight: 700;
    color: rgba(255,255,255,.6);
  }
  .replay-exit {
    font-family: var(--fm);
    font-size: 7px;
    font-weight: 900;
    letter-spacing: 1px;
    padding: 3px 8px;
    border: 2px solid #fff;
    border-radius: 6px;
    background: rgba(255,255,255,.15);
    color: #fff;
    cursor: pointer;
  }
  .replay-exit:hover { background: rgba(255,255,255,.3); }

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
    font-size: 8px;
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
  .prev-rr-val { font-size: 14px; color: #ffe600; }
  .preview-config {
    font-family: var(--fm);
    font-size: 8px;
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

  /* ═══════ PARTIAL REFERENCE UI LAYER (OUR TONE) ═══════ */
  .arena-rail {
    position: absolute;
    top: 52px;
    right: 10px;
    bottom: 38px;
    width: 190px;
    z-index: 14;
    border: 1px solid var(--arena-line);
    background: rgba(8, 18, 13, 0.92);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    backdrop-filter: blur(4px);
  }
  .rail-head {
    padding: 8px 10px;
    border-bottom: 1px solid var(--arena-line-soft);
    background: linear-gradient(180deg, rgba(232, 150, 125, 0.15), rgba(8, 18, 13, 0.2));
  }
  .rail-pair {
    font-family: var(--fd);
    font-size: 8px;
    font-weight: 900;
    letter-spacing: 1px;
    color: var(--arena-accent);
  }
  .rail-price {
    margin-top: 3px;
    font-family: var(--fd);
    font-size: 14px;
    font-weight: 900;
    color: var(--arena-text);
    letter-spacing: 1px;
  }
  .rail-tabs {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    border-top: 1px solid var(--arena-line-soft);
    border-bottom: 1px solid var(--arena-line-soft);
  }
  .rail-tabs button {
    height: 28px;
    border: none;
    background: transparent;
    color: var(--arena-text-muted);
    font-family: var(--fd);
    font-size: 7px;
    letter-spacing: 1px;
    font-weight: 900;
    cursor: pointer;
  }
  .rail-tabs button.active {
    color: var(--arena-text);
    background: rgba(232, 150, 125, 0.15);
    box-shadow: inset 0 -2px 0 rgba(232, 150, 125, 0.95);
  }
  .rail-body {
    flex: 1;
    overflow-y: auto;
  }
  .rail-body::-webkit-scrollbar {
    width: 2px;
  }
  .rail-body::-webkit-scrollbar-thumb {
    background: rgba(232, 150, 125, 0.35);
  }
  .rail-row {
    display: grid;
    grid-template-columns: 14px 1fr auto auto;
    align-items: center;
    gap: 5px;
    padding: 6px 8px;
    border-bottom: 1px solid var(--arena-line-soft);
  }
  .rail-rank {
    font-family: var(--fm);
    font-size: 7px;
    color: rgba(240, 237, 228, 0.45);
    text-align: center;
  }
  .rail-name {
    font-family: var(--fd);
    font-size: 7px;
    font-weight: 900;
    letter-spacing: 1px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .rail-dir {
    font-family: var(--fm);
    font-size: 6px;
    border: 1px solid;
    padding: 1px 4px;
    letter-spacing: 1px;
  }
  .rail-dir.long {
    color: var(--arena-good);
    border-color: rgba(0, 204, 136, 0.45);
    background: rgba(0, 204, 136, 0.12);
  }
  .rail-dir.short {
    color: var(--arena-bad);
    border-color: rgba(255, 94, 122, 0.42);
    background: rgba(255, 94, 122, 0.1);
  }
  .rail-dir.neutral {
    color: var(--arena-warn);
    border-color: rgba(220, 185, 112, 0.5);
    background: rgba(220, 185, 112, 0.12);
  }
  .rail-conf {
    font-family: var(--fm);
    font-size: 7px;
    color: var(--arena-accent-2);
    min-width: 26px;
    text-align: right;
  }
  .rail-log {
    padding: 6px 8px;
    border-bottom: 1px solid var(--arena-line-soft);
    display: grid;
    gap: 2px;
  }
  .rl-name {
    font-family: var(--fd);
    font-size: 7px;
    letter-spacing: 1px;
    font-weight: 900;
  }
  .rl-text {
    font-family: var(--fm);
    font-size: 7px;
    line-height: 1.35;
    color: var(--arena-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .rail-map {
    padding: 7px;
    display: grid;
    gap: 6px;
  }
  .rm-item {
    padding: 7px 8px;
    border: 1px solid var(--arena-line-soft);
    background: rgba(10, 22, 17, 0.78);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .rm-item span {
    font-family: var(--fm);
    font-size: 7px;
    color: var(--arena-text-muted);
    letter-spacing: 1px;
  }
  .rm-item b {
    font-family: var(--fd);
    font-size: 8px;
    color: var(--arena-text);
    letter-spacing: 1px;
  }
  .rail-empty {
    padding: 18px 10px;
    text-align: center;
    color: rgba(240, 237, 228, 0.45);
    font-family: var(--fm);
    font-size: 8px;
  }

  .arena-balance {
    position: absolute;
    left: 10px;
    right: 10px;
    bottom: 8px;
    z-index: 15;
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 8px;
  }
  .arena-balance > span {
    font-family: var(--fm);
    font-size: 7px;
    letter-spacing: 1px;
    color: var(--arena-text-muted);
  }
  .ab-track {
    height: 6px;
    border: 1px solid var(--arena-line-soft);
    background: linear-gradient(90deg, rgba(0, 204, 136, 0.12), rgba(255, 94, 122, 0.18));
    position: relative;
    overflow: hidden;
  }
  .ab-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--arena-good), var(--arena-accent-2));
    transition: width .3s ease;
  }

  .feed-panel {
    left: 8px;
    right: 206px;
    max-height: 82px;
  }
  .feed-msg {
    border-color: var(--arena-line-soft);
    background: rgba(8, 18, 13, 0.78);
    color: var(--arena-text);
  }
  .feed-text {
    color: var(--arena-text-dim);
  }
  .hist-btn {
    right: 206px;
  }

  @media (max-width: 1150px) {
    .arena-rail {
      width: 170px;
    }
    .feed-panel {
      right: 184px;
    }
    .hist-btn {
      right: 184px;
    }
  }
  @media (max-width: 900px) {
    .arena-rail {
      display: none;
    }
    .feed-panel {
      right: 8px;
    }
    .hist-btn {
      right: 8px;
    }
  }

  @keyframes popIn { from { transform: translate(-50%, -50%) scale(.8); opacity: 0 } to { transform: translate(-50%, -50%) scale(1); opacity: 1 } }
  @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }

  @media (max-width: 768px) {
    .battle-layout { grid-template-columns: 1fr; grid-template-rows: 45% 1fr; }
    .chart-side { border-right: none; border-bottom: 4px solid #000; }
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
    box-shadow: 0 0 40px rgba(255,230,0,.15), 8px 8px 0 #000;
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
    background: repeating-conic-gradient(transparent 0deg 8deg, rgba(255,230,0,.04) 8deg 16deg);
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
    font-size: 8px;
    color: rgba(255,255,255,.25);
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
