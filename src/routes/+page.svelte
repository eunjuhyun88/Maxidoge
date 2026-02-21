<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { gameState } from '$lib/stores/gameState';
  import { AGDEFS } from '$lib/data/agents';
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

  const FEATURES = [
    {
      label: 'WAR ROOM',
      sub: 'TERMINAL',
      desc: '7마리 AI 개들이 시장 물어뜯는 중',
      img: '/blockparty/f5-doge-chart.png',
      path: '/terminal'
    },
    {
      label: 'BOSS FIGHT',
      sub: 'ARENA',
      desc: 'AI 7마리 vs 너 — 살아남아봐',
      img: '/blockparty/f5-doge-muscle.png',
      path: '/arena'
    },
    {
      label: 'AI SIGNALS',
      sub: 'SIGNALS',
      desc: 'AI가 돈 벌어주는 시그널',
      img: '/blockparty/f5-doge-fire.png',
      path: '/signals'
    },
    {
      label: 'LIVE FEED',
      sub: 'LIVE',
      desc: '실시간 시장 + AI 분석 스트림',
      img: '/blockparty/f5-doge-excited.png',
      path: '/signals?view=live'
    },
  ];
</script>

<div class="home">
  <!-- ═══ HERO: STIFF-STYLE TWO-COLUMN ═══ -->
  <section class="hero">
    <!-- Left: Big stacked text -->
    <div class="hero-left">
      <div class="hero-text-stack">
        <span class="ht-line ht-sm">WE MAKE</span>
        <span class="ht-line ht-red ht-xl">TRADES</span>
        <span class="ht-line ht-md">THAT LOOK</span>
        <span class="ht-line ht-md">DAMN</span>
        <div class="ht-good-row">
          <span class="ht-line ht-xxl">GO</span>
          <img src="/blockparty/f5-doge-bull.png" alt="doge" class="hero-mascot" />
          <span class="ht-line ht-xxl">OD</span>
        </div>
      </div>
    </div>

    <!-- Vertical divider with repeating text -->
    <div class="hero-divider">
      <span class="vt">FEATURES</span>
      <span class="vt">FEATURES</span>
      <span class="vt">FEATURES</span>
      <span class="vt">FEATURES</span>
      <span class="vt">FEATURES</span>
      <span class="vt">FEATURES</span>
      <span class="vt">FEATURES</span>
      <span class="vt">FEATURES</span>
    </div>

    <!-- Right: Feature cards (portfolio style) -->
    <div class="hero-right">
      {#each FEATURES as feat}
        <button class="feat-card" on:click={() => goto(feat.path)}>
          <div class="feat-img-wrap">
            <img src={feat.img} alt="" class="feat-img" />
          </div>
          <div class="feat-info">
            <span class="feat-sub">{feat.sub}</span>
            <h3 class="feat-label">{feat.label}</h3>
          </div>
        </button>
      {/each}
      <button class="feat-view-all" on:click={enterTerminal}>
        VIEW ALL FEATURES <span class="feat-arrow">↗</span>
      </button>
    </div>
  </section>

  <!-- ═══ ABOUT / DESCRIPTION (Stiff style) ═══ -->
  <section class="about">
    <!-- Left: Rotating badge -->
    <div class="about-badge-area">
      <div class="rotating-badge">
        <svg viewBox="0 0 200 200" class="badge-svg">
          <defs>
            <path id="circlePath" d="M 100, 100 m -75, 0 a 75,75 0 1,1 150,0 a 75,75 0 1,1 -150,0" />
          </defs>
          <text>
            <textPath href="#circlePath" class="badge-text">
              MUCH WOW ✦ MUCH WOW ✦ MUCH WOW ✦ MUCH WOW ✦
            </textPath>
          </text>
        </svg>
        <img src="/blockparty/f5-doge-face.png" alt="" class="badge-face" />
      </div>

      <!-- Description text with mixed typography -->
      <div class="about-text">
        <p>
          <strong class="at-bold">FOR</strong>
          <em class="at-italic">every</em>
          <strong class="at-bold at-big">DEGEN,</strong>
          <span class="at-reg">WE'VE BEEN</span>
          <strong class="at-bold at-big">BUILDING,</strong>
          <em class="at-italic">training</em>
          <strong class="at-bold at-big">AI DOGS,</strong>
          <span class="at-reg">SCANNING</span>
          <strong class="at-bold at-big">MARKETS,</strong>
          <span class="at-sm">GENERATING</span>
          <strong class="at-bold at-big">SIGNALS,</strong>
          <span class="at-reg">AND</span>
          <strong class="at-bold at-big">CRAFTING</strong>
          <em class="at-italic">relatable</em>
          <span class="at-reg">MEMES FOR</span>
          <strong class="at-bold at-biggest">BIG</strong>
          <span class="at-sm">(AND TINY)</span>
          <strong class="at-bold at-biggest">GAINS.</strong>
        </p>
      </div>
    </div>

    <div class="about-sub">WE AIN'T NO ORDINARY DOGS.</div>
  </section>

  <!-- ═══ AGENT SQUAD (cream bg section) ═══ -->
  <section class="squad">
    <div class="squad-header">
      <h2 class="squad-title">
        <span class="sq-dark">THE</span>
        <span class="sq-red">SQUAD</span>
      </h2>
      <p class="squad-sub">7 AI dogs that eat the market alive</p>
    </div>
    <div class="squad-grid">
      {#each AGDEFS as ag}
        <div class="sq-card" style="--ac:{ag.color}">
          <img src={ag.img.def} alt={ag.name} class="sq-avatar" />
          <div class="sq-info">
            <span class="sq-name" style="color:var(--ac)">{ag.name}</span>
            <span class="sq-role">{ag.role}</span>
          </div>
          <div class="sq-conf">{ag.conf}%</div>
        </div>
      {/each}
    </div>
  </section>

  <!-- ═══ IN YOUR FEED — Arena + Ticker ═══ -->
  <section class="feed">
    <div class="feed-left">
      <div class="feed-text-stack">
        <span class="ft-line ft-dark">IN YOUR</span>
        <span class="ft-line ft-red">FEED</span>
      </div>
      <img src="/blockparty/f5-doge-fire.png" alt="" class="feed-mascot" />
    </div>
    <div class="feed-right">
      <!-- Arena card -->
      <button class="arena-card" on:click={enterArena}>
        <div class="arena-top">
          <img src="/blockparty/f5-doge-muscle.png" alt="" class="arena-doge" />
          <div class="arena-info">
            <span class="arena-tag">🎮 BOSS FIGHT</span>
            <h3 class="arena-title">ARENA</h3>
            <p class="arena-desc">7 AI 개 vs 너 ⚔️</p>
          </div>
          <img src="/blockparty/f5-doge-bull.png" alt="" class="arena-doge" />
        </div>
        <div class="arena-feats">
          <span>⚔️ 11-Phase</span>
          <span>🐕 7 Agents</span>
          <span>🏆 Ranking</span>
        </div>
      </button>

      <!-- Live prices card -->
      <div class="ticker-card">
        <div class="tc-row">
          <span class="tc-sym">₿</span>
          <span class="tc-name">BTC</span>
          <span class="tc-val">${btcPrice.toLocaleString()}</span>
        </div>
        <div class="tc-sep"></div>
        <div class="tc-row">
          <span class="tc-sym tc-eth">Ξ</span>
          <span class="tc-name">ETH</span>
          <span class="tc-val">${ethPrice.toLocaleString()}</span>
        </div>
        <div class="tc-sep"></div>
        <div class="tc-row">
          <span class="tc-sym tc-sol">◎</span>
          <span class="tc-name">SOL</span>
          <span class="tc-val">${solPrice.toLocaleString()}</span>
        </div>
      </div>

      <!-- Quick nav cards -->
      <div class="quick-grid">
        <button class="qn" on:click={() => goto('/terminal')}>📊 TERMINAL</button>
        <button class="qn" on:click={() => goto('/passport')}>📋 PASSPORT</button>
        <button class="qn" on:click={() => goto('/oracle')}>🔮 ORACLE</button>
        <button class="qn" on:click={() => goto('/signals')}>
          🔔 SIGNALS
          {#if trackedSigs > 0}<span class="qn-badge">{trackedSigs}</span>{/if}
        </button>
        <button class="qn" on:click={() => goto('/signals?view=live')}>💡 COMMUNITY LIVE</button>
      </div>
    </div>
  </section>

  <!-- ═══ FOOTER / CTA (cream bg) ═══ -->
  <section class="footer-cta">
    <div class="fc-left">
      <div class="fc-text-stack">
        <span class="fc-dark">JOIN</span>
        <span class="fc-dark">THE</span>
        <span class="fc-red">PACK</span>
      </div>
      <div class="fc-details">
        <span class="fc-brand">MAXI⚡DOGE</span>
        <span class="fc-loc">AI TRADING PLATFORM</span>
      </div>
    </div>
    <div class="fc-right">
      <img src="/blockparty/f5-doge-excited.png" alt="" class="fc-mascot" />

      <!-- Wallet CTA -->
      {#if !connected}
        <button class="wallet-btn" on:click={openWalletModal}>
          ⚡ CONNECT WALLET ⚡
        </button>
      {:else}
        <div class="wallet-connected">
          <span class="wc-dot"></span>
          <span>{wallet.shortAddr}</span>
          <span class="wc-tier">{profile.tier.toUpperCase()}</span>
        </div>
      {/if}

      <!-- Rotating reach out badge -->
      <div class="rotating-badge rb-sm">
        <svg viewBox="0 0 200 200" class="badge-svg">
          <defs>
            <path id="circlePathSm" d="M 100, 100 m -70, 0 a 70,70 0 1,1 140,0 a 70,70 0 1,1 -140,0" />
          </defs>
          <text>
            <textPath href="#circlePathSm" class="badge-text">
              CONNECT ✦ CONNECT ✦ CONNECT ✦ CONNECT ✦
            </textPath>
          </text>
        </svg>
        <span class="rb-arrow">↗</span>
      </div>
    </div>

    <!-- Team/agents row -->
    <div class="fc-team">
      {#each AGDEFS.slice(0, 4) as ag}
        <div class="team-row">
          <span class="team-name">{ag.name}</span>
          <span class="team-role">{ag.role}</span>
        </div>
      {/each}
    </div>
  </section>
</div>

<style>
  /* ═══ STIFF-STYLE DESIGN SYSTEM ═══ */
  :root {
    --cream: #F0ECD9;
    --dark: #282D35;
    --red: #D93535;
  }

  /* ═══ BASE ═══ */
  .home {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    background: var(--dark);
    display: flex;
    flex-direction: column;
  }
  .home::-webkit-scrollbar { width: 4px; }
  .home::-webkit-scrollbar-thumb { background: var(--cream); border-radius: 4px; }

  /* ═══ HERO: TWO-COLUMN STIFF STYLE ═══ */
  .hero {
    display: flex;
    min-height: 100vh;
    border-bottom: 3px solid var(--cream);
  }

  /* ── Hero Left: Big Stacked Text ── */
  .hero-left {
    flex: 1.1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 60px 40px 40px;
    background: var(--dark);
  }

  .hero-text-stack {
    display: flex;
    flex-direction: column;
    line-height: 0.88;
  }

  .ht-line {
    font-family: var(--fd), 'Impact', sans-serif;
    font-weight: 900;
    color: var(--cream);
    letter-spacing: -2px;
    text-transform: uppercase;
    display: block;
  }

  .ht-sm { font-size: clamp(36px, 5vw, 64px); letter-spacing: 2px; }
  .ht-md { font-size: clamp(42px, 6vw, 80px); }
  .ht-xl { font-size: clamp(70px, 11vw, 160px); }
  .ht-xxl { font-size: clamp(80px, 13vw, 200px); letter-spacing: -6px; }

  .ht-red { color: var(--red); }

  .ht-good-row {
    display: flex;
    align-items: center;
    gap: 0;
    position: relative;
  }

  .hero-mascot {
    width: clamp(100px, 14vw, 200px);
    height: auto;
    object-fit: contain;
    margin: 0 -10px;
    filter: drop-shadow(4px 4px 0 rgba(0,0,0,.4));
    z-index: 2;
    animation: mascot-idle 3s ease-in-out infinite;
  }

  @keyframes mascot-idle {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    50% { transform: translateY(-8px) rotate(2deg); }
  }

  /* ── Vertical Divider ── */
  .hero-divider {
    width: 50px;
    background: var(--dark);
    border-left: 2px solid rgba(240,236,217,.15);
    border-right: 2px solid rgba(240,236,217,.15);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
    overflow: hidden;
    flex-shrink: 0;
  }

  .vt {
    font-family: var(--fm), sans-serif;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 3px;
    color: rgba(240,236,217,.25);
    writing-mode: vertical-rl;
    text-orientation: mixed;
    white-space: nowrap;
    padding: 8px 0;
  }

  /* ── Hero Right: Feature Cards ── */
  .hero-right {
    width: 420px;
    max-width: 40%;
    background: var(--cream);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    flex-shrink: 0;
  }
  .hero-right::-webkit-scrollbar { width: 3px; }
  .hero-right::-webkit-scrollbar-thumb { background: var(--dark); }

  .feat-card {
    display: flex;
    flex-direction: column;
    background: var(--cream);
    border: none;
    border-bottom: 2px solid var(--dark);
    cursor: pointer;
    transition: background .15s;
    padding: 0;
    text-align: left;
  }
  .feat-card:hover {
    background: rgba(40,45,53,.05);
  }

  .feat-img-wrap {
    width: 100%;
    aspect-ratio: 16/10;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(40,45,53,.06);
    border-bottom: 1px solid rgba(40,45,53,.1);
  }
  .feat-img {
    width: 60%;
    max-height: 80%;
    object-fit: contain;
    transition: transform .3s;
  }
  .feat-card:hover .feat-img {
    transform: scale(1.08);
  }

  .feat-info {
    padding: 12px 20px 16px;
  }
  .feat-sub {
    font-family: var(--fm), sans-serif;
    font-size: 11px;
    font-weight: 500;
    color: rgba(40,45,53,.5);
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .feat-label {
    font-family: var(--fd), 'Impact', sans-serif;
    font-size: 28px;
    font-weight: 900;
    color: var(--red);
    letter-spacing: 1px;
    line-height: 1;
    margin-top: 2px;
  }

  .feat-view-all {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px;
    background: var(--cream);
    border: none;
    border-top: 0;
    cursor: pointer;
    font-family: var(--fd), sans-serif;
    font-size: 14px;
    font-weight: 900;
    letter-spacing: 2px;
    color: var(--dark);
    transition: color .15s;
  }
  .feat-view-all:hover { color: var(--red); }
  .feat-arrow { font-size: 22px; }

  /* ═══ ABOUT SECTION ═══ */
  .about {
    background: var(--dark);
    padding: 60px 40px 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
    border-bottom: 3px solid var(--cream);
  }

  .about-badge-area {
    display: flex;
    align-items: flex-start;
    gap: 40px;
    max-width: 1100px;
    width: 100%;
  }

  /* Rotating badge */
  .rotating-badge {
    position: relative;
    width: 180px;
    height: 180px;
    flex-shrink: 0;
  }
  .badge-svg {
    width: 100%;
    height: 100%;
    animation: spin 20s linear infinite;
  }
  .badge-text {
    font-family: var(--fd), sans-serif;
    font-size: 15px;
    font-weight: 900;
    fill: var(--cream);
    letter-spacing: 3px;
  }
  .badge-face {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 70px;
    height: 70px;
    object-fit: contain;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* Mixed typography about text */
  .about-text {
    flex: 1;
  }
  .about-text p {
    font-family: var(--fd), 'Impact', sans-serif;
    font-size: 28px;
    line-height: 1.15;
    color: var(--cream);
    text-align: center;
  }
  .at-bold {
    font-weight: 900;
    text-transform: uppercase;
  }
  .at-italic {
    font-style: italic;
    font-weight: 400;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 0.85em;
  }
  .at-reg {
    font-weight: 700;
    font-size: 0.7em;
    letter-spacing: 2px;
    text-transform: uppercase;
  }
  .at-sm {
    font-weight: 700;
    font-size: 0.55em;
    letter-spacing: 3px;
    text-transform: uppercase;
  }
  .at-big {
    font-size: 1.15em;
  }
  .at-biggest {
    font-size: 1.4em;
  }

  .about-sub {
    font-family: var(--fm), sans-serif;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 4px;
    color: rgba(240,236,217,.4);
    text-align: center;
    margin-top: 40px;
    padding-top: 20px;
    border-top: 1px solid rgba(240,236,217,.1);
    width: 100%;
    max-width: 600px;
  }

  /* ═══ SQUAD SECTION (CREAM BG) ═══ */
  .squad {
    background: var(--cream);
    padding: 50px 40px;
    border-bottom: 3px solid var(--dark);
  }

  .squad-header {
    text-align: center;
    margin-bottom: 30px;
  }
  .squad-title {
    font-family: var(--fd), 'Impact', sans-serif;
    font-size: clamp(48px, 8vw, 90px);
    font-weight: 900;
    line-height: 0.9;
    letter-spacing: -2px;
  }
  .sq-dark { color: var(--dark); }
  .sq-red { color: var(--red); display: block; }
  .squad-sub {
    font-family: var(--fm), sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: rgba(40,45,53,.5);
    letter-spacing: 1px;
    margin-top: 8px;
  }

  .squad-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
    max-width: 900px;
    margin: 0 auto;
  }

  .sq-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    background: var(--dark);
    border: 2px solid var(--dark);
    cursor: default;
    transition: transform .15s;
  }
  .sq-card:hover {
    transform: translateY(-2px);
  }
  .sq-avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid var(--ac);
    flex-shrink: 0;
  }
  .sq-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }
  .sq-name {
    font-family: var(--fd), sans-serif;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 1px;
  }
  .sq-role {
    font-family: var(--fm), sans-serif;
    font-size: 8px;
    color: rgba(240,236,217,.4);
    letter-spacing: 0.5px;
  }
  .sq-conf {
    margin-left: auto;
    font-family: var(--fd), sans-serif;
    font-size: 16px;
    font-weight: 900;
    color: var(--cream);
    opacity: 0.5;
  }

  /* ═══ FEED SECTION ═══ */
  .feed {
    display: flex;
    min-height: 500px;
    background: var(--dark);
    border-bottom: 3px solid var(--cream);
  }

  .feed-left {
    flex: 0 0 40%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    position: relative;
    overflow: hidden;
  }

  .feed-text-stack {
    display: flex;
    flex-direction: column;
    line-height: 0.85;
    text-align: center;
  }
  .ft-line {
    font-family: var(--fd), 'Impact', sans-serif;
    font-weight: 900;
    text-transform: uppercase;
    display: block;
  }
  .ft-dark {
    font-size: clamp(40px, 6vw, 80px);
    color: var(--cream);
    letter-spacing: -1px;
  }
  .ft-red {
    font-size: clamp(70px, 12vw, 160px);
    color: var(--red);
    letter-spacing: -4px;
  }

  .feed-mascot {
    width: clamp(120px, 16vw, 200px);
    object-fit: contain;
    margin-top: 20px;
    filter: drop-shadow(3px 4px 0 rgba(0,0,0,.3));
    animation: mascot-idle 4s ease-in-out infinite;
  }

  .feed-right {
    flex: 1;
    background: var(--cream);
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow-y: auto;
  }

  /* Arena card */
  .arena-card {
    background: var(--dark);
    border: 3px solid var(--dark);
    padding: 16px;
    cursor: pointer;
    transition: transform .15s;
    width: 100%;
    text-align: left;
  }
  .arena-card:hover { transform: translateY(-2px); }

  .arena-top {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .arena-doge {
    width: 70px;
    height: 70px;
    object-fit: contain;
    flex-shrink: 0;
  }
  .arena-info { flex: 1; text-align: center; }
  .arena-tag {
    font-family: var(--fm), sans-serif;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1px;
    color: var(--cream);
    opacity: .6;
  }
  .arena-title {
    font-family: var(--fd), sans-serif;
    font-size: 32px;
    font-weight: 900;
    letter-spacing: 6px;
    color: var(--red);
    line-height: 1;
  }
  .arena-desc {
    font-family: var(--fm), sans-serif;
    font-size: 11px;
    color: rgba(240,236,217,.5);
    margin-top: 2px;
  }
  .arena-feats {
    display: flex;
    gap: 8px;
    justify-content: center;
    margin-top: 10px;
  }
  .arena-feats span {
    font-family: var(--fm), sans-serif;
    font-size: 9px;
    font-weight: 700;
    color: rgba(240,236,217,.5);
    background: rgba(240,236,217,.06);
    padding: 4px 10px;
    letter-spacing: 0.5px;
  }

  /* Ticker card */
  .ticker-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 20px;
    background: var(--dark);
    border: 2px solid var(--dark);
  }
  .tc-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .tc-sym {
    font-size: 18px;
    color: #f7931a;
  }
  .tc-eth { color: #627eea; }
  .tc-sol { color: #9945ff; }
  .tc-name {
    font-family: var(--fm), sans-serif;
    font-size: 10px;
    font-weight: 700;
    color: rgba(240,236,217,.4);
    letter-spacing: 1px;
  }
  .tc-val {
    font-family: var(--fd), sans-serif;
    font-size: 16px;
    font-weight: 900;
    color: var(--cream);
  }
  .tc-sep {
    width: 1px;
    height: 24px;
    background: rgba(240,236,217,.15);
    flex-shrink: 0;
  }

  /* Quick nav */
  .quick-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .qn {
    font-family: var(--fd), sans-serif;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 2px;
    color: var(--dark);
    background: transparent;
    border: 2px solid var(--dark);
    padding: 8px 14px;
    cursor: pointer;
    transition: all .12s;
    display: flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
  }
  .qn:hover {
    background: var(--dark);
    color: var(--cream);
  }
  .qn-badge {
    font-size: 8px;
    background: var(--red);
    color: #fff;
    padding: 1px 5px;
    border-radius: 4px;
  }

  /* ═══ FOOTER CTA (CREAM BG) ═══ */
  .footer-cta {
    background: var(--cream);
    padding: 50px 40px 40px;
    display: flex;
    flex-wrap: wrap;
    gap: 30px;
    border-top: 3px solid var(--dark);
  }

  .fc-left {
    flex: 1;
    min-width: 250px;
  }
  .fc-text-stack {
    display: flex;
    flex-direction: column;
    line-height: 0.85;
  }
  .fc-dark {
    font-family: var(--fd), 'Impact', sans-serif;
    font-size: clamp(50px, 9vw, 120px);
    font-weight: 900;
    color: var(--dark);
    letter-spacing: -3px;
    display: block;
  }
  .fc-red {
    font-family: var(--fd), 'Impact', sans-serif;
    font-size: clamp(60px, 12vw, 160px);
    font-weight: 900;
    color: var(--red);
    letter-spacing: -4px;
    display: block;
  }

  .fc-details {
    margin-top: 16px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .fc-brand {
    font-family: var(--fd), sans-serif;
    font-size: 22px;
    font-weight: 900;
    color: var(--dark);
    letter-spacing: 2px;
  }
  .fc-loc {
    font-family: var(--fm), sans-serif;
    font-size: 13px;
    color: rgba(40,45,53,.5);
    letter-spacing: 1px;
  }

  .fc-right {
    flex: 1;
    min-width: 250px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
  }

  .fc-mascot {
    width: 180px;
    object-fit: contain;
    filter: drop-shadow(3px 4px 0 rgba(0,0,0,.15));
  }

  /* Wallet button (cream context) */
  .wallet-btn {
    font-family: var(--fd), sans-serif;
    font-size: 14px;
    font-weight: 900;
    letter-spacing: 3px;
    color: var(--cream);
    background: var(--dark);
    border: 3px solid var(--dark);
    padding: 16px 32px;
    cursor: pointer;
    transition: all .15s;
    box-shadow: 4px 4px 0 var(--dark);
  }
  .wallet-btn:hover {
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0 var(--dark);
  }

  .wallet-connected {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--fm), sans-serif;
    font-size: 12px;
    font-weight: 700;
    color: #00cc66;
    background: var(--dark);
    padding: 12px 20px;
    letter-spacing: 1px;
  }
  .wc-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #00cc66;
    box-shadow: 0 0 8px #00cc66;
  }
  .wc-tier {
    font-size: 8px;
    background: rgba(255,200,0,.15);
    color: #c8a000;
    padding: 2px 6px;
    letter-spacing: 1px;
  }

  /* Small rotating badge */
  .rb-sm {
    width: 120px;
    height: 120px;
  }
  .rb-arrow {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 28px;
    font-weight: 900;
    color: var(--dark);
  }
  .rb-sm .badge-text {
    fill: var(--dark);
    font-size: 17px;
  }

  /* Team rows */
  .fc-team {
    width: 100%;
    flex-basis: 100%;
    display: flex;
    flex-direction: column;
    border-top: 2px solid var(--dark);
  }
  .team-row {
    display: flex;
    justify-content: space-between;
    padding: 10px 0;
    border-bottom: 1px solid rgba(40,45,53,.15);
  }
  .team-name {
    font-family: var(--fd), sans-serif;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 2px;
    color: var(--dark);
  }
  .team-role {
    font-family: var(--fm), sans-serif;
    font-size: 11px;
    font-weight: 600;
    color: rgba(40,45,53,.5);
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  /* ═══ RESPONSIVE ═══ */
  @media (max-width: 900px) {
    .hero {
      flex-direction: column;
      min-height: auto;
    }
    .hero-left {
      padding: 50px 24px 30px;
    }
    .hero-divider {
      width: 100%;
      height: 40px;
      flex-direction: row;
      border-left: none;
      border-right: none;
      border-top: 2px solid rgba(240,236,217,.15);
      border-bottom: 2px solid rgba(240,236,217,.15);
    }
    .vt {
      writing-mode: horizontal-tb;
      text-orientation: initial;
      padding: 0 8px;
    }
    .hero-right {
      width: 100%;
      max-width: 100%;
    }

    .about-badge-area {
      flex-direction: column;
      align-items: center;
    }

    .feed {
      flex-direction: column;
      min-height: auto;
    }
    .feed-left {
      padding: 30px 24px;
    }

    .footer-cta {
      padding: 30px 24px;
    }
  }

  @media (max-width: 640px) {
    .hero-left { padding: 40px 16px 20px; }
    .ht-sm { font-size: 28px; }
    .ht-md { font-size: 36px; }
    .ht-xl { font-size: 64px; }
    .ht-xxl { font-size: 72px; }
    .hero-mascot { width: 80px; }

    .about { padding: 30px 16px 24px; }
    .about-text p { font-size: 20px; }
    .rotating-badge { width: 120px; height: 120px; }
    .badge-face { width: 45px; height: 45px; }

    .squad { padding: 30px 16px; }
    .squad-grid { grid-template-columns: 1fr; }

    .feed-right { padding: 16px; }
    .arena-doge { width: 50px; height: 50px; }
    .arena-title { font-size: 24px; letter-spacing: 4px; }
    .ticker-card { flex-wrap: wrap; gap: 10px; }
    .tc-sep { display: none; }

    .footer-cta { padding: 24px 16px; }
    .fc-dark { font-size: 48px; }
    .fc-red { font-size: 60px; }
    .fc-mascot { width: 120px; }
    .wallet-btn { font-size: 11px; padding: 12px 20px; letter-spacing: 2px; }
  }

  @media (max-width: 400px) {
    .ht-sm { font-size: 22px; }
    .ht-md { font-size: 28px; }
    .ht-xl { font-size: 48px; }
    .ht-xxl { font-size: 56px; }
    .hero-mascot { width: 60px; }
    .about-text p { font-size: 16px; }
    .squad-grid { gap: 8px; }
    .sq-card { padding: 10px 12px; }
    .fc-dark { font-size: 36px; }
    .fc-red { font-size: 48px; }
  }
</style>
