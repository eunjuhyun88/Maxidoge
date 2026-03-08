import { STORAGE_KEYS } from './storageKeys';
import { notifications } from './notificationsStore';
import { toasts } from './toastStore';

export function notifyTradePnL(pair: string, dir: string, pnl: number) {
  if (Math.abs(pnl) < 5) return;
  const up = pnl > 0;
  notifications.addNotification({
    type: up ? 'success' : 'alert',
    title: `${dir} ${pair}: ${up ? '+' : ''}${pnl.toFixed(1)}%`,
    body: up
      ? `Your ${dir} position is up ${pnl.toFixed(1)}%. Consider taking profit.`
      : `Your ${dir} position is down ${Math.abs(pnl).toFixed(1)}%. Check your stop loss.`,
    dismissable: true,
  });
}

export function notifySignalExpiring(pair: string, source: string, hoursLeft: number) {
  if (hoursLeft > 1) return;
  notifications.addNotification({
    type: 'alert',
    title: `Signal expiring: ${pair}`,
    body: `Tracked signal from ${source} expires in ${Math.floor(hoursLeft * 60)}min. Convert to trade or let it expire.`,
    dismissable: true,
  });
}

export function notifyMatchComplete(matchN: number, win: boolean, lp: number) {
  notifications.addNotification({
    type: win ? 'success' : 'info',
    title: `Match #${matchN}: ${win ? 'WIN' : 'LOSS'}`,
    body: `${win ? 'Victory!' : 'Defeated.'} ${lp >= 0 ? '+' : ''}${lp} LP earned.`,
    dismissable: true,
  });
}

export function notifySignalTracked(pair: string, dir: string) {
  toasts.addToast({
    level: 'medium',
    title: `📌 ${dir} ${pair} tracked — check TRACKED tab`,
    score: 0,
  });
}

export function seedNotifications() {
  if (typeof window === 'undefined') return;
  const seedKey = STORAGE_KEYS.notificationsSeeded;
  if (sessionStorage.getItem(seedKey) === '1') return;
  sessionStorage.setItem(seedKey, '1');

  notifications.addNotification({
    type: 'info',
    title: 'SESSION STARTED',
    body: 'Stockclaw arena is live. Good luck, trader.',
    dismissable: true,
  });
  notifications.addNotification({
    type: 'alert',
    title: 'FUNDING RATE SPIKE',
    body: 'BTC perpetual funding rate at +0.045% — elevated long positioning detected.',
    dismissable: true,
  });
  notifications.addNotification({
    type: 'success',
    title: 'AGENT SYNC COMPLETE',
    body: 'All 5 agents calibrated and ready for deployment.',
    dismissable: true,
  });
  notifications.addNotification({
    type: 'critical',
    title: 'LIQUIDATION CASCADE',
    body: '$142M in long liquidations over the past hour. High volatility zone.',
    dismissable: true,
  });
  notifications.addNotification({
    type: 'alert',
    title: 'OI DIVERGENCE',
    body: 'Open Interest rising while price drops — potential short squeeze setup.',
    dismissable: true,
  });
}
