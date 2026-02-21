<script lang="ts">
  import { goto } from '$app/navigation';
  import { gameState } from '$lib/stores/gameState';
  import { AGDEFS, CHARACTER_ART } from '$lib/data/agents';
  import { walletStore, isWalletConnected, openWalletModal } from '$lib/stores/walletStore';
  import { userProfileStore } from '$lib/stores/userProfileStore';
  import { openTradeCount } from '$lib/stores/quickTradeStore';
  import { activeSignalCount } from '$lib/stores/trackedSignalStore';

  $: state = $gameState;
  $: connected = $isWalletConnected;
  $: wallet = $walletStore;
  $: profile = $userProfileStore;
  $: openPositions = $openTradeCount;
  $: trackedSigs = $activeSignalCount;

  $: btcPrice = state.prices.BTC;
  $: ethPrice = state.prices.ETH;
  $: solPrice = state.prices.SOL;

  function enterArena() { goto('/arena'); }
  function enterTerminal() { goto('/terminal'); }
</script>

<div class="home">
  <!-- ═══ BLOCK PARTY HERO ═══ -->
  <section class="hero">
    <!-- Scattered pop-art deco elements -->
    <div class="deco-layer">
      <img class="d d-burst-tl" src="/blockparty/deco-bursts.png" alt="" />
      <img class="d d-burst-tr" src="/blockparty/deco-bursts.png" alt="" />
      <img class="d d-cloud-l" src="/blockparty/deco-clouds.png" alt="" />
      <img class="d d-cloud-r" src="/blockparty/deco-clouds-halftone.png" alt="" />
      <img class="d d-star" src="/blockparty/deco-stars.png" alt="" />
      <img class="d d-sparkle" src="/blockparty/deco-sparkles.png" alt="" />
      <img class="d d-ball" src="/blockparty/deco-pow-doge.png" alt="" />
      <img class="d d-glasses" src="/blockparty/deco-ball-glasses.png" alt="" />
      <img class="d d-cam" src="/blockparty/deco-coin-camera.png" alt="" />
      <img class="d d-halftone" src="/blockparty/deco-coin-doge-big.png" alt="" />
      <img class="d d-pow" src="/blockparty/deco-halftone-blob.png" alt="" />
      <img class="d d-coins" src="/blockparty/deco-top-doges.png" alt="" />
      <img class="d d-doge-fly" src="/blockparty/deco-doge-cloud.png" alt="" />
      <img class="d d-heart" src="/blockparty/deco-heart-doge.png" alt="" />
    </div>

    <!-- Center content -->
    <div class="hero-content">
      <div class="hero-badge">AI AGENT TRADING PLATFORM</div>
      <h1 class="hero-title">
        <span class="title-maxi">MAXI</span><span class="title-bolt">⚡</span><span class="title-doge">DOGE</span>
      </h1>
      <p class="hero-sub">AI 에이전트 팀과 함께하는 전략 트레이딩 배틀</p>

      <!-- Live price ticker -->
      <div class="hero-ticker">
        <div class="tick-item">
          <span class="tick-coin">₿</span>
          <span class="tick-label">BTC</span>
          <span class="tick-price">${btcPrice.toLocaleString()}</span>
        </div>
        <div class="tick-sep">|</div>
        <div class="tick-item">
          <span class="tick-coin eth-coin">Ξ</span>
          <span class="tick-label">ETH</span>
          <span class="tick-price">${ethPrice.toLocaleString()}</span>
        </div>
        <div class="tick-sep">|</div>
        <div class="tick-item">
          <span class="tick-coin sol-coin">◎</span>
          <span class="tick-label">SOL</span>
          <span class="tick-price">${solPrice.toLocaleString()}</span>
        </div>
      </div>
    </div>
  </section>

  <!-- ═══ STATS STRIP (separate from hero) ═══ -->
  {#if profile.stats.totalMatches > 0}
    <section class="stats-strip">
      <div class="ss-item">
        <span class="ss-v">{profile.stats.totalMatches}</span>
        <span class="ss-l">MATCHES</span>
      </div>
      <div class="ss-sep"></div>
      <div class="ss-item">
        <span class="ss-v" style="color:var(--grn)">{profile.stats.winRate}%</span>
        <span class="ss-l">WIN RATE</span>
      </div>
      <div class="ss-sep"></div>
      <div class="ss-item">
        <span class="ss-v" style="color:{profile.stats.totalPnL >= 0 ? 'var(--grn)' : 'var(--red)'}">
          {profile.stats.totalPnL >= 0 ? '+' : ''}{profile.stats.totalPnL.toFixed(1)}%
        </span>
        <span class="ss-l">TOTAL PNL</span>
      </div>
      <div class="ss-sep"></div>
      <div class="ss-item">
        <span class="ss-v ss-streak">🔥 {profile.stats.streak}</span>
        <span class="ss-l">STREAK</span>
      </div>
    </section>
  {/if}

  <!-- ═══ FLOW: HOW IT WORKS ═══ -->
  <section class="flow-section">
    <h3 class="flow-title">HOW IT WORKS</h3>
    <div class="flow-steps">
      <!-- STEP 1: WAR ROOM -->
      <button class="flow-card fc-1" on:click={enterTerminal}>
        <div class="fc-step">STEP 1</div>
        <div class="fc-icon-row">
          <img src="/doge/trade-actions.png" alt="" class="fc-img" />
          <div class="fc-live-dot"></div>
        </div>
        <h2 class="fc-name fc-n1">WAR ROOM</h2>
        <p class="fc-desc">7 AI 에이전트가 실시간으로 시장을 분석</p>
        <div class="fc-detail">
          <span>📈 차트 · 온체인 · 파생상품</span>
          <span>🧠 감성 · 리스크 · 컨센서스</span>
        </div>
        <div class="fc-agents">
          {#each AGDEFS.slice(0, 5) as ag}
            <div class="fc-ag" style="border-color:{ag.color}">
              <img src={ag.img.def} alt="" class="fc-ag-img" />
              <span class="fc-ag-vote" style="color:{ag.dir === 'LONG' ? 'var(--grn)' : ag.dir === 'SHORT' ? 'var(--red)' : 'rgba(255,255,255,.3)'}">{ag.dir === 'LONG' ? '▲' : ag.dir === 'SHORT' ? '▼' : '—'}</span>
            </div>
          {/each}
        </div>
        <div class="fc-cta fc-cta1">ENTER WAR ROOM →</div>
      </button>

      <div class="flow-arrow">
        <span class="fa-line"></span>
        <span class="fa-label">시그널 자동 생성</span>
        <span class="fa-icon">⚡</span>
      </div>

      <!-- STEP 2: SIGNAL ROOM -->
      <button class="flow-card fc-2" on:click={() => goto('/signals')}>
        <div class="fc-step">STEP 2</div>
        <div class="fc-icon-row">
          <img src="/doge/trade-surge.png" alt="" class="fc-img" />
          <div class="fc-signal-badge">📡 LIVE</div>
        </div>
        <h2 class="fc-name fc-n2">SIGNAL ROOM</h2>
        <p class="fc-desc">에이전트 분석 기반 트레이딩 시그널</p>
        <div class="fc-detail">
          <span>📡 실시간 시그널 피드</span>
          <span>🎯 Entry / TP / SL 자동 설정</span>
        </div>
        <div class="fc-signal-preview">
          <div class="fc-sig-row">
            <span class="fc-sig-dir long">▲ LONG</span>
            <span class="fc-sig-pair">BTC/USDT</span>
            <span class="fc-sig-conf">82%</span>
          </div>
          <div class="fc-sig-row">
            <span class="fc-sig-dir short">▼ SHORT</span>
            <span class="fc-sig-pair">ETH/USDT</span>
            <span class="fc-sig-conf">75%</span>
          </div>
        </div>
        {#if trackedSigs > 0}
          <div class="fc-tracked-badge">📌 {trackedSigs} TRACKED</div>
        {/if}
        <div class="fc-cta fc-cta2">SIGNAL ROOM →</div>
      </button>

      <div class="flow-arrow">
        <span class="fa-line"></span>
        <span class="fa-label">원클릭 카피트레이드</span>
        <span class="fa-icon">🚀</span>
      </div>

      <!-- STEP 3: COPY TRADE -->
      <button class="flow-card fc-3" on:click={enterTerminal}>
        <div class="fc-step">STEP 3</div>
        <div class="fc-icon-row">
          <img src="/doge/action-victory.png" alt="" class="fc-img" />
        </div>
        <h2 class="fc-name fc-n3">COPY TRADE</h2>
        <p class="fc-desc">시그널 기반 원클릭 포지션 오픈</p>
        <div class="fc-detail">
          <span>⚡ Quick Long / Short</span>
          <span>📊 실시간 PnL 추적</span>
        </div>
        {#if openPositions > 0}
          <div class="fc-open-badge">{openPositions} OPEN POSITIONS</div>
        {/if}
        <div class="fc-cta fc-cta3">START TRADING →</div>
      </button>
    </div>
  </section>

  <!-- ═══ ARENA CARD ═══ -->
  <section class="arena-section">
    <button class="arena-entry" on:click={enterArena}>
      <img src="/doge/action-charge.png" alt="" class="arena-bg-img" />
      <div class="arena-content">
        <span class="arena-tag">AI BATTLE MODE</span>
        <h2 class="arena-title">ARENA</h2>
        <p class="arena-desc">AI 에이전트 스쿼드와 11-Phase 배틀에 참전</p>
        <div class="arena-feats">
          <span>⚔️ 11-Phase Battle</span>
          <span>🐕 7 AI Agents</span>
          <span>📊 Consensus</span>
          <span>🏆 LP Ranking</span>
        </div>
        <div class="arena-cta">ENTER ARENA →</div>
      </div>
    </button>
  </section>

  <!-- ═══ AGENT SQUAD ═══ -->
  <section class="squad-section">
    <div class="squad-header">
      <h3 class="sq-title">⚡ AGENT SQUAD</h3>
      <span class="sq-sub">7 AI 분석가가 대기 중</span>
    </div>
    <div class="squad-scroll">
      {#each AGDEFS as ag}
        <div class="sq-card" style="--ac:{ag.color}">
          <img src={ag.img.def} alt={ag.name} class="sq-avatar" />
          <span class="sq-name" style="color:{ag.color}">{ag.name}</span>
          <span class="sq-role">{ag.role}</span>
          <span class="sq-conf">{ag.conf}%</span>
        </div>
      {/each}
    </div>
  </section>

  <!-- ═══ QUICK NAV ═══ -->
  <section class="quick-nav">
    <button class="qn-btn" on:click={() => goto('/passport')}>
      <span class="qn-icon">📋</span>
      <span class="qn-label">PASSPORT</span>
      <span class="qn-tier">{profile.tier.toUpperCase()}</span>
    </button>
    <button class="qn-btn" on:click={() => goto('/oracle')}>
      <span class="qn-icon">🔮</span>
      <span class="qn-label">ORACLE</span>
    </button>
    <button class="qn-btn" on:click={() => goto('/signals')}>
      <span class="qn-icon">🔔</span>
      <span class="qn-label">SIGNALS</span>
      {#if trackedSigs > 0}<span class="qn-badge">{trackedSigs}</span>{/if}
    </button>
    <button class="qn-btn" on:click={() => goto('/passport')}>
      <span class="qn-icon">💰</span>
      <span class="qn-label">PORTFOLIO</span>
    </button>
    <button class="qn-btn" on:click={() => goto('/live')}>
      <span class="qn-icon">👀</span>
      <span class="qn-label">LIVE</span>
    </button>
  </section>

  <!-- ═══ WALLET CTA ═══ -->
  <section class="wallet-cta">
    {#if !connected}
      <button class="wc-btn" on:click={openWalletModal}>
        <span class="wc-bolt">⚡</span> CONNECT WALLET TO START <span class="wc-bolt">⚡</span>
      </button>
    {:else}
      <div class="wc-connected">
        <span class="wc-dot"></span>
        <span>{wallet.shortAddr}</span>
        <span class="wc-tier">{profile.tier.toUpperCase()}</span>
      </div>
    {/if}
  </section>
</div>

<style>
  .home {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    background: #1a0a2e;
    display: flex;
    flex-direction: column;
  }
  .home::-webkit-scrollbar { width: 4px; }
  .home::-webkit-scrollbar-thumb { background: var(--yel); border-radius: 4px; }

  /* ═══ BLOCK PARTY HERO ═══ */
  .hero {
    position: relative;
    text-align: center;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #000;
    border-bottom: 5px solid #000;
    min-height: 420px;
    padding: 50px 24px 35px;
  }

  /* ── Scattered deco elements ── */
  .deco-layer { position: absolute; inset: 0; pointer-events: none; z-index: 1; }
  .d { position: absolute; object-fit: contain; }

  /* Top-left bursts */
  .d-burst-tl { left: -2%; top: -5%; width: 160px; opacity: .8; transform: rotate(-10deg); }
  /* Top-right bursts (flipped) */
  .d-burst-tr { right: -2%; top: -5%; width: 140px; opacity: .7; transform: scaleX(-1) rotate(5deg); }
  /* Pink clouds left */
  .d-cloud-l { left: -3%; top: 30%; width: 160px; opacity: .6; }
  /* Pink clouds + halftone right */
  .d-cloud-r { right: -4%; bottom: 15%; width: 180px; opacity: .5; }
  /* Star cluster top-left */
  .d-star { left: 5%; top: 8%; width: 90px; opacity: .8; }
  /* Sparkles bottom-right */
  .d-sparkle { right: 8%; bottom: 8%; width: 80px; opacity: .85; }
  /* Basketball top-right */
  .d-ball { right: 4%; top: 5%; width: 110px; opacity: .75; transform: rotate(10deg); }
  /* Sunglasses + ball mid-left */
  .d-glasses { left: 2%; bottom: 5%; width: 130px; opacity: .65; }
  /* Coin + camera bottom center-right */
  .d-cam { right: 15%; bottom: 0; width: 100px; opacity: .6; }
  /* Halftone blob mid-right */
  .d-halftone { right: 0; top: 40%; width: 120px; opacity: .4; }
  /* POW / ZAP mid-left */
  .d-pow { left: 0; bottom: 25%; width: 170px; opacity: .55; }
  /* DOGE coins top center */
  .d-coins { left: 50%; top: 0; width: 140px; opacity: .7; transform: translateX(-50%); }
  /* Flying doge + cloud top-right */
  .d-doge-fly { right: 0; top: 12%; width: 150px; opacity: .8; }
  /* Heart DOGE coin bottom-left */
  .d-heart { left: 12%; bottom: 2%; width: 90px; opacity: .75; }

  /* ── Hero Content ── */
  .hero-content { position: relative; z-index: 5; }
  .hero-badge {
    display: inline-block;
    font-family: var(--fm);
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 4px;
    color: #000;
    background: var(--yel);
    border: 2px solid #000;
    box-shadow: 3px 3px 0 #000;
    padding: 5px 18px;
    border-radius: 20px;
    margin-bottom: 14px;
  }

  .hero-title {
    font-family: var(--fd);
    font-size: 72px;
    font-weight: 900;
    letter-spacing: 8px;
    line-height: 1;
    margin-bottom: 12px;
    filter: drop-shadow(4px 4px 0 rgba(0,0,0,.8));
  }
  .title-maxi {
    color: #f5e6c8;
    -webkit-text-stroke: 3px #000;
    paint-order: stroke fill;
  }
  .title-bolt {
    color: #ffe600;
    -webkit-text-stroke: 3px #000;
    paint-order: stroke fill;
    animation: boltFlash 1.5s ease infinite;
    display: inline-block;
    font-size: 80px;
  }
  @keyframes boltFlash {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: .85; transform: scale(1.15); }
  }
  .title-doge {
    color: #f5e6c8;
    -webkit-text-stroke: 3px #000;
    paint-order: stroke fill;
  }

  .hero-sub {
    font-family: var(--fb);
    font-size: 13px;
    color: rgba(255,255,255,.6);
    font-weight: 700;
    letter-spacing: 2px;
    margin-bottom: 12px;
  }

  /* ── Ticker ── */
  .hero-ticker {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    background: rgba(255,255,255,.06);
    border: 2px solid rgba(255,255,255,.1);
    border-radius: 30px;
    padding: 8px 24px;
  }
  .tick-item { display: flex; align-items: center; gap: 5px; }
  .tick-coin { font-size: 16px; color: #f7931a; }
  .tick-coin.eth-coin { color: #627eea; }
  .tick-coin.sol-coin { color: #9945ff; }
  .tick-label { font-family: var(--fm); font-size: 9px; font-weight: 700; color: rgba(255,255,255,.5); letter-spacing: 1px; }
  .tick-price { font-family: var(--fd); font-size: 15px; font-weight: 900; color: var(--yel); }
  .tick-sep { color: rgba(255,255,255,.2); font-size: 12px; }

  /* ═══ STATS STRIP ═══ */
  .stats-strip {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    padding: 12px 24px;
    background: #000;
    border-bottom: 3px solid var(--yel);
  }
  .ss-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 0 24px;
  }
  .ss-sep {
    width: 1px;
    height: 28px;
    background: rgba(255,255,255,.12);
    flex-shrink: 0;
  }
  .ss-v {
    font-family: var(--fd);
    font-size: 20px;
    font-weight: 900;
    color: #fff;
    letter-spacing: 1px;
  }
  .ss-streak { color: var(--ora); }
  .ss-l {
    font-family: var(--fm);
    font-size: 7px;
    font-weight: 700;
    color: rgba(255,255,255,.35);
    letter-spacing: 2px;
  }

  /* ═══ FLOW SECTION ═══ */
  .flow-section {
    padding: 20px 18px;
    background: linear-gradient(180deg, #1a0a2e 0%, #0c0c1e 100%);
  }
  .flow-title {
    font-family: var(--fd); font-size: 12px; font-weight: 900;
    letter-spacing: 4px; color: var(--yel); text-align: center;
    margin-bottom: 16px;
    text-shadow: 0 0 12px rgba(255,230,0,.3);
  }
  .flow-steps {
    display: flex; flex-direction: column; align-items: center; gap: 0;
  }

  /* Flow Card */
  .flow-card {
    width: 100%; max-width: 520px;
    border: 3px solid #000;
    border-radius: 16px;
    padding: 18px 18px 14px;
    cursor: pointer;
    transition: all .15s;
    text-align: left;
    display: flex; flex-direction: column; gap: 6px;
    box-shadow: 5px 5px 0 #000;
    position: relative;
    overflow: hidden;
  }
  .flow-card:hover { transform: translate(-2px, -2px); box-shadow: 7px 7px 0 #000; }
  .flow-card:active { transform: translate(1px, 1px); box-shadow: 2px 2px 0 #000; }
  .fc-1 { background: linear-gradient(135deg, #0a1628 0%, #0d2240 100%); }
  .fc-2 { background: linear-gradient(135deg, #1a0a1e 0%, #2a0a38 100%); }
  .fc-3 { background: linear-gradient(135deg, #0a1e0a 0%, #0a2818 100%); }

  .fc-step {
    font-family: var(--fm); font-size: 7px; font-weight: 900;
    letter-spacing: 3px; color: #000;
    background: var(--yel); padding: 2px 10px; border-radius: 10px;
    display: inline-block; width: fit-content;
    border: 2px solid #000;
  }

  .fc-icon-row {
    display: flex; align-items: center; gap: 8px;
  }
  .fc-img { width: 48px; height: 48px; object-fit: contain; }
  .fc-live-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--grn); box-shadow: 0 0 8px var(--grn);
    animation: blink .9s infinite;
  }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.2} }
  .fc-signal-badge {
    font-family: var(--fm); font-size: 7px; font-weight: 900;
    letter-spacing: 1px; color: var(--pk); background: rgba(255,45,155,.1);
    border: 1.5px solid rgba(255,45,155,.4); padding: 2px 8px; border-radius: 6px;
  }

  .fc-name {
    font-family: var(--fd); font-size: 22px; font-weight: 900;
    letter-spacing: 4px; line-height: 1;
  }
  .fc-n1 { color: var(--cyan); text-shadow: 2px 2px 0 #000; }
  .fc-n2 { color: var(--pk); text-shadow: 2px 2px 0 #000; }
  .fc-n3 { color: var(--grn); text-shadow: 2px 2px 0 #000; }

  .fc-desc { font-family: var(--fb); font-size: 11px; color: rgba(255,255,255,.6); line-height: 1.4; }

  .fc-detail { display: flex; flex-direction: column; gap: 2px; }
  .fc-detail span {
    font-family: var(--fm); font-size: 8px; color: rgba(255,255,255,.4); letter-spacing: .5px;
  }

  /* Agent avatars in flow card */
  .fc-agents {
    display: flex; gap: 6px; margin-top: 4px;
  }
  .fc-ag {
    display: flex; align-items: center; gap: 2px;
    border: 1.5px solid; border-radius: 20px;
    padding: 2px 6px 2px 2px; background: rgba(255,255,255,.03);
  }
  .fc-ag-img { width: 20px; height: 20px; border-radius: 50%; object-fit: cover; }
  .fc-ag-vote { font-family: var(--fm); font-size: 9px; font-weight: 900; }

  /* Signal preview rows */
  .fc-signal-preview {
    display: flex; flex-direction: column; gap: 3px;
    background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.06);
    border-radius: 6px; padding: 6px 8px; margin-top: 2px;
  }
  .fc-sig-row {
    display: flex; align-items: center; gap: 8px;
  }
  .fc-sig-dir {
    font-family: var(--fm); font-size: 8px; font-weight: 900;
    padding: 1px 5px; border: 1px solid; border-radius: 3px;
  }
  .fc-sig-dir.long { color: var(--grn); border-color: rgba(0,255,136,.4); background: rgba(0,255,136,.08); }
  .fc-sig-dir.short { color: var(--red); border-color: rgba(255,45,85,.4); background: rgba(255,45,85,.08); }
  .fc-sig-pair { font-family: var(--fd); font-size: 10px; font-weight: 900; color: #fff; }
  .fc-sig-conf { font-family: var(--fm); font-size: 8px; color: var(--yel); margin-left: auto; }

  .fc-tracked-badge {
    font-family: var(--fm); font-size: 7px; font-weight: 900; letter-spacing: 1px;
    color: var(--ora); background: rgba(255,140,59,.08);
    border: 1px solid rgba(255,140,59,.3); padding: 3px 8px;
    border-radius: 6px; width: fit-content;
  }
  .fc-open-badge {
    font-family: var(--fm); font-size: 7px; font-weight: 900; letter-spacing: 1px;
    color: #000; background: var(--grn);
    border: 2px solid #000; padding: 3px 8px;
    border-radius: 6px; width: fit-content;
  }

  .fc-cta {
    margin-top: 4px;
    font-family: var(--fd); font-size: 10px; font-weight: 900;
    letter-spacing: 2px; padding: 10px 16px; border-radius: 8px;
    border: 3px solid #000; box-shadow: 3px 3px 0 #000;
    text-align: center; transition: all .12s;
  }
  .fc-cta1 { background: var(--cyan); color: #000; }
  .fc-cta2 { background: var(--pk); color: #fff; }
  .fc-cta3 { background: var(--grn); color: #000; }
  .flow-card:hover .fc-cta { box-shadow: 4px 4px 0 #000; }

  /* Flow Arrow */
  .flow-arrow {
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    padding: 6px 0;
  }
  .fa-line {
    width: 2px; height: 16px;
    background: linear-gradient(180deg, var(--yel), rgba(255,230,0,.2));
  }
  .fa-label {
    font-family: var(--fm); font-size: 7px; font-weight: 900;
    letter-spacing: 2px; color: var(--yel);
    background: rgba(255,230,0,.06); border: 1px solid rgba(255,230,0,.2);
    padding: 2px 10px; border-radius: 10px;
  }
  .fa-icon { font-size: 14px; }

  /* ═══ ARENA SECTION ═══ */
  .arena-section {
    padding: 0 18px 14px;
    background: #0c0c1e;
  }
  .arena-entry {
    width: 100%;
    position: relative; overflow: hidden;
    border: 3px solid #000; border-radius: 16px;
    box-shadow: 5px 5px 0 #000;
    cursor: pointer; transition: all .15s;
    background: linear-gradient(135deg, #1e0a28 0%, #2d0a3e 100%);
  }
  .arena-entry:hover { transform: translate(-2px,-2px); box-shadow: 7px 7px 0 #000; }
  .arena-entry:active { transform: translate(1px,1px); box-shadow: 2px 2px 0 #000; }
  .arena-bg-img {
    position: absolute; right: -10px; bottom: -10px;
    width: 120px; height: 120px; object-fit: contain;
    opacity: .15; pointer-events: none;
  }
  .arena-content { position: relative; padding: 16px 18px; }
  .arena-tag {
    font-family: var(--fm); font-size: 7px; font-weight: 900; letter-spacing: 2px;
    color: var(--pk); background: rgba(255,45,155,.1);
    border: 1.5px solid rgba(255,45,155,.4);
    padding: 2px 8px; border-radius: 8px;
  }
  .arena-title {
    font-family: var(--fd); font-size: 24px; font-weight: 900;
    letter-spacing: 4px; color: var(--pk); text-shadow: 2px 2px 0 #000;
    margin-top: 6px; line-height: 1;
  }
  .arena-desc {
    font-family: var(--fb); font-size: 11px; color: rgba(255,255,255,.6);
    margin-top: 4px; line-height: 1.4;
  }
  .arena-feats {
    display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px;
  }
  .arena-feats span {
    font-family: var(--fm); font-size: 7px; color: rgba(255,255,255,.5);
    background: rgba(255,255,255,.06); padding: 3px 7px; border-radius: 4px;
    border: 1px solid rgba(255,255,255,.08);
  }
  .arena-cta {
    margin-top: 10px;
    font-family: var(--fd); font-size: 10px; font-weight: 900;
    letter-spacing: 2px; padding: 10px 16px; border-radius: 8px;
    border: 3px solid #000; box-shadow: 3px 3px 0 #000;
    background: var(--pk); color: #fff; text-align: center;
    transition: all .12s;
  }
  .arena-entry:hover .arena-cta { box-shadow: 4px 4px 0 #000; }

  /* ═══ SQUAD ═══ */
  .squad-section { padding: 14px 18px; background: #0c0c1e; }
  .squad-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .sq-title { font-family: var(--fd); font-size: 11px; font-weight: 900; letter-spacing: 3px; color: var(--yel); }
  .sq-sub { font-family: var(--fm); font-size: 7px; color: rgba(255,255,255,.3); letter-spacing: 1px; }

  .squad-scroll {
    display: flex; gap: 8px;
    overflow-x: auto; padding-bottom: 6px;
    scrollbar-width: none;
  }
  .squad-scroll::-webkit-scrollbar { display: none; }

  .sq-card {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    background: #111130;
    border: 2px solid rgba(255,255,255,.08);
    border-radius: 12px;
    padding: 12px 14px 10px;
    min-width: 88px;
    transition: all .15s;
  }
  .sq-card:hover { border-color: var(--ac); box-shadow: 0 0 16px color-mix(in srgb, var(--ac) 25%, transparent); transform: translateY(-2px); }
  .sq-avatar {
    width: 40px; height: 40px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid var(--ac);
    box-shadow: 0 0 10px color-mix(in srgb, var(--ac) 30%, transparent);
  }
  .sq-name { font-family: var(--fd); font-size: 8px; font-weight: 900; letter-spacing: 1px; }
  .sq-role { font-family: var(--fm); font-size: 6px; color: rgba(255,255,255,.3); letter-spacing: .5px; text-align: center; }
  .sq-conf { font-family: var(--fd); font-size: 10px; font-weight: 900; color: rgba(255,255,255,.45); }

  /* ═══ QUICK NAV ═══ */
  .quick-nav {
    display: flex; gap: 6px; padding: 10px 18px;
    overflow-x: auto; justify-content: center; flex-wrap: wrap;
    background: #0c0c1e;
  }
  .qn-btn {
    display: flex; align-items: center; gap: 5px;
    font-family: var(--fm); font-size: 8px; font-weight: 700;
    letter-spacing: 1px; color: rgba(255,255,255,.5);
    background: rgba(255,255,255,.03); border: 1.5px solid rgba(255,255,255,.08);
    padding: 7px 14px; border-radius: 8px; cursor: pointer;
    transition: all .15s; white-space: nowrap;
  }
  .qn-btn:hover { color: var(--yel); border-color: rgba(255,230,0,.3); background: rgba(255,230,0,.04); transform: translateY(-1px); }
  .qn-icon { font-size: 13px; }
  .qn-label { letter-spacing: 1.5px; }
  .qn-tier { font-size: 7px; color: var(--gold); background: rgba(255,200,0,.1); padding: 1px 5px; border-radius: 4px; }
  .qn-badge {
    font-size: 7px; font-weight: 900;
    background: var(--cyan); color: #000;
    padding: 1px 5px; border-radius: 6px; min-width: 14px; text-align: center;
  }

  /* ═══ WALLET CTA ═══ */
  .wallet-cta { padding: 14px 18px 32px; text-align: center; background: #0c0c1e; }
  .wc-btn {
    font-family: var(--fd); font-size: 12px; font-weight: 900; letter-spacing: 3px;
    color: #000; background: var(--yel);
    border: 3px solid #000; box-shadow: 5px 5px 0 #000;
    padding: 16px 32px; border-radius: 14px; cursor: pointer;
    transition: all .15s; width: 100%; max-width: 420px;
    animation: ctaPulse 3s ease infinite;
  }
  .wc-btn:hover { transform: translate(-2px,-2px); box-shadow: 7px 7px 0 #000; }
  @keyframes ctaPulse {
    0%,100% { box-shadow: 5px 5px 0 #000; }
    50% { box-shadow: 5px 5px 0 #000, 0 0 30px rgba(255,230,0,.25); }
  }
  .wc-bolt { display: inline-block; animation: boltFlash 1.5s ease infinite; }

  .wc-connected {
    display: inline-flex; align-items: center; gap: 8px;
    font-family: var(--fm); font-size: 10px; font-weight: 700;
    color: var(--grn); letter-spacing: 1.5px;
    background: rgba(0,255,136,.05); border: 1.5px solid rgba(0,255,136,.2);
    padding: 10px 18px; border-radius: 12px;
  }
  .wc-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--grn); box-shadow: 0 0 10px var(--grn); }
  .wc-tier {
    font-size: 7px; background: rgba(255,200,0,.15);
    color: var(--gold); padding: 2px 6px; border-radius: 4px;
    letter-spacing: 1px;
  }

  /* ═══ RESPONSIVE ═══ */
  @media (max-width: 640px) {
    .hero { min-height: 320px; padding: 35px 16px 25px; }
    .hero-title { font-size: 46px; letter-spacing: 4px; }
    .title-bolt { font-size: 52px; }
    .hero-sub { font-size: 10px; }
    .hero-ticker { padding: 6px 14px; gap: 8px; }
    .tick-price { font-size: 12px; }
    .tick-label { font-size: 7px; }
    .d-burst-tl, .d-burst-tr { width: 100px !important; }
    .d-cloud-l { width: 100px !important; }
    .d-cloud-r { width: 110px !important; }
    .d-ball { width: 70px !important; }
    .d-doge-fly { width: 100px !important; }
    .d-pow { width: 110px !important; }
    .d-coins { width: 90px !important; }
    .d-glasses { width: 80px !important; }
    .d-heart { width: 60px !important; }
    .stats-strip { padding: 10px 12px; }
    .ss-item { padding: 0 14px; }
    .ss-v { font-size: 16px; }
    .flow-section { padding: 14px; }
    .flow-card { padding: 14px 14px 12px; }
    .fc-name { font-size: 18px; letter-spacing: 2px; }
  }
</style>
