<script lang="ts">
  import type { ArenaBattlePhaseDisplay } from '$lib/arena/state/arenaTypes';

  interface Props {
    missionText?: string;
    battlePhaseDisplay?: ArenaBattlePhaseDisplay;
    onGoLobby?: () => void;
  }

  let {
    missionText = '',
    battlePhaseDisplay = { label: 'STANDBY', color: '#ffffff', timerLabel: null },
    onGoLobby = () => {},
  }: Props = $props();
</script>

<div class="mission-bar">
  <div class="mission-top">
    <div class="mission-phase">
      <span class="mp-dot" style="background:{battlePhaseDisplay.color}"></span>
      <span class="mp-label" style="color:{battlePhaseDisplay.color}">{battlePhaseDisplay.label}</span>
      {#if battlePhaseDisplay.timerLabel}
        <span class="mp-timer">{battlePhaseDisplay.timerLabel}</span>
      {/if}
    </div>
    <button class="mission-close" onclick={onGoLobby} title="LOBBY">✕</button>
  </div>
  <div class="mission-text">{missionText}</div>
</div>

<style>
  .mission-bar {
    padding: 8px 12px;
    border-bottom: 1px solid rgba(255,105,180,.2);
    background: linear-gradient(90deg, rgba(255,105,180,.06), rgba(255,105,180,.02));
    flex-shrink: 0;
  }
  .mission-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
  .mission-phase { display: flex; align-items: center; gap: 6px; font: 800 9px/1 var(--fd); letter-spacing: 1.5px; }
  .mp-dot { width: 6px; height: 6px; border-radius: 50%; box-shadow: 0 0 8px currentColor; flex-shrink: 0; }
  .mp-label { text-transform: uppercase; }
  .mp-timer { color: rgba(255,255,255,.4); font-size: 9px; margin-left: 8px; }
  .mission-close {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    border: 1px solid rgba(255,105,180,.35);
    background: rgba(255,105,180,.1);
    color: rgba(255,255,255,.7);
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all .15s;
    flex-shrink: 0;
  }
  .mission-close:hover { background: rgba(255,105,180,.25); color: #fff; }
  .mission-text { font: 700 8px/1.3 var(--fm); color: rgba(255,255,255,.5); letter-spacing: 0.5px; }
</style>
