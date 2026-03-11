<script lang="ts">
  import {
    getFreshnessMeta,
    type FreshnessInput,
  } from '$lib/utils/freshness';

  interface Props {
    timestamp?: FreshnessInput;
    source?: string;
    label?: string;
    freshMs?: number;
    staleMs?: number;
    compact?: boolean;
    showLabel?: boolean;
  }

  let {
    timestamp = null,
    source = 'Market',
    label = 'Data freshness',
    freshMs = 15_000,
    staleMs = 60_000,
    compact = false,
    showLabel = true,
  }: Props = $props();

  const meta = $derived(getFreshnessMeta(timestamp, { freshMs, staleMs }));
  const toneLabel = $derived(
    meta.isUnknown ? 'Unknown' : meta.isStale ? 'Stale' : meta.isAging ? 'Aging' : 'Live'
  );
  const assistiveLabel = $derived(
    `${label}: ${toneLabel}. ${source} · ${meta.ageLabel}`
  );
</script>

<div
  class="freshness"
  class:compact
  data-level={meta.level}
  aria-label={assistiveLabel}
  title={assistiveLabel}
>
  <span class="dot" aria-hidden="true"></span>
  {#if showLabel}
    <span class="meta">
      <span class="source">{source}</span>
      <span class="separator">·</span>
      <span class="age">{meta.ageLabel}</span>
    </span>
  {/if}
  <span class="badge">{toneLabel}</span>
</div>

<style>
  .freshness {
    --fresh-color: #29d391;
    --aging-color: #ffb648;
    --stale-color: #ff6b7a;
    --unknown-color: rgba(255, 255, 255, 0.45);
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 6px 10px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.88);
    font-family: var(--fm);
    font-size: 11px;
    letter-spacing: 0.02em;
  }

  .freshness[data-level='fresh'] {
    border-color: rgba(41, 211, 145, 0.24);
  }

  .freshness[data-level='aging'] {
    border-color: rgba(255, 182, 72, 0.24);
  }

  .freshness[data-level='stale'] {
    border-color: rgba(255, 107, 122, 0.28);
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    background: var(--unknown-color);
    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.03);
    flex-shrink: 0;
  }

  .freshness[data-level='fresh'] .dot {
    background: var(--fresh-color);
    box-shadow: 0 0 12px rgba(41, 211, 145, 0.45);
  }

  .freshness[data-level='aging'] .dot {
    background: var(--aging-color);
    box-shadow: 0 0 12px rgba(255, 182, 72, 0.35);
  }

  .freshness[data-level='stale'] .dot {
    background: var(--stale-color);
    box-shadow: 0 0 12px rgba(255, 107, 122, 0.4);
  }

  .meta {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .source {
    font-weight: 700;
    color: rgba(255, 255, 255, 0.94);
  }

  .separator,
  .age {
    color: rgba(255, 255, 255, 0.58);
  }

  .badge {
    margin-left: 2px;
    padding: 2px 7px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: rgba(255, 255, 255, 0.78);
    background: rgba(255, 255, 255, 0.06);
  }

  .freshness[data-level='fresh'] .badge {
    background: rgba(41, 211, 145, 0.14);
    color: #8ff0c3;
  }

  .freshness[data-level='aging'] .badge {
    background: rgba(255, 182, 72, 0.14);
    color: #ffd28c;
  }

  .freshness[data-level='stale'] .badge {
    background: rgba(255, 107, 122, 0.14);
    color: #ffb1bb;
  }

  .compact {
    gap: 6px;
    padding: 4px 8px;
    font-size: 10px;
  }

  .compact .dot {
    width: 8px;
    height: 8px;
  }

  .compact .badge {
    padding: 2px 6px;
    font-size: 9px;
  }
</style>
