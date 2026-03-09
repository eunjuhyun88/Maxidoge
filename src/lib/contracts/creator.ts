// ═══════════════════════════════════════════════════════════════
// STOCKCLAW — Creator Profile Contracts
// ═══════════════════════════════════════════════════════════════

import type { ProfileBadge } from './profile';
import type { CommunityPost } from './community';

export interface CreatorProfile {
  id: string;
  nickname: string;
  avatar: string | null;
  avatarColor: string;
  tier: string;
  joinedAt: number | null;
  stats: CreatorStats;
  recentSignals: CommunityPost[];
}

export interface CreatorStats {
  displayTier: string;
  totalMatches: number;
  wins: number;
  losses: number;
  winRate: number;
  streak: number;
  bestStreak: number;
  totalPnl: number;
  totalLp: number;
  badges: ProfileBadge[];
  signalCount: number;
}
