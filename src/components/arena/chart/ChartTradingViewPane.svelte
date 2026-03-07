<script lang="ts">
  import { onDestroy } from 'svelte';
  import { pairToTradingViewSymbol } from '$lib/chart/tradingviewEmbed';

  interface Props {
    pair: string;
    tvLoading?: boolean;
    tvFallbackTried?: boolean;
    tvError?: string;
    tvSafeMode?: boolean;
    onRetry?: () => void;
    onSwitchAgent?: () => void;
    onContainerReady?: (container: HTMLDivElement | null) => void;
  }

  let {
    pair,
    tvLoading = false,
    tvFallbackTried = false,
    tvError = '',
    tvSafeMode = false,
    onRetry = () => {},
    onSwitchAgent = () => {},
    onContainerReady = () => {},
  }: Props = $props();

  let containerEl: HTMLDivElement | null = null;

  $effect(() => {
    onContainerReady(containerEl);
  });

  onDestroy(() => {
    onContainerReady(null);
  });
</script>

<div class="tv-container" bind:this={containerEl}>
  <div id="tradingview_widget" style="width:100%;height:100%"></div>
  {#if tvLoading}
    <div class="loading-overlay tv-skeleton">
      <div class="tv-skeleton-bars"></div>
      <div class="tv-skeleton-content">
        <div class="loader"></div>
        <span>Loading TradingView...</span>
        {#if tvFallbackTried}
          <button class="tv-fallback-btn" onclick={onSwitchAgent}>Agent 차트로 전환</button>
        {/if}
      </div>
    </div>
  {/if}
  {#if tvError}
    <div class="tv-error-card">
      <div class="tv-error-title">TradingView 연결 오류</div>
      <div class="tv-error-desc">{tvError}</div>
      <div class="tv-error-actions">
        <button class="tv-retry-btn" onclick={onRetry}>다시 시도</button>
        <a
          class="tv-open-link"
          href={`https://www.tradingview.com/chart/?symbol=${pairToTradingViewSymbol(pair)}`}
          target="_blank"
          rel="noreferrer"
        >
          TradingView에서 열기
        </a>
      </div>
      {#if tvSafeMode}
        <div class="tv-safe-hint">Safe mode로 재시도 중</div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .tv-container {
    flex: 1;
    position: relative;
    overflow: hidden;
    background: #0a0a1a;
  }

  .tv-container :global(iframe) {
    width: 100% !important;
    height: 100% !important;
    border: none !important;
  }

  .loading-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: rgba(10, 10, 26, 0.9);
    z-index: 10;
    color: #d0d6df;
    font-size: 10px;
    font-family: var(--fm);
  }

  .loader {
    width: 24px;
    height: 24px;
    border: 2px solid rgba(232, 150, 125, 0.2);
    border-top-color: #e8967d;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  .tv-error-card {
    position: absolute;
    inset: auto 16px 16px 16px;
    z-index: 12;
    padding: 14px 16px;
    border-radius: 14px;
    border: 1px solid rgba(232, 150, 125, 0.32);
    background: rgba(13, 17, 25, 0.94);
    backdrop-filter: blur(12px);
    box-shadow: 0 18px 44px rgba(0, 0, 0, 0.42);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .tv-error-title {
    font-family: var(--fd);
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 0.8px;
    color: #f4f7fb;
  }

  .tv-error-desc {
    font-family: var(--fm);
    font-size: 11px;
    line-height: 1.5;
    color: rgba(216, 223, 235, 0.82);
  }

  .tv-error-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .tv-retry-btn {
    border: 1px solid rgba(232, 150, 125, 0.42);
    background: rgba(232, 150, 125, 0.14);
    color: #f4f7fb;
    border-radius: 999px;
    padding: 8px 12px;
    font-family: var(--fd);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.6px;
    cursor: pointer;
  }

  .tv-retry-btn:hover {
    background: rgba(232, 150, 125, 0.24);
  }

  .tv-open-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 8px 12px;
    border-radius: 999px;
    border: 1px solid rgba(122, 162, 255, 0.32);
    color: #a7c4ff;
    text-decoration: none;
    font-family: var(--fd);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.6px;
    background: rgba(122, 162, 255, 0.1);
  }

  .tv-open-link:hover {
    background: rgba(122, 162, 255, 0.18);
  }

  .tv-safe-hint {
    font-family: var(--fm);
    font-size: 10px;
    color: rgba(232, 150, 125, 0.9);
    letter-spacing: 0.2px;
  }

  .tv-skeleton {
    overflow: hidden;
  }

  .tv-skeleton-bars {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(90deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.06) 50%, rgba(255, 255, 255, 0.02) 100%);
    transform: translateX(-100%);
    animation: shimmer 1.6s infinite;
  }

  .tv-skeleton-content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .tv-fallback-btn {
    border: 1px solid rgba(232, 150, 125, 0.28);
    background: rgba(232, 150, 125, 0.14);
    color: #f4f7fb;
    border-radius: 999px;
    padding: 7px 10px;
    font-family: var(--fd);
    font-size: 10px;
    cursor: pointer;
  }

  .tv-fallback-btn:hover {
    background: rgba(232, 150, 125, 0.25);
  }

  @keyframes shimmer {
    100% {
      transform: translateX(100%);
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
