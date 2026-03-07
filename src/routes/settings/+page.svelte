<script lang="ts">
  import { onMount } from 'svelte';
  import { gameState } from '$lib/stores/gameState';
  import { RESETTABLE_STORAGE_KEYS } from '$lib/stores/storageKeys';
  import {
    CORE_TIMEFRAME_OPTIONS,
    formatTimeframeLabel,
    normalizeTimeframe,
  } from '$lib/utils/timeframe';
  import { fetchPreferencesApi, updatePreferencesApi } from '$lib/api/preferencesApi';

  const gameStateVal = $derived($gameState);
  let saving = $state(false);
  let loadedRemote = $state(false);

  // Settings
  let settings = $state({
    defaultTF: normalizeTimeframe($gameState.timeframe),
    signals: true,
    sfx: true,
    dataSource: 'binance',
    chartTheme: 'dark',
    speed: $gameState.speed || 3,
    language: 'kr'
  });
  $effect(() => {
    const normalized = normalizeTimeframe(gameStateVal.timeframe);
    if (settings.defaultTF !== normalized) {
      settings = { ...settings, defaultTF: normalized };
    }
  });

  async function persistPreferences(currentSettings = settings) {
    saving = true;
    await updatePreferencesApi({
      defaultPair: gameStateVal.pair,
      defaultTimeframe: normalizeTimeframe(currentSettings.defaultTF),
      battleSpeed: Number(currentSettings.speed || 3),
      signalsEnabled: Boolean(currentSettings.signals),
      sfxEnabled: Boolean(currentSettings.sfx),
      chartTheme: currentSettings.chartTheme,
      dataSource: currentSettings.dataSource,
      language: currentSettings.language
    });
    saving = false;
    savedFlash = true;
    setTimeout(() => { savedFlash = false; }, 1200);
  }

  let _persistTimer: ReturnType<typeof setTimeout> | null = null;
  function queuePersist() {
    if (_persistTimer) clearTimeout(_persistTimer);
    _persistTimer = setTimeout(() => {
      persistPreferences(settings);
    }, 250);
  }

  function updateSetting(key: string, value: any) {
    const next = { ...settings, [key]: value };
    settings = next;
    if (key === 'speed') {
      gameState.update(s => ({ ...s, speed: value }));
    }
    if (key === 'defaultTF') {
      const timeframe = normalizeTimeframe(value);
      gameState.update(s => ({ ...s, timeframe }));
    }
    queuePersist();
  }

  let resetConfirm = $state(false);
  let _resetTimer: ReturnType<typeof setTimeout> | null = null;
  let savedFlash = $state(false);

  function resetAllData() {
    if (!resetConfirm) {
      resetConfirm = true;
      _resetTimer = setTimeout(() => { resetConfirm = false; }, 3000);
      return;
    }
    if (_resetTimer) clearTimeout(_resetTimer);
    if (typeof window !== 'undefined') {
      for (const key of RESETTABLE_STORAGE_KEYS) {
        localStorage.removeItem(key);
      }
      window.location.reload();
    }
  }

  onMount(async () => {
    const remote = await fetchPreferencesApi();
    if (!remote) return;

    settings = {
      ...settings,
      defaultTF: normalizeTimeframe(remote.defaultTimeframe),
      signals: Boolean(remote.signalsEnabled),
      sfx: Boolean(remote.sfxEnabled),
      dataSource: remote.dataSource || settings.dataSource,
      chartTheme: remote.chartTheme || settings.chartTheme,
      speed: Number(remote.battleSpeed || settings.speed),
      language: remote.language || settings.language
    };

    gameState.update((s) => ({
      ...s,
      pair: remote.defaultPair || s.pair,
      timeframe: normalizeTimeframe(remote.defaultTimeframe),
      speed: Number(remote.battleSpeed || s.speed || 3)
    }));

    loadedRemote = true;
  });
</script>

<div class="settings-page">
  <div class="settings-header">
    <h1 class="settings-title">⚙️ SETTINGS</h1>
    <p class="settings-sub">Configure your Stockclaw experience</p>
    <p class="settings-sync" class:saved-flash={savedFlash}>
      {#if saving}Saving to cloud...{:else if savedFlash}✓ Saved{:else if loadedRemote}Synced with account settings{:else}Local mode{/if}
    </p>
  </div>

  <div class="settings-body">
    <!-- Trading Settings -->
    <div class="settings-section">
      <div class="ss-title">📊 TRADING</div>

      <div class="setting-row">
        <div class="sr-info">
          <div class="sr-label">Default Timeframe</div>
          <div class="sr-desc">Set default chart timeframe</div>
        </div>
        <select class="sr-select" bind:value={settings.defaultTF} onchange={() => updateSetting('defaultTF', settings.defaultTF)}>
          {#each CORE_TIMEFRAME_OPTIONS as option}
            <option value={option.value}>{formatTimeframeLabel(option.value)}</option>
          {/each}
        </select>
      </div>

      <div class="setting-row">
        <div class="sr-info">
          <div class="sr-label">Data Source</div>
          <div class="sr-desc">Real-time market data provider</div>
        </div>
        <select class="sr-select" bind:value={settings.dataSource} onchange={() => updateSetting('dataSource', settings.dataSource)}>
          <option value="binance">Binance Futures</option>
          <option value="simulation">Simulation</option>
        </select>
      </div>

      <div class="setting-row">
        <div class="sr-info">
          <div class="sr-label">Game Speed</div>
          <div class="sr-desc">Arena battle speed multiplier</div>
        </div>
        <div class="speed-btns">
          {#each [1, 2, 3] as s}
            <button
              class="speed-btn"
              class:active={settings.speed === s}
              onclick={() => updateSetting('speed', s)}
            >{s}x</button>
          {/each}
        </div>
      </div>
    </div>

    <!-- Display Settings -->
    <div class="settings-section">
      <div class="ss-title">🎨 DISPLAY</div>

      <div class="setting-row">
        <div class="sr-info">
          <div class="sr-label">Chart Theme</div>
          <div class="sr-desc">Chart color scheme</div>
        </div>
        <select class="sr-select" bind:value={settings.chartTheme} onchange={() => updateSetting('chartTheme', settings.chartTheme)}>
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </select>
      </div>

      <div class="setting-row">
        <div class="sr-info">
          <div class="sr-label">Language</div>
          <div class="sr-desc">Interface language</div>
        </div>
        <select class="sr-select" bind:value={settings.language} onchange={() => updateSetting('language', settings.language)}>
          <option value="kr">한국어</option>
          <option value="en">English</option>
        </select>
      </div>
    </div>

    <!-- Notifications -->
    <div class="settings-section">
      <div class="ss-title">🔔 NOTIFICATIONS</div>

      <div class="setting-row">
        <div class="sr-info">
          <div class="sr-label">Signal Alerts</div>
          <div class="sr-desc">Receive trade signal notifications</div>
        </div>
        <button
          class="toggle-btn"
          class:on={settings.signals}
          aria-label="Toggle signal alerts"
          onclick={() => { settings.signals = !settings.signals; updateSetting('signals', settings.signals); }}
        >
          <div class="toggle-dot"></div>
        </button>
      </div>

      <div class="setting-row">
        <div class="sr-info">
          <div class="sr-label">Sound Effects</div>
          <div class="sr-desc">Arena SFX and notifications</div>
        </div>
        <button
          class="toggle-btn"
          class:on={settings.sfx}
          aria-label="Toggle sound effects"
          onclick={() => { settings.sfx = !settings.sfx; updateSetting('sfx', settings.sfx); }}
        >
          <div class="toggle-dot"></div>
        </button>
      </div>
    </div>

    <!-- Account Stats -->
    <div class="settings-section">
      <div class="ss-title">📋 ACCOUNT</div>
      <div class="account-stats">
        <div class="as-row"><span>Matches Played</span><span class="as-val">{gameStateVal.matchN}</span></div>
        <div class="as-row"><span>Total Wins</span><span class="as-val up">{gameStateVal.wins}</span></div>
        <div class="as-row"><span>Total Losses</span><span class="as-val dn">{gameStateVal.losses}</span></div>
        <div class="as-row"><span>Current LP</span><span class="as-val">{gameStateVal.lp.toLocaleString()}</span></div>
        <div class="as-row"><span>Current Streak</span><span class="as-val fire">🔥 {gameStateVal.streak}</span></div>
      </div>
    </div>

    <!-- Danger Zone -->
    <div class="settings-section danger">
      <div class="ss-title">⚠️ DANGER ZONE</div>
      <div class="setting-row">
        <div class="sr-info">
          <div class="sr-label">Reset All Data</div>
          <div class="sr-desc">Delete all saved progress and start fresh</div>
        </div>
        <button class="reset-btn" class:confirm={resetConfirm} onclick={resetAllData}>
          {resetConfirm ? '⚠️ CONFIRM RESET?' : '🗑 RESET'}
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .settings-page {
    height: 100%;
    overflow-y: auto;
    background: #00120a;
    padding-bottom: var(--sc-bottom-bar-h);
  }

  .settings-header {
    padding: var(--sc-sp-6) 30px;
    border-bottom: 1px solid rgba(232,150,125,.15);
    background: linear-gradient(135deg, rgba(232,150,125,.15), rgba(232,150,125,.05));
  }
  .settings-title {
    font-family: var(--fc);
    font-size: var(--sc-fs-3xl, 28px);
    color: #E8967D;
    letter-spacing: 3px;
  }
  .settings-sub {
    font-family: var(--fm);
    font-size: var(--sc-fs-xs, 10px);
    color: rgba(240,237,228,.5);
    letter-spacing: 2px;
    margin-top: 4px;
  }
  .settings-sync {
    font-family: var(--fm);
    font-size: var(--sc-fs-2xs, 9px);
    color: rgba(240,237,228,.5);
    margin-top: 4px;
    letter-spacing: 1px;
  }

  .settings-body {
    max-width: 600px;
    margin: 0 auto;
    padding: var(--sc-sp-5);
    display: flex;
    flex-direction: column;
    gap: var(--sc-sp-4);
  }

  .settings-section {
    background: rgba(255,255,255,.03);
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 12px;
    box-shadow: none;
    overflow: hidden;
  }
  .settings-section.danger {
    border-color: rgba(255,45,85,.3);
    box-shadow: none;
  }

  .ss-title {
    font-family: var(--fc);
    font-size: var(--sc-fs-md, 14px);
    letter-spacing: 2px;
    color: #E8967D;
    padding: 10px 14px;
    border-bottom: 1px solid rgba(255,255,255,.06);
    background: rgba(255,255,255,.02);
  }

  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    border-bottom: 1px solid rgba(255,255,255,.04);
  }
  .setting-row:last-child { border-bottom: none; }

  .sr-info { flex: 1; }
  .sr-label { font-family: var(--fm); font-size: 10px; font-weight: 900; color: #F0EDE4; }
  .sr-desc { font-family: var(--fm); font-size: 9px; color: rgba(240,237,228,.55); margin-top: 1px; }

  .sr-select {
    font-family: var(--fm); font-size: 9px; font-weight: 700;
    padding: 4px 10px; border: 1px solid rgba(255,255,255,.15); border-radius: 8px;
    background: rgba(255,255,255,.05); color: #F0EDE4; cursor: pointer;
  }

  .speed-btns { display: flex; gap: 3px; }
  .speed-btn {
    font-family: var(--fm); font-size: 9px; font-weight: 900;
    width: 32px; height: 28px;
    border: 1px solid rgba(255,255,255,.15); border-radius: 6px;
    background: rgba(255,255,255,.05); color: rgba(240,237,228,.55);
    cursor: pointer; transition: all .15s;
  }
  .speed-btn.active { background: rgba(232,150,125,.2); color: #E8967D; border-color: rgba(232,150,125,.4); }

  .toggle-btn {
    width: 42px; height: 22px;
    border-radius: 11px;
    border: 1px solid rgba(255,255,255,.15);
    background: rgba(255,255,255,.08);
    cursor: pointer;
    position: relative;
    transition: background .2s, border-color .2s;
    padding: 0;
  }
  .toggle-btn.on { background: var(--grn); border-color: rgba(0,255,136,.4); }
  .toggle-dot {
    width: 16px; height: 16px;
    border-radius: 50%;
    background: #F0EDE4;
    border: 1px solid rgba(0,0,0,.2);
    position: absolute;
    top: 2px; left: 2px;
    transition: left .2s;
  }
  .toggle-btn.on .toggle-dot { left: 22px; }

  /* Account Stats */
  .account-stats { padding: 10px 14px; }
  .as-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 4px 0;
    font-family: var(--fm); font-size: 9px; color: rgba(240,237,228,.45);
    border-bottom: 1px solid rgba(255,255,255,.04);
  }
  .as-row:last-child { border-bottom: none; }
  .as-val { font-weight: 900; color: #F0EDE4; }
  .as-val.up { color: var(--grn); }
  .as-val.dn { color: var(--red); }
  .as-val.fire { color: #E8967D; }

  .reset-btn {
    font-family: var(--fm); font-size: 9px; font-weight: 900; letter-spacing: 1px;
    padding: 6px 14px; border-radius: 8px;
    background: rgba(255,45,85,.2); color: var(--red);
    border: 1px solid rgba(255,45,85,.35);
    cursor: pointer; transition: all .15s;
  }
  .reset-btn:hover { background: rgba(255,45,85,.3); }
  .reset-btn.confirm {
    background: rgba(255,45,85,.4);
    border-color: rgba(255,45,85,.7);
    color: #fff;
    animation: resetPulse 0.6s ease;
  }
  @keyframes resetPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }

  .saved-flash {
    color: var(--grn, #00ff88) !important;
    transition: color 0.3s ease;
  }

  /* ── Touch targets (coarse pointer) ── */
  @media (pointer: coarse) {
    .sr-select { min-height: var(--sc-touch-sm, 36px); padding: 6px 12px; font-size: 11px; }
    .speed-btn { min-width: 36px; min-height: var(--sc-touch-sm, 36px); }
    .toggle-btn { width: 48px; height: 26px; border-radius: 13px; }
    .toggle-dot { width: 18px; height: 18px; top: 3px; left: 3px; }
    .toggle-btn.on .toggle-dot { left: 25px; }
    .reset-btn { min-height: var(--sc-touch-sm, 36px); padding: 8px 16px; }
    .setting-row { min-height: 48px; }
  }

  /* ── Tablet ≤768px ── */
  @media (max-width: 768px) {
    .settings-header { padding: 18px 20px; }
    .settings-title { font-size: clamp(20px, 5vw, 28px); letter-spacing: 2px; }
    .settings-body { padding: 14px 10px; gap: 12px; }
    .settings-section { border-radius: 10px; }
    .ss-title { font-size: 12px; padding: 8px 12px; }
    .setting-row { padding: 10px 12px; }
    .settings-page { padding-bottom: 0; }
  }

  /* ── Small Mobile ≤480px ── */
  @media (max-width: 480px) {
    .settings-header { padding: 14px 14px; }
    .settings-title { font-size: clamp(16px, 4.5vw, 22px); letter-spacing: 1.5px; }
    .settings-sub { font-size: var(--sc-fs-2xs, 9px); letter-spacing: 1px; }
    .settings-sync { font-size: var(--sc-fs-2xs, 9px); }
    .settings-body { padding: 10px 6px; gap: 10px; }
    .settings-section { border-radius: 8px; }
    .ss-title { font-size: 11px; padding: 7px 10px; letter-spacing: 1.5px; }
    .setting-row { padding: 8px 10px; gap: 8px; }
    .sr-label { font-size: var(--sc-fs-2xs, 9px); }
    .sr-desc { font-size: var(--sc-fs-2xs, 9px); }
    .sr-select { font-size: var(--sc-fs-2xs, 9px); padding: 4px 8px; }
    .speed-btn { width: 30px; height: 28px; font-size: var(--sc-fs-2xs, 9px); }
    .account-stats { padding: 8px 10px; }
    .as-row { font-size: var(--sc-fs-2xs, 9px); padding: 3px 0; }
    .reset-btn { font-size: var(--sc-fs-2xs, 9px); padding: 5px 10px; }
  }
</style>
