// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — 7 Agent Definitions
// ═══════════════════════════════════════════════════════════════

export interface AgentDef {
  id: string;
  name: string;
  nameKR: string;
  icon: string;
  color: string;
  role: string;
  source: string;
  dir: 'LONG' | 'SHORT' | 'NEUTRAL';
  conf: number;
  abilities: { analysis: number; accuracy: number; speed: number; instinct: number };
  specialty: string[];
  finding: { title: string; detail: string };
  speech: { scout: string; vote: string; win: string; lose: string };
  // doge image URLs (can be replaced with actual images)
  img: { def: string; alt: string; win: string };
  // character image set: [idle, action, victory] — themed SVG doge variants
  characterSet: [string, string, string];
  // additional character image options for variety
  characters: string[];
}

// ═══ Character art sheets for decorative use ═══
export const CHARACTER_ART = {
  // RPG agent character sheets (composite illustrations)
  rpgLabeled: '/characters/rpg-agents-labeled.jpg',
  rpgAction: '/characters/rpg-agents-action.jpg',
  rpgFantasy: '/characters/rpg-agents-fantasy.jpg',
  rpgCover: '/characters/rpg-agents-cover.jpg',
  // Circular badge art
  badgesDetailed: '/characters/badges-detailed.jpg',
  badgesTiers: '/characters/badges-tiers.jpg',
  // Gaming action poses
  gamingActions: '/characters/gaming-actions.jpg',
  gamingIcons: '/characters/gaming-icons.jpg',
  // Trading states (long/short/confused/sleep/whale)
  tradingStates: '/characters/trading-states.jpg',
  tradingScenes: '/characters/trading-scenes.jpg',
  // Expressions & emotions
  expressionsCloseup: '/characters/expressions-closeup.jpg',
  expressionsAlt: '/characters/expressions-alt.jpg',
  // Cartoon & animated
  cartoonBattle: '/characters/cartoon-battle.jpg',
  cartoonExpressive: '/characters/cartoon-expressive.jpg',
  animatedSet: '/characters/animated-set.jpg',
  // Stickers & misc
  stickerPack: '/characters/sticker-pack.jpg',
  stylizedMemes: '/characters/stylized-memes.jpg',
  minimalIcons: '/characters/minimal-icons.jpg',
  minimalistIcons: '/characters/minimalist-icons.jpg',
  // ═══ New doge art (v2 zip) ═══
  tradeBull: '/doge/trade-bull.png',
  tradeBear: '/doge/trade-bear.png',
  tradePump: '/doge/trade-pump.png',
  tradeSurge: '/doge/trade-surge.png',
  tradeActions: '/doge/trade-actions.png',
  tradeSheet: '/doge/trade-sheet.png',
  tradeWhale: '/doge/trade-whale.png',
  tradeShield: '/doge/trade-shield.png',
  spriteActions: '/doge/sprite-actions.png',
  spriteEmojis: '/doge/sprite-emojis.png',
  actionVictory: '/doge/action-victory.png',
  actionCharge: '/doge/action-charge.png',
  actionPortal: '/doge/action-portal.png',
  actionCelebrate: '/doge/action-celebrate.png',
  badgeVerified: '/doge/badge-verified.png',
  badgeShield: '/doge/badge-shield.png',
  badgeRocket: '/doge/badge-rocket.png',
  badgeDiamond: '/doge/badge-diamond.png',
  memeBuff: '/doge/meme-buff.png',
  memeBodybuilder: '/doge/meme-bodybuilder.png',
  memeMoney: '/doge/meme-money.png',
  memeGreedy: '/doge/meme-greedy.png',
} as const;

export const AGDEFS: AgentDef[] = [
  {
    id: 'structure', name: 'STRUCTURE', nameKR: '차트분석',
    icon: '⚡', color: '#3b9eff', role: 'Chart Analysis',
    source: 'binance', dir: 'LONG', conf: 82,
    abilities: { analysis: 82, accuracy: 71, speed: 65, instinct: 55 },
    specialty: ['OHLCV candle structure', 'ICT OB/FVG detection', 'BOS/CHoCH pivot points'],
    finding: { title: '4H CHoCH Uptrend', detail: 'OB $95,400 reaction with BOS confirmation' },
    speech: { scout: 'such chart. wow candle', vote: 'very LONG. much structure', win: 'WOW TP HIT!!', lose: 'such sad. no structure' },
    img: { def: '/doge/trade-bull.png', alt: '/doge/sticker-think.png', win: '/doge/action-victory.png' },
    characterSet: ['/doge/trade-bull.png', '/doge/sticker-think.png', '/doge/action-victory.png'],
    characters: ['/doge/trade-bull.png', '/doge/sticker-think.png', '/doge/action-victory.png', '/doge/doge-detective.svg', '/doge/doge-ninja.svg']
  },
  {
    id: 'flow', name: 'FLOW', nameKR: '자금추적',
    icon: '💰', color: '#00e68a', role: 'Capital Flow Tracking',
    source: 'onchain', dir: 'LONG', conf: 71,
    abilities: { analysis: 70, accuracy: 78, speed: 60, instinct: 68 },
    specialty: ['Exchange net flows', 'Whale wallet monitoring', 'Smart money tracking'],
    finding: { title: '$128M Net Outflow Accumulation', detail: 'Cold wallet transfers with smart money' },
    speech: { scout: 'much money flow. wow whale', vote: 'LONG! such confident', win: 'many profit!! wow', lose: 'where money go...' },
    img: { def: '/doge/trade-whale.png', alt: '/doge/meme-cash.png', win: '/doge/action-celebrate.png' },
    characterSet: ['/doge/trade-whale.png', '/doge/meme-cash.png', '/doge/action-celebrate.png'],
    characters: ['/doge/trade-whale.png', '/doge/meme-cash.png', '/doge/action-celebrate.png', '/doge/doge-pirate.svg', '/doge/doge-astronaut.svg']
  },
  {
    id: 'deriv', name: 'DERIV', nameKR: '파생상품',
    icon: '📊', color: '#ff8c3b', role: 'Derivatives Analysis',
    source: 'coinglass', dir: 'LONG', conf: 75,
    abilities: { analysis: 76, accuracy: 74, speed: 70, instinct: 62 },
    specialty: ['FR/OI real-time analysis', 'Liquidation heatmap detection', 'Options max pain'],
    finding: { title: 'OI +4.2% Buy Bias', detail: 'FR normal with liquidation wall at $96k' },
    speech: { scout: 'wow. much open interest', vote: 'LONG. derivatives say so', win: 'derivatives always right!!', lose: 'even derivatives wrong sometimes...' },
    img: { def: '/doge/trade-surge.png', alt: '/doge/meme-shocked.png', win: '/doge/trade-pump.png' },
    characterSet: ['/doge/trade-surge.png', '/doge/meme-shocked.png', '/doge/trade-pump.png'],
    characters: ['/doge/trade-surge.png', '/doge/meme-shocked.png', '/doge/trade-pump.png', '/doge/doge-wizard.svg', '/doge/doge-hacker.svg']
  },
  {
    id: 'senti', name: 'SENTI', nameKR: '여론분석',
    icon: '💜', color: '#8b5cf6', role: 'Sentiment Analysis',
    source: 'social', dir: 'LONG', conf: 68,
    abilities: { analysis: 65, accuracy: 62, speed: 80, instinct: 75 },
    specialty: ['KOL sentiment tracking', 'Social mention analysis', 'Fear & Greed interpretation'],
    finding: { title: 'KOL 72% Bullish Bias', detail: 'F&G 74 Greed with social volume up' },
    speech: { scout: 'much sentiment. very social', vote: 'LONG wow. such bullish', win: 'very profit!!', lose: 'such bearish. wow pain' },
    img: { def: '/doge/action-portal.png', alt: '/doge/meme-annoyed.png', win: '/doge/action-charge.png' },
    characterSet: ['/doge/action-portal.png', '/doge/meme-annoyed.png', '/doge/action-charge.png'],
    characters: ['/doge/action-portal.png', '/doge/meme-annoyed.png', '/doge/action-charge.png', '/doge/doge-chef.svg', '/doge/doge-samurai.svg']
  },
  {
    id: 'guardian', name: 'GUARDIAN', nameKR: '위험관리',
    icon: '🛡', color: '#ff3d5c', role: 'Risk Management',
    source: 'feargreed', dir: 'LONG', conf: 70,
    abilities: { analysis: 60, accuracy: 85, speed: 55, instinct: 90 },
    specialty: ['Agent report validation', 'Risk override authority', 'Position sizing adjustment'],
    finding: { title: 'Risk Acceptable · Entry Approved', detail: 'Risk Score 42 with no overrides' },
    speech: { scout: 'checking all reports...', vote: 'APPROVED. risk acceptable', win: 'risk managed perfectly', lose: 'should have overridden...' },
    img: { def: '/doge/trade-shield.png', alt: '/doge/trade-bear.png', win: '/doge/meme-thumbsup.png' },
    characterSet: ['/doge/trade-shield.png', '/doge/trade-bear.png', '/doge/meme-thumbsup.png'],
    characters: ['/doge/trade-shield.png', '/doge/trade-bear.png', '/doge/meme-thumbsup.png', '/doge/doge-knight.svg', '/doge/doge-king.svg']
  },
  {
    id: 'commander', name: 'COMMANDER', nameKR: '종합지휘',
    icon: '👑', color: '#ffd060', role: 'Command/Consensus',
    source: 'cmegap', dir: 'LONG', conf: 78,
    abilities: { analysis: 88, accuracy: 80, speed: 50, instinct: 85 },
    specialty: ['5-agent report synthesis', 'Final direction determination', 'Confidence weighting'],
    finding: { title: 'Final Judgment: LONG Confirmed', detail: '5/5 agent consensus with high confidence' },
    speech: { scout: 'reviewing all intel...', vote: 'FINAL DECISION: LONG', win: 'COMMANDER VICTORY!!', lose: 'we regroup and try again...' },
    img: { def: '/doge/meme-buff.png', alt: '/doge/meme-skeptic.png', win: '/doge/action-victory.png' },
    characterSet: ['/doge/meme-buff.png', '/doge/meme-skeptic.png', '/doge/action-victory.png'],
    characters: ['/doge/meme-buff.png', '/doge/meme-skeptic.png', '/doge/action-victory.png', '/doge/doge-king.svg', '/doge/doge-samurai.svg']
  },
  {
    id: 'scanner', name: 'SCANNER', nameKR: '시장감색',
    icon: '🔍', color: '#00d4ff', role: 'Market Scanning',
    source: 'binance2', dir: 'LONG', conf: 72,
    abilities: { analysis: 72, accuracy: 68, speed: 90, instinct: 70 },
    specialty: ['Full market real-time scanning', 'Altcoin correlation', 'Sector rotation detection'],
    finding: { title: 'BTC Dominance Declining', detail: 'Altseason signals with sector strength' },
    speech: { scout: 'scanning all markets...', vote: 'LONG. market confirms', win: 'scanner called it!!', lose: 'markets are unpredictable...' },
    img: { def: '/doge/meme-classic.png', alt: '/doge/sticker-default.png', win: '/doge/sticker-grin.png' },
    characterSet: ['/doge/meme-classic.png', '/doge/sticker-default.png', '/doge/sticker-grin.png'],
    characters: ['/doge/meme-classic.png', '/doge/sticker-default.png', '/doge/sticker-grin.png', '/doge/doge-astronaut.svg', '/doge/doge-detective.svg']
  }
];

export const SOURCES = [
  { id: 'binance', icon: '📊', label: 'BINANCE', color: '#f0b90b', x: 0.08, y: 0.18, data: ['4H OHLCV', '거래량 $2.8B', '체결강도 62%'], tags: ['RSI 58', 'MACD↑', 'EMA200 ✓'] },
  { id: 'onchain', icon: '⛓', label: 'ON-CHAIN', color: '#00e68a', x: 0.92, y: 0.18, data: ['Net Flow -$128M', 'Whale 3건', 'Smart Money'], tags: ['Outflow↑', 'Whale Buy'] },
  { id: 'coinglass', icon: '🔮', label: 'COINGLASS', color: '#ff8c3b', x: 0.50, y: 0.08, data: ['OI +4.2%', 'FR 0.082%', 'Liq $96k'], tags: ['OI Buy', 'FR High'] },
  { id: 'social', icon: '💬', label: 'SOCIAL/X', color: '#8b5cf6', x: 0.08, y: 0.78, data: ['KOL 72% Bull', 'Volume ↑42%', 'F&G 74'], tags: ['Bullish', 'Greed'] },
  { id: 'feargreed', icon: '😱', label: 'F&G INDEX', color: '#ff3d5c', x: 0.92, y: 0.78, data: ['Index: 74', 'Greed Zone', 'Prev: 68'], tags: ['Greed', 'Rising'] },
  { id: 'cmegap', icon: '🏛', label: 'CME GAP', color: '#ffd060', x: 0.50, y: 0.88, data: ['Gap $95.2k-$96.1k', 'Unfilled', 'Magnet Zone'], tags: ['Gap Down', 'Magnet'] }
];
