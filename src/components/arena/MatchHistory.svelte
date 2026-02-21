<script lang="ts">
  import { gameState } from '$lib/stores/gameState';
  import { matchRecords, winRate, avgLP, bestStreak } from '$lib/stores/matchHistoryStore';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  export let visible = false;

  let state = $gameState;
  $: state = $gameState;

  $: records = $matchRecords;
  $: wr = $winRate;
  $: alp = $avgLP;
  $: bs = $bestStreak;

  // Expanded row tracking
  let expandedId: string | null = null;

  function toggleExpand(id: string) {
    expandedId = expandedId === id ? null : id;
  }

  function timeAgo(ts: number): string {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }
</script>

{#if visible}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="mh-overlay" on:click={() => dispatch('close')}>
    <div class="mh-panel" on:click|stopPropagation>
      <div class="mh-header">
        <span class="mh-title">MATCH HISTORY</span>
        <span class="mh-stats">{state.wins}W - {state.losses}L</span>
        <button class="mh-close" on:click={() => dispatch('close')}>✕</button>
      </div>

      <!-- Summary Stats -->
      <div class="mh-summary">
        <div class="sum-stat">
          <span class="sum-val" style="color:{wr >= 50 ? '#00cc66' : '#ff2d55'}">{wr}%</span>
          <span class="sum-label">WIN RATE</span>
        </div>
        <div class="sum-stat">
          <span class="sum-val" style="color:{alp >= 0 ? '#00cc66' : '#ff2d55'}">{alp >= 0 ? '+' : ''}{alp}</span>
          <span class="sum-label">AVG LP</span>
        </div>
        <div class="sum-stat">
          <span class="sum-val" style="color:#ffe600">{bs}</span>
          <span class="sum-label">BEST STREAK</span>
        </div>
      </div>

      <div class="mh-list">
        {#if records.length === 0}
          <div class="mh-empty">No matches yet. Start your first battle!</div>
        {:else}
          {#each records as match (match.id)}
            <button class="mh-row" class:win={match.win} class:loss={!match.win} on:click={() => toggleExpand(match.id)}>
              <span class="mh-id">M{match.matchN}</span>
              <span class="mh-result-badge" class:w={match.win} class:l={!match.win}>{match.win ? 'WIN' : 'LOSE'}</span>
              <span class="mh-lp" class:pos={match.lp > 0} class:neg={match.lp < 0}>
                {match.lp > 0 ? '+' : ''}{match.lp} LP
              </span>
              {#if match.streak >= 3}<span class="mh-streak">🔥{match.streak}</span>{/if}
              <span class="mh-time">{timeAgo(match.timestamp)}</span>
              <span class="mh-arrow">{expandedId === match.id ? '▲' : '▼'}</span>
            </button>

            <!-- Expanded Details -->
            {#if expandedId === match.id}
              <div class="mh-detail">
                <!-- Hypothesis -->
                {#if match.hypothesis}
                  <div class="mhd-section">
                    <span class="mhd-label">YOUR CALL</span>
                    <div class="mhd-hypo">
                      <span class="mhd-dir {match.hypothesis.dir.toLowerCase()}">{match.hypothesis.dir}</span>
                      <span class="mhd-levels">
                        Entry ${Math.round(match.hypothesis.entry).toLocaleString()} ·
                        TP ${Math.round(match.hypothesis.tp).toLocaleString()} ·
                        SL ${Math.round(match.hypothesis.sl).toLocaleString()}
                      </span>
                      <span class="mhd-rr">R:R 1:{match.hypothesis.rr.toFixed(1)}</span>
                    </div>
                  </div>
                {/if}

                <!-- Agent Votes -->
                <div class="mhd-section">
                  <span class="mhd-label">AGENT COUNCIL</span>
                  <div class="mhd-votes">
                    {#each match.agentVotes as vote}
                      <div class="mhd-vote">
                        <span class="mhd-vote-icon" style="color:{vote.color}">{vote.icon}</span>
                        <span class="mhd-vote-name">{vote.name}</span>
                        <span class="mhd-vote-dir {vote.dir.toLowerCase()}">{vote.dir}</span>
                        <span class="mhd-vote-conf">{vote.conf}%</span>
                      </div>
                    {/each}
                  </div>
                </div>

                <!-- Consensus -->
                {#if match.consensusType}
                  <div class="mhd-consensus">
                    <span class="mhd-cons-badge {match.consensusType}">{match.consensusType.toUpperCase()}</span>
                    <span class="mhd-cons-mult">x{match.lpMult}</span>
                  </div>
                {/if}

                <!-- Result tag -->
                {#if match.battleResult}
                  <div class="mhd-result-tag">{match.battleResult.toUpperCase()}</div>
                {/if}
              </div>
            {/if}
          {/each}
        {/if}
      </div>

      <div class="mh-footer">
        <span>Total LP: <b>{state.lp.toLocaleString()}</b></span>
        <span>🔥 Streak: <b>{state.streak}</b></span>
        <span>Matches: <b>{records.length}</b></span>
      </div>
    </div>
  </div>
{/if}

<style>
  .mh-overlay {
    position: absolute;
    inset: 0;
    z-index: 60;
    background: rgba(0,0,0,.5);
    display: flex;
    justify-content: flex-end;
  }

  .mh-panel {
    width: 340px;
    height: 100%;
    background: #0a0a1a;
    border-left: 4px solid #ffe600;
    display: flex;
    flex-direction: column;
    animation: mhSlideIn .25s ease;
  }
  @keyframes mhSlideIn {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }

  .mh-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    background: linear-gradient(90deg, #ffe600, #ffcc00);
    border-bottom: 3px solid #000;
    color: #000;
    flex-shrink: 0;
  }
  .mh-title {
    font-family: var(--fd);
    font-size: 14px;
    font-weight: 900;
    letter-spacing: 2px;
  }
  .mh-stats {
    font-family: var(--fm);
    font-size: 9px;
    font-weight: 700;
    margin-left: auto;
  }
  .mh-close {
    width: 22px; height: 22px;
    border: 2px solid #000;
    border-radius: 6px;
    background: #fff;
    cursor: pointer;
    font-size: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .mh-close:hover { background: #ff2d55; color: #fff; }

  /* Summary Stats */
  .mh-summary {
    display: flex;
    padding: 10px 14px;
    gap: 8px;
    border-bottom: 2px solid rgba(255,230,0,.1);
    flex-shrink: 0;
  }
  .sum-stat {
    flex: 1;
    text-align: center;
    padding: 6px 4px;
    background: rgba(255,255,255,.03);
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,.06);
  }
  .sum-val {
    font-family: var(--fd);
    font-size: 14px;
    font-weight: 900;
    display: block;
  }
  .sum-label {
    font-family: var(--fm);
    font-size: 6px;
    font-weight: 700;
    letter-spacing: 1.5px;
    color: #666;
    display: block;
    margin-top: 2px;
  }

  .mh-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }
  .mh-list::-webkit-scrollbar { width: 3px; }
  .mh-list::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }

  .mh-empty {
    text-align: center;
    padding: 30px;
    color: #555;
    font-family: var(--fm);
    font-size: 10px;
  }

  .mh-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border-radius: 8px;
    margin-bottom: 2px;
    font-family: var(--fm);
    font-size: 8px;
    font-weight: 600;
    transition: background .15s;
    cursor: pointer;
    width: 100%;
    background: none;
    border: none;
    color: inherit;
    text-align: left;
  }
  .mh-row:hover { background: rgba(255,255,255,.05); }
  .mh-row.win { border-left: 3px solid #00cc66; }
  .mh-row.loss { border-left: 3px solid #ff2d55; }

  .mh-id { color: #555; font-size: 7px; width: 28px; font-weight: 700; }
  .mh-result-badge {
    font-size: 6px; font-weight: 900; padding: 1px 6px;
    border-radius: 4px; letter-spacing: 1px;
  }
  .mh-result-badge.w { background: #00cc66; color: #000; }
  .mh-result-badge.l { background: #ff2d55; color: #fff; }
  .mh-lp { font-weight: 800; }
  .mh-lp.pos { color: #00cc66; }
  .mh-lp.neg { color: #ff2d55; }
  .mh-streak { font-size: 7px; }
  .mh-time { color: #555; font-size: 7px; margin-left: auto; }
  .mh-arrow { color: #555; font-size: 7px; }

  /* Expanded Detail */
  .mh-detail {
    background: rgba(255,255,255,.03);
    border: 1px solid rgba(255,255,255,.06);
    border-radius: 8px;
    padding: 8px 10px;
    margin-bottom: 4px;
    animation: detailSlide .2s ease;
  }
  @keyframes detailSlide {
    from { opacity: 0; max-height: 0; }
    to { opacity: 1; max-height: 200px; }
  }

  .mhd-section { margin-bottom: 6px; }
  .mhd-label {
    font-family: var(--fd);
    font-size: 6px;
    font-weight: 900;
    letter-spacing: 2px;
    color: #666;
    display: block;
    margin-bottom: 3px;
  }
  .mhd-hypo {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .mhd-dir {
    font-family: var(--fd);
    font-size: 9px;
    font-weight: 900;
    padding: 1px 6px;
    border-radius: 4px;
    letter-spacing: 1px;
  }
  .mhd-dir.long { background: #00ff88; color: #000; }
  .mhd-dir.short { background: #ff2d55; color: #fff; }
  .mhd-dir.neutral { background: #ffaa00; color: #000; }
  .mhd-levels {
    font-family: var(--fm);
    font-size: 7px;
    color: #888;
  }
  .mhd-rr {
    font-family: var(--fd);
    font-size: 7px;
    font-weight: 900;
    color: #ffe600;
    background: #000;
    padding: 1px 5px;
    border-radius: 4px;
  }

  .mhd-votes {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
  }
  .mhd-vote {
    display: flex;
    align-items: center;
    gap: 3px;
    background: rgba(255,255,255,.04);
    border-radius: 4px;
    padding: 2px 5px;
    font-size: 7px;
    font-family: var(--fm);
  }
  .mhd-vote-icon { font-size: 8px; }
  .mhd-vote-name { font-weight: 700; color: #aaa; }
  .mhd-vote-dir {
    font-weight: 900;
    font-size: 6px;
    padding: 0 3px;
    border-radius: 3px;
  }
  .mhd-vote-dir.long { background: rgba(0,255,136,.2); color: #00cc66; }
  .mhd-vote-dir.short { background: rgba(255,45,85,.2); color: #ff2d55; }
  .mhd-vote-conf { color: #666; font-size: 6px; }

  .mhd-consensus {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }
  .mhd-cons-badge {
    font-family: var(--fd);
    font-size: 7px;
    font-weight: 900;
    padding: 2px 8px;
    border-radius: 4px;
    letter-spacing: 1px;
  }
  .mhd-cons-badge.consensus { background: #00ff88; color: #000; }
  .mhd-cons-badge.partial { background: #ffe600; color: #000; }
  .mhd-cons-badge.dissent { background: #ff2d55; color: #fff; }
  .mhd-cons-badge.override { background: #c840ff; color: #fff; }
  .mhd-cons-mult {
    font-family: var(--fd);
    font-size: 8px;
    font-weight: 900;
    color: #ffe600;
  }

  .mhd-result-tag {
    font-family: var(--fm);
    font-size: 7px;
    font-weight: 700;
    color: #666;
    text-align: center;
    letter-spacing: 1px;
  }

  .mh-footer {
    padding: 8px 14px;
    border-top: 2px solid rgba(255,230,0,.2);
    display: flex;
    gap: 16px;
    font-family: var(--fm);
    font-size: 9px;
    color: #888;
    flex-shrink: 0;
  }
  .mh-footer b { color: #ffe600; }
</style>
