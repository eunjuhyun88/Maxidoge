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
  import { copyTradeStore } from '$lib/stores/copyTradeStore';
  import { formatTimeframeLabel } from '$lib/utils/timeframe';
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
    // Sync prices less aggressively — WS already updates in real-time via ChartPanel
    priceSync = setInterval(() => {
      const s = $gameState;
      const prices = { BTC: s.prices.BTC, ETH: s.prices.ETH, SOL: s.prices.SOL };
      updateAllPrices(prices);
      updateTrackedPrices(prices);
    }, 30000);

    const params = new URLSearchParams(window.location.search);
    if (params.get('copyTrade') === '1') {
      const pair = params.get('pair') || 'BTC/USDT';
      const dir = params.get('dir') === 'SHORT' ? 'SHORT' : 'LONG';
      const entry = Number(params.get('entry') || 0);
      const tp = Number(params.get('tp') || 0);
      const sl = Number(params.get('sl') || 0);
      const conf = Number(params.get('conf') || 70);
      const source = params.get('source') || 'SIGNAL ROOM';
      const reason = params.get('reason') || '';

      if (pair && Number.isFinite(entry) && entry > 0 && Number.isFinite(tp) && Number.isFinite(sl)) {
        copyTradeStore.openFromSignal({
          pair,
          dir,
          entry,
          tp,
          sl,
          conf: Number.isFinite(conf) ? conf : 70,
          source,
          reason,
        });
      }

      params.delete('copyTrade');
      params.delete('pair');
      params.delete('dir');
      params.delete('entry');
      params.delete('tp');
      params.delete('sl');
      params.delete('conf');
      params.delete('source');
      params.delete('reason');
      const nextQuery = params.toString();
      const nextUrl = nextQuery ? `${window.location.pathname}?${nextQuery}` : window.location.pathname;
      history.replaceState({}, '', nextUrl);
    }
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

<div class="terminal-shell">
  <div class="term-stars" aria-hidden="true"></div>
  <div class="term-stars term-stars-soft" aria-hidden="true"></div>
  <div class="term-grain" aria-hidden="true"></div>

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
            <span class="ctb-tf">{formatTimeframeLabel($gameState.timeframe)}</span>
            <span class="ctb-live"><span class="ctb-dot"></span>LIVE</span>
          </div>
          <div class="mob-chart-area">
            <ChartPanel advancedMode enableTradeLineEntry />
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
          <ChartPanel advancedMode enableTradeLineEntry />
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
        <ChartPanel advancedMode enableTradeLineEntry />
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
</div>

<!-- Copy Trade Modal (shared across all layouts) -->
<CopyTradeModal />

<style>
  .terminal-shell {
    --term-bg: #0a1a0d;
    --term-bg2: #0f2614;
    --term-bg3: #143620;
    --term-accent: #e8967d;
    --term-accent-soft: #f5c4b8;
    --term-live: #87dcbe;
    --term-danger: #d86b79;
    --term-text: #f0ede4;
    --term-text-dim: rgba(240, 237, 228, 0.56);
    --term-border: rgba(232, 150, 125, 0.2);
    --term-border-soft: rgba(232, 150, 125, 0.12);
    --term-panel: rgba(13, 35, 22, 0.9);
    --term-panel-2: rgba(10, 27, 17, 0.92);

    /* Override legacy terminal globals inside this route only */
    --yel: var(--term-accent);
    --pk: var(--term-accent);
    --grn: var(--term-live);
    --red: var(--term-danger);
    --ora: #d8a266;
    --cyan: #9fd5cb;
    --blk: #0a1a0d;

    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    isolation: isolate;
    background:
      radial-gradient(110% 72% at 15% 0%, rgba(232, 150, 125, 0.1) 0%, rgba(232, 150, 125, 0) 58%),
      radial-gradient(96% 68% at 88% 6%, rgba(135, 220, 190, 0.14) 0%, rgba(135, 220, 190, 0) 62%),
      linear-gradient(180deg, var(--term-bg2) 0%, var(--term-bg) 72%);
  }
  .terminal-shell::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background:
      linear-gradient(180deg, rgba(240, 237, 228, 0.03) 0%, rgba(240, 237, 228, 0) 24%),
      repeating-linear-gradient(
        0deg,
        transparent 0,
        transparent 2px,
        rgba(0, 0, 0, 0.14) 2px,
        rgba(0, 0, 0, 0.14) 3px
      );
    opacity: 0.52;
  }
  .term-stars,
  .term-grain {
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
  }
  .term-stars {
    background:
      radial-gradient(1px 1px at 10% 15%, rgba(255, 255, 255, 0.65) 50%, transparent 50%),
      radial-gradient(1.2px 1.2px at 35% 30%, rgba(255, 255, 255, 0.5) 50%, transparent 50%),
      radial-gradient(1px 1px at 52% 8%, rgba(255, 255, 255, 0.45) 50%, transparent 50%),
      radial-gradient(1px 1px at 76% 46%, rgba(255, 255, 255, 0.6) 50%, transparent 50%),
      radial-gradient(1.2px 1.2px at 84% 18%, rgba(255, 255, 255, 0.42) 50%, transparent 50%),
      radial-gradient(1px 1px at 18% 64%, rgba(255, 255, 255, 0.5) 50%, transparent 50%),
      radial-gradient(1px 1px at 64% 74%, rgba(255, 255, 255, 0.38) 50%, transparent 50%),
      radial-gradient(1.3px 1.3px at 93% 82%, rgba(255, 255, 255, 0.56) 50%, transparent 50%);
    background-size: 320px 320px;
    opacity: 0.45;
  }
  .term-stars-soft {
    background:
      radial-gradient(1px 1px at 22% 22%, rgba(135, 220, 190, 0.55) 50%, transparent 50%),
      radial-gradient(1px 1px at 68% 36%, rgba(135, 220, 190, 0.45) 50%, transparent 50%),
      radial-gradient(1.5px 1.5px at 78% 66%, rgba(135, 220, 190, 0.45) 50%, transparent 50%),
      radial-gradient(1px 1px at 42% 84%, rgba(135, 220, 190, 0.35) 50%, transparent 50%);
    background-size: 520px 520px;
    opacity: 0.38;
    animation: termTwinkle 4.2s ease-in-out infinite alternate;
  }
  @keyframes termTwinkle {
    0% { opacity: 0.26; }
    100% { opacity: 0.52; }
  }
  .term-grain {
    opacity: 0.03;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size: 200px 200px;
    animation: termGrainShift 0.3s steps(3) infinite;
  }
  @keyframes termGrainShift {
    0% { transform: translate(0, 0); }
    33% { transform: translate(-1px, 1px); }
    66% { transform: translate(1px, -1px); }
    100% { transform: translate(0, 0); }
  }

  .terminal-page,
  .terminal-mobile,
  .terminal-tablet {
    position: relative;
    z-index: 1;
  }

  /* ═══════════════════════════════════════════
     DESKTOP — Full 5-column grid with resizers
     ═══════════════════════════════════════════ */
  .terminal-page {
    display: grid;
    grid-template-columns: 280px 6px 1fr 6px 300px; /* overridden by inline style */
    grid-template-rows: 1fr auto;
    height: 100%;
    overflow: hidden;
    background: linear-gradient(180deg, var(--term-panel) 0%, var(--term-panel-2) 100%);
    box-shadow: inset 0 0 0 1px var(--term-border-soft);
  }
  .ticker-bar {
    grid-column: 1 / -1;
  }
  .tl,
  .tr,
  .tab-left {
    overflow-y: auto;
    overflow-x: hidden;
    min-width: 0;
  }
  .tl {
    grid-row: 1;
    grid-column: 1;
  }
  .tr {
    grid-row: 1;
    grid-column: 5;
  }
  .tl::-webkit-scrollbar,
  .tr::-webkit-scrollbar,
  .tab-left::-webkit-scrollbar { width: 3px; }
  .tl::-webkit-scrollbar-track,
  .tr::-webkit-scrollbar-track,
  .tab-left::-webkit-scrollbar-track { background: transparent; }
  .tl::-webkit-scrollbar-thumb,
  .tr::-webkit-scrollbar-thumb,
  .tab-left::-webkit-scrollbar-thumb {
    background: rgba(232, 150, 125, 0.45);
    border-radius: 3px;
  }

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
    padding: 6px 12px;
    background: linear-gradient(90deg, rgba(18, 44, 28, 0.96), rgba(14, 33, 23, 0.96));
    border-bottom: 1px solid var(--term-border);
    box-shadow: 0 1px 0 rgba(245, 196, 184, 0.08) inset;
  }
  .ctb-tf {
    font-family: var(--fm);
    font-size: 10px;
    font-weight: 700;
    color: var(--term-text-dim);
    letter-spacing: 1px;
    border: 1px solid rgba(240, 237, 228, 0.14);
    padding: 1px 6px;
  }
  .ctb-live {
    margin-left: auto;
    font-family: var(--fm);
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 2px;
    color: var(--term-live);
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .ctb-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--term-live);
    box-shadow: 0 0 8px rgba(135, 220, 190, 0.8);
    animation: blink-dot 0.9s infinite;
  }
  @keyframes blink-dot {
    0%,100% { opacity: 1; }
    50% { opacity: .2; }
  }

  .chart-area {
    flex: 1;
    overflow: hidden;
    min-height: 180px;
  }
  .chart-area-full { flex: 1; }

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
    background: rgba(10, 24, 16, 0.9);
    border-left: 1px solid var(--term-border-soft);
    border-right: 1px solid var(--term-border-soft);
    transition: background .15s, border-color .15s;
  }
  .resizer-h:hover {
    background: rgba(232, 150, 125, 0.1);
    border-left-color: var(--term-border);
    border-right-color: var(--term-border);
  }
  .resizer-spacer {
    width: 2px;
    grid-row: 1;
  }
  .resizer-spacer:nth-of-type(1) { grid-column: 2; }

  .panel-strip {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 8px 0;
    background: rgba(12, 29, 19, 0.95);
    border: none;
    cursor: pointer;
    transition: background .15s;
    grid-row: 1;
  }
  .panel-strip:hover { background: rgba(232, 150, 125, 0.08); }
  .panel-strip svg {
    color: rgba(245, 196, 184, 0.62);
    transition: color .15s;
  }
  .panel-strip:hover svg { color: var(--term-accent-soft); }
  .strip-label {
    writing-mode: vertical-rl;
    font-family: var(--fm);
    font-size: 7px;
    font-weight: 900;
    letter-spacing: 2px;
    color: rgba(245, 196, 184, 0.42);
    transition: color .15s;
  }
  .panel-strip:hover .strip-label { color: rgba(245, 196, 184, 0.8); }
  .panel-strip-left {
    grid-column: 1;
    border-right: 1px solid var(--term-border);
  }
  .panel-strip-right {
    grid-column: 5;
    border-left: 1px solid var(--term-border);
  }

  .resizer-drag {
    position: absolute;
    inset: 0;
    cursor: col-resize;
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
    background: linear-gradient(180deg, rgba(15, 40, 24, 0.95) 0%, rgba(10, 27, 17, 0.98) 100%);
    border-top: 1px solid var(--term-border);
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
    color: var(--term-live);
    font-weight: 600;
    letter-spacing: 0.5px;
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
    background: linear-gradient(180deg, var(--term-panel) 0%, var(--term-panel-2) 100%);
    box-shadow: inset 0 0 0 1px var(--term-border-soft);
    overflow: hidden;
  }
  .mob-tabs {
    display: flex;
    flex-shrink: 0;
    border-bottom: 1px solid var(--term-border);
    background: rgba(12, 30, 20, 0.85);
  }
  .mob-tab {
    flex: 1;
    padding: 9px 4px;
    font-family: var(--fm);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1.2px;
    text-align: center;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--term-text-dim);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    transition: all .15s;
  }
  .mob-tab.active {
    background: rgba(232, 150, 125, 0.18);
    color: var(--term-accent-soft);
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
    background: linear-gradient(180deg, var(--term-panel) 0%, var(--term-panel-2) 100%);
    box-shadow: inset 0 0 0 1px var(--term-border-soft);
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
  }
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
  .tab-bottom {
    height: 200px;
    flex-shrink: 0;
    border-top: 1px solid var(--term-border);
    overflow: hidden;
  }

  /* Route-scoped tone overrides for terminal child components */
  .terminal-shell :global(.war-room),
  .terminal-shell :global(.intel-panel),
  .terminal-shell :global(.chart-wrapper),
  .terminal-shell :global(.tv-container) {
    background: var(--term-panel-2);
  }

  .terminal-shell :global(.war-room) {
    border-right: 1px solid var(--term-border-soft);
  }
  .terminal-shell :global(.war-room .wr-header) {
    background: linear-gradient(90deg, rgba(232, 150, 125, 0.94), rgba(245, 196, 184, 0.86));
    border-bottom: 1px solid rgba(10, 26, 13, 0.5);
  }
  .terminal-shell :global(.war-room .wr-title) {
    color: #112419;
    letter-spacing: 2px;
  }
  .terminal-shell :global(.war-room .signal-link),
  .terminal-shell :global(.war-room .wr-auto-badge) {
    color: #132418;
    background: rgba(240, 237, 228, 0.55);
    border-color: rgba(10, 26, 13, 0.28);
  }
  .terminal-shell :global(.war-room .wr-live) {
    background: rgba(10, 26, 13, 0.18);
    color: #193123;
    border-color: rgba(10, 26, 13, 0.4);
  }
  .terminal-shell :global(.war-room .wr-live-dot) {
    background: #193123;
  }
  .terminal-shell :global(.war-room .token-tabs) {
    border-bottom-color: var(--term-border-soft);
    background: rgba(9, 24, 16, 0.55);
  }
  .terminal-shell :global(.war-room .token-tab) {
    color: var(--term-text-dim);
  }
  .terminal-shell :global(.war-room .token-tab.active) {
    color: var(--term-accent-soft);
    border-bottom-color: var(--term-accent);
    background: rgba(232, 150, 125, 0.08);
  }
  .terminal-shell :global(.war-room .token-tab.active .token-tab-count) {
    background: rgba(232, 150, 125, 0.14);
    color: var(--term-accent-soft);
  }
  .terminal-shell :global(.war-room .deriv-strip) {
    background: rgba(10, 26, 16, 0.6);
    border-bottom-color: var(--term-border-soft);
  }
  .terminal-shell :global(.war-room .wr-msg) {
    border-bottom-color: rgba(232, 150, 125, 0.08);
  }
  .terminal-shell :global(.war-room .wr-msg:hover) {
    background: rgba(232, 150, 125, 0.04);
  }
  .terminal-shell :global(.war-room .wr-msg.selected) {
    background: rgba(232, 150, 125, 0.07);
    border-left-color: var(--term-accent);
  }
  .terminal-shell :global(.war-room .copy-trade-cta) {
    background: linear-gradient(90deg, rgba(232, 150, 125, 0.2), rgba(232, 150, 125, 0.09));
    border-top-color: var(--term-border);
  }
  .terminal-shell :global(.war-room .copy-trade-cta:hover) {
    background: linear-gradient(90deg, rgba(232, 150, 125, 0.3), rgba(232, 150, 125, 0.14));
  }
  .terminal-shell :global(.war-room .wr-stats) {
    border-top-color: var(--term-border);
    background: rgba(232, 150, 125, 0.04);
  }
  .terminal-shell :global(.war-room .stat-cell) {
    border-right-color: rgba(232, 150, 125, 0.14);
  }
  .terminal-shell :global(.war-room .stat-lbl) {
    color: rgba(245, 196, 184, 0.5);
  }

  .terminal-shell :global(.intel-panel) {
    border-left: 1px solid var(--term-border-soft);
  }
  .terminal-shell :global(.intel-panel .rp-tabs) {
    border-bottom-color: var(--term-border);
  }
  .terminal-shell :global(.intel-panel .rp-tab) {
    color: var(--term-text-dim);
    background: rgba(240, 237, 228, 0.015);
  }
  .terminal-shell :global(.intel-panel .rp-tab.active) {
    background: rgba(232, 150, 125, 0.2);
    color: var(--term-accent-soft);
  }
  .terminal-shell :global(.intel-panel .rp-tab:not(.active):hover) {
    color: var(--term-accent-soft);
    background: rgba(232, 150, 125, 0.08);
  }
  .terminal-shell :global(.intel-panel .rp-collapse),
  .terminal-shell :global(.intel-panel .rp-panel-collapse) {
    border-left-color: var(--term-border-soft);
    color: rgba(245, 196, 184, 0.62);
  }
  .terminal-shell :global(.intel-panel .rp-collapse:hover),
  .terminal-shell :global(.intel-panel .rp-panel-collapse:hover) {
    background: rgba(232, 150, 125, 0.14);
    color: var(--term-accent-soft);
  }
  .terminal-shell :global(.intel-panel .rp-inner-tabs) {
    border-bottom-color: var(--term-border-soft);
  }
  .terminal-shell :global(.intel-panel .rp-inner-tab.active) {
    color: var(--term-accent-soft);
    border-bottom-color: var(--term-accent);
  }
  .terminal-shell :global(.intel-panel .hl-ticker-badge) {
    color: var(--term-accent-soft);
    background: rgba(232, 150, 125, 0.1);
    border-bottom-color: var(--term-border-soft);
  }
  .terminal-shell :global(.intel-panel .hl-row),
  .terminal-shell :global(.intel-panel .ev-card) {
    border-bottom-color: rgba(232, 150, 125, 0.08);
  }
  .terminal-shell :global(.intel-panel .hl-row:hover),
  .terminal-shell :global(.intel-panel .comm-react:hover) {
    background: rgba(232, 150, 125, 0.08);
  }
  .terminal-shell :global(.intel-panel .user-post) {
    border-left-color: var(--term-accent);
  }
  .terminal-shell :global(.intel-panel .ac-send) {
    background: var(--term-accent);
    color: var(--term-bg);
    border-color: rgba(10, 26, 13, 0.45);
  }
  .terminal-shell :global(.intel-panel .ac-input input:focus) {
    border-color: rgba(232, 150, 125, 0.42);
  }

  .terminal-shell :global(.chart-wrapper),
  .terminal-shell :global(.tv-container) {
    background: #0f2316;
  }
  .terminal-shell :global(.chart-bar) {
    background: linear-gradient(90deg, rgba(17, 42, 27, 0.98), rgba(15, 34, 24, 0.95));
    border-bottom-color: rgba(232, 150, 125, 0.28);
  }
  .terminal-shell :global(.tfbtn.active) {
    background: rgba(232, 150, 125, 0.18);
    color: var(--term-accent-soft);
    border-color: rgba(232, 150, 125, 0.35);
  }
  .terminal-shell :global(.mode-toggle) {
    border-color: rgba(232, 150, 125, 0.3);
  }
  .terminal-shell :global(.mode-btn:first-child) {
    border-right-color: rgba(232, 150, 125, 0.2);
  }
  .terminal-shell :global(.mode-btn:hover) {
    background: rgba(232, 150, 125, 0.1);
    color: var(--term-text);
  }
  .terminal-shell :global(.mode-btn.active) {
    background: linear-gradient(135deg, rgba(232, 150, 125, 0.28), rgba(232, 150, 125, 0.14));
    color: var(--term-accent-soft);
    text-shadow: 0 0 8px rgba(232, 150, 125, 0.35);
  }
  .terminal-shell :global(.draw-btn:hover) {
    background: rgba(232, 150, 125, 0.11);
    color: var(--term-accent-soft);
    border-color: rgba(232, 150, 125, 0.35);
  }
  .terminal-shell :global(.draw-btn.active) {
    background: rgba(232, 150, 125, 0.22);
    color: var(--term-accent-soft);
    border-color: rgba(232, 150, 125, 0.42);
    box-shadow: 0 0 6px rgba(232, 150, 125, 0.24);
  }
  .terminal-shell :global(.drawing-indicator) {
    background: rgba(232, 150, 125, 0.14);
    border-color: rgba(232, 150, 125, 0.34);
    color: var(--term-accent-soft);
  }
  .terminal-shell :global(.loading-overlay) {
    background: rgba(10, 26, 13, 0.86);
    color: var(--term-text-dim);
  }
  .terminal-shell :global(.loader) {
    border-color: rgba(232, 150, 125, 0.25);
    border-top-color: var(--term-accent);
  }
  .terminal-shell :global(.chart-footer) {
    border-top-color: rgba(232, 150, 125, 0.14);
    background: rgba(8, 20, 13, 0.55);
    color: rgba(240, 237, 228, 0.45);
  }
  .terminal-shell :global(.src-badge),
  .terminal-shell :global(.draw-count) {
    color: var(--term-accent);
  }
  .terminal-shell :global(.src-ws) {
    color: var(--term-live);
  }
  .terminal-shell :global(.pos-rr) {
    color: var(--term-accent-soft);
  }
</style>
