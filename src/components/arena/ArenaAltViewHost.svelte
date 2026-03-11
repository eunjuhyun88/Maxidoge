<script lang="ts">
  import type { ArenaAltViewProps, ArenaResultPanelProps } from './arenaMatchSceneTypes';

  type ChartWarViewComponentType = typeof import('./views/ChartWarView.svelte').default;
  type MissionControlViewComponentType = typeof import('./views/MissionControlView.svelte').default;
  type CardDuelViewComponentType = typeof import('./views/CardDuelView.svelte').default;
  type ResultPanelComponentType = typeof import('./ResultPanel.svelte').default;

  interface Props {
    arenaView?: 'chart' | 'mission' | 'card';
    altViewProps?: ArenaAltViewProps;
    resultVisible?: boolean;
    resultPanelProps?: ArenaResultPanelProps;
    onPlayAgain?: () => void;
    onLobby?: () => void;
  }

  let {
    arenaView = 'chart',
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
  }: Props = $props();

  let ResultPanelComponent = $state<ResultPanelComponentType | null>(null);
  let ChartWarViewComponent = $state<ChartWarViewComponentType | null>(null);
  let MissionControlViewComponent = $state<MissionControlViewComponentType | null>(null);
  let CardDuelViewComponent = $state<CardDuelViewComponentType | null>(null);

  function ensureResultPanelComponent() {
    if (ResultPanelComponent || typeof window === 'undefined') return;
    void import('./ResultPanel.svelte').then((module) => {
      ResultPanelComponent = module.default;
    });
  }

  function ensureAltArenaViewComponent(view: 'chart' | 'mission' | 'card') {
    if (typeof window === 'undefined') return;

    if (view === 'chart') {
      if (ChartWarViewComponent) return;
      void import('./views/ChartWarView.svelte').then((module) => {
        ChartWarViewComponent = module.default;
      });
      return;
    }

    if (view === 'mission') {
      if (MissionControlViewComponent) return;
      void import('./views/MissionControlView.svelte').then((module) => {
        MissionControlViewComponent = module.default;
      });
      return;
    }

    if (CardDuelViewComponent) return;
    void import('./views/CardDuelView.svelte').then((module) => {
      CardDuelViewComponent = module.default;
    });
  }

  $effect(() => {
    ensureAltArenaViewComponent(arenaView);
    if (resultVisible) {
      ensureResultPanelComponent();
    }
  });
</script>

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
          {onPlayAgain}
          {onLobby}
        />
      {:else}
        <div class="alt-view-loading">Loading result panel...</div>
      {/if}
    </div>
  {/if}
</div>

<style>
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
</style>
