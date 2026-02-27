<!--
  STOCKCLAW — Live Session List
  Lists active LIVE sessions + connect via SSE
-->
<script lang="ts">
  import {
    loadLiveSessions, connectToStream, disconnectStream, sendReaction,
    liveSessions, liveConnected, liveSpectators, liveEvents, liveLoading, liveError,
  } from '$lib/stores/liveSessionStore';
  import type { LiveReaction } from '$lib/engine/types';
  import { onMount, onDestroy } from 'svelte';

  interface Props {
    visible: boolean;
  }

  let { visible }: Props = $props();

  const REACTIONS: LiveReaction[] = ['🔥', '🧊', '🤔', '⚡', '💀'];

  onMount(() => { if (visible) loadLiveSessions(); });
  $effect(() => { if (visible) loadLiveSessions(); });
  onDestroy(() => disconnectStream());

  function handleConnect(sessionId: string) {
    connectToStream(sessionId);
  }

  function handleReaction(reaction: LiveReaction) {
    sendReaction(reaction);
  }
</script>

{#if visible}
  <div class="ls-panel">
    <div class="ls-header">
      <span class="ls-title">📡 LIVE SESSIONS</span>
      <button class="ls-refresh" onclick={() => loadLiveSessions()} disabled={$liveLoading}>↻</button>
    </div>

    {#if $liveError}
      <p class="ls-error">{$liveError}</p>
    {/if}

    <!-- Connected session view -->
    {#if $liveConnected}
      <div class="ls-connected">
        <div class="ls-connected-header">
          <span class="ls-live-badge">● LIVE</span>
          <span class="ls-spectators">👁 {$liveSpectators}</span>
          <button class="ls-disconnect" onclick={disconnectStream}>Disconnect</button>
        </div>

        <!-- Reaction bar -->
        <div class="ls-reactions">
          {#each REACTIONS as r}
            <button class="ls-react-btn" onclick={() => handleReaction(r)}>{r}</button>
          {/each}
        </div>

        <!-- Event feed -->
        <div class="ls-events">
          {#each $liveEvents.slice(0, 10) as ev}
            <div class="ls-event">
              <span class="ls-event-type">{ev.type.split(':')[1]}</span>
              <span class="ls-event-data">{JSON.stringify(ev.data).slice(0, 80)}</span>
            </div>
          {:else}
            <p class="ls-event-empty">Waiting for events...</p>
          {/each}
        </div>
      </div>
    {:else}
      <!-- Session list -->
      <div class="ls-list">
        {#each $liveSessions as session}
          <div class="ls-session-card">
            <div class="ls-session-info">
              <span class="ls-session-pair">{session.pair}</span>
              <span class="ls-session-stage">{session.stage}</span>
              <span class="ls-session-viewers">👁 {session.spectatorCount}</span>
            </div>
            <button class="ls-join-btn" onclick={() => handleConnect(session.id)} disabled={!session.isLive}>
              {session.isLive ? 'Watch' : 'Ended'}
            </button>
          </div>
        {:else}
          {#if $liveLoading}
            <p class="ls-empty">Loading sessions...</p>
          {:else}
            <p class="ls-empty">No active sessions</p>
          {/if}
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .ls-panel {
    background: linear-gradient(135deg, #1a1c2e 0%, #12131f 100%);
    border: 1px solid rgba(102, 204, 230, 0.2);
    border-radius: 16px;
    padding: 16px;
    margin-top: 12px;
  }
  .ls-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  .ls-title { font-size: 13px; font-weight: 700; letter-spacing: 1px; color: #66cce6; }
  .ls-refresh {
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 6px; color: rgba(255,255,255,0.5); font-size: 14px; padding: 4px 8px; cursor: pointer;
  }
  .ls-refresh:hover { color: #fff; }
  .ls-refresh:disabled { opacity: 0.3; }

  .ls-error { font-size: 11px; color: #ff3b30; margin: 4px 0; }

  .ls-connected { display: flex; flex-direction: column; gap: 10px; }
  .ls-connected-header { display: flex; align-items: center; gap: 8px; }
  .ls-live-badge { font-size: 11px; font-weight: 700; color: #ff2d55; animation: livePulse 1.5s infinite; }
  @keyframes livePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  .ls-spectators { font-size: 11px; color: rgba(255,255,255,0.4); flex: 1; }
  .ls-disconnect {
    font-size: 10px; padding: 4px 10px; background: rgba(255,59,48,0.15); border: 1px solid rgba(255,59,48,0.3);
    border-radius: 6px; color: #ff3b30; cursor: pointer;
  }

  .ls-reactions { display: flex; gap: 6px; justify-content: center; }
  .ls-react-btn {
    font-size: 20px; padding: 6px 10px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px; cursor: pointer; transition: all 0.15s ease;
  }
  .ls-react-btn:hover { transform: scale(1.2); background: rgba(255,255,255,0.1); }

  .ls-events { display: flex; flex-direction: column; gap: 4px; max-height: 200px; overflow-y: auto; }
  .ls-event {
    display: flex; gap: 8px; padding: 4px 8px; font-size: 10px;
    background: rgba(255,255,255,0.02); border-radius: 6px;
  }
  .ls-event-type { color: #66cce6; font-weight: 600; white-space: nowrap; }
  .ls-event-data { color: rgba(255,255,255,0.4); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ls-event-empty { font-size: 11px; color: rgba(255,255,255,0.3); text-align: center; padding: 8px; margin: 0; }

  .ls-list { display: flex; flex-direction: column; gap: 6px; }
  .ls-session-card {
    display: flex; justify-content: space-between; align-items: center;
    padding: 8px 12px; background: rgba(255,255,255,0.03); border-radius: 10px; border: 1px solid rgba(255,255,255,0.05);
  }
  .ls-session-info { display: flex; align-items: center; gap: 8px; }
  .ls-session-pair { font-size: 12px; font-weight: 600; color: #fff; }
  .ls-session-stage { font-size: 10px; color: rgba(255,255,255,0.4); }
  .ls-session-viewers { font-size: 10px; color: rgba(255,255,255,0.3); }
  .ls-join-btn {
    padding: 4px 12px; background: rgba(102,204,230,0.15); border: 1px solid rgba(102,204,230,0.3);
    border-radius: 6px; color: #66cce6; font-size: 10px; font-weight: 600; cursor: pointer;
  }
  .ls-join-btn:disabled { opacity: 0.3; cursor: not-allowed; }
  .ls-empty { font-size: 12px; color: rgba(255,255,255,0.3); text-align: center; padding: 16px 0; margin: 0; }
</style>
