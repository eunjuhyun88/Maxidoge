<script lang="ts">
  import type { SignalAttachment } from '$lib/stores/communityStore';
  import type { TerminalSharePrefill } from '$lib/terminal/terminalTypes';
  import type { PriceLikeMap } from '$lib/utils/price';

  interface Props {
    show?: boolean;
    prefill?: TerminalSharePrefill | null;
    livePrices?: PriceLikeMap;
    onClose?: () => void;
    onPosted?: (attachment: SignalAttachment | null) => void | Promise<void>;
  }

  let {
    show = false,
    prefill = null,
    livePrices = {},
    onClose,
    onPosted,
  }: Props = $props();

  let signalPostFormModule = $state<Promise<typeof import('../community/SignalPostForm.svelte')> | null>(null);

  $effect(() => {
    if (show) {
      signalPostFormModule ??= import('../community/SignalPostForm.svelte');
    }
  });

  async function handlePosted(attachment: SignalAttachment | null) {
    await onPosted?.(attachment);
  }
</script>

{#if show && signalPostFormModule}
  <div class="share-modal-overlay" role="dialog" aria-label="커뮤니티에 공유">
    <div class="share-modal">
      <div class="share-modal-header">
        <span class="share-modal-title">📡 커뮤니티에 공유</span>
        <button class="share-modal-close" onclick={onClose}>✕</button>
      </div>
      {#await signalPostFormModule then signalPostFormNs}
        <signalPostFormNs.default
          {prefill}
          {livePrices}
          onPosted={handlePosted}
        />
      {/await}
    </div>
  </div>
{/if}

<style>
  .share-modal-overlay {
    position: fixed; inset: 0; z-index: var(--sc-z-modal-backdrop, 9999);
    background: var(--sc-overlay, rgba(0,0,0,.7)); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    padding: var(--sc-sp-4);
  }
  .share-modal {
    width: 100%; max-width: 480px;
    background: var(--sc-bg-1); border: 1px solid var(--sc-line);
    border-radius: var(--sc-radius-xl); padding: var(--sc-sp-5);
    box-shadow: var(--sc-shadow-lg);
  }
  .share-modal-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: var(--sc-sp-3); padding-bottom: var(--sc-sp-2);
    border-bottom: 1px solid var(--sc-line-soft);
  }
  .share-modal-title {
    font-family: var(--sc-font-mono); font-size: var(--sc-fs-sm); font-weight: 900;
    letter-spacing: .5px; color: var(--sc-accent);
  }
  .share-modal-close {
    width: 28px; height: 28px; border-radius: var(--sc-radius-md);
    background: var(--sc-surface); border: 1px solid var(--sc-line-soft);
    color: var(--sc-text-3); font-size: var(--sc-fs-sm);
    cursor: pointer; display: grid; place-items: center;
    transition: all var(--sc-duration-fast) var(--sc-ease);
  }
  .share-modal-close:hover { background: var(--sc-surface-2); color: var(--sc-text-0); }
</style>
