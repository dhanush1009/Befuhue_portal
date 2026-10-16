import { create } from 'zustand';

// Matches the shape returned by GET /api/notifications
export interface Notification {
  id:        string;
  type:      string;
  title:     string;
  body:      string;   // API field name
  linkUrl:   string | null;
  isRead:    boolean;  // API field name
  createdAt: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount:   number;
  setNotifications: (notifications: Notification[]) => void;
  prependNotification: (n: Notification) => void;
  markAsRead:  (id: string) => void;
  markAllRead: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount:   0,

  setNotifications: (notifications) =>
    set({
      notifications,
      unreadCount: notifications.filter((n) => !n.isRead).length,
    }),

  prependNotification: (n) =>
    set((state) => {
      const updated = [n, ...state.notifications];
      return { notifications: updated, unreadCount: updated.filter((x) => !x.isRead).length };
    }),

  markAsRead: (id) =>
    set((state) => {
      const updated = state.notifications.map((n) => n.id === id ? { ...n, isRead: true } : n);
      return { notifications: updated, unreadCount: updated.filter((n) => !n.isRead).length };
    }),

  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    })),
}));
