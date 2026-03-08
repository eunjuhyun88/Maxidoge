-- Copy-trade publish retries should resolve to one canonical run per client mutation.
CREATE UNIQUE INDEX IF NOT EXISTS uq_copy_trade_runs_user_client_mutation
  ON copy_trade_runs (user_id, ((draft->>'clientMutationId')))
  WHERE draft ? 'clientMutationId';
