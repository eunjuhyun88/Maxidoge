<script lang="ts">
  import type { SignalEvidence, EvidenceItem } from '$lib/terminal/signalEvidence';
  import EvidenceChip from './EvidenceChip.svelte';

  interface Props {
    evidence: SignalEvidence | null;
    onUpdate: (evidence: SignalEvidence) => void;
    onNext: () => void;
    onCancel: () => void;
  }

  let { evidence, onUpdate, onNext, onCancel }: Props = $props();

  let showNoteInput = $state(false);
  let noteText = $state('');

  const hasItems = $derived((evidence?.items?.length ?? 0) > 0);
  const sourceLabel = $derived(
    evidence?.source === 'ai-scan' ? '🤖 AI 분석 근거' :
    evidence?.source === 'chart-observation' ? '📊 차트 관찰 근거' :
    '📝 수동 입력'
  );
  const consensusItem = $derived(evidence?.items?.find(i => i.kind === 'consensus'));
  const agentItems = $derived(evidence?.items?.filter(i => i.kind === 'agent-vote') ?? []);
  const indicatorItems = $derived(evidence?.items?.filter(i => i.kind === 'indicator') ?? []);
  const patternItems = $derived(evidence?.items?.filter(i => i.kind === 'pattern') ?? []);
  const noteItems = $derived(evidence?.items?.filter(i => i.kind === 'user-note') ?? []);

  function addNote() {
    if (!noteText.trim()) return;
    const newItem: EvidenceItem = {
      kind: 'user-note',
      label: '메모',
      detail: noteText.trim(),
    };
    const updatedEvidence: SignalEvidence = evidence
      ? { ...evidence, items: [...evidence.items, newItem] }
      : {
          source: 'manual',
          capturedAt: new Date().toISOString(),
          pair: '',
          timeframe: '',
          priceAtCapture: 0,
          items: [newItem],
        };
    onUpdate(updatedEvidence);
    noteText = '';
    showNoteInput = false;
  }

  function removeItem(index: number) {
    if (!evidence) return;
    const updated = { ...evidence, items: evidence.items.filter((_, i) => i !== index) };
    onUpdate(updated);
  }
</script>

<div class="evidence-step">
  {#if hasItems}
    <!-- Evidence present — review mode -->
    <div class="ev-header">
      <span class="ev-source">{sourceLabel}</span>
      <span class="ev-count">{evidence?.items?.length ?? 0}개 근거</span>
      {#if evidence?.priceAtCapture}
        <span class="ev-price">${evidence.priceAtCapture.toLocaleString()}</span>
      {/if}
    </div>

    <!-- Consensus (large) -->
    {#if consensusItem}
      <div class="ev-consensus">
        <EvidenceChip item={consensusItem} />
        {#if evidence?.commanderSummary}
          <p class="ev-summary">{evidence.commanderSummary}</p>
        {/if}
      </div>
    {/if}

    <!-- Agent votes grid -->
    {#if agentItems.length > 0}
      <div class="ev-group">
        <div class="ev-group-label">에이전트 분석</div>
        <div class="ev-chips">
          {#each agentItems as item, idx}
            <div class="ev-chip-wrap">
              <EvidenceChip {item} />
              <button class="ev-remove" onclick={() => {
                const globalIdx = evidence?.items?.indexOf(item) ?? -1;
                if (globalIdx >= 0) removeItem(globalIdx);
              }} title="제거">×</button>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Indicators -->
    {#if indicatorItems.length > 0}
      <div class="ev-group">
        <div class="ev-group-label">인디케이터</div>
        <div class="ev-chips">
          {#each indicatorItems as item}
            <EvidenceChip {item} />
          {/each}
        </div>
      </div>
    {/if}

    <!-- Patterns -->
    {#if patternItems.length > 0}
      <div class="ev-group">
        <div class="ev-group-label">패턴</div>
        <div class="ev-chips">
          {#each patternItems as item}
            <EvidenceChip {item} />
          {/each}
        </div>
      </div>
    {/if}

    <!-- User notes -->
    {#if noteItems.length > 0}
      <div class="ev-group">
        <div class="ev-group-label">메모</div>
        {#each noteItems as item}
          <div class="ev-note">
            <span class="ev-note-text">{item.detail}</span>
          </div>
        {/each}
      </div>
    {/if}

  {:else}
    <!-- No evidence — empty state -->
    <div class="ev-empty">
      <span class="ev-empty-icon">📋</span>
      <span class="ev-empty-text">아직 증거가 없습니다</span>
      <span class="ev-empty-hint">메모를 추가하거나, 건너뛰고 바로 시그널을 작성할 수 있습니다</span>
    </div>
  {/if}

  <!-- Add note -->
  {#if showNoteInput}
    <div class="note-input-wrap">
      <textarea
        class="note-input"
        placeholder="관찰한 내용이나 근거를 입력하세요..."
        bind:value={noteText}
        rows={2}
      ></textarea>
      <div class="note-actions">
        <button class="note-cancel" onclick={() => { showNoteInput = false; noteText = ''; }}>취소</button>
        <button class="note-add" disabled={!noteText.trim()} onclick={addNote}>추가</button>
      </div>
    </div>
  {:else}
    <button class="add-note-btn" onclick={() => showNoteInput = true}>
      📝 메모 추가
    </button>
  {/if}

  <!-- Navigation -->
  <div class="step-actions">
    <button class="btn-cancel" onclick={onCancel}>취소</button>
    <button class="btn-next" onclick={onNext}>
      {hasItems ? '다음 → 시그널 설정' : '건너뛰기 →'}
    </button>
  </div>
</div>

<style>
  .evidence-step {
    display: flex;
    flex-direction: column;
    gap: var(--sc-sp-3);
    animation: sc-slide-up var(--sc-duration-fast) var(--sc-ease);
  }

  /* Header */
  .ev-header {
    display: flex;
    align-items: center;
    gap: var(--sc-sp-2);
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-sm);
  }
  .ev-source { font-weight: 800; color: var(--sc-text-0); }
  .ev-count {
    font-size: var(--sc-fs-2xs);
    font-weight: 700;
    color: var(--sc-text-3);
    background: var(--sc-surface);
    padding: 1px var(--sc-sp-1_5);
    border-radius: var(--sc-radius-pill);
  }
  .ev-price {
    margin-left: auto;
    font-size: var(--sc-fs-2xs);
    font-weight: 800;
    color: var(--sc-text-2);
  }

  /* Consensus */
  .ev-consensus {
    display: flex;
    flex-direction: column;
    gap: var(--sc-sp-1);
  }
  .ev-summary {
    margin: 0;
    font-family: var(--sc-font-body);
    font-size: var(--sc-fs-sm);
    color: var(--sc-text-2);
    line-height: var(--sc-lh-normal);
    padding-left: var(--sc-sp-2);
    border-left: 2px solid var(--sc-line-soft);
  }

  /* Groups */
  .ev-group {
    display: flex;
    flex-direction: column;
    gap: var(--sc-sp-1);
  }
  .ev-group-label {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-2xs);
    font-weight: 700;
    color: var(--sc-text-3);
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  .ev-chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sc-sp-1);
  }

  .ev-chip-wrap {
    position: relative;
    display: inline-flex;
  }
  .ev-remove {
    position: absolute;
    top: -4px;
    right: -4px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--sc-bad);
    color: #000;
    font-size: 10px;
    font-weight: 900;
    border: none;
    cursor: pointer;
    display: grid;
    place-items: center;
    opacity: 0;
    transition: opacity var(--sc-duration-fast);
  }
  .ev-chip-wrap:hover .ev-remove { opacity: 1; }

  /* Note */
  .ev-note {
    padding: var(--sc-sp-2);
    background: var(--sc-surface);
    border-radius: var(--sc-radius-md);
    border-left: 3px solid var(--sc-accent);
  }
  .ev-note-text {
    font-family: var(--sc-font-body);
    font-size: var(--sc-fs-sm);
    color: var(--sc-text-1);
    font-style: italic;
  }

  /* Empty state */
  .ev-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sc-sp-1);
    padding: var(--sc-sp-4) var(--sc-sp-3);
    border: 1px dashed var(--sc-line-soft);
    border-radius: var(--sc-radius-lg);
    text-align: center;
  }
  .ev-empty-icon { font-size: var(--sc-fs-xl); opacity: 0.4; }
  .ev-empty-text {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-sm);
    font-weight: 700;
    color: var(--sc-text-2);
  }
  .ev-empty-hint {
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-2xs);
    color: var(--sc-text-3);
  }

  /* Note input */
  .note-input-wrap {
    display: flex;
    flex-direction: column;
    gap: var(--sc-sp-1);
  }
  .note-input {
    width: 100%;
    resize: vertical;
    min-height: 48px;
    background: var(--sc-bg-0);
    border: 1px solid var(--sc-line-soft);
    border-radius: var(--sc-radius-md);
    padding: var(--sc-sp-2);
    font-family: var(--sc-font-body);
    font-size: var(--sc-fs-sm);
    color: var(--sc-text-0);
    outline: none;
  }
  .note-input:focus { border-color: var(--sc-accent); }
  .note-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--sc-sp-1);
  }
  .note-cancel, .note-add {
    padding: var(--sc-sp-1) var(--sc-sp-3);
    border-radius: var(--sc-radius-md);
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-2xs);
    font-weight: 700;
    cursor: pointer;
    border: 1px solid var(--sc-line-soft);
  }
  .note-cancel { background: var(--sc-surface); color: var(--sc-text-2); }
  .note-add {
    background: var(--sc-accent);
    color: #000;
    border: none;
    font-weight: 900;
  }
  .note-add:disabled { opacity: 0.35; cursor: not-allowed; }

  .add-note-btn {
    align-self: flex-start;
    padding: var(--sc-sp-1) var(--sc-sp-3);
    border-radius: var(--sc-radius-pill);
    font-family: var(--sc-font-mono);
    font-size: var(--sc-fs-2xs);
    font-weight: 700;
    background: var(--sc-surface);
    color: var(--sc-text-2);
    border: 1px dashed var(--sc-line-soft);
    cursor: pointer;
    transition: all var(--sc-duration-fast) var(--sc-ease);
  }
  .add-note-btn:hover {
    border-color: var(--sc-accent);
    color: var(--sc-accent);
    background: var(--sc-accent-bg-subtle);
  }

  /* Navigation */
  .step-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--sc-sp-2);
  }
  .btn-cancel {
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
  .btn-cancel:hover { background: var(--sc-surface-2); color: var(--sc-text-1); }
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
  .btn-next:hover {
    transform: translateY(-1px);
    box-shadow: 2px 2px 0 rgba(0,0,0,0.4);
  }
</style>
