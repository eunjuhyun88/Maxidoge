<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import { loadFromStorage, saveToStorage } from '$lib/utils/storage';

  type Tone = 'default' | 'info' | 'success';

  interface Props {
    storageKey: string;
    title: string;
    description: string;
    actionLabel?: string;
    dismissLabel?: string;
    tone?: Tone;
    initiallyVisible?: boolean;
    onaction?: () => void;
    ondismiss?: () => void;
  }

  const STORAGE_PREFIX = 'sc:onboarding-hint:';

  let {
    storageKey,
    title,
    description,
    actionLabel = '',
    dismissLabel = 'Got it',
    tone = 'info' as Tone,
    initiallyVisible = true,
    onaction,
    ondismiss,
  }: Props = $props();

  let visible = $state(false);

  onMount(() => {
    if (!browser) return;
    const seen = loadFromStorage<boolean>(`${STORAGE_PREFIX}${storageKey}`, false);
    visible = initiallyVisible && !seen;
  });

  function markSeen() {
    if (!browser) return;
    saveToStorage(`${STORAGE_PREFIX}${storageKey}`, true);
  }

  function dismiss() {
    visible = false;
    markSeen();
    ondismiss?.();
  }

  function runAction() {
    onaction?.();
    dismiss();
  }
</script>

{#if visible}
  <aside class="hint" data-tone={tone} role="note" aria-live="polite">
    <div class="badge">Hint</div>
    <div class="copy">
      <p class="title">{title}</p>
      <p class="description">{description}</p>
    </div>
    <div class="actions">
      {#if actionLabel}
        <button class="primary" type="button" onclick={runAction}>{actionLabel}</button>
      {/if}
      <button class="secondary" type="button" onclick={dismiss}>{dismissLabel}</button>
    </div>
  </aside>
{/if}

<style>
  .hint {
    --tone: #7ec8ff;
    --tone-bg: rgba(126, 200, 255, 0.12);
    display: grid;
    gap: 12px;
    padding: 14px;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background:
      radial-gradient(circle at top right, var(--tone-bg), transparent 48%),
      rgba(255, 255, 255, 0.03);
  }

  .hint[data-tone='default'] {
    --tone: rgba(255, 255, 255, 0.8);
    --tone-bg: rgba(255, 255, 255, 0.08);
  }

  .hint[data-tone='info'] {
    --tone: #7ec8ff;
    --tone-bg: rgba(126, 200, 255, 0.14);
  }

  .hint[data-tone='success'] {
    --tone: #29d391;
    --tone-bg: rgba(41, 211, 145, 0.14);
  }

  .badge {
    width: fit-content;
    border-radius: 999px;
    padding: 4px 8px;
    background: var(--tone-bg);
    color: var(--tone);
    font-family: var(--fm);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .copy,
  .title,
  .description {
    margin: 0;
  }

  .title {
    font-family: var(--fm);
    font-size: 13px;
    font-weight: 800;
    color: rgba(255, 255, 255, 0.94);
  }

  .description {
    margin-top: 4px;
    font-family: var(--fb);
    font-size: 12px;
    line-height: 1.5;
    color: rgba(255, 255, 255, 0.64);
  }

  .actions {
    display: inline-flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .primary,
  .secondary {
    border-radius: 999px;
    padding: 8px 12px;
    font-family: var(--fm);
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
  }

  .primary {
    border: 1px solid transparent;
    background: var(--tone);
    color: #061017;
  }

  .secondary {
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: transparent;
    color: rgba(255, 255, 255, 0.76);
  }
</style>
