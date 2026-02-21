<script lang="ts">
  import { AGDEFS, CHARACTER_ART } from '$lib/data/agents';
  import { agentStats } from '$lib/stores/agentData';
  import { gameState } from '$lib/stores/gameState';
  import { matchHistoryStore } from '$lib/stores/matchHistoryStore';
  import { goto } from '$app/navigation';
  import EmptyState from '../../components/shared/EmptyState.svelte';
  import ContextBanner from '../../components/shared/ContextBanner.svelte';

  $: stats = $agentStats;
  $: state = $gameState;
  $: records = $matchHistoryStore.records;

  let sortBy = 'accuracy';
  let period: '7d' | '30d' | 'all' = 'all';
  let selectedAgent: (typeof AGDEFS[0] & { level: number; xp: number; accuracy: number; sample: number; wins: number; losses: number; recentVotes: any[] }) | null = null;

  // Filter records by period
  $: filteredRecords = (() => {
    const now = Date.now();
    if (period === '7d') return records.filter(r => now - r.timestamp < 7 * 86400000);
    if (period === '30d') return records.filter(r => now - r.timestamp < 30 * 86400000);
    return records;
  })();

  // Calculate agent accuracy from match data
  $: oracleData = AGDEFS.map(ag => {
    const s = stats[ag.id] || { level: 1, xp: 0 };
    let wins = 0;
    let total = 0;
    let recentVotes: Array<{ matchN: number; dir: string; conf: number; win: boolean; timestamp: number }> = [];

    for (const r of filteredRecords) {
      if (r.agentVotes) {
        const vote = r.agentVotes.find(v => v.agentId === ag.id);
        if (vote) {
          total++;
          const agentWon = (vote.dir === 'LONG' && r.win) || (vote.dir === 'SHORT' && !r.win);
          if (agentWon) wins++;
          recentVotes.push({
            matchN: r.matchN,
            dir: vote.dir,
            conf: vote.conf,
            win: agentWon,
            timestamp: r.timestamp,
          });
        }
      }
    }

    const accuracy = total > 0 ? Math.round((wins / total) * 100) : ag.conf;

    return {
      ...ag,
      level: s.level || 1,
      xp: s.xp || 0,
      accuracy,
      sample: total,
      wins,
      losses: total - wins,
      recentVotes: recentVotes.slice(0, 5),
    };
  }).sort((a, b) => {
    if (sortBy === 'accuracy') return b.accuracy - a.accuracy;
    if (sortBy === 'level') return b.level - a.level;
    if (sortBy === 'sample') return b.sample - a.sample;
    return b.conf - a.conf;
  });

  function selectAgent(ag: typeof oracleData[0]) {
    selectedAgent = ag;
  }

  function triggerArena() {
    goto('/arena');
  }

  function timeSince(ts: number): string {
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    return `${Math.floor(sec / 86400)}d ago`;
  }
</script>

<div class="oracle-page">
  <ContextBanner page="oracle" />
  <div class="oracle-header">
    <div class="oh-bg"></div>
    <div class="oh-content">
      <h1 class="oh-title">ORACLE</h1>
      <p class="oh-sub">Agent accuracy rankings from real match data</p>
      <div class="oh-stats">
        <span class="oh-stat">{filteredRecords.length} MATCHES</span>
        <span class="oh-stat">{oracleData.filter(a => a.accuracy >= 70).length} AGENTS 70%+</span>
      </div>
    </div>
  </div>

  <!-- Period + Sort Controls -->
  <div class="control-bar">
    <div class="control-group">
      <span class="ctrl-label">PERIOD:</span>
      {#each [['7d', '7D'], ['30d', '30D'], ['all', 'ALL']] as [key, label]}
        <button class="ctrl-btn" class:active={period === key} on:click={() => period = key}>{label}</button>
      {/each}
    </div>
    <div class="control-group">
      <span class="ctrl-label">SORT:</span>
      {#each [['accuracy', 'ACCURACY'], ['level', 'LEVEL'], ['sample', 'MATCHES'], ['conf', 'CONFIDENCE']] as [key, label]}
        <button class="ctrl-btn" class:active={sortBy === key} on:click={() => sortBy = key}>{label}</button>
      {/each}
    </div>
  </div>

  <!-- Agent Table -->
  {#if filteredRecords.length === 0 && records.length === 0}
    <EmptyState
      image={CHARACTER_ART.spriteActions}
      title="NO MATCH DATA YET"
      subtitle="Agent accuracy is calculated from Arena battles. Start your first match!"
      ctaText="⚔️ START ARENA BATTLE"
      ctaHref="/arena"
      icon="🔮"
      variant="purple"
    />
  {:else}
    <div class="oracle-table">
      <div class="ot-header">
        <span class="ot-rank">#</span>
        <span class="ot-agent">AGENT</span>
        <span class="ot-col">ACCURACY</span>
        <span class="ot-col">W/L</span>
        <span class="ot-col">LEVEL</span>
        <span class="ot-col">SPECIALTY</span>
        <span class="ot-col">CALIBRATION</span>
      </div>
      {#each oracleData as ag, i}
        <button class="ot-row" on:click={() => selectAgent(ag)}>
          <span class="ot-rank rank-{i+1}">{i+1}</span>
          <div class="ot-agent">
            {#if ag.img?.def}
              <img src={ag.img.def} alt={ag.name} class="ot-img" />
            {:else}
              <span class="ot-icon">{ag.icon}</span>
            {/if}
            <div>
              <div class="ot-name" style="color:{ag.color}">{ag.name}</div>
              <div class="ot-role">{ag.nameKR} · {ag.role}</div>
            </div>
          </div>
          <span class="ot-col ot-accuracy" style="color:{ag.accuracy >= 70 ? 'var(--grn)' : ag.accuracy >= 50 ? 'var(--yel)' : 'var(--red)'}">
            {ag.accuracy}%
            {#if ag.sample > 0}<span class="ot-sample">({ag.sample})</span>{/if}
          </span>
          <span class="ot-col ot-wl">
            <span style="color:var(--grn)">{ag.wins}</span>/<span style="color:var(--red)">{ag.losses}</span>
          </span>
          <span class="ot-col ot-level">Lv.{ag.level}</span>
          <span class="ot-col ot-spec">{ag.specialty[0]}</span>
          <div class="ot-col ot-cal-wrap">
            <div class="cal-bar"><div class="cal-fill" style="width:{ag.accuracy}%"></div></div>
            <span class="cal-num">{ag.accuracy}%</span>
          </div>
        </button>
      {/each}
    </div>
  {/if}

  <!-- Agent Detail Sidebar -->
  {#if selectedAgent}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="agent-detail-overlay" on:click={() => selectedAgent = null}>
      <div class="agent-detail" on:click|stopPropagation>
        <button class="close-btn" on:click={() => selectedAgent = null}>✕</button>
        <div class="ad-header" style="border-color:{selectedAgent.color}">
          {#if selectedAgent.img?.def}
            <img src={selectedAgent.img.def} alt={selectedAgent.name} class="ad-img" />
          {/if}
          <div class="ad-info">
            <div class="ad-name" style="color:{selectedAgent.color}">{selectedAgent.icon} {selectedAgent.name}</div>
            <div class="ad-role">{selectedAgent.nameKR} · {selectedAgent.role}</div>
            <div class="ad-accuracy" style="color:{selectedAgent.accuracy >= 70 ? 'var(--grn)' : 'var(--yel)'}">
              {selectedAgent.accuracy}% Accuracy · {selectedAgent.sample} matches
            </div>
          </div>
        </div>

        <!-- Recent Match Votes -->
        {#if selectedAgent.recentVotes.length > 0}
          <div class="ad-section">
            <div class="ab-title">RECENT VOTES ({selectedAgent.recentVotes.length})</div>
            {#each selectedAgent.recentVotes as vote}
              <div class="vote-row" class:win={vote.win} class:loss={!vote.win}>
                <span class="vr-match">#{vote.matchN}</span>
                <span class="vr-dir" class:long={vote.dir === 'LONG'} class:short={vote.dir === 'SHORT'}>{vote.dir}</span>
                <span class="vr-conf">{vote.conf}%</span>
                <span class="vr-result" class:win={vote.win}>{vote.win ? '✓ WIN' : '✗ LOSS'}</span>
                <span class="vr-time">{timeSince(vote.timestamp)}</span>
              </div>
            {/each}
          </div>
        {/if}

        <div class="ad-abilities">
          <div class="ab-title">ABILITIES</div>
          {#each Object.entries(selectedAgent.abilities) as [key, val]}
            <div class="ab-row">
              <span class="ab-label">{key.toUpperCase()}</span>
              <div class="ab-bar"><div class="ab-fill" style="width:{val}%;background:{selectedAgent.color}"></div></div>
              <span class="ab-val">{val}</span>
            </div>
          {/each}
        </div>

        <div class="ad-finding">
          <div class="ab-title">LATEST FINDING</div>
          <div class="finding-card" style="border-color:{selectedAgent.color}">
            <div class="fc-title">{selectedAgent.finding.title}</div>
            <div class="fc-detail">{selectedAgent.finding.detail}</div>
          </div>
        </div>

        <div class="ad-specialties">
          <div class="ab-title">SPECIALTIES</div>
          <div class="spec-tags">
            {#each selectedAgent.specialty as spec}
              <span class="spec-tag" style="border-color:{selectedAgent.color};color:{selectedAgent.color}">{spec}</span>
            {/each}
          </div>
        </div>

        <button class="ad-arena-btn" on:click={triggerArena}>
          DEPLOY TO ARENA
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .oracle-page {
    height: 100%;
    overflow-y: auto;
    background: linear-gradient(180deg, #1a0a2e, #0a0a1a);
  }

  .oracle-header {
    position: relative;
    padding: 20px 24px;
    border-bottom: 4px solid #000;
    background: linear-gradient(135deg, #8b5cf6, #c840ff);
    overflow: hidden;
  }
  .oracle-header::after {
    content: '';
    position: absolute;
    right: -5px; bottom: -5px;
    width: 100px; height: 100px;
    background: url('/doge/action-portal.png') center/cover no-repeat;
    opacity: .15;
    border-radius: 12px 0 0 0;
    pointer-events: none;
  }
  .oh-bg { position: absolute; inset: 0; background: radial-gradient(circle at 20% 50%, rgba(255,255,255,.15), transparent 60%); }
  .oh-content { position: relative; z-index: 2; }
  .oh-title {
    font-family: var(--fc); font-size: 28px; color: #fff;
    -webkit-text-stroke: 1px #000; text-shadow: 3px 3px 0 rgba(0,0,0,.3); letter-spacing: 3px;
  }
  .oh-sub { font-family: var(--fm); font-size: 9px; color: rgba(255,255,255,.7); letter-spacing: 2px; margin-top: 2px; }
  .oh-stats { display: flex; gap: 8px; margin-top: 6px; }
  .oh-stat {
    font-family: var(--fm); font-size: 7px; font-weight: 900; letter-spacing: 1.5px;
    background: rgba(0,0,0,.4); color: #fff; padding: 2px 8px; border-radius: 4px;
  }

  /* Controls */
  .control-bar {
    display: flex; gap: 16px; padding: 8px 16px;
    border-bottom: 2px solid rgba(255,255,255,.05);
    flex-wrap: wrap;
  }
  .control-group { display: flex; align-items: center; gap: 4px; }
  .ctrl-label { font-family: var(--fm); font-size: 7px; font-weight: 900; letter-spacing: 2px; color: rgba(255,255,255,.3); }
  .ctrl-btn {
    font-family: var(--fm); font-size: 7px; font-weight: 700; letter-spacing: 1px;
    padding: 3px 8px; border-radius: 6px;
    border: 1.5px solid rgba(255,255,255,.1); background: rgba(255,255,255,.03);
    color: rgba(255,255,255,.4); cursor: pointer; transition: all .15s;
  }
  .ctrl-btn.active { background: var(--pk); color: #fff; border-color: var(--pk); box-shadow: 0 0 8px rgba(255,45,155,.3); }

  /* Empty state handled by EmptyState component */

  /* Table */
  .oracle-table { padding: 0 16px 16px; }
  .ot-header {
    display: grid; grid-template-columns: 30px 1.5fr .8fr .6fr .6fr 1.2fr 1fr;
    gap: 6px; padding: 8px 10px;
    border-bottom: 2px solid rgba(139,92,246,.3);
    font-family: var(--fd); font-size: 7px; font-weight: 900; letter-spacing: 2px; color: rgba(255,255,255,.3);
  }
  .ot-row {
    display: grid; grid-template-columns: 30px 1.5fr .8fr .6fr .6fr 1.2fr 1fr;
    gap: 6px; align-items: center; padding: 8px 10px;
    border-bottom: 1px solid rgba(255,255,255,.04);
    cursor: pointer; transition: background .15s;
    background: none; border-left: none; border-right: none; border-top: none;
    width: 100%; text-align: left;
  }
  .ot-row:hover { background: rgba(139,92,246,.06); }
  .ot-rank { font-family: var(--fd); font-size: 14px; font-weight: 900; color: rgba(255,255,255,.3); text-align: center; }
  .rank-1 { color: #ffd060; }
  .rank-2 { color: #c0c0c0; }
  .rank-3 { color: #cd7f32; }
  .ot-agent { display: flex; align-items: center; gap: 6px; }
  .ot-img { width: 28px; height: 28px; border-radius: 8px; border: 2px solid rgba(255,255,255,.1); object-fit: cover; }
  .ot-icon { font-size: 18px; }
  .ot-name { font-family: var(--fm); font-size: 9px; font-weight: 900; letter-spacing: 1px; }
  .ot-role { font-family: var(--fm); font-size: 6px; color: rgba(255,255,255,.3); }
  .ot-col { font-family: var(--fm); font-size: 9px; color: rgba(255,255,255,.6); }
  .ot-accuracy { font-weight: 900; font-family: var(--fd); }
  .ot-sample { font-size: 7px; opacity: .5; }
  .ot-wl { font-family: var(--fd); font-size: 10px; font-weight: 900; }
  .ot-level { color: var(--pk); font-weight: 700; }
  .ot-spec { font-size: 7px; color: rgba(255,255,255,.3); }
  .ot-cal-wrap { display: flex; align-items: center; gap: 4px; }
  .cal-bar { flex: 1; height: 4px; background: rgba(255,255,255,.06); border-radius: 2px; }
  .cal-fill { height: 100%; background: var(--pur); border-radius: 2px; transition: width .5s; }
  .cal-num { font-size: 8px; font-weight: 700; color: var(--pur); min-width: 28px; }

  /* Agent Detail */
  .agent-detail-overlay {
    position: fixed; inset: 0; z-index: 200;
    background: rgba(0,0,0,.6); display: flex; justify-content: flex-end;
  }
  .agent-detail {
    width: 380px; background: #111; border-left: 4px solid #000;
    padding: 16px; overflow-y: auto;
    animation: slideInRight .3s ease; position: relative;
  }
  @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
  .close-btn {
    position: absolute; top: 10px; right: 10px;
    width: 26px; height: 26px; border-radius: 50%;
    border: 2px solid rgba(255,255,255,.2); background: rgba(255,255,255,.05);
    color: #fff; font-size: 11px; cursor: pointer;
  }
  .ad-header { display: flex; align-items: center; gap: 10px; padding-bottom: 12px; border-bottom: 3px solid; margin-bottom: 12px; }
  .ad-img { width: 50px; height: 50px; border-radius: 10px; border: 3px solid #000; object-fit: cover; box-shadow: 3px 3px 0 #000; }
  .ad-info { flex: 1; }
  .ad-name { font-family: var(--fc); font-size: 18px; letter-spacing: 2px; }
  .ad-role { font-family: var(--fm); font-size: 8px; color: rgba(255,255,255,.4); }
  .ad-accuracy { font-family: var(--fd); font-size: 10px; font-weight: 900; margin-top: 2px; }

  .ad-section { margin-bottom: 12px; }

  /* Vote rows */
  .vote-row {
    display: flex; align-items: center; gap: 6px;
    padding: 4px 6px; border-radius: 4px;
    border-bottom: 1px solid rgba(255,255,255,.04);
    font-family: var(--fm); font-size: 8px;
  }
  .vote-row.win { border-left: 2px solid var(--grn); }
  .vote-row.loss { border-left: 2px solid var(--red); }
  .vr-match { color: rgba(255,255,255,.4); font-weight: 700; }
  .vr-dir { font-weight: 900; padding: 1px 4px; border: 1px solid; border-radius: 3px; font-size: 7px; }
  .vr-dir.long { color: var(--grn); border-color: rgba(0,255,136,.3); }
  .vr-dir.short { color: var(--red); border-color: rgba(255,45,85,.3); }
  .vr-conf { color: var(--yel); font-weight: 700; }
  .vr-result { font-weight: 900; }
  .vr-result.win { color: var(--grn); }
  .vr-result:not(.win) { color: var(--red); }
  .vr-time { color: rgba(255,255,255,.2); margin-left: auto; font-size: 7px; }

  .ab-title { font-family: var(--fd); font-size: 8px; font-weight: 900; letter-spacing: 2px; color: rgba(255,255,255,.4); margin-bottom: 4px; }
  .ad-abilities { margin-bottom: 12px; }
  .ab-row { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; }
  .ab-label { font-family: var(--fm); font-size: 7px; font-weight: 700; color: rgba(255,255,255,.3); width: 55px; letter-spacing: 1px; }
  .ab-bar { flex: 1; height: 4px; background: rgba(255,255,255,.06); border-radius: 2px; }
  .ab-fill { height: 100%; border-radius: 2px; transition: width .5s; }
  .ab-val { font-family: var(--fm); font-size: 8px; font-weight: 900; color: rgba(255,255,255,.5); width: 22px; text-align: right; }

  .ad-finding { margin-bottom: 12px; }
  .finding-card { border: 2px solid; border-radius: 8px; padding: 8px; background: rgba(255,255,255,.03); }
  .fc-title { font-family: var(--fm); font-size: 9px; font-weight: 900; color: #fff; margin-bottom: 2px; }
  .fc-detail { font-family: var(--fm); font-size: 7px; color: rgba(255,255,255,.5); line-height: 1.4; }

  .ad-specialties { margin-bottom: 14px; }
  .spec-tags { display: flex; flex-wrap: wrap; gap: 4px; }
  .spec-tag { font-family: var(--fm); font-size: 7px; font-weight: 700; padding: 2px 6px; border: 1.5px solid; border-radius: 6px; background: rgba(255,255,255,.03); }

  .ad-arena-btn {
    width: 100%; padding: 10px;
    font-family: var(--fc); font-size: 14px; letter-spacing: 3px; color: #fff;
    background: linear-gradient(135deg, #ff2d9b, #ff0066);
    border: 3px solid #000; border-radius: 10px;
    box-shadow: 3px 3px 0 #000; cursor: pointer; transition: all .15s;
    -webkit-text-stroke: .5px #000;
  }
  .ad-arena-btn:hover { transform: translate(-2px, -2px); box-shadow: 5px 5px 0 #000; }
</style>
