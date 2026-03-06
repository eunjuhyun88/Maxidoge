import { formatRelativeTime, getTokenAliases } from './intelHelpers';
import {
  DEMO_GMX_POSITIONS,
  DEMO_POLYMARKET_POSITIONS,
  DEMO_QUICK_TRADES,
  FEED_FILTER_OPTIONS_ALL,
  FEED_FILTER_OPTIONS_ESSENTIAL,
  TREND_BASIS,
  TREND_BASIS_COMPACT,
  TREND_TAB_OPTIONS_ALL,
  TREND_TAB_OPTIONS_ESSENTIAL,
  type DexHot,
  type FeedFilter,
  type GainerLoser,
  type HeadlineEx,
  type OpScore,
  type PolicyCard,
  type PolicyPanel,
  type PositionMarketRow,
  type PositionTradeRow,
  type TrendTab,
  type TrendingCoin,
} from './intelTypes';

export function deriveIntelPositionState(params: {
  openTrades: PositionTradeRow[];
  gmxPositions: PositionMarketRow[];
  polymarketPositions: PositionMarketRow[];
  pendingPositions: Array<unknown>;
  positionsLoading: boolean;
  positionsError: unknown;
  positionsLastSyncedAt: number | null;
}) {
  const {
    openTrades,
    gmxPositions,
    polymarketPositions,
    pendingPositions,
    positionsLoading,
    positionsError,
    positionsLastSyncedAt,
  } = params;
  const openCount = openTrades.length;
  const livePositionCount = openCount + gmxPositions.length + polymarketPositions.length;
  const hasLivePositions = livePositionCount > 0;
  const useDemoPositions = !!positionsError && !positionsLoading && !hasLivePositions;
  const displayTrades = useDemoPositions ? DEMO_QUICK_TRADES : openTrades;
  const displayGmxPositions = useDemoPositions ? DEMO_GMX_POSITIONS : gmxPositions;
  const displayPolymarketPositions = useDemoPositions ? DEMO_POLYMARKET_POSITIONS : polymarketPositions;
  const displayOpenCount = displayTrades.length;
  const displayGmxCount = displayGmxPositions.length;
  const displayPolymarketCount = displayPolymarketPositions.length;
  const positionCount = displayOpenCount + displayGmxCount + displayPolymarketCount;
  const pendingCount = pendingPositions.length;
  const positionsSyncStatus = useDemoPositions
    ? 'DEMO MODE'
    : positionsLoading
      ? 'SYNCING...'
      : positionsError
        ? 'RETRY NEEDED'
        : positionsLastSyncedAt
          ? `SYNCED ${formatRelativeTime(positionsLastSyncedAt)} AGO`
          : 'NOT SYNCED';

  return {
    opens: openTrades,
    openCount,
    livePositionCount,
    hasLivePositions,
    useDemoPositions,
    displayTrades,
    displayGmxPositions,
    displayPolymarketPositions,
    displayOpenCount,
    displayGmxCount,
    displayPolymarketCount,
    positionCount,
    pendingCount,
    positionsSyncStatus,
  };
}

export function deriveIntelTrendState(params: {
  densityMode: 'essential' | 'pro';
  trendSubTab: TrendTab;
  trendUpdatedAt: number;
  trendDexHot: DexHot[];
  dexChainFilter: string;
  topPicks: OpScore[];
  trendingCoins: TrendingCoin[];
  trendGainers: GainerLoser[];
  trendLosers: GainerLoser[];
}) {
  const {
    densityMode,
    trendSubTab,
    trendUpdatedAt,
    trendDexHot,
    dexChainFilter,
    topPicks,
    trendingCoins,
    trendGainers,
    trendLosers,
  } = params;
  const trendBasisText = TREND_BASIS[trendSubTab];
  const trendBasisCompactText = TREND_BASIS_COMPACT[trendSubTab];
  const trendUpdatedLabel = trendUpdatedAt > 0 ? `${formatRelativeTime(trendUpdatedAt)} ago` : '';
  const dexChains = ['all', ...Array.from(new Set(trendDexHot.map((item) => item.chainId)))];
  const nextDexChainFilter = dexChains.includes(dexChainFilter) ? dexChainFilter : 'all';
  const filteredDexHot = nextDexChainFilter === 'all'
    ? trendDexHot
    : trendDexHot.filter((item) => item.chainId === nextDexChainFilter);
  const visibleTopPicks = densityMode === 'essential' ? topPicks.slice(0, 4) : topPicks.slice(0, 6);
  const visibleTrendingCoins = densityMode === 'essential' ? trendingCoins.slice(0, 10) : trendingCoins;
  const visibleTrendGainers = densityMode === 'essential' ? trendGainers.slice(0, 8) : trendGainers;
  const visibleTrendLosers = densityMode === 'essential' ? trendLosers.slice(0, 8) : trendLosers;
  const visibleDexHot = densityMode === 'essential' ? filteredDexHot.slice(0, 10) : filteredDexHot;

  return {
    trendBasisText,
    trendBasisCompactText,
    trendUpdatedLabel,
    dexChains,
    dexChainFilter: nextDexChainFilter,
    filteredDexHot,
    visibleTopPicks,
    visibleTrendingCoins,
    visibleTrendGainers,
    visibleTrendLosers,
    visibleDexHot,
  };
}

export function deriveIntelFeedOptions(densityMode: 'essential' | 'pro') {
  return {
    feedFilterOptions: densityMode === 'essential' ? FEED_FILTER_OPTIONS_ESSENTIAL : FEED_FILTER_OPTIONS_ALL,
    trendTabOptions: densityMode === 'essential' ? TREND_TAB_OPTIONS_ESSENTIAL : TREND_TAB_OPTIONS_ALL,
  };
}

export function normalizeFeedFilterForDensity(
  densityMode: 'essential' | 'pro',
  feedFilter: FeedFilter,
): FeedFilter {
  if (densityMode === 'essential' && (feedFilter === 'all' || feedFilter === 'flow' || feedFilter === 'community')) {
    return 'trending';
  }
  return feedFilter;
}

export function normalizeTrendTabForDensity(
  densityMode: 'essential' | 'pro',
  trendSubTab: TrendTab,
): TrendTab {
  if (densityMode === 'essential' && trendSubTab === 'dex') {
    return 'picks';
  }
  return trendSubTab;
}

export function deriveIntelHeadlineState(params: {
  pair: string;
  liveHeadlines: HeadlineEx[];
  densityMode: 'essential' | 'pro';
}) {
  const currentToken = params.pair.split('/')[0] || 'BTC';
  const tokenAliases = getTokenAliases(currentToken);
  const filteredHeadlines = params.liveHeadlines.filter((headline) =>
    tokenAliases.some((alias) => headline.text.toLowerCase().includes(alias)) ||
    headline.text.toLowerCase().includes('crypto') ||
    headline.text.toLowerCase().includes('exchange') ||
    headline.text.toLowerCase().includes('market')
  );
  const displayHeadlines = filteredHeadlines.length >= 2 ? filteredHeadlines : params.liveHeadlines;
  const visibleHeadlines = params.densityMode === 'essential' ? displayHeadlines.slice(0, 8) : displayHeadlines;

  return {
    currentToken,
    tokenAliases,
    filteredHeadlines,
    displayHeadlines,
    visibleHeadlines,
  };
}

export function derivePolicyCardsForTab(params: {
  feedFilter: FeedFilter;
  trendSubTab: TrendTab;
  policyPanels: Record<PolicyPanel, PolicyCard[]>;
}) {
  const { feedFilter, trendSubTab, policyPanels } = params;
  if (feedFilter === 'news') return policyPanels.headlines;
  if (feedFilter === 'events') return policyPanels.events;
  if (feedFilter === 'flow') return policyPanels.flow;
  if (feedFilter === 'trending') {
    return trendSubTab === 'picks' ? policyPanels.picks : policyPanels.trending;
  }
  return [];
}
