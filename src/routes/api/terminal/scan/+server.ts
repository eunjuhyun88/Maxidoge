import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthUserFromCookies } from '$lib/server/authGuard';
import { query } from '$lib/server/db';
import { runTerminalScan } from '$lib/services/scanService';
import { scanLimiter } from '$lib/server/rateLimit';
import { checkDistributedRateLimit } from '$lib/server/distributedRateLimit';
import { evaluateIpReputation } from '$lib/server/ipReputation';
import { isRequestBodyTooLargeError, readJsonBody } from '$lib/server/requestGuards';

function parseValidationMessage(message: string): string | null {
  if (message.startsWith('pair must be like')) return message;
  if (message.startsWith('timeframe must be one of')) return message;
  return null;
}

export const POST: RequestHandler = async ({ cookies, request, getClientAddress }) => {
  const fallbackIp = getClientAddress();
  const reputation = evaluateIpReputation(request, fallbackIp);
  if (!reputation.allowed) {
    return json({ error: 'Request blocked by security policy' }, { status: 403 });
  }

  // Rate limit: 6 scans/min per IP
  const ip = reputation.clientIp || fallbackIp || 'unknown';
  if (!scanLimiter.check(ip)) {
    return json({ error: 'Too many scan requests. Please wait.' }, { status: 429 });
  }
  const distributedAllowed = await checkDistributedRateLimit({
    scope: 'terminal:scan',
    key: ip,
    windowMs: 60_000,
    max: 6,
  });
  if (!distributedAllowed) {
    return json({ error: 'Too many scan requests. Please wait.' }, { status: 429 });
  }

  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    const body = await readJsonBody<Record<string, unknown>>(request, 16 * 1024);
    const source = typeof body?.source === 'string' ? body.source.trim() : 'terminal';

    const result = await runTerminalScan(user.id, {
      pair: body?.pair,
      timeframe: body?.timeframe,
    });

    await query(
      `
        INSERT INTO activity_events (user_id, event_type, source_page, source_id, severity, payload)
        VALUES ($1, 'scan_run', 'terminal', $2, 'info', $3::jsonb)
      `,
      [
        user.id,
        result.scanId,
        JSON.stringify({
          pair: result.data.pair,
          timeframe: result.data.timeframe,
          consensus: result.data.consensus,
          avgConfidence: result.data.avgConfidence,
          source,
          persisted: result.persisted,
        }),
      ]
    ).catch(() => undefined);

    return json({
      success: true,
      ok: true,
      scanId: result.scanId,
      persisted: result.persisted,
      warning: result.warning,
      data: result.data,
    });
  } catch (error: any) {
    if (isRequestBodyTooLargeError(error)) {
      return json({ error: 'Request body too large' }, { status: 413 });
    }
    const validationMessage = typeof error?.message === 'string' ? parseValidationMessage(error.message) : null;
    if (validationMessage) return json({ error: validationMessage }, { status: 400 });
    if (typeof error?.message === 'string' && error.message.includes('DATABASE_URL is not set')) {
      return json({ error: 'Server database is not configured' }, { status: 500 });
    }
    if (error instanceof SyntaxError) return json({ error: 'Invalid request body' }, { status: 400 });
    console.error('[terminal/scan/post] unexpected error:', error);
    return json({ error: 'Failed to run terminal scan' }, { status: 500 });
  }
};
