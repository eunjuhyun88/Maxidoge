<script lang="ts">
  import type { ArenaBattleHudDisplay } from '$lib/arena/state/arenaTypes';
  import type { ArenaBattleChatMessage } from '$lib/arena/battle/arenaBattlePresentationRuntime';

  interface Props {
    battleHudDisplay?: ArenaBattleHudDisplay;
    battleLogPreview?: Array<ArenaBattleChatMessage & { id: number }>;
    battleLogCount?: number;
  }

  let {
    battleHudDisplay = { enemyHpAccent: '#ff2d55', enemyHpLabel: '100', narration: '에이전트 대기 중...', priceLabel: '--' },
    battleLogPreview = [],
    battleLogCount = 0,
  }: Props = $props();
</script>

<div class="sb-narration">
  <div class="narr-icon">⚡</div>
  <div class="narr-text">{battleHudDisplay.narration}</div>
</div>

<div class="battle-log">
  {#each battleLogPreview as msg (msg.id)}
    <div class="bl-line" class:action={msg.isAction}>
      <span class="bl-icon" style="color:{msg.color}">{msg.icon}</span>
      <span class="bl-name" style="color:{msg.color}">{msg.name}</span>
      <span class="bl-text">{msg.text}</span>
    </div>
  {/each}
  {#if battleLogCount === 0}
    <div class="bl-empty">대기 중...</div>
  {/if}
</div>

<style>
  .sb-narration {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-top: 1px solid rgba(255,105,180,.15);
    background: rgba(255,105,180,.04);
    flex-shrink: 0;
    min-height: 32px;
  }
  .narr-icon { font-size: 11px; flex-shrink: 0; }
  .narr-text { font: 700 9px/1.3 var(--fm); color: rgba(255,255,255,.7); flex: 1; animation: narrFade .3s ease; }
  @keyframes narrFade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

  .battle-log {
    max-height: 80px;
    overflow-y: auto;
    padding: 4px 8px;
    border-top: 1px solid rgba(255,105,180,.1);
    background: rgba(0,0,0,.2);
    flex-shrink: 0;
  }
  .battle-log::-webkit-scrollbar { width: 2px; }
  .battle-log::-webkit-scrollbar-thumb { background: rgba(255,105,180,.2); }
  .bl-line {
    display: flex;
    align-items: center;
    gap: 4px;
    font: 600 8px/1.3 var(--fm);
    color: rgba(255,255,255,.5);
    padding: 2px 0;
    animation: blSlideIn .3s ease;
  }
  .bl-line.action { color: rgba(255,105,180,.7); }
  @keyframes blSlideIn { from { opacity: 0; transform: translateX(-6px); } to { opacity: 1; transform: none; } }
  .bl-icon { font-size: 9px; flex-shrink: 0; }
  .bl-name { font: 800 7px/1 var(--fd); letter-spacing: .5px; flex-shrink: 0; }
  .bl-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bl-empty { text-align: center; color: rgba(255,255,255,.15); font: 600 8px/1 var(--fm); padding: 8px 0; }
</style>
