<script lang="ts">
  import type { AgentDef } from '$lib/data/agents';
  import type { CharSpriteState } from '$lib/engine/arenaCharacters';
  import type { ArenaBattleParticle } from './arenaBattleStageTypes';

  interface Props {
    arenaParticles?: ArenaBattleParticle[];
    activeAgents?: AgentDef[];
    charSprites?: Record<string, CharSpriteState>;
  }

  let {
    arenaParticles = [],
    activeAgents = [],
    charSprites = {},
  }: Props = $props();
</script>

<div class="arena-grid-bg"></div>

{#each arenaParticles as p (p.id)}
  <div
    class="arena-particle"
    style="left:{p.x}%;top:{p.y}%;width:{p.size}px;height:{p.size}px;opacity:{p.opacity};animation-duration:{p.speed * 4}s"
  ></div>
{/each}

<svg class="arena-connections" viewBox="0 0 100 100" preserveAspectRatio="none">
  {#each activeAgents as ag}
    {@const cs = charSprites[ag.id]}
    {#if cs}
      <line
        x1={cs.x}
        y1={cs.y}
        x2="50"
        y2="50"
        stroke={ag.color}
        stroke-width="0.3"
        stroke-opacity="0.2"
        stroke-dasharray="1 1"
      />
    {/if}
  {/each}
</svg>

<style>
  .arena-grid-bg {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image:
      linear-gradient(rgba(255,105,180,.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,105,180,.06) 1px, transparent 1px);
    background-size: 28px 28px;
    opacity: .4;
  }

  .arena-particle {
    position: absolute;
    border-radius: 50%;
    background: rgba(255,105,180,.3);
    animation: particleFloat linear infinite alternate;
    pointer-events: none;
  }

  @keyframes particleFloat {
    0% { transform: translateY(0) translateX(0); opacity: .1; }
    50% { transform: translateY(-15px) translateX(8px); opacity: .3; }
    100% { transform: translateY(5px) translateX(-5px); opacity: .15; }
  }

  .arena-connections {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 1;
  }
</style>
