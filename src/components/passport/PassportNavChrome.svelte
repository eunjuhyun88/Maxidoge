<script lang="ts">
  import { focusToneClass, type PassportTabType } from './passportHelpers';
  import type { PassportFocusCard } from '$lib/passport/passportSummaryViewModel';

  interface PassportTabNavItem {
    id: PassportTabType;
    label: string;
    icon: string;
  }

  interface Props {
    tabs: PassportTabNavItem[];
    activeTab: PassportTabType;
    openPos: number;
    recordCount: number;
    walletConnected: boolean;
    holdingsSyncing: boolean;
    showFocusInsights: boolean;
    focusCards: PassportFocusCard[];
    onSelectTab: (tab: PassportTabType) => void;
    onSyncHoldings: () => void;
    onOpenWalletModal: () => void;
  }

  let {
    tabs,
    activeTab,
    openPos,
    recordCount,
    walletConnected,
    holdingsSyncing,
    showFocusInsights,
    focusCards,
    onSelectTab,
    onSyncHoldings,
    onOpenWalletModal,
  }: Props = $props();
</script>

<div class="passport-nav-chrome">
  <div class="tab-bar">
    {#each tabs as tab}
      <button
        class="tab-btn"
        class:active={activeTab === tab.id}
        onclick={() => onSelectTab(tab.id)}
      >
        <span class="tab-icon">{tab.icon}</span>
        <span class="tab-label">{tab.label}</span>
        {#if tab.id === 'positions' && openPos > 0}
          <span class="tab-badge">{openPos}</span>
        {/if}
        {#if tab.id === 'arena' && recordCount > 0}
          <span class="tab-badge">{recordCount}</span>
        {/if}
      </button>
    {/each}
  </div>

  <div class="control-rail">
    <div class="quick-actions">
      <a class="qa-btn qa-terminal" href="/terminal" data-gtm-area="passport" data-gtm-action="open_terminal">
        QUICK TRADE
      </a>
      {#if activeTab !== 'arena'}
        <a class="qa-btn qa-arena" href="/arena" data-gtm-area="passport" data-gtm-action="open_arena">
          START ARENA
        </a>
      {/if}
      {#if activeTab === 'wallet' && walletConnected}
        <button class="qa-btn qa-sync" onclick={onSyncHoldings} disabled={holdingsSyncing} data-gtm-area="passport" data-gtm-action="sync_holdings">
          {holdingsSyncing ? 'SYNCING...' : 'SYNC HOLDINGS'}
        </button>
      {/if}
      {#if !walletConnected}
        <button class="qa-btn qa-wallet" onclick={onOpenWalletModal} data-gtm-area="passport" data-gtm-action="connect_wallet">
          CONNECT WALLET
        </button>
      {/if}
    </div>
  </div>

  {#if showFocusInsights}
    <div class="focus-strip">
      {#each focusCards as card, index (card.key)}
        <div class={`focus-item ${card.primary || index === 0 ? 'focus-item-primary' : ''} ${focusToneClass(card.tone)}`}>
          <span class="focus-k">{card.key}</span>
          <span class="focus-v">{card.value}</span>
          <span class="focus-sub">{card.sub}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .tab-bar {
    display: flex;
    position: sticky;
    top: 0;
    z-index: 9;
    background: rgba(0, 0, 0, 0.26);
    backdrop-filter: blur(8px);
    border-top: 1px solid var(--sp-line);
    border-bottom: 1px solid var(--sp-line);
  }

  .tab-btn {
    position: relative;
    flex: 1;
    min-height: 48px;
    border: none;
    border-bottom: 2px solid transparent;
    background: transparent;
    color: var(--sp-dim);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--sp-space-2);
    font-family: var(--fp);
    font-size: 10px;
    letter-spacing: 0.12px;
    cursor: pointer;
  }

  .tab-btn:hover {
    color: var(--sp-w);
    background: rgba(255, 140, 121, 0.06);
  }

  .tab-btn.active {
    color: var(--sp-pk-l);
    border-bottom-color: var(--sp-pk);
    background: rgba(255, 140, 121, 0.08);
    box-shadow: inset 0 -2px 0 rgba(255, 140, 121, 0.6);
  }

  .tab-icon {
    font-size: 16px;
    line-height: 1;
  }

  .tab-label {
    font-size: 10px;
    letter-spacing: 0.1px;
  }

  .tab-badge {
    position: absolute;
    top: 5px;
    right: 8px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 999px;
    background: var(--sp-pk);
    color: #111;
    font-family: var(--fp);
    font-size: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .control-rail {
    position: sticky;
    top: 48px;
    z-index: 8;
    padding: var(--sp-space-2) var(--sp-space-3);
    border-bottom: 1px solid var(--sp-soft);
    background: rgba(0, 0, 0, 0.22);
    backdrop-filter: blur(8px);
  }

  .quick-actions {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    gap: var(--sp-space-2);
    overflow-x: auto;
    padding-bottom: var(--sp-space-1);
  }

  .qa-btn {
    min-height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    padding: 0 12px;
    text-decoration: none;
    white-space: nowrap;
    font-family: var(--fp);
    font-size: 10px;
    letter-spacing: 0.08px;
    border: 1px solid var(--sp-line);
    color: var(--sp-w);
    background: rgba(0, 0, 0, 0.25);
    cursor: pointer;
  }

  .qa-btn:hover {
    background: rgba(255, 140, 121, 0.12);
    border-color: rgba(255, 140, 121, 0.42);
  }

  .qa-terminal {
    color: var(--sp-pk-l);
  }

  .qa-arena {
    color: var(--sp-green);
  }

  .qa-sync {
    color: #8bd8ff;
  }

  .qa-sync:disabled,
  .qa-btn:disabled {
    opacity: 0.62;
    cursor: default;
  }

  .qa-wallet {
    color: #cbefff;
  }

  .focus-strip {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--sp-space-2);
    padding: var(--sp-space-3) var(--sp-space-3) var(--sp-space-4);
    border-bottom: 1px solid var(--sp-soft);
    background: linear-gradient(180deg, rgba(8, 23, 16, 0.72), rgba(6, 18, 13, 0.62));
  }

  .focus-item {
    border: 1px solid var(--sp-soft);
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.24);
    padding: var(--sp-space-2) var(--sp-space-3);
    display: flex;
    flex-direction: column;
    gap: var(--sp-space-2);
    min-height: 78px;
  }

  .focus-item-primary {
    border-color: rgba(255, 140, 121, 0.42);
    background: rgba(255, 140, 121, 0.1);
  }

  .focus-k {
    color: var(--sp-dim);
    font-family: var(--fp);
    font-size: 9px;
    letter-spacing: 0.08px;
  }

  .focus-v {
    color: var(--sp-w);
    font-family: var(--fd);
    font-size: clamp(14px, 1.8vw, 18px);
    line-height: 1.05;
  }

  .focus-sub {
    color: var(--sp-dim);
    font-family: var(--fm);
    font-size: 11px;
    line-height: 1.32;
  }

  .focus-good {
    border-color: rgba(157, 205, 185, 0.34);
    background: rgba(157, 205, 185, 0.08);
  }

  .focus-good .focus-v {
    color: var(--sp-green);
  }

  .focus-warn {
    border-color: rgba(255, 208, 96, 0.34);
    background: rgba(255, 208, 96, 0.08);
  }

  .focus-warn .focus-v {
    color: #ffd060;
  }

  .focus-bad {
    border-color: rgba(255, 114, 93, 0.42);
    background: rgba(255, 114, 93, 0.1);
  }

  .focus-bad .focus-v {
    color: var(--sp-red);
  }

  .focus-neutral {
    border-color: var(--sp-soft);
    background: rgba(255, 255, 255, 0.02);
  }

  @media (max-width: 1024px) {
    .focus-strip {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .control-rail {
      position: relative;
      top: auto;
      z-index: 1;
      padding: var(--sp-space-2) var(--sp-space-3);
      backdrop-filter: none;
    }
  }

  @media (max-width: 768px) {
    .quick-actions {
      justify-content: flex-start;
    }

    .qa-btn {
      min-height: var(--sc-touch-sm, 36px);
    }

    .focus-strip {
      grid-template-columns: 1fr;
      padding: var(--sp-space-2);
    }

    .focus-item {
      min-height: 60px;
      padding: var(--sp-space-2);
    }

    .tab-bar {
      overflow-x: auto;
      scrollbar-width: none;
      -ms-overflow-style: none;
      -webkit-overflow-scrolling: touch;
    }

    .tab-bar::-webkit-scrollbar {
      display: none;
    }

    .tab-btn {
      flex: 0 0 auto;
      min-width: 80px;
      min-height: 42px;
      padding: 0 10px;
    }

    .tab-icon {
      font-size: 14px;
    }

    .tab-label {
      font-size: 9px;
    }
  }

  @media (max-width: 480px) {
    .focus-strip {
      padding: var(--sp-space-1);
      gap: var(--sp-space-1);
    }

    .focus-item {
      min-height: auto;
      padding: var(--sp-space-1) var(--sp-space-2);
      gap: var(--sp-space-1);
    }

    .focus-v {
      font-size: clamp(13px, 3.5vw, 16px);
    }

    .focus-sub {
      font-size: 10px;
    }

    .tab-btn {
      min-width: 72px;
      min-height: 40px;
      padding: 0 8px;
      gap: 3px;
    }

    .tab-icon {
      font-size: 12px;
    }

    .tab-label {
      font-size: var(--sc-fs-2xs, 9px);
    }

    .control-rail {
      padding: var(--sp-space-1) var(--sp-space-2);
    }

    .quick-actions {
      gap: var(--sp-space-1);
    }

    .qa-btn {
      min-height: var(--sc-touch-sm, 36px);
      padding: 0 8px;
      font-size: 9px;
    }
  }
</style>
