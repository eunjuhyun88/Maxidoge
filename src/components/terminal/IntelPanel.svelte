<script lang="ts">
  import { HEADLINES, EVENTS, COMMUNITY } from '$lib/data/warroom';
  import type { Headline, EventData } from '$lib/data/warroom';
  import { communityPosts, hydrateCommunityPosts, likeCommunityPost } from '$lib/stores/communityStore';
  import { openTrades, closeQuickTrade } from '$lib/stores/quickTradeStore';
  import { gameState } from '$lib/stores/gameState';
  import { predictMarkets, loadPolymarkets } from '$lib/stores/predictStore';
  import { fetchUiStateApi, updateUiStateApi } from '$lib/api/preferencesApi';
  import { parseOutcomePrices } from '$lib/api/polymarket';
  import { createEventDispatcher, onMount } from 'svelte';

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
  let liveHeadlines: Headline[] = [];
  let liveEvents: Array<{ id: string; tag: string; level: string; text: string; source: string; createdAt: number }> = [];
  let liveFlows: Array<{ id: string; label: string; addr: string; amt: string; isBuy: boolean }> = [];
  let dataLoaded = { headlines: false, events: false, flow: false };

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

  function sendChat() {
    if (!chatInput.trim()) return;
    dispatch('sendchat', { text: chatInput });
    chatInput = '';
  }
  function chatKey(e: KeyboardEvent) { if (e.key === 'Enter') sendChat(); }

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
  $: headlineSource = dataLoaded.headlines ? liveHeadlines : HEADLINES;
  $: filteredHeadlines = headlineSource.filter(hl =>
    tokenAliases.some(alias => hl.text.toLowerCase().includes(alias)) ||
    hl.text.toLowerCase().includes('crypto') ||
    hl.text.toLowerCase().includes('exchange') ||
    hl.text.toLowerCase().includes('market')
  );
  // Show all if no matches
  $: displayHeadlines = filteredHeadlines.length >= 2 ? filteredHeadlines : headlineSource;

  async function fetchLiveHeadlines() {
    try {
      const res = await fetch('/api/market/news?limit=10');
      const json = await res.json();
      if (json.ok && json.data?.records?.length > 0) {
        liveHeadlines = json.data.records.map((r: any) => ({
          icon: r.sentiment === 'bullish' ? '📈' : r.sentiment === 'bearish' ? '📉' : '📊',
          time: formatRelativeTime(r.publishedAt),
          text: r.title || r.summary,
          bull: r.sentiment === 'bullish',
          link: r.link || '',
        }));
        dataLoaded.headlines = true;
        dataLoaded = dataLoaded;
      }
    } catch (e) {
      console.warn('[IntelPanel] Headlines API unavailable, using fallback');
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
      if (ui?.terminalActiveTab && ['intel', 'community', 'positions'].includes(ui.terminalActiveTab)) {
        activeTab = ui.terminalActiveTab;
      }
      if (ui?.terminalInnerTab && ['chat', 'headlines', 'events', 'flow'].includes(ui.terminalInnerTab)) {
        innerTab = ui.terminalInnerTab;
      }
      if (prioritizeChat) {
        activeTab = 'intel';
        innerTab = 'chat';
        tabCollapsed = false;
      }
    })();

    // ── Load live market data ──
    fetchLiveHeadlines();
    fetchLiveEvents();
    fetchLiveFlow();
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
          {#each ['chat', 'headlines', 'events', 'flow'] as tab}
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
                <input type="text" bind:value={chatInput} on:keydown={chatKey} placeholder="@STRUCTURE @FLOW @DERIV ..." />
                <button class="ac-send" on:click={sendChat} disabled={!chatInput.trim()}>⚡</button>
              </div>
            </div>

          {:else if innerTab === 'headlines'}
            <div class="hl-ticker-badge">{currentToken} NEWS</div>
            <div class="hl-list">
              {#each displayHeadlines as hl}
                {#if hl.link}
                  <a class="hl-row hl-linked" href={hl.link} target="_blank" rel="noopener noreferrer">
                    <span class="hl-icon">{hl.icon}</span>
                    <span class="hl-time">{hl.time}</span>
                    <span class="hl-txt" class:bull={hl.bull}>{hl.text}</span>
                    <span class="hl-ext">&#8599;</span>
                  </a>
                {:else}
                  <div class="hl-row">
                    <span class="hl-icon">{hl.icon}</span>
                    <span class="hl-time">{hl.time}</span>
                    <span class="hl-txt" class:bull={hl.bull}>{hl.text}</span>
                  </div>
                {/if}
              {/each}
            </div>

          {:else if innerTab === 'events'}
            <div class="ev-list">
              {#each dataLoaded.events ? liveEvents : EVENTS as ev}
                <div class="ev-card" style="border-left-color:{dataLoaded.events ? (ev.level === 'warning' ? '#ff8c3b' : '#3b9eff') : ev.borderColor}">
                  <div class="ev-head">
                    <span class="ev-tag" style="background:{dataLoaded.events ? (ev.tag === 'DERIV' ? '#ff8c3b' : ev.tag === 'ON-CHAIN' ? '#00e68a' : ev.tag === 'SOCIAL' ? '#8b5cf6' : '#3b9eff') : ev.tagColor};color:#000">{ev.tag}</span>
                    <span class="ev-etime">{dataLoaded.events ? formatRelativeTime(ev.createdAt) : ev.time}</span>
                  </div>
                  <div class="ev-body">{ev.text}</div>
                  <span class="ev-src">{dataLoaded.events ? ev.source : ev.src}</span>
                </div>
              {/each}
            </div>

          {:else if innerTab === 'flow'}
            <div class="flow-list">
              <div class="flow-section-lbl">SMART MONEY FLOWS (24H)</div>
              {#each dataLoaded.flow ? liveFlows : [{id:'f1',label:'↗ Binance → Cold',addr:'0x1a...4f2',amt:'+2,140 BTC',isBuy:true},{id:'f2',label:'↙ OKX ← Whale',addr:'0x8c...3a1',amt:'-850 BTC',isBuy:false},{id:'f3',label:'↗ Coinbase → DeFi',addr:'0x3e...9d5',amt:'+12,500 ETH',isBuy:true}] as flow (flow.id)}
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

          <!-- Static community posts -->
          {#each COMMUNITY as post}
            <div class="comm-post">
              <div class="comm-head">
                <div class="comm-avatar" style="background:{post.avatarColor}20;color:{post.avatarColor}">{post.avatar}</div>
                <span class="comm-name">{post.name}</span>
                <span class="comm-time">{post.time}</span>
              </div>
              <div class="comm-txt">{post.text}</div>
              <div class="comm-actions">
                {#if post.signal}
                  <span class="comm-sig {post.signal}">{post.signal.toUpperCase()}</span>
                {/if}
                <button class="comm-react">👍</button>
                <button class="comm-react">🔥</button>
              </div>
            </div>
          {/each}
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
  .hl-ticker-badge {
    padding: 4px 8px; font-family: var(--fm); font-size: 8px; font-weight: 900;
    letter-spacing: 1.5px; color: var(--yel); background: rgba(255,230,0,.06);
    border-bottom: 1px solid rgba(255,230,0,.1);
  }
  .hl-list { display: flex; flex-direction: column; }
  .hl-row { display: flex; gap: 6px; padding: 7px 8px; border-bottom: 1px solid rgba(255,230,0,.08); cursor: pointer; }
  .hl-row:hover { background: rgba(255,230,0,.03); }
  .hl-icon { font-size: 10px; flex-shrink: 0; width: 16px; }
  .hl-time { font-family: var(--fm); font-size: 9px; color: rgba(255,255,255,.58); width: 34px; flex-shrink: 0; }
  .hl-txt { font-family: var(--fm); font-size: 10px; line-height: 1.45; color: rgba(255,255,255,.82); }
  .hl-txt.bull { color: var(--grn); }
  a.hl-linked { text-decoration: none; color: inherit; }
  .hl-linked:hover .hl-txt { text-decoration: underline; }
  .hl-ext { font-size: 10px; opacity: 0; transition: opacity .15s; flex-shrink: 0; color: rgba(255,230,0,.6); }
  .hl-linked:hover .hl-ext { opacity: 1; }

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
  .scan-brief-note span {
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
</style>
