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
  <!-- ═══ BLOCK PARTY HERO – FULL SCREEN POP ART COLLAGE ═══ -->
  <section class="hero">
    <!-- LAYER 1: Pop-art deco elements (bursts, clouds, halftone, stars) -->
    <div class="deco-layer">
      <img class="d d-burst-tl" src="/blockparty/deco-bursts.png" alt="" />
      <img class="d d-burst-tr" src="/blockparty/deco-bursts.png" alt="" />
      <img class="d d-burst-bl" src="/blockparty/deco-bursts.png" alt="" />
      <img class="d d-cloud-l" src="/blockparty/deco-clouds.png" alt="" />
      <img class="d d-cloud-r" src="/blockparty/deco-clouds-halftone.png" alt="" />
      <img class="d d-halftone" src="/blockparty/deco-halftone-blob.png" alt="" />
      <img class="d d-star1" src="/blockparty/deco-stars.png" alt="" />
      <img class="d d-star2" src="/blockparty/deco-stars.png" alt="" />
      <img class="d d-star3" src="/blockparty/deco-stars.png" alt="" />
      <img class="d d-sparkle1" src="/blockparty/deco-sparkles.png" alt="" />
      <img class="d d-sparkle2" src="/blockparty/deco-sparkles.png" alt="" />
    </div>

    <!-- LAYER 2: Blockparty doge deco PNGs – HUGE -->
    <div class="doge-layer">
      <img class="dg dg-pow" src="/blockparty/deco-pow-doge.png" alt="" />
      <img class="dg dg-glasses" src="/blockparty/deco-ball-glasses.png" alt="" />
      <img class="dg dg-cam" src="/blockparty/deco-coin-camera.png" alt="" />
      <img class="dg dg-coin" src="/blockparty/deco-coin-doge-big.png" alt="" />
      <img class="dg dg-cloud" src="/blockparty/deco-doge-cloud.png" alt="" />
      <img class="dg dg-heart" src="/blockparty/deco-heart-doge.png" alt="" />
      <img class="dg dg-top" src="/blockparty/deco-top-doges.png" alt="" />
      <img class="dg dg-row" src="/blockparty/deco-doges-row.png" alt="" />
      <img class="dg dg-multi" src="/blockparty/deco-multi-doges.png" alt="" />
      <img class="dg dg-left" src="/blockparty/deco-left-cluster.png" alt="" />
      <img class="dg dg-zap" src="/blockparty/deco-zap-duck.png" alt="" />
    </div>

    <!-- LAYER 3: folder5 individual doge stickers – scattered BOLD -->
    <div class="sticker-layer">
      <img class="s s-bull" src="/blockparty/f5-doge-bull.png" alt="" />
      <img class="s s-bear" src="/blockparty/f5-doge-bear.png" alt="" />
      <img class="s s-chart" src="/blockparty/f5-doge-chart.png" alt="" />
      <img class="s s-angry" src="/blockparty/f5-doge-angry.png" alt="" />
      <img class="s s-muscle" src="/blockparty/f5-doge-muscle.png" alt="" />
      <img class="s s-fire" src="/blockparty/f5-doge-fire.png" alt="" />
      <img class="s s-cross" src="/blockparty/f5-doge-cross.png" alt="" />
      <img class="s s-wings" src="/blockparty/f5-doge-wings.png" alt="" />
      <img class="s s-fist" src="/blockparty/f5-doge-fist.png" alt="" />
      <img class="s s-excited" src="/blockparty/f5-doge-excited.png" alt="" />
      <img class="s s-face" src="/blockparty/f5-doge-face.png" alt="" />
      <img class="s s-circle" src="/blockparty/f5-doge-circle.png" alt="" />
      <img class="s s-question" src="/blockparty/f5-doge-question.png" alt="" />
      <img class="s s-heart" src="/blockparty/f5-doge-heart.png" alt="" />
      <img class="s s-shock" src="/blockparty/f5-doge-shock.png" alt="" />
      <img class="s s-cry" src="/blockparty/f5-doge-cry.png" alt="" />
      <img class="s s-happy" src="/blockparty/f5-doge-happy.png" alt="" />
      <img class="s s-grin" src="/blockparty/f5-doge-grin.png" alt="" />
      <img class="s s-shield" src="/blockparty/f5-doge-shield.png" alt="" />
      <img class="s s-tilt" src="/blockparty/f5-doge-tilt.png" alt="" />
      <img class="s s-rage" src="/blockparty/f5-doge-rage.png" alt="" />
      <img class="s s-bearish" src="/blockparty/f5-doge-bearish.png" alt="" />
      <img class="s s-redarrow" src="/blockparty/f5-doge-redarrow.png" alt="" />
      <img class="s s-splash" src="/blockparty/f5-doge-splash.png" alt="" />
      <img class="s s-spin" src="/blockparty/f5-doge-spin.png" alt="" />
      <img class="s s-love" src="/blockparty/f5-doge-love.png" alt="" />
      <img class="s s-smirk" src="/blockparty/f5-doge-smirk.png" alt="" />
    </div>

    <!-- LAYER 4 (TOP): Title + ticker -->
    <div class="hero-content">
      <h1 class="hero-title">
        <span class="title-line">MAXI</span>
        <span class="title-line">DOGE</span>
      </h1>
      <div class="hero-badge">⚡ AI AGENT TRADING PLATFORM ⚡</div>
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

  <!-- ═══ STATS STRIP ═══ -->
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

  <!-- ═══ 3-STEP FLOW (Horizontal, Compact Pop-Art) ═══ -->
  <section class="flow-section">
    <h3 class="flow-title">⚡ HOW IT WORKS ⚡</h3>
    <div class="flow-grid">
      <button class="fc fc-1" on:click={enterTerminal}>
        <div class="fc-num">01</div>
        <img src="/blockparty/f5-doge-cross.png" alt="" class="fc-doge" />
        <h2 class="fc-name">WAR ROOM</h2>
        <p class="fc-desc">7 AI 에이전트 실시간 시장 분석</p>
        <div class="fc-agents">
          {#each AGDEFS.slice(0, 5) as ag}
            <img src={ag.img.def} alt="" class="fc-ag" style="border-color:{ag.color}" />
          {/each}
        </div>
        <div class="fc-cta" style="background:var(--cyan);color:#000">ENTER →</div>
      </button>

      <div class="flow-connector">
        <span class="fc-arrow">→</span>
        <span class="fc-arrow-label">시그널 생성</span>
      </div>

      <button class="fc fc-2" on:click={() => goto('/signals')}>
        <div class="fc-num">02</div>
        <img src="/blockparty/f5-doge-chart.png" alt="" class="fc-doge" />
        <h2 class="fc-name">SIGNALS</h2>
        <p class="fc-desc">AI 분석 기반 트레이딩 시그널</p>
        <div class="fc-preview">
          <span class="fp-long">▲ LONG BTC 82%</span>
          <span class="fp-short">▼ SHORT ETH 75%</span>
        </div>
        {#if trackedSigs > 0}
          <div class="fc-badge">📌 {trackedSigs} TRACKED</div>
        {/if}
        <div class="fc-cta" style="background:var(--pk);color:#fff">SIGNALS →</div>
      </button>

      <div class="flow-connector">
        <span class="fc-arrow">→</span>
        <span class="fc-arrow-label">카피트레이드</span>
      </div>

      <button class="fc fc-3" on:click={enterTerminal}>
        <div class="fc-num">03</div>
        <img src="/blockparty/f5-doge-fire.png" alt="" class="fc-doge" />
        <h2 class="fc-name">COPY TRADE</h2>
        <p class="fc-desc">원클릭 포지션 오픈 & PnL 추적</p>
        {#if openPositions > 0}
          <div class="fc-badge fc-badge-grn">{openPositions} OPEN</div>
        {/if}
        <div class="fc-cta" style="background:var(--grn);color:#000">TRADE →</div>
      </button>
    </div>
  </section>

  <!-- ═══ ARENA BANNER (Comic Panel) ═══ -->
  <section class="arena-section">
    <button class="arena-card" on:click={enterArena}>
      <img src="/blockparty/f5-doge-muscle.png" alt="" class="arena-doge-l" />
      <div class="arena-center">
        <span class="arena-tag">⚔️ AI BATTLE MODE</span>
        <h2 class="arena-title">ARENA</h2>
        <p class="arena-desc">7 AI 에이전트와 11-Phase 배틀 참전</p>
        <div class="arena-feats">
          <span>⚔️ 11-Phase</span>
          <span>🐕 7 Agents</span>
          <span>🏆 Ranking</span>
        </div>
        <div class="arena-cta">ENTER ARENA →</div>
      </div>
      <img src="/blockparty/f5-doge-bull.png" alt="" class="arena-doge-r" />
    </button>
  </section>

  <!-- ═══ AGENT SQUAD (Comic Cards) ═══ -->
  <section class="squad-section">
    <h3 class="sq-title">🐕 AGENT SQUAD</h3>
    <div class="squad-grid">
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

  <!-- ═══ QUICK NAV (Retro Game Menu) ═══ -->
  <section class="quick-nav">
    <button class="qn" on:click={() => goto('/terminal')}>
      <span class="qn-icon">📊</span><span>TERMINAL</span>
    </button>
    <button class="qn" on:click={() => goto('/passport')}>
      <span class="qn-icon">📋</span><span>PASSPORT</span>
    </button>
    <button class="qn" on:click={() => goto('/oracle')}>
      <span class="qn-icon">🔮</span><span>ORACLE</span>
    </button>
    <button class="qn" on:click={() => goto('/signals')}>
      <span class="qn-icon">🔔</span><span>SIGNALS</span>
      {#if trackedSigs > 0}<span class="qn-badge">{trackedSigs}</span>{/if}
    </button>
    <button class="qn" on:click={() => goto('/live')}>
      <span class="qn-icon">👀</span><span>LIVE</span>
    </button>
  </section>

  <!-- ═══ WALLET CTA ═══ -->
  <section class="wallet-cta">
    {#if !connected}
      <button class="wc-btn" on:click={openWalletModal}>
        <span class="wc-bolt">⚡</span> CONNECT WALLET <span class="wc-bolt">⚡</span>
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
    background: #0a0a14;
    display: flex;
    flex-direction: column;
  }
  .home::-webkit-scrollbar { width: 4px; }
  .home::-webkit-scrollbar-thumb { background: var(--yel); border-radius: 4px; }

  /* ═══ BLOCK PARTY HERO – FULL SCREEN POP ART ═══ */
  .hero {
    position: relative;
    text-align: center;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(160deg, #ffb6c1 0%, #ff69b4 25%, #ff8ca0 50%, #ffa0b4 75%, #ffccd5 100%);
    min-height: 520px;
    padding: 30px 16px;
  }

  /* ── LAYER 1: Deco (bursts, clouds, halftone, stars) ── */
  .deco-layer { position: absolute; inset: 0; pointer-events: none; z-index: 1; }
  .d { position: absolute; object-fit: contain; }

  .d-burst-tl { left: -8%; top: -12%; width: 380px; opacity: .9; transform: rotate(-15deg); }
  .d-burst-tr { right: -6%; top: -10%; width: 350px; opacity: .85; transform: scaleX(-1) rotate(10deg); }
  .d-burst-bl { left: -5%; bottom: -10%; width: 300px; opacity: .8; transform: rotate(15deg); }
  .d-cloud-l { left: -5%; top: 20%; width: 320px; opacity: .7; }
  .d-cloud-r { right: -8%; bottom: 5%; width: 360px; opacity: .65; }
  .d-halftone { right: -3%; top: 30%; width: 300px; opacity: .5; }
  .d-star1 { left: 8%; top: 5%; width: 120px; opacity: 1; }
  .d-star2 { right: 15%; top: 15%; width: 90px; opacity: .9; transform: rotate(20deg); }
  .d-star3 { left: 35%; bottom: 3%; width: 100px; opacity: .85; transform: rotate(-10deg); }
  .d-sparkle1 { left: 20%; top: 10%; width: 110px; opacity: .9; }
  .d-sparkle2 { right: 5%; bottom: 15%; width: 130px; opacity: .85; }

  /* ── LAYER 2: Blockparty doge deco PNGs ── */
  .doge-layer { position: absolute; inset: 0; pointer-events: none; z-index: 2; }
  .dg { position: absolute; object-fit: contain; }

  .dg-pow    { left: -3%; top: 5%; width: 280px; transform: rotate(-8deg); }
  .dg-glasses { right: 2%; bottom: 0; width: 260px; transform: rotate(5deg); }
  .dg-cam    { right: 25%; bottom: -5%; width: 200px; }
  .dg-coin   { left: 5%; bottom: 5%; width: 220px; transform: rotate(-5deg); }
  .dg-cloud  { right: 0; top: 0; width: 300px; }
  .dg-heart  { left: 30%; bottom: -3%; width: 180px; }
  .dg-top    { left: 25%; top: -8%; width: 340px; }
  .dg-row    { left: 0; bottom: -5%; width: 100%; max-width: 500px; opacity: .8; }
  .dg-multi  { right: -5%; top: 15%; width: 280px; }
  .dg-left   { left: -8%; top: 25%; width: 320px; }
  .dg-zap    { left: 40%; bottom: 0; width: 200px; }

  /* ── LAYER 3: Folder5 individual doge stickers ── */
  .sticker-layer { position: absolute; inset: 0; pointer-events: none; z-index: 3; }
  .s { position: absolute; object-fit: contain; filter: drop-shadow(3px 3px 2px rgba(0,0,0,.3)); }

  /* LEFT SIDE stickers */
  .s-bull    { left: -2%; top: 8%; width: 220px; transform: rotate(-5deg); }
  .s-muscle  { left: 0; bottom: 2%; width: 200px; transform: scaleX(-1); }
  .s-cross   { left: 3%; top: 45%; width: 170px; }
  .s-wings   { left: 8%; bottom: 25%; width: 240px; }
  .s-rage    { left: 15%; top: 2%; width: 150px; transform: rotate(8deg); }

  /* RIGHT SIDE stickers */
  .s-fire    { right: -2%; top: 5%; width: 230px; }
  .s-chart   { right: 0; top: 35%; width: 220px; transform: rotate(5deg); }
  .s-bear    { right: 5%; bottom: 5%; width: 200px; }
  .s-angry   { right: 15%; top: 0; width: 180px; transform: rotate(-8deg); }
  .s-fist    { right: 8%; bottom: 30%; width: 190px; }

  /* TOP stickers */
  .s-excited { left: 35%; top: -3%; width: 160px; transform: rotate(-5deg); }
  .s-face    { right: 30%; top: 2%; width: 130px; transform: rotate(10deg); }
  .s-circle  { left: 50%; top: -5%; width: 140px; transform: translateX(-50%) rotate(-3deg); }

  /* BOTTOM stickers */
  .s-shock   { left: 45%; bottom: -2%; width: 150px; }
  .s-grin    { right: 35%; bottom: 0; width: 120px; }
  .s-happy   { left: 20%; bottom: -3%; width: 180px; transform: rotate(5deg); }
  .s-tilt    { right: 20%; bottom: -2%; width: 190px; transform: rotate(-3deg); }

  /* MID scattered stickers */
  .s-question { left: 5%; top: 65%; width: 160px; }
  .s-heart   { right: 2%; top: 55%; width: 130px; transform: rotate(12deg); }
  .s-cry     { left: 18%; top: 15%; width: 140px; transform: rotate(-10deg); }
  .s-shield  { right: 10%; top: 60%; width: 130px; }
  .s-bearish { left: 10%; bottom: 40%; width: 170px; }
  .s-redarrow { right: 25%; top: 25%; width: 150px; transform: rotate(8deg); }
  .s-splash  { left: 40%; top: 65%; width: 130px; }
  .s-spin    { right: 40%; bottom: 20%; width: 110px; }
  .s-love    { left: 55%; bottom: 15%; width: 120px; transform: rotate(-8deg); }
  .s-smirk   { right: 45%; top: 10%; width: 100px; }

  /* ── LAYER 4: Hero Content (TOP) ── */
  .hero-content { position: relative; z-index: 10; }
  .hero-title {
    font-family: var(--fd);
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: .85;
    margin-bottom: 10px;
  }
  .title-line {
    font-size: 120px;
    font-weight: 900;
    letter-spacing: 12px;
    color: #1a0a00;
    -webkit-text-stroke: 5px #000;
    paint-order: stroke fill;
    text-shadow:
      6px 6px 0 rgba(0,0,0,.5),
      -2px -2px 0 rgba(255,255,255,.3),
      0 0 40px rgba(255,200,0,.4);
    filter: drop-shadow(4px 6px 0 rgba(0,0,0,.6));
  }

  .hero-badge {
    display: inline-block;
    font-family: var(--fm);
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 4px;
    color: #000;
    background: var(--yel);
    border: 3px solid #000;
    box-shadow: 4px 4px 0 #000;
    padding: 6px 20px;
    border-radius: 24px;
    margin-bottom: 10px;
  }

  /* ── Ticker ── */
  .hero-ticker {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    background: rgba(0,0,0,.6);
    border: 2px solid rgba(255,255,255,.2);
    border-radius: 30px;
    padding: 8px 24px;
    backdrop-filter: blur(8px);
  }
  .tick-item { display: flex; align-items: center; gap: 5px; }
  .tick-coin { font-size: 16px; color: #f7931a; }
  .tick-coin.eth-coin { color: #627eea; }
  .tick-coin.sol-coin { color: #9945ff; }
  .tick-label { font-family: var(--fm); font-size: 9px; font-weight: 700; color: rgba(255,255,255,.7); letter-spacing: 1px; }
  .tick-price { font-family: var(--fd); font-size: 15px; font-weight: 900; color: var(--yel); }
  .tick-sep { color: rgba(255,255,255,.3); font-size: 12px; }

  /* ═══ STATS STRIP ═══ */
  .stats-strip {
    display: flex; align-items: center; justify-content: center;
    gap: 0; padding: 14px 24px;
    background: linear-gradient(90deg, #1a0025 0%, #000 50%, #1a0025 100%);
    border-top: 4px solid var(--yel);
    border-bottom: 4px solid var(--yel);
  }
  .ss-item { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 0 24px; }
  .ss-sep { width: 1px; height: 28px; background: rgba(255,255,255,.12); flex-shrink: 0; }
  .ss-v { font-family: var(--fd); font-size: 20px; font-weight: 900; color: #fff; letter-spacing: 1px; }
  .ss-streak { color: var(--ora); }
  .ss-l { font-family: var(--fm); font-size: 7px; font-weight: 700; color: rgba(255,255,255,.35); letter-spacing: 2px; }

  /* ═══ 3-STEP FLOW (Pop-Art Horizontal Grid) ═══ */
  .flow-section {
    padding: 28px 18px 24px;
    background:
      radial-gradient(circle, rgba(255,230,0,.04) 1px, transparent 1px),
      radial-gradient(circle, rgba(255,105,180,.03) 1px, transparent 1px),
      linear-gradient(180deg, #12082a 0%, #0a0418 100%);
    background-size: 24px 24px, 16px 16px, 100% 100%;
    background-position: 0 0, 12px 12px, 0 0;
    border-bottom: 4px solid rgba(255,230,0,.15);
  }
  .flow-title {
    font-family: var(--fd); font-size: 14px; font-weight: 900;
    letter-spacing: 6px; color: var(--yel); text-align: center;
    margin-bottom: 18px;
    text-shadow: 0 0 20px rgba(255,230,0,.3);
  }
  .flow-grid {
    display: flex; align-items: stretch; justify-content: center;
    gap: 0; max-width: 900px; margin: 0 auto;
  }

  .fc {
    flex: 1; min-width: 0;
    border: 3px solid #000; border-radius: 16px;
    padding: 16px 14px 14px; cursor: pointer;
    transition: all .15s; text-align: center;
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    box-shadow: 5px 5px 0 #000; position: relative; overflow: hidden;
  }
  .fc:hover { transform: translate(-2px, -2px); box-shadow: 7px 7px 0 #000; }
  .fc:active { transform: translate(1px, 1px); box-shadow: 2px 2px 0 #000; }
  .fc-1 { background: linear-gradient(135deg, #081830 0%, #0d2a50 100%); border-color: rgba(0,255,255,.3); }
  .fc-2 { background: linear-gradient(135deg, #200a28 0%, #380a50 100%); border-color: rgba(255,45,155,.3); }
  .fc-3 { background: linear-gradient(135deg, #0a2010 0%, #0a3818 100%); border-color: rgba(0,255,136,.3); }

  .fc-num {
    font-family: var(--fd); font-size: 32px; font-weight: 900;
    color: rgba(255,255,255,.06); position: absolute; top: 4px; right: 10px;
    letter-spacing: -2px; line-height: 1;
  }
  .fc-doge { width: 80px; height: 80px; object-fit: contain; filter: drop-shadow(2px 2px 4px rgba(0,0,0,.4)); }
  .fc-name {
    font-family: var(--fd); font-size: 16px; font-weight: 900;
    letter-spacing: 3px; line-height: 1; color: #fff;
    text-shadow: 2px 2px 0 #000;
  }
  .fc-desc { font-family: var(--fb); font-size: 10px; color: rgba(255,255,255,.5); line-height: 1.3; }

  .fc-agents { display: flex; gap: 4px; justify-content: center; }
  .fc-ag {
    width: 26px; height: 26px; border-radius: 50%; object-fit: cover;
    border: 2px solid; box-shadow: 0 0 6px rgba(255,255,255,.15);
  }

  .fc-preview { display: flex; flex-direction: column; gap: 2px; }
  .fp-long {
    font-family: var(--fm); font-size: 8px; font-weight: 900;
    color: var(--grn); background: rgba(0,255,136,.08);
    border: 1px solid rgba(0,255,136,.3); padding: 2px 8px; border-radius: 4px;
  }
  .fp-short {
    font-family: var(--fm); font-size: 8px; font-weight: 900;
    color: var(--red); background: rgba(255,45,85,.08);
    border: 1px solid rgba(255,45,85,.3); padding: 2px 8px; border-radius: 4px;
  }

  .fc-badge {
    font-family: var(--fm); font-size: 7px; font-weight: 900; letter-spacing: 1px;
    color: var(--ora); background: rgba(255,140,59,.1);
    border: 1px solid rgba(255,140,59,.3); padding: 2px 8px; border-radius: 6px;
  }
  .fc-badge-grn { color: #000; background: var(--grn); border-color: #000; }

  .fc-cta {
    margin-top: auto; width: 100%;
    font-family: var(--fd); font-size: 10px; font-weight: 900;
    letter-spacing: 2px; padding: 8px 12px; border-radius: 8px;
    border: 3px solid #000; box-shadow: 3px 3px 0 #000;
    text-align: center; transition: all .12s;
  }
  .fc:hover .fc-cta { box-shadow: 4px 4px 0 #000; }

  .flow-connector {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 2px; padding: 0 6px; flex-shrink: 0;
  }
  .fc-arrow {
    font-family: var(--fd); font-size: 20px; font-weight: 900; color: var(--yel);
    text-shadow: 0 0 10px rgba(255,230,0,.4);
  }
  .fc-arrow-label {
    font-family: var(--fm); font-size: 6px; font-weight: 900;
    letter-spacing: 1px; color: rgba(255,230,0,.5); white-space: nowrap;
  }

  /* ═══ ARENA (Comic Panel) ═══ */
  .arena-section {
    padding: 20px 18px;
    background:
      repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(255,45,155,.03) 20px, rgba(255,45,155,.03) 40px),
      linear-gradient(180deg, #0a0418 0%, #14082e 50%, #0a0418 100%);
  }
  .arena-card {
    width: 100%; display: flex; align-items: center; gap: 0;
    border: 4px solid #000; border-radius: 18px;
    box-shadow: 6px 6px 0 #000; cursor: pointer; transition: all .15s;
    background: linear-gradient(135deg, #2d0a3e 0%, #4a0a5e 50%, #1e0a28 100%);
    overflow: hidden; position: relative;
  }
  .arena-card:hover { transform: translate(-2px,-2px); box-shadow: 8px 8px 0 #000; }
  .arena-card:active { transform: translate(1px,1px); box-shadow: 3px 3px 0 #000; }
  .arena-doge-l { width: 130px; height: 130px; object-fit: contain; flex-shrink: 0; transform: scaleX(-1); margin-left: -10px; }
  .arena-doge-r { width: 130px; height: 130px; object-fit: contain; flex-shrink: 0; margin-right: -10px; }
  .arena-center { flex: 1; text-align: center; padding: 14px 8px; }
  .arena-tag {
    font-family: var(--fm); font-size: 8px; font-weight: 900; letter-spacing: 2px;
    color: var(--yel); background: rgba(255,230,0,.1);
    border: 2px solid rgba(255,230,0,.3);
    padding: 3px 10px; border-radius: 10px; display: inline-block;
  }
  .arena-title {
    font-family: var(--fd); font-size: 36px; font-weight: 900;
    letter-spacing: 8px; color: var(--pk);
    -webkit-text-stroke: 2px #000; paint-order: stroke fill;
    text-shadow: 3px 3px 0 #000, 0 0 20px rgba(255,45,155,.4);
    margin-top: 4px; line-height: 1;
  }
  .arena-desc {
    font-family: var(--fb); font-size: 10px; color: rgba(255,255,255,.5);
    margin-top: 4px;
  }
  .arena-feats {
    display: flex; gap: 4px; justify-content: center; flex-wrap: wrap; margin-top: 6px;
  }
  .arena-feats span {
    font-family: var(--fm); font-size: 7px; color: rgba(255,255,255,.6);
    background: rgba(255,255,255,.08); padding: 3px 8px; border-radius: 6px;
    border: 1px solid rgba(255,255,255,.1);
  }
  .arena-cta {
    margin-top: 8px; display: inline-block;
    font-family: var(--fd); font-size: 11px; font-weight: 900;
    letter-spacing: 3px; padding: 8px 24px; border-radius: 10px;
    border: 3px solid #000; box-shadow: 3px 3px 0 #000;
    background: var(--pk); color: #fff; transition: all .12s;
  }
  .arena-card:hover .arena-cta { box-shadow: 4px 4px 0 #000; }

  /* ═══ SQUAD (Pop-Art Grid) ═══ */
  .squad-section {
    padding: 20px 18px;
    background:
      radial-gradient(circle, rgba(0,255,255,.03) 1px, transparent 1px),
      linear-gradient(180deg, #08061a 0%, #0c0a22 100%);
    background-size: 18px 18px, 100% 100%;
    border-top: 3px solid rgba(0,255,255,.1);
  }
  .sq-title {
    font-family: var(--fd); font-size: 13px; font-weight: 900;
    letter-spacing: 4px; color: var(--yel); text-align: center;
    margin-bottom: 12px; text-shadow: 0 0 12px rgba(255,230,0,.3);
  }
  .squad-grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: 8px; max-width: 700px; margin: 0 auto;
  }
  .sq-card {
    display: flex; flex-direction: column; align-items: center; gap: 3px;
    background: linear-gradient(135deg, rgba(255,255,255,.04) 0%, rgba(255,255,255,.01) 100%);
    border: 2.5px solid rgba(255,255,255,.1); border-radius: 14px;
    padding: 12px 8px 10px; transition: all .15s; cursor: default;
    box-shadow: 3px 3px 0 rgba(0,0,0,.4);
  }
  .sq-card:hover {
    border-color: var(--ac);
    box-shadow: 0 0 16px color-mix(in srgb, var(--ac) 25%, transparent), 4px 4px 0 #000;
    transform: translateY(-3px);
  }
  .sq-avatar {
    width: 44px; height: 44px; border-radius: 50%; object-fit: cover;
    border: 2.5px solid var(--ac);
    box-shadow: 0 0 10px color-mix(in srgb, var(--ac) 30%, transparent);
  }
  .sq-name { font-family: var(--fd); font-size: 9px; font-weight: 900; letter-spacing: 1px; }
  .sq-role { font-family: var(--fm); font-size: 6px; color: rgba(255,255,255,.3); letter-spacing: .5px; text-align: center; }
  .sq-conf { font-family: var(--fd); font-size: 11px; font-weight: 900; color: rgba(255,255,255,.5); }

  /* ═══ QUICK NAV (Retro Game Buttons) ═══ */
  .quick-nav {
    display: flex; gap: 8px; padding: 14px 18px;
    justify-content: center; flex-wrap: wrap;
    background:
      repeating-linear-gradient(-45deg, transparent, transparent 30px, rgba(255,230,0,.02) 30px, rgba(255,230,0,.02) 60px),
      #0a0818;
    border-top: 3px solid rgba(255,230,0,.08);
  }
  .qn {
    display: flex; align-items: center; gap: 6px;
    font-family: var(--fd); font-size: 9px; font-weight: 900;
    letter-spacing: 2px; color: #fff;
    background: rgba(255,255,255,.05);
    border: 3px solid rgba(255,255,255,.12);
    box-shadow: 3px 3px 0 rgba(0,0,0,.5);
    padding: 8px 16px; border-radius: 10px; cursor: pointer;
    transition: all .12s; white-space: nowrap;
  }
  .qn:hover {
    color: var(--yel); border-color: var(--yel);
    box-shadow: 4px 4px 0 rgba(0,0,0,.6);
    transform: translate(-1px, -1px);
    background: rgba(255,230,0,.06);
  }
  .qn:active { transform: translate(1px, 1px); box-shadow: 1px 1px 0 #000; }
  .qn-icon { font-size: 14px; }
  .qn-badge {
    font-size: 8px; font-weight: 900;
    background: var(--cyan); color: #000;
    padding: 1px 6px; border-radius: 6px;
  }

  /* ═══ WALLET CTA ═══ */
  .wallet-cta {
    padding: 20px 18px 48px; text-align: center;
    background:
      radial-gradient(ellipse at center, rgba(255,230,0,.05) 0%, transparent 60%),
      linear-gradient(180deg, #0a0818 0%, #06040e 100%);
  }
  .wc-btn {
    font-family: var(--fd); font-size: 13px; font-weight: 900; letter-spacing: 4px;
    color: #000; background: var(--yel);
    border: 4px solid #000; box-shadow: 6px 6px 0 #000;
    padding: 16px 36px; border-radius: 16px; cursor: pointer;
    transition: all .15s; width: 100%; max-width: 420px;
    animation: ctaPulse 3s ease infinite;
  }
  .wc-btn:hover { transform: translate(-2px,-2px); box-shadow: 8px 8px 0 #000; }
  @keyframes ctaPulse {
    0%,100% { box-shadow: 6px 6px 0 #000; }
    50% { box-shadow: 6px 6px 0 #000, 0 0 30px rgba(255,230,0,.3); }
  }
  @keyframes boltFlash {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: .85; transform: scale(1.15); }
  }
  .wc-bolt { display: inline-block; animation: boltFlash 1.5s ease infinite; }
  .wc-connected {
    display: inline-flex; align-items: center; gap: 8px;
    font-family: var(--fm); font-size: 10px; font-weight: 700;
    color: var(--grn); letter-spacing: 1.5px;
    background: rgba(0,255,136,.05); border: 2px solid rgba(0,255,136,.2);
    padding: 10px 18px; border-radius: 12px;
  }
  .wc-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--grn); box-shadow: 0 0 10px var(--grn); }
  .wc-tier {
    font-size: 7px; background: rgba(255,200,0,.15);
    color: var(--gold); padding: 2px 6px; border-radius: 4px; letter-spacing: 1px;
  }

  /* ═══ RESPONSIVE ═══ */

  /* Tablet / medium */
  @media (max-width: 900px) {
    .flow-grid { flex-direction: column; align-items: center; gap: 0; }
    .fc { max-width: 400px; width: 100%; }
    .flow-connector { flex-direction: row; padding: 6px 0; }
    .fc-arrow { transform: rotate(90deg); }
    .arena-doge-l, .arena-doge-r { width: 100px; height: 100px; }
    .arena-title { font-size: 28px; letter-spacing: 5px; }
  }

  /* Mobile */
  @media (max-width: 640px) {
    .hero { min-height: 380px; padding: 16px 8px; }
    .title-line { font-size: 64px !important; letter-spacing: 5px !important; -webkit-text-stroke: 3px #000 !important; }
    .hero-badge { font-size: 7px; padding: 4px 10px; }
    .hero-ticker { padding: 6px 14px; gap: 6px; }
    .tick-price { font-size: 12px; }
    .tick-label { font-size: 7px; }
    /* Scale hero decorations */
    .d-burst-tl, .d-burst-tr, .d-burst-bl { width: 200px !important; }
    .d-cloud-l, .d-cloud-r { width: 180px !important; }
    .d-halftone { width: 160px !important; }
    .dg { transform: scale(.55) !important; }
    .s { transform: scale(.5) !important; }
    /* Stats */
    .stats-strip { padding: 10px 12px; }
    .ss-item { padding: 0 12px; }
    .ss-v { font-size: 16px; }
    /* Flow */
    .flow-section { padding: 16px 12px; }
    .fc { padding: 12px 10px 10px; }
    .fc-doge { width: 60px; height: 60px; }
    .fc-name { font-size: 14px; letter-spacing: 2px; }
    /* Arena */
    .arena-section { padding: 0 12px 12px; }
    .arena-doge-l, .arena-doge-r { width: 80px; height: 80px; }
    .arena-title { font-size: 24px; letter-spacing: 4px; }
    .arena-cta { font-size: 9px; padding: 7px 16px; }
    /* Squad */
    .squad-grid { grid-template-columns: repeat(3, 1fr); gap: 6px; }
    .sq-avatar { width: 36px; height: 36px; }
    /* Quick Nav */
    .quick-nav { gap: 6px; padding: 10px 12px; }
    .qn { font-size: 8px; padding: 6px 12px; }
    /* Wallet */
    .wc-btn { font-size: 11px; padding: 14px 20px; letter-spacing: 2px; }
  }

  /* Small mobile */
  @media (max-width: 400px) {
    .title-line { font-size: 48px !important; letter-spacing: 3px !important; }
    .squad-grid { grid-template-columns: repeat(2, 1fr); }
    .arena-doge-l { display: none; }
    .arena-doge-r { display: none; }
  }
</style>
