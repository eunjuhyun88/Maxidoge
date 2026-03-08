import { writable } from 'svelte/store';
import { notifications } from './notificationsStore';

export interface P0State {
  active: boolean;
  reason: string;
  triggeredAt: Date | null;
}

function createP0Store() {
  const { subscribe, set } = writable<P0State>({
    active: false,
    reason: '',
    triggeredAt: null,
  });

  return {
    subscribe,
    trigger(reason: string) {
      set({ active: true, reason, triggeredAt: new Date() });
      notifications.addNotification({
        type: 'critical',
        title: 'P0 OVERRIDE TRIGGERED',
        body: reason,
        dismissable: false,
      });
    },
    clear() {
      set({ active: false, reason: '', triggeredAt: null });
      notifications.addNotification({
        type: 'success',
        title: 'P0 OVERRIDE CLEARED',
        body: 'Guardian conditions normalized. Trading resumed.',
        dismissable: true,
      });
    },
  };
}

export const p0Override = createP0Store();
