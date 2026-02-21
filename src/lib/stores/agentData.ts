// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — Agent Persistent Data Store
// ═══════════════════════════════════════════════════════════════

import { writable } from 'svelte/store';
import { AGDEFS } from '$lib/data/agents';
import { STORAGE_KEYS } from './storageKeys';

export interface AgentStats {
  level: number;
  xp: number;
  xpMax: number;
  wins: number;
  losses: number;
  bestStreak: number;
  curStreak: number;
  avgConf: number;
  bestConf: number;
  matches: MatchRecord[];
  stamps: { win: number; lose: number; streak: number; diamond: number; crown: number };
}

export interface MatchRecord {
  matchN: number;
  dir: string;
  conf: number;
  win: boolean;
  lp: number;
  hypothesis?: string;
}

function createDefaultStats(): Record<string, AgentStats> {
  const stats: Record<string, AgentStats> = {};
  for (const ag of AGDEFS) {
    stats[ag.id] = {
      level: 1, xp: 0, xpMax: 100,
      wins: 0, losses: 0,
      bestStreak: 0, curStreak: 0,
      avgConf: ag.conf, bestConf: ag.conf,
      matches: [],
      stamps: { win: 0, lose: 0, streak: 0, diamond: 0, crown: 0 }
    };
  }
  return stats;
}

function loadAgentData(): Record<string, AgentStats> {
  if (typeof window === 'undefined') return createDefaultStats();
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.agents);
    if (saved) return { ...createDefaultStats(), ...JSON.parse(saved) };
  } catch {}
  return createDefaultStats();
}

export const agentStats = writable<Record<string, AgentStats>>(loadAgentData());

// Auto-save (debounced to avoid blocking main thread)
let _agentSaveTimer: ReturnType<typeof setTimeout>;
agentStats.subscribe(data => {
  if (typeof window === 'undefined') return;
  clearTimeout(_agentSaveTimer);
  _agentSaveTimer = setTimeout(() => {
    localStorage.setItem(STORAGE_KEYS.agents, JSON.stringify(data));
  }, 500);
});

// Helpers
export function addXP(agentId: string, amount: number) {
  agentStats.update(stats => {
    const ag = stats[agentId];
    if (!ag) return stats;
    ag.xp += amount;
    while (ag.xp >= ag.xpMax && ag.level < 10) {
      ag.xp -= ag.xpMax;
      ag.level++;
      ag.xpMax = Math.floor(ag.xpMax * 1.5);
    }
    return { ...stats };
  });
}

export function getWinRate(stats: AgentStats): number {
  const total = stats.wins + stats.losses;
  return total > 0 ? Math.round((stats.wins / total) * 100) : 0;
}
