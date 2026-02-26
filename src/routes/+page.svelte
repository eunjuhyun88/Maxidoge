<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { walletStore, isWalletConnected, openWalletModal } from '$lib/stores/walletStore';
  import { userProfileStore } from '$lib/stores/userProfileStore';
  import HomeBackground from '../components/home/HomeBackground.svelte';

  const connected = $derived($isWalletConnected);
  const wallet = $derived($walletStore);
  const profile = $derived($userProfileStore);

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
    { label: 'TERMINAL', sub: 'WAR ROOM', brief: 'ORPO READS THE CHART. CONTEXT AGENTS WATCH BEYOND IT.', img: '/blockparty/f5-doge-chart.png', path: '/terminal',
      detail: 'ORPO PROCESSES 90 INDICATORS PER PAIR. DERIV, FLOW, MACRO & SENTI FEED REAL-TIME CONTEXT. COMMANDER RESOLVES ALL CONFLICTS INTO ONE ENTRY SCORE.',
      stats: [{ k: 'INDICATORS', v: '90' }, { k: 'CONTEXT AGENTS', v: '4' }, { k: 'ENTRY SCORE', v: 'LIVE' }] },
    { label: 'ARENA', sub: 'AI VS YOU', brief: 'YOUR CALL FIRST. THEN ORPO CHALLENGES EVERY ANGLE.', img: '/blockparty/f5-doge-muscle.png', path: '/arena',
      detail: '5-PHASE STRESS TEST: SKILL SELECT → DRAFT → HYPOTHESIS → BATTLE → PASSPORT RECORD. INDEPENDENT JUDGMENT WINS.',
      stats: [{ k: 'PHASES', v: '5' }, { k: 'SKILLS', v: '6' }, { k: 'REWARDS', v: 'XP+RANK' }] },
    { label: 'SCANNER', sub: 'ANOMALY DETECTION', brief: '28 PATTERNS DETECT WHAT HUMANS MISS. REAL-TIME PUSH.', img: '/blockparty/f5-doge-fire.png', path: '/signals',
      detail: 'FR EXTREMES, WHALE $50M+ DEPOSITS, DXY SPIKES, LIQUIDATION CLUSTERS — 4 CONTEXT AGENTS CONVERGE INTO ACTIONABLE SIGNALS.',
      stats: [{ k: 'PATTERNS', v: '28' }, { k: 'CYCLE', v: '15 MIN' }, { k: 'ALERTS', v: 'PUSH' }] },
    { label: 'PASSPORT', sub: 'SKILL = DATA', brief: 'YOUR TRACK RECORD. IMMUTABLE. ON-CHAIN PROOF.', img: '/blockparty/f5-doge-excited.png', path: '/passport',
      detail: 'WIN RATE · LP SCORE · TIER · BEST SKILL · IDS (INDEPENDENT DECISION SCORE) — EVERY ARENA BATTLE BUILDS YOUR PASSPORT.',
      stats: [{ k: 'METRICS', v: '5+' }, { k: 'HISTORY', v: 'ALL' }, { k: 'PROOF', v: 'ON-CHAIN' }] },
    { label: 'ORACLE', sub: 'META INTELLIGENCE', brief: 'WHICH COMBOS ACTUALLY HIT? THE LEADERBOARD REVEALS ALL.', img: '/blockparty/f5-doge-bull.png', path: '/oracle',
      detail: 'ORPO SKILL × CONTEXT SPEC ACCURACY LEADERBOARD. SEE WHAT STRATEGIES TOP TRADERS USE AND WHERE ALPHA LIVES.',
      stats: [{ k: 'SKILLS', v: '6' }, { k: 'SPECS', v: '4' }, { k: 'RANKING', v: 'LIVE' }] },
  ];

  const SCAN_CATS = [
    { id: 'D', icon: '📊', label: 'DERIV', desc: 'FR / OI / LIQUIDATION CLUSTERS — DERIVATIVES OVERHEATING', count: 7 },
    { id: 'F', icon: '🐋', label: 'FLOW', desc: 'WHALE DEPOSITS $50M+, EXCHANGE FLOWS — SMART MONEY TRACKING', count: 6 },
    { id: 'M', icon: '🌍', label: 'MACRO', desc: 'DXY / RATES / VIX — MACRO HEADWIND & TAILWIND DETECTION', count: 5 },
    { id: 'S', icon: '💬', label: 'SENTI', desc: 'FEAR & GREED INDEX, SOCIAL EXPLOSIONS — CROWD SENTIMENT', count: 5 },
  ];

  /** Squad display — v7 architecture mapping (ORPO + 4 Context + COMMANDER) */
  const SQUAD_DISPLAY = [
    { name: 'ORPO', role: 'CHART PROFESSOR', color: '#e8967d', conf: 92, desc: '90 indicators × thousands of charts. Reads only the chart.' },
    { name: 'DERIV', role: 'DERIVATIVES CONTEXT', color: '#ff6b4a', conf: 75, desc: 'FR, OI, liquidation clusters — derivatives overheating.' },
    { name: 'FLOW', role: 'WHALE TRACKER', color: '#4acfff', conf: 71, desc: 'Exchange flows, whale deposits — smart money signals.' },
    { name: 'MACRO', role: 'MACRO WATCHDOG', color: '#ffd060', conf: 72, desc: 'DXY, rates, VIX — macro headwind & tailwind.' },
    { name: 'SENTI', role: 'CROWD READER', color: '#c840ff', conf: 68, desc: 'Fear & Greed, social data — crowd sentiment gauge.' },
    { name: 'COMMANDER', role: 'CONFLICT RESOLVER', color: '#00ff88', conf: 88, desc: 'ORPO vs Context conflict → Entry Score. Your edge.' },
  ];

  let selectedFeature: number | null = $state(null);
  let mobileSheet: number | null = $state(null);
  let isMobile = $state(false);
  let heroRightEl: HTMLDivElement;
  let heroLeftEl: HTMLDivElement;
  let prefersReducedMotion = false;
  const activeFeatureIndex = $derived(selectedFeature === null ? 0 : selectedFeature);

  function selectFeature(i: number) {
    if (isMobile) {
      // Mobile: open bottom sheet instead of swapping hero-left
      mobileSheet = mobileSheet === i ? null : i;
      if (mobileSheet !== null) {
        trackHomeFunnel('hero_feature_select', 'click', { feature: FEATURES[i].sub });
      }
      return;
    }
    const next = selectedFeature === i ? null : i;
    if (next !== null) {
      trackHomeFunnel('hero_feature_select', 'click', {
        feature: FEATURES[i].sub,
      });
    }
    selectedFeature = next;
  }

  function closeMobileSheet() {
    mobileSheet = null;
  }

  /** Desktop hero behavior: scroll right feature rail first, then let page continue. */
  function onWheel(e: WheelEvent) {
    if (!heroRightEl || window.innerWidth <= 900 || prefersReducedMotion) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    const heroSection = document.querySelector('.hero');
    if (!heroSection) return;
    const rect = heroSection.getBoundingClientRect();
    if (rect.bottom <= 100 || rect.top >= window.innerHeight - 100) return;

    const el = heroRightEl;
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll <= 0) return;

    const canScrollDown = el.scrollTop < maxScroll - 2;
    const canScrollUp = el.scrollTop > 2;

    if (e.deltaY > 0 && canScrollDown) {
      e.preventDefault();
      e.stopPropagation();
      el.scrollTop = Math.min(el.scrollTop + e.deltaY, maxScroll);
    } else if (e.deltaY < 0 && canScrollUp) {
      e.preventDefault();
      e.stopPropagation();
      el.scrollTop = Math.max(el.scrollTop + e.deltaY, 0);
    }
  }

  function onHeroKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (mobileSheet !== null) { mobileSheet = null; return; }
      if (selectedFeature !== null) { selectedFeature = null; }
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
    { num: '02', title: 'SCAN', desc: 'ORPO READS THE CHART. 4 CONTEXT AGENTS WATCH THE WORLD BEYOND IT.', img: '/blockparty/f5-doge-chart.png', pct: 85 },
    { num: '03', title: 'DECIDE', desc: 'YOUR JUDGMENT FIRST. THEN COMPARE WITH ORPO. INDEPENDENT THINKING WINS.', img: '/blockparty/f5-doge-fire.png', pct: 90 },
    { num: '04', title: 'EARN', desc: 'ARENA BATTLES → PASSPORT STATS → LP REWARDS. SKILL COMPOUNDS.', img: '/blockparty/f5-doge-muscle.png', pct: 95 },
  ];

  /* ── Animation system ── */
  let homeEl: HTMLDivElement;
  let heroReady = $state(false);
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

    /* ── Mobile breakpoint tracking ── */
    const mobileQuery = window.matchMedia('(max-width: 1080px)');
    isMobile = mobileQuery.matches;
    const onMobileChange = (e: MediaQueryListEvent) => {
      isMobile = e.matches;
      if (!e.matches) { mobileSheet = null; }        // close sheet when switching to desktop
      if (e.matches) { selectedFeature = null; }      // reset desktop detail when switching to mobile
    };
    if (typeof mobileQuery.addEventListener === 'function') {
      mobileQuery.addEventListener('change', onMobileChange);
    } else {
      mobileQuery.addListener(onMobileChange);
    }

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    window.addEventListener('keydown', onHeroKeydown);
    let wheelBound = false;
    const setWheelCapture = (enabled: boolean) => {
      if (enabled && !wheelBound) {
        window.addEventListener('wheel', onWheel, { passive: false, capture: true });
        wheelBound = true;
      } else if (!enabled && wheelBound) {
        window.removeEventListener('wheel', onWheel, { capture: true });
        wheelBound = false;
      }
    };
    const syncMotionPreference = () => {
      prefersReducedMotion = motionQuery.matches;
      setWheelCapture(!prefersReducedMotion);
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
      requestAnimationFrame(() => {
        homeEl.scrollTop = 0;
        if (heroLeftEl) heroLeftEl.scrollTop = 0;
        if (heroRightEl) heroRightEl.scrollTop = 0;
      });
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
      setWheelCapture(false);
      if (homeEl) homeEl.removeEventListener('scroll', onScroll);
      obs?.disconnect();
      if (typeof motionQuery.removeEventListener === 'function') {
        motionQuery.removeEventListener('change', onMotionPreferenceChange);
      } else {
        motionQuery.removeListener(onMotionPreferenceChange);
      }
      if (typeof mobileQuery.removeEventListener === 'function') {
        mobileQuery.removeEventListener('change', onMobileChange);
      } else {
        mobileQuery.removeListener(onMobileChange);
      }
    };
  });
</script>

<div class="home" bind:this={homeEl}>
  <HomeBackground />

  <!-- ═══════════════════════════════════════
       SECTION 1: HERO
       ═══════════════════════════════════════ -->
  <section class="hero {heroReady ? 'hero-go' : ''}">
    <div class="hero-left {selectedFeature !== null ? 'hero-left-detail' : ''}" bind:this={heroLeftEl}>
      {#if selectedFeature !== null}
        <!-- Feature detail view -->
        <div class="feat-detail" id="hero-feature-detail" tabindex="-1">
          <button type="button" class="feat-back" onclick={() => selectFeature(selectedFeature ?? 0)}>← BACK</button>
          <span class="htag">{FEATURES[selectedFeature].sub}</span>
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
          <button type="button" class="feat-detail-cta" onclick={() => goto(FEATURES[selectedFeature ?? 0].path)}>
            ENTER {FEATURES[selectedFeature].sub} →
          </button>
        </div>
      {:else}
        <!-- Default hero content — ORPO-centric -->
        <h1 class="hero-stack">
          <span class="htag ha" style="--ha-d:0s">Stockclaw</span>
          <span class="ha" style="--ha-d:0.1s"><span class="hl hl-pk">ALPHA</span></span>
          <span class="hl-row ha" style="--ha-d:0.2s">
            <span class="hl hl-xl">DOGS</span>
            <span class="ht hero-doge-wrap" style="--ht-img:url(/blockparty/f5-doge-bull.png)">
              <img src="/blockparty/f5-doge-bull.png" alt="doge" class="hero-doge" />
            </span>
          </span>
        </h1>
        <p class="hero-sub ha" style="--ha-d:0.3s">
          <span class="hero-sub-v">MEET ORPO — AI CHART PROFESSOR THAT READS THE MARKET</span>
        </p>
        <div class="hero-props ha" style="--ha-d:0.36s">
          <div class="hp hp-prime"><span class="hp-icon">◉</span><span class="hp-txt">90 INDICATORS × THOUSANDS OF CHARTS TRAINED · 4 CONTEXT AGENTS ON WATCH · REAL-TIME ENTRY SCORE</span></div>
        </div>
        <div class="hero-ctas ha" style="--ha-d:0.42s">
          <button type="button" class="hero-btn hero-btn-primary" onclick={handleHeroPrimaryCta}>ENTER WAR ROOM →</button>
          {#if !connected}
            <button type="button" class="hero-btn hero-btn-secondary" onclick={handleHeroSecondaryCta}>CONNECT WALLET</button>
          {:else}
            <button type="button" class="hero-btn hero-btn-secondary" onclick={handleHeroSecondaryCta}>ENTER ARENA →</button>
          {/if}
        </div>
        <div class="hero-social ha" style="--ha-d:0.48s">
          <span class="hs-stars">★★★★★</span>
          <div class="hs-quote">
            <span class="hs-quote-txt">BEST AI DOGS</span>
            <span class="hs-quote-src">— DEGENS</span>
            <span class="hs-quote-src">— CRYPTO TWITTER</span>
          </div>
        </div>
      {/if}
    </div>

    <div
      class="hero-right"
      bind:this={heroRightEl}
      aria-label="Feature explorer"
    >
      <div class="hero-right-head ha ha-r" style="--ha-d:0.14s">
        <span class="fr-k">OUR FEATURES</span>
        <span class="fr-hint">{activeFeatureIndex + 1}/{FEATURES.length} · {FEATURES[activeFeatureIndex].sub}</span>
      </div>
      {#each FEATURES as feat, i}
        <button
          type="button"
          class="fc ha ha-r {selectedFeature === i ? 'fc-active' : ''}"
          style="--ha-d:{0.24 + i * 0.12}s"
          aria-pressed={selectedFeature === i}
          onclick={() => selectFeature(i)}
        >
          <div class="fc-img"><div class="ht" style="--ht-img:url({feat.img})"><img src={feat.img} alt={feat.label} /></div></div>
          <div class="fc-txt">
            <span class="fc-sub">{feat.sub}</span>
            <h3 class="fc-lbl">{feat.label}</h3>
            <p class="fc-brief">{feat.brief}</p>
          </div>
        </button>
      {/each}
      <a href="/terminal" class="fc-all ha ha-r" style="--ha-d:0.7s">
        VIEW ALL <span class="fc-arr">→</span>
      </a>
    </div>

    <!-- Perspective grid floor -->
    <div class="grid-floor" aria-hidden="true"></div>
  </section>

  <!-- ═══════════════════════════════════════
       SECTION 2: WHY DIFFERENT
       ═══════════════════════════════════════ -->
  <section class="about">
    <div class="about-header">
      <span class="about-kicker sr sr-r">WHY DIFFERENT</span>
      <h2 class="about-title sr sr-r" style="--d:0.08s">
        <span class="ab-line">SEEING THE AGENT FIRST</span>
        <span class="ab-line ab-pk">CORRUPTS YOUR JUDGMENT</span>
      </h2>
    </div>
    <div class="why-grid">
      <div class="why-card sr sr-r" style="--d:0.15s">
        <span class="why-num">01</span>
        <strong class="why-label">ORPO — CHART PROFESSOR</strong>
        <p class="why-desc">90 indicators × thousands of charts. Reads only the chart. No noise. No bias.</p>
      </div>
      <div class="why-card sr sr-r" style="--d:0.22s">
        <span class="why-num">02</span>
        <strong class="why-label">4 CONTEXT AGENTS</strong>
        <p class="why-desc">DERIV · FLOW · MACRO · SENTI — monitoring everything beyond the chart 24/7.</p>
      </div>
      <div class="why-card sr sr-r" style="--d:0.29s">
        <span class="why-num">03</span>
        <strong class="why-label">COMMANDER</strong>
        <p class="why-desc">Resolves ORPO vs Context conflict → Entry Score. One number. Your edge.</p>
      </div>
    </div>
    <div class="about-tag sr su" style="--d:0.4s">YOUR JUDGMENT FIRST. AI SECOND. THAT'S THE ALPHA.</div>
  </section>

  <!-- ═══════════════════════════════════════
       SECTION 3: FLOW — HOW IT WORKS
       ═══════════════════════════════════════ -->
  <section class="flow">
    <div class="flow-header">
      <span class="flow-tag sr sr-r">THE JOURNEY</span>
      <h2 class="flow-title sr sr-r" style="--d:0.08s" data-px="0.06">
        <span class="ft-w">HOW IT</span>
        <span class="ft-pk">WORKS</span>
      </h2>
      <p class="flow-sub sr sr-r" style="--d:0.18s">4 STEPS FROM CONNECT TO COMPOUND</p>
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
          <div class="ht fstep-imgwrap" style="--ht-img:url({step.img})"><img src={step.img} alt="" class="fstep-img" loading="lazy" /></div>
        </div>
      {/each}
    </div>
  </section>

  <!-- ═══════════════════════════════════════
       SECTION 5: SQUAD — THE ARCHITECTURE
       ═══════════════════════════════════════ -->
  <section class="squad">
    <span class="sq-tag sr sl">THE ARCHITECTURE</span>
    <h2 class="sq-title sr sl" style="--d:0.06s" data-px="0.05">
      <span class="sq-w">THE</span>
      <span class="sq-pk">SQUAD</span>
    </h2>
    <p class="sq-sub sr sr-r" style="--d:0.1s">ORPO + 4 CONTEXT AGENTS + COMMANDER</p>

    <div class="sq-frame">
      <div class="sq-grid sq-grid-6">
        {#each SQUAD_DISPLAY as ag, i}
          <div class="sq-card sr sr-r" style="--ac:{ag.color};--d:{i * 0.07}s">
            <div class="sq-info">
              <span class="sq-nm" style="color:var(--ac)">{ag.name}</span>
              <span class="sq-rl">{ag.role}</span>
              <p class="sq-desc">{ag.desc}</p>
              <div class="sq-bar"><div class="sq-fill" style="width:{ag.conf}%;background:var(--ac)"></div></div>
            </div>
            <div class="sq-pct">{ag.conf}%</div>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- ═══════════════════════════════════════
       SECTION 4: CONTEXT AGENTS — BEYOND THE CHART
       ═══════════════════════════════════════ -->
  <section class="detect">
    <div class="detect-stars" aria-hidden="true">
      <span class="ds" style="top:8%;left:6%;--ds-d:0s">·</span>
      <span class="ds" style="top:15%;left:85%;--ds-d:1.5s">✦</span>
      <span class="ds" style="top:30%;left:20%;--ds-d:0.8s">·</span>
      <span class="ds" style="top:45%;left:92%;--ds-d:2.3s">✦</span>
      <span class="ds" style="top:55%;left:8%;--ds-d:1.1s">·</span>
      <span class="ds" style="top:70%;left:75%;--ds-d:0.3s">✦</span>
    </div>
    <div class="detect-header">
      <span class="detect-tag sr sr-r">CONTEXT AGENTS</span>
      <h2 class="detect-title sr sr-r" style="--d:0.08s">
        <span class="dt-w">BEYOND THE</span>
        <span class="dt-pk">CHART</span>
      </h2>
      <p class="detect-sub sr sr-r" style="--d:0.18s">4 SPECIALIZED AGENTS MONITOR WHAT ORPO CAN'T SEE</p>
    </div>

    <div class="dtl-inputs dtl-inputs-4">
      {#each SCAN_CATS as cat, i}
        <div class="dtl-input sr sr-r" style="--d:{0.1 + i * 0.06}s">
          <span class="dtl-badge">{cat.id}</span>
          <span class="dtl-icon">{cat.icon}</span>
          <div class="dtl-input-body">
            <span class="dtl-label">{cat.label}</span>
            <span class="dtl-count">{cat.count} PATTERNS</span>
          </div>
          <p class="dtl-desc">{cat.desc}</p>
        </div>
      {/each}
    </div>

    <div class="dtl-flow sr su" style="--d:0.35s">
      <div class="dtl-flow-line"></div>
      <span class="dtl-flow-label">CONVERGE → COMMANDER → ENTRY SCORE</span>
      <div class="dtl-flow-line"></div>
    </div>

    <div class="detect-cta sr su" style="--d:0.45s">
      <p class="detect-example">ORPO READS THE CHART. CONTEXT WATCHES THE WORLD. COMMANDER DECIDES.</p>
      <button class="hero-btn hero-btn-primary" onclick={enterTerminal}>ENTER TERMINAL →</button>
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
        <span class="cta-loc">ORPO-POWERED AI TRADING</span>
      </div>
    </div>
    <div class="cta-r">
      <div class="ht cta-doge-wrap sr sr-r" style="--ht-img:url(/blockparty/f5-doge-excited.png)"><img src="/blockparty/f5-doge-excited.png" alt="" class="cta-doge" loading="lazy" /></div>
      {#if !connected}
        <button class="cta-btn sr sr-r" style="--d:0.15s" onclick={openWalletModal}>⚡ CONNECT WALLET</button>
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

  <!-- ═══ MOBILE FEATURE BOTTOM SHEET ═══ -->
  {#if mobileSheet !== null}
    <div
      class="m-sheet-backdrop"
      role="presentation"
      onclick={closeMobileSheet}
      onkeydown={(e) => e.key === 'Escape' && closeMobileSheet()}
    ></div>
    <div class="m-sheet" role="dialog" aria-modal="true" aria-label={FEATURES[mobileSheet].label}>
      <div class="m-sheet-handle"></div>
      <button type="button" class="m-sheet-close" onclick={closeMobileSheet} aria-label="Close">✕</button>
      <span class="m-sheet-tag">{FEATURES[mobileSheet].sub}</span>
      <div class="ht m-sheet-img" style="--ht-img:url({FEATURES[mobileSheet].img})">
        <img src={FEATURES[mobileSheet].img} alt={FEATURES[mobileSheet].label} />
      </div>
      <h2 class="m-sheet-title">{FEATURES[mobileSheet].label}</h2>
      <p class="m-sheet-desc">{FEATURES[mobileSheet].detail}</p>
      <div class="m-sheet-stats">
        {#each FEATURES[mobileSheet].stats as s}
          <div class="m-sheet-stat">
            <span class="m-sheet-stat-v">{s.v}</span>
            <span class="m-sheet-stat-k">{s.k}</span>
          </div>
        {/each}
      </div>
      <button type="button" class="m-sheet-cta" onclick={() => goto(FEATURES[mobileSheet ?? 0].path)}>
        ENTER {FEATURES[mobileSheet].sub} →
      </button>
    </div>
  {/if}

  <!-- ═══ FOOTER ═══ -->
  <footer class="foot">
    <div class="foot-top">
      <div class="foot-logo" data-px="-0.04">STOCK<span class="foot-bolt">⚡</span>CLAW</div>
      <div class="foot-nav">
        <a href="/terminal">TERMINAL</a>
        <a href="/arena">ARENA</a>
        <a href="/signals">SCANNER</a>
        <a href="/passport">PASSPORT</a>
        <a href="/oracle">ORACLE</a>
      </div>
    </div>
    <div class="foot-bot">
      <span class="foot-copy">© 2026 STOCKCLAW. ALL RIGHTS RESERVED.</span>
      <span class="foot-tag">ORPO reads. You decide. WAGMI.</span>
    </div>
  </footer>
</div>

<style>
  /* ═══════════════════════════════════════════════
     STOCKCLAW — LOOX LOST-IN-SPACE STYLE
     Dark green-black + Salmon pink retro game
     ═══════════════════════════════════════════════ */

  /* ── GLOBAL: Kill yellow body background from app.css ── */
  :global(html), :global(body) {
    background: #0a1a0d !important;
  }

  /* ── PALETTE ── */
  :root {
    --sp-bg: #0a1a0d;
    --sp-bg2: #0f2614;
    --sp-pk: #E8967D;
    --sp-pk-l: #F5C4B8;
    --sp-w: #F0EDE4;
    --sp-dim: rgba(240,237,228,0.6);
    --sp-glow: rgba(232,150,125,0.35);
    --sp-grid: rgba(232,150,125,0.12);
  }

  /* ── BASE ── */
  .home {
    --fx-orb-blur: 24px;
    --fx-glow-sm:   0 0 4px rgba(232,150,125,0.25);
    --fx-glow-md:   0 0 8px rgba(232,150,125,0.3), 0 0 16px rgba(232,150,125,0.1);
    --fx-glow-lg:   0 0 12px rgba(232,150,125,0.35), 0 4px 12px rgba(0,0,0,0.25);
    --fx-glow-text: 0 0 5px rgba(232,150,125,0.3), 0 0 12px rgba(232,150,125,0.1);
    --fx-glow-live: 0 0 5px #00cc66;
    --fx-title-pink-fill: repeating-linear-gradient(
      0deg,
      var(--sp-pk) 0px, var(--sp-pk) 3px,
      rgba(232,150,125,0.15) 3px, rgba(232,150,125,0.15) 5px
    );
    --space-sec-x: clamp(20px, 4vw, 64px);
    --space-sec-y-lg: clamp(64px, 8vw, 96px);
    --space-hero-x: clamp(20px, 2.8vw, 40px);
    --space-hero-y-top: clamp(24px, 3vw, 40px);
    --space-hero-y-bottom: clamp(24px, 3vw, 40px);
    --fs-kicker: clamp(9px, 0.95vw, 11px);
    --fs-meta: clamp(9px, 0.95vw, 11px);
    --fs-copy: clamp(11px, 1.1vw, 13px);
    --fs-subhead: clamp(11px, 1vw, 13px);
    --fs-prop: clamp(9.5px, 0.85vw, 11px);
    --fs-chip-k: clamp(9px, 0.85vw, 10px);
    --fs-chip-v: clamp(11px, 1.08vw, 14px);
    --fs-hero-white: clamp(48px, 6.5vw, 95px);
    --fs-hero-pink: clamp(54px, 7.25vw, 110px);
    --ls-kicker: clamp(1px, 0.24vw, 2.2px);
    --ls-copy: clamp(1px, 0.24vw, 2.4px);
    --ls-title: clamp(2px, 0.44vw, 4.8px);
    width: 100%; height: 100%;
    overflow-y: auto; overflow-x: hidden;
    background: var(--sp-bg);
    display: flex; flex-direction: column;
    position: relative;
  }
  .home > * { flex-shrink: 0; }
  .home {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .home::-webkit-scrollbar {
    width: 0;
    height: 0;
    display: none;
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
    animation: scanFlicker 6s ease-in-out infinite alternate;
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
    position: absolute; bottom: 0; left: -10%; right: -10%;
    height: 25%; z-index: 1; pointer-events: none; opacity: 0.6;
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
    box-shadow: var(--fx-glow-sm);
    opacity: 0.82;
  }

  /* ════════════════════════════════════════════
     ANIMATION SYSTEM (same mechanics, new look)
     ════════════════════════════════════════════ */
  .sr {
    opacity: 0;
    transition: opacity 0.9s cubic-bezier(.16,1,.3,1), transform 0.9s cubic-bezier(.16,1,.3,1);
    transition-delay: var(--d, 0s);
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
    grid-template-columns: minmax(0, 1fr) clamp(296px, 31vw, 420px);
    gap: clamp(12px, 1.6vw, 24px);
    padding-inline: var(--space-sec-x);
    border-bottom: 1px solid rgba(232,150,125,0.08);
    position: relative;
    min-height: min(calc(100dvh - var(--header-h, 48px)), 900px);
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
    max-width: min(100%, clamp(560px, 64vw, 860px));
    display: flex; flex-direction: column; align-items: flex-start; justify-content: center;
    padding: var(--space-hero-y-top) var(--space-hero-x) var(--space-hero-y-bottom);
    position: sticky;
    top: var(--header-h, 48px);
    height: calc(100vh - var(--header-h, 48px));
    height: calc(100dvh - var(--header-h, 48px));
    overflow-y: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
    z-index: 3;
  }
  .hero-left::-webkit-scrollbar { width: 0; height: 0; display: none; }

  .hero-stack {
    display: flex; flex-direction: column; line-height: 0.95;
    gap: clamp(2px, 0.45vw, 8px);
    position: relative; z-index: 3;
    margin: 0; font-weight: inherit;
  }
  .htag {
    font-family: var(--fp); font-size: var(--fs-kicker);
    color: var(--sp-pk); letter-spacing: var(--ls-kicker);
    margin-bottom: clamp(9px, 1.3vw, 15px);
    text-shadow: 0 0 6px var(--sp-glow);
    text-wrap: balance;
  }
  .hl {
    font-family: var(--fp); font-weight: 400;
    display: inline-block;
    color: var(--sp-w);
    text-shadow: 0 0 5px rgba(240,237,228,0.24), 0 0 10px rgba(240,237,228,0.09);
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
    text-shadow: var(--fx-glow-text);
  }
  @supports ((-webkit-background-clip: text) and (-webkit-text-fill-color: transparent)) {
    .hl-pk {
      background: var(--fx-title-pink-fill);
      -webkit-background-clip: text; background-clip: text;
      -webkit-text-fill-color: transparent;
    }
  }
  .hl-row { display: flex; align-items: center; flex-wrap: wrap; gap: clamp(8px, 1.1vw, 14px); min-width: 0; }

  .hero-doge-wrap { flex-shrink: 0; }
  .hero-doge {
    width: clamp(80px, 12vw, 170px); height: auto; object-fit: contain;
    animation: bob 3s ease-in-out infinite;
  }
  @keyframes bob {
    0%,100% { transform: translateY(0) rotate(0); }
    50% { transform: translateY(-7px) rotate(2deg); }
  }

  /* Hero subtitle + value props + CTAs */
  .hero-sub {
    font-family: var(--fp); margin-top: clamp(16px, 2vw, 24px);
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .hero-sub-v {
    font-size: var(--fs-subhead);
    color: var(--sp-pk);
    letter-spacing: var(--ls-copy);
    text-shadow: 0 0 6px var(--sp-glow);
    max-width: 60ch;
    line-height: 1.3;
    text-wrap: balance;
  }
  .hero-props { display: flex; flex-direction: column; gap: clamp(4px, 0.6vw, 8px); margin-top: clamp(10px, 1.3vw, 16px); width: 100%; }
  .hp { display: flex; align-items: flex-start; gap: 9px; min-width: 0; }
  .hp-icon { font-size: clamp(12px, 1.3vw, 14px); flex-shrink: 0; line-height: 1.25; }
  .hp-txt {
    font-family: var(--fp); font-size: var(--fs-prop);
    color: var(--sp-w); letter-spacing: clamp(0.7px, 0.2vw, 1.3px); opacity: 0.76; line-height: 1.4;
    text-wrap: pretty;
  }
  .hp-prime .hp-txt {
    opacity: 0.96;
    color: rgba(240,237,228,0.98);
  }
  .hero-ctas { display: flex; gap: 12px; margin-top: clamp(16px, 2vw, 22px); flex-wrap: wrap; width: min(100%, 760px); }
  .hero-btn {
    font-family: var(--fp); font-size: clamp(10.4px, 1.08vw, 13px); letter-spacing: clamp(1.1px, 0.22vw, 1.7px);
    border: none; border-radius: 6px; padding: 14px 24px;
    cursor: pointer; transition: all .2s;
    min-width: 180px;
  }
  .hero-btn-primary {
    color: var(--sp-bg); background: var(--sp-pk);
    box-shadow: var(--fx-glow-md);
    padding: 16px 32px; min-width: 200px; border-radius: 8px;
    font-size: clamp(11px, 1.15vw, 14px);
  }
  .hero-btn-primary:hover { transform: translateY(-2px); box-shadow: var(--fx-glow-lg); }
  .hero-btn-secondary {
    color: var(--sp-pk); background: transparent;
    border: 1px solid rgba(232,150,125,0.3);
  }
  .hero-btn-secondary:hover { background: rgba(232,150,125,0.08); border-color: var(--sp-pk); }

  /* Social proof */
  .hero-social {
    display: flex; align-items: center; gap: 14px;
    margin-top: clamp(14px, 1.8vw, 22px);
    padding-top: clamp(10px, 1.4vw, 16px);
    border-top: 1px solid rgba(232,150,125,0.1);
  }
  .hs-stars {
    font-size: clamp(12px, 1.3vw, 15px); color: #f5c842;
    letter-spacing: 2px; line-height: 1;
  }
  .hs-quote { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .hs-quote-txt {
    font-family: var(--fp); font-size: clamp(10px, 1vw, 12px);
    color: var(--sp-pk); letter-spacing: 1.5px; font-weight: 700;
  }
  .hs-quote-src {
    font-family: var(--fp); font-size: clamp(10px, 0.9vw, 11px);
    color: var(--sp-dim); letter-spacing: 1px;
  }

  .hero-btn:focus-visible,
  .fc:focus-visible,
  .fc-all:focus-visible,
  .feat-back:focus-visible,
  .feat-detail-cta:focus-visible,
  .cta-btn:focus-visible,
  .foot-nav a:focus-visible {
    outline: 2px solid var(--sp-pk);
    outline-offset: 2px;
  }

  /* Feature cards (right column): this is the only visible scrollbar in hero on desktop */
  .hero-right {
    min-width: 0;
    width: 100%;
    background: var(--sp-bg2);
    border-left: none;
    display: flex; flex-direction: column;
    position: sticky;
    top: var(--header-h, 48px);
    height: calc(100vh - var(--header-h, 48px));
    height: calc(100dvh - var(--header-h, 48px));
    overflow-y: auto;
    z-index: 3;
  }
  .hero-right-head {
    position: sticky;
    top: 0;
    z-index: 7;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 14px;
    border-bottom: 1px solid rgba(232,150,125,0.14);
    background: linear-gradient(180deg, rgba(15,38,20,0.96) 0%, rgba(15,38,20,0.88) 100%);
    backdrop-filter: blur(3px);
  }
  .fr-k {
    font-family: var(--fp);
    font-size: clamp(10px, 1.02vw, 12px);
    color: var(--sp-pk);
    letter-spacing: clamp(1.2px, 0.22vw, 1.9px);
    text-shadow: 0 0 6px var(--sp-glow);
  }
  .fr-hint {
    font-family: var(--fp);
    font-size: clamp(10px, 0.95vw, 11px);
    color: var(--sp-dim);
    letter-spacing: clamp(1px, 0.22vw, 1.6px);
  }
  .hero-right::-webkit-scrollbar { width: 6px; }
  .hero-right::-webkit-scrollbar-thumb {
    background: rgba(232,150,125,0.9);
    border-radius: 4px;
  }
  .hero-right::-webkit-scrollbar-track { background: rgba(232,150,125,0.06); }
  .hero-right { scrollbar-color: rgba(232,150,125,0.9) rgba(232,150,125,0.06); scrollbar-width: thin; }

  .fc {
    display: flex; flex-direction: column; background: transparent;
    border: none; border-bottom: 1px solid rgba(232,150,125,0.1);
    cursor: pointer; padding: 0; text-align: left;
    transition: background .4s, box-shadow .4s, border-color .4s;
    border-radius: 0;
    position: relative;
    overflow: hidden;
    min-height: clamp(190px, 32vh, 288px);
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
    box-shadow: var(--fx-glow-md);
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
    font-family: var(--fp); font-size: clamp(10px, 0.95vw, 11px);
    color: var(--sp-dim); letter-spacing: clamp(1px, 0.2vw, 2px);
  }
  .fc-lbl {
    font-family: var(--fp); font-size: clamp(13px, 1.32vw, 16px);
    color: var(--sp-pk); letter-spacing: clamp(0.8px, 0.18vw, 1.2px); line-height: 1.4; margin-top: 4px;
    text-shadow: 0 0 6px var(--sp-glow);
  }
  .fc-brief {
    font-family: var(--fv); font-size: clamp(10.5px, 0.98vw, 12px);
    color: var(--sp-w); letter-spacing: 0.5px; line-height: 1.5; margin-top: 6px;
    opacity: 0.82;
  }
  .fc-all {
    display: flex; align-items: center; justify-content: space-between;
    padding: 20px; background: transparent; border: none; cursor: pointer;
    font-family: var(--fp); font-size: 10px;
    letter-spacing: 2px; color: var(--sp-w); transition: color .15s;
    border-top: 1px solid rgba(232,150,125,0.08);
    text-decoration: none;
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
    font-family: var(--fp); font-size: 10px;
    color: var(--sp-dim); letter-spacing: 2px;
  }
  .feat-detail-cta {
    font-family: var(--fp); font-size: 10px; letter-spacing: 2px;
    color: var(--sp-bg); background: var(--sp-pk);
    border: none; border-radius: 6px;
    padding: 12px 24px; cursor: pointer; margin-top: 8px;
    transition: all .2s;
    box-shadow: var(--fx-glow-md);
  }
  .feat-detail-cta:hover { transform: translateY(-2px); box-shadow: var(--fx-glow-lg); }

  /* ═══ FLOW — MISSION STAGES ═══ */
  .flow {
    background: var(--sp-bg2); padding: var(--space-sec-y-lg) var(--space-sec-x);
    border-bottom: 1px solid rgba(232,150,125,0.08);
    position: relative; overflow: hidden; z-index: 2;
    min-height: auto;
    content-visibility: visible;
    contain: layout style;
  }
  .flow-header { text-align: center; margin-bottom: clamp(28px, 4vw, 48px); position: relative; z-index: 2; }
  .flow-tag {
    font-family: var(--fp); font-size: var(--fs-meta);
    color: var(--sp-pk); letter-spacing: var(--ls-kicker);
    display: block; margin-bottom: 12px;
    text-shadow: var(--fx-glow-sm);
  }
  .flow-title {
    font-family: var(--fp); line-height: 1.4;
  }
  .ft-w { font-size: clamp(20px, 4vw, 36px); color: var(--sp-w); display: block; }
  .ft-pk,
  .sq-pk,
  .dt-pk,
  .cta-pk {
    display: block;
    width: fit-content;
    max-width: 100%;
    color: var(--sp-pk);
    text-shadow: var(--fx-glow-text);
    line-height: 1.08;
  }
  .flow-title .ft-pk,
  .sq-title .sq-pk,
  .detect-title .dt-pk {
    margin-inline: auto;
  }
  .cta-l .cta-pk {
    margin-inline: 0;
  }
  @supports ((-webkit-background-clip: text) and (-webkit-text-fill-color: transparent)) {
    .ft-pk,
    .sq-pk,
    .dt-pk,
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

  /* ═══ ABOUT — WHY DIFFERENT ═══ */
  .about {
    background: var(--sp-bg);
    padding: clamp(96px, 12vw, 160px) var(--space-sec-x) clamp(64px, 7vw, 96px);
    display: flex; flex-direction: column; align-items: center;
    border-bottom: 1px solid rgba(232,150,125,0.08);
    position: relative; overflow: hidden; z-index: 2;
    min-height: auto;
    content-visibility: visible;
  }

  .about-header {
    text-align: center; margin-bottom: clamp(40px, 5vw, 64px);
    position: relative; z-index: 2;
  }
  .about-kicker {
    font-family: var(--fp); font-size: var(--fs-meta);
    color: var(--sp-pk); letter-spacing: var(--ls-kicker);
    display: block; margin-bottom: 12px;
    text-shadow: var(--fx-glow-sm);
  }
  .about-title {
    font-family: var(--fp); line-height: 1.3;
  }
  .ab-line {
    display: block;
    font-size: clamp(18px, 3.2vw, 36px);
    color: var(--sp-w);
    letter-spacing: clamp(1px, 0.22vw, 2px);
  }
  .ab-pk {
    color: var(--sp-pk);
    text-shadow: 0 0 12px var(--sp-glow);
    font-size: clamp(22px, 3.8vw, 42px);
    text-decoration: underline;
    text-decoration-color: rgba(232,150,125,0.5);
    text-underline-offset: 6px;
    text-decoration-thickness: 2px;
  }

  .why-grid {
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: clamp(16px, 2vw, 24px);
    max-width: 900px; width: 100%;
    position: relative; z-index: 2;
  }
  .why-card {
    background: var(--sp-bg2);
    border: 1px solid rgba(232,150,125,0.12);
    border-radius: 12px;
    padding: clamp(20px, 2.4vw, 32px);
    transition: transform .2s, box-shadow .2s, border-color .2s;
  }
  .why-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 4px 20px rgba(232,150,125,0.1);
    border-color: rgba(232,150,125,0.3);
  }
  .why-num {
    font-family: var(--fp); font-size: clamp(24px, 3vw, 36px);
    color: var(--sp-pk); opacity: 0.3;
    display: block; margin-bottom: 8px;
  }
  .why-label {
    font-family: var(--fp); font-size: var(--fs-copy);
    color: var(--sp-pk); letter-spacing: 1px;
    display: block; margin-bottom: 8px;
    text-shadow: 0 0 6px var(--sp-glow);
  }
  .why-desc {
    font-family: var(--fv); font-size: clamp(12px, 1.2vw, 14px);
    color: var(--sp-w); line-height: 1.6;
    opacity: 0.7;
  }

  .about-tag {
    font-family: var(--fp); font-size: var(--fs-meta);
    letter-spacing: clamp(1.6px, 0.42vw, 3.2px); color: var(--sp-dim); text-align: center;
    margin-top: 40px; padding-top: 20px;
    border-top: 1px solid rgba(232,150,125,0.08);
    width: 100%; max-width: 900px; position: relative; z-index: 2;
    text-wrap: balance;
  }

  /* ═══ SQUAD — CHARACTER SELECT ═══ */
  .squad {
    background: var(--sp-bg2);
    padding: var(--space-sec-y-lg) var(--space-sec-x); position: relative; overflow: hidden; z-index: 2;
    border-bottom: 1px solid rgba(232,150,125,0.08);
    min-height: auto;
    content-visibility: visible;
    contain: layout style;
  }
  .sq-tag {
    font-family: var(--fp); font-size: var(--fs-meta);
    color: var(--sp-pk); letter-spacing: var(--ls-kicker);
    display: block; text-align: center; margin-bottom: 10px;
    text-shadow: var(--fx-glow-sm);
  }
  .sq-title {
    font-family: var(--fp); font-size: clamp(24px, 5vw, 48px);
    line-height: 1.3; text-align: center;
    position: relative; z-index: 2;
  }
  .sq-w { color: var(--sp-w); display: block; }
  .sq-pk { text-shadow: var(--fx-glow-sm); }
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
  .sq-grid-6 {
    grid-template-columns: repeat(3, 1fr);
  }
  .sq-card {
    display: flex; align-items: center; gap: 10px; padding: 12px 14px;
    background: var(--sp-bg);
    border: 1px solid rgba(232,150,125,0.15);
    border-radius: 8px;
    cursor: default; transition: transform .2s, box-shadow .2s;
  }
  .sq-card:hover { transform: translateY(-3px); box-shadow: 0 4px 20px rgba(232,150,125,0.12); }
  .sq-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
  .sq-nm { font-family: var(--fp); font-size: var(--fs-copy); letter-spacing: clamp(0.7px, 0.2vw, 1.2px); }
  .sq-rl { font-family: var(--fv); font-size: clamp(11px, 1.2vw, 13px); color: var(--sp-dim); }
  .sq-desc { font-family: var(--fv); font-size: clamp(11px, 1.1vw, 13px); color: var(--sp-w); opacity: 0.6; line-height: 1.5; margin-top: 4px; }
  .sq-bar { width: 100%; height: 4px; background: rgba(232,150,125,0.1); border-radius: 2px; margin-top: 3px; overflow: hidden; }
  .sq-fill { height: 100%; border-radius: 2px; box-shadow: 0 0 4px var(--sp-glow); }
  .sq-pct { font-family: var(--fp); font-size: var(--fs-copy); color: var(--sp-pk); opacity: .8; margin-left: auto; }

  /* ═══ DETECT — SCANNER SHOWCASE ═══ */
  .detect {
    background: var(--sp-bg);
    padding: var(--space-sec-y-lg) var(--space-sec-x);
    border-bottom: 1px solid rgba(232,150,125,0.08);
    position: relative; overflow: hidden; z-index: 2;
    content-visibility: visible;
    contain: layout style;
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
    text-shadow: var(--fx-glow-sm);
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

  /* Context Agent grid */
  .dtl-inputs {
    max-width: 960px; margin: 0 auto 0;
    display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    gap: 10px;
  }
  .dtl-inputs-4 {
    grid-template-columns: repeat(4, 1fr);
    max-width: 1000px;
  }
  .dtl-input {
    background: var(--sp-bg2);
    border: 1px solid rgba(232,150,125,0.12);
    border-radius: 10px;
    padding: 16px;
    transition: transform .2s, box-shadow .2s, border-color .2s;
  }
  .dtl-input:hover {
    transform: translateY(-3px);
    box-shadow: 0 4px 20px rgba(232,150,125,0.1);
    border-color: rgba(232,150,125,0.3);
  }
  .dtl-badge {
    font-family: var(--fp); font-size: 9px; font-weight: 700;
    color: var(--sp-bg); background: var(--sp-pk);
    width: 28px; height: 28px; border-radius: 50%;
    display: inline-flex; align-items: center; justify-content: center;
    text-shadow: none;
    box-shadow: 0 0 8px var(--sp-glow);
    margin-right: 6px; vertical-align: middle;
  }
  .dtl-icon { font-size: 14px; vertical-align: middle; margin-right: 4px; }
  .dtl-input-body {
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

  /* ═══ CTA ═══ */
  .cta {
    background: var(--sp-bg2);
    padding: var(--space-sec-y-lg) var(--space-sec-x) clamp(84px, 10vw, 128px); display: flex; flex-wrap: wrap; gap: clamp(20px, 3.2vw, 34px);
    position: relative; overflow: hidden; z-index: 2;
    min-height: auto;
    content-visibility: visible;
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
    font-family: var(--fp); font-size: clamp(10px, 1.05vw, 11px); letter-spacing: clamp(1.2px, 0.24vw, 2px);
    color: var(--sp-bg); background: var(--sp-pk);
    border: none; border-radius: 30px;
    padding: 16px 32px; cursor: pointer;
    transition: all .2s;
    box-shadow: var(--fx-glow-lg);
  }
  .cta-btn:hover { transform: translateY(-2px); box-shadow: var(--fx-glow-lg); }
  .cta-connected {
    display: flex; align-items: center; gap: 8px;
    font-family: var(--fp); font-size: var(--fs-copy);
    color: #00cc66; background: var(--sp-bg); padding: 12px 20px;
    border: 1px solid rgba(0,204,102,0.3); border-radius: 8px;
  }
  .wc-dot { width: 8px; height: 8px; border-radius: 50%; background: #00cc66; box-shadow: var(--fx-glow-live); }
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
  .foot-nav a {
    font-family: var(--fp); font-size: var(--fs-meta);
    letter-spacing: clamp(1px, 0.24vw, 2px); color: var(--sp-dim);
    background: none; border: 1px solid rgba(232,150,125,0.1);
    padding: 6px 12px; cursor: pointer; transition: all .15s; border-radius: 4px;
    text-decoration: none;
  }
  .foot-nav a:hover { color: var(--sp-pk); border-color: rgba(232,150,125,0.3); }
  .foot-bot {
    display: flex; justify-content: space-between; align-items: center;
    flex-wrap: wrap; gap: 8px; padding-top: 16px;
    border-top: 1px solid rgba(232,150,125,0.06);
  }
  .foot-copy { font-family: var(--fp); font-size: clamp(10px, 0.95vw, 11px); letter-spacing: clamp(0.7px, 0.2vw, 1.2px); color: rgba(240,237,228,0.55); }
  .foot-tag { font-family: var(--fv); font-size: clamp(12px, 1.3vw, 14px); color: rgba(232,150,125,0.6); }

  @media (prefers-reduced-motion: reduce) {
    .sr,
    .ha {
      opacity: 1 !important;
      transform: none !important;
      transition: none !important;
    }
    .ht::before,
    .hero-doge,
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

    .about-tag { max-width: 1080px; text-align: left; }
    .why-grid { max-width: 960px; }

    .dtl-inputs { max-width: 1000px; }
    .sq-frame { max-width: 1080px; padding: clamp(18px, 2vw, 24px); }
    .sq-grid { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
    .sq-grid-6 { grid-template-columns: repeat(3, 1fr); }
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
    .hero-sub-v { max-width: 44ch; }
    .hero-btn { min-width: 164px; }
    .fc { min-height: clamp(186px, 30vh, 264px); }
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
    .hero-right-head {
      position: static;
      padding: 10px var(--space-sec-x);
    }
    .hero-sub,
    .hero-props,
    .hero-ctas {
      width: 100%;
      max-width: none;
    }
    .hero-right {
      width: 100%;
      max-height: none;
      overflow-x: auto;
      overflow-y: hidden;
      flex-direction: row;
      scroll-snap-type: x mandatory;
      -webkit-overflow-scrolling: touch;
      gap: 12px;
      padding: 14px var(--space-sec-x);
    }
    .fc {
      min-height: auto;
      min-width: 280px;
      max-width: 320px;
      flex-shrink: 0;
      scroll-snap-align: start;
      padding: 0;
      flex-direction: column;
      border-bottom: none;
      border: 1px solid rgba(232,150,125,0.12);
      border-radius: 12px;
    }
    .fc-img {
      flex: 0 0 auto;
      height: 160px;
      border-bottom: 1px solid rgba(232,150,125,0.06);
    }
    .fc-img .ht { width: 46%; }
    .fc-txt {
      padding: 14px 18px 16px;
    }
    .fc-sub { font-size: 9px; }
    .fc-lbl {
      font-size: clamp(14px, 2.5vw, 18px);
    }
    .fc-brief {
      font-size: clamp(11px, 1.8vw, 13px);
      line-height: 1.5;
    }
    .fc-all { display: none; }
    .hero-right-head { display: none; }

    .why-grid { grid-template-columns: 1fr; gap: 16px; }
    .dtl-inputs-4 { grid-template-columns: repeat(2, 1fr); }
    .sq-grid-6 { grid-template-columns: repeat(2, 1fr); }
  }

  @media (max-width: 900px) {
    .hero-left { padding: 22px var(--space-sec-x) 30px; }
    .hero-sub-v {
      font-size: clamp(13px, 2.8vw, 16px);
      letter-spacing: clamp(1px, 0.24vw, 1.8px);
      max-width: none;
    }
    .feat-detail-stats { flex-wrap: wrap; gap: 10px; }
    .feat-detail-title {
      font-size: clamp(24px, 6vw, 34px);
      letter-spacing: clamp(1.4px, 0.3vw, 2.6px);
    }
    .why-grid { grid-template-columns: 1fr; }
    .flow { padding-top: clamp(48px, 8vw, 60px); padding-bottom: clamp(48px, 8vw, 60px); }
    .about { padding-top: clamp(72px, 10vw, 100px); padding-bottom: clamp(48px, 6vw, 64px); }
    .detect { padding-top: clamp(48px, 8vw, 60px); padding-bottom: clamp(48px, 8vw, 60px); }
    .dtl-inputs { grid-template-columns: 1fr 1fr; }
    .dtl-inputs-4 { grid-template-columns: repeat(2, 1fr); }
    .detect-example { font-size: 10px; padding: 10px 14px; }
    .cta { padding-top: clamp(46px, 8vw, 58px); }
    .fstep-num { font-size: clamp(22px, 3.2vw, 26px); min-width: 48px; }
    .fstep-imgwrap { width: 60px; height: 60px; }
    .sq-frame { padding: 16px; border-radius: 14px; }

    /* ── Detect card text wrapping fix ── */
    .dtl-input { padding: 14px; }
    .dtl-label { font-size: 11px; letter-spacing: 0.8px; white-space: nowrap; }
    .dtl-desc { font-size: 11px; line-height: 1.5; }
    .dtl-badge { width: 26px; height: 26px; font-size: 8px; margin-right: 5px; }
    .dtl-icon { font-size: 13px; }
    .dtl-count { font-size: 8px; padding: 1px 5px; }
    .dtl-flow-label { font-size: 10px; letter-spacing: 1.5px; }

    /* ── Squad card normalization ── */
    .sq-card { padding: 10px 12px; gap: 8px; }
    .sq-nm { font-size: 11px; }
    .sq-rl { font-size: 10px; }
    .sq-desc { font-size: 10px; }
    .sq-pct { font-size: 11px; }
  }

  @media (max-width: 640px) {
    .hero-left { padding: clamp(32px, 8vw, 48px) 20px clamp(24px, 5vw, 36px); }

    /* ── Hero title: 1면답게 크게 ── */
    .hl-pk {
      font-size: clamp(38px, 13vw, 56px);
      letter-spacing: clamp(1.6px, 0.6vw, 3px);
    }
    .hl-xl {
      font-size: clamp(34px, 11.5vw, 48px);
      letter-spacing: clamp(1.6px, 0.5vw, 3px);
    }
    .htag {
      font-size: 10px;
      margin-bottom: clamp(10px, 3vw, 16px);
    }
    .hero-doge { width: clamp(52px, 14vw, 72px); }
    .hero-stack { gap: clamp(4px, 1.2vw, 8px); }

    /* ── 서브타이틀 & value prop ── */
    .hero-sub {
      margin-top: clamp(16px, 4vw, 24px);
    }
    .hero-sub-v {
      font-size: clamp(11px, 3.2vw, 14px);
      line-height: 1.45;
      letter-spacing: 0.8px;
      text-wrap: balance;
    }
    .hero-props {
      margin-top: clamp(10px, 3vw, 16px);
    }
    .hp-icon { font-size: 10px; }
    .hp-txt {
      font-size: clamp(8.5px, 2.5vw, 10px);
      line-height: 1.5;
      letter-spacing: 0.5px;
    }

    /* ── CTA: 비율 맞춤 (타이틀 대비 적절하게) ── */
    .hero-ctas {
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
      margin-top: clamp(18px, 4vw, 28px);
    }
    .hero-btn {
      width: 100%;
      min-width: 0;
      min-height: 44px;
      display: inline-flex;
      justify-content: center;
      padding: 12px 16px;
      font-size: 10px;
      letter-spacing: 1.2px;
    }
    .hero-social {
      margin-top: 12px;
      padding-top: 10px;
      gap: 10px;
    }
    .hs-stars { font-size: 12px; letter-spacing: 1px; }
    .hs-quote { gap: 6px; }
    .hs-quote-txt { font-size: 9px; letter-spacing: 1px; }
    .hs-quote-src { font-size: 8px; }

    /* Mobile feature cards: vertical but image capped */
    .hero-right {
      max-height: none;
      overflow-x: auto;
      overflow-y: hidden;
      flex-direction: row;
      scroll-snap-type: x mandatory;
      -webkit-overflow-scrolling: touch;
      gap: 12px;
      padding: 14px 16px;
    }
    .fc {
      min-width: 240px;
      max-width: 280px;
      min-height: auto;
      flex-shrink: 0;
      scroll-snap-align: start;
      border-bottom: none;
      border: 1px solid rgba(232,150,125,0.15);
      border-radius: 12px;
      flex-direction: column;
    }
    .fc-img {
      flex: 0 0 auto;
      height: 140px;
      border-bottom: 1px solid rgba(232,150,125,0.06);
    }
    .fc-img .ht { width: 50%; }
    .fc-txt {
      padding: 14px 16px 16px;
    }
    .fc-sub { font-size: 9px; }
    .fc-lbl { font-size: 14px; margin-top: 3px; }
    .fc-brief { font-size: 11px; margin-top: 5px; line-height: 1.45; }
    .fc-all { display: none; }
    .hero-right-head { display: none; }

    .why-grid { gap: 12px; }
    .why-card { padding: 16px; }
    .why-label { font-size: 12px; letter-spacing: 0.8px; }
    .why-desc { font-size: 12px; line-height: 1.5; }
    .why-num { font-size: 22px; margin-bottom: 4px; }
    .ab-line { font-size: clamp(16px, 5vw, 22px); }
    .ab-pk { font-size: clamp(18px, 6vw, 26px); }

    /* ── Unified section padding ── */
    .flow, .detect, .cta {
      padding: clamp(48px, 12vw, 72px) 16px;
    }
    .about {
      padding: clamp(56px, 14vw, 80px) 16px clamp(40px, 10vw, 56px);
    }
    .squad { padding: 40px 16px; }

    .sq-grid { grid-template-columns: 1fr; }
    .sq-grid-6 { grid-template-columns: repeat(2, 1fr); }
    .sq-frame { border-radius: 10px; padding: 12px; }
    .sq-card { padding: 12px; gap: 8px; min-height: 56px; }
    .sq-nm { font-size: 11px; letter-spacing: 0.6px; }
    .sq-rl { font-size: 10px; }
    .sq-desc { font-size: 10px; line-height: 1.4; }
    .sq-pct { font-size: 10px; }
    .sq-bar { margin-top: 2px; }
    .sq-title { font-size: clamp(20px, 7vw, 28px); }
    .sq-sub { font-size: 10px; margin-bottom: 20px; }

    /* ── Detect mobile ── */
    .dtl-inputs-4 { grid-template-columns: 1fr; gap: 10px; }
    .dtl-input { padding: 14px 16px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
    .dtl-label { font-size: 12px; white-space: nowrap; }
    .dtl-desc { font-size: 11px; line-height: 1.45; width: 100%; margin-top: 6px; }
    .dtl-badge { width: 24px; height: 24px; font-size: 8px; }
    .dtl-icon { font-size: 14px; }
    .dtl-count { font-size: 8px; }
    .dtl-flow { margin: 20px 0; }
    .dtl-flow-label { font-size: 9px; letter-spacing: 1px; }
    .dtl-flow-line { width: 40px; }
    .detect-header { margin-bottom: 20px; }
    .dt-w { font-size: clamp(14px, 4vw, 18px); }
    .dt-pk { font-size: clamp(18px, 6vw, 26px); }
    .detect-sub { font-size: 9px; letter-spacing: 1px; margin-top: 8px; }
    .detect-cta { margin-top: 24px; gap: 12px; }
    .detect-example { font-size: 10px; padding: 10px 14px; line-height: 1.5; }

    /* ── CTA mobile ── */
    .cta-w { font-size: clamp(22px, 8vw, 32px); }
    .cta-pk {
      font-size: clamp(30px, 10vw, 42px);
      letter-spacing: clamp(1.4px, 0.5vw, 2.6px);
    }
    .cta-doge-wrap { width: 120px; }
    .cta-btn { font-size: 10px; padding: 14px 20px; width: 100%; max-width: 320px; min-height: 48px; }
    .cta-det { margin-top: 12px; }
    .cta-brand { font-size: 10px; }
    .cta-loc { font-size: 9px; }

    /* ── Flow mobile ── */
    .flow-tag { font-size: 9px; }
    .flow-title { margin-bottom: 20px; }
    .fstep { gap: 12px; padding: 16px; border-radius: 10px; }
    .fstep-num { font-size: 18px; min-width: 32px; }
    .fstep-title { font-size: 11px; letter-spacing: 0.8px; }
    .fstep-desc { font-size: 11px; line-height: 1.45; }
    .fstep-imgwrap { width: 48px; height: 48px; }
    .fstep-bar { max-width: 100px; }

    /* ── Footer mobile ── */
    .foot { padding: 20px 16px 16px; gap: 14px; }
    .foot-top { gap: 12px; }
    .foot-logo { font-size: 10px; }
    .foot-nav { gap: 4px; }
    .foot-nav a { font-size: 8px; padding: 5px 8px; letter-spacing: 0.8px; }
    .foot-copy { font-size: 7px; }
    .foot-tag { font-size: 8px; }
  }

  @media (max-width: 400px) {
    .hl-pk { font-size: clamp(26px, 12vw, 32px); }
    .hl-xl { font-size: clamp(24px, 10vw, 28px); }
    .hero-doge { width: 50px; }
    .flow-sub,
    .detect-sub,
    .about-tag { letter-spacing: 1.2px; }
    .cta-w { font-size: 20px; }
    .cta-pk { font-size: 26px; }
  }

  @media (min-width: 1081px) and (max-height: 900px) {
    .hero {
      grid-template-columns: minmax(0, 1fr) clamp(292px, 30vw, 390px);
      gap: 10px;
    }
    .hero-left {
      padding-top: 10px;
      padding-bottom: 12px;
    }
    .hero-stack { gap: 2px; }
    .htag { margin-bottom: 4px; }
    /* font-size overrides removed — hero-left overflow-y:auto handles overflow */
    .hero-sub { margin-top: 6px; }
    .hero-sub-v { line-height: 1.22; }
    .hero-props { gap: 4px; margin-top: 6px; }
    .hp-txt { line-height: 1.3; }
    .hero-ctas { margin-top: 10px; }
    .hero-btn { padding: 10px 14px; min-width: 150px; }
    .hero-social { margin-top: 8px; padding-top: 8px; }
  }

  /* ═══ MOBILE BOTTOM SHEET ═══ */
  .m-sheet-backdrop {
    display: none;
  }
  .m-sheet {
    display: none;
  }

  @media (max-width: 1080px) {
    .m-sheet-backdrop {
      display: block;
      position: fixed; inset: 0; z-index: 200;
      background: rgba(0,0,0,0.65);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      animation: sheetFadeIn 0.2s ease-out;
    }
    .m-sheet {
      display: flex; flex-direction: column;
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 201;
      max-height: 82vh;
      background: var(--sp-bg2, #111a12);
      border-top: 1px solid rgba(232,150,125,0.25);
      border-radius: 20px 20px 0 0;
      padding: 16px 20px 32px;
      padding-bottom: max(32px, env(safe-area-inset-bottom));
      overflow-y: auto;
      overscroll-behavior: contain;
      animation: sheetSlideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1);
    }
    .m-sheet-handle {
      width: 36px; height: 4px;
      background: rgba(240,237,228,0.2);
      border-radius: 2px;
      margin: 0 auto 16px;
      flex-shrink: 0;
    }
    .m-sheet-close {
      position: absolute; top: 16px; right: 16px;
      background: rgba(240,237,228,0.08);
      border: 1px solid rgba(232,150,125,0.15);
      color: var(--sp-w, #f0ede4);
      width: 32px; height: 32px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; cursor: pointer;
      transition: background 0.15s;
    }
    .m-sheet-close:active {
      background: rgba(232,150,125,0.15);
    }
    .m-sheet-tag {
      font-family: var(--fp); font-size: 10px;
      color: var(--sp-pk, #e8967d);
      letter-spacing: 2px;
      text-shadow: 0 0 6px rgba(232,150,125,0.3);
      margin-bottom: 8px;
    }
    .m-sheet-img {
      width: 100%; max-width: 200px; aspect-ratio: 1;
      margin: 0 auto 12px;
    }
    .m-sheet-img img {
      width: 100%; height: 100%; object-fit: contain;
    }
    .m-sheet-title {
      font-family: var(--fp); font-size: clamp(22px, 6vw, 30px);
      color: var(--sp-w, #f0ede4);
      letter-spacing: 2px;
      margin-bottom: 10px;
    }
    .m-sheet-desc {
      font-family: var(--fv); font-size: clamp(12px, 3vw, 14px);
      color: var(--sp-w, #f0ede4); opacity: 0.7;
      line-height: 1.6;
      margin-bottom: 20px;
    }
    .m-sheet-stats {
      display: flex; gap: 12px; flex-wrap: wrap;
      margin-bottom: 24px;
    }
    .m-sheet-stat {
      display: flex; flex-direction: column; align-items: center;
      background: rgba(232,150,125,0.06);
      border: 1px solid rgba(232,150,125,0.12);
      border-radius: 10px;
      padding: 10px 16px;
      flex: 1; min-width: 80px;
    }
    .m-sheet-stat-v {
      font-family: var(--fp); font-size: 16px;
      color: var(--sp-pk, #e8967d);
      letter-spacing: 1px;
    }
    .m-sheet-stat-k {
      font-family: var(--fp); font-size: 9px;
      color: var(--sp-dim, rgba(240,237,228,0.5));
      letter-spacing: 1.2px;
      margin-top: 2px;
    }
    .m-sheet-cta {
      width: 100%;
      padding: 16px 24px;
      min-height: 52px;
      background: linear-gradient(135deg, var(--sp-pk, #e8967d), #d4785f);
      color: var(--sp-bg, #0a1a0d);
      font-family: var(--fp); font-size: 13px; font-weight: 600;
      letter-spacing: 2px;
      border: none; border-radius: 12px;
      cursor: pointer;
      text-align: center;
      transition: opacity 0.15s;
    }
    .m-sheet-cta:active {
      opacity: 0.85;
    }
  }

  @keyframes sheetSlideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }
  @keyframes sheetFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>
