// ═══════════════════════════════════════════════════════════════
// STOCKCLAW — Arena API Client (browser-side)
// ═══════════════════════════════════════════════════════════════
//
// Wraps /api/arena/* endpoints for the Arena page to call.
// All functions return typed results or throw on error.

import type {
  Direction,
  DraftSelection,
  MatchPrediction,
  MatchState,
  MatchResult,
  MatchPhase,
  AgentOutput,
  ExitRecommendation,
  MarketRegime,
  DecisionAction,
  DecisionWindow,
  EmergencyMeetingData,
  MatchMemory,
  ArenaSignal,
  Challenge,
  PvPPoolEntry,
  LiveSession,
  LiveReaction,
  SSEEvent,
  UserFollowStats,
  Tier,
  MemorySearchMode,
  TeamInfo,
  TeamMemberInfo,
  TeamMatchSummary,
} from '$lib/engine/types';

// ─── Response Types ─────────────────────────────────────────

export interface CreateMatchResponse {
  success: boolean;
  matchId: string;
  state: Partial<MatchState>;
}

export interface ListMatchesResponse {
  success: boolean;
  total: number;
  records: Partial<MatchState>[];
  pagination: { limit: number; offset: number };
}

export interface SubmitDraftResponse {
  success: boolean;
  phase: string;
  errors?: string[];
}

export interface AnalyzeResponse {
  success: boolean;
  agentOutputs: Pick<AgentOutput, 'agentId' | 'specId' | 'direction' | 'confidence' | 'thesis' | 'bullScore' | 'bearScore'>[];
  prediction: MatchPrediction;
  exitRecommendation: ExitRecommendation;
  entryPrice: number;
  regime: MarketRegime;
  meta: {
    totalLatencyMs: number;
    factorsComputed: number;
    factorsAvailable: number;
    dataCompleteness: number;
  };
}

export interface SubmitHypothesisResponse {
  success: boolean;
  prediction: MatchPrediction;
  phase: string;
}

export interface ResolveResponse {
  success: boolean;
  result: MatchResult;
  priceChange: string;
}

export type TournamentType = 'DAILY_SPRINT' | 'WEEKLY_CUP' | 'SEASON_CHAMPIONSHIP';
export type TournamentStatus = 'REG_OPEN' | 'REG_CLOSED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface TournamentActiveRecord {
  tournamentId: string;
  type: TournamentType;
  pair: string;
  status: TournamentStatus;
  maxPlayers: number;
  registeredPlayers: number;
  entryFeeLp: number;
  startAt: string;
}

export interface ListActiveTournamentsResponse {
  success: boolean;
  records: TournamentActiveRecord[];
}

export interface RegisterTournamentResponse {
  success: boolean;
  tournamentId: string;
  registered: boolean;
  seed: number;
  lpDelta: number;
}

export interface TournamentBracketMatch {
  matchIndex: number;
  userA: { userId: string; nickname: string } | null;
  userB: { userId: string; nickname: string } | null;
  winnerId: string | null;
  matchId: string | null;
}

export interface TournamentBracketResponse {
  success: boolean;
  tournamentId: string;
  round: number;
  matches: TournamentBracketMatch[];
}

// ─── Helper ─────────────────────────────────────────────────

async function apiCall<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    signal: options?.signal ?? AbortSignal.timeout(10_000),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || data.errors?.join(', ') || `API error ${res.status}`);
  }
  return data as T;
}

// ─── Arena API Functions ────────────────────────────────────

/** Create a new arena match */
export async function createArenaMatch(
  pair = 'BTC/USDT',
  timeframe = '4h',
): Promise<CreateMatchResponse> {
  return apiCall<CreateMatchResponse>('/api/arena/match', {
    method: 'POST',
    body: JSON.stringify({ pair, timeframe }),
  });
}

/** List user's arena matches */
export async function listArenaMatches(
  limit = 20,
  offset = 0,
): Promise<ListMatchesResponse> {
  return apiCall<ListMatchesResponse>(`/api/arena/match?limit=${limit}&offset=${offset}`);
}

/** Get a single match by ID */
export async function getArenaMatch(matchId: string): Promise<{ success: boolean; match: Partial<MatchState> }> {
  return apiCall(`/api/arena/match/${matchId}`);
}

/** Submit agent draft for a match */
export async function submitArenaDraft(
  matchId: string,
  draft: DraftSelection[],
): Promise<SubmitDraftResponse> {
  return apiCall<SubmitDraftResponse>('/api/arena/draft', {
    method: 'POST',
    body: JSON.stringify({ matchId, draft }),
  });
}

/** Run analysis pipeline (agents + exitOptimizer) */
export async function runArenaAnalysis(matchId: string): Promise<AnalyzeResponse> {
  return apiCall<AnalyzeResponse>('/api/arena/analyze', {
    method: 'POST',
    body: JSON.stringify({ matchId }),
  });
}

/** Submit user hypothesis (direction + confidence) */
export async function submitArenaHypothesis(
  matchId: string,
  direction: Direction,
  confidence: number,
  exitStrategy: 'conservative' | 'balanced' | 'aggressive' = 'balanced',
): Promise<SubmitHypothesisResponse> {
  return apiCall<SubmitHypothesisResponse>('/api/arena/hypothesis', {
    method: 'POST',
    body: JSON.stringify({ matchId, direction, confidence, exitStrategy }),
  });
}

/** Resolve match with exit price */
export async function resolveArenaMatch(
  matchId: string,
  exitPrice: number,
): Promise<ResolveResponse> {
  return apiCall<ResolveResponse>('/api/arena/resolve', {
    method: 'POST',
    body: JSON.stringify({ matchId, exitPrice }),
  });
}

/** List active tournaments (lobby widget) */
export async function listActiveTournaments(
  limit = 20,
): Promise<ListActiveTournamentsResponse> {
  return apiCall<ListActiveTournamentsResponse>(`/api/tournaments/active?limit=${limit}`);
}

/** Register current user for a tournament */
export async function registerTournament(
  tournamentId: string,
): Promise<RegisterTournamentResponse> {
  return apiCall<RegisterTournamentResponse>(`/api/tournaments/${tournamentId}/register`, {
    method: 'POST',
  });
}

/** Fetch bracket for tournament */
export async function getTournamentBracket(
  tournamentId: string,
): Promise<TournamentBracketResponse> {
  return apiCall<TournamentBracketResponse>(`/api/tournaments/${tournamentId}/bracket`);
}

// ═══════════════════════════════════════════════════════════════
// Phase 2+3: New API Endpoints
// ═══════════════════════════════════════════════════════════════

// ─── Response Types (Phase 2+3) ─────────────────────────────

export interface PhaseTransitionResponse {
  success: boolean;
  phase: string;
  expiresAt?: string;
  metadata: Record<string, unknown>;
}

export interface SubmitDecisionResponse {
  success: boolean;
  window: DecisionWindow;
  remainingWindows: number;
}

export interface EmergencyMeetingResponse {
  success: boolean;
  cached: boolean;
  emergencyMeeting: EmergencyMeetingData;
}

export interface StoreMemoryResponse {
  success: boolean;
  stored: number;
}

export interface SearchMemoriesResponse {
  success: boolean;
  memories: MatchMemory[];
  total: number;
  searchMode: MemorySearchMode;
  agentStats: Record<string, unknown> | null;
}

export interface PublishSignalResponse {
  success: boolean;
  signalId: string;
}

export interface CreateChallengeResponse {
  success: boolean;
  challengeId: string;
  agentId: string;
  pair: string;
  userDirection: string;
  agentDirection: string;
}

export interface ListChallengesResponse {
  success: boolean;
  total: number;
  records: Challenge[];
  pagination: { limit: number; offset: number };
}

export interface JoinPvPQueueResponse {
  success: boolean;
  matched: boolean;
  poolEntryId?: string;
  matchId?: string;
  status: string;
}

export interface PvPQueueStatusResponse {
  success: boolean;
  entries: PvPPoolEntry[];
}

export interface LeavePvPQueueResponse {
  success: boolean;
  cancelled: boolean;
}

export interface CreateLiveSessionResponse {
  success: boolean;
  sessionId: string;
  matchId: string;
  pair: string;
}

export interface ListLiveSessionsResponse {
  success: boolean;
  sessions: LiveSession[];
  total: number;
}

export interface SendReactionResponse {
  success: boolean;
}

export interface FollowResponse {
  success: boolean;
  following: boolean;
  targetUserId: string;
}

export interface SocialFeedResponse {
  success: boolean;
  signals: ArenaSignal[];
  total: number;
}

export interface SocialProfileResponse {
  success: boolean;
  userId: string;
  displayName: string;
  tier: string;
  tierLevel: number;
  winRate: number;
  lpTotal: number;
  totalMatches: number;
  followStats: UserFollowStats;
  recentSignals: ArenaSignal[];
}

export interface TeamListResponse {
  success: boolean;
  teams: TeamInfo[];
}

export interface TeamActionResponse {
  success: boolean;
  team?: TeamInfo;
  member?: TeamMemberInfo;
  left?: boolean;
}

export interface TeamDisbandResponse {
  success: boolean;
  disbanded: boolean;
}

export interface TeamMatchListResponse {
  success: boolean;
  matches: TeamMatchSummary[];
}

export interface TeamMatchCreateResponse {
  success: boolean;
  match: TeamMatchSummary;
}

export interface TeamMatchDetailResponse {
  success: boolean;
  match: TeamMatchSummary;
}

// ─── Phase Transitions ──────────────────────────────────────

/** Advance match to a target phase (server-authoritative) */
export async function advanceMatchPhase(
  matchId: string,
  targetPhase: MatchPhase,
): Promise<PhaseTransitionResponse> {
  return apiCall<PhaseTransitionResponse>(`/api/arena/match/${matchId}/phase`, {
    method: 'POST',
    body: JSON.stringify({ targetPhase }),
  });
}

// ─── Decision Windows ───────────────────────────────────────

/** Submit BUY/SELL/HOLD for a decision window during BATTLE */
export async function submitDecision(
  matchId: string,
  windowN: number,
  action: DecisionAction,
  priceAt: number,
): Promise<SubmitDecisionResponse> {
  return apiCall<SubmitDecisionResponse>(`/api/arena/match/${matchId}/decision`, {
    method: 'POST',
    body: JSON.stringify({ windowN, action, priceAt }),
  });
}

// ─── Emergency Meeting ──────────────────────────────────────

/** Trigger LLM agent debate (Among Us-style) */
export async function triggerEmergencyMeeting(
  matchId: string,
): Promise<EmergencyMeetingResponse> {
  return apiCall<EmergencyMeetingResponse>(`/api/arena/match/${matchId}/emergency-meeting`, {
    method: 'POST',
    signal: AbortSignal.timeout(20_000),
  });
}

// ─── Memory ─────────────────────────────────────────────────

/** Store RAG memories for a resolved match */
export async function storeMatchMemory(
  matchId: string,
  lesson?: string,
): Promise<StoreMemoryResponse> {
  return apiCall<StoreMemoryResponse>(`/api/arena/match/${matchId}/memory`, {
    method: 'POST',
    body: JSON.stringify({ lesson }),
  });
}

/** Search RAG memories with 4-way search modes */
export async function searchMemories(params: {
  q?: string;
  mode?: MemorySearchMode;
  agentId?: string;
  pair?: string;
  outcome?: 'win' | 'loss';
  limit?: number;
}): Promise<SearchMemoriesResponse> {
  const sp = new URLSearchParams();
  if (params.q) sp.set('q', params.q);
  if (params.mode) sp.set('mode', params.mode);
  if (params.agentId) sp.set('agentId', params.agentId);
  if (params.pair) sp.set('pair', params.pair);
  if (params.outcome) sp.set('outcome', params.outcome);
  if (params.limit) sp.set('limit', String(params.limit));
  return apiCall<SearchMemoriesResponse>(`/api/arena/memories?${sp.toString()}`);
}

// ─── Publish Signal ─────────────────────────────────────────

/** Publish match result as arena signal to community */
export async function publishMatchSignal(
  matchId: string,
): Promise<PublishSignalResponse> {
  return apiCall<PublishSignalResponse>(`/api/arena/match/${matchId}/publish`, {
    method: 'POST',
  });
}

// ─── Challenge ──────────────────────────────────────────────

/** Challenge an agent (disagree with its call) */
export async function createChallenge(params: {
  agentId: string;
  specId: string;
  pair: string;
  userDirection: Direction;
  agentDirection: Direction;
  reasonTags?: string[];
  reasonText?: string;
  matchId?: string;
}): Promise<CreateChallengeResponse> {
  return apiCall<CreateChallengeResponse>('/api/arena/challenge', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/** List user's challenges */
export async function listChallenges(
  limit = 20,
  offset = 0,
): Promise<ListChallengesResponse> {
  return apiCall<ListChallengesResponse>(`/api/arena/challenge?limit=${limit}&offset=${offset}`);
}

// ─── PvP Queue ──────────────────────────────────────────────

/** Join PvP matchmaking queue */
export async function joinPvPQueue(params: {
  pair: string;
  timeframe: string;
  tier: Tier;
  draft: DraftSelection[];
}): Promise<JoinPvPQueueResponse> {
  return apiCall<JoinPvPQueueResponse>('/api/arena/pvp/queue', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/** Get current PvP queue status */
export async function getPvPQueueStatus(): Promise<PvPQueueStatusResponse> {
  return apiCall<PvPQueueStatusResponse>('/api/arena/pvp/queue');
}

/** Leave PvP queue */
export async function leavePvPQueue(
  poolEntryId: string,
): Promise<LeavePvPQueueResponse> {
  return apiCall<LeavePvPQueueResponse>('/api/arena/pvp/queue', {
    method: 'DELETE',
    body: JSON.stringify({ poolEntryId }),
  });
}

// ─── Live Sessions ──────────────────────────────────────────

/** Create a LIVE spectator session (Diamond+ tier) */
export async function createLiveSession(
  matchId: string,
): Promise<CreateLiveSessionResponse> {
  return apiCall<CreateLiveSessionResponse>('/api/arena/live/session', {
    method: 'POST',
    body: JSON.stringify({ matchId }),
  });
}

/** List active LIVE sessions */
export async function listLiveSessions(
  limit = 20,
): Promise<ListLiveSessionsResponse> {
  return apiCall<ListLiveSessionsResponse>(`/api/arena/live/sessions?limit=${limit}`);
}

/** Connect to SSE stream (returns EventSource — NOT apiCall) */
export function connectLiveStream(sessionId: string): EventSource {
  return new EventSource(`/api/arena/live/stream/${sessionId}`);
}

/** Send danmaku reaction to a LIVE session */
export async function sendLiveReaction(
  sessionId: string,
  reaction: LiveReaction,
): Promise<SendReactionResponse> {
  return apiCall<SendReactionResponse>('/api/arena/live/react', {
    method: 'POST',
    body: JSON.stringify({ sessionId, reaction }),
  });
}

// ─── Social ─────────────────────────────────────────────────

/** Follow a user */
export async function followUser(
  userId: string,
): Promise<FollowResponse> {
  return apiCall<FollowResponse>('/api/social/follow', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

/** Unfollow a user */
export async function unfollowUser(
  userId: string,
): Promise<FollowResponse> {
  return apiCall<FollowResponse>('/api/social/follow', {
    method: 'DELETE',
    body: JSON.stringify({ userId }),
  });
}

/** Get social feed (signals from followed users) */
export async function getSocialFeed(
  limit = 20,
  offset = 0,
  pair?: string,
): Promise<SocialFeedResponse> {
  const sp = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (pair) sp.set('pair', pair);
  return apiCall<SocialFeedResponse>(`/api/social/feed?${sp.toString()}`);
}

/** Get public profile */
export async function getSocialProfile(
  userId: string,
): Promise<SocialProfileResponse> {
  return apiCall<SocialProfileResponse>(`/api/social/profile/${userId}`);
}

// ─── Tournament (Phase 3 path) ──────────────────────────────

/** List tournaments via Phase 3 endpoint */
export async function listTournamentsP3(
  limit = 20,
): Promise<{ success: boolean; tournaments: TournamentActiveRecord[] }> {
  return apiCall(`/api/arena/tournament?limit=${limit}`);
}

/** Register for tournament via Phase 3 endpoint */
export async function registerTournamentP3(
  tournamentId: string,
): Promise<RegisterTournamentResponse> {
  return apiCall<RegisterTournamentResponse>('/api/arena/tournament', {
    method: 'POST',
    body: JSON.stringify({ tournamentId }),
  });
}

/** Get bracket via Phase 3 endpoint */
export async function getTournamentBracketP3(
  tournamentId: string,
): Promise<TournamentBracketResponse> {
  return apiCall<TournamentBracketResponse>(`/api/arena/tournament/${tournamentId}/bracket`);
}

// ─── Team ───────────────────────────────────────────────────

/** Get user's teams */
export async function getUserTeams(): Promise<TeamListResponse> {
  return apiCall<TeamListResponse>('/api/arena/team');
}

/** Create a team */
export async function createTeam(
  name: string,
): Promise<TeamActionResponse> {
  return apiCall<TeamActionResponse>('/api/arena/team', {
    method: 'POST',
    body: JSON.stringify({ action: 'create', name }),
  });
}

/** Join a team */
export async function joinTeam(
  teamId: string,
): Promise<TeamActionResponse> {
  return apiCall<TeamActionResponse>('/api/arena/team', {
    method: 'POST',
    body: JSON.stringify({ action: 'join', teamId }),
  });
}

/** Leave a team */
export async function leaveTeam(
  teamId: string,
): Promise<TeamActionResponse> {
  return apiCall<TeamActionResponse>('/api/arena/team', {
    method: 'POST',
    body: JSON.stringify({ action: 'leave', teamId }),
  });
}

/** Disband a team (captain only) */
export async function disbandTeam(
  teamId: string,
): Promise<TeamDisbandResponse> {
  return apiCall<TeamDisbandResponse>('/api/arena/team', {
    method: 'DELETE',
    body: JSON.stringify({ teamId }),
  });
}

/** List active team matches */
export async function listTeamMatches(
  teamId: string,
): Promise<TeamMatchListResponse> {
  return apiCall<TeamMatchListResponse>(`/api/arena/team/match?teamId=${teamId}`);
}

/** Create a team match (queue for opponent) */
export async function createTeamMatch(
  teamId: string,
  pair: string,
): Promise<TeamMatchCreateResponse> {
  return apiCall<TeamMatchCreateResponse>('/api/arena/team/match', {
    method: 'POST',
    body: JSON.stringify({ teamId, pair }),
  });
}

/** Get team match detail */
export async function getTeamMatchDetail(
  teamMatchId: string,
): Promise<TeamMatchDetailResponse> {
  return apiCall<TeamMatchDetailResponse>(`/api/arena/team/match/${teamMatchId}`);
}
