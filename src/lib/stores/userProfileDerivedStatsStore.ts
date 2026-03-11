import { writable } from 'svelte/store';
import { matchHistoryStore } from './matchHistoryStore';

export interface UserProfileDerivedStats {
  directionAccuracy: number;
  avgConfidence: number;
  agentWins: number;
}

function createDefaultDerivedStats(): UserProfileDerivedStats {
  return {
    directionAccuracy: 0,
    avgConfidence: 0,
    agentWins: 0,
  };
}

export const userProfileDerivedStatsStore = writable<UserProfileDerivedStats>(createDefaultDerivedStats());

matchHistoryStore.subscribe((history) => {
  const records = history.records;
  const withHypothesis = records.filter((record) => record.hypothesis);
  const directionAccuracy = withHypothesis.length > 0
    ? Math.round((withHypothesis.filter((record) => record.win).length / withHypothesis.length) * 100)
    : 0;
  const avgConfidence = withHypothesis.length > 0
    ? Math.round(withHypothesis.reduce((sum, record) => sum + (record.hypothesis?.conf || 0), 0) / withHypothesis.length)
    : 0;

  let agentWins = 0;
  for (const record of records) {
    if (!record.agentVotes) continue;
    for (const vote of record.agentVotes) {
      if ((vote.dir === 'LONG' && record.win) || (vote.dir === 'SHORT' && !record.win)) agentWins++;
    }
  }

  userProfileDerivedStatsStore.set({
    directionAccuracy,
    avgConfidence,
    agentWins,
  });
});
