import { getTerminalLiveTicker } from '$lib/api/terminalApi';

type TerminalViewport = 'mobile' | 'tablet' | 'desktop';

interface GTMWindow extends Window {
  dataLayer?: Array<Record<string, unknown>>;
}

export interface CopyTradeBootstrapDraft {
  pair: string;
  dir: 'LONG' | 'SHORT';
  entry: number;
  tp: number;
  sl: number;
  conf: number;
  source: string;
  reason: string;
}

export function createTerminalGtmEmitter(params: {
  component: string;
  getViewport: () => TerminalViewport;
}) {
  return function emitTerminalGtm(event: string, payload: Record<string, unknown> = {}) {
    if (typeof window === 'undefined') return;
    const w = window as GTMWindow;
    if (!Array.isArray(w.dataLayer)) return;
    w.dataLayer.push({
      event,
      page: 'terminal',
      component: params.component,
      viewport: params.getViewport(),
      ...payload,
    });
  };
}

export function createTerminalShellRuntime(params: {
  getAbortSignal: () => AbortSignal;
  setLiveTicker: (ticker: string) => void;
  setTickerLoaded: (loaded: boolean) => void;
  startAlertEngine: () => void;
  stopAlertEngine: () => void;
  openCopyTradeDraft: (draft: CopyTradeBootstrapDraft) => void;
  warn: (message: string) => void;
}) {
  function mount() {
    void loadTerminalLiveTicker(AbortSignal.any([AbortSignal.timeout(5000), params.getAbortSignal()]))
      .then((ticker) => {
        if (!ticker) {
          params.warn('[Terminal] Live ticker fetch failed, using fallback');
          return;
        }
        params.setLiveTicker(ticker);
        params.setTickerLoaded(true);
      });

    params.startAlertEngine();

    if (typeof window === 'undefined') return;

    const bootstrap = extractCopyTradeBootstrap(window.location.search, window.location.pathname);
    if (bootstrap.draft) {
      params.openCopyTradeDraft(bootstrap.draft);
    }
    if (bootstrap.nextUrl) {
      history.replaceState({}, '', bootstrap.nextUrl);
    }
  }

  function destroy() {
    params.stopAlertEngine();
  }

  return {
    destroy,
    mount,
  };
}

export async function loadTerminalLiveTicker(signal: AbortSignal): Promise<string | null> {
  try {
    const snapshot = await getTerminalLiveTicker({ signal });
    if (!snapshot) return null;

    const parts: string[] = [];
    if (snapshot.btcDominance !== null) parts.push(`BTC_DOM: ${snapshot.btcDominance.toFixed(1)}%`);
    if (snapshot.totalVolumeUsd !== null) parts.push(`VOL_24H: $${(snapshot.totalVolumeUsd / 1e9).toFixed(1)}B`);
    if (snapshot.totalMarketCapUsd !== null) parts.push(`MCAP: $${(snapshot.totalMarketCapUsd / 1e12).toFixed(2)}T`);
    if (snapshot.ethDominance !== null) parts.push(`ETH_DOM: ${snapshot.ethDominance.toFixed(1)}%`);
    if (snapshot.marketCapChange24hPct !== null) {
      parts.push(`MCAP_24H: ${snapshot.marketCapChange24hPct >= 0 ? '+' : ''}${snapshot.marketCapChange24hPct.toFixed(2)}%`);
    }
    if (snapshot.fearGreedValue !== null) {
      parts.push(`FEAR_GREED: ${snapshot.fearGreedValue} (${snapshot.fearGreedClassification ?? 'unknown'})`);
    }
    if (snapshot.stablecoinTotalMcapUsd !== null) {
      parts.push(`STABLE_MCAP: $${(snapshot.stablecoinTotalMcapUsd / 1e9).toFixed(1)}B`);
    }

    if (parts.length === 0) return null;

    parts.push(`UPDATED: ${new Date().toTimeString().slice(0, 5)}`);
    return parts.join(' | ');
  } catch {
    return null;
  }
}

export function extractCopyTradeBootstrap(
  search: string,
  pathname: string,
): { draft: CopyTradeBootstrapDraft | null; nextUrl: string | null } {
  const params = new URLSearchParams(search);
  if (params.get('copyTrade') !== '1') {
    return { draft: null, nextUrl: null };
  }

  const pair = params.get('pair') || 'BTC/USDT';
  const dir: CopyTradeBootstrapDraft['dir'] = params.get('dir') === 'SHORT' ? 'SHORT' : 'LONG';
  const entry = Number(params.get('entry') || 0);
  const tp = Number(params.get('tp') || 0);
  const sl = Number(params.get('sl') || 0);
  const conf = Number(params.get('conf') || 70);
  const source = params.get('source') || 'SIGNAL ROOM';
  const reason = params.get('reason') || '';

  const draft = pair && Number.isFinite(entry) && entry > 0 && Number.isFinite(tp) && Number.isFinite(sl)
    ? {
        pair,
        dir,
        entry,
        tp,
        sl,
        conf: Number.isFinite(conf) ? conf : 70,
        source,
        reason,
      }
    : null;

  params.delete('copyTrade');
  params.delete('pair');
  params.delete('dir');
  params.delete('entry');
  params.delete('tp');
  params.delete('sl');
  params.delete('conf');
  params.delete('source');
  params.delete('reason');

  const nextQuery = params.toString();
  return {
    draft,
    nextUrl: nextQuery ? `${pathname}?${nextQuery}` : pathname,
  };
}
