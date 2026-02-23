// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — LunarCrush API Client (server-side)
// ═══════════════════════════════════════════════════════════════
// Social metrics: sentiment, social volume, interactions, dominance
// Maps to: SENTI agent → SOCIAL_VOLUME, SOCIAL_SENTIMENT

import { env } from '$env/dynamic/private';
import { getCached, setCache } from './providers/cache';

const BASE = 'https://lunarcrush.com/api4/public';
const CACHE_TTL = 120_000; // 2 min

function apiKey(): string {
  return env.LUNARCRUSH_API_KEY ?? '';
}

export interface LunarCrushTopicData {
  topic: string;
  sentiment: number;          // 1-5 (1=bearish, 5=bullish)
  interactions24h: number;    // total engagements 24h
  postsActive: number;        // active mentions
  contributorsActive: number; // unique creators posting
  socialDominance: number;    // % of total crypto social volume
  galaxyScore: number;        // 0-100 overall health
  altRank: number;            // rank vs other cryptos
  topicRank: number;
  close: number;              // price
  percentChange24h: number;
  volume24h: number;
  marketCap: number;
}

async function lcFetch<T>(path: string): Promise<T | null> {
  const key = apiKey();
  if (!key) return null;

  const cacheKey = `lunarcrush:${path}`;
  const cached = getCached<T>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error(`[LunarCrush] ${res.status} ${res.statusText}`);
      return null;
    }
    const json = await res.json();
    setCache(cacheKey, json?.data ?? json, CACHE_TTL);
    return (json?.data ?? json) as T;
  } catch (err) {
    console.error('[LunarCrush]', err);
    return null;
  }
}

/** Fetch topic social metrics (BTC, ETH, SOL, etc.) */
export async function fetchTopicSocial(topic: string): Promise<LunarCrushTopicData | null> {
  const raw = await lcFetch<any>(`/topic/${topic.toLowerCase()}/v1`);
  if (!raw) return null;

  return {
    topic: raw.topic ?? topic,
    sentiment: raw.sentiment ?? 3,
    interactions24h: raw.interactions_24h ?? raw.interactions ?? 0,
    postsActive: raw.posts_active ?? raw.num_posts ?? 0,
    contributorsActive: raw.contributors_active ?? raw.num_contributors ?? 0,
    socialDominance: raw.social_dominance ?? 0,
    galaxyScore: raw.galaxy_score ?? 0,
    altRank: raw.alt_rank ?? 0,
    topicRank: raw.topic_rank ?? 0,
    close: raw.close ?? raw.price ?? 0,
    percentChange24h: raw.percent_change_24h ?? 0,
    volume24h: raw.volume_24h ?? raw.volume ?? 0,
    marketCap: raw.market_cap ?? 0,
  };
}

/** Check if LunarCrush API key is configured */
export function hasLunarCrushKey(): boolean {
  return Boolean(apiKey());
}
