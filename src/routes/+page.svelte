<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { isWalletConnected } from '$lib/stores/walletStore';
  import { openWalletModal } from '$lib/stores/walletModalStore';
  import { userLifecycleStore } from '$lib/stores/userLifecycleStore';
  import HomeBackground from '../components/home/HomeBackground.svelte';
  import { buildTerminalLink, buildArenaLink } from '$lib/utils/deepLinks';

  const connected = $derived($isWalletConnected);
  const lifecycle = $derived($userLifecycleStore);

  // Returning user (matchesPlayed > 0) → skip Home, go straight to Terminal
  onMount(() => {
    if (lifecycle.matchesPlayed > 0) {
      goto(buildTerminalLink(), { replaceState: true });
    }
  });

  function enterTerminal() { goto(buildTerminalLink()); }
  function enterArena() { goto(buildArenaLink()); }
  function connectWallet() { openWalletModal(); }
</script>

<HomeBackground />

<main class="home">
  <section class="hero">
    <p class="eyebrow">AI-Powered Trading Arena</p>
    <h1>Your AI vs.&nbsp;The&nbsp;Market.</h1>
    <p class="subtitle">
      Train AI agents, battle in real-time arenas, and sharpen conviction before risking real capital.
    </p>

    <div class="ctas">
      <button class="cta-primary" type="button" onclick={enterTerminal}>
        Open Terminal
      </button>
      {#if connected}
        <button class="cta-secondary" type="button" onclick={enterArena}>
          Enter Arena
        </button>
      {:else}
        <button class="cta-secondary" type="button" onclick={connectWallet}>
          Connect Wallet
        </button>
      {/if}
    </div>

    <p class="hint">No sign-up required — explore the terminal instantly</p>
  </section>
</main>

<style>
  .home {
    position: relative;
    z-index: 1;
    display: grid;
    place-items: center;
    min-height: 100%;
    padding: var(--sc-sp-6) var(--sc-sp-4);
    overflow: auto;
  }

  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--sc-sp-4);
    max-width: 620px;
  }

  .eyebrow {
    margin: 0;
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-2xs);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--sc-accent);
    opacity: 0.85;
  }

  h1 {
    margin: 0;
    font-family: var(--sc-font-display);
    font-size: clamp(1.8rem, 5vw, 3rem);
    line-height: 1.08;
    color: var(--sc-text-0);
    letter-spacing: -0.01em;
  }

  .subtitle {
    margin: 0;
    max-width: 48ch;
    font-family: var(--sc-font-body);
    font-size: var(--sc-fs-base);
    line-height: 1.6;
    color: var(--sc-text-2);
  }

  .ctas {
    display: flex;
    align-items: center;
    gap: var(--sc-sp-3);
    margin-top: var(--sc-sp-2);
  }

  .cta-primary,
  .cta-secondary {
    font-family: var(--sc-font-pixel);
    font-size: var(--sc-fs-xs);
    letter-spacing: 1px;
    border-radius: var(--sc-radius-md);
    padding: var(--sc-sp-3) var(--sc-sp-5);
    cursor: pointer;
    transition: all var(--sc-duration-fast);
    white-space: nowrap;
  }

  .cta-primary {
    background: var(--sc-accent);
    color: var(--sc-bg-0);
    border: none;
    box-shadow: var(--sc-shadow-glow);
  }
  .cta-primary:hover {
    box-shadow: 0 0 24px rgba(232, 150, 125, 0.45);
    transform: translateY(-2px);
  }
  .cta-primary:active {
    transform: scale(0.97);
    opacity: 0.9;
  }

  .cta-secondary {
    background: transparent;
    color: var(--sc-text-1);
    border: 1px solid var(--sc-line-hard);
  }
  .cta-secondary:hover {
    background: var(--sc-accent-bg-subtle);
    color: var(--sc-text-0);
    border-color: var(--sc-accent);
  }
  .cta-secondary:active {
    transform: scale(0.97);
    opacity: 0.85;
  }

  .hint {
    margin: 0;
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-2xs);
    color: var(--sc-text-3);
    letter-spacing: 0.03em;
  }

  /* ═══ MOBILE (≤ 768px) — thumb-zone CTAs ═══ */
  @media (max-width: 768px) {
    .home {
      align-content: end;
      padding-bottom: var(--sc-sp-8);
    }

    .hero {
      gap: var(--sc-sp-3);
    }

    h1 {
      font-size: clamp(1.5rem, 6vw, 2.2rem);
    }

    .subtitle {
      font-size: var(--sc-fs-sm);
    }

    .ctas {
      flex-direction: column;
      width: 100%;
    }

    .cta-primary,
    .cta-secondary {
      width: 100%;
      text-align: center;
      padding: var(--sc-sp-3) var(--sc-sp-4);
      min-height: var(--sc-touch-lg, 48px);
    }
  }
</style>
