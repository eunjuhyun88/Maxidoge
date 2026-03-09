<script lang="ts">
  import ModalShell from '../ui/ModalShell.svelte';

  interface Props {
    open?: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    details?: string[];
    onconfirm?: () => void;
    oncancel?: () => void;
  }

  let {
    open = false,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    details = [],
    onconfirm,
    oncancel,
  }: Props = $props();

  function handleConfirm() {
    onconfirm?.();
  }

  function handleCancel() {
    oncancel?.();
  }
</script>

{#if open}
  <ModalShell onclose={handleCancel} maxWidth="520px" maxHeight="min(88vh, 640px)">
    {#snippet children()}
      <div class="critical-modal">
        <div class="eyebrow">Critical confirmation</div>
        <h2>{title}</h2>
        <p class="message">{message}</p>

        {#if details.length}
          <ul class="details">
            {#each details as detail}
              <li>{detail}</li>
            {/each}
          </ul>
        {/if}

        <div class="actions">
          <button class="cancel" type="button" onclick={handleCancel}>{cancelLabel}</button>
          <button class="confirm" type="button" onclick={handleConfirm}>{confirmLabel}</button>
        </div>
      </div>
    {/snippet}
  </ModalShell>
{/if}

<style>
  .critical-modal {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 24px;
    background:
      radial-gradient(circle at top right, rgba(255, 107, 122, 0.16), transparent 45%),
      linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.02));
    color: rgba(255, 255, 255, 0.92);
  }

  .eyebrow {
    display: inline-flex;
    width: fit-content;
    border-radius: 999px;
    padding: 6px 10px;
    border: 1px solid rgba(255, 107, 122, 0.25);
    background: rgba(255, 107, 122, 0.1);
    color: #ffb1bb;
    font-family: var(--fm);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h2,
  .message {
    margin: 0;
  }

  h2 {
    font-family: var(--fd);
    font-size: 26px;
    line-height: 1.05;
  }

  .message,
  .details {
    font-family: var(--fb);
    font-size: 14px;
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.7);
  }

  .details {
    margin: 0;
    padding-left: 20px;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 8px;
  }

  .cancel,
  .confirm {
    min-width: 120px;
    border-radius: 12px;
    padding: 12px 14px;
    font-family: var(--fm);
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.04em;
    cursor: pointer;
  }

  .cancel {
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.78);
  }

  .confirm {
    border: 1px solid rgba(255, 107, 122, 0.28);
    background: rgba(255, 107, 122, 0.16);
    color: #ffd1d7;
  }

  @media (max-width: 640px) {
    .critical-modal {
      padding: 20px;
    }

    .actions {
      flex-direction: column-reverse;
    }

    .cancel,
    .confirm {
      width: 100%;
    }
  }
</style>
