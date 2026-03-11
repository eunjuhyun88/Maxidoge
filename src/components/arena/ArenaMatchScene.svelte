<script lang="ts">
  import ArenaAltViewHost from './ArenaAltViewHost.svelte';
  import ArenaBattleLayout from './ArenaBattleLayout.svelte';
  import ArenaTopbar from './ArenaTopbar.svelte';
  import PhaseGuide from './PhaseGuide.svelte';
  import ViewPicker from './ViewPicker.svelte';
  import type { ArenaMatchSceneProps } from './arenaMatchSceneTypes';

  type MatchHistoryComponentType = typeof import('./MatchHistory.svelte').default;

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
    matchHistoryOpen = false,
    onCloseMatchHistory = () => {},
    phase = 'ANALYSIS',
    pair = 'BTCUSDT',
    timeframe = '1h',
    arenaView = 'arena',
    onSelectArenaView = () => {},
    altViewProps = {
      phase: 'ANALYSIS',
      battleTick: null,
      hypothesis: null,
      prices: { BTC: 97000 },
      battleResult: null,
      battlePriceHistory: [],
      activeAgents: [],
    },
    resultVisible = false,
    resultPanelProps = {
      win: false,
      battleResult: '',
      entryPrice: 0,
      exitPrice: 0,
      tpPrice: 0,
      slPrice: 0,
      direction: 'LONG',
      priceHistory: [],
      duration: 0,
      maxRunup: 0,
      maxDrawdown: 0,
      rAchieved: 0,
      fbScore: null,
      lpChange: 0,
      streak: 0,
      agents: [],
      actualDirection: 'NEUTRAL',
    },
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
  }: ArenaMatchSceneProps = $props();

  let MatchHistoryComponent = $state<MatchHistoryComponentType | null>(null);
  function ensureMatchHistoryComponent() {
    if (MatchHistoryComponent || typeof window === 'undefined') return;
    void import('./MatchHistory.svelte').then((module) => {
      MatchHistoryComponent = module.default;
    });
  }

  $effect(() => {
    if (!matchHistoryOpen) return;
    ensureMatchHistoryComponent();
  });
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
  <ArenaAltViewHost
    {arenaView}
    {altViewProps}
    {resultVisible}
    {resultPanelProps}
    {onPlayAgain}
    {onLobby}
  />
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
