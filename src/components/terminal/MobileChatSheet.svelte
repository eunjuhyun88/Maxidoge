<!-- ═══════════════════════════════════════════════════════════════
     MobileChatSheet — AI chat panel (split pane or overlay sheet)
     splitMode: fills parent flex pane, no handle/backdrop/input
     overlay mode: peek (40px) | half (~50vh) | full (~90vh)
═══════════════════════════════════════════════════════════════ -->
<script lang="ts">
  import type { ChatMsg, MobileChatSheetState } from '$lib/terminal/terminalTypes';

  interface Props {
    splitMode?: boolean;
    sheetState?: MobileChatSheetState;
    chatMessages?: ChatMsg[];
    isTyping?: boolean;
    onSendChat?: (detail: { text: string }) => void | Promise<void>;
    onGoToTrade?: () => void;
    onSheetStateChange?: (next: MobileChatSheetState) => void;
    onGoToFullChat?: () => void;
  }

  let {
    splitMode = false,
    sheetState = 'peek',
    chatMessages = [],
    isTyping = false,
    onSendChat = () => {},
    onGoToTrade = () => {},
    onSheetStateChange = () => {},
    onGoToFullChat = () => {},
  }: Props = $props();

  let chatText = $state('');
  let inputEl = $state<HTMLInputElement | null>(null);
  let scrollEl = $state<HTMLDivElement | null>(null);
  let dragStartY = $state(0);
  let dragging = $state(false);
  let dragOffset = $state(0);

  const lastAiMsg = $derived(
    chatMessages.filter(m => !m.isUser).at(-1)
  );

  // Height map (overlay mode only)
  const heightMap: Record<MobileChatSheetState, number> = {
    closed: 0,
    peek: 40,
    half: 50,
    full: 88,
  };

  function getHeightStyle(): string {
    if (splitMode) return '';
    if (dragging && dragOffset !== 0) {
      const baseVh = sheetState === 'peek' ? 6 : heightMap[sheetState];
      const offsetVh = (dragOffset / window.innerHeight) * 100;
      const totalVh = Math.max(6, Math.min(90, baseVh + offsetVh));
      return `height: ${totalVh}vh`;
    }
    if (sheetState === 'peek') return 'height: 40px';
    if (sheetState === 'closed') return 'height: 0px';
    return `height: ${heightMap[sheetState]}vh`;
  }

  function handleSend() {
    const text = chatText.trim();
    if (!text) return;
    onSendChat({ text });
    chatText = '';
    if (!splitMode && sheetState === 'peek') {
      onSheetStateChange('half');
    }
    requestAnimationFrame(() => {
      scrollEl?.scrollTo({ top: scrollEl.scrollHeight, behavior: 'smooth' });
    });
  }

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'Escape' && !splitMode) {
      onSheetStateChange('closed');
    }
  }

  function handleHandleTap() {
    if (sheetState === 'peek') onSheetStateChange('half');
    else if (sheetState === 'half') onSheetStateChange('closed');
    else if (sheetState === 'full') onSheetStateChange('half');
  }

  // ── Drag gesture (overlay mode only) ──
  function onDragStart(e: PointerEvent) {
    if (splitMode) return;
    dragging = true;
    dragStartY = e.clientY;
    dragOffset = 0;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onDragMove(e: PointerEvent) {
    if (!dragging) return;
    dragOffset = -(e.clientY - dragStartY);
  }

  function onDragEnd() {
    if (!dragging) return;
    dragging = false;

    const threshold = window.innerHeight * 0.08;
    if (dragOffset > threshold) {
      if (sheetState === 'peek') onSheetStateChange('half');
      else if (sheetState === 'half') onSheetStateChange('full');
    } else if (dragOffset < -threshold) {
      if (sheetState === 'full') onSheetStateChange('half');
      else if (sheetState === 'half') onSheetStateChange('closed');
    }
    dragOffset = 0;
  }

  // Auto-scroll on new message
  $effect(() => {
    if (chatMessages.length > 0 && scrollEl) {
      const shouldScroll = splitMode || (sheetState !== 'peek' && sheetState !== 'closed');
      if (shouldScroll) {
        requestAnimationFrame(() => {
          scrollEl?.scrollTo({ top: scrollEl.scrollHeight, behavior: 'smooth' });
        });
      }
    }
  });

  // Focus input when expanding (overlay mode)
  $effect(() => {
    if (!splitMode && (sheetState === 'half' || sheetState === 'full')) {
      requestAnimationFrame(() => inputEl?.focus());
    }
  });
</script>

{#if splitMode}
  <!-- ══ Split pane mode: fills parent, no header chrome ══ -->
  <div class="mcs mcs-split">
    <div class="mcs-messages" bind:this={scrollEl}>
      {#if chatMessages.length === 0 && !isTyping}
        <div class="mcs-empty">
          <span class="mcs-empty-icon">💬</span>
          <span class="mcs-empty-text">Ask AI about this chart...</span>
        </div>
      {/if}
      {#each chatMessages as msg}
        <div class="mcs-msg" class:mcs-msg-user={msg.isUser} class:mcs-msg-system={msg.isSystem}>
          {#if !msg.isUser && !msg.isSystem}
            <span class="mcs-msg-icon" style="color:{msg.color}">{msg.icon}</span>
          {/if}
          <div class="mcs-msg-body">
            {#if !msg.isUser && !msg.isSystem}
              <span class="mcs-msg-from" style="color:{msg.color}">{msg.from}</span>
            {/if}
            <span class="mcs-msg-text">{msg.text}</span>
            <span class="mcs-msg-time">{msg.time}</span>
          </div>
        </div>
      {/each}
      {#if isTyping}
        <div class="mcs-msg">
          <span class="mcs-msg-icon" style="color:#e8967d">🤖</span>
          <div class="mcs-msg-body">
            <span class="mcs-msg-typing">thinking...</span>
          </div>
        </div>
      {/if}
    </div>

    <div class="mcs-input-row">
      <input
        bind:this={inputEl}
        class="mcs-input"
        type="text"
        placeholder="Ask about the chart..."
        bind:value={chatText}
        onkeydown={handleKey}
      />
      <button class="mcs-send" onclick={handleSend} disabled={!chatText.trim()}>→</button>
    </div>
  </div>

{:else if sheetState !== 'closed'}
  <!-- ══ Overlay sheet mode (original) ══ -->
  {#if sheetState === 'half' || sheetState === 'full'}
    <button
      class="mcs-backdrop"
      class:mcs-backdrop-visible={sheetState === 'full'}
      onclick={() => onSheetStateChange('closed')}
      aria-label="Close chat sheet"
    ></button>
  {/if}

  <div
    class="mcs"
    class:mcs-peek={sheetState === 'peek'}
    class:mcs-half={sheetState === 'half'}
    class:mcs-full={sheetState === 'full'}
    class:mcs-dragging={dragging}
    style={getHeightStyle()}
  >
    <!-- Drag handle -->
    <div
      class="mcs-handle"
      role="button"
      tabindex="0"
      aria-label="Drag to resize chat"
      onpointerdown={onDragStart}
      onpointermove={onDragMove}
      onpointerup={onDragEnd}
      onpointercancel={onDragEnd}
      onclick={handleHandleTap}
      onkeydown={(e) => { if (e.key === 'Enter') handleHandleTap(); }}
    >
      <span class="mcs-handle-bar"></span>
    </div>

    {#if sheetState === 'peek'}
      <div class="mcs-peek-row">
        {#if isTyping}
          <span class="mcs-peek-typing">AI typing...</span>
        {:else if lastAiMsg}
          <span class="mcs-peek-tag">AI</span>
          <span class="mcs-peek-text">{lastAiMsg.text}</span>
        {:else}
          <span class="mcs-peek-placeholder">Ask AI about this chart...</span>
        {/if}
        <button class="mcs-peek-expand" onclick={() => onSheetStateChange('half')}>▲</button>
      </div>
    {:else}
      <div class="mcs-header">
        <span class="mcs-header-tag">AI CHAT</span>
        <button class="mcs-header-full" onclick={onGoToFullChat}>FULL VIEW →</button>
      </div>

      <div class="mcs-messages" bind:this={scrollEl}>
        {#each chatMessages as msg}
          <div class="mcs-msg" class:mcs-msg-user={msg.isUser} class:mcs-msg-system={msg.isSystem}>
            {#if !msg.isUser && !msg.isSystem}
              <span class="mcs-msg-icon" style="color:{msg.color}">{msg.icon}</span>
            {/if}
            <div class="mcs-msg-body">
              {#if !msg.isUser && !msg.isSystem}
                <span class="mcs-msg-from" style="color:{msg.color}">{msg.from}</span>
              {/if}
              <span class="mcs-msg-text">{msg.text}</span>
              <span class="mcs-msg-time">{msg.time}</span>
            </div>
          </div>
        {/each}
        {#if isTyping}
          <div class="mcs-msg">
            <span class="mcs-msg-icon" style="color:#e8967d">🤖</span>
            <div class="mcs-msg-body">
              <span class="mcs-msg-typing">thinking...</span>
            </div>
          </div>
        {/if}
      </div>

      <div class="mcs-input-row">
        <input
          bind:this={inputEl}
          class="mcs-input"
          type="text"
          placeholder="Ask about the chart..."
          bind:value={chatText}
          onkeydown={handleKey}
        />
        <button class="mcs-send" onclick={handleSend} disabled={!chatText.trim()}>→</button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .mcs-backdrop {
    position: fixed;
    inset: 0;
    z-index: 19;
    background: transparent;
    border: none;
    cursor: default;
    transition: background 0.25s;
  }
  .mcs-backdrop-visible {
    background: rgba(0, 0, 0, 0.35);
  }

  .mcs {
    position: relative;
    z-index: 20;
    display: flex;
    flex-direction: column;
    background: rgba(8, 18, 13, 0.97);
    border-top: 1px solid rgba(232, 150, 125, 0.15);
    border-radius: 10px 10px 0 0;
    flex-shrink: 0;
    width: 100%;
    overflow: hidden;
    transition: height 0.3s cubic-bezier(0.32, 0.72, 0, 1);
  }
  .mcs-dragging { transition: none; }

  /* ── Split pane mode: fill parent, no fixed height ── */
  .mcs-split {
    flex: 1 1 auto;
    min-height: 0;
    height: auto;
    border-radius: 0;
    border-top: none;
    transition: none;
  }

  .mcs-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 5px 0 3px;
    cursor: grab;
    touch-action: none;
    flex-shrink: 0;
  }
  .mcs-handle:active { cursor: grabbing; }
  .mcs-handle-bar {
    width: 32px;
    height: 3px;
    border-radius: 1.5px;
    background: rgba(240, 237, 228, 0.2);
  }

  .mcs-peek-row {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 0 8px 4px;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  .mcs-peek-tag {
    font-size: 8px;
    font-weight: 900;
    color: #0b1b12;
    background: #e8967d;
    border-radius: 2px;
    padding: 2px 4px;
    flex-shrink: 0;
  }
  .mcs-peek-text {
    font-family: var(--fm, 'JetBrains Mono', monospace);
    font-size: 10px;
    color: rgba(240, 237, 228, 0.6);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }
  .mcs-peek-typing {
    font-family: var(--fm, 'JetBrains Mono', monospace);
    font-size: 10px;
    color: rgba(232, 150, 125, 0.5);
    font-style: italic;
    flex: 1;
  }
  .mcs-peek-placeholder {
    font-family: var(--fm, 'JetBrains Mono', monospace);
    font-size: 10px;
    color: rgba(240, 237, 228, 0.25);
    flex: 1;
  }
  .mcs-peek-expand {
    width: 24px;
    height: 24px;
    border: 1px solid rgba(240, 237, 228, 0.1);
    border-radius: 4px;
    background: transparent;
    color: rgba(240, 237, 228, 0.3);
    font-size: 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .mcs-peek-expand:active { opacity: 0.7; }

  .mcs-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 10px;
    flex-shrink: 0;
  }
  .mcs-header-tag {
    font-family: var(--fm, 'JetBrains Mono', monospace);
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 1px;
    color: rgba(232, 150, 125, 0.7);
  }
  .mcs-header-full {
    border: none;
    background: none;
    font-family: var(--fm, 'JetBrains Mono', monospace);
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.5px;
    color: rgba(232, 150, 125, 0.5);
    cursor: pointer;
    padding: 2px 4px;
  }
  .mcs-header-full:active { color: rgba(232, 150, 125, 0.8); }

  .mcs-messages {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    padding: 0 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .mcs-messages::-webkit-scrollbar { width: 2px; }
  .mcs-messages::-webkit-scrollbar-thumb {
    background: rgba(232, 150, 125, 0.2);
    border-radius: 1px;
  }

  /* ── Empty state ── */
  .mcs-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 20px;
    flex: 1;
    min-height: 60px;
  }
  .mcs-empty-icon { font-size: 20px; opacity: 0.3; }
  .mcs-empty-text {
    font-family: var(--fm, 'JetBrains Mono', monospace);
    font-size: 10px;
    color: rgba(240, 237, 228, 0.2);
  }

  .mcs-msg {
    display: flex;
    gap: 6px;
    align-items: flex-start;
  }
  .mcs-msg-user { justify-content: flex-end; }
  .mcs-msg-icon {
    font-size: 14px;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .mcs-msg-body {
    display: flex;
    flex-direction: column;
    gap: 1px;
    max-width: 85%;
  }
  .mcs-msg-user .mcs-msg-body {
    align-items: flex-end;
    background: rgba(232, 150, 125, 0.08);
    border-radius: 8px 8px 2px 8px;
    padding: 5px 8px;
  }
  .mcs-msg-from {
    font-family: var(--fm, 'JetBrains Mono', monospace);
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.5px;
  }
  .mcs-msg-text {
    font-family: var(--fm, 'JetBrains Mono', monospace);
    font-size: 11px;
    color: rgba(240, 237, 228, 0.8);
    line-height: 1.45;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .mcs-msg-user .mcs-msg-text {
    color: rgba(240, 237, 228, 0.9);
  }
  .mcs-msg-time {
    font-family: var(--fm, 'JetBrains Mono', monospace);
    font-size: 8px;
    color: rgba(240, 237, 228, 0.25);
  }
  .mcs-msg-typing {
    font-family: var(--fm, 'JetBrains Mono', monospace);
    font-size: 10px;
    color: rgba(232, 150, 125, 0.5);
    font-style: italic;
  }
  .mcs-msg-system .mcs-msg-text {
    font-size: 9px;
    color: rgba(240, 237, 228, 0.4);
    font-style: italic;
  }

  .mcs-input-row {
    display: flex;
    gap: 4px;
    padding: 4px 8px;
    flex-shrink: 0;
    border-top: 1px solid rgba(240, 237, 228, 0.06);
  }
  .mcs-input {
    flex: 1;
    height: 28px;
    padding: 0 8px;
    border: 1px solid rgba(232, 150, 125, 0.2);
    border-radius: 5px;
    background: rgba(240, 237, 228, 0.04);
    color: #F0EDE4;
    font-family: var(--fm, 'JetBrains Mono', monospace);
    font-size: 12px;
    outline: none;
  }
  .mcs-input::placeholder {
    color: rgba(240, 237, 228, 0.25);
  }
  .mcs-send {
    width: 28px;
    height: 28px;
    border: 1px solid rgba(232, 150, 125, 0.2);
    border-radius: 6px;
    background: rgba(232, 150, 125, 0.1);
    color: #e8967d;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .mcs-send:disabled { opacity: 0.3; cursor: default; }
  .mcs-send:not(:disabled):active { opacity: 0.7; }
</style>
