<!-- ═══════════════════════════════════════════════════════════════
     STOCKCLAW — ModalShell (Shared Modal Overlay Pattern)
     Replaces repeated: overlay + close + stopPropagation in 5 modals
     Usage:
       <ModalShell onclose={close}>
         {#snippet children()}<div>content</div>{/snippet}
       </ModalShell>
═══════════════════════════════════════════════════════════════ -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    onclose?: () => void;
    maxWidth?: string;
    maxHeight?: string;
    children: Snippet;
  }

  let {
    onclose = () => {},
    maxWidth = '420px',
    maxHeight = '85vh',
    children,
  }: Props = $props();

  function onOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onclose();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="modal-overlay"
  onclick={onOverlayClick}
  onkeydown={onKeydown}
  role="dialog"
  aria-modal="true"
  tabindex="-1"
>
  <div
    class="modal-container"
    style="max-width:{maxWidth}; max-height:{maxHeight}"
    onclick={(e) => e.stopPropagation()}
    role="presentation"
  >
    {@render children()}
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    z-index: var(--sc-z-modal, 200);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: modalFadeIn 0.15s ease;
  }
  @keyframes modalFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .modal-container {
    width: 100%;
    border: 4px solid #000;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 8px 8px 0 #000;
    background: var(--sc-bg-1, #0a0a1a);
    animation: modalSlideUp 0.2s ease;
  }
  @keyframes modalSlideUp {
    from { opacity: 0; transform: translateY(12px) scale(0.97); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
</style>
