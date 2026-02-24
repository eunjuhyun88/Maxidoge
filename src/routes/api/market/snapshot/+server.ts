import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Cookies } from '@sveltejs/kit';
import { collectMarketSnapshot } from '$lib/server/marketSnapshotService';
import { getAuthUserFromCookies } from '$lib/server/authGuard';
import { marketSnapshotLimiter } from '$lib/server/rateLimit';
import { checkDistributedRateLimit } from '$lib/server/distributedRateLimit';
import { evaluateIpReputation } from '$lib/server/ipReputation';
import { isRequestBodyTooLargeError, readJsonBody } from '$lib/server/requestGuards';

type MarketSnapshotResult = Awaited<ReturnType<typeof collectMarketSnapshot>>;

function toValidationMessage(error: any): string | null {
  const message = typeof error?.message === 'string' ? error.message : '';
  if (message.includes('pair must be like')) return message;
  if (message.includes('timeframe must be one of')) return message;
  return null;
}

function toPersistFlag(value: unknown, fallback = true): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const raw = value.trim().toLowerCase();
    if (!raw) return fallback;
    return !(raw === '0' || raw === 'false' || raw === 'no' || raw === 'off');
  }
  return fallback;
}

function buildSuccessPayload(snapshot: MarketSnapshotResult) {
  const atIso = new Date(snapshot.at).toISOString();
  return {
    success: true as const,
    ok: true as const,
    updated: snapshot.updated,
    pair: snapshot.pair,
    timeframe: snapshot.timeframe,
    at: snapshot.at,
    persisted: snapshot.persisted,
    warning: snapshot.warning,
    sources: snapshot.sources,
    data: {
      updated: snapshot.updated,
      pair: snapshot.pair,
      timeframe: snapshot.timeframe,
      at: atIso,
      persisted: snapshot.persisted,
      warning: snapshot.warning,
      sources: snapshot.sources,
    },
  };
}

function successResponse(snapshot: MarketSnapshotResult) {
  return json(buildSuccessPayload(snapshot), {
    headers: {
      'Cache-Control': 'public, max-age=30',
    },
  });
}

function errorResponse(error: any, method: 'get' | 'post') {
  if (isRequestBodyTooLargeError(error)) {
    return json({ error: 'Request body too large' }, { status: 413 });
  }
  const validationMessage = toValidationMessage(error);
  if (validationMessage) return json({ error: validationMessage }, { status: 400 });
  console.error(`[market/snapshot/${method}] unexpected error:`, error);
  return json({ error: 'Failed to build market snapshot' }, { status: 500 });
}

async function isAuthenticated(cookies: Cookies): Promise<boolean> {
  try {
    const user = await getAuthUserFromCookies(cookies);
    return Boolean(user);
  } catch {
    return false;
  }
}

export const GET: RequestHandler = async ({ fetch, url, cookies, getClientAddress, request }) => {
  const fallbackIp = getClientAddress();
  const reputation = evaluateIpReputation(request, fallbackIp);
  if (!reputation.allowed) {
    return json({ error: 'Request blocked by security policy' }, { status: 403 });
  }

  const ip = reputation.clientIp || fallbackIp || 'unknown';
  if (!marketSnapshotLimiter.check(ip)) {
    return json({ error: 'Too many snapshot requests. Please wait.' }, { status: 429 });
  }
  const distributedAllowed = await checkDistributedRateLimit({
    scope: 'market:snapshot:get',
    key: ip,
    windowMs: 60_000,
    max: 20,
  });
  if (!distributedAllowed) {
    return json({ error: 'Too many snapshot requests. Please wait.' }, { status: 429 });
  }

  try {
    const pair = url.searchParams.get('pair');
    const timeframe = url.searchParams.get('timeframe');
    const requestedPersist = toPersistFlag(url.searchParams.get('persist'), true);
    const persist = requestedPersist && (await isAuthenticated(cookies));

    const snapshot = await collectMarketSnapshot(fetch, { pair, timeframe, persist });
    return successResponse(snapshot);
  } catch (error: any) {
    return errorResponse(error, 'get');
  }
};

export const POST: RequestHandler = async ({ fetch, request, cookies, getClientAddress }) => {
  const fallbackIp = getClientAddress();
  const reputation = evaluateIpReputation(request, fallbackIp);
  if (!reputation.allowed) {
    return json({ error: 'Request blocked by security policy' }, { status: 403 });
  }

  const ip = reputation.clientIp || fallbackIp || 'unknown';
  if (!marketSnapshotLimiter.check(ip)) {
    return json({ error: 'Too many snapshot requests. Please wait.' }, { status: 429 });
  }
  const distributedAllowed = await checkDistributedRateLimit({
    scope: 'market:snapshot:post',
    key: ip,
    windowMs: 60_000,
    max: 20,
  });
  if (!distributedAllowed) {
    return json({ error: 'Too many snapshot requests. Please wait.' }, { status: 429 });
  }
  try {
    const body = await readJsonBody<Record<string, unknown>>(request, 16 * 1024);
    const pair = typeof body?.pair === 'string' ? body.pair : null;
    const timeframe = typeof body?.timeframe === 'string' ? body.timeframe : null;
    const requestedPersist = toPersistFlag(body?.persist, true);
    const persist = requestedPersist && (await isAuthenticated(cookies));

    const snapshot = await collectMarketSnapshot(fetch, { pair, timeframe, persist });
    return successResponse(snapshot);
  } catch (error: any) {
    return errorResponse(error, 'post');
  }
};
