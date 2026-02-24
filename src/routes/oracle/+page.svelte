<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  onMount(() => {
    void goto('/signals?view=oracle', {
      replaceState: true,
      noScroll: true,
      keepFocus: true,
      invalidateAll: false
    });
  });
</script>

<div class="oracle-redirect tm-page-shell">
  <p>Redirecting to Community Oracle leaderboard...</p>
  <a href="/signals?view=oracle">Open now</a>
</div>

<style>
  .oracle-redirect {
    min-height: calc(100vh - var(--app-header-h, 46px));
    display: grid;
    place-content: center;
    gap: 12px;
    padding: 20px;
    text-align: center;
    background:
      radial-gradient(circle at 18% 12%, rgba(241,164,136,0.14), transparent 42%),
      radial-gradient(circle at 82% 6%, rgba(136,200,255,0.16), transparent 38%),
      linear-gradient(180deg, var(--tm-bg-1), var(--tm-bg-0));
    color: var(--tm-text-mid);
    font-family: var(--fm, 'JetBrains Mono', monospace);
    letter-spacing: 0.02em;
  }

  .oracle-redirect a {
    color: var(--tm-accent-cool);
    text-decoration: none;
    font-weight: 700;
    border: 1px solid rgba(136,200,255,0.32);
    border-radius: 999px;
    padding: 8px 14px;
    justify-self: center;
    background: rgba(136,200,255,0.08);
    transition: background .15s ease, border-color .15s ease;
  }
  .oracle-redirect a:hover {
    background: rgba(136,200,255,0.16);
    border-color: rgba(136,200,255,0.58);
  }
</style>
