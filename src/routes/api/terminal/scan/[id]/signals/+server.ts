import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { UUID_RE } from '$lib/server/apiValidation';
import { getAuthUserFromCookies } from '$lib/server/authGuard';
import { getTerminalScan, getTerminalScanSignals } from '$lib/services/scanService';

export const GET: RequestHandler = async ({ cookies, params }) => {
  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    const scanId = String(params.id || '').trim();
    if (!UUID_RE.test(scanId)) return json({ error: 'Invalid scan id' }, { status: 400 });

    const exists = await getTerminalScan(user.id, scanId);
    if (!exists.record) return json({ error: 'Scan not found' }, { status: 404 });

    const signals = await getTerminalScanSignals(user.id, scanId);
    return json({
      ok: true,
      warning: signals.warning,
      data: {
        scanId,
        records: signals.records,
      },
    });
  } catch (error: any) {
    if (typeof error?.message === 'string' && error.message.includes('DATABASE_URL is not set')) {
      return json({ error: 'Server database is not configured' }, { status: 500 });
    }
    console.error('[terminal/scan/:id/signals/get] unexpected error:', error);
    return json({ error: 'Failed to load scan signals' }, { status: 500 });
  }
};

