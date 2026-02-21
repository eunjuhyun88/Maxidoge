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
  $: trackedSigs = $activeSignalCount;

  $: btcPrice = state.prices.BTC;
  $: ethPrice = state.prices.ETH;
  $: solPrice = state.prices.SOL;

  function enterArena() { goto('/arena'); }
  function enterTerminal() { goto('/terminal'); }

  const FEATURES = [
    { label: 'WAR ROOM', sub: 'TERMINAL', img: '/blockparty/f5-doge-chart.png', path: '/terminal',
      detail: 'REAL-TIME CHARTS, ORDER FLOW, AND AI-POWERED MARKET ANALYSIS. YOUR COMMAND CENTER FOR DOMINATING THE MARKET.',
      stats: [{ k: 'LIVE FEEDS', v: '24/7' }, { k: 'AI AGENTS', v: '7' }, { k: 'PAIRS', v: '200+' }] },
    { label: 'BOSS FIGHT', sub: 'ARENA', img: '/blockparty/f5-doge-muscle.png', path: '/arena',
      detail: '11-PHASE TRADING ARENA WHERE YOU BATTLE AI DOGS. PREDICT, COMPETE, AND CLIMB THE LEADERBOARD.',
      stats: [{ k: 'PHASES', v: '11' }, { k: 'OPPONENTS', v: '7 AI' }, { k: 'REWARDS', v: 'XP+RANK' }] },
    { label: 'AI SIGNALS', sub: 'SIGNALS', img: '/blockparty/f5-doge-fire.png', path: '/signals',
      detail: 'AI-GENERATED TRADE SIGNALS WITH CONFIDENCE SCORES. TRACK, FOLLOW, AND BUILD YOUR PORTFOLIO.',
      stats: [{ k: 'ACCURACY', v: '85%+' }, { k: 'DAILY', v: '50+' }, { k: 'LATENCY', v: '<1s' }] },
    { label: 'COMMUNITY', sub: 'HUB', img: '/blockparty/f5-doge-excited.png', path: '/signals',
      detail: 'SHARE STRATEGIES, DISCUSS MARKETS, AND CONNECT WITH FELLOW DEGENS IN THE PACK.',
      stats: [{ k: 'MEMBERS', v: '10K+' }, { k: 'POSTS', v: '1K/DAY' }, { k: 'VIBES', v: 'MAX' }] },
  ];

  let selectedFeature: number | null = null;

  function selectFeature(i: number) {
    selectedFeature = selectedFeature === i ? null : i;
  }

  const FLOW_STEPS = [
    { num: '01', title: 'CONNECT', desc: 'LINK WALLET & CREATE PROFILE', img: '/blockparty/f5-doge-excited.png', pct: 100 },
    { num: '02', title: 'ANALYZE', desc: 'AI AGENTS SCAN MARKETS LIVE', img: '/blockparty/f5-doge-chart.png', pct: 85 },
    { num: '03', title: 'BATTLE', desc: 'COMPETE VS AI IN THE ARENA', img: '/blockparty/f5-doge-muscle.png', pct: 70 },
    { num: '04', title: 'EARN', desc: 'RANK UP & CLAIM REWARDS', img: '/blockparty/f5-doge-bull.png', pct: 95 },
  ];

  /* ── Animation system ── */
  let homeEl: HTMLDivElement;
  let heroReady = false;

  function onScroll() {
    if (!homeEl) return;
    const vh = homeEl.clientHeight;
    const pxEls = homeEl.querySelectorAll<HTMLElement>('[data-px]');
    for (const el of pxEls) {
      const speed = parseFloat(el.dataset.px || '0.12');
      const rect = el.getBoundingClientRect();
      const offset = (rect.top - vh / 2) * speed;
      el.style.transform = `translate3d(0, ${offset}px, 0)`;
    }
  }

  onMount(() => {
    // Hero intro: direct DOM add to bypass Svelte scoping
    setTimeout(() => {
      const heroEl = document.querySelector('.hero');
      if (heroEl) heroEl.classList.add('hero-go');
    }, 300);

    // Setup scroll & observer
    if (!homeEl) return;
    homeEl.addEventListener('scroll', onScroll, { passive: true });

    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            (e.target as HTMLElement).classList.add('vis');
            obs.unobserve(e.target);
          }
        }
      },
      { root: homeEl, threshold: 0.01 }
    );
    // Delay observer setup to let DOM settle
    requestAnimationFrame(() => {
      homeEl.querySelectorAll('.sr').forEach((el) => obs.observe(el));
    });

    return () => {
      homeEl.removeEventListener('scroll', onScroll);
      obs.disconnect();
    };
  });
</script>

<div class="home" bind:this={homeEl}>
  <!-- Stars layer -->
  <div class="stars" aria-hidden="true"></div>
  <div class="stars2" aria-hidden="true"></div>

  <!-- ═══════════════════════════════════════
       SECTION 1: HERO
       ═══════════════════════════════════════ -->
  <section class="hero" class:hero-go={heroReady}>
    <div class="hero-left">
      {#if selectedFeature !== null}
        <!-- Feature detail view -->
        <div class="feat-detail">
          <button class="feat-back" on:click={() => selectedFeature = null}>← BACK</button>
          <span class="htag">//{FEATURES[selectedFeature].sub}</span>
          <div class="ht feat-detail-img">
            <img src={FEATURES[selectedFeature].img} alt="" />
          </div>
          <h2 class="feat-detail-title">{FEATURES[selectedFeature].label}</h2>
          <p class="feat-detail-desc">{FEATURES[selectedFeature].detail}</p>
          <div class="feat-detail-stats">
            {#each FEATURES[selectedFeature].stats as s}
              <div class="fds">
                <span class="fds-v">{s.v}</span>
                <span class="fds-k">{s.k}</span>
              </div>
            {/each}
          </div>
          <button class="feat-detail-cta" on:click={() => goto(FEATURES[selectedFeature ?? 0].path)}>
            ENTER {FEATURES[selectedFeature].sub} →
          </button>
        </div>
      {:else}
        <!-- Default hero content -->
        <div class="hero-stack">
          <span class="htag ha" style="--ha-d:0s">//MAXI⚡DOGE PRESENTS</span>
          <span class="hl hl-sm ha" style="--ha-d:0.12s">A NEW</span>
          <span class="hl hl-pk ha" style="--ha-d:0.24s">DOGE</span>
          <span class="hl hl-xl ha" style="--ha-d:0.36s">RUN</span>
          <div class="hl-row ha" style="--ha-d:0.48s">
            <span class="hl hl-sm">GAME</span>
            <div class="ht hero-doge-wrap">
              <img src="/blockparty/f5-doge-bull.png" alt="doge" class="hero-doge" />
            </div>
          </div>
        </div>
        <div class="rbadges ha" style="--ha-d:0.6s">
          <div class="rbdg rbdg-l">
            <span class="rbdg-stars">★★★★★</span>
            <span class="rbdg-src">— DEGENS</span>
          </div>
          <div class="rbdg rbdg-r">
            <span class="rbdg-label">BEST AI DOGS</span>
            <span class="rbdg-src">— CRYPTO TWITTER</span>
          </div>
        </div>
      {/if}
    </div>

    <div class="hero-div">
      {#each Array(8) as _}<span class="vt">FEATURES</span>{/each}
    </div>

    <div class="hero-right">
      {#each FEATURES as feat, i}
        <button
          class="fc ha ha-r"
          class:fc-active={selectedFeature === i}
          style="--ha-d:{0.2 + i * 0.12}s"
          on:click={() => selectFeature(i)}
        >
          <div class="fc-img"><div class="ht"><img src={feat.img} alt="" /></div></div>
          <div class="fc-txt">
            <span class="fc-sub">{feat.sub}</span>
            <h3 class="fc-lbl">{feat.label}</h3>
          </div>
        </button>
      {/each}
      <button class="fc-all ha ha-r" style="--ha-d:0.7s" on:click={enterTerminal}>
        VIEW ALL <span class="fc-arr">→</span>
      </button>
    </div>

    <!-- Perspective grid floor -->
    <div class="grid-floor" aria-hidden="true"></div>
  </section>

  <!-- ═══════════════════════════════════════
       SECTION 2: FLOW — MISSION STAGES
       ═══════════════════════════════════════ -->
  <section class="flow">
    <div class="flow-header">
      <span class="flow-tag sr sr-r">//MISSION STAGES</span>
      <h2 class="flow-title sr sr-r" style="--d:0.08s" data-px="0.06">
        <span class="ft-w">HOW IT</span>
        <span class="ft-pk">WORKS</span>
      </h2>
      <p class="flow-sub sr sr-r" style="--d:0.18s">4 STEPS TO DEGEN GLORY</p>
    </div>

    <div class="flow-steps">
      {#each FLOW_STEPS as step, i}
        <div class="fstep sr sr-r" style="--d:{0.1 + i * 0.12}s">
          <div class="fstep-num">{step.num}</div>
          <div class="fstep-body">
            <h3 class="fstep-title">{step.title}</h3>
            <p class="fstep-desc">{step.desc}</p>
            <div class="fstep-bar"><div class="fstep-fill" style="width:{step.pct}%"></div></div>
          </div>
          <div class="ht fstep-imgwrap"><img src={step.img} alt="" class="fstep-img" /></div>
        </div>
      {/each}
    </div>
  </section>

  <!-- ═══════════════════════════════════════
       SECTION 3: ABOUT
       ═══════════════════════════════════════ -->
  <section class="about">
    <div class="about-inner">
      <div class="about-badge sr sl">
        <svg viewBox="0 0 200 200" class="badge-svg">
          <defs><path id="cp" d="M100,100 m-75,0 a75,75 0 1,1 150,0 a75,75 0 1,1 -150,0"/></defs>
          <text><textPath href="#cp" class="badge-txt">MUCH WOW ✦ MUCH WOW ✦ MUCH WOW ✦ MUCH WOW ✦</textPath></text>
        </svg>
        <div class="ht badge-face-wrap"><img src="/blockparty/f5-doge-face.png" alt="" class="badge-face" /></div>
      </div>

      <div class="about-text sr sr-r" style="--d:0.15s">
        <p>
          <strong class="ab">FOR</strong>
          <em class="ai">every</em>
          <strong class="ab abg">DEGEN,</strong>
          <span class="ar">WE'VE BEEN</span>
          <strong class="ab abg">BUILDING,</strong>
          <em class="ai">training</em>
          <strong class="ab abg">AI DOGS,</strong>
          <span class="ar">SCANNING</span>
          <strong class="ab abg">MARKETS,</strong>
          <span class="as">GENERATING</span>
          <strong class="ab abg">SIGNALS,</strong>
          <span class="ar">AND</span>
          <strong class="ab abg">CRAFTING</strong>
          <em class="ai">relatable</em>
          <span class="ar">MEMES FOR</span>
          <strong class="ab abx">BIG</strong>
          <span class="as">(AND TINY)</span>
          <strong class="ab abx">GAINS.</strong>
        </p>
      </div>
    </div>
    <div class="about-tag sr su" style="--d:0.3s">WE AIN'T NO ORDINARY DOGS.</div>
  </section>

  <!-- ═══════════════════════════════════════
       SECTION 4: SQUAD — CHARACTER SELECT
       ═══════════════════════════════════════ -->
  <section class="squad">
    <span class="sq-tag sr sl">//CHARACTER SELECT</span>
    <h2 class="sq-title sr sl" style="--d:0.06s" data-px="0.05">
      <span class="sq-w">THE</span>
      <span class="sq-pk">SQUAD</span>
    </h2>
    <p class="sq-sub sr sr-r" style="--d:0.1s">7 AI DOGS THAT EAT THE MARKET ALIVE</p>

    <div class="sq-frame">
      <div class="sq-grid">
        {#each AGDEFS as ag, i}
          <div class="sq-card sr sr-r" style="--ac:{ag.color};--d:{i * 0.07}s">
            <div class="ht sq-av-wrap"><img src={ag.img.def} alt={ag.name} class="sq-av" /></div>
            <div class="sq-info">
              <span class="sq-nm" style="color:var(--ac)">{ag.name}</span>
              <span class="sq-rl">{ag.role}</span>
              <div class="sq-bar"><div class="sq-fill" style="width:{ag.conf}%;background:var(--ac)"></div></div>
            </div>
            <div class="sq-pct">{ag.conf}%</div>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- ═══════════════════════════════════════
       SECTION 5: FEED
       ═══════════════════════════════════════ -->
  <section class="feed">
    <div class="feed-l">
      <span class="fd-line fd-w sr sl">IN YOUR</span>
      <span class="fd-line fd-pk sr sl" style="--d:0.15s">FEED</span>
      <div class="ht feed-doge-wrap sr sl" style="--d:0.3s"><img src="/blockparty/f5-doge-fire.png" alt="" class="feed-doge" /></div>
    </div>
    <div class="feed-r">
      <button class="arena sr sr-r" on:click={enterArena}>
        <div class="arena-row">
          <div class="ht arena-img-wrap"><img src="/blockparty/f5-doge-muscle.png" alt="" class="arena-img" /></div>
          <div class="arena-mid">
            <span class="arena-tag">BOSS FIGHT</span>
            <h3 class="arena-name">ARENA</h3>
            <p class="arena-sub">7 AI DOGS vs YOU</p>
          </div>
          <div class="ht arena-img-wrap"><img src="/blockparty/f5-doge-bull.png" alt="" class="arena-img" /></div>
        </div>
        <div class="arena-ft"><span>11-PHASE</span><span>7 AGENTS</span><span>RANKING</span></div>
      </button>

      <div class="ticker sr sr-r" style="--d:0.12s">
        <div class="tk"><span class="tk-s">₿</span><span class="tk-n">BTC</span><span class="tk-v">${btcPrice.toLocaleString()}</span></div>
        <div class="tk-sep"></div>
        <div class="tk"><span class="tk-s tk-eth">Ξ</span><span class="tk-n">ETH</span><span class="tk-v">${ethPrice.toLocaleString()}</span></div>
        <div class="tk-sep"></div>
        <div class="tk"><span class="tk-s tk-sol">◎</span><span class="tk-n">SOL</span><span class="tk-v">${solPrice.toLocaleString()}</span></div>
      </div>

      <div class="qg sr sr-r" style="--d:0.24s">
        <button class="qn" on:click={() => goto('/terminal')}>TERMINAL</button>
        <button class="qn" on:click={() => goto('/passport')}>PASSPORT</button>
        <button class="qn" on:click={() => goto('/oracle')}>ORACLE</button>
        <button class="qn" on:click={() => goto('/signals')}>SIGNALS {#if trackedSigs > 0}<span class="qn-b">{trackedSigs}</span>{/if}</button>
        <button class="qn" on:click={() => goto('/signals')}>COMMUNITY</button>
      </div>
    </div>
  </section>

  <!-- ═══════════════════════════════════════
       SECTION 6: CTA
       ═══════════════════════════════════════ -->
  <section class="cta">
    <div class="cta-l">
      <span class="cta-txt cta-w sr sl">JOIN</span>
      <span class="cta-txt cta-w sr sl" style="--d:0.1s">THE</span>
      <span class="cta-txt cta-pk sr sl" style="--d:0.2s">PACK</span>
      <div class="cta-det sr sl" style="--d:0.3s">
        <span class="cta-brand">MAXI⚡DOGE</span>
        <span class="cta-loc">AI TRADING PLATFORM</span>
      </div>
    </div>
    <div class="cta-r">
      <div class="ht cta-doge-wrap sr sr-r"><img src="/blockparty/f5-doge-excited.png" alt="" class="cta-doge" /></div>
      {#if !connected}
        <button class="cta-btn sr sr-r" style="--d:0.15s" on:click={openWalletModal}>⚡ CONNECT WALLET</button>
      {:else}
        <div class="cta-connected sr sr-r" style="--d:0.15s">
          <span class="wc-dot"></span>
          <span>{wallet.shortAddr}</span>
          <span class="wc-tier">{profile.tier.toUpperCase()}</span>
        </div>
      {/if}
    </div>
    <div class="grid-floor grid-floor-cta" aria-hidden="true"></div>
  </section>

  <!-- ═══ FOOTER ═══ -->
  <footer class="foot">
    <div class="foot-top">
      <div class="foot-logo" data-px="-0.04">MAXI<span class="foot-bolt">⚡</span>DOGE</div>
      <div class="foot-nav">
        <button on:click={() => goto('/terminal')}>TERMINAL</button>
        <button on:click={() => goto('/arena')}>ARENA</button>
        <button on:click={() => goto('/signals')}>SIGNALS</button>
        <button on:click={() => goto('/passport')}>PASSPORT</button>
        <button on:click={() => goto('/oracle')}>ORACLE</button>
        <button on:click={() => goto('/signals')}>COMMUNITY</button>
      </div>
    </div>
    <div class="foot-bot">
      <span class="foot-copy">© 2025 MAXI⚡DOGE. ALL RIGHTS RESERVED.</span>
      <span class="foot-tag">such AI. very trade. much profit. wow.</span>
    </div>
  </footer>
</div>

<style>
  /* ═══════════════════════════════════════════════
     MAXI⚡DOGE — LOOX LOST-IN-SPACE STYLE
     Dark green-black + Salmon pink retro game
     ═══════════════════════════════════════════════ */

  /* ── PALETTE ── */
  :root {
    --sp-bg: #0a1a0d;
    --sp-bg2: #0f2614;
    --sp-pk: #E8967D;
    --sp-pk-l: #F5C4B8;
    --sp-w: #F0EDE4;
    --sp-dim: rgba(240,237,228,0.4);
    --sp-glow: rgba(232,150,125,0.5);
    --sp-grid: rgba(232,150,125,0.12);
  }

  /* ── BASE ── */
  .home {
    width: 100%; height: 100%;
    overflow-y: auto; overflow-x: hidden;
    background: var(--sp-bg);
    display: flex; flex-direction: column;
    position: relative;
  }
  .home::-webkit-scrollbar { width: 4px; }
  .home::-webkit-scrollbar-thumb { background: var(--sp-pk); border-radius: 4px; }

  /* ── STARS ── */
  .stars, .stars2 {
    position: fixed; inset: 0;
    pointer-events: none; z-index: 0;
  }
  .stars {
    background:
      radial-gradient(1px 1px at 10% 15%, rgba(255,255,255,0.7) 50%, transparent 50%),
      radial-gradient(1px 1px at 25% 35%, rgba(255,255,255,0.5) 50%, transparent 50%),
      radial-gradient(1.5px 1.5px at 40% 8%, rgba(255,255,255,0.8) 50%, transparent 50%),
      radial-gradient(1px 1px at 55% 60%, rgba(255,255,255,0.4) 50%, transparent 50%),
      radial-gradient(1px 1px at 70% 22%, rgba(255,255,255,0.6) 50%, transparent 50%),
      radial-gradient(1.5px 1.5px at 85% 45%, rgba(255,255,255,0.7) 50%, transparent 50%),
      radial-gradient(1px 1px at 15% 70%, rgba(255,255,255,0.5) 50%, transparent 50%),
      radial-gradient(1px 1px at 92% 80%, rgba(255,255,255,0.6) 50%, transparent 50%),
      radial-gradient(1.5px 1.5px at 5% 90%, rgba(255,255,255,0.4) 50%, transparent 50%),
      radial-gradient(1px 1px at 48% 42%, rgba(255,255,255,0.5) 50%, transparent 50%),
      radial-gradient(1px 1px at 78% 68%, rgba(255,255,255,0.3) 50%, transparent 50%),
      radial-gradient(1px 1px at 33% 88%, rgba(255,255,255,0.6) 50%, transparent 50%);
    background-size: 300px 300px;
  }
  .stars2 {
    background:
      radial-gradient(1px 1px at 62% 18%, rgba(135,220,190,0.6) 50%, transparent 50%),
      radial-gradient(1px 1px at 28% 52%, rgba(135,220,190,0.4) 50%, transparent 50%),
      radial-gradient(1.5px 1.5px at 82% 72%, rgba(135,220,190,0.5) 50%, transparent 50%),
      radial-gradient(1px 1px at 45% 92%, rgba(135,220,190,0.3) 50%, transparent 50%),
      radial-gradient(1px 1px at 8% 38%, rgba(135,220,190,0.5) 50%, transparent 50%);
    background-size: 500px 500px;
    animation: twinkle 4s ease-in-out infinite alternate;
  }
  @keyframes twinkle { 0% { opacity: 0.4; } 100% { opacity: 1; } }

  /* ── HALFTONE OVERLAY ── */
  .ht {
    position: relative; overflow: hidden; display: inline-block;
  }
  .ht img {
    filter: contrast(1.3) brightness(1.1) sepia(0.8) hue-rotate(-25deg) saturate(1.6);
    display: block;
  }
  .ht::after {
    content: '';
    position: absolute; inset: 0;
    background: radial-gradient(circle, rgba(10,26,13,0.35) 1px, transparent 1px);
    background-size: 4px 4px;
    mix-blend-mode: multiply;
    pointer-events: none;
  }

  /* ── PERSPECTIVE GRID FLOOR ── */
  .grid-floor {
    position: absolute; bottom: 0; left: -20%; right: -20%;
    height: 35%; z-index: 1; pointer-events: none;
    background:
      linear-gradient(90deg, var(--sp-grid) 1px, transparent 1px),
      linear-gradient(0deg, var(--sp-grid) 1px, transparent 1px);
    background-size: 60px 40px;
    transform: perspective(400px) rotateX(55deg);
    transform-origin: center top;
  }
  .grid-floor::before {
    content: '';
    position: absolute; top: 0; left: 0; right: 0; height: 3px;
    background: var(--sp-pk);
    box-shadow: 0 0 15px var(--sp-pk), 0 0 40px var(--sp-glow), 0 0 80px rgba(232,150,125,0.2);
  }

  /* ════════════════════════════════════════════
     ANIMATION SYSTEM (same mechanics, new look)
     ════════════════════════════════════════════ */
  .sr {
    opacity: 0;
    transition: opacity 0.9s cubic-bezier(.16,1,.3,1), transform 0.9s cubic-bezier(.16,1,.3,1);
    transition-delay: var(--d, 0s);
    will-change: opacity, transform;
  }
  .sl  { transform: translateX(-140px); }
  .sr-r { transform: translateX(160px); }
  .su  { transform: translateY(80px); }
  :global(.vis) {
    opacity: 1 !important;
    transform: translateX(0) translateY(0) scale(1) !important;
  }

  .ha {
    opacity: 0;
    transform: translateX(-100px);
    transition: opacity 0.9s cubic-bezier(.16,1,.3,1),
                transform 0.9s cubic-bezier(.16,1,.3,1);
    transition-delay: var(--ha-d, 0s);
  }
  .ha-r { transform: translateX(120px); }
  :global(.hero-go .ha) { opacity: 1 !important; transform: translateX(0) !important; }

  /* ═══ HERO ═══ */
  .hero {
    display: flex;
    border-bottom: 2px solid rgba(232,150,125,0.2);
    position: relative;
    min-height: 100vh;
    z-index: 2;
    align-items: flex-start; /* let sticky children anchor to top */
  }

  .hero-left {
    flex: 1.1;
    display: flex; flex-direction: column; align-items: flex-start; justify-content: center;
    padding: 60px 40px 120px;
    position: sticky; top: 36px; /* stick below header */
    height: calc(100vh - 36px);
    z-index: 3;
  }

  .hero-stack {
    display: flex; flex-direction: column; line-height: 1;
    position: relative; z-index: 3;
  }
  .htag {
    font-family: var(--fp); font-size: 10px;
    color: var(--sp-pk); letter-spacing: 2px;
    margin-bottom: 16px;
  }
  .hl {
    font-family: var(--fp); font-weight: 400;
    color: var(--sp-w); display: block;
    text-shadow: 0 0 10px rgba(240,237,228,0.3);
  }
  .hl-sm { font-size: clamp(18px, 3vw, 32px); margin-bottom: 8px; }
  .hl-xl { font-size: clamp(48px, 9vw, 100px); letter-spacing: 6px; }
  .hl-pk {
    font-size: clamp(52px, 10vw, 120px); letter-spacing: 4px;
    color: var(--sp-pk);
    text-shadow: 0 0 20px var(--sp-pk), 0 0 60px var(--sp-glow), 0 0 120px rgba(232,150,125,0.15);
  }
  .hl-row { display: flex; align-items: center; gap: 12px; }

  .hero-doge-wrap { flex-shrink: 0; }
  .hero-doge {
    width: clamp(80px, 12vw, 160px); height: auto; object-fit: contain;
    animation: bob 3s ease-in-out infinite;
  }
  @keyframes bob {
    0%,100% { transform: translateY(0) rotate(0); }
    50% { transform: translateY(-8px) rotate(2deg); }
  }

  /* Review badges */
  .rbadges {
    display: flex; gap: 20px; margin-top: 30px; flex-wrap: wrap;
  }
  .rbdg {
    display: flex; flex-direction: column; gap: 2px;
  }
  .rbdg-stars {
    font-family: var(--fp); font-size: 12px;
    color: var(--sp-pk); letter-spacing: 2px;
  }
  .rbdg-label {
    font-family: var(--fp); font-size: 9px;
    color: var(--sp-pk); letter-spacing: 1px;
    text-shadow: 0 0 10px var(--sp-glow);
  }
  .rbdg-src {
    font-family: var(--fp); font-size: 7px;
    color: var(--sp-w); letter-spacing: 2px; opacity: 0.6;
  }

  /* Vertical divider */
  .hero-div {
    width: 40px;
    border-left: 1px solid rgba(232,150,125,0.15);
    border-right: 1px solid rgba(232,150,125,0.15);
    display: flex; flex-direction: column; align-items: center;
    overflow: hidden; flex-shrink: 0; z-index: 3;
  }
  .vt {
    font-family: var(--fp); font-size: 7px;
    color: rgba(232,150,125,0.2);
    writing-mode: vertical-rl; text-orientation: mixed;
    white-space: nowrap; padding: 8px 0;
  }

  /* Feature cards (right column) — independent scroll within hero */
  .hero-right {
    width: 400px; max-width: 38%;
    background: var(--sp-bg2);
    border-left: 1px solid rgba(232,150,125,0.1);
    display: flex; flex-direction: column;
    flex-shrink: 0;
    position: sticky; top: 36px;
    z-index: 3;
    overflow-y: auto;
    max-height: calc(100vh - 36px);
  }
  .hero-right::-webkit-scrollbar { width: 3px; }
  .hero-right::-webkit-scrollbar-thumb { background: var(--sp-pk); }

  .fc {
    display: flex; flex-direction: column; background: transparent;
    border: none; border-bottom: 1px solid rgba(232,150,125,0.1);
    cursor: pointer; padding: 0; text-align: left;
    transition: background .2s;
  }
  .fc:hover { background: rgba(232,150,125,0.04); }
  .fc-img {
    width: 100%; aspect-ratio: 16/10; overflow: hidden;
    display: flex; align-items: center; justify-content: center;
    background: rgba(232,150,125,0.02);
    border-bottom: 1px solid rgba(232,150,125,0.06);
  }
  .fc-img .ht { width: 55%; }
  .fc-img img {
    width: 100%; max-height: 80%; object-fit: contain;
    transition: transform .4s cubic-bezier(.22,1,.36,1);
  }
  .fc:hover .fc-img img { transform: scale(1.1) rotate(-2deg); }
  .fc-txt { padding: 12px 20px 16px; }
  .fc-sub {
    font-family: var(--fp); font-size: 7px;
    color: var(--sp-dim); letter-spacing: 2px;
  }
  .fc-lbl {
    font-family: var(--fp); font-size: 12px;
    color: var(--sp-pk); letter-spacing: 1px; line-height: 1.4; margin-top: 4px;
    text-shadow: 0 0 10px var(--sp-glow);
  }
  .fc-all {
    display: flex; align-items: center; justify-content: space-between;
    padding: 20px; background: transparent; border: none; cursor: pointer;
    font-family: var(--fp); font-size: 8px;
    letter-spacing: 2px; color: var(--sp-w); transition: color .15s;
    border-top: 1px solid rgba(232,150,125,0.08);
  }
  .fc-all:hover { color: var(--sp-pk); }
  .fc-arr { font-size: 16px; }

  /* Active card highlight */
  .fc-active { background: rgba(232,150,125,0.08); border-left: 3px solid var(--sp-pk); }
  .fc-active .fc-lbl { text-shadow: 0 0 15px var(--sp-pk), 0 0 40px var(--sp-glow); }

  /* ═══ FEATURE DETAIL (left panel) ═══ */
  .feat-detail {
    display: flex; flex-direction: column; align-items: flex-start;
    gap: 16px; position: relative; z-index: 3;
    animation: fadeSlideIn 0.35s cubic-bezier(.16,1,.3,1);
  }
  @keyframes fadeSlideIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .feat-back {
    font-family: var(--fp); font-size: 8px;
    color: var(--sp-dim); letter-spacing: 2px;
    background: none; border: 1px solid rgba(232,150,125,0.15);
    padding: 6px 14px; cursor: pointer; border-radius: 4px;
    transition: all .15s;
  }
  .feat-back:hover { color: var(--sp-pk); border-color: var(--sp-pk); }
  .feat-detail-img { width: clamp(100px, 18vw, 200px); }
  .feat-detail-img img { width: 100%; object-fit: contain; }
  .feat-detail-title {
    font-family: var(--fp); font-size: clamp(28px, 5vw, 52px);
    color: var(--sp-pk); letter-spacing: 4px; line-height: 1;
    text-shadow: 0 0 20px var(--sp-pk), 0 0 60px var(--sp-glow);
  }
  .feat-detail-desc {
    font-family: var(--fp); font-size: 9px;
    color: var(--sp-w); letter-spacing: 1px; line-height: 1.8;
    max-width: 400px; opacity: 0.8;
  }
  .feat-detail-stats {
    display: flex; gap: 20px; margin-top: 8px;
  }
  .fds {
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    padding: 10px 16px;
    background: rgba(232,150,125,0.06);
    border: 1px solid rgba(232,150,125,0.15);
    border-radius: 8px;
  }
  .fds-v {
    font-family: var(--fp); font-size: 16px;
    color: var(--sp-pk); letter-spacing: 1px;
    text-shadow: 0 0 8px var(--sp-glow);
  }
  .fds-k {
    font-family: var(--fp); font-size: 6px;
    color: var(--sp-dim); letter-spacing: 2px;
  }
  .feat-detail-cta {
    font-family: var(--fp); font-size: 9px; letter-spacing: 2px;
    color: var(--sp-bg); background: var(--sp-pk);
    border: none; border-radius: 6px;
    padding: 12px 24px; cursor: pointer; margin-top: 8px;
    transition: all .2s;
    box-shadow: 0 0 15px var(--sp-glow);
  }
  .feat-detail-cta:hover { transform: translateY(-2px); box-shadow: 0 0 25px var(--sp-pk); }

  /* ═══ FLOW — MISSION STAGES ═══ */
  .flow {
    background: var(--sp-bg2); padding: 80px 40px;
    border-bottom: 2px solid rgba(232,150,125,0.15);
    position: relative; overflow: hidden; z-index: 2;
    min-height: 80vh;
  }
  .flow-header { text-align: center; margin-bottom: 50px; position: relative; z-index: 2; }
  .flow-tag {
    font-family: var(--fp); font-size: 9px;
    color: var(--sp-pk); letter-spacing: 2px;
    display: block; margin-bottom: 12px;
    text-shadow: 0 0 10px var(--sp-glow);
  }
  .flow-title {
    font-family: var(--fp); line-height: 1.4;
  }
  .ft-w { font-size: clamp(20px, 4vw, 36px); color: var(--sp-w); display: block; }
  .ft-pk {
    font-size: clamp(28px, 6vw, 56px); color: var(--sp-pk); display: block;
    text-shadow: 0 0 20px var(--sp-pk), 0 0 60px var(--sp-glow);
  }
  .flow-sub {
    font-family: var(--fp); font-size: 8px;
    color: var(--sp-dim); letter-spacing: 3px; margin-top: 12px;
  }

  .flow-steps {
    max-width: 900px; margin: 0 auto;
    display: flex; flex-direction: column; gap: 0;
    position: relative; z-index: 2;
  }

  .fstep {
    display: flex; align-items: center; gap: 24px;
    padding: 28px 24px;
    border-bottom: 1px solid rgba(232,150,125,0.1);
    position: relative;
  }
  .fstep:last-child { border-bottom: none; }

  .fstep-num {
    font-family: var(--fp); font-size: 32px;
    color: var(--sp-pk); opacity: 0.2;
    flex-shrink: 0; line-height: 1; min-width: 70px; text-align: center;
  }
  .fstep-body { flex: 1; min-width: 0; }
  .fstep-title {
    font-family: var(--fp); font-size: clamp(14px, 2.5vw, 24px);
    color: var(--sp-pk); letter-spacing: 3px; line-height: 1;
    text-shadow: 0 0 10px var(--sp-glow);
  }
  .fstep-desc {
    font-family: var(--fp); font-size: 7px;
    color: var(--sp-dim); letter-spacing: 1px; margin-top: 8px; line-height: 1.6;
  }
  /* Stat bar */
  .fstep-bar {
    width: 100%; max-width: 200px; height: 8px; margin-top: 10px;
    background: rgba(232,150,125,0.1);
    border: 1px solid rgba(232,150,125,0.2);
    overflow: hidden;
  }
  .fstep-fill {
    height: 100%;
    background: var(--sp-pk);
    box-shadow: 0 0 6px var(--sp-glow);
    transition: width 1s ease-out;
  }

  .fstep-imgwrap { flex-shrink: 0; width: 80px; height: 80px; }
  .fstep-img {
    width: 100%; height: 100%; object-fit: contain;
    transition: transform .3s;
  }
  .fstep:hover .fstep-img { transform: scale(1.1) rotate(-3deg); }

  /* ═══ ABOUT ═══ */
  .about {
    background: var(--sp-bg);
    padding: 90px 40px 60px;
    display: flex; flex-direction: column; align-items: center;
    border-bottom: 2px solid rgba(232,150,125,0.15);
    position: relative; overflow: hidden; z-index: 2;
    min-height: 60vh;
  }

  .about-inner {
    display: flex; align-items: flex-start; gap: 40px;
    max-width: 1100px; width: 100%; position: relative; z-index: 2;
  }

  .about-badge { position: relative; width: 180px; height: 180px; flex-shrink: 0; }
  .badge-svg { width: 100%; height: 100%; animation: spin 20s linear infinite; }
  .badge-txt { font-family: var(--fp); font-size: 10px; fill: var(--sp-pk); letter-spacing: 3px; }
  .badge-face-wrap {
    position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
    width: 70px; height: 70px;
  }
  .badge-face { width: 100%; height: 100%; object-fit: contain; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .about-text { flex: 1; }
  .about-text p {
    font-family: var(--fv); font-size: 28px;
    line-height: 1.25; color: var(--sp-w); text-align: center;
  }
  .ab { font-weight: 700; text-transform: uppercase; }
  .ai { font-style: italic; font-weight: 400; font-family: Georgia, serif; font-size: .85em; color: var(--sp-pk-l); }
  .ar { font-weight: 700; font-size: .7em; letter-spacing: 2px; text-transform: uppercase; color: var(--sp-dim); }
  .as { font-weight: 700; font-size: .55em; letter-spacing: 3px; text-transform: uppercase; color: var(--sp-dim); }
  .abg { font-size: 1.15em; color: var(--sp-pk); text-shadow: 0 0 10px var(--sp-glow); }
  .abx { font-size: 1.4em; color: var(--sp-pk); text-shadow: 0 0 15px var(--sp-glow); }

  .about-tag {
    font-family: var(--fp); font-size: 8px;
    letter-spacing: 4px; color: var(--sp-dim); text-align: center;
    margin-top: 40px; padding-top: 20px;
    border-top: 1px solid rgba(232,150,125,0.08);
    width: 100%; max-width: 600px; position: relative; z-index: 2;
  }

  /* ═══ SQUAD — CHARACTER SELECT ═══ */
  .squad {
    background: var(--sp-bg2);
    padding: 70px 40px; position: relative; overflow: hidden; z-index: 2;
    border-bottom: 2px solid rgba(232,150,125,0.15);
    min-height: 70vh;
  }
  .sq-tag {
    font-family: var(--fp); font-size: 9px;
    color: var(--sp-pk); letter-spacing: 2px;
    display: block; text-align: center; margin-bottom: 10px;
    text-shadow: 0 0 10px var(--sp-glow);
  }
  .sq-title {
    font-family: var(--fp); font-size: clamp(24px, 5vw, 48px);
    line-height: 1.3; text-align: center;
    position: relative; z-index: 2;
  }
  .sq-w { color: var(--sp-w); display: block; }
  .sq-pk {
    color: var(--sp-pk); display: block;
    text-shadow: 0 0 20px var(--sp-pk), 0 0 60px var(--sp-glow);
  }
  .sq-sub {
    font-family: var(--fp); font-size: 7px;
    color: var(--sp-dim); letter-spacing: 2px; margin-top: 8px;
    text-align: center; margin-bottom: 30px; position: relative; z-index: 2;
  }

  /* Game frame around grid */
  .sq-frame {
    max-width: 960px; margin: 0 auto;
    border: 3px solid var(--sp-pk); border-radius: 20px;
    padding: 24px; position: relative; z-index: 2;
    background: rgba(232,150,125,0.02);
    box-shadow: 0 0 20px rgba(232,150,125,0.08), inset 0 0 20px rgba(232,150,125,0.03);
  }

  .sq-grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 10px;
  }
  .sq-card {
    display: flex; align-items: center; gap: 10px; padding: 12px 14px;
    background: var(--sp-bg);
    border: 1px solid rgba(232,150,125,0.15);
    border-radius: 8px;
    cursor: default; transition: transform .2s, box-shadow .2s;
  }
  .sq-card:hover { transform: translateY(-3px); box-shadow: 0 4px 20px rgba(232,150,125,0.12); }
  .sq-av-wrap { width: 44px; height: 44px; border-radius: 50%; overflow: hidden; flex-shrink: 0; border: 2px solid var(--ac); }
  .sq-av { width: 100%; height: 100%; object-fit: cover; }
  .sq-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
  .sq-nm { font-family: var(--fp); font-size: 7px; letter-spacing: 1px; }
  .sq-rl { font-family: var(--fv); font-size: 12px; color: var(--sp-dim); }
  .sq-bar { width: 100%; height: 4px; background: rgba(232,150,125,0.1); border-radius: 2px; margin-top: 3px; overflow: hidden; }
  .sq-fill { height: 100%; border-radius: 2px; box-shadow: 0 0 4px var(--sp-glow); }
  .sq-pct { font-family: var(--fp); font-size: 10px; color: var(--sp-pk); opacity: .6; margin-left: auto; }

  /* ═══ FEED ═══ */
  .feed {
    display: flex; background: var(--sp-bg);
    border-bottom: 2px solid rgba(232,150,125,0.15);
    overflow: hidden; z-index: 2;
    min-height: 80vh;
  }
  .feed-l {
    flex: 0 0 40%; display: flex; flex-direction: column;
    align-items: center; justify-content: center; padding: 40px;
    position: relative; overflow: hidden;
  }
  .fd-line {
    font-family: var(--fp); display: block;
    position: relative; z-index: 2; line-height: 1.2; text-align: center;
  }
  .fd-w { font-size: clamp(20px, 4vw, 36px); color: var(--sp-w); text-shadow: 0 0 10px rgba(240,237,228,0.3); }
  .fd-pk {
    font-size: clamp(36px, 8vw, 72px); color: var(--sp-pk); letter-spacing: 4px;
    text-shadow: 0 0 20px var(--sp-pk), 0 0 60px var(--sp-glow);
  }
  .feed-doge-wrap { width: clamp(120px, 16vw, 200px); margin-top: 20px; position: relative; z-index: 2; }
  .feed-doge {
    width: 100%; object-fit: contain;
    animation: bob 4s ease-in-out infinite;
  }
  .feed-r {
    flex: 1;
    background: var(--sp-bg2);
    border-left: 1px solid rgba(232,150,125,0.1);
    padding: 24px; display: flex; flex-direction: column; gap: 14px; overflow-y: auto;
  }

  .arena {
    background: var(--sp-bg); border: 2px solid rgba(232,150,125,0.2); border-radius: 12px;
    padding: 16px; cursor: pointer; transition: transform .2s, box-shadow .2s; width: 100%; text-align: left;
  }
  .arena:hover { transform: translateY(-2px); box-shadow: 0 4px 20px rgba(232,150,125,0.12); }
  .arena-row { display: flex; align-items: center; gap: 12px; }
  .arena-img-wrap { width: 60px; height: 60px; flex-shrink: 0; }
  .arena-img { width: 100%; height: 100%; object-fit: contain; }
  .arena-mid { flex: 1; text-align: center; }
  .arena-tag { font-family: var(--fp); font-size: 7px; color: var(--sp-dim); letter-spacing: 1px; }
  .arena-name {
    font-family: var(--fp); font-size: 18px; letter-spacing: 4px;
    color: var(--sp-pk); line-height: 1.4;
    text-shadow: 0 0 15px var(--sp-pk), 0 0 40px var(--sp-glow);
  }
  .arena-sub { font-family: var(--fp); font-size: 7px; color: var(--sp-dim); margin-top: 4px; }
  .arena-ft { display: flex; gap: 8px; justify-content: center; margin-top: 10px; }
  .arena-ft span {
    font-family: var(--fp); font-size: 6px; color: var(--sp-dim);
    background: rgba(232,150,125,0.06); padding: 4px 10px; border: 1px solid rgba(232,150,125,0.1);
    border-radius: 4px;
  }

  .ticker {
    display: flex; align-items: center; gap: 16px;
    padding: 14px 18px; background: var(--sp-bg);
    border: 1px solid rgba(232,150,125,0.15); border-radius: 8px;
  }
  .tk { display: flex; align-items: center; gap: 6px; }
  .tk-s { font-size: 16px; color: #f7931a; }
  .tk-eth { color: #627eea; }
  .tk-sol { color: #9945ff; }
  .tk-n { font-family: var(--fp); font-size: 6px; color: var(--sp-dim); letter-spacing: 1px; }
  .tk-v { font-family: var(--fp); font-size: 10px; color: var(--sp-w); }
  .tk-sep { width: 1px; height: 20px; background: rgba(232,150,125,0.12); }

  .qg { display: flex; flex-wrap: wrap; gap: 8px; }
  .qn {
    font-family: var(--fp); font-size: 7px;
    letter-spacing: 2px; color: var(--sp-w);
    background: transparent; border: 1px solid rgba(232,150,125,0.2);
    padding: 8px 14px; cursor: pointer; border-radius: 6px;
    transition: all .15s; display: flex; align-items: center; gap: 6px; white-space: nowrap;
  }
  .qn:hover { background: rgba(232,150,125,0.1); color: var(--sp-pk); border-color: var(--sp-pk); }
  .qn-b { font-size: 6px; background: var(--sp-pk); color: var(--sp-bg); padding: 1px 5px; border-radius: 4px; }

  /* ═══ CTA ═══ */
  .cta {
    background: var(--sp-bg2);
    padding: 70px 40px 120px; display: flex; flex-wrap: wrap; gap: 30px;
    position: relative; overflow: hidden; z-index: 2;
    min-height: 70vh;
  }
  .cta-l { flex: 1; min-width: 250px; display: flex; flex-direction: column; line-height: 1.2; position: relative; z-index: 3; }
  .cta-txt { font-family: var(--fp); display: block; }
  .cta-w {
    font-size: clamp(28px, 6vw, 60px); color: var(--sp-w); letter-spacing: 2px;
    text-shadow: 0 0 10px rgba(240,237,228,0.3);
  }
  .cta-pk {
    font-size: clamp(36px, 8vw, 80px); color: var(--sp-pk); letter-spacing: 4px;
    text-shadow: 0 0 20px var(--sp-pk), 0 0 60px var(--sp-glow);
  }
  .cta-det { margin-top: 16px; display: flex; flex-direction: column; gap: 4px; }
  .cta-brand { font-family: var(--fp); font-size: 12px; color: var(--sp-pk); letter-spacing: 2px; }
  .cta-loc { font-family: var(--fp); font-size: 7px; color: var(--sp-dim); letter-spacing: 2px; }

  .cta-r { flex: 1; min-width: 250px; display: flex; flex-direction: column; align-items: center; gap: 20px; position: relative; z-index: 3; }
  .cta-doge-wrap { width: 180px; }
  .cta-doge { width: 100%; object-fit: contain; }
  .cta-btn {
    font-family: var(--fp); font-size: 10px; letter-spacing: 2px;
    color: var(--sp-bg); background: var(--sp-pk);
    border: none; border-radius: 30px;
    padding: 16px 32px; cursor: pointer;
    transition: all .2s;
    box-shadow: 0 0 20px var(--sp-glow), 0 4px 15px rgba(0,0,0,0.3);
  }
  .cta-btn:hover { transform: translateY(-2px); box-shadow: 0 0 30px var(--sp-pk), 0 6px 20px rgba(0,0,0,0.4); }
  .cta-connected {
    display: flex; align-items: center; gap: 8px;
    font-family: var(--fp); font-size: 8px;
    color: #00cc66; background: var(--sp-bg); padding: 12px 20px;
    border: 1px solid rgba(0,204,102,0.3); border-radius: 8px;
  }
  .wc-dot { width: 8px; height: 8px; border-radius: 50%; background: #00cc66; box-shadow: 0 0 8px #00cc66; }
  .wc-tier { font-size: 7px; background: rgba(255,200,0,.15); color: #c8a000; padding: 2px 6px; border-radius: 4px; }

  .grid-floor-cta {
    height: 40%;
  }

  /* ═══ FOOTER ═══ */
  .foot {
    background: #060e08;
    border-top: 1px solid rgba(232,150,125,0.08);
    padding: 30px 40px 20px;
    display: flex; flex-direction: column; gap: 20px;
    z-index: 2; position: relative;
  }
  .foot-top { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; }
  .foot-logo { font-family: var(--fp); font-size: 12px; color: var(--sp-w); letter-spacing: 2px; }
  .foot-bolt { color: var(--sp-pk); text-shadow: 0 0 10px var(--sp-glow); }
  .foot-nav { display: flex; gap: 6px; flex-wrap: wrap; }
  .foot-nav button {
    font-family: var(--fp); font-size: 6px;
    letter-spacing: 2px; color: var(--sp-dim);
    background: none; border: 1px solid rgba(232,150,125,0.1);
    padding: 6px 12px; cursor: pointer; transition: all .15s; border-radius: 4px;
  }
  .foot-nav button:hover { color: var(--sp-pk); border-color: rgba(232,150,125,0.3); }
  .foot-bot {
    display: flex; justify-content: space-between; align-items: center;
    flex-wrap: wrap; gap: 8px; padding-top: 16px;
    border-top: 1px solid rgba(232,150,125,0.06);
  }
  .foot-copy { font-family: var(--fp); font-size: 6px; letter-spacing: 1px; color: rgba(240,237,228,0.2); }
  .foot-tag { font-family: var(--fv); font-size: 14px; color: rgba(232,150,125,0.3); }

  /* ═══ RESPONSIVE ═══ */
  @media (min-width: 901px) {
    .home {
      scroll-padding-top: 48px;
    }

    .hero {
      min-height: calc(100vh - 36px);
      gap: clamp(14px, 1.8vw, 26px);
      padding-inline: clamp(18px, 2.6vw, 40px);
    }
    .hero-left {
      max-width: min(760px, 57vw);
      padding: 52px clamp(14px, 2vw, 30px) 84px;
    }
    .hero-div { width: 30px; }
    .hero-right {
      width: clamp(320px, 30vw, 420px);
      max-width: none;
      overscroll-behavior: contain;
      scrollbar-gutter: stable;
    }
    .fc-txt { padding: 12px 16px 14px; }
    .fc-lbl { font-size: 11px; }

    .rbadges { gap: 14px; margin-top: 24px; }
    .rbdg {
      padding: 8px 10px;
      border: 1px solid rgba(232,150,125,0.12);
      border-radius: 10px;
      background: rgba(232,150,125,0.03);
    }

    .flow,
    .about,
    .squad,
    .feed,
    .cta {
      min-height: auto;
    }

    .flow { padding: 78px clamp(24px, 4vw, 64px); }
    .flow-steps { max-width: 980px; gap: 10px; }
    .fstep {
      padding: 24px 20px;
      border: 1px solid rgba(232,150,125,0.14);
      border-radius: 12px;
      background: rgba(232,150,125,0.03);
    }
    .fstep:last-child { border-bottom: 1px solid rgba(232,150,125,0.14); }

    .about { padding: 84px clamp(24px, 4vw, 64px) 64px; }
    .about-inner { max-width: 1140px; gap: 48px; }
    .about-text p { text-align: left; font-size: clamp(24px, 2.3vw, 34px); }
    .about-tag { max-width: 1080px; text-align: left; }

    .squad { padding: 74px clamp(24px, 4vw, 64px); }
    .sq-frame { max-width: 1080px; padding: 22px; }
    .sq-grid { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }

    .feed { align-items: stretch; }
    .feed-l { flex: 0 0 38%; padding: 40px; }
    .feed-r { padding: 24px 26px; overflow: visible; }

    .cta { padding: 74px clamp(24px, 4vw, 64px) 100px; gap: 34px; }

    .foot { padding: 28px clamp(24px, 4vw, 64px) 20px; }
  }

  @media (max-width: 900px) {
    .hero { flex-direction: column; min-height: auto; }
    .hero-left { padding: 50px 24px 80px; position: relative; height: auto; }
    .hero-div { width: 100%; height: 30px; flex-direction: row; border-left: none; border-right: none; border-top: 1px solid rgba(232,150,125,0.12); border-bottom: 1px solid rgba(232,150,125,0.12); }
    .vt { writing-mode: horizontal-tb; text-orientation: initial; padding: 0 8px; }
    .hero-right { width: 100%; max-width: 100%; }
    .feat-detail-stats { flex-wrap: wrap; gap: 10px; }
    .feat-detail-title { font-size: 28px; }
    .about-inner { flex-direction: column; align-items: center; }
    .about { padding: 40px 24px 30px; }
    .flow { padding: 50px 24px; }
    .feed { flex-direction: column; }
    .feed-l { padding: 30px 24px; }
    .cta { padding: 30px 24px 80px; }
    .fstep-num { font-size: 24px; min-width: 50px; }
    .fstep-imgwrap { width: 60px; height: 60px; }
    .sq-frame { padding: 16px; border-radius: 14px; }
  }

  @media (max-width: 640px) {
    .hero-left { padding: 40px 16px 60px; }
    .hl-sm { font-size: 14px; }
    .hl-pk { font-size: 40px; }
    .hl-xl { font-size: 36px; }
    .hero-doge { width: 60px; }
    .about-text p { font-size: 22px; }
    .about-badge { width: 120px; height: 120px; }
    .badge-face-wrap { width: 45px; height: 45px; }
    .squad { padding: 30px 16px; }
    .sq-grid { grid-template-columns: 1fr; }
    .sq-frame { border-radius: 10px; }
    .feed-r { padding: 16px; }
    .arena-img-wrap { width: 45px; height: 45px; }
    .arena-name { font-size: 14px; letter-spacing: 3px; }
    .ticker { flex-wrap: wrap; gap: 10px; }
    .tk-sep { display: none; }
    .cta-w { font-size: 24px; } .cta-pk { font-size: 32px; }
    .cta-doge-wrap { width: 120px; }
    .cta-btn { font-size: 8px; padding: 12px 20px; }
    .fstep { gap: 12px; padding: 20px 16px; }
    .fstep-num { font-size: 20px; min-width: 36px; }
    .fstep-title { font-size: 12px; }
    .fstep-imgwrap { width: 50px; height: 50px; }
    .fstep-bar { max-width: 120px; }
    .rbadges { gap: 12px; }
    .rbdg-stars { font-size: 10px; }
  }

  @media (max-width: 400px) {
    .hl-sm { font-size: 12px; }
    .hl-pk { font-size: 32px; }
    .hl-xl { font-size: 28px; }
    .hero-doge { width: 50px; }
    .about-text p { font-size: 18px; }
    .cta-w { font-size: 20px; } .cta-pk { font-size: 26px; }
  }
</style>
