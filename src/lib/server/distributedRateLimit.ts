import { createHash } from 'node:crypto';
import { query } from './db';
import { createRateLimiter } from './rateLimit';

let _infraReady = false;

type LocalLimiterKey = `${string}:${number}:${number}`;
const _localFallback = new Map<LocalLimiterKey, ReturnType<typeof createRateLimiter>>();

function hashKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

async function ensureRateLimitInfrastructure(): Promise<void> {
  if (_infraReady) return;

  await query(
    `
      CREATE TABLE IF NOT EXISTS request_rate_limits (
        scope text NOT NULL,
        key_hash text NOT NULL,
        window_start_ms bigint NOT NULL,
        hit_count integer NOT NULL DEFAULT 0,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (scope, key_hash, window_start_ms)
      )
    `
  );

  await query(
    `
      CREATE INDEX IF NOT EXISTS idx_request_rate_limits_updated_at
      ON request_rate_limits (updated_at)
    `
  );

  _infraReady = true;
}

function getLocalFallback(scope: string, windowMs: number, max: number) {
  const key: LocalLimiterKey = `${scope}:${windowMs}:${max}`;
  let limiter = _localFallback.get(key);
  if (!limiter) {
    limiter = createRateLimiter({ windowMs, max });
    _localFallback.set(key, limiter);
  }
  return limiter;
}

function shouldCleanup(): boolean {
  return Math.random() < 0.02;
}

export async function checkDistributedRateLimit(args: {
  scope: string;
  key: string;
  windowMs: number;
  max: number;
}): Promise<boolean> {
  const scope = args.scope.trim() || 'global';
  const key = args.key.trim() || 'unknown';
  const windowMs = Math.max(1_000, Math.min(3_600_000, Math.trunc(args.windowMs)));
  const max = Math.max(1, Math.min(10_000, Math.trunc(args.max)));

  const now = Date.now();
  const windowStartMs = Math.floor(now / windowMs) * windowMs;

  try {
    await ensureRateLimitInfrastructure();

    const result = await query<{ hit_count: number }>(
      `
        INSERT INTO request_rate_limits (scope, key_hash, window_start_ms, hit_count, updated_at)
        VALUES ($1, $2, $3, 1, now())
        ON CONFLICT (scope, key_hash, window_start_ms)
        DO UPDATE SET
          hit_count = request_rate_limits.hit_count + 1,
          updated_at = now()
        RETURNING hit_count
      `,
      [scope, hashKey(key), windowStartMs]
    );

    if (shouldCleanup()) {
      const retentionMs = Math.max(windowMs * 20, 86_400_000);
      void query(
        `
          DELETE FROM request_rate_limits
          WHERE window_start_ms < $1
        `,
        [now - retentionMs]
      ).catch(() => undefined);
    }

    const hitCount = Number(result.rows[0]?.hit_count ?? 0);
    return hitCount <= max;
  } catch {
    // Fallback when DB is unavailable: still enforce per-instance protection.
    const local = getLocalFallback(scope, windowMs, max);
    return local.check(key);
  }
}
