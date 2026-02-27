// ═══════════════════════════════════════════════════════════════
// Stockclaw — Team Service (Phase 3)
// 3v3 팀전: 팀 CRUD, 멤버 관리, 팀 매치 생성/매칭/결과
// ═══════════════════════════════════════════════════════════════

import { query, withTransaction } from '$lib/server/db';
import type { ArenaMatchMode } from '$lib/engine/types';

// ── Types ──────────────────────────────────────────────────

export type TeamRole = 'CAPTAIN' | 'SUPPORT_A' | 'SUPPORT_B';
export type TeamMatchStatus = 'FORMING' | 'READY' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface Team {
  id: string;
  name: string;
  creatorId: string;
  tier: string;
  lpPool: number;
  winCount: number;
  lossCount: number;
  isActive: boolean;
  createdAt: string;
  members: TeamMember[];
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: TeamRole;
  joinedAt: string;
}

export interface TeamMatch {
  id: string;
  teamAId: string;
  teamBId: string | null;
  pair: string;
  status: TeamMatchStatus;
  matchIds: string[];
  teamAFbsAvg: number | null;
  teamBFbsAvg: number | null;
  winnerTeamId: string | null;
  lpReward: number;
  megaMeeting: Record<string, unknown> | null;
  createdAt: string;
  completedAt: string | null;
}

export interface CreateTeamInput {
  name: string;
  creatorId: string;
  tier?: string;
}

export interface TeamMatchResult {
  teamMatchId: string;
  teamAFbsAvg: number;
  teamBFbsAvg: number;
  winnerTeamId: string;
  lpReward: number;
}

// ── DB Error Helper ────────────────────────────────────────

const TABLE_UNAVAILABLE = new Set(['42P01', '42703', '23503']);
function isTableError(err: unknown): boolean {
  const errObj = err as Record<string, unknown> | null | undefined;
  const code = typeof errObj?.code === 'string' ? errObj.code : '';
  return TABLE_UNAVAILABLE.has(code) || (typeof errObj?.message === 'string' && (errObj.message as string).includes('DATABASE_URL is not set'));
}

// ── Team Errors ────────────────────────────────────────────

export class TeamError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function isTeamError(err: unknown): err is TeamError {
  return err instanceof TeamError;
}

// ── Constants ──────────────────────────────────────────────

const MAX_TEAM_SIZE = 3;
const MAX_TEAMS_PER_USER = 3;
const TEAM_WIN_LP = 15;
const TEAM_LOSS_LP = -6;

// ── Create Team ────────────────────────────────────────────

export async function createTeam(input: CreateTeamInput): Promise<Team> {
  try {
    return await withTransaction(async (client) => {
      // Check user's existing team count
      const countRes = await client.query<{ cnt: string }>(
        `SELECT count(*)::text AS cnt FROM team_members WHERE user_id = $1`,
        [input.creatorId],
      );
      if (Number(countRes.rows[0]?.cnt ?? '0') >= MAX_TEAMS_PER_USER) {
        throw new TeamError('MAX_TEAMS', 409, `Maximum ${MAX_TEAMS_PER_USER} teams per user`);
      }

      // Check name uniqueness
      const nameCheck = await client.query<{ id: string }>(
        `SELECT id FROM teams WHERE name = $1 LIMIT 1`,
        [input.name],
      );
      if (nameCheck.rows[0]) {
        throw new TeamError('NAME_TAKEN', 409, 'Team name already taken');
      }

      // Create team
      const teamRes = await client.query<{
        id: string; name: string; creator_id: string; tier: string;
        lp_pool: number; win_count: number; loss_count: number;
        is_active: boolean; created_at: string;
      }>(
        `INSERT INTO teams (name, creator_id, tier)
         VALUES ($1, $2, $3)
         RETURNING id, name, creator_id, tier, lp_pool, win_count, loss_count, is_active, created_at`,
        [input.name, input.creatorId, input.tier ?? 'DIAMOND'],
      );
      const row = teamRes.rows[0];

      // Add creator as CAPTAIN
      const memberRes = await client.query<{
        id: string; team_id: string; user_id: string; role: TeamRole; joined_at: string;
      }>(
        `INSERT INTO team_members (team_id, user_id, role)
         VALUES ($1, $2, 'CAPTAIN')
         RETURNING id, team_id, user_id, role, joined_at`,
        [row.id, input.creatorId],
      );
      const member = memberRes.rows[0];

      return {
        id: row.id,
        name: row.name,
        creatorId: row.creator_id,
        tier: row.tier,
        lpPool: Number(row.lp_pool),
        winCount: Number(row.win_count),
        lossCount: Number(row.loss_count),
        isActive: row.is_active,
        createdAt: row.created_at,
        members: [{
          id: member.id,
          teamId: member.team_id,
          userId: member.user_id,
          role: member.role,
          joinedAt: member.joined_at,
        }],
      };
    });
  } catch (err: unknown) {
    if (isTeamError(err)) throw err;
    if (isTableError(err)) {
      throw new TeamError('DB_UNAVAILABLE', 503, 'Team system unavailable');
    }
    throw err;
  }
}

// ── Get Team ───────────────────────────────────────────────

export async function getTeam(teamId: string): Promise<Team | null> {
  try {
    const teamRes = await query<{
      id: string; name: string; creator_id: string; tier: string;
      lp_pool: string; win_count: string; loss_count: string;
      is_active: boolean; created_at: string;
    }>(
      `SELECT id, name, creator_id, tier, lp_pool::text, win_count::text, loss_count::text,
              is_active, created_at
       FROM teams WHERE id = $1`,
      [teamId],
    );
    const row = teamRes.rows[0];
    if (!row) return null;

    const membersRes = await query<{
      id: string; team_id: string; user_id: string; role: TeamRole; joined_at: string;
    }>(
      `SELECT id, team_id, user_id, role, joined_at
       FROM team_members WHERE team_id = $1
       ORDER BY joined_at ASC`,
      [teamId],
    );

    return {
      id: row.id,
      name: row.name,
      creatorId: row.creator_id,
      tier: row.tier,
      lpPool: Number(row.lp_pool),
      winCount: Number(row.win_count),
      lossCount: Number(row.loss_count),
      isActive: row.is_active,
      createdAt: row.created_at,
      members: membersRes.rows.map((m: { id: string; team_id: string; user_id: string; role: TeamRole; joined_at: string }) => ({
        id: m.id,
        teamId: m.team_id,
        userId: m.user_id,
        role: m.role,
        joinedAt: m.joined_at,
      })),
    };
  } catch (err: unknown) {
    if (isTableError(err)) return null;
    throw err;
  }
}

// ── Get User's Teams ──────────────────────────────────────

export async function getUserTeams(userId: string): Promise<Team[]> {
  try {
    const res = await query<{ team_id: string }>(
      `SELECT team_id FROM team_members WHERE user_id = $1`,
      [userId],
    );

    const teams: Team[] = [];
    for (const row of res.rows) {
      const team = await getTeam(row.team_id);
      if (team) teams.push(team);
    }
    return teams;
  } catch (err: unknown) {
    if (isTableError(err)) return [];
    throw err;
  }
}

// ── Join Team ──────────────────────────────────────────────

export async function joinTeam(teamId: string, userId: string): Promise<TeamMember> {
  try {
    return await withTransaction(async (client) => {
      // Check team exists and is active
      const teamRes = await client.query<{ is_active: boolean }>(
        `SELECT is_active FROM teams WHERE id = $1 LIMIT 1 FOR UPDATE`,
        [teamId],
      );
      if (!teamRes.rows[0]) throw new TeamError('TEAM_NOT_FOUND', 404, 'Team not found');
      if (!teamRes.rows[0].is_active) throw new TeamError('TEAM_INACTIVE', 403, 'Team is inactive');

      // Check member count
      const countRes = await client.query<{ cnt: string }>(
        `SELECT count(*)::text AS cnt FROM team_members WHERE team_id = $1`,
        [teamId],
      );
      if (Number(countRes.rows[0]?.cnt ?? '0') >= MAX_TEAM_SIZE) {
        throw new TeamError('TEAM_FULL', 409, 'Team is full (max 3 members)');
      }

      // Check not already member
      const existRes = await client.query<{ id: string }>(
        `SELECT id FROM team_members WHERE team_id = $1 AND user_id = $2 LIMIT 1`,
        [teamId, userId],
      );
      if (existRes.rows[0]) {
        throw new TeamError('ALREADY_MEMBER', 409, 'Already a member of this team');
      }

      // Check user's team limit
      const userTeamCount = await client.query<{ cnt: string }>(
        `SELECT count(*)::text AS cnt FROM team_members WHERE user_id = $1`,
        [userId],
      );
      if (Number(userTeamCount.rows[0]?.cnt ?? '0') >= MAX_TEAMS_PER_USER) {
        throw new TeamError('MAX_TEAMS', 409, `Maximum ${MAX_TEAMS_PER_USER} teams per user`);
      }

      // Determine role (2nd = SUPPORT_A, 3rd = SUPPORT_B)
      const currentCount = Number(countRes.rows[0]?.cnt ?? '0');
      const role: TeamRole = currentCount === 1 ? 'SUPPORT_A' : 'SUPPORT_B';

      const res = await client.query<{
        id: string; team_id: string; user_id: string; role: TeamRole; joined_at: string;
      }>(
        `INSERT INTO team_members (team_id, user_id, role)
         VALUES ($1, $2, $3)
         RETURNING id, team_id, user_id, role, joined_at`,
        [teamId, userId, role],
      );

      return {
        id: res.rows[0].id,
        teamId: res.rows[0].team_id,
        userId: res.rows[0].user_id,
        role: res.rows[0].role,
        joinedAt: res.rows[0].joined_at,
      };
    });
  } catch (err: unknown) {
    if (isTeamError(err)) throw err;
    if (isTableError(err)) throw new TeamError('DB_UNAVAILABLE', 503, 'Team system unavailable');
    throw err;
  }
}

// ── Leave Team ─────────────────────────────────────────────

export async function leaveTeam(teamId: string, userId: string): Promise<boolean> {
  try {
    return await withTransaction(async (client) => {
      // Check if captain — captain can't leave (must disband)
      const memberRes = await client.query<{ role: TeamRole }>(
        `SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2 LIMIT 1`,
        [teamId, userId],
      );
      if (!memberRes.rows[0]) throw new TeamError('NOT_MEMBER', 404, 'Not a member of this team');
      if (memberRes.rows[0].role === 'CAPTAIN') {
        throw new TeamError('CAPTAIN_LEAVE', 403, 'Captain cannot leave — disband the team instead');
      }

      await client.query(
        `DELETE FROM team_members WHERE team_id = $1 AND user_id = $2`,
        [teamId, userId],
      );
      return true;
    });
  } catch (err: unknown) {
    if (isTeamError(err)) throw err;
    if (isTableError(err)) return false;
    throw err;
  }
}

// ── Disband Team ──────────────────────────────────────────

export async function disbandTeam(teamId: string, captainId: string): Promise<boolean> {
  try {
    return await withTransaction(async (client) => {
      const memberRes = await client.query<{ role: TeamRole }>(
        `SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2 LIMIT 1`,
        [teamId, captainId],
      );
      if (!memberRes.rows[0]) throw new TeamError('NOT_MEMBER', 404, 'Not a member of this team');
      if (memberRes.rows[0].role !== 'CAPTAIN') {
        throw new TeamError('NOT_CAPTAIN', 403, 'Only captain can disband the team');
      }

      // Check no in-progress matches
      const activeRes = await client.query<{ cnt: string }>(
        `SELECT count(*)::text AS cnt FROM team_matches
         WHERE (team_a_id = $1 OR team_b_id = $1)
         AND status IN ('FORMING', 'READY', 'IN_PROGRESS')`,
        [teamId],
      );
      if (Number(activeRes.rows[0]?.cnt ?? '0') > 0) {
        throw new TeamError('ACTIVE_MATCH', 409, 'Cannot disband while matches are in progress');
      }

      await client.query(`UPDATE teams SET is_active = false WHERE id = $1`, [teamId]);
      await client.query(`DELETE FROM team_members WHERE team_id = $1`, [teamId]);
      return true;
    });
  } catch (err: unknown) {
    if (isTeamError(err)) throw err;
    if (isTableError(err)) return false;
    throw err;
  }
}

// ── Create Team Match ─────────────────────────────────────

export async function createTeamMatch(teamId: string, pair: string): Promise<TeamMatch> {
  try {
    return await withTransaction(async (client) => {
      // Verify team is full (3 members)
      const countRes = await client.query<{ cnt: string }>(
        `SELECT count(*)::text AS cnt FROM team_members WHERE team_id = $1`,
        [teamId],
      );
      if (Number(countRes.rows[0]?.cnt ?? '0') < MAX_TEAM_SIZE) {
        throw new TeamError('TEAM_INCOMPLETE', 400, `Team must have ${MAX_TEAM_SIZE} members to start a match`);
      }

      // Create team match (FORMING state, waiting for opponent)
      const res = await client.query<{
        id: string; team_a_id: string; team_b_id: string | null;
        pair: string; status: TeamMatchStatus; match_ids: string[];
        team_a_fbs_avg: string | null; team_b_fbs_avg: string | null;
        winner_team_id: string | null; lp_reward: number;
        mega_meeting: Record<string, unknown> | null;
        created_at: string; completed_at: string | null;
      }>(
        `INSERT INTO team_matches (team_a_id, pair, status)
         VALUES ($1, $2, 'FORMING')
         RETURNING *`,
        [teamId, pair],
      );

      const row = res.rows[0];

      // Try instant matching: find another FORMING team match for same pair
      const matchCandidate = await client.query<{ id: string; team_a_id: string }>(
        `SELECT id, team_a_id FROM team_matches
         WHERE pair = $1 AND status = 'FORMING' AND team_a_id != $2 AND team_b_id IS NULL
         ORDER BY created_at ASC LIMIT 1
         FOR UPDATE SKIP LOCKED`,
        [pair, teamId],
      );

      if (matchCandidate.rows[0]) {
        // Match found — update both team matches
        const opponentMatchId = matchCandidate.rows[0].id;
        const opponentTeamId = matchCandidate.rows[0].team_a_id;

        // Update opponent match: set team_b and status READY
        await client.query(
          `UPDATE team_matches SET team_b_id = $1, status = 'READY'
           WHERE id = $2`,
          [teamId, opponentMatchId],
        );

        // Update our match: set team_b and status READY
        await client.query(
          `UPDATE team_matches SET team_b_id = $1, status = 'READY'
           WHERE id = $2`,
          [opponentTeamId, row.id],
        );

        return {
          id: row.id,
          teamAId: row.team_a_id,
          teamBId: opponentTeamId,
          pair: row.pair,
          status: 'READY' as TeamMatchStatus,
          matchIds: [],
          teamAFbsAvg: null,
          teamBFbsAvg: null,
          winnerTeamId: null,
          lpReward: 0,
          megaMeeting: null,
          createdAt: row.created_at,
          completedAt: null,
        };
      }

      return {
        id: row.id,
        teamAId: row.team_a_id,
        teamBId: null,
        pair: row.pair,
        status: 'FORMING' as TeamMatchStatus,
        matchIds: [],
        teamAFbsAvg: null,
        teamBFbsAvg: null,
        winnerTeamId: null,
        lpReward: 0,
        megaMeeting: null,
        createdAt: row.created_at,
        completedAt: null,
      };
    });
  } catch (err: unknown) {
    if (isTeamError(err)) throw err;
    if (isTableError(err)) throw new TeamError('DB_UNAVAILABLE', 503, 'Team system unavailable');
    throw err;
  }
}

// ── Get Team Match ────────────────────────────────────────

export async function getTeamMatch(teamMatchId: string): Promise<TeamMatch | null> {
  try {
    const res = await query<any>(
      `SELECT * FROM team_matches WHERE id = $1`,
      [teamMatchId],
    );
    const row = res.rows[0];
    if (!row) return null;

    return {
      id: row.id,
      teamAId: row.team_a_id,
      teamBId: row.team_b_id,
      pair: row.pair,
      status: row.status,
      matchIds: row.match_ids ?? [],
      teamAFbsAvg: row.team_a_fbs_avg ? Number(row.team_a_fbs_avg) : null,
      teamBFbsAvg: row.team_b_fbs_avg ? Number(row.team_b_fbs_avg) : null,
      winnerTeamId: row.winner_team_id,
      lpReward: Number(row.lp_reward),
      megaMeeting: row.mega_meeting,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    };
  } catch (err: unknown) {
    if (isTableError(err)) return null;
    throw err;
  }
}

// ── Resolve Team Match ────────────────────────────────────

export async function resolveTeamMatch(
  teamMatchId: string,
  memberScores: { teamId: string; userId: string; fbs: number }[],
): Promise<TeamMatchResult> {
  try {
    return await withTransaction(async (client) => {
      const matchRes = await client.query<any>(
        `SELECT * FROM team_matches WHERE id = $1 FOR UPDATE`,
        [teamMatchId],
      );
      const match = matchRes.rows[0];
      if (!match) throw new TeamError('MATCH_NOT_FOUND', 404, 'Team match not found');
      if (match.status === 'COMPLETED') {
        throw new TeamError('ALREADY_RESOLVED', 409, 'Team match already resolved');
      }

      const teamAId = match.team_a_id;
      const teamBId = match.team_b_id;

      // Calculate average FBS per team
      const teamAScores = memberScores.filter((s) => s.teamId === teamAId);
      const teamBScores = memberScores.filter((s) => s.teamId === teamBId);

      const teamAAvg = teamAScores.length > 0
        ? teamAScores.reduce((sum, s) => sum + s.fbs, 0) / teamAScores.length
        : 0;
      const teamBAvg = teamBScores.length > 0
        ? teamBScores.reduce((sum, s) => sum + s.fbs, 0) / teamBScores.length
        : 0;

      const winnerTeamId = teamAAvg >= teamBAvg ? teamAId : teamBId;
      const loserTeamId = winnerTeamId === teamAId ? teamBId : teamAId;
      const lpReward = TEAM_WIN_LP;

      // Update team match
      await client.query(
        `UPDATE team_matches
         SET team_a_fbs_avg = $1, team_b_fbs_avg = $2,
             winner_team_id = $3, lp_reward = $4,
             status = 'COMPLETED', completed_at = now()
         WHERE id = $5`,
        [teamAAvg, teamBAvg, winnerTeamId, lpReward, teamMatchId],
      );

      // Update team win/loss counts
      await client.query(
        `UPDATE teams SET win_count = win_count + 1, lp_pool = lp_pool + $1 WHERE id = $2`,
        [lpReward, winnerTeamId],
      );
      if (loserTeamId) {
        await client.query(
          `UPDATE teams SET loss_count = loss_count + 1, lp_pool = lp_pool + $1 WHERE id = $2`,
          [TEAM_LOSS_LP, loserTeamId],
        );
      }

      return {
        teamMatchId,
        teamAFbsAvg: Math.round(teamAAvg * 100) / 100,
        teamBFbsAvg: Math.round(teamBAvg * 100) / 100,
        winnerTeamId,
        lpReward,
      };
    });
  } catch (err: unknown) {
    if (isTeamError(err)) throw err;
    if (isTableError(err)) throw new TeamError('DB_UNAVAILABLE', 503, 'Team system unavailable');
    throw err;
  }
}

// ── List Active Team Matches ─────────────────────────────

export async function listActiveTeamMatches(teamId: string): Promise<TeamMatch[]> {
  try {
    const res = await query<any>(
      `SELECT * FROM team_matches
       WHERE (team_a_id = $1 OR team_b_id = $1)
       AND status != 'COMPLETED' AND status != 'CANCELLED'
       ORDER BY created_at DESC`,
      [teamId],
    );

    return res.rows.map((row: any) => ({
      id: row.id,
      teamAId: row.team_a_id,
      teamBId: row.team_b_id,
      pair: row.pair,
      status: row.status as TeamMatchStatus,
      matchIds: row.match_ids ?? [],
      teamAFbsAvg: row.team_a_fbs_avg ? Number(row.team_a_fbs_avg) : null,
      teamBFbsAvg: row.team_b_fbs_avg ? Number(row.team_b_fbs_avg) : null,
      winnerTeamId: row.winner_team_id,
      lpReward: Number(row.lp_reward),
      megaMeeting: row.mega_meeting,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    }));
  } catch (err: unknown) {
    if (isTableError(err)) return [];
    throw err;
  }
}
