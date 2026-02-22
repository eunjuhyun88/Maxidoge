// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — War Room Data (Terminal View)
// ═══════════════════════════════════════════════════════════════

export interface WRMessage {
  icon: string;
  name: string;
  color: string;
  vote: 'short' | 'long' | 'neutral';
  time: string;
  text: string;
  src: string;
}

export const WR_MESSAGES: WRMessage[] = [
  {
    icon: '⚡', name: 'CHART', color: '#3b9eff', vote: 'short', time: '14:15',
    text: 'Bearish OB $98.2K-$98.8K unfilled. Premium Zone 67%. HTF Bearish Engulfing. ICT SHORT valid.',
    src: 'SRC: BIN:BTC:1D · 4/8 SHORT'
  },
  {
    icon: '💰', name: 'CHAIN', color: '#00e68a', vote: 'short', time: '14:18',
    text: '$67M+$45M Binance deposit. 24h net inflow $128M. 3 whales moving simultaneously — 3/4 past cases led to -8~-16% in 72h.',
    src: 'SRC: ARKHAM:BTC:INFLOW · 88%'
  },
  {
    icon: '📊', name: 'DERIV', color: '#ff8c3b', vote: 'short', time: '14:19',
    text: 'Funding +0.082% extreme. OI +18.5% 24h. Longs overcrowded. Liquidation cascade trigger near $96.8K.',
    src: 'SRC: BIN:BTC:FUNDING/OI'
  },
  {
    icon: '💜', name: 'SOCIAL', color: '#8b5cf6', vote: 'neutral', time: '14:20',
    text: 'Social +42% surge but mixed direction. F&G 28 Fear. 5 influencer bearish calls. NEUTRAL.',
    src: 'SRC: LUNAR:BTC:VOL/FG'
  },
  {
    icon: '🛡', name: 'ALERT', color: '#ff3d5c', vote: 'short', time: '14:21',
    text: '3/5 SHORT consensus. Similar zone: 3/4 past cases succeeded (avg +11.2%). Entry Score 72.',
    src: 'SRC: CONTEXT:ZONE · SCORE:72'
  }
];

// ═══ Multi-Token Agent Signals ═══
export interface AgentSignal {
  id: string;
  agentId: string;
  icon: string;
  name: string;
  color: string;
  token: string;
  pair: string;
  vote: 'long' | 'short' | 'neutral';
  conf: number;
  text: string;
  src: string;
  time: string;
  entry: number;
  tp: number;
  sl: number;
}

export const AGENT_SIGNALS: AgentSignal[] = [
  // ── BTC Signals ──
  { id: 'structure-btc', agentId: 'structure', icon: '⚡', name: 'STRUCTURE', color: '#3b9eff', token: 'BTC', pair: 'BTC/USDT', vote: 'short', conf: 82, time: '14:15',
    text: 'Bearish OB $98.2K-$98.8K unfilled. Premium Zone 67%. HTF Bearish Engulfing. ICT SHORT valid.',
    src: 'BIN:BTC:4H', entry: 68200, tp: 66100, sl: 69500 },
  { id: 'flow-btc', agentId: 'flow', icon: '💰', name: 'FLOW', color: '#00e68a', token: 'BTC', pair: 'BTC/USDT', vote: 'short', conf: 71, time: '14:18',
    text: '$67M+$45M Binance deposit. 24h net inflow $128M. 3 whales moving simultaneously.',
    src: 'ARKHAM:BTC:INFLOW', entry: 68200, tp: 66400, sl: 69800 },
  { id: 'deriv-btc', agentId: 'deriv', icon: '📊', name: 'DERIV', color: '#ff8c3b', token: 'BTC', pair: 'BTC/USDT', vote: 'short', conf: 75, time: '14:19',
    text: 'Funding +0.082% extreme. OI +18.5% 24h. Longs overcrowded. Liquidation cascade near $66.8K.',
    src: 'BIN:BTC:FUNDING/OI', entry: 68200, tp: 66100, sl: 69200 },
  { id: 'senti-btc', agentId: 'senti', icon: '💜', name: 'SENTI', color: '#8b5cf6', token: 'BTC', pair: 'BTC/USDT', vote: 'neutral', conf: 55, time: '14:20',
    text: 'Social +42% surge but mixed direction. F&G 28 Fear zone. 5 KOL bearish calls. NEUTRAL bias.',
    src: 'LUNAR:BTC:VOL/FG', entry: 68200, tp: 69800, sl: 66800 },
  { id: 'macro-btc', agentId: 'macro', icon: '🌍', name: 'MACRO', color: '#f43f5e', token: 'BTC', pair: 'BTC/USDT', vote: 'short', conf: 72, time: '14:21',
    text: 'DXY risk-off + elevated funding suggests reflexive downside. Regime score favors defensive SHORT bias.',
    src: 'MACRO:REGIME', entry: 68200, tp: 66100, sl: 69500 },

  // ── ETH Signals ──
  { id: 'structure-eth', agentId: 'structure', icon: '⚡', name: 'STRUCTURE', color: '#3b9eff', token: 'ETH', pair: 'ETH/USDT', vote: 'long', conf: 78, time: '14:22',
    text: 'ETH/BTC ratio recovering. 4H Bullish BOS confirmed at $1,940. OB $1,920 holds as support.',
    src: 'BIN:ETH:4H', entry: 1972, tp: 2050, sl: 1920 },
  { id: 'flow-eth', agentId: 'flow', icon: '💰', name: 'FLOW', color: '#00e68a', token: 'ETH', pair: 'ETH/USDT', vote: 'long', conf: 68, time: '14:24',
    text: '$42M exchange outflow. Smart money accumulating. DeFi TVL up 8% 7d. Staking deposits rising.',
    src: 'ARKHAM:ETH:OUTFLOW', entry: 1972, tp: 2060, sl: 1930 },
  { id: 'deriv-eth', agentId: 'deriv', icon: '📊', name: 'DERIV', color: '#ff8c3b', token: 'ETH', pair: 'ETH/USDT', vote: 'long', conf: 65, time: '14:25',
    text: 'Funding -0.01% slightly negative. OI flat. Shorts building but no conviction. Options skew bullish.',
    src: 'BIN:ETH:FUNDING/OI', entry: 1972, tp: 2040, sl: 1940 },
  { id: 'senti-eth', agentId: 'senti', icon: '💜', name: 'SENTI', color: '#8b5cf6', token: 'ETH', pair: 'ETH/USDT', vote: 'long', conf: 72, time: '14:26',
    text: 'ETH sentiment turning bullish. Pectra upgrade narrative. KOL mentions +120% 48h. F&G 42.',
    src: 'LUNAR:ETH:VOL/FG', entry: 1972, tp: 2080, sl: 1925 },
  { id: 'macro-eth', agentId: 'macro', icon: '🌍', name: 'MACRO', color: '#f43f5e', token: 'ETH', pair: 'ETH/USDT', vote: 'long', conf: 70, time: '14:27',
    text: 'Risk-on macro pocket with softer dollar and improving breadth supports ETH continuation scenario.',
    src: 'MACRO:REGIME', entry: 1972, tp: 2050, sl: 1920 },

  // ── SOL Signals ──
  { id: 'structure-sol', agentId: 'structure', icon: '⚡', name: 'STRUCTURE', color: '#3b9eff', token: 'SOL', pair: 'SOL/USDT', vote: 'long', conf: 80, time: '14:28',
    text: 'SOL 4H Higher Low confirmed. FVG $82-$84 acting as support. Bullish MS intact.',
    src: 'BIN:SOL:4H', entry: 85, tp: 92, sl: 81 },
  { id: 'flow-sol', agentId: 'flow', icon: '💰', name: 'FLOW', color: '#00e68a', token: 'SOL', pair: 'SOL/USDT', vote: 'long', conf: 74, time: '14:30',
    text: 'DEX volume surging +35%. NFT mints on Solana up 200%. Validator stake increasing.',
    src: 'FLIPSIDE:SOL:DEX', entry: 85, tp: 91, sl: 82 },
  { id: 'deriv-sol', agentId: 'deriv', icon: '📊', name: 'DERIV', color: '#ff8c3b', token: 'SOL', pair: 'SOL/USDT', vote: 'neutral', conf: 58, time: '14:31',
    text: 'OI +12% but funding neutral. Options max pain at $84. Mixed signals on derivative side.',
    src: 'BIN:SOL:FUNDING/OI', entry: 85, tp: 88, sl: 82 },
  { id: 'senti-sol', agentId: 'senti', icon: '💜', name: 'SENTI', color: '#8b5cf6', token: 'SOL', pair: 'SOL/USDT', vote: 'long', conf: 76, time: '14:32',
    text: 'SOL narrative strongest in market. Firedancer hype. Social dominance 18%. Extremely bullish.',
    src: 'LUNAR:SOL:VOL/FG', entry: 85, tp: 95, sl: 80 },
  { id: 'macro-sol', agentId: 'macro', icon: '🌍', name: 'MACRO', color: '#f43f5e', token: 'SOL', pair: 'SOL/USDT', vote: 'long', conf: 73, time: '14:33',
    text: 'High-beta regime remains supportive while liquidity expands. SOL relative strength keeps upside bias.',
    src: 'MACRO:REGIME', entry: 85, tp: 92, sl: 81 },
];

export function getSignalsByToken(token: string | 'ALL'): AgentSignal[] {
  if (token === 'ALL') return AGENT_SIGNALS;
  return AGENT_SIGNALS.filter(s => s.token === token);
}

export function getConsensus(signals: AgentSignal[]): { dir: 'LONG' | 'SHORT' | 'NEUTRAL'; conf: number; count: { long: number; short: number; neutral: number } } {
  const count = { long: 0, short: 0, neutral: 0 };
  let totalConf = 0;
  signals.forEach(s => {
    count[s.vote]++;
    totalConf += s.conf;
  });
  const avgConf = signals.length ? Math.round(totalConf / signals.length) : 0;
  const dir = count.long > count.short ? 'LONG' : count.short > count.long ? 'SHORT' : 'NEUTRAL';
  return { dir, conf: avgConf, count };
}

export const THOUGHTS = [
  { agent: 0, text: '$67M Binance deposit → SELL PRESSURE', color: '#00e68a' },
  { agent: 2, text: 'Funding +0.082% extreme → SHORT bias ↑', color: '#ff8c3b' },
  { agent: 0, text: 'Bearish OB $98.2K zone → premium rejection', color: '#3b9eff' },
  { agent: 4, text: '3/5 agents SHORT → entry score 72 approved', color: '#ff3d5c' }
];

export const TICKER_DATA = 'GAS: 14 GWEI | SOL_PRICE: $142.22 | BTC_DOMINANCE: 52.4% | TRADING_VOLUME_24H: $4.2B | LIQUIDATIONS_1H: $1.2M | SYSTEM_STABILITY: 99.98% | BLOCK_HEIGHT: 1982/... | ETH_GAS: 8 GWEI | FEAR_GREED: 28 | OI_BTC: $18.4B | FUNDING: +0.082%';

export interface Headline {
  icon: string;
  time: string;
  text: string;
  bull: boolean;
}

export const HEADLINES: Headline[] = [
  { icon: '⚡', time: '2m', text: 'BTC breaks $100K psychological barrier — record volume', bull: true },
  { icon: '💰', time: '5m', text: 'Whale alert: 50K ETH moved to cold storage', bull: true },
  { icon: '📊', time: '8m', text: 'Record $2.1B in options expiring Friday', bull: false },
  { icon: '🛡', time: '12m', text: 'US SEC delays spot ETH ETF decision to Q3', bull: false },
  { icon: '💜', time: '18m', text: 'Crypto Twitter sentiment shifts bullish — mentions +340%', bull: true },
  { icon: '👑', time: '25m', text: 'MicroStrategy adds 2,500 BTC to treasury', bull: true },
  { icon: '🔍', time: '32m', text: 'SOL/BTC ratio at 6-month high', bull: true },
  { icon: '⚡', time: '45m', text: 'Major exchange outflow: 12,000 BTC in 4 hours', bull: true }
];

export interface EventData {
  tag: string;
  tagColor: string;
  time: string;
  text: string;
  src: string;
  borderColor: string;
}

export const EVENTS: EventData[] = [
  { tag: 'ON-CHAIN', tagColor: '#00e68a', time: '14:15', text: '$67M + $45M consecutive Binance deposits from 2 whale wallets. Historical: 3/4 similar events led to -8~-16% within 72h.', src: 'Arkham Intelligence', borderColor: '#00e68a' },
  { tag: 'DERIV', tagColor: '#ff8c3b', time: '14:10', text: 'Funding rate exceeded +0.08% — top 5% historical extreme. Last 4 occurrences: 3 led to corrections within 48h.', src: 'Binance Futures', borderColor: '#ff8c3b' },
  { tag: 'MACRO', tagColor: '#3b9eff', time: '13:45', text: 'FOMC minutes signal potential rate pause. DXY weakening. Traditional risk-on sentiment building.', src: 'Fed Reserve', borderColor: '#3b9eff' },
  { tag: 'SOCIAL', tagColor: '#8b5cf6', time: '13:30', text: 'Top 5 crypto KOLs posted bearish calls within 2-hour window. Unusual coordinated sentiment shift.', src: 'LunarCrush', borderColor: '#8b5cf6' }
];

export interface CommunityPost {
  name: string;
  avatar: string;
  avatarColor: string;
  time: string;
  text: string;
  signal?: 'long' | 'short';
}

export const COMMUNITY: CommunityPost[] = [
  { name: 'doge_king_420', avatar: 'DK', avatarColor: '#ff8c3b', time: '2m ago', text: 'BTC looking weak at this level. Funding too hot. Taking shorts here with tight SL above 99k.', signal: 'short' },
  { name: 'whale_watcher', avatar: 'WW', avatarColor: '#00e68a', time: '5m ago', text: 'Massive Binance deposit just flagged. This is the 3rd whale in 2 hours. Something is brewing.', signal: 'short' },
  { name: 'moon_trader', avatar: 'MT', avatarColor: '#3b9eff', time: '8m ago', text: 'Don\'t fight the trend. BTC is still above key MAs. This pullback is a buying opportunity.', signal: 'long' },
  { name: 'crypto_sensei', avatar: 'CS', avatarColor: '#8b5cf6', time: '15m ago', text: 'F&G at 28 means fear. Historically this is where smart money accumulates. Patient longs.', signal: 'long' },
  { name: 'defi_degen', avatar: 'DD', avatarColor: '#ffd060', time: '22m ago', text: 'OI data screaming overleveraged longs. Liquidation cascade incoming. Protect your positions.' }
];

export interface Prediction {
  question: string;
  yesPercent: number;
  pool: string;
  closes: string;
}

export const PREDICTIONS: Prediction[] = [
  { question: 'Will BTC close above $100K this week?', yesPercent: 42, pool: '12,450 CLAW', closes: '3d 14h' },
  { question: 'Will ETH/BTC ratio recover above 0.04?', yesPercent: 31, pool: '8,200 CLAW', closes: '5d 8h' },
  { question: 'Will funding rate normalize below 0.01% within 24h?', yesPercent: 67, pool: '5,800 CLAW', closes: '1d 2h' },
  { question: 'Will SOL break new ATH this month?', yesPercent: 55, pool: '15,300 CLAW', closes: '9d 18h' },
  { question: 'Will there be a >5% BTC correction within 48h?', yesPercent: 58, pool: '9,100 CLAW', closes: '2d 0h' }
];
