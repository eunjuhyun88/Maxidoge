<script lang="ts">
  import VerdictCard from '../VerdictCard.svelte';
  import type { PolicyDecision, ShadowDecision, ShadowRuntime } from '../intelTypes';
  import { shadowSourceLabel } from '../intelHelpers';
  import { gameState } from '$lib/stores/gameState';

  interface ChatMessage {
    from: string;
    icon: string;
    color: string;
    text: string;
    time: string;
    isUser: boolean;
    isSystem?: boolean;
  }

  interface Props {
    chatMessages?: ChatMessage[];
    isTyping?: boolean;
    chatTradeReady?: boolean;
    chatConnectionStatus?: 'connected' | 'degraded' | 'disconnected';
    policyDecision?: PolicyDecision | null;
    policyLoading?: boolean;
    shadowDecision?: ShadowDecision | null;
    shadowLoading?: boolean;
    shadowExecutionEnabled?: boolean;
    showDebugModel?: boolean;
    onSendChat?: (text: string) => void;
    onGoToTrade?: () => void;
    onExecuteShadow?: () => void;
  }

  let {
    chatMessages = [],
    isTyping = false,
    chatTradeReady = false,
    chatConnectionStatus = 'connected',
    policyDecision = null,
    policyLoading = false,
    shadowDecision = null,
    shadowLoading = false,
    shadowExecutionEnabled = false,
    showDebugModel = false,
    onSendChat = () => {},
    onGoToTrade = () => {},
    onExecuteShadow = () => {},
  }: Props = $props();

  let chatInput = $state('');
  let chatEl: HTMLDivElement;
  let _isComposing = $state(false);

  function sendChat() {
    if (!chatInput.trim()) return;
    onSendChat(chatInput);
    chatInput = '';
  }

  function chatKey(e: KeyboardEvent) {
    if (e.isComposing || _isComposing) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      sendChat();
    }
  }

  $effect(() => {
    if (chatMessages.length && chatEl) {
      setTimeout(() => { if (chatEl) chatEl.scrollTop = chatEl.scrollHeight; }, 50);
    }
  });
</script>

<VerdictCard
  bias={shadowDecision?.enforced.bias ?? policyDecision?.bias ?? 'wait'}
  confidence={shadowDecision?.proposal.confidence ?? policyDecision?.confidence ?? 0}
  pair={$gameState.pair || 'BTC/USDT'}
  timeframe={$gameState.timeframe || '4h'}
  reason={shadowDecision?.proposal.nowWhat ?? policyDecision?.reasons?.[0] ?? ''}
  edgePct={policyDecision?.edgePct ?? null}
  gateScore={policyDecision?.qualityGateScore ?? null}
  shouldExecute={shadowDecision?.enforced.shouldExecute ?? false}
  model={shadowDecision && showDebugModel ? shadowSourceLabel(shadowDecision) : null}
  showModelMeta={showDebugModel}
  loading={policyLoading || shadowLoading}
  executionEnabled={shadowExecutionEnabled}
  onexecute={onExecuteShadow}
/>

<div class="rp-body chat-mode">
  <div class="ac-section ac-embedded">
    <div class="ac-header">
      <span class="ac-title">🤖 AGENT CHAT <span class="ac-status-dot ac-status-{chatConnectionStatus}" title="{chatConnectionStatus === 'connected' ? 'Connected' : chatConnectionStatus === 'degraded' ? 'Degraded' : 'Disconnected'}"></span></span>
      <button
        class="ac-trade-btn"
        class:ready={chatTradeReady}
        onclick={onGoToTrade}
        disabled={!chatTradeReady}
        title={chatTradeReady ? 'Move to chart and start drag trade planner' : 'Ask in chat first to unlock trade action'}
      >
        TRADE ON CHART
      </button>
    </div>
    <div class="ac-msgs" bind:this={chatEl}>
      {#each chatMessages as msg}
        {#if msg.isSystem}
          <div class="ac-sys">{msg.icon} {msg.text}</div>
        {:else if msg.isUser}
          <div class="ac-row ac-right">
            <div class="ac-bub ac-bub-user">
              <span class="ac-txt">{msg.text}</span>
            </div>
          </div>
        {:else}
          <div class="ac-row ac-left">
            <span class="ac-av" style="border-color:{msg.color}">{msg.icon}</span>
            <div class="ac-bub ac-bub-agent">
              <span class="ac-name" style="color:{msg.color}">{msg.from}</span>
              <span class="ac-txt">{msg.text}</span>
            </div>
          </div>
        {/if}
      {/each}
      {#if isTyping}
        <div class="ac-row ac-left">
          <span class="ac-av" style="border-color:#ff2d9b">🧠</span>
          <div class="ac-bub ac-bub-agent"><span class="ac-dots"><span></span><span></span><span></span></span></div>
        </div>
      {/if}
    </div>
    <div class="ac-input">
      <input type="text" bind:value={chatInput} onkeydown={chatKey} oncompositionstart={() => _isComposing = true} oncompositionend={() => _isComposing = false} placeholder="@STRUCTURE @FLOW @DERIV ..." />
      <button class="ac-send" onclick={sendChat} disabled={!chatInput.trim()}>⚡</button>
    </div>
  </div>
</div>

<style>
  .rp-body.chat-mode { padding: 0; overflow: hidden; flex: 1; min-height: 0; display: flex; flex-direction: column; }

  .ac-section {
    display: flex; flex-direction: column; flex: 1 1 0%; min-height: 0;
    background: rgba(0,0,0,.3);
  }
  .ac-section.ac-embedded { border-top: 0; }
  .ac-status-dot {
    display: inline-block; width: 6px; height: 6px; border-radius: 50%;
    margin-left: 4px; vertical-align: middle;
  }
  .ac-status-connected { background: #00ff88; box-shadow: 0 0 4px #00ff88; }
  .ac-status-degraded { background: #ffaa00; box-shadow: 0 0 4px #ffaa00; animation: pulse-dot 2s infinite; }
  .ac-status-disconnected { background: #ff2d55; box-shadow: 0 0 4px #ff2d55; animation: pulse-dot 1.5s infinite; }
  @keyframes pulse-dot { 0%,100% { opacity: 1; } 50% { opacity: .4; } }

  .ac-header {
    display: flex; align-items: center; gap: 6px;
    justify-content: space-between; padding: 5px 8px 3px; flex-shrink: 0;
  }
  .ac-title {
    font-family: var(--fm); font-size: 10px; font-weight: 900;
    letter-spacing: 2px; color: var(--yel);
  }
  .ac-trade-btn {
    border: 1px solid rgba(255, 255, 255, 0.22);
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.58);
    border-radius: 999px; padding: 3px 8px;
    font-family: var(--fm); font-size: 8px; font-weight: 800;
    letter-spacing: .65px; white-space: nowrap;
    cursor: not-allowed; transition: all .12s ease;
  }
  .ac-trade-btn.ready {
    border-color: rgba(0, 255, 136, 0.46);
    background: rgba(0, 255, 136, 0.18);
    color: #d9ffe9; cursor: pointer;
  }
  .ac-trade-btn.ready:hover {
    border-color: rgba(0, 255, 136, 0.7);
    background: rgba(0, 255, 136, 0.28);
    color: #f4fff8;
  }
  .ac-trade-btn:disabled { opacity: 0.66; }

  .ac-msgs {
    flex: 1; overflow-y: auto; display: flex; flex-direction: column;
    gap: 8px; padding: 8px; min-height: 0;
    scroll-behavior: smooth; -webkit-overflow-scrolling: touch;
    overscroll-behavior-y: contain;
  }
  .ac-msgs::-webkit-scrollbar { width: 2px; }
  .ac-msgs::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }

  .ac-sys {
    font-family: var(--fm); font-size: 10px; color: rgba(255,255,255,.58);
    padding: 5px 8px; background: rgba(var(--t-accent-rgb),.04);
    border-left: 2px solid rgba(var(--t-accent-rgb),.2);
  }
  .ac-row { display: flex; gap: 5px; }
  .ac-right { justify-content: flex-end; }
  .ac-left { justify-content: flex-start; }
  .ac-av {
    width: 20px; height: 20px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; border: 1.5px solid; flex-shrink: 0;
    background: rgba(255,255,255,.03);
  }
  .ac-bub { max-width: 85%; padding: 6px 9px; border-radius: 6px; }
  .ac-bub-user { background: rgba(var(--t-accent-rgb),.12); border: 1px solid rgba(var(--t-accent-rgb),.2); margin-left: auto; }
  .ac-bub-agent { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); }
  .ac-name { font-family: var(--fm); font-size: 10px; font-weight: 800; letter-spacing: 1px; display: block; margin-bottom: 2px; }
  .ac-txt { font-family: var(--fm); font-size: 11px; color: rgba(255,255,255,.84); line-height: 1.5; white-space: pre-line; }
  .ac-dots { display: flex; gap: 3px; padding: 4px 0; }
  .ac-dots span { width: 4px; height: 4px; border-radius: 50%; background: rgba(255,255,255,.3); animation: dotBounce .6s infinite; }
  .ac-dots span:nth-child(2) { animation-delay: .15s; }
  .ac-dots span:nth-child(3) { animation-delay: .3s; }
  @keyframes dotBounce { 0%,100%{opacity:.3} 50%{opacity:1} }

  .ac-input {
    display: flex; align-items: center; gap: 6px; padding: 6px 8px 8px;
    border-top: 1px solid rgba(255,255,255,.08); flex-shrink: 0;
    background: rgba(5, 9, 7, .85);
  }
  .ac-input input {
    flex: 1; height: 34px; background: rgba(255,255,255,.05);
    border: 1px solid rgba(255,255,255,.12); border-radius: 6px; padding: 0 10px;
    font-family: var(--fm); font-size: 11px; color: #fff; outline: none;
  }
  .ac-input input::placeholder { color: rgba(255,255,255,.3); }
  .ac-input input:focus { border-color: rgba(var(--t-accent-rgb),.5); background: rgba(255,255,255,.07); }
  .ac-send {
    width: 34px; height: 34px; background: var(--yel); color: #000;
    border: none; border-radius: 6px; font-size: 13px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; transition: opacity .12s;
  }
  .ac-send:hover { opacity: .85; }
  .ac-send:disabled { opacity: .25; cursor: not-allowed; }
</style>
