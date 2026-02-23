// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — Opportunity Scan API
// ═══════════════════════════════════════════════════════════════
// Multi-asset scan: scores trending coins → ranked opportunities
// Stores results in DB for history tracking

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { runOpportunityScan, extractAlerts } from '$lib/engine/opportunityScanner';
import { query } from '$lib/server/db';

export const GET: RequestHandler = async ({ url }) => {
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 15, 5), 30);

  try {
    const result = await runOpportunityScan(limit);
    const alerts = extractAlerts(result);

    // Persist to DB (best-effort)
    try {
      const top5 = result.coins.slice(0, 5);
      await query(
        `INSERT INTO opportunity_scans (
          scanned_at, coin_count, macro_regime, macro_score,
          top_picks, alerts, scan_duration_ms
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          new Date(result.scannedAt),
          result.coins.length,
          result.macroBackdrop.regime,
          result.macroBackdrop.overallMacroScore,
          JSON.stringify(top5.map(c => ({
            symbol: c.symbol, score: c.totalScore, direction: c.direction,
            confidence: c.confidence, reasons: c.reasons,
          }))),
          JSON.stringify(alerts.slice(0, 10)),
          result.scanDurationMs,
        ],
      );
    } catch (dbErr) {
      // DB not available or table doesn't exist — scan still works
      console.warn('[opportunity-scan] DB persist failed:', (dbErr as Error).message);
    }

    return json(
      {
        ok: true,
        data: {
          coins: result.coins,
          macroBackdrop: result.macroBackdrop,
          alerts,
          scannedAt: result.scannedAt,
          scanDurationMs: result.scanDurationMs,
        },
      },
      { headers: { 'Cache-Control': 'public, max-age=30' } }
    );
  } catch (error: any) {
    console.error('[opportunity-scan] error:', error);
    return json({ error: 'Opportunity scan failed' }, { status: 500 });
  }
};
