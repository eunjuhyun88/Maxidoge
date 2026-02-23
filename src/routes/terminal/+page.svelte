<script lang="ts">
  import WarRoom from '../../components/terminal/WarRoom.svelte';
  import ChartPanel from '../../components/arena/ChartPanel.svelte';
  import IntelPanel from '../../components/terminal/IntelPanel.svelte';
  import TokenDropdown from '../../components/shared/TokenDropdown.svelte';
  import CopyTradeModal from '../../components/modals/CopyTradeModal.svelte';
  import { AGDEFS } from '$lib/data/agents';

  let liveTickerStr = '';
  let tickerLoaded = false;
  $: TICKER_STR = tickerLoaded && liveTickerStr
    ? `${liveTickerStr}  \u00a0|\u00a0  ${liveTickerStr}`
    : 'Loading market data...';
  import { gameState } from '$lib/stores/gameState';
  import { livePrices } from '$lib/stores/priceStore';
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
  type MobileTab = 'warroom' | 'chart' | 'intel';
  const MOBILE_TAB_META: Record<MobileTab, { label: string; icon: string; desc: string }> = {
    warroom: { label: 'War Room', icon: '🎖', desc: 'Signal stream and quick trade actions' },
    chart: { label: 'Chart', icon: '📊', desc: 'Execution chart with drawing and indicators' },
    intel: { label: 'Intel', icon: '🧠', desc: 'News, community and agent chat' },
  };
  let mobileTab: MobileTab = 'chart';
  let mobileViewTracked = false;

  function gtmEvent(event: string, payload: Record<string, unknown> = {}) {
    if (typeof window === 'undefined') return;
    const w = window as any;
    if (!Array.isArray(w.dataLayer)) return;
    w.dataLayer.push({
      event,
      page: 'terminal',
      component: 'terminal-shell',
      viewport: isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop',
      ...payload,
    });
  }

  function setMobileTab(tab: MobileTab) {
    if (mobileTab === tab) return;
    mobileTab = tab;
    gtmEvent('terminal_mobile_tab_change', {
      tab,
      pair: $gameState.pair,
      timeframe: $gameState.timeframe,
    });
  }

  $: if (isMobile && !mobileViewTracked) {
    mobileViewTracked = true;
    gtmEvent('terminal_mobile_view', {
      tab: mobileTab,
      pair: $gameState.pair,
      timeframe: $gameState.timeframe,
    });
  }
  $: if (!isMobile && mobileViewTracked) mobileViewTracked = false;

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

  async function fetchLiveTicker() {
    try {
      const [fgRes, cgRes] = await Promise.all([
        fetch('/api/feargreed?limit=1').then(r => r.json()).catch(() => null),
        fetch('/api/coingecko/global').then(r => r.json()).catch(() => null),
      ]);

      const parts: string[] = [];
      if (cgRes?.ok && cgRes.data?.global) {
        const g = cgRes.data.global;
        if (g.btcDominance) parts.push(`BTC_DOM: ${g.btcDominance.toFixed(1)}%`);
        if (g.totalVolumeUsd) parts.push(`VOL_24H: $${(g.totalVolumeUsd / 1e9).toFixed(1)}B`);
        if (g.totalMarketCapUsd) parts.push(`MCAP: $${(g.totalMarketCapUsd / 1e12).toFixed(2)}T`);
        if (g.ethDominance) parts.push(`ETH_DOM: ${g.ethDominance.toFixed(1)}%`);
        if (g.marketCapChange24hPct != null) parts.push(`MCAP_24H: ${g.marketCapChange24hPct >= 0 ? '+' : ''}${g.marketCapChange24hPct.toFixed(2)}%`);
      }
      if (fgRes?.ok && fgRes.data?.current) {
        const fg = fgRes.data.current;
        parts.push(`FEAR_GREED: ${fg.value} (${fg.classification})`);
      }
      if (cgRes?.ok && cgRes.data?.stablecoin) {
        const s = cgRes.data.stablecoin;
        if (s.totalMcapUsd) parts.push(`STABLE_MCAP: $${(s.totalMcapUsd / 1e9).toFixed(1)}B`);
      }

      if (parts.length > 0) {
        parts.push('SYSTEM_STABILITY: 99.98%');
        liveTickerStr = parts.join(' | ');
        tickerLoaded = true;
      }
    } catch (e) {
      console.warn('[Terminal] Live ticker fetch failed, using fallback');
    }
  }

  // Fast local updates + slower server persistence (keeps UI snappy without hammering DB)
  let priceUiSync: ReturnType<typeof setInterval> | null = null;
  let pricePersistSync: ReturnType<typeof setInterval> | null = null;

  onMount(() => {
    windowWidth = window.innerWidth;
    window.addEventListener('resize', handleResize);

    // ── Load live ticker data ──
    fetchLiveTicker();

    // 1) Local UI refresh — 3초 간격 (WS가 실시간 가격 담당, 여기는 보조 동기화)
    priceUiSync = setInterval(() => {
      const s = $gameState;
      const prices = { BTC: s.prices.BTC, ETH: s.prices.ETH, SOL: s.prices.SOL };
      updateAllPrices(prices, { syncServer: false });
      updateTrackedPrices(prices);
    }, 3000);

    // 2) Periodic server persistence (batched in store debounce)
    pricePersistSync = setInterval(() => {
      const s = $gameState;
      const prices = { BTC: s.prices.BTC, ETH: s.prices.ETH, SOL: s.prices.SOL };
      updateAllPrices(prices, { syncServer: true });
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
    if (priceUiSync) clearInterval(priceUiSync);
    if (pricePersistSync) clearInterval(pricePersistSync);
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', handleResize);
    }
  });

  // Selected pair display
  $: pair = $gameState.pair || 'BTC/USDT';
  $: mobileMeta = MOBILE_TAB_META[mobileTab];

  function onTokenSelect(e: CustomEvent<{ pair: string }>) {
    gameState.update(s => ({ ...s, pair: e.detail.pair }));
    gtmEvent('terminal_pair_change_shell', {
      pair: e.detail.pair,
      source: isMobile ? 'mobile-topbar' : 'shell-token-control',
      timeframe: $gameState.timeframe,
    });
  }

  type WarRoomHandle = {
    triggerScanFromChart?: () => void;
  };
  let warRoomRef: WarRoomHandle | null = null;
  let pendingChartScan = false;

  function tryTriggerWarRoomScan(): boolean {
    if (!warRoomRef || typeof warRoomRef.triggerScanFromChart !== 'function') return false;
    warRoomRef.triggerScanFromChart();
    return true;
  }

  function handleChartScanRequest(e: CustomEvent<{ source?: string; pair?: string; timeframe?: string }>) {
    const detail = e.detail ?? {};
    gtmEvent('terminal_scan_request_shell', {
      source: detail.source || 'chart-panel',
      pair: detail.pair || $gameState.pair,
      timeframe: detail.timeframe || $gameState.timeframe,
    });

    if (tryTriggerWarRoomScan()) return;

    pendingChartScan = true;
    if (isDesktop && leftCollapsed) {
      toggleLeft();
    }
    if (isMobile && mobileTab !== 'warroom') {
      setMobileTab('warroom');
    }
  }

  $: if (pendingChartScan && tryTriggerWarRoomScan()) {
    pendingChartScan = false;
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

  type ScanHighlight = {
    agent: string;
    vote: 'long' | 'short' | 'neutral';
    conf: number;
    note: string;
  };

  type ScanIntelDetail = {
    pair: string;
    timeframe: string;
    token: string;
    createdAt: number;
    label: string;
    consensus: 'long' | 'short' | 'neutral';
    avgConfidence: number;
    summary: string;
    highlights: ScanHighlight[];
  };

  let chatMessages: ChatMsg[] = [
    { from: 'SYSTEM', icon: '🤖', color: '#ffe600', text: 'MAXI⚡DOGE Orchestrator v8 online. 7 agents standing by.', time: '—', isUser: false, isSystem: true },
    { from: 'ORCHESTRATOR', icon: '🧠', color: '#ff2d9b',
      text: '💡 @STRUCTURE @VPA @ICT @DERIV @FLOW @SENTI @MACRO — Tag an agent below for targeted analysis. Or just ask me anything.',
      time: '—', isUser: false },
  ];
  let isTyping = false;
  let latestScan: ScanIntelDetail | null = null;

  // 에이전트 정보 맵 (아이콘/컬러 lookup)
  const AGENT_META: Record<string, { icon: string; color: string }> = {};
  for (const ag of AGDEFS) AGENT_META[ag.name] = { icon: ag.icon, color: ag.color };
  AGENT_META['ORCHESTRATOR'] = { icon: '🧠', color: '#ff2d9b' };

  async function handleSendChat(e: CustomEvent<{ text: string }>) {
    const text = e.detail.text;
    if (!text.trim()) return;
    const now = new Date();
    const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;

    // 유저 메시지 즉시 표시
    chatMessages = [...chatMessages, { from: 'YOU', icon: '🐕', color: '#ffe600', text, time, isUser: true }];
    isTyping = true;

    // 멘션된 에이전트 감지 (없으면 서버에서 ORCHESTRATOR로 기본 처리)
    const agent = AGDEFS.find(ag => text.toLowerCase().includes(`@${ag.name.toLowerCase()}`));
    const mentionedAgent = agent?.name || undefined;

    try {
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'terminal',
          senderKind: 'user',
          senderName: 'YOU',
          message: text,
          meta: {
            pair: $gameState.pair || 'BTC/USDT',
            timeframe: $gameState.timeframe || '4h',
            mentionedAgent,
            livePrices: { ...$livePrices },
          },
        }),
      });

      isTyping = false;

      if (res.ok) {
        const data = await res.json();
        if (data.agentResponse) {
          const r = data.agentResponse;
          const agMeta = AGENT_META[r.senderName] || AGENT_META['ORCHESTRATOR'];
          chatMessages = [...chatMessages, {
            from: r.senderName,
            icon: agMeta.icon,
            color: agMeta.color,
            text: r.message,
            time,
            isUser: false,
          }];
        }
      } else {
        chatMessages = [...chatMessages, {
          from: 'SYSTEM', icon: '⚠️', color: '#ff8c3b',
          text: 'Connection error. Try again or check server status.',
          time, isUser: false, isSystem: true
        }];
      }
    } catch (err) {
      isTyping = false;
      chatMessages = [...chatMessages, {
        from: 'SYSTEM', icon: '⚠️', color: '#ff8c3b',
        text: 'Network error. Please check your connection.',
        time, isUser: false, isSystem: true
      }];
    }
  }

  function handleScanComplete(e: CustomEvent<ScanIntelDetail>) {
    // 스캔 컨텍스트만 저장 (채팅에 LLM이 참조할 수 있도록)
    // 스캔 결과를 채팅에 직접 표시하지 않음
    latestScan = e.detail;
  }
</script>

<div class="terminal-shell">
  <div class="term-stars" aria-hidden="true"></div>
  <div class="term-stars term-stars-soft" aria-hidden="true"></div>
  <div class="term-grain" aria-hidden="true"></div>

  <!-- ═══ MOBILE LAYOUT ═══ -->
  {#if isMobile}
  <div class="terminal-mobile">
    <div class="mob-topbar">
      <div class="mob-topline">
        <div class="mob-title-wrap">
          <span class="mob-eyebrow">TERMINAL MOBILE</span>
          <span class="mob-title">{mobileMeta.icon} {mobileMeta.label}</span>
        </div>
        <span class="mob-live"><span class="ctb-dot"></span>LIVE</span>
      </div>
      <div class="mob-meta">
        <div class="mob-token">
          <TokenDropdown value={pair} compact on:select={onTokenSelect} />
        </div>
        <span class="mob-meta-chip">{formatTimeframeLabel($gameState.timeframe)}</span>
        <span class="mob-meta-chip subtle">{pair}</span>
      </div>
      <div class="mob-desc">{mobileMeta.desc}</div>
    </div>

    <div class="mob-content">
      {#if mobileTab === 'warroom'}
        <div class="mob-panel-wrap">
          <WarRoom bind:this={warRoomRef} on:scancomplete={handleScanComplete} />
        </div>
      {:else if mobileTab === 'chart'}
        <div class="mob-chart-section">
          <div class="mob-chart-area">
            <ChartPanel advancedMode enableTradeLineEntry on:scanrequest={handleChartScanRequest} />
          </div>
        </div>
      {:else if mobileTab === 'intel'}
        <div class="mob-panel-wrap">
          <IntelPanel {chatMessages} {isTyping} {latestScan} prioritizeChat on:sendchat={handleSendChat} />
        </div>
      {/if}
    </div>

    <div class="mob-bottom-nav">
      <button class="mob-nav-btn" class:active={mobileTab === 'warroom'} on:click={() => setMobileTab('warroom')}>
        <span class="mob-nav-icon">🎖</span>
        <span class="mob-nav-label">WAR ROOM</span>
      </button>
      <button class="mob-nav-btn" class:active={mobileTab === 'chart'} on:click={() => setMobileTab('chart')}>
        <span class="mob-nav-icon">📊</span>
        <span class="mob-nav-label">CHART</span>
      </button>
      <button class="mob-nav-btn" class:active={mobileTab === 'intel'} on:click={() => setMobileTab('intel')}>
        <span class="mob-nav-icon">🧠</span>
        <span class="mob-nav-label">INTEL</span>
      </button>
    </div>
  </div>

  <!-- ═══ TABLET LAYOUT (no side resizers, stacked) ═══ -->
  {:else if isTablet}
  <div class="terminal-tablet">
    <div class="tab-top">
      <div class="tab-left">
        <WarRoom bind:this={warRoomRef} on:scancomplete={handleScanComplete} />
      </div>
      <div class="tab-center">
        <div class="tab-chart-area">
          <ChartPanel advancedMode enableTradeLineEntry on:scanrequest={handleChartScanRequest} />
        </div>
      </div>
    </div>
    <div class="tab-bottom">
      <IntelPanel {chatMessages} {isTyping} {latestScan} on:sendchat={handleSendChat} />
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
        <WarRoom bind:this={warRoomRef} on:collapse={toggleLeft} on:scancomplete={handleScanComplete} />
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
        <ChartPanel advancedMode enableTradeLineEntry on:scanrequest={handleChartScanRequest} />
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
        <IntelPanel {chatMessages} {isTyping} {latestScan} on:sendchat={handleSendChat} on:collapse={toggleRight} />
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

  /* Shared live status dot */
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
    font-size: 8px;
    font-weight: 900;
    letter-spacing: 1.8px;
    color: rgba(245, 196, 184, 0.62);
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
     MOBILE — Context header + bottom nav
     ═══════════════════════════════════════════ */
  .terminal-mobile {
    display: grid;
    grid-template-rows: auto 1fr auto;
    height: 100%;
    background: linear-gradient(180deg, var(--term-panel) 0%, var(--term-panel-2) 100%);
    box-shadow: inset 0 0 0 1px var(--term-border-soft);
    overflow: hidden;
    padding-bottom: max(8px, env(safe-area-inset-bottom));
  }
  .mob-topbar {
    flex-shrink: 0;
    padding: 10px 12px 8px;
    border-bottom: 1px solid var(--term-border);
    background:
      linear-gradient(135deg, rgba(232, 150, 125, 0.14), rgba(232, 150, 125, 0.04)),
      linear-gradient(180deg, rgba(14, 36, 23, 0.92), rgba(10, 27, 17, 0.94));
    backdrop-filter: blur(8px);
  }
  .mob-topline {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 8px;
  }
  .mob-title-wrap {
    display: flex;
    flex-direction: column;
    min-width: 0;
    gap: 1px;
  }
  .mob-eyebrow {
    font-family: var(--fm);
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 1.4px;
    color: rgba(240, 237, 228, 0.48);
  }
  .mob-title {
    font-family: var(--fd);
    font-size: 14px;
    font-weight: 900;
    letter-spacing: 0.6px;
    color: var(--term-text);
    line-height: 1.2;
  }
  .mob-live {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 8px;
    border-radius: 999px;
    border: 1px solid rgba(135, 220, 190, 0.26);
    background: rgba(135, 220, 190, 0.08);
    font-family: var(--fm);
    font-size: 8px;
    font-weight: 800;
    letter-spacing: 1.3px;
    color: var(--term-live);
    white-space: nowrap;
  }
  .mob-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }
  .mob-token {
    min-width: 0;
    flex: 1;
  }
  .mob-meta-chip {
    flex-shrink: 0;
    padding: 4px 8px;
    border-radius: 8px;
    border: 1px solid rgba(240, 237, 228, 0.2);
    background: rgba(240, 237, 228, 0.08);
    font-family: var(--fm);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.35px;
    color: rgba(240, 237, 228, 0.84);
    max-width: 44vw;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .mob-meta-chip.subtle {
    color: rgba(240, 237, 228, 0.65);
    border-color: rgba(240, 237, 228, 0.13);
    background: rgba(240, 237, 228, 0.04);
  }
  .mob-desc {
    margin-top: 8px;
    font-family: var(--fm);
    font-size: 10px;
    color: rgba(240, 237, 228, 0.56);
    letter-spacing: 0.15px;
    line-height: 1.35;
  }
  .mob-content {
    min-height: 0;
    overflow: hidden;
    padding: 10px 10px 8px;
  }
  .mob-panel-wrap,
  .mob-chart-section {
    height: 100%;
    min-height: 0;
    border-radius: 12px;
    border: 1px solid rgba(232, 150, 125, 0.16);
    overflow: hidden;
    background: rgba(8, 22, 14, 0.58);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.26);
  }
  .mob-chart-area {
    flex: 1;
    min-height: 220px;
    overflow: hidden;
  }
  .mob-bottom-nav {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    padding: 8px 10px 4px;
    border-top: 1px solid var(--term-border);
    background: rgba(10, 26, 16, 0.92);
    backdrop-filter: blur(8px);
  }
  .mob-nav-btn {
    min-height: 50px;
    border-radius: 12px;
    border: 1px solid rgba(232, 150, 125, 0.16);
    background: rgba(240, 237, 228, 0.03);
    color: rgba(240, 237, 228, 0.62);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    font-family: var(--fm);
    cursor: pointer;
    transition: all .14s ease;
  }
  .mob-nav-btn.active {
    color: var(--term-accent-soft);
    border-color: rgba(232, 150, 125, 0.4);
    background: linear-gradient(135deg, rgba(232, 150, 125, 0.2), rgba(232, 150, 125, 0.08));
    box-shadow: inset 0 0 0 1px rgba(245, 196, 184, 0.18);
  }
  .mob-nav-icon { font-size: 12px; line-height: 1; }
  .mob-nav-label {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 1.1px;
    line-height: 1;
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
    letter-spacing: 1.4px;
    white-space: nowrap;
  }
  .terminal-shell :global(.war-room .signal-link) {
    color: #132418;
    background: rgba(240, 237, 228, 0.55);
    border-color: rgba(10, 26, 13, 0.28);
  }
  .terminal-shell :global(.war-room .ticker-flow) {
    border-bottom-color: var(--term-border-soft);
    background: rgba(9, 24, 16, 0.62);
  }
  .terminal-shell :global(.war-room .ticker-chip) {
    color: rgba(240, 237, 228, 0.78);
    border-color: rgba(232, 150, 125, 0.2);
    background: rgba(240, 237, 228, 0.03);
  }
  .terminal-shell :global(.war-room .ticker-label) {
    color: var(--term-accent-soft);
    border-color: rgba(232, 150, 125, 0.42);
    background: rgba(232, 150, 125, 0.16);
  }
  .terminal-shell :global(.war-room .ticker-tf) {
    color: var(--term-live);
    border-color: rgba(94, 203, 180, 0.44);
    background: rgba(94, 203, 180, 0.14);
  }
  .terminal-shell :global(.war-room .token-tabs) {
    border-bottom-color: var(--term-border-soft);
    background: rgba(9, 24, 16, 0.55);
  }
  .terminal-shell :global(.war-room .token-tab) {
    color: rgba(240, 237, 228, 0.78);
  }
  .terminal-shell :global(.war-room .token-tab.active) {
    color: var(--term-accent-soft);
    border-color: rgba(232, 150, 125, 0.52);
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
    color: rgba(245, 196, 184, 0.72);
  }

  .terminal-shell :global(.intel-panel) {
    border-left: 1px solid var(--term-border-soft);
  }
  .terminal-shell :global(.intel-panel .rp-tabs) {
    border-bottom-color: var(--term-border);
  }
  .terminal-shell :global(.intel-panel .rp-tab) {
    color: rgba(240, 237, 228, 0.8);
    background: rgba(240, 237, 228, 0.04);
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
    color: rgba(245, 196, 184, 0.78);
  }
  .terminal-shell :global(.intel-panel .rp-collapse:hover),
  .terminal-shell :global(.intel-panel .rp-panel-collapse:hover) {
    background: rgba(232, 150, 125, 0.14);
    color: var(--term-accent-soft);
  }
  .terminal-shell :global(.intel-panel .rp-inner-tabs) {
    border-bottom-color: var(--term-border-soft);
  }
  .terminal-shell :global(.intel-panel .rp-inner-tab) {
    color: rgba(240, 237, 228, 0.72);
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
  .terminal-shell :global(.intel-panel .hl-time),
  .terminal-shell :global(.intel-panel .ev-etime),
  .terminal-shell :global(.intel-panel .comm-time),
  .terminal-shell :global(.intel-panel .flow-addr),
  .terminal-shell :global(.intel-panel .ac-name) {
    color: rgba(240, 237, 228, 0.68);
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
  .terminal-shell :global(.tfbtn),
  .terminal-shell :global(.mode-btn),
  .terminal-shell :global(.scan-btn),
  .terminal-shell :global(.draw-btn),
  .terminal-shell :global(.ind-chip),
  .terminal-shell :global(.legend-chip) {
    color: rgba(240, 237, 228, 0.8);
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
  .terminal-shell :global(.scan-btn) {
    border-color: rgba(232, 150, 125, 0.45);
    background: linear-gradient(135deg, rgba(232, 150, 125, 0.3), rgba(232, 150, 125, 0.15));
    color: var(--term-accent-soft);
  }
  .terminal-shell :global(.scan-btn:hover) {
    border-color: rgba(232, 150, 125, 0.62);
    background: linear-gradient(135deg, rgba(232, 150, 125, 0.42), rgba(232, 150, 125, 0.24));
    color: var(--term-text);
    box-shadow: 0 0 10px rgba(232, 150, 125, 0.28);
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
    color: rgba(240, 237, 228, 0.8);
  }
  .terminal-shell :global(.loader) {
    border-color: rgba(232, 150, 125, 0.25);
    border-top-color: var(--term-accent);
  }
  .terminal-shell :global(.chart-footer) {
    border-top-color: rgba(232, 150, 125, 0.14);
    background: rgba(8, 20, 13, 0.55);
    color: rgba(240, 237, 228, 0.68);
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

  /* Mobile-only readability and touch ergonomics */
  .terminal-mobile :global(.war-room),
  .terminal-mobile :global(.intel-panel),
  .terminal-mobile :global(.chart-wrapper),
  .terminal-mobile :global(.tv-container) {
    border-radius: 12px;
    overflow: hidden;
  }
  .terminal-mobile :global(.war-room .wr-header) {
    height: 38px;
    padding: 0 12px;
  }
  .terminal-mobile :global(.war-room .wr-title) {
    font-size: 13px;
    letter-spacing: 1.5px;
  }
  .terminal-mobile :global(.war-room .signal-link),
  .terminal-mobile :global(.war-room .wr-collapse-btn) {
    display: none;
  }
  .terminal-mobile :global(.war-room .arena-trigger) {
    min-height: 28px;
    padding: 4px 8px;
    font-size: 9px;
  }
  .terminal-mobile :global(.scan-btn) {
    min-height: 28px;
    padding: 4px 10px;
    font-size: 9px;
  }
  .terminal-mobile :global(.war-room .token-tab),
  .terminal-mobile :global(.intel-panel .rp-tab),
  .terminal-mobile :global(.intel-panel .rp-inner-tab) {
    min-height: 38px;
    font-size: 10px;
    letter-spacing: 0.9px;
  }
  .terminal-mobile :global(.war-room .token-tab-count) {
    font-size: 8px;
  }
  .terminal-mobile :global(.war-room .deriv-strip) {
    padding: 6px 8px;
  }
  .terminal-mobile :global(.war-room .deriv-val) {
    font-size: 12px;
  }
  .terminal-mobile :global(.war-room .wr-msg-body) {
    padding: 10px 12px 10px 6px;
  }
  .terminal-mobile :global(.war-room .wr-msg-head) {
    gap: 5px;
    margin-bottom: 4px;
  }
  .terminal-mobile :global(.war-room .wr-msg-name),
  .terminal-mobile :global(.war-room .wr-msg-text) {
    font-size: 10px;
  }
  .terminal-mobile :global(.war-room .wr-msg-signal-row),
  .terminal-mobile :global(.war-room .wr-msg-actions) {
    margin-top: 6px;
    gap: 6px;
  }
  .terminal-mobile :global(.war-room .wr-act-btn),
  .terminal-mobile :global(.war-room .copy-trade-cta),
  .terminal-mobile :global(.war-room .signal-room-cta) {
    min-height: 34px;
  }
  .terminal-mobile :global(.war-room .wr-act-btn) {
    font-size: 8px;
    padding: 4px 7px;
  }
  .terminal-mobile :global(.war-room .ctc-text),
  .terminal-mobile :global(.war-room .src-text) {
    font-size: 9px;
    letter-spacing: 1px;
  }

  .terminal-mobile :global(.intel-panel .rp-tabs) {
    border-bottom-width: 2px;
  }
  .terminal-mobile :global(.intel-panel .rp-collapse) {
    width: 34px;
    font-size: 10px;
  }
  .terminal-mobile :global(.intel-panel .rp-panel-collapse) {
    display: none;
  }
  .terminal-mobile :global(.intel-panel .rp-body) {
    padding: 10px;
    gap: 8px;
  }
  .terminal-mobile :global(.intel-panel .hl-row),
  .terminal-mobile :global(.intel-panel .ev-card),
  .terminal-mobile :global(.intel-panel .pos-row),
  .terminal-mobile :global(.intel-panel .comm-post) {
    padding-top: 10px;
    padding-bottom: 10px;
  }
  .terminal-mobile :global(.intel-panel .hl-txt),
  .terminal-mobile :global(.intel-panel .comm-txt),
  .terminal-mobile :global(.intel-panel .ev-body),
  .terminal-mobile :global(.intel-panel .ac-txt) {
    font-size: 10px;
    line-height: 1.45;
  }
  .terminal-mobile :global(.intel-panel .ac-section) {
    flex: 1 1 auto;
    min-height: 185px;
    max-height: none;
  }
  .terminal-mobile :global(.intel-panel .ac-title) {
    font-size: 10px;
    letter-spacing: 1.2px;
  }
  .terminal-mobile :global(.intel-panel .ac-input) {
    padding: 6px 8px 8px;
    gap: 6px;
  }
  .terminal-mobile :global(.intel-panel .ac-input input) {
    min-height: 36px;
    font-size: 10px;
    padding: 8px 10px;
  }
  .terminal-mobile :global(.intel-panel .ac-send) {
    width: 38px;
    min-height: 36px;
    border-radius: 8px;
  }

  .terminal-tablet :global(.intel-panel .rp-body-wrap) {
    min-height: 0;
  }
  .terminal-tablet :global(.intel-panel .ac-section) {
    flex: 0 0 132px;
    min-height: 120px;
    max-height: none;
  }

  .terminal-mobile :global(.chart-wrapper .chart-bar) {
    flex-wrap: wrap;
    gap: 6px;
    padding: 8px 10px;
  }
  .terminal-mobile :global(.chart-wrapper .chart-bar > .live-indicator),
  .terminal-mobile :global(.chart-wrapper .chart-bar > .tdd) {
    display: none;
  }
  .terminal-mobile :global(.chart-wrapper .chart-bar > .tf-btns) {
    order: 1;
    width: 100%;
    overflow-x: auto;
    padding-bottom: 1px;
  }
  .terminal-mobile :global(.chart-wrapper .chart-bar > .mode-toggle),
  .terminal-mobile :global(.chart-wrapper .chart-bar > .draw-tools),
  .terminal-mobile :global(.chart-wrapper .chart-bar > .price-info) {
    order: 2;
  }
  .terminal-mobile :global(.chart-wrapper .indicator-strip) {
    padding: 6px 8px;
    gap: 5px;
  }
  .terminal-mobile :global(.chart-wrapper .ind-chip),
  .terminal-mobile :global(.chart-wrapper .legend-chip),
  .terminal-mobile :global(.chart-wrapper .view-chip) {
    min-height: 24px;
  }
  .terminal-mobile :global(.chart-wrapper .chart-footer) {
    gap: 6px;
    font-size: 8px;
    padding: 4px 8px;
  }

  @media (max-width: 768px) {
    .terminal-shell::before,
    .term-stars-soft,
    .term-grain {
      opacity: 0.2;
    }
    .term-stars {
      opacity: 0.28;
    }
  }
</style>
