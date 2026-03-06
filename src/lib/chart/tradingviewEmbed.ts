import { toTradingViewInterval } from '$lib/utils/timeframe';

export interface TradingViewEmbedTheme {
  bg: string;
  grid: string;
  candleUp: string;
  candleDown: string;
}

export interface TradingViewEmbedOptions {
  pair: string;
  timeframe: string;
  theme: TradingViewEmbedTheme;
  useSafeMode?: boolean;
}

export interface TradingViewEmbedInstance {
  iframe: HTMLIFrameElement;
  container: HTMLElement;
}

export function pairToTradingViewSymbol(pair: string): string {
  return `BINANCE:${pair.replace('/', '')}`;
}

export function mountTradingViewEmbed(
  container: HTMLElement,
  options: TradingViewEmbedOptions,
  callbacks: {
    onLoad?: () => void;
    onError?: () => void;
  } = {},
): TradingViewEmbedInstance {
  const iframe = document.createElement('iframe');
  const params: Record<string, string> = {
    symbol: pairToTradingViewSymbol(options.pair),
    interval: toTradingViewInterval(options.timeframe),
    hidesidetoolbar: '0',
    symboledit: '1',
    saveimage: '1',
    toolbarbg: options.theme.bg,
    theme: 'dark',
    style: '1',
    timezone: 'Etc/UTC',
    withdateranges: '1',
    locale: 'en',
    hide_top_toolbar: '0',
    allow_symbol_change: '1',
  };

  if (!options.useSafeMode) {
    params.studies = [
      'Volume@tv-basicstudies',
      'MASimple@tv-basicstudies',
      'RSI@tv-basicstudies',
      'OBV@tv-basicstudies',
    ].join('\x1f');
    params.studies_overrides = '{}';
    params.overrides = JSON.stringify({
      'mainSeriesProperties.candleStyle.upColor': options.theme.candleUp,
      'mainSeriesProperties.candleStyle.downColor': options.theme.candleDown,
      'mainSeriesProperties.candleStyle.wickUpColor': options.theme.candleUp,
      'mainSeriesProperties.candleStyle.wickDownColor': options.theme.candleDown,
      'paneProperties.background': options.theme.bg,
      'paneProperties.vertGridProperties.color': options.theme.grid,
      'paneProperties.horzGridProperties.color': options.theme.grid,
    });
  }

  container.innerHTML = '';
  iframe.src = `https://www.tradingview.com/widgetembed/?${new URLSearchParams(params).toString()}`;
  iframe.style.cssText = 'width:100%;height:100%;border:none;display:block;';
  iframe.allow = 'fullscreen';
  iframe.loading = 'lazy';
  iframe.onload = () => callbacks.onLoad?.();
  iframe.onerror = () => callbacks.onError?.();
  container.appendChild(iframe);

  return { iframe, container };
}

export function destroyTradingViewEmbed(widget: TradingViewEmbedInstance | null): null {
  if (widget?.iframe) {
    widget.iframe.onload = null;
    widget.iframe.onerror = null;
    widget.iframe.src = 'about:blank';
  }
  if (widget?.container) {
    widget.container.innerHTML = '';
  }
  return null;
}
