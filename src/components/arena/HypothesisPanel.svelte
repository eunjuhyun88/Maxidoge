<script lang="ts">
  import { gameState } from '$lib/stores/gameState';
  import { p0Override } from '$lib/stores/notificationStore';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  let state = $gameState;
  $: state = $gameState;

  let p0 = $p0Override;
  $: p0 = $p0Override;

  // Get current price from the active pair
  $: pairBase = state.pair.split('/')[0];
  $: currentPrice = state.prices[pairBase as keyof typeof state.prices] || state.prices.BTC;

  // Hypothesis state
  let dir: 'LONG' | 'SHORT' | 'NEUTRAL' | null = null;
  let conf = 0;
  let tf = '1h';
  let vmode: 'tpsl' | 'close' = 'tpsl';
  let closeN = 3;
  let locked = false;

  // NEW: Reasoning tags
  const REASONING_TAGS = ['STRUCTURE', 'FLOW', 'FUNDING', 'SENTIMENT', 'MACRO'] as const;
  let selectedTags: Set<string> = new Set();

  // NEW: Optional text reason (280 char max)
  let reason = '';
  $: reasonCharsLeft = 280 - reason.length;

  // Price levels — dynamically adjusted to current price
  let entry = currentPrice;
  let tp = entry * 1.02;
  let sl = entry * 0.985;
  let userAdjusted = false;

  // Update entry when price changes (only if user hasn't manually adjusted)
  $: if (!userAdjusted && !dir) {
    entry = currentPrice;
    tp = entry * 1.02;
    sl = entry * 0.985;
  }

  // Calculate step size based on price magnitude
  $: step = currentPrice > 10000 ? 100 : currentPrice > 1000 ? 10 : currentPrice > 100 ? 1 : currentPrice > 10 ? 0.1 : 0.01;
  $: decimals = currentPrice > 100 ? 0 : currentPrice > 1 ? 2 : 4;

  $: reward = Math.abs(tp - entry);
  $: risk = Math.abs(entry - sl);
  $: rr = risk > 0 ? (reward / risk).toFixed(2) : '—';
  $: rrColor = parseFloat(rr) >= 2 ? '#00cc66' : parseFloat(rr) >= 1.5 ? '#ffd060' : parseFloat(rr) >= 1 ? '#ff8c3b' : '#ff2d55';
  $: tpPct = ((tp - entry) / entry * 100).toFixed(2);
  $: slPct = ((sl - entry) / entry * 100).toFixed(2);

  // Validation: for LONG, TP > Entry > SL; for SHORT, SL > Entry > TP
  // P0 override disables submission
  $: canSubmit = !p0.active && !locked && dir !== null && dir !== 'NEUTRAL' && (
    dir === 'LONG' ? (tp > entry && entry > sl) :
    dir === 'SHORT' ? (sl > entry && entry > tp) : false
  );

  // Timer
  export let timeLeft = 45;

  // "Hypothesis First" — agent data should be hidden when user has not yet committed
  $: hypothesisInputActive = !locked;

  const TF_LABELS: Record<string, string> = { '1m': '1M', '5m': '5M', '15m': '15M', '1h': '1H', '4h': '4H', '1d': '1D' };

  function selectDir(d: 'LONG' | 'SHORT' | 'NEUTRAL') {
    if (locked || p0.active) return;
    dir = d;
    userAdjusted = true;
    if (d === 'LONG') {
      tp = entry * 1.02;
      sl = entry * 0.985;
    } else if (d === 'SHORT') {
      tp = entry * 0.98;
      sl = entry * 1.015;
    }
  }

  function toggleTag(tag: string) {
    if (locked) return;
    if (selectedTags.has(tag)) {
      selectedTags.delete(tag);
    } else {
      selectedTags.add(tag);
    }
    selectedTags = selectedTags; // trigger reactivity
  }

  function adjustTP(delta: number) {
    if (locked) return;
    tp = +(tp + delta * step).toFixed(decimals);
    userAdjusted = true;
  }
  function adjustSL(delta: number) {
    if (locked) return;
    sl = +(sl + delta * step).toFixed(decimals);
    userAdjusted = true;
  }

  function formatPrice(p: number): string {
    if (p >= 1000) return '$' + Math.round(p).toLocaleString();
    if (p >= 1) return '$' + p.toFixed(2);
    return '$' + p.toFixed(4);
  }

  function submit() {
    if (!dir || p0.active) return;
    locked = true;
    dispatch('submit', {
      dir, conf: conf || 1, tf, vmode, closeN,
      tags: Array.from(selectedTags),
      reason,
      entry: +entry.toFixed(decimals),
      tp: +tp.toFixed(decimals),
      sl: +sl.toFixed(decimals),
      rr: parseFloat(rr) || 1
    });
  }

  function skip() {
    locked = true;
    dispatch('submit', {
      dir: 'NEUTRAL', conf: 1, tf, vmode: 'tpsl', closeN: 3,
      tags: [],
      reason: '',
      entry: +entry.toFixed(decimals),
      tp: +(entry * 1.02).toFixed(decimals),
      sl: +(entry * 0.985).toFixed(decimals),
      rr: 1.3
    });
  }

  function unlock() {
    locked = false;
  }
</script>

<div class="hypo-panel" class:locked>
  <!-- Hypothesis First Banner -->
  {#if hypothesisInputActive}
    <div class="hypo-first-banner">
      🧠 HYPOTHESIS FIRST — Form your thesis before agents analyze
    </div>
  {/if}

  <div class="hypo-header">
    <span class="hypo-icon">🐕</span>
    <span class="hypo-title">YOUR CALL?</span>
    <span class="hypo-pair">{state.pair}</span>
    <div class="hypo-timer" class:urgent={timeLeft <= 10}>{timeLeft}s</div>
  </div>

  <!-- P0 Override Warning -->
  {#if p0.active}
    <div class="p0-warning">
      ⚠️ P0 OVERRIDE ACTIVE — All draft orders disabled
    </div>
  {/if}

  <!-- Direction Selection — Compact Pill Toggles -->
  <div class="dir-section">
    <button class="dir-pill long" class:sel={dir === 'LONG'} disabled={locked || p0.active} on:click={() => selectDir('LONG')}>
      ▲ LONG
    </button>
    <button class="dir-pill short" class:sel={dir === 'SHORT'} disabled={locked || p0.active} on:click={() => selectDir('SHORT')}>
      ▼ SHORT
    </button>
  </div>

  <!-- Confidence Dots (1-5) -->
  <div class="conf-section">
    <span class="section-label">CONFIDENCE</span>
    <div class="conf-dots">
      {#each [1,2,3,4,5] as n}
        <button
          class="conf-dot"
          class:on={n <= conf}
          disabled={locked}
          on:click={() => conf = n}
          aria-label="Confidence {n}"
        >
          <span class="dot-fill"></span>
        </button>
      {/each}
      <span class="conf-label">
        {#if conf === 0}SELECT{:else if conf <= 2}LOW{:else if conf <= 3}MED{:else if conf <= 4}HIGH{:else}MAX{/if}
      </span>
    </div>
  </div>

  <!-- Reasoning Tags -->
  <div class="tags-section">
    <span class="section-label">REASONING</span>
    <div class="tag-chips">
      {#each REASONING_TAGS as tag}
        <button
          class="tag-chip"
          class:sel={selectedTags.has(tag)}
          disabled={locked}
          on:click={() => toggleTag(tag)}
        >
          {tag}
        </button>
      {/each}
    </div>
  </div>

  <!-- Optional Text Reason -->
  <div class="reason-section">
    <span class="section-label">THESIS NOTE <span class="optional-tag">OPTIONAL</span></span>
    <textarea
      class="reason-input"
      placeholder="Why this direction? (280 chars max)"
      bind:value={reason}
      maxlength="280"
      disabled={locked}
      rows="2"
    ></textarea>
    <span class="char-count" class:warn={reasonCharsLeft < 30}>{reasonCharsLeft}</span>
  </div>

  <!-- Timeframe -->
  <div class="tf-section">
    <span class="section-label">TIMEFRAME</span>
    <div class="tf-btns">
      {#each ['1m', '5m', '15m', '1h', '4h', '1d'] as t}
        <button class="tf-btn" class:sel={tf === t} disabled={locked} on:click={() => tf = t}>{TF_LABELS[t]}</button>
      {/each}
    </div>
  </div>

  <!-- Verdict Mode -->
  <div class="vmode-section">
    <span class="section-label">VERDICT MODE</span>
    <div class="vmode-btns">
      <button class="vmode-btn" class:sel={vmode === 'tpsl'} disabled={locked} on:click={() => vmode = 'tpsl'}>TP/SL Touch</button>
      <button class="vmode-btn" class:sel={vmode === 'close'} disabled={locked} on:click={() => vmode = 'close'}>Close x{closeN}</button>
    </div>
    {#if vmode === 'close'}
      <div class="close-n">
        <button disabled={locked} on:click={() => closeN = Math.max(1, closeN - 1)}>-</button>
        <span>{closeN} candles</span>
        <button disabled={locked} on:click={() => closeN = Math.min(10, closeN + 1)}>+</button>
      </div>
    {/if}
  </div>

  <!-- SL/TP Levels -->
  <div class="levels-section">
    {#if dir === 'LONG' || !dir}
      <!-- LONG order: TP > Entry > SL -->
      <div class="level-row tp">
        <span class="level-label">TP</span>
        <div class="level-controls">
          <button class="adj-btn" disabled={locked} on:click={() => adjustTP(-1)}>-</button>
          <span class="level-price">{formatPrice(tp)}</span>
          <button class="adj-btn" disabled={locked} on:click={() => adjustTP(1)}>+</button>
        </div>
        <span class="level-pct" style="color:#00cc66">{+tpPct >= 0 ? '+' : ''}{tpPct}%</span>
      </div>
      <div class="level-row entry">
        <span class="level-label">ENTRY</span>
        <span class="level-price">{formatPrice(entry)}</span>
        <span class="level-tag">CURRENT</span>
      </div>
      <div class="level-row sl">
        <span class="level-label">SL</span>
        <div class="level-controls">
          <button class="adj-btn" disabled={locked} on:click={() => adjustSL(-1)}>-</button>
          <span class="level-price">{formatPrice(sl)}</span>
          <button class="adj-btn" disabled={locked} on:click={() => adjustSL(1)}>+</button>
        </div>
        <span class="level-pct" style="color:#ff2d55">{slPct}%</span>
      </div>
    {:else}
      <!-- SHORT order: SL > Entry > TP -->
      <div class="level-row sl">
        <span class="level-label">SL</span>
        <div class="level-controls">
          <button class="adj-btn" disabled={locked} on:click={() => adjustSL(-1)}>-</button>
          <span class="level-price">{formatPrice(sl)}</span>
          <button class="adj-btn" disabled={locked} on:click={() => adjustSL(1)}>+</button>
        </div>
        <span class="level-pct" style="color:#ff2d55">{+slPct >= 0 ? '+' : ''}{slPct}%</span>
      </div>
      <div class="level-row entry">
        <span class="level-label">ENTRY</span>
        <span class="level-price">{formatPrice(entry)}</span>
        <span class="level-tag">CURRENT</span>
      </div>
      <div class="level-row tp">
        <span class="level-label">TP</span>
        <div class="level-controls">
          <button class="adj-btn" disabled={locked} on:click={() => adjustTP(-1)}>-</button>
          <span class="level-price">{formatPrice(tp)}</span>
          <button class="adj-btn" disabled={locked} on:click={() => adjustTP(1)}>+</button>
        </div>
        <span class="level-pct" style="color:#00cc66">{tpPct}%</span>
      </div>
    {/if}
  </div>

  <!-- R:R Display -->
  <div class="rr-display">
    <span class="rr-label">RISK : REWARD</span>
    <span class="rr-value" style="color:{rrColor}">1 : {rr}</span>
  </div>

  <!-- Submit -->
  <div class="submit-section">
    {#if locked}
      <button class="submit-btn locked-btn" on:click={unlock}>
        🔒 HYPOTHESIS LOCKED — TAP TO EDIT
      </button>
    {:else}
      <button class="submit-btn" class:long-btn={dir === 'LONG'} class:short-btn={dir === 'SHORT'} disabled={!canSubmit} on:click={submit}>
        {#if p0.active}⛔ P0 — DISABLED{:else if dir === 'LONG'}🚀 LOCK IN LONG{:else if dir === 'SHORT'}💀 LOCK IN SHORT{:else}SELECT DIRECTION{/if}
      </button>
      <button class="skip-btn" on:click={skip}>SKIP →</button>
    {/if}
  </div>

  <!-- Drag hint -->
  <div class="drag-hint">💡 Drag TP/SL lines on chart or use +/- buttons</div>
</div>

<style>
  .hypo-panel {
    background: #fff;
    border: 3px solid #000;
    border-radius: 14px;
    padding: 10px;
    box-shadow: 4px 4px 0 #000;
    width: 260px;
    max-height: 80vh;
    overflow-y: auto;
    transition: opacity .3s;
    font-size: 0.95em;
  }
  .hypo-panel.locked {
    opacity: 0.85;
  }

  /* Hypothesis First Banner */
  .hypo-first-banner {
    background: linear-gradient(90deg, #E8967D, #d07a64);
    color: #000;
    font-family: var(--fm);
    font-size: 7px;
    font-weight: 900;
    letter-spacing: 1px;
    padding: 5px 8px;
    border: 2px solid #000;
    border-radius: 8px;
    margin-bottom: 8px;
    text-align: center;
    animation: slideUp .3s ease;
  }

  /* P0 Warning */
  .p0-warning {
    background: var(--red);
    color: #fff;
    font-family: var(--fm);
    font-size: 7px;
    font-weight: 900;
    letter-spacing: 1px;
    padding: 5px 8px;
    border: 2px solid #000;
    border-radius: 8px;
    margin-bottom: 8px;
    text-align: center;
    animation: shake .4s ease;
  }

  .hypo-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 8px;
    border-bottom: 3px solid #000;
    margin-bottom: 10px;
  }
  .hypo-icon { font-size: 18px; }
  .hypo-title { font-size: 14px; font-weight: 900; font-family: var(--fc); letter-spacing: 3px; }
  .hypo-pair { font-size: 9px; font-weight: 700; font-family: var(--fd); color: #E8967D; background: #000; padding: 2px 6px; border-radius: 4px; letter-spacing: 1px; }
  .hypo-timer {
    font-size: 16px; font-weight: 900; font-family: var(--fd);
    background: #E8967D; border: 2px solid #000; border-radius: 8px;
    padding: 2px 10px; min-width: 40px; text-align: center; margin-left: auto;
  }
  .hypo-timer.urgent { background: #ff2d55; color: #fff; animation: timerPulse .5s ease infinite; }
  @keyframes timerPulse { 0%,100% { transform: scale(1) } 50% { transform: scale(1.1) } }

  /* Direction — Compact Pill Toggles */
  .dir-section { display: flex; gap: 4px; margin-bottom: 10px; }
  .dir-pill {
    flex: 1; padding: 7px 4px; border: 2px solid #ddd; border-radius: 20px;
    font-family: var(--fd); font-size: 10px; font-weight: 900; letter-spacing: 1.5px;
    cursor: pointer; transition: all .15s; box-shadow: 2px 2px 0 rgba(0,0,0,.15);
    text-align: center;
  }
  .dir-pill:disabled { opacity: .5; cursor: not-allowed; }
  .dir-pill.long { background: #e8fff0; color: #00aa44; border-color: #b0e8c0; }
  .dir-pill.long.sel { background: #00ff88; color: #000; border-color: #000; box-shadow: 0 0 0 2px #00aa44, 2px 2px 0 #000; }
  .dir-pill.short { background: #ffe8ec; color: #cc0033; border-color: #f0b0b8; }
  .dir-pill.short.sel { background: #ff2d55; color: #fff; border-color: #000; box-shadow: 0 0 0 2px #cc0033, 2px 2px 0 #000; }
  .dir-pill:hover:not(:disabled):not(.sel) { border-color: #999; }

  /* Sections */
  .section-label { font-size: 7px; font-weight: 900; font-family: var(--fd); letter-spacing: 2px; color: #888; display: block; margin-bottom: 4px; }
  .optional-tag { font-size: 6px; color: #bbb; letter-spacing: 1px; }

  /* Confidence Dots */
  .conf-section { margin-bottom: 8px; }
  .conf-dots { display: flex; align-items: center; gap: 6px; }
  .conf-dot {
    width: 24px; height: 24px; border-radius: 50%;
    border: 3px solid #ccc; background: #fff;
    cursor: pointer; transition: all .15s;
    display: flex; align-items: center; justify-content: center;
    padding: 0;
  }
  .conf-dot:disabled { cursor: not-allowed; opacity: .5; }
  .conf-dot .dot-fill {
    width: 12px; height: 12px; border-radius: 50%;
    background: transparent; transition: background .15s;
  }
  .conf-dot.on { border-color: #000; }
  .conf-dot.on .dot-fill { background: #E8967D; }
  .conf-dot:hover:not(:disabled) { border-color: #000; transform: scale(1.1); }
  .conf-label {
    font-family: var(--fm); font-size: 8px; font-weight: 900;
    letter-spacing: 2px; color: #888; margin-left: 4px;
  }

  /* Reasoning Tags */
  .tags-section { margin-bottom: 8px; }
  .tag-chips { display: flex; flex-wrap: wrap; gap: 4px; }
  .tag-chip {
    font-family: var(--fm); font-size: 7px; font-weight: 900;
    letter-spacing: 1px; padding: 4px 8px;
    border: 2px solid #ddd; border-radius: 20px;
    background: #fff; color: #888; cursor: pointer;
    transition: all .15s;
  }
  .tag-chip:disabled { opacity: .5; cursor: not-allowed; }
  .tag-chip.sel {
    border-color: #000; background: #E8967D; color: #000;
    box-shadow: 1px 1px 0 #000;
  }
  .tag-chip:hover:not(:disabled):not(.sel) {
    border-color: #999; color: #555;
  }

  /* Text Reason */
  .reason-section { margin-bottom: 8px; position: relative; }
  .reason-input {
    width: 100%; padding: 6px 8px;
    border: 2px solid #ddd; border-radius: 8px;
    font-family: var(--fm); font-size: 8px;
    background: #fafafa; color: #333;
    resize: none; outline: none;
    transition: border-color .15s;
    line-height: 1.4;
  }
  .reason-input:focus { border-color: #000; }
  .reason-input:disabled { opacity: .5; }
  .char-count {
    position: absolute; bottom: 4px; right: 8px;
    font-family: var(--fm); font-size: 7px; color: #bbb;
  }
  .char-count.warn { color: #ff2d55; }

  /* Timeframe */
  .tf-section { margin-bottom: 8px; }
  .tf-btns { display: flex; gap: 3px; }
  .tf-btn {
    flex: 1; padding: 4px 2px; border: 2px solid #ddd; border-radius: 6px;
    font-size: 8px; font-weight: 900; font-family: var(--fd);
    background: #fff; cursor: pointer; color: #888;
  }
  .tf-btn:disabled { opacity: .5; cursor: not-allowed; }
  .tf-btn.sel { border-color: #000; background: #E8967D; color: #000; box-shadow: 1px 1px 0 #000; }

  /* Verdict Mode */
  .vmode-section { margin-bottom: 8px; }
  .vmode-btns { display: flex; gap: 4px; }
  .vmode-btn {
    flex: 1; padding: 5px 4px; border: 2px solid #ddd; border-radius: 8px;
    font-size: 8px; font-weight: 700; font-family: var(--fm);
    background: #fff; cursor: pointer; color: #888;
  }
  .vmode-btn:disabled { opacity: .5; cursor: not-allowed; }
  .vmode-btn.sel { border-color: #000; background: #f0f0ff; color: #000; box-shadow: 1px 1px 0 #000; }
  .close-n {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    margin-top: 4px; font-size: 9px; font-family: var(--fm); font-weight: 700;
  }
  .close-n button { width: 22px; height: 22px; border: 2px solid #000; border-radius: 6px; background: #fff; cursor: pointer; font-weight: 900; }
  .close-n button:disabled { opacity: .5; cursor: not-allowed; }

  /* Levels */
  .levels-section { margin-bottom: 8px; border: 2px solid #000; border-radius: 10px; overflow: hidden; }
  .level-row {
    display: flex; align-items: center; gap: 6px; padding: 6px 8px;
    font-family: var(--fm); font-size: 9px;
  }
  .level-row.tp { background: rgba(0,255,136,.08); border-bottom: 1px solid #eee; }
  .level-row.entry { background: rgba(232,150,125,.1); border-bottom: 1px solid #eee; }
  .level-row.sl { background: rgba(255,45,85,.06); }
  .level-label { font-size: 8px; font-weight: 900; font-family: var(--fd); letter-spacing: 2px; width: 36px; }
  .level-price { font-size: 11px; font-weight: 900; font-family: var(--fd); }
  .level-pct { font-size: 8px; font-weight: 700; margin-left: auto; }
  .level-tag { font-size: 6px; color: #888; margin-left: auto; font-weight: 700; letter-spacing: 1px; }
  .level-controls { display: flex; align-items: center; gap: 4px; }
  .adj-btn { width: 22px; height: 22px; border: 2px solid #000; border-radius: 6px; background: #fff; cursor: pointer; font-weight: 900; font-size: 12px; display: flex; align-items: center; justify-content: center; }
  .adj-btn:disabled { opacity: .5; cursor: not-allowed; }
  .adj-btn:hover:not(:disabled) { background: #E8967D; }
  .adj-btn:active:not(:disabled) { transform: scale(.9); }

  /* R:R */
  .rr-display {
    display: flex; align-items: center; justify-content: space-between;
    padding: 6px 10px; margin-bottom: 8px;
    background: #000; border-radius: 8px;
  }
  .rr-label { font-size: 7px; font-weight: 900; font-family: var(--fd); letter-spacing: 2px; color: #888; }
  .rr-value { font-size: 16px; font-weight: 900; font-family: var(--fd); }

  /* Submit */
  .submit-section { display: flex; gap: 6px; }
  .submit-btn {
    flex: 1; padding: 10px; border: 3px solid #000; border-radius: 12px;
    font-family: var(--fc); font-size: 12px; font-weight: 900; letter-spacing: 2px;
    background: linear-gradient(180deg, #eee, #ddd); color: #888;
    cursor: pointer; box-shadow: 3px 3px 0 #000; transition: all .15s;
  }
  .submit-btn.long-btn:not(:disabled) { background: linear-gradient(180deg, #00ff88, #00cc66); color: #000; }
  .submit-btn.short-btn:not(:disabled) { background: linear-gradient(180deg, #ff4060, #cc0033); color: #fff; }
  .submit-btn:hover:not(:disabled) { transform: translate(-1px,-1px); box-shadow: 4px 4px 0 #000; }
  .submit-btn:disabled { opacity: .5; cursor: not-allowed; }
  .submit-btn.locked-btn {
    background: linear-gradient(180deg, #333, #222);
    color: var(--yel);
    font-size: 8px;
    letter-spacing: 1px;
  }
  .submit-btn.locked-btn:hover {
    background: linear-gradient(180deg, #444, #333);
  }
  .skip-btn {
    padding: 10px 14px; border: 2px solid #000; border-radius: 10px;
    font-family: var(--fm); font-size: 9px; font-weight: 700;
    background: #f0f0f0; cursor: pointer;
  }
  .skip-btn:hover { background: #e0e0e0; }

  .drag-hint { text-align: center; font-size: 7px; color: #aaa; margin-top: 6px; font-family: var(--fm); }
</style>
