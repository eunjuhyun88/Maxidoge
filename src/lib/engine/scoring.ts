// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — Scoring & LP Engine
// ═══════════════════════════════════════════════════════════════

import type { AgentDef } from '$lib/data/agents';

export function calculateLP(win: boolean, streak: number, lpMult: number): number {
  if (win) {
    const base = 15 + (streak >= 3 ? 5 : 0);
    return Math.round(base * lpMult);
  }
  return -8;
}

export function determineConsensus(
  userDir: string,
  agentDirs: string[],
  hasGuardianOverride: boolean
): { type: string; lpMult: number; badge: string } {
  const longs = agentDirs.filter(d => d === 'LONG').length;
  const agentDir = longs > agentDirs.length / 2 ? 'LONG' : 'SHORT';
  const match = userDir === agentDir;

  if (hasGuardianOverride) return { type: 'override', lpMult: 1.0, badge: 'OVERRIDE' };
  if (match && longs >= Math.ceil(agentDirs.length * 0.8)) return { type: 'consensus', lpMult: 1.5, badge: 'CONSENSUS x1.5' };
  if (match) return { type: 'partial', lpMult: 1.0, badge: 'PARTIAL x1.0' };
  return { type: 'dissent', lpMult: 0.7, badge: 'DISSENT x0.7' };
}
