<script lang="ts">
  import { pnlColor, pnlPrefix } from './passportHelpers';

  interface PassportStats {
    winRate: number;
    totalPnL: number;
    totalMatches: number;
    bestStreak: number;
    directionAccuracy: number;
    avgConfidence: number;
    trackedSignals: number;
    agentWins: number;
    streak: number;
  }

  interface ProfileBadge {
    icon?: string;
    name: string;
    description?: string;
    earnedAt?: number | string | null;
  }

  interface Props {
    stats: PassportStats;
    wins: number;
    losses: number;
    earnedBadges: ProfileBadge[];
    lockedBadges: ProfileBadge[];
  }

  let {
    stats,
    wins,
    losses,
    earnedBadges,
    lockedBadges,
  }: Props = $props();
</script>

<div class="profile-tab">
  <section class="content-panel">
    <div class="section-header">PERFORMANCE SNAPSHOT</div>
    <div class="metrics-grid metrics-primary">
      <div class="metric-card"><div class="mc-icon">🎯</div><div class="mc-value" class:up={stats.winRate >= 50}>{stats.winRate}%</div><div class="mc-label">WIN RATE</div></div>
      <div class="metric-card"><div class="mc-icon">💰</div><div class="mc-value" style="color:{pnlColor(stats.totalPnL)}">{pnlPrefix(stats.totalPnL)}{stats.totalPnL.toFixed(1)}%</div><div class="mc-label">TOTAL PnL</div></div>
      <div class="metric-card"><div class="mc-icon">⚔️</div><div class="mc-value">{stats.totalMatches}</div><div class="mc-label">MATCHES</div></div>
      <div class="metric-card"><div class="mc-icon">🔥</div><div class="mc-value fire">{stats.bestStreak}</div><div class="mc-label">BEST STREAK</div></div>
    </div>

    <details class="detail-block">
      <summary>MORE PERFORMANCE METRICS</summary>
      <div class="metrics-grid metrics-detail">
        <div class="metric-card"><div class="mc-icon">🧭</div><div class="mc-value">{stats.directionAccuracy}%</div><div class="mc-label">DIRECTION ACC</div></div>
        <div class="metric-card"><div class="mc-icon">💡</div><div class="mc-value">{stats.avgConfidence}%</div><div class="mc-label">AVG CONFIDENCE</div></div>
        <div class="metric-card"><div class="mc-icon">📌</div><div class="mc-value">{stats.trackedSignals}</div><div class="mc-label">TRACKED</div></div>
        <div class="metric-card"><div class="mc-icon">🤖</div><div class="mc-value">{stats.agentWins}</div><div class="mc-label">AGENT WINS</div></div>
      </div>
    </details>

    <div class="summary-line">
      {stats.totalMatches > 0
        ? `${wins}W-${losses}L | ${pnlPrefix(stats.totalPnL)}${stats.totalPnL.toFixed(1)}% PnL | 🔥 ${stats.streak}-streak`
        : 'No matches yet — Start an Arena battle!'}
    </div>
  </section>

  <section class="content-panel">
    <details class="detail-block">
      <summary>BADGES ({earnedBadges.length}/{earnedBadges.length + lockedBadges.length})</summary>
      <div class="badges-grid">
        {#each earnedBadges as badge}
          <div class="badge-card earned">
            <span class="badge-icon">{badge.icon}</span>
            <span class="badge-name">{badge.name}</span>
            <span class="badge-date">{badge.earnedAt ? new Date(badge.earnedAt).toLocaleDateString() : ''}</span>
          </div>
        {/each}
        {#each lockedBadges as badge}
          <div class="badge-card locked">
            <span class="badge-icon">🔒</span>
            <span class="badge-name">{badge.name}</span>
            <span class="badge-desc">{badge.description}</span>
          </div>
        {/each}
      </div>
    </details>
  </section>
</div>

<style>
  @import './passportTabShared.css';

  .profile-tab {
    display: flex;
    flex-direction: column;
    gap: var(--sp-space-2);
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--sp-space-3);
  }

  .metric-card {
    border: 1px solid var(--sp-soft);
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.02);
    padding: var(--sp-space-3) var(--sp-space-2);
    text-align: center;
  }

  .metrics-detail {
    margin-top: 8px;
  }

  .mc-icon {
    font-size: 16px;
    margin-bottom: 6px;
  }

  .mc-value {
    color: var(--sp-w);
    font-family: var(--fd);
    font-size: 18px;
    font-weight: 800;
    line-height: 1.1;
  }

  .mc-value.up {
    color: var(--sp-green);
  }

  .mc-value.fire {
    color: var(--sp-gold);
  }

  .mc-label {
    margin-top: 4px;
    color: var(--sp-dim);
    font-family: var(--fp);
    font-size: 9px;
    letter-spacing: 0.08px;
  }

  .summary-line {
    margin-top: var(--sp-space-3);
    padding: var(--sp-space-2) var(--sp-space-3);
    border-radius: 8px;
    border: 1px dashed var(--sp-soft);
    color: var(--sp-w);
    text-align: center;
    font-family: var(--fm);
    font-size: 12px;
  }

  .badges-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
    padding: 8px;
  }

  .badge-card {
    border: 1px solid var(--sp-soft);
    border-radius: 8px;
    text-align: center;
    padding: 9px 6px;
    background: rgba(0, 0, 0, 0.2);
  }

  .badge-card.earned {
    background: rgba(157, 205, 185, 0.09);
    border-color: rgba(157, 205, 185, 0.26);
  }

  .badge-card.locked {
    opacity: 0.62;
  }

  .badge-icon {
    display: block;
    font-size: 16px;
    margin-bottom: 3px;
  }

  .badge-name {
    display: block;
    color: var(--sp-w);
    font-family: var(--fm);
    font-size: 10px;
  }

  .badge-date,
  .badge-desc {
    display: block;
    margin-top: 3px;
    color: var(--sp-dim);
    font-family: var(--fm);
    font-size: 9px;
  }

  @media (max-width: 1024px) {
    .metrics-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 768px) {
    .badges-grid {
      grid-template-columns: 1fr;
    }

    .mc-value {
      font-size: 15px;
    }
  }

  @media (max-width: 480px) {
    .metrics-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--sp-space-1);
    }

    .metric-card {
      padding: var(--sp-space-2) var(--sp-space-1);
    }

    .mc-value {
      font-size: 14px;
    }

    .mc-icon {
      font-size: 13px;
      margin-bottom: 4px;
    }

    .mc-label {
      font-size: var(--sc-fs-2xs, 9px);
    }

    .badges-grid {
      gap: 4px;
      padding: 4px;
    }

    .badge-card {
      padding: 6px 4px;
    }

    .badge-icon {
      font-size: 14px;
    }

    .badge-name {
      font-size: 9px;
    }

    .summary-line {
      font-size: 11px;
      padding: var(--sp-space-1) var(--sp-space-2);
    }
  }
</style>
