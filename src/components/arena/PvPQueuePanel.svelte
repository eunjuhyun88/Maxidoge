<!--
  STOCKCLAW — PvP Queue Panel
  Matching animation + cancel button
-->
<script lang="ts">
  import { isInQueue, isMatched, pvpQueueLoading, pvpQueueError, dequeue } from '$lib/stores/pvpQueueStore';
  import { gameState } from '$lib/stores/gameState';

  interface Props {
    visible: boolean;
    onMatched: (matchId: string) => void;
    onCancel: () => void;
  }

  let { visible, onMatched, onCancel }: Props = $props();

  let dots = $state('.');
  let dotTimer: ReturnType<typeof setInterval> | null = null;

  $effect(() => {
    if (visible && $isInQueue) {
      dotTimer = setInterval(() => {
        dots = dots.length >= 3 ? '.' : dots + '.';
      }, 500);
    }
    return () => { if (dotTimer) clearInterval(dotTimer); };
  });

  // Watch for match
  $effect(() => {
    if ($isMatched) {
      const matchId = $gameState.pvpQueue.matchId;
      if (matchId) onMatched(matchId);
    }
  });

  async function handleCancel() {
    await dequeue();
    onCancel();
  }
</script>

{#if visible}
  <div class="pvpq-panel">
    <div class="pvpq-card">
      {#if $isMatched}
        <div class="pvpq-matched">
          <span class="pvpq-matched-icon">⚔️</span>
          <p class="pvpq-matched-text">OPPONENT FOUND!</p>
          <p class="pvpq-matched-sub">Entering arena...</p>
        </div>
      {:else if $isInQueue}
        <div class="pvpq-searching">
          <div class="pvpq-radar">
            <div class="pvpq-radar-sweep"></div>
            <span class="pvpq-radar-icon">🔍</span>
          </div>
          <p class="pvpq-search-text">Searching for opponent{dots}</p>
          <p class="pvpq-search-sub">Matching by tier & pair</p>
          <button class="pvpq-cancel" onclick={handleCancel} disabled={$pvpQueueLoading}>
            {$pvpQueueLoading ? 'Leaving...' : 'Cancel Queue'}
          </button>
        </div>
      {:else}
        <p class="pvpq-idle">Ready to join PvP queue</p>
      {/if}

      {#if $pvpQueueError}
        <p class="pvpq-error">{$pvpQueueError}</p>
      {/if}
    </div>
  </div>
{/if}

<style>
  .pvpq-panel {
    display: flex;
    justify-content: center;
    padding: 12px;
  }
  .pvpq-card {
    background: linear-gradient(135deg, #1a1c2e 0%, #12131f 100%);
    border: 1px solid rgba(255, 94, 122, 0.2);
    border-radius: 16px;
    padding: 28px;
    width: 300px;
    text-align: center;
  }

  .pvpq-searching { display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .pvpq-radar {
    position: relative;
    width: 80px; height: 80px;
    border-radius: 50%;
    border: 2px solid rgba(255,94,122,0.3);
    display: flex; align-items: center; justify-content: center;
    overflow: hidden;
  }
  .pvpq-radar-sweep {
    position: absolute; inset: 0;
    background: conic-gradient(from 0deg, transparent 0%, rgba(255,94,122,0.3) 25%, transparent 30%);
    animation: radarSweep 2s linear infinite;
  }
  @keyframes radarSweep { to { transform: rotate(360deg); } }
  .pvpq-radar-icon { font-size: 28px; z-index: 1; }
  .pvpq-search-text { font-size: 14px; font-weight: 600; color: #fff; margin: 0; }
  .pvpq-search-sub { font-size: 11px; color: rgba(255,255,255,0.4); margin: 0; }

  .pvpq-cancel {
    margin-top: 8px;
    padding: 8px 20px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    color: rgba(255,255,255,0.6);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .pvpq-cancel:hover { background: rgba(255,59,48,0.15); border-color: rgba(255,59,48,0.3); color: #ff3b30; }
  .pvpq-cancel:disabled { opacity: 0.4; cursor: not-allowed; }

  .pvpq-matched { display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .pvpq-matched-icon { font-size: 40px; animation: matchedBounce 0.5s ease; }
  @keyframes matchedBounce { 0% { transform: scale(0.5); } 50% { transform: scale(1.2); } 100% { transform: scale(1); } }
  .pvpq-matched-text { font-size: 16px; font-weight: 800; color: #ff5e7a; margin: 0; letter-spacing: 1px; }
  .pvpq-matched-sub { font-size: 12px; color: rgba(255,255,255,0.5); margin: 0; }

  .pvpq-idle { font-size: 13px; color: rgba(255,255,255,0.4); margin: 0; }
  .pvpq-error { font-size: 11px; color: #ff3b30; margin-top: 8px; }
</style>
