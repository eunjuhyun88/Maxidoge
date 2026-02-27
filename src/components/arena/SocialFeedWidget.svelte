<!--
  STOCKCLAW — Social Feed Widget
  Follow feed + profile link
-->
<script lang="ts">
  import {
    loadFeed, follow, unfollow, loadProfile,
    socialFeed, socialLoading, socialError, socialProfile, socialHasMore,
  } from '$lib/stores/socialStore';
  import { onMount } from 'svelte';

  interface Props {
    visible: boolean;
    pair?: string;
  }

  let { visible, pair }: Props = $props();

  let showProfile = $state(false);

  onMount(() => { if (visible) loadFeed(pair, true); });
  $effect(() => { if (visible) loadFeed(pair, true); });

  function handleLoadMore() {
    loadFeed(pair);
  }

  async function handleViewProfile(userId: string) {
    await loadProfile(userId);
    showProfile = true;
  }
</script>

{#if visible}
  <div class="sf-panel">
    <div class="sf-header">
      <span class="sf-title">📢 SOCIAL FEED</span>
    </div>

    {#if $socialError}
      <p class="sf-error">{$socialError}</p>
    {/if}

    <!-- Profile Modal -->
    {#if showProfile && $socialProfile}
      <div class="sf-profile-overlay">
        <div class="sf-profile-card">
          <button class="sf-profile-close" onclick={() => { showProfile = false; }}>✕</button>
          <div class="sf-profile-header">
            <span class="sf-profile-name">{$socialProfile.displayName}</span>
            <span class="sf-profile-tier">{$socialProfile.tier}</span>
          </div>
          <div class="sf-profile-stats">
            <div class="sf-stat">
              <span class="sf-stat-val">{$socialProfile.lp}</span>
              <span class="sf-stat-label">LP</span>
            </div>
            <div class="sf-stat">
              <span class="sf-stat-val">{($socialProfile.winRate * 100).toFixed(0)}%</span>
              <span class="sf-stat-label">Win Rate</span>
            </div>
            <div class="sf-stat">
              <span class="sf-stat-val">{$socialProfile.followStats.followersCount}</span>
              <span class="sf-stat-label">Followers</span>
            </div>
          </div>
          {#if $socialProfile.followStats.isFollowing}
            <button class="sf-follow-btn sf-unfollow" onclick={() => unfollow($socialProfile!.userId)}>
              Unfollow
            </button>
          {:else}
            <button class="sf-follow-btn" onclick={() => follow($socialProfile!.userId)}>
              Follow
            </button>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Signal Feed -->
    <div class="sf-feed">
      {#each $socialFeed as signal}
        <div class="sf-signal">
          <div class="sf-signal-header">
            <button class="sf-user-link" onclick={() => handleViewProfile(signal.userId)}>
              Trader
            </button>
            <span class="sf-signal-pair">{signal.pair}</span>
            <span class="sf-signal-dir {signal.direction.toLowerCase()}">{signal.direction}</span>
            <span class="sf-signal-fbs">FBS {signal.fbs.toFixed(1)}</span>
          </div>
          <div class="sf-signal-body">
            <span class="sf-signal-draft">{signal.draftSummary}</span>
            {#if signal.isWin}
              <span class="sf-signal-win">W</span>
            {:else}
              <span class="sf-signal-loss">L</span>
            {/if}
          </div>
        </div>
      {:else}
        {#if $socialLoading}
          <p class="sf-empty">Loading feed...</p>
        {:else}
          <p class="sf-empty">No signals in feed</p>
        {/if}
      {/each}
    </div>

    {#if $socialHasMore && $socialFeed.length > 0}
      <button class="sf-load-more" onclick={handleLoadMore} disabled={$socialLoading}>
        {$socialLoading ? 'Loading...' : 'Load More'}
      </button>
    {/if}
  </div>
{/if}

<style>
  .sf-panel {
    background: linear-gradient(135deg, #1a1c2e 0%, #12131f 100%);
    border: 1px solid rgba(232, 150, 125, 0.2);
    border-radius: 16px;
    padding: 16px;
    margin-top: 12px;
  }
  .sf-header { margin-bottom: 12px; }
  .sf-title { font-size: 13px; font-weight: 700; letter-spacing: 1px; color: #e8967d; }
  .sf-error { font-size: 11px; color: #ff3b30; margin: 4px 0; }

  .sf-profile-overlay {
    position: fixed; inset: 0; z-index: 960; display: flex; align-items: center; justify-content: center;
    background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
  }
  .sf-profile-card {
    background: linear-gradient(135deg, #1a1c2e, #12131f); border: 1px solid rgba(232,150,125,0.3);
    border-radius: 16px; padding: 24px; width: 280px; text-align: center; position: relative;
  }
  .sf-profile-close {
    position: absolute; top: 8px; right: 12px; background: none; border: none;
    color: rgba(255,255,255,0.4); font-size: 16px; cursor: pointer;
  }
  .sf-profile-header { margin-bottom: 16px; }
  .sf-profile-name { font-size: 16px; font-weight: 700; color: #fff; display: block; }
  .sf-profile-tier { font-size: 11px; color: #e8967d; font-weight: 600; }

  .sf-profile-stats { display: flex; justify-content: center; gap: 20px; margin-bottom: 16px; }
  .sf-stat { display: flex; flex-direction: column; align-items: center; }
  .sf-stat-val { font-size: 16px; font-weight: 700; color: #fff; }
  .sf-stat-label { font-size: 9px; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 0.5px; }

  .sf-follow-btn {
    padding: 8px 24px; background: linear-gradient(135deg, #e8967d, #d97d63); border: none;
    border-radius: 8px; color: #fff; font-size: 12px; font-weight: 700; cursor: pointer;
  }
  .sf-follow-btn:hover { transform: translateY(-1px); }
  .sf-unfollow { background: rgba(255,255,255,0.1); }

  .sf-feed { display: flex; flex-direction: column; gap: 6px; max-height: 300px; overflow-y: auto; }
  .sf-signal {
    padding: 8px 10px; background: rgba(255,255,255,0.03); border-radius: 10px; border: 1px solid rgba(255,255,255,0.05);
  }
  .sf-signal-header { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
  .sf-user-link {
    font-size: 11px; font-weight: 600; color: #e8967d; background: none; border: none; cursor: pointer;
    text-decoration: underline; padding: 0;
  }
  .sf-signal-pair { font-size: 10px; color: rgba(255,255,255,0.4); }
  .sf-signal-dir { font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 4px; }
  .sf-signal-dir.long { color: #4cd964; background: rgba(76,217,100,0.15); }
  .sf-signal-dir.short { color: #ff3b30; background: rgba(255,59,48,0.15); }
  .sf-signal-dir.neutral { color: #ffcc00; background: rgba(255,204,0,0.15); }
  .sf-signal-fbs { font-size: 10px; color: rgba(255,255,255,0.3); margin-left: auto; }
  .sf-signal-body { display: flex; align-items: center; gap: 6px; }
  .sf-signal-draft { font-size: 10px; color: rgba(255,255,255,0.5); flex: 1; }
  .sf-signal-win { font-size: 10px; font-weight: 800; color: #4cd964; }
  .sf-signal-loss { font-size: 10px; font-weight: 800; color: #ff3b30; }

  .sf-empty { font-size: 12px; color: rgba(255,255,255,0.3); text-align: center; padding: 16px 0; margin: 0; }
  .sf-load-more {
    display: block; width: 100%; margin-top: 8px; padding: 8px;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px;
    color: rgba(255,255,255,0.5); font-size: 11px; font-weight: 600; cursor: pointer;
  }
  .sf-load-more:hover { background: rgba(255,255,255,0.08); }
  .sf-load-more:disabled { opacity: 0.3; cursor: not-allowed; }
</style>
