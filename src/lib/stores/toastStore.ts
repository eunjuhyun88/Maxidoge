import { writable } from 'svelte/store';

export type ToastLevel = 'low' | 'medium' | 'high' | 'critical';

export interface Toast {
  id: string;
  level: ToastLevel;
  title: string;
  score: number;
  time: Date;
}

function createToastStore() {
  const { subscribe, update, set } = writable<Toast[]>([]);

  return {
    subscribe,
    addToast(toast: Omit<Toast, 'id' | 'time'>) {
      if (toast.level === 'low') return null;

      const next: Toast = {
        ...toast,
        id: crypto.randomUUID ? crypto.randomUUID() : `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        time: new Date(),
      };

      update((list) => [...list, next].slice(-5));
      return next.id;
    },
    dismiss(id: string) {
      update((list) => list.filter((toast) => toast.id !== id));
    },
    clearAll() {
      set([]);
    },
  };
}

export const toasts = createToastStore();
