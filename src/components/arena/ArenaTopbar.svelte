<script lang="ts">
  import type { ArenaModeDisplay, ArenaPhaseTrackStep } from '$lib/arena/state/arenaTypes';
  import type { ArenaMode } from '$lib/stores/gameState';

  interface Props {
    confirmingExit?: boolean;
    phaseTrack?: ArenaPhaseTrackStep[];
    arenaMode?: ArenaMode;
    arenaModeDisplay?: ArenaModeDisplay;
    lp?: number;
    wins?: number;
    losses?: number;
    onConfirmGoLobby?: () => void;
    onToggleMatchHistory?: () => void;
  }

  let {
    confirmingExit = false,
    phaseTrack = [],
    arenaMode = 'PVE',
    arenaModeDisplay = { label: 'PVE', roundBadge: null, fullLabel: 'PVE', tournamentMeta: null },
    lp = 0,
    wins = 0,
    losses = 0,
    onConfirmGoLobby = () => {},
    onToggleMatchHistory = () => {},
  }: Props = $props();
</script>

<div class="arena-topbar">
  <button class="atb-back" onclick={onConfirmGoLobby}>
    {#if confirmingExit}
      <span class="atb-confirm-pulse">EXIT? CLICK AGAIN</span>
    {:else}
      <span class="atb-arrow">←</span> LOBBY
    {/if}
  </button>
  <div class="atb-phase-track">
    {#each phaseTrack as step, idx}
      <div class="atb-phase" class:active={step.active} class:done={step.done}>
        <span class="atp-dot"></span><span class="atp-label">{step.label}</span>
      </div>
      {#if idx < phaseTrack.length - 1}
        <div class="atb-connector"></div>
      {/if}
    {/each}
  </div>
  <div class="atb-right">
    <div class="atb-mode" class:pvp={arenaMode === 'PVP'} class:tour={arenaMode === 'TOURNAMENT'}>
      {arenaModeDisplay.fullLabel}
    </div>
    <div class="atb-stats">
      <span class="atb-lp">⚡{lp}</span>
      <span class="atb-wl">{wins}W-{losses}L</span>
    </div>
    <button class="atb-hist" onclick={onToggleMatchHistory}>📋</button>
  </div>
</div>

<style>
  .arena-topbar {
    position: relative;
    z-index: 40;
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-bottom: 1px solid var(--space-line);
    background:
      linear-gradient(180deg, rgba(8, 19, 13, 0.95), rgba(7, 16, 11, 0.9)),
      radial-gradient(circle at 8% -20%, rgba(232, 150, 125, 0.12), transparent 40%);
    backdrop-filter: blur(10px);
  }

  .atb-back {
    border: 1px solid var(--space-line-strong);
    border-radius: 999px;
    background: rgba(10, 26, 18, 0.72);
    color: var(--space-text);
    font: 800 10px/1 var(--fd);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    padding: 7px 13px;
    cursor: pointer;
    transition: transform .16s ease, border-color .16s ease, background .16s ease;
  }

  .atb-back:hover {
    transform: translateY(-1px);
    border-color: rgba(232, 150, 125, 0.7);
    background: rgba(10, 26, 18, 0.84);
  }

  .atb-arrow {
    margin-right: 5px;
  }

  .atb-confirm-pulse {
    color: #ff9c89;
    animation: pulseWarn .9s ease-in-out infinite;
  }

  @keyframes pulseWarn {
    0%, 100% { opacity: .8; }
    50% { opacity: 1; }
  }

  .atb-phase-track {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
  }

  .atb-phase {
    display: flex;
    align-items: center;
    gap: 4px;
    opacity: .62;
    transition: opacity .2s ease, filter .2s ease;
  }

  .atb-phase.active,
  .atb-phase.done {
    opacity: 1;
  }

  .atp-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 1px solid rgba(232, 150, 125, 0.35);
    background: rgba(232, 150, 125, 0.2);
    box-shadow: 0 0 0 rgba(232, 150, 125, 0);
  }

  .atb-phase.active .atp-dot {
    background: #e8967d;
    box-shadow: 0 0 10px rgba(232, 150, 125, 0.7);
  }

  .atb-phase.done .atp-dot {
    background: #1effa0;
    border-color: rgba(130, 255, 207, 0.9);
  }

  .atp-label {
    font: 800 8px/1 var(--fd);
    letter-spacing: 1.3px;
    color: var(--space-text-soft);
    white-space: nowrap;
  }

  .atb-connector {
    width: 20px;
    height: 1px;
    margin: 0 4px;
    background: linear-gradient(90deg, rgba(232, 150, 125, 0.1), rgba(232, 150, 125, 0.35), rgba(232, 150, 125, 0.1));
  }

  .atb-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .atb-mode {
    border: 1px solid rgba(232, 150, 125, 0.4);
    border-radius: 999px;
    background: rgba(232, 150, 125, 0.1);
    color: #e8967d;
    font: 800 8px/1 var(--fd);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    padding: 4px 8px;
  }

  .atb-mode.pvp {
    border-color: rgba(255, 158, 112, 0.7);
    background: rgba(198, 93, 52, 0.18);
    color: #ffd7bb;
  }

  .atb-mode.tour {
    border-color: rgba(249, 199, 127, 0.72);
    background: rgba(186, 133, 54, 0.18);
    color: #ffdeb2;
  }

  .atb-stats {
    display: flex;
    gap: 6px;
    align-items: center;
    font: 700 8px/1 var(--fm);
    color: var(--space-text-soft);
  }

  .atb-lp {
    color: #ffd39e;
  }

  .atb-hist {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: 1px solid rgba(232, 150, 125, 0.4);
    background: rgba(10, 26, 18, 0.8);
    color: #f0ede4;
    font-size: 13px;
    cursor: pointer;
  }

  .atb-hist:hover {
    border-color: rgba(232, 150, 125, 0.6);
    background: rgba(232, 150, 125, 0.12);
  }

  @media (max-width: 1024px) {
    .atb-phase-track {
      justify-content: flex-start;
      overflow-x: auto;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
    }

    .atb-phase-track::-webkit-scrollbar {
      display: none;
    }
  }

  @media (max-width: 1024px) {
    .arena-topbar {
      grid-template-columns: 1fr auto;
      grid-template-areas:
        'back right'
        'track track';
      row-gap: 8px;
    }

    .atb-back {
      grid-area: back;
      justify-self: start;
    }

    .atb-right {
      grid-area: right;
      justify-self: end;
    }

    .atb-phase-track {
      grid-area: track;
      justify-content: flex-start;
      width: 100%;
    }
  }

  @media (max-width: 768px) {
    .atp-label {
      font-size: 9px;
      letter-spacing: 1px;
    }

    .atb-connector {
      width: 12px;
      margin: 0 3px;
    }

    .atb-back {
      font-size: 9px;
      padding: 6px 10px;
    }

    .atb-hist {
      width: 28px;
      height: 28px;
    }
  }
</style>
