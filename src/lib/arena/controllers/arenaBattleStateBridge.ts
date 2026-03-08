import type { BattleTurn, CharSpriteState } from '$lib/engine/arenaCharacters';

interface CreateArenaBattleStateBridgeOptions {
  getCharSprites: () => Record<string, CharSpriteState>;
  getVsMeterTarget: () => number;
  getEnemyHp: () => number;
  setCharSprites: (next: Record<string, CharSpriteState>) => void;
  setBattleTurns: (next: BattleTurn[]) => void;
  setCurrentTurnIdx: (next: number) => void;
  setBattleNarration: (next: string) => void;
  setBattlePhaseLabel: (next: string) => void;
  setVsMeter: (next: number) => void;
  setVsMeterTarget: (next: number) => void;
  setEnemyHp: (next: number) => void;
  setComboCount: (next: number) => void;
  setShowCombo: (next: boolean) => void;
  setShowCritical: (next: boolean) => void;
  setCriticalText: (next: string) => void;
  setShowVsSplash: (next: boolean) => void;
}

export function createArenaBattleStateBridge(options: CreateArenaBattleStateBridgeOptions) {
  return {
    getCharSprites: options.getCharSprites,
    getEnemyHp: options.getEnemyHp,
    getVsMeterTarget: options.getVsMeterTarget,
    setBattleNarration: options.setBattleNarration,
    setBattlePhaseLabel: options.setBattlePhaseLabel,
    setBattleTurns: options.setBattleTurns,
    setCharSprites: options.setCharSprites,
    setComboCount: options.setComboCount,
    setCriticalText: options.setCriticalText,
    setCurrentTurnIdx: options.setCurrentTurnIdx,
    setEnemyHp: options.setEnemyHp,
    setShowCombo: options.setShowCombo,
    setShowCritical: options.setShowCritical,
    setShowVsSplash: options.setShowVsSplash,
    setVsMeter: options.setVsMeter,
    setVsMeterTarget: options.setVsMeterTarget,
  };
}
