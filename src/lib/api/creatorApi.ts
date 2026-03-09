// ═══════════════════════════════════════════════════════════════
// STOCKCLAW — Creator Profile API Client
// ═══════════════════════════════════════════════════════════════

import type { CreatorProfile } from '$lib/contracts/creator';

function canUseBrowserFetch(): boolean {
  return typeof window !== 'undefined' && typeof fetch === 'function';
}

interface ApiErrorPayload {
  error?: string;
}

export async function fetchCreatorProfileApi(
  userId: string
): Promise<CreatorProfile | null> {
  if (!canUseBrowserFetch()) return null;
  try {
    const res = await fetch(`/api/creator/${userId}`, {
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      let message = `Request failed (${res.status})`;
      try {
        const payload = (await res.json()) as ApiErrorPayload;
        if (payload?.error) message = payload.error;
      } catch {
        // ignore
      }
      throw new Error(message);
    }

    const data = (await res.json()) as { success: boolean; creator: CreatorProfile };
    return data.creator ?? null;
  } catch {
    return null;
  }
}
