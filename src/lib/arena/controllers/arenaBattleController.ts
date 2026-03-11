import { createBattleResolver, type BattleTickState } from '$lib/engine/battleResolver';
import type { Hypothesis, Position } from '$lib/stores/gameState';
import {
  applyArenaBattleResolverEffects,
  resolveArenaBattleOutcome,
} from '$lib/arena/battle/arenaBattleResolverRuntime';

interface ArenaBattleAgentLike {
  id: string;
}

interface ArenaBattleSnapshot<TAgent extends ArenaBattleAgentLike> {
  activeAgents: ReadonlyArray<TAgent>;
  speed: number;
  pos: Position | null;
  hypothesis: Hypothesis | null;
}

interface CreateArenaBattleControllerOptions<TAgent extends ArenaBattleAgentLike> {
  getSnapshot: () => ArenaBattleSnapshot<TAgent>;
  isDestroyed: () => boolean;
  onBattleEnter: () => void;
  onMissingPosition: () => void;
  applyBattleBootstrapState: () => void;
  applyBattleTick: (tick: BattleTickState) => void;
  applyResolvedBattleState: (result: string, exitTime: number, exitPrice: number) => void;
  setAgentState: (agentId: string, state: string) => void;
  setSpeech: (agentId: string, text: string, duration: number) => void;
  setVsMeter: (value: number) => void;
  setVsMeterTarget: (value: number) => void;
  setEnemyHP: (value: number) => void;
  addFeed: (icon: string, name: string, color: string, text: string) => void;
  advancePhase: () => void;
  safeTimeout: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
}

function buildFallbackPosition(hypothesis: Hypothesis | null): Position | null {
  if (!hypothesis) {
    return null;
  }

  return {
    entry: hypothesis.entry,
    tp: hypothesis.tp,
    sl: hypothesis.sl,
    dir: hypothesis.dir,
    rr: hypothesis.rr,
    size: 0,
    lev: 0,
  };
}

export function createArenaBattleController<TAgent extends ArenaBattleAgentLike>(
  options: CreateArenaBattleControllerOptions<TAgent>,
) {
  let battleResolver: ReturnType<typeof createBattleResolver> | null = null;
  let battleResolverUnsub: (() => void) | null = null;

  function clearBattleSession() {
    if (battleResolverUnsub) {
      battleResolverUnsub();
      battleResolverUnsub = null;
    }
    if (battleResolver) {
      battleResolver.destroy();
      battleResolver = null;
    }
  }

  function initBattle() {
    options.onBattleEnter();

    const snapshot = options.getSnapshot();
    const position = snapshot.pos || buildFallbackPosition(snapshot.hypothesis);
    if (!position) {
      options.onMissingPosition();
      return;
    }

    clearBattleSession();

    battleResolver = createBattleResolver({
      entryPrice: position.entry,
      tpPrice: position.tp,
      slPrice: position.sl,
      direction: position.dir === 'LONG' || position.dir === 'SHORT' ? position.dir : 'LONG',
      speed: snapshot.speed,
    });

    options.applyBattleBootstrapState();

    battleResolverUnsub = battleResolver.subscribe((tick: BattleTickState) => {
      if (options.isDestroyed()) {
        return;
      }

      options.applyBattleTick(tick);

      applyArenaBattleResolverEffects({
        tick,
        activeAgents: snapshot.activeAgents,
        setAgentState: options.setAgentState,
        setSpeech: options.setSpeech,
        setVsMeter: options.setVsMeter,
        setVsMeterTarget: options.setVsMeterTarget,
        setEnemyHP: options.setEnemyHP,
      });

      const resolvedBattle = resolveArenaBattleOutcome(tick);
      if (!resolvedBattle) {
        return;
      }

      options.applyResolvedBattleState(
        resolvedBattle.result,
        tick.exitTime || Date.now(),
        tick.exitPrice || tick.currentPrice,
      );
      clearBattleSession();
      options.addFeed(
        resolvedBattle.feed.icon,
        resolvedBattle.feed.name,
        resolvedBattle.feed.color,
        resolvedBattle.feed.text,
      );

      options.safeTimeout(() => {
        options.advancePhase();
      }, 1500);
    });
  }

  function destroy() {
    clearBattleSession();
  }

  return {
    clearBattleSession,
    destroy,
    initBattle,
  };
}
