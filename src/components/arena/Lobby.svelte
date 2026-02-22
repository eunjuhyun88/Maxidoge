<script lang="ts">
  import { AGDEFS } from '$lib/data/agents';
  import { gameState } from '$lib/stores/gameState';
  import { sfx } from '$lib/audio/sfx';
  import { startMatch as engineStartMatch, resetPhaseInit } from '$lib/engine/gameLoop';
  import { PHASE_DURATION } from '$lib/engine/phases';
  import TokenDropdown from '../shared/TokenDropdown.svelte';

  let selected: Set<string> = new Set(['structure', 'flow', 'deriv', 'senti', 'guardian']);
  let speed = 3;
  let pair = 'BTC/USDT';

  /* ── Theme switcher ── */
  type ThemeId = 'cyber' | 'premium' | 'retro' | 'champ';
  let currentTheme: ThemeId = 'cyber';
  const THEMES: { id: ThemeId; label: string; color: string }[] = [
    { id: 'cyber',   label: 'CYBER',   color: '#00d4ff' },
    { id: 'premium', label: 'PREMIUM', color: '#E8967D' },
    { id: 'retro',   label: 'RETRO',   color: '#00ff88' },
    { id: 'champ',   label: 'CHAMP',   color: '#FFD060' },
  ];

  function toggleAgent(id: string) {
    if (selected.has(id)) {
      if (selected.size <= 3) return;
      selected.delete(id);
    } else {
      if (selected.size >= 5) return;
      selected.add(id);
    }
    selected = new Set(selected);
  }

  function teamPower(): number {
    let total = 0;
    for (const id of selected) {
      const ag = AGDEFS.find(a => a.id === id);
      if (ag) total += ag.conf;
    }
    return Math.round(total / selected.size);
  }

  function startMatch() {
    if (selected.size < 3 || selected.size > 5) return;
    sfx.enter();
    gameState.update(s => ({
      ...s,
      inLobby: false,
      selectedAgents: [...selected],
      speed,
      pair
    }));
    resetPhaseInit();
    engineStartMatch();
  }
</script>

<div class="lobby" data-theme={currentTheme}>
  <!-- Background effects -->
  <div class="bg-glow"></div>
  <div class="bg-grid"></div>
  <div class="bg-grain" aria-hidden="true"></div>
  <div class="bg-scanlines" aria-hidden="true"></div>
  <!-- Floating sparkles -->
  <span class="spk" style="top:6%;left:10%;--d:0s;--s:1.2">✦</span>
  <span class="spk" style="top:14%;left:80%;--d:1.4s;--s:0.8">✦</span>
  <span class="spk" style="top:40%;left:4%;--d:2.2s;--s:1">✦</span>
  <span class="spk" style="top:75%;left:90%;--d:0.6s;--s:0.7">✦</span>
  <span class="spk" style="top:85%;left:30%;--d:3s;--s:1.1">✦</span>
  <span class="spk" style="top:25%;left:55%;--d:1.8s;--s:0.6">✦</span>

  <!-- Theme selector -->
  <div class="theme-bar">
    {#each THEMES as t}
      <button
        class="theme-btn"
        class:active={currentTheme === t.id}
        style="--tc:{t.color}"
        on:click={() => currentTheme = t.id}
      >{t.label}</button>
    {/each}
  </div>

  <div class="lobby-content">
    <!-- Title -->
    <h1 class="title">
      MAXI<span class="zap">⚡</span>DOGE
    </h1>
    <p class="subtitle">SELECT YOUR SQUAD</p>

    <!-- Character Stage -->
    <div class="stage-wrap">
      <div class="character-row">
        {#each AGDEFS as ag, i}
          <button
            class="char-slot"
            class:picked={selected.has(ag.id)}
            style="--ac:{ag.color};animation-delay:{i * 0.08}s"
            on:click={() => toggleAgent(ag.id)}
          >
            {#if selected.has(ag.id)}
              <div class="pick-check">✓</div>
            {/if}
            <div class="char-img-wrap">
              <img
                class="char-img"
                src={ag.img.def}
                alt={ag.name}
                style="border-color:{ag.color}"
              />
              {#if selected.has(ag.id)}
                <div class="char-glow" style="background:{ag.color}"></div>
              {/if}
            </div>
            <div class="char-badge" style="background:{ag.color}">{ag.icon}</div>
            <div class="char-name">{ag.name}</div>
            <div class="char-role">{ag.nameKR}</div>
          </button>
        {/each}
      </div>

      <!-- Stage platform -->
      <div class="stage-platform">
        <div class="stage-text">MAXI⚡DOGE ARENA — DEPLOY YOUR PACK</div>
      </div>
    </div>

    <!-- Selected count + power bar -->
    <div class="meta-row">
      <div class="select-count">
        SQUAD: <span class="count-num">{selected.size}</span>/5
      </div>
      <div class="power-bar-wrap">
        <span class="pw-label">POWER</span>
        <div class="pw-bar"><div class="pw-fill" style="width:{teamPower()}%"></div></div>
        <span class="pw-val">{teamPower()}</span>
      </div>
      <div class="stats-chip">
        {$gameState.lp.toLocaleString()} LP
        <span class="sep">|</span>
        {$gameState.wins}W-{$gameState.losses}L
        {#if $gameState.streak > 0}<span class="sep">|</span> {$gameState.streak} STREAK{/if}
      </div>
    </div>

    <!-- Settings row -->
    <div class="settings-row">
      <div class="set-group">
        <span class="set-lbl">PAIR</span>
        <TokenDropdown value={pair} on:select={e => pair = e.detail.pair} />
      </div>
      <div class="set-group">
        <span class="set-lbl">SPEED</span>
        <div class="speed-row">
          {#each [1, 2, 3] as s}
            <button class="spd-btn" class:on={speed === s} on:click={() => speed = s}>{s}x</button>
          {/each}
        </div>
      </div>
    </div>

    <!-- Start button -->
    <button class="go-btn" on:click={startMatch}>
      START MATCH
    </button>

    <div class="footer-line">
      vs <b>ARENA BOT</b>
      <span class="motto">"IN GAINS WE TRUST"</span>
    </div>
  </div>
</div>

<style>
  /* ═══════════════════════════════════════
     THEME VARIABLES
     ═══════════════════════════════════════ */

  /* A: CYBERPUNK NEON */
  .lobby[data-theme="cyber"] {
    --a-bg: #06080f;
    --a-bg2: #0a0e1a;
    --a-accent: #00d4ff;
    --a-accent2: #ff2d9b;
    --a-text: #d8ecff;
    --a-dim: rgba(0,212,255,0.25);
    --a-glow-color: rgba(0,212,255,0.4);
    --a-glow2-color: rgba(255,45,155,0.3);
    --a-border-color: rgba(0,212,255,0.2);
    --a-card-bg: rgba(0,212,255,0.04);
    --a-btn-bg: linear-gradient(135deg, #00d4ff 0%, #ff2d9b 100%);
    --a-fill-bg: linear-gradient(90deg, #00d4ff, #ff2d9b);
    --a-platform-bg: linear-gradient(180deg, rgba(0,212,255,0.08), rgba(0,212,255,0.02));
    --a-scanline-color: rgba(0,212,255,0.03);
    --a-grid-color: rgba(0,212,255,0.06);
    --a-sparkle-color: rgba(0,212,255,0.5);
  }

  /* B: DARK PREMIUM */
  .lobby[data-theme="premium"] {
    --a-bg: #0a1a0d;
    --a-bg2: #0f2614;
    --a-accent: #E8967D;
    --a-accent2: #F5C4B8;
    --a-text: #F0EDE4;
    --a-dim: rgba(240,237,228,0.35);
    --a-glow-color: rgba(232,150,125,0.35);
    --a-glow2-color: rgba(232,150,125,0.15);
    --a-border-color: rgba(232,150,125,0.15);
    --a-card-bg: rgba(255,255,255,0.03);
    --a-btn-bg: linear-gradient(135deg, #E8967D 0%, #d4745a 100%);
    --a-fill-bg: linear-gradient(90deg, #E8967D, #F5C4B8);
    --a-platform-bg: linear-gradient(180deg, rgba(232,150,125,0.06), rgba(232,150,125,0.01));
    --a-scanline-color: rgba(232,150,125,0.02);
    --a-grid-color: rgba(232,150,125,0.05);
    --a-sparkle-color: rgba(232,150,125,0.5);
  }

  /* C: RETRO ARCADE */
  .lobby[data-theme="retro"] {
    --a-bg: #050805;
    --a-bg2: #0a100a;
    --a-accent: #00ff88;
    --a-accent2: #ffaa00;
    --a-text: #c0ffc0;
    --a-dim: rgba(0,255,136,0.25);
    --a-glow-color: rgba(0,255,136,0.35);
    --a-glow2-color: rgba(255,170,0,0.2);
    --a-border-color: rgba(0,255,136,0.18);
    --a-card-bg: rgba(0,255,136,0.03);
    --a-btn-bg: linear-gradient(135deg, #00ff88 0%, #00cc66 100%);
    --a-fill-bg: linear-gradient(90deg, #00ff88, #ffaa00);
    --a-platform-bg: linear-gradient(180deg, rgba(0,255,136,0.06), rgba(0,255,136,0.01));
    --a-scanline-color: rgba(0,255,136,0.04);
    --a-grid-color: rgba(0,255,136,0.06);
    --a-sparkle-color: rgba(0,255,136,0.5);
  }

  /* D: CHAMPIONSHIP */
  .lobby[data-theme="champ"] {
    --a-bg: #08060e;
    --a-bg2: #0e0a16;
    --a-accent: #FFD060;
    --a-accent2: #ff2d55;
    --a-text: #fff5e0;
    --a-dim: rgba(255,208,96,0.3);
    --a-glow-color: rgba(255,208,96,0.3);
    --a-glow2-color: rgba(255,45,85,0.2);
    --a-border-color: rgba(255,208,96,0.18);
    --a-card-bg: rgba(255,208,96,0.03);
    --a-btn-bg: linear-gradient(135deg, #FFD060 0%, #ffaa00 100%);
    --a-fill-bg: linear-gradient(90deg, #FFD060, #ff2d55);
    --a-platform-bg: linear-gradient(180deg, rgba(255,208,96,0.06), rgba(255,208,96,0.01));
    --a-scanline-color: rgba(255,208,96,0.02);
    --a-grid-color: rgba(255,208,96,0.05);
    --a-sparkle-color: rgba(255,208,96,0.5);
  }

  /* ═══════════════════════════════════════
     BASE LAYOUT
     ═══════════════════════════════════════ */
  .lobby {
    position: absolute; inset: 0; z-index: 50;
    display: flex; align-items: center; justify-content: center;
    background: var(--a-bg);
    overflow: hidden;
  }

  /* ═══ Background effects ═══ */
  .bg-glow {
    position: absolute; inset: 0; z-index: 0; pointer-events: none;
    background: radial-gradient(ellipse at 50% 30%, var(--a-glow-color) 0%, transparent 55%),
                radial-gradient(ellipse at 20% 80%, var(--a-glow2-color) 0%, transparent 45%),
                radial-gradient(ellipse at 80% 70%, var(--a-glow2-color) 0%, transparent 45%);
  }

  .bg-grid {
    position: absolute; inset: 0; z-index: 1; pointer-events: none;
    background-image:
      linear-gradient(var(--a-grid-color) 1px, transparent 1px),
      linear-gradient(90deg, var(--a-grid-color) 1px, transparent 1px);
    background-size: 60px 60px;
    mask-image: radial-gradient(ellipse at 50% 50%, black 20%, transparent 70%);
    -webkit-mask-image: radial-gradient(ellipse at 50% 50%, black 20%, transparent 70%);
  }

  .bg-grain {
    position: absolute; inset: 0; z-index: 2; pointer-events: none; opacity: 0.035;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23g)' opacity='1'/%3E%3C/svg%3E");
    background-size: 200px 200px;
    animation: grainShift 0.3s steps(3) infinite;
  }
  @keyframes grainShift {
    0% { transform: translate(0, 0); }
    33% { transform: translate(-2px, 1px); }
    66% { transform: translate(1px, -1px); }
    100% { transform: translate(0, 0); }
  }

  .bg-scanlines {
    position: absolute; inset: 0; z-index: 2; pointer-events: none;
    background: repeating-linear-gradient(
      0deg,
      transparent 0px, transparent 2px,
      var(--a-scanline-color) 2px, var(--a-scanline-color) 3px
    );
  }

  /* Sparkles */
  .spk {
    position: absolute; z-index: 3; pointer-events: none;
    font-size: calc(12px * var(--s, 1)); color: var(--a-sparkle-color);
    text-shadow: 0 0 8px var(--a-glow-color);
    animation: spkPulse 3s var(--d, 0s) ease-in-out infinite;
  }
  @keyframes spkPulse {
    0%, 100% { opacity: 0.3; transform: scale(0.8); }
    50% { opacity: 1; transform: scale(1.3); }
  }

  /* ═══ Theme selector ═══ */
  .theme-bar {
    position: absolute; top: 12px; right: 12px; z-index: 60;
    display: flex; gap: 4px;
  }
  .theme-btn {
    font-family: var(--fd); font-size: 7px; font-weight: 900;
    letter-spacing: 1.5px;
    padding: 5px 10px; border-radius: 6px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.1);
    color: rgba(255,255,255,0.4);
    cursor: pointer; transition: all 0.2s;
  }
  .theme-btn:hover {
    background: rgba(255,255,255,0.08);
    color: var(--tc);
    border-color: var(--tc);
  }
  .theme-btn.active {
    background: var(--tc);
    color: #000;
    border-color: var(--tc);
    box-shadow: 0 0 12px color-mix(in srgb, var(--tc) 50%, transparent);
  }

  /* ═══ Content ═══ */
  .lobby-content {
    position: relative; z-index: 10; text-align: center;
    max-width: 900px; width: 100%; padding: 16px 20px;
  }

  /* Title */
  .title {
    font-family: var(--fc); font-size: 48px;
    color: var(--a-text);
    letter-spacing: 6px; margin: 0 0 4px;
    text-shadow: 0 0 30px var(--a-glow-color), 0 0 60px var(--a-glow2-color);
  }
  .zap { color: var(--a-accent); }

  .subtitle {
    font-family: var(--fd); font-size: 10px; font-weight: 900;
    color: var(--a-dim);
    letter-spacing: 5px; margin: 0 0 18px;
  }

  /* ═══ Character Stage ═══ */
  .stage-wrap { margin-bottom: 12px; }

  .character-row {
    display: flex; gap: 6px; justify-content: center;
    flex-wrap: wrap; padding: 0 10px;
    position: relative; z-index: 5;
  }

  .char-slot {
    width: 108px; padding: 6px 4px 6px;
    background: var(--a-card-bg);
    border: 1px solid var(--a-border-color);
    border-radius: 14px;
    cursor: pointer; transition: all .2s;
    position: relative; text-align: center;
    backdrop-filter: blur(8px);
    animation: slotIn .4s ease both;
  }
  @keyframes slotIn {
    from { opacity: 0; transform: translateY(20px) scale(.9); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .char-slot:hover {
    transform: translateY(-4px);
    background: rgba(255,255,255,0.06);
    border-color: var(--a-accent);
    box-shadow: 0 4px 20px rgba(0,0,0,0.3), 0 0 15px var(--a-glow-color);
  }
  .char-slot.picked {
    border-color: var(--ac);
    background: rgba(255,255,255,0.06);
    box-shadow: 0 0 0 1px var(--ac), 0 0 20px color-mix(in srgb, var(--ac) 30%, transparent);
  }

  .pick-check {
    position: absolute; top: -6px; right: -6px; z-index: 10;
    width: 20px; height: 20px; border-radius: 50%;
    background: var(--ac); border: 2px solid var(--a-bg);
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 900; color: #000;
  }

  /* Character image */
  .char-img-wrap {
    position: relative; width: 80px; height: 80px;
    margin: 0 auto 4px; border-radius: 14px; overflow: hidden;
  }
  .char-img {
    width: 100%; height: 100%; object-fit: cover;
    border-radius: 12px; border: 2px solid;
    background: var(--a-bg2);
    transition: transform .2s;
  }
  .char-slot:hover .char-img { transform: scale(1.06); }
  .char-glow {
    position: absolute; inset: -6px; border-radius: 20px;
    opacity: .15; z-index: -1; filter: blur(8px);
    animation: glowPulse 2s ease-in-out infinite;
  }
  @keyframes glowPulse {
    0%,100% { opacity: .1; transform: scale(1); }
    50% { opacity: .25; transform: scale(1.05); }
  }

  .char-badge {
    position: absolute; top: 2px; left: 2px;
    width: 20px; height: 20px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; border: 1px solid rgba(0,0,0,0.5);
    z-index: 5;
  }

  .char-name {
    font-family: var(--fd); font-size: 8px; font-weight: 900;
    letter-spacing: 1.5px; color: var(--a-text);
  }
  .char-role {
    font-family: var(--fm); font-size: 6.5px; color: var(--a-dim); margin-top: 1px;
  }

  /* Stage platform */
  .stage-platform {
    margin-top: -2px;
    background: var(--a-platform-bg);
    border: 1px solid var(--a-border-color);
    border-radius: 12px;
    padding: 8px 20px;
    position: relative; z-index: 1;
  }
  .stage-text {
    font-family: var(--fd); font-size: 7px; font-weight: 900;
    letter-spacing: 3px; color: var(--a-dim);
  }

  /* Meta row */
  .meta-row {
    display: flex; align-items: center; justify-content: center;
    gap: 16px; margin: 12px 0 10px; flex-wrap: wrap;
  }
  .select-count {
    font-family: var(--fc); font-size: 14px; color: var(--a-text); letter-spacing: 2px;
  }
  .count-num { color: var(--a-accent); font-size: 18px; }

  .power-bar-wrap {
    display: flex; align-items: center; gap: 6px;
  }
  .pw-label {
    font-family: var(--fd); font-size: 7px; font-weight: 900; color: var(--a-dim);
    letter-spacing: 2px;
  }
  .pw-bar {
    width: 100px; height: 6px;
    background: rgba(255,255,255,0.06);
    border: 1px solid var(--a-border-color);
    border-radius: 4px; overflow: hidden;
  }
  .pw-fill {
    height: 100%; border-radius: 3px;
    background: var(--a-fill-bg);
    transition: width .3s;
  }
  .pw-val {
    font-family: var(--fc); font-size: 14px; color: var(--a-accent);
  }

  .stats-chip {
    font-family: var(--fm); font-size: 9px; font-weight: 900;
    background: rgba(255,255,255,0.04);
    border: 1px solid var(--a-border-color);
    color: var(--a-accent); padding: 4px 12px;
    border-radius: 8px; letter-spacing: 1px;
  }
  .sep { color: rgba(255,255,255,0.15); margin: 0 3px; }

  /* Settings */
  .settings-row {
    display: flex; gap: 20px; justify-content: center;
    align-items: center; margin-bottom: 12px;
  }
  .set-group { display: flex; align-items: center; gap: 6px; }
  .set-lbl {
    font-family: var(--fd); font-size: 8px; font-weight: 900;
    color: var(--a-dim); letter-spacing: 2px;
  }
  .speed-row { display: flex; gap: 4px; }
  .spd-btn {
    font-family: var(--fm); font-size: 10px; font-weight: 900;
    width: 32px; height: 26px;
    border: 1px solid var(--a-border-color); border-radius: 6px;
    background: rgba(255,255,255,0.03); color: var(--a-dim);
    cursor: pointer; transition: all .15s;
  }
  .spd-btn:hover {
    border-color: var(--a-accent);
    color: var(--a-accent);
  }
  .spd-btn.on {
    background: var(--a-accent); color: #000;
    border-color: var(--a-accent);
    box-shadow: 0 0 10px var(--a-glow-color);
  }

  /* Start button */
  .go-btn {
    font-family: var(--fc); font-size: 28px; letter-spacing: 6px;
    color: #000;
    background: var(--a-btn-bg);
    border: none; border-radius: 14px;
    padding: 14px 60px; cursor: pointer;
    box-shadow: 0 0 30px var(--a-glow-color), 0 4px 20px rgba(0,0,0,0.4);
    transition: all .2s;
    display: inline-block;
    animation: goBtnPulse 3s ease-in-out infinite;
  }
  @keyframes goBtnPulse {
    0%,100% { box-shadow: 0 0 30px var(--a-glow-color), 0 4px 20px rgba(0,0,0,0.4); }
    50% { box-shadow: 0 0 50px var(--a-glow-color), 0 0 80px var(--a-glow2-color), 0 4px 20px rgba(0,0,0,0.4); }
  }
  .go-btn:hover {
    transform: translateY(-2px) scale(1.02);
    box-shadow: 0 0 50px var(--a-glow-color), 0 0 80px var(--a-glow2-color), 0 6px 30px rgba(0,0,0,0.5);
  }
  .go-btn:active {
    transform: translateY(1px) scale(0.99);
  }

  /* Footer */
  .footer-line {
    font-family: var(--fm); font-size: 9px; color: var(--a-dim); margin-top: 12px;
  }
  .motto {
    display: block; font-style: italic;
    color: rgba(255,255,255,0.15);
    font-family: var(--fd); font-size: 8px; margin-top: 3px;
    letter-spacing: 2px;
  }
</style>
