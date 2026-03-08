<script lang="ts">
  import ArenaBattleLayout from './ArenaBattleLayout.svelte';
  import ArenaTopbar from './ArenaTopbar.svelte';
  import PhaseGuide from './PhaseGuide.svelte';
  import ViewPicker from './ViewPicker.svelte';
  import type {
    ArenaApiSyncStatusDisplay,
    ArenaModeDisplay,
    ArenaPhaseTrackStep,
  } from '$lib/arena/state/arenaTypes';
  import type {
    ArenaBattleSidebarProps,
    ArenaChartRailProps,
  } from './arenaBattleLayoutTypes';
  import type { ArenaMode, ArenaView, Phase } from '$lib/stores/gameState';

  type MatchHistoryComponentType = typeof import('./MatchHistory.svelte').default;
  type ResultPanelComponentType = typeof import('./ResultPanel.svelte').default;
  type ChartWarViewComponentType = typeof import('./views/ChartWarView.svelte').default;
  type MissionControlViewComponentType = typeof import('./views/MissionControlView.svelte').default;
  type CardDuelViewComponentType = typeof import('./views/CardDuelView.svelte').default;

  interface Props {
    arenaSyncStatus?: ArenaApiSyncStatusDisplay | null;
    confirmingExit?: boolean;
    phaseTrack?: ArenaPhaseTrackStep[];
    arenaMode?: ArenaMode;
    arenaModeDisplay?: ArenaModeDisplay;
    lp?: number;
    wins?: number;
    losses?: number;
    onConfirmGoLobby?: () => void;
    onToggleMatchHistory?: () => void;
    MatchHistoryComponent?: MatchHistoryComponentType | null;
    matchHistoryOpen?: boolean;
    onCloseMatchHistory?: () => void;
    phase?: Phase;
    pair?: string;
    timeframe?: string;
    arenaView?: ArenaView;
    onSelectArenaView?: (view: ArenaView) => void;
    ChartWarViewComponent?: ChartWarViewComponentType | null;
    MissionControlViewComponent?: MissionControlViewComponentType | null;
    CardDuelViewComponent?: CardDuelViewComponentType | null;
    altViewProps?: Record<string, unknown>;
    resultVisible?: boolean;
    ResultPanelComponent?: ResultPanelComponentType | null;
    resultPanelProps?: Record<string, unknown>;
    onPlayAgain?: () => void;
    onLobby?: () => void;
    battleLayoutProps?: {
      chartRailProps: ArenaChartRailProps;
      battleSidebarProps: ArenaBattleSidebarProps;
    };
  }

  let {
    arenaSyncStatus = null,
    confirmingExit = false,
    phaseTrack = [],
    arenaMode = 'PVE',
    arenaModeDisplay = { label: 'PVE', roundBadge: null, fullLabel: 'PVE', tournamentMeta: null },
    lp = 0,
    wins = 0,
    losses = 0,
    onConfirmGoLobby = () => {},
    onToggleMatchHistory = () => {},
    MatchHistoryComponent = null,
    matchHistoryOpen = false,
    onCloseMatchHistory = () => {},
    phase = 'ANALYSIS',
    pair = 'BTCUSDT',
    timeframe = '1h',
    arenaView = 'arena',
    onSelectArenaView = () => {},
    ChartWarViewComponent = null,
    MissionControlViewComponent = null,
    CardDuelViewComponent = null,
    altViewProps = {},
    resultVisible = false,
    ResultPanelComponent = null,
    resultPanelProps = {},
    onPlayAgain = () => {},
    onLobby = () => {},
    battleLayoutProps = {
      chartRailProps: {
        chartPanelProps: {
          showPosition: false,
          posEntry: null,
          posTp: null,
          posSl: null,
          posDir: 'LONG',
          agentAnnotations: [],
          agentMarkers: [],
        },
      },
      battleSidebarProps: {},
    },
  }: Props = $props();
</script>

<!-- API Sync Status -->
{#if arenaSyncStatus}
  <div class="api-status {arenaSyncStatus.tone}">{arenaSyncStatus.label}</div>
{/if}

<ArenaTopbar
  {confirmingExit}
  {phaseTrack}
  {arenaMode}
  {arenaModeDisplay}
  {lp}
  {wins}
  {losses}
  onConfirmGoLobby={onConfirmGoLobby}
  onToggleMatchHistory={onToggleMatchHistory}
/>

{#if MatchHistoryComponent}
  <MatchHistoryComponent visible={matchHistoryOpen} onclose={onCloseMatchHistory} />
{/if}

<div class="phase-guide-wrap">
  <PhaseGuide {phase} {pair} {timeframe} />
</div>

<div class="view-picker-bar">
  <ViewPicker current={arenaView} onselect={onSelectArenaView} />
</div>

{#if arenaView !== 'arena'}
  <div class="view-container">
    {#if arenaView === 'chart'}
      {#if ChartWarViewComponent}
        <ChartWarViewComponent {...altViewProps} />
      {:else}
        <div class="alt-view-loading">Loading chart view...</div>
      {/if}
    {:else if arenaView === 'mission'}
      {#if MissionControlViewComponent}
        <MissionControlViewComponent {...altViewProps} />
      {:else}
        <div class="alt-view-loading">Loading mission view...</div>
      {/if}
    {:else if arenaView === 'card'}
      {#if CardDuelViewComponent}
        <CardDuelViewComponent {...altViewProps} />
      {:else}
        <div class="alt-view-loading">Loading card view...</div>
      {/if}
    {/if}

    {#if resultVisible}
      <div class="result-panel-wrap">
        {#if ResultPanelComponent}
          <ResultPanelComponent
            {...resultPanelProps}
            onPlayAgain={onPlayAgain}
            onLobby={onLobby}
          />
        {:else}
          <div class="alt-view-loading">Loading result panel...</div>
        {/if}
      </div>
    {/if}
  </div>
{:else}
  <ArenaBattleLayout {...battleLayoutProps} />
{/if}

<style>
  .view-picker-bar {
    position: relative;
    z-index: 20;
    padding: 0 12px;
    border-bottom: 1px solid rgba(255,105,180,.08);
  }
  .phase-guide-wrap {
    position: relative;
    z-index: 35;
    padding: 0 10px;
  }
  .view-container {
    flex: 1;
    min-height: 0;
    overflow: auto;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 12px;
    gap: 12px;
  }
  .result-panel-wrap {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,.7);
    backdrop-filter: blur(8px);
  }
  .alt-view-loading {
    width: min(980px, 100%);
    min-height: 280px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(232,150,125,.18);
    border-radius: 20px;
    background:
      linear-gradient(180deg, rgba(9, 20, 15, 0.94), rgba(7, 18, 13, 0.9)),
      radial-gradient(circle at 20% 0%, rgba(102, 204, 230, 0.08), transparent 32%);
    color: rgba(240, 237, 228, 0.72);
    font: 800 12px/1 var(--fd);
    letter-spacing: 1.1px;
    text-transform: uppercase;
  }
  .api-status {
    position: fixed;
    bottom: 8px;
    right: 8px;
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 8px;
    z-index: 100;
    opacity: 0.7;
    font-family: monospace;
  }
  .api-status.synced { background: rgba(0,170,68,0.2); color: #00aa44; }
  .api-status.error { background: rgba(255,45,85,0.15); color: #ff6666; }
</style>
