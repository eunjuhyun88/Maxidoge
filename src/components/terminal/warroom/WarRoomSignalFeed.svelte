<script lang="ts">
  import type { AgentSignal } from '$lib/data/warroom';
  import type { ScanTab, SignalDiff } from './types';

  export let filteredSignals: AgentSignal[] = [];
  export let scanTabs: ScanTab[] = [];
  export let selectedIds: Set<string> = new Set();
  export let selectedCount = 0;
  export let signalDiffs: Map<string, SignalDiff> = new Map();
  export let diffFreshUntil = 0;

  export let fmtPrice: (value: number) => string;
  export let onSelectAll: () => void;
  export let onToggleSelect: (id: string) => void;
  export let onQuickTrade: (dir: 'LONG' | 'SHORT', sig: AgentSignal) => void;
  export let onTrack: (sig: AgentSignal) => void;
  export let onRunScan: () => void;
</script>

<div class="select-bar">
  <button class="select-all-btn" on:click={onSelectAll}>
    <span class="sa-check" class:checked={selectedCount === filteredSignals.length && filteredSignals.length > 0}>
      {selectedCount === filteredSignals.length && filteredSignals.length > 0 ? '☑' : '☐'}
    </span>
    SELECT ALL
  </button>
  {#if selectedCount > 0}
    <span class="select-count">{selectedCount} selected</span>
  {/if}
</div>

<div class="wr-msgs">
  {#each filteredSignals as sig (sig.id)}
    {@const isSelected = selectedIds.has(sig.id)}
    {@const diff = diffFreshUntil > Date.now() ? signalDiffs.get(sig.id) : undefined}
    {@const hasChange = diff && (diff.isNew || diff.voteChanged || Math.abs(diff.confDelta) >= 3)}
    <div
      class="wr-msg"
      class:selected={isSelected}
      class:wr-msg-new={hasChange}
      class:wr-msg-vote-flip={diff?.voteChanged}
      on:click={() => onToggleSelect(sig.id)}
      role="button"
      tabindex="0"
      on:keydown={(e) => e.key === 'Enter' && onToggleSelect(sig.id)}
    >
      <div class="wr-msg-strip" style="background:{sig.color}"></div>
      <div class="wr-msg-checkbox">
        <span class="msg-check" class:checked={isSelected}>
          {isSelected ? '☑' : '☐'}
        </span>
      </div>
      <div class="wr-msg-body">
        <div class="wr-msg-head">
          <span class="wr-msg-icon">{sig.icon}</span>
          <span class="wr-msg-name" style="color:{sig.color}">{sig.name}</span>
          <span class="wr-msg-token">{sig.token}</span>
          <span class="wr-msg-vote {sig.vote}">{sig.vote.toUpperCase()}</span>
          <span class="wr-msg-conf">{sig.conf}%</span>
          {#if diff}
            {#if diff.isNew}
              <span class="wr-diff-badge wr-diff-new">NEW</span>
            {:else if diff.voteChanged && diff.prevVote}
              <span class="wr-diff-badge wr-diff-flip">{diff.prevVote.toUpperCase()}→{sig.vote.toUpperCase()}</span>
            {/if}
            {#if !diff.isNew && diff.confDelta !== 0}
              <span class="wr-diff-delta" class:pos={diff.confDelta > 0} class:neg={diff.confDelta < 0}>
                {diff.confDelta > 0 ? '+' : ''}{diff.confDelta}%
              </span>
            {/if}
          {/if}
          <span class="wr-msg-time">{sig.time}</span>
        </div>
        <div class="wr-conf-bar">
          <div class="wr-conf-fill {sig.vote}" style="width:{Math.min(sig.conf, 100)}%"></div>
        </div>
        <div class="wr-msg-text">{sig.text}</div>
        <div class="wr-msg-signal-row">
          <span class="wr-msg-entry">{fmtPrice(sig.entry)}</span>
          <span class="wr-msg-arrow-price">→</span>
          <span class="wr-msg-tp">TP {fmtPrice(sig.tp)}</span>
          <span class="wr-msg-sl">SL {fmtPrice(sig.sl)}</span>
        </div>
        <div class="wr-msg-actions">
          <span class="wr-msg-src">{sig.src}</span>
          <button class="wr-act-btn long" on:click|stopPropagation={() => onQuickTrade('LONG', sig)} title="Quick Trade: open LONG position">▲ LONG</button>
          <button class="wr-act-btn short" on:click|stopPropagation={() => onQuickTrade('SHORT', sig)} title="Quick Trade: open SHORT position">▼ SHORT</button>
          <button class="wr-act-btn track" on:click|stopPropagation={() => onTrack(sig)}>TRACK</button>
        </div>
      </div>
    </div>
  {/each}

  {#if filteredSignals.length === 0}
    <div class="wr-empty">
      {#if scanTabs.length === 0}
        <div class="wr-empty-icon">🔍</div>
        <div class="wr-empty-title">SCAN TO START</div>
        <div class="wr-empty-text">차트에서 SCAN 버튼을 눌러 AI 에이전트 분석을 시작하세요. 스캔 결과가 여기에 표시됩니다.</div>
        <button class="wr-empty-scan-btn" on:click={onRunScan}>
          ⚡ RUN SCAN NOW
        </button>
      {:else}
        <div class="wr-empty-title">NO SIGNALS</div>
        <div class="wr-empty-text">현재 필터에서 표시할 데이터가 없습니다.</div>
      {/if}
    </div>
  {/if}
</div>
