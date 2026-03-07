<script lang="ts">
  import { addCommunityPost, type SignalAttachment } from '$lib/stores/communityStore';
  import type { TerminalSharePrefill } from '$lib/terminal/terminalTypes';
  import { getPairPrice, type PriceLikeMap } from '$lib/utils/price';

  interface Props {
    /** Pre-fill from terminal share */
    prefill?: TerminalSharePrefill | null;
    /** Live prices: numeric map or canonical livePrice entries keyed by base symbol. */
    livePrices?: PriceLikeMap;
    /** Called after post is created, with attachment data */
    onPosted?: (attachment: SignalAttachment | null) => void;
  }

  let { prefill = null, livePrices, onPosted }: Props = $props();

  // ─── Form mode: collapsed (inline) or expanded (stepped wizard) ───
  let expanded: boolean = $state(false);

  // ─── Step state (1: direction+pair, 2: levels, 3: text+preview) ───
  type FormStep = 1 | 2 | 3;
  let step: FormStep = $state(1);

  // ─── Form fields ───
  let dir: 'LONG' | 'SHORT' = $state('LONG');
  let pair: string = $state('BTC/USDT');
  let timeframe: string = $state('4H');
  let entry: string = $state('');
  let tp: string = $state('');
  let sl: string = $state('');
  let conf: number = $state(70);
  let allowCopy: boolean = $state(true);
  let body: string = $state('');
  let isSubmitting: boolean = $state(false);

  const PAIRS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'DOGE/USDT', 'XRP/USDT', 'BNB/USDT'];
  const TIMEFRAMES = ['5m', '15m', '30m', '1H', '4H', '1D'];

  // ─── Prefill handling ───
  $effect(() => {
    if (!prefill) return;
    if (prefill.attachment) {
      // Full prefill from terminal chart signal → jump to step 3
      dir = prefill.attachment.dir;
      pair = prefill.attachment.pair;
      entry = String(prefill.attachment.entry);
      tp = String(prefill.attachment.tp);
      sl = String(prefill.attachment.sl);
      conf = prefill.attachment.conf ?? 70;
      timeframe = prefill.attachment.timeframe ?? '4H';
      body = prefill.text ?? '';
      expanded = true;
      step = 3;
    } else {
      // Context hints only → start at step 1 with pair/price pre-set
      if (prefill.contextPair) pair = prefill.contextPair;
      if (prefill.contextTimeframe) timeframe = prefill.contextTimeframe;
      if (prefill.contextPrice && prefill.contextPrice > 0) {
        entry = String(Math.round(prefill.contextPrice));
      }
      body = prefill.text ?? '';
      expanded = true;
      step = 1;
    }
  });

  // ─── Live price helper ───
  function getLivePrice(p: string): number | null {
    if (!livePrices) return null;
    const base = (p.split('/')[0] || 'BTC').toUpperCase();
    const price = getPairPrice(livePrices, p, base, 0);
    return price > 0 ? price : null;
  }

  const currentLivePrice = $derived(getLivePrice(pair));

  function fillLivePrice() {
    if (currentLivePrice) {
      entry = String(Math.round(currentLivePrice));
      autoFillLevels();
    }
  }

  // ─── Auto-compute TP/SL from entry ───
  function autoFillLevels() {
    const e = Number(entry);
    if (!e || e <= 0) return;
    if (!tp || Number(tp) === 0) {
      tp = String(Math.round(dir === 'LONG' ? e * 1.02 : e * 0.98));
    }
    if (!sl || Number(sl) === 0) {
      sl = String(Math.round(dir === 'LONG' ? e * 0.99 : e * 1.01));
    }
  }

  // ─── R:R + Risk calculation ───
  const riskReward = $derived.by(() => {
    const e = Number(entry), t = Number(tp), s = Number(sl);
    if (!e || !t || !s || e <= 0) return null;
    const risk = Math.abs(e - s);
    const reward = Math.abs(t - e);
    if (risk <= 0) return null;
    return {
      rr: (reward / risk).toFixed(1),
      riskPct: ((risk / e) * 100).toFixed(1),
    };
  });

  // ─── Step navigation ───
  function nextStep() {
    if (step === 1) {
      // Auto-fill entry from live price if empty
      if (!entry && currentLivePrice) {
        entry = String(Math.round(currentLivePrice));
      }
      step = 2;
    } else if (step === 2) {
      autoFillLevels();
      step = 3;
    }
  }

  function prevStep() {
    if (step === 2) step = 1;
    else if (step === 3) step = 2;
  }

  function canAdvance(): boolean {
    if (step === 1) return true; // direction + pair always valid
    if (step === 2) return Number(entry) > 0;
    return body.trim().length >= 2;
  }

  // ─── Submit ───
  async function handleSubmit() {
    if (body.trim().length < 2 || isSubmitting) return;
    isSubmitting = true;

    const attachment: SignalAttachment = {
      pair,
      dir,
      entry: Number(entry),
      tp: Number(tp),
      sl: Number(sl),
      conf,
      timeframe,
    };

    const signal: 'long' | 'short' = dir === 'LONG' ? 'long' : 'short';
    await addCommunityPost(body.trim(), signal, attachment, allowCopy);

    // Reset form
    body = '';
    entry = '';
    tp = '';
    sl = '';
    conf = 70;
    step = 1;
    expanded = false;
    isSubmitting = false;
    onPosted?.(attachment);
  }

  function resetAndClose() {
    expanded = false;
    step = 1;
    body = '';
    entry = '';
    tp = '';
    sl = '';
  }
</script>

<div class="form-wrap" class:expanded>
  {#if !expanded}
    <!-- Collapsed — inline CTA -->
    <button class="collapsed" onclick={() => { expanded = true; step = 1; }}>
      <span class="c-avatar">🐕</span>
      <span class="c-placeholder">시그널 공유하기...</span>
      <span class="c-badge">📊</span>
    </button>
  {:else}
    <div class="form">
      <!-- Step indicator -->
      <div class="step-indicator">
        <div class="step-dot" class:active={step >= 1} class:done={step > 1}>1</div>
        <div class="step-line" class:active={step >= 2}></div>
        <div class="step-dot" class:active={step >= 2} class:done={step > 2}>2</div>
        <div class="step-line" class:active={step >= 3}></div>
        <div class="step-dot" class:active={step >= 3}>3</div>
      </div>

      <!-- ═══ STEP 1: Direction + Pair ═══ -->
      {#if step === 1}
        <div class="step-content" role="group" aria-label="방향 및 페어 선택">
          <div class="step-label">방향 선택</div>

          <div class="dir-row">
            <button class="dir-btn" class:active={dir === 'LONG'} class:long={dir === 'LONG'} onclick={() => dir = 'LONG'}>
              <span class="dir-arrow">▲</span> LONG
            </button>
            <button class="dir-btn" class:active={dir === 'SHORT'} class:short={dir === 'SHORT'} onclick={() => dir = 'SHORT'}>
              <span class="dir-arrow">▼</span> SHORT
            </button>
          </div>

          <div class="pair-tf-row">
            <select class="select" bind:value={pair}>
              {#each PAIRS as p}
                <option value={p}>{p}</option>
              {/each}
            </select>
            <div class="tf-group">
              {#each TIMEFRAMES as tf}
                <button class="tf-btn" class:active={timeframe === tf} onclick={() => timeframe = tf}>{tf}</button>
              {/each}
            </div>
          </div>

          {#if currentLivePrice}
            <div class="live-hint">
              현재가 <span class="live-price">${currentLivePrice.toLocaleString()}</span>
            </div>
          {/if}

          <div class="step-actions">
            <button class="btn-cancel" onclick={resetAndClose}>취소</button>
            <button class="btn-next" onclick={nextStep}>다음 →</button>
          </div>
        </div>

      <!-- ═══ STEP 2: Price Levels ═══ -->
      {:else if step === 2}
        <div class="step-content" role="group" aria-label="가격 레벨 설정">
          <div class="step-context">
            <span class="ctx-pair">{pair}</span>
            <span class="ctx-dir" class:long={dir === 'LONG'} class:short={dir === 'SHORT'}>
              {dir === 'LONG' ? '▲' : '▼'} {dir}
            </span>
            <span class="ctx-tf">{timeframe}</span>
          </div>

          <div class="levels">
            <label class="level-field">
              <span class="level-label">
                Entry
                {#if currentLivePrice}
                  <button class="live-btn" onclick={fillLivePrice} type="button">현재가</button>
                {/if}
              </span>
              <input
                type="number"
                class="level-input"
                bind:value={entry}
                placeholder={currentLivePrice ? String(Math.round(currentLivePrice)) : '0'}
                step="any"
                oninput={() => { tp = ''; sl = ''; }}
              />
            </label>
            <label class="level-field">
              <span class="level-label tp-label">TP</span>
              <input type="number" class="level-input" bind:value={tp} placeholder="0" step="any" />
            </label>
            <label class="level-field">
              <span class="level-label sl-label">SL</span>
              <input type="number" class="level-input" bind:value={sl} placeholder="0" step="any" />
            </label>
          </div>

          {#if Number(entry) > 0 && (!tp || !sl)}
            <button class="auto-fill-btn" type="button" onclick={autoFillLevels}>
              자동 계산 (2:1 R:R)
            </button>
          {/if}

          {#if riskReward}
            <div class="rr-display">
              <span class="rr-tag">R:R 1:{riskReward.rr}</span>
              <span class="rr-risk">Risk {riskReward.riskPct}%</span>
            </div>
          {/if}

          <div class="conf-row">
            <span class="conf-label">신뢰도</span>
            <input type="range" class="conf-slider" min={10} max={95} bind:value={conf} />
            <span class="conf-val">{conf}%</span>
          </div>

          <label class="copy-toggle">
            <input type="checkbox" bind:checked={allowCopy} />
            <span>카피 트레이딩 허용</span>
          </label>

          <div class="step-actions">
            <button class="btn-prev" onclick={prevStep}>← 이전</button>
            <button class="btn-next" disabled={!canAdvance()} onclick={nextStep}>다음 →</button>
          </div>
        </div>

      <!-- ═══ STEP 3: Preview + Text + Submit ═══ -->
      {:else if step === 3}
        <div class="step-content" role="group" aria-label="프리뷰 및 공유">
          <!-- Card preview -->
          <div class="preview-card">
            <div class="preview-row-1">
              <span class="preview-avatar">🐕</span>
              <span class="preview-author">You</span>
              <span class="preview-dir" class:long={dir === 'LONG'} class:short={dir === 'SHORT'}>
                {dir === 'LONG' ? '▲' : '▼'} {dir}
              </span>
              <span class="preview-pair">{pair}</span>
              {#if riskReward}
                <span class="preview-rr">R:R 1:{riskReward.rr}</span>
              {/if}
            </div>
            <div class="preview-levels">
              <span class="preview-lv">Entry <b>{Number(entry).toLocaleString()}</b></span>
              <span class="preview-sep">│</span>
              <span class="preview-lv tp">TP <b>{Number(tp).toLocaleString()}</b></span>
              <span class="preview-sep">│</span>
              <span class="preview-lv sl">SL <b>{Number(sl).toLocaleString()}</b></span>
            </div>
            <div class="preview-meta">
              <span class="preview-conf">{conf}%</span>
              <span class="preview-tf">{timeframe}</span>
            </div>
          </div>

          <textarea
            class="textarea"
            placeholder="분석 근거를 작성하세요..."
            bind:value={body}
            rows={3}
          ></textarea>

          <div class="step-actions">
            <button class="btn-prev" onclick={prevStep}>← 이전</button>
            <button
              class="btn-submit"
              disabled={isSubmitting || body.trim().length < 2}
              onclick={handleSubmit}
            >
              {isSubmitting ? '게시 중...' : '🚀 시그널 공유'}
            </button>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .form-wrap { margin-bottom: var(--sc-sp-3); }

  /* ═══ COLLAPSED ═══ */
  .collapsed {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--sc-sp-2);
    padding: var(--sc-sp-3) var(--sc-sp-4);
    border-radius: var(--sc-radius-xl);
    border: 1px solid var(--sc-line-soft);
    background: var(--sc-bg-1);
    cursor: pointer;
    transition: all var(--sc-duration-fast) var(--sc-ease);
  }
  .collapsed:hover {
    background: var(--sc-surface);
    border-color: var(--sc-line);
    box-shadow: var(--sc-shadow-sm);
  }
  .c-avatar {
    width: 32px; height: 32px;
    border-radius: 50%;
    background: var(--sc-accent-bg);
    display: flex; align-items: center; justify-content: center;
    font-size: var(--sc-fs-md);
    border: 1px solid var(--sc-line-soft);
    flex-shrink: 0;
  }
  .c-placeholder {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-base);
    color: var(--sc-text-3);
    letter-spacing: 0.3px;
  }
  .c-badge {
    margin-left: auto;
    font-size: var(--sc-fs-lg);
    opacity: 0.4;
    transition: opacity var(--sc-duration-fast);
  }
  .collapsed:hover .c-badge { opacity: 0.8; }

  /* ═══ FORM SHELL ═══ */
  .form {
    border: 1px solid var(--sc-line);
    border-radius: var(--sc-radius-xl);
    background: var(--sc-bg-1);
    padding: var(--sc-sp-4);
    display: flex;
    flex-direction: column;
    gap: var(--sc-sp-3);
    box-shadow: var(--sc-shadow-sm);
    animation: sc-slide-up var(--sc-duration-normal) var(--sc-ease);
  }

  /* ═══ STEP INDICATOR ═══ */
  .step-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    padding-bottom: var(--sc-sp-2);
  }
  .step-dot {
    width: 24px; height: 24px;
    border-radius: 50%;
    display: grid; place-items: center;
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-2xs);
    font-weight: 900;
    border: 1.5px solid var(--sc-line-soft);
    color: var(--sc-text-3);
    background: var(--sc-bg-0);
    transition: all var(--sc-duration-fast) var(--sc-ease);
  }
  .step-dot.active {
    border-color: var(--sc-accent);
    color: var(--sc-accent);
    background: var(--sc-accent-bg);
  }
  .step-dot.done {
    border-color: var(--sc-good);
    color: var(--sc-good);
    background: var(--sc-good-bg);
  }
  .step-line {
    width: 32px; height: 2px;
    background: var(--sc-line-soft);
    transition: background var(--sc-duration-fast) var(--sc-ease);
  }
  .step-line.active {
    background: var(--sc-accent);
  }

  /* ═══ STEP CONTENT ═══ */
  .step-content {
    display: flex;
    flex-direction: column;
    gap: var(--sc-sp-3);
    animation: sc-slide-up var(--sc-duration-fast) var(--sc-ease);
  }
  .step-label {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-xs);
    font-weight: 700;
    color: var(--sc-text-3);
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  /* ═══ STEP 1: Direction ═══ */
  .dir-row { display: flex; gap: var(--sc-sp-2); }
  .dir-btn {
    flex: 1;
    padding: var(--sc-sp-3);
    border-radius: var(--sc-radius-lg);
    font-family: var(--sc-font-display);
    font-size: var(--sc-fs-md);
    font-weight: 900;
    letter-spacing: 1px;
    cursor: pointer;
    transition: all var(--sc-duration-fast) var(--sc-ease);
    border: 2px solid var(--sc-line-soft);
    background: var(--sc-surface);
    color: var(--sc-text-3);
    text-align: center;
  }
  .dir-btn:hover { border-color: var(--sc-line); }
  .dir-btn.active.long {
    color: var(--sc-good);
    border-color: var(--sc-good);
    background: var(--sc-good-bg);
    box-shadow: 0 0 12px var(--sc-good-bg);
  }
  .dir-btn.active.short {
    color: var(--sc-bad);
    border-color: var(--sc-bad);
    background: var(--sc-bad-bg);
    box-shadow: 0 0 12px var(--sc-bad-bg);
  }
  .dir-arrow { font-size: var(--sc-fs-lg); }

  .pair-tf-row {
    display: flex;
    gap: var(--sc-sp-2);
    align-items: center;
  }
  .select {
    flex: 1;
    padding: var(--sc-sp-2) var(--sc-sp-3);
    border-radius: var(--sc-radius-md);
    background: var(--sc-surface);
    border: 1px solid var(--sc-line-soft);
    color: var(--sc-text-0);
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-sm);
    font-weight: 700;
    outline: none;
  }
  .tf-group { display: flex; gap: var(--sc-sp-0_5); }
  .tf-btn {
    padding: var(--sc-sp-1) var(--sc-sp-2);
    border-radius: var(--sc-radius-sm);
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-2xs);
    font-weight: 800;
    background: var(--sc-surface);
    color: var(--sc-text-3);
    border: 1px solid var(--sc-line-soft);
    cursor: pointer;
    transition: all var(--sc-duration-fast) var(--sc-ease);
  }
  .tf-btn.active {
    background: var(--sc-accent-bg);
    color: var(--sc-accent);
    border-color: var(--sc-line);
  }

  .live-hint {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-xs);
    color: var(--sc-text-3);
    text-align: center;
  }
  .live-price {
    color: var(--sc-text-0);
    font-weight: 800;
  }

  /* ═══ STEP 2: Levels ═══ */
  .step-context {
    display: flex;
    align-items: center;
    gap: var(--sc-sp-2);
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-sm);
    font-weight: 800;
  }
  .ctx-pair { color: var(--sc-text-0); }
  .ctx-dir { letter-spacing: 0.5px; }
  .ctx-dir.long { color: var(--sc-good); }
  .ctx-dir.short { color: var(--sc-bad); }
  .ctx-tf {
    font-size: var(--sc-fs-2xs);
    color: var(--sc-text-3);
    background: var(--sc-surface);
    padding: var(--sc-sp-0_5) var(--sc-sp-1_5);
    border-radius: var(--sc-radius-sm);
  }

  .levels { display: flex; gap: var(--sc-sp-2); }
  .level-field {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .level-label {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-2xs);
    font-weight: 700;
    letter-spacing: 0.5px;
    color: var(--sc-text-3);
    display: flex;
    align-items: center;
    gap: var(--sc-sp-1);
  }
  .tp-label { color: var(--sc-good); }
  .sl-label { color: var(--sc-bad); }
  .live-btn {
    font-family: var(--sc-font-mono);
    font-size: 8px;
    font-weight: 800;
    color: var(--sc-accent);
    background: var(--sc-accent-bg);
    border: 1px solid var(--sc-line-soft);
    border-radius: var(--sc-radius-sm);
    padding: 1px var(--sc-sp-1);
    cursor: pointer;
    transition: all var(--sc-duration-fast) var(--sc-ease);
  }
  .live-btn:hover { background: var(--sc-accent-hover); border-color: var(--sc-accent); }
  .level-input {
    padding: var(--sc-sp-2) var(--sc-sp-2);
    border-radius: var(--sc-radius-md);
    background: var(--sc-bg-0);
    border: 1px solid var(--sc-line-soft);
    color: var(--sc-text-0);
    font-family: var(--sc-font-display);
    font-size: var(--sc-fs-base);
    font-weight: 700;
    outline: none;
    width: 100%;
    transition: border-color var(--sc-duration-fast) var(--sc-ease);
  }
  .level-input:focus { border-color: var(--sc-accent); }

  .auto-fill-btn {
    align-self: center;
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-2xs);
    font-weight: 700;
    color: var(--sc-accent);
    background: var(--sc-accent-bg-subtle);
    border: 1px dashed var(--sc-line-soft);
    border-radius: var(--sc-radius-md);
    padding: var(--sc-sp-1) var(--sc-sp-3);
    cursor: pointer;
    transition: all var(--sc-duration-fast) var(--sc-ease);
  }
  .auto-fill-btn:hover {
    border-color: var(--sc-accent);
    background: var(--sc-accent-bg);
  }

  .rr-display {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--sc-sp-3);
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-xs);
    font-weight: 800;
  }
  .rr-tag { color: var(--sc-accent); }
  .rr-risk { color: var(--sc-text-3); }

  .conf-row {
    display: flex;
    align-items: center;
    gap: var(--sc-sp-2);
  }
  .conf-label {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-xs);
    font-weight: 700;
    color: var(--sc-text-2);
    flex-shrink: 0;
  }
  .conf-slider {
    flex: 1;
    accent-color: var(--sc-accent);
    height: 4px;
  }
  .conf-val {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-xs);
    font-weight: 900;
    color: var(--sc-warn);
    min-width: 32px;
    text-align: right;
  }

  .copy-toggle {
    display: flex;
    align-items: center;
    gap: var(--sc-sp-1_5);
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-xs);
    color: var(--sc-text-2);
    cursor: pointer;
  }
  .copy-toggle input { accent-color: var(--sc-good); }

  /* ═══ STEP 3: Preview + Text ═══ */
  .preview-card {
    border: 1px solid var(--sc-line-soft);
    border-radius: var(--sc-radius-lg);
    background: var(--sc-bg-0);
    padding: var(--sc-sp-2) var(--sc-sp-3);
    display: flex;
    flex-direction: column;
    gap: var(--sc-sp-1);
  }
  .preview-row-1 {
    display: flex;
    align-items: center;
    gap: var(--sc-sp-1_5);
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-sm);
    font-weight: 700;
  }
  .preview-avatar {
    width: 20px; height: 20px;
    border-radius: 50%;
    background: var(--sc-accent-bg);
    display: grid; place-items: center;
    font-size: 10px;
  }
  .preview-author { color: var(--sc-text-0); }
  .preview-dir { font-weight: 900; letter-spacing: 0.5px; }
  .preview-dir.long { color: var(--sc-good); }
  .preview-dir.short { color: var(--sc-bad); }
  .preview-pair { color: var(--sc-text-1); font-weight: 800; }
  .preview-rr {
    margin-left: auto;
    font-size: var(--sc-fs-2xs);
    color: var(--sc-accent);
    background: var(--sc-accent-bg-subtle);
    padding: 1px var(--sc-sp-1);
    border-radius: var(--sc-radius-sm);
  }
  .preview-levels {
    display: flex;
    align-items: center;
    gap: var(--sc-sp-1);
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-xs);
    color: var(--sc-text-2);
  }
  .preview-lv b { color: var(--sc-text-0); font-weight: 800; }
  .preview-lv.tp b { color: var(--sc-good); }
  .preview-lv.sl b { color: var(--sc-bad); }
  .preview-sep { color: var(--sc-line); font-size: var(--sc-fs-2xs); }
  .preview-meta {
    display: flex;
    gap: var(--sc-sp-2);
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-2xs);
    color: var(--sc-text-3);
  }
  .preview-conf { color: var(--sc-warn); font-weight: 800; }
  .preview-tf {
    background: var(--sc-surface);
    padding: 0 var(--sc-sp-1);
    border-radius: var(--sc-radius-sm);
  }

  .textarea {
    width: 100%;
    resize: vertical;
    min-height: 64px;
    background: var(--sc-bg-0);
    border: 1px solid var(--sc-line-soft);
    border-radius: var(--sc-radius-lg);
    padding: var(--sc-sp-3);
    font-family: var(--sc-font-body);
    font-size: var(--sc-fs-base);
    color: var(--sc-text-0);
    line-height: var(--sc-lh-normal);
    outline: none;
    transition: border-color var(--sc-duration-fast) var(--sc-ease);
  }
  .textarea:focus { border-color: var(--sc-accent); }
  .textarea::placeholder { color: var(--sc-text-3); }

  /* ═══ ACTION BUTTONS ═══ */
  .step-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--sc-sp-2);
  }
  .btn-cancel, .btn-prev {
    padding: var(--sc-sp-2) var(--sc-sp-4);
    border-radius: var(--sc-radius-md);
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-sm);
    font-weight: 700;
    background: var(--sc-surface);
    color: var(--sc-text-2);
    border: 1px solid var(--sc-line-soft);
    cursor: pointer;
    transition: all var(--sc-duration-fast) var(--sc-ease);
  }
  .btn-cancel:hover, .btn-prev:hover { background: var(--sc-surface-2); color: var(--sc-text-1); }

  .btn-next {
    padding: var(--sc-sp-2) var(--sc-sp-5);
    border-radius: var(--sc-radius-md);
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-sm);
    font-weight: 900;
    background: var(--sc-accent);
    color: #000;
    border: none;
    cursor: pointer;
    box-shadow: 1px 1px 0 rgba(0,0,0,0.3);
    transition: all var(--sc-duration-fast) var(--sc-ease);
  }
  .btn-next:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 2px 2px 0 rgba(0,0,0,0.4);
  }
  .btn-next:disabled { opacity: 0.35; cursor: not-allowed; }

  .btn-submit {
    padding: var(--sc-sp-2) var(--sc-sp-5);
    border-radius: var(--sc-radius-md);
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-sm);
    font-weight: 900;
    background: var(--sc-good);
    color: #000;
    border: none;
    cursor: pointer;
    box-shadow: 1px 1px 0 rgba(0,0,0,0.4);
    transition: all var(--sc-duration-fast) var(--sc-ease);
  }
  .btn-submit:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 2px 2px 0 rgba(0,0,0,0.5);
  }
  .btn-submit:active:not(:disabled) { transform: translateY(0); box-shadow: none; }
  .btn-submit:disabled { opacity: 0.35; cursor: not-allowed; }

  /* ═══ RESPONSIVE ═══ */
  @media (max-width: 768px) {
    .levels { flex-direction: column; }
    .tf-group { flex-wrap: wrap; }
    .pair-tf-row { flex-direction: column; align-items: stretch; }
    .dir-btn { padding: var(--sc-sp-2); font-size: var(--sc-fs-sm); }
    .preview-levels { flex-wrap: wrap; }
  }
</style>
