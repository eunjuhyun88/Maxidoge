<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  // Holdings merged into Passport — redirect
  onMount(() => { goto('/passport', { replaceState: true }); });
</script>

<div class="holdings-redirect tm-page-shell">
  REDIRECTING TO PASSPORT...
</div>

<style>
  .holdings-redirect {
    min-height: calc(100vh - var(--app-header-h, 46px));
    display: grid;
    place-content: center;
    padding: 20px;
    text-align: center;
    font-family: var(--fm, 'JetBrains Mono', monospace);
    color: var(--tm-text-low);
    font-size: 13px;
    letter-spacing: 0.12em;
    background:
      radial-gradient(circle at 20% 14%, rgba(241,164,136,0.08), transparent 44%),
      radial-gradient(circle at 86% 8%, rgba(136,200,255,0.1), transparent 40%),
      linear-gradient(180deg, var(--tm-bg-1), var(--tm-bg-0));
  }
</style>
