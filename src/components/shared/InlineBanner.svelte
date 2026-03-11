<script lang="ts">
  type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'critical';

  interface Props {
    tone?: Tone;
    title: string;
    message?: string;
    actionLabel?: string;
    dismissLabel?: string;
    compact?: boolean;
    dismissible?: boolean;
    onaction?: () => void;
    ondismiss?: () => void;
  }

  let {
    tone = 'info' as Tone,
    title,
    message = '',
    actionLabel = '',
    dismissLabel = 'Dismiss',
    compact = false,
    dismissible = true,
    onaction,
    ondismiss,
  }: Props = $props();

  function handleAction() {
    onaction?.();
  }

  function handleDismiss() {
    ondismiss?.();
  }
</script>

<div class="banner" class:compact data-tone={tone} role="status" aria-live="polite">
  <div class="rail" aria-hidden="true"></div>
  <div class="copy">
    <p class="title">{title}</p>
    {#if message}
      <p class="message">{message}</p>
    {/if}
  </div>
  <div class="actions">
    {#if actionLabel}
      <button class="action" type="button" onclick={handleAction}>{actionLabel}</button>
    {/if}
    {#if dismissible}
      <button class="dismiss" type="button" onclick={handleDismiss}>{dismissLabel}</button>
    {/if}
  </div>
</div>

<style>
  .banner {
    --tone: #7ec8ff;
    --tone-bg: rgba(126, 200, 255, 0.1);
    display: grid;
    grid-template-columns: 4px minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.09);
    background: rgba(255, 255, 255, 0.04);
  }

  .banner[data-tone='neutral'] {
    --tone: rgba(255, 255, 255, 0.68);
    --tone-bg: rgba(255, 255, 255, 0.08);
  }

  .banner[data-tone='info'] {
    --tone: #7ec8ff;
    --tone-bg: rgba(126, 200, 255, 0.12);
  }

  .banner[data-tone='success'] {
    --tone: #29d391;
    --tone-bg: rgba(41, 211, 145, 0.12);
  }

  .banner[data-tone='warning'] {
    --tone: #ffb648;
    --tone-bg: rgba(255, 182, 72, 0.14);
  }

  .banner[data-tone='critical'] {
    --tone: #ff6b7a;
    --tone-bg: rgba(255, 107, 122, 0.16);
  }

  .rail {
    width: 4px;
    height: 100%;
    min-height: 36px;
    border-radius: 999px;
    background: linear-gradient(180deg, var(--tone), transparent);
  }

  .copy {
    min-width: 0;
  }

  .title,
  .message {
    margin: 0;
  }

  .title {
    font-family: var(--fm);
    font-size: 12px;
    font-weight: 800;
    color: rgba(255, 255, 255, 0.94);
  }

  .message {
    margin-top: 4px;
    font-family: var(--fb);
    font-size: 12px;
    line-height: 1.5;
    color: rgba(255, 255, 255, 0.62);
  }

  .actions {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .action,
  .dismiss {
    border-radius: 999px;
    padding: 8px 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    font-family: var(--fm);
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
  }

  .action {
    background: var(--tone-bg);
    color: var(--tone);
  }

  .dismiss {
    background: transparent;
    color: rgba(255, 255, 255, 0.68);
  }

  .compact {
    gap: 10px;
    padding: 10px 12px;
  }

  .compact .title,
  .compact .message {
    font-size: 11px;
  }

  .compact .action,
  .compact .dismiss {
    padding: 6px 10px;
    font-size: 10px;
  }

  @media (max-width: 640px) {
    .banner {
      grid-template-columns: 4px 1fr;
    }

    .actions {
      grid-column: 2;
      justify-content: flex-start;
      flex-wrap: wrap;
    }
  }
</style>
