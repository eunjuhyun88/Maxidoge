import { query } from '$lib/server/db';
import { UUID_RE } from '$lib/server/apiValidation';
import { isPersistenceUnavailableError } from '$lib/services/scanService';
import type {
  AgentChatRow,
  ChatMessageRecord,
  ScanContext,
  ScanRunContextRow,
  ScanSignalContextRow,
} from './chatTypes';

function toNum(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(n) ? n : fallback;
}

export function mapChatRow(row: AgentChatRow): ChatMessageRecord {
  return {
    id: row.id,
    userId: row.user_id,
    channel: row.channel,
    senderKind: row.sender_kind,
    senderId: row.sender_id,
    senderName: row.sender_name,
    message: row.message,
    meta: (row.meta ?? {}) as Record<string, unknown>,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export async function countChatMessages(userId: string, channel = ''): Promise<number> {
  const where = channel ? 'AND channel = $2' : '';
  const params = channel ? [userId, channel] : [userId];
  const count = await query<{ total: string }>(
    `SELECT count(*)::text AS total FROM agent_chat_messages WHERE user_id = $1 ${where}`,
    params
  );
  return Number(count.rows[0]?.total ?? '0');
}

export async function getChatMessages(
  userId: string,
  channel: string,
  limit: number,
  offset: number
): Promise<ChatMessageRecord[]> {
  const where = channel ? 'AND channel = $2' : '';
  const rows = await query<AgentChatRow>(
    `
      SELECT
        id, user_id, channel, sender_kind, sender_id,
        sender_name, message, meta, created_at
      FROM agent_chat_messages
      WHERE user_id = $1
      ${where}
      ORDER BY created_at DESC
      LIMIT $${channel ? 3 : 2} OFFSET $${channel ? 4 : 3}
    `,
    channel ? [userId, channel, limit, offset] : [userId, limit, offset]
  );

  return rows.rows.map(mapChatRow).reverse();
}

export async function insertChatMessage(input: {
  userId: string;
  channel: string;
  senderKind: string;
  senderId: string | null;
  senderName: string;
  message: string;
  meta: Record<string, unknown>;
}): Promise<ChatMessageRecord> {
  const insert = await query<AgentChatRow>(
    `
      INSERT INTO agent_chat_messages (
        user_id, channel, sender_kind, sender_id, sender_name, message, meta, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, now())
      RETURNING
        id, user_id, channel, sender_kind, sender_id, sender_name, message, meta, created_at
    `,
    [
      input.userId,
      input.channel,
      input.senderKind,
      input.senderId,
      input.senderName,
      input.message,
      JSON.stringify(input.meta),
    ]
  );

  return mapChatRow(insert.rows[0]);
}

export async function insertChatActivity(input: {
  userId: string;
  sourceId: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  await query(
    `
      INSERT INTO activity_events (user_id, event_type, source_page, source_id, severity, payload)
      VALUES ($1, 'chat_sent', 'terminal', $2, 'info', $3::jsonb)
    `,
    [input.userId, input.sourceId, JSON.stringify(input.payload)]
  ).catch(() => undefined);
}

export async function loadScanContext(
  userId: string,
  meta: Record<string, unknown>
): Promise<ScanContext | null> {
  const requestedScanId = typeof meta.scanId === 'string' && UUID_RE.test(meta.scanId) ? meta.scanId : null;
  const requestedPair = typeof meta.pair === 'string' ? meta.pair.trim().toUpperCase() : '';
  const requestedTimeframe = typeof meta.timeframe === 'string' ? meta.timeframe.trim().toLowerCase() : '';

  try {
    let runRow: ScanRunContextRow | undefined;

    if (requestedScanId) {
      const run = await query<ScanRunContextRow>(
        `
          SELECT id, pair, timeframe, consensus, avg_confidence, summary, created_at
          FROM terminal_scan_runs
          WHERE id = $1 AND user_id = $2
          LIMIT 1
        `,
        [requestedScanId, userId]
      );
      runRow = run.rows[0];
    } else {
      const filters = ['user_id = $1'];
      const params: unknown[] = [userId];

      if (requestedPair) {
        params.push(requestedPair);
        filters.push(`pair = $${params.length}`);
      }
      if (requestedTimeframe) {
        params.push(requestedTimeframe);
        filters.push(`timeframe = $${params.length}`);
      }

      const run = await query<ScanRunContextRow>(
        `
          SELECT id, pair, timeframe, consensus, avg_confidence, summary, created_at
          FROM terminal_scan_runs
          WHERE ${filters.join(' AND ')}
          ORDER BY created_at DESC
          LIMIT 1
        `,
        params
      );
      runRow = run.rows[0];
    }

    if (!runRow) {
      return {
        scanId: null,
        pair: requestedPair || 'BTC/USDT',
        timeframe: requestedTimeframe || '4h',
        consensus: null,
        avgConfidence: null,
        summary: null,
        signals: [],
      };
    }

    const signals = await query<ScanSignalContextRow>(
      `
        SELECT
          agent_id, agent_name, vote, confidence, analysis_text,
          data_source, entry_price, tp_price, sl_price
        FROM terminal_scan_signals
        WHERE scan_id = $1 AND user_id = $2
        ORDER BY confidence DESC, created_at DESC
      `,
      [runRow.id, userId]
    );

    return {
      scanId: runRow.id,
      pair: runRow.pair,
      timeframe: runRow.timeframe,
      consensus: runRow.consensus,
      avgConfidence: Math.round(toNum(runRow.avg_confidence, 0)),
      summary: runRow.summary,
      signals: signals.rows,
    };
  } catch (error: unknown) {
    if (isPersistenceUnavailableError(error)) return null;
    console.warn('[chat/messages] failed to load scan context:', error);
    return null;
  }
}

