<script lang="ts">
  import { HEADLINES, EVENTS, COMMUNITY } from '$lib/data/warroom';
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

  let activeTab = 'intel';
  let innerTab = 'headlines';
  let tabCollapsed = false;
  let _uiStateSaveTimer: ReturnType<typeof setTimeout> | null = null;


  // Chat input (local)
  let chatInput = '';
  let chatEl: HTMLDivElement;

  function setTab(tab: string) {
    if (activeTab === tab) {
      tabCollapsed = !tabCollapsed;
    } else {
      activeTab = tab;
      tabCollapsed = false;
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

  // ═══ Filter headlines by current chart ticker ═══
  $: currentToken = $gameState.pair.split('/')[0] || 'BTC';
  $: tokenAliases = getTokenAliases(currentToken);
  $: filteredHeadlines = HEADLINES.filter(hl =>
    tokenAliases.some(alias => hl.text.toLowerCase().includes(alias)) ||
    hl.text.toLowerCase().includes('crypto') ||
    hl.text.toLowerCase().includes('exchange') ||
    hl.text.toLowerCase().includes('market')
  );
  // Show all if no matches
  $: displayHeadlines = filteredHeadlines.length >= 2 ? filteredHeadlines : HEADLINES;

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
      if (ui?.terminalInnerTab && ['headlines', 'events', 'flow'].includes(ui.terminalInnerTab)) {
        innerTab = ui.terminalInnerTab;
      }
    })();
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
          {#each ['headlines', 'events', 'flow'] as tab}
            <button class="rp-inner-tab" class:active={innerTab === tab} on:click={() => setInnerTab(tab)}>
              {tab.toUpperCase()}
            </button>
          {/each}
        </div>

        <div class="rp-body">
          {#if innerTab === 'headlines'}
            <div class="hl-ticker-badge">{currentToken} NEWS</div>
            <div class="hl-list">
              {#each displayHeadlines as hl}
                <div class="hl-row">
                  <span class="hl-icon">{hl.icon}</span>
                  <span class="hl-time">{hl.time}</span>
                  <span class="hl-txt" class:bull={hl.bull}>{hl.text}</span>
                </div>
              {/each}
            </div>

          {:else if innerTab === 'events'}
            <div class="ev-list">
              {#each EVENTS as ev}
                <div class="ev-card" style="border-left-color:{ev.borderColor}">
                  <div class="ev-head">
                    <span class="ev-tag" style="background:{ev.tagColor};color:#000">{ev.tag}</span>
                    <span class="ev-etime">{ev.time}</span>
                  </div>
                  <div class="ev-body">{ev.text}</div>
                  <span class="ev-src">{ev.src}</span>
                </div>
              {/each}
            </div>

          {:else if innerTab === 'flow'}
            <div class="flow-list">
              <div class="flow-section-lbl">SMART MONEY FLOWS (24H)</div>
              {#each [['↗ Binance → Cold', '0x1a...4f2', '+2,140 BTC', true], ['↙ OKX ← Whale', '0x8c...3a1', '-850 BTC', false], ['↗ Coinbase → DeFi', '0x3e...9d5', '+12,500 ETH', true]] as [label, addr, amt, isBuy]}
                <div class="flow-row">
                  <div class="flow-dir" class:buy={isBuy} class:sell={!isBuy}>{isBuy ? '↑' : '↓'}</div>
                  <div class="flow-info">
                    <div class="flow-lbl">{label}</div>
                    <div class="flow-addr">{addr}</div>
                  </div>
                  <div class="flow-amt" class:buy={isBuy} class:sell={!isBuy}>{amt}</div>
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
                  <div class="pp-card">
                    <div class="pp-q">{market.question.length > 70 ? market.question.slice(0, 70) + '…' : market.question}</div>
                    <div class="pp-bar-wrap">
                      <div class="pp-bar-yes" style="width:{outcome.yes}%"></div>
                    </div>
                    <div class="pp-odds">
                      <span class="pp-yes">YES {outcome.yes}¢</span>
                      <span class="pp-no">NO {outcome.no}¢</span>
                    </div>
                  </div>
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

  <!-- ═══ AGENT CHAT — always visible outside tabs ═══ -->
  <div class="ac-section">
    <div class="ac-header">
      <span class="ac-title">🤖 AGENT CHAT</span>
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
      <input type="text" bind:value={chatInput} on:keydown={chatKey} placeholder="@STRUCTURE @FLOW @DERIV ..." />
      <button class="ac-send" on:click={sendChat} disabled={!chatInput.trim()}>⚡</button>
    </div>
  </div>
</div>

<style>
  .intel-panel { display: flex; flex-direction: column; height: 100%; background: var(--blk); overflow: hidden; }

  /* ── Tabs ── */
  .rp-tabs { display: flex; border-bottom: 3px solid var(--yel); flex-shrink: 0; }
  .rp-tab {
    flex: 1; padding: 7px 2px;
    font-family: var(--fm); font-size: 9px; font-weight: 700; letter-spacing: 2px; text-align: center;
    background: none; border: none; cursor: pointer; transition: all .15s;
  }
  .rp-tab.active { background: var(--yel); color: var(--blk); }
  .rp-tab:not(.active) { color: rgba(255,255,255,.4); }
  .rp-tab:not(.active):hover { color: var(--yel); }
  .rp-collapse {
    width: 28px; flex-shrink: 0;
    background: rgba(255,230,0,.08); border: none; border-left: 1px solid rgba(255,230,0,.15);
    color: var(--yel); font-size: 9px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background .12s;
  }
  .rp-collapse:hover { background: rgba(255,230,0,.2); }
  .rp-panel-collapse {
    width: 24px; flex-shrink: 0;
    background: rgba(255,255,255,.03); border: none; border-left: 1px solid rgba(255,230,0,.1);
    color: rgba(255,230,0,.5); cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: all .12s; padding: 0;
  }
  .rp-panel-collapse:hover { background: rgba(255,230,0,.15); color: var(--yel); }

  .rp-inner-tabs { display: flex; border-bottom: 2px solid rgba(255,230,0,.15); flex-shrink: 0; }
  .rp-inner-tab {
    flex: 1; padding: 5px 2px;
    font-family: var(--fm); font-size: 8px; font-weight: 700; letter-spacing: 1px; text-align: center;
    background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer;
    color: rgba(255,255,255,.35); transition: all .15s;
  }
  .rp-inner-tab.active { color: var(--yel); border-bottom-color: var(--pk); }

  /* ── Tab Content Wrapper ── */
  .rp-body-wrap { flex: 1; overflow: hidden; display: flex; flex-direction: column; min-height: 80px; }
  .rp-body { flex: 1; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 6px; }

  /* ── Headlines ── */
  .hl-ticker-badge {
    padding: 3px 8px; font-family: var(--fm); font-size: 7px; font-weight: 900;
    letter-spacing: 1.5px; color: var(--yel); background: rgba(255,230,0,.06);
    border-bottom: 1px solid rgba(255,230,0,.1);
  }
  .hl-list { display: flex; flex-direction: column; }
  .hl-row { display: flex; gap: 5px; padding: 6px 8px; border-bottom: 1px solid rgba(255,230,0,.06); cursor: pointer; }
  .hl-row:hover { background: rgba(255,230,0,.03); }
  .hl-icon { font-size: 9px; flex-shrink: 0; width: 14px; }
  .hl-time { font-family: var(--fm); font-size: 8px; color: rgba(255,255,255,.35); width: 30px; flex-shrink: 0; }
  .hl-txt { font-family: var(--fm); font-size: 9px; line-height: 1.4; color: rgba(255,255,255,.65); }
  .hl-txt.bull { color: var(--grn); }

  /* ── Events ── */
  .ev-list { display: flex; flex-direction: column; gap: 5px; }
  .ev-card { border-left: 2px solid; padding: 5px 7px; background: rgba(255,255,255,.02); }
  .ev-head { display: flex; align-items: center; gap: 4px; margin-bottom: 2px; }
  .ev-tag { font-family: var(--fm); font-size: 8px; font-weight: 700; padding: 2px 5px; }
  .ev-etime { font-family: var(--fm); font-size: 8px; color: rgba(255,255,255,.35); }
  .ev-body { font-family: var(--fm); font-size: 9px; line-height: 1.4; color: rgba(255,255,255,.6); }
  .ev-src { font-family: var(--fm); font-size: 7px; color: rgba(255,255,255,.25); display: block; margin-top: 2px; }

  /* ── Flow ── */
  .flow-list { display: flex; flex-direction: column; gap: 4px; }
  .flow-section-lbl { font-family: var(--fm); font-size: 9px; font-weight: 700; letter-spacing: 1.5px; color: var(--grn); padding: 4px 0 5px; border-bottom: 1px solid rgba(255,255,255,.06); }
  .flow-row { display: flex; align-items: center; gap: 6px; padding: 4px 6px; background: rgba(255,255,255,.02); border: 1px solid rgba(255,255,255,.04); }
  .flow-dir { width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; flex-shrink: 0; }
  .flow-dir.sell { color: var(--red); } .flow-dir.buy { color: var(--grn); }
  .flow-info { flex: 1; min-width: 0; }
  .flow-lbl { font-family: var(--fm); font-size: 9px; color: rgba(255,255,255,.6); }
  .flow-addr { font-family: var(--fm); font-size: 8px; color: rgba(255,255,255,.3); }
  .flow-amt { font-family: var(--fm); font-size: 10px; font-weight: 700; flex-shrink: 0; }
  .flow-amt.sell { color: var(--red); } .flow-amt.buy { color: var(--grn); }

  /* ── Community ── */
  .community-body { gap: 0; }
  .comm-post { padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,.05); }
  .comm-head { display: flex; align-items: center; gap: 5px; margin-bottom: 3px; }
  .comm-avatar { width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: 700; border: 1px solid rgba(255,255,255,.1); }
  .comm-name { font-family: var(--fm); font-size: 9px; font-weight: 700; color: #fff; }
  .comm-time { font-family: var(--fm); font-size: 7px; color: rgba(255,255,255,.3); margin-left: auto; }
  .comm-txt { font-family: var(--fm); font-size: 9px; line-height: 1.45; color: rgba(255,255,255,.65); }
  .comm-sig { display: inline-block; font-family: var(--fm); font-size: 8px; font-weight: 700; padding: 2px 7px; border: 1px solid; margin-top: 3px; }
  .comm-sig.long { color: var(--grn); border-color: rgba(0,255,136,.3); }
  .comm-sig.short { color: var(--red); border-color: rgba(255,45,85,.3); }
  .user-post { border-left: 2px solid var(--yel); }

  /* Community Reactions */
  .comm-actions {
    display: flex; align-items: center; gap: 4px; margin-top: 3px;
  }
  .comm-react {
    font-size: 10px; background: rgba(255,255,255,.04);
    border: 1px solid rgba(255,255,255,.08); border-radius: 4px;
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
  .pos-entry { font-family: var(--fm); font-size: 8px; color: rgba(255,255,255,.35); }
  .pos-pnl {
    font-family: var(--fd); font-size: 13px; font-weight: 900;
    letter-spacing: .5px; min-width: 50px; text-align: right;
  }
  .pos-close {
    font-family: var(--fm); font-size: 7px; font-weight: 900;
    letter-spacing: 1px; padding: 4px 8px;
    background: rgba(255,45,85,.1); color: var(--red);
    border: 1px solid rgba(255,45,85,.3); border-radius: 3px;
    cursor: pointer; transition: all .12s;
  }
  .pos-close:hover { background: rgba(255,45,85,.25); border-color: var(--red); }

  .pos-empty-mini {
    display: flex; align-items: center; gap: 6px;
    padding: 12px 8px;
    color: rgba(255,255,255,.3);
  }
  .pos-empty-icon { font-size: 14px; opacity: .5; }
  .pos-empty-txt {
    font-family: var(--fm); font-size: 9px; font-weight: 700;
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
    font-family: var(--fm); font-size: 9px; font-weight: 900;
    letter-spacing: 2px; color: #a78bfa;
  }
  .pp-cnt {
    font-family: var(--fm); font-size: 7px; font-weight: 900;
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
  .pp-q {
    font-family: var(--fm); font-size: 9px; font-weight: 700;
    color: rgba(255,255,255,.7); line-height: 1.3;
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
    font-family: var(--fm); font-size: 8px; font-weight: 800;
  }
  .pp-yes { color: var(--grn); }
  .pp-no { color: var(--red); }
  .pp-hint {
    text-align: center; padding: 3px 0 0;
    font-family: var(--fm); font-size: 7px;
    color: rgba(255,255,255,.2); letter-spacing: 2px;
  }
  .pp-empty {
    font-family: var(--fm); font-size: 8px;
    color: rgba(255,255,255,.25); padding: 8px 0;
  }

  /* ═══ AGENT CHAT — always visible outside tabs ═══ */
  .ac-section {
    flex: 1;
    border-top: 2px solid rgba(255,230,0,.25);
    display: flex; flex-direction: column;
    min-height: 160px;
    background: rgba(0,0,0,.3);
  }
  .ac-header {
    display: flex; align-items: center; gap: 6px;
    padding: 5px 8px 3px;
    flex-shrink: 0;
  }
  .ac-title {
    font-family: var(--fm); font-size: 9px; font-weight: 900;
    letter-spacing: 2px; color: var(--yel);
  }
  .ac-msgs {
    flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;
    padding: 4px 8px; min-height: 40px;
  }
  .ac-msgs::-webkit-scrollbar { width: 2px; }
  .ac-msgs::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
  .ac-sys {
    font-family: var(--fm); font-size: 8px; color: rgba(255,255,255,.3);
    padding: 4px 6px; background: rgba(255,230,0,.04);
    border-left: 2px solid rgba(255,230,0,.2);
  }
  .ac-row { display: flex; gap: 5px; }
  .ac-right { justify-content: flex-end; }
  .ac-left { justify-content: flex-start; }
  .ac-av {
    width: 18px; height: 18px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 9px; border: 1.5px solid; flex-shrink: 0;
    background: rgba(255,255,255,.03);
  }
  .ac-bub { max-width: 85%; padding: 5px 8px; border-radius: 6px; }
  .ac-bub-user { background: rgba(255,230,0,.12); border: 1px solid rgba(255,230,0,.2); margin-left: auto; }
  .ac-bub-agent { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); }
  .ac-name { font-family: var(--fm); font-size: 7px; font-weight: 800; letter-spacing: 1px; display: block; margin-bottom: 1px; }
  .ac-txt { font-family: var(--fm); font-size: 9px; color: rgba(255,255,255,.7); line-height: 1.4; }
  .ac-dots { display: flex; gap: 3px; padding: 4px 0; }
  .ac-dots span { width: 4px; height: 4px; border-radius: 50%; background: rgba(255,255,255,.3); animation: dotBounce .6s infinite; }
  .ac-dots span:nth-child(2) { animation-delay: .15s; }
  .ac-dots span:nth-child(3) { animation-delay: .3s; }
  @keyframes dotBounce { 0%,100%{opacity:.3} 50%{opacity:1} }

  .ac-input {
    display: flex; gap: 4px; padding: 4px 8px 6px;
    border-top: 1px solid rgba(255,255,255,.06);
    flex-shrink: 0;
  }
  .ac-input input {
    flex: 1; background: rgba(255,255,255,.04);
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 4px; padding: 6px 8px;
    font-family: var(--fm); font-size: 9px;
    color: #fff; outline: none;
  }
  .ac-input input::placeholder { color: #555; }
  .ac-input input:focus { border-color: rgba(255,230,0,.4); }
  .ac-send {
    width: 32px; background: var(--yel); color: #000;
    border: 1.5px solid #000; border-radius: 4px;
    font-size: 12px; cursor: pointer; display: flex;
    align-items: center; justify-content: center;
  }
  .ac-send:disabled { opacity: .3; cursor: not-allowed; }
</style>
