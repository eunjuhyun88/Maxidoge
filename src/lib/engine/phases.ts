// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — 11-Phase Battle Engine (v2 with Preview)
// ═══════════════════════════════════════════════════════════════

import type { Phase } from '$lib/stores/gameState';

export const PHASES: Phase[] = [
  'config', 'deploy', 'hypothesis', 'preview', 'scout', 'gather', 'council',
  'verdict', 'compare', 'battle', 'result', 'cooldown'
];

export const PHASE_DURATION: Record<Phase, number> = {
  standby: 0,
  config: 0,      // User-controlled (no auto-advance)
  deploy: 2,
  hypothesis: 45,
  preview: 3,     // Position preview before scout
  scout: 6,
  gather: 2,
  council: 10,
  verdict: 2.5,
  compare: 4,
  battle: 12,
  result: 3,
  cooldown: 1
};

export const PHASE_LABELS: Record<Phase, { name: string; color: string; emoji: string }> = {
  standby: { name: 'STANDBY', color: '#888', emoji: '💤' },
  config: { name: 'SQUAD CONFIG', color: '#8b5cf6', emoji: '⚙️' },
  deploy: { name: 'WOW DEPLOY', color: '#0066cc', emoji: '🐕' },
  hypothesis: { name: 'YOUR CALL?', color: '#9900cc', emoji: '🐕' },
  preview: { name: 'POSITION PREVIEW', color: '#ff6600', emoji: '👁' },
  scout: { name: 'SUCH SCOUTING', color: '#cc6600', emoji: '🔍' },
  gather: { name: 'MUCH GATHER', color: '#cc6600', emoji: '🐕' },
  council: { name: 'VERY COUNCIL', color: '#cc0066', emoji: '🗳' },
  verdict: { name: 'SO VERDICT', color: '#cc0066', emoji: '★' },
  compare: { name: 'COMPARE', color: '#ff6600', emoji: '⚔️' },
  battle: { name: 'MUCH BATTLE', color: '#cc0033', emoji: '⚔' },
  result: { name: 'RESULT', color: '#00aa44', emoji: '🏆' },
  cooldown: { name: '· · ·', color: '#888', emoji: '💤' }
};

export const DOGE_DEPLOYS = ['such deploy! ⚡', 'wow go go!', 'much ready!', 'very start!', 'to the moon! 🌙'];
export const DOGE_GATHER = ['wow report!', 'such data!', 'very finding!', 'much info!', 'so ready!'];
export const DOGE_BATTLE = ['wow battle...', 'such candle!', 'very intense!', 'much volatility!', 'so price action!'];
export const DOGE_WIN = ['WOW TP HIT!!', 'VERY WIN!', 'SUCH GAINS!', 'MUCH PROFIT!', 'WOW! 💪'];
export const DOGE_LOSE = ['such sad...', 'very rekt 😢', 'much pain...', 'wow loss...', 'no moon... 😢'];
export const DOGE_VOTE_LONG = ['TO THE MOON! 🌙', 'LONG! such wow!', 'very bullish! 🔥', 'wow LONG! 💎', 'ALL IN! 🚀'];
export const DOGE_WORDS = ['WOW!', 'SUCH!', 'MUCH!', 'VERY!', 'SO!', 'AMAZE!', 'MOON!', 'HODL!', '💎PAWS!', '🚀MOON!', 'GAINS!', 'PUMP!'];
export const WIN_MOTTOS = ['IF IT DIPS, DOUBLE DOWN', 'I ONLY BUY GREEN', 'IN GAINS WE TRUST', 'PUMP MONTH'];
export const LOSE_MOTTOS = ['NO RISK NO RAMEN', 'SUCH IS DEGEN LIFE', "THE DEGEN'S MANIFESTO", 'REKT BUT HOPEFUL'];

export function getNextPhase(current: Phase): Phase {
  const idx = PHASES.indexOf(current);
  if (idx === -1) return 'deploy';
  return PHASES[(idx + 1) % PHASES.length];
}

export function getPhaseDuration(phase: Phase, speed: number): number {
  return (PHASE_DURATION[phase] || 2) / Math.max(1, speed);
}
