import { writable, derived } from 'svelte/store';
import {
  createNotificationApi,
  deleteNotificationApi,
  fetchNotificationsApi,
  markNotificationsReadApi,
} from '$lib/api/notificationsApi';
import type { NotificationRecord, NotificationType } from '$lib/contracts/notifications';

export type { NotificationType };

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  time: Date;
  read: boolean;
  dismissable: boolean;
}

function mapNotificationRecord(record: NotificationRecord): Notification {
  return {
    id: record.id,
    type: record.type,
    title: record.title,
    body: record.body,
    time: new Date(record.createdAt),
    read: Boolean(record.isRead),
    dismissable: Boolean(record.dismissable),
  };
}

function createNotificationsStore() {
  const { subscribe, update, set } = writable<Notification[]>([]);
  let hydrated = false;
  let hydratePromise: Promise<void> | null = null;

  return {
    subscribe,
    async hydrate(force = false) {
      if (typeof window === 'undefined') return;
      if (hydrated && !force) return;
      if (hydratePromise) return hydratePromise;

      hydratePromise = (async () => {
        const page = await fetchNotificationsApi({ limit: 100, offset: 0 });
        if (!page) return;
        hydrated = true;
        set(page.records.map(mapNotificationRecord));
      })();

      try {
        await hydratePromise;
      } finally {
        hydratePromise = null;
      }
    },
    addNotification(notification: Omit<Notification, 'id' | 'time' | 'read'>) {
      const tempId = crypto.randomUUID
        ? crypto.randomUUID()
        : `n-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimistic: Notification = {
        ...notification,
        id: `tmp-${tempId}`,
        time: new Date(),
        read: false,
      };

      update((list) => [optimistic, ...list].slice(0, 50));

      void (async () => {
        const saved = await createNotificationApi({
          type: notification.type,
          title: notification.title,
          body: notification.body,
          dismissable: notification.dismissable,
        });
        if (!saved) return;

        update((list) =>
          list.map((item) => (item.id === optimistic.id ? mapNotificationRecord(saved) : item)),
        );
      })();

      return optimistic.id;
    },
    markRead(id: string) {
      update((list) => list.map((item) => (item.id === id ? { ...item, read: true } : item)));
      if (!id.startsWith('tmp-')) {
        void markNotificationsReadApi([id]);
      }
    },
    markAllRead() {
      update((list) => list.map((item) => ({ ...item, read: true })));
      void markNotificationsReadApi();
    },
    clearAll() {
      let ids: string[] = [];
      update((list) => {
        ids = list.filter((item) => !item.id.startsWith('tmp-')).map((item) => item.id);
        return [];
      });
      void Promise.all(ids.map((id) => deleteNotificationApi(id)));
    },
    remove(id: string) {
      update((list) => list.filter((item) => item.id !== id));
      if (!id.startsWith('tmp-')) {
        void deleteNotificationApi(id);
      }
    },
  };
}

export const notifications = createNotificationsStore();
export const unreadCount = derived<typeof notifications, number>(
  notifications,
  ($notifications) => $notifications.filter((item) => !item.read).length,
);
