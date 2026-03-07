<script lang="ts">
  import type { OnchainData } from '$lib/terminal/intel/intelTypes';
  import { MVRV_ZONE_LABELS } from '$lib/terminal/intel/intelTypes';
  import { formatRelativeTime, fmtUsd } from '$lib/terminal/intel/intelHelpers';
  import { communityPosts, toggleReaction } from '$lib/stores/communityStore';

  interface Props {
    onchainData?: OnchainData | null;
    onchainLoading?: boolean;
    liveFlows?: Array<{ id: string; label: string; addr: string; amt: string; isBuy: boolean; source?: string }>;
    liveEvents?: Array<{ id: string; tag: string; level: string; text: string; source: string; createdAt: number }>;
    feedFilter?: string;
    densityMode?: 'essential' | 'pro';
  }

  let {
    onchainData = null,
    onchainLoading = false,
    liveFlows = [],
    liveEvents = [],
    feedFilter = 'all',
    densityMode = 'essential',
  }: Props = $props();
</script>

{#if feedFilter === 'all' || feedFilter === 'events'}
  <div class="ev-list">
    {#if liveEvents.length === 0}
      <div class="flow-empty">Loading events...</div>
    {/if}
    {#each liveEvents as ev}
      <div class="ev-card" style="border-left-color:{ev.level === 'warning' ? '#ff8c3b' : '#3b9eff'}">
        <div class="ev-head">
          <span class="ev-tag" style="background:{ev.tag === 'DERIV' ? '#ff8c3b' : ev.tag === 'ON-CHAIN' ? '#00e68a' : ev.tag === 'SOCIAL' ? '#8b5cf6' : '#3b9eff'};color:#000">{ev.tag}</span>
          <span class="ev-etime">{formatRelativeTime(ev.createdAt)}</span>
        </div>
        <div class="ev-body">{ev.text}</div>
        <span class="ev-src">{ev.source}</span>
      </div>
    {/each}
  </div>
{/if}

{#if feedFilter === 'all' || feedFilter === 'flow'}
  <div class="oc-dashboard">
    <div class="oc-header">ON-CHAIN SIGNALS</div>
    {#if onchainLoading && !onchainData}
      <div class="oc-loading">Loading on-chain data...</div>
    {:else if onchainData}
      {#if onchainData.mvrv}
        {@const zoneInfo = MVRV_ZONE_LABELS[onchainData.mvrv.zone ?? ''] ?? { label: '—', emoji: '⚪', color: '#666' }}
        {@const nuplVal = onchainData.mvrv.nupl}
        {@const nuplColor = nuplVal == null ? '#666' : nuplVal > 0.5 ? '#ef4444' : nuplVal > 0.25 ? '#f97316' : nuplVal > 0 ? '#22c55e' : '#3b82f6'}
        {@const mvrvGauge = onchainData.mvrv.value == null ? 0 : Math.max(0, Math.min(100, onchainData.mvrv.value * 22))}
        {@const nuplGauge = nuplVal == null ? 0 : Math.max(0, Math.min(100, (nuplVal + 1) * 50))}
        {@const wNet = onchainData.whale.netflow}
        {@const wBullish = wNet < 0}
        {@const ef = onchainData.exchangeFlow.netflow24h}
        {@const efOut = ef != null && ef < 0}
        <div class="oc-grid">
          <div class="oc-card">
            <div class="oc-card-lbl">MVRV</div>
            <div class="oc-card-val" style="color:{zoneInfo.color}">{onchainData.mvrv.value?.toFixed(3) ?? '—'}</div>
            <div class="oc-mini-gauge"><span style="width:{mvrvGauge}%;background:{zoneInfo.color};"></span></div>
            <div class="oc-card-tag" style="background:{zoneInfo.color}20;color:{zoneInfo.color}">{zoneInfo.emoji} {zoneInfo.label}</div>
          </div>
          <div class="oc-card">
            <div class="oc-card-lbl">NUPL</div>
            <div class="oc-card-val" style="color:{nuplColor}">{nuplVal?.toFixed(3) ?? '—'}</div>
            <div class="oc-mini-gauge"><span style="width:{nuplGauge}%;background:{nuplColor};"></span></div>
            <div class="oc-card-sub">{nuplVal == null ? '' : nuplVal > 0.5 ? 'Euphoria' : nuplVal > 0.25 ? 'Belief' : nuplVal > 0 ? 'Hope' : 'Capitulation'}</div>
          </div>
          <div class="oc-card">
            <div class="oc-card-lbl">🐋 WHALE</div>
            <div class="oc-card-val" style="color:{wBullish ? '#22c55e' : '#ef4444'}">{onchainData.whale.count}건</div>
            <div class="oc-card-sub" style="color:{wBullish ? '#22c55e' : '#ef4444'}">{wBullish ? '순매수' : '순매도'} {fmtUsd(Math.abs(wNet))}</div>
          </div>
          <div class="oc-card">
            <div class="oc-card-lbl">🏦 EX FLOW</div>
            <div class="oc-card-val" style="color:{ef == null ? '#666' : efOut ? '#22c55e' : '#ef4444'}">{ef != null ? (efOut ? '−' : '+') : ''}{fmtUsd(ef != null ? Math.abs(ef) : null)}</div>
            <div class="oc-card-sub">{efOut ? 'Outflow (Bullish)' : ef != null && ef > 0 ? 'Inflow (Bearish)' : '—'}</div>
          </div>
        </div>
      {/if}

      {#if onchainData.liquidation.total1h > 0}
        {@const longPct = onchainData.liquidation.total1h > 0 ? (onchainData.liquidation.longTotal1h / onchainData.liquidation.total1h) * 100 : 50}
        <div class="oc-liq">
          <div class="oc-liq-header">
            <span>💀 LIQUIDATIONS (1H)</span>
            <span class="oc-liq-total">{fmtUsd(onchainData.liquidation.total1h)}</span>
          </div>
          <div class="oc-liq-bar">
            <div class="oc-liq-long" style="width:{longPct}%"><span>L {longPct.toFixed(0)}%</span></div>
            <div class="oc-liq-short" style="width:{100 - longPct}%"><span>S {(100 - longPct).toFixed(0)}%</span></div>
          </div>
        </div>
      {/if}

      {#if onchainData.alerts.length > 0}
        <div class="oc-alerts">
          {#each onchainData.alerts.slice(0, 4) as alert (alert.id)}
            <div class="oc-alert oc-alert-{alert.severity}">
              <span class="oc-alert-title">{alert.title}</span>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>

  <div class="flow-list">
    <div class="flow-section-lbl">SMART MONEY FLOWS (24H)</div>
    {#if liveFlows.length === 0}
      <div class="flow-empty">Loading flow data...</div>
    {/if}
    {#each liveFlows as flow (flow.id)}
      <div class="flow-row">
        <div class="flow-dir" class:buy={flow.isBuy} class:sell={!flow.isBuy}>{flow.isBuy ? '↑' : '↓'}</div>
        <div class="flow-info">
          <div class="flow-lbl">{flow.label}</div>
          <div class="flow-addr">{flow.addr}</div>
          {#if flow.source}
            <div class="flow-src">{flow.source}</div>
          {/if}
        </div>
        <div class="flow-amt" class:buy={flow.isBuy} class:sell={!flow.isBuy}>{flow.amt}</div>
      </div>
    {/each}
  </div>
{/if}

{#if feedFilter === 'all' || feedFilter === 'community'}
  {#each $communityPosts as post (post.id)}
    <div class="comm-post user-post">
      <div class="comm-head">
        <div class="comm-avatar" style="background:{post.avatarColor}20;color:{post.avatarColor}">{post.avatar}</div>
        <span class="comm-name">{post.author}</span>
        {#if post.signal}
          <span class="comm-sig {post.signal}">{post.signal === 'long' ? '▲' : '▼'} {post.signal.toUpperCase()}</span>
        {/if}
        <span class="comm-time">{formatRelativeTime(post.timestamp)}</span>
      </div>
      <div class="comm-txt">{post.text}</div>

      {#if post.signalAttachment}
        {@const att = post.signalAttachment}
        {@const rr = Math.abs(att.entry - att.sl) > 0 ? Math.abs(att.tp - att.entry) / Math.abs(att.entry - att.sl) : 0}
        <div class="comm-signal-card">
          <div class="comm-sig-top">
            <span class="comm-sig-pair">{att.pair}</span>
            <span class="comm-sig-dir {att.dir === 'LONG' ? 'long' : 'short'}">{att.dir === 'LONG' ? '▲' : '▼'} {att.dir}</span>
            <span class="comm-sig-conf">{att.conf}%</span>
            {#if rr > 0}<span class="comm-sig-rr">R:R {rr.toFixed(1)}</span>{/if}
            {#if att.timeframe}<span class="comm-sig-tf">{att.timeframe}</span>{/if}
          </div>
          <div class="comm-sig-levels">
            <span class="comm-sig-lv">E ${att.entry.toLocaleString()}</span>
            <span class="comm-sig-lv tp">TP ${att.tp.toLocaleString()}</span>
            <span class="comm-sig-lv sl">SL ${att.sl.toLocaleString()}</span>
          </div>
        </div>
      {/if}

      <div class="comm-actions">
        <button class="comm-react" class:reacted={post.userReacted} onclick={() => toggleReaction(post.id)}>
          👍 {post.likes > 0 ? post.likes : ''}
        </button>
        {#if post.commentCount > 0}
          <span class="comm-meta">💬 {post.commentCount}</span>
        {/if}
        {#if post.copyCount > 0}
          <span class="comm-meta">📋 {post.copyCount}</span>
        {/if}
      </div>
    </div>
  {/each}
  {#if $communityPosts.length === 0 && feedFilter === 'community'}
    <div class="flow-empty">No community posts yet.</div>
  {/if}
{/if}

<style>
  /* ── Events ── */
  .ev-list { display: flex; flex-direction: column; gap: var(--sc-sp-1); }
  .ev-card {
    border-left: 2px solid;
    padding: var(--sc-sp-1_5) var(--sc-sp-2);
    background: var(--sc-accent-bg-subtle);
  }
  .ev-head { display: flex; align-items: center; gap: var(--sc-sp-1); margin-bottom: 2px; }
  .ev-tag { font-family: var(--sc-font-mono); font-size: var(--sc-fs-2xs); font-weight: 700; padding: 2px 5px; }
  .ev-etime { font-family: var(--sc-font-mono); font-size: var(--sc-fs-2xs); color: var(--sc-text-2); }
  .ev-body { font-family: var(--sc-font-mono); font-size: var(--sc-fs-sm); line-height: var(--sc-lh-normal); color: var(--sc-text-1); }
  .ev-src { font-family: var(--sc-font-mono); font-size: var(--sc-fs-2xs); color: var(--sc-text-3); display: block; margin-top: 3px; }

  /* ── On-chain dashboard ── */
  .oc-dashboard { margin-bottom: var(--sc-sp-2); }
  .oc-header {
    font-family: var(--sc-font-mono); font-size: var(--sc-fs-xs); font-weight: 700;
    letter-spacing: 1.5px; color: #a78bfa;
    padding: var(--sc-sp-1) 0 var(--sc-sp-1_5);
    border-bottom: 1px solid var(--sc-line-soft);
  }
  .oc-loading { font-family: var(--sc-font-mono); font-size: var(--sc-fs-2xs); color: var(--sc-text-3); text-align: center; padding: var(--sc-sp-3) 0; }
  .oc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sc-sp-1); margin-top: var(--sc-sp-1_5); }
  .oc-card {
    background: var(--sc-accent-bg-subtle);
    border: 1px solid var(--sc-line-soft);
    padding: var(--sc-sp-2);
    display: flex; flex-direction: column; gap: 2px;
    border-radius: var(--sc-radius-sm);
  }
  .oc-card-lbl { font-family: var(--sc-font-mono); font-size: var(--sc-fs-2xs); font-weight: 700; letter-spacing: 1px; color: var(--sc-text-3); }
  .oc-card-val { font-family: var(--sc-font-mono); font-size: var(--sc-fs-lg); font-weight: 800; line-height: var(--sc-lh-tight); }
  .oc-mini-gauge { height: 4px; border-radius: var(--sc-radius-pill); background: var(--sc-line-soft); overflow: hidden; margin-top: 1px; }
  .oc-mini-gauge > span { display: block; height: 100%; border-radius: var(--sc-radius-pill); transition: width var(--sc-duration-normal) var(--sc-ease); }
  .oc-card-tag { font-family: var(--sc-font-mono); font-size: var(--sc-fs-2xs); font-weight: 600; padding: 1px 5px; border-radius: var(--sc-radius-sm); display: inline-block; width: fit-content; letter-spacing: .3px; }
  .oc-card-sub { font-family: var(--sc-font-mono); font-size: var(--sc-fs-2xs); color: var(--sc-text-3); letter-spacing: .3px; }

  /* ── Liquidations ── */
  .oc-liq { margin-top: var(--sc-sp-1_5); }
  .oc-liq-header { display: flex; justify-content: space-between; align-items: center; font-family: var(--sc-font-mono); font-size: var(--sc-fs-2xs); font-weight: 700; color: var(--sc-text-1); letter-spacing: .5px; margin-bottom: 3px; }
  .oc-liq-total { color: var(--sc-text-3); }
  .oc-liq-bar { display: flex; height: 16px; border-radius: var(--sc-radius-sm); overflow: hidden; }
  .oc-liq-long { background: rgba(255, 94, 122, 0.4); display: flex; align-items: center; justify-content: center; min-width: 20px; transition: width var(--sc-duration-normal); }
  .oc-liq-short { background: rgba(0, 204, 136, 0.4); display: flex; align-items: center; justify-content: center; min-width: 20px; transition: width var(--sc-duration-normal); }
  .oc-liq-long span, .oc-liq-short span { font-family: var(--sc-font-mono); font-size: var(--sc-fs-2xs); font-weight: 700; color: var(--sc-text-0); letter-spacing: .3px; }

  /* ── Alerts ── */
  .oc-alerts { display: flex; flex-direction: column; gap: 3px; margin-top: var(--sc-sp-1_5); }
  .oc-alert { font-family: var(--sc-font-mono); font-size: var(--sc-fs-2xs); padding: var(--sc-sp-1) var(--sc-sp-2); border-radius: var(--sc-radius-sm); border-left: 2px solid; }
  .oc-alert-critical { background: var(--sc-bad-bg); border-color: var(--sc-bad); color: #fca5a5; }
  .oc-alert-alert { background: var(--sc-warn-bg); border-color: var(--sc-warn); color: #fdba74; }
  .oc-alert-info { background: rgba(59,130,246,.08); border-color: var(--sc-info); color: #93c5fd; }
  .oc-alert-title { font-weight: 600; letter-spacing: .3px; }

  /* ── Flows ── */
  .flow-list { display: flex; flex-direction: column; gap: var(--sc-sp-1); }
  .flow-empty { font-family: var(--sc-font-mono); font-size: var(--sc-fs-2xs); color: var(--sc-text-3); text-align: center; padding: var(--sc-sp-4) 0; letter-spacing: .5px; }
  .flow-section-lbl { font-family: var(--sc-font-mono); font-size: var(--sc-fs-xs); font-weight: 700; letter-spacing: 1.5px; color: var(--sc-good); padding: var(--sc-sp-1) 0; border-bottom: 1px solid var(--sc-line-soft); }
  .flow-row {
    display: flex; align-items: center; gap: var(--sc-sp-1_5);
    padding: var(--sc-sp-1) var(--sc-sp-2);
    background: var(--sc-accent-bg-subtle);
    border: 1px solid var(--sc-line-soft);
    border-radius: var(--sc-radius-sm);
  }
  .flow-dir { width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; font-size: var(--sc-fs-xs); font-weight: 700; flex-shrink: 0; }
  .flow-dir.sell { color: var(--sc-bad); }
  .flow-dir.buy { color: var(--sc-good); }
  .flow-info { flex: 1; min-width: 0; }
  .flow-lbl { font-family: var(--sc-font-mono); font-size: var(--sc-fs-sm); color: var(--sc-text-1); }
  .flow-addr { font-family: var(--sc-font-mono); font-size: var(--sc-fs-2xs); color: var(--sc-text-2); }
  .flow-src { font-family: var(--sc-font-mono); font-size: var(--sc-fs-2xs); color: var(--sc-text-3); letter-spacing: .6px; margin-top: 1px; }
  .flow-amt { font-family: var(--sc-font-mono); font-size: var(--sc-fs-xs); font-weight: 700; flex-shrink: 0; }
  .flow-amt.sell { color: var(--sc-bad); }
  .flow-amt.buy { color: var(--sc-good); }

  /* ── Community Posts (terminal embed) ── */
  .comm-post {
    padding: var(--sc-sp-2) 0;
    border-bottom: 1px solid var(--sc-line-soft);
  }
  .comm-head { display: flex; align-items: center; gap: var(--sc-sp-1); margin-bottom: var(--sc-sp-1); }
  .comm-avatar {
    width: 20px; height: 20px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: var(--sc-fs-2xs); font-weight: 700;
    border: 1px solid var(--sc-line-soft);
  }
  .comm-name { font-family: var(--sc-font-mono); font-size: var(--sc-fs-sm); font-weight: 700; color: var(--sc-text-0); }
  .comm-time { font-family: var(--sc-font-mono); font-size: var(--sc-fs-2xs); color: var(--sc-text-3); margin-left: auto; }
  .comm-txt { font-family: var(--sc-font-mono); font-size: var(--sc-fs-sm); line-height: var(--sc-lh-normal); color: var(--sc-text-1); }
  .comm-sig {
    display: inline-block;
    font-family: var(--sc-font-mono); font-size: var(--sc-fs-2xs); font-weight: 700;
    padding: 2px 7px; border: 1px solid; margin-top: 3px;
    border-radius: var(--sc-radius-sm);
  }
  .comm-sig.long { color: var(--sc-good); border-color: rgba(0, 204, 136, 0.3); background: var(--sc-good-bg); }
  .comm-sig.short { color: var(--sc-bad); border-color: rgba(255, 94, 122, 0.3); background: var(--sc-bad-bg); }
  .user-post { border-left: 2px solid var(--sc-accent); }

  .comm-actions { display: flex; align-items: center; gap: var(--sc-sp-1); margin-top: var(--sc-sp-1); }
  .comm-react {
    font-size: var(--sc-fs-sm);
    background: var(--sc-surface);
    border: 1px solid var(--sc-line-soft);
    border-radius: var(--sc-radius-sm);
    padding: 2px var(--sc-sp-1_5);
    cursor: pointer;
    transition: all var(--sc-duration-fast) var(--sc-ease);
    font-family: var(--sc-font-mono);
    color: var(--sc-text-2);
  }
  .comm-react:hover { background: var(--sc-surface-2); border-color: var(--sc-line); }
  .comm-react.reacted { background: rgba(59,130,246,.12); border-color: rgba(59,130,246,.35); color: #93c5fd; }
  .comm-meta { font-family: var(--sc-font-mono); font-size: var(--sc-fs-xs); color: var(--sc-text-3); }

  .comm-signal-card {
    margin: var(--sc-sp-1) 0;
    padding: var(--sc-sp-1) var(--sc-sp-2);
    border-radius: var(--sc-radius-md);
    background: var(--sc-surface);
    border: 1px solid var(--sc-line-soft);
  }
  .comm-sig-top { display: flex; align-items: center; gap: var(--sc-sp-1); flex-wrap: wrap; margin-bottom: 3px; }
  .comm-sig-pair { font-family: var(--sc-font-display); font-size: var(--sc-fs-sm); font-weight: 900; color: var(--sc-text-0); }
  .comm-sig-dir {
    font-family: var(--sc-font-mono); font-size: var(--sc-fs-2xs); font-weight: 900;
    letter-spacing: .5px; padding: 1px 5px; border: 1px solid; border-radius: var(--sc-radius-sm);
  }
  .comm-sig-dir.long { color: var(--sc-good); border-color: rgba(0, 204, 136, 0.3); background: var(--sc-good-bg); }
  .comm-sig-dir.short { color: var(--sc-bad); border-color: rgba(255, 94, 122, 0.3); background: var(--sc-bad-bg); }
  .comm-sig-conf { font-family: var(--sc-font-mono); font-size: var(--sc-fs-2xs); font-weight: 700; color: var(--sc-warn); }
  .comm-sig-rr { font-family: var(--sc-font-mono); font-size: var(--sc-fs-2xs); color: var(--sc-text-3); }
  .comm-sig-tf {
    font-family: var(--sc-font-mono); font-size: var(--sc-fs-2xs); font-weight: 800;
    padding: 1px 5px; border-radius: var(--sc-radius-pill);
    background: var(--sc-accent-bg); color: var(--sc-accent);
  }
  .comm-sig-levels { display: flex; gap: var(--sc-sp-2); }
  .comm-sig-lv { font-family: var(--sc-font-display); font-size: var(--sc-fs-xs); font-weight: 700; color: var(--sc-text-0); }
  .comm-sig-lv.tp { color: var(--sc-good); }
  .comm-sig-lv.sl { color: var(--sc-bad); }

  @supports (animation-timeline: view()) {
    .ev-card, .comm-post, .flow-row {
      animation: intelReveal 1ms both; animation-timeline: view(); animation-range: entry 0% cover 24%;
    }
  }
  @keyframes intelReveal {
    from { opacity: 0.4; transform: translateY(10px) scale(0.985); filter: saturate(0.88); }
    to { opacity: 1; transform: translateY(0) scale(1); filter: saturate(1); }
  }
</style>
