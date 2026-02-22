// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — Agent Persistent Data Store
// ═══════════════════════════════════════════════════════════════

import { writable } from 'svelte/store';
import { AGDEFS } from '$lib/data/agents';
import { STORAGE_KEYS } from './storageKeys';
import { fetchAgentStatsApi, updateAgentStatApi } from '$lib/api/agentStatsApi';
import { resolveAgentLevelFromMatches } from './progressionRules';

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
let _agentSyncTimer: ReturnType<typeof setTimeout> | null = null;
let _lastServerHash = '';

function buildServerPayload(data: Record<string, AgentStats>) {
  return Object.entries(data).map(([agentId, s]) => ({
    agentId,
    level: s.level,
    xp: s.xp,
    xpMax: s.xpMax,
    wins: s.wins,
    losses: s.losses,
    bestStreak: s.bestStreak,
    curStreak: s.curStreak,
    avgConf: s.avgConf,
    bestConf: s.bestConf,
    stamps: s.stamps
  }));
}

async function syncAgentStatsToServer(data: Record<string, AgentStats>) {
  const payload = buildServerPayload(data);
  const hash = JSON.stringify(payload);
  if (hash === _lastServerHash) return;
  _lastServerHash = hash;

  await Promise.all(
    payload.map((item) =>
      updateAgentStatApi(item.agentId, {
        level: item.level,
        xp: item.xp,
        xpMax: item.xpMax,
        wins: item.wins,
        losses: item.losses,
        bestStreak: item.bestStreak,
        curStreak: item.curStreak,
        avgConf: item.avgConf,
        bestConf: item.bestConf,
        stamps: item.stamps,
      })
    )
  );
}

let _agentHydrated = false;
export async function hydrateAgentStats(force = false) {
  if (typeof window === 'undefined') return;
  if (_agentHydrated && !force) return;

  const rows = await fetchAgentStatsApi();
  if (!rows) return;
  if (rows.length === 0) {
    _agentHydrated = true;
    return;
  }

  const next = createDefaultStats();
  for (const row of rows) {
    if (!next[row.agentId]) continue;
    next[row.agentId] = {
      ...next[row.agentId],
      level: Number(row.level ?? next[row.agentId].level),
      xp: Number(row.xp ?? next[row.agentId].xp),
      xpMax: Number(row.xpMax ?? next[row.agentId].xpMax),
      wins: Number(row.wins ?? next[row.agentId].wins),
      losses: Number(row.losses ?? next[row.agentId].losses),
      bestStreak: Number(row.bestStreak ?? next[row.agentId].bestStreak),
      curStreak: Number(row.curStreak ?? next[row.agentId].curStreak),
      avgConf: Number(row.avgConf ?? next[row.agentId].avgConf),
      bestConf: Number(row.bestConf ?? next[row.agentId].bestConf),
      stamps: {
        ...next[row.agentId].stamps,
        ...(row.stamps || {}),
      },
    };
  }

  _agentHydrated = true;
  agentStats.set(next);
}

if (typeof window !== 'undefined') {
  void hydrateAgentStats();
}

agentStats.subscribe(data => {
  if (typeof window === 'undefined') return;
  clearTimeout(_agentSaveTimer);
  _agentSaveTimer = setTimeout(() => {
    localStorage.setItem(STORAGE_KEYS.agents, JSON.stringify(data));
  }, 500);

  if (_agentSyncTimer) clearTimeout(_agentSyncTimer);
  _agentSyncTimer = setTimeout(() => {
    void syncAgentStatsToServer(data);
  }, 900);
});

function recalcFromMatches(ag: AgentStats) {
  const count = Math.max(ag.matches.length, ag.wins + ag.losses);
  const levelState = resolveAgentLevelFromMatches(count);
  ag.level = levelState.level;
  ag.xp = levelState.xp;
  ag.xpMax = levelState.xpMax;

  if (ag.matches.length > 0) {
    const confSum = ag.matches.reduce((sum, m) => sum + Number(m.conf || 0), 0);
    ag.avgConf = Math.round(confSum / ag.matches.length);
    ag.bestConf = Math.max(ag.bestConf, ...ag.matches.map((m) => Number(m.conf || 0)));
  }
}

export function recordAgentMatch(agentId: string, match: MatchRecord) {
  agentStats.update((stats) => {
    const ag = stats[agentId];
    if (!ag) return stats;

    if (match.win) {
      ag.wins += 1;
      ag.curStreak += 1;
      ag.stamps.win += 1;
      if (ag.curStreak > ag.bestStreak) {
        ag.bestStreak = ag.curStreak;
        ag.stamps.streak += 1;
      }
    } else {
      ag.losses += 1;
      ag.curStreak = 0;
      ag.stamps.lose += 1;
    }

    ag.matches.push(match);
    if (ag.matches.length > 60) ag.matches.shift();
    recalcFromMatches(ag);
    return { ...stats };
  });
}

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
    // Keep legacy helper compatible, but normalize to shared progression model when possible.
    recalcFromMatches(ag);
    return { ...stats };
  });
}

export function getWinRate(stats: AgentStats): number {
  const total = stats.wins + stats.losses;
  return total > 0 ? Math.round((stats.wins / total) * 100) : 0;
}
