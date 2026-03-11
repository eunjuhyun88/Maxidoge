<script lang="ts">
  import { AGDEFS, CHARACTER_ART } from '$lib/data/agents';
  import type { PassportLearningPanelController, PassportLearningPanelState } from '$lib/passport/passportLearningPanelController';
  import EmptyState from '../shared/EmptyState.svelte';
  import PassportLearningPanel from './PassportLearningPanel.svelte';
  import { timeSince } from './passportHelpers';

  interface AgentProgress {
    level?: number;
    xp?: number;
  }

  interface AgentVote {
    color: string;
    name: string;
    dir: string;
  }

  interface MatchRecordItem {
    id: string;
    win: boolean;
    matchN: number;
    timestamp: number;
    lp: number;
    hypothesis?: { dir: string } | null;
    agentVotes?: AgentVote[];
  }

  interface Props {
    records: MatchRecordItem[];
    winRate: number;
    bestStreak: number;
    lp: number;
    agentStats: Record<string, AgentProgress | undefined>;
    learningPanelState: PassportLearningPanelState;
    learningPanelController: PassportLearningPanelController;
  }

  const MATCH_PREVIEW_LIMIT = 5;

  let {
    records,
    winRate,
    bestStreak,
    lp,
    agentStats,
    learningPanelState,
    learningPanelController,
  }: Props = $props();

  const matchPreview = $derived(records.slice(0, MATCH_PREVIEW_LIMIT));
  const olderMatches = $derived(records.slice(MATCH_PREVIEW_LIMIT, 20));
</script>

<div class="arena-tab">
  <section class="content-panel">
    <div class="arena-stats">
      <div class="as-item"><div class="asi-val">{records.length}</div><div class="asi-label">MATCHES</div></div>
      <div class="as-item"><div class="asi-val" style="color:#00ff88">{winRate}%</div><div class="asi-label">WIN RATE</div></div>
      <div class="as-item"><div class="asi-val" style="color:#ff8c3b">🔥 {bestStreak}</div><div class="asi-label">BEST STREAK</div></div>
      <div class="as-item"><div class="asi-val" style="color:#ffd060">{lp.toLocaleString()}</div><div class="asi-label">LP EARNED</div></div>
    </div>
  </section>

  <PassportLearningPanel panelState={learningPanelState} controller={learningPanelController} />

  <section class="content-panel">
    <details class="detail-block">
      <summary>AGENT SQUAD ({AGDEFS.length})</summary>
      <div class="agent-perf-grid">
        {#each AGDEFS as ag}
          {@const ags = agentStats[ag.id]}
          <div class="agent-perf-card" style="border-left-color:{ag.color}">
            <div class="apc-head">
              {#if ag.img?.def}
                <img src={ag.img.def} alt={ag.name} class="apc-img" loading="lazy" />
              {:else}
                <span class="apc-icon">{ag.icon}</span>
              {/if}
              <div>
                <div class="apc-name" style="color:{ag.color}">{ag.name}</div>
                <div class="apc-role">{ag.role}</div>
              </div>
              <div class="apc-level">Lv.{ags?.level || 1}</div>
            </div>
            <div class="apc-bar-wrap">
              <div class="apc-bar" style="width:{Math.min((ags?.xp || 0) / (((ags?.level || 1) + 1) * 100) * 100, 100)}%;background:{ag.color}"></div>
            </div>
            <div class="apc-xp">XP: {ags?.xp || 0} / {((ags?.level || 1) + 1) * 100}</div>
          </div>
        {/each}
      </div>
    </details>
  </section>

  <section class="content-panel list-panel">
    {#if records.length > 0}
      <details class="detail-block">
        <summary>MATCH HISTORY ({Math.min(records.length, 20)})</summary>
        {#each matchPreview as match (match.id)}
          <div class="match-row" class:win={match.win} class:loss={!match.win}>
            <div class="mr-left">
              <span class="mr-result" class:win={match.win}>{match.win ? 'WIN' : 'LOSS'}</span>
              <span class="mr-num">#{match.matchN}</span>
              <span class="mr-time">{timeSince(match.timestamp)}</span>
            </div>
            <div class="mr-right">
              <span class="mr-lp" class:plus={match.lp >= 0} class:minus={match.lp < 0}>{match.lp >= 0 ? '+' : ''}{match.lp} LP</span>
              {#if match.hypothesis}
                <span class="mr-hyp" class:long={match.hypothesis.dir === 'LONG'} class:short={match.hypothesis.dir === 'SHORT'}>{match.hypothesis.dir}</span>
              {/if}
              <span class="mr-agents">
                {#each (match.agentVotes || []).slice(0, 3) as vote}
                  <span class="mr-agent-dot" style="background:{vote.color}" title="{vote.name}: {vote.dir}"></span>
                {/each}
              </span>
            </div>
          </div>
        {/each}
        {#if records.length > MATCH_PREVIEW_LIMIT}
          <details class="detail-block nested-detail">
            <summary>OLDER MATCHES ({Math.min(records.length - MATCH_PREVIEW_LIMIT, 12)})</summary>
            {#each olderMatches as match (match.id)}
              <div class="match-row" class:win={match.win} class:loss={!match.win}>
                <div class="mr-left">
                  <span class="mr-result" class:win={match.win}>{match.win ? 'WIN' : 'LOSS'}</span>
                  <span class="mr-num">#{match.matchN}</span>
                  <span class="mr-time">{timeSince(match.timestamp)}</span>
                </div>
                <div class="mr-right">
                  <span class="mr-lp" class:plus={match.lp >= 0} class:minus={match.lp < 0}>{match.lp >= 0 ? '+' : ''}{match.lp} LP</span>
                  {#if match.hypothesis}
                    <span class="mr-hyp" class:long={match.hypothesis.dir === 'LONG'} class:short={match.hypothesis.dir === 'SHORT'}>{match.hypothesis.dir}</span>
                  {/if}
                  <span class="mr-agents">
                    {#each (match.agentVotes || []).slice(0, 3) as vote}
                      <span class="mr-agent-dot" style="background:{vote.color}" title="{vote.name}: {vote.dir}"></span>
                    {/each}
                  </span>
                </div>
              </div>
            {/each}
          </details>
        {/if}
      </details>
    {:else}
      <EmptyState image={CHARACTER_ART.actionVictory} title="NO ARENA MATCHES YET" subtitle="Challenge the AI agents!" ctaText="GO TO ARENA →" ctaHref="/arena" icon="⚔️" variant="pink" compact />
    {/if}
  </section>
</div>

<style>
  @import './passportTabShared.css';

  .arena-tab {
    display: flex;
    flex-direction: column;
    gap: var(--sp-space-2);
  }

  .arena-stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--sp-space-3);
  }

  .as-item {
    border: 1px solid var(--sp-soft);
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.02);
    padding: var(--sp-space-3) var(--sp-space-2);
    text-align: center;
  }

  .asi-val {
    color: var(--sp-w);
    font-family: var(--fd);
    font-size: 18px;
    font-weight: 800;
    line-height: 1.1;
  }

  .asi-label {
    margin-top: 4px;
    color: var(--sp-dim);
    font-family: var(--fp);
    font-size: 9px;
    letter-spacing: 0.08px;
  }

  .agent-perf-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    padding: 8px;
  }

  .agent-perf-card {
    border: 1px solid var(--sp-soft);
    border-left-width: 3px;
    border-radius: 8px;
    padding: 9px;
    background: rgba(0, 0, 0, 0.2);
  }

  .apc-head {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-bottom: 6px;
  }

  .apc-img {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    object-fit: cover;
  }

  .apc-icon {
    font-size: 16px;
  }

  .apc-name {
    font-family: var(--fm);
    font-size: 11px;
    font-weight: 700;
  }

  .apc-role {
    color: var(--sp-dim);
    font-family: var(--fm);
    font-size: 9px;
  }

  .apc-level {
    margin-left: auto;
    border-radius: 7px;
    padding: 2px 6px;
    color: var(--sp-pk-l);
    border: 1px solid var(--sp-soft);
    font-family: var(--fp);
    font-size: 9px;
  }

  .apc-bar-wrap {
    height: 5px;
    border-radius: 999px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.08);
    margin-bottom: 4px;
  }

  .apc-bar {
    height: 100%;
    border-radius: 999px;
  }

  .apc-xp {
    color: var(--sp-dim);
    font-family: var(--fm);
    font-size: 9px;
  }

  .match-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-space-2);
    padding: var(--sp-space-2) var(--sp-space-2);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 7px;
  }

  .match-row:hover {
    background: rgba(255, 255, 255, 0.03);
  }

  .match-row.win {
    border-left: 2px solid var(--sp-green);
  }

  .match-row.loss {
    border-left: 2px solid var(--sp-red);
  }

  .mr-left {
    display: flex;
    align-items: center;
    gap: var(--sp-space-2);
    min-width: 0;
  }

  .mr-right {
    display: flex;
    align-items: center;
    gap: var(--sp-space-2);
    flex-shrink: 0;
  }

  .mr-result {
    font-family: var(--fp);
    font-size: 9px;
    letter-spacing: 0.08px;
    border-radius: 6px;
    padding: 4px 8px;
    border: none;
    flex-shrink: 0;
  }

  .mr-result.win {
    color: var(--sp-green);
    background: rgba(157, 205, 185, 0.1);
  }

  .mr-result:not(.win) {
    color: var(--sp-red);
    background: rgba(255, 114, 93, 0.12);
  }

  .mr-num {
    color: var(--sp-w);
    font-family: var(--fm);
    font-size: 10px;
  }

  .mr-time {
    color: var(--sp-dim);
    font-family: var(--fm);
    font-size: 11px;
  }

  .mr-lp {
    font-family: var(--fd);
    font-size: 12px;
    min-width: 56px;
    text-align: right;
  }

  .mr-lp.plus {
    color: var(--sp-green);
  }

  .mr-lp.minus {
    color: var(--sp-red);
  }

  .mr-hyp {
    font-family: var(--fp);
    font-size: 9px;
    letter-spacing: 0.08px;
    padding: 3px 8px;
    border-radius: 6px;
    border: 1px solid;
  }

  .mr-hyp.long {
    color: var(--sp-green);
    border-color: rgba(157, 205, 185, 0.36);
  }

  .mr-hyp.short {
    color: var(--sp-red);
    border-color: rgba(255, 114, 93, 0.36);
  }

  .mr-agents {
    display: flex;
    gap: 4px;
  }

  .mr-agent-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
  }

  @media (max-width: 1024px) {
    .arena-stats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 768px) {
    .agent-perf-grid {
      grid-template-columns: 1fr;
    }

    .match-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }

    .mr-right {
      width: 100%;
      justify-content: space-between;
    }

    .asi-val {
      font-size: 15px;
    }
  }

  @media (max-width: 480px) {
    .arena-stats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--sp-space-1);
    }

    .as-item {
      padding: var(--sp-space-2) var(--sp-space-1);
    }

    .asi-val {
      font-size: 14px;
    }

    .asi-label {
      font-size: var(--sc-fs-2xs, 9px);
    }

    .agent-perf-card {
      padding: 7px;
    }

    .apc-img {
      width: 24px;
      height: 24px;
      border-radius: 6px;
    }

    .mr-lp {
      font-size: 11px;
      min-width: 48px;
    }
  }
</style>
