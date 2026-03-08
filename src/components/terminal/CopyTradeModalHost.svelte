<script lang="ts">
  interface Props {
    isOpen?: boolean;
  }

  let { isOpen = false }: Props = $props();
  let copyTradeModalModule = $state<Promise<typeof import('../modals/CopyTradeModal.svelte')> | null>(null);

  $effect(() => {
    if (isOpen) {
      copyTradeModalModule ??= import('../modals/CopyTradeModal.svelte');
    }
  });
</script>

{#if copyTradeModalModule}
  {#await copyTradeModalModule then copyTradeModalNs}
    <copyTradeModalNs.default />
  {/await}
{/if}
