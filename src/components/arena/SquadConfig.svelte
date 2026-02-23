<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { AGDEFS } from '$lib/data/agents';
  import type { SquadConfig, RiskLevel, SquadTimeframe } from '$lib/stores/gameState';
  import { CORE_TIMEFRAME_OPTIONS } from '$lib/utils/timeframe';

  const dispatch = createEventDispatcher<{
    deploy: { config: SquadConfig };
    back: void;
  }>();

  let { selectedAgents = [] as string[] }: { selectedAgents?: string[] } = $props();

  // Squad-wide config (v2 parameters)
  let riskLevel: RiskLevel = $state('mid');
  let timeframe: SquadTimeframe = $state('4h');
  let leverageBias = $state(5);
  let confidenceWeight = $state(5);

  let activeAgents = $derived(AGDEFS.filter(a => selectedAgents.includes(a.id)));

  const RISK_OPTIONS: { value: RiskLevel; label: string; emoji: string; desc: string; color: string }[] = [
    { value: 'low', label: 'LOW', emoji: '🛡', desc: 'Conservative. Tight SL, low leverage.', color: '#00cc66' },
    { value: 'mid', label: 'MID', emoji: '⚖️', desc: 'Balanced risk/reward.', color: '#ffe600' },
    { value: 'aggro', label: 'AGGRO', emoji: '🔥', desc: 'High risk, high reward. Wide SL.', color: '#ff2d55' }
  ];

  const TF_DESCRIPTIONS: Record<SquadTimeframe, string> = {
    '1m': 'Ultra scalp',
    '5m': 'Scalp',
    '15m': 'Fast intraday',
    '30m': 'Intraday',
    '1h': 'Session trend',
    '4h': 'Swing',
    '1d': 'Macro',
    '1w': 'Position',
  };

  const TF_OPTIONS: { value: SquadTimeframe; label: string; desc: string }[] = CORE_TIMEFRAME_OPTIONS.map((tf) => ({
    value: tf.value,
    label: tf.label,
    desc: TF_DESCRIPTIONS[tf.value],
  }));

  function handleDeploy() {
    dispatch('deploy', {
      config: { riskLevel, timeframe, leverageBias, confidenceWeight }
    });
  }

  function handleBack() {
    dispatch('back');
  }
</script>

<div class="squad-config">
  <div class="sc-header">
    <button class="sc-back" on:click={handleBack}>← BACK</button>
    <h2 class="sc-title">CONFIGURE SQUAD</h2>
    <div class="sc-count">{activeAgents.length} AGENTS</div>
  </div>

  <!-- Agent roster preview -->
  <div class="sc-roster">
    {#each activeAgents as ag (ag.id)}
      <div class="roster-chip" style="--agent-color:{ag.color}">
        <span class="rc-icon">{ag.icon}</span>
        <span class="rc-name">{ag.name}</span>
        <span class="rc-role">{ag.role}</span>
      </div>
    {/each}
  </div>

  <div class="sc-params">
    <!-- Risk Level -->
    <div class="param-section">
      <div class="param-label">
        <span class="pl-emoji">⚠️</span>
        <span class="pl-text">RISK LEVEL</span>
      </div>
      <div class="pill-group risk">
        {#each RISK_OPTIONS as opt}
          <button
            class="pill"
            class:sel={riskLevel === opt.value}
            style="--pill-color:{opt.color}"
            on:click={() => riskLevel = opt.value}
          >
            <span class="pill-emoji">{opt.emoji}</span>
            <span class="pill-label">{opt.label}</span>
          </button>
        {/each}
      </div>
      <div class="param-desc">
        {RISK_OPTIONS.find(o => o.value === riskLevel)?.desc}
      </div>
    </div>

    <!-- Timeframe -->
    <div class="param-section">
      <div class="param-label">
        <span class="pl-emoji">⏱</span>
        <span class="pl-text">TIMEFRAME</span>
      </div>
      <div class="pill-group tf">
        {#each TF_OPTIONS as opt}
          <button
            class="pill tf-pill"
            class:sel={timeframe === opt.value}
            on:click={() => timeframe = opt.value}
          >
            <span class="pill-label">{opt.label}</span>
            <span class="pill-sub">{opt.desc}</span>
          </button>
        {/each}
      </div>
    </div>

    <!-- Leverage Bias -->
    <div class="param-section">
      <div class="param-label">
        <span class="pl-emoji">📈</span>
        <span class="pl-text">LEVERAGE BIAS</span>
        <span class="pl-val">{leverageBias}</span>
      </div>
      <div class="slider-wrap">
        <span class="slider-min">1</span>
        <input type="range" class="sc-slider" min="1" max="10" step="1" bind:value={leverageBias} />
        <span class="slider-max">10</span>
      </div>
      <div class="slider-ticks">
        {#each Array(10) as _, i}
          <div class="tick" class:active={i + 1 <= leverageBias}></div>
        {/each}
      </div>
      <div class="param-desc">
        {leverageBias <= 3 ? 'Low leverage — safer but smaller gains' : leverageBias <= 6 ? 'Moderate leverage — balanced exposure' : 'High leverage — amplified gains & losses'}
      </div>
    </div>

    <!-- Confidence Weight -->
    <div class="param-section">
      <div class="param-label">
        <span class="pl-emoji">🎯</span>
        <span class="pl-text">CONFIDENCE WEIGHT</span>
        <span class="pl-val">{confidenceWeight}</span>
      </div>
      <div class="slider-wrap">
        <span class="slider-min">1</span>
        <input type="range" class="sc-slider conf" min="1" max="10" step="1" bind:value={confidenceWeight} />
        <span class="slider-max">10</span>
      </div>
      <div class="slider-ticks">
        {#each Array(10) as _, i}
          <div class="tick" class:active={i + 1 <= confidenceWeight}></div>
        {/each}
      </div>
      <div class="param-desc">
        {confidenceWeight <= 3 ? 'Low weight — agents decide more freely' : confidenceWeight <= 6 ? 'Balanced — agents weigh your conviction' : 'High weight — your conviction strongly influences agents'}
      </div>
    </div>
  </div>

  <!-- Config Summary -->
  <div class="sc-summary">
    <div class="sum-row">
      <span class="sum-label">RISK</span>
      <span class="sum-val" style="color:{RISK_OPTIONS.find(o => o.value === riskLevel)?.color}">{riskLevel.toUpperCase()}</span>
    </div>
    <div class="sum-divider"></div>
    <div class="sum-row">
      <span class="sum-label">TF</span>
      <span class="sum-val">{timeframe}</span>
    </div>
    <div class="sum-divider"></div>
    <div class="sum-row">
      <span class="sum-label">LEV</span>
      <span class="sum-val">{leverageBias}x</span>
    </div>
    <div class="sum-divider"></div>
    <div class="sum-row">
      <span class="sum-label">CONF</span>
      <span class="sum-val">{confidenceWeight}/10</span>
    </div>
  </div>

  <button class="sc-deploy-btn" on:click={handleDeploy}>
    🚀 DEPLOY SQUAD 🚀
  </button>
</div>

<style>
  .squad-config {
    position: absolute;
    inset: 0;
    z-index: 45;
    background: #ffe600;
    background-image: repeating-conic-gradient(#ffcc00 0deg 10deg, #ffe600 10deg 20deg);
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .sc-header {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    max-width: 520px;
    margin-bottom: 8px;
  }
  .sc-back {
    font-family: var(--fm);
    font-size: 9px;
    font-weight: 700;
    padding: 4px 10px;
    border: 2px solid #000;
    border-radius: 8px;
    background: #fff;
    cursor: pointer;
    box-shadow: 2px 2px 0 #000;
  }
  .sc-back:hover { background: #f0f0f0; }
  .sc-title {
    font-family: var(--fc);
    font-size: 22px;
    color: #000;
    -webkit-text-stroke: 1.5px #000;
    letter-spacing: 3px;
    flex: 1;
    text-align: center;
    margin: 0;
  }
  .sc-count {
    font-family: var(--fd);
    font-size: 12px;
    color: #fff;
    background: #000;
    padding: 3px 10px;
    border-radius: 10px;
    letter-spacing: 2px;
  }

  /* Agent Roster */
  .sc-roster {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;
    max-width: 520px;
    margin-bottom: 14px;
  }
  .roster-chip {
    display: flex;
    align-items: center;
    gap: 5px;
    background: #fff;
    border: 2.5px solid #000;
    border-radius: 20px;
    padding: 4px 10px 4px 6px;
    box-shadow: 2px 2px 0 #000;
  }
  .rc-icon { font-size: 14px; }
  .rc-name {
    font-family: var(--fd);
    font-size: 8px;
    font-weight: 900;
    letter-spacing: 1px;
    color: #000;
  }
  .rc-role {
    font-family: var(--fm);
    font-size: 6px;
    font-weight: 700;
    color: var(--agent-color);
    letter-spacing: .5px;
  }

  /* Params Container */
  .sc-params {
    width: 100%;
    max-width: 520px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-bottom: 16px;
  }

  .param-section {
    background: #fff;
    border: 3px solid #000;
    border-radius: 14px;
    padding: 12px 14px;
    box-shadow: 4px 4px 0 #000;
  }

  .param-label {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
  }
  .pl-emoji { font-size: 14px; }
  .pl-text {
    font-family: var(--fd);
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 2px;
    color: #000;
  }
  .pl-val {
    margin-left: auto;
    font-family: var(--fd);
    font-size: 16px;
    font-weight: 900;
    color: #000;
    background: #ffe600;
    border: 2px solid #000;
    border-radius: 8px;
    padding: 1px 10px;
    min-width: 32px;
    text-align: center;
  }

  .param-desc {
    font-family: var(--fm);
    font-size: 8px;
    color: #888;
    margin-top: 6px;
    text-align: center;
    letter-spacing: .5px;
  }

  /* Pill Groups */
  .pill-group {
    display: flex;
    gap: 6px;
  }
  .pill {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 8px 4px;
    border: 3px solid #ddd;
    border-radius: 12px;
    background: #fafafa;
    cursor: pointer;
    transition: all .15s;
    position: relative;
    overflow: hidden;
  }
  .pill:hover:not(.sel) { border-color: #999; background: #f5f5f5; }
  .pill.sel {
    border-color: #000;
    background: var(--pill-color, #ffe600);
    box-shadow: 0 0 0 2px var(--pill-color, #ffe600), 3px 3px 0 #000;
    transform: scale(1.05);
  }
  .pill-emoji { font-size: 16px; }
  .pill-label {
    font-family: var(--fd);
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 2px;
    color: #000;
  }
  .pill-sub {
    font-family: var(--fm);
    font-size: 7px;
    color: #888;
    letter-spacing: .5px;
  }
  .pill.sel .pill-sub { color: rgba(0,0,0,.5); }

  .tf-pill { padding: 10px 4px; }

  /* Slider */
  .slider-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .slider-min, .slider-max {
    font-family: var(--fd);
    font-size: 9px;
    font-weight: 900;
    color: #aaa;
    width: 16px;
    text-align: center;
  }
  .sc-slider {
    flex: 1;
    -webkit-appearance: none;
    appearance: none;
    height: 8px;
    border-radius: 4px;
    background: linear-gradient(90deg, #ddd, #ddd);
    outline: none;
    border: 2px solid #000;
  }
  .sc-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #ffe600;
    border: 3px solid #000;
    cursor: pointer;
    box-shadow: 2px 2px 0 #000;
    transition: transform .1s;
  }
  .sc-slider::-webkit-slider-thumb:hover {
    transform: scale(1.15);
  }
  .sc-slider::-webkit-slider-thumb:active {
    transform: scale(.95);
    box-shadow: 1px 1px 0 #000;
  }
  .sc-slider.conf::-webkit-slider-thumb {
    background: #00ccff;
  }

  .slider-ticks {
    display: flex;
    gap: 2px;
    margin-top: 4px;
    padding: 0 24px;
  }
  .tick {
    flex: 1;
    height: 4px;
    border-radius: 2px;
    background: #eee;
    transition: background .15s;
  }
  .tick.active { background: #000; }

  /* Summary Bar */
  .sc-summary {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #000;
    border-radius: 12px;
    padding: 8px 16px;
    margin-bottom: 14px;
    max-width: 520px;
    width: 100%;
    box-shadow: 4px 4px 0 rgba(0,0,0,.3);
  }
  .sum-row {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    flex: 1;
  }
  .sum-label {
    font-family: var(--fm);
    font-size: 6px;
    font-weight: 900;
    letter-spacing: 2px;
    color: #888;
  }
  .sum-val {
    font-family: var(--fd);
    font-size: 12px;
    font-weight: 900;
    color: #ffe600;
    letter-spacing: 1px;
  }
  .sum-divider {
    width: 1px;
    height: 24px;
    background: rgba(255,255,255,.15);
  }

  /* Deploy Button */
  .sc-deploy-btn {
    font-family: var(--fc);
    font-size: 22px;
    letter-spacing: 3px;
    color: #fff;
    background: linear-gradient(180deg, #00cc66, #00aa44);
    border: 4px solid #000;
    border-radius: 30px;
    padding: 12px 50px;
    cursor: pointer;
    box-shadow: 4px 4px 0 #000;
    transition: all .2s;
    -webkit-text-stroke: 1px #000;
    text-shadow: 2px 2px 0 rgba(0,0,0,.3);
  }
  .sc-deploy-btn:hover {
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0 #000;
    background: linear-gradient(180deg, #00dd77, #00bb55);
  }
  .sc-deploy-btn:active {
    transform: translate(2px, 2px);
    box-shadow: 1px 1px 0 #000;
  }
</style>
