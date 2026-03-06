<script lang="ts">
  import type { OnchainData } from '../intelTypes';
  import { MVRV_ZONE_LABELS } from '../intelTypes';
  import { formatRelativeTime, fmtUsd } from '../intelHelpers';
  import { communityPosts, likeCommunityPost } from '$lib/stores/communityStore';

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
        <span class="comm-time">now</span>
      </div>
      <div class="comm-txt">{post.text}</div>
      <div class="comm-actions">
        {#if post.signal}
          <span class="comm-sig {post.signal}">{post.signal.toUpperCase()}</span>
        {/if}
        <button class="comm-react" onclick={() => likeCommunityPost(post.id)}>👍</button>
        <button class="comm-react" onclick={() => likeCommunityPost(post.id)}>🔥</button>
      </div>
    </div>
  {/each}
  {#if $communityPosts.length === 0 && feedFilter === 'community'}
    <div class="flow-empty">No community posts yet.</div>
  {/if}
{/if}

<style>
  .ev-list { display: flex; flex-direction: column; gap: 5px; }
  .ev-card { border-left: 2px solid; padding: 6px 8px; background: rgba(255,255,255,.03); }
  .ev-head { display: flex; align-items: center; gap: 4px; margin-bottom: 2px; }
  .ev-tag { font-family: var(--fm); font-size: 9px; font-weight: 700; padding: 2px 5px; }
  .ev-etime { font-family: var(--fm); font-size: 9px; color: rgba(255,255,255,.6); }
  .ev-body { font-family: var(--fm); font-size: 11px; line-height: 1.45; color: rgba(255,255,255,.8); }
  .ev-src { font-family: var(--fm); font-size: 9px; color: rgba(255,255,255,.3); display: block; margin-top: 3px; }

  .oc-dashboard { margin-bottom: 8px; }
  .oc-header { font-family: var(--fm); font-size: 10px; font-weight: 700; letter-spacing: 1.5px; color: #a78bfa; padding: 4px 0 6px; border-bottom: 1px solid rgba(255,255,255,.1); }
  .oc-loading { font-family: var(--fm); font-size: 9px; color: rgba(255,255,255,.4); text-align: center; padding: 12px 0; }
  .oc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-top: 6px; }
  .oc-card { background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.08); padding: 7px 8px; display: flex; flex-direction: column; gap: 2px; }
  .oc-card-lbl { font-family: var(--fm); font-size: 8px; font-weight: 700; letter-spacing: 1px; color: rgba(255,255,255,.5); }
  .oc-card-val { font-family: var(--fm); font-size: 15px; font-weight: 800; line-height: 1.1; }
  .oc-mini-gauge { height: 4px; border-radius: 999px; background: rgba(255,255,255,.08); overflow: hidden; margin-top: 1px; }
  .oc-mini-gauge > span { display: block; height: 100%; border-radius: 999px; transition: width .2s ease; }
  .oc-card-tag { font-family: var(--fm); font-size: 8px; font-weight: 600; padding: 1px 5px; border-radius: 2px; display: inline-block; width: fit-content; letter-spacing: .3px; }
  .oc-card-sub { font-family: var(--fm); font-size: 8px; color: rgba(255,255,255,.55); letter-spacing: .3px; }

  .oc-liq { margin-top: 6px; }
  .oc-liq-header { display: flex; justify-content: space-between; align-items: center; font-family: var(--fm); font-size: 9px; font-weight: 700; color: rgba(255,255,255,.7); letter-spacing: .5px; margin-bottom: 3px; }
  .oc-liq-total { color: rgba(255,255,255,.5); }
  .oc-liq-bar { display: flex; height: 16px; border-radius: 2px; overflow: hidden; }
  .oc-liq-long { background: #ef444480; display: flex; align-items: center; justify-content: center; min-width: 20px; transition: width .3s; }
  .oc-liq-short { background: #22c55e80; display: flex; align-items: center; justify-content: center; min-width: 20px; transition: width .3s; }
  .oc-liq-long span, .oc-liq-short span { font-family: var(--fm); font-size: 8px; font-weight: 700; color: #fff; letter-spacing: .3px; }

  .oc-alerts { display: flex; flex-direction: column; gap: 3px; margin-top: 6px; }
  .oc-alert { font-family: var(--fm); font-size: 9px; padding: 4px 7px; border-radius: 2px; border-left: 2px solid; }
  .oc-alert-critical { background: rgba(239,68,68,.12); border-color: #ef4444; color: #fca5a5; }
  .oc-alert-alert { background: rgba(249,115,22,.1); border-color: #f97316; color: #fdba74; }
  .oc-alert-info { background: rgba(59,130,246,.08); border-color: #3b82f6; color: #93c5fd; }
  .oc-alert-title { font-weight: 600; letter-spacing: .3px; }

  .flow-list { display: flex; flex-direction: column; gap: 4px; }
  .flow-empty { font-family: var(--fm); font-size: 9px; color: rgba(255,255,255,.4); text-align: center; padding: 16px 0; letter-spacing: .5px; }
  .flow-section-lbl { font-family: var(--fm); font-size: 10px; font-weight: 700; letter-spacing: 1.5px; color: var(--grn); padding: 4px 0 5px; border-bottom: 1px solid rgba(255,255,255,.1); }
  .flow-row { display: flex; align-items: center; gap: 6px; padding: 5px 7px; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.08); }
  .flow-dir { width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; flex-shrink: 0; }
  .flow-dir.sell { color: var(--red); } .flow-dir.buy { color: var(--grn); }
  .flow-info { flex: 1; min-width: 0; }
  .flow-lbl { font-family: var(--fm); font-size: 11px; color: rgba(255,255,255,.8); }
  .flow-addr { font-family: var(--fm); font-size: 9px; color: rgba(255,255,255,.6); }
  .flow-src { font-family: var(--fm); font-size: 8px; color: rgba(255,255,255,.38); letter-spacing: .6px; margin-top: 1px; }
  .flow-amt { font-family: var(--fm); font-size: 10px; font-weight: 700; flex-shrink: 0; }
  .flow-amt.sell { color: var(--red); } .flow-amt.buy { color: var(--grn); }

  .comm-post { padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,.05); }
  .comm-head { display: flex; align-items: center; gap: 5px; margin-bottom: 3px; }
  .comm-avatar { width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; border: 1px solid rgba(255,255,255,.2); }
  .comm-name { font-family: var(--fm); font-size: 11px; font-weight: 700; color: #fff; }
  .comm-time { font-family: var(--fm); font-size: 9px; color: rgba(255,255,255,.3); margin-left: auto; }
  .comm-txt { font-family: var(--fm); font-size: 11px; line-height: 1.45; color: rgba(255,255,255,.8); }
  .comm-sig { display: inline-block; font-family: var(--fm); font-size: 9px; font-weight: 700; padding: 2px 7px; border: 1px solid; margin-top: 3px; }
  .comm-sig.long { color: var(--grn); border-color: rgba(0,255,136,.3); }
  .comm-sig.short { color: var(--red); border-color: rgba(255,45,85,.3); }
  .user-post { border-left: 2px solid var(--yel); }
  .comm-actions { display: flex; align-items: center; gap: 4px; margin-top: 3px; }
  .comm-react {
    font-size: 11px; background: rgba(255,255,255,.08);
    border: 1px solid rgba(255,255,255,.14); border-radius: 4px;
    padding: 2px 6px; cursor: pointer; transition: all .12s;
  }
  .comm-react:hover { background: rgba(var(--t-accent-rgb),.1); border-color: rgba(var(--t-accent-rgb),.25); }

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
