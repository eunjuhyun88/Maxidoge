// ═══════════════════════════════════════════════════════════════
// STOCKCLAW — Team Store
// User teams cache + CRUD operations
// ═══════════════════════════════════════════════════════════════

import { writable, derived } from 'svelte/store';
import { gameState } from './gameState';
import {
  getUserTeams,
  createTeam,
  joinTeam,
  leaveTeam,
  disbandTeam,
  listTeamMatches,
  createTeamMatch,
} from '$lib/api/arenaApi';
import type { TeamInfo, TeamMatchSummary, TeamRole } from '$lib/engine/types';

interface TeamStoreState {
  teams: TeamInfo[];
  teamMatches: TeamMatchSummary[];
  loading: boolean;
  error: string | null;
}

const store = writable<TeamStoreState>({
  teams: [],
  teamMatches: [],
  loading: false,
  error: null,
});

/** Load user's teams from server */
export async function loadTeams() {
  store.update(s => ({ ...s, loading: true, error: null }));
  try {
    const res = await getUserTeams();
    store.update(s => ({ ...s, teams: res.teams }));
  } catch (err: unknown) {
    store.update(s => ({ ...s, error: err instanceof Error ? err.message : 'Failed to load teams' }));
  } finally {
    store.update(s => ({ ...s, loading: false }));
  }
}

/** Create a new team */
export async function createNewTeam(name: string) {
  store.update(s => ({ ...s, loading: true, error: null }));
  try {
    const res = await createTeam(name);
    // Set team context — creator is CAPTAIN
    if (res.team) {
      gameState.update(g => ({
        ...g,
        teamContext: {
          teamId: res.team!.id,
          teamName: res.team!.name,
          role: 'CAPTAIN' as TeamRole,
          teamMatchId: null,
        },
      }));
    }
    await loadTeams(); // refresh list
    return res.team;
  } catch (err: unknown) {
    store.update(s => ({ ...s, error: err instanceof Error ? err.message : 'Failed to create team' }));
    throw err;
  } finally {
    store.update(s => ({ ...s, loading: false }));
  }
}

/** Join an existing team */
export async function joinExistingTeam(teamId: string) {
  store.update(s => ({ ...s, loading: true, error: null }));
  try {
    const res = await joinTeam(teamId);
    gameState.update(g => ({
      ...g,
      teamContext: {
        teamId,
        teamName: null, // will be set when teams reload
        role: (res.member?.role as TeamRole) ?? 'SUPPORT_A',
        teamMatchId: null,
      },
    }));
    await loadTeams();
  } catch (err: unknown) {
    store.update(s => ({ ...s, error: err instanceof Error ? err.message : 'Failed to join team' }));
    throw err;
  } finally {
    store.update(s => ({ ...s, loading: false }));
  }
}

/** Leave current team */
export async function leaveCurrentTeam(teamId: string) {
  store.update(s => ({ ...s, loading: true, error: null }));
  try {
    await leaveTeam(teamId);
    gameState.update(g => ({
      ...g,
      teamContext: { teamId: null, teamName: null, role: null, teamMatchId: null },
    }));
    await loadTeams();
  } catch (err: unknown) {
    store.update(s => ({ ...s, error: err instanceof Error ? err.message : 'Failed to leave team' }));
    throw err;
  } finally {
    store.update(s => ({ ...s, loading: false }));
  }
}

/** Disband team (captain only) */
export async function disbandCurrentTeam(teamId: string) {
  store.update(s => ({ ...s, loading: true, error: null }));
  try {
    await disbandTeam(teamId);
    gameState.update(g => ({
      ...g,
      teamContext: { teamId: null, teamName: null, role: null, teamMatchId: null },
    }));
    await loadTeams();
  } catch (err: unknown) {
    store.update(s => ({ ...s, error: err instanceof Error ? err.message : 'Failed to disband team' }));
    throw err;
  } finally {
    store.update(s => ({ ...s, loading: false }));
  }
}

/** Load team matches for a specific team */
export async function loadTeamMatches(teamId: string) {
  store.update(s => ({ ...s, loading: true, error: null }));
  try {
    const res = await listTeamMatches(teamId);
    store.update(s => ({ ...s, teamMatches: res.matches }));
  } catch (err: unknown) {
    store.update(s => ({ ...s, error: err instanceof Error ? err.message : 'Failed to load matches' }));
  } finally {
    store.update(s => ({ ...s, loading: false }));
  }
}

/** Start a new team match */
export async function startTeamMatch(teamId: string, pair: string) {
  store.update(s => ({ ...s, loading: true, error: null }));
  try {
    const res = await createTeamMatch(teamId, pair);
    gameState.update(g => ({
      ...g,
      teamContext: { ...g.teamContext, teamMatchId: res.match.id },
    }));
    return res.match;
  } catch (err: unknown) {
    store.update(s => ({ ...s, error: err instanceof Error ? err.message : 'Failed to start team match' }));
    throw err;
  } finally {
    store.update(s => ({ ...s, loading: false }));
  }
}

// Derived convenience
export const teamList = derived(store, $s => $s.teams);
export const teamMatches = derived(store, $s => $s.teamMatches);
export const teamLoading = derived(store, $s => $s.loading);
export const teamError = derived(store, $s => $s.error);
export const activeTeam = derived(gameState, $g => $g.teamContext);

export { store as teamStore };
