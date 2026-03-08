<script lang="ts">
  import ArenaRewardModal from './ArenaRewardModal.svelte';
  import type {
    ArenaModeDisplay,
    ArenaResultState,
  } from '$lib/arena/state/arenaTypes';
  import type { ArenaRewardState } from '$lib/arena/reward/arenaRewardRuntime';
  import type { FBScore } from '$lib/engine/types';
  import type { Hypothesis } from '$lib/stores/gameState';

  interface Props {
    rewardState?: ArenaRewardState;
    onCloseReward?: () => void;
    resultVisible?: boolean;
    resultData?: ArenaResultState;
    streak?: number;
    fbScore?: FBScore | null;
    pvpVisible?: boolean;
    resultOverlayTitle?: string;
    arenaModeDisplay?: ArenaModeDisplay;
    score?: number;
    hypothesis?: Hypothesis | null;
    onGoLobby?: () => void;
    onPlayAgain?: () => void;
    floatingWords?: Array<{ id: number; text: string; color: string; x: number; dur: number }>;
  }

  let {
    rewardState = { visible: false, xpGain: 0, streak: 0, badges: [] },
    onCloseReward = () => {},
    resultVisible = false,
    resultData = { win: false, lp: 0, tag: '', motto: '', opponentScore: 0 },
    streak = 0,
    fbScore = null,
    pvpVisible = false,
    resultOverlayTitle = '',
    arenaModeDisplay = { label: 'PVE', roundBadge: null, fullLabel: 'PVE', tournamentMeta: null },
    score = 0,
    hypothesis = null,
    onGoLobby = () => {},
    onPlayAgain = () => {},
    floatingWords = [],
  }: Props = $props();
</script>

<ArenaRewardModal
  visible={rewardState.visible}
  xpGain={rewardState.xpGain}
  streak={rewardState.streak}
  badges={rewardState.badges}
  onclose={onCloseReward}
/>

{#if resultVisible}
  <div class="result-overlay" class:win={resultData.win} class:lose={!resultData.win}>
    <div class="result-text">{resultData.win ? 'VERY WIN WOW!' : 'SUCH SAD'}</div>
    <div class="result-lp">{resultData.tag}<br />{resultData.lp >= 0 ? '+' : ''}{resultData.lp} LP</div>
    {#if streak >= 3}
      <div class="result-streak">🔥×{streak} MUCH STREAK</div>
    {/if}
    {#if fbScore}
      <div class="fbs-card">
        <div class="fbs-title">FBS SCORECARD</div>
        <div class="fbs-row">
          <span class="fbs-label">DS</span>
          <div class="fbs-bar"><div class="fbs-fill" style="width:{fbScore.ds}%;background:#e8967d"></div></div>
          <span class="fbs-val">{fbScore.ds}</span>
        </div>
        <div class="fbs-row">
          <span class="fbs-label">RE</span>
          <div class="fbs-bar"><div class="fbs-fill" style="width:{fbScore.re}%;background:#66cce6"></div></div>
          <span class="fbs-val">{fbScore.re}</span>
        </div>
        <div class="fbs-row">
          <span class="fbs-label">CI</span>
          <div class="fbs-bar"><div class="fbs-fill" style="width:{fbScore.ci}%;background:#00cc88"></div></div>
          <span class="fbs-val">{fbScore.ci}</span>
        </div>
        <div class="fbs-total">
          <span>FBS</span>
          <span class="fbs-total-val">{fbScore.fbs}</span>
        </div>
      </div>
    {/if}
    <div class="result-motto">{resultData.motto}</div>
  </div>
{/if}

{#if pvpVisible}
  <div class="pvp-overlay">
    <div class="pvp-card">
      <div class="pvp-title">{resultOverlayTitle}</div>
      {#if arenaModeDisplay.tournamentMeta}
        <div class="pvp-label tour-meta">{arenaModeDisplay.tournamentMeta}</div>
      {/if}
      <div class="pvp-scores">
        <div class="pvp-side">
          <div class="pvp-label">YOUR SCORE</div>
          <div class="pvp-score">{Math.round(score)}</div>
        </div>
        <div class="pvp-vs">VS</div>
        <div class="pvp-side">
          <div class="pvp-label">OPPONENT</div>
          <div class="pvp-score">{resultData.opponentScore}</div>
        </div>
      </div>
      <div class="pvp-lp" class:pos={resultData.lp >= 0} class:neg={resultData.lp < 0}>
        {resultData.lp >= 0 ? '+' : ''}{resultData.lp} LP
      </div>
      {#if hypothesis}
        <div class="pvp-hypo">
          Your call: <span class="{hypothesis.dir.toLowerCase()}">{hypothesis.dir}</span>
          · R:R 1:{hypothesis.rr.toFixed(1)}
          {#if hypothesis.consensusType}
            · <span class="pvp-consensus">{hypothesis.consensusType.toUpperCase()}</span>
          {/if}
        </div>
      {/if}
      <div class="pvp-btns">
        <button class="pvp-btn lobby" onclick={onGoLobby}>↺ LOBBY</button>
        <button class="pvp-btn again" onclick={onPlayAgain}>🐕 PLAY AGAIN</button>
      </div>
    </div>
  </div>
{/if}

{#each floatingWords as w (w.id)}
  <div class="doge-float" style="left:{w.x}%;color:{w.color};animation-duration:{w.dur}s">{w.text}</div>
{/each}

<style>
  .result-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 35;
    text-align: center;
    animation: popIn .3s ease;
    padding: 16px 28px;
    border-radius: 16px;
    border: 1px solid rgba(232,150,125,.3);
    box-shadow: 0 8px 32px rgba(0,0,0,.5);
    backdrop-filter: blur(8px);
  }
  .result-overlay.win { background: linear-gradient(135deg, rgba(0,204,136,.25), rgba(0,180,100,.2)); border-color: rgba(0,204,136,.4); }
  .result-overlay.lose { background: linear-gradient(135deg, rgba(255,94,122,.25), rgba(200,50,70,.2)); border-color: rgba(255,94,122,.4); }
  .result-text { font-size: 22px; font-weight: 900; font-family: var(--fc); color: #f0ede4; letter-spacing: 3px; text-shadow: 0 0 12px rgba(232,150,125,.3); }
  .result-lp { font-size: 14px; font-weight: 900; font-family: var(--fd); color: #f0ede4; margin-top: 4px; }
  .result-streak { font-size: 10px; font-weight: 700; color: #e8967d; margin-top: 4px; }
  .result-motto { font-size: 9px; font-family: var(--fc); color: rgba(240,237,228,.6); margin-top: 8px; font-style: italic; }

  .fbs-card {
    margin-top: 10px;
    padding: 8px 12px;
    border-radius: 10px;
    background: rgba(10,26,18,.85);
    border: 1px solid rgba(232,150,125,.2);
    text-align: left;
    min-width: 180px;
  }
  .fbs-title { font-size: 9px; font-weight: 900; letter-spacing: 2px; color: rgba(240,237,228,.5); font-family: var(--fd); margin-bottom: 6px; text-align: center; }
  .fbs-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
  .fbs-label { font-size: 9px; font-weight: 900; font-family: var(--fd); letter-spacing: 1px; width: 22px; color: rgba(240,237,228,.6); }
  .fbs-bar { flex: 1; height: 5px; background: rgba(240,237,228,.08); border-radius: 3px; overflow: hidden; }
  .fbs-fill { height: 100%; border-radius: 3px; transition: width .6s ease; }
  .fbs-val { font-size: 9px; font-weight: 900; font-family: var(--fd); width: 24px; text-align: right; color: #f0ede4; }
  .fbs-total { display: flex; justify-content: space-between; align-items: center; padding-top: 6px; border-top: 1px solid rgba(232,150,125,.15); margin-top: 4px; font-size: 9px; font-weight: 900; font-family: var(--fd); color: rgba(240,237,228,.5); letter-spacing: 1px; }
  .fbs-total-val { font-size: 16px; color: #e8967d; text-shadow: 0 0 8px rgba(232,150,125,.3); }

  .pvp-overlay {
    position: absolute;
    inset: 0;
    z-index: 40;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,.6);
    backdrop-filter: blur(4px);
    animation: fadeIn .3s ease;
  }
  .pvp-card {
    background: rgba(10,26,18,.95);
    border: 1px solid rgba(232,150,125,.3);
    border-radius: 16px;
    padding: 20px 30px;
    text-align: center;
    box-shadow: 0 8px 32px rgba(0,0,0,.5);
    min-width: 260px;
  }
  .pvp-title { font-size: 18px; font-weight: 900; font-family: var(--fc); letter-spacing: 3px; color: #f0ede4; }
  .pvp-scores { display: flex; align-items: center; justify-content: center; gap: 16px; margin: 12px 0; }
  .pvp-side { text-align: center; }
  .pvp-label { font-size: 9px; color: #888; font-family: var(--fd); letter-spacing: 2px; }
  .pvp-label.tour-meta { margin-top: 2px; margin-bottom: 8px; font-size: 9px; color: #8b6c27; letter-spacing: 1px; }
  .pvp-score { font-size: 28px; font-weight: 900; font-family: var(--fc); }
  .pvp-vs { font-size: 14px; font-weight: 900; font-family: var(--fc); color: #888; }
  .pvp-lp { font-size: 16px; font-weight: 900; font-family: var(--fd); margin: 8px 0; }
  .pvp-lp.pos { color: #00cc66; }
  .pvp-lp.neg { color: #ff2d55; }
  .pvp-hypo { font-size: 9px; font-family: var(--fm); font-weight: 700; color: #666; margin: 4px 0 8px; }
  .pvp-hypo .long { color: #00cc66; }
  .pvp-hypo .short { color: #ff2d55; }
  .pvp-hypo .neutral { color: #ffaa00; }
  .pvp-consensus { color: #c840ff; }
  .pvp-btns { display: flex; gap: 8px; justify-content: center; margin-top: 12px; }
  .pvp-btn { padding: 8px 20px; border-radius: 12px; border: 3px solid #000; font-family: var(--fd); font-size: 9px; font-weight: 900; letter-spacing: 2px; cursor: pointer; box-shadow: 3px 3px 0 #000; }
  .pvp-btn.lobby { background: #eee; color: #000; }
  .pvp-btn.again { background: #E8967D; color: #000; }
  .pvp-btn:hover { transform: translate(-1px, -1px); box-shadow: 4px 4px 0 #000; }

  .doge-float {
    position: absolute;
    z-index: 25;
    font-family: var(--fc);
    font-weight: 900;
    font-style: italic;
    font-size: 16px;
    letter-spacing: 2px;
    pointer-events: none;
    animation: dogeUp ease forwards;
    text-shadow: 2px 2px 0 #000, -1px -1px 0 #000;
    -webkit-text-stroke: 1px #000;
  }
  @keyframes dogeUp { 0% { opacity: 1; transform: translateY(0) rotate(-5deg) scale(1); } 100% { opacity: 0; transform: translateY(-100px) rotate(15deg) scale(1.5); } }
  @keyframes popIn { from { transform: translate(-50%, -50%) scale(.8); opacity: 0 } to { transform: translate(-50%, -50%) scale(1); opacity: 1 } }
  @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
</style>
