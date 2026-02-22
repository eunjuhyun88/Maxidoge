<script lang="ts">
  import { gameState } from '$lib/stores/gameState';
  import { sfx } from '$lib/audio/sfx';
  import { startMatch as engineStartMatch, resetPhaseInit } from '$lib/engine/gameLoop';

  const PVP_UNLOCK_MATCHES = 10;
  const TOURNAMENT_UNLOCK_LP = 500;
  const TOURNAMENT_UNLOCK_PVP_WINS = 5;

  let selectedMode: 'pve' | 'pvp' | 'tournament' = 'pve';

  $: walletLabel = 'Silver';
  $: pveRecord = `${$gameState.wins}W-${$gameState.losses}L`;
  $: pvpWins = Math.max(0, Math.floor($gameState.wins * 0.65));
  $: pvpLosses = Math.max(0, Math.floor($gameState.losses * 0.35));
  $: pvpRecord = `${pvpWins}W-${pvpLosses}L`;
  $: pvpUnlocked = $gameState.matchN >= PVP_UNLOCK_MATCHES;
  $: tournamentUnlocked = $gameState.lp >= TOURNAMENT_UNLOCK_LP && pvpWins >= TOURNAMENT_UNLOCK_PVP_WINS;
  $: activeCount = Math.min(5, Math.max(1, ($gameState.matchN % 5) + 1));

  $: activeMatches = [
    {
      id: '#42',
      type: 'PVP',
      pair: 'BTC',
      enemy: '@jin',
      pnl: -0.8,
      eta: '3h남음'
    },
    {
      id: '#41',
      type: 'PVE',
      pair: 'ETH',
      enemy: 'ORPO',
      pnl: 1.2,
      eta: '21h남음'
    }
  ];

  $: recent = [
    {
      id: `#${Math.max(1, $gameState.matchN)}`,
      result: $gameState.wins >= $gameState.losses ? 'WIN' : 'LOSS',
      lp: $gameState.wins >= $gameState.losses ? 16 : -3,
      pair: $gameState.pair.split('/')[0],
      dir: $gameState.score >= 60 ? 'LONG' : 'SHORT',
      tag: 'DISSENT',
      fbs: Math.max(40, Math.min(99, Math.round($gameState.score + 8))),
      age: '2h'
    }
  ];

  function enterMode(mode: 'pve' | 'pvp' | 'tournament') {
    if (mode === 'pvp' && !pvpUnlocked) return;
    if (mode === 'tournament' && !tournamentUnlocked) return;

    selectedMode = mode;
    sfx.enter();

    gameState.update((s) => ({
      ...s,
      inLobby: false,
      selectedAgents: ['structure', 'vpa', 'ict', 'deriv', 'valuation', 'flow', 'senti', 'macro'],
      speed: 3
    }));

    resetPhaseInit();
    engineStartMatch();
  }
</script>

<div class="arena-lobby-v3">
  <div class="bg-layer bg-noise" aria-hidden="true"></div>
  <div class="bg-layer bg-grid" aria-hidden="true"></div>
  <div class="bg-layer bg-glow" aria-hidden="true"></div>

  <main class="lobby-main">
    <section class="hero">
      <div class="hero-meta">
        <span>진행 중</span>
        <span class="dot">•</span>
        <span>{$gameState.pair}</span>
        <span class="dot">•</span>
        <span>{selectedMode === 'pve' ? 'SHORT' : 'LONG'}</span>
        <span class="dot">•</span>
        <span class:neg={selectedMode === 'pve'} class:pos={selectedMode !== 'pve'}>
          {selectedMode === 'pve' ? '-0.8%' : '+1.2%'}
        </span>
        <span class="dot">•</span>
        <span>3h 남음</span>
        <button class="view-btn">진행 매치 보기</button>
      </div>

      <div class="hero-head">
        <div>
          <h1>ARENA LOBBY</h1>
          <p>{walletLabel} · LP {$gameState.lp} · ELO 1450</p>
        </div>
        <div class="match-cap">
          <span>동시 매치</span>
          <strong>{activeCount}/5</strong>
        </div>
      </div>
    </section>

    <section class="mode-grid">
      <button class="mode-card mode-pve" on:click={() => enterMode('pve')}>
        <div class="mode-type">PVE</div>
        <div class="mode-title">vs ORPO System</div>
        <div class="mode-meta">전적 {pveRecord}</div>
        <div class="mode-enter">ENTER →</div>
      </button>

      <button class="mode-card mode-pvp" class:locked={!pvpUnlocked} on:click={() => enterMode('pvp')}>
        <div class="mode-type">PVP</div>
        <div class="mode-title">vs HUMAN</div>
        <div class="mode-meta">전적 {pvpRecord}</div>
        <div class="mode-enter">{pvpUnlocked ? 'ENTER →' : `LOCK ${PVP_UNLOCK_MATCHES}전 후`}</div>
      </button>

      <button class="mode-card mode-tour" class:locked={!tournamentUnlocked} on:click={() => enterMode('tournament')}>
        <div class="mode-type">TOURNAMENT</div>
        <div class="mode-title">Bracket Battle</div>
        <div class="mode-meta muted">
          {#if tournamentUnlocked}
            OPEN
          {:else}
            LOCK Silver 이상 + PvP {TOURNAMENT_UNLOCK_PVP_WINS}전
          {/if}
        </div>
      </button>
    </section>

    <section class="panel">
      <div class="panel-title">진행 중 매치 (2)</div>
      <div class="rows">
        {#each activeMatches as m}
          <div class="row">
            <div class="left">
              <span class="id">{m.id}</span>
              <span class="type" class:pvpTag={m.type === 'PVP'} class:pveTag={m.type === 'PVE'}>{m.type}</span>
              <span class="pair">{m.pair}</span>
              <span class="vs">vs {m.enemy}</span>
            </div>
            <div class="right">
              <span class="status">추적중</span>
              <span class:neg={m.pnl < 0} class:pos={m.pnl >= 0}>{m.pnl >= 0 ? '+' : ''}{m.pnl}%</span>
              <span class="eta">{m.eta}</span>
            </div>
          </div>
        {/each}
      </div>
    </section>

    <section class="panel panel-recent">
      <div class="panel-title">RECENT</div>
      <div class="rows">
        {#each recent as r}
          <div class="row">
            <div class="left">
              <span class="id">{r.id}</span>
              <span class="result" class:win={r.result === 'WIN'} class:loss={r.result !== 'WIN'}>{r.result}</span>
              <span class="lp-delta">{r.lp > 0 ? '+' : ''}{r.lp}LP</span>
              <span class="pair">{r.pair}</span>
              <span class="dir">{r.dir}</span>
            </div>
            <div class="right">
              <span class="tag">{r.tag}</span>
              <span class="fbs">FBS {r.fbs}</span>
              <span class="eta">{r.age}</span>
            </div>
          </div>
        {/each}
      </div>
    </section>
  </main>

  <footer class="status-footer">
    <span>DECISION CHAIN</span>
    <span class="online-dot"></span>
    <span class="online">SYSTEM ONLINE</span>
    <span>BLOCK #18,429,031</span>
    <span class="lat">LATENCY 42ms</span>
  </footer>
</div>

<style>
  .arena-lobby-v3 {
    position: absolute;
    inset: 0;
    overflow: auto;
    background: linear-gradient(180deg, #08130d 0%, #07110c 55%, #060f0b 100%);
    color: #f0ede4;
    font-family: var(--fm, monospace);
  }

  .bg-layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .bg-noise {
    background-image: url('/arena/references/14-o.png');
    background-size: cover;
    background-position: center;
    mix-blend-mode: soft-light;
    opacity: 0.1;
    z-index: 0;
  }

  .bg-grid {
    background-image: radial-gradient(rgba(232, 150, 125, 0.1) 1px, transparent 1px);
    background-size: 12px 12px;
    mask-image: linear-gradient(to bottom, black 0%, rgba(0, 0, 0, 0.58) 75%, transparent 100%);
    z-index: 1;
  }

  .bg-glow {
    background:
      radial-gradient(circle at 82% 12%, rgba(232, 150, 125, 0.16) 0%, transparent 34%),
      radial-gradient(circle at 14% 78%, rgba(0, 212, 255, 0.08) 0%, transparent 40%);
    z-index: 2;
  }

  .lobby-main {
    position: relative;
    z-index: 4;
    max-width: 1280px;
    margin: 0 auto;
    padding: 18px 18px 74px;
  }

  .hero {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-bottom: 14px;
    border: 1px solid rgba(232, 150, 125, 0.28);
    background: linear-gradient(180deg, rgba(10, 22, 17, 0.9), rgba(9, 19, 15, 0.92));
    padding: 14px;
  }

  .hero-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    color: rgba(240, 237, 228, 0.75);
    font-family: var(--fd, monospace);
    font-size: 11px;
    letter-spacing: 0.8px;
  }

  .hero-meta .dot {
    color: rgba(232, 150, 125, 0.6);
    font-size: 10px;
  }

  .view-btn {
    margin-left: auto;
    border: 1px solid rgba(232, 150, 125, 0.5);
    background: rgba(232, 150, 125, 0.1);
    color: #e8967d;
    font-family: var(--fd, monospace);
    font-size: 10px;
    letter-spacing: 1px;
    padding: 6px 10px;
    cursor: pointer;
  }

  .view-btn:hover {
    background: rgba(232, 150, 125, 0.18);
  }

  .hero-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 16px;
  }

  .hero h1 {
    margin: 0;
    color: #f0ede4;
    font-family: var(--fd, monospace);
    font-size: clamp(30px, 3.8vw, 44px);
    letter-spacing: 1.5px;
    line-height: 1;
    text-shadow: 0 0 10px rgba(232, 150, 125, 0.25);
  }

  .hero p {
    margin-top: 8px;
    font-family: var(--fd, monospace);
    font-size: 12px;
    color: rgba(240, 237, 228, 0.62);
    letter-spacing: 1px;
  }

  .match-cap {
    border: 1px solid rgba(232, 150, 125, 0.46);
    background: rgba(6, 13, 10, 0.88);
    color: rgba(240, 237, 228, 0.82);
    font-family: var(--fd, monospace);
    font-size: 11px;
    padding: 9px 12px;
    min-width: 124px;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .match-cap strong {
    color: #e8967d;
    font-size: 22px;
    line-height: 1;
  }

  .mode-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
    margin-bottom: 14px;
  }

  .mode-card {
    text-align: left;
    min-height: 176px;
    padding: 16px;
    border: 1px solid rgba(232, 150, 125, 0.42);
    background: linear-gradient(180deg, rgba(13, 24, 19, 0.95), rgba(11, 20, 16, 0.95));
    color: #f0ede4;
    cursor: pointer;
    transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .mode-card:hover {
    transform: translateY(-2px);
    border-color: rgba(232, 150, 125, 0.7);
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.3);
  }

  .mode-pvp {
    border-color: rgba(0, 212, 255, 0.45);
  }

  .mode-tour {
    border-color: rgba(255, 208, 96, 0.42);
  }

  .mode-card.locked {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .mode-type {
    color: #e8967d;
    font-family: var(--fd, monospace);
    font-size: 19px;
    font-weight: 900;
    letter-spacing: 0.8px;
  }

  .mode-pvp .mode-type {
    color: #66cce6;
  }

  .mode-tour .mode-type {
    color: #dcb970;
  }

  .mode-title {
    margin-top: 12px;
    color: rgba(240, 237, 228, 0.84);
    font-family: var(--fd, monospace);
    font-size: 17px;
    letter-spacing: 0.5px;
  }

  .mode-meta {
    margin-top: 12px;
    color: rgba(240, 237, 228, 0.6);
    font-family: var(--fd, monospace);
    font-size: 12px;
  }

  .mode-meta.muted {
    color: rgba(240, 237, 228, 0.52);
  }

  .mode-enter {
    margin-top: 18px;
    color: #e8967d;
    font-family: var(--fd, monospace);
    font-size: 13px;
    letter-spacing: 1px;
  }

  .mode-card.locked .mode-enter {
    color: rgba(255, 45, 85, 0.82);
  }

  .panel {
    border: 1px solid rgba(232, 150, 125, 0.36);
    background: rgba(11, 21, 16, 0.92);
    padding: 12px;
    margin-bottom: 12px;
  }

  .panel-title {
    color: #e8967d;
    font-family: var(--fd, monospace);
    font-size: 18px;
    letter-spacing: 1px;
    margin-bottom: 10px;
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .row {
    border: 1px solid rgba(232, 150, 125, 0.22);
    background: rgba(19, 27, 24, 0.9);
    padding: 9px 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .left,
  .right {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .id,
  .vs,
  .status,
  .eta,
  .fbs,
  .dir {
    color: rgba(240, 237, 228, 0.62);
    font-family: var(--fd, monospace);
    font-size: 12px;
    white-space: nowrap;
  }

  .pair {
    color: #f0ede4;
    font-family: var(--fd, monospace);
    font-size: 14px;
  }

  .type,
  .result,
  .tag {
    font-family: var(--fd, monospace);
    font-size: 11px;
    padding: 3px 8px;
    border: 1px solid;
  }

  .type.pveTag {
    color: #e8967d;
    border-color: rgba(232, 150, 125, 0.6);
  }

  .type.pvpTag {
    color: #66cce6;
    border-color: rgba(0, 212, 255, 0.5);
  }

  .result.win {
    color: #00cc88;
    border-color: rgba(0, 255, 136, 0.62);
  }

  .result.loss {
    color: #ff5e7a;
    border-color: rgba(255, 45, 85, 0.62);
  }

  .tag {
    color: #e8967d;
    border-color: rgba(232, 150, 125, 0.5);
  }

  .lp-delta,
  .pos,
  .neg {
    font-family: var(--fd, monospace);
    font-size: 14px;
  }

  .lp-delta,
  .pos {
    color: #00cc88;
  }

  .neg {
    color: #ff5e7a;
  }

  .panel-recent {
    margin-bottom: 0;
  }

  .status-footer {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 8;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 9px 12px;
    border-top: 1px solid rgba(232, 150, 125, 0.24);
    background: rgba(7, 14, 11, 0.96);
    color: rgba(240, 237, 228, 0.7);
    font-family: var(--fd, monospace);
    font-size: 10px;
    letter-spacing: 1px;
    flex-wrap: wrap;
  }

  .online-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--grn);
    box-shadow: 0 0 8px var(--grn);
  }

  .online {
    color: #00cc88;
  }

  .lat {
    color: #66cce6;
  }

  @media (max-width: 1024px) {
    .hero-head {
      flex-direction: column;
      align-items: flex-start;
    }

    .match-cap {
      text-align: left;
      width: fit-content;
      align-items: flex-start;
    }

    .mode-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 768px) {
    .view-btn {
      margin-left: 0;
    }

    .lobby-main {
      padding: 12px 12px 84px;
    }

    .hero {
      padding: 12px;
    }

    .hero h1 {
      font-size: 30px;
    }

    .panel-title {
      font-size: 17px;
    }

    .row {
      flex-direction: column;
      align-items: flex-start;
    }

    .right {
      width: 100%;
      justify-content: flex-end;
    }
  }
</style>
