import { randomUUID } from 'node:crypto';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthUserFromCookies } from '$lib/server/authGuard';
import { toBoundedInt } from '$lib/server/apiValidation';
import { withTransaction } from '$lib/server/db';
import { buildOrpoPairs } from '$lib/server/orpo/pairBuilder';
import { estimateJsonlByteSize, serializeOrpoPairsToJsonl } from '$lib/server/orpo/exportJsonl';

function normalizeDate(value: unknown, fallback: Date): Date {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function normalizeNumber(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function createVersionLabel(windowEnd: Date): string {
  const y = windowEnd.getUTCFullYear();
  const m = String(windowEnd.getUTCMonth() + 1).padStart(2, '0');
  const d = String(windowEnd.getUTCDate()).padStart(2, '0');
  const hh = String(windowEnd.getUTCHours()).padStart(2, '0');
  const mm = String(windowEnd.getUTCMinutes()).padStart(2, '0');
  return `orpo-${y}${m}${d}-${hh}${mm}-${randomUUID().slice(0, 6)}`;
}

export const POST: RequestHandler = async ({ cookies, request }) => {
  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    const body = await request.json().catch(() => ({}));

    const now = new Date();
    const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const windowStart = normalizeDate(body?.windowStart, defaultStart);
    const windowEnd = normalizeDate(body?.windowEnd, now);

    if (windowStart.getTime() >= windowEnd.getTime()) {
      return json({ error: 'windowStart must be before windowEnd' }, { status: 400 });
    }

    const minMargin = normalizeNumber(body?.minMargin, 5, 0, 300);
    const maxPairs = toBoundedInt(body?.maxPairs, 400, 1, 5000);
    const maxPerCluster = toBoundedInt(body?.maxPerCluster, 60, 1, 500);
    const includeLowQuality = Boolean(body?.includeLowQuality);
    const dryRun = Boolean(body?.dryRun);

    const build = await buildOrpoPairs({
      userId: user.id,
      windowStart,
      windowEnd,
      minMargin,
      maxPairs,
      maxPerCluster,
      includeLowQuality,
    });

    const jsonlPreview = serializeOrpoPairsToJsonl(build.pairs.slice(0, 20), { includeMetadata: true });
    const previewBytes = estimateJsonlByteSize(jsonlPreview);

    if (dryRun) {
      return json({
        success: true,
        dryRun: true,
        build,
        preview: {
          lines: build.pairs.slice(0, 5),
          jsonlPreview,
          previewBytes,
        },
      });
    }

    const datasetType = 'orpo';
    const versionLabel = createVersionLabel(windowEnd);

    const qualityReport = {
      schemaVersion: 'orpo-pairs-v1',
      sourceCount: build.sourceCount,
      candidateCount: build.candidateCount,
      clusterCount: build.clusterCount,
      pairCount: build.pairCount,
      droppedLowMargin: build.droppedLowMargin,
      droppedLowQuality: build.droppedLowQuality,
      avgMargin: build.avgMargin,
      qualityCounts: build.qualityCounts,
      filters: build.filters,
    };

    const created = await withTransaction(async (client) => {
      const insertedDataset = await client.query<{
        dataset_version_id: string;
        dataset_type: string;
        version_label: string;
        sample_count: number;
        status: string;
        created_at: string;
      }>(
        `
          INSERT INTO ml_dataset_versions (
            user_id,
            dataset_type,
            version_label,
            window_start,
            window_end,
            sample_count,
            filters,
            quality_report,
            status
          )
          VALUES ($1, $2, $3, $4::timestamptz, $5::timestamptz, $6, $7::jsonb, $8::jsonb, 'ready')
          RETURNING dataset_version_id, dataset_type, version_label, sample_count, status, created_at
        `,
        [
          user.id,
          datasetType,
          versionLabel,
          windowStart.toISOString(),
          windowEnd.toISOString(),
          build.pairs.length,
          JSON.stringify({
            minMargin,
            maxPairs,
            maxPerCluster,
            includeLowQuality,
          }),
          JSON.stringify(qualityReport),
        ],
      );

      const dataset = insertedDataset.rows[0];

      for (const pair of build.pairs) {
        await client.query(
          `
            INSERT INTO ml_preference_pairs (
              dataset_version_id,
              user_id,
              trace_id,
              prompt,
              chosen,
              rejected,
              margin_score,
              pair_quality
            )
            VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8)
          `,
          [
            dataset.dataset_version_id,
            user.id,
            pair.traceId,
            JSON.stringify(pair.prompt),
            JSON.stringify(pair.chosen),
            JSON.stringify(pair.rejected),
            pair.marginScore,
            pair.pairQuality,
          ],
        );
      }

      return {
        datasetVersionId: dataset.dataset_version_id,
        datasetType: dataset.dataset_type,
        versionLabel: dataset.version_label,
        sampleCount: Number(dataset.sample_count ?? build.pairs.length),
        status: dataset.status,
        createdAt: new Date(dataset.created_at).getTime(),
      };
    });

    const jsonl = serializeOrpoPairsToJsonl(build.pairs, {
      datasetVersionId: created.datasetVersionId,
      includeMetadata: true,
    });

    return json(
      {
        success: true,
        dryRun: false,
        dataset: created,
        build,
        exportInfo: {
          format: 'jsonl',
          byteSize: estimateJsonlByteSize(jsonl),
          lineCount: build.pairCount,
        },
      },
      { status: 201 },
    );
  } catch (error: any) {
    if (typeof error?.message === 'string' && error.message.includes('DATABASE_URL is not set')) {
      return json({ error: 'Server database is not configured' }, { status: 500 });
    }
    if (error instanceof SyntaxError) return json({ error: 'Invalid request body' }, { status: 400 });
    console.error('[profile/passport/learning/datasets/build] unexpected error:', error);
    return json({ error: 'Failed to build ORPO dataset' }, { status: 500 });
  }
};
