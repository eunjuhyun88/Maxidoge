<script lang="ts">
  import type { ArenaView } from '$lib/stores/gameState';

  interface Props {
    current?: ArenaView;
    onselect?: (view: ArenaView) => void;
  }

  let {
    current = 'chart',
    onselect = () => {},
  }: Props = $props();

  const views: Array<{ id: ArenaView; name: string; icon: string; desc: string; key: string }> = [
    { id: 'chart',   name: 'CHART WAR',       icon: '◎', desc: 'Chart is the game board', key: '1' },
    { id: 'arena',   name: 'AGENT ARENA',     icon: '⚔', desc: 'RPG boss battle', key: '2' },
    { id: 'mission', name: 'MISSION CONTROL', icon: '▦', desc: 'Trading desk dashboard', key: '3' },
    { id: 'card',    name: 'CARD DUEL',       icon: '▧', desc: 'Card game mechanics', key: '4' },
  ];
</script>

<div class="vp">
  <div class="vp-title">SELECT VIEW</div>
  <div class="vp-grid">
    {#each views as v}
      <button
        class="vp-card"
        class:active={current === v.id}
        onclick={() => { onselect(v.id); }}
      >
        <span class="vp-key">{v.key}</span>
        <span class="vp-icon">{v.icon}</span>
        <span class="vp-name">{v.name}</span>
        <span class="vp-desc">{v.desc}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .vp { padding: 12px 0; }
  .vp-title {
    font-size: 9px; letter-spacing: 2px; color: rgba(240,237,228,.55);
    font-family: var(--fm, 'JetBrains Mono', monospace);
    margin-bottom: 8px;
  }
  .vp-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .vp-card {
    position: relative;
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    padding: 12px 8px; border-radius: 8px;
    background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.06);
    color: #F0EDE4; cursor: pointer; transition: all .15s;
    font-family: var(--fm, 'JetBrains Mono', monospace);
  }
  .vp-card:hover { background: rgba(232,150,125,.08); border-color: rgba(232,150,125,.2); }
  .vp-card:active { transform: scale(0.95); }
  .vp-card.active { background: rgba(232,150,125,.12); border-color: #E8967D; }
  .vp-key {
    position: absolute;
    top: 4px;
    right: 6px;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.5px;
    color: rgba(232, 150, 125, 0.5);
    background: rgba(232, 150, 125, 0.08);
    border: 1px solid rgba(232, 150, 125, 0.15);
    border-radius: 3px;
    padding: 1px 4px;
    line-height: 1.2;
  }
  .vp-card.active .vp-key {
    color: rgba(232, 150, 125, 0.8);
    background: rgba(232, 150, 125, 0.15);
    border-color: rgba(232, 150, 125, 0.3);
  }
  .vp-icon { font-size: 20px; }
  .vp-name { font-size: 9px; font-weight: 700; letter-spacing: 1px; }
  .vp-desc { font-size: 9px; color: rgba(240,237,228,.55); text-align: center; }

  @media (max-width: 768px) {
    .vp-grid { grid-template-columns: repeat(4, 1fr); gap: 4px; }
    .vp-card { padding: 8px 4px; min-height: 44px; }
    .vp-icon { font-size: 16px; }
    .vp-desc { display: none; }
    .vp-key { display: none; }
  }
  @media (max-width: 480px) {
    .vp-card { padding: 6px 2px; }
    .vp-name { font-size: 9px; letter-spacing: 0.5px; }
  }
</style>
