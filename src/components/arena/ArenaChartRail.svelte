<script lang="ts">
  import ArenaHypothesisOverlay from './ArenaHypothesisOverlay.svelte';
  import ArenaPreviewOverlay from './ArenaPreviewOverlay.svelte';
  import ArenaChartScoreBar from './ArenaChartScoreBar.svelte';
  import ChartPanel from './ChartPanel.svelte';
  import type {
    ArenaModeDisplay,
    ArenaPreviewDisplay,
    ArenaScoreSummary,
  } from '$lib/arena/state/arenaTypes';
  import type { ArenaHypothesisSubmitInput } from '$lib/arena/controllers/arenaPhaseController';
  import type { ArenaMode, Direction } from '$lib/stores/gameState';
  import type { ArenaChartPanelProps } from './arenaBattleLayoutTypes';

  interface Props {
    chartPanelProps: ArenaChartPanelProps;
    onDragTP?: (detail: { price: number }) => void;
    onDragSL?: (detail: { price: number }) => void;
    onDragEntry?: (detail: { price: number }) => void;
    hypothesisVisible?: boolean;
    hypothesisTimer?: number;
    onHypothesisSubmit?: (selection: ArenaHypothesisSubmitInput) => void;
    floatDir?: 'LONG' | 'SHORT' | null;
    onSelectFloatDir?: (value: 'LONG' | 'SHORT' | null) => void;
    previewVisible?: boolean;
    previewDisplay?: ArenaPreviewDisplay | null;
    onConfirmPreview?: () => void;
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
    onToggleMarkers?: () => void;
    onTogglePositionVisibility?: () => void;
    onGoLobby?: () => void;
  }

  let {
    chartPanelProps,
    onDragTP = () => {},
    onDragSL = () => {},
    onDragEntry = () => {},
    hypothesisVisible = false,
    hypothesisTimer = 45,
    onHypothesisSubmit = () => {},
    floatDir = null,
    onSelectFloatDir = () => {},
    previewVisible = false,
    previewDisplay = null,
    onConfirmPreview = () => {},
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
    onToggleMarkers = () => {},
    onTogglePositionVisibility = () => {},
    onGoLobby = () => {},
  }: Props = $props();
</script>

<div class="chart-side">
  <ChartPanel
    {...chartPanelProps}
    onDragTP={onDragTP}
    onDragSL={onDragSL}
    onDragEntry={onDragEntry}
  />

  <ArenaHypothesisOverlay
    {hypothesisVisible}
    {hypothesisTimer}
    {onHypothesisSubmit}
    {floatDir}
    {onSelectFloatDir}
  />

  <ArenaPreviewOverlay {previewVisible} {previewDisplay} {onConfirmPreview} />

  <ArenaChartScoreBar
    {score}
    {scoreSummary}
    {streak}
    {wins}
    {losses}
    {lp}
    {arenaMode}
    {arenaModeDisplay}
    {hypothesisBadge}
    {hypothesisDir}
    {showMarkers}
    showPosition={chartPanelProps.showPosition}
    {onToggleMarkers}
    {onTogglePositionVisibility}
    {onGoLobby}
  />
</div>

<style>
  .chart-side {
    display: flex;
    flex-direction: column;
    background: #07130d;
    overflow: hidden;
    border-right: 1px solid rgba(232,150,125,.15);
    position: relative;
  }

  @media (max-width: 768px) {
    .chart-side { border-right: none; border-bottom: 4px solid #000; }
  }
</style>
