// ═══ Arena Game Juice & Live Events ═══
// DOM-based visual effects extracted from arena/+page.svelte

/** Screen shake effect on the battle layout container */
export function juice_shake(intensity: 'light' | 'medium' | 'heavy' = 'medium') {
  const el = document.querySelector('.battle-layout');
  if (!el) return;
  el.classList.remove('jc-shake-light', 'jc-shake-medium', 'jc-shake-heavy');
  void (el as HTMLElement).offsetHeight;
  el.classList.add(`jc-shake-${intensity}`);
  setTimeout(() => el.classList.remove(`jc-shake-${intensity}`), 400);
}

/** Full-screen color flash overlay */
export function juice_flash(color: 'white' | 'green' | 'red' | 'gold' = 'white') {
  const d = document.createElement('div');
  d.className = `jc-flash jc-flash-${color}`;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 400);
}

/** Floating number animation at a position */
export function juice_flyNumber(text: string, x: number, y: number, color: string) {
  const s = document.createElement('span');
  s.className = 'jc-fly-number';
  s.textContent = text;
  s.style.cssText = `left:${x}px;top:${y}px;color:${color}`;
  document.body.appendChild(s);
  setTimeout(() => s.remove(), 1300);
}

/** Confetti particle burst */
export function juice_confetti(count = 30) {
  const cols = ['#FF5E7A', '#00CC88', '#66CCE6', '#DCB970', '#E8967D', '#8b5cf6', '#ffcc00'];
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const d = document.createElement('div');
      d.className = 'jc-confetti';
      const sz = 4 + Math.random() * 6;
      d.style.cssText = `left:${10 + Math.random() * 80}vw;width:${sz}px;height:${sz}px;background:${cols[i % cols.length]};animation-delay:${Math.random() * 0.3}s;animation-duration:${1.5 + Math.random() * 1}s;border-radius:${Math.random() > 0.5 ? '50%' : '2px'}`;
      document.body.appendChild(d);
      setTimeout(() => d.remove(), 3000);
    }, i * 25);
  }
}

// ─── Live Event System ───

export interface ArenaLiveEvent {
  id: number;
  icon: string;
  title: string;
  detail: string;
  severity: 'LOW' | 'MID' | 'HIGH';
  tint: string;
  expiresAt: number;
}

export const LIVE_EVENT_TTL_MS = 8000;

export const LIVE_EVENT_DECK: Record<'ANALYSIS' | 'HYPOTHESIS' | 'BATTLE', Array<Omit<ArenaLiveEvent, 'id' | 'expiresAt'>>> = {
  ANALYSIS: [
    { icon: '🛰️', title: 'VOL SHIFT', detail: 'Micro volatility spike detected on last swing.', severity: 'MID', tint: '#6fd6ff' },
    { icon: '🐋', title: 'WHALE TRACE', detail: 'On-chain flow leaning to directional build-up.', severity: 'LOW', tint: '#7ef0c2' },
    { icon: '📡', title: 'SOCIAL PULSE', detail: 'Narrative momentum rising in high-beta clusters.', severity: 'LOW', tint: '#89a8ff' },
  ],
  HYPOTHESIS: [
    { icon: '⏱️', title: 'ENTRY WINDOW', detail: 'Timing edge narrows. Tighten your trigger zone.', severity: 'MID', tint: '#7ecbff' },
    { icon: '🧭', title: 'BIAS CHECK', detail: 'Model confidence diverges across macro and flow.', severity: 'HIGH', tint: '#ff8ea5' },
    { icon: '🛡️', title: 'RISK GATE', detail: 'Suggested risk budget below 2% per attempt.', severity: 'LOW', tint: '#76f2bf' },
  ],
  BATTLE: [
    { icon: '🌌', title: 'MOMENTUM BURST', detail: 'Directional acceleration in active candle range.', severity: 'HIGH', tint: '#ff9b7f' },
    { icon: '💥', title: 'LIQUIDITY SWEEP', detail: 'Fast wick event cleared a nearby stop pocket.', severity: 'MID', tint: '#ffb26f' },
    { icon: '📈', title: 'TREND HOLD', detail: 'Price structure remains aligned with current bias.', severity: 'LOW', tint: '#65f4c0' },
  ],
};

/** Pick a random live event from the deck for the given phase */
export function pickLiveEvent(phase: 'ANALYSIS' | 'HYPOTHESIS' | 'BATTLE'): ArenaLiveEvent | null {
  const bucket = LIVE_EVENT_DECK[phase];
  if (!bucket || bucket.length === 0) return null;
  const picked = bucket[Math.floor(Math.random() * bucket.length)];
  return {
    ...picked,
    id: Date.now() + Math.floor(Math.random() * 10000),
    expiresAt: Date.now() + LIVE_EVENT_TTL_MS,
  };
}

/** Get the event stream cadence (ms) for a given phase */
export function getEventCadence(phase: 'ANALYSIS' | 'HYPOTHESIS' | 'BATTLE', speed: number): number {
  const base = phase === 'BATTLE' ? 3600 : phase === 'HYPOTHESIS' ? 4400 : 5000;
  return Math.max(2200, Math.round(base / Math.max(1, speed)));
}
