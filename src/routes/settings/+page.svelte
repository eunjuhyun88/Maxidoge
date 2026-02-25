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

  let state = $gameState;
  $: state = $gameState;
  let saving = false;
  let loadedRemote = false;

  // Settings
  let settings = {
    defaultTF: normalizeTimeframe(state.timeframe),
    signals: true,
    sfx: true,
    dataSource: 'binance',
    chartTheme: 'dark',
    speed: state.speed || 3,
    language: 'kr'
  };
  $: {
    const normalized = normalizeTimeframe(state.timeframe);
    if (settings.defaultTF !== normalized) {
      settings = { ...settings, defaultTF: normalized };
    }
  }

  async function persistPreferences(currentSettings = settings) {
    saving = true;
    await updatePreferencesApi({
      defaultPair: state.pair,
      defaultTimeframe: normalizeTimeframe(currentSettings.defaultTF),
      battleSpeed: Number(currentSettings.speed || 3),
      signalsEnabled: Boolean(currentSettings.signals),
      sfxEnabled: Boolean(currentSettings.sfx),
      chartTheme: currentSettings.chartTheme,
      dataSource: currentSettings.dataSource,
      language: currentSettings.language
    });
    saving = false;
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

  function resetAllData() {
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
    <p class="settings-sync">
      {#if saving}Saving to cloud...{:else if loadedRemote}Synced with account settings{:else}Local mode{/if}
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
        <select class="sr-select" bind:value={settings.defaultTF} on:change={() => updateSetting('defaultTF', settings.defaultTF)}>
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
        <select class="sr-select" bind:value={settings.dataSource} on:change={() => updateSetting('dataSource', settings.dataSource)}>
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
              on:click={() => updateSetting('speed', s)}
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
        <select class="sr-select" bind:value={settings.chartTheme} on:change={() => updateSetting('chartTheme', settings.chartTheme)}>
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </select>
      </div>

      <div class="setting-row">
        <div class="sr-info">
          <div class="sr-label">Language</div>
          <div class="sr-desc">Interface language</div>
        </div>
        <select class="sr-select" bind:value={settings.language} on:change={() => updateSetting('language', settings.language)}>
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
          on:click={() => { settings.signals = !settings.signals; updateSetting('signals', settings.signals); }}
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
          on:click={() => { settings.sfx = !settings.sfx; updateSetting('sfx', settings.sfx); }}
        >
          <div class="toggle-dot"></div>
        </button>
      </div>
    </div>

    <!-- Account Stats -->
    <div class="settings-section">
      <div class="ss-title">📋 ACCOUNT</div>
      <div class="account-stats">
        <div class="as-row"><span>Matches Played</span><span class="as-val">{state.matchN}</span></div>
        <div class="as-row"><span>Total Wins</span><span class="as-val up">{state.wins}</span></div>
        <div class="as-row"><span>Total Losses</span><span class="as-val dn">{state.losses}</span></div>
        <div class="as-row"><span>Current LP</span><span class="as-val">{state.lp.toLocaleString()}</span></div>
        <div class="as-row"><span>Current Streak</span><span class="as-val fire">🔥 {state.streak}</span></div>
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
        <button class="reset-btn" on:click={resetAllData}>🗑 RESET</button>
      </div>
    </div>
  </div>
</div>

<style>
  .settings-page {
    height: 100%;
    overflow-y: auto;
    background: linear-gradient(180deg, #ffe600, #ffcc00);
  }

  .settings-header {
    padding: 24px 30px;
    border-bottom: 4px solid #000;
    background: linear-gradient(135deg, #ffe600, #ffaa00);
  }
  .settings-title {
    font-family: var(--fc);
    font-size: 28px;
    color: #000;
    -webkit-text-stroke: 1px #000;
    letter-spacing: 3px;
  }
  .settings-sub {
    font-family: var(--fm);
    font-size: 10px;
    color: #555;
    letter-spacing: 2px;
    margin-top: 4px;
  }
  .settings-sync {
    font-family: var(--fm);
    font-size: 8px;
    color: #333;
    margin-top: 4px;
    letter-spacing: 1px;
  }

  .settings-body {
    max-width: 600px;
    margin: 0 auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .settings-section {
    background: #fff;
    border: 3px solid #000;
    border-radius: 12px;
    box-shadow: 4px 4px 0 #000;
    overflow: hidden;
  }
  .settings-section.danger {
    border-color: #cc0033;
    box-shadow: 4px 4px 0 rgba(204,0,51,.3);
  }

  .ss-title {
    font-family: var(--fc);
    font-size: 14px;
    letter-spacing: 2px;
    color: #000;
    padding: 10px 14px;
    border-bottom: 2px solid rgba(0,0,0,.1);
    background: rgba(0,0,0,.02);
  }

  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    border-bottom: 1px solid rgba(0,0,0,.06);
  }
  .setting-row:last-child { border-bottom: none; }

  .sr-info { flex: 1; }
  .sr-label { font-family: var(--fm); font-size: 10px; font-weight: 900; color: #000; }
  .sr-desc { font-family: var(--fm); font-size: 7px; color: #888; margin-top: 1px; }

  .sr-select {
    font-family: var(--fm); font-size: 9px; font-weight: 700;
    padding: 4px 10px; border: 2px solid #000; border-radius: 8px;
    background: #fff; box-shadow: 2px 2px 0 #000; cursor: pointer;
  }

  .speed-btns { display: flex; gap: 3px; }
  .speed-btn {
    font-family: var(--fm); font-size: 9px; font-weight: 900;
    width: 32px; height: 28px;
    border: 2px solid #000; border-radius: 6px;
    background: #fff; cursor: pointer; transition: all .15s;
    box-shadow: 2px 2px 0 #000;
  }
  .speed-btn.active { background: var(--pk); color: #fff; }

  .toggle-btn {
    width: 42px; height: 22px;
    border-radius: 11px;
    border: 2px solid #000;
    background: #ddd;
    cursor: pointer;
    position: relative;
    transition: background .2s;
    box-shadow: 2px 2px 0 #000;
    padding: 0;
  }
  .toggle-btn.on { background: var(--grn); }
  .toggle-dot {
    width: 16px; height: 16px;
    border-radius: 50%;
    background: #fff;
    border: 2px solid #000;
    position: absolute;
    top: 1px; left: 1px;
    transition: left .2s;
  }
  .toggle-btn.on .toggle-dot { left: 21px; }

  /* Account Stats */
  .account-stats { padding: 10px 14px; }
  .as-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 4px 0;
    font-family: var(--fm); font-size: 9px; color: #555;
    border-bottom: 1px solid rgba(0,0,0,.04);
  }
  .as-row:last-child { border-bottom: none; }
  .as-val { font-weight: 900; color: #000; }
  .as-val.up { color: #00aa44; }
  .as-val.dn { color: #cc0033; }
  .as-val.fire { color: #ff8c3b; }

  .reset-btn {
    font-family: var(--fm); font-size: 9px; font-weight: 900; letter-spacing: 1px;
    padding: 6px 14px; border-radius: 8px;
    background: #cc0033; color: #fff;
    border: 2px solid #000;
    box-shadow: 2px 2px 0 #000;
    cursor: pointer; transition: all .15s;
  }
  .reset-btn:hover { transform: translate(-1px, -1px); box-shadow: 3px 3px 0 #000; }
</style>
