export const STORAGE_KEYS = {
  gameState: 'stockclaw_state',
  agents: 'stockclaw_agents',
  wallet: 'stockclaw_wallet',
  matchHistory: 'stockclaw_match_history',
  quickTrades: 'stockclaw_quicktrades',
  trackedSignals: 'stockclaw_tracked',
  predictPositions: 'stockclaw_predict_positions',
  community: 'stockclaw_community',
  profile: 'stockclaw_profile',
  pnl: 'stockclaw_pnl',
  dbUsers: 'stockclaw_users',
  dbMatches: 'stockclaw_matches',
  dbSignals: 'stockclaw_signals',
  dbPredictions: 'stockclaw_predictions',
} as const;

export const RESETTABLE_STORAGE_KEYS: ReadonlyArray<string> = Object.values(STORAGE_KEYS);
