import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthUserFromCookies } from '$lib/server/authGuard';
import { getPassportLearningStatus } from '$lib/server/passportMlPipeline';
import { getErrorMessage } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async ({ cookies }) => {
  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    const status = await getPassportLearningStatus(user.id);
    return json({ success: true, status });
  } catch (error: unknown) {
    if (getErrorMessage(error).includes('DATABASE_URL is not set')) {
      return json({ error: 'Server database is not configured' }, { status: 500 });
    }
    console.error('[profile/passport/learning/status] unexpected error:', error);
    return json({ error: 'Failed to load learning status' }, { status: 500 });
  }
};
