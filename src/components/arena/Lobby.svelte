<script lang="ts">
  import { onMount } from 'svelte';
  import { gameState } from '$lib/stores/gameState';
  import { sfx } from '$lib/audio/sfx';
  import { startMatch as engineStartMatch, resetPhaseInit } from '$lib/engine/gameLoop';
  import {
    listActiveTournaments,
    registerTournament,
    getTournamentBracket,
    type TournamentActiveRecord,
    type TournamentBracketMatch,
    type TournamentType,
  } from '$lib/api/arenaApi';

  const PVP_UNLOCK_MATCHES = 10;
  const TOURNAMENT_UNLOCK_LP = 500;
  const TOURNAMENT_UNLOCK_PVP_WINS = 5;

  let selectedMode: 'pve' | 'pvp' | 'tournament' = 'pve';
  let tournaments: TournamentActiveRecord[] = [];
  let tournamentsLoading = false;
  let tournamentsError: string | null = null;
  let selectedTournamentId: string | null = null;
  let bracketLoading = false;
  let bracketError: string | null = null;
  let bracketRound = 1;
  let bracketMatches: TournamentBracketMatch[] = [];
  let registerLoading = false;
  let registerMessage: string | null = null;
  let selectedTournament: TournamentActiveRecord | null = null;
  let canRegisterTournament = false;

  $: walletLabel = 'Silver';
  $: pveRecord = `${$gameState.wins}W-${$gameState.losses}L`;
  $: pvpWins = Math.max(0, Math.floor($gameState.wins * 0.65));
  $: pvpLosses = Math.max(0, Math.floor($gameState.losses * 0.35));
  $: pvpRecord = `${pvpWins}W-${pvpLosses}L`;
  $: pvpUnlocked = $gameState.matchN >= PVP_UNLOCK_MATCHES;
  $: tournamentUnlocked = $gameState.lp >= TOURNAMENT_UNLOCK_LP && pvpWins >= TOURNAMENT_UNLOCK_PVP_WINS;
  $: activeCount = Math.min(5, Math.max(1, ($gameState.matchN % 5) + 1));
  $: selectedTournament = tournaments.find((t) => t.tournamentId === selectedTournamentId) ?? tournaments[0] ?? null;
  $: canRegisterTournament =
    !!selectedTournament &&
    selectedTournament.status === 'REG_OPEN' &&
    selectedTournament.registeredPlayers < selectedTournament.maxPlayers;

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

  function modeStart(mode: 'pve' | 'pvp' | 'tournament') {
    sfx.enter();
    selectedMode = mode;

    gameState.update((s) => ({
      ...s,
      inLobby: false,
      selectedAgents: ['structure', 'vpa', 'ict', 'deriv', 'valuation', 'flow', 'senti', 'macro'],
      speed: 3
    }));

    resetPhaseInit();
    engineStartMatch();
  }

  async function loadTournaments() {
    tournamentsLoading = true;
    tournamentsError = null;
    try {
      const res = await listActiveTournaments(12);
      tournaments = res.records;
      if (!selectedTournamentId && tournaments.length > 0) {
        selectedTournamentId = tournaments[0].tournamentId;
      }
    } catch (err) {
      tournamentsError = err instanceof Error ? err.message : '토너먼트 목록 로드 실패';
      tournaments = [];
    } finally {
      tournamentsLoading = false;
    }
  }

  async function loadBracket(tournamentId: string) {
    bracketLoading = true;
    bracketError = null;
    registerMessage = null;
    try {
      const res = await getTournamentBracket(tournamentId);
      bracketRound = res.round;
      bracketMatches = res.matches;
    } catch (err) {
      bracketError = err instanceof Error ? err.message : '브래킷 로드 실패';
      bracketMatches = [];
    } finally {
      bracketLoading = false;
    }
  }

  async function openTournamentPanel() {
    selectedMode = 'tournament';
    await loadTournaments();
    if (selectedTournamentId) {
      await loadBracket(selectedTournamentId);
    }
  }

  async function chooseTournament(tournamentId: string) {
    selectedTournamentId = tournamentId;
    await loadBracket(tournamentId);
  }

  async function onTournamentRegister() {
    if (!selectedTournamentId) return;
    registerLoading = true;
    registerMessage = null;
    try {
      const res = await registerTournament(selectedTournamentId);
      const lpLabel = res.lpDelta === 0 ? '' : ` · ${res.lpDelta > 0 ? '+' : ''}${res.lpDelta} LP`;
      registerMessage = `등록 완료 · Seed #${res.seed}${lpLabel}`;
      await loadTournaments();
      await loadBracket(selectedTournamentId);
    } catch (err) {
      registerMessage = err instanceof Error ? err.message : '토너먼트 등록 실패';
    } finally {
      registerLoading = false;
    }
  }

  function formatStartAt(iso: string): string {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '-';
    return d.toLocaleString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  function formatTournamentType(type: TournamentType): string {
    if (type === 'DAILY_SPRINT') return 'Daily Sprint';
    if (type === 'WEEKLY_CUP') return 'Weekly Cup';
    if (type === 'SEASON_CHAMPIONSHIP') return 'Season Championship';
    return type;
  }

  function enterMode(mode: 'pve' | 'pvp' | 'tournament') {
    if (mode === 'pvp' && !pvpUnlocked) return;
    if (mode === 'tournament' && !tournamentUnlocked) return;

    if (mode === 'tournament') {
      openTournamentPanel();
      return;
    }

    modeStart(mode);
  }

  function startTournamentRound() {
    if (!selectedTournamentId) return;
    modeStart('tournament');
  }

  onMount(() => {
    loadTournaments();
  });
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

    {#if selectedMode === 'tournament' && tournamentUnlocked}
      <section class="panel panel-tournament">
        <div class="panel-title panel-title-inline">
          <span>WEEKLY TOURNAMENT</span>
          <div class="tour-header-actions">
            <button class="tour-action-btn" on:click={loadTournaments} disabled={tournamentsLoading}>새로고침</button>
            <button class="tour-action-btn primary" on:click={startTournamentRound} disabled={!selectedTournamentId}>라운드 시작 →</button>
          </div>
        </div>

        {#if tournamentsLoading}
          <div class="tour-empty">토너먼트 목록 로딩 중...</div>
        {:else if tournamentsError}
          <div class="tour-empty tour-error">{tournamentsError}</div>
        {:else if tournaments.length === 0}
          <div class="tour-empty">현재 등록 가능한 토너먼트가 없습니다.</div>
        {:else}
          <div class="tour-layout">
            <div class="tour-list">
              {#each tournaments as t}
                <button
                  class="tour-item"
                  class:active={selectedTournamentId === t.tournamentId}
                  on:click={() => chooseTournament(t.tournamentId)}
                >
                  <div class="tour-row top">
                    <span class="tour-type">{formatTournamentType(t.type)}</span>
                    <span class="tour-status">{t.status}</span>
                  </div>
                  <div class="tour-row mid">
                    <span class="tour-pair">{t.pair}</span>
                    <span class="tour-time">{formatStartAt(t.startAt)}</span>
                  </div>
                  <div class="tour-row bottom">
                    <span>{t.registeredPlayers}/{t.maxPlayers}명</span>
                    <span>Entry {t.entryFeeLp} LP</span>
                  </div>
                </button>
              {/each}
            </div>

            <div class="tour-bracket">
              <div class="tour-bracket-head">
                <div>
                  <div class="tour-bracket-title">{selectedTournament ? selectedTournament.pair : '-'}</div>
                  <div class="tour-bracket-sub">Round {bracketRound} · Bracket</div>
                </div>
                <button
                  class="tour-register-btn"
                  on:click={onTournamentRegister}
                  disabled={!canRegisterTournament || registerLoading}
                >
                  {registerLoading ? '등록 중...' : canRegisterTournament ? '등록하기' : '등록 마감'}
                </button>
              </div>

              {#if registerMessage}
                <div class="tour-register-msg">{registerMessage}</div>
              {/if}

              {#if bracketLoading}
                <div class="tour-empty">브래킷 로딩 중...</div>
              {:else if bracketError}
                <div class="tour-empty tour-error">{bracketError}</div>
              {:else if bracketMatches.length === 0}
                <div class="tour-empty">참가자가 모이면 브래킷이 생성됩니다.</div>
              {:else}
                <div class="tour-bracket-rows">
                  {#each bracketMatches as m}
                    <div class="tour-bracket-row">
                      <div class="slot">{m.matchIndex}</div>
                      <div class="players">
                        <span>{m.userA ? m.userA.nickname : 'TBD'}</span>
                        <span>vs</span>
                        <span>{m.userB ? m.userB.nickname : 'BYE'}</span>
                      </div>
                      <div class="winner">{m.winnerId ? '완료' : '대기'}</div>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </section>
    {/if}

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

  .panel-title-inline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .tour-header-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .tour-action-btn {
    border: 1px solid rgba(232, 150, 125, 0.45);
    background: rgba(232, 150, 125, 0.08);
    color: #e8967d;
    font-family: var(--fd, monospace);
    font-size: 10px;
    letter-spacing: 0.8px;
    padding: 7px 11px;
    cursor: pointer;
  }

  .tour-action-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .tour-action-btn.primary {
    border-color: rgba(0, 212, 255, 0.55);
    background: rgba(0, 212, 255, 0.09);
    color: #66cce6;
  }

  .tour-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
    gap: 12px;
  }

  .tour-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 210px;
  }

  .tour-item {
    width: 100%;
    text-align: left;
    border: 1px solid rgba(220, 185, 112, 0.28);
    background: rgba(16, 26, 22, 0.9);
    padding: 10px;
    color: rgba(240, 237, 228, 0.9);
    cursor: pointer;
  }

  .tour-item.active {
    border-color: rgba(232, 150, 125, 0.66);
    box-shadow: inset 0 0 0 1px rgba(232, 150, 125, 0.18);
  }

  .tour-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }

  .tour-row + .tour-row {
    margin-top: 6px;
  }

  .tour-type {
    color: #dcb970;
    font-family: var(--fd, monospace);
    font-size: 12px;
  }

  .tour-status {
    color: rgba(240, 237, 228, 0.58);
    font-family: var(--fd, monospace);
    font-size: 10px;
  }

  .tour-pair {
    color: #f0ede4;
    font-family: var(--fd, monospace);
    font-size: 14px;
  }

  .tour-time,
  .tour-row.bottom span {
    color: rgba(240, 237, 228, 0.62);
    font-family: var(--fd, monospace);
    font-size: 11px;
  }

  .tour-bracket {
    border: 1px solid rgba(0, 212, 255, 0.24);
    background: rgba(12, 23, 19, 0.9);
    padding: 10px;
    min-height: 210px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .tour-bracket-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }

  .tour-bracket-title {
    color: #66cce6;
    font-family: var(--fd, monospace);
    font-size: 16px;
  }

  .tour-bracket-sub {
    color: rgba(240, 237, 228, 0.58);
    font-family: var(--fd, monospace);
    font-size: 11px;
  }

  .tour-register-btn {
    border: 1px solid rgba(220, 185, 112, 0.62);
    background: rgba(220, 185, 112, 0.12);
    color: #dcb970;
    font-family: var(--fd, monospace);
    font-size: 11px;
    letter-spacing: 0.8px;
    padding: 8px 12px;
    cursor: pointer;
  }

  .tour-register-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .tour-register-msg {
    border: 1px solid rgba(0, 255, 136, 0.3);
    background: rgba(0, 255, 136, 0.08);
    color: #00cc88;
    padding: 7px 10px;
    font-family: var(--fd, monospace);
    font-size: 11px;
  }

  .tour-bracket-rows {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .tour-bracket-row {
    border: 1px solid rgba(102, 204, 230, 0.26);
    background: rgba(17, 28, 24, 0.86);
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr) 48px;
    gap: 8px;
    align-items: center;
    padding: 8px 9px;
  }

  .tour-bracket-row .slot {
    color: #66cce6;
    font-family: var(--fd, monospace);
    font-size: 12px;
    text-align: center;
  }

  .tour-bracket-row .players {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    color: #f0ede4;
    font-family: var(--fd, monospace);
    font-size: 11px;
    min-width: 0;
  }

  .tour-bracket-row .winner {
    color: rgba(240, 237, 228, 0.62);
    font-family: var(--fd, monospace);
    font-size: 10px;
    text-align: right;
  }

  .tour-empty {
    color: rgba(240, 237, 228, 0.65);
    font-family: var(--fd, monospace);
    font-size: 12px;
    padding: 14px 8px;
    text-align: center;
    border: 1px dashed rgba(240, 237, 228, 0.2);
    background: rgba(13, 21, 18, 0.85);
  }

  .tour-error {
    color: #ff5e7a;
    border-color: rgba(255, 94, 122, 0.4);
    background: rgba(255, 94, 122, 0.09);
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

    .tour-layout {
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

    .panel-title-inline {
      align-items: flex-start;
      flex-direction: column;
    }

    .tour-header-actions {
      width: 100%;
      flex-wrap: wrap;
    }

    .row {
      flex-direction: column;
      align-items: flex-start;
    }

    .right {
      width: 100%;
      justify-content: flex-end;
    }

    .tour-bracket-row {
      grid-template-columns: 24px minmax(0, 1fr) 38px;
      padding: 7px 8px;
    }

    .tour-bracket-row .players {
      font-size: 10px;
    }
  }
</style>
