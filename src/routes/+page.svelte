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
  $: openPos = $openTradeCount;

  $: btcPrice = state.prices.BTC;
  $: ethPrice = state.prices.ETH;
  $: solPrice = state.prices.SOL;

  type HomeFunnelStep = 'hero_view' | 'hero_feature_select' | 'hero_cta_click';
  type HomeFunnelStatus = 'view' | 'click';

  interface GTMWindow extends Window {
    dataLayer?: Array<Record<string, unknown>>;
  }

  function gtmEvent(event: string, payload: Record<string, unknown> = {}) {
    if (typeof window === 'undefined') return;
    const w = window as GTMWindow;
    if (!Array.isArray(w.dataLayer)) return;
    w.dataLayer.push({
      event,
      area: 'home',
      ...payload,
    });
  }

  function trackHomeFunnel(
    step: HomeFunnelStep,
    status: HomeFunnelStatus,
    payload: Record<string, unknown> = {}
  ) {
    gtmEvent('home_funnel', {
      step,
      status,
      ...payload,
    });
  }

  function enterArena() { goto('/arena'); }
  function enterTerminal() { goto('/terminal'); }

  const FEATURES = [
    { label: 'WAR ROOM', sub: 'TERMINAL', brief: 'YOU MISSED THE PUMP BECAUSE YOU WERE SLEEPING. NEVER AGAIN.', img: '/blockparty/f5-doge-chart.png', path: '/terminal',
      detail: '8 AI AGENTS RUN 24/7 — SCANNING CHARTS, TRACKING WHALES, READING DERIVATIVES, AND MONITORING SOCIAL SENTIMENT ACROSS 200+ PAIRS. YOU OPEN YOUR EYES. THE INTEL IS ALREADY THERE.',
      stats: [{ k: 'AI AGENTS', v: '8' }, { k: 'PAIRS', v: '200+' }, { k: 'SCAN PATTERNS', v: '28' }] },
    { label: 'AI vs YOU', sub: 'ARENA', brief: 'SUBMIT YOUR CALL. 8 AI AGENTS CHALLENGE EVERY ANGLE.', img: '/blockparty/f5-doge-muscle.png', path: '/arena',
      detail: 'THINK YOU FOUND THE TRADE? SUBMIT IT. 8 AI AGENTS WILL ANALYZE YOUR ENTRY, TP, SL, AND R:R FROM EVERY ANGLE — STRUCTURE, FLOW, DERIVATIVES, SENTIMENT, MACRO. IF YOUR THESIS SURVIVES 5 PHASES, IT MIGHT ACTUALLY WORK.',
      stats: [{ k: 'PHASES', v: '5' }, { k: 'AI JUDGES', v: '8' }, { k: 'REWARDS', v: 'XP+RANK' }] },
    { label: 'AI SCANNER', sub: 'SIGNALS', brief: 'THE MARKET WHISPERS BEFORE IT SCREAMS. WE HEAR IT FIRST.', img: '/blockparty/f5-doge-fire.png', path: '/signals',
      detail: '28 ANOMALY PATTERNS CATCH WHAT HUMANS MISS — OI COMPRESSION BEFORE THE SQUEEZE, WHALE DEPOSITS BEFORE THE DUMP, LIQUIDATION CLUSTERS BEFORE THE CASCADE. SCORE 70+ = ALERT. SCORE 85+ = DROP EVERYTHING.',
      stats: [{ k: 'PATTERNS', v: '28' }, { k: 'SCAN CYCLE', v: '15 MIN' }, { k: 'ALERTS', v: 'REAL-TIME' }] },
    { label: 'COPY TRADE', sub: 'COMMUNITY', brief: 'STOP WATCHING. START COPYING. ONE CLICK.', img: '/blockparty/f5-doge-excited.png', path: '/signals',
      detail: 'SEE A SIGNAL YOU LIKE? ONE TAP. THE COPY WIZARD BUILDS YOUR ORDER — ENTRY, TP, SL, R:R — ALL CALCULATED. YOU JUST APPROVE OR SKIP. NO MATH. NO HESITATION. YOUR WALLET, YOUR RULES.',
      stats: [{ k: 'COPY WIZARD', v: '4-STEP' }, { k: 'R:R CALC', v: 'AUTO' }, { k: 'APPROVAL', v: 'YOU' }] },
  ];

  const SCAN_CATS = [
    { id: 'A', icon: '📊', label: 'OI + PRICE', desc: 'OI COMPRESSION, SHORT SQUEEZE, LONG LIQUIDATION TRAPS', count: 5 },
    { id: 'B', icon: '📈', label: 'VOLUME', desc: 'VOLUME SPIKES ON FLAT PRICE, PANIC SELLS, DEAD VOLUME', count: 4 },
    { id: 'C', icon: '⚡', label: 'FUNDING + LIQ', desc: 'EXTREME FUNDING RATES, LIQUIDATION CLUSTERS, L/S RATIOS', count: 4 },
    { id: 'D', icon: '🐋', label: 'ON-CHAIN', desc: 'WHALE EXCHANGE DEPOSITS, WITHDRAWALS, BLOCK ACCUMULATION', count: 4 },
    { id: 'E', icon: '💬', label: 'SOCIAL', desc: 'SOCIAL EXPLOSIONS, SENTIMENT DEPARTURE, FEAR & GREED', count: 3 },
    { id: 'F', icon: '🔗', label: 'COMPOSITE', desc: 'MULTI-WARNING CONVERGENCE, BOTTOM CONFIRMATION, BTC DECOUPLING', count: 4 },
    { id: 'G', icon: '🎯', label: 'DIRECT QUERY', desc: '"IS ETH SAFE TO BUY?" — ASK IN PLAIN ENGLISH, GET AI ANALYSIS', count: 4 },
  ];

  let selectedFeature: number | null = null;
  let heroRightEl: HTMLDivElement;
  let heroLeftEl: HTMLDivElement;
  let prefersReducedMotion = false;

  function selectFeature(i: number) {
    const next = selectedFeature === i ? null : i;
    if (next !== null) {
      trackHomeFunnel('hero_feature_select', 'click', {
        feature: FEATURES[i].sub,
      });
    }
    selectedFeature = next;
    // Reset left panel scroll to top when switching views
    if (heroLeftEl) {
      heroLeftEl.scrollTo({
        top: 0,
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });
    }
  }

  function onHeroKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && selectedFeature !== null) {
      selectedFeature = null;
      if (heroLeftEl) {
        heroLeftEl.scrollTo({
          top: 0,
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
        });
      }
    }
  }

  function handleHeroPrimaryCta() {
    trackHomeFunnel('hero_cta_click', 'click', {
      cta: 'enter_war_room',
      connected,
    });
    goto('/terminal');
  }

  function handleHeroSecondaryCta() {
    const cta = connected ? 'enter_arena' : 'connect_wallet';
    trackHomeFunnel('hero_cta_click', 'click', { cta, connected });
    if (connected) {
      goto('/arena');
      return;
    }
    openWalletModal();
  }

  const FLOW_STEPS = [
    { num: '01', title: 'CONNECT', desc: 'LINK WALLET IN 30 SECONDS. NO KYC. START FREE.', img: '/blockparty/f5-doge-excited.png', pct: 100 },
    { num: '02', title: 'SET CONDITIONS', desc: 'TYPE "OI COMPRESSION" OR "WHALE DEPOSIT" — SCANNER DOES THE REST.', img: '/blockparty/f5-doge-chart.png', pct: 85 },
    { num: '03', title: 'GET ALERTS', desc: 'SCORE 70+ = TOAST ALERT. SCORE 85+ = CRITICAL. AUTO DRAFT ORDERS.', img: '/blockparty/f5-doge-fire.png', pct: 90 },
    { num: '04', title: 'ACT', desc: 'APPROVE THE AI\'S DRAFT ORDER, BATTLE IN THE ARENA, OR COPY TRADE.', img: '/blockparty/f5-doge-muscle.png', pct: 95 },
  ];

  /* ── Animation system ── */
  let homeEl: HTMLDivElement;
  let heroReady = false;
  let heroIntroTimer: ReturnType<typeof setTimeout> | null = null;

  function onScroll() {
    if (!homeEl || prefersReducedMotion) return;
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
    heroIntroTimer = setTimeout(() => {
      heroReady = true;
      trackHomeFunnel('hero_view', 'view', { connected });
    }, 280);

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    window.addEventListener('keydown', onHeroKeydown);
    const syncMotionPreference = () => {
      prefersReducedMotion = motionQuery.matches;
    };
    syncMotionPreference();

    const onMotionPreferenceChange = () => syncMotionPreference();
    if (typeof motionQuery.addEventListener === 'function') {
      motionQuery.addEventListener('change', onMotionPreferenceChange);
    } else {
      motionQuery.addListener(onMotionPreferenceChange);
    }

    let obs: IntersectionObserver | null = null;
    if (homeEl) {
      homeEl.addEventListener('scroll', onScroll, { passive: true });

      obs = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              (e.target as HTMLElement).classList.add('vis');
              obs?.unobserve(e.target);
            }
          }
        },
        { root: homeEl, threshold: 0.01 }
      );

      requestAnimationFrame(() => {
        homeEl.querySelectorAll('.sr').forEach((el) => obs?.observe(el));
      });
    }

    return () => {
      if (heroIntroTimer) clearTimeout(heroIntroTimer);
      window.removeEventListener('keydown', onHeroKeydown);
      if (homeEl) homeEl.removeEventListener('scroll', onScroll);
      obs?.disconnect();
      if (typeof motionQuery.removeEventListener === 'function') {
        motionQuery.removeEventListener('change', onMotionPreferenceChange);
      } else {
        motionQuery.removeListener(onMotionPreferenceChange);
      }
    };
  });
</script>

<div class="home" bind:this={homeEl}>
  <!-- Stars layer -->
  <div class="stars" aria-hidden="true"></div>
  <div class="stars2" aria-hidden="true"></div>
  <!-- Diamond sparkle stars -->
  <div class="sparkles" aria-hidden="true">
    <span class="spk" style="top:8%;left:12%;--spk-d:0s;--spk-s:1.2">✦</span>
    <span class="spk" style="top:15%;left:45%;--spk-d:1.2s;--spk-s:0.8">✦</span>
    <span class="spk" style="top:22%;left:78%;--spk-d:0.5s;--spk-s:1">✦</span>
    <span class="spk" style="top:35%;left:5%;--spk-d:2s;--spk-s:0.6">✦</span>
    <span class="spk" style="top:42%;left:92%;--spk-d:1.8s;--spk-s:1.1">✦</span>
    <span class="spk" style="top:55%;left:25%;--spk-d:0.8s;--spk-s:0.7">✦</span>
    <span class="spk" style="top:62%;left:60%;--spk-d:3s;--spk-s:1.3">✦</span>
    <span class="spk" style="top:70%;left:88%;--spk-d:1.5s;--spk-s:0.9">✦</span>
    <span class="spk" style="top:80%;left:15%;--spk-d:2.5s;--spk-s:1">✦</span>
    <span class="spk" style="top:88%;left:50%;--spk-d:0.3s;--spk-s:0.7">✦</span>
    <span class="spk" style="top:5%;left:65%;--spk-d:1s;--spk-s:1.4">✦</span>
    <span class="spk" style="top:48%;left:38%;--spk-d:2.2s;--spk-s:0.5">✦</span>
  </div>
  <!-- Film grain noise -->
  <div class="grain" aria-hidden="true"></div>
  <!-- Old TV static interference -->
  <div class="tv-static" aria-hidden="true">
    <div class="tv-band tv-band-1"></div>
    <div class="tv-band tv-band-2"></div>
    <div class="tv-band tv-band-3"></div>
  </div>
  <!-- Full-screen CRT scanlines -->
  <div class="crt-overlay" aria-hidden="true"></div>
  <!-- Floating glow orbs -->
  <div class="orbs" aria-hidden="true">
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>
    <div class="orb orb-3"></div>
  </div>

  <!-- ═══════════════════════════════════════
       SECTION 1: HERO
       ═══════════════════════════════════════ -->
  <section class="hero" class:hero-go={heroReady}>
    <div class="hero-left" bind:this={heroLeftEl}>
      {#if selectedFeature !== null}
        <!-- Feature detail view -->
        <div class="feat-detail" id="hero-feature-detail" tabindex="-1">
          <button type="button" class="feat-back" on:click={() => selectFeature(selectedFeature ?? 0)}>← BACK</button>
          <span class="htag">//{FEATURES[selectedFeature].sub}</span>
          <div class="ht feat-detail-img" style="--ht-img:url({FEATURES[selectedFeature].img})">
            <img src={FEATURES[selectedFeature].img} alt={FEATURES[selectedFeature].label} />
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
          <button type="button" class="feat-detail-cta" on:click={() => goto(FEATURES[selectedFeature ?? 0].path)}>
            ENTER {FEATURES[selectedFeature].sub} →
          </button>
        </div>
      {:else}
        <!-- Default hero content -->
        <div class="hero-stack">
          <span class="htag ha" style="--ha-d:0s">//STOCKCLAW</span>
          <div class="ha" style="--ha-d:0.12s"><span class="hl hl-pk">ALPHA</span></div>
          <div class="hl-row ha" style="--ha-d:0.24s">
            <span class="hl hl-xl">DOGS</span>
            <div class="ht hero-doge-wrap" style="--ht-img:url(/blockparty/f5-doge-bull.png)">
              <img src="/blockparty/f5-doge-bull.png" alt="doge" class="hero-doge" />
            </div>
          </div>
        </div>
        <p class="hero-sub ha" style="--ha-d:0.44s">AI AGENTS THAT WATCH THE MARKET WHILE YOU SLEEP</p>
        <div class="hero-props ha" style="--ha-d:0.52s">
          <div class="hp"><span class="hp-icon">🔍</span><span class="hp-txt">28 ANOMALY PATTERNS SCAN 200+ PAIRS EVERY 15 MIN</span></div>
          <div class="hp"><span class="hp-icon">🐋</span><span class="hp-txt">WHALE MOVES, OI SPIKES, LIQUIDATION CLUSTERS — AUTO-DETECTED</span></div>
          <div class="hp"><span class="hp-icon">📋</span><span class="hp-txt">DRAFT ORDERS WITH TP/SL/R:R WHEN SCORE HITS 70+</span></div>
        </div>
        <div class="hero-status ha" style="--ha-d:0.56s" role="status" aria-live="polite">
          <div class="hs-chip">
            <span class="hs-k">WALLET</span>
            <span class="hs-v" class:hs-v-live={connected}>{connected ? wallet.shortAddr : 'NOT CONNECTED'}</span>
          </div>
          <div class="hs-chip">
            <span class="hs-k">OPEN TRADES</span>
            <span class="hs-v">{openPos}</span>
          </div>
          <div class="hs-chip">
            <span class="hs-k">TRACKED SIGNALS</span>
            <span class="hs-v">{trackedSigs}</span>
          </div>
        </div>
        <div class="hero-ctas ha" style="--ha-d:0.6s">
          <button type="button" class="hero-btn hero-btn-primary" on:click={handleHeroPrimaryCta}>ENTER WAR ROOM →</button>
          {#if !connected}
            <button type="button" class="hero-btn hero-btn-secondary" on:click={handleHeroSecondaryCta}>CONNECT WALLET</button>
          {:else}
            <button type="button" class="hero-btn hero-btn-secondary" on:click={handleHeroSecondaryCta}>ENTER ARENA →</button>
          {/if}
        </div>
        <div class="rbadges ha" style="--ha-d:0.7s">
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

    <div
      class="hero-right"
      bind:this={heroRightEl}
      aria-label="Feature explorer"
    >
      {#each FEATURES as feat, i}
        <button
          type="button"
          class="fc ha ha-r"
          class:fc-active={selectedFeature === i}
          style="--ha-d:{0.2 + i * 0.12}s"
          aria-controls="hero-feature-detail"
          aria-expanded={selectedFeature === i}
          aria-pressed={selectedFeature === i}
          on:click={() => selectFeature(i)}
        >
          <div class="fc-img"><div class="ht" style="--ht-img:url({feat.img})"><img src={feat.img} alt={feat.label} /></div></div>
          <div class="fc-txt">
            <span class="fc-sub">{feat.sub}</span>
            <h3 class="fc-lbl">{feat.label}</h3>
            <p class="fc-brief">{feat.brief}</p>
          </div>
        </button>
      {/each}
      <button type="button" class="fc-all ha ha-r" style="--ha-d:0.7s" on:click={enterTerminal}>
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
          <div class="ht fstep-imgwrap" style="--ht-img:url({step.img})"><img src={step.img} alt="" class="fstep-img" /></div>
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
        <div class="ht badge-face-wrap" style="--ht-img:url(/blockparty/f5-doge-face.png)"><img src="/blockparty/f5-doge-face.png" alt="" class="badge-face" /></div>
      </div>

      <div class="about-text sr sr-r" style="--d:0.15s">
        <p>
          <strong class="ab abg">8 AI DOGS</strong>
          <span class="ar">WATCHING</span>
          <strong class="ab abg">200+ PAIRS,</strong>
          <em class="ai">scanning</em>
          <strong class="ab abg">28 PATTERNS,</strong>
          <span class="ar">DETECTING</span>
          <strong class="ab abg">WHALE MOVES,</strong>
          <span class="as">OI COMPRESSION,</span>
          <strong class="ab abg">LIQUIDATION</strong>
          <em class="ai">clusters,</em>
          <span class="ar">FUNDING EXTREMES,</span>
          <strong class="ab abg">VOLUME SPIKES</strong>
          <span class="as">AND SOCIAL EXPLOSIONS</span>
          <span class="ar">SO YOU</span>
          <strong class="ab abx">NEVER</strong>
          <span class="ar">MISS</span>
          <strong class="ab abx">AGAIN.</strong>
        </p>
      </div>
    </div>
    <div class="about-tag sr su" style="--d:0.3s">YOUR AI PACK. NO SLEEP. NO MERCY. NO MISSED TRADES.</div>
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
    <p class="sq-sub sr sr-r" style="--d:0.1s">8 AI DOGS THAT EAT THE MARKET ALIVE</p>

    <div class="sq-frame">
      <div class="sq-grid">
        {#each AGDEFS as ag, i}
          <div class="sq-card sr sr-r" style="--ac:{ag.color};--d:{i * 0.07}s">
            <div class="ht sq-av-wrap" style="--ht-img:url({ag.img.def})"><img src={ag.img.def} alt={ag.name} class="sq-av" /></div>
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
       SECTION 5: SCANNER — WHAT WE DETECT
       ═══════════════════════════════════════ -->
  <section class="detect">
    <!-- Floating stars background -->
    <div class="detect-stars" aria-hidden="true">
      <span class="ds" style="top:8%;left:6%;--ds-d:0s">·</span>
      <span class="ds" style="top:15%;left:85%;--ds-d:1.5s">✦</span>
      <span class="ds" style="top:30%;left:20%;--ds-d:0.8s">·</span>
      <span class="ds" style="top:45%;left:92%;--ds-d:2.3s">✦</span>
      <span class="ds" style="top:55%;left:8%;--ds-d:1.1s">·</span>
      <span class="ds" style="top:70%;left:75%;--ds-d:0.3s">✦</span>
      <span class="ds" style="top:82%;left:40%;--ds-d:2s">·</span>
      <span class="ds" style="top:20%;left:55%;--ds-d:1.7s">·</span>
      <span class="ds" style="top:65%;left:35%;--ds-d:0.5s">✦</span>
      <span class="ds" style="top:90%;left:15%;--ds-d:2.8s">·</span>
      <span class="ds" style="top:38%;left:68%;--ds-d:1.3s">✦</span>
      <span class="ds" style="top:75%;left:55%;--ds-d:0.7s">·</span>
    </div>
    <div class="detect-header">
      <span class="detect-tag sr sr-r">//ANOMALY DETECTION</span>
      <h2 class="detect-title sr sr-r" style="--d:0.08s">
        <span class="dt-w">WHAT WE</span>
        <span class="dt-pk">DETECT</span>
      </h2>
      <p class="detect-sub sr sr-r" style="--d:0.18s">28 PATTERNS ACROSS 7 CATEGORIES — RUNNING 24/7</p>
    </div>

    <!-- A-E: Parallel data inputs -->
    <div class="dtl-phase-label sr sr-r" style="--d:0.08s">
      <span class="dtl-phase-tag">⚡ SIMULTANEOUS SCAN</span>
    </div>
    <div class="dtl-inputs">
      {#each SCAN_CATS.slice(0, 5) as cat, i}
        <div class="dtl-input sr sr-r" style="--d:{0.1 + i * 0.04}s">
          <span class="dtl-badge">{cat.id}</span>
          <span class="dtl-icon">{cat.icon}</span>
          <div class="dtl-input-body">
            <span class="dtl-label">{cat.label}</span>
            <span class="dtl-count">{cat.count}</span>
          </div>
          <p class="dtl-desc">{cat.desc}</p>
        </div>
      {/each}
    </div>

    <!-- Arrow / Flow -->
    <div class="dtl-flow sr su" style="--d:0.35s">
      <div class="dtl-flow-line"></div>
      <span class="dtl-flow-label">CONVERGE & ANALYZE</span>
      <div class="dtl-flow-line"></div>
    </div>

    <!-- F-G: Conclusion outputs -->
    <div class="dtl-phase-label sr su" style="--d:0.4s">
      <span class="dtl-phase-tag">🎯 AI CONCLUSION</span>
    </div>
    <div class="dtl-outputs">
      {#each SCAN_CATS.slice(5) as cat, i}
        <div class="dtl-output sr su" style="--d:{0.42 + i * 0.06}s">
          <span class="dtl-badge dtl-badge-out">{cat.id}</span>
          <span class="dtl-icon">{cat.icon}</span>
          <div class="dtl-output-body">
            <span class="dtl-label">{cat.label}</span>
            <span class="dtl-count">{cat.count}</span>
          </div>
          <p class="dtl-desc">{cat.desc}</p>
        </div>
      {/each}
    </div>

    <div class="detect-cta sr su" style="--d:0.5s">
      <p class="detect-example">"FIND COINS WHERE OI ROSE 4 CANDLES STRAIGHT BUT PRICE DIDN'T MOVE" → SCANNER HANDLES IT</p>
      <button class="hero-btn hero-btn-primary" on:click={enterTerminal}>TRY SCANNER NOW →</button>
    </div>
  </section>

  <!-- ═══════════════════════════════════════
       SECTION 6: FEED
       ═══════════════════════════════════════ -->
  <section class="feed">
    <div class="feed-l">
      <span class="fd-line fd-w sr sl">IN YOUR</span>
      <span class="fd-line fd-pk sr sl" style="--d:0.15s">FEED</span>
      <div class="ht feed-doge-wrap sr sl" style="--d:0.3s;--ht-img:url(/blockparty/f5-doge-fire.png)"><img src="/blockparty/f5-doge-fire.png" alt="" class="feed-doge" /></div>
    </div>
    <div class="feed-r">
      <button class="arena sr sr-r" on:click={enterArena}>
        <div class="arena-row">
          <div class="ht arena-img-wrap" style="--ht-img:url(/blockparty/f5-doge-muscle.png)"><img src="/blockparty/f5-doge-muscle.png" alt="" class="arena-img" /></div>
          <div class="arena-mid">
            <span class="arena-tag">AI vs YOU</span>
            <h3 class="arena-name">ARENA</h3>
            <p class="arena-sub">YOUR THESIS vs 8 AI AGENTS</p>
          </div>
          <div class="ht arena-img-wrap" style="--ht-img:url(/blockparty/f5-doge-bull.png)"><img src="/blockparty/f5-doge-bull.png" alt="" class="arena-img" /></div>
        </div>
        <div class="arena-ft"><span>5-PHASE</span><span>8 AGENTS</span><span>RANKING</span></div>
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
        <span class="cta-brand">STOCKCLAW</span>
        <span class="cta-loc">AI TRADING PLATFORM</span>
      </div>
    </div>
    <div class="cta-r">
      <div class="ht cta-doge-wrap sr sr-r" style="--ht-img:url(/blockparty/f5-doge-excited.png)"><img src="/blockparty/f5-doge-excited.png" alt="" class="cta-doge" /></div>
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
      <span class="foot-copy">© 2025 STOCKCLAW. ALL RIGHTS RESERVED.</span>
      <span class="foot-tag">such AI. very trade. much profit. wow.</span>
    </div>
  </footer>
</div>

<style>
  /* ═══════════════════════════════════════════════
     STOCKCLAW — LOOX LOST-IN-SPACE STYLE
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
    --sp-glow: rgba(232,150,125,0.34);
    --sp-grid: rgba(232,150,125,0.12);
  }

  /* ── BASE ── */
  .home {
    --fx-orb-blur: 54px;
    --fx-floor-glow: 0 0 5px rgba(232,150,125,0.56), 0 0 14px rgba(232,150,125,0.24), 0 0 24px rgba(232,150,125,0.1);
    --fx-card-hover-glow: inset 0 0 10px rgba(232,150,125,0.04), 0 0 8px rgba(232,150,125,0.05);
    --fx-btn-glow: 0 0 7px rgba(232,150,125,0.28);
    --fx-btn-glow-hover: 0 0 11px rgba(232,150,125,0.4);
    --fx-cta-glow: 0 0 10px rgba(232,150,125,0.24), 0 4px 10px rgba(0,0,0,0.24);
    --fx-cta-glow-hover: 0 0 14px rgba(232,150,125,0.34), 0 6px 12px rgba(0,0,0,0.28);
    --fx-live-dot-glow: 0 0 5px #00cc66;
    --fx-title-tag-glow: 0 0 4px rgba(232,150,125,0.2);
    --fx-title-pink-glow: 0 0 4px rgba(232,150,125,0.36), 0 0 10px rgba(232,150,125,0.12);
    --fx-title-pink-glow-squad: 0 0 3px rgba(232,150,125,0.28), 0 0 7px rgba(232,150,125,0.08);
    --fx-title-pink-glow-hero: 0 0 8px rgba(232,150,125,0.52), 0 0 20px rgba(232,150,125,0.2), 0 0 34px rgba(232,150,125,0.08);
    --fx-title-pink-fill: repeating-linear-gradient(
      0deg,
      var(--sp-pk) 0px, var(--sp-pk) 3px,
      rgba(232,150,125,0.15) 3px, rgba(232,150,125,0.15) 5px
    );
    --space-sec-x: clamp(16px, 3.8vw, 64px);
    --space-sec-y-lg: clamp(58px, 7.2vw, 94px);
    --space-hero-x: clamp(14px, 2.2vw, 34px);
    --space-hero-y-top: clamp(20px, 2.6vw, 36px);
    --space-hero-y-bottom: clamp(24px, 3vw, 40px);
    --fs-kicker: clamp(8px, 0.95vw, 11px);
    --fs-meta: clamp(8px, 0.95vw, 10px);
    --fs-copy: clamp(10px, 1.08vw, 13px);
    --fs-hero-white: clamp(30px, 5.4vw, 74px);
    --fs-hero-pink: clamp(34px, 6vw, 84px);
    --ls-kicker: clamp(1px, 0.24vw, 2.2px);
    --ls-copy: clamp(1px, 0.24vw, 2.4px);
    --ls-title: clamp(2px, 0.46vw, 5px);
    width: 100%; height: 100%;
    overflow-y: auto; overflow-x: hidden;
    background: var(--sp-bg);
    display: flex; flex-direction: column;
    position: relative;
  }
  .home > * { flex-shrink: 0; }
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

  /* ── DIAMOND SPARKLES ── */
  .sparkles {
    position: fixed; inset: 0;
    pointer-events: none; z-index: 0;
  }
  .spk {
    position: absolute;
    font-size: calc(8px * var(--spk-s, 1));
    color: rgba(135,220,190,0.7);
    text-shadow: 0 0 6px rgba(135,220,190,0.5);
    animation: sparkPulse 3s ease-in-out infinite alternate;
    animation-delay: var(--spk-d, 0s);
  }
  @keyframes sparkPulse {
    0% { opacity: 0.15; transform: scale(0.6) rotate(0deg); }
    50% { opacity: 1; transform: scale(1.2) rotate(45deg); }
    100% { opacity: 0.15; transform: scale(0.6) rotate(90deg); }
  }

  /* ── FILM GRAIN NOISE ── */
  .grain {
    position: fixed; inset: 0;
    pointer-events: none; z-index: 0;
    opacity: 0.035;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size: 200px 200px;
    animation: grainShift 0.3s steps(3) infinite;
  }
  @keyframes grainShift {
    0% { transform: translate(0, 0); }
    33% { transform: translate(-1px, 1px); }
    66% { transform: translate(1px, -1px); }
    100% { transform: translate(0, 0); }
  }

  /* ── OLD TV STATIC — short pink/dark alternating bands ── */
  .tv-static {
    position: fixed; inset: 0;
    pointer-events: none; z-index: 1;
    overflow: hidden;
  }
  .tv-band {
    position: absolute; left: 0; right: 0;
    opacity: 0;
  }
  /* Pink band */
  .tv-band-1 {
    height: 1px;
    background: rgba(232,150,125,0.35);
    box-shadow: 0 0 4px rgba(232,150,125,0.2);
    animation: tvPink1 1.2s steps(1) infinite;
  }
  /* Dark band */
  .tv-band-2 {
    height: 2px;
    background: rgba(0,0,0,0.5);
    animation: tvDark1 1.6s steps(1) infinite;
  }
  /* Pink band 2 */
  .tv-band-3 {
    height: 1px;
    background: rgba(232,150,125,0.3);
    box-shadow: 0 0 3px rgba(232,150,125,0.15);
    animation: tvPink2 2s steps(1) infinite;
  }
  @keyframes tvPink1 {
    0% { top: 22%; opacity: 0; }
    4% { top: 22%; opacity: 0.8; }
    6% { opacity: 0; }
    40% { top: 67%; opacity: 0; }
    42% { top: 67%; opacity: 0.6; }
    44% { opacity: 0; }
    78% { top: 41%; opacity: 0; }
    80% { top: 41%; opacity: 0.7; }
    82% { opacity: 0; }
    100% { opacity: 0; }
  }
  @keyframes tvDark1 {
    0% { top: 55%; opacity: 0; }
    5% { top: 55%; opacity: 0.7; }
    7% { opacity: 0; }
    35% { top: 12%; opacity: 0; }
    37% { top: 12%; opacity: 0.5; }
    39% { opacity: 0; }
    70% { top: 83%; opacity: 0; }
    72% { top: 83%; opacity: 0.6; }
    74% { opacity: 0; }
    100% { opacity: 0; }
  }
  @keyframes tvPink2 {
    0% { top: 35%; opacity: 0; }
    3% { top: 35%; opacity: 0.5; }
    5% { opacity: 0; }
    50% { top: 78%; opacity: 0; }
    52% { top: 78%; opacity: 0.7; }
    54% { opacity: 0; }
    100% { opacity: 0; }
  }

  /* ── FULL-SCREEN CRT SCANLINES ── */
  .crt-overlay {
    position: fixed; inset: 0;
    pointer-events: none; z-index: 0;
    background: repeating-linear-gradient(
      0deg,
      transparent 0px,
      transparent 3px,
      rgba(0,0,0,0.06) 3px,
      rgba(0,0,0,0.06) 4px
    );
    opacity: 0.5;
  }

  /* ── FLOATING GLOW ORBS ── */
  .orbs {
    position: fixed; inset: 0;
    pointer-events: none; z-index: 0;
    overflow: hidden;
  }
  .orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(var(--fx-orb-blur));
    opacity: 0.12;
    will-change: transform;
  }
  .orb-1 {
    width: 500px; height: 500px;
    background: radial-gradient(circle, rgba(232,150,125,0.6), transparent 70%);
    top: 10%; left: -5%;
    animation: orbFloat1 20s ease-in-out infinite alternate;
  }
  .orb-2 {
    width: 400px; height: 400px;
    background: radial-gradient(circle, rgba(135,220,190,0.5), transparent 70%);
    top: 50%; right: -8%;
    animation: orbFloat2 25s ease-in-out infinite alternate;
  }
  .orb-3 {
    width: 350px; height: 350px;
    background: radial-gradient(circle, rgba(232,150,125,0.4), transparent 70%);
    bottom: 10%; left: 30%;
    animation: orbFloat3 18s ease-in-out infinite alternate;
  }
  @keyframes orbFloat1 {
    0% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(80px, 60px) scale(1.15); }
    100% { transform: translate(-40px, 120px) scale(0.9); }
  }
  @keyframes orbFloat2 {
    0% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(-60px, -80px) scale(1.1); }
    100% { transform: translate(40px, -40px) scale(0.95); }
  }
  @keyframes orbFloat3 {
    0% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(60px, -50px) scale(1.2); }
    100% { transform: translate(-80px, 30px) scale(0.85); }
  }

  /* ── HALFTONE OVERLAY + CRT SCANLINE ── */
  .ht {
    position: relative; overflow: hidden; display: inline-block;
    /* Mask entire container to image silhouette — clips img + all overlays */
    -webkit-mask-image: var(--ht-img);
    mask-image: var(--ht-img);
    -webkit-mask-size: contain;
    mask-size: contain;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-position: center;
    mask-position: center;
  }
  .ht img {
    filter: contrast(1.4) brightness(1.1) sepia(0.8) hue-rotate(-25deg) saturate(1.8);
    display: block;
  }
  /* CRT scanline — horizontal electric lines */
  .ht::before {
    content: '';
    position: absolute; inset: 0; z-index: 2;
    background: repeating-linear-gradient(
      0deg,
      transparent 0px,
      transparent 2px,
      rgba(0,0,0,0.25) 2px,
      rgba(0,0,0,0.25) 3px
    );
    pointer-events: none;
    animation: scanFlicker 4s ease-in-out infinite alternate;
  }
  @keyframes scanFlicker {
    0% { opacity: 0.6; }
    50% { opacity: 0.9; }
    100% { opacity: 0.6; }
  }
  /* Halftone dot grid */
  .ht::after {
    content: '';
    position: absolute; inset: 0;
    background: radial-gradient(circle, rgba(10,26,13,0.35) 0.6px, transparent 0.6px);
    background-size: 3px 3px;
    mix-blend-mode: multiply;
    pointer-events: none;
  }

  /* ── PERSPECTIVE GRID FLOOR ── */
  .grid-floor {
    position: absolute; bottom: 0; left: -20%; right: -20%;
    height: 31%; z-index: 1; pointer-events: none;
    background:
      linear-gradient(90deg, var(--sp-grid) 1px, transparent 1px),
      linear-gradient(0deg, var(--sp-grid) 1px, transparent 1px);
    background-size: 60px 40px;
    transform: perspective(400px) rotateX(55deg);
    transform-origin: center top;
  }
  .grid-floor::before {
    content: '';
    position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: rgba(232,150,125,0.78);
    box-shadow: var(--fx-floor-glow);
    opacity: 0.82;
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
    display: grid;
    grid-template-columns: minmax(0, 1fr) clamp(300px, 34vw, 480px);
    gap: clamp(12px, 1.8vw, 28px);
    padding-inline: var(--space-sec-x);
    border-bottom: 2px solid rgba(232,150,125,0.2);
    position: relative;
    min-height: calc(100vh - var(--header-h, 48px));
    z-index: 2;
    align-items: stretch;
  }
  /* Ambient glow behind hero */
  .hero::before {
    content: '';
    position: absolute; top: 10%; left: 2%;
    width: 58%; height: 62%;
    background: radial-gradient(ellipse, rgba(232,150,125,0.04) 0%, transparent 70%);
    pointer-events: none; z-index: 0;
  }

  .hero-left {
    min-width: 0;
    width: 100%;
    max-width: min(100%, clamp(560px, 62vw, 860px));
    display: flex; flex-direction: column; align-items: flex-start; justify-content: safe center;
    padding: var(--space-hero-y-top) var(--space-hero-x) var(--space-hero-y-bottom);
    position: relative;
    overflow: visible;
    z-index: 3;
  }

  .hero-stack {
    display: flex; flex-direction: column; line-height: 0.95;
    gap: clamp(2px, 0.5vw, 8px);
    position: relative; z-index: 3;
  }
  .htag {
    font-family: var(--fp); font-size: var(--fs-kicker);
    color: var(--sp-pk); letter-spacing: var(--ls-kicker);
    margin-bottom: clamp(10px, 1.5vw, 18px);
    text-shadow: 0 0 6px var(--sp-glow);
    text-wrap: balance;
  }
  .hl {
    font-family: var(--fp); font-weight: 400;
    display: inline-block;
    color: var(--sp-w);
    text-shadow: 0 0 8px rgba(240,237,228,0.42), 0 0 20px rgba(240,237,228,0.1);
  }
  @supports ((-webkit-background-clip: text) or (background-clip: text)) {
    .hl {
      background: repeating-linear-gradient(
        0deg,
        var(--sp-w) 0px, var(--sp-w) 3px,
        rgba(240,237,228,0.15) 3px, rgba(240,237,228,0.15) 5px
      );
      -webkit-background-clip: text; background-clip: text;
      -webkit-text-fill-color: transparent;
    }
  }
  /* .hl-sm removed — no longer used */
  .hl-xl { font-size: var(--fs-hero-white); letter-spacing: var(--ls-title); }
  .hl-pk {
    font-size: var(--fs-hero-pink); letter-spacing: var(--ls-title);
    color: var(--sp-pk);
    text-shadow: var(--fx-title-pink-glow-hero);
  }
  @supports ((-webkit-background-clip: text) and (-webkit-text-fill-color: transparent)) {
    .hl-pk {
      background: var(--fx-title-pink-fill);
      -webkit-background-clip: text; background-clip: text;
      -webkit-text-fill-color: transparent;
    }
  }
  .hl-row { display: flex; align-items: center; flex-wrap: wrap; gap: clamp(8px, 1.2vw, 14px); min-width: 0; }

  .hero-doge-wrap { flex-shrink: 0; }
  .hero-doge {
    width: clamp(68px, 10vw, 138px); height: auto; object-fit: contain;
    animation: bob 3s ease-in-out infinite;
  }
  @keyframes bob {
    0%,100% { transform: translateY(0) rotate(0); }
    50% { transform: translateY(-8px) rotate(2deg); }
  }

  /* Review badges */
  .rbadges {
    display: flex; gap: clamp(10px, 1.5vw, 18px); margin-top: clamp(16px, 2.4vw, 28px); flex-wrap: wrap;
    width: min(100%, 760px);
  }
  .rbdg {
    display: flex; flex-direction: column; gap: 2px;
    padding: 8px 10px;
    border: 1px solid rgba(232,150,125,0.12);
    border-radius: 10px;
    background: rgba(232,150,125,0.03);
  }
  .rbdg-stars {
    font-family: var(--fp); font-size: clamp(10px, 1.2vw, 12px);
    color: var(--sp-pk); letter-spacing: clamp(1px, 0.24vw, 2px);
  }
  .rbdg-label {
    font-family: var(--fp); font-size: var(--fs-meta);
    color: var(--sp-pk); letter-spacing: clamp(0.8px, 0.2vw, 1.4px);
    text-shadow: 0 0 6px var(--sp-glow);
  }
  .rbdg-src {
    font-family: var(--fp); font-size: var(--fs-meta);
    color: var(--sp-w); letter-spacing: clamp(0.8px, 0.22vw, 1.8px); opacity: 0.65;
  }

  /* Hero subtitle + value props + CTAs */
  .hero-sub {
    font-family: var(--fp); font-size: var(--fs-copy);
    color: var(--sp-pk); letter-spacing: var(--ls-copy); margin-top: clamp(12px, 1.7vw, 20px);
    text-shadow: 0 0 8px var(--sp-glow);
    max-width: 52ch;
    line-height: 1.55;
    text-wrap: balance;
  }
  .hero-props { display: flex; flex-direction: column; gap: clamp(8px, 1vw, 12px); margin-top: clamp(12px, 1.7vw, 20px); width: min(100%, 76ch); }
  .hp { display: flex; align-items: flex-start; gap: 10px; min-width: 0; }
  .hp-icon { font-size: clamp(12px, 1.4vw, 14px); flex-shrink: 0; line-height: 1.3; }
  .hp-txt {
    font-family: var(--fp); font-size: var(--fs-copy);
    color: var(--sp-w); letter-spacing: clamp(0.8px, 0.22vw, 1.6px); opacity: 0.85; line-height: 1.62;
    text-wrap: pretty;
  }
  .hero-status {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: clamp(8px, 1vw, 12px);
    margin-top: clamp(12px, 1.7vw, 20px);
    width: min(100%, 920px);
  }
  .hs-chip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: clamp(8px, 1.2vw, 11px) clamp(10px, 1.4vw, 13px);
    border-radius: 8px;
    border: 1px solid rgba(232,150,125,0.2);
    background: rgba(232,150,125,0.04);
    min-width: 0;
  }
  .hs-k {
    font-family: var(--fp);
    font-size: var(--fs-meta);
    letter-spacing: clamp(0.8px, 0.2vw, 1.4px);
    color: var(--sp-dim);
    white-space: nowrap;
  }
  .hs-v {
    font-family: var(--fp);
    font-size: var(--fs-copy);
    color: var(--sp-w);
    letter-spacing: clamp(0.5px, 0.14vw, 0.9px);
    text-align: right;
    min-width: 0;
  }
  .hs-v-live {
    color: #89f4be;
    text-shadow: 0 0 10px rgba(137,244,190,0.3);
  }
  .hero-ctas { display: flex; gap: 12px; margin-top: clamp(16px, 2vw, 24px); flex-wrap: wrap; width: min(100%, 760px); }
  .hero-btn {
    font-family: var(--fp); font-size: clamp(9px, 1vw, 11px); letter-spacing: clamp(1.2px, 0.24vw, 2px);
    border: none; border-radius: 6px; padding: 14px 24px;
    cursor: pointer; transition: all .2s;
    min-width: 192px;
  }
  .hero-btn-primary {
    color: var(--sp-bg); background: var(--sp-pk);
    box-shadow: var(--fx-btn-glow);
  }
  .hero-btn-primary:hover { transform: translateY(-2px); box-shadow: var(--fx-btn-glow-hover); }
  .hero-btn-secondary {
    color: var(--sp-pk); background: transparent;
    border: 1px solid rgba(232,150,125,0.3);
  }
  .hero-btn-secondary:hover { background: rgba(232,150,125,0.08); border-color: var(--sp-pk); }

  .hero-btn:focus-visible,
  .fc:focus-visible,
  .fc-all:focus-visible,
  .feat-back:focus-visible,
  .feat-detail-cta:focus-visible,
  .arena:focus-visible,
  .qn:focus-visible,
  .cta-btn:focus-visible,
  .foot-nav button:focus-visible {
    outline: 2px solid var(--sp-pk);
    outline-offset: 2px;
  }

  /* Feature cards (right column) */
  .hero-right {
    min-width: 0;
    width: 100%;
    background: var(--sp-bg2);
    border-left: none;
    display: flex; flex-direction: column;
    position: relative;
    height: auto;
    overflow: visible;
    z-index: 3;
  }

  .fc {
    display: flex; flex-direction: column; background: transparent;
    border: none; border-bottom: 1px solid rgba(232,150,125,0.1);
    cursor: pointer; padding: 0; text-align: left;
    transition: background .4s, box-shadow .4s, border-color .4s;
    border-radius: 0;
    position: relative;
    overflow: hidden;
    min-height: clamp(220px, 41vh, 380px);
  }
  /* Glass reflection sweep */
  .fc::before {
    content: '';
    position: absolute;
    top: 0; left: -100%;
    width: 50%; height: 100%;
    background: linear-gradient(
      105deg,
      transparent 0%,
      transparent 35%,
      rgba(232,150,125,0.06) 42%,
      rgba(255,220,200,0.13) 50%,
      rgba(232,150,125,0.06) 58%,
      transparent 65%,
      transparent 100%
    );
    z-index: 5;
    pointer-events: none;
    transition: left 0.7s cubic-bezier(0.23, 1, 0.32, 1);
  }
  .fc:hover::before {
    left: 150%;
  }
  .fc:hover {
    background: rgba(232,150,125,0.06);
    box-shadow: var(--fx-card-hover-glow);
    border-bottom-color: rgba(232,150,125,0.25);
  }
  .fc-img {
    width: 100%; flex: 1; overflow: hidden;
    display: flex; align-items: center; justify-content: center;
    background: rgba(232,150,125,0.02);
    border-bottom: 1px solid rgba(232,150,125,0.06);
  }
  .fc-img .ht { width: 60%; }
  .fc-img img {
    width: 100%; max-height: 80%; object-fit: contain;
    transition: transform .4s cubic-bezier(.22,1,.36,1);
  }
  .fc:hover .fc-img img { transform: scale(1.1) rotate(-2deg); }
  .fc-txt { padding: clamp(12px, 1.4vw, 18px) clamp(14px, 1.8vw, 22px) clamp(14px, 2vw, 22px); }
  .fc-sub {
    font-family: var(--fp); font-size: var(--fs-meta);
    color: var(--sp-dim); letter-spacing: clamp(1px, 0.2vw, 2px);
  }
  .fc-lbl {
    font-family: var(--fp); font-size: clamp(11px, 1.2vw, 13px);
    color: var(--sp-pk); letter-spacing: clamp(0.8px, 0.18vw, 1.2px); line-height: 1.4; margin-top: 4px;
    text-shadow: 0 0 6px var(--sp-glow);
  }
  .fc-brief {
    font-family: var(--fv); font-size: 11px;
    color: var(--sp-w); letter-spacing: 0.5px; line-height: 1.5; margin-top: 6px;
    opacity: 0.7;
  }
  .fc-all {
    display: flex; align-items: center; justify-content: space-between;
    padding: 20px; background: transparent; border: none; cursor: pointer;
    font-family: var(--fp); font-size: 10px;
    letter-spacing: 2px; color: var(--sp-w); transition: color .15s;
    border-top: 1px solid rgba(232,150,125,0.08);
  }
  .fc-all:hover { color: var(--sp-pk); }
  .fc-arr { font-size: 16px; }

  /* Active card highlight */
  .fc-active { background: rgba(232,150,125,0.08); border-left: 3px solid var(--sp-pk); }
  .fc-active .fc-lbl { text-shadow: 0 0 8px var(--sp-pk), 0 0 20px var(--sp-glow); }

  /* ═══ FEATURE DETAIL (left panel) ═══ */
  .feat-detail {
    display: flex; flex-direction: column; align-items: flex-start;
    gap: 20px; position: relative; z-index: 3;
    animation: fadeSlideIn 0.35s cubic-bezier(.16,1,.3,1);
  }
  @keyframes fadeSlideIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .feat-back {
    font-family: var(--fp); font-size: 10px;
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
    text-shadow: 0 0 10px var(--sp-pk), 0 0 28px var(--sp-glow);
  }
  .feat-detail-desc {
    font-family: var(--fv); font-size: 14px;
    color: var(--sp-w); letter-spacing: 0.3px; line-height: 1.7;
    max-width: 440px; opacity: 0.8;
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
    font-family: var(--fp); font-size: 9px;
    color: var(--sp-dim); letter-spacing: 2px;
  }
  .feat-detail-cta {
    font-family: var(--fp); font-size: 9px; letter-spacing: 2px;
    color: var(--sp-bg); background: var(--sp-pk);
    border: none; border-radius: 6px;
    padding: 12px 24px; cursor: pointer; margin-top: 8px;
    transition: all .2s;
    box-shadow: var(--fx-btn-glow);
  }
  .feat-detail-cta:hover { transform: translateY(-2px); box-shadow: var(--fx-btn-glow-hover); }

  /* ═══ FLOW — MISSION STAGES ═══ */
  .flow {
    background: var(--sp-bg2); padding: var(--space-sec-y-lg) var(--space-sec-x);
    border-bottom: 2px solid rgba(232,150,125,0.15);
    position: relative; overflow: hidden; z-index: 2;
    min-height: 80vh;
  }
  .flow-header { text-align: center; margin-bottom: clamp(28px, 4vw, 48px); position: relative; z-index: 2; }
  .flow-tag {
    font-family: var(--fp); font-size: var(--fs-meta);
    color: var(--sp-pk); letter-spacing: var(--ls-kicker);
    display: block; margin-bottom: 12px;
    text-shadow: var(--fx-title-tag-glow);
  }
  .flow-title {
    font-family: var(--fp); line-height: 1.4;
  }
  .ft-w { font-size: clamp(20px, 4vw, 36px); color: var(--sp-w); display: block; }
  .ft-pk,
  .sq-pk,
  .dt-pk,
  .fd-pk,
  .cta-pk {
    display: block;
    width: fit-content;
    max-width: 100%;
    color: var(--sp-pk);
    text-shadow: var(--fx-title-pink-glow);
    line-height: 1.08;
  }
  .flow-title .ft-pk,
  .sq-title .sq-pk,
  .detect-title .dt-pk {
    margin-inline: auto;
  }
  .feed-l .fd-pk,
  .cta-l .cta-pk {
    margin-inline: 0;
  }
  @supports ((-webkit-background-clip: text) and (-webkit-text-fill-color: transparent)) {
    .ft-pk,
    .sq-pk,
    .dt-pk,
    .fd-pk,
    .cta-pk,
    .feat-detail-title {
      background: var(--fx-title-pink-fill);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
    }
  }
  .ft-pk {
    font-size: clamp(28px, 6vw, 56px);
  }
  .flow-sub {
    font-family: var(--fp); font-size: var(--fs-meta);
    color: var(--sp-dim); letter-spacing: clamp(1.4px, 0.32vw, 2.6px); margin-top: 12px;
    text-wrap: balance;
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
    color: var(--sp-pk); letter-spacing: clamp(1.4px, 0.32vw, 2.8px); line-height: 1.1;
    text-shadow: 0 0 10px var(--sp-glow);
  }
  .fstep-desc {
    font-family: var(--fv); font-size: clamp(12px, 1.3vw, 14px);
    color: var(--sp-w); letter-spacing: 0.3px; margin-top: 8px; line-height: 1.6;
    opacity: 0.7;
    max-width: 62ch;
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
    padding: var(--space-sec-y-lg) var(--space-sec-x) clamp(50px, 5vw, 72px);
    display: flex; flex-direction: column; align-items: center;
    border-bottom: 2px solid rgba(232,150,125,0.15);
    position: relative; overflow: hidden; z-index: 2;
    min-height: 60vh;
  }

  .about-inner {
    display: flex; align-items: flex-start; gap: 48px;
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
    font-family: var(--fv); font-size: clamp(21px, 2.6vw, 34px);
    line-height: 1.25; color: var(--sp-w); text-align: center;
    text-wrap: balance;
  }
  .ab { font-weight: 700; text-transform: uppercase; }
  .ai { font-style: italic; font-weight: 400; font-family: Georgia, serif; font-size: .85em; color: var(--sp-pk-l); }
  .ar { font-weight: 700; font-size: .7em; letter-spacing: 2px; text-transform: uppercase; color: var(--sp-dim); }
  .as { font-weight: 700; font-size: .55em; letter-spacing: 3px; text-transform: uppercase; color: var(--sp-dim); }
  .abg { font-size: 1.15em; color: var(--sp-pk); text-shadow: 0 0 6px var(--sp-glow); }
  .abx { font-size: 1.4em; color: var(--sp-pk); text-shadow: 0 0 8px var(--sp-glow); }

  .about-tag {
    font-family: var(--fp); font-size: var(--fs-meta);
    letter-spacing: clamp(1.6px, 0.42vw, 3.2px); color: var(--sp-dim); text-align: center;
    margin-top: 40px; padding-top: 20px;
    border-top: 1px solid rgba(232,150,125,0.08);
    width: 100%; max-width: 600px; position: relative; z-index: 2;
    text-wrap: balance;
  }

  /* ═══ SQUAD — CHARACTER SELECT ═══ */
  .squad {
    background: var(--sp-bg2);
    padding: var(--space-sec-y-lg) var(--space-sec-x); position: relative; overflow: hidden; z-index: 2;
    border-bottom: 2px solid rgba(232,150,125,0.15);
    min-height: 70vh;
  }
  .sq-tag {
    font-family: var(--fp); font-size: var(--fs-meta);
    color: var(--sp-pk); letter-spacing: var(--ls-kicker);
    display: block; text-align: center; margin-bottom: 10px;
    text-shadow: var(--fx-title-tag-glow);
  }
  .sq-title {
    font-family: var(--fp); font-size: clamp(24px, 5vw, 48px);
    line-height: 1.3; text-align: center;
    position: relative; z-index: 2;
  }
  .sq-w { color: var(--sp-w); display: block; }
  .sq-pk { text-shadow: var(--fx-title-pink-glow-squad); }
  .sq-sub {
    font-family: var(--fp); font-size: var(--fs-copy);
    color: var(--sp-dim); letter-spacing: clamp(1px, 0.24vw, 2px); margin-top: 8px;
    text-align: center; margin-bottom: 30px; position: relative; z-index: 2;
    text-wrap: balance;
  }

  /* Game frame around grid */
  @property --shimmer-angle {
    syntax: '<angle>';
    initial-value: 0deg;
    inherits: false;
  }
  .sq-frame {
    max-width: 960px; margin: 0 auto;
    border: 2px solid rgba(232,150,125,0.2); border-radius: 20px;
    padding: 24px; position: relative; z-index: 2;
    background: rgba(232,150,125,0.02);
    box-shadow: 0 0 20px rgba(232,150,125,0.08), inset 0 0 20px rgba(232,150,125,0.03);
  }
  /* Animated shimmer border */
  .sq-frame::before {
    content: '';
    position: absolute; inset: -2px;
    border-radius: 22px;
    background: conic-gradient(
      from var(--shimmer-angle, 0deg),
      transparent 0%,
      transparent 30%,
      rgba(232,150,125,0.6) 45%,
      rgba(255,220,200,0.95) 50%,
      rgba(232,150,125,0.6) 55%,
      transparent 70%,
      transparent 100%
    );
    -webkit-mask:
      linear-gradient(#fff 0 0) content-box,
      linear-gradient(#fff 0 0);
    mask:
      linear-gradient(#fff 0 0) content-box,
      linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    padding: 2px;
    animation: shimmerRotate 4s linear infinite;
    pointer-events: none;
    z-index: 3;
  }
  @keyframes shimmerRotate {
    0% { --shimmer-angle: 0deg; }
    100% { --shimmer-angle: 360deg; }
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
  .sq-av-wrap::after { -webkit-mask-size: cover; mask-size: cover; }
  .sq-av { width: 100%; height: 100%; object-fit: cover; }
  .sq-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
  .sq-nm { font-family: var(--fp); font-size: var(--fs-copy); letter-spacing: clamp(0.7px, 0.2vw, 1.2px); }
  .sq-rl { font-family: var(--fv); font-size: clamp(11px, 1.2vw, 13px); color: var(--sp-dim); }
  .sq-bar { width: 100%; height: 4px; background: rgba(232,150,125,0.1); border-radius: 2px; margin-top: 3px; overflow: hidden; }
  .sq-fill { height: 100%; border-radius: 2px; box-shadow: 0 0 4px var(--sp-glow); }
  .sq-pct { font-family: var(--fp); font-size: var(--fs-copy); color: var(--sp-pk); opacity: .6; margin-left: auto; }

  /* ═══ DETECT — SCANNER SHOWCASE ═══ */
  .detect {
    background: var(--sp-bg);
    padding: var(--space-sec-y-lg) var(--space-sec-x);
    border-bottom: 2px solid rgba(232,150,125,0.15);
    position: relative; overflow: hidden; z-index: 2;
  }
  .detect-stars {
    position: absolute; inset: 0;
    pointer-events: none; z-index: 0;
  }
  .ds {
    position: absolute;
    color: rgba(232,150,125,0.45);
    font-size: 22px;
    text-shadow: 0 0 8px rgba(232,150,125,0.35);
    animation: dsStar 5s ease-in-out infinite alternate;
    animation-delay: var(--ds-d, 0s);
  }
  @keyframes dsStar {
    0% { opacity: 0.1; transform: scale(0.5); }
    50% { opacity: 0.7; transform: scale(1.3); }
    100% { opacity: 0.1; transform: scale(0.5); }
  }
  .detect-header { text-align: center; margin-bottom: clamp(26px, 3.5vw, 40px); }
  .detect-tag {
    font-family: var(--fp); font-size: var(--fs-meta);
    color: var(--sp-pk); letter-spacing: var(--ls-kicker);
    display: block; margin-bottom: 12px;
    text-shadow: var(--fx-title-tag-glow);
  }
  .detect-title { font-family: var(--fp); line-height: 1.4; }
  .dt-w { font-size: clamp(16px, 3vw, 28px); color: var(--sp-w); display: block; }
  .dt-pk {
    font-size: clamp(22px, 5vw, 44px);
  }
  .detect-sub {
    font-family: var(--fp); font-size: var(--fs-meta);
    color: var(--sp-dim); letter-spacing: clamp(1.4px, 0.34vw, 2.8px); margin-top: 12px;
    text-wrap: balance;
  }

  /* Phase labels */
  .dtl-phase-label {
    text-align: center; margin-bottom: 16px;
  }
  .dtl-phase-tag {
    font-family: var(--fp); font-size: var(--fs-copy);
    color: var(--sp-pk); letter-spacing: clamp(1px, 0.22vw, 2px);
    background: rgba(232,150,125,0.06);
    border: 1px solid rgba(232,150,125,0.15);
    padding: 4px 14px; border-radius: 20px;
    text-shadow: 0 0 6px var(--sp-glow);
  }
  /* A-E: Parallel input grid */
  .dtl-inputs {
    max-width: 960px; margin: 0 auto 0;
    display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    gap: 10px;
  }
  .dtl-input, .dtl-output {
    background: var(--sp-bg2);
    border: 1px solid rgba(232,150,125,0.12);
    border-radius: 10px;
    padding: 16px;
    transition: transform .2s, box-shadow .2s, border-color .2s;
  }
  .dtl-input:hover, .dtl-output:hover {
    transform: translateY(-3px);
    box-shadow: 0 4px 20px rgba(232,150,125,0.1);
    border-color: rgba(232,150,125,0.3);
  }
  .dtl-badge {
    font-family: var(--fp); font-size: 10px; font-weight: 700;
    color: var(--sp-bg); background: var(--sp-pk);
    width: 24px; height: 24px; border-radius: 50%;
    display: inline-flex; align-items: center; justify-content: center;
    text-shadow: none;
    box-shadow: 0 0 8px var(--sp-glow);
    margin-right: 6px; vertical-align: middle;
  }
  .dtl-badge-out {
    background: rgba(135,220,190,0.9);
    box-shadow: 0 0 8px rgba(135,220,190,0.4);
  }
  .dtl-icon { font-size: 14px; vertical-align: middle; margin-right: 4px; }
  .dtl-input-body, .dtl-output-body {
    display: inline; vertical-align: middle;
  }
  .dtl-label {
    font-family: var(--fp); font-size: var(--fs-copy);
    color: var(--sp-pk); letter-spacing: 1px;
    text-shadow: 0 0 5px var(--sp-glow);
  }
  .dtl-count {
    font-family: var(--fp); font-size: var(--fs-meta);
    color: var(--sp-dim); margin-left: 6px;
    background: rgba(232,150,125,0.06);
    border: 1px solid rgba(232,150,125,0.15);
    padding: 1px 6px; border-radius: 4px;
    letter-spacing: 1px;
  }
  .dtl-desc {
    font-family: var(--fv); font-size: clamp(11px, 1.1vw, 13px);
    color: var(--sp-w); letter-spacing: 0.3px; line-height: 1.5;
    opacity: 0.55; margin-top: 8px;
  }

  /* Converge flow arrow */
  .dtl-flow {
    display: flex; align-items: center; gap: 12px;
    justify-content: center;
    margin: 28px 0;
  }
  .dtl-flow-line {
    height: 1px; width: 60px;
    background: linear-gradient(90deg, transparent, var(--sp-pk), transparent);
  }
  .dtl-flow-label {
    font-family: var(--fp); font-size: var(--fs-copy);
    color: var(--sp-pk); letter-spacing: clamp(1.6px, 0.34vw, 3px);
    text-shadow: 0 0 10px var(--sp-glow);
  }

  /* F-G: Conclusion outputs */
  .dtl-outputs {
    max-width: 640px; margin: 0 auto;
    display: grid; grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
  .dtl-output {
    border-color: rgba(135,220,190,0.2);
    background: rgba(135,220,190,0.03);
  }
  .dtl-output:hover {
    border-color: rgba(135,220,190,0.4);
    box-shadow: 0 4px 20px rgba(135,220,190,0.1);
  }
  .dtl-output .dtl-label { color: rgba(135,220,190,0.9); }

  .detect-cta {
    text-align: center; margin-top: 40px;
    display: flex; flex-direction: column; align-items: center; gap: 16px;
  }
  .detect-example {
    font-family: var(--fv); font-size: clamp(11px, 1.35vw, 14px);
    color: var(--sp-pk); letter-spacing: 0.3px;
    background: rgba(232,150,125,0.04);
    border: 1px solid rgba(232,150,125,0.12);
    padding: 14px 24px; border-radius: 8px;
    max-width: 700px; line-height: 1.6;
    text-shadow: 0 0 8px var(--sp-glow);
  }

  /* ═══ FEED ═══ */
  .feed {
    display: flex; background: var(--sp-bg);
    border-bottom: 2px solid rgba(232,150,125,0.15);
    overflow: hidden; z-index: 2;
    min-height: 80vh;
  }
  .feed-l {
    flex: 0 0 40%; display: flex; flex-direction: column;
    align-items: center; justify-content: center; padding: clamp(22px, 2.8vw, 42px);
    position: relative; overflow: hidden;
  }
  .fd-line {
    font-family: var(--fp); display: block;
    position: relative; z-index: 2; line-height: 1.2; text-align: center;
  }
  .fd-w { font-size: clamp(20px, 4vw, 36px); color: var(--sp-w); text-shadow: 0 0 10px rgba(240,237,228,0.3); }
  .fd-pk {
    font-size: clamp(36px, 8vw, 72px); letter-spacing: 4px;
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
    padding: clamp(16px, 2vw, 26px); display: flex; flex-direction: column; gap: 14px; overflow-y: auto;
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
  .arena-tag { font-family: var(--fp); font-size: 9px; color: var(--sp-dim); letter-spacing: 1px; }
  .arena-name {
    font-family: var(--fp); font-size: clamp(14px, 2vw, 20px); letter-spacing: clamp(1.6px, 0.34vw, 3.6px);
    color: var(--sp-pk); line-height: 1.4;
    text-shadow: 0 0 8px var(--sp-pk), 0 0 20px var(--sp-glow);
  }
  .arena-sub { font-family: var(--fp); font-size: 9px; color: var(--sp-dim); margin-top: 4px; }
  .arena-ft { display: flex; gap: 8px; justify-content: center; margin-top: 10px; }
  .arena-ft span {
    font-family: var(--fp); font-size: 9px; color: var(--sp-dim);
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
  .tk-n { font-family: var(--fp); font-size: 8px; color: var(--sp-dim); letter-spacing: 1px; }
  .tk-v { font-family: var(--fp); font-size: 10px; color: var(--sp-w); }
  .tk-sep { width: 1px; height: 20px; background: rgba(232,150,125,0.12); }

  .qg { display: flex; flex-wrap: wrap; gap: 8px; }
  .qn {
    font-family: var(--fp); font-size: var(--fs-meta);
    letter-spacing: clamp(1px, 0.26vw, 2px); color: var(--sp-w);
    background: transparent; border: 1px solid rgba(232,150,125,0.2);
    padding: 8px 14px; cursor: pointer; border-radius: 6px;
    transition: all .15s; display: flex; align-items: center; gap: 6px; white-space: nowrap;
  }
  .qn:hover { background: rgba(232,150,125,0.1); color: var(--sp-pk); border-color: var(--sp-pk); }
  .qn-b { font-size: 8px; background: var(--sp-pk); color: var(--sp-bg); padding: 1px 5px; border-radius: 4px; }

  /* ═══ CTA ═══ */
  .cta {
    background: var(--sp-bg2);
    padding: var(--space-sec-y-lg) var(--space-sec-x) clamp(84px, 10vw, 128px); display: flex; flex-wrap: wrap; gap: clamp(20px, 3.2vw, 34px);
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
    font-size: clamp(36px, 8vw, 80px); letter-spacing: 4px;
  }
  .cta-det { margin-top: 16px; display: flex; flex-direction: column; gap: 4px; }
  .cta-brand { font-family: var(--fp); font-size: clamp(10px, 1.2vw, 12px); color: var(--sp-pk); letter-spacing: clamp(1px, 0.24vw, 2px); }
  .cta-loc { font-family: var(--fp); font-size: var(--fs-meta); color: var(--sp-dim); letter-spacing: clamp(1px, 0.24vw, 2px); }

  .cta-r { flex: 1; min-width: 250px; display: flex; flex-direction: column; align-items: center; gap: 20px; position: relative; z-index: 3; }
  .cta-doge-wrap { width: 180px; }
  .cta-doge { width: 100%; object-fit: contain; }
  .cta-btn {
    font-family: var(--fp); font-size: clamp(9px, 1.05vw, 11px); letter-spacing: clamp(1.2px, 0.24vw, 2px);
    color: var(--sp-bg); background: var(--sp-pk);
    border: none; border-radius: 30px;
    padding: 16px 32px; cursor: pointer;
    transition: all .2s;
    box-shadow: var(--fx-cta-glow);
  }
  .cta-btn:hover { transform: translateY(-2px); box-shadow: var(--fx-cta-glow-hover); }
  .cta-connected {
    display: flex; align-items: center; gap: 8px;
    font-family: var(--fp); font-size: var(--fs-copy);
    color: #00cc66; background: var(--sp-bg); padding: 12px 20px;
    border: 1px solid rgba(0,204,102,0.3); border-radius: 8px;
  }
  .wc-dot { width: 8px; height: 8px; border-radius: 50%; background: #00cc66; box-shadow: var(--fx-live-dot-glow); }
  .wc-tier { font-size: var(--fs-meta); background: rgba(255,200,0,.15); color: #c8a000; padding: 2px 6px; border-radius: 4px; }

  .grid-floor-cta {
    height: 40%;
  }

  /* ═══ FOOTER ═══ */
  .foot {
    background: #060e08;
    border-top: 1px solid rgba(232,150,125,0.08);
    padding: clamp(22px, 3.4vw, 34px) var(--space-sec-x) clamp(18px, 2.4vw, 24px);
    display: flex; flex-direction: column; gap: 20px;
    z-index: 2; position: relative;
  }
  .foot-top { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; }
  .foot-logo { font-family: var(--fp); font-size: clamp(10px, 1.1vw, 12px); color: var(--sp-w); letter-spacing: clamp(1px, 0.22vw, 2px); }
  .foot-bolt { color: var(--sp-pk); text-shadow: 0 0 10px var(--sp-glow); }
  .foot-nav { display: flex; gap: 6px; flex-wrap: wrap; }
  .foot-nav button {
    font-family: var(--fp); font-size: var(--fs-meta);
    letter-spacing: clamp(1px, 0.24vw, 2px); color: var(--sp-dim);
    background: none; border: 1px solid rgba(232,150,125,0.1);
    padding: 6px 12px; cursor: pointer; transition: all .15s; border-radius: 4px;
  }
  .foot-nav button:hover { color: var(--sp-pk); border-color: rgba(232,150,125,0.3); }
  .foot-bot {
    display: flex; justify-content: space-between; align-items: center;
    flex-wrap: wrap; gap: 8px; padding-top: 16px;
    border-top: 1px solid rgba(232,150,125,0.06);
  }
  .foot-copy { font-family: var(--fp); font-size: clamp(7px, 0.82vw, 9px); letter-spacing: clamp(0.7px, 0.2vw, 1.2px); color: rgba(240,237,228,0.2); }
  .foot-tag { font-family: var(--fv); font-size: clamp(12px, 1.3vw, 14px); color: rgba(232,150,125,0.3); }

  @media (prefers-reduced-motion: reduce) {
    .sr,
    .ha {
      opacity: 1 !important;
      transform: none !important;
      transition: none !important;
    }
    .stars2,
    .sparkles .spk,
    .grain,
    .tv-band,
    .orb,
    .ht::before,
    .badge-svg,
    .hero-doge,
    .feed-doge,
    .sq-frame::before {
      animation: none !important;
    }
    .fc::before {
      transition: none !important;
    }
    .fc:hover .fc-img img,
    .fstep:hover .fstep-img,
    .hero-btn-primary:hover,
    .feat-detail-cta:hover,
    .arena:hover,
    .cta-btn:hover {
      transform: none !important;
    }
  }

  /* ═══ RESPONSIVE ═══ */
  @media (min-width: 901px) {
    .home {
      scroll-padding-top: var(--header-h, 48px);
    }
    .fc-img .ht { width: min(62%, 220px); }

    .flow,
    .about,
    .squad,
    .detect,
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

    .about-inner { max-width: 1140px; gap: clamp(28px, 4vw, 48px); }
    .about-text p { text-align: left; }
    .about-tag { max-width: 1080px; text-align: left; }

    .dtl-inputs { max-width: 1000px; }
    .sq-frame { max-width: 1080px; padding: clamp(18px, 2vw, 24px); }
    .sq-grid { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }

    .feed { align-items: stretch; }
    .feed-l { flex: 0 0 clamp(300px, 38%, 500px); }
    .feed-r { overflow: visible; }
  }

  @media (max-width: 1200px) {
    .hero {
      grid-template-columns: minmax(0, 1fr) clamp(280px, 36vw, 380px);
    }
    .hero-left {
      max-width: none;
    }
    .hl-pk { font-size: clamp(30px, 6.4vw, 66px); }
    .hl-xl { font-size: clamp(28px, 5.6vw, 58px); }
    .hero-sub { max-width: 46ch; }
    .hero-status {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      width: min(100%, 860px);
    }
    .hs-chip:first-child {
      grid-column: auto;
    }
    .hero-btn { min-width: 168px; }
    .fc { min-height: clamp(200px, 34vh, 300px); }
    .fc-img .ht { width: 54%; }
  }

  @media (max-width: 1080px) {
    .hero {
      grid-template-columns: minmax(0, 1fr);
      min-height: auto;
      gap: 0;
      padding-inline: 0;
    }
    .hero-left {
      max-width: none;
      padding: clamp(24px, 3vw, 30px) var(--space-sec-x) clamp(30px, 4vw, 40px);
      position: relative;
      top: auto;
      height: auto;
      overflow-y: visible;
    }
    .hero-right {
      width: 100%;
      max-width: 100%;
      position: static;
      height: auto;
      overflow-y: visible;
      border-left: none;
      border-top: 1px solid rgba(232,150,125,0.12);
    }
    .hero-status {
      width: 100%;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .hs-chip:first-child {
      grid-column: 1 / -1;
    }
    .hero-sub,
    .hero-props,
    .hero-ctas,
    .rbadges {
      width: 100%;
      max-width: none;
    }
    .fc { min-height: clamp(210px, 42vw, 300px); }
    .fc-img .ht { width: 46%; }

    .feed { flex-direction: column; }
    .feed-l { flex: 0 0 auto; }
  }

  @media (max-width: 900px) {
    .hero-left { padding: 22px var(--space-sec-x) 30px; }
    .hero-sub { letter-spacing: clamp(1px, 0.24vw, 1.8px); }
    .hero-status {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .hs-chip {
      align-items: flex-start;
      flex-direction: column;
      gap: 4px;
    }
    .hs-v { text-align: left; }
    .feat-detail-stats { flex-wrap: wrap; gap: 10px; }
    .feat-detail-title {
      font-size: clamp(24px, 6vw, 34px);
      letter-spacing: clamp(1.4px, 0.3vw, 2.6px);
    }
    .about-inner { flex-direction: column; align-items: center; }
    .flow { padding-top: clamp(48px, 8vw, 60px); padding-bottom: clamp(48px, 8vw, 60px); }
    .about { padding-bottom: clamp(34px, 5vw, 46px); }
    .detect { padding-top: clamp(48px, 8vw, 60px); padding-bottom: clamp(48px, 8vw, 60px); }
    .dtl-inputs { grid-template-columns: 1fr 1fr; }
    .dtl-outputs { grid-template-columns: 1fr; }
    .detect-example { font-size: 10px; padding: 10px 14px; }
    .feed-l { padding: 28px var(--space-sec-x); }
    .cta { padding-top: clamp(46px, 8vw, 58px); }
    .fstep-num { font-size: clamp(22px, 3.2vw, 26px); min-width: 48px; }
    .fstep-imgwrap { width: 60px; height: 60px; }
    .sq-frame { padding: 16px; border-radius: 14px; }
  }

  @media (max-width: 640px) {
    .hero-left { padding: 24px 16px 34px; }
    .hl-pk {
      font-size: clamp(32px, 11.5vw, 46px);
      letter-spacing: clamp(1.4px, 0.5vw, 2.4px);
    }
    .hl-xl {
      font-size: clamp(28px, 10.2vw, 40px);
      letter-spacing: clamp(1.4px, 0.46vw, 2.4px);
    }
    .hero-doge { width: clamp(52px, 13vw, 68px); }
    .hero-status {
      grid-template-columns: 1fr;
      gap: 8px;
    }
    .hs-chip {
      width: 100%;
      min-width: 0;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .hs-k { font-size: 8px; }
    .hs-v { font-size: 9px; text-align: right; }
    .hero-ctas {
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
    }
    .hero-btn {
      width: 100%;
      min-width: 0;
      display: inline-flex;
      justify-content: center;
      padding: 12px 16px;
    }
    .rbadges { gap: 10px; }
    .rbdg { width: 100%; }
    .about-text p { font-size: clamp(19px, 6.2vw, 24px); }
    .about-badge { width: 120px; height: 120px; }
    .badge-face-wrap { width: 45px; height: 45px; }
    .squad { padding: 34px 16px; }
    .sq-grid { grid-template-columns: 1fr; }
    .sq-frame { border-radius: 10px; }
    .feed-r { padding: 16px; }
    .arena-img-wrap { width: 45px; height: 45px; }
    .arena-name { font-size: 14px; letter-spacing: 2.2px; }
    .ticker { flex-wrap: wrap; gap: 10px; }
    .tk-sep { display: none; }
    .cta-w { font-size: clamp(22px, 8vw, 32px); }
    .cta-pk {
      font-size: clamp(30px, 10vw, 42px);
      letter-spacing: clamp(1.4px, 0.5vw, 2.6px);
    }
    .cta-doge-wrap { width: 120px; }
    .cta-btn { font-size: 9px; padding: 12px 20px; width: 100%; max-width: 320px; }
    .fstep { gap: 12px; padding: 20px 16px; }
    .fstep-num { font-size: 20px; min-width: 36px; }
    .fstep-title { font-size: 12px; }
    .fstep-imgwrap { width: 50px; height: 50px; }
    .fstep-bar { max-width: 120px; }
    .rbdg-stars { font-size: 10px; }
  }

  @media (max-width: 400px) {
    .hl-pk { font-size: clamp(26px, 12vw, 32px); }
    .hl-xl { font-size: clamp(24px, 10vw, 28px); }
    .hero-doge { width: 50px; }
    .about-text p { font-size: 18px; }
    .flow-sub,
    .detect-sub,
    .about-tag { letter-spacing: 1.2px; }
    .cta-w { font-size: 20px; }
    .cta-pk { font-size: 26px; }
  }
</style>
