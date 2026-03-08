<script lang="ts">
  import { type AgentSignal } from '$lib/data/warroom';
  import { STORAGE_KEYS } from '$lib/stores/storageKeys';
  import type { TerminalDensityMode, ChartCommunitySignal } from '$lib/terminal/terminalTypes';
  import { agentSignalToCommunitySignal } from '$lib/terminal/terminalEventMappers';
  import { buildAiScanEvidence } from '$lib/terminal/signalEvidence';
  import { gameState } from '$lib/stores/gameState';
  import { openQuickTrade } from '$lib/stores/quickTradeStore';
  import { trackSignal as trackSignalStore, activeSignalCount } from '$lib/stores/trackedSignalStore';
  import { incrementTrackedSignals } from '$lib/stores/userProfileProjectionStore';
  import { notifySignalTracked } from '$lib/stores/notificationEvents';
  import { copyTradeStore, registerScanSignals } from '$lib/stores/copyTradeStore';
  import {
    formatOI,
    formatFunding
  } from '$lib/api/coinalyze';
  import { runTerminalScan, getScanHistory, getScanDetail } from '$lib/api/terminalApi';
  import { goto } from '$app/navigation';
  import { onMount, onDestroy } from 'svelte';
  import {
    createWarRoomDerivativesRuntime,
    type WarRoomDerivativesSnapshot
  } from '$lib/terminal/warroom/warRoomDerivativesRuntime';
  import {
    mergeServerTabs,
    persistWarRoomScanState,
    restoreWarRoomScanState,
    shouldAutoRunScan
  } from '$lib/terminal/warroom/warRoomScanState';
  import {
    buildSignalDiffs,
    hydrateServerScanTab,
    mapScanResultSnapshot,
    upsertScanTab
  } from '$lib/terminal/warroom/warRoomScanRuntime';
  import type { TokenFilter, ScanTab, SignalDiff, ScanHighlight } from '$lib/terminal/warroom/warRoomTypes';
  import WarRoomHeaderSection from './warroom/WarRoomHeaderSection.svelte';
  import WarRoomSignalFeed from './warroom/WarRoomSignalFeed.svelte';
  import WarRoomFooterSection from './warroom/WarRoomFooterSection.svelte';
  // C02 카드 → 채팅으로 통합됨 (VerdictCard + handleScanComplete)
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
    signals: AgentSignal[];
  };

  type WarRoomProps = {
    densityMode?: TerminalDensityMode;
    onCollapse?: () => void;
    onTracked?: (detail: { dir: AgentSignal['vote']; pair: string }) => void;
    onQuickTrade?: (detail: { dir: 'LONG' | 'SHORT'; pair: string; price: number }) => void;
    onScanStart?: () => void;
    onScanComplete?: (detail: ScanCompleteDetail) => void;
    onShowOnChart?: (detail: { signal: AgentSignal }) => void;
    onShareToCommunity?: (detail: ChartCommunitySignal) => void;
  };

  let {
    densityMode = 'essential',
    onCollapse,
    onTracked,
    onQuickTrade,
    onScanStart,
    onScanComplete,
    onShowOnChart,
    onShareToCommunity,
  }: WarRoomProps = $props();

  const SCAN_STATE_STORAGE_KEY = STORAGE_KEYS.warRoomScan;
  const MAX_SCAN_TABS = 6;
  const MAX_SIGNALS_PER_TAB = 60;
  const AUTO_SCAN_STALE_MS = 5 * 60_000; // 5분 이상이면 stale → 자동 재스캔

  let activeToken: TokenFilter = $state('ALL');
  let selectedIds: Set<string> = $state(new Set());
  let scanTabs: ScanTab[] = $state([]);
  // 기본값: 스캔 없으면 preset(빈 상태), 스캔 있으면 최신 스캔
  let activeScanId = $state('preset');
  let scanRunning = $state(false);
  let scanQueued = $state(false);
  let scanStep = $state('');
  let scanError = $state('');
  let scanStateHydrated = $state(false);

  // ── Scan Diff: 이전 스캔과 비교 ──
  let signalDiffs: Map<string, SignalDiff> = $state(new Map());
  let diffFreshUntil = $state(0);     // diff 하이라이트 유지 시간 (ms)

  // ── Derivatives Data (real-time from Coinalyze) ──
  let derivOI: number | null = $state(null);
  let derivFunding: number | null = $state(null);
  let derivPredFunding: number | null = $state(null);
  let derivLSRatio: number | null = $state(null);
  let derivLoading = $state(false);
  let derivativesRuntimeStarted = $state(false);

  const applyDerivativesSnapshot = (snapshot: WarRoomDerivativesSnapshot) => {
    derivOI = snapshot.oi;
    derivFunding = snapshot.funding;
    derivPredFunding = snapshot.predFunding;
    derivLSRatio = snapshot.lsRatio;
  };

  const derivativesRuntime = createWarRoomDerivativesRuntime({
    getPair: () => currentPair || '',
    getTimeframe: () => String(currentTF || '4h'),
    applySnapshot: applyDerivativesSnapshot,
    setLoading: (loading) => {
      derivLoading = loading;
    },
    onError: (error) => {
      console.error('[WarRoom] Derivatives fetch error:', error);
    }
  });

  // Track which server tabs are being loaded
  let _loadingServerTabs = new Set<string>();

  async function hydrateServerTab(tabId: string) {
    const tab = scanTabs.find(t => t.id === tabId);
    if (!tab || tab.signals.length > 0 || _loadingServerTabs.has(tabId)) return;
    const scanId = tabId.replace('server-', '');
    _loadingServerTabs.add(tabId);
    try {
      const res = await getScanDetail(scanId);
      if (res.record?.signals && res.record.signals.length > 0) {
        scanTabs = hydrateServerScanTab(scanTabs, tabId, res.record);
      }
    } catch (err) {
      console.warn('[WarRoom] Failed to load server scan detail:', err);
    } finally {
      _loadingServerTabs.delete(tabId);
    }
  }

  let currentPair = $derived($gameState.pair);
  let currentTF = $derived($gameState.timeframe);

  // 프리셋(하드코딩) 데이터 제거 — 실제 스캔 데이터만 표시
  let signalPool = $derived(
    activeScanId === 'preset'
      ? (scanTabs.length > 0 ? scanTabs.flatMap(t => t.signals).slice(0, MAX_SIGNALS_PER_TAB) : [])
      : scanTabs.find((tab) => tab.id === activeScanId)?.signals ?? scanTabs[0]?.signals ?? []
  );

  $effect.pre(() => {
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
  });

  $effect(() => {
    if (scanStateHydrated) {
      persistWarRoomScanState(SCAN_STATE_STORAGE_KEY, {
        activeScanId,
        activeToken,
        scanTabs
      }, MAX_SCAN_TABS);
    }
  });

  let tokenTabs = $derived(['ALL', ...Array.from(new Set(signalPool.map((s) => s.token)))]);
  let tokenCounts = $derived.by(() => tokenTabs.reduce<Record<string, number>>((acc, tok) => {
    acc[tok] = tok === 'ALL' ? signalPool.length : signalPool.filter((s) => s.token === tok).length;
    return acc;
  }, {}));
  let activeScanTab = $derived(activeScanId === 'preset'
    ? null
    : scanTabs.find((tab) => tab.id === activeScanId) ?? null);
  $effect.pre(() => { if (!tokenTabs.includes(activeToken)) activeToken = 'ALL'; });
  let filteredSignals = $derived.by(() => {
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
  });
  let selectedCount = $derived(selectedIds.size);
  let summarySignals = $derived.by(() => {
    const source = activeScanTab?.signals?.length ? activeScanTab.signals : signalPool;
    const ranked = [...source].sort((a, b) => b.conf - a.conf);
    const dedup = new Map<string, AgentSignal>();
    for (const sig of ranked) {
      if (!dedup.has(sig.agentId)) dedup.set(sig.agentId, sig);
    }
    return Array.from(dedup.values()).slice(0, 8);
  });
  let avgConfidence = $derived.by(() => signalPool.length > 0
    ? Math.round(signalPool.reduce((sum, sig) => sum + sig.conf, 0) / signalPool.length)
    : 0);
  let avgRR = $derived.by(() => signalPool.length > 0
    ? signalPool.reduce((sum, sig) => {
      const risk = Math.max(Math.abs(sig.entry - sig.sl), 0.0001);
      return sum + Math.abs(sig.tp - sig.entry) / risk;
    }, 0) / signalPool.length
    : 0);
  let consensusDir = $derived.by(() => {
    const consensusSource = activeScanTab?.signals?.length ? activeScanTab.signals : signalPool;
    const counts = { long: 0, short: 0, neutral: 0 };
    consensusSource.forEach((sig) => counts[sig.vote]++);
    if (counts.long > counts.short && counts.long > counts.neutral) return 'LONG';
    if (counts.short > counts.long && counts.short > counts.neutral) return 'SHORT';
    return 'NEUTRAL';
  });
  let topActionSignal = $derived.by(() => {
    const source = activeScanTab?.signals?.length ? activeScanTab.signals : filteredSignals;
    return [...source]
      .filter((sig) => sig.vote === 'long' || sig.vote === 'short')
      .sort((a, b) => b.conf - a.conf)[0] ?? null;
  });
  let trackedCount = $derived($activeSignalCount);

  // C02 카드 제거됨 — 분석 결과는 채팅에 표시 (handleScanComplete)

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
    // Lazy-load signals for server-only tabs
    if (id.startsWith('server-')) {
      hydrateServerTab(id);
    }
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

  function applyTopSignalToChart() {
    if (!topActionSignal) return;
    onShowOnChart?.({ signal: topActionSignal });
  }

  function scrollXOnWheel(event: WheelEvent) {
    const el = event.currentTarget as HTMLElement | null;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    const delta = Math.abs(event.deltaX) > 0 ? event.deltaX : event.deltaY;
    if (!delta) return;
    el.scrollLeft += delta;
    if (Math.abs(event.deltaY) > 0) event.preventDefault();
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
    onScanStart?.();

    const pair = currentPair || 'BTC/USDT';
    const timeframe = String(currentTF || '4h');

    try {
      scanStep = 'COUNCIL · synthesizing outputs';

      // ── 서버 API 1회 호출로 스캔 + DB 저장 동시 처리 ──
      const res = await runTerminalScan(pair, timeframe);
      const scan = mapScanResultSnapshot(res.data);
      const nextTab = upsertScanTab(scanTabs, scan, MAX_SIGNALS_PER_TAB);
      const nextScanTabs = [nextTab, ...scanTabs.filter((tab) => tab.id !== nextTab.id)].slice(0, MAX_SCAN_TABS);

      signalDiffs = buildSignalDiffs(signalPool, scan.signals);
      diffFreshUntil = Date.now() + 30_000; // 30초 동안 diff 표시

      scanTabs = nextScanTabs;
      activeScanId = nextTab.id;
      activeToken = 'ALL';
      // CopyTrade에서 참조할 수 있도록 현재 시그널 등록
      registerScanSignals(nextScanTabs.flatMap((tab) => tab.signals));
      selectedIds = new Set();
      onScanComplete?.({
        pair: scan.pair,
        timeframe: scan.timeframe,
        token: scan.token,
        createdAt: scan.createdAt,
        label: nextTab.label,
        consensus: scan.consensus,
        avgConfidence: scan.avgConfidence,
        summary: scan.summary,
        highlights: scan.highlights,
        signals: scan.signals,
      });
      scanError = '';
      scanStep = 'DONE';
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

  $effect(() => {
    currentPair;
    currentTF;
    if (derivativesRuntimeStarted) {
      derivativesRuntime.queueRefreshForMarket();
    }
  });

  // Volatility alert removed (low-value demo feature)

  function handleTrack(sig: AgentSignal) {
    trackSignalStore(sig.pair, sig.vote === 'long' ? 'LONG' : sig.vote === 'short' ? 'SHORT' : 'LONG', sig.entry, sig.name, sig.conf);
    incrementTrackedSignals();
    notifySignalTracked(sig.pair, sig.vote.toUpperCase());
    onTracked?.({ dir: sig.vote, pair: sig.pair });
  }

  function handleShareToCommunity(sig: AgentSignal) {
    const communitySignal = agentSignalToCommunitySignal(sig);
    if (communitySignal) {
      // activeScanTab의 전체 시그널에서 AI evidence 조립
      const scanSignals = activeScanTab?.signals ?? [sig];
      const evidence = buildAiScanEvidence({
        signals: scanSignals,
        pair: sig.pair,
        timeframe: String(currentTF || '4h'),
        livePrice: sig.entry,
      });
      communitySignal.evidence = evidence;
      onShareToCommunity?.(communitySignal);
    }
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
    onQuickTrade?.({ dir, pair: sig.pair, price: entry });
  }

  onMount(() => {
    const restoredState = restoreWarRoomScanState(SCAN_STATE_STORAGE_KEY, MAX_SCAN_TABS);
    if (restoredState) {
      scanTabs = restoredState.scanTabs;
      activeScanId = restoredState.activeScanId;
      activeToken = restoredState.activeToken;
    }
    scanStateHydrated = true;

    derivativesRuntimeStarted = true;
    derivativesRuntime.start();

    // Load scan history from server and merge with local tabs
    getScanHistory({ pair: currentPair, limit: MAX_SCAN_TABS })
      .then(res => {
        if (res.records.length > 0) {
          scanTabs = mergeServerTabs(scanTabs, res.records, MAX_SCAN_TABS);
        }
      })
      .catch(() => {
        // Server history unavailable — localStorage fallback already active
      })
      .finally(() => {
        // C1: Auto-Scan on Entry — 스캔이 없거나 5분 이상 stale이면 자동 실행
        if (shouldAutoRunScan(scanTabs, AUTO_SCAN_STALE_MS) && !scanRunning) {
          void runAgentScan();
        }
      });
  });

  onDestroy(() => {
    derivativesRuntimeStarted = false;
    derivativesRuntime.stop();
  });
</script>

<div class="war-room">
  <WarRoomHeaderSection
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
    {derivLoading}
    {scanRunning}
    {scanStep}
    {scanError}
    {formatOI}
    {formatFunding}
    onWheel={scrollXOnWheel}
    onCollapse={() => onCollapse?.()}
    onRunScan={runAgentScan}
    onActivateScanTab={activateScanTab}
    onSetActiveToken={(tok) => { activeToken = tok; selectedIds = new Set(); }}
  />

  <WarRoomSignalFeed
    {filteredSignals}
    {summarySignals}
    {densityMode}
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
    onShowOnChart={(sig) => onShowOnChart?.({ signal: sig })}
    onShareToCommunity={handleShareToCommunity}
  />

  <WarRoomFooterSection
    {selectedCount}
    signalPoolLength={signalPool.length}
    {trackedCount}
    {avgConfidence}
    {avgRR}
    {consensusDir}
    topSignalHint={topActionSignal ? `${topActionSignal.name} ${topActionSignal.vote.toUpperCase()} ${topActionSignal.conf}%` : ''}
    canApplyTopSignal={!!topActionSignal}
    onOpenCopyTrade={openCopyTrade}
    onApplyTopSignal={applyTopSignalToChart}
    onGoSignals={goSignals}
  />
</div>
