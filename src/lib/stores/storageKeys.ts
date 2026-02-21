export const STORAGE_KEYS = {
  gameState: 'maxidoge_state',
  agents: 'maxidoge_agents',
  wallet: 'maxidoge_wallet',
  matchHistory: 'maxidoge_match_history',
  quickTrades: 'maxidoge_quicktrades',
  trackedSignals: 'maxidoge_tracked',
  predictPositions: 'maxidoge_predict_positions',
  community: 'maxidoge_community',
  profile: 'maxidoge_profile',
  pnl: 'maxidoge_pnl',
  dbUsers: 'maxidoge_users',
  dbMatches: 'maxidoge_matches',
  dbSignals: 'maxidoge_signals',
  dbPredictions: 'maxidoge_predictions',
} as const;

export const RESETTABLE_STORAGE_KEYS: ReadonlyArray<string> = Object.values(STORAGE_KEYS);
