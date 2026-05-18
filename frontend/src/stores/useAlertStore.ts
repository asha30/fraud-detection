import { create } from 'zustand';

type AlertState = {
  unreadCount: number;
  incrementUnread: () => void;
  setUnread: (count: number) => void;
  resetUnread: () => void;
};

export const useAlertStore = create<AlertState>((set) => ({
  unreadCount: 0,
  incrementUnread: () => set((s) => ({ unreadCount: s.unreadCount + 1 })),
  setUnread: (count) => set({ unreadCount: Math.max(0, count) }),
  resetUnread: () => set({ unreadCount: 0 }),
}));
