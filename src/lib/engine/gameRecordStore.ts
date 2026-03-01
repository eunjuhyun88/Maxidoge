// ═══════════════════════════════════════════════════════════════
// STOCKCLAW — GameRecord Persistence (Server API)
// ═══════════════════════════════════════════════════════════════
//
// GameRecord를 서버 API(/api/arena-war)를 통해 저장/조회
// DB: PostgreSQL (arena_war_records 테이블)

import type { GameRecord } from './arenaWarTypes';

// ─── API Calls ──────────────────────────────────────────────

/** GameRecord를 서버에 저장 */
export async function saveGameRecord(record: GameRecord): Promise<{ success: boolean; warning?: string }> {
  try {
    const res = await fetch('/api/arena-war', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameRecord: record }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.warn('[GameRecordStore] Server save failed:', data.error);
      return { success: false };
    }

    return { success: true, warning: data.warning };
  } catch (e) {
    console.warn('[GameRecordStore] Network error:', e);
    return { success: false };
  }
}

/** 서버에서 통계 포함 기록 목록 조회 */
export interface GameRecordSummary {
  id: string;
  pair: string;
  timeframe: string;
  regime: string;
  humanDirection: string;
  aiDirection: string;
  winner: string;
  humanFbs: number;
  aiFbs: number;
  fbsMargin: number;
  consensusType: string;
  pairQuality: string;
  reasonTags: string[];
  fullRecord?: GameRecord;
  createdAt: string;
}

export interface GameStats {
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  avgFBS: number;
  avgAiFBS: number;
  dissentWins: number;
  strongPairs: number;
  mediumPairs: number;
}

export interface FetchRecordsResult {
  records: GameRecordSummary[];
  stats: GameStats;
}

const EMPTY_STATS: GameStats = {
  totalGames: 0,
  wins: 0, losses: 0, draws: 0,
  winRate: 0, avgFBS: 0, avgAiFBS: 0,
  dissentWins: 0, strongPairs: 0, mediumPairs: 0,
};

/** 기록 목록 + 통계 조회 */
export async function fetchGameRecords(
  opts: { limit?: number; offset?: number; full?: boolean } = {}
): Promise<FetchRecordsResult> {
  try {
    const params = new URLSearchParams();
    if (opts.limit) params.set('limit', String(opts.limit));
    if (opts.offset) params.set('offset', String(opts.offset));
    if (opts.full) params.set('full', 'true');

    const res = await fetch(`/api/arena-war?${params.toString()}`);
    const data = await res.json();

    if (!res.ok || !data.success) {
      console.warn('[GameRecordStore] Fetch failed:', data.error);
      return { records: [], stats: EMPTY_STATS };
    }

    return {
      records: data.records ?? [],
      stats: data.stats ?? EMPTY_STATS,
    };
  } catch (e) {
    console.warn('[GameRecordStore] Network error:', e);
    return { records: [], stats: EMPTY_STATS };
  }
}
