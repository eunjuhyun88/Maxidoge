<script lang="ts">
  import { quickTradeStore, openTrades, closedTrades, totalQuickPnL, closeQuickTrade, clearClosedTrades } from '$lib/stores/quickTradeStore';
  import { trackedSignalStore, activeSignals, activeSignalCount, convertToTrade, removeTracked, clearExpired } from '$lib/stores/trackedSignalStore';
  import { gameState } from '$lib/stores/gameState';
  import { AGDEFS } from '$lib/data/agents';
  import { onMount } from 'svelte';

  // ── Chat state (migrated from TerminalChat) ──
  interface ChatMsg {
    from: string;
    icon: string;
    color: string;
    text: string;
    time: string;
    isUser: boolean;
    isSystem?: boolean;
  }

  let chatMessages: ChatMsg[] = [
    { from: 'SYSTEM', icon: '🤖', color: '#ffe600', text: 'Stockclaw Orchestrator v8 online.', time: '—', isUser: false, isSystem: true },
  ];
  let chatInput = '';
  let chatEl: HTMLDivElement;
  let isTyping = false;

  const agentResponses: Record<string, string[]> = {
    ORCHESTRATOR: ['Analyzing across 7 agents...', 'Running backtest... 68% win rate detected.', 'Consensus updated.'],
    STRUCTURE: ['CHoCH on 4H confirmed. OB zone at $95,400.', 'BOS above $97,800. Bullish intact.'],
    FLOW: ['Net flow: -$128M accumulation. Whales increasing.', 'Exchange outflows rising.'],
    DERIV: ['OI +4.2% with positive delta.', 'FR at +0.082% — extreme. Liq near $96.8K.'],
  };

  // ── Activity log ──
  interface Activity {
    id: string;
    icon: string;
    text: string;
    time: number;
    color: string;
  }

  let activities: Activity[] = [];

  export function addActivity(icon: string, text: string, color: string = '#fff') {
    activities = [{ id: crypto.randomUUID(), icon, text, time: Date.now(), color }, ...activities].slice(0, 50);
  }

  // ── Tab state ──
  type Tab = 'positions' | 'tracked' | 'chat' | 'activity';
  let activeTab: Tab = 'positions';
  let collapsed = false;

  export function activateTab(tab: Tab) {
    activeTab = tab;
    collapsed = false;
  }

  // ── Reactive ──
  $: state = $gameState;
  $: opens = $openTrades;
  $: closed = $closedTrades;
  $: totalPnl = $totalQuickPnL;
  $: tracked = $activeSignals;
  $: trackedCount = $activeSignalCount;

  // ── Trade actions ──
  function handleCloseTrade(tradeId: string) {
    const trade = opens.find(t => t.id === tradeId);
    if (!trade) return;
    const token = trade.pair.split('/')[0] as keyof typeof state.prices;
    const currentPrice = state.prices[token] || state.prices.BTC;
    closeQuickTrade(tradeId, currentPrice);
    const pnl = trade.pnlPercent;
    addActivity(pnl >= 0 ? '🟢' : '🔴', `Closed ${trade.dir} ${trade.pair} · ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}%`, pnl >= 0 ? 'var(--grn)' : 'var(--red)');
  }

  function handleConvert(signalId: string) {
    const sig = tracked.find(s => s.id === signalId);
    if (!sig) return;
    const token = sig.pair.split('/')[0] as keyof typeof state.prices;
    const price = state.prices[token] || state.prices.BTC;
    convertToTrade(signalId, price);
    addActivity('📊', `Converted ${sig.dir} ${sig.pair} to trade`, 'var(--yel)');
    activeTab = 'positions';
  }

  // ── Chat ──
  function sendChat() {
    if (!chatInput.trim()) return;
    const now = new Date();
    const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;
    chatMessages = [...chatMessages, { from: 'YOU', icon: '🐕', color: '#ffe600', text: chatInput, time, isUser: true }];
    const q = chatInput;
    chatInput = '';
    scrollChat();
    isTyping = true;

    const agent = AGDEFS.find(ag => q.toLowerCase().includes(`@${ag.name.toLowerCase()}`));
    setTimeout(() => {
      isTyping = false;
      const pool = agent ? (agentResponses[agent.name] || agentResponses.ORCHESTRATOR) : agentResponses.ORCHESTRATOR;
      const resp = pool[Math.floor(Math.random() * pool.length)];
      chatMessages = [...chatMessages, {
        from: agent?.name || 'ORCHESTRATOR',
        icon: agent?.icon || '🧠',
        color: agent?.color || '#ff2d9b',
        text: resp, time, isUser: false
      }];
      scrollChat();
    }, 800 + Math.random() * 600);
  }

  function scrollChat() {
    setTimeout(() => { if (chatEl) chatEl.scrollTop = chatEl.scrollHeight; }, 50);
  }
  function chatKey(e: KeyboardEvent) { if (e.key === 'Enter') sendChat(); }

  // ── Helpers ──
  function pnlColor(n: number) { return n >= 0 ? 'var(--grn)' : 'var(--red)'; }
  function pnlPfx(n: number) { return n >= 0 ? '+' : ''; }
  function timeSince(ts: number) {
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m`;
    return `${Math.floor(sec / 3600)}h`;
  }
  function timeLeft(ts: number) {
    const ms = ts - Date.now();
    if (ms <= 0) return 'expired';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${m}m`;
  }

  onMount(() => scrollChat());
</script>

<div class="bp" class:collapsed>
  <!-- Tab Bar -->
  <div class="bp-tabs">
    <button class="bp-tab" class:active={activeTab === 'positions'} on:click={() => { activeTab = 'positions'; collapsed = false; }}>
      POSITIONS
      {#if opens.length > 0}<span class="bp-badge">{opens.length}</span>{/if}
    </button>
    <button class="bp-tab" class:active={activeTab === 'tracked'} on:click={() => { activeTab = 'tracked'; collapsed = false; }}>
      TRACKED
      {#if trackedCount > 0}<span class="bp-badge bp-badge-cyan">{trackedCount}</span>{/if}
    </button>
    <button class="bp-tab" class:active={activeTab === 'chat'} on:click={() => { activeTab = 'chat'; collapsed = false; }}>
      CHAT
    </button>
    <button class="bp-tab" class:active={activeTab === 'activity'} on:click={() => { activeTab = 'activity'; collapsed = false; }}>
      ACTIVITY
      {#if activities.length > 0}<span class="bp-badge bp-badge-dim">{activities.length}</span>{/if}
    </button>
    <div class="bp-tabs-right">
      <span class="bp-pnl" style="color:{pnlColor(totalPnl)}">{pnlPfx(totalPnl)}{totalPnl.toFixed(2)}%</span>
      <button class="bp-collapse" on:click={() => collapsed = !collapsed}>{collapsed ? '▲' : '▼'}</button>
    </div>
  </div>

  <!-- Content Area -->
  {#if !collapsed}
  <div class="bp-content">
    <!-- POSITIONS (open only) -->
    {#if activeTab === 'positions'}
      <div class="bp-body">
        {#if opens.length > 0}
          {#each opens as trade (trade.id)}
            <div class="bp-row">
              <span class="bp-dir" class:long={trade.dir === 'LONG'} class:short={trade.dir === 'SHORT'}>
                {trade.dir === 'LONG' ? '▲' : '▼'}{trade.dir}
              </span>
              <span class="bp-pair">{trade.pair}</span>
              <span class="bp-src">{trade.source}</span>
              <span class="bp-entry">${Math.round(trade.entry).toLocaleString()}</span>
              <span class="bp-pnl-val" style="color:{pnlColor(trade.pnlPercent)}">
                {pnlPfx(trade.pnlPercent)}{trade.pnlPercent}%
              </span>
              <span class="bp-time">{timeSince(trade.openedAt)}</span>
              <button class="bp-action-btn bp-close-btn" on:click={() => handleCloseTrade(trade.id)}>CLOSE</button>
            </div>
          {/each}
        {:else}
          <div class="bp-empty">No open positions. Use QUICK LONG/SHORT in War Room.</div>
        {/if}
      </div>

    <!-- TRACKED -->
    {:else if activeTab === 'tracked'}
      <div class="bp-body">
        {#if tracked.length > 0}
          {#each tracked as sig (sig.id)}
            <div class="bp-row">
              <span class="bp-dir" class:long={sig.dir === 'LONG'} class:short={sig.dir === 'SHORT'}>
                {sig.dir === 'LONG' ? '▲' : '▼'}{sig.dir}
              </span>
              <span class="bp-pair">{sig.pair}</span>
              <span class="bp-src">{sig.source}</span>
              <span class="bp-conf">{sig.confidence}%</span>
              <span class="bp-pnl-val" style="color:{pnlColor(sig.pnlPercent)}">
                {pnlPfx(sig.pnlPercent)}{sig.pnlPercent}%
              </span>
              <span class="bp-time bp-expire">⏱{timeLeft(sig.expiresAt)}</span>
              <button class="bp-action-btn bp-trade-btn" on:click={() => handleConvert(sig.id)}>TRADE</button>
              <button class="bp-action-btn bp-rm-btn" on:click={() => removeTracked(sig.id)}>✕</button>
            </div>
          {/each}
        {:else}
          <div class="bp-empty">No tracked signals. Use TRACK in War Room to watch signals.</div>
        {/if}
        {#if $trackedSignalStore.signals.filter(s => s.status === 'expired').length > 0}
          <button class="bp-clear" on:click={clearExpired}>CLEAR EXPIRED</button>
        {/if}
      </div>

    <!-- CHAT -->
    {:else if activeTab === 'chat'}
      <div class="bp-chat">
        <div class="bp-chat-msgs" bind:this={chatEl}>
          {#each chatMessages as msg}
            {#if msg.isSystem}
              <div class="cm-sys"><span>{msg.icon}</span> <span>{msg.text}</span></div>
            {:else if msg.isUser}
              <div class="cm-row cm-right">
                <div class="cm-bub cm-bub-user">
                  <span class="cm-txt">{msg.text}</span>
                  <span class="cm-time">{msg.time}</span>
                </div>
              </div>
            {:else}
              <div class="cm-row cm-left">
                <span class="cm-av" style="border-color:{msg.color}">{msg.icon}</span>
                <div class="cm-bub cm-bub-agent">
                  <span class="cm-name" style="color:{msg.color}">{msg.from}</span>
                  <span class="cm-txt">{msg.text}</span>
                  <span class="cm-time">{msg.time}</span>
                </div>
              </div>
            {/if}
          {/each}
          {#if isTyping}
            <div class="cm-row cm-left">
              <span class="cm-av" style="border-color:#ff2d9b">🧠</span>
              <div class="cm-bub cm-bub-agent"><span class="cm-dots"><span></span><span></span><span></span></span></div>
            </div>
          {/if}
        </div>
        <div class="bp-chat-input">
          <input type="text" bind:value={chatInput} on:keydown={chatKey} placeholder="Ask agents... (@STRUCTURE, @FLOW...)" />
          <button class="bp-send" on:click={sendChat} disabled={!chatInput.trim()}>⚡</button>
        </div>
      </div>

    <!-- ACTIVITY (includes closed trades + all events) -->
    {:else if activeTab === 'activity'}
      <div class="bp-body">
        <!-- Closed Trades History -->
        {#if closed.length > 0}
          <div class="bp-section-lbl">TRADE HISTORY</div>
          {#each closed.slice(0, 8) as trade (trade.id)}
            <div class="bp-row bp-row-closed">
              <span class="bp-dir" class:long={trade.dir === 'LONG'} class:short={trade.dir === 'SHORT'}>
                {trade.dir === 'LONG' ? '▲' : '▼'}
              </span>
              <span class="bp-pair">{trade.pair}</span>
              <span class="bp-src">{trade.source}</span>
              <span class="bp-pnl-val" style="color:{pnlColor(trade.closePnl || 0)}">
                {pnlPfx(trade.closePnl || 0)}{(trade.closePnl || 0).toFixed(2)}%
              </span>
            </div>
          {/each}
          <button class="bp-clear" on:click={clearClosedTrades}>CLEAR HISTORY</button>
        {/if}

        <!-- Activity Log -->
        {#if activities.length > 0}
          <div class="bp-section-lbl">ACTIVITY LOG</div>
          {#each activities as act (act.id)}
            <div class="bp-row bp-act-row">
              <span class="bp-act-icon">{act.icon}</span>
              <span class="bp-act-text" style="color:{act.color}">{act.text}</span>
              <span class="bp-time">{timeSince(act.time)}</span>
            </div>
          {/each}
        {/if}

        {#if closed.length === 0 && activities.length === 0}
          <div class="bp-empty">No activity yet. Start trading!</div>
        {/if}
      </div>
    {/if}
  </div>
  {/if}
</div>

<style>
  .bp {
    flex-shrink: 0;
    background: #0a0a1a;
    border-top: 3px solid var(--yel);
    display: flex;
    flex-direction: column;
    max-height: 240px;
    transition: max-height .2s ease;
  }
  .bp.collapsed { max-height: 30px; }

  /* Tabs */
  .bp-tabs {
    display: flex;
    align-items: center;
    gap: 0;
    flex-shrink: 0;
    background: linear-gradient(90deg, #0f0f28, #1a0f28);
    border-bottom: 1px solid rgba(255,230,0,.1);
  }
  .bp-tab {
    padding: 6px 12px;
    font-family: var(--fm);
    font-size: 8px;
    font-weight: 900;
    letter-spacing: 1.5px;
    color: rgba(255,255,255,.3);
    background: none;
    border: none;
    cursor: pointer;
    transition: all .15s;
    display: flex;
    align-items: center;
    gap: 4px;
    border-bottom: 2px solid transparent;
  }
  .bp-tab:hover { color: rgba(255,255,255,.6); }
  .bp-tab.active {
    color: var(--yel);
    border-bottom-color: var(--yel);
    background: rgba(255,230,0,.04);
  }
  .bp-badge {
    font-size: 7px;
    background: var(--yel);
    color: #000;
    padding: 1px 4px;
    border-radius: 8px;
    font-weight: 900;
  }
  .bp-badge-cyan { background: var(--cyan); }
  .bp-badge-dim { background: rgba(255,255,255,.2); color: #fff; }
  .bp-tabs-right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 8px;
    padding-right: 8px;
  }
  .bp-pnl {
    font-family: var(--fd);
    font-size: 11px;
    font-weight: 900;
  }
  .bp-collapse {
    font-size: 10px;
    background: none;
    border: none;
    color: rgba(255,255,255,.3);
    cursor: pointer;
    padding: 2px;
  }
  .bp-collapse:hover { color: #fff; }

  /* Content */
  .bp-content {
    flex: 1;
    overflow: hidden;
    min-height: 0;
  }
  .bp-body {
    height: 100%;
    overflow-y: auto;
    padding: 4px 8px;
  }
  .bp-body::-webkit-scrollbar { width: 3px; }
  .bp-body::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }

  /* Rows */
  .bp-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 4px;
    border-bottom: 1px solid rgba(255,255,255,.04);
    font-family: var(--fm);
  }
  .bp-row:hover { background: rgba(255,255,255,.02); }
  .bp-row-closed { opacity: .4; }

  .bp-dir {
    font-size: 7px;
    font-weight: 900;
    padding: 2px 5px;
    border-radius: 3px;
    border: 1px solid;
    letter-spacing: .5px;
    white-space: nowrap;
  }
  .bp-dir.long { color: var(--grn); border-color: rgba(0,255,136,.3); background: rgba(0,255,136,.08); }
  .bp-dir.short { color: var(--red); border-color: rgba(255,45,85,.3); background: rgba(255,45,85,.08); }

  .bp-pair { font-size: 9px; font-weight: 700; color: rgba(255,255,255,.7); }
  .bp-src {
    font-size: 6px;
    color: rgba(255,255,255,.25);
    background: rgba(255,255,255,.04);
    padding: 1px 4px;
    border-radius: 3px;
  }
  .bp-conf {
    font-size: 8px;
    color: var(--cyan);
    font-weight: 700;
  }
  .bp-entry { font-size: 8px; color: rgba(255,255,255,.4); }
  .bp-pnl-val {
    font-family: var(--fd);
    font-size: 10px;
    font-weight: 900;
    min-width: 45px;
    text-align: right;
  }
  .bp-time { font-size: 7px; color: rgba(255,255,255,.2); }
  .bp-expire { color: var(--ora); }

  .bp-action-btn {
    font-family: var(--fm);
    font-size: 7px;
    font-weight: 900;
    letter-spacing: .5px;
    padding: 3px 6px;
    border-radius: 3px;
    cursor: pointer;
    transition: all .12s;
    border: 1px solid;
  }
  .bp-close-btn {
    background: rgba(255,45,85,.1);
    color: var(--red);
    border-color: rgba(255,45,85,.3);
  }
  .bp-close-btn:hover { background: rgba(255,45,85,.3); }
  .bp-trade-btn {
    background: rgba(0,255,136,.1);
    color: var(--grn);
    border-color: rgba(0,255,136,.3);
  }
  .bp-trade-btn:hover { background: rgba(0,255,136,.3); }
  .bp-rm-btn {
    background: rgba(255,255,255,.05);
    color: rgba(255,255,255,.3);
    border-color: rgba(255,255,255,.1);
    padding: 3px 5px;
  }
  .bp-rm-btn:hover { color: var(--red); border-color: var(--red); }

  .bp-empty {
    padding: 20px;
    text-align: center;
    font-size: 8px;
    color: rgba(255,255,255,.2);
    letter-spacing: 1px;
  }
  .bp-section-lbl {
    font-family: var(--fm);
    font-size: 7px;
    font-weight: 900;
    letter-spacing: 2px;
    color: rgba(255,255,255,.25);
    padding: 6px 4px 3px;
    border-bottom: 1px solid rgba(255,255,255,.06);
    margin-bottom: 2px;
  }
  .bp-section-lbl:not(:first-child) {
    margin-top: 6px;
    border-top: 1px solid rgba(255,255,255,.06);
    padding-top: 8px;
  }
  .bp-clear {
    width: 100%;
    padding: 4px;
    font-family: var(--fm);
    font-size: 7px;
    color: rgba(255,255,255,.2);
    background: none;
    border: none;
    cursor: pointer;
    text-align: center;
  }
  .bp-clear:hover { color: var(--red); }

  /* Activity */
  .bp-act-row { gap: 8px; }
  .bp-act-icon { font-size: 11px; }
  .bp-act-text { font-size: 8px; flex: 1; }

  /* Chat */
  .bp-chat {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .bp-chat-msgs {
    flex: 1;
    overflow-y: auto;
    padding: 6px 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-height: 0;
  }
  .bp-chat-msgs::-webkit-scrollbar { width: 3px; }
  .bp-chat-msgs::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }

  .cm-sys {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    font-size: 7px;
    color: rgba(255,230,0,.5);
    font-family: var(--fm);
    padding: 2px 8px;
    border: 1px dashed rgba(255,230,0,.1);
    border-radius: 12px;
    margin: 0 20px;
  }
  .cm-row { display: flex; align-items: flex-end; gap: 4px; max-width: 90%; }
  .cm-right { align-self: flex-end; }
  .cm-left { align-self: flex-start; }
  .cm-av {
    width: 20px; height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    flex-shrink: 0;
    border: 1.5px solid;
    background: rgba(255,255,255,.05);
  }
  .cm-bub {
    padding: 4px 8px;
    border-radius: 8px;
    min-width: 40px;
  }
  .cm-bub-user {
    background: rgba(255,230,0,.1);
    border: 1px solid rgba(255,230,0,.2);
    border-bottom-right-radius: 2px;
  }
  .cm-bub-agent {
    background: rgba(255,255,255,.03);
    border: 1px solid rgba(255,255,255,.06);
    border-bottom-left-radius: 2px;
  }
  .cm-name { font-size: 7px; font-weight: 900; font-family: var(--fd); letter-spacing: .5px; display: block; }
  .cm-txt { font-size: 8px; color: #ccc; font-family: var(--fm); line-height: 1.4; display: block; }
  .cm-bub-user .cm-txt { color: rgba(255,255,255,.9); }
  .cm-time { font-size: 6px; color: rgba(255,255,255,.2); font-family: var(--fm); display: block; text-align: right; }

  .cm-dots { display: flex; gap: 3px; padding: 2px 0; }
  .cm-dots span {
    width: 4px; height: 4px; border-radius: 50%;
    background: rgba(255,255,255,.3);
    animation: dotBounce 1.2s infinite;
  }
  .cm-dots span:nth-child(2) { animation-delay: .2s; }
  .cm-dots span:nth-child(3) { animation-delay: .4s; }
  @keyframes dotBounce {
    0%,60%,100% { transform: translateY(0); opacity: .3; }
    30% { transform: translateY(-3px); opacity: 1; }
  }

  .bp-chat-input {
    flex-shrink: 0;
    display: flex;
    gap: 4px;
    padding: 4px 8px 6px;
    border-top: 1px solid rgba(255,255,255,.06);
  }
  .bp-chat-input input {
    flex: 1;
    padding: 5px 8px;
    border-radius: 8px;
    background: rgba(255,255,255,.06);
    border: 1px solid rgba(255,255,255,.1);
    color: #fff;
    font-size: 8px;
    font-family: var(--fm);
    outline: none;
  }
  .bp-chat-input input::placeholder { color: #444; }
  .bp-chat-input input:focus { border-color: rgba(255,230,0,.3); }
  .bp-send {
    width: 28px;
    border-radius: 8px;
    background: var(--yel);
    border: 2px solid #000;
    color: #000;
    font-size: 11px;
    cursor: pointer;
    box-shadow: 2px 2px 0 #000;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .bp-send:hover:not(:disabled) { background: #ffcc00; }
  .bp-send:disabled { opacity: .3; cursor: default; }
</style>
