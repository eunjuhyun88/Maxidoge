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

<div class="lobby">
  <!-- Background layers -->
  <div class="sunburst-bg"></div>
  <div class="halftone-overlay"></div>

  <!-- Rainbow swirls in corners -->
  <div class="rainbow tl"></div>
  <div class="rainbow tr"></div>
  <div class="rainbow bl"></div>
  <div class="rainbow br"></div>

  <!-- Comic bursts -->
  <div class="burst b1">BOOM!</div>
  <div class="burst b2">POW!</div>
  <div class="burst b3">WOW!</div>
  <div class="burst b4">ZAP!</div>

  <!-- Floating crypto coins -->
  <div class="coin c1">₿</div>
  <div class="coin c2">Ξ</div>
  <div class="coin c3">◎</div>
  <div class="coin c4">🐕</div>

  <div class="lobby-content">
    <!-- Title -->
    <h1 class="title">
      MAXI<span class="zap">⚡</span>DOGE
    </h1>
    <p class="subtitle">PICK YOUR SQUAD & FIGHT!</p>

    <!-- Character Stage — agents displayed like the poster characters on a platform -->
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
        <div class="stage-text">MAXI⚡DOGE ARENA — SELECT YOUR SQUAD</div>
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
        ⚡{$gameState.lp.toLocaleString()} LP
        <span class="sep">|</span>
        {$gameState.wins}W-{$gameState.losses}L
        {#if $gameState.streak > 0}<span class="sep">|</span> 🔥{$gameState.streak}{/if}
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
      <span class="go-icon">🚀</span>
      START MATCH!!
      <span class="go-icon">🚀</span>
    </button>

    <div class="footer-line">
      vs 🤖 <b>Random Arena Bot</b>
      <span class="motto">"IN GAINS WE TRUST" 🔱</span>
    </div>
  </div>
</div>

<style>
  /* ═══════ LOBBY — Comic Pop Art ═══════ */
  .lobby {
    position: absolute; inset: 0; z-index: 50;
    display: flex; align-items: center; justify-content: center;
    background: radial-gradient(ellipse at 50% 40%, #fff8b0 0%, #ffe600 35%, #ffcc00 65%, #ffa500 100%);
    overflow: hidden;
  }

  /* Sunburst */
  .sunburst-bg {
    position: absolute; inset: -80%; z-index: 0; pointer-events: none;
    background: repeating-conic-gradient(
      transparent 0deg 5deg, rgba(255,200,0,.15) 5deg 10deg
    );
    animation: spin 80s linear infinite;
  }
  @keyframes spin { from { transform: rotate(0) } to { transform: rotate(360deg) } }

  /* Halftone dots */
  .halftone-overlay {
    position: absolute; inset: 0; z-index: 1; pointer-events: none;
    background-image: radial-gradient(circle, rgba(0,0,0,.05) 2px, transparent 2px);
    background-size: 14px 14px;
  }

  /* Rainbow swirl decorations */
  .rainbow {
    position: absolute; z-index: 2; pointer-events: none;
    width: 180px; height: 180px; border-radius: 50%;
    background: conic-gradient(#ff3d5c, #ff8c3b, #ffe600, #00ff88, #00d4ff, #a855f7, #ff3d5c);
    filter: blur(4px);
    opacity: .3;
    animation: rainSpin 10s linear infinite;
  }
  .rainbow.tl { top: -60px; left: -60px; }
  .rainbow.tr { top: -50px; right: -50px; animation-direction: reverse; }
  .rainbow.bl { bottom: -40px; left: -40px; animation-delay: -3s; }
  .rainbow.br { bottom: -50px; right: -50px; animation-direction: reverse; animation-delay: -6s; }
  @keyframes rainSpin { from { transform: rotate(0) } to { transform: rotate(360deg) } }

  /* Comic burst text */
  .burst {
    position: absolute; z-index: 3; pointer-events: none;
    font-family: var(--fc); font-weight: 900; font-style: italic;
    -webkit-text-stroke: 2.5px #000;
    text-shadow: 3px 3px 0 #000;
    animation: burstPulse 3s ease-in-out infinite;
  }
  .b1 { top: 6%; left: 4%; font-size: 48px; color: #ff3d5c; transform: rotate(-12deg); }
  .b2 { top: 8%; right: 5%; font-size: 42px; color: #00ff88; transform: rotate(8deg); animation-delay: .5s; }
  .b3 { bottom: 22%; left: 6%; font-size: 36px; color: #ffe600; transform: rotate(-5deg); animation-delay: 1s; }
  .b4 { bottom: 26%; right: 8%; font-size: 32px; color: #a855f7; transform: rotate(10deg); animation-delay: 1.5s; }
  @keyframes burstPulse {
    0%,100% { transform: rotate(var(--r, 0deg)) scale(1); opacity: .7; }
    50% { transform: rotate(var(--r, 0deg)) scale(1.12); opacity: .9; }
  }

  /* Floating crypto coins */
  .coin {
    position: absolute; z-index: 3; pointer-events: none;
    font-size: 32px; -webkit-text-stroke: 1.5px #000;
    text-shadow: 2px 2px 0 #000;
    opacity: .5;
    animation: coinBob 5s ease-in-out infinite;
  }
  .c1 { top: 18%; left: 12%; animation-delay: 0s; }
  .c2 { top: 15%; right: 14%; animation-delay: 1.5s; }
  .c3 { bottom: 30%; left: 8%; animation-delay: 3s; }
  .c4 { bottom: 28%; right: 10%; animation-delay: 2s; font-size: 28px; }
  @keyframes coinBob {
    0%,100% { transform: translateY(0) rotate(-8deg); }
    50% { transform: translateY(-16px) rotate(8deg); }
  }

  /* Content */
  .lobby-content {
    position: relative; z-index: 10; text-align: center;
    max-width: 900px; width: 100%; padding: 16px 20px;
  }

  /* Title */
  .title {
    font-family: var(--fc); font-size: 52px; color: #fff;
    -webkit-text-stroke: 3px #000;
    text-shadow: 5px 5px 0 #000, 0 0 30px rgba(255,230,0,.4);
    letter-spacing: 4px; margin: 0 0 2px;
    animation: titleBounce 2s ease-in-out infinite;
  }
  .zap { color: #ffe600; -webkit-text-stroke: 2px #000; }
  @keyframes titleBounce {
    0%,100% { transform: scale(1); }
    50% { transform: scale(1.02); }
  }

  .subtitle {
    font-family: var(--fc); font-size: 16px; color: #000;
    letter-spacing: 4px; margin: 0 0 16px;
    background: #fff; display: inline-block; padding: 4px 20px;
    border: 3px solid #000; border-radius: 20px;
    box-shadow: 3px 3px 0 #000;
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
    background: rgba(255,255,255,.85);
    border: 3px solid #000; border-radius: 16px;
    box-shadow: 4px 4px 0 #000;
    cursor: pointer; transition: all .2s;
    position: relative; text-align: center;
    backdrop-filter: blur(4px);
    animation: slotIn .4s ease both;
  }
  @keyframes slotIn {
    from { opacity: 0; transform: translateY(20px) scale(.9); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .char-slot:hover {
    transform: translateY(-6px) scale(1.03);
    box-shadow: 6px 8px 0 #000;
  }
  .char-slot.picked {
    border-color: var(--ac);
    background: linear-gradient(180deg, rgba(255,255,255,.95), rgba(255,255,255,.7));
    box-shadow: 0 0 0 4px var(--ac), 4px 4px 0 #000;
  }

  .pick-check {
    position: absolute; top: -8px; right: -8px; z-index: 10;
    width: 26px; height: 26px; border-radius: 50%;
    background: var(--ac); border: 3px solid #000;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 900; color: #fff;
    box-shadow: 2px 2px 0 #000;
  }

  /* Character image */
  .char-img-wrap {
    position: relative; width: 84px; height: 84px;
    margin: 0 auto 4px; border-radius: 18px; overflow: hidden;
  }
  .char-img {
    width: 100%; height: 100%; object-fit: cover;
    border-radius: 16px; border: 3px solid;
    background: #fff;
    transition: transform .2s;
  }
  .char-slot:hover .char-img { transform: scale(1.08); }
  .char-glow {
    position: absolute; inset: -4px; border-radius: 20px;
    opacity: .2; z-index: -1;
    animation: glowPulse 1.5s ease-in-out infinite;
  }
  @keyframes glowPulse {
    0%,100% { opacity: .15; transform: scale(1); }
    50% { opacity: .3; transform: scale(1.05); }
  }

  .char-badge {
    position: absolute; top: 2px; left: 2px;
    width: 22px; height: 22px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; border: 2px solid #000;
    box-shadow: 1px 1px 0 #000; z-index: 5;
  }

  .char-name {
    font-family: var(--fd); font-size: 9px; font-weight: 900;
    letter-spacing: 1.5px; color: #000;
  }
  .char-role {
    font-family: var(--fm); font-size: 6.5px; color: #666; margin-top: 1px;
  }

  /* Stage platform */
  .stage-platform {
    margin-top: -4px;
    background: linear-gradient(180deg, #ff8c00, #e67300);
    border: 4px solid #000; border-radius: 16px;
    padding: 8px 20px;
    box-shadow: 4px 4px 0 #000;
    position: relative; z-index: 1;
  }
  .stage-text {
    font-family: var(--fd); font-size: 8px; font-weight: 900;
    letter-spacing: 3px; color: rgba(255,255,255,.6);
    text-shadow: 1px 1px 0 rgba(0,0,0,.2);
  }

  /* Meta row */
  .meta-row {
    display: flex; align-items: center; justify-content: center;
    gap: 16px; margin: 10px 0 8px; flex-wrap: wrap;
  }
  .select-count {
    font-family: var(--fc); font-size: 15px; color: #000; letter-spacing: 2px;
  }
  .count-num { color: #ff2d9b; font-size: 20px; }

  .power-bar-wrap {
    display: flex; align-items: center; gap: 6px;
  }
  .pw-label {
    font-family: var(--fd); font-size: 8px; font-weight: 900; color: #000;
    letter-spacing: 2px;
  }
  .pw-bar {
    width: 100px; height: 10px; background: #fff;
    border: 3px solid #000; border-radius: 6px; overflow: hidden;
    box-shadow: 2px 2px 0 #000;
  }
  .pw-fill {
    height: 100%; border-radius: 3px;
    background: linear-gradient(90deg, #ff2d9b, #ff8c3b, #ffe600);
    transition: width .3s;
  }
  .pw-val {
    font-family: var(--fc); font-size: 16px; color: #000;
    -webkit-text-stroke: 1px #000;
  }

  .stats-chip {
    font-family: var(--fm); font-size: 9px; font-weight: 900;
    background: #000; color: #ffe600; padding: 4px 12px;
    border-radius: 10px; letter-spacing: 1px;
  }
  .sep { color: rgba(255,255,255,.3); margin: 0 2px; }

  /* Settings */
  .settings-row {
    display: flex; gap: 20px; justify-content: center;
    align-items: center; margin-bottom: 10px;
  }
  .set-group { display: flex; align-items: center; gap: 6px; }
  .set-lbl {
    font-family: var(--fd); font-size: 9px; font-weight: 900;
    color: #000; letter-spacing: 2px;
  }
  .speed-row { display: flex; gap: 4px; }
  .spd-btn {
    font-family: var(--fm); font-size: 10px; font-weight: 900;
    width: 32px; height: 28px;
    border: 3px solid #000; border-radius: 8px;
    background: #fff; cursor: pointer;
    box-shadow: 2px 2px 0 #000; transition: all .15s;
  }
  .spd-btn.on {
    background: #ff2d9b; color: #fff;
    box-shadow: 0 0 0 2px #ff2d9b, 2px 2px 0 #000;
  }
  .spd-btn:hover { transform: translateY(-2px); }

  /* Start button */
  .go-btn {
    font-family: var(--fc); font-size: 32px; letter-spacing: 4px;
    color: #fff; -webkit-text-stroke: 2px #000;
    text-shadow: 3px 3px 0 rgba(0,0,0,.3);
    background: linear-gradient(180deg, #ff3dab, #ff0066);
    border: 5px solid #000; border-radius: 30px;
    padding: 14px 60px; cursor: pointer;
    box-shadow: 6px 6px 0 #000;
    transition: all .2s;
    display: inline-flex; align-items: center; gap: 12px;
    animation: goBtnPulse 2s ease-in-out infinite;
  }
  @keyframes goBtnPulse {
    0%,100% { box-shadow: 6px 6px 0 #000; }
    50% { box-shadow: 6px 6px 0 #000, 0 0 30px rgba(255,0,102,.3); }
  }
  .go-btn:hover {
    transform: translate(-3px, -3px) scale(1.02);
    box-shadow: 8px 8px 0 #000, 0 0 40px rgba(255,0,102,.4);
  }
  .go-btn:active {
    transform: translate(2px, 2px);
    box-shadow: 2px 2px 0 #000;
  }
  .go-icon { -webkit-text-stroke: 0; }

  /* Footer */
  .footer-line {
    font-family: var(--fm); font-size: 9px; color: #555; margin-top: 10px;
  }
  .motto {
    display: block; font-style: italic; color: #888;
    font-family: var(--fc); font-size: 10px; margin-top: 2px;
  }
</style>
