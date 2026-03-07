<script lang="ts">
  import type { EvidenceItem } from '$lib/terminal/signalEvidence';

  interface Props {
    item: EvidenceItem;
    compact?: boolean;
  }

  let { item, compact = false }: Props = $props();

  const voteColor = $derived(
    item.vote === 'long' ? 'good' : item.vote === 'short' ? 'bad' : 'neutral'
  );
</script>

<div class="chip" class:compact class:consensus={item.kind === 'consensus'} data-vote={voteColor}>
  {#if item.kind === 'consensus'}
    <span class="chip-icon">🧠</span>
    <span class="chip-label">{item.label}</span>
  {:else if item.kind === 'agent-vote'}
    <span class="chip-dot" data-vote={voteColor}></span>
    <span class="chip-label">{item.label}</span>
  {:else if item.kind === 'indicator'}
    <span class="chip-icon">📊</span>
    <span class="chip-label">{item.label}</span>
  {:else if item.kind === 'pattern'}
    <span class="chip-icon">🔍</span>
    <span class="chip-label">{item.label}</span>
  {:else if item.kind === 'user-note'}
    <span class="chip-icon">📝</span>
    <span class="chip-label note">{item.detail.slice(0, 40)}{item.detail.length > 40 ? '…' : ''}</span>
  {:else}
    <span class="chip-label">{item.label}</span>
  {/if}
</div>

<style>
  .chip {
    display: inline-flex;
    align-items: center;
    gap: var(--sc-sp-1);
    padding: var(--sc-sp-1) var(--sc-sp-2);
    border-radius: var(--sc-radius-pill);
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-2xs);
    font-weight: 700;
    letter-spacing: 0.3px;
    border: 1px solid var(--sc-line-soft);
    background: var(--sc-surface);
    color: var(--sc-text-1);
    transition: all var(--sc-duration-fast) var(--sc-ease);
    white-space: nowrap;
    max-width: 200px;
    overflow: hidden;
  }

  .chip.consensus {
    padding: var(--sc-sp-1_5) var(--sc-sp-3);
    font-size: var(--sc-fs-xs);
    font-weight: 900;
    border-width: 1.5px;
  }

  /* Vote-based coloring */
  .chip[data-vote='good'] {
    border-color: rgba(0, 204, 136, 0.3);
    background: var(--sc-good-bg);
    color: var(--sc-good);
  }
  .chip[data-vote='bad'] {
    border-color: rgba(255, 94, 122, 0.3);
    background: var(--sc-bad-bg);
    color: var(--sc-bad);
  }
  .chip[data-vote='neutral'] {
    border-color: var(--sc-line-soft);
    background: var(--sc-surface);
    color: var(--sc-text-2);
  }

  .chip-icon {
    font-size: var(--sc-fs-xs);
    flex-shrink: 0;
  }

  .chip-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .chip-dot[data-vote='good'] { background: var(--sc-good); }
  .chip-dot[data-vote='bad'] { background: var(--sc-bad); }
  .chip-dot[data-vote='neutral'] { background: var(--sc-text-3); }

  .chip-label {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .chip-label.note {
    font-style: italic;
    font-weight: 600;
    color: var(--sc-text-2);
  }

  .compact {
    padding: 2px var(--sc-sp-1_5);
    font-size: 9px;
    max-width: 160px;
  }
  .compact .chip-icon { font-size: 10px; }
  .compact .chip-dot { width: 5px; height: 5px; }
</style>
