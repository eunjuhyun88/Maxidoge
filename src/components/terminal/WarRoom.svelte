<script lang="ts">
  import { type AgentSignal } from '$lib/data/warroom';
  import { gameState, setView } from '$lib/stores/gameState';
  import { openQuickTrade } from '$lib/stores/quickTradeStore';
  import { trackSignal as trackSignalStore, activeSignalCount } from '$lib/stores/trackedSignalStore';
  import { incrementTrackedSignals } from '$lib/stores/userProfileStore';
  import { notifySignalTracked } from '$lib/stores/notificationStore';
  import { copyTradeStore, registerScanSignals } from '$lib/stores/copyTradeStore';
  import {
    fetchCurrentOI,
    fetchCurrentFunding,
    fetchPredictedFunding,
    fetchLiquidationHistory,
    fetchLSRatioHistory,
    formatOI,
    formatFunding
  } from '$lib/api/coinalyze';
  import { runTerminalScan, getScanHistory } from '$lib/api/terminalApi';
  import { AGENT_POOL } from '$lib/engine/agents';
  import { goto } from '$app/navigation';
  import { onMount, onDestroy } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import WarRoomHeaderSection from './warroom/WarRoomHeaderSection.svelte';
  import WarRoomSignalFeed from './warroom/WarRoomSignalFeed.svelte';
  import WarRoomFooterSection from './warroom/WarRoomFooterSection.svelte';
  import type { TokenFilter, ScanTab, SignalDiff, ScanHighlight } from './warroom/types';
  import './warroom/warroom.css';

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

      // ── 서버 API 1회 호출로 스캔 + DB 저장 동시 처리 ──
      const res = await runTerminalScan(pair, timeframe);
      const detail = res.data;

      // ── 서버 응답 → AgentSignal 변환 ──
      const agentMeta: Record<string, { icon: string; color: string }> = {};
      for (const [id, def] of Object.entries(AGENT_POOL)) {
        agentMeta[id] = { icon: def.icon, color: def.color };
      }
      const signals: AgentSignal[] = detail.signals.map(s => {
        const meta = agentMeta[s.agentId.toUpperCase()] ?? { icon: '?', color: '#888' };
        return {
          id: s.id,
          agentId: s.agentId,
          icon: meta.icon,
          name: s.name,
          color: meta.color,
          token: detail.token,
          pair: detail.pair,
          vote: s.vote as AgentSignal['vote'],
          conf: s.conf,
          text: s.text,
          src: s.src,
          time: s.time,
          entry: s.entry,
          tp: s.tp,
          sl: s.sl,
        };
      });

      const scan = {
        pair: detail.pair,
        timeframe: detail.timeframe,
        token: detail.token,
        createdAt: detail.createdAt,
        label: detail.label,
        signals,
        consensus: detail.consensus as AgentSignal['vote'],
        avgConfidence: detail.avgConfidence,
        summary: detail.summary,
        highlights: detail.highlights as ScanHighlight[],
      };

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
      // CopyTrade에서 참조할 수 있도록 현재 시그널 등록
      registerScanSignals(scanTabs.flatMap(t => t.signals));
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
      serverScanSynced = res.persisted;
      if (res.warning) console.warn('[WarRoom] Scan warning:', res.warning);
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

  function goSignals() {
    goto('/signals');
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
  <WarRoomHeaderSection
    {volatilityAlert}
    {currentPair}
    currentTF={String(currentTF)}
    {activeScanTab}
    {activeScanId}
    {scanTabs}
    {tokenTabs}
    {activeToken}
    {tokenCounts}
    {derivOI}
    {derivFunding}
    {derivPredFunding}
    {derivLSRatio}
    {derivLiqLong}
    {derivLiqShort}
    {derivLoading}
    {scanRunning}
    {scanStep}
    {scanError}
    {formatOI}
    {formatFunding}
    onWheel={scrollXOnWheel}
    onGoSignals={goSignals}
    onGoArena={goArena}
    onCollapse={() => dispatch('collapse')}
    onActivateScanTab={activateScanTab}
    onSetActiveToken={(tok) => { activeToken = tok; selectedIds = new Set(); }}
  />

  <WarRoomSignalFeed
    {filteredSignals}
    {signalPool}
    {scanTabs}
    {selectedIds}
    {selectedCount}
    {signalDiffs}
    {diffFreshUntil}
    {fmtPrice}
    onSelectAll={selectAll}
    onToggleSelect={toggleSelect}
    onQuickTrade={quickTrade}
    onTrack={handleTrack}
    onRunScan={runAgentScan}
  />

  <WarRoomFooterSection
    {selectedCount}
    signalPoolLength={signalPool.length}
    {trackedCount}
    {avgConfidence}
    {avgRR}
    {consensusDir}
    onOpenCopyTrade={openCopyTrade}
    onGoSignals={goSignals}
  />
</div>
