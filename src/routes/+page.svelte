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
    { label: 'WAR ROOM', sub: 'TERMINAL', img: '/blockparty/f5-doge-chart.png', path: '/terminal' },
    { label: 'BOSS FIGHT', sub: 'ARENA', img: '/blockparty/f5-doge-muscle.png', path: '/arena' },
    { label: 'AI SIGNALS', sub: 'SIGNALS', img: '/blockparty/f5-doge-fire.png', path: '/signals' },
    { label: 'COMMUNITY', sub: 'COMMUNITY', img: '/blockparty/f5-doge-excited.png', path: '/signals' },
  ];

  /* Platform Flow Steps */
  const FLOW_STEPS = [
    { num: '01', title: 'CONNECT', desc: '지갑 연결하고 프로필 생성', img: '/blockparty/f5-doge-excited.png', color: '#D93535' },
    { num: '02', title: 'ANALYZE', desc: 'AI 에이전트가 시장 실시간 분석', img: '/blockparty/f5-doge-chart.png', color: '#282D35' },
    { num: '03', title: 'BATTLE', desc: '아레나에서 AI와 트레이드 대결', img: '/blockparty/f5-doge-muscle.png', color: '#D93535' },
    { num: '04', title: 'EARN', desc: '점수 쌓고 랭킹 올리고 보상 획득', img: '/blockparty/f5-doge-bull.png', color: '#282D35' },
  ];

  /* ── Animation system ── */
  let homeEl: HTMLDivElement;
  let heroReady = false;

  function onScroll() {
    if (!homeEl) return;
    const vh = homeEl.clientHeight;
    // Parallax
    const pxEls = homeEl.querySelectorAll<HTMLElement>('[data-px]');
    for (const el of pxEls) {
      const speed = parseFloat(el.dataset.px || '0.12');
      const rect = el.getBoundingClientRect();
      const offset = (rect.top - vh / 2) * speed;
      el.style.transform = `translate3d(0, ${offset}px, 0)`;
    }
  }

  onMount(() => {
    if (!homeEl) return;

    // Hero: stagger text lines in after 100ms
    requestAnimationFrame(() => {
      setTimeout(() => { heroReady = true; }, 150);
    });

    homeEl.addEventListener('scroll', onScroll, { passive: true });

    // Scroll-triggered reveals for non-hero elements
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

    homeEl.querySelectorAll('.sr').forEach((el) => obs.observe(el));

    return () => {
      homeEl.removeEventListener('scroll', onScroll);
      obs.disconnect();
    };
  });
</script>

<div class="home" bind:this={homeEl}>
  <div class="grain" aria-hidden="true"></div>

  <!-- ═══════════════════════════════════════
       SECTION 1: HERO — Stiff-style intro
       Text slides from LEFT one by one
       Cards slide from RIGHT with stagger
       ═══════════════════════════════════════ -->
  <section class="hero" class:hero-go={heroReady}>
    <div class="hero-left">
      <div class="hero-stack">
        <span class="hl hl-sm ha" style="--ha-d:0s">WE MAKE</span>
        <span class="hl hl-red hl-xl ha" style="--ha-d:0.15s">TRADES</span>
        <span class="hl hl-md ha" style="--ha-d:0.3s">THAT LOOK</span>
        <span class="hl hl-md ha" style="--ha-d:0.45s">DAMN</span>
        <div class="hl-row ha" style="--ha-d:0.6s">
          <span class="hl hl-xxl">GO</span>
          <img src="/blockparty/f5-doge-bull.png" alt="doge" class="hero-doge" />
          <span class="hl hl-xxl">OD</span>
        </div>
      </div>
    </div>

    <div class="hero-div">
      {#each Array(8) as _}<span class="vt">FEATURES</span>{/each}
    </div>

    <div class="hero-right">
      {#each FEATURES as feat, i}
        <button class="fc ha ha-r" style="--ha-d:{0.2 + i * 0.12}s" on:click={() => goto(feat.path)}>
          <div class="fc-img"><img src={feat.img} alt="" /></div>
          <div class="fc-txt">
            <span class="fc-sub">{feat.sub}</span>
            <h3 class="fc-lbl">{feat.label}</h3>
          </div>
        </button>
      {/each}
      <button class="fc-all ha ha-r" style="--ha-d:0.7s" on:click={enterTerminal}>
        VIEW ALL <span class="fc-arr">↗</span>
      </button>
    </div>
  </section>

  <!-- ═══════════════════════════════════════
       SECTION 2: FLOW — "HOW IT WORKS"
       Platform workflow: Connect→Analyze→Battle→Earn
       Each step slides from alternating sides
       ═══════════════════════════════════════ -->
  <section class="flow">
    <div class="flow-header">
      <h2 class="flow-title sr sl" data-px="0.06">
        <span class="ft-cream">HOW IT</span>
        <span class="ft-red">WORKS</span>
      </h2>
      <p class="flow-sub sr sr-r" style="--d:0.1s">4 steps to degen glory</p>
    </div>

    <div class="flow-steps">
      {#each FLOW_STEPS as step, i}
        <div class="fstep sr {i % 2 === 0 ? 'sl' : 'sr-r'}" style="--d:{i * 0.1}s">
          <div class="fstep-num" style="color:{step.color}">{step.num}</div>
          <div class="fstep-body">
            <h3 class="fstep-title" style="color:{step.color}">{step.title}</h3>
            <p class="fstep-desc">{step.desc}</p>
          </div>
          <img src={step.img} alt="" class="fstep-img" />
          <div class="fstep-line"></div>
        </div>
      {/each}
    </div>
  </section>

  <!-- ═══════════════════════════════════════
       SECTION 3: ABOUT — Mixed typography
       Badge slides from LEFT, text from RIGHT
       ═══════════════════════════════════════ -->
  <section class="about">
    <div class="about-inner">
      <div class="about-badge sr sl">
        <svg viewBox="0 0 200 200" class="badge-svg">
          <defs><path id="cp" d="M100,100 m-75,0 a75,75 0 1,1 150,0 a75,75 0 1,1 -150,0"/></defs>
          <text><textPath href="#cp" class="badge-txt">MUCH WOW ✦ MUCH WOW ✦ MUCH WOW ✦ MUCH WOW ✦</textPath></text>
        </svg>
        <img src="/blockparty/f5-doge-face.png" alt="" class="badge-face" />
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
       SECTION 4: SQUAD — Agent cards
       Title slides LEFT, cards slide RIGHT
       ═══════════════════════════════════════ -->
  <section class="squad">
    <h2 class="sq-title sr sl" data-px="0.05">
      <span class="sq-dk">THE</span>
      <span class="sq-rd">SQUAD</span>
    </h2>
    <p class="sq-sub sr sr-r" style="--d:0.1s">7 AI dogs that eat the market alive</p>

    <div class="sq-grid">
      {#each AGDEFS as ag, i}
        <div class="sq-card sr sr-r" style="--ac:{ag.color};--d:{i * 0.07}s">
          <img src={ag.img.def} alt={ag.name} class="sq-av" />
          <div class="sq-info">
            <span class="sq-nm" style="color:var(--ac)">{ag.name}</span>
            <span class="sq-rl">{ag.role}</span>
          </div>
          <div class="sq-pct">{ag.conf}%</div>
        </div>
      {/each}
    </div>
  </section>

  <!-- ═══════════════════════════════════════
       SECTION 5: FEED — Arena + Prices
       Text/image from LEFT, cards from RIGHT
       ═══════════════════════════════════════ -->
  <section class="feed">
    <div class="feed-l">
      <span class="fd-line fd-cream sr sl">IN YOUR</span>
      <span class="fd-line fd-red sr sl" style="--d:0.15s">FEED</span>
      <img src="/blockparty/f5-doge-fire.png" alt="" class="feed-doge sr sl" style="--d:0.3s" />
    </div>
    <div class="feed-r">
      <button class="arena sr sr-r" on:click={enterArena}>
        <div class="arena-row">
          <img src="/blockparty/f5-doge-muscle.png" alt="" class="arena-img" />
          <div class="arena-mid">
            <span class="arena-tag">🎮 BOSS FIGHT</span>
            <h3 class="arena-name">ARENA</h3>
            <p class="arena-sub">7 AI 개 vs 너 ⚔️</p>
          </div>
          <img src="/blockparty/f5-doge-bull.png" alt="" class="arena-img" />
        </div>
        <div class="arena-ft"><span>⚔️ 11-Phase</span><span>🐕 7 Agents</span><span>🏆 Ranking</span></div>
      </button>

      <div class="ticker sr sr-r" style="--d:0.12s">
        <div class="tk"><span class="tk-s">₿</span><span class="tk-n">BTC</span><span class="tk-v">${btcPrice.toLocaleString()}</span></div>
        <div class="tk-sep"></div>
        <div class="tk"><span class="tk-s tk-eth">Ξ</span><span class="tk-n">ETH</span><span class="tk-v">${ethPrice.toLocaleString()}</span></div>
        <div class="tk-sep"></div>
        <div class="tk"><span class="tk-s tk-sol">◎</span><span class="tk-n">SOL</span><span class="tk-v">${solPrice.toLocaleString()}</span></div>
      </div>

      <div class="qg sr sr-r" style="--d:0.24s">
        <button class="qn" on:click={() => goto('/terminal')}>📊 TERMINAL</button>
        <button class="qn" on:click={() => goto('/passport')}>📋 PASSPORT</button>
        <button class="qn" on:click={() => goto('/oracle')}>🔮 ORACLE</button>
        <button class="qn" on:click={() => goto('/signals')}>🔔 SIGNALS {#if trackedSigs > 0}<span class="qn-b">{trackedSigs}</span>{/if}</button>
        <button class="qn" on:click={() => goto('/signals')}>👀 COMMUNITY</button>
      </div>
    </div>
  </section>

  <!-- ═══════════════════════════════════════
       SECTION 6: CTA — Join the Pack
       Big text from LEFT, mascot from RIGHT
       ═══════════════════════════════════════ -->
  <section class="cta">
    <div class="cta-l">
      <span class="cta-txt cta-dk sr sl">JOIN</span>
      <span class="cta-txt cta-dk sr sl" style="--d:0.1s">THE</span>
      <span class="cta-txt cta-rd sr sl" style="--d:0.2s">PACK</span>
      <div class="cta-det sr sl" style="--d:0.3s">
        <span class="cta-brand">MAXI⚡DOGE</span>
        <span class="cta-loc">AI TRADING PLATFORM</span>
      </div>
    </div>
    <div class="cta-r">
      <img src="/blockparty/f5-doge-excited.png" alt="" class="cta-doge sr sr-r" />
      {#if !connected}
        <button class="cta-btn sr sr-r" style="--d:0.15s" on:click={openWalletModal}>⚡ CONNECT WALLET ⚡</button>
      {:else}
        <div class="cta-connected sr sr-r" style="--d:0.15s">
          <span class="wc-dot"></span>
          <span>{wallet.shortAddr}</span>
          <span class="wc-tier">{profile.tier.toUpperCase()}</span>
        </div>
      {/if}
      <div class="rbadge sr sr-r" style="--d:0.25s">
        <svg viewBox="0 0 200 200" class="badge-svg">
          <defs><path id="cp2" d="M100,100 m-70,0 a70,70 0 1,1 140,0 a70,70 0 1,1 -140,0"/></defs>
          <text><textPath href="#cp2" class="badge-dk">CONNECT ✦ CONNECT ✦ CONNECT ✦ CONNECT ✦</textPath></text>
        </svg>
        <span class="rb-arrow">↗</span>
      </div>
    </div>
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
     MAXI⚡DOGE — STIFF-STYLE RETRO PREMIUM
     Complete animation system + platform flow
     ═══════════════════════════════════════════════ */

  /* ── BASE ── */
  .home {
    width: 100%; height: 100%;
    overflow-y: auto; overflow-x: hidden;
    background: #282D35;
    display: flex; flex-direction: column;
    position: relative;
  }
  .home::-webkit-scrollbar { width: 4px; }
  .home::-webkit-scrollbar-thumb { background: #F0ECD9; border-radius: 4px; }

  /* ── GRAIN TEXTURE ── */
  .grain {
    position: fixed; inset: 0;
    pointer-events: none; z-index: 999;
    opacity: 0.06; mix-blend-mode: overlay;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
    background-repeat: repeat; background-size: 200px 200px;
  }

  /* ════════════════════════════════════════════
     ANIMATION SYSTEM
     .sr = scroll-reveal element
     .sl = slides from LEFT (-120px)
     .sr-r = slides from RIGHT (+120px)
     .su = slides from BOTTOM (+60px)
     .vis = revealed (added by IntersectionObserver)
     ════════════════════════════════════════════ */
  .sr {
    opacity: 0;
    transition: opacity 0.85s cubic-bezier(.16,1,.3,1), transform 0.85s cubic-bezier(.16,1,.3,1);
    transition-delay: var(--d, 0s);
    will-change: opacity, transform;
  }
  .sl  { transform: translateX(-120px); }
  .sr-r { transform: translateX(120px); }
  .su  { transform: translateY(60px); }

  :global(.vis) {
    opacity: 1 !important;
    transform: translateX(0) translateY(0) scale(1) !important;
  }

  /* ════════════════════════════════════════════
     HERO INTRO — text lines stagger from LEFT
     Cards stagger from RIGHT
     Triggered by heroReady → .hero-go class
     ════════════════════════════════════════════ */
  .ha {
    opacity: 0;
    transform: translateX(-90px);
    transition: opacity 0.75s cubic-bezier(.16,1,.3,1),
                transform 0.75s cubic-bezier(.16,1,.3,1);
    transition-delay: var(--ha-d, 0s);
  }
  .ha-r { transform: translateX(100px); }
  .hero-go .ha { opacity: 1; transform: translateX(0); }

  /* ═══ HERO ═══ */
  .hero {
    display: flex;
    border-bottom: 3px solid #F0ECD9;
    position: relative;
    min-height: 100vh;
  }
  .hero::after {
    content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 1;
    background: radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(0,0,0,.3) 100%);
  }

  .hero-left {
    flex: 1.1;
    display: flex; align-items: center; justify-content: center;
    padding: 60px 40px 40px;
    background: radial-gradient(ellipse at 30% 60%, rgba(217,53,53,.04) 0%, transparent 50%),
                radial-gradient(ellipse at 70% 30%, rgba(240,236,217,.03) 0%, transparent 50%), #282D35;
    position: relative; z-index: 2;
  }

  .hero-stack {
    display: flex; flex-direction: column; line-height: 0.88;
    position: relative; z-index: 3;
  }
  .hl {
    font-family: var(--fd), 'Impact', sans-serif; font-weight: 900;
    color: #F0ECD9; letter-spacing: -2px; text-transform: uppercase; display: block;
    text-shadow: 2px 2px 0 rgba(0,0,0,.4);
  }
  .hl-sm  { font-size: clamp(36px, 5vw, 64px); letter-spacing: 2px; }
  .hl-md  { font-size: clamp(42px, 6vw, 80px); }
  .hl-xl  { font-size: clamp(70px, 11vw, 160px); }
  .hl-xxl { font-size: clamp(80px, 13vw, 200px); letter-spacing: -6px; }
  .hl-red { color: #D93535; text-shadow: 3px 3px 0 rgba(0,0,0,.5), 0 0 60px rgba(217,53,53,.15); }
  .hl-row { display: flex; align-items: center; }

  .hero-doge {
    width: clamp(100px, 14vw, 200px); height: auto; object-fit: contain;
    margin: 0 -10px; filter: drop-shadow(4px 4px 0 rgba(0,0,0,.4));
    z-index: 2; animation: bob 3s ease-in-out infinite;
  }
  @keyframes bob {
    0%,100% { transform: translateY(0) rotate(0); }
    50% { transform: translateY(-8px) rotate(2deg); }
  }

  /* Vertical divider */
  .hero-div {
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

  /* Feature cards (right column) */
  .hero-right {
    width: 420px; max-width: 40%;
    background: radial-gradient(ellipse at 50% 80%, rgba(217,53,53,.03) 0%, transparent 60%), #F0ECD9;
    display: flex; flex-direction: column; overflow-y: auto; flex-shrink: 0; position: relative;
  }
  .hero-right::-webkit-scrollbar { width: 3px; }
  .hero-right::-webkit-scrollbar-thumb { background: #282D35; }

  .fc {
    display: flex; flex-direction: column; background: transparent;
    border: none; border-bottom: 2px solid #282D35;
    cursor: pointer; padding: 0; text-align: left;
    transition: background .2s;
  }
  .fc:hover { background: rgba(40,45,53,.05); }
  .fc-img {
    width: 100%; aspect-ratio: 16/10; overflow: hidden;
    display: flex; align-items: center; justify-content: center;
    background: rgba(40,45,53,.04); border-bottom: 1px solid rgba(40,45,53,.08);
  }
  .fc-img img {
    width: 55%; max-height: 80%; object-fit: contain;
    transition: transform .4s cubic-bezier(.22,1,.36,1);
    filter: drop-shadow(2px 3px 0 rgba(0,0,0,.1));
  }
  .fc:hover .fc-img img { transform: scale(1.1) rotate(-2deg); }
  .fc-txt { padding: 12px 20px 16px; }
  .fc-sub {
    font-family: var(--fm), sans-serif; font-size: 11px; font-weight: 500;
    color: rgba(40,45,53,.45); letter-spacing: 1.5px; text-transform: uppercase;
  }
  .fc-lbl {
    font-family: var(--fd), 'Impact', sans-serif; font-size: 28px; font-weight: 900;
    color: #D93535; letter-spacing: 1px; line-height: 1; margin-top: 2px;
  }
  .fc-all {
    display: flex; align-items: center; justify-content: space-between;
    padding: 20px; background: transparent; border: none; cursor: pointer;
    font-family: var(--fd), sans-serif; font-size: 14px; font-weight: 900;
    letter-spacing: 2px; color: #282D35; transition: color .15s;
    border-top: 1px solid rgba(40,45,53,.1);
  }
  .fc-all:hover { color: #D93535; }
  .fc-arr { font-size: 22px; }

  /* ═══ FLOW — HOW IT WORKS ═══ */
  .flow {
    background: #F0ECD9; padding: 80px 40px;
    border-bottom: 3px solid #282D35; position: relative; overflow: hidden;
    min-height: 80vh;
  }
  .flow::before {
    content: ''; position: absolute; inset: 0; pointer-events: none; opacity: 0.03;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size: 180px;
  }
  .flow-header { text-align: center; margin-bottom: 50px; position: relative; z-index: 2; }
  .flow-title {
    font-family: var(--fd), 'Impact', sans-serif; font-weight: 900;
    line-height: 0.88; letter-spacing: -2px;
  }
  .ft-cream { font-size: clamp(40px, 7vw, 80px); color: #282D35; display: block; }
  .ft-red { font-size: clamp(56px, 10vw, 120px); color: #D93535; display: block; }
  .flow-sub {
    font-family: var(--fm), sans-serif; font-size: 13px; font-weight: 600;
    color: rgba(40,45,53,.45); letter-spacing: 1.5px; margin-top: 10px;
    text-transform: uppercase;
  }

  .flow-steps {
    max-width: 900px; margin: 0 auto;
    display: flex; flex-direction: column; gap: 0;
    position: relative; z-index: 2;
  }

  .fstep {
    display: flex; align-items: center; gap: 24px;
    padding: 30px 24px;
    border-bottom: 2px solid rgba(40,45,53,.1);
    position: relative;
  }
  .fstep:last-child { border-bottom: none; }

  .fstep-num {
    font-family: var(--fd), sans-serif; font-size: 60px; font-weight: 900;
    opacity: 0.15; flex-shrink: 0; line-height: 1; letter-spacing: -2px;
    min-width: 80px; text-align: center;
  }
  .fstep-body { flex: 1; min-width: 0; }
  .fstep-title {
    font-family: var(--fd), 'Impact', sans-serif; font-size: clamp(28px, 4vw, 48px);
    font-weight: 900; letter-spacing: 3px; line-height: 1;
  }
  .fstep-desc {
    font-family: var(--fm), sans-serif; font-size: 13px; font-weight: 600;
    color: rgba(40,45,53,.5); letter-spacing: .5px; margin-top: 6px;
  }
  .fstep-img {
    width: 90px; height: 90px; object-fit: contain; flex-shrink: 0;
    filter: drop-shadow(2px 3px 0 rgba(0,0,0,.08));
    transition: transform .3s;
  }
  .fstep:hover .fstep-img { transform: scale(1.1) rotate(-3deg); }
  .fstep-line {
    position: absolute; left: 56px; bottom: 0;
    width: 2px; height: 0; background: rgba(40,45,53,.08);
  }

  /* ═══ ABOUT ═══ */
  .about {
    background: radial-gradient(ellipse at 20% 40%, rgba(217,53,53,.03) 0%, transparent 50%),
                radial-gradient(ellipse at 80% 70%, rgba(240,236,217,.04) 0%, transparent 50%), #282D35;
    padding: 90px 40px 60px;
    display: flex; flex-direction: column; align-items: center;
    border-bottom: 3px solid #F0ECD9; position: relative; overflow: hidden;
    min-height: 60vh;
  }
  .about::after {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background: radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(0,0,0,.25) 100%);
  }

  .about-inner {
    display: flex; align-items: flex-start; gap: 40px;
    max-width: 1100px; width: 100%; position: relative; z-index: 2;
  }

  .about-badge { position: relative; width: 180px; height: 180px; flex-shrink: 0; }
  .badge-svg { width: 100%; height: 100%; animation: spin 20s linear infinite; }
  .badge-txt { font-family: var(--fd), sans-serif; font-size: 15px; font-weight: 900; fill: #F0ECD9; letter-spacing: 3px; }
  .badge-dk { font-family: var(--fd), sans-serif; font-size: 17px; font-weight: 900; fill: #282D35; letter-spacing: 3px; }
  .badge-face { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 70px; height: 70px; object-fit: contain; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .about-text { flex: 1; }
  .about-text p {
    font-family: var(--fd), 'Impact', sans-serif; font-size: 28px;
    line-height: 1.18; color: #F0ECD9; text-align: center;
  }
  .ab { font-weight: 900; text-transform: uppercase; }
  .ai { font-style: italic; font-weight: 400; font-family: Georgia, serif; font-size: .85em; }
  .ar { font-weight: 700; font-size: .7em; letter-spacing: 2px; text-transform: uppercase; }
  .as { font-weight: 700; font-size: .55em; letter-spacing: 3px; text-transform: uppercase; }
  .abg { font-size: 1.15em; }
  .abx { font-size: 1.4em; }

  .about-tag {
    font-family: var(--fm), sans-serif; font-size: 12px; font-weight: 700;
    letter-spacing: 4px; color: rgba(240,236,217,.35); text-align: center;
    margin-top: 40px; padding-top: 20px;
    border-top: 1px solid rgba(240,236,217,.08);
    width: 100%; max-width: 600px; position: relative; z-index: 2;
  }

  /* ═══ SQUAD ═══ */
  .squad {
    background: radial-gradient(ellipse at 60% 20%, rgba(217,53,53,.03) 0%, transparent 50%), #F0ECD9;
    padding: 70px 40px; border-bottom: 3px solid #282D35; position: relative; overflow: hidden;
    min-height: 70vh;
  }
  .squad::before {
    content: ''; position: absolute; inset: 0; pointer-events: none; opacity: 0.03;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n2'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n2)'/%3E%3C/svg%3E");
    background-size: 180px;
  }
  .sq-title {
    font-family: var(--fd), 'Impact', sans-serif; font-size: clamp(48px, 8vw, 90px);
    font-weight: 900; line-height: .9; letter-spacing: -2px; text-align: center;
    position: relative; z-index: 2;
  }
  .sq-dk { color: #282D35; }
  .sq-rd { color: #D93535; display: block; }
  .sq-sub {
    font-family: var(--fm), sans-serif; font-size: 13px; font-weight: 600;
    color: rgba(40,45,53,.45); letter-spacing: 1px; margin-top: 8px;
    text-align: center; margin-bottom: 30px; position: relative; z-index: 2;
  }
  .sq-grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 10px; max-width: 960px; margin: 0 auto; position: relative; z-index: 2;
  }
  .sq-card {
    display: flex; align-items: center; gap: 10px; padding: 14px 16px;
    background: #282D35; border: 2px solid #282D35;
    cursor: default; transition: transform .2s, box-shadow .2s;
  }
  .sq-card:hover { transform: translateY(-3px); box-shadow: 0 6px 20px rgba(0,0,0,.15); }
  .sq-av { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 2px solid var(--ac); flex-shrink: 0; }
  .sq-info { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  .sq-nm { font-family: var(--fd), sans-serif; font-size: 11px; font-weight: 900; letter-spacing: 1px; }
  .sq-rl { font-family: var(--fm), sans-serif; font-size: 8px; color: rgba(240,236,217,.35); letter-spacing: .5px; }
  .sq-pct { margin-left: auto; font-family: var(--fd), sans-serif; font-size: 16px; font-weight: 900; color: #F0ECD9; opacity: .45; }

  /* ═══ FEED ═══ */
  .feed {
    display: flex; background: #282D35;
    border-bottom: 3px solid #F0ECD9; overflow: hidden;
    min-height: 80vh;
  }
  .feed-l {
    flex: 0 0 40%; display: flex; flex-direction: column;
    align-items: center; justify-content: center; padding: 40px;
    position: relative; overflow: hidden;
    background: radial-gradient(ellipse at 50% 70%, rgba(217,53,53,.05) 0%, transparent 55%), #282D35;
  }
  .feed-l::after {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background: radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(0,0,0,.25) 100%);
  }
  .fd-line {
    font-family: var(--fd), 'Impact', sans-serif; font-weight: 900;
    text-transform: uppercase; display: block; position: relative; z-index: 2;
    line-height: .85; text-align: center;
  }
  .fd-cream { font-size: clamp(40px, 6vw, 80px); color: #F0ECD9; text-shadow: 2px 2px 0 rgba(0,0,0,.4); }
  .fd-red { font-size: clamp(70px, 12vw, 160px); color: #D93535; letter-spacing: -4px; text-shadow: 3px 3px 0 rgba(0,0,0,.5); }
  .feed-doge {
    width: clamp(120px, 16vw, 200px); object-fit: contain; margin-top: 20px;
    filter: drop-shadow(3px 4px 0 rgba(0,0,0,.3));
    animation: bob 4s ease-in-out infinite; position: relative; z-index: 2;
  }
  .feed-r {
    flex: 1;
    background: radial-gradient(ellipse at 30% 80%, rgba(217,53,53,.02) 0%, transparent 50%), #F0ECD9;
    padding: 24px; display: flex; flex-direction: column; gap: 14px; overflow-y: auto;
  }

  .arena {
    background: #282D35; border: 3px solid #282D35; padding: 16px;
    cursor: pointer; transition: transform .2s, box-shadow .2s; width: 100%; text-align: left;
  }
  .arena:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,.15); }
  .arena-row { display: flex; align-items: center; gap: 12px; }
  .arena-img { width: 70px; height: 70px; object-fit: contain; flex-shrink: 0; }
  .arena-mid { flex: 1; text-align: center; }
  .arena-tag { font-family: var(--fm), sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 1px; color: #F0ECD9; opacity: .55; }
  .arena-name { font-family: var(--fd), sans-serif; font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #D93535; line-height: 1; text-shadow: 2px 2px 0 rgba(0,0,0,.4); }
  .arena-sub { font-family: var(--fm), sans-serif; font-size: 11px; color: rgba(240,236,217,.45); margin-top: 2px; }
  .arena-ft { display: flex; gap: 8px; justify-content: center; margin-top: 10px; }
  .arena-ft span { font-family: var(--fm), sans-serif; font-size: 9px; font-weight: 700; color: rgba(240,236,217,.45); background: rgba(240,236,217,.06); padding: 4px 10px; }

  .ticker {
    display: flex; align-items: center; gap: 16px;
    padding: 16px 20px; background: #282D35; border: 2px solid #282D35;
  }
  .tk { display: flex; align-items: center; gap: 6px; }
  .tk-s { font-size: 18px; color: #f7931a; }
  .tk-eth { color: #627eea; }
  .tk-sol { color: #9945ff; }
  .tk-n { font-family: var(--fm), sans-serif; font-size: 10px; font-weight: 700; color: rgba(240,236,217,.35); letter-spacing: 1px; }
  .tk-v { font-family: var(--fd), sans-serif; font-size: 16px; font-weight: 900; color: #F0ECD9; }
  .tk-sep { width: 1px; height: 24px; background: rgba(240,236,217,.12); }

  .qg { display: flex; flex-wrap: wrap; gap: 8px; }
  .qn {
    font-family: var(--fd), sans-serif; font-size: 10px; font-weight: 900;
    letter-spacing: 2px; color: #282D35; background: transparent;
    border: 2px solid #282D35; padding: 8px 14px; cursor: pointer;
    transition: all .15s; display: flex; align-items: center; gap: 6px; white-space: nowrap;
  }
  .qn:hover { background: #282D35; color: #F0ECD9; }
  .qn-b { font-size: 8px; background: #D93535; color: #fff; padding: 1px 5px; border-radius: 4px; }

  /* ═══ CTA ═══ */
  .cta {
    background: radial-gradient(ellipse at 70% 30%, rgba(217,53,53,.03) 0%, transparent 50%), #F0ECD9;
    padding: 70px 40px 50px; display: flex; flex-wrap: wrap; gap: 30px;
    border-top: 3px solid #282D35; position: relative; overflow: hidden;
    min-height: 70vh;
  }
  .cta::before {
    content: ''; position: absolute; inset: 0; pointer-events: none; opacity: 0.03;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n3'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n3)'/%3E%3C/svg%3E");
    background-size: 180px;
  }
  .cta-l { flex: 1; min-width: 250px; display: flex; flex-direction: column; line-height: .85; position: relative; z-index: 2; }
  .cta-txt {
    font-family: var(--fd), 'Impact', sans-serif; font-weight: 900; display: block;
  }
  .cta-dk { font-size: clamp(50px, 9vw, 120px); color: #282D35; letter-spacing: -3px; text-shadow: 2px 2px 0 rgba(0,0,0,.06); }
  .cta-rd { font-size: clamp(60px, 12vw, 160px); color: #D93535; letter-spacing: -4px; text-shadow: 3px 3px 0 rgba(0,0,0,.08); }
  .cta-det { margin-top: 16px; display: flex; flex-direction: column; gap: 2px; }
  .cta-brand { font-family: var(--fd), sans-serif; font-size: 22px; font-weight: 900; color: #282D35; letter-spacing: 2px; }
  .cta-loc { font-family: var(--fm), sans-serif; font-size: 13px; color: rgba(40,45,53,.45); letter-spacing: 1px; }

  .cta-r { flex: 1; min-width: 250px; display: flex; flex-direction: column; align-items: center; gap: 20px; position: relative; z-index: 2; }
  .cta-doge { width: 180px; object-fit: contain; filter: drop-shadow(3px 4px 0 rgba(0,0,0,.1)); }
  .cta-btn {
    font-family: var(--fd), sans-serif; font-size: 14px; font-weight: 900; letter-spacing: 3px;
    color: #F0ECD9; background: #282D35; border: 3px solid #282D35; padding: 16px 32px;
    cursor: pointer; transition: all .2s; box-shadow: 4px 4px 0 rgba(0,0,0,.2);
  }
  .cta-btn:hover { transform: translate(-2px,-2px); box-shadow: 6px 6px 0 rgba(0,0,0,.25); }
  .cta-connected {
    display: flex; align-items: center; gap: 8px;
    font-family: var(--fm), sans-serif; font-size: 12px; font-weight: 700;
    color: #00cc66; background: #282D35; padding: 12px 20px; letter-spacing: 1px;
  }
  .wc-dot { width: 8px; height: 8px; border-radius: 50%; background: #00cc66; box-shadow: 0 0 8px #00cc66; }
  .wc-tier { font-size: 8px; background: rgba(255,200,0,.15); color: #c8a000; padding: 2px 6px; }

  .rbadge { position: relative; width: 120px; height: 120px; }
  .rb-arrow { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); font-size: 28px; font-weight: 900; color: #282D35; }

  /* ═══ FOOTER ═══ */
  .foot {
    background: #1a1e24;
    border-top: 3px solid rgba(240,236,217,.08);
    padding: 30px 40px 20px;
    display: flex; flex-direction: column; gap: 20px;
  }
  .foot-top { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; }
  .foot-logo { font-family: var(--fd), sans-serif; font-size: 20px; font-weight: 900; letter-spacing: 3px; color: #F0ECD9; }
  .foot-bolt { color: #D93535; }
  .foot-nav { display: flex; gap: 6px; flex-wrap: wrap; }
  .foot-nav button {
    font-family: var(--fm), sans-serif; font-size: 9px; font-weight: 700;
    letter-spacing: 2px; color: rgba(240,236,217,.4);
    background: none; border: 1px solid rgba(240,236,217,.08);
    padding: 6px 12px; cursor: pointer; transition: all .15s;
  }
  .foot-nav button:hover { color: #F0ECD9; border-color: rgba(240,236,217,.25); }
  .foot-bot {
    display: flex; justify-content: space-between; align-items: center;
    flex-wrap: wrap; gap: 8px; padding-top: 16px;
    border-top: 1px solid rgba(240,236,217,.06);
  }
  .foot-copy { font-family: var(--fm), sans-serif; font-size: 9px; font-weight: 600; letter-spacing: 1.5px; color: rgba(240,236,217,.25); }
  .foot-tag { font-family: Georgia, serif; font-style: italic; font-size: 10px; color: rgba(240,236,217,.2); }

  /* ═══ RESPONSIVE ═══ */
  @media (max-width: 900px) {
    .hero { flex-direction: column; min-height: auto; }
    .hero-left { padding: 50px 24px 30px; }
    .hero-div { width: 100%; height: 40px; flex-direction: row; border-left: none; border-right: none; border-top: 2px solid rgba(240,236,217,.12); border-bottom: 2px solid rgba(240,236,217,.12); }
    .vt { writing-mode: horizontal-tb; text-orientation: initial; padding: 0 8px; }
    .hero-right { width: 100%; max-width: 100%; }
    .about-inner { flex-direction: column; align-items: center; }
    .about { padding: 40px 24px 30px; }
    .flow { padding: 50px 24px; }
    .feed { flex-direction: column; }
    .feed-l { padding: 30px 24px; }
    .cta { padding: 30px 24px; }
    .fstep-num { font-size: 40px; min-width: 50px; }
    .fstep-img { width: 60px; height: 60px; }
  }

  @media (max-width: 640px) {
    .hero-left { padding: 40px 16px 20px; }
    .hl-sm { font-size: 28px; } .hl-md { font-size: 36px; }
    .hl-xl { font-size: 64px; } .hl-xxl { font-size: 72px; }
    .hero-doge { width: 80px; }
    .about-text p { font-size: 20px; }
    .about-badge { width: 120px; height: 120px; }
    .badge-face { width: 45px; height: 45px; }
    .squad { padding: 30px 16px; }
    .sq-grid { grid-template-columns: 1fr; }
    .feed-r { padding: 16px; }
    .arena-img { width: 50px; height: 50px; }
    .arena-name { font-size: 24px; letter-spacing: 4px; }
    .ticker { flex-wrap: wrap; gap: 10px; }
    .tk-sep { display: none; }
    .cta-dk { font-size: 48px; } .cta-rd { font-size: 60px; }
    .cta-doge { width: 120px; }
    .cta-btn { font-size: 11px; padding: 12px 20px; letter-spacing: 2px; }
    .fstep { gap: 12px; padding: 20px 16px; }
    .fstep-num { font-size: 32px; min-width: 40px; }
    .fstep-title { font-size: 24px; }
    .fstep-img { width: 50px; height: 50px; }
  }

  @media (max-width: 400px) {
    .hl-sm { font-size: 22px; } .hl-md { font-size: 28px; }
    .hl-xl { font-size: 48px; } .hl-xxl { font-size: 56px; }
    .hero-doge { width: 60px; }
    .about-text p { font-size: 16px; }
    .cta-dk { font-size: 36px; } .cta-rd { font-size: 48px; }
  }
</style>
