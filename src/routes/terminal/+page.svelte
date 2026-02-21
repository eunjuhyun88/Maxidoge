<script lang="ts">
  import WarRoom from '../../components/terminal/WarRoom.svelte';
  import ChartPanel from '../../components/arena/ChartPanel.svelte';
  import IntelPanel from '../../components/terminal/IntelPanel.svelte';
  import TokenDropdown from '../../components/shared/TokenDropdown.svelte';
  import CopyTradeModal from '../../components/modals/CopyTradeModal.svelte';
  import { TICKER_DATA } from '$lib/data/warroom';
  import { AGDEFS } from '$lib/data/agents';

  const TICKER_STR = `${TICKER_DATA}  \u00a0|\u00a0  ${TICKER_DATA}`;
  import { gameState } from '$lib/stores/gameState';
  import { updateAllPrices } from '$lib/stores/quickTradeStore';
  import { updateTrackedPrices } from '$lib/stores/trackedSignalStore';
  import { onMount, onDestroy } from 'svelte';

  // ── Panel resize state ──
  let leftW = 280;       // War Room width
  let rightW = 300;      // Intel Panel width
  let containerEl: HTMLDivElement;
  let windowWidth = 1200;

  const MIN_LEFT = 200;
  const MAX_LEFT = 450;
  const MIN_RIGHT = 220;
  const MAX_RIGHT = 500;

  // Collapse state
  let leftCollapsed = false;
  let rightCollapsed = false;
  let savedLeftW = 280;
  let savedRightW = 300;

  function toggleLeft() {
    if (leftCollapsed) {
      leftW = savedLeftW;
      leftCollapsed = false;
    } else {
      savedLeftW = leftW;
      leftW = 0;
      leftCollapsed = true;
    }
  }
  function toggleRight() {
    if (rightCollapsed) {
      rightW = savedRightW;
      rightCollapsed = false;
    } else {
      savedRightW = rightW;
      rightW = 0;
      rightCollapsed = true;
    }
  }

  // Responsive breakpoints
  const BP_MOBILE = 768;
  const BP_TABLET = 1024;

  type DragTarget = 'left' | 'right' | null;
  let dragTarget: DragTarget = null;
  let dragStartX = 0;
  let dragStartVal = 0;

  // Responsive layout mode
  $: isMobile = windowWidth < BP_MOBILE;
  $: isTablet = windowWidth >= BP_MOBILE && windowWidth < BP_TABLET;
  $: isDesktop = windowWidth >= BP_TABLET;

  // Mobile tab control
  let mobileTab: 'warroom' | 'chart' | 'intel' = 'chart';

  function startDrag(target: DragTarget, e: MouseEvent) {
    if (isMobile || isTablet) return;
    dragTarget = target;
    dragStartX = e.clientX;
    if (target === 'left') dragStartVal = leftW;
    else if (target === 'right') dragStartVal = rightW;
    e.preventDefault();
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  function onMouseMove(e: MouseEvent) {
    if (!dragTarget) return;
    if (dragTarget === 'left') {
      const delta = e.clientX - dragStartX;
      leftW = Math.min(MAX_LEFT, Math.max(MIN_LEFT, dragStartVal + delta));
    } else if (dragTarget === 'right') {
      const delta = dragStartX - e.clientX;
      rightW = Math.min(MAX_RIGHT, Math.max(MIN_RIGHT, dragStartVal + delta));
    }
  }

  function onMouseUp() {
    if (!dragTarget) return;
    dragTarget = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }

  function handleResize() {
    windowWidth = window.innerWidth;
  }

  // Sync live prices to open quick trades every 2s
  let priceSync: ReturnType<typeof setInterval> | null = null;

  onMount(() => {
    windowWidth = window.innerWidth;
    window.addEventListener('resize', handleResize);
    priceSync = setInterval(() => {
      const s = $gameState;
      const prices = { BTC: s.prices.BTC, ETH: s.prices.ETH, SOL: s.prices.SOL };
      updateAllPrices(prices);
      updateTrackedPrices(prices);
    }, 10000);
  });

  onDestroy(() => {
    if (priceSync) clearInterval(priceSync);
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', handleResize);
    }
  });

  // Selected pair display
  $: pair = $gameState.pair || 'BTC/USDT';

  function onTokenSelect(e: CustomEvent<{ pair: string }>) {
    gameState.update(s => ({ ...s, pair: e.detail.pair }));
  }

  // ── Agent Chat State ──
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
    { from: 'SYSTEM', icon: '🤖', color: '#ffe600', text: 'MAXI⚡DOGE Orchestrator v8 online. Type @AGENT to query.', time: '—', isUser: false, isSystem: true },
  ];
  let isTyping = false;

  const agentResponses: Record<string, string[]> = {
    ORCHESTRATOR: ['Analyzing across 7 agents...', 'Running backtest... 68% win rate detected.', 'Consensus updated — SHORT bias.'],
    STRUCTURE: ['CHoCH on 4H confirmed. OB zone at $95,400.', 'BOS above $97,800. Bullish structure intact.'],
    FLOW: ['Net flow: -$128M accumulation. Whales increasing positions.', 'Exchange outflows rising — bullish signal.'],
    DERIV: ['OI +4.2% with positive delta. Longs building.', 'FR at +0.082% — extreme. Liquidation cluster near $96.8K.'],
    SENTI: ['Fear & Greed: 42 (Fear). Social sentiment shifting bearish.', 'Whale wallets accumulating despite price drop.'],
    GUARDIAN: ['Risk check: Max drawdown within limits.', 'Position sizing OK. Correlation risk moderate.'],
    COMMANDER: ['Final signal: SHORT with 72% confidence.', 'Consensus: 4/5 agents agree on direction.'],
  };

  function handleSendChat(e: CustomEvent<{ text: string }>) {
    const text = e.detail.text;
    if (!text.trim()) return;
    const now = new Date();
    const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    chatMessages = [...chatMessages, { from: 'YOU', icon: '🐕', color: '#ffe600', text, time, isUser: true }];
    isTyping = true;

    const agent = AGDEFS.find(ag => text.toLowerCase().includes(`@${ag.name.toLowerCase()}`));
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
    }, 600 + Math.random() * 500);
  }
</script>

<!-- ═══ MOBILE LAYOUT ═══ -->
{#if isMobile}
<div class="terminal-mobile">
  <div class="mob-tabs">
    <button class="mob-tab" class:active={mobileTab === 'warroom'} on:click={() => mobileTab = 'warroom'}>
      <span class="mob-tab-icon">🎖</span>WAR ROOM
    </button>
    <button class="mob-tab" class:active={mobileTab === 'chart'} on:click={() => mobileTab = 'chart'}>
      <span class="mob-tab-icon">📊</span>CHART
    </button>
    <button class="mob-tab" class:active={mobileTab === 'intel'} on:click={() => mobileTab = 'intel'}>
      <span class="mob-tab-icon">🧠</span>INTEL
    </button>
  </div>

  <div class="mob-content">
    {#if mobileTab === 'warroom'}
      <WarRoom />
    {:else if mobileTab === 'chart'}
      <div class="mob-chart-section">
        <div class="chart-token-bar">
          <TokenDropdown value={pair} compact on:select={onTokenSelect} />
          <span class="ctb-tf">{$gameState.timeframe}</span>
          <span class="ctb-live"><span class="ctb-dot"></span>LIVE</span>
        </div>
        <div class="mob-chart-area">
          <ChartPanel />
        </div>
      </div>
    {:else if mobileTab === 'intel'}
      <IntelPanel {chatMessages} {isTyping} on:sendchat={handleSendChat} />
    {/if}
  </div>

  <div class="ticker-bar">
    <div class="ticker-inner">
      <span class="ticker-text">{TICKER_STR}</span>
    </div>
  </div>
</div>

<!-- ═══ TABLET LAYOUT (no side resizers, stacked) ═══ -->
{:else if isTablet}
<div class="terminal-tablet">
  <div class="tab-top">
    <div class="tab-left">
      <WarRoom />
    </div>
    <div class="tab-center">
      <div class="tab-chart-area">
        <ChartPanel />
      </div>
    </div>
  </div>
  <div class="tab-bottom">
    <IntelPanel {chatMessages} {isTyping} on:sendchat={handleSendChat} />
  </div>

  <div class="ticker-bar">
    <div class="ticker-inner">
      <span class="ticker-text">{TICKER_STR}</span>
    </div>
  </div>
</div>

<!-- ═══ DESKTOP LAYOUT (full 3-panel with resizers) ═══ -->
{:else}
<div class="terminal-page" bind:this={containerEl}
  style="grid-template-columns: {leftCollapsed ? 32 : leftW}px 6px 1fr 6px {rightCollapsed ? 32 : rightW}px">

  <!-- Left: WAR ROOM or collapsed strip -->
  {#if !leftCollapsed}
    <div class="tl">
      <WarRoom on:collapse={toggleLeft} />
    </div>
  {:else}
    <button class="panel-strip panel-strip-left" on:click={toggleLeft} title="Show War Room">
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="1" y="2" width="14" height="12" rx="1.5"/>
        <line x1="6" y1="2" x2="6" y2="14"/>
      </svg>
      <span class="strip-label">WAR</span>
    </button>
  {/if}

  <!-- Left Resizer (drag only, no toggle) -->
  {#if !leftCollapsed}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="resizer resizer-h resizer-left">
      <div class="resizer-drag" on:mousedown={(e) => startDrag('left', e)}></div>
    </div>
  {:else}
    <div class="resizer-spacer"></div>
  {/if}

  <!-- Center: Chart -->
  <div class="tc">
    <div class="chart-area chart-area-full">
      <ChartPanel />
    </div>
  </div>

  <!-- Right Resizer (drag only, no toggle) -->
  {#if !rightCollapsed}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="resizer resizer-h resizer-right">
      <div class="resizer-drag" on:mousedown={(e) => startDrag('right', e)}></div>
    </div>
  {:else}
    <div class="resizer-spacer"></div>
  {/if}

  <!-- Right: Intel Panel or collapsed strip -->
  {#if !rightCollapsed}
    <div class="tr">
      <IntelPanel {chatMessages} {isTyping} on:sendchat={handleSendChat} on:collapse={toggleRight} />
    </div>
  {:else}
    <button class="panel-strip panel-strip-right" on:click={toggleRight} title="Show Intel">
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="1" y="2" width="14" height="12" rx="1.5"/>
        <line x1="10" y1="2" x2="10" y2="14"/>
      </svg>
      <span class="strip-label">INTEL</span>
    </button>
  {/if}

  <!-- Ticker -->
  <div class="ticker-bar">
    <div class="ticker-inner">
      <span class="ticker-text">{TICKER_STR}</span>
    </div>
  </div>

  <!-- Drag Overlay (prevents iframes/canvas from eating events) -->
  {#if dragTarget}
    <div class="drag-overlay col"></div>
  {/if}
</div>
{/if}

<!-- Copy Trade Modal (shared across all layouts) -->
<CopyTradeModal />

<style>
  /* ═══════════════════════════════════════════
     DESKTOP — Full 5-column grid with resizers
     ═══════════════════════════════════════════ */
  .terminal-page {
    display: grid;
    /* 5 columns: warroom | resizer | chart | resizer | intel */
    grid-template-columns: 280px 6px 1fr 6px 300px; /* overridden by inline style */
    grid-template-rows: 1fr auto;
    height: 100%;
    overflow: hidden;
    background: #080818;
    position: relative;
  }
  .ticker-bar {
    grid-column: 1 / -1;
  }
  .tl {
    overflow-y: auto;
    overflow-x: hidden;
    grid-row: 1;
    grid-column: 1;
    min-width: 0;
  }
  .tl::-webkit-scrollbar { width: 3px; }
  .tl::-webkit-scrollbar-track { background: transparent; }
  .tl::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }

  .tc {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    grid-row: 1;
    grid-column: 3;
    min-width: 0;
    min-height: 0;
  }

  /* Chart Token Bar */
  .chart-token-bar {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 12px;
    background: linear-gradient(90deg, #0f0f28, #141428);
    border-bottom: 2px solid rgba(255,230,0,.15);
  }
  /* Token pair now rendered by TokenDropdown component */
  .ctb-tf {
    font-family: var(--fm);
    font-size: 10px;
    font-weight: 700;
    color: rgba(255,255,255,.4);
    letter-spacing: 1px;
    border: 1px solid rgba(255,255,255,.12);
    padding: 1px 6px;
  }
  .ctb-live {
    margin-left: auto;
    font-family: var(--fm);
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 2px;
    color: var(--grn);
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .ctb-dot {
    width: 5px; height: 5px; border-radius: 50%;
    background: var(--grn);
    box-shadow: 0 0 6px var(--grn);
    animation: blink-dot .9s infinite;
  }
  @keyframes blink-dot { 0%,100%{opacity:1} 50%{opacity:.2} }

  .chart-area {
    flex: 1;
    overflow: hidden;
    min-height: 180px;
  }

  .chart-area-full { flex: 1; }
  .tr {
    overflow-y: auto;
    overflow-x: hidden;
    grid-row: 1;
    grid-column: 5;
    min-width: 0;
  }
  .tr::-webkit-scrollbar { width: 3px; }
  .tr::-webkit-scrollbar-track { background: transparent; }
  .tr::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }

  /* ── Resizers ── */
  .resizer {
    position: relative;
    z-index: 20;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    grid-row: 1;
  }
  .resizer-left { grid-column: 2; }
  .resizer-right { grid-column: 4; }

  .resizer-h {
    width: 6px;
    background: rgba(0,0,0,.8);
    border-left: 1px solid rgba(255,230,0,.08);
    border-right: 1px solid rgba(255,230,0,.08);
    transition: background .15s;
  }
  .resizer-h:hover {
    background: rgba(255,230,0,.08);
  }
  .resizer-spacer {
    width: 2px; grid-row: 1;
  }
  .resizer-spacer:nth-of-type(1) { grid-column: 2; }

  /* Collapsed panel strip (like sidebar toggle) */
  .panel-strip {
    display: flex; flex-direction: column; align-items: center;
    gap: 6px; padding: 8px 0;
    background: #0a0a1a;
    border: none; cursor: pointer;
    transition: background .15s;
    grid-row: 1;
  }
  .panel-strip:hover { background: rgba(255,230,0,.06); }
  .panel-strip svg {
    color: rgba(255,230,0,.6);
    transition: color .15s;
  }
  .panel-strip:hover svg { color: var(--yel); }
  .strip-label {
    writing-mode: vertical-rl;
    font-family: var(--fm); font-size: 7px; font-weight: 900;
    letter-spacing: 2px; color: rgba(255,230,0,.35);
    transition: color .15s;
  }
  .panel-strip:hover .strip-label { color: rgba(255,230,0,.7); }
  .panel-strip-left {
    grid-column: 1;
    border-right: 2px solid rgba(255,230,0,.15);
  }
  .panel-strip-right {
    grid-column: 5;
    border-left: 2px solid rgba(255,230,0,.15);
  }

  /* Drag area */
  .resizer-drag {
    position: absolute; inset: 0;
    cursor: col-resize;
  }
  .resizer-drag:hover ~ .resizer-h,
  .resizer-h:hover {
    border-left-color: rgba(255,230,0,.2);
    border-right-color: rgba(255,230,0,.2);
  }

  /* Drag Overlay */
  .drag-overlay {
    position: absolute;
    inset: 0;
    z-index: 100;
  }
  .drag-overlay.col { cursor: col-resize; }

  /* ═══════════════════════════════════════════
     TICKER BAR — shared across all layouts
     ═══════════════════════════════════════════ */
  .ticker-bar {
    height: 24px;
    background: #000;
    border-top: 2px solid rgba(255,230,0,.15);
    overflow: hidden;
    position: relative;
    flex-shrink: 0;
  }
  .ticker-inner {
    display: flex;
    white-space: nowrap;
    animation: tickerScroll 40s linear infinite;
    will-change: transform;
    contain: layout style;
  }
  .ticker-text {
    font-size: 9px;
    font-family: var(--fm);
    color: #00ff88;
    font-weight: 600;
    letter-spacing: .5px;
    line-height: 24px;
    padding: 0 20px;
  }
  @keyframes tickerScroll {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }

  /* ═══════════════════════════════════════════
     MOBILE — Single column with tab switching
     ═══════════════════════════════════════════ */
  .terminal-mobile {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #080818;
    overflow: hidden;
  }
  .mob-tabs {
    display: flex;
    flex-shrink: 0;
    border-bottom: 3px solid var(--yel);
  }
  .mob-tab {
    flex: 1;
    padding: 8px 4px;
    font-family: var(--fm);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-align: center;
    background: none;
    border: none;
    cursor: pointer;
    color: rgba(255,255,255,.35);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    transition: all .15s;
  }
  .mob-tab.active {
    background: var(--yel);
    color: #000;
  }
  .mob-tab-icon { font-size: 11px; }
  .mob-content {
    flex: 1;
    overflow: hidden;
    min-height: 0;
  }
  .mob-chart-section {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .mob-chart-area {
    flex: 1;
    min-height: 200px;
    overflow: hidden;
  }
  /* ═══════════════════════════════════════════
     TABLET — 2-col top + Intel bottom
     ═══════════════════════════════════════════ */
  .terminal-tablet {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #080818;
    overflow: hidden;
  }
  .tab-top {
    flex: 1;
    display: flex;
    min-height: 0;
    overflow: hidden;
  }
  .tab-left {
    width: 240px;
    flex-shrink: 0;
    overflow-y: auto;
    overflow-x: hidden;
  }
  .tab-left::-webkit-scrollbar { width: 3px; }
  .tab-left::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
  .tab-center {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }
  .tab-chart-area {
    flex: 1;
    min-height: 200px;
    overflow: hidden;
  }
  /* tab-chat-area removed — now in BottomPanel */
  .tab-bottom {
    height: 200px;
    flex-shrink: 0;
    border-top: 3px solid var(--yel);
    overflow: hidden;
  }
</style>
