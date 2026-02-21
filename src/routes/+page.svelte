<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
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
    { label: 'WAR ROOM', sub: 'TERMINAL', img: '/blockparty/f5-doge-chart.png', path: '/terminal' },
    { label: 'BOSS FIGHT', sub: 'ARENA', img: '/blockparty/f5-doge-muscle.png', path: '/arena' },
    { label: 'AI SIGNALS', sub: 'SIGNALS', img: '/blockparty/f5-doge-fire.png', path: '/signals' },
    { label: 'COMMUNITY', sub: 'LIVE', img: '/blockparty/f5-doge-excited.png', path: '/signals' },
  ];

  /* ── Scroll-driven animations + parallax ── */
  let homeEl: HTMLDivElement;
  let scrollY = 0;

  function onScroll() {
    if (!homeEl) return;
    scrollY = homeEl.scrollTop;

    // Parallax: move elements at different speeds
    const pxEls = homeEl.querySelectorAll('[data-px]');
    for (const el of pxEls) {
      const rect = (el as HTMLElement).getBoundingClientRect();
      const speed = parseFloat((el as HTMLElement).dataset.px || '0.3');
      const offset = (scrollY - (el as HTMLElement).offsetTop + homeEl.clientHeight) * speed;
      (el as HTMLElement).style.transform = `translate3d(0, ${offset}px, 0)`;
    }
  }

  onMount(() => {
    if (!homeEl) return;

    homeEl.addEventListener('scroll', onScroll, { passive: true });

    // Panel slide-in observer
    const panelObs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add('panel-visible');
            panelObs.unobserve(entry.target);
          }
        }
      },
      { root: homeEl, threshold: 0.05 }
    );

    // Element reveal observer
    const elObs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add('sr-visible');
            elObs.unobserve(entry.target);
          }
        }
      },
      { root: homeEl, threshold: 0.1 }
    );

    homeEl.querySelectorAll('.panel').forEach((el) => panelObs.observe(el));
    homeEl.querySelectorAll('.sr').forEach((el) => elObs.observe(el));

    return () => {
      homeEl.removeEventListener('scroll', onScroll);
      panelObs.disconnect();
      elObs.disconnect();
    };
  });
</script>

<div class="home" bind:this={homeEl}>
  <div class="grain" aria-hidden="true"></div>

  <!-- ═══ PANEL 1: HERO ═══ -->
  <section class="panel panel-visible hero">
    <div class="hero-left">
      <div class="hero-text-stack perspective-3d">
        <span class="ht-line ht-sm sr sr-left">WE MAKE</span>
        <span class="ht-line ht-red ht-xl sr sr-left" style="transition-delay:.1s">TRADES</span>
        <span class="ht-line ht-md sr sr-left" style="transition-delay:.2s">THAT LOOK</span>
        <span class="ht-line ht-md sr sr-left" style="transition-delay:.3s">DAMN</span>
        <div class="ht-good-row sr sr-up" style="transition-delay:.45s">
          <span class="ht-line ht-xxl">GO</span>
          <img src="/blockparty/f5-doge-bull.png" alt="doge" class="hero-mascot" />
          <span class="ht-line ht-xxl">OD</span>
        </div>
      </div>
    </div>

    <div class="hero-divider">
      {#each Array(8) as _}<span class="vt">FEATURES</span>{/each}
    </div>

    <div class="hero-right">
      {#each FEATURES as feat, i}
        <button class="feat-card sr sr-right" style="transition-delay:{i * 0.12}s" on:click={() => goto(feat.path)}>
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

  <!-- ═══ PANEL 2: ABOUT (slides from right) ═══ -->
  <section class="panel panel-from-right about">
    <div class="about-badge-area">
      <div class="rotating-badge sr sr-scale">
        <svg viewBox="0 0 200 200" class="badge-svg">
          <defs>
            <path id="circlePath" d="M 100, 100 m -75, 0 a 75,75 0 1,1 150,0 a 75,75 0 1,1 -150,0" />
          </defs>
          <text>
            <textPath href="#circlePath" class="badge-text">MUCH WOW ✦ MUCH WOW ✦ MUCH WOW ✦ MUCH WOW ✦</textPath>
          </text>
        </svg>
        <img src="/blockparty/f5-doge-face.png" alt="" class="badge-face" />
      </div>

      <div class="about-text sr sr-up">
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
    <div class="about-sub sr sr-up" style="transition-delay:.2s">WE AIN'T NO ORDINARY DOGS.</div>
  </section>

  <!-- ═══ PANEL 3: SQUAD (slides from left) ═══ -->
  <section class="panel panel-from-left squad">
    <div class="squad-header sr sr-up">
      <h2 class="squad-title">
        <span class="sq-dark">THE</span>
        <span class="sq-red">SQUAD</span>
      </h2>
      <p class="squad-sub">7 AI dogs that eat the market alive</p>
    </div>
    <div class="squad-grid">
      {#each AGDEFS as ag, i}
        <div class="sq-card sr sr-up" style="--ac:{ag.color};transition-delay:{i * 0.07}s">
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

  <!-- ═══ PANEL 4: FEED (slides from right) ═══ -->
  <section class="panel panel-from-right feed">
    <div class="feed-left">
      <div class="feed-text-stack">
        <span class="ft-line ft-cream sr sr-left">IN YOUR</span>
        <span class="ft-line ft-red sr sr-left" style="transition-delay:.15s">FEED</span>
      </div>
      <img src="/blockparty/f5-doge-fire.png" alt="" class="feed-mascot sr sr-scale" style="transition-delay:.3s" />
    </div>
    <div class="feed-right">
      <button class="arena-card sr sr-right" on:click={enterArena}>
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

      <div class="ticker-card sr sr-up" style="transition-delay:.1s">
        <div class="tc-row"><span class="tc-sym">₿</span><span class="tc-name">BTC</span><span class="tc-val">${btcPrice.toLocaleString()}</span></div>
        <div class="tc-sep"></div>
        <div class="tc-row"><span class="tc-sym tc-eth">Ξ</span><span class="tc-name">ETH</span><span class="tc-val">${ethPrice.toLocaleString()}</span></div>
        <div class="tc-sep"></div>
        <div class="tc-row"><span class="tc-sym tc-sol">◎</span><span class="tc-name">SOL</span><span class="tc-val">${solPrice.toLocaleString()}</span></div>
      </div>

      <div class="quick-grid sr sr-up" style="transition-delay:.2s">
        <button class="qn" on:click={() => goto('/terminal')}>📊 TERMINAL</button>
        <button class="qn" on:click={() => goto('/passport')}>📋 PASSPORT</button>
        <button class="qn" on:click={() => goto('/oracle')}>🔮 ORACLE</button>
        <button class="qn" on:click={() => goto('/signals')}>
          🔔 SIGNALS {#if trackedSigs > 0}<span class="qn-badge">{trackedSigs}</span>{/if}
        </button>
        <button class="qn" on:click={() => goto('/signals')}>👀 COMMUNITY</button>
      </div>
    </div>
  </section>

  <!-- ═══ PANEL 5: FOOTER CTA (slides from left) ═══ -->
  <section class="panel panel-from-left footer-cta">
    <div class="fc-left sr sr-left">
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
    <div class="fc-right sr sr-right">
      <img src="/blockparty/f5-doge-excited.png" alt="" class="fc-mascot" />

      {#if !connected}
        <button class="wallet-btn" on:click={openWalletModal}>⚡ CONNECT WALLET ⚡</button>
      {:else}
        <div class="wallet-connected">
          <span class="wc-dot"></span>
          <span>{wallet.shortAddr}</span>
          <span class="wc-tier">{profile.tier.toUpperCase()}</span>
        </div>
      {/if}

      <div class="rotating-badge rb-sm">
        <svg viewBox="0 0 200 200" class="badge-svg">
          <defs><path id="circlePathSm" d="M 100, 100 m -70, 0 a 70,70 0 1,1 140,0 a 70,70 0 1,1 -140,0" /></defs>
          <text><textPath href="#circlePathSm" class="badge-text-dark">CONNECT ✦ CONNECT ✦ CONNECT ✦ CONNECT ✦</textPath></text>
        </svg>
        <span class="rb-arrow">↗</span>
      </div>
    </div>

    <div class="fc-team sr sr-up" style="transition-delay:.15s">
      {#each AGDEFS.slice(0, 4) as ag}
        <div class="team-row">
          <span class="team-name">{ag.name}</span>
          <span class="team-role">{ag.role}</span>
        </div>
      {/each}
    </div>
  </section>

  <!-- ═══ FOOTER ═══ -->
  <footer class="footer">
    <div class="footer-top">
      <div class="footer-logo">MAXI<span class="footer-bolt">⚡</span>DOGE</div>
      <div class="footer-links">
        <button on:click={() => goto('/terminal')}>TERMINAL</button>
        <button on:click={() => goto('/arena')}>ARENA</button>
        <button on:click={() => goto('/signals')}>SIGNALS</button>
        <button on:click={() => goto('/passport')}>PASSPORT</button>
        <button on:click={() => goto('/oracle')}>ORACLE</button>
        <button on:click={() => goto('/signals')}>COMMUNITY</button>
      </div>
    </div>
    <div class="footer-bottom">
      <span class="footer-copy">© 2025 MAXI⚡DOGE. ALL RIGHTS RESERVED.</span>
      <span class="footer-tagline">such AI. very trade. much profit. wow.</span>
    </div>
  </footer>
</div>

<style>
  /* ═══ RETRO PREMIUM — STIFF STYLE ═══ */

  .home {
    width: 100%; height: 100%;
    overflow-y: auto; overflow-x: hidden;
    background: #282D35;
    display: flex; flex-direction: column;
    position: relative;
    scroll-snap-type: y mandatory;
    scroll-behavior: smooth;
  }
  .home::-webkit-scrollbar { width: 4px; }
  .home::-webkit-scrollbar-thumb { background: #F0ECD9; border-radius: 4px; }

  /* ═══ GRAIN TEXTURE ═══ */
  .grain {
    position: fixed; inset: 0;
    pointer-events: none; z-index: 999;
    opacity: 0.045; mix-blend-mode: overlay;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
    background-repeat: repeat; background-size: 200px 200px;
  }

  /* ═══ PANEL SYSTEM — HORIZONTAL SLIDE TRANSITIONS ═══ */
  .panel {
    min-height: 100vh;
    scroll-snap-align: start;
    transition: opacity 0.9s cubic-bezier(.22,1,.36,1), transform 0.9s cubic-bezier(.22,1,.36,1);
    will-change: opacity, transform;
  }
  .panel-from-right { opacity: 0; transform: translateX(100px); }
  .panel-from-left { opacity: 0; transform: translateX(-100px); }
  :global(.panel-visible) { opacity: 1 !important; transform: translateX(0) !important; }

  /* ═══ SCROLL REVEAL (child elements) ═══ */
  .sr {
    opacity: 0;
    transition: opacity 0.7s cubic-bezier(.22,1,.36,1), transform 0.7s cubic-bezier(.22,1,.36,1);
    will-change: opacity, transform;
  }
  .sr-up { transform: translateY(40px); }
  .sr-left { transform: translateX(-50px); }
  .sr-right { transform: translateX(50px); }
  .sr-scale { transform: scale(0.85); }
  :global(.sr-visible) { opacity: 1 !important; transform: translate(0) scale(1) !important; }

  /* ═══ 3D PERSPECTIVE TEXT (Stiff about page style) ═══ */
  .perspective-3d {
    perspective: 800px;
    transform-style: preserve-3d;
  }

  /* ═══ HERO ═══ */
  .hero {
    display: flex;
    border-bottom: 3px solid #F0ECD9;
    position: relative;
  }
  .hero::after {
    content: ''; position: absolute; inset: 0;
    pointer-events: none; z-index: 1;
    background: radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(0,0,0,.3) 100%);
  }

  .hero-left {
    flex: 1.1;
    display: flex; align-items: center; justify-content: center;
    padding: 60px 40px 40px;
    background: radial-gradient(ellipse at 30% 60%, rgba(217,53,53,.04) 0%, transparent 50%),
                radial-gradient(ellipse at 70% 30%, rgba(240,236,217,.03) 0%, transparent 50%),
                #282D35;
    position: relative; z-index: 2;
  }

  .hero-text-stack {
    display: flex; flex-direction: column; line-height: 0.88;
    position: relative; z-index: 3;
  }

  .ht-line {
    font-family: var(--fd), 'Impact', sans-serif; font-weight: 900;
    color: #F0ECD9; letter-spacing: -2px; text-transform: uppercase; display: block;
    text-shadow: 2px 2px 0 rgba(0,0,0,.4), 0 0 40px rgba(240,236,217,.03);
  }
  .ht-sm { font-size: clamp(36px, 5vw, 64px); letter-spacing: 2px; }
  .ht-md { font-size: clamp(42px, 6vw, 80px); }
  .ht-xl { font-size: clamp(70px, 11vw, 160px); }
  .ht-xxl { font-size: clamp(80px, 13vw, 200px); letter-spacing: -6px; }
  .ht-red { color: #D93535; text-shadow: 3px 3px 0 rgba(0,0,0,.5), 0 0 60px rgba(217,53,53,.15); }

  .ht-good-row { display: flex; align-items: center; position: relative; }

  .hero-mascot {
    width: clamp(100px, 14vw, 200px); height: auto; object-fit: contain;
    margin: 0 -10px; filter: drop-shadow(4px 4px 0 rgba(0,0,0,.4));
    z-index: 2; animation: mascot-idle 3s ease-in-out infinite;
  }
  @keyframes mascot-idle {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    50% { transform: translateY(-8px) rotate(2deg); }
  }

  /* Vertical divider */
  .hero-divider {
    width: 50px; background: #282D35;
    border-left: 2px solid rgba(240,236,217,.12);
    border-right: 2px solid rgba(240,236,217,.12);
    display: flex; flex-direction: column; align-items: center;
    overflow: hidden; flex-shrink: 0;
  }
  .vt {
    font-family: var(--fm), sans-serif; font-size: 10px; font-weight: 900;
    letter-spacing: 3px; color: rgba(240,236,217,.2);
    writing-mode: vertical-rl; text-orientation: mixed;
    white-space: nowrap; padding: 8px 0;
  }

  /* Feature cards */
  .hero-right {
    width: 420px; max-width: 40%;
    background: radial-gradient(ellipse at 50% 80%, rgba(217,53,53,.03) 0%, transparent 60%), #F0ECD9;
    display: flex; flex-direction: column; overflow-y: auto; flex-shrink: 0;
    position: relative;
  }
  .hero-right::-webkit-scrollbar { width: 3px; }
  .hero-right::-webkit-scrollbar-thumb { background: #282D35; }

  .feat-card {
    display: flex; flex-direction: column; background: transparent;
    border: none; border-bottom: 2px solid #282D35;
    cursor: pointer; transition: background .2s; padding: 0; text-align: left;
  }
  .feat-card:hover { background: rgba(40,45,53,.05); }

  .feat-img-wrap {
    width: 100%; aspect-ratio: 16/10; overflow: hidden;
    display: flex; align-items: center; justify-content: center;
    background: rgba(40,45,53,.04); border-bottom: 1px solid rgba(40,45,53,.08);
  }
  .feat-img {
    width: 55%; max-height: 80%; object-fit: contain;
    transition: transform .4s cubic-bezier(.22,1,.36,1);
    filter: drop-shadow(2px 3px 0 rgba(0,0,0,.1));
  }
  .feat-card:hover .feat-img { transform: scale(1.1) rotate(-2deg); }

  .feat-info { padding: 12px 20px 16px; }
  .feat-sub {
    font-family: var(--fm), sans-serif; font-size: 11px; font-weight: 500;
    color: rgba(40,45,53,.45); letter-spacing: 1.5px; text-transform: uppercase;
  }
  .feat-label {
    font-family: var(--fd), 'Impact', sans-serif; font-size: 28px; font-weight: 900;
    color: #D93535; letter-spacing: 1px; line-height: 1; margin-top: 2px;
  }

  .feat-view-all {
    display: flex; align-items: center; justify-content: space-between;
    padding: 20px; background: transparent; border: none; cursor: pointer;
    font-family: var(--fd), sans-serif; font-size: 14px; font-weight: 900;
    letter-spacing: 2px; color: #282D35; transition: color .15s;
    border-top: 1px solid rgba(40,45,53,.1);
  }
  .feat-view-all:hover { color: #D93535; }
  .feat-arrow { font-size: 22px; }

  /* ═══ ABOUT ═══ */
  .about {
    background: radial-gradient(ellipse at 20% 40%, rgba(217,53,53,.03) 0%, transparent 50%),
                radial-gradient(ellipse at 80% 70%, rgba(240,236,217,.04) 0%, transparent 50%),
                #282D35;
    padding: 70px 40px 50px;
    display: flex; flex-direction: column; align-items: center;
    border-bottom: 3px solid #F0ECD9; position: relative;
  }
  .about::after {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background: radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(0,0,0,.25) 100%); z-index: 0;
  }

  .about-badge-area {
    display: flex; align-items: flex-start; gap: 40px;
    max-width: 1100px; width: 100%; position: relative; z-index: 2;
  }

  .rotating-badge { position: relative; width: 180px; height: 180px; flex-shrink: 0; }
  .badge-svg { width: 100%; height: 100%; animation: spin 20s linear infinite; }
  .badge-text { font-family: var(--fd), sans-serif; font-size: 15px; font-weight: 900; fill: #F0ECD9; letter-spacing: 3px; }
  .badge-text-dark { font-family: var(--fd), sans-serif; font-size: 17px; font-weight: 900; fill: #282D35; letter-spacing: 3px; }
  .badge-face { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 70px; height: 70px; object-fit: contain; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

  .about-text { flex: 1; }
  .about-text p { font-family: var(--fd), 'Impact', sans-serif; font-size: 28px; line-height: 1.18; color: #F0ECD9; text-align: center; }
  .at-bold { font-weight: 900; text-transform: uppercase; }
  .at-italic { font-style: italic; font-weight: 400; font-family: Georgia, 'Times New Roman', serif; font-size: 0.85em; }
  .at-reg { font-weight: 700; font-size: 0.7em; letter-spacing: 2px; text-transform: uppercase; }
  .at-sm { font-weight: 700; font-size: 0.55em; letter-spacing: 3px; text-transform: uppercase; }
  .at-big { font-size: 1.15em; }
  .at-biggest { font-size: 1.4em; }

  .about-sub {
    font-family: var(--fm), sans-serif; font-size: 12px; font-weight: 700;
    letter-spacing: 4px; color: rgba(240,236,217,.35); text-align: center;
    margin-top: 40px; padding-top: 20px;
    border-top: 1px solid rgba(240,236,217,.08);
    width: 100%; max-width: 600px; position: relative; z-index: 2;
  }

  /* ═══ SQUAD ═══ */
  .squad {
    background: radial-gradient(ellipse at 60% 20%, rgba(217,53,53,.03) 0%, transparent 50%), #F0ECD9;
    padding: 55px 40px; border-bottom: 3px solid #282D35; position: relative;
  }
  .squad::before, .footer-cta::before {
    content: ''; position: absolute; inset: 0; pointer-events: none; opacity: 0.03;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size: 180px 180px;
  }

  .squad-header { text-align: center; margin-bottom: 30px; }
  .squad-title { font-family: var(--fd), 'Impact', sans-serif; font-size: clamp(48px, 8vw, 90px); font-weight: 900; line-height: 0.9; letter-spacing: -2px; }
  .sq-dark { color: #282D35; }
  .sq-red { color: #D93535; display: block; }
  .squad-sub { font-family: var(--fm), sans-serif; font-size: 13px; font-weight: 600; color: rgba(40,45,53,.45); letter-spacing: 1px; margin-top: 8px; }

  .squad-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; max-width: 960px; margin: 0 auto; }

  .sq-card {
    display: flex; align-items: center; gap: 10px; padding: 14px 16px;
    background: #282D35; border: 2px solid #282D35;
    cursor: default; transition: transform .2s, box-shadow .2s;
  }
  .sq-card:hover { transform: translateY(-3px); box-shadow: 0 6px 20px rgba(0,0,0,.15); }
  .sq-avatar { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 2px solid var(--ac); flex-shrink: 0; }
  .sq-info { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  .sq-name { font-family: var(--fd), sans-serif; font-size: 11px; font-weight: 900; letter-spacing: 1px; }
  .sq-role { font-family: var(--fm), sans-serif; font-size: 8px; color: rgba(240,236,217,.35); letter-spacing: .5px; }
  .sq-conf { margin-left: auto; font-family: var(--fd), sans-serif; font-size: 16px; font-weight: 900; color: #F0ECD9; opacity: .45; }

  /* ═══ FEED ═══ */
  .feed { display: flex; background: #282D35; border-bottom: 3px solid #F0ECD9; }

  .feed-left {
    flex: 0 0 40%; display: flex; flex-direction: column;
    align-items: center; justify-content: center; padding: 40px;
    position: relative; overflow: hidden;
    background: radial-gradient(ellipse at 50% 70%, rgba(217,53,53,.05) 0%, transparent 55%), #282D35;
  }
  .feed-left::after {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background: radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(0,0,0,.25) 100%);
  }

  .feed-text-stack { display: flex; flex-direction: column; line-height: 0.85; text-align: center; position: relative; z-index: 2; }
  .ft-line { font-family: var(--fd), 'Impact', sans-serif; font-weight: 900; text-transform: uppercase; display: block; }
  .ft-cream { font-size: clamp(40px, 6vw, 80px); color: #F0ECD9; letter-spacing: -1px; text-shadow: 2px 2px 0 rgba(0,0,0,.4); }
  .ft-red { font-size: clamp(70px, 12vw, 160px); color: #D93535; letter-spacing: -4px; text-shadow: 3px 3px 0 rgba(0,0,0,.5); }

  .feed-mascot {
    width: clamp(120px, 16vw, 200px); object-fit: contain; margin-top: 20px;
    filter: drop-shadow(3px 4px 0 rgba(0,0,0,.3));
    animation: mascot-idle 4s ease-in-out infinite; position: relative; z-index: 2;
  }

  .feed-right {
    flex: 1; background: radial-gradient(ellipse at 30% 80%, rgba(217,53,53,.02) 0%, transparent 50%), #F0ECD9;
    padding: 24px; display: flex; flex-direction: column; gap: 14px; overflow-y: auto;
  }

  .arena-card {
    background: #282D35; border: 3px solid #282D35; padding: 16px;
    cursor: pointer; transition: transform .2s, box-shadow .2s; width: 100%; text-align: left;
  }
  .arena-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,.15); }
  .arena-top { display: flex; align-items: center; gap: 12px; }
  .arena-doge { width: 70px; height: 70px; object-fit: contain; flex-shrink: 0; }
  .arena-info { flex: 1; text-align: center; }
  .arena-tag { font-family: var(--fm), sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 1px; color: #F0ECD9; opacity: .55; }
  .arena-title { font-family: var(--fd), sans-serif; font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #D93535; line-height: 1; text-shadow: 2px 2px 0 rgba(0,0,0,.4); }
  .arena-desc { font-family: var(--fm), sans-serif; font-size: 11px; color: rgba(240,236,217,.45); margin-top: 2px; }
  .arena-feats { display: flex; gap: 8px; justify-content: center; margin-top: 10px; }
  .arena-feats span { font-family: var(--fm), sans-serif; font-size: 9px; font-weight: 700; color: rgba(240,236,217,.45); background: rgba(240,236,217,.06); padding: 4px 10px; letter-spacing: .5px; }

  .ticker-card { display: flex; align-items: center; gap: 16px; padding: 16px 20px; background: #282D35; border: 2px solid #282D35; }
  .tc-row { display: flex; align-items: center; gap: 6px; }
  .tc-sym { font-size: 18px; color: #f7931a; }
  .tc-eth { color: #627eea; }
  .tc-sol { color: #9945ff; }
  .tc-name { font-family: var(--fm), sans-serif; font-size: 10px; font-weight: 700; color: rgba(240,236,217,.35); letter-spacing: 1px; }
  .tc-val { font-family: var(--fd), sans-serif; font-size: 16px; font-weight: 900; color: #F0ECD9; }
  .tc-sep { width: 1px; height: 24px; background: rgba(240,236,217,.12); flex-shrink: 0; }

  .quick-grid { display: flex; flex-wrap: wrap; gap: 8px; }
  .qn { font-family: var(--fd), sans-serif; font-size: 10px; font-weight: 900; letter-spacing: 2px; color: #282D35; background: transparent; border: 2px solid #282D35; padding: 8px 14px; cursor: pointer; transition: all .15s; display: flex; align-items: center; gap: 6px; white-space: nowrap; }
  .qn:hover { background: #282D35; color: #F0ECD9; }
  .qn-badge { font-size: 8px; background: #D93535; color: #fff; padding: 1px 5px; border-radius: 4px; }

  /* ═══ FOOTER CTA ═══ */
  .footer-cta {
    background: radial-gradient(ellipse at 70% 30%, rgba(217,53,53,.03) 0%, transparent 50%), #F0ECD9;
    padding: 55px 40px 40px; display: flex; flex-wrap: wrap; gap: 30px;
    border-top: 3px solid #282D35; position: relative;
  }

  .fc-left { flex: 1; min-width: 250px; }
  .fc-text-stack { display: flex; flex-direction: column; line-height: 0.85; }
  .fc-dark { font-family: var(--fd), 'Impact', sans-serif; font-size: clamp(50px, 9vw, 120px); font-weight: 900; color: #282D35; letter-spacing: -3px; display: block; text-shadow: 2px 2px 0 rgba(0,0,0,.06); }
  .fc-red { font-family: var(--fd), 'Impact', sans-serif; font-size: clamp(60px, 12vw, 160px); font-weight: 900; color: #D93535; letter-spacing: -4px; display: block; text-shadow: 3px 3px 0 rgba(0,0,0,.08); }

  .fc-details { margin-top: 16px; display: flex; flex-direction: column; gap: 2px; }
  .fc-brand { font-family: var(--fd), sans-serif; font-size: 22px; font-weight: 900; color: #282D35; letter-spacing: 2px; }
  .fc-loc { font-family: var(--fm), sans-serif; font-size: 13px; color: rgba(40,45,53,.45); letter-spacing: 1px; }

  .fc-right { flex: 1; min-width: 250px; display: flex; flex-direction: column; align-items: center; gap: 20px; }
  .fc-mascot { width: 180px; object-fit: contain; filter: drop-shadow(3px 4px 0 rgba(0,0,0,.1)); }

  .wallet-btn {
    font-family: var(--fd), sans-serif; font-size: 14px; font-weight: 900; letter-spacing: 3px;
    color: #F0ECD9; background: #282D35; border: 3px solid #282D35; padding: 16px 32px;
    cursor: pointer; transition: all .2s; box-shadow: 4px 4px 0 rgba(0,0,0,.2);
  }
  .wallet-btn:hover { transform: translate(-2px, -2px); box-shadow: 6px 6px 0 rgba(0,0,0,.25); }
  .wallet-connected { display: flex; align-items: center; gap: 8px; font-family: var(--fm), sans-serif; font-size: 12px; font-weight: 700; color: #00cc66; background: #282D35; padding: 12px 20px; letter-spacing: 1px; }
  .wc-dot { width: 8px; height: 8px; border-radius: 50%; background: #00cc66; box-shadow: 0 0 8px #00cc66; }
  .wc-tier { font-size: 8px; background: rgba(255,200,0,.15); color: #c8a000; padding: 2px 6px; letter-spacing: 1px; }

  .rb-sm { width: 120px; height: 120px; }
  .rb-arrow { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 28px; font-weight: 900; color: #282D35; }

  .fc-team { width: 100%; flex-basis: 100%; display: flex; flex-direction: column; border-top: 2px solid #282D35; }
  .team-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(40,45,53,.12); }
  .team-name { font-family: var(--fd), sans-serif; font-size: 12px; font-weight: 900; letter-spacing: 2px; color: #282D35; }
  .team-role { font-family: var(--fm), sans-serif; font-size: 11px; font-weight: 600; color: rgba(40,45,53,.45); letter-spacing: .5px; text-transform: uppercase; }

  /* ═══ FOOTER ═══ */
  .footer {
    background: #1a1e24;
    border-top: 3px solid rgba(240,236,217,.08);
    padding: 30px 40px 20px;
    display: flex; flex-direction: column; gap: 20px;
  }
  .footer-top {
    display: flex; align-items: center; justify-content: space-between;
    flex-wrap: wrap; gap: 16px;
  }
  .footer-logo {
    font-family: var(--fd), sans-serif; font-size: 20px; font-weight: 900;
    letter-spacing: 3px; color: #F0ECD9;
  }
  .footer-bolt { color: #D93535; }
  .footer-links {
    display: flex; gap: 6px; flex-wrap: wrap;
  }
  .footer-links button {
    font-family: var(--fm), sans-serif; font-size: 9px; font-weight: 700;
    letter-spacing: 2px; color: rgba(240,236,217,.4);
    background: none; border: 1px solid rgba(240,236,217,.08);
    padding: 6px 12px; cursor: pointer; transition: all .15s;
  }
  .footer-links button:hover {
    color: #F0ECD9; border-color: rgba(240,236,217,.25);
  }
  .footer-bottom {
    display: flex; justify-content: space-between; align-items: center;
    flex-wrap: wrap; gap: 8px;
    padding-top: 16px; border-top: 1px solid rgba(240,236,217,.06);
  }
  .footer-copy {
    font-family: var(--fm), sans-serif; font-size: 9px; font-weight: 600;
    letter-spacing: 1.5px; color: rgba(240,236,217,.25);
  }
  .footer-tagline {
    font-family: Georgia, serif; font-style: italic; font-size: 10px;
    color: rgba(240,236,217,.2);
  }

  /* ═══ RESPONSIVE ═══ */
  @media (max-width: 900px) {
    .hero { flex-direction: column; }
    .hero-left { padding: 50px 24px 30px; }
    .hero-divider { width: 100%; height: 40px; flex-direction: row; border-left: none; border-right: none; border-top: 2px solid rgba(240,236,217,.12); border-bottom: 2px solid rgba(240,236,217,.12); }
    .vt { writing-mode: horizontal-tb; text-orientation: initial; padding: 0 8px; }
    .hero-right { width: 100%; max-width: 100%; }
    .about-badge-area { flex-direction: column; align-items: center; }
    .about { padding: 40px 24px 30px; }
    .feed { flex-direction: column; }
    .feed-left { padding: 30px 24px; }
    .footer-cta { padding: 30px 24px; }
    .panel { min-height: auto; }
  }

  @media (max-width: 640px) {
    .hero-left { padding: 40px 16px 20px; }
    .ht-sm { font-size: 28px; } .ht-md { font-size: 36px; }
    .ht-xl { font-size: 64px; } .ht-xxl { font-size: 72px; }
    .hero-mascot { width: 80px; }
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
    .fc-dark { font-size: 48px; } .fc-red { font-size: 60px; }
    .fc-mascot { width: 120px; }
    .wallet-btn { font-size: 11px; padding: 12px 20px; letter-spacing: 2px; }
  }

  @media (max-width: 400px) {
    .ht-sm { font-size: 22px; } .ht-md { font-size: 28px; }
    .ht-xl { font-size: 48px; } .ht-xxl { font-size: 56px; }
    .hero-mascot { width: 60px; }
    .about-text p { font-size: 16px; }
    .fc-dark { font-size: 36px; } .fc-red { font-size: 48px; }
  }
</style>
