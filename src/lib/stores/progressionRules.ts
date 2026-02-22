// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — Shared Progression Rules
// ═══════════════════════════════════════════════════════════════

export function resolveLifecyclePhase(matchesPlayed: number, totalLP: number): number {
  const matches = Math.max(0, Math.floor(matchesPlayed || 0));
  const lp = Math.max(0, Math.floor(totalLP || 0));

  if (lp >= 2200 || matches >= 200) return 5;
  if (lp >= 1200 || matches >= 50) return 4;
  if (lp >= 600 || matches >= 30) return 3;
  if (lp >= 200 || matches >= 10) return 2;
  if (matches >= 1) return 1;
  return 0;
}

export function resolveAgentLevelFromMatches(matchCount: number): { level: number; xp: number; xpMax: number } {
  const matches = Math.max(0, Math.floor(matchCount || 0));
  const level = Math.min(10, 1 + Math.floor(matches / 10));
  const xpMax = 100 + (level - 1) * 50;
  const progressInLevel = matches % 10;
  const xp = Math.round((progressInLevel / 10) * xpMax);
  return { level, xp, xpMax };
}
