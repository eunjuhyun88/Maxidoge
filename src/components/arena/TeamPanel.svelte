<!--
  STOCKCLAW — Team Panel
  Team CRUD + member list + team match creation
-->
<script lang="ts">
  import {
    loadTeams, createNewTeam, joinExistingTeam, leaveCurrentTeam,
    disbandCurrentTeam, loadTeamMatches, startTeamMatch,
    teamList, teamMatches, teamLoading, teamError, activeTeam,
  } from '$lib/stores/teamStore';
  import { onMount } from 'svelte';

  interface Props {
    visible: boolean;
    pair: string;
    onTeamMatchStart: (teamMatchId: string) => void;
  }

  let { visible, pair, onTeamMatchStart }: Props = $props();

  let newTeamName = $state('');
  let joinTeamId = $state('');
  let tab: 'list' | 'create' | 'join' = $state('list');
  let actionMessage = $state<string | null>(null);

  onMount(() => { if (visible) loadTeams(); });

  $effect(() => { if (visible) loadTeams(); });

  async function handleCreate() {
    if (!newTeamName.trim() || newTeamName.trim().length < 2) return;
    actionMessage = null;
    try {
      const team = await createNewTeam(newTeamName.trim());
      actionMessage = team ? `Team "${team.name}" created!` : 'Team created!';
      newTeamName = '';
      tab = 'list';
    } catch (err) {
      actionMessage = err instanceof Error ? err.message : 'Create failed';
    }
  }

  async function handleJoin() {
    if (!joinTeamId.trim()) return;
    actionMessage = null;
    try {
      await joinExistingTeam(joinTeamId.trim());
      actionMessage = 'Joined team!';
      joinTeamId = '';
      tab = 'list';
    } catch (err) {
      actionMessage = err instanceof Error ? err.message : 'Join failed';
    }
  }

  async function handleLeave(teamId: string) {
    actionMessage = null;
    try {
      await leaveCurrentTeam(teamId);
      actionMessage = 'Left team';
    } catch (err) {
      actionMessage = err instanceof Error ? err.message : 'Leave failed';
    }
  }

  async function handleDisband(teamId: string) {
    actionMessage = null;
    try {
      await disbandCurrentTeam(teamId);
      actionMessage = 'Team disbanded';
    } catch (err) {
      actionMessage = err instanceof Error ? err.message : 'Disband failed';
    }
  }

  async function handleStartMatch(teamId: string) {
    actionMessage = null;
    try {
      const match = await startTeamMatch(teamId, pair);
      if (match) onTeamMatchStart(match.id);
    } catch (err) {
      actionMessage = err instanceof Error ? err.message : 'Match start failed';
    }
  }

  async function handleViewMatches(teamId: string) {
    await loadTeamMatches(teamId);
  }
</script>

{#if visible}
  <div class="tp-panel">
    <div class="tp-header">
      <span class="tp-title">🛡️ TEAM MANAGEMENT</span>
    </div>

    <!-- Tabs -->
    <div class="tp-tabs">
      <button class="tp-tab" class:active={tab === 'list'} onclick={() => { tab = 'list'; }}>My Teams</button>
      <button class="tp-tab" class:active={tab === 'create'} onclick={() => { tab = 'create'; }}>Create</button>
      <button class="tp-tab" class:active={tab === 'join'} onclick={() => { tab = 'join'; }}>Join</button>
    </div>

    {#if actionMessage}
      <p class="tp-message">{actionMessage}</p>
    {/if}

    {#if $teamLoading}
      <div class="tp-loading">Loading...</div>
    {/if}

    {#if $teamError}
      <p class="tp-error">{$teamError}</p>
    {/if}

    <!-- Team List -->
    {#if tab === 'list'}
      <div class="tp-list">
        {#each $teamList as team}
          <div class="tp-team-card">
            <div class="tp-team-info">
              <span class="tp-team-name">{team.name}</span>
              <span class="tp-team-stats">{team.winCount}W {team.lossCount}L · {team.memberCount}/3 · LP {team.lpPool}</span>
            </div>
            <div class="tp-team-actions">
              <button class="tp-btn tp-btn-battle" onclick={() => handleStartMatch(team.id)} title="Start team match">⚔</button>
              <button class="tp-btn tp-btn-view" onclick={() => handleViewMatches(team.id)} title="View matches">📋</button>
              <button class="tp-btn tp-btn-leave" onclick={() => handleLeave(team.id)} title="Leave team">🚪</button>
            </div>
          </div>
        {:else}
          <p class="tp-empty">No teams yet. Create or join one!</p>
        {/each}
      </div>

      <!-- Team Matches -->
      {#if $teamMatches.length > 0}
        <div class="tp-matches">
          <div class="tp-matches-header">Recent Matches</div>
          {#each $teamMatches.slice(0, 5) as m}
            <div class="tp-match-row">
              <span class="tp-match-teams">{m.teamAName} vs {m.teamBName ?? 'TBD'}</span>
              <span class="tp-match-pair">{m.pair}</span>
              <span class="tp-match-status">{m.status}</span>
            </div>
          {/each}
        </div>
      {/if}
    {/if}

    <!-- Create Tab -->
    {#if tab === 'create'}
      <div class="tp-form">
        <input
          class="tp-input"
          type="text"
          placeholder="Team name (2-20 chars)"
          maxlength={20}
          bind:value={newTeamName}
          onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter') handleCreate(); }}
        />
        <button class="tp-btn-primary" onclick={handleCreate} disabled={$teamLoading || newTeamName.trim().length < 2}>
          Create Team
        </button>
      </div>
    {/if}

    <!-- Join Tab -->
    {#if tab === 'join'}
      <div class="tp-form">
        <input
          class="tp-input"
          type="text"
          placeholder="Team ID"
          bind:value={joinTeamId}
          onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter') handleJoin(); }}
        />
        <button class="tp-btn-primary" onclick={handleJoin} disabled={$teamLoading || !joinTeamId.trim()}>
          Join Team
        </button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .tp-panel {
    background: linear-gradient(135deg, #1a1c2e 0%, #12131f 100%);
    border: 1px solid rgba(138, 180, 255, 0.2);
    border-radius: 16px;
    padding: 16px;
    margin-top: 12px;
  }
  .tp-header { margin-bottom: 12px; }
  .tp-title { font-size: 13px; font-weight: 700; letter-spacing: 1px; color: #8ab4ff; }

  .tp-tabs { display: flex; gap: 4px; margin-bottom: 12px; }
  .tp-tab {
    flex: 1; padding: 6px 0; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px; color: rgba(255,255,255,0.5); font-size: 11px; font-weight: 600; cursor: pointer;
    transition: all 0.15s ease;
  }
  .tp-tab.active { background: rgba(138,180,255,0.15); border-color: rgba(138,180,255,0.3); color: #8ab4ff; }

  .tp-message { font-size: 11px; color: #4cd964; margin: 4px 0; }
  .tp-loading { font-size: 12px; color: rgba(255,255,255,0.4); padding: 8px 0; text-align: center; }
  .tp-error { font-size: 11px; color: #ff3b30; margin: 4px 0; }

  .tp-list { display: flex; flex-direction: column; gap: 8px; }
  .tp-team-card {
    display: flex; justify-content: space-between; align-items: center;
    padding: 10px 12px; background: rgba(255,255,255,0.03); border-radius: 10px; border: 1px solid rgba(255,255,255,0.05);
  }
  .tp-team-name { font-size: 13px; font-weight: 700; color: #fff; display: block; }
  .tp-team-stats { font-size: 10px; color: rgba(255,255,255,0.4); }
  .tp-team-actions { display: flex; gap: 4px; }
  .tp-btn {
    width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px;
    font-size: 14px; cursor: pointer; transition: all 0.15s ease;
  }
  .tp-btn:hover { background: rgba(255,255,255,0.1); }
  .tp-btn-leave:hover { background: rgba(255,59,48,0.15); }

  .tp-empty { font-size: 12px; color: rgba(255,255,255,0.3); text-align: center; padding: 16px 0; margin: 0; }

  .tp-matches { margin-top: 12px; }
  .tp-matches-header { font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.4); letter-spacing: 0.8px; margin-bottom: 6px; }
  .tp-match-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 6px 8px; font-size: 11px; color: rgba(255,255,255,0.6);
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .tp-match-teams { flex: 1; }
  .tp-match-pair { color: rgba(255,255,255,0.3); margin: 0 8px; }
  .tp-match-status { font-size: 10px; font-weight: 600; color: #8ab4ff; }

  .tp-form { display: flex; flex-direction: column; gap: 8px; padding: 8px 0; }
  .tp-input {
    padding: 10px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px; color: #fff; font-size: 13px; outline: none;
  }
  .tp-input:focus { border-color: rgba(138,180,255,0.4); }
  .tp-btn-primary {
    padding: 10px; background: linear-gradient(135deg, #8ab4ff, #5a7eff); border: none;
    border-radius: 8px; color: #fff; font-size: 12px; font-weight: 700; cursor: pointer;
    transition: all 0.15s ease;
  }
  .tp-btn-primary:hover { transform: translateY(-1px); }
  .tp-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
