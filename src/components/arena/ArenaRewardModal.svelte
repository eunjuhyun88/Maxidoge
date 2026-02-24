<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';

  const dispatch = createEventDispatcher<{ close: void }>();

  export let visible = false;
  export let xpGain = 0;
  export let streak = 0;
  export let badges: string[] = [];

  let shownXp = 0;
  let xpTimer: ReturnType<typeof setInterval> | null = null;

  function stopXpTimer() {
    if (xpTimer) {
      clearInterval(xpTimer);
      xpTimer = null;
    }
  }

  function startXpCount(target: number) {
    stopXpTimer();
    shownXp = 0;
    if (target <= 0) return;

    const step = Math.max(1, Math.ceil(target / 22));
    xpTimer = setInterval(() => {
      shownXp = Math.min(target, shownXp + step);
      if (shownXp >= target) stopXpTimer();
    }, 28);
  }

  $: if (visible) {
    startXpCount(Math.max(0, Math.round(xpGain)));
  } else {
    stopXpTimer();
    shownXp = 0;
  }

  function close() {
    dispatch('close');
  }

  onDestroy(() => {
    stopXpTimer();
  });
</script>

{#if visible}
  <div class="reward-shell" role="dialog" aria-label="Arena reward">
    <div class="reward-card">
      <button class="reward-close" on:click={close} aria-label="Close reward">✕</button>
      <div class="reward-tag">MISSION REWARD</div>
      <div class="reward-xp">+{shownXp} XP</div>

      <div class="reward-meta">
        <span>🔥 Streak {streak}</span>
        <span>Unlocked {badges.length}</span>
      </div>

      {#if badges.length > 0}
        <div class="reward-badges">
          {#each badges as badge}
            <span>{badge}</span>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .reward-shell {
    position: absolute;
    inset: 0;
    z-index: 46;
    pointer-events: none;
    display: flex;
    justify-content: flex-end;
    align-items: flex-start;
    padding: 72px 14px 14px;
  }

  .reward-card {
    pointer-events: auto;
    position: relative;
    width: min(320px, 92vw);
    border-radius: 14px;
    padding: 12px 14px 13px;
    border: 1px solid rgba(255, 180, 98, 0.6);
    background:
      linear-gradient(140deg, rgba(18, 10, 32, 0.88), rgba(10, 8, 20, 0.92)),
      radial-gradient(circle at 12% -5%, rgba(255, 163, 86, 0.24), transparent 45%),
      radial-gradient(circle at 100% 100%, rgba(106, 215, 255, 0.22), transparent 46%);
    box-shadow:
      0 14px 34px rgba(0, 0, 0, 0.45),
      inset 0 1px 0 rgba(255, 229, 186, 0.35);
    animation: rewardIn 0.34s ease;
  }

  .reward-close {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 22px;
    height: 22px;
    border-radius: 8px;
    border: 1px solid rgba(255, 202, 122, 0.55);
    background: rgba(255, 201, 114, 0.1);
    color: rgba(255, 229, 183, 0.9);
    cursor: pointer;
    font: 800 11px/1 var(--fm);
  }

  .reward-tag {
    font: 900 8px/1 var(--fd);
    letter-spacing: 1.8px;
    color: #ffd99d;
    text-transform: uppercase;
  }

  .reward-xp {
    margin-top: 6px;
    font: 900 30px/1 var(--fc);
    letter-spacing: 1px;
    color: #ffffff;
    text-shadow:
      0 0 18px rgba(255, 182, 98, 0.42),
      0 0 30px rgba(104, 215, 255, 0.28);
  }

  .reward-meta {
    margin-top: 5px;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    font: 700 8px/1 var(--fm);
    color: rgba(214, 232, 255, 0.88);
  }

  .reward-meta > span {
    padding: 3px 8px;
    border-radius: 999px;
    border: 1px solid rgba(145, 205, 255, 0.38);
    background: rgba(46, 104, 182, 0.16);
  }

  .reward-badges {
    margin-top: 10px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .reward-badges > span {
    border: 1px solid rgba(255, 203, 116, 0.62);
    border-radius: 999px;
    padding: 4px 8px;
    font: 800 7px/1 var(--fd);
    letter-spacing: 1.1px;
    color: #ffe4b0;
    background: rgba(255, 172, 73, 0.12);
    text-transform: uppercase;
  }

  @keyframes rewardIn {
    from {
      opacity: 0;
      transform: translateY(-10px) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @media (max-width: 900px) {
    .reward-shell {
      padding-top: 64px;
    }

    .reward-card {
      width: min(280px, 92vw);
    }

    .reward-xp {
      font-size: 25px;
    }
  }

  @media (max-width: 640px) {
    .reward-shell {
      justify-content: center;
      align-items: flex-end;
      padding: 12px;
    }
  }
</style>
