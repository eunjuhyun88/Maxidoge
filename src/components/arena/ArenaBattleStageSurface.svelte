<script lang="ts">
  import ArenaBattleAgentSprite from './ArenaBattleAgentSprite.svelte';
  import ArenaBattleCenterNode from './ArenaBattleCenterNode.svelte';
  import ArenaBattleParticleField from './ArenaBattleParticleField.svelte';
  import ArenaBattleStageFx from './ArenaBattleStageFx.svelte';
  import type { ArenaBattleStageSurfaceProps as Props } from './arenaBattleStageTypes';

  let {
    battleHudDisplay = {
      enemyHpAccent: '#ff2d55',
      enemyHpLabel: '100',
      narration: '에이전트 대기 중...',
      priceLabel: '--',
    },
    arenaParticles = [],
    activeAgents = [],
    charSprites = {},
    currentTurnIdx = -1,
    battleTurns = [],
    agentStates = {},
    showVsSplash = false,
    showCritical = false,
    criticalText = '',
    showCombo = false,
    comboCount = 0,
  }: Props = $props();

  const activeTurnAgentId = $derived(
    currentTurnIdx >= 0 ? battleTurns[currentTurnIdx]?.agent.id ?? null : null,
  );
</script>

<div class="game-arena">
  <ArenaBattleParticleField {arenaParticles} {activeAgents} {charSprites} />

  <ArenaBattleCenterNode {battleHudDisplay} />

  {#each activeAgents as ag, i}
    <ArenaBattleAgentSprite
      agent={ag}
      sprite={charSprites[ag.id]}
      isActiveTurn={activeTurnAgentId === ag.id}
      voteDir={agentStates[ag.id]?.voteDir}
      delayIndex={i}
    />
  {/each}

  <ArenaBattleStageFx {showVsSplash} {showCritical} {criticalText} {showCombo} {comboCount} />
</div>

<style>
  .game-arena {
    flex: 1;
    position: relative;
    overflow: hidden;
    min-height: 200px;
    background:
      radial-gradient(circle at 50% 45%, rgba(255,105,180,.06), transparent 50%),
      radial-gradient(circle at 20% 80%, rgba(0,255,136,.04), transparent 40%),
      radial-gradient(circle at 80% 20%, rgba(102,204,230,.04), transparent 40%);
  }
</style>
