export interface ArenaRewardState {
  visible: boolean;
  xpGain: number;
  streak: number;
  badges: string[];
}

interface ArenaRewardInput {
  win: boolean;
  score: number;
  streak: number;
  consensusType: string;
  lpMult: number;
}

export function createArenaRewardState(): ArenaRewardState {
  return {
    visible: false,
    xpGain: 0,
    streak: 0,
    badges: [],
  };
}

export function buildArenaRewardState(input: ArenaRewardInput): ArenaRewardState {
  const winBonus = input.win ? 42 : 12;
  const scoreBonus = Math.round(Math.max(0, input.score - 45) * 1.15);
  const streakBonus = input.streak >= 2 ? input.streak * 10 : 0;
  const consensusBonus = Math.round(input.lpMult * 16);

  return {
    visible: true,
    xpGain: winBonus + scoreBonus + streakBonus + consensusBonus,
    streak: input.streak,
    badges: [
      input.win ? 'MISSION CLEAR' : 'FIELD REPORT',
      input.score >= 80 ? 'PRECISION+' : '',
      buildConsensusRewardBadge(input.consensusType),
      input.streak >= 3 ? 'STREAK ENGINE' : '',
    ].filter(Boolean),
  };
}

function buildConsensusRewardBadge(consensusType: string): string {
  if (consensusType === 'consensus') return 'COUNCIL SYNC';
  if (consensusType === 'partial') return 'PARTIAL READ';
  return 'HIGH DIVERGENCE';
}
