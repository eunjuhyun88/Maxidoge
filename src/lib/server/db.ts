import pg from 'pg';
import { env } from '$env/dynamic/private';

const { Pool } = pg;

let _pool: pg.Pool | null = null;

function envInt(name: string, fallback: number, min: number, max: number): number {
  const raw = env[name as keyof typeof env];
  const parsed = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function shouldUseSsl(connectionString: string): boolean {
  return !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1');
}

export function getPool(): pg.Pool {
  if (_pool) return _pool;

  const connectionString = env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  // Defaults tuned for moderate concurrency; override with env in production.
  const max = envInt('PGPOOL_MAX', 24, 2, 200);
  const idleTimeoutMillis = envInt('PGPOOL_IDLE_TIMEOUT_MS', 30000, 1000, 300000);
  const connectionTimeoutMillis = envInt('PGPOOL_CONN_TIMEOUT_MS', 5000, 500, 60000);
  const maxUses = envInt('PGPOOL_MAX_USES', 7500, 0, 1000000);

  _pool = new Pool({
    connectionString,
    ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : false,
    max,
    idleTimeoutMillis,
    connectionTimeoutMillis,
    maxUses,
  });

  return _pool;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<pg.QueryResult<T>> {
  const pool = getPool();
  return pool.query<T>(text, params);
}

export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
