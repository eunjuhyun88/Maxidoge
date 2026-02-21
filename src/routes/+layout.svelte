<script lang="ts">
  import '../app.css';
  import Header from '../components/layout/Header.svelte';
  import BottomBar from '../components/layout/BottomBar.svelte';
  import WalletModal from '../components/modals/WalletModal.svelte';
  import NotificationTray from '../components/shared/NotificationTray.svelte';
  import ToastStack from '../components/shared/ToastStack.svelte';
  import P0Banner from '../components/shared/P0Banner.svelte';
  import { page } from '$app/stores';
  import { gameState } from '$lib/stores/gameState';
  import { derived } from 'svelte/store';

  let { children } = $props();

  // Derive isArena from page store (only actual /arena/* pages, not home /)
  const isArena = derived(page, $p => $p.url.pathname.startsWith('/arena'));

  // Sync currentView store from URL via effect
  $effect(() => {
    const path = $page.url.pathname;
    const view = path.startsWith('/terminal') ? 'terminal'
      : path.startsWith('/passport') ? 'passport'
      : path.startsWith('/arena') ? 'arena'
      : 'arena';
    gameState.update(s => {
      if (s.currentView !== view) return { ...s, currentView: view };
      return s;
    });
  });
</script>

<div id="app">
  <Header />
  <P0Banner />
  <div id="main-content">
    {@render children()}
  </div>
  {#if $isArena}
    <BottomBar />
  {/if}
</div>

<!-- Global Wallet Modal -->
<WalletModal />

<!-- Global Notification Tray (bottom-right bell + slide-up panel) -->
<NotificationTray />

<!-- Global Toast Stack (bottom-right, above bell) -->
<ToastStack />

<style>
  #app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    padding-top: 42px;
    overflow: hidden;
    position: relative;
  }
  #main-content {
    flex: 1;
    overflow: hidden;
    position: relative;
  }
</style>
