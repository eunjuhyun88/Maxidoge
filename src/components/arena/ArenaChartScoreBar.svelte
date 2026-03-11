<script lang="ts">
  import type {
    ArenaModeDisplay,
    ArenaScoreSummary,
  } from '$lib/arena/state/arenaTypes';
  import type { ArenaMode, Direction } from '$lib/stores/gameState';

  interface Props {
    score?: number;
    scoreSummary?: ArenaScoreSummary;
    streak?: number;
    wins?: number;
    losses?: number;
    lp?: number;
    arenaMode?: ArenaMode;
    arenaModeDisplay?: ArenaModeDisplay;
    hypothesisBadge?: string | null;
    hypothesisDir?: Direction | null;
    showMarkers?: boolean;
    showPosition?: boolean;
    onToggleMarkers?: () => void;
    onTogglePositionVisibility?: () => void;
    onGoLobby?: () => void;
  }

  let {
    score = 0,
    scoreSummary = { directionLabel: 'LONG', directionColor: '#00CC88', meta: '' },
    streak = 0,
    wins = 0,
    losses = 0,
    lp = 0,
    arenaMode = 'PVE',
    arenaModeDisplay = { label: 'PVE', roundBadge: null, fullLabel: 'PVE', tournamentMeta: null },
    hypothesisBadge = null,
    hypothesisDir = null,
    showMarkers = true,
    showPosition = false,
    onToggleMarkers = () => {},
    onTogglePositionVisibility = () => {},
    onGoLobby = () => {},
  }: Props = $props();
</script>

<div class="score-bar">
  <div class="sr">
    <svg viewBox="0 0 44 44">
      <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="3" />
      <circle
        cx="22"
        cy="22"
        r="18"
        fill="none"
        stroke={score >= 60 ? '#00CC88' : '#FF5E7A'}
        stroke-width="3"
        stroke-dasharray="{score * 1.13} 200"
        stroke-linecap="round"
        transform="rotate(-90 22 22)"
      />
    </svg>
    <span class="n">{score}</span>
  </div>
  <div>
    <div class="sdir" style="color:{scoreSummary.directionColor}">{scoreSummary.directionLabel}</div>
    <div class="smeta">{scoreSummary.meta}</div>
  </div>
  <div class="score-stats">
    <span class="ss-item">🔥{streak}</span>
    <span class="ss-item">{wins}W-{losses}L</span>
    <span class="ss-item lp">⚡{lp} LP</span>
  </div>
  <div class="mode-badge" class:tour={arenaMode === 'TOURNAMENT'} class:pvp={arenaMode === 'PVP'}>
    {arenaModeDisplay.fullLabel}
  </div>
  {#if hypothesisBadge && hypothesisDir}
    <div class="hypo-badge {hypothesisDir.toLowerCase()}">{hypothesisBadge}</div>
  {/if}
  <div class="chart-toggles">
    <button class="ct-btn" class:on={showMarkers} onclick={onToggleMarkers} title="에이전트 마커">🏷</button>
    <button class="ct-btn" class:on={showPosition} onclick={onTogglePositionVisibility} title="TP/SL 라인">📏</button>
  </div>
  <button class="mbtn" onclick={onGoLobby}>↺ LOBBY</button>
</div>

<style>
  .score-bar {
    padding: 6px 12px;
    border-top: 1px solid rgba(232,150,125,.15);
    background: linear-gradient(90deg, rgba(10,26,18,.95), rgba(8,19,13,.95));
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }
  .sr { position: relative; width: 40px; height: 40px; flex-shrink: 0; }
  .sr svg { width: 40px; height: 40px; }
  .sr .n {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 900;
    font-family: var(--fd);
    color: #fff;
  }
  .sdir { font-size: 13px; font-weight: 900; font-family: var(--fd); letter-spacing: 2px; text-shadow: 0 0 10px currentColor; }
  .smeta { font-size: 9px; color: #888; font-family: var(--fm); }
  .score-stats { display: flex; gap: 8px; margin-left: auto; }
  .ss-item { font-size: 9px; font-weight: 700; font-family: var(--fm); color: #aaa; }
  .ss-item.lp { color: #e8967d; }
  .mode-badge {
    padding: 3px 8px;
    border: 1.5px solid rgba(232,150,125,.55);
    background: rgba(232,150,125,.09);
    color: #e8967d;
    font-size: 9px;
    font-family: var(--fd);
    font-weight: 900;
    letter-spacing: 1px;
    border-radius: 7px;
    white-space: nowrap;
  }
  .mode-badge.pvp { border-color: rgba(102,204,230,.55); background: rgba(102,204,230,.1); color: #66cce6; }
  .mode-badge.tour { border-color: rgba(220,185,112,.65); background: rgba(220,185,112,.12); color: #dcb970; }
  .hypo-badge {
    padding: 3px 10px;
    border-radius: 8px;
    font-size: 9px;
    font-weight: 900;
    font-family: var(--fd);
    letter-spacing: 1px;
    border: 2px solid;
  }
  .hypo-badge.long { background: rgba(0,255,136,.15); border-color: #00ff88; color: #00ff88; }
  .hypo-badge.short { background: rgba(255,45,85,.15); border-color: #ff2d55; color: #ff2d55; }
  .hypo-badge.neutral { background: rgba(255,170,0,.15); border-color: #ffaa00; color: #ffaa00; }
  .chart-toggles { display: flex; gap: 3px; margin-left: 4px; }
  .ct-btn {
    width: 26px;
    height: 26px;
    border: 1px solid rgba(255,105,180,.2);
    border-radius: 6px;
    background: rgba(255,105,180,.05);
    font-size: 11px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all .15s;
    opacity: .5;
  }
  .ct-btn.on { border-color: rgba(255,105,180,.5); background: rgba(255,105,180,.15); opacity: 1; }
  .ct-btn:hover { opacity: .8; background: rgba(255,105,180,.1); }
  .mbtn {
    padding: 6px 16px;
    border-radius: 16px;
    background: #E8967D;
    border: 3px solid #000;
    color: #000;
    font-family: var(--fd);
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 2px;
    cursor: pointer;
    box-shadow: 3px 3px 0 #000;
  }
  .mbtn:hover { background: #d07a64; }

  @media (max-width: 768px) {
    .score-bar { padding: 4px 8px; gap: 6px; flex-wrap: wrap; }
    .score-stats { gap: 5px; }
    .chart-toggles { gap: 3px; }
    .ct-btn { width: 28px; height: 28px; font-size: 11px; }
    .mbtn { font-size: 8px; padding: 4px 8px; }
  }
</style>
