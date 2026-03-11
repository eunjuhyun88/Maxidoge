<script lang="ts">
  interface Props {
    eyebrow?: string;
    title: string;
    description?: string;
    primaryLabel?: string;
    secondaryLabel?: string;
    primaryHref?: string;
    secondaryHref?: string;
    icon?: string;
    compact?: boolean;
    onprimary?: () => void;
    onsecondary?: () => void;
  }

  let {
    eyebrow = 'Ready when you are',
    title,
    description = '',
    primaryLabel = '',
    secondaryLabel = '',
    primaryHref = '',
    secondaryHref = '',
    icon = '◎',
    compact = false,
    onprimary,
    onsecondary,
  }: Props = $props();

  function go(href: string) {
    if (!href || typeof window === 'undefined') return;
    window.location.href = href;
  }

  function handlePrimary() {
    onprimary?.();
    go(primaryHref);
  }

  function handleSecondary() {
    onsecondary?.();
    go(secondaryHref);
  }
</script>

<section class="zero-state" class:compact>
  <div class="hero">
    <div class="icon" aria-hidden="true">{icon}</div>
    <div class="copy">
      <p class="eyebrow">{eyebrow}</p>
      <h3>{title}</h3>
      {#if description}
        <p class="description">{description}</p>
      {/if}
    </div>
  </div>

  {#if primaryLabel || secondaryLabel}
    <div class="actions">
      {#if primaryLabel}
        <button class="primary" type="button" onclick={handlePrimary}>{primaryLabel}</button>
      {/if}
      {#if secondaryLabel}
        <button class="secondary" type="button" onclick={handleSecondary}>{secondaryLabel}</button>
      {/if}
    </div>
  {/if}
</section>

<style>
  .zero-state {
    display: grid;
    gap: 18px;
    padding: 24px;
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background:
      radial-gradient(circle at top right, rgba(232, 150, 125, 0.14), transparent 40%),
      linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.02));
  }

  .hero {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 16px;
    align-items: start;
  }

  .icon {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border-radius: 14px;
    border: 1px solid rgba(232, 150, 125, 0.26);
    background: rgba(232, 150, 125, 0.1);
    color: #f7b9a6;
    font-size: 22px;
    font-weight: 800;
  }

  .copy,
  .eyebrow,
  h3,
  .description {
    margin: 0;
  }

  .eyebrow {
    font-family: var(--fm);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(232, 150, 125, 0.86);
  }

  h3 {
    margin-top: 6px;
    font-family: var(--fd);
    font-size: 28px;
    line-height: 1.02;
    color: rgba(255, 255, 255, 0.96);
  }

  .description {
    margin-top: 8px;
    max-width: 52ch;
    font-family: var(--fb);
    font-size: 14px;
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.66);
  }

  .actions {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .primary,
  .secondary {
    border-radius: 999px;
    padding: 10px 14px;
    font-family: var(--fm);
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
  }

  .primary {
    border: 1px solid rgba(232, 150, 125, 0.22);
    background: #e8967d;
    color: #120b09;
  }

  .secondary {
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: transparent;
    color: rgba(255, 255, 255, 0.78);
  }

  .compact {
    gap: 14px;
    padding: 18px;
  }

  .compact .hero {
    gap: 12px;
  }

  .compact .icon {
    width: 40px;
    height: 40px;
    font-size: 18px;
  }

  .compact h3 {
    font-size: 22px;
  }

  .compact .description {
    font-size: 13px;
  }

  @media (max-width: 640px) {
    .hero {
      grid-template-columns: 1fr;
    }

    .actions {
      flex-direction: column;
      align-items: stretch;
    }

    .primary,
    .secondary {
      width: 100%;
    }
  }
</style>
