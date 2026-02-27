<!--
  STOCKCLAW — Emergency Meeting Panel
  Among Us-style agent debate triggered during ANALYSIS/HYPOTHESIS
-->
<script lang="ts">
  import type { EmergencyMeetingData } from '$lib/engine/types';
  import { AGDEFS } from '$lib/data/agents';

  interface Props {
    active: boolean;
    loading: boolean;
    data: EmergencyMeetingData | null;
    onTrigger: () => void;
    onDismiss: () => void;
    showButton: boolean;
    disabled: boolean;
  }

  let { active, loading, data, onTrigger, onDismiss, showButton, disabled }: Props = $props();

  function getAgentIcon(agentId: string): string {
    const def = AGDEFS.find(a => a.id === agentId);
    return def?.icon ?? '🤖';
  }

  function getAgentColor(agentId: string): string {
    const def = AGDEFS.find(a => a.id === agentId);
    return def?.color ?? '#888';
  }
</script>

<!-- Floating trigger button (visible during ANALYSIS/HYPOTHESIS) -->
{#if showButton && !active}
  <button
    class="em-trigger"
    onclick={onTrigger}
    disabled={disabled || loading}
    title="Emergency Meeting: Agent debate"
  >
    🚨 <span class="em-trigger-text">MEETING</span>
  </button>
{/if}

<!-- Full panel overlay when active -->
{#if active}
  <div class="em-overlay">
    <div class="em-panel">
      <div class="em-header">
        <span class="em-icon">🚨</span>
        <span class="em-title">EMERGENCY MEETING</span>
        <button class="em-close" onclick={onDismiss}>✕</button>
      </div>

      {#if loading}
        <div class="em-loading">
          <div class="em-spinner"></div>
          <p class="em-loading-text">Agents are debating...</p>
          <p class="em-loading-sub">This may take up to 20 seconds</p>
        </div>
      {:else if data}
        <!-- Agent Dialogues -->
        <div class="em-dialogues">
          {#each data.dialogues as d}
            <div class="em-dialogue" class:imposter={d.isImposter}>
              <div class="em-agent-avatar" style="background-color: {getAgentColor(d.agentId)}20; border-color: {getAgentColor(d.agentId)}">
                <span>{getAgentIcon(d.agentId)}</span>
              </div>
              <div class="em-dialogue-content">
                <div class="em-dialogue-header">
                  <span class="em-agent-name" style="color: {getAgentColor(d.agentId)}">{d.personaName}</span>
                  <span class="em-agent-id">{d.agentId}</span>
                  <span class="em-dir {d.direction.toLowerCase()}">{d.direction}</span>
                  {#if d.isImposter}
                    <span class="em-imposter-badge">SUS</span>
                  {/if}
                </div>
                <p class="em-dialogue-text">{d.dialogueText}</p>
                <div class="em-conf">Confidence: {d.confidence}%</div>
              </div>
            </div>
          {/each}
        </div>

        <!-- Vote Summary -->
        {#if data.voteSummary}
          <div class="em-vote-summary">
            <div class="em-vote-header">VOTE RESULT</div>
            <div class="em-vote-bars">
              <div class="em-vote-bar long" style="width: {(data.voteSummary.longVotes / data.voteSummary.totalAgents) * 100}%">
                LONG ({data.voteSummary.longVotes})
              </div>
              <div class="em-vote-bar short" style="width: {(data.voteSummary.shortVotes / data.voteSummary.totalAgents) * 100}%">
                SHORT ({data.voteSummary.shortVotes})
              </div>
              {#if data.voteSummary.neutralVotes > 0}
                <div class="em-vote-bar neutral" style="width: {(data.voteSummary.neutralVotes / data.voteSummary.totalAgents) * 100}%">
                  NEUTRAL ({data.voteSummary.neutralVotes})
                </div>
              {/if}
            </div>
            <div class="em-consensus">
              Consensus: <strong class={data.voteSummary.consensusDirection.toLowerCase()}>
                {data.voteSummary.consensusDirection}
              </strong>
              {#if data.voteSummary.imposterAgentId}
                · Imposter: <span class="em-imposter-name">{data.voteSummary.imposterAgentId}</span>
              {/if}
            </div>
          </div>
        {/if}
      {/if}
    </div>
  </div>
{/if}

<style>
  .em-trigger {
    position: fixed;
    bottom: 90px;
    right: 20px;
    z-index: 800;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    background: linear-gradient(135deg, #ff2d55, #ff5e7a);
    border: none;
    border-radius: 24px;
    color: #fff;
    font-weight: 700;
    font-size: 12px;
    cursor: pointer;
    box-shadow: 0 4px 20px rgba(255, 45, 85, 0.4);
    transition: all 0.2s ease;
    animation: emPulse 2s infinite;
  }
  .em-trigger:hover { transform: scale(1.05); }
  .em-trigger:disabled { opacity: 0.4; cursor: not-allowed; animation: none; }
  .em-trigger-text { letter-spacing: 1px; }
  @keyframes emPulse { 0%, 100% { box-shadow: 0 4px 20px rgba(255, 45, 85, 0.4); } 50% { box-shadow: 0 4px 30px rgba(255, 45, 85, 0.7); } }

  .em-overlay {
    position: fixed;
    inset: 0;
    z-index: 950;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(6px);
    animation: emFadeIn 0.3s ease-out;
  }
  @keyframes emFadeIn { from { opacity: 0; } to { opacity: 1; } }

  .em-panel {
    background: linear-gradient(135deg, #1a1c2e 0%, #12131f 100%);
    border: 1px solid rgba(255, 45, 85, 0.3);
    border-radius: 16px;
    width: min(480px, 95vw);
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 12px 60px rgba(0, 0, 0, 0.8);
  }

  .em-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }
  .em-icon { font-size: 20px; }
  .em-title { flex: 1; font-size: 13px; font-weight: 700; letter-spacing: 1.5px; color: #ff2d55; }
  .em-close {
    background: none; border: none; color: rgba(255,255,255,0.4); font-size: 16px; cursor: pointer;
    padding: 4px 8px; border-radius: 6px;
  }
  .em-close:hover { color: #fff; background: rgba(255,255,255,0.1); }

  .em-loading {
    padding: 40px 20px;
    text-align: center;
  }
  .em-spinner {
    width: 40px; height: 40px;
    border: 3px solid rgba(255,45,85,0.2);
    border-top-color: #ff2d55;
    border-radius: 50%;
    animation: emSpin 0.8s linear infinite;
    margin: 0 auto 16px;
  }
  @keyframes emSpin { to { transform: rotate(360deg); } }
  .em-loading-text { color: #fff; font-size: 14px; font-weight: 600; margin: 0; }
  .em-loading-sub { color: rgba(255,255,255,0.4); font-size: 12px; margin-top: 4px; }

  .em-dialogues { padding: 12px 16px; display: flex; flex-direction: column; gap: 12px; }
  .em-dialogue {
    display: flex;
    gap: 12px;
    padding: 12px;
    background: rgba(255,255,255,0.03);
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.05);
  }
  .em-dialogue.imposter { border-color: rgba(255,45,85,0.3); background: rgba(255,45,85,0.05); }
  .em-agent-avatar {
    width: 36px; height: 36px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    border: 2px solid;
    font-size: 16px;
    flex-shrink: 0;
  }
  .em-dialogue-content { flex: 1; min-width: 0; }
  .em-dialogue-header { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; flex-wrap: wrap; }
  .em-agent-name { font-size: 12px; font-weight: 700; }
  .em-agent-id { font-size: 10px; color: rgba(255,255,255,0.3); }
  .em-dir { font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 4px; }
  .em-dir.long { color: #4cd964; background: rgba(76,217,100,0.15); }
  .em-dir.short { color: #ff3b30; background: rgba(255,59,48,0.15); }
  .em-dir.neutral { color: #ffcc00; background: rgba(255,204,0,0.15); }
  .em-imposter-badge { font-size: 9px; font-weight: 800; color: #ff2d55; background: rgba(255,45,85,0.15); padding: 1px 6px; border-radius: 4px; letter-spacing: 0.5px; }
  .em-dialogue-text { font-size: 12px; color: rgba(255,255,255,0.75); line-height: 1.5; margin: 0; }
  .em-conf { font-size: 10px; color: rgba(255,255,255,0.3); margin-top: 4px; }

  .em-vote-summary {
    margin: 8px 16px 16px;
    padding: 12px;
    background: rgba(255,255,255,0.03);
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.06);
  }
  .em-vote-header { font-size: 10px; font-weight: 700; letter-spacing: 1px; color: rgba(255,255,255,0.4); margin-bottom: 8px; }
  .em-vote-bars { display: flex; gap: 4px; height: 24px; border-radius: 6px; overflow: hidden; }
  .em-vote-bar {
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 700; color: #fff; min-width: 40px;
  }
  .em-vote-bar.long { background: rgba(76,217,100,0.4); }
  .em-vote-bar.short { background: rgba(255,59,48,0.4); }
  .em-vote-bar.neutral { background: rgba(255,204,0,0.3); }
  .em-consensus { font-size: 12px; color: rgba(255,255,255,0.6); margin-top: 8px; }
  .em-consensus .long { color: #4cd964; }
  .em-consensus .short { color: #ff3b30; }
  .em-consensus .neutral { color: #ffcc00; }
  .em-imposter-name { color: #ff2d55; font-weight: 700; }
</style>
