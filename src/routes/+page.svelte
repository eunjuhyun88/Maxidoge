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
  <!-- ═══ HERO: MEME ARCADE EXPLOSION ═══ -->
  <section class="hero">
    <!-- Doge stickers: dynamic "explosion" composition -->
    <img class="hd stk-bull" src="/blockparty/f5-doge-bull.png" alt="" />
    <img class="hd stk-fire" src="/blockparty/f5-doge-fire.png" alt="" />
    <img class="hd stk-muscle" src="/blockparty/f5-doge-muscle.png" alt="" />
    <img class="hd stk-chart" src="/blockparty/f5-doge-chart.png" alt="" />
    <img class="hd stk-excited" src="/blockparty/f5-doge-excited.png" alt="" />
    <img class="hd stk-shield" src="/blockparty/f5-doge-shield.png" alt="" />
    <img class="hd stk-happy" src="/blockparty/f5-doge-happy.png" alt="" />
    <img class="hd stk-angry" src="/blockparty/f5-doge-angry.png" alt="" />

    <!-- Deco accents -->
    <img class="hd dec-stars" src="/blockparty/deco-stars.png" alt="" />
    <img class="hd dec-sparkle" src="/blockparty/deco-sparkles.png" alt="" />
    <img class="hd dec-pow" src="/blockparty/deco-pow-doge.png" alt="" />

    <!-- Floating meme text -->
    <span class="meme mt-wow">WOW</span>
    <span class="meme mt-wagmi">WAGMI 🚀</span>
    <span class="meme mt-gg">GG</span>
    <span class="meme mt-lfg">LFG!!</span>
    <span class="meme mt-moon">TO THE MOON</span>

    <!-- Speech bubble -->
    <div class="speech sb-1">나 부자됨 ㅋㅋ</div>
    <div class="speech sb-2">such profit!!</div>

    <!-- Center content -->
    <div class="hero-content">
      <h1 class="hero-title">
        <span class="tl">MAXI</span>
        <span class="tl">DOGE</span>
      </h1>
      <p class="hero-meme-sub">such AI. very trade. much profit. wow.</p>
      <div class="hero-badge">⚡ AI AGENT TRADING PLATFORM ⚡</div>
      <div class="hero-ticker">
        <div class="tick">
          <span class="tick-sym">₿</span>
          <span class="tick-name">BTC</span>
          <span class="tick-val">${btcPrice.toLocaleString()}</span>
        </div>
        <span class="tick-div">|</span>
        <div class="tick">
          <span class="tick-sym eth">Ξ</span>
          <span class="tick-name">ETH</span>
          <span class="tick-val">${ethPrice.toLocaleString()}</span>
        </div>
        <span class="tick-div">|</span>
        <div class="tick">
          <span class="tick-sym sol">◎</span>
          <span class="tick-name">SOL</span>
          <span class="tick-val">${solPrice.toLocaleString()}</span>
        </div>
      </div>
    </div>

    <!-- Scrolling meme marquee -->
    <div class="marquee">
      <div class="marquee-track">
        <span>🐕 DOGE TO THE MOON 🚀 &nbsp;&nbsp; WAGMI 🔥 &nbsp;&nbsp; SUCH PROFIT 💎 &nbsp;&nbsp; DIAMOND HANDS 🙌 &nbsp;&nbsp; MUCH WOW 🌙 &nbsp;&nbsp; LFG 🐕 &nbsp;&nbsp; HODL 💪 &nbsp;&nbsp; WEN LAMBO 🏎️ &nbsp;&nbsp;</span>
        <span>🐕 DOGE TO THE MOON 🚀 &nbsp;&nbsp; WAGMI 🔥 &nbsp;&nbsp; SUCH PROFIT 💎 &nbsp;&nbsp; DIAMOND HANDS 🙌 &nbsp;&nbsp; MUCH WOW 🌙 &nbsp;&nbsp; LFG 🐕 &nbsp;&nbsp; HODL 💪 &nbsp;&nbsp; WEN LAMBO 🏎️ &nbsp;&nbsp;</span>
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

  <!-- ═══ 3-STEP FLOW ═══ -->
  <section class="flow-section">
    <h3 class="section-head">⚡ 부자되는 3단계 ⚡</h3>
    <div class="flow-grid">
      <button class="fc fc-1" on:click={enterTerminal}>
        <div class="fc-num">01</div>
        <img src="/blockparty/f5-doge-cross.png" alt="" class="fc-doge" />
        <h2 class="fc-name">WAR ROOM</h2>
        <p class="fc-desc">7마리 AI 개들이 시장 물어뜯는 중 🐕</p>
        <div class="fc-agents">
          {#each AGDEFS.slice(0, 5) as ag}
            <img src={ag.img.def} alt="" class="fc-ag" style="border-color:{ag.color}" />
          {/each}
        </div>
        <div class="fc-cta" style="background:var(--cyan);color:#000">ENTER →</div>
      </button>

      <div class="flow-conn">
        <span class="conn-arrow">→</span>
        <span class="conn-label">시그널 생성</span>
      </div>

      <button class="fc fc-2" on:click={() => goto('/signals')}>
        <div class="fc-num">02</div>
        <img src="/blockparty/f5-doge-chart.png" alt="" class="fc-doge" />
        <h2 class="fc-name">SIGNALS</h2>
        <p class="fc-desc">AI가 돈 벌어주는 시그널 💰</p>
        <div class="fc-preview">
          <span class="fp-long">▲ LONG BTC 82%</span>
          <span class="fp-short">▼ SHORT ETH 75%</span>
        </div>
        {#if trackedSigs > 0}
          <div class="fc-badge">📌 {trackedSigs} TRACKED</div>
        {/if}
        <div class="fc-cta" style="background:var(--pk);color:#fff">SIGNALS →</div>
      </button>

      <div class="flow-conn">
        <span class="conn-arrow">→</span>
        <span class="conn-label">카피트레이드</span>
      </div>

      <button class="fc fc-3" on:click={enterTerminal}>
        <div class="fc-num">03</div>
        <img src="/blockparty/f5-doge-fire.png" alt="" class="fc-doge" />
        <h2 class="fc-name">COPY TRADE</h2>
        <p class="fc-desc">원클릭으로 부자되기 (아마도) 🚀</p>
        {#if openPositions > 0}
          <div class="fc-badge fc-badge-grn">{openPositions} OPEN</div>
        {/if}
        <div class="fc-cta" style="background:var(--grn);color:#000">TRADE →</div>
      </button>
    </div>
  </section>

  <!-- ═══ ARENA BANNER ═══ -->
  <section class="arena-section">
    <button class="arena-card" on:click={enterArena}>
      <img src="/blockparty/f5-doge-muscle.png" alt="" class="arena-doge-l" />
      <div class="arena-center">
        <span class="arena-tag">🎮 BOSS FIGHT - 들어오면 못나감</span>
        <h2 class="arena-title">ARENA</h2>
        <p class="arena-desc">7마리 AI 개 vs 너 ⚔️ 살아남아봐</p>
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

  <!-- ═══ AGENT SQUAD ═══ -->
  <section class="squad-section">
    <h3 class="section-head">🐕 돈버는개들 (THE SQUAD)</h3>
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

  <!-- ═══ QUICK NAV ═══ -->
  <section class="quick-nav">
    <h3 class="section-head qn-head">🕹️ SELECT YOUR GAME</h3>
    <div class="qn-grid">
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
    </div>
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
  /* ═══ BASE ═══ */
  .home {
    width: 100%; height: 100%;
    overflow-y: auto; overflow-x: hidden;
    background: #060d1a;
    display: flex; flex-direction: column;
  }
  .home::-webkit-scrollbar { width: 4px; }
  .home::-webkit-scrollbar-thumb { background: var(--yel); border-radius: 4px; }

  /* ═══ HERO: MEME ARCADE ═══ */
  .hero {
    position: relative;
    overflow: hidden;
    display: flex; align-items: center; justify-content: center;
    text-align: center;
    min-height: 580px;
    padding: 60px 20px 50px;
    background: linear-gradient(160deg, #0a1628 0%, #0f1e3a 30%, #162044 60%, #1a2650 100%);
  }

  /* Manga speed lines */
  .hero::before {
    content: '';
    position: absolute;
    top: 50%; left: 50%;
    width: 200%; height: 200%;
    transform: translate(-50%, -50%);
    background: repeating-conic-gradient(
      transparent 0deg 4.5deg,
      rgba(255,225,0,.025) 4.5deg 5.5deg
    );
    z-index: 0;
    pointer-events: none;
  }

  /* Yellow glow behind title */
  .hero::after {
    content: '';
    position: absolute;
    top: 45%; left: 50%;
    transform: translate(-50%, -50%);
    width: 500px; height: 350px;
    background: radial-gradient(ellipse, rgba(255,225,0,.08) 0%, transparent 65%);
    z-index: 0;
    pointer-events: none;
  }

  /* ═══ HERO DECORATIONS ═══ */
  .hd {
    position: absolute;
    object-fit: contain;
    pointer-events: none;
    filter: drop-shadow(3px 4px 6px rgba(0,0,0,.5));
  }

  /* Sticker positions: explosion composition */
  .stk-bull {
    top: 3%; left: 1%;
    width: 165px; z-index: 2;
    transform: rotate(-8deg);
    animation: bounce 3s ease-in-out infinite;
  }
  .stk-fire {
    top: 1%; right: 0;
    width: 170px; z-index: 2;
    transform: rotate(6deg);
    animation: bounce 3.5s ease-in-out infinite .5s;
  }
  .stk-muscle {
    bottom: 12%; left: -2%;
    width: 185px; z-index: 2;
    transform: scaleX(-1);
    animation: bounce 4s ease-in-out infinite 1s;
  }
  .stk-chart {
    top: 32%; right: -2%;
    width: 175px; z-index: 2;
    transform: rotate(4deg);
    animation: bounce 3.8s ease-in-out infinite 1.5s;
  }
  .stk-excited {
    bottom: 10%; left: 50%;
    transform: translateX(-120%);
    width: 140px; z-index: 2;
    animation: bounce 3.2s ease-in-out infinite 2s;
  }
  .stk-shield {
    bottom: 8%; right: 2%;
    width: 145px; z-index: 2;
    transform: rotate(6deg);
    animation: bounce 3.6s ease-in-out infinite .8s;
  }
  .stk-happy {
    top: 55%; left: 3%;
    width: 130px; z-index: 2;
    transform: rotate(-6deg);
    animation: bounce 4.2s ease-in-out infinite 1.2s;
  }
  .stk-angry {
    top: 8%; right: 20%;
    width: 120px; z-index: 2;
    transform: rotate(10deg);
    animation: bounce 3.4s ease-in-out infinite 2.5s;
  }

  /* Deco accents */
  .dec-stars {
    top: 5%; left: 22%;
    width: 75px; z-index: 3;
    animation: spin-slow 8s linear infinite;
  }
  .dec-sparkle {
    bottom: 25%; right: 18%;
    width: 65px; z-index: 3;
    animation: spin-slow 10s linear infinite reverse;
  }
  .dec-pow {
    top: 12%; left: 55%;
    width: 110px; z-index: 3;
    transform: translateX(-50%) rotate(-8deg);
    animation: pow-pulse 2s ease-in-out infinite;
  }

  /* ═══ FLOATING MEME TEXT ═══ */
  .meme {
    position: absolute;
    font-family: 'Comic Sans MS', 'Comic Neue', cursive, sans-serif;
    font-weight: 900;
    pointer-events: none;
    z-index: 4;
    text-shadow: 3px 3px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000;
  }
  .mt-wow {
    top: 6%; left: 15%;
    font-size: 36px; color: #ffe100;
    transform: rotate(-15deg);
    animation: wiggle 2s ease-in-out infinite;
  }
  .mt-wagmi {
    top: 10%; right: 6%;
    font-size: 22px; color: #ff69b4;
    transform: rotate(10deg);
    animation: wiggle 2.5s ease-in-out infinite .5s;
  }
  .mt-gg {
    bottom: 25%; right: 10%;
    font-size: 32px; color: #00e5ff;
    transform: rotate(-5deg);
    animation: wiggle 1.8s ease-in-out infinite 1s;
  }
  .mt-lfg {
    bottom: 18%; left: 12%;
    font-size: 20px; color: #00ff88;
    transform: rotate(8deg);
    animation: wiggle 2.2s ease-in-out infinite 1.5s;
  }
  .mt-moon {
    top: 42%; right: 3%;
    font-size: 12px; color: rgba(255,255,255,.5);
    transform: rotate(90deg);
    transform-origin: right center;
    letter-spacing: 4px;
  }

  /* ═══ SPEECH BUBBLES ═══ */
  .speech {
    position: absolute;
    background: #fff;
    color: #000;
    font-family: 'Comic Sans MS', 'Comic Neue', cursive, sans-serif;
    font-weight: 900;
    font-size: 13px;
    padding: 8px 14px;
    border: 3px solid #000;
    border-radius: 18px;
    z-index: 5;
    box-shadow: 3px 3px 0 #000;
    white-space: nowrap;
  }
  .speech::after {
    content: '';
    position: absolute;
    bottom: -14px; left: 18px;
    width: 0; height: 0;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-top: 14px solid #000;
  }
  .speech::before {
    content: '';
    position: absolute;
    bottom: -10px; left: 20px;
    width: 0; height: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-top: 11px solid #fff;
    z-index: 1;
  }
  .sb-1 {
    bottom: 38%; left: 18%;
    transform: rotate(-3deg);
    animation: speech-bob 3s ease-in-out infinite;
  }
  .sb-2 {
    top: 28%; right: 22%;
    font-size: 11px;
    transform: rotate(4deg);
    animation: speech-bob 3.5s ease-in-out infinite 1s;
  }

  /* ═══ HERO CONTENT ═══ */
  .hero-content {
    position: relative; z-index: 10;
    display: flex; flex-direction: column; align-items: center;
  }
  .hero-title {
    font-family: var(--fd);
    display: flex; flex-direction: column; align-items: center;
    line-height: .82;
    margin-bottom: 8px;
    transform: rotate(-2deg);
    cursor: default;
    transition: transform .3s;
  }
  .hero-title:hover {
    animation: title-shake .4s ease;
  }
  .tl {
    font-size: 130px;
    font-weight: 900;
    letter-spacing: 12px;
    color: #ffe100;
    -webkit-text-stroke: 5px #000;
    paint-order: stroke fill;
    text-shadow:
      0 2px 0 #c4a000,
      0 4px 0 #a08200,
      0 6px 0 #7c6400,
      0 8px 0 #584600,
      0 10px 0 #342800,
      0 10px 25px rgba(0,0,0,.6);
    filter: drop-shadow(0 0 30px rgba(255,225,0,.2));
  }

  .hero-meme-sub {
    font-family: 'Comic Sans MS', 'Comic Neue', cursive, sans-serif;
    font-size: 15px;
    font-weight: 900;
    color: rgba(255,255,255,.7);
    letter-spacing: 2px;
    margin-bottom: 10px;
    text-shadow: 2px 2px 0 rgba(0,0,0,.8);
    transform: rotate(-2deg);
  }

  .hero-badge {
    display: inline-block;
    font-family: var(--fm);
    font-size: 10px; font-weight: 900;
    letter-spacing: 4px;
    color: #000; background: var(--yel);
    border: 3px solid #000;
    box-shadow: 4px 4px 0 #000;
    padding: 6px 22px;
    border-radius: 24px;
    margin-bottom: 12px;
    transform: rotate(-2deg);
  }

  .hero-ticker {
    display: inline-flex; align-items: center; gap: 12px;
    background: rgba(0,0,0,.65);
    border: 2px solid rgba(255,225,0,.15);
    border-radius: 30px;
    padding: 8px 24px;
    backdrop-filter: blur(10px);
    transform: rotate(-2deg);
  }
  .tick { display: flex; align-items: center; gap: 5px; }
  .tick-sym { font-size: 16px; color: #f7931a; }
  .tick-sym.eth { color: #627eea; }
  .tick-sym.sol { color: #9945ff; }
  .tick-name { font-family: var(--fm); font-size: 9px; font-weight: 700; color: rgba(255,255,255,.5); letter-spacing: 1px; }
  .tick-val { font-family: var(--fd); font-size: 15px; font-weight: 900; color: var(--yel); }
  .tick-div { color: rgba(255,255,255,.2); font-size: 12px; }

  /* ═══ MARQUEE ═══ */
  .marquee {
    position: absolute;
    bottom: 0; left: 0;
    width: 100%;
    overflow: hidden;
    background: rgba(0,0,0,.7);
    border-top: 2px solid var(--yel);
    z-index: 8;
  }
  .marquee-track {
    display: flex;
    white-space: nowrap;
    animation: marquee-scroll 25s linear infinite;
  }
  .marquee-track span {
    font-family: var(--fm);
    font-size: 11px; font-weight: 900;
    letter-spacing: 2px;
    color: var(--yel);
    padding: 7px 0;
    flex-shrink: 0;
  }

  /* ═══ ANIMATIONS ═══ */
  @keyframes bounce {
    0%, 100% { transform: translateY(0) rotate(var(--r, 0deg)); }
    50% { transform: translateY(-8px) rotate(var(--r, 0deg)); }
  }
  @keyframes wiggle {
    0%, 100% { transform: rotate(var(--base-rot, 0deg)) scale(1); }
    25% { transform: rotate(calc(var(--base-rot, 0deg) - 3deg)) scale(1.05); }
    75% { transform: rotate(calc(var(--base-rot, 0deg) + 3deg)) scale(0.95); }
  }
  @keyframes spin-slow {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes pow-pulse {
    0%, 100% { transform: translateX(-50%) rotate(-8deg) scale(1); }
    50% { transform: translateX(-50%) rotate(-8deg) scale(1.1); }
  }
  @keyframes speech-bob {
    0%, 100% { transform: translateY(0) rotate(var(--sb-rot, -3deg)); }
    50% { transform: translateY(-5px) rotate(var(--sb-rot, -3deg)); }
  }
  @keyframes title-shake {
    0%, 100% { transform: rotate(-2deg); }
    20% { transform: rotate(-4deg) translateX(-3px); }
    40% { transform: rotate(0deg) translateX(3px); }
    60% { transform: rotate(-3deg) translateX(-2px); }
    80% { transform: rotate(-1deg) translateX(2px); }
  }
  @keyframes marquee-scroll {
    from { transform: translateX(0); }
    to { transform: translateX(-50%); }
  }

  /* ═══ STATS STRIP ═══ */
  .stats-strip {
    display: flex; align-items: center; justify-content: center;
    gap: 0; padding: 14px 24px;
    background: #060d1a;
    border-top: 3px solid rgba(255,225,0,.2);
    border-bottom: 3px solid rgba(255,225,0,.2);
  }
  .ss-item { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 0 24px; }
  .ss-sep { width: 1px; height: 28px; background: rgba(255,255,255,.08); flex-shrink: 0; }
  .ss-v { font-family: var(--fd); font-size: 20px; font-weight: 900; color: #fff; letter-spacing: 1px; }
  .ss-streak { color: var(--ora); }
  .ss-l { font-family: var(--fm); font-size: 7px; font-weight: 700; color: rgba(255,255,255,.3); letter-spacing: 2px; }

  /* ═══ SECTION HEAD ═══ */
  .section-head {
    font-family: var(--fd); font-size: 15px; font-weight: 900;
    letter-spacing: 5px; color: var(--yel); text-align: center;
    margin-bottom: 18px;
    text-shadow: 0 0 20px rgba(255,225,0,.25);
  }

  /* ═══ 3-STEP FLOW ═══ */
  .flow-section {
    padding: 28px 18px 24px;
    background: linear-gradient(180deg, #0a1222 0%, #0e1830 100%);
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
  .fc-1 { background: linear-gradient(135deg, #081830 0%, #0d2a50 100%); border-color: rgba(0,255,255,.25); }
  .fc-2 { background: linear-gradient(135deg, #200a28 0%, #380a50 100%); border-color: rgba(255,45,155,.25); }
  .fc-3 { background: linear-gradient(135deg, #0a2010 0%, #0a3818 100%); border-color: rgba(0,255,136,.25); }

  .fc-num {
    font-family: var(--fd); font-size: 32px; font-weight: 900;
    color: rgba(255,255,255,.05); position: absolute; top: 4px; right: 10px;
    letter-spacing: -2px; line-height: 1;
  }
  .fc-doge { width: 80px; height: 80px; object-fit: contain; filter: drop-shadow(2px 2px 4px rgba(0,0,0,.4)); }
  .fc-name {
    font-family: var(--fd); font-size: 16px; font-weight: 900;
    letter-spacing: 3px; line-height: 1; color: #fff;
    text-shadow: 2px 2px 0 #000;
  }
  .fc-desc { font-family: var(--fb); font-size: 10px; color: rgba(255,255,255,.5); line-height: 1.4; }

  .fc-agents { display: flex; gap: 4px; justify-content: center; }
  .fc-ag {
    width: 26px; height: 26px; border-radius: 50%; object-fit: cover;
    border: 2px solid; box-shadow: 0 0 6px rgba(255,255,255,.1);
  }

  .fc-preview { display: flex; flex-direction: column; gap: 2px; }
  .fp-long {
    font-family: var(--fm); font-size: 8px; font-weight: 900;
    color: var(--grn); background: rgba(0,255,136,.06);
    border: 1px solid rgba(0,255,136,.2); padding: 2px 8px; border-radius: 4px;
  }
  .fp-short {
    font-family: var(--fm); font-size: 8px; font-weight: 900;
    color: var(--red); background: rgba(255,45,85,.06);
    border: 1px solid rgba(255,45,85,.2); padding: 2px 8px; border-radius: 4px;
  }

  .fc-badge {
    font-family: var(--fm); font-size: 7px; font-weight: 900; letter-spacing: 1px;
    color: var(--ora); background: rgba(255,140,59,.08);
    border: 1px solid rgba(255,140,59,.25); padding: 2px 8px; border-radius: 6px;
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

  .flow-conn {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 2px; padding: 0 8px; flex-shrink: 0;
  }
  .conn-arrow {
    font-family: var(--fd); font-size: 20px; font-weight: 900; color: var(--yel);
    text-shadow: 0 0 10px rgba(255,225,0,.3);
  }
  .conn-label {
    font-family: var(--fm); font-size: 6px; font-weight: 900;
    letter-spacing: 1px; color: rgba(255,225,0,.4); white-space: nowrap;
  }

  /* ═══ ARENA ═══ */
  .arena-section {
    padding: 20px 18px;
    background: linear-gradient(180deg, #0e1830 0%, #14203a 50%, #0e1830 100%);
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
    font-family: var(--fm); font-size: 8px; font-weight: 900; letter-spacing: 1px;
    color: var(--yel); background: rgba(255,225,0,.08);
    border: 2px solid rgba(255,225,0,.2);
    padding: 3px 10px; border-radius: 10px; display: inline-block;
  }
  .arena-title {
    font-family: var(--fd); font-size: 36px; font-weight: 900;
    letter-spacing: 8px; color: var(--pk);
    -webkit-text-stroke: 2px #000; paint-order: stroke fill;
    text-shadow: 3px 3px 0 #000, 0 0 20px rgba(255,45,155,.3);
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
    font-family: var(--fm); font-size: 7px; color: rgba(255,255,255,.5);
    background: rgba(255,255,255,.05); padding: 3px 8px; border-radius: 6px;
    border: 1px solid rgba(255,255,255,.08);
  }
  .arena-cta {
    margin-top: 8px; display: inline-block;
    font-family: var(--fd); font-size: 11px; font-weight: 900;
    letter-spacing: 3px; padding: 8px 24px; border-radius: 10px;
    border: 3px solid #000; box-shadow: 3px 3px 0 #000;
    background: var(--pk); color: #fff; transition: all .12s;
  }
  .arena-card:hover .arena-cta { box-shadow: 4px 4px 0 #000; }

  /* ═══ SQUAD ═══ */
  .squad-section {
    padding: 20px 18px;
    background: linear-gradient(180deg, #0a1222 0%, #0e1630 100%);
    border-top: 2px solid rgba(0,255,255,.06);
  }
  .squad-grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: 8px; max-width: 700px; margin: 0 auto;
  }
  .sq-card {
    display: flex; flex-direction: column; align-items: center; gap: 3px;
    background: rgba(255,255,255,.02);
    border: 2.5px solid rgba(255,255,255,.07); border-radius: 14px;
    padding: 12px 8px 10px; transition: all .15s; cursor: default;
    box-shadow: 3px 3px 0 rgba(0,0,0,.4);
  }
  .sq-card:hover {
    border-color: var(--ac);
    box-shadow: 0 0 14px color-mix(in srgb, var(--ac) 20%, transparent), 4px 4px 0 #000;
    transform: translateY(-3px);
  }
  .sq-avatar {
    width: 44px; height: 44px; border-radius: 50%; object-fit: cover;
    border: 2.5px solid var(--ac);
    box-shadow: 0 0 8px color-mix(in srgb, var(--ac) 25%, transparent);
  }
  .sq-name { font-family: var(--fd); font-size: 9px; font-weight: 900; letter-spacing: 1px; }
  .sq-role { font-family: var(--fm); font-size: 6px; color: rgba(255,255,255,.25); letter-spacing: .5px; text-align: center; }
  .sq-conf { font-family: var(--fd); font-size: 11px; font-weight: 900; color: rgba(255,255,255,.4); }

  /* ═══ QUICK NAV ═══ */
  .quick-nav {
    padding: 18px 18px 14px;
    background: #080e1a;
    border-top: 2px solid rgba(255,225,0,.06);
  }
  .qn-head { margin-bottom: 12px; font-size: 12px; letter-spacing: 4px; }
  .qn-grid {
    display: flex; gap: 8px;
    justify-content: center; flex-wrap: wrap;
  }
  .qn {
    display: flex; align-items: center; gap: 6px;
    font-family: var(--fd); font-size: 9px; font-weight: 900;
    letter-spacing: 2px; color: #fff;
    background: rgba(255,255,255,.03);
    border: 3px solid rgba(255,255,255,.08);
    box-shadow: 3px 3px 0 rgba(0,0,0,.5);
    padding: 8px 16px; border-radius: 10px; cursor: pointer;
    transition: all .12s; white-space: nowrap;
  }
  .qn:hover {
    color: var(--yel); border-color: var(--yel);
    box-shadow: 4px 4px 0 rgba(0,0,0,.6);
    transform: translate(-1px, -1px);
    background: rgba(255,225,0,.04);
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
    padding: 24px 18px 52px; text-align: center;
    background: linear-gradient(180deg, #080e1a 0%, #040810 100%);
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
    50% { box-shadow: 6px 6px 0 #000, 0 0 30px rgba(255,225,0,.25); }
  }
  .wc-bolt { display: inline-block; animation: boltFlash 1.5s ease infinite; }
  @keyframes boltFlash {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: .85; transform: scale(1.15); }
  }
  .wc-connected {
    display: inline-flex; align-items: center; gap: 8px;
    font-family: var(--fm); font-size: 10px; font-weight: 700;
    color: var(--grn); letter-spacing: 1.5px;
    background: rgba(0,255,136,.04); border: 2px solid rgba(0,255,136,.15);
    padding: 10px 18px; border-radius: 12px;
  }
  .wc-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--grn); box-shadow: 0 0 10px var(--grn); }
  .wc-tier {
    font-size: 7px; background: rgba(255,200,0,.12);
    color: var(--gold); padding: 2px 6px; border-radius: 4px; letter-spacing: 1px;
  }

  /* ═══ RESPONSIVE ═══ */

  @media (max-width: 900px) {
    .flow-grid { flex-direction: column; align-items: center; gap: 0; }
    .fc { max-width: 400px; width: 100%; }
    .flow-conn { flex-direction: row; padding: 6px 0; }
    .conn-arrow { transform: rotate(90deg); }
    .arena-doge-l, .arena-doge-r { width: 100px; height: 100px; }
    .arena-title { font-size: 28px; letter-spacing: 5px; }
  }

  @media (max-width: 640px) {
    .hero { min-height: 440px; padding: 40px 10px 40px; }
    .tl { font-size: 72px !important; letter-spacing: 6px !important; -webkit-text-stroke: 4px #000 !important; }
    .hero-meme-sub { font-size: 11px; }
    .hero-badge { font-size: 7px; padding: 4px 12px; letter-spacing: 2px; }
    .hero-ticker { padding: 6px 14px; gap: 6px; }
    .tick-val { font-size: 12px; }
    .tick-name { font-size: 7px; }
    /* Stickers scale down */
    .stk-bull, .stk-fire { width: 110px !important; }
    .stk-muscle, .stk-chart { width: 120px !important; }
    .stk-excited, .stk-shield { width: 95px !important; }
    .stk-happy { width: 85px !important; }
    .stk-angry { width: 80px !important; }
    .dec-pow { width: 75px !important; }
    /* Meme text smaller */
    .mt-wow { font-size: 24px !important; }
    .mt-wagmi { font-size: 16px !important; }
    .mt-gg { font-size: 22px !important; }
    .mt-lfg { font-size: 14px !important; }
    .mt-moon { display: none; }
    /* Speech bubbles */
    .sb-2 { display: none; }
    .speech { font-size: 11px; padding: 6px 10px; }
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
    .qn-grid { gap: 6px; }
    .qn { font-size: 8px; padding: 6px 12px; }
    /* Wallet */
    .wc-btn { font-size: 11px; padding: 14px 20px; letter-spacing: 2px; }
  }

  @media (max-width: 400px) {
    .tl { font-size: 52px !important; letter-spacing: 3px !important; }
    .hero-meme-sub { font-size: 9px; letter-spacing: 1px; }
    .squad-grid { grid-template-columns: repeat(2, 1fr); }
    .arena-doge-l, .arena-doge-r { display: none; }
    .stk-bull, .stk-fire, .stk-happy, .stk-angry { display: none; }
    .mt-wagmi, .mt-gg { display: none; }
    .sb-1 { display: none; }
  }
</style>
