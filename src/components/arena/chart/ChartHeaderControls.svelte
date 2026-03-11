<script lang="ts">
  import type { ChartHeaderControlsProps } from './chartHeaderBarContracts';

  let {
    chartMode,
    isTvLikePreset = false,
    advancedMode = false,
    chatFirstMode = false,
    chatTradeReady = false,
    chatTradeDir = 'LONG',
    indicatorStripState = 'collapsed',
    hasActiveTradeSetup = false,
    onSetChartMode = () => {},
    onSetDrawingMode = () => {},
    onRequestChatAssist = () => {},
    onRequestAgentScan = () => {},
    onForcePatternScan = () => {},
    onPublishCommunitySignal = () => {},
    onRestoreIndicatorStrip = () => {},
  }: ChartHeaderControlsProps = $props();
</script>

<div class="bar-controls" class:tv-like={isTvLikePreset}>
  <div class="mode-toggle">
    <button class="mode-btn" class:active={chartMode === 'agent'} onclick={() => onSetChartMode('agent')}>
      AGENT
    </button>
    <button class="mode-btn" class:active={chartMode === 'trading'} onclick={() => onSetChartMode('trading')}>
      TRADING
    </button>
  </div>

  {#if chartMode === 'agent'}
    {#if chatFirstMode}
      <button
        class="scan-btn chat-trigger"
        class:ready={chatTradeReady}
        onclick={onRequestChatAssist}
        title={chatTradeReady ? `AI answer ready. Start ${chatTradeDir} drag on chart.` : 'Open Intel chat and ask AI first'}
      >
        {chatTradeReady ? `START ${chatTradeDir}` : 'OPEN CHAT'}
      </button>
    {:else}
      <button class="scan-btn" onclick={onRequestAgentScan} title="Run agent scan for current market">
        SCAN
      </button>
    {/if}

    <button
      class="scan-btn pattern-trigger"
      onclick={onForcePatternScan}
      title="Re-scan head and shoulders / falling wedge patterns"
    >
      PATTERN
    </button>

    <div class="opinion-actions">
      <button
        class="scan-btn view-btn long"
        class:ready={hasActiveTradeSetup}
        onclick={() => {
          if (hasActiveTradeSetup) {
            onPublishCommunitySignal('LONG');
          } else {
            onSetDrawingMode('trade');
          }
        }}
        title={hasActiveTradeSetup ? 'LONG 시그널 공유' : '먼저 차트에 포지션을 그리세요 (⬡ 도구)'}
      >
        ▲ LONG 공유
      </button>
      <button
        class="scan-btn view-btn short"
        class:ready={hasActiveTradeSetup}
        onclick={() => {
          if (hasActiveTradeSetup) {
            onPublishCommunitySignal('SHORT');
          } else {
            onSetDrawingMode('trade');
          }
        }}
        title={hasActiveTradeSetup ? 'SHORT 시그널 공유' : '먼저 차트에 포지션을 그리세요 (⬡ 도구)'}
      >
        ▼ SHORT 공유
      </button>
    </div>

    {#if advancedMode && indicatorStripState === 'hidden' && !isTvLikePreset}
      <button class="strip-restore-btn" onclick={onRestoreIndicatorStrip}>IND ON</button>
    {/if}
  {/if}
</div>

<style>
  .bar-controls {
    display: flex;
    align-items: center;
    gap: 2px;
    min-width: max-content;
    flex: 0 0 auto;
    padding-left: 8px;
    margin-left: 8px;
    border-left: 1px solid #363a45;
  }

  .mode-toggle {
    display: flex;
    gap: 0;
    border-radius: 4px;
    overflow: hidden;
    border: 1px solid #363a45;
  }

  .mode-btn {
    padding: 0 8px;
    height: 22px;
    background: transparent;
    border: none;
    color: #787b86;
    font-size: 11px;
    font-family: var(--fd);
    font-weight: 700;
    cursor: pointer;
    transition: color 0.1s, background 0.1s;
    display: flex;
    align-items: center;
    white-space: nowrap;
  }

  .mode-btn:first-child {
    border-right: 1px solid #363a45;
  }

  .mode-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #d1d4dc;
  }

  .mode-btn.active {
    background: rgba(41, 98, 255, 0.12);
    color: #5b9cf6;
  }

  .scan-btn {
    height: 22px;
    padding: 0 8px;
    border-radius: 4px;
    border: 1px solid #363a45;
    background: transparent;
    color: #d1d4dc;
    font-size: 11px;
    font-family: var(--fd);
    font-weight: 700;
    cursor: pointer;
    transition: color 0.1s, background 0.1s, border-color 0.1s;
    white-space: nowrap;
  }

  .scan-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: #4a4e59;
    color: #e6e6e6;
  }

  .scan-btn.chat-trigger {
    border-color: rgba(41, 98, 255, 0.4);
    color: #5b9cf6;
  }

  .scan-btn.chat-trigger:hover {
    border-color: rgba(41, 98, 255, 0.6);
    background: rgba(41, 98, 255, 0.1);
    color: #93bbfc;
  }

  .scan-btn.chat-trigger.ready {
    border-color: rgba(38, 166, 154, 0.5);
    color: #26a69a;
  }

  .scan-btn.chat-trigger.ready:hover {
    border-color: rgba(38, 166, 154, 0.7);
    background: rgba(38, 166, 154, 0.1);
    color: #4db6ac;
  }

  .scan-btn.pattern-trigger {
    color: #787b86;
  }

  .scan-btn.pattern-trigger:hover {
    color: #d1d4dc;
  }

  .opinion-actions {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .scan-btn.view-btn:not(.ready) {
    color: #787b86;
    border-style: dashed;
    border-color: #363a45;
  }

  .scan-btn.view-btn:not(.ready):hover {
    color: #d1d4dc;
    border-color: #4a4e59;
  }

  .scan-btn.view-btn.long {
    border-color: rgba(38, 166, 154, 0.5);
    color: #26a69a;
  }

  .scan-btn.view-btn.long:hover {
    border-color: rgba(38, 166, 154, 0.7);
    background: rgba(38, 166, 154, 0.08);
    color: #4db6ac;
  }

  .scan-btn.view-btn.short {
    border-color: rgba(239, 83, 80, 0.5);
    color: #ef5350;
  }

  .scan-btn.view-btn.short:hover {
    border-color: rgba(239, 83, 80, 0.7);
    background: rgba(239, 83, 80, 0.08);
    color: #f77c7a;
  }

  .strip-restore-btn {
    border: 1px solid #363a45;
    background: transparent;
    color: #787b86;
    border-radius: 4px;
    padding: 0 6px;
    height: 22px;
    font-family: var(--fd);
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
    transition: color 0.1s, background 0.1s;
    display: flex;
    align-items: center;
  }

  .strip-restore-btn:hover {
    color: #d1d4dc;
    background: rgba(255, 255, 255, 0.06);
  }

  .bar-controls.tv-like .mode-btn.active {
    background: rgba(41, 98, 255, 0.12);
    color: #5b9cf6;
  }

  .bar-controls.tv-like .scan-btn.view-btn.long {
    border-color: rgba(38, 166, 154, 0.5);
    color: #26a69a;
  }

  .bar-controls.tv-like .scan-btn.view-btn.short {
    border-color: rgba(239, 83, 80, 0.5);
    color: #ef5350;
  }

  @media (max-width: 1280px) {
    .pattern-trigger {
      display: none;
    }

    .scan-btn {
      padding: 0 6px;
    }

    .opinion-actions .scan-btn {
      padding: 0 5px;
      font-size: 10px;
    }
  }

  @media (max-width: 1024px) {
    .opinion-actions {
      display: none;
    }

    .mode-btn {
      padding: 0 5px;
      font-size: 10px;
    }

    .bar-controls {
      gap: 2px;
    }
  }

  @media (max-width: 768px) {
    .bar-controls {
      margin-left: 6px;
      padding-left: 6px;
      gap: 2px;
    }

    .mode-btn {
      height: 20px;
      padding: 0 6px;
      font-size: 10px;
    }

    .scan-btn {
      height: 20px;
      padding: 0 6px;
      font-size: 10px;
    }

    .opinion-actions {
      display: none;
    }

    .pattern-trigger {
      display: none;
    }

    .scan-btn:not(.chat-trigger) {
      display: none;
    }

    .scan-btn.chat-trigger {
      display: flex;
      align-items: center;
    }
  }
</style>
