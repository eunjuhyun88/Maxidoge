import type {
  AgentDef,
  BattleTurn,
  CharSpriteState,
  CharState,
} from '$lib/engine/arenaCharacters';
import {
  ACTION_CATALOG,
  AGENT_TO_CHAR_STATE,
  ATTACK_SUPER,
  ATTACK_WEAK,
  createInitialSprites,
  getFormPos,
  scheduleBattleTurns,
} from '$lib/engine/arenaCharacters';

export interface ArenaBattleChatMessage {
  agentId: string;
  name: string;
  icon: string;
  color: string;
  text: string;
  isAction?: boolean;
}

interface ArenaBattlePresentationRuntimeOptions {
  getActiveAgents: () => AgentDef[];
  getHypothesisDir: () => string | null | undefined;
  getCharSprites: () => Record<string, CharSpriteState>;
  getVsMeterTarget: () => number;
  getEnemyHP: () => number;
  getAgentEnergy: (agentId: string) => number;
  setCharSprites: (sprites: Record<string, CharSpriteState>) => void;
  setAgentState: (agentId: string, state: string) => void;
  setAgentEnergy: (agentId: string, energy: number) => void;
  setBattleTurns: (turns: BattleTurn[]) => void;
  setCurrentTurnIdx: (idx: number) => void;
  clearChatMessages: () => void;
  appendChatMessage: (message: ArenaBattleChatMessage) => void;
  setBattleNarration: (text: string) => void;
  setBattlePhaseLabel: (text: string) => void;
  setVsMeter: (value: number) => void;
  setVsMeterTarget: (value: number) => void;
  setEnemyHP: (value: number) => void;
  setComboCount: (value: number) => void;
  setShowCombo: (value: boolean) => void;
  setShowCritical: (value: boolean) => void;
  setCriticalText: (text: string) => void;
  setShowVsSplash: (value: boolean) => void;
  runChargeEffect: () => void;
  runSplashEffect: () => void;
  runImpactEffect: (variant: 'critical' | 'super' | 'weak' | 'normal') => void;
  isDestroyed: () => boolean;
}

function clampBattleMeter(value: number) {
  return Math.max(5, Math.min(95, value));
}

export function createArenaBattlePresentationRuntime(
  options: ArenaBattlePresentationRuntimeOptions,
) {
  let turnTimers: ReturnType<typeof setTimeout>[] = [];
  let comboCount = 0;
  let lastHitTime = 0;

  function trackTimer(id: ReturnType<typeof setTimeout>) {
    turnTimers.push(id);
    return id;
  }

  function schedule(fn: () => void, delayMs: number) {
    return trackTimer(
      setTimeout(() => {
        if (options.isDestroyed()) {
          return;
        }
        fn();
      }, delayMs),
    );
  }

  function updateSprite(
    agentId: string,
    updater: (sprite: CharSpriteState) => CharSpriteState,
  ) {
    const sprites = options.getCharSprites();
    const current = sprites[agentId];
    if (!current) {
      return;
    }
    options.setCharSprites({
      ...sprites,
      [agentId]: updater(current),
    });
  }

  function initCharSprites() {
    options.setCharSprites(createInitialSprites(options.getActiveAgents()));
  }

  function setCharState(agentId: string, nextState: CharState, duration = 0) {
    updateSprite(agentId, (sprite) => ({ ...sprite, charState: nextState }));
    if (duration > 0) {
      schedule(() => {
        updateSprite(agentId, (sprite) => ({ ...sprite, charState: 'idle' }));
      }, duration);
    }
  }

  function syncAgentState(agentId: string, agentState: string) {
    const mapped = AGENT_TO_CHAR_STATE[agentState] || 'idle';
    updateSprite(agentId, (sprite) => ({ ...sprite, charState: mapped as CharState }));
  }

  function syncAgentEnergy(agentId: string, energy: number) {
    updateSprite(agentId, (sprite) => ({ ...sprite, energy: Math.min(100, energy) }));
  }

  function moveChar(agentId: string, x: number, y: number) {
    updateSprite(agentId, (sprite) => ({
      ...sprite,
      targetX: x,
      targetY: y,
      x,
      y,
      flipX: x > sprite.x,
    }));
  }

  function showCharHit(agentId: string, text: string, color: string) {
    updateSprite(agentId, (sprite) => ({
      ...sprite,
      showHit: true,
      hitText: text,
      hitColor: color,
    }));
    schedule(() => {
      updateSprite(agentId, (sprite) => ({ ...sprite, showHit: false }));
    }, 1200);
  }

  function showCharAction(agentId: string, emoji: string, label: string) {
    updateSprite(agentId, (sprite) => ({
      ...sprite,
      actionEmoji: emoji,
      actionLabel: label,
    }));
    schedule(() => {
      updateSprite(agentId, (sprite) => ({
        ...sprite,
        actionEmoji: '',
        actionLabel: '',
      }));
    }, 1300);
  }

  function appendAgentChatMessage(agent: AgentDef, text: string, isAction = false) {
    options.appendChatMessage({
      agentId: agent.id,
      name: agent.name,
      icon: agent.icon,
      color: agent.color,
      text,
      isAction,
    });
  }

  function trackCombo() {
    const now = Date.now();
    if (now - lastHitTime < 3000) {
      comboCount += 1;
      options.setComboCount(comboCount);
      options.setShowCombo(true);
      schedule(() => {
        options.setShowCombo(false);
      }, 1000);
    } else {
      comboCount = 1;
      options.setComboCount(comboCount);
    }
    lastHitTime = now;
  }

  function executeTurn(turn: BattleTurn, idx: number) {
    const activeAgents = options.getActiveAgents();
    const agentId = turn.agent.id;
    const action = ACTION_CATALOG[turn.action];

    options.setCurrentTurnIdx(idx);
    setCharState(agentId, 'lock');
    options.setAgentState(agentId, 'alert');
    options.setBattleNarration(`${turn.agent.name} 준비 중...`);
    options.setBattlePhaseLabel(`${turn.agent.name} TURN`);

    schedule(() => {
      setCharState(agentId, 'windup');
      options.setAgentState(agentId, 'charge');
      options.runChargeEffect();
      showCharAction(agentId, '⚡', '차징...');
      options.setBattleNarration(`${turn.agent.name}: ${action.label}`);
      appendAgentChatMessage(turn.agent, `${turn.attackName} ${action.emoji} ${action.label}`, true);
      const homePos = getFormPos(activeAgents.indexOf(turn.agent), activeAgents.length);
      moveChar(agentId, 50 + (homePos.x - 50) * 0.3, 50 + (homePos.y - 50) * 0.3);
    }, 400);

    schedule(() => {
      setCharState(agentId, 'cast');
      showCharAction(agentId, action.emoji, action.label);
    }, 900);

    schedule(() => {
      setCharState(agentId, 'impact');
      trackCombo();

      if (turn.isCritical) {
        options.runImpactEffect('critical');
        options.setBattleNarration(`💥 CRITICAL! ${turn.agent.name} ${ATTACK_SUPER[agentId] || '필살!'}`);
        showCharHit(agentId, `CRITICAL! -${Math.round(turn.damage)}`, '#ffcc00');
        options.setShowCritical(true);
        options.setCriticalText(`💥 ${turn.agent.name} CRITICAL!`);
        appendAgentChatMessage(turn.agent, `급소!! ${ATTACK_SUPER[agentId] || ''} 🔥`);
        schedule(() => {
          options.setShowCritical(false);
        }, 1200);
      } else if (turn.effectiveness === 'super') {
        options.runImpactEffect('super');
        options.setBattleNarration(`⚡ ${turn.attackName}! ${ATTACK_SUPER[agentId] || '효과 굉장!'}`);
        showCharHit(agentId, `-${Math.round(turn.damage)}`, '#00ff88');
        appendAgentChatMessage(turn.agent, `${ATTACK_SUPER[agentId] || '효과 굉장!'} ⚡`);
      } else if (turn.effectiveness === 'weak') {
        options.runImpactEffect('weak');
        options.setBattleNarration(`${turn.attackName}... ${ATTACK_WEAK[agentId] || '효과 약함'}`);
        showCharHit(agentId, 'WEAK', '#ff5e7a');
        appendAgentChatMessage(turn.agent, `${ATTACK_WEAK[agentId] || '효과 약함...'} 😐`);
      } else {
        options.runImpactEffect('normal');
        options.setBattleNarration(`${turn.attackName}! 나쁘지 않다!`);
        showCharHit(agentId, `-${Math.round(turn.damage)}`, '#fff');
        appendAgentChatMessage(turn.agent, '나쁘지 않다! 💪');
      }

      const sprites = options.getCharSprites();
      const sprite = sprites[agentId];
      if (sprite) {
        options.setCharSprites({
          ...sprites,
          [agentId]: {
            ...sprite,
            energy: Math.min(100, sprite.energy + 25 + (turn.isCritical ? 20 : 0)),
          },
        });
      }

      const nextVsMeterTarget = clampBattleMeter(options.getVsMeterTarget() + turn.meterShift);
      options.setVsMeterTarget(nextVsMeterTarget);
      options.setVsMeter(nextVsMeterTarget);
      options.setEnemyHP(
        Math.max(
          0,
          Math.min(
            100,
            options.getEnemyHP() - turn.damage * (turn.dirSign > 0 ? 1 : -1) * 0.5,
          ),
        ),
      );
      options.setAgentEnergy(
        agentId,
        Math.min(100, options.getAgentEnergy(agentId) + 30 + (turn.isCritical ? 20 : 0)),
      );
    }, 1300);

    const bigHit = turn.effectiveness === 'super' || turn.isCritical;
    schedule(() => {
      setCharState(agentId, bigHit ? 'celebrate' : 'recover');
      options.setAgentState(agentId, bigHit ? 'jump' : 'idle');
      const homePos = getFormPos(activeAgents.indexOf(turn.agent), activeAgents.length);
      moveChar(agentId, homePos.x, homePos.y);
      options.setBattlePhaseLabel('COMBAT');
    }, 2000);

    schedule(() => {
      setCharState(agentId, 'idle');
    }, 2500);
  }

  function clearTurnTimers() {
    turnTimers.forEach((timerId) => clearTimeout(timerId));
    turnTimers = [];
  }

  function startBattleTurnSequence() {
    clearTurnTimers();
    const activeAgents = options.getActiveAgents();
    const turns = scheduleBattleTurns(activeAgents);
    comboCount = 0;
    lastHitTime = 0;

    options.setBattleTurns(turns);
    options.setVsMeter(50);
    options.setVsMeterTarget(50);
    options.setCurrentTurnIdx(-1);
    options.clearChatMessages();
    options.setBattleNarration('');
    options.setEnemyHP(100);
    options.setComboCount(0);
    options.setShowCombo(false);
    options.setShowCritical(false);
    options.setCriticalText('');
    options.setBattlePhaseLabel('VS SPLASH');
    initCharSprites();
    options.setShowVsSplash(true);
    options.runSplashEffect();
    options.appendChatMessage({
      agentId: 'SYS',
      name: 'SYSTEM',
      icon: '⚔',
      color: '#ff5e7a',
      text: options.getHypothesisDir() === 'LONG' ? '🔥 LONG SQUAD vs MARKET 🔥' : '🔥 SHORT SQUAD vs MARKET 🔥',
      isAction: true,
    });

    activeAgents.forEach((agent) => setCharState(agent.id, 'patrol', 1500));

    schedule(() => {
      options.setShowVsSplash(false);
      options.setBattlePhaseLabel('COMBAT');
    }, 1500);

    turns.forEach((turn, idx) => {
      schedule(() => {
        executeTurn(turn, idx);
      }, 1800 + idx * 2800);
    });

    const suspenseDelay = 1800 + turns.length * 2800;
    schedule(() => {
      options.setBattleNarration('⏳ 시장이 결정한다...');
      options.setBattlePhaseLabel('JUDGMENT');
      options.appendChatMessage({
        agentId: 'SYS',
        name: 'MARKET',
        icon: '🌑',
        color: '#ffcc00',
        text: '시장이 결정한다...',
        isAction: true,
      });
      activeAgents.forEach((agent) => setCharState(agent.id, 'lock'));
    }, suspenseDelay);
  }

  function destroy() {
    clearTurnTimers();
  }

  return {
    clearTurnTimers,
    destroy,
    initCharSprites,
    moveChar,
    setCharState,
    showCharAction,
    startBattleTurnSequence,
    syncAgentEnergy,
    syncAgentState,
  };
}
