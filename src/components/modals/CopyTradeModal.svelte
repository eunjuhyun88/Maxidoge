<script lang="ts">
  import {
    copyTradeStore,
    isCopyTradeOpen,
    copyTradeStep,
    copyTradeDraft,
    copyTradeIsPublishing,
    copyTradePublishError,
  } from '$lib/stores/copyTradeStore';
  import { notifySignalTracked } from '$lib/stores/notificationEvents';

  const isOpen = $derived($isCopyTradeOpen);
  const step = $derived($copyTradeStep);
  const draft = $derived($copyTradeDraft);
  const isPublishing = $derived($copyTradeIsPublishing);
  const publishError = $derived($copyTradePublishError);

  // evidence는 이미 draft에 포함되어 있으므로 별도 signal lookup 불필요
  const selectedSignals = $derived(draft.evidence);

  const consensus = $derived(selectedSignals.length
    ? { dir: draft.dir, conf: Math.round(selectedSignals.reduce((a: number, e: { conf: number }) => a + e.conf, 0) / selectedSignals.length), count: { long: 0, short: 0, neutral: 0 } }
    : { dir: 'NEUTRAL' as const, conf: 0, count: { long: 0, short: 0, neutral: 0 } });

  function calcRR(): string {
    if (!draft.sl || !draft.tp[0] || !draft.entry) return '—';
    const risk = Math.abs(draft.entry - draft.sl);
    const reward = Math.abs(draft.entry - draft.tp[0]);
    if (risk === 0) return '—';
    return `1:${(reward / risk).toFixed(1)}`;
  }

  function calcPct(price: number): string {
    if (!draft.entry) return '';
    const pct = ((price - draft.entry) / draft.entry * 100);
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
  }

  async function handlePublish() {
    const ok = await copyTradeStore.publishSignal();
    if (ok) {
      notifySignalTracked(draft.pair, draft.dir);
    }
  }

  function handleOverlayClick(e: MouseEvent) {
    if (!isPublishing && (e.target as HTMLElement).classList.contains('ct-overlay')) {
      copyTradeStore.closeModal();
    }
  }

  const leverageOptions = [1, 2, 3, 5, 10, 15, 20];
  const sizeOptions = [25, 50, 75, 100];
</script>

{#if isOpen}
  <div class="ct-overlay" onclick={handleOverlayClick} onkeydown={(e) => { if (e.key === 'Escape') copyTradeStore.closeModal(); }} role="dialog" tabindex="-1">
    <div class="ct-modal" aria-busy={isPublishing}>
      <!-- Header -->
      <div class="ct-header">
        <span class="ct-title">⚡ CREATE COPY TRADE</span>
        <button class="ct-close" onclick={() => copyTradeStore.closeModal()} disabled={isPublishing}>✕</button>
      </div>

      <!-- Step Indicator -->
      <div class="ct-steps">
        <span class="ct-step" class:active={step >= 1} class:current={step === 1}>1 EVIDENCE</span>
        <span class="ct-step-arrow">→</span>
        <span class="ct-step" class:active={step >= 2} class:current={step === 2}>2 CONFIGURE</span>
        <span class="ct-step-arrow">→</span>
        <span class="ct-step" class:active={step >= 3} class:current={step === 3}>3 PUBLISH</span>
      </div>

      <!-- Step 1: Evidence Review -->
      {#if step === 1}
        <div class="ct-body">
          <div class="ct-section-label">📊 Selected Agent Signals ({draft.evidence.length})</div>
          <div class="ct-evidence-list">
            {#each draft.evidence as ev}
              <div class="ct-ev-card" style="border-left: 3px solid {ev.color}">
                <div class="ct-ev-head">
                  <span class="ct-ev-icon">{ev.icon}</span>
                  <span class="ct-ev-name" style="color:{ev.color}">{ev.name}</span>
                  <span class="ct-ev-conf">{ev.conf}%</span>
                </div>
                <div class="ct-ev-text">{ev.text}</div>
              </div>
            {/each}
          </div>

          <div class="ct-consensus">
            <span class="ct-cons-label">CONSENSUS</span>
            <span class="ct-cons-dir" class:long={consensus.dir === 'LONG'} class:short={consensus.dir === 'SHORT'}>
              {consensus.dir === 'LONG' ? '▲' : '▼'} {consensus.dir}
            </span>
            <span class="ct-cons-conf">{consensus.conf}%</span>
            <span class="ct-cons-count">({consensus.count.long + consensus.count.short + consensus.count.neutral} agents)</span>
          </div>

          <button class="ct-btn ct-btn-primary" onclick={() => copyTradeStore.nextStep()} disabled={isPublishing}>
            NEXT: CONFIGURE →
          </button>
        </div>
      {/if}

      <!-- Step 2: Configure Trade -->
      {#if step === 2}
        <div class="ct-body">
          <!-- Pair -->
          <div class="ct-field">
            <label class="ct-label" for="ct-pair">PAIR</label>
            <select id="ct-pair" class="ct-select" bind:value={draft.pair} onchange={(e) => copyTradeStore.updateDraft({ pair: e.currentTarget.value })} disabled={isPublishing}>
              <option value="BTC/USDT">BTC/USDT</option>
              <option value="ETH/USDT">ETH/USDT</option>
              <option value="SOL/USDT">SOL/USDT</option>
            </select>
          </div>

          <!-- Direction -->
          <div class="ct-field" role="group" aria-label="Direction">
            <span class="ct-label">DIRECTION</span>
            <div class="ct-toggle-row">
              <button class="ct-dir-btn" class:active={draft.dir === 'LONG'} class:long-active={draft.dir === 'LONG'}
                onclick={() => copyTradeStore.updateDraft({ dir: 'LONG' })} disabled={isPublishing}>▲ LONG</button>
              <button class="ct-dir-btn" class:active={draft.dir === 'SHORT'} class:short-active={draft.dir === 'SHORT'}
                onclick={() => copyTradeStore.updateDraft({ dir: 'SHORT' })} disabled={isPublishing}>▼ SHORT</button>
            </div>
          </div>

          <!-- Order Type -->
          <div class="ct-field" role="group" aria-label="Order type">
            <span class="ct-label">ORDER TYPE</span>
            <div class="ct-toggle-row">
              <button class="ct-type-btn" class:active={draft.orderType === 'market'}
                onclick={() => copyTradeStore.updateDraft({ orderType: 'market' })} disabled={isPublishing}>MARKET</button>
              <button class="ct-type-btn" class:active={draft.orderType === 'limit'}
                onclick={() => copyTradeStore.updateDraft({ orderType: 'limit' })} disabled={isPublishing}>LIMIT</button>
            </div>
          </div>

          <!-- Entry -->
          <div class="ct-field">
            <label class="ct-label" for="ct-entry">ENTRY PRICE</label>
            <input id="ct-entry" class="ct-input" type="number" value={draft.entry}
              onchange={(e) => copyTradeStore.updateDraft({ entry: +e.currentTarget.value })} disabled={isPublishing} />
          </div>

          <!-- TP Targets -->
          <div class="ct-field" role="group" aria-label="Take profit targets">
            <span class="ct-label">TAKE PROFIT</span>
            {#each draft.tp as tp, i}
              <div class="ct-tp-row">
                <span class="ct-tp-label">TP {i + 1}</span>
                <input class="ct-input ct-input-sm" type="number" value={tp}
                  onchange={(e) => {
                    const newTp = [...draft.tp];
                    newTp[i] = +e.currentTarget.value;
                    copyTradeStore.updateDraft({ tp: newTp });
                  }} disabled={isPublishing} />
                <span class="ct-pct tp">{calcPct(tp)}</span>
                {#if i > 0}
                  <button class="ct-remove-tp" onclick={() => copyTradeStore.removeTpTarget(i)} disabled={isPublishing}>✕</button>
                {/if}
              </div>
            {/each}
            {#if draft.tp.length < 3}
              <button class="ct-add-tp" onclick={() => copyTradeStore.addTpTarget()} disabled={isPublishing}>+ ADD TP TARGET</button>
            {/if}
          </div>

          <!-- SL -->
          <div class="ct-field" role="group" aria-label="Stop loss">
            <span class="ct-label">STOP LOSS</span>
            <div class="ct-tp-row">
              <span class="ct-tp-label">SL</span>
              <input class="ct-input ct-input-sm" type="number" value={draft.sl}
                onchange={(e) => copyTradeStore.updateDraft({ sl: +e.currentTarget.value })} disabled={isPublishing} />
              <span class="ct-pct sl">{calcPct(draft.sl)}</span>
            </div>
          </div>

          <!-- Leverage -->
          <div class="ct-field" role="group" aria-label="Leverage">
            <span class="ct-label">LEVERAGE</span>
            <div class="ct-lev-row">
              {#each leverageOptions as lev}
                <button class="ct-lev-btn" class:active={draft.leverage === lev}
                  onclick={() => copyTradeStore.updateDraft({ leverage: lev })} disabled={isPublishing}>{lev}x</button>
              {/each}
            </div>
          </div>

          <!-- Position Size -->
          <div class="ct-field" role="group" aria-label="Position size">
            <span class="ct-label">POSITION SIZE</span>
            <div class="ct-size-row">
              {#each sizeOptions as sz}
                <button class="ct-size-btn" class:active={draft.sizePercent === sz}
                  onclick={() => copyTradeStore.updateDraft({ sizePercent: sz })} disabled={isPublishing}>{sz}%</button>
              {/each}
            </div>
          </div>

          <!-- Margin Mode -->
          <div class="ct-field" role="group" aria-label="Margin mode">
            <span class="ct-label">MARGIN MODE</span>
            <div class="ct-toggle-row">
              <button class="ct-type-btn" class:active={draft.marginMode === 'isolated'}
                onclick={() => copyTradeStore.updateDraft({ marginMode: 'isolated' })} disabled={isPublishing}>ISOLATED</button>
              <button class="ct-type-btn" class:active={draft.marginMode === 'cross'}
                onclick={() => copyTradeStore.updateDraft({ marginMode: 'cross' })} disabled={isPublishing}>CROSS</button>
            </div>
          </div>

          <!-- R:R -->
          <div class="ct-rr">
            <span class="ct-rr-label">R:R RATIO</span>
            <span class="ct-rr-val">{calcRR()}</span>
          </div>

          <div class="ct-nav-row">
            <button class="ct-btn ct-btn-back" onclick={() => copyTradeStore.prevStep()} disabled={isPublishing}>← BACK</button>
            <button class="ct-btn ct-btn-primary" onclick={() => copyTradeStore.nextStep()} disabled={isPublishing}>NEXT: REVIEW →</button>
          </div>
        </div>
      {/if}

      <!-- Step 3: Review & Publish -->
      {#if step === 3}
        <div class="ct-body">
          <!-- Summary -->
          <div class="ct-summary">
            <div class="ct-sum-pair">{draft.pair}</div>
            <span class="ct-sum-dir" class:long={draft.dir === 'LONG'} class:short={draft.dir === 'SHORT'}>
              {draft.dir === 'LONG' ? '▲' : '▼'} {draft.dir}
            </span>
            <span class="ct-sum-lev">{draft.leverage}x</span>
            <span class="ct-sum-margin">{draft.marginMode.toUpperCase()}</span>
          </div>

          <div class="ct-sum-prices">
            <div class="ct-sum-p"><span class="ct-sum-pl">ENTRY</span><span class="ct-sum-pv">${draft.entry.toLocaleString()}</span></div>
            {#each draft.tp as tp, i}
              <div class="ct-sum-p"><span class="ct-sum-pl tp">TP {i + 1}</span><span class="ct-sum-pv tp">${tp.toLocaleString()}</span></div>
            {/each}
            <div class="ct-sum-p"><span class="ct-sum-pl sl">SL</span><span class="ct-sum-pv sl">${draft.sl.toLocaleString()}</span></div>
          </div>

          <div class="ct-sum-meta">
            <span>R:R {calcRR()}</span>
            <span>SIZE {draft.sizePercent}%</span>
          </div>

          <!-- Evidence -->
          <div class="ct-section-label">EVIDENCE ({draft.evidence.length} AGENTS)</div>
          <div class="ct-evidence-compact">
            {#each draft.evidence as ev}
              <div class="ct-evc-row">
                <span style="color:{ev.color}">{ev.icon} {ev.name}</span>
                <span class="ct-evc-text">{ev.text.slice(0, 60)}...</span>
                <span class="ct-evc-conf">({ev.conf}%)</span>
              </div>
            {/each}
          </div>

          <!-- Notes -->
          <div class="ct-field">
            <label class="ct-label" for="ct-notes">NOTES</label>
            <textarea id="ct-notes" class="ct-textarea" placeholder="Add your trade reasoning..."
              value={draft.note}
              oninput={(e) => copyTradeStore.updateDraft({ note: e.currentTarget.value })} disabled={isPublishing}></textarea>
          </div>

          {#if isPublishing}
            <div class="ct-status">Publishing to backend and reconciling optimistic state...</div>
          {/if}

          {#if publishError}
            <div class="ct-status ct-status-error">{publishError}</div>
          {/if}

          <div class="ct-nav-row">
            <button class="ct-btn ct-btn-back" onclick={() => copyTradeStore.prevStep()} disabled={isPublishing}>← BACK</button>
            <button class="ct-btn ct-btn-publish" onclick={handlePublish} disabled={isPublishing}>
              {isPublishing ? 'PUBLISHING...' : '🚀 PUBLISH SIGNAL'}
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .ct-overlay {
    position: fixed; inset: 0; z-index: 200;
    background: rgba(0,0,0,.7);
    backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    padding: 20px;
  }

  .ct-modal {
    width: 100%; max-width: 460px; max-height: 85vh;
    background: #0c0c1e;
    border: 3px solid var(--yel);
    border-radius: 16px;
    box-shadow: 0 0 40px rgba(232,150,125,.15), 8px 8px 0 #000;
    display: flex; flex-direction: column;
    overflow: hidden;
  }

  .ct-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px;
    background: var(--yel);
    border-bottom: 3px solid #000;
  }
  .ct-title {
    font-family: var(--fd); font-size: 14px; font-weight: 900;
    letter-spacing: 2px; color: #000;
  }
  .ct-close {
    font-size: 16px; color: #000; background: none; border: none;
    cursor: pointer; font-weight: 900; padding: 0 4px;
  }
  .ct-close:disabled { opacity: .45; cursor: not-allowed; }

  /* Steps */
  .ct-steps {
    display: flex; align-items: center; justify-content: center; gap: 4px;
    padding: 8px 16px;
    border-bottom: 2px solid rgba(232,150,125,.1);
    background: rgba(232,150,125,.02);
  }
  .ct-step {
    font-family: var(--fm); font-size: 9px; font-weight: 900;
    letter-spacing: 1.5px; color: rgba(255,255,255,.5);
    padding: 2px 8px; border-radius: 4px;
    border: 1px solid rgba(255,255,255,.06);
  }
  .ct-step.active { color: rgba(255,255,255,.5); border-color: rgba(232,150,125,.2); }
  .ct-step.current { color: #000; background: var(--yel); border-color: var(--yel); }
  .ct-step-arrow { font-size: 9px; color: rgba(255,255,255,.15); }

  /* Body */
  .ct-body {
    padding: 12px 16px; overflow-y: auto; flex: 1;
    display: flex; flex-direction: column; gap: 10px;
  }
  .ct-body::-webkit-scrollbar { width: 3px; }
  .ct-body::-webkit-scrollbar-thumb { background: var(--yel); border-radius: 3px; }

  .ct-status {
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid rgba(232,150,125,.3);
    background: rgba(232,150,125,.08);
    font-family: var(--fm);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: .8px;
    color: var(--yel);
  }
  .ct-status-error {
    border-color: rgba(255,82,82,.38);
    background: rgba(255,82,82,.1);
    color: #ff8d8d;
  }

  .ct-section-label {
    font-family: var(--fm); font-size: 9px; font-weight: 900;
    letter-spacing: 2px; color: var(--yel); padding-bottom: 2px;
  }

  /* Evidence Cards */
  .ct-evidence-list { display: flex; flex-direction: column; gap: 4px; }
  .ct-ev-card {
    padding: 6px 8px;
    background: rgba(255,255,255,.02); border-radius: 6px;
    border: 1px solid rgba(255,255,255,.06);
  }
  .ct-ev-head { display: flex; align-items: center; gap: 4px; margin-bottom: 2px; }
  .ct-ev-icon { font-size: 11px; }
  .ct-ev-name { font-family: var(--fm); font-size: 9px; font-weight: 900; letter-spacing: 1px; }
  .ct-ev-conf {
    margin-left: auto;
    font-family: var(--fm); font-size: 9px; font-weight: 900; color: var(--yel);
  }
  .ct-ev-text { font-family: var(--fm); font-size: 9px; color: rgba(255,255,255,.5); line-height: 1.4; }

  /* Consensus */
  .ct-consensus {
    display: flex; align-items: center; gap: 6px;
    padding: 8px 10px; border-radius: 6px;
    background: rgba(232,150,125,.04); border: 1.5px solid rgba(232,150,125,.15);
  }
  .ct-cons-label { font-family: var(--fm); font-size: 9px; font-weight: 900; letter-spacing: 2px; color: rgba(255,255,255,.4); }
  .ct-cons-dir {
    font-family: var(--fd); font-size: 14px; font-weight: 900; letter-spacing: 1px;
  }
  .ct-cons-dir.long { color: var(--grn); }
  .ct-cons-dir.short { color: var(--red); }
  .ct-cons-conf { font-family: var(--fd); font-size: 14px; font-weight: 900; color: var(--yel); }
  .ct-cons-count { font-family: var(--fm); font-size: 9px; color: rgba(255,255,255,.3); }

  /* Form Fields */
  .ct-field { display: flex; flex-direction: column; gap: 4px; }
  .ct-label {
    font-family: var(--fm); font-size: 9px; font-weight: 900;
    letter-spacing: 2px; color: rgba(255,255,255,.35);
  }
  .ct-input {
    font-family: var(--fd); font-size: 14px; font-weight: 900;
    color: #fff; background: rgba(255,255,255,.04);
    border: 1.5px solid rgba(255,255,255,.1); border-radius: 6px;
    padding: 8px 10px; outline: none; transition: border-color .15s;
  }
  .ct-input:focus { border-color: var(--yel); }
  .ct-input-sm { font-size: 12px; padding: 5px 8px; flex: 1; }

  .ct-select {
    font-family: var(--fd); font-size: 12px; font-weight: 900;
    color: #fff; background: rgba(255,255,255,.04);
    border: 1.5px solid rgba(255,255,255,.1); border-radius: 6px;
    padding: 8px 10px; outline: none; cursor: pointer;
  }
  .ct-select option { background: #0c0c1e; }

  /* Toggle Rows */
  .ct-toggle-row { display: flex; gap: 4px; }
  .ct-dir-btn, .ct-type-btn {
    flex: 1; padding: 6px 8px;
    font-family: var(--fm); font-size: 9px; font-weight: 900; letter-spacing: 1.5px;
    border: 2px solid rgba(255,255,255,.1); border-radius: 6px;
    background: rgba(255,255,255,.02); color: rgba(255,255,255,.4);
    cursor: pointer; transition: all .12s; text-align: center;
  }
  .ct-dir-btn.long-active { background: var(--grn); color: #000; border-color: var(--grn); }
  .ct-dir-btn.short-active { background: var(--red); color: #fff; border-color: var(--red); }
  .ct-type-btn.active { background: var(--yel); color: #000; border-color: var(--yel); }

  /* TP Rows */
  .ct-tp-row { display: flex; align-items: center; gap: 6px; }
  .ct-tp-label { font-family: var(--fm); font-size: 9px; font-weight: 900; color: rgba(255,255,255,.3); width: 24px; }
  .ct-pct { font-family: var(--fm); font-size: 9px; font-weight: 700; width: 44px; text-align: right; }
  .ct-pct.tp { color: var(--grn); }
  .ct-pct.sl { color: var(--red); }
  .ct-remove-tp {
    font-size: 10px; color: var(--red); background: none; border: none;
    cursor: pointer; padding: 2px 4px;
  }
  .ct-add-tp {
    font-family: var(--fm); font-size: 9px; font-weight: 900; letter-spacing: 1px;
    color: var(--grn); background: rgba(0,255,136,.06);
    border: 1px solid rgba(0,255,136,.2); border-radius: 4px;
    padding: 4px 8px; cursor: pointer; width: fit-content; transition: background .12s;
  }
  .ct-add-tp:hover { background: rgba(0,255,136,.12); }

  /* Leverage */
  .ct-lev-row { display: flex; gap: 3px; }
  .ct-lev-btn {
    flex: 1; padding: 5px 4px;
    font-family: var(--fm); font-size: 9px; font-weight: 900;
    border: 1.5px solid rgba(255,255,255,.08); border-radius: 4px;
    background: rgba(255,255,255,.02); color: rgba(255,255,255,.35);
    cursor: pointer; transition: all .12s; text-align: center;
  }
  .ct-lev-btn.active { background: var(--ora); color: #000; border-color: var(--ora); }

  /* Size */
  .ct-size-row { display: flex; gap: 4px; }
  .ct-size-btn {
    flex: 1; padding: 6px 4px;
    font-family: var(--fm); font-size: 9px; font-weight: 900;
    border: 2px solid rgba(255,255,255,.08); border-radius: 6px;
    background: rgba(255,255,255,.02); color: rgba(255,255,255,.35);
    cursor: pointer; transition: all .12s; text-align: center;
  }
  .ct-size-btn.active { background: var(--cyan); color: #000; border-color: var(--cyan); }

  /* R:R */
  .ct-rr {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 8px; border-radius: 6px;
    background: rgba(232,150,125,.04); border: 1px solid rgba(232,150,125,.15);
  }
  .ct-rr-label { font-family: var(--fm); font-size: 9px; font-weight: 900; letter-spacing: 2px; color: rgba(255,255,255,.4); }
  .ct-rr-val { font-family: var(--fd); font-size: 20px; font-weight: 900; color: var(--yel); }

  /* Navigation */
  .ct-nav-row { display: flex; gap: 8px; margin-top: 4px; }
  .ct-btn {
    padding: 10px 16px; border-radius: 8px;
    font-family: var(--fd); font-size: 10px; font-weight: 900;
    letter-spacing: 2px; cursor: pointer; transition: all .12s;
    border: 3px solid #000; box-shadow: 3px 3px 0 #000;
    text-align: center;
  }
  .ct-btn:hover { transform: translate(-1px,-1px); box-shadow: 4px 4px 0 #000; }
  .ct-btn:active { transform: translate(1px,1px); box-shadow: 1px 1px 0 #000; }
  .ct-btn-primary { flex: 1; background: var(--yel); color: #000; }
  .ct-btn-back { background: rgba(255,255,255,.05); color: rgba(255,255,255,.5); border-color: rgba(255,255,255,.1); box-shadow: none; }
  .ct-btn-back:hover { background: rgba(255,255,255,.1); box-shadow: none; transform: none; }
  .ct-btn-publish { flex: 1; background: var(--grn); color: #000; }

  /* Summary (Step 3) */
  .ct-summary {
    display: flex; align-items: center; gap: 8px;
    padding: 10px; border-radius: 8px;
    background: rgba(255,255,255,.03); border: 2px solid rgba(255,255,255,.08);
  }
  .ct-sum-pair { font-family: var(--fd); font-size: 18px; font-weight: 900; color: #fff; }
  .ct-sum-dir {
    font-family: var(--fm); font-size: 9px; font-weight: 900;
    padding: 3px 8px; border: 1.5px solid; border-radius: 4px;
  }
  .ct-sum-dir.long { color: var(--grn); border-color: rgba(0,255,136,.4); background: rgba(0,255,136,.08); }
  .ct-sum-dir.short { color: var(--red); border-color: rgba(255,45,85,.4); background: rgba(255,45,85,.08); }
  .ct-sum-lev {
    font-family: var(--fm); font-size: 9px; font-weight: 900;
    color: var(--ora); background: rgba(255,140,59,.08);
    padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(255,140,59,.2);
  }
  .ct-sum-margin {
    font-family: var(--fm); font-size: 9px; font-weight: 700;
    color: rgba(255,255,255,.3); letter-spacing: 1px;
  }

  .ct-sum-prices {
    display: flex; gap: 12px; padding: 6px 10px;
    background: rgba(255,255,255,.02); border-radius: 6px;
  }
  .ct-sum-p { display: flex; flex-direction: column; }
  .ct-sum-pl { font-family: var(--fm); font-size: 9px; color: rgba(255,255,255,.5); letter-spacing: 1px; }
  .ct-sum-pl.tp { color: rgba(0,255,136,.5); }
  .ct-sum-pl.sl { color: rgba(255,45,85,.5); }
  .ct-sum-pv { font-family: var(--fd); font-size: 12px; font-weight: 900; color: #fff; }
  .ct-sum-pv.tp { color: var(--grn); }
  .ct-sum-pv.sl { color: var(--red); }

  .ct-sum-meta {
    display: flex; gap: 12px;
    font-family: var(--fm); font-size: 9px; font-weight: 700;
    color: rgba(255,255,255,.4); letter-spacing: 1px;
  }

  /* Evidence Compact */
  .ct-evidence-compact { display: flex; flex-direction: column; gap: 3px; }
  .ct-evc-row {
    display: flex; align-items: center; gap: 4px;
    font-family: var(--fm); font-size: 9px;
    padding: 3px 6px; border-radius: 4px;
    background: rgba(255,255,255,.02);
  }
  .ct-evc-row span:first-child { font-weight: 900; font-size: 9px; min-width: 80px; }
  .ct-evc-text { color: rgba(255,255,255,.4); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ct-evc-conf { color: var(--yel); font-weight: 700; }

  /* Textarea */
  .ct-textarea {
    font-family: var(--fm); font-size: 9px;
    color: rgba(255,255,255,.7); background: rgba(255,255,255,.03);
    border: 1.5px solid rgba(255,255,255,.08); border-radius: 6px;
    padding: 8px 10px; resize: vertical; min-height: 60px;
    outline: none; line-height: 1.5;
  }
  .ct-textarea:focus { border-color: var(--yel); }
  .ct-textarea::placeholder { color: rgba(255,255,255,.5); }
</style>
