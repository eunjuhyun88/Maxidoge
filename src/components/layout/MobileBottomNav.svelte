<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { openTradeCount } from '$lib/stores/quickTradeStore';
  import { activeSignalCount } from '$lib/stores/trackedSignalStore';
  import { buildArenaLink, buildDeepLink } from '$lib/utils/deepLinks';

  type NavItem = {
    path: string;
    label: string;
    icon: string;
    badge?: number;
  };

  const activePath = $derived($page.url.pathname);
  const trackedSignals = $derived($activeSignalCount);
  const openPositions = $derived($openTradeCount);

  const items = $derived<NavItem[]>([
    { path: '/terminal', label: 'Terminal', icon: '~' },
    { path: '/arena', label: 'Arena', icon: '>' },
    { path: '/signals', label: 'Signals', icon: '#', badge: trackedSignals > 0 ? trackedSignals : undefined },
    { path: '/passport', label: 'Passport', icon: '@', badge: openPositions > 0 ? openPositions : undefined },
  ]);

  function isActive(path: string): boolean {
    if (path === '/arena') {
      return activePath === '/arena' || activePath.startsWith('/arena-war') || activePath.startsWith('/arena-v2');
    }
    if (path === '/passport') {
      return activePath.startsWith('/passport') || activePath.startsWith('/settings') || activePath.startsWith('/agents');
    }
    return activePath.startsWith(path);
  }

  function hrefFor(path: string): string {
    if (path === '/arena') return buildArenaLink();
    return buildDeepLink(path);
  }
</script>

<nav class="mobile-nav" aria-label="Primary mobile navigation">
  {#each items as item (item.path)}
    <button
      class="mobile-nav-item"
      class:active={isActive(item.path)}
      type="button"
      onclick={() => goto(hrefFor(item.path))}
      aria-current={isActive(item.path) ? 'page' : undefined}
    >
      <span class="icon" aria-hidden="true">{item.icon}</span>
      <span class="label">{item.label}</span>
      {#if item.badge}
        <span class="badge">{item.badge > 99 ? '99+' : item.badge}</span>
      {/if}
    </button>
  {/each}
</nav>

<style>
  .mobile-nav {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: var(--sc-z-sticky, 140);
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0;
    height: calc(var(--sc-mobile-nav-h, 64px) + env(safe-area-inset-bottom, 0px));
    padding-bottom: env(safe-area-inset-bottom, 0px);
    background: rgba(10, 14, 18, 0.96);
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(18px);
  }

  .mobile-nav-item {
    position: relative;
    display: grid;
    place-items: center;
    gap: 4px;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.58);
    font-family: var(--sc-font-pixel);
    cursor: pointer;
  }

  .mobile-nav-item.active {
    color: #f0ede4;
    background: rgba(232, 150, 125, 0.08);
  }

  .mobile-nav-item.active::before {
    content: '';
    position: absolute;
    top: 0;
    left: 18%;
    right: 18%;
    height: 2px;
    border-radius: 0 0 999px 999px;
    background: #e8967d;
    box-shadow: 0 0 8px rgba(232, 150, 125, 0.4);
  }

  .icon {
    font-size: 14px;
    line-height: 1;
  }

  .label {
    font-size: 9px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .badge {
    position: absolute;
    top: 8px;
    right: calc(50% - 22px);
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: #e8967d;
    color: #151010;
    font-family: var(--sc-font-mono);
    font-size: 10px;
    font-weight: 700;
  }
</style>
