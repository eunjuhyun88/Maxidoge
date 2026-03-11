import type { IntelFlowApiPayload, IntelNewsRecord } from '$lib/api/intelApi';
import { formatRelativeTime } from './intelHelpers';
import type { HeadlineEx, LiveFlowItem } from './intelTypes';

export function mapIntelNewsRecordsToHeadlines(records: IntelNewsRecord[]): HeadlineEx[] {
  return records.map((record) => ({
    icon: record.sentiment === 'bullish' ? '📈' : record.sentiment === 'bearish' ? '📉' : '📊',
    time: formatRelativeTime(Date.parse(record.publishedAt) || Date.now()),
    text: record.title || record.summary,
    bull: record.sentiment === 'bullish',
    link: record.link || '',
    interactions: record.interactions || 0,
    importance: record.importance || 0,
    network: record.network || 'rss',
    creator: record.creator || record.source || '',
  }));
}

export function mapIntelFlowPayloadToRows(payload: IntelFlowApiPayload): LiveFlowItem[] {
  const snapshot = payload.snapshot || {};
  const rows: LiveFlowItem[] = [];

  if (snapshot.funding != null) {
    rows.push({
      id: 'funding',
      label: `Funding Rate ${snapshot.funding > 0 ? '↑' : '↓'}`,
      addr: payload.pair,
      amt: `${(snapshot.funding * 100).toFixed(4)}%`,
      isBuy: snapshot.funding < 0,
      source: 'COINALYZE',
    });
  }

  if (snapshot.lsRatio != null) {
    rows.push({
      id: 'ls-ratio',
      label: 'Long / Short Ratio',
      addr: payload.pair,
      amt: `${Number(snapshot.lsRatio).toFixed(2)}`,
      isBuy: Number(snapshot.lsRatio) < 1,
      source: 'COINALYZE',
    });
  }

  if (snapshot.liqLong24h || snapshot.liqShort24h) {
    rows.push({
      id: 'liq-long',
      label: '↙ Liquidations LONG 24h',
      addr: payload.pair,
      amt: `$${Math.round(snapshot.liqLong24h || 0).toLocaleString()}`,
      isBuy: false,
      source: 'COINALYZE',
    });
    rows.push({
      id: 'liq-short',
      label: '↗ Liquidations SHORT 24h',
      addr: payload.pair,
      amt: `$${Math.round(snapshot.liqShort24h || 0).toLocaleString()}`,
      isBuy: true,
      source: 'COINALYZE',
    });
  }

  if (snapshot.quoteVolume24h) {
    rows.push({
      id: 'volume',
      label: '↔ 24h Quote Volume',
      addr: payload.pair,
      amt: `$${(snapshot.quoteVolume24h / 1e9).toFixed(2)}B`,
      isBuy: (snapshot.priceChangePct || 0) >= 0,
      source: 'BINANCE',
    });
  }

  if (snapshot.cmcMarketCap) {
    rows.push({
      id: 'cmc-mcap',
      label: 'Global Market Cap',
      addr: payload.pair,
      amt: `$${(Number(snapshot.cmcMarketCap) / 1e9).toFixed(1)}B`,
      isBuy: (snapshot.cmcChange24hPct || 0) >= 0,
      source: 'CMC',
    });
  }

  if (snapshot.cmcChange24hPct != null) {
    const change24hPct = Number(snapshot.cmcChange24hPct);
    rows.push({
      id: 'cmc-change',
      label: 'CMC 24h Change',
      addr: payload.pair,
      amt: `${change24hPct >= 0 ? '+' : ''}${change24hPct.toFixed(2)}%`,
      isBuy: change24hPct >= 0,
      source: 'CMC',
    });
  }

  if (rows.length === 0 && payload.records.length > 0) {
    for (const record of payload.records.slice(0, 3)) {
      rows.push({
        id: `record-${record.id}`,
        label: record.agent || 'FLOW',
        addr: record.pair || payload.pair,
        amt: record.text || '',
        isBuy: record.vote === 'LONG',
        source: record.source || 'UNKNOWN',
      });
    }
  }

  return rows;
}
