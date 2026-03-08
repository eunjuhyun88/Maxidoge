<script lang="ts">
  import ArenaChartRail from './ArenaChartRail.svelte';
  import ArenaBattleSidebar from './ArenaBattleSidebar.svelte';
  import type {
    ArenaBattleSidebarProps,
    ArenaChartRailProps,
  } from './arenaBattleLayoutTypes';

  interface Props {
    chartRailProps: ArenaChartRailProps;
    battleSidebarProps: ArenaBattleSidebarProps;
  }

  let {
    chartRailProps = {
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
    battleSidebarProps = {},
  }: Props = $props();
</script>

<div class="battle-layout">
  <ArenaChartRail {...chartRailProps} />

  <ArenaBattleSidebar {...battleSidebarProps} />
</div>

<style>
  .battle-layout {
    display: grid;
    grid-template-columns: 1fr 380px;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  @media (max-width: 768px) {
    .battle-layout {
      grid-template-columns: 1fr;
      grid-template-rows: 45% 1fr;
    }
  }
</style>
