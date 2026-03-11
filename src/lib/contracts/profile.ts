export interface ProfileBadge {
  id: string;
  name?: string;
  icon?: string;
  description?: string;
  condition?: string;
  earnedAt?: number | null;
}

export interface ProfileStats {
  displayTier: string;
  totalMatches: number;
  wins: number;
  losses: number;
  streak: number;
  bestStreak: number;
  totalLp: number;
  totalPnl: number;
  trackedSignals?: number;
  badges: ProfileBadge[];
  updatedAt: number | null;
}

export interface ProfileProjection {
  id: string;
  email: string | null;
  nickname: string | null;
  walletAddress: string | null;
  tier: string;
  phase: number;
  avatar: string | null;
  createdAt: number | null;
  updatedAt: number | null;
  stats: ProfileStats;
}

export interface PassportAgentSummary {
  totalAgents: number;
  avgLevel: number;
}

export interface PassportProjection {
  tier: string;
  totalMatches: number;
  wins: number;
  losses: number;
  streak: number;
  bestStreak: number;
  totalLp: number;
  totalPnl: number;
  badges: ProfileBadge[];
  openTrades: number;
  trackedSignals: number;
  winRate: number;
  agentSummary: PassportAgentSummary;
}

export interface UpdateProfileRequest {
  nickname?: string;
  avatar?: string;
}

export interface UpdateProfileData {
  updated: boolean;
}
