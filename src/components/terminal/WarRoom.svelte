<script lang="ts">
  import { AGENT_SIGNALS, type AgentSignal } from '$lib/data/warroom';
  import { gameState, setView } from '$lib/stores/gameState';
  import { openQuickTrade } from '$lib/stores/quickTradeStore';
  import { trackSignal as trackSignalStore, activeSignalCount } from '$lib/stores/trackedSignalStore';
  import { incrementTrackedSignals } from '$lib/stores/userProfileStore';
  import { notifySignalTracked } from '$lib/stores/notificationStore';
  import { copyTradeStore } from '$lib/stores/copyTradeStore';
  import {
    fetchCurrentOI,
    fetchCurrentFunding,
    fetchPredictedFunding,
    fetchLiquidationHistory,
    fetchLSRatioHistory,
    formatOI,
    formatFunding
  } from '$lib/api/coinalyze';
  import { runWarRoomScan } from '$lib/engine/warroomScan';
  import { runTerminalScan, getScanHistory } from '$lib/api/terminalApi';
  import { goto } from '$app/navigation';
  import { onMount, onDestroy } from 'svelte';
  import { createEventDispatcher } from 'svelte';

  type TokenFilter = 'ALL' | string;
  type ScanTab = {
    id: string;
    pair: string;
    timeframe: string;
    token: string;
    createdAt: number;
    label: string;
    signals: AgentSignal[];
  };

  type ScanHighlight = {
    agent: string;
    vote: AgentSignal['vote'];
    conf: number;
    note: string;
  };

  type ScanCompleteDetail = {
    pair: string;
    timeframe: string;
    token: string;
    createdAt: number;
    label: string;
    consensus: AgentSignal['vote'];
    avgConfidence: number;
    summary: string;
    highlights: ScanHighlight[];
  };

  type WarRoomEvents = {
    collapse: void;
    tracked: { dir: AgentSignal['vote']; pair: string };
    quicktrade: { dir: 'LONG' | 'SHORT'; pair: string; price: number };
    scancomplete: ScanCompleteDetail;
  };

  const dispatch = createEventDispatcher<WarRoomEvents>();

  const SCAN_STATE_STORAGE_KEY = 'maxidoge.warroom.scanstate.v1';
  const MAX_SCAN_TABS = 6;
  const MAX_SIGNALS_PER_TAB = 60;

  let activeToken: TokenFilter = 'ALL';
  let selectedIds: Set<string> = new Set();
  let scanTabs: ScanTab[] = [];
  // 기본값: 스캔 없으면 preset(빈 상태), 스캔 있으면 최신 스캔
  let activeScanId = 'preset';
  let scanRunning = false;
  let scanQueued = false;
  let scanStep = '';
  let scanError = '';
  let scanStateHydrated = false;
  let serverScanSynced = false;

  // ── Scan Diff: 이전 스캔과 비교 ──
  type SignalDiff = {
    prevVote: AgentSignal['vote'] | null;
    confDelta: number;         // +5, -3 등
    voteChanged: boolean;
    isNew: boolean;
  };
  let _prevSignalMap = new Map<string, { vote: AgentSignal['vote']; conf: number }>();
  let signalDiffs = new Map<string, SignalDiff>();
  let diffFreshUntil = 0;     // diff 하이라이트 유지 시간 (ms)

  // ── Derivatives Data (real-time from Coinalyze) ──
  let derivOI: number | null = null;
  let derivFunding: number | null = null;
  let derivPredFunding: number | null = null;
  let derivLSRatio: number | null = null;
  let derivLiqLong = 0;
  let derivLiqShort = 0;
  let derivLoading = false;
  let derivLastPair = '';
  let derivRefreshTimer: ReturnType<typeof setInterval> | null = null;

  // ── Cache: avoid redundant API calls (60s TTL per pair) ──
  const _derivCache = new Map<string, { ts: number; data: any }>();
  const DERIV_CACHE_TTL = 60_000;
  let _derivDebounce: ReturnType<typeof setTimeout> | null = null;

  $: currentPair = $gameState.pair;
  $: currentTF = $gameState.timeframe;

  // 프리셋(하드코딩) 데이터 제거 — 실제 스캔 데이터만 표시
  $: signalPool =
    activeScanId === 'preset'
      ? (scanTabs.length > 0 ? scanTabs.flatMap(t => t.signals).slice(0, MAX_SIGNALS_PER_TAB) : [])
      : scanTabs.find((tab) => tab.id === activeScanId)?.signals ?? scanTabs[0]?.signals ?? [];

  $: {
    if (activeScanId === 'preset') {
      // noop
    } else {
      const activeTab = scanTabs.find((tab) => tab.id === activeScanId);
      if (!activeTab) {
        activeScanId = scanTabs[0]?.id ?? 'preset';
        activeToken = 'ALL';
        selectedIds = new Set();
      } else {
        const tf = String(currentTF || '4h');
        const pairChanged = activeTab.pair !== currentPair;
        const tfChanged = activeTab.timeframe !== tf;
        if (pairChanged || tfChanged) {
          const sameMarketTab = scanTabs.find((tab) => tab.pair === currentPair && tab.timeframe === tf);
          // Keep current scan tab if there is no same-market scan tab.
          // Prevents unexpected fallback to preset BTC/ETH/SOL feed.
          if (sameMarketTab && sameMarketTab.id !== activeScanId) {
            activeScanId = sameMarketTab.id;
            activeToken = 'ALL';
            selectedIds = new Set();
          }
        }
      }
    }
  }

  $: if (scanStateHydrated && typeof window !== 'undefined') {
    try {
      localStorage.setItem(
        SCAN_STATE_STORAGE_KEY,
        JSON.stringify({
          activeScanId,
          activeToken,
          scanTabs: scanTabs.slice(0, MAX_SCAN_TABS)
        })
      );
    } catch (err) {
      console.warn('[WarRoom] Failed to persist scan state', err);
    }
  }

  $: tokenTabs = ['ALL', ...Array.from(new Set(signalPool.map((s) => s.token)))];
  $: tokenCounts = tokenTabs.reduce<Record<string, number>>((acc, tok) => {
    acc[tok] = tok === 'ALL' ? signalPool.length : signalPool.filter((s) => s.token === tok).length;
    return acc;
  }, {});
  $: activeScanTab = activeScanId === 'preset'
    ? null
    : scanTabs.find((tab) => tab.id === activeScanId) ?? null;
  $: if (!tokenTabs.includes(activeToken)) activeToken = 'ALL';
  $: filteredSignals = (() => {
    const base = activeToken === 'ALL' ? signalPool : signalPool.filter((s) => s.token === activeToken);
    // diff 활성중이면 변화 큰 순서로 정렬
    if (diffFreshUntil > Date.now() && signalDiffs.size > 0) {
      return [...base].sort((a, b) => {
        const da = signalDiffs.get(a.id);
        const db = signalDiffs.get(b.id);
        const sa = da ? (da.isNew ? 100 : da.voteChanged ? 90 : Math.abs(da.confDelta)) : 0;
        const sb = db ? (db.isNew ? 100 : db.voteChanged ? 90 : Math.abs(db.confDelta)) : 0;
        return sb - sa;
      });
    }
    return base;
  })();
  $: selectedCount = selectedIds.size;
  $: avgConfidence = signalPool.length > 0
    ? Math.round(signalPool.reduce((sum, sig) => sum + sig.conf, 0) / signalPool.length)
    : 0;
  $: avgRR = signalPool.length > 0
    ? signalPool.reduce((sum, sig) => {
      const risk = Math.max(Math.abs(sig.entry - sig.sl), 0.0001);
      return sum + Math.abs(sig.tp - sig.entry) / risk;
    }, 0) / signalPool.length
    : 0;
  $: consensusDir = (() => {
    const counts = { long: 0, short: 0, neutral: 0 };
    signalPool.forEach((sig) => counts[sig.vote]++);
    if (counts.long > counts.short && counts.long > counts.neutral) return 'LONG';
    if (counts.short > counts.long && counts.short > counts.neutral) return 'SHORT';
    return 'NEUTRAL';
  })();
  $: trackedCount = $activeSignalCount;

  function roundPrice(value: number): number {
    if (!Number.isFinite(value)) return 0;
    if (Math.abs(value) >= 1000) return Math.round(value);
    if (Math.abs(value) >= 100) return Number(value.toFixed(2));
    return Number(value.toFixed(4));
  }

  function fmtPrice(price: number): string {
    if (!Number.isFinite(price)) return '$0';
    if (Math.abs(price) >= 1000) return '$' + price.toLocaleString();
    return '$' + price.toFixed(price >= 100 ? 2 : 4);
  }

  function activateScanTab(id: string) {
    if (activeScanId === id) return;
    activeScanId = id;
    selectedIds = new Set();
    activeToken = 'ALL';
  }

  function toggleSelect(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedIds = next;
  }

  function selectAll() {
    if (selectedCount === filteredSignals.length) selectedIds = new Set();
    else selectedIds = new Set(filteredSignals.map((s) => s.id));
  }

  function openCopyTrade() {
    if (selectedCount === 0) return;
    copyTradeStore.openModal([...selectedIds]);
  }

  function scrollXOnWheel(event: WheelEvent) {
    const el = event.currentTarget as HTMLElement | null;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    const delta = Math.abs(event.deltaX) > 0 ? event.deltaX : event.deltaY;
    if (!delta) return;
    el.scrollLeft += delta;
    if (Math.abs(event.deltaY) > 0) event.preventDefault();
  }

  function restoreScanState() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(SCAN_STATE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        activeScanId?: string;
        activeToken?: string;
        scanTabs?: unknown[];
      };
      if (!parsed || !Array.isArray(parsed.scanTabs)) return;

      const restoredTabs = parsed.scanTabs
        .filter((tab): tab is ScanTab =>
          Boolean(tab) &&
          typeof (tab as ScanTab).id === 'string' &&
          typeof (tab as ScanTab).pair === 'string' &&
          typeof (tab as ScanTab).timeframe === 'string' &&
          typeof (tab as ScanTab).token === 'string' &&
          typeof (tab as ScanTab).label === 'string' &&
          typeof (tab as ScanTab).createdAt === 'number' &&
          Array.isArray((tab as ScanTab).signals)
        )
        .map((tab) => {
          const rawLabel = String(tab.label || '').trim();
          const tokenPrefix = `${String(tab.token || '').trim()} `;
          const label = tokenPrefix && rawLabel.toUpperCase().startsWith(tokenPrefix.toUpperCase())
            ? rawLabel.slice(tokenPrefix.length).trim()
            : rawLabel;
          return { ...tab, label: label || rawLabel };
        })
        .slice(0, MAX_SCAN_TABS);

      if (restoredTabs.length === 0) return;

      scanTabs = restoredTabs;
      activeScanId =
        typeof parsed.activeScanId === 'string' && restoredTabs.some((tab) => tab.id === parsed.activeScanId)
          ? parsed.activeScanId
          : restoredTabs[0].id;
      if (typeof parsed.activeToken === 'string') activeToken = parsed.activeToken;
    } catch (err) {
      console.warn('[WarRoom] Failed to restore scan state', err);
    }
  }

  async function fetchDerivativesData() {
    const pair = currentPair;
    if (!pair) return;
    const cached = _derivCache.get(pair);
    if (cached && Date.now() - cached.ts < DERIV_CACHE_TTL) {
      const d = cached.data;
      derivOI = d.oi;
      derivFunding = d.funding;
      derivPredFunding = d.predFunding;
      derivLSRatio = d.lsRatio;
      derivLiqLong = d.liqLong;
      derivLiqShort = d.liqShort;
      derivLastPair = pair;
      return;
    }

    derivLoading = true;
    try {
      const [oi, funding, predFunding, lsRatio, liqs] = await Promise.allSettled([
        fetchCurrentOI(pair),
        fetchCurrentFunding(pair),
        fetchPredictedFunding(pair),
        fetchLSRatioHistory(pair, currentTF, 2),
        fetchLiquidationHistory(pair, currentTF, 24),
      ]);

      if (oi.status === 'fulfilled' && oi.value) derivOI = oi.value.value;
      if (funding.status === 'fulfilled' && funding.value) derivFunding = funding.value.value;
      if (predFunding.status === 'fulfilled' && predFunding.value) derivPredFunding = predFunding.value.value;
      if (lsRatio.status === 'fulfilled' && lsRatio.value.length > 0) derivLSRatio = lsRatio.value[lsRatio.value.length - 1].value;
      if (liqs.status === 'fulfilled' && liqs.value.length > 0) {
        derivLiqLong = liqs.value.reduce((sum, d) => sum + d.long, 0);
        derivLiqShort = liqs.value.reduce((sum, d) => sum + d.short, 0);
      }
      derivLastPair = pair;
      _derivCache.set(pair, {
        ts: Date.now(),
        data: {
          oi: derivOI,
          funding: derivFunding,
          predFunding: derivPredFunding,
          lsRatio: derivLSRatio,
          liqLong: derivLiqLong,
          liqShort: derivLiqShort
        }
      });
    } catch (err) {
      console.error('[WarRoom] Derivatives fetch error:', err);
    }
    derivLoading = false;
  }

  async function runAgentScan() {
    if (scanRunning) {
      scanQueued = true;
      scanStep = 'QUEUED';
      return;
    }
    scanRunning = true;
    scanQueued = false;
    scanError = '';
    scanStep = 'ANALYSIS · loading market data';

    const pair = currentPair || 'BTC/USDT';
    const timeframe = String(currentTF || '4h');

    try {
      scanStep = 'COUNCIL · synthesizing outputs';

      // ── 스캔 전 현재 시그널 스냅샷 저장 (diff 비교용) ──
      const prevMap = new Map<string, { vote: AgentSignal['vote']; conf: number }>();
      for (const sig of signalPool) {
        const key = `${sig.agentId}:${sig.token}`;
        prevMap.set(key, { vote: sig.vote, conf: sig.conf });
      }

      const scan = await runWarRoomScan(pair, timeframe);
      const existingTab = scanTabs.find((tab) => tab.pair === scan.pair && tab.timeframe === scan.timeframe);
      const nextTab: ScanTab = existingTab
        ? {
          ...existingTab,
          token: scan.token,
          createdAt: scan.createdAt,
          label: scan.label,
          signals: [...scan.signals, ...existingTab.signals].slice(0, MAX_SIGNALS_PER_TAB)
        }
        : {
          id: `scan-${scan.createdAt}-${Math.floor(Math.random() * 10_000).toString(16)}`,
          pair: scan.pair,
          timeframe: scan.timeframe,
          token: scan.token,
          createdAt: scan.createdAt,
          label: scan.label,
          signals: scan.signals
        };

      // ── Diff 계산: 이전 vs 새 시그널 비교 ──
      const diffs = new Map<string, SignalDiff>();
      for (const sig of scan.signals) {
        const key = `${sig.agentId}:${sig.token}`;
        const prev = prevMap.get(key);
        if (!prev) {
          diffs.set(sig.id, { prevVote: null, confDelta: 0, voteChanged: false, isNew: true });
        } else {
          const voteChanged = prev.vote !== sig.vote;
          diffs.set(sig.id, {
            prevVote: voteChanged ? prev.vote : null,
            confDelta: sig.conf - prev.conf,
            voteChanged,
            isNew: false,
          });
        }
      }
      signalDiffs = diffs;
      _prevSignalMap = prevMap;
      diffFreshUntil = Date.now() + 30_000; // 30초 동안 diff 표시

      scanTabs = [nextTab, ...scanTabs.filter((tab) => tab.id !== nextTab.id)].slice(0, MAX_SCAN_TABS);
      activeScanId = nextTab.id;
      activeToken = 'ALL';
      selectedIds = new Set();
      dispatch('scancomplete', {
        pair: scan.pair,
        timeframe: scan.timeframe,
        token: scan.token,
        createdAt: scan.createdAt,
        label: nextTab.label,
        consensus: scan.consensus,
        avgConfidence: scan.avgConfidence,
        summary: scan.summary,
        highlights: scan.highlights
      });
      scanError = '';
      scanStep = 'DONE';

      // ── Server sync: persist scan results ──
      serverScanSynced = false;
      runTerminalScan(scan.pair, scan.timeframe)
        .then(() => {
          serverScanSynced = true;
          console.log('[WarRoom] Scan persisted to server');
        })
        .catch(err => {
          console.warn('[WarRoom] Server persistence failed (local scan still available):', err);
        });
    } catch (err) {
      console.error('[WarRoom] Agent scan error:', err);
      scanError = err instanceof Error ? err.message : '스캔 중 오류가 발생했습니다.';
    } finally {
      scanRunning = false;
      if (scanQueued) {
        scanQueued = false;
        void runAgentScan();
        return;
      }
      setTimeout(() => {
        if (!scanRunning) scanStep = '';
      }, 900);
    }
  }

  export function triggerScanFromChart() {
    runAgentScan();
  }

  // Debounced refetch when pair changes (prevents rapid switching spam)
  $: if (currentPair && currentPair !== derivLastPair) {
    if (_derivDebounce) clearTimeout(_derivDebounce);
    _derivDebounce = setTimeout(fetchDerivativesData, 200);
  }

  // ── Volatility alert ──
  let volatilityAlert = false;
  let volatilityInterval: ReturnType<typeof setInterval> | null = null;

  function handleTrack(sig: AgentSignal) {
    trackSignalStore(sig.pair, sig.vote === 'long' ? 'LONG' : sig.vote === 'short' ? 'SHORT' : 'LONG', sig.entry, sig.name, sig.conf);
    incrementTrackedSignals();
    notifySignalTracked(sig.pair, sig.vote.toUpperCase());
    dispatch('tracked', { dir: sig.vote, pair: sig.pair });
  }

  function goArena() {
    setView('arena');
    goto('/arena');
  }

  function quickTrade(dir: 'LONG' | 'SHORT', sig: AgentSignal) {
    const entry = sig.entry;
    const baseRisk = Math.max(Math.abs(sig.entry - sig.sl), Math.abs(sig.entry) * 0.0035);
    const rr = Math.max(Math.abs(sig.tp - sig.entry) / Math.max(baseRisk, 0.0001), 1.2);
    const sl = dir === 'LONG' ? roundPrice(entry - baseRisk) : roundPrice(entry + baseRisk);
    const tp = dir === 'LONG' ? roundPrice(entry + baseRisk * rr) : roundPrice(entry - baseRisk * rr);
    openQuickTrade(sig.pair, dir, entry, tp, sl, sig.name);
    dispatch('quicktrade', { dir, pair: sig.pair, price: entry });
  }

  onMount(() => {
    restoreScanState();
    scanStateHydrated = true;

    volatilityInterval = setInterval(() => {
      if (Math.random() < 0.2) {
        volatilityAlert = true;
        setTimeout(() => { volatilityAlert = false; }, 8000);
      }
    }, 30000);

    fetchDerivativesData();
    derivRefreshTimer = setInterval(fetchDerivativesData, 30000);

    // Load scan history from server
    getScanHistory({ limit: 5 })
      .then(res => {
        if (res.records.length > 0) {
          console.log(`[WarRoom] Loaded ${res.records.length} scan records from server`);
        }
      })
      .catch(() => {
        // Server history unavailable - that's fine, local scans still work
      });
  });

  onDestroy(() => {
    if (volatilityInterval) clearInterval(volatilityInterval);
    if (derivRefreshTimer) clearInterval(derivRefreshTimer);
    if (_derivDebounce) clearTimeout(_derivDebounce);
  });
</script>

<div class="war-room">
  <!-- Volatility Alert Banner -->
  {#if volatilityAlert}
    <div class="vol-alert">
      <div class="vol-pulse"></div>
      <span class="vol-text">VOLATILITY SPIKE DETECTED</span>
      <button class="vol-arena-btn" on:click={goArena}>OPEN ARENA</button>
    </div>
  {/if}

  <!-- Header -->
  <div class="wr-header">
    <div class="wr-title-wrap">
      <span class="wr-title">WAR ROOM</span>
    </div>
    <div class="wr-header-right" on:wheel={scrollXOnWheel}>
      <button class="wr-chip signal-link" on:click={() => goto('/signals')}>SIGNALS</button>
      <button class="wr-chip arena-trigger" on:click={goArena}>ARENA</button>
    </div>
    <button class="wr-collapse-btn" on:click={() => dispatch('collapse')} title="Collapse panel" aria-label="Collapse panel">
      <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <rect x="1" y="2" width="14" height="12" rx="1.5"/>
        <line x1="6" y1="2" x2="6" y2="14"/>
      </svg>
    </button>
  </div>

  <div class="ticker-flow" on:wheel={scrollXOnWheel}>
    <span class="ticker-chip ticker-pair">{currentPair}</span>
    <span class="ticker-chip ticker-tf">{String(currentTF).toUpperCase()}</span>
    {#if activeScanTab}
      <span class="ticker-chip ticker-stamp">SCANNED {activeScanTab.label}</span>
    {/if}
    {#if !activeScanTab && activeScanId === 'preset'}
      <span class="ticker-chip ticker-hint">RUN SCAN ↓</span>
    {/if}
  </div>

  <div class="scan-tabs" on:wheel={scrollXOnWheel}>
    {#if scanTabs.length > 0}
      <button class="scan-tab scan-tab-history" class:active={activeScanId === 'preset'} on:click={() => activateScanTab('preset')}>
        HISTORY
      </button>
      {#each scanTabs as tab (tab.id)}
        <button class="scan-tab" class:active={activeScanId === tab.id} on:click={() => activateScanTab(tab.id)}>
          <span class="scan-tab-token">{tab.token}</span>
          <span class="scan-tab-meta">{tab.label}</span>
        </button>
      {/each}
    {:else}
      <button class="scan-tab active" disabled>
        SCAN TO START
      </button>
    {/if}
  </div>

  <!-- Token Filter Tabs (only show when multiple tokens exist) -->
  {#if tokenTabs.length > 2}
    <div class="token-tabs" on:wheel={scrollXOnWheel}>
      {#each tokenTabs as tok (tok)}
        <button
          class="token-tab"
          class:active={activeToken === tok}
          class:btc={tok === 'BTC'}
          class:eth={tok === 'ETH'}
          class:sol={tok === 'SOL'}
          on:click={() => { activeToken = tok; selectedIds = new Set(); }}
        >
          {tok}
          <span class="token-tab-count">{tokenCounts[tok] || 0}</span>
        </button>
      {/each}
    </div>
  {/if}

  <!-- ═══ Derivatives Data Strip ═══ -->
  <div class="deriv-strip">
    <div class="deriv-row">
      <div class="deriv-cell">
        <span class="deriv-lbl">OI</span>
        <span class="deriv-val" class:loading={derivLoading}>
          {derivOI != null ? formatOI(derivOI) : '—'}
        </span>
      </div>
      <div class="deriv-cell">
        <span class="deriv-lbl">FUNDING</span>
        <span class="deriv-val" class:pos={derivFunding != null && derivFunding > 0} class:neg={derivFunding != null && derivFunding < 0}>
          {derivFunding != null ? formatFunding(derivFunding) : '—'}
        </span>
      </div>
      <div class="deriv-cell">
        <span class="deriv-lbl">PRED</span>
        <span class="deriv-val" class:pos={derivPredFunding != null && derivPredFunding > 0} class:neg={derivPredFunding != null && derivPredFunding < 0}>
          {derivPredFunding != null ? formatFunding(derivPredFunding) : '—'}
        </span>
      </div>
    </div>
    <div class="deriv-row">
      <div class="deriv-cell">
        <span class="deriv-lbl">L/S</span>
        <span class="deriv-val" class:pos={derivLSRatio != null && derivLSRatio > 1} class:neg={derivLSRatio != null && derivLSRatio < 1}>
          {derivLSRatio != null ? Number(derivLSRatio).toFixed(2) : '—'}
        </span>
      </div>
      <div class="deriv-cell">
        <span class="deriv-lbl">LIQ ▲</span>
        <span class="deriv-val long-liq">{derivLiqLong > 0 ? formatOI(derivLiqLong) : '—'}</span>
      </div>
      <div class="deriv-cell">
        <span class="deriv-lbl">LIQ ▼</span>
        <span class="deriv-val short-liq">{derivLiqShort > 0 ? formatOI(derivLiqShort) : '—'}</span>
      </div>
    </div>
  </div>

  {#if scanRunning || scanStep || scanError}
    <div class="scan-status" class:error={Boolean(scanError)}>
      <span class="scan-status-dot"></span>
      <span class="scan-status-text">
        {#if scanError}
          {scanError}
        {:else}
          {scanStep || 'SCANNING...'}
        {/if}
      </span>
    </div>
  {/if}

  <!-- Select All bar -->
  <div class="select-bar">
    <button class="select-all-btn" on:click={selectAll}>
      <span class="sa-check" class:checked={selectedCount === filteredSignals.length && filteredSignals.length > 0}>
        {selectedCount === filteredSignals.length && filteredSignals.length > 0 ? '☑' : '☐'}
      </span>
      SELECT ALL
    </button>
    {#if selectedCount > 0}
      <span class="select-count">{selectedCount} selected</span>
    {/if}
  </div>

  <!-- Signal Feed (selectable cards) -->
  <div class="wr-msgs">
    {#each filteredSignals as sig (sig.id)}
      {@const isSelected = selectedIds.has(sig.id)}
      {@const diff = diffFreshUntil > Date.now() ? signalDiffs.get(sig.id) : undefined}
      {@const hasChange = diff && (diff.isNew || diff.voteChanged || Math.abs(diff.confDelta) >= 3)}
      <div
        class="wr-msg"
        class:selected={isSelected}
        class:wr-msg-new={hasChange}
        class:wr-msg-vote-flip={diff?.voteChanged}
        on:click={() => toggleSelect(sig.id)}
        role="button"
        tabindex="0"
        on:keydown={(e) => e.key === 'Enter' && toggleSelect(sig.id)}
      >
        <div class="wr-msg-strip" style="background:{sig.color}"></div>
        <div class="wr-msg-checkbox">
          <span class="msg-check" class:checked={isSelected}>
            {isSelected ? '☑' : '☐'}
          </span>
        </div>
        <div class="wr-msg-body">
          <div class="wr-msg-head">
            <span class="wr-msg-icon">{sig.icon}</span>
            <span class="wr-msg-name" style="color:{sig.color}">{sig.name}</span>
            <span class="wr-msg-token">{sig.token}</span>
            <span class="wr-msg-vote {sig.vote}">{sig.vote.toUpperCase()}</span>
            <span class="wr-msg-conf">{sig.conf}%</span>
            <!-- Diff indicators -->
            {#if diff}
              {#if diff.isNew}
                <span class="wr-diff-badge wr-diff-new">NEW</span>
              {:else if diff.voteChanged && diff.prevVote}
                <span class="wr-diff-badge wr-diff-flip">{diff.prevVote.toUpperCase()}→{sig.vote.toUpperCase()}</span>
              {/if}
              {#if !diff.isNew && diff.confDelta !== 0}
                <span class="wr-diff-delta" class:pos={diff.confDelta > 0} class:neg={diff.confDelta < 0}>
                  {diff.confDelta > 0 ? '+' : ''}{diff.confDelta}%
                </span>
              {/if}
            {/if}
            <span class="wr-msg-time">{sig.time}</span>
          </div>
          <!-- Confidence bar -->
          <div class="wr-conf-bar">
            <div class="wr-conf-fill {sig.vote}" style="width:{Math.min(sig.conf, 100)}%"></div>
          </div>
          <div class="wr-msg-text">{sig.text}</div>
          <div class="wr-msg-signal-row">
            <span class="wr-msg-entry">{fmtPrice(sig.entry)}</span>
            <span class="wr-msg-arrow-price">→</span>
            <span class="wr-msg-tp">TP {fmtPrice(sig.tp)}</span>
            <span class="wr-msg-sl">SL {fmtPrice(sig.sl)}</span>
          </div>
          <div class="wr-msg-actions">
            <span class="wr-msg-src">{sig.src}</span>
            <button class="wr-act-btn long" on:click|stopPropagation={() => quickTrade('LONG', sig)}>▲ LONG</button>
            <button class="wr-act-btn short" on:click|stopPropagation={() => quickTrade('SHORT', sig)}>▼ SHORT</button>
            <button class="wr-act-btn track" on:click|stopPropagation={() => handleTrack(sig)}>TRACK</button>
          </div>
        </div>
      </div>
    {/each}
    {#if filteredSignals.length === 0}
      <div class="wr-empty">
        {#if scanTabs.length === 0}
          <div class="wr-empty-icon">🔍</div>
          <div class="wr-empty-title">SCAN TO START</div>
          <div class="wr-empty-text">차트에서 SCAN 버튼을 눌러 AI 에이전트 분석을 시작하세요. 스캔 결과가 여기에 표시됩니다.</div>
          <button class="wr-empty-scan-btn" on:click={runAgentScan}>
            ⚡ RUN SCAN NOW
          </button>
        {:else}
          <div class="wr-empty-title">NO SIGNALS</div>
          <div class="wr-empty-text">현재 필터에서 표시할 데이터가 없습니다.</div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- CREATE COPY TRADE CTA -->
  {#if selectedCount > 0}
    <button class="copy-trade-cta" on:click={openCopyTrade}>
      <span class="ctc-text">CREATE COPY TRADE</span>
      <span class="ctc-count">{selectedCount} selected</span>
      <span class="ctc-arrow">→</span>
    </button>
  {/if}

  <!-- Signal Room Link -->
  <button class="signal-room-cta" on:click={() => goto('/signals')}>
    <span class="src-text">SIGNAL ROOM</span>
    <span class="src-count">{signalPool.length} SIGNALS</span>
    {#if trackedCount > 0}
      <span class="src-tracked">TRACKED {trackedCount}</span>
    {/if}
    <span class="src-arrow">→</span>
  </button>

  <!-- Stats Footer -->
  <div class="wr-stats">
    <div class="stat-cell"><div class="stat-lbl">SIG</div><div class="stat-val" style="color:var(--yel)">{signalPool.length}</div></div>
    <div class="stat-cell"><div class="stat-lbl">CONF</div><div class="stat-val" style="color:var(--grn)">{avgConfidence}%</div></div>
    <div class="stat-cell"><div class="stat-lbl">R:R</div><div class="stat-val" style="color:var(--ora)">1:{avgRR.toFixed(1)}</div></div>
    <div class="stat-cell"><div class="stat-lbl">DIR</div><div class="stat-val" style="color:var(--pk)">{consensusDir}</div></div>
  </div>
</div>

<style>
  /* Volatility Alert */
  .vol-alert {
    flex-shrink: 0; display: flex; align-items: center; gap: 6px;
    padding: 6px 10px;
    background: linear-gradient(90deg, rgba(255,45,85,.15), rgba(255,45,85,.05));
    border-bottom: 2px solid rgba(255,45,85,.4);
    animation: volPulse 1s ease infinite;
    position: relative; z-index: 3;
  }
  @keyframes volPulse { 0%,100%{opacity:1} 50%{opacity:.7} }
  .vol-pulse {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--red); box-shadow: 0 0 8px var(--red);
    animation: blink .6s infinite;
  }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.2} }
  .vol-text { font-family: var(--fm); font-size: 10px; font-weight: 900; letter-spacing: 1px; color: var(--red); flex: 1; }
  .vol-arena-btn {
    font-family: var(--fm); font-size: 9px; font-weight: 900; letter-spacing: 1px;
    padding: 3px 8px; border-radius: 4px; background: var(--red); color: #fff;
    border: 1.5px solid #000; cursor: pointer; box-shadow: 2px 2px 0 #000;
  }

  .war-room {
    background: #0A0908; display: flex; flex-direction: column; overflow: hidden;
    height: 100%; border-right: 3px solid var(--yel); position: relative;
  }
  .war-room::after {
    content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 0;
    background: repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(0,0,0,.18) 2px, rgba(0,0,0,.18) 3px);
    contain: strict; will-change: auto;
  }

  .wr-header {
    height: 36px; padding: 0 8px; flex-shrink: 0;
    background: var(--yel); border-bottom: 3px solid #000;
    display: flex; align-items: center; gap: 8px; position: relative; z-index: 2;
  }
  .wr-title-wrap {
    display: flex;
    align-items: center;
    min-width: 84px;
    flex-shrink: 0;
  }
  .wr-title {
    font-family: var(--fdisplay);
    font-size: 13px;
    letter-spacing: 1.2px;
    color: #000;
    white-space: nowrap;
  }
  .wr-header-right {
    display: flex;
    align-items: center;
    gap: 3px;
    margin-left: auto;
    flex: 1 1 auto;
    min-width: 0;
    flex-wrap: nowrap;
    overflow-x: auto;
    overflow-y: hidden;
    padding-right: 4px;
    scrollbar-width: thin;
    scrollbar-color: rgba(0,0,0,.35) rgba(0,0,0,.08);
    -webkit-overflow-scrolling: touch;
    touch-action: pan-x;
  }
  .wr-header-right::-webkit-scrollbar { height: 4px; }
  .wr-header-right::-webkit-scrollbar-thumb {
    background: rgba(0,0,0,.38);
    border-radius: 999px;
  }
  .wr-header-right::-webkit-scrollbar-track {
    background: rgba(0,0,0,.08);
  }
  .wr-chip {
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 8px;
    border-radius: 3px;
    border: 1px solid rgba(0,0,0,.26);
    font-family: var(--fm);
    font-size: 9px;
    font-weight: 800;
    letter-spacing: .4px;
    line-height: 1;
    white-space: nowrap;
    box-sizing: border-box;
  }
  .arena-trigger {
    color: var(--pk); background: rgba(255,45,155,.1);
    border: 1.5px solid rgba(255,45,155,.4);
    cursor: pointer;
    transition: all .15s;
  }
  .arena-trigger:hover { background: rgba(255,45,155,.25); }
  .wr-collapse-btn {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 24px;
    width: 24px;
    padding: 0;
    background: rgba(0,0,0,.14);
    border: 1.5px solid rgba(0,0,0,.45);
    border-radius: 3px;
    cursor: pointer;
    color: #111;
    transition: all .12s;
  }
  .wr-collapse-btn:hover {
    background: #000;
    border-color: #000;
    color: var(--yel);
  }

  .ticker-flow {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 8px;
    background: linear-gradient(90deg, rgba(0,0,0,.62), rgba(0,0,0,.48));
    border-bottom: 1px solid rgba(255,230,0,.14);
    position: relative;
    z-index: 2;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,230,0,.35) transparent;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-x;
  }
  .ticker-flow::-webkit-scrollbar { height: 4px; }
  .ticker-flow::-webkit-scrollbar-thumb { background: rgba(255,230,0,.35); border-radius: 999px; }
  .ticker-flow::-webkit-scrollbar-track { background: rgba(255,255,255,.04); }
  .ticker-chip {
    height: 20px;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    padding: 0 7px;
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,.12);
    background: rgba(255,255,255,.03);
    color: rgba(255,255,255,.75);
    font-family: var(--fm);
    font-size: 8px;
    font-weight: 800;
    letter-spacing: .55px;
    white-space: nowrap;
  }
  .ticker-label {
    color: rgba(255,230,0,.86);
    border-color: rgba(255,230,0,.38);
    background: rgba(255,230,0,.1);
  }
  .ticker-hint {
    color: rgba(255,230,0,.5);
    border-color: rgba(255,230,0,.2);
    background: rgba(255,230,0,.05);
    font-style: italic;
    font-size: 8px;
  }
  .ticker-pair {
    color: rgba(255,255,255,.92);
    border-color: rgba(255,255,255,.22);
  }
  .ticker-tf {
    color: rgba(0,255,166,.92);
    border-color: rgba(0,255,166,.35);
    background: rgba(0,255,166,.1);
  }
  .ticker-stamp {
    color: rgba(255,255,255,.72);
    border-color: rgba(255,255,255,.18);
    background: rgba(255,255,255,.04);
  }

  .scan-tabs {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    gap: 4px;
    padding: 4px 6px;
    border-bottom: 1px solid rgba(255,230,0,.08);
    position: relative;
    z-index: 2;
    background: rgba(0,0,0,.35);
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,230,0,.35) transparent;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-x;
  }
  .scan-tabs::-webkit-scrollbar { height: 4px; }
  .scan-tabs::-webkit-scrollbar-thumb { background: rgba(255,230,0,.35); border-radius: 999px; }
  .scan-tabs::-webkit-scrollbar-track { background: rgba(255,255,255,.04); }
  .scan-tab {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    gap: 4px;
    border: 1px solid rgba(255,255,255,.08);
    background: rgba(255,255,255,.03);
    color: rgba(255,255,255,.72);
    border-radius: 999px;
    padding: 2px 8px;
    font-family: var(--fm);
    font-size: 8px;
    font-weight: 800;
    letter-spacing: .7px;
    cursor: pointer;
    transition: all .15s;
  }
  .scan-tab:hover { color: rgba(255,255,255,.82); border-color: rgba(255,255,255,.2); }
  .scan-tab.active {
    color: var(--yel);
    border-color: rgba(255,230,0,.5);
    background: rgba(255,230,0,.12);
  }
  .scan-tab-token {
    color: rgba(255,255,255,.88);
    font-weight: 900;
  }
  .scan-tab-meta {
    color: rgba(255,230,0,.72);
    font-weight: 700;
  }
  .scan-tab-history {
    opacity: .6;
    font-size: 7px;
    letter-spacing: 1px;
  }
  .scan-tab-history.active { opacity: 1; }

  /* Token Filter Tabs */
  .token-tabs {
    display: flex;
    flex-shrink: 0;
    gap: 6px;
    padding: 5px 8px;
    border-bottom: 1px solid rgba(255,230,0,.12);
    position: relative;
    z-index: 2;
    background: rgba(0,0,0,.56);
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,230,0,.35) transparent;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-x;
  }
  .token-tabs::-webkit-scrollbar { height: 4px; }
  .token-tabs::-webkit-scrollbar-thumb { background: rgba(255,230,0,.35); border-radius: 999px; }
  .token-tabs::-webkit-scrollbar-track { background: rgba(255,255,255,.04); }
  .token-tab {
    flex: 0 0 auto;
    min-width: 56px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 0 9px;
    font-family: var(--fm);
    font-size: 9px;
    font-weight: 900;
    letter-spacing: .65px;
    color: rgba(255,255,255,.68);
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 999px;
    background: rgba(255,255,255,.03);
    cursor: pointer; transition: color .15s, border-color .15s;
  }
  .token-tab:hover { color: rgba(255,255,255,.84); border-color: rgba(255,255,255,.2); }
  .token-tab.active { color: var(--yel); border-color: rgba(255,230,0,.5); background: rgba(255,230,0,.1); }
  .token-tab.active.btc { color: #f7931a; border-color: rgba(247,147,26,.6); background: rgba(247,147,26,.12); }
  .token-tab.active.eth { color: #8ea0ff; border-color: rgba(98,126,234,.6); background: rgba(98,126,234,.12); }
  .token-tab.active.sol { color: #b57bff; border-color: rgba(153,69,255,.62); background: rgba(153,69,255,.12); }
  .token-tab-count {
    font-size: 8px; font-weight: 700; padding: 1px 5px; border-radius: 999px;
    background: rgba(255,255,255,.1); color: rgba(255,255,255,.66);
  }
  .token-tab.active .token-tab-count { background: rgba(255,230,0,.2); color: var(--yel); }

  /* Derivatives Data Strip */
  .deriv-strip {
    flex-shrink: 0; position: relative; z-index: 2;
    background: rgba(0,0,0,.5); border-bottom: 1px solid rgba(255,230,0,.1);
    padding: 4px 8px;
  }
  .deriv-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; }
  .deriv-row + .deriv-row { margin-top: 2px; }
  .deriv-cell { text-align: center; padding: 2px 0; }
  .deriv-lbl {
    display: block; font-family: var(--fm); font-size: 8px; font-weight: 700;
    letter-spacing: .9px; color: rgba(255,255,255,.52); line-height: 1;
  }
  .deriv-val {
    display: block; font-family: var(--fd); font-size: 12px; font-weight: 900;
    color: rgba(255,255,255,.86); line-height: 1.3;
  }
  .deriv-val.loading { opacity: .4; }
  .deriv-val.pos { color: var(--grn); }
  .deriv-val.neg { color: var(--red); }
  .deriv-val.long-liq { color: var(--grn); font-size: 10px; }
  .deriv-val.short-liq { color: var(--red); font-size: 10px; }
  .scan-status {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    padding: 4px 8px;
    border-bottom: 1px solid rgba(255,230,0,.12);
    background: rgba(255,230,0,.06);
    position: relative;
    z-index: 2;
  }
  .scan-status.error {
    background: rgba(255,45,85,.08);
    border-bottom-color: rgba(255,45,85,.2);
  }
  .scan-status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--yel);
    box-shadow: 0 0 8px rgba(255,230,0,.6);
    animation: wr-blink .9s infinite;
  }
  @keyframes wr-blink { 0%,100%{opacity:1} 50%{opacity:.2} }
  .scan-status.error .scan-status-dot {
    background: var(--red);
    box-shadow: 0 0 8px rgba(255,45,85,.6);
  }
  .scan-status-text {
    font-family: var(--fm);
    font-size: 8px;
    font-weight: 800;
    letter-spacing: .7px;
    color: rgba(255,255,255,.9);
  }

  /* Select All Bar */
  .select-bar {
    display: flex; align-items: center; gap: 6px; padding: 4px 10px;
    background: rgba(255,230,0,.02); border-bottom: 1px solid rgba(255,230,0,.08);
    flex-shrink: 0; position: relative; z-index: 1;
  }
  .select-all-btn {
    display: flex; align-items: center; gap: 4px;
    font-family: var(--fm); font-size: 8px; font-weight: 900; letter-spacing: 1px;
    color: rgba(255,255,255,.68); background: none; border: none;
    cursor: pointer; padding: 2px 0; transition: color .12s;
  }
  .select-all-btn:hover { color: rgba(255,255,255,.7); }
  .sa-check { font-size: 11px; color: rgba(255,255,255,.3); }
  .sa-check.checked { color: var(--yel); }
  .select-count {
    font-family: var(--fm); font-size: 8px; font-weight: 700;
    color: var(--yel); background: rgba(255,230,0,.1); padding: 1px 6px; border-radius: 8px;
  }

  /* Signal Feed */
  .wr-msgs { flex: 1; overflow-y: auto; position: relative; z-index: 1; }
  .wr-msgs::-webkit-scrollbar { width: 2px; }
  .wr-msgs::-webkit-scrollbar-thumb { background: var(--yel); }
  .wr-msg {
    display: flex; gap: 0; border-bottom: 1px solid rgba(255,255,255,.035);
    transition: background .1s; cursor: pointer;
  }
  .wr-msg:hover { background: rgba(255,255,255,.02); }
  .wr-msg.selected { background: rgba(255,230,0,.04); border-left: 2px solid var(--yel); }
  .wr-msg-strip { width: 2px; flex-shrink: 0; }
  .wr-msg.selected .wr-msg-strip { width: 0; }
  .wr-msg-checkbox { display: flex; align-items: flex-start; padding: 8px 2px 0 6px; flex-shrink: 0; }
  .msg-check { font-size: 13px; color: rgba(255,255,255,.2); line-height: 1; }
  .msg-check.checked { color: var(--yel); }
  .wr-msg-body { flex: 1; padding: 8px 10px 8px 5px; }
  .wr-msg-head { display: flex; align-items: center; gap: 4px; margin-bottom: 3px; flex-wrap: wrap; }
  .wr-msg-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 22px;
    padding: 1px 3px;
    border-radius: 3px;
    border: 1px solid rgba(255,255,255,.2);
    font-family: var(--fm);
    font-size: 7px;
    font-weight: 900;
    letter-spacing: .4px;
    line-height: 1;
    color: rgba(255,255,255,.72);
    flex-shrink: 0;
  }
  .wr-msg-name { font-family: var(--fm); font-size: 10px; font-weight: 700; }
  .wr-msg-token {
    font-family: var(--fm); font-size: 8px; font-weight: 900; letter-spacing: .5px;
    padding: 1px 4px; border-radius: 3px; background: rgba(255,255,255,.08); color: rgba(255,255,255,.72);
  }
  .wr-msg-vote { font-family: var(--fm); font-size: 9px; font-weight: 700; padding: 1px 5px; border: 1px solid; }
  .wr-msg-vote.short { color: var(--red); border-color: rgba(255,45,85,.4); background: rgba(255,45,85,.08); }
  .wr-msg-vote.long { color: var(--grn); border-color: rgba(0,255,136,.4); background: rgba(0,255,136,.08); }
  .wr-msg-vote.neutral { color: rgba(255,255,255,.35); border-color: rgba(255,255,255,.1); }
  .wr-msg-conf { font-family: var(--fm); font-size: 9px; font-weight: 900; color: var(--yel); }
  .wr-msg-time { font-family: var(--fm); font-size: 8px; color: rgba(255,255,255,.56); margin-left: auto; }
  .wr-msg-text { font-family: var(--fm); font-size: 10px; line-height: 1.5; color: rgba(255,255,255,.84); }
  .wr-msg-signal-row {
    display: flex; align-items: center; gap: 6px; margin-top: 3px;
    font-family: var(--fm); font-size: 9px; font-weight: 700;
  }
  .wr-msg-entry { color: rgba(255,255,255,.78); }
  .wr-msg-arrow-price { color: rgba(255,255,255,.5); font-size: 8px; }
  .wr-msg-tp { color: var(--grn); }
  .wr-msg-sl { color: var(--red); }
  .wr-msg-src { font-family: var(--fm); font-size: 8px; color: rgba(255,230,0,.6); }
  .wr-msg-actions { display: flex; align-items: center; gap: 4px; margin-top: 4px; }
  .wr-act-btn {
    font-family: var(--fm); font-size: 8px; font-weight: 800; letter-spacing: .5px;
    padding: 3px 7px; border-radius: 3px; cursor: pointer; transition: background .12s; border: 1px solid;
  }
  .wr-act-btn.long { color: var(--grn); border-color: rgba(0,255,136,.3); background: rgba(0,255,136,.06); }
  .wr-act-btn.long:hover { background: rgba(0,255,136,.2); }
  .wr-act-btn.short { color: var(--red); border-color: rgba(255,45,85,.3); background: rgba(255,45,85,.06); }
  .wr-act-btn.short:hover { background: rgba(255,45,85,.2); }
  .wr-act-btn.track { color: #00ccff; border-color: rgba(0,204,255,.3); background: rgba(0,204,255,.06); }
  .wr-act-btn.track:hover { background: rgba(0,204,255,.2); }
  .wr-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-height: 120px;
    padding: 18px 12px;
    color: rgba(255,255,255,.45);
  }
  .wr-empty-title {
    font-family: var(--fd);
    font-size: 10px;
    letter-spacing: 1.6px;
    color: rgba(255,230,0,.72);
  }
  .wr-empty-text {
    font-family: var(--fm);
    font-size: 9px;
    text-align: center;
    max-width: 220px;
    line-height: 1.5;
  }
  .wr-empty-icon {
    font-size: 28px;
    opacity: .6;
    margin-bottom: 4px;
  }
  .wr-empty-scan-btn {
    margin-top: 8px;
    padding: 6px 16px;
    border-radius: 6px;
    border: 1.5px solid rgba(255,230,0,.5);
    background: rgba(255,230,0,.12);
    color: var(--yel);
    font-family: var(--fm);
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 1px;
    cursor: pointer;
    transition: all .15s;
  }
  .wr-empty-scan-btn:hover {
    background: rgba(255,230,0,.22);
    border-color: var(--yel);
    box-shadow: 0 0 10px rgba(255,230,0,.2);
  }

  /* Copy Trade CTA */
  .copy-trade-cta {
    width: 100%; display: flex; align-items: center; gap: 6px;
    padding: 10px 12px;
    background: linear-gradient(90deg, rgba(255,230,0,.12), rgba(255,230,0,.04));
    border: none; border-top: 2px solid var(--yel);
    cursor: pointer; transition: background .15s;
    flex-shrink: 0; position: relative; z-index: 2;
  }
  .copy-trade-cta:hover { background: linear-gradient(90deg, rgba(255,230,0,.22), rgba(255,230,0,.08)); }
  .ctc-text { font-family: var(--fd); font-size: 10px; font-weight: 900; letter-spacing: 2px; color: var(--yel); }
  .ctc-count {
    font-family: var(--fm); font-size: 8px; font-weight: 700;
    color: #000; background: var(--yel); padding: 2px 6px; border-radius: 8px;
  }
  .ctc-arrow { margin-left: auto; font-family: var(--fm); font-size: 12px; color: var(--yel); }

  /* Signal Link / Signal Room CTA */
  .signal-link {
    color: var(--pk); background: rgba(255,45,155,.1);
    border: 1.5px solid rgba(255,45,155,.4);
    cursor: pointer;
    transition: all .15s;
  }
  .signal-link:hover { background: rgba(255,45,155,.25); }
  .signal-room-cta {
    width: 100%; display: flex; align-items: center; gap: 6px; padding: 8px 10px;
    background: linear-gradient(90deg, rgba(255,45,155,.1), rgba(255,45,155,.03));
    border: none; border-top: 2px solid rgba(255,45,155,.3);
    cursor: pointer; transition: background .12s; flex-shrink: 0; position: relative; z-index: 1;
  }
  .signal-room-cta:hover { background: linear-gradient(90deg, rgba(255,45,155,.18), rgba(255,45,155,.06)); }
  .src-text { font-family: var(--fm); font-size: 9px; font-weight: 900; letter-spacing: 1.5px; color: var(--pk); }
  .src-count { font-family: var(--fm); font-size: 8px; font-weight: 700; color: rgba(255,255,255,.64); }
  .src-tracked { font-family: var(--fm); font-size: 8px; font-weight: 900; color: var(--ora); background: rgba(255,140,59,.1); padding: 1px 5px; border-radius: 4px; }
  .src-arrow { margin-left: auto; font-family: var(--fm); font-size: 10px; color: var(--pk); }

  /* Stats Footer */
  .wr-stats {
    border-top: 3px solid var(--yel); display: grid; grid-template-columns: repeat(4, 1fr);
    flex-shrink: 0; position: relative; z-index: 1; background: rgba(255,230,0,.02);
  }
  .stat-cell { padding: 5px 4px; text-align: center; border-right: 1px solid rgba(255,230,0,.1); }
  .stat-cell:last-child { border-right: none; }
  .stat-lbl { font-family: var(--fm); font-size: 8px; color: rgba(255,230,0,.62); letter-spacing: 1.4px; margin-bottom: 1px; }
  .stat-val { font-family: var(--fdisplay); font-size: 16px; letter-spacing: 1px; line-height: 1.1; }

  /* ═══ Scan Diff Visualization ═══ */
  .wr-msg-new {
    animation: diffGlow 2s ease-out;
    border-left: 2px solid rgba(0,255,166,.6) !important;
  }
  .wr-msg-vote-flip {
    animation: voteFlipGlow 2.5s ease-out;
    border-left: 2px solid rgba(255,45,155,.6) !important;
  }
  @keyframes diffGlow {
    0% { background: rgba(0,255,166,.15); box-shadow: inset 0 0 12px rgba(0,255,166,.2); }
    100% { background: transparent; box-shadow: none; }
  }
  @keyframes voteFlipGlow {
    0% { background: rgba(255,45,155,.15); box-shadow: inset 0 0 12px rgba(255,45,155,.2); }
    100% { background: transparent; box-shadow: none; }
  }

  .wr-diff-badge {
    display: inline-flex; align-items: center;
    padding: 1px 5px; border-radius: 3px;
    font-family: var(--fm); font-size: 7px; font-weight: 900;
    letter-spacing: .5px; line-height: 1;
    animation: badgePop .4s cubic-bezier(.34,1.56,.64,1);
  }
  @keyframes badgePop {
    0% { transform: scale(0); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }
  .wr-diff-new {
    color: #0a0908; background: var(--grn);
    box-shadow: 0 0 6px rgba(0,255,136,.4);
  }
  .wr-diff-flip {
    color: #fff; background: rgba(255,45,155,.85);
    box-shadow: 0 0 6px rgba(255,45,155,.4);
  }

  .wr-diff-delta {
    font-family: var(--fm); font-size: 8px; font-weight: 900;
    padding: 1px 4px; border-radius: 3px;
  }
  .wr-diff-delta.pos { color: var(--grn); background: rgba(0,255,136,.1); }
  .wr-diff-delta.neg { color: var(--red); background: rgba(255,45,85,.1); }

  .wr-conf-bar {
    height: 3px; width: 100%; border-radius: 2px;
    background: rgba(255,255,255,.06); margin: 3px 0 2px;
    overflow: hidden;
  }
  .wr-conf-fill {
    height: 100%; border-radius: 2px;
    transition: width .6s cubic-bezier(.22,1,.36,1);
  }
  .wr-conf-fill.long { background: linear-gradient(90deg, rgba(0,255,136,.4), rgba(0,255,136,.8)); }
  .wr-conf-fill.short { background: linear-gradient(90deg, rgba(255,45,85,.4), rgba(255,45,85,.8)); }
  .wr-conf-fill.neutral { background: linear-gradient(90deg, rgba(255,255,255,.15), rgba(255,255,255,.3)); }
</style>
