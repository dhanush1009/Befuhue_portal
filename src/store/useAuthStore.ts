import { create } from 'zustand';
import type { AuthUser } from '@/types/auth';

interface AuthState {
  user:    AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  isAdmin: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user:    null,
  setUser: (user) => set({ user }),
  isAdmin: () => get().user?.role === 'ADMIN',
}));
