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

<div class="settings-page tm-page-shell tm-scroll">
  <div class="settings-header">
    <h1 class="settings-title">⚙️ SETTINGS</h1>
    <p class="settings-sub">Configure your MAXI⚡DOGE experience</p>
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
    min-height: 100%;
    overflow-y: auto;
    padding-bottom: 24px;
    background:
      radial-gradient(circle at 14% 10%, rgba(241,164,136,0.22), transparent 38%),
      radial-gradient(circle at 86% 6%, rgba(136,200,255,0.16), transparent 34%),
      linear-gradient(180deg, var(--tm-bg-1), var(--tm-bg-0));
  }

  .settings-header {
    padding: 26px clamp(16px, 3vw, 34px) 20px;
    border-bottom: 1px solid var(--tm-border);
    background:
      linear-gradient(180deg, rgba(10,24,35,0.9), rgba(9,20,30,0.76)),
      radial-gradient(circle at 82% -20%, rgba(241,164,136,0.32), transparent 46%);
    backdrop-filter: blur(8px);
  }
  .settings-title {
    font-family: var(--fd);
    font-size: clamp(28px, 3.8vw, 40px);
    color: var(--tm-text-high);
    letter-spacing: 0.06em;
    text-shadow: 0 8px 20px rgba(0,0,0,0.35);
  }
  .settings-sub {
    font-family: var(--fb);
    font-size: clamp(13px, 1.3vw, 15px);
    color: var(--tm-text-mid);
    letter-spacing: 0.01em;
    margin-top: 8px;
  }
  .settings-sync {
    font-family: var(--fm);
    font-size: 11px;
    color: var(--tm-text-low);
    margin-top: 8px;
    letter-spacing: 0.03em;
  }

  .settings-body {
    max-width: 760px;
    margin: 0 auto;
    padding: clamp(16px, 2.4vw, 28px) clamp(14px, 2vw, 24px);
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .settings-section {
    background: var(--tm-surface);
    border: 1px solid var(--tm-border);
    border-radius: 14px;
    box-shadow: 0 16px 30px rgba(0,0,0,.24);
    overflow: hidden;
    backdrop-filter: blur(7px);
  }
  .settings-section.danger {
    border-color: rgba(255, 114, 129, 0.45);
    box-shadow: 0 16px 28px rgba(110, 20, 32, 0.3);
  }

  .ss-title {
    font-family: var(--fd);
    font-size: 15px;
    letter-spacing: 0.05em;
    color: var(--tm-text-high);
    padding: 12px 16px;
    border-bottom: 1px solid rgba(172,206,240,0.2);
    background: rgba(7,16,26,0.45);
  }

  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 16px;
    border-bottom: 1px solid rgba(172,206,240,0.12);
  }
  .setting-row:last-child { border-bottom: none; }

  .sr-info { flex: 1; }
  .sr-label { font-family: var(--fb); font-size: 13px; font-weight: 700; color: var(--tm-text-high); }
  .sr-desc { font-family: var(--fb); font-size: 11px; color: var(--tm-text-low); margin-top: 3px; }

  .sr-select {
    font-family: var(--fm);
    font-size: 12px;
    font-weight: 600;
    padding: 8px 12px;
    border: 1px solid rgba(172,206,240,0.34);
    border-radius: 10px;
    background: rgba(7,16,27,0.75);
    color: var(--tm-text-high);
    cursor: pointer;
  }

  .speed-btns { display: flex; gap: 3px; }
  .speed-btn {
    font-family: var(--fm);
    font-size: 11px;
    font-weight: 800;
    width: 36px;
    height: 30px;
    border: 1px solid rgba(172,206,240,0.35);
    border-radius: 8px;
    background: rgba(7,16,27,0.75);
    color: var(--tm-text-mid);
    cursor: pointer;
    transition: all .15s;
  }
  .speed-btn.active {
    background: linear-gradient(135deg, rgba(136,200,255,0.42), rgba(241,164,136,0.4));
    color: var(--tm-text-high);
    border-color: rgba(241,164,136,0.58);
  }

  .toggle-btn {
    width: 42px; height: 22px;
    border-radius: 11px;
    border: 1px solid rgba(172,206,240,0.35);
    background: rgba(7,16,27,0.82);
    cursor: pointer;
    position: relative;
    transition: background .2s;
    padding: 0;
  }
  .toggle-btn.on {
    background: linear-gradient(135deg, rgba(136,200,255,0.58), rgba(90,190,150,0.6));
    border-color: rgba(136,200,255,0.66);
  }
  .toggle-dot {
    width: 16px; height: 16px;
    border-radius: 50%;
    background: var(--tm-text-high);
    border: 1px solid rgba(7,16,27,0.75);
    position: absolute;
    top: 1px; left: 1px;
    transition: left .2s;
  }
  .toggle-btn.on .toggle-dot { left: 21px; }

  /* Account Stats */
  .account-stats { padding: 10px 14px; }
  .as-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 7px 0;
    font-family: var(--fm); font-size: 11px; color: var(--tm-text-low);
    border-bottom: 1px solid rgba(172,206,240,0.12);
  }
  .as-row:last-child { border-bottom: none; }
  .as-val { font-weight: 800; color: var(--tm-text-high); }
  .as-val.up { color: #59dfa1; }
  .as-val.dn { color: #ff7281; }
  .as-val.fire { color: #f9b578; }

  .reset-btn {
    font-family: var(--fm); font-size: 11px; font-weight: 800; letter-spacing: .06em;
    padding: 8px 14px; border-radius: 10px;
    background: linear-gradient(135deg, #ce4557, #f16c7d);
    color: #fff;
    border: 1px solid rgba(255,255,255,0.2);
    cursor: pointer; transition: all .15s ease;
  }
  .reset-btn:hover { transform: translateY(-1px); filter: brightness(1.05); }

  @media (max-width: 760px) {
    .settings-header {
      padding: 20px 14px 16px;
    }
    .settings-body {
      padding: 14px 10px 20px;
      gap: 12px;
    }
    .setting-row {
      align-items: flex-start;
      flex-direction: column;
    }
    .sr-select,
    .speed-btns {
      width: 100%;
    }
    .speed-btns {
      justify-content: flex-start;
    }
  }
</style>
