import { create } from 'zustand';

export type Theme = 'light' | 'dark';

interface UIState {
  sidebarOpen:       boolean;
  toggleSidebar:     () => void;
  mobileMenuOpen:    boolean;
  setMobileMenuOpen: (open: boolean) => void;
  currentPageTitle:  string;
  setPageTitle:      (title: string) => void;
  theme:             Theme;
  setTheme:          (theme: Theme) => void;
  toggleTheme:       () => void;
  // Company branding — loaded once on app boot
  companyName:       string;
  companyLogoUrl:    string | null;
  setCompanyBranding:(name: string, logoUrl: string | null) => void;
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  localStorage.setItem('di-theme', theme);
}

export const useUIStore = create<UIState>((set, get) => ({
  sidebarOpen:       true,
  toggleSidebar:     () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  mobileMenuOpen:    false,
  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),

  currentPageTitle:  'Dashboard',
  setPageTitle:      (title) => set({ currentPageTitle: title }),

  theme: 'light',

  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },

  toggleTheme: () => {
    const next: Theme = get().theme === 'light' ? 'dark' : 'light';
    applyTheme(next);
    set({ theme: next });
  },

  companyName:    'Befhue',
  companyLogoUrl: '/branding/befhue-logo.png',
  setCompanyBranding: (name, logoUrl) => set({ companyName: name, companyLogoUrl: logoUrl }),
}));

// Backward-compat alias
export const sidebarCollapsedSelector = (s: UIState) => !s.sidebarOpen;
