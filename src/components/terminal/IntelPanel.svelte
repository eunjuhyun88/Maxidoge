<script lang="ts">
  import type { Headline } from '$lib/data/warroom';
  import { communityPosts, hydrateCommunityPosts, likeCommunityPost } from '$lib/stores/communityStore';
  import { openTrades, closeQuickTrade } from '$lib/stores/quickTradeStore';
  import { gameState } from '$lib/stores/gameState';
  import { predictMarkets, loadPolymarkets } from '$lib/stores/predictStore';
  import { fetchUiStateApi, updateUiStateApi } from '$lib/api/preferencesApi';
  import { parseOutcomePrices } from '$lib/api/polymarket';
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';

  const dispatch = createEventDispatcher();

  // Chat props (passed from terminal page)
  export let chatMessages: { from: string; icon: string; color: string; text: string; time: string; isUser: boolean; isSystem?: boolean }[] = [];
  export let isTyping = false;
  export let prioritizeChat = false;
  type ScanHighlight = {
    agent: string;
    vote: 'long' | 'short' | 'neutral';
    conf: number;
    note: string;
  };
  type ScanBrief = {
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
  export let latestScan: ScanBrief | null = null;

  let activeTab = 'intel';
  let innerTab = 'chat';
  let tabCollapsed = false;
  let _uiStateSaveTimer: ReturnType<typeof setTimeout> | null = null;

  // ═══ Live data from API (replaces hardcoded) ═══
  interface HeadlineEx extends Headline {
    interactions?: number;
    importance?: number;
    network?: string;
    creator?: string;
  }
  let liveHeadlines: HeadlineEx[] = [];
  let headlineOffset = 0;
  let headlineHasMore = true;
  let headlineLoading = false;
  let headlineSortBy: 'importance' | 'time' = 'importance';
  let liveEvents: Array<{ id: string; tag: string; level: string; text: string; source: string; createdAt: number }> = [];
  let liveFlows: Array<{ id: string; label: string; addr: string; amt: string; isBuy: boolean }> = [];
  let dataLoaded = { headlines: false, events: false, flow: false, trending: false };

  // ═══ Trending data ═══
  interface TrendingCoin { rank: number; symbol: string; name: string; price: number; change1h: number; change24h: number; change7d: number; volume24h: number; sentiment?: number | null; socialVolume?: number | null; galaxyScore?: number | null; }
  interface GainerLoser extends TrendingCoin { direction: 'gainer' | 'loser'; }
  interface DexHot { chainId: string; tokenAddress: string; url: string; description: string | null; icon: string | null; }
  let trendingCoins: TrendingCoin[] = [];
  let trendGainers: GainerLoser[] = [];
  let trendLosers: GainerLoser[] = [];
  let trendDexHot: DexHot[] = [];
  let trendSubTab: 'hot' | 'gainers' | 'dex' | 'picks' = 'picks';
  let trendLoading = false;

  // ═══ Opportunity Scanner (TOP PICKS) ═══
  interface OpScore {
    symbol: string; name: string; price: number;
    change1h: number; change24h: number; change7d: number;
    volume24h: number; marketCap: number;
    momentumScore: number; volumeScore: number; socialScore: number;
    macroScore: number; onchainScore: number; totalScore: number;
    direction: 'long' | 'short' | 'neutral'; confidence: number;
    reasons: string[]; alerts: string[];
    sentiment?: number | null; galaxyScore?: number | null;
  }
  interface OpAlert { symbol: string; type: string; severity: string; message: string; score: number; }
  let topPicks: OpScore[] = [];
  let opAlerts: OpAlert[] = [];
  let macroRegime = '';
  let picksLoading = false;
  let picksScanTime = 0;
  let picksLoaded = false;

  // Chat input (local)
  let chatInput = '';
  let chatEl: HTMLDivElement;

  function setTab(tab: string) {
    if (activeTab === tab) {
      tabCollapsed = !tabCollapsed;
    } else {
      activeTab = tab;
      tabCollapsed = false;
      if (tab === 'intel') {
        innerTab = 'chat';
        queueUiStateSave({ terminalInnerTab: innerTab });
      }
      queueUiStateSave({ terminalActiveTab: activeTab });
    }
  }
  function setInnerTab(tab: string) {
    innerTab = tab;
    queueUiStateSave({ terminalInnerTab: innerTab });
    if (tab === 'trending') { fetchTopPicks(); fetchTrendingData(); }
  }

  function queueUiStateSave(partial: Record<string, unknown>) {
    if (_uiStateSaveTimer) clearTimeout(_uiStateSaveTimer);
    _uiStateSaveTimer = setTimeout(() => {
      void updateUiStateApi(partial);
    }, 260);
  }

  function handleClosePos(id: string) {
    const trade = opens.find(t => t.id === id);
    if (!trade) return;
    const state = $gameState;
    const token = trade.pair.split('/')[0] as keyof typeof state.prices;
    const price = state.prices[token] || state.prices.BTC;
    closeQuickTrade(id, price);
  }

  let _isComposing = false;

  function sendChat() {
    if (!chatInput.trim()) return;
    dispatch('sendchat', { text: chatInput });
    chatInput = '';
  }
  function chatKey(e: KeyboardEvent) {
    // 한글 IME 조합 중에는 Enter 무시 (이중 전송 방지)
    if (e.isComposing || _isComposing) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      sendChat();
    }
  }

  // Auto-scroll chat when messages change
  $: if (chatMessages.length && chatEl) {
    setTimeout(() => { if (chatEl) chatEl.scrollTop = chatEl.scrollHeight; }, 50);
  }

  $: opens = $openTrades;
  $: openCount = opens.length;
  $: latestScanTime = latestScan ? new Date(latestScan.createdAt).toTimeString().slice(0, 5) : '';

  // ═══ Filter headlines by current chart ticker ═══
  $: currentToken = $gameState.pair.split('/')[0] || 'BTC';
  $: tokenAliases = getTokenAliases(currentToken);
  $: headlineSource = liveHeadlines;
  $: filteredHeadlines = headlineSource.filter(hl =>
    tokenAliases.some(alias => hl.text.toLowerCase().includes(alias)) ||
    hl.text.toLowerCase().includes('crypto') ||
    hl.text.toLowerCase().includes('exchange') ||
    hl.text.toLowerCase().includes('market')
  );
  // Show all if no matches
  $: displayHeadlines = filteredHeadlines.length >= 2 ? filteredHeadlines : headlineSource;

  async function fetchLiveHeadlines(append = false) {
    if (headlineLoading) return;
    headlineLoading = true;
    try {
      const token = ($gameState.pair || 'BTC/USDT').split('/')[0];
      const offset = append ? headlineOffset : 0;
      const res = await fetch(
        `/api/market/news?limit=20&offset=${offset}&token=${encodeURIComponent(token)}&sort=${headlineSortBy}&interval=1m`
      );
      const json = await res.json();
      if (json.ok && json.data?.records?.length > 0) {
        const newItems: HeadlineEx[] = json.data.records.map((r: any) => ({
          icon: r.sentiment === 'bullish' ? '📈' : r.sentiment === 'bearish' ? '📉' : '📊',
          time: formatRelativeTime(r.publishedAt),
          text: r.title || r.summary,
          bull: r.sentiment === 'bullish',
          link: r.link || '',
          interactions: r.interactions || 0,
          importance: r.importance || 0,
          network: r.network || 'rss',
          creator: r.creator || r.source || '',
        }));
        if (append) {
          liveHeadlines = [...liveHeadlines, ...newItems];
        } else {
          liveHeadlines = newItems;
        }
        headlineOffset = (json.data.offset ?? 0) + newItems.length;
        headlineHasMore = json.data.hasMore ?? false;
        dataLoaded.headlines = true;
        dataLoaded = dataLoaded;
      }
    } catch (e) {
      console.warn('[IntelPanel] Headlines API unavailable, using fallback');
    } finally {
      headlineLoading = false;
    }
  }

  function loadMoreHeadlines() {
    if (headlineHasMore && !headlineLoading) {
      fetchLiveHeadlines(true);
    }
  }

  function toggleHeadlineSort() {
    headlineSortBy = headlineSortBy === 'importance' ? 'time' : 'importance';
    headlineOffset = 0;
    headlineHasMore = true;
    fetchLiveHeadlines(false);
  }

  function handleHeadlineScroll(e: Event) {
    const el = e.target as HTMLElement;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 60) {
      loadMoreHeadlines();
    }
  }

  async function fetchLiveEvents() {
    try {
      const pair = $gameState.pair || 'BTC/USDT';
      const res = await fetch(`/api/market/events?pair=${encodeURIComponent(pair)}`);
      const json = await res.json();
      if (json.ok && json.data?.records?.length > 0) {
        liveEvents = json.data.records;
        dataLoaded.events = true;
        dataLoaded = dataLoaded;
      }
    } catch (e) {
      console.warn('[IntelPanel] Events API unavailable, using fallback');
    }
  }

  async function fetchLiveFlow() {
    try {
      const pair = $gameState.pair || 'BTC/USDT';
      const res = await fetch(`/api/market/flow?pair=${encodeURIComponent(pair)}`);
      const json = await res.json();
      if (json.ok && json.data) {
        const snap = json.data.snapshot || {};
        const flows: typeof liveFlows = [];
        if (snap.funding != null) {
          flows.push({
            id: 'funding',
            label: `Funding Rate ${snap.funding > 0 ? '↑' : '↓'}`,
            addr: json.data.pair,
            amt: `${(snap.funding * 100).toFixed(4)}%`,
            isBuy: snap.funding < 0
          });
        }
        if (snap.liqLong24h || snap.liqShort24h) {
          flows.push({
            id: 'liq-long',
            label: '↙ Liquidations LONG 24h',
            addr: json.data.pair,
            amt: `$${Math.round(snap.liqLong24h || 0).toLocaleString()}`,
            isBuy: false
          });
          flows.push({
            id: 'liq-short',
            label: '↗ Liquidations SHORT 24h',
            addr: json.data.pair,
            amt: `$${Math.round(snap.liqShort24h || 0).toLocaleString()}`,
            isBuy: true
          });
        }
        if (snap.quoteVolume24h) {
          flows.push({
            id: 'volume',
            label: '↔ 24h Quote Volume',
            addr: json.data.pair,
            amt: `$${(snap.quoteVolume24h / 1e9).toFixed(2)}B`,
            isBuy: (snap.priceChangePct || 0) >= 0
          });
        }
        if (flows.length > 0) {
          liveFlows = flows;
          dataLoaded.flow = true;
          dataLoaded = dataLoaded;
        }
      }
    } catch (e) {
      console.warn('[IntelPanel] Flow API unavailable, using fallback');
    }
  }

  async function fetchTrendingData() {
    if (dataLoaded.trending || trendLoading) return;
    trendLoading = true;
    try {
      const res = await fetch('/api/market/trending?section=all&limit=15');
      const json = await res.json();
      if (json.ok && json.data) {
        trendingCoins = json.data.trending ?? [];
        trendGainers = json.data.gainers ?? [];
        trendLosers = json.data.losers ?? [];
        trendDexHot = json.data.dexHot ?? [];
        dataLoaded.trending = true;
        dataLoaded = dataLoaded;
      }
    } catch (e) {
      console.warn('[IntelPanel] Trending API unavailable');
    } finally {
      trendLoading = false;
    }
  }

  async function fetchTopPicks() {
    if (picksLoaded || picksLoading) return;
    picksLoading = true;
    try {
      const res = await fetch('/api/terminal/opportunity-scan?limit=15');
      const json = await res.json();
      if (json.ok && json.data) {
        topPicks = json.data.coins ?? [];
        opAlerts = json.data.alerts ?? [];
        macroRegime = json.data.macroBackdrop?.regime ?? '';
        picksScanTime = json.data.scanDurationMs ?? 0;
        picksLoaded = true;
      }
    } catch (e) {
      console.warn('[IntelPanel] Opportunity scan unavailable');
    } finally {
      picksLoading = false;
    }
  }

  function scoreColor(score: number): string {
    if (score >= 65) return '#00e676';
    if (score >= 50) return '#ffeb3b';
    if (score >= 35) return '#ff9800';
    return '#ff1744';
  }

  function dirIcon(dir: string): string {
    if (dir === 'long') return '▲';
    if (dir === 'short') return '▼';
    return '●';
  }

  function dirColor(dir: string): string {
    if (dir === 'long') return '#00e676';
    if (dir === 'short') return '#ff1744';
    return '#ffeb3b';
  }

  function fmtTrendPrice(p: number): string {
    if (!Number.isFinite(p)) return '$0';
    if (p >= 1000) return '$' + p.toLocaleString(undefined, { maximumFractionDigits: 0 });
    if (p >= 1) return '$' + p.toFixed(2);
    if (p >= 0.001) return '$' + p.toFixed(4);
    return '$' + p.toFixed(6);
  }

  function fmtTrendVol(v: number): string {
    if (v >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B';
    if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
    if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
    return '$' + v.toFixed(0);
  }

  function formatRelativeTime(ts: number): string {
    const mins = Math.round((Date.now() - ts) / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    if (mins < 1440) return `${Math.round(mins / 60)}h`;
    return `${Math.round(mins / 1440)}d`;
  }

  function getTokenAliases(token: string): string[] {
    const map: Record<string, string[]> = {
      BTC: ['btc', 'bitcoin', 'microstrategy'],
      ETH: ['eth', 'ethereum', 'vitalik'],
      SOL: ['sol', 'solana'],
      DOGE: ['doge', 'dogecoin'],
      XRP: ['xrp', 'ripple'],
    };
    return map[token] || [token.toLowerCase()];
  }

  // ═══ Pair 변경 시 Events/Flow 자동 refetch ═══
  let _prevPair = '';
  let _pairRefetchTimer: ReturnType<typeof setTimeout> | null = null;
  $: {
    const pair = $gameState.pair || 'BTC/USDT';
    if (_prevPair && pair !== _prevPair) {
      // pair 바뀌면 debounce 후 refetch (빠른 전환 스팸 방지)
      if (_pairRefetchTimer) clearTimeout(_pairRefetchTimer);
      _pairRefetchTimer = setTimeout(() => {
        headlineOffset = 0;
        headlineHasMore = true;
        fetchLiveHeadlines(false);
        fetchLiveEvents();
        fetchLiveFlow();
      }, 300);
    }
    _prevPair = pair;
  }

  // Crypto prediction markets for POSITIONS tab
  const CRYPTO_RX = /\b(bitcoin|btc|ethereum|eth|solana|sol|crypto|defi|web3)\b/i;
  $: cryptoMarkets = $predictMarkets
    .filter(m => CRYPTO_RX.test(m.question))
    .slice(0, 8);

  onMount(() => {
    loadPolymarkets();
    hydrateCommunityPosts();
    void (async () => {
      const ui = await fetchUiStateApi();
      // 채팅이 항상 최우선 — 저장된 상태보다 우선
      // 사용자가 다른 탭을 명시적으로 선택하면 그때 저장됨
      if (prioritizeChat) {
        activeTab = 'intel';
        innerTab = 'chat';
        tabCollapsed = false;
      } else {
        // 저장 상태 복원하되, 항상 chat을 기본 innerTab으로
        if (ui?.terminalActiveTab && ['intel', 'community', 'positions'].includes(ui.terminalActiveTab)) {
          activeTab = ui.terminalActiveTab;
        }
        // innerTab은 항상 chat으로 시작 (headlines/events/flow는 사용자가 직접 선택)
        innerTab = 'chat';
      }
    })();

    // ── Load live market data ──
    fetchLiveHeadlines();
    fetchLiveEvents();
    fetchLiveFlow();
  });

  onDestroy(() => {
    if (_pairRefetchTimer) clearTimeout(_pairRefetchTimer);
    if (_uiStateSaveTimer) clearTimeout(_uiStateSaveTimer);
  });
</script>

<div class="intel-panel">
  <!-- Main Tabs with collapse toggle -->
  <div class="rp-tabs">
    <button class="rp-tab" class:active={activeTab === 'intel'} on:click={() => setTab('intel')}>INTEL</button>
    <button class="rp-tab" class:active={activeTab === 'community'} on:click={() => setTab('community')}>COMMUNITY</button>
    <button class="rp-tab" class:active={activeTab === 'positions'} on:click={() => setTab('positions')}>POSITIONS</button>
    <button class="rp-collapse" on:click={() => tabCollapsed = !tabCollapsed} title={tabCollapsed ? 'Expand' : 'Collapse'}>
      {tabCollapsed ? '▲' : '▼'}
    </button>
    <button class="rp-panel-collapse" on:click={() => dispatch('collapse')} title="Collapse panel">
      <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="1" y="2" width="14" height="12" rx="1.5"/>
        <line x1="10" y1="2" x2="10" y2="14"/>
      </svg>
    </button>
  </div>

  <!-- Tab Content (collapsible) -->
  {#if !tabCollapsed}
    <div class="rp-body-wrap">
      {#if activeTab === 'intel'}
        <div class="rp-inner-tabs">
          {#each ['chat', 'headlines', 'trending', 'events', 'flow'] as tab}
            <button class="rp-inner-tab" class:active={innerTab === tab} on:click={() => setInnerTab(tab)}>
              {tab.toUpperCase()}
            </button>
          {/each}
        </div>

        <div class="rp-body" class:chat-mode={innerTab === 'chat'}>
          {#if innerTab === 'chat'}
            <div class="ac-section ac-embedded">
              <div class="ac-header">
                <span class="ac-title">🤖 AGENT CHAT</span>
              </div>
              <!-- scan-brief 제거: 스캔 데이터는 채팅 패널에 표시하지 않음 -->
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
                <input type="text" bind:value={chatInput} on:keydown={chatKey} on:compositionstart={() => _isComposing = true} on:compositionend={() => _isComposing = false} placeholder="@STRUCTURE @FLOW @DERIV ..." />
                <button class="ac-send" on:click={sendChat} disabled={!chatInput.trim()}>⚡</button>
              </div>
            </div>

          {:else if innerTab === 'headlines'}
            <div class="hl-header-bar">
              <span class="hl-ticker-badge">{currentToken} NEWS</span>
              <button class="hl-sort-btn" on:click={toggleHeadlineSort} title="Toggle sort">
                {headlineSortBy === 'importance' ? '🔥 HOT' : '🕐 NEW'}
              </button>
            </div>
            <div class="hl-list hl-scrollable" on:scroll={handleHeadlineScroll}>
              {#if displayHeadlines.length === 0 && !headlineLoading}
                <div class="flow-empty">No headlines yet</div>
              {/if}
              {#each displayHeadlines as hl}
                {#if hl.link}
                  <a class="hl-row hl-linked" href={hl.link} target="_blank" rel="noopener noreferrer">
                    <span class="hl-icon">{hl.icon}</span>
                    <div class="hl-main">
                      <span class="hl-txt" class:bull={hl.bull}>{hl.text}</span>
                      <div class="hl-meta">
                        <span class="hl-time">{hl.time}</span>
                        {#if hl.network && hl.network !== 'rss'}
                          <span class="hl-net">{hl.network}</span>
                        {/if}
                        {#if hl.interactions && hl.interactions > 0}
                          <span class="hl-engage">🔥 {hl.interactions > 1000 ? `${(hl.interactions / 1000).toFixed(1)}K` : hl.interactions}</span>
                        {/if}
                        {#if hl.creator && hl.network !== 'rss'}
                          <span class="hl-creator">@{hl.creator.slice(0, 15)}</span>
                        {/if}
                      </div>
                    </div>
                    <span class="hl-ext">&#8599;</span>
                  </a>
                {:else}
                  <div class="hl-row">
                    <span class="hl-icon">{hl.icon}</span>
                    <div class="hl-main">
                      <span class="hl-txt" class:bull={hl.bull}>{hl.text}</span>
                      <div class="hl-meta">
                        <span class="hl-time">{hl.time}</span>
                        {#if hl.network && hl.network !== 'rss'}
                          <span class="hl-net">{hl.network}</span>
                        {/if}
                      </div>
                    </div>
                  </div>
                {/if}
              {/each}
              {#if headlineLoading}
                <div class="hl-loading">Loading more...</div>
              {/if}
              {#if !headlineHasMore && displayHeadlines.length > 0}
                <div class="hl-end">— end of headlines —</div>
              {/if}
            </div>

          {:else if innerTab === 'events'}
            <div class="ev-list">
              {#if liveEvents.length === 0}
                <div class="flow-empty">Loading events...</div>
              {/if}
              {#each liveEvents as ev}
                <div class="ev-card" style="border-left-color:{ev.level === 'warning' ? '#ff8c3b' : '#3b9eff'}">
                  <div class="ev-head">
                    <span class="ev-tag" style="background:{ev.tag === 'DERIV' ? '#ff8c3b' : ev.tag === 'ON-CHAIN' ? '#00e68a' : ev.tag === 'SOCIAL' ? '#8b5cf6' : '#3b9eff'};color:#000">{ev.tag}</span>
                    <span class="ev-etime">{formatRelativeTime(ev.createdAt)}</span>
                  </div>
                  <div class="ev-body">{ev.text}</div>
                  <span class="ev-src">{ev.source}</span>
                </div>
              {/each}
            </div>

          {:else if innerTab === 'trending'}
            <div class="trend-panel">
              <div class="trend-sub-tabs">
                <button class="trend-sub" class:active={trendSubTab === 'picks'} on:click={() => { trendSubTab = 'picks'; fetchTopPicks(); }}>🎯 PICKS</button>
                <button class="trend-sub" class:active={trendSubTab === 'hot'} on:click={() => trendSubTab = 'hot'}>🔥 HOT</button>
                <button class="trend-sub" class:active={trendSubTab === 'gainers'} on:click={() => trendSubTab = 'gainers'}>📈 GAINERS</button>
                <button class="trend-sub" class:active={trendSubTab === 'dex'} on:click={() => trendSubTab = 'dex'}>💎 DEX</button>
              </div>

              {#if trendSubTab === 'picks'}
                <div class="picks-panel">
                  {#if picksLoading}
                    <div class="trend-loading">⏳ 멀티-에셋 스캔 중... ({topPicks.length > 0 ? '갱신' : '분석'})</div>
                  {:else if topPicks.length > 0}
                    <!-- Macro regime banner -->
                    <div class="picks-macro" class:risk-on={macroRegime === 'risk-on'} class:risk-off={macroRegime === 'risk-off'}>
                      매크로: <strong>{macroRegime === 'risk-on' ? '🟢 RISK-ON' : macroRegime === 'risk-off' ? '🔴 RISK-OFF' : '🟡 NEUTRAL'}</strong>
                      {#if picksScanTime > 0}<span class="picks-time">({(picksScanTime / 1000).toFixed(1)}s)</span>{/if}
                    </div>

                    <!-- Alerts banner -->
                    {#if opAlerts.length > 0}
                      <div class="picks-alerts">
                        {#each opAlerts.slice(0, 3) as alert}
                          <div class="pa-row" class:critical={alert.severity === 'critical'} class:warning={alert.severity === 'warning'}>
                            <span class="pa-msg">{alert.message}</span>
                          </div>
                        {/each}
                      </div>
                    {/if}

                    <!-- Top 5 ranked picks -->
                    <div class="picks-section-lbl">🎯 TOP OPPORTUNITIES</div>
                    {#each topPicks.slice(0, 5) as pick, i (pick.symbol)}
                      <div class="pick-card">
                        <div class="pick-head">
                          <span class="pick-rank" style="color:{scoreColor(pick.totalScore)}">#{i + 1}</span>
                          <span class="pick-sym">{pick.symbol}</span>
                          <span class="pick-dir" style="color:{dirColor(pick.direction)}">{dirIcon(pick.direction)} {pick.direction.toUpperCase()}</span>
                          <span class="pick-score" style="color:{scoreColor(pick.totalScore)}">{pick.totalScore}/100</span>
                        </div>
                        <div class="pick-price">
                          {fmtTrendPrice(pick.price)}
                          <span class="trend-chg" class:up={pick.change24h >= 0} class:dn={pick.change24h < 0}>
                            {pick.change24h >= 0 ? '+' : ''}{pick.change24h.toFixed(1)}%
                          </span>
                        </div>
                        <div class="pick-bar">
                          <div class="pb-seg mom" style="width:{pick.momentumScore}px" title="Momentum {pick.momentumScore}/25"></div>
                          <div class="pb-seg vol" style="width:{pick.volumeScore}px" title="Volume {pick.volumeScore}/20"></div>
                          <div class="pb-seg soc" style="width:{pick.socialScore}px" title="Social {pick.socialScore}/20"></div>
                          <div class="pb-seg mac" style="width:{pick.macroScore}px" title="Macro {pick.macroScore}/15"></div>
                          <div class="pb-seg onc" style="width:{pick.onchainScore}px" title="OnChain {pick.onchainScore}/20"></div>
                        </div>
                        <div class="pick-reasons">
                          {#each pick.reasons as reason}
                            <span class="pr-tag">{reason}</span>
                          {/each}
                        </div>
                        {#if pick.alerts.length > 0}
                          <div class="pick-alerts">
                            {#each pick.alerts.slice(0, 2) as a}<span class="pa-mini">{a}</span>{/each}
                          </div>
                        {/if}
                      </div>
                    {/each}

                    <!-- Rescan button -->
                    <button class="picks-rescan" on:click={() => { picksLoaded = false; fetchTopPicks(); }}>
                      🔄 다시 스캔
                    </button>
                  {:else}
                    <div class="trend-empty">🎯 PICKS 탭을 누르면 자동으로 트렌딩 코인을 분석합니다</div>
                  {/if}
                </div>

              {:else if trendLoading}
                <div class="trend-loading">Loading trending data...</div>
              {:else if trendSubTab === 'hot'}
                <div class="trend-list">
                  {#each trendingCoins as coin, i (coin.symbol + i)}
                    <div class="trend-row">
                      <span class="trend-rank">#{coin.rank}</span>
                      <div class="trend-coin">
                        <span class="trend-sym">{coin.symbol}</span>
                        <span class="trend-name">{coin.name}</span>
                      </div>
                      <div class="trend-data">
                        <span class="trend-price">{fmtTrendPrice(coin.price)}</span>
                        <span class="trend-chg" class:up={coin.change24h >= 0} class:dn={coin.change24h < 0}>
                          {coin.change24h >= 0 ? '+' : ''}{coin.change24h.toFixed(1)}%
                        </span>
                      </div>
                      <div class="trend-social">
                        {#if coin.socialVolume != null && coin.socialVolume > 0}
                          <span class="trend-soc" title="Social volume">💬 {coin.socialVolume > 1000 ? (coin.socialVolume / 1000).toFixed(0) + 'K' : coin.socialVolume}</span>
                        {/if}
                        {#if coin.galaxyScore != null && coin.galaxyScore > 0}
                          <span class="trend-galaxy" title="Galaxy Score">⭐ {coin.galaxyScore}</span>
                        {/if}
                      </div>
                    </div>
                  {/each}
                  {#if trendingCoins.length === 0}
                    <div class="trend-empty">No trending data available</div>
                  {/if}
                </div>

              {:else if trendSubTab === 'gainers'}
                <div class="trend-list">
                  {#if trendGainers.length > 0}
                    <div class="trend-section-lbl up">▲ TOP GAINERS 24H</div>
                    {#each trendGainers as coin, i (coin.symbol + '-g-' + i)}
                      <div class="trend-row gainer">
                        <span class="trend-rank">#{i + 1}</span>
                        <div class="trend-coin">
                          <span class="trend-sym">{coin.symbol}</span>
                          <span class="trend-name">{coin.name}</span>
                        </div>
                        <div class="trend-data">
                          <span class="trend-price">{fmtTrendPrice(coin.price)}</span>
                          <span class="trend-chg up">+{coin.change24h.toFixed(1)}%</span>
                        </div>
                        <span class="trend-vol">{fmtTrendVol(coin.volume24h)}</span>
                      </div>
                    {/each}
                  {/if}
                  {#if trendLosers.length > 0}
                    <div class="trend-section-lbl dn">▼ TOP LOSERS 24H</div>
                    {#each trendLosers as coin, i (coin.symbol + '-l-' + i)}
                      <div class="trend-row loser">
                        <span class="trend-rank">#{i + 1}</span>
                        <div class="trend-coin">
                          <span class="trend-sym">{coin.symbol}</span>
                          <span class="trend-name">{coin.name}</span>
                        </div>
                        <div class="trend-data">
                          <span class="trend-price">{fmtTrendPrice(coin.price)}</span>
                          <span class="trend-chg dn">{coin.change24h.toFixed(1)}%</span>
                        </div>
                        <span class="trend-vol">{fmtTrendVol(coin.volume24h)}</span>
                      </div>
                    {/each}
                  {/if}
                  {#if trendGainers.length === 0 && trendLosers.length === 0}
                    <div class="trend-empty">No gainers/losers data</div>
                  {/if}
                </div>

              {:else if trendSubTab === 'dex'}
                <div class="trend-list">
                  <div class="trend-section-lbl">💎 DEX HOT TOKENS</div>
                  {#each trendDexHot as token, i (token.chainId + token.tokenAddress)}
                    <a class="trend-row dex-row" href={token.url} target="_blank" rel="noopener">
                      <span class="trend-rank">#{i + 1}</span>
                      {#if token.icon}
                        <img class="dex-icon" src={token.icon} alt="" width="18" height="18" />
                      {/if}
                      <div class="trend-coin">
                        <span class="trend-sym">{token.chainId}</span>
                        <span class="trend-name dex-addr">{token.tokenAddress.slice(0, 6)}...{token.tokenAddress.slice(-4)}</span>
                      </div>
                      {#if token.description}
                        <span class="dex-desc">{token.description.slice(0, 40)}{token.description.length > 40 ? '...' : ''}</span>
                      {/if}
                      <span class="dex-link">↗</span>
                    </a>
                  {/each}
                  {#if trendDexHot.length === 0}
                    <div class="trend-empty">No DEX trending data</div>
                  {/if}
                </div>
              {/if}
            </div>

          {:else if innerTab === 'flow'}
            <div class="flow-list">
              <div class="flow-section-lbl">SMART MONEY FLOWS (24H)</div>
              {#if liveFlows.length === 0}
                <div class="flow-empty">Loading flow data...</div>
              {/if}
              {#each liveFlows as flow (flow.id)}
                <div class="flow-row">
                  <div class="flow-dir" class:buy={flow.isBuy} class:sell={!flow.isBuy}>{flow.isBuy ? '↑' : '↓'}</div>
                  <div class="flow-info">
                    <div class="flow-lbl">{flow.label}</div>
                    <div class="flow-addr">{flow.addr}</div>
                  </div>
                  <div class="flow-amt" class:buy={flow.isBuy} class:sell={!flow.isBuy}>{flow.amt}</div>
                </div>
              {/each}
            </div>
          {/if}
        </div>

      {:else if activeTab === 'community'}
        <div class="rp-body community-body">
          <!-- User posts (from store) -->
          {#each $communityPosts as post (post.id)}
            <div class="comm-post user-post">
              <div class="comm-head">
                <div class="comm-avatar" style="background:{post.avatarColor}20;color:{post.avatarColor}">{post.avatar}</div>
                <span class="comm-name">{post.author}</span>
                <span class="comm-time">now</span>
              </div>
              <div class="comm-txt">{post.text}</div>
              <div class="comm-actions">
                {#if post.signal}
                  <span class="comm-sig {post.signal}">{post.signal.toUpperCase()}</span>
                {/if}
                <button class="comm-react" on:click={() => likeCommunityPost(post.id)}>👍</button>
                <button class="comm-react" on:click={() => likeCommunityPost(post.id)}>🔥</button>
              </div>
            </div>
          {/each}

          {#if $communityPosts.length === 0}
            <div class="flow-empty">No community posts yet. Be the first to share your analysis!</div>
          {/if}
        </div>

      {:else if activeTab === 'positions'}
        <div class="rp-body">
          <!-- PREDICT section (horizontal scroll, above positions) -->
          <div class="pp-section">
            <div class="pp-header">
              <span class="pp-title">🔮 PREDICT</span>
              {#if cryptoMarkets.length > 0}
                <span class="pp-cnt">{cryptoMarkets.length}</span>
              {/if}
            </div>
            {#if cryptoMarkets.length > 0}
              <div class="pp-scroll">
                {#each cryptoMarkets as market}
                  {@const outcome = parseOutcomePrices(market.outcomePrices)}
                  <a class="pp-card pp-linked" href="https://polymarket.com/event/{market.slug}" target="_blank" rel="noopener noreferrer">
                    <div class="pp-q">{market.question.length > 70 ? market.question.slice(0, 70) + '…' : market.question}</div>
                    <div class="pp-bar-wrap">
                      <div class="pp-bar-yes" style="width:{outcome.yes}%"></div>
                    </div>
                    <div class="pp-odds">
                      <span class="pp-yes">YES {outcome.yes}¢</span>
                      <span class="pp-no">NO {outcome.no}¢</span>
                    </div>
                    <span class="pp-ext">&#8599; Polymarket</span>
                  </a>
                {/each}
              </div>
              <div class="pp-hint">← swipe →</div>
            {:else}
              <div class="pp-empty">Loading markets...</div>
            {/if}
          </div>

          <!-- Open Positions -->
          {#if openCount > 0}
            <div class="pos-header">
              <span class="pos-title">📊 POSITIONS</span>
              <span class="pos-cnt">{openCount}</span>
            </div>
            {#each opens as trade (trade.id)}
              <div class="pos-row">
                <span class="pos-dir" class:long={trade.dir === 'LONG'} class:short={trade.dir === 'SHORT'}>
                  {trade.dir === 'LONG' ? '▲' : '▼'}
                </span>
                <div class="pos-info">
                  <span class="pos-pair">{trade.pair}</span>
                  <span class="pos-entry">${Math.round(trade.entry).toLocaleString()}</span>
                </div>
                <span class="pos-pnl" style="color:{trade.pnlPercent >= 0 ? 'var(--grn)' : 'var(--red)'}">
                  {trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(1)}%
                </span>
                <button class="pos-close" on:click={() => handleClosePos(trade.id)}>CLOSE</button>
              </div>
            {/each}
          {:else}
            <div class="pos-empty-mini">
              <span class="pos-empty-icon">📊</span>
              <span class="pos-empty-txt">NO OPEN POSITIONS</span>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .intel-panel { display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--blk); overflow: hidden; }

  /* ── Tabs ── */
  .rp-tabs { display: flex; border-bottom: 3px solid var(--yel); flex-shrink: 0; }
  .rp-tab {
    flex: 1; padding: 8px 3px;
    font-family: var(--fm); font-size: 10px; font-weight: 700; letter-spacing: 1.8px; text-align: center;
    background: none; border: none; cursor: pointer; transition: all .15s;
  }
  .rp-tab.active { background: var(--yel); color: var(--blk); }
  .rp-tab:not(.active) { color: rgba(255,255,255,.62); }
  .rp-tab:not(.active):hover { color: var(--yel); }
  .rp-collapse {
    width: 28px; flex-shrink: 0;
    background: rgba(255,230,0,.08); border: none; border-left: 1px solid rgba(255,230,0,.15);
    color: var(--yel); font-size: 10px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background .12s;
  }
  .rp-collapse:hover { background: rgba(255,230,0,.2); }
  .rp-panel-collapse {
    width: 24px; flex-shrink: 0;
    background: rgba(255,255,255,.03); border: none; border-left: 1px solid rgba(255,230,0,.1);
    color: rgba(255,230,0,.68); cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: all .12s; padding: 0;
  }
  .rp-panel-collapse:hover { background: rgba(255,230,0,.15); color: var(--yel); }

  .rp-inner-tabs { display: flex; border-bottom: 2px solid rgba(255,230,0,.15); flex-shrink: 0; }
  .rp-inner-tab {
    flex: 1; padding: 5px 2px;
    font-family: var(--fm); font-size: 9px; font-weight: 700; letter-spacing: 1px; text-align: center;
    background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer;
    color: rgba(255,255,255,.62); transition: all .15s;
  }
  .rp-inner-tab.active { color: var(--yel); border-bottom-color: var(--pk); }

  /* ── Tab Content Wrapper ── */
  .rp-body-wrap { flex: 1 1 auto; overflow: hidden; display: flex; flex-direction: column; min-height: 72px; }
  .rp-body { flex: 1; min-height: 0; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
  .rp-body.chat-mode { padding: 0; overflow: hidden; }

  /* ── Headlines ── */
  .hl-header-bar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 4px 8px;
    background: rgba(255,230,0,.06);
    border-bottom: 1px solid rgba(255,230,0,.1);
  }
  .hl-ticker-badge {
    font-family: var(--fm); font-size: 8px; font-weight: 900;
    letter-spacing: 1.5px; color: var(--yel);
  }
  .hl-sort-btn {
    font-family: var(--fm); font-size: 7px; font-weight: 800;
    letter-spacing: .5px; padding: 2px 6px;
    background: rgba(255,255,255,.05); border: 1px solid rgba(255,230,0,.2);
    border-radius: 3px; color: rgba(255,230,0,.7); cursor: pointer;
    transition: all .12s;
  }
  .hl-sort-btn:hover { background: rgba(255,230,0,.12); color: var(--yel); }
  .hl-list { display: flex; flex-direction: column; }
  .hl-scrollable { overflow-y: auto; max-height: calc(100vh - 300px); }
  .hl-scrollable::-webkit-scrollbar { width: 2px; }
  .hl-scrollable::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
  .hl-row { display: flex; gap: 6px; padding: 7px 8px; border-bottom: 1px solid rgba(255,230,0,.08); cursor: pointer; align-items: flex-start; }
  .hl-row:hover { background: rgba(255,230,0,.03); }
  .hl-icon { font-size: 10px; flex-shrink: 0; width: 16px; padding-top: 1px; }
  .hl-main { flex: 1; min-width: 0; }
  .hl-txt { font-family: var(--fm); font-size: 10px; line-height: 1.45; color: rgba(255,255,255,.82); display: block; }
  .hl-txt.bull { color: var(--grn); }
  .hl-meta { display: flex; gap: 6px; align-items: center; margin-top: 2px; flex-wrap: wrap; }
  .hl-time { font-family: var(--fm); font-size: 8px; color: rgba(255,255,255,.42); }
  .hl-net {
    font-family: var(--fm); font-size: 7px; font-weight: 700; letter-spacing: .5px;
    color: rgba(139,92,246,.7); background: rgba(139,92,246,.1);
    padding: 0 4px; border-radius: 2px;
  }
  .hl-engage {
    font-family: var(--fm); font-size: 7px; font-weight: 700;
    color: rgba(255,140,59,.8);
  }
  .hl-creator {
    font-family: var(--fm); font-size: 7px;
    color: rgba(255,255,255,.3);
  }
  a.hl-linked { text-decoration: none; color: inherit; }
  .hl-linked:hover .hl-txt { text-decoration: underline; }
  .hl-ext { font-size: 10px; opacity: 0; transition: opacity .15s; flex-shrink: 0; color: rgba(255,230,0,.6); padding-top: 1px; }
  .hl-linked:hover .hl-ext { opacity: 1; }
  .hl-loading, .hl-end {
    font-family: var(--fm); font-size: 8px; color: rgba(255,255,255,.3);
    text-align: center; padding: 10px 0; letter-spacing: 1px;
  }

  /* ── Events ── */
  .ev-list { display: flex; flex-direction: column; gap: 5px; }
  .ev-card { border-left: 2px solid; padding: 6px 8px; background: rgba(255,255,255,.03); }
  .ev-head { display: flex; align-items: center; gap: 4px; margin-bottom: 2px; }
  .ev-tag { font-family: var(--fm); font-size: 9px; font-weight: 700; padding: 2px 5px; }
  .ev-etime { font-family: var(--fm); font-size: 9px; color: rgba(255,255,255,.58); }
  .ev-body { font-family: var(--fm); font-size: 10px; line-height: 1.45; color: rgba(255,255,255,.8); }
  .ev-src { font-family: var(--fm); font-size: 8px; color: rgba(255,255,255,.52); display: block; margin-top: 3px; }

  /* ── Flow ── */
  .flow-list { display: flex; flex-direction: column; gap: 4px; }
  .flow-empty { font-family: var(--fm); font-size: 9px; color: rgba(255,255,255,.4); text-align: center; padding: 16px 0; letter-spacing: .5px; }
  .flow-section-lbl { font-family: var(--fm); font-size: 10px; font-weight: 700; letter-spacing: 1.5px; color: var(--grn); padding: 4px 0 5px; border-bottom: 1px solid rgba(255,255,255,.1); }
  .flow-row { display: flex; align-items: center; gap: 6px; padding: 5px 7px; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.08); }
  .flow-dir { width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; flex-shrink: 0; }
  .flow-dir.sell { color: var(--red); } .flow-dir.buy { color: var(--grn); }
  .flow-info { flex: 1; min-width: 0; }
  .flow-lbl { font-family: var(--fm); font-size: 10px; color: rgba(255,255,255,.82); }
  .flow-addr { font-family: var(--fm); font-size: 9px; color: rgba(255,255,255,.58); }
  .flow-amt { font-family: var(--fm); font-size: 10px; font-weight: 700; flex-shrink: 0; }
  .flow-amt.sell { color: var(--red); } .flow-amt.buy { color: var(--grn); }

  /* ── Community ── */
  .community-body { gap: 0; }
  .comm-post { padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,.05); }
  .comm-head { display: flex; align-items: center; gap: 5px; margin-bottom: 3px; }
  .comm-avatar { width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; border: 1px solid rgba(255,255,255,.2); }
  .comm-name { font-family: var(--fm); font-size: 10px; font-weight: 700; color: #fff; }
  .comm-time { font-family: var(--fm); font-size: 8px; color: rgba(255,255,255,.56); margin-left: auto; }
  .comm-txt { font-family: var(--fm); font-size: 10px; line-height: 1.45; color: rgba(255,255,255,.82); }
  .comm-sig { display: inline-block; font-family: var(--fm); font-size: 9px; font-weight: 700; padding: 2px 7px; border: 1px solid; margin-top: 3px; }
  .comm-sig.long { color: var(--grn); border-color: rgba(0,255,136,.3); }
  .comm-sig.short { color: var(--red); border-color: rgba(255,45,85,.3); }
  .user-post { border-left: 2px solid var(--yel); }

  /* Community Reactions */
  .comm-actions {
    display: flex; align-items: center; gap: 4px; margin-top: 3px;
  }
  .comm-react {
    font-size: 11px; background: rgba(255,255,255,.08);
    border: 1px solid rgba(255,255,255,.14); border-radius: 4px;
    padding: 2px 6px; cursor: pointer; transition: all .12s;
  }
  .comm-react:hover { background: rgba(255,230,0,.1); border-color: rgba(255,230,0,.25); }

  /* ── Positions ── */
  .pos-header {
    display: flex; align-items: center; gap: 6px;
    padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,.06);
  }
  .pos-title {
    font-family: var(--fm); font-size: 10px; font-weight: 900;
    letter-spacing: 2px; color: var(--yel);
  }
  .pos-cnt {
    font-family: var(--fm); font-size: 8px; font-weight: 900;
    background: var(--yel); color: #000;
    padding: 1px 6px; border-radius: 8px;
  }
  .pos-row {
    display: flex; align-items: center; gap: 6px;
    padding: 8px 6px;
    background: rgba(255,255,255,.02);
    border: 1px solid rgba(255,255,255,.06);
  }
  .pos-dir {
    font-family: var(--fm); font-size: 12px; font-weight: 900;
    width: 20px; text-align: center;
  }
  .pos-dir.long { color: var(--grn); }
  .pos-dir.short { color: var(--red); }
  .pos-info { flex: 1; display: flex; flex-direction: column; gap: 1px; }
  .pos-pair { font-family: var(--fd); font-size: 11px; font-weight: 900; color: #fff; letter-spacing: .5px; }
  .pos-entry { font-family: var(--fm); font-size: 9px; color: rgba(255,255,255,.58); }
  .pos-pnl {
    font-family: var(--fd); font-size: 13px; font-weight: 900;
    letter-spacing: .5px; min-width: 50px; text-align: right;
  }
  .pos-close {
    font-family: var(--fm); font-size: 8px; font-weight: 900;
    letter-spacing: 1px; padding: 4px 8px;
    background: rgba(255,45,85,.1); color: var(--red);
    border: 1px solid rgba(255,45,85,.3); border-radius: 3px;
    cursor: pointer; transition: all .12s;
  }
  .pos-close:hover { background: rgba(255,45,85,.25); border-color: var(--red); }

  .pos-empty-mini {
    display: flex; align-items: center; gap: 6px;
    padding: 12px 8px;
    color: rgba(255,255,255,.56);
  }
  .pos-empty-icon { font-size: 14px; opacity: .5; }
  .pos-empty-txt {
    font-family: var(--fm); font-size: 10px; font-weight: 700;
    letter-spacing: 1.5px;
  }

  /* ── PREDICT in Positions tab (horizontal scroll, 1 card visible) ── */
  .pp-section {
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(139,92,246,.15);
    margin-bottom: 2px;
  }
  .pp-header {
    display: flex; align-items: center; gap: 6px;
    padding-bottom: 5px;
  }
  .pp-title {
    font-family: var(--fm); font-size: 10px; font-weight: 900;
    letter-spacing: 2px; color: #a78bfa;
  }
  .pp-cnt {
    font-family: var(--fm); font-size: 8px; font-weight: 900;
    background: rgba(139,92,246,.25); color: #c4b5fd;
    padding: 1px 5px; border-radius: 8px;
  }
  .pp-scroll {
    display: flex; gap: 6px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .pp-scroll::-webkit-scrollbar { display: none; }
  .pp-card {
    flex: 0 0 calc(100% - 4px);
    scroll-snap-align: start;
    min-width: 0;
    padding: 8px;
    background: rgba(139,92,246,.06);
    border: 1px solid rgba(139,92,246,.2);
    border-radius: 4px;
  }
  .pp-linked {
    display: block;
    text-decoration: none;
    color: inherit;
    cursor: pointer;
    transition: border-color .15s, background .15s;
  }
  .pp-linked:hover {
    border-color: rgba(139,92,246,.45);
    background: rgba(139,92,246,.12);
  }
  .pp-linked:hover .pp-q { text-decoration: underline; }
  .pp-ext {
    display: block;
    margin-top: 4px;
    font-family: var(--fm); font-size: 7px; font-weight: 700;
    letter-spacing: .5px;
    color: rgba(139,92,246,.5);
    text-align: right;
  }
  .pp-linked:hover .pp-ext { color: rgba(139,92,246,.85); }
  .pp-q {
    font-family: var(--fm); font-size: 10px; font-weight: 700;
    color: rgba(255,255,255,.84); line-height: 1.35;
    margin-bottom: 6px;
  }
  .pp-bar-wrap {
    height: 4px; background: rgba(255,45,85,.2);
    border-radius: 2px; overflow: hidden; margin-bottom: 4px;
  }
  .pp-bar-yes {
    height: 100%; background: #00e68a; border-radius: 2px;
    transition: width .3s;
  }
  .pp-odds {
    display: flex; justify-content: space-between;
    font-family: var(--fm); font-size: 9px; font-weight: 800;
  }
  .pp-yes { color: var(--grn); }
  .pp-no { color: var(--red); }
  .pp-hint {
    text-align: center; padding: 3px 0 0;
    font-family: var(--fm); font-size: 8px;
    color: rgba(255,255,255,.42); letter-spacing: 1.6px;
  }
  .pp-empty {
    font-family: var(--fm); font-size: 9px;
    color: rgba(255,255,255,.5); padding: 8px 0;
  }

  /* ═══ AGENT CHAT (inside INTEL tab) ═══ */
  .ac-section {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    min-height: 0;
    height: 100%;
    background: rgba(0,0,0,.3);
  }
  .ac-section.ac-embedded { border-top: 0; }
  .ac-header {
    display: flex; align-items: center; gap: 6px;
    padding: 5px 8px 3px;
    flex-shrink: 0;
  }
  .scan-brief {
    margin: 2px 8px 4px;
    padding: 6px 7px;
    border-radius: 6px;
    border: 1px solid rgba(255,230,0,.26);
    background: rgba(255,230,0,.08);
  }
  .scan-brief-head { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; }
  .scan-brief-badge {
    font-family: var(--fm); font-size: 8px; font-weight: 900; letter-spacing: 1.1px;
    color: #000; background: var(--yel); padding: 1px 5px; border-radius: 999px;
  }
  .scan-brief-market {
    font-family: var(--fm); font-size: 9px; font-weight: 800; letter-spacing: .5px; color: rgba(255,255,255,.92);
  }
  .scan-brief-time {
    margin-left: auto; font-family: var(--fm); font-size: 9px; color: rgba(255,255,255,.72);
  }
  .scan-brief-summary {
    font-family: var(--fm); font-size: 10px; line-height: 1.5; color: rgba(255,255,255,.9);
  }
  .scan-brief-tags {
    display: flex; align-items: center; flex-wrap: wrap; gap: 4px; margin-top: 4px;
  }
  .scan-brief-tag {
    font-family: var(--fm); font-size: 9px; font-weight: 800; letter-spacing: .4px;
    border-radius: 8px; border: 1px solid rgba(255,255,255,.16); padding: 1px 6px;
    color: rgba(255,255,255,.88); background: rgba(255,255,255,.05);
  }
  .scan-brief-tag.long { color: var(--grn); border-color: rgba(0,255,136,.36); background: rgba(0,255,136,.1); }
  .scan-brief-tag.short { color: var(--red); border-color: rgba(255,45,85,.36); background: rgba(255,45,85,.1); }
  .scan-brief-tag.neutral { color: rgba(255,255,255,.75); border-color: rgba(255,255,255,.22); }
  .scan-brief-notes {
    margin-top: 5px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .scan-brief-note {
    font-family: var(--fm);
    font-size: 9px;
    line-height: 1.35;
    color: rgba(255,255,255,.82);
    word-break: break-word;
  }
  .scan-brief-note :global(span) {
    color: rgba(255,230,0,.86);
    font-weight: 700;
    letter-spacing: .3px;
  }
  .ac-title {
    font-family: var(--fm); font-size: 10px; font-weight: 900;
    letter-spacing: 2px; color: var(--yel);
  }
  .ac-msgs {
    flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;
    padding: 4px 8px; min-height: 0;
  }
  .ac-msgs::-webkit-scrollbar { width: 2px; }
  .ac-msgs::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
  .ac-sys {
    font-family: var(--fm); font-size: 9px; color: rgba(255,255,255,.58);
    padding: 4px 6px; background: rgba(255,230,0,.04);
    border-left: 2px solid rgba(255,230,0,.2);
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
  .ac-bub-user { background: rgba(255,230,0,.12); border: 1px solid rgba(255,230,0,.2); margin-left: auto; }
  .ac-bub-agent { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); }
  .ac-name { font-family: var(--fm); font-size: 8px; font-weight: 800; letter-spacing: 1px; display: block; margin-bottom: 1px; }
  .ac-txt { font-family: var(--fm); font-size: 10px; color: rgba(255,255,255,.84); line-height: 1.45; white-space: pre-line; }
  .ac-dots { display: flex; gap: 3px; padding: 4px 0; }
  .ac-dots span { width: 4px; height: 4px; border-radius: 50%; background: rgba(255,255,255,.3); animation: dotBounce .6s infinite; }
  .ac-dots span:nth-child(2) { animation-delay: .15s; }
  .ac-dots span:nth-child(3) { animation-delay: .3s; }
  @keyframes dotBounce { 0%,100%{opacity:.3} 50%{opacity:1} }

  .ac-input {
    display: flex; gap: 4px; padding: 6px 8px 8px;
    border-top: 1px solid rgba(255,255,255,.06);
    flex-shrink: 0;
    background: rgba(5, 9, 7, .6);
    backdrop-filter: blur(4px);
  }
  .ac-input input {
    flex: 1; background: rgba(255,255,255,.04);
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 6px; padding: 8px 10px;
    font-family: var(--fm); font-size: 10px;
    color: #fff; outline: none;
  }
  .ac-input input::placeholder { color: rgba(255,255,255,.45); }
  .ac-input input:focus { border-color: rgba(255,230,0,.4); }
  .ac-send {
    width: 36px; background: var(--yel); color: #000;
    border: 1.5px solid #000; border-radius: 6px;
    font-size: 13px; cursor: pointer; display: flex;
    align-items: center; justify-content: center;
  }
  .ac-send:disabled { opacity: .3; cursor: not-allowed; }

  /* ── Trending Panel ── */
  .trend-panel { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
  .trend-sub-tabs {
    display: flex; gap: 2px; padding: 4px 6px; border-bottom: 1px solid rgba(255,255,255,.06);
  }
  .trend-sub {
    flex: 1; background: transparent; border: 1px solid rgba(255,255,255,.08); border-radius: 4px;
    color: rgba(255,255,255,.55); font-size: 9px; font-family: var(--fm); font-weight: 700;
    letter-spacing: .5px; padding: 4px 0; cursor: pointer; transition: all .15s;
  }
  .trend-sub:hover { background: rgba(255,255,255,.04); color: rgba(255,255,255,.8); }
  .trend-sub.active { background: rgba(255,230,0,.08); color: var(--yel); border-color: rgba(255,230,0,.25); }

  .trend-list { flex: 1; overflow-y: auto; padding: 4px 6px; }
  .trend-loading, .trend-empty {
    padding: 20px; text-align: center; color: rgba(255,255,255,.35); font-size: 10px; font-family: var(--fm);
  }

  .trend-row {
    display: flex; align-items: center; gap: 6px; padding: 5px 4px;
    border-bottom: 1px solid rgba(255,255,255,.03); transition: background .1s;
  }
  .trend-row:hover { background: rgba(255,255,255,.03); }
  .trend-rank {
    width: 22px; flex-shrink: 0; font-family: var(--fm); font-size: 9px; font-weight: 700;
    color: rgba(255,255,255,.3); text-align: right;
  }
  .trend-coin { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .trend-sym { font-family: var(--fm); font-size: 10px; font-weight: 800; color: #fff; letter-spacing: .3px; }
  .trend-name { font-size: 8px; color: rgba(255,255,255,.35); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .trend-data { display: flex; flex-direction: column; align-items: flex-end; flex-shrink: 0; }
  .trend-price { font-family: var(--fm); font-size: 10px; color: rgba(255,255,255,.8); }
  .trend-chg { font-family: var(--fm); font-size: 9px; font-weight: 700; }
  .trend-chg.up { color: #00e676; }
  .trend-chg.dn { color: #ff1744; }
  .trend-vol { font-family: var(--fm); font-size: 8px; color: rgba(255,255,255,.3); flex-shrink: 0; width: 48px; text-align: right; }
  .trend-social { display: flex; flex-direction: column; align-items: flex-end; flex-shrink: 0; gap: 1px; }
  .trend-soc, .trend-galaxy { font-size: 8px; color: rgba(255,255,255,.4); white-space: nowrap; }
  .trend-section-lbl {
    font-family: var(--fm); font-size: 9px; font-weight: 800; letter-spacing: 1px;
    padding: 6px 2px 3px; color: rgba(255,255,255,.45);
  }
  .trend-section-lbl.up { color: #00e676; }
  .trend-section-lbl.dn { color: #ff1744; }
  .trend-row.gainer { border-left: 2px solid rgba(0,230,118,.2); }
  .trend-row.loser { border-left: 2px solid rgba(255,23,68,.2); }

  /* DEX trending */
  .dex-row { text-decoration: none; color: inherit; }
  .dex-row:hover { background: rgba(255,230,0,.04); }
  .dex-icon { border-radius: 50%; flex-shrink: 0; }
  .dex-addr { font-family: var(--fm); font-size: 8px; }
  .dex-desc { font-size: 8px; color: rgba(255,255,255,.3); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dex-link { color: rgba(255,230,0,.5); font-size: 10px; flex-shrink: 0; }

  /* ── TOP PICKS (Opportunity Scanner) ── */
  .picks-panel { flex: 1; overflow-y: auto; padding: 6px; display: flex; flex-direction: column; gap: 6px; }
  .picks-panel::-webkit-scrollbar { width: 2px; }
  .picks-panel::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }

  .picks-macro {
    display: flex; align-items: center; gap: 6px;
    padding: 5px 8px; border-radius: 4px;
    font-family: var(--fm); font-size: 9px; font-weight: 700; letter-spacing: .5px;
    color: rgba(255,255,255,.7);
    background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08);
  }
  .picks-macro.risk-on { background: rgba(0,230,118,.08); border-color: rgba(0,230,118,.2); color: #00e676; }
  .picks-macro.risk-off { background: rgba(255,23,68,.08); border-color: rgba(255,23,68,.2); color: #ff1744; }
  .picks-time { font-size: 8px; opacity: .5; margin-left: 4px; font-weight: 400; }

  .picks-alerts { display: flex; flex-direction: column; gap: 3px; }
  .pa-row {
    display: flex; align-items: center; gap: 4px;
    padding: 3px 6px; border-radius: 3px;
    font-family: var(--fm); font-size: 8px; font-weight: 600;
    background: rgba(255,140,59,.06); border-left: 2px solid rgba(255,140,59,.4);
    color: rgba(255,140,59,.85);
  }
  .pa-row.critical { background: rgba(255,23,68,.08); border-left-color: #ff1744; color: #ff5252; }
  .pa-row.warning { background: rgba(255,193,7,.06); border-left-color: rgba(255,193,7,.5); color: rgba(255,193,7,.85); }
  .pa-msg { line-height: 1.35; }

  .picks-section-lbl {
    font-family: var(--fm); font-size: 9px; font-weight: 800; letter-spacing: 1.2px;
    color: rgba(255,230,0,.65); padding: 2px 0;
  }

  .pick-card {
    padding: 7px 8px; border-radius: 5px;
    background: rgba(255,255,255,.025); border: 1px solid rgba(255,255,255,.06);
    transition: background .12s, border-color .12s;
  }
  .pick-card:hover { background: rgba(255,230,0,.04); border-color: rgba(255,230,0,.15); }

  .pick-head {
    display: flex; align-items: center; gap: 6px; margin-bottom: 3px;
  }
  .pick-rank { font-family: var(--fd); font-size: 12px; font-weight: 900; min-width: 22px; }
  .pick-sym { font-family: var(--fm); font-size: 11px; font-weight: 900; color: #fff; letter-spacing: .5px; }
  .pick-dir { font-family: var(--fm); font-size: 9px; font-weight: 800; letter-spacing: .5px; margin-left: auto; }
  .pick-score { font-family: var(--fd); font-size: 12px; font-weight: 900; letter-spacing: .3px; }

  .pick-price {
    font-family: var(--fm); font-size: 9px; color: rgba(255,255,255,.55);
    display: flex; align-items: center; gap: 6px; margin-bottom: 4px;
  }

  .pick-bar {
    display: flex; gap: 1px; height: 6px; border-radius: 3px; overflow: hidden;
    background: rgba(255,255,255,.04); margin-bottom: 4px;
  }
  .pb-seg { height: 100%; min-width: 1px; border-radius: 1px; }
  .pb-seg.mom { background: #ff9800; }
  .pb-seg.vol { background: #2196f3; }
  .pb-seg.soc { background: #e040fb; }
  .pb-seg.mac { background: #00e676; }
  .pb-seg.onc { background: #ffd600; }

  .pick-reasons { display: flex; flex-wrap: wrap; gap: 3px; margin-bottom: 2px; }
  .pr-tag {
    font-family: var(--fm); font-size: 7px; font-weight: 600; letter-spacing: .3px;
    padding: 1px 5px; border-radius: 3px;
    background: rgba(255,255,255,.05); color: rgba(255,255,255,.55);
    border: 1px solid rgba(255,255,255,.06);
  }

  .pick-alerts { display: flex; flex-wrap: wrap; gap: 3px; }
  .pa-mini {
    font-family: var(--fm); font-size: 7px; font-weight: 700;
    padding: 1px 4px; border-radius: 2px;
    background: rgba(255,140,59,.08); color: rgba(255,140,59,.75);
    border: 1px solid rgba(255,140,59,.15);
  }

  .picks-rescan {
    width: 100%; padding: 6px; margin-top: 2px;
    font-family: var(--fm); font-size: 9px; font-weight: 700; letter-spacing: .8px;
    background: rgba(255,230,0,.06); border: 1px solid rgba(255,230,0,.15);
    border-radius: 4px; color: rgba(255,230,0,.7); cursor: pointer;
    transition: all .15s;
  }
  .picks-rescan:hover { background: rgba(255,230,0,.12); color: var(--yel); border-color: rgba(255,230,0,.3); }
</style>
