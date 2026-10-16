import { create } from 'zustand';

// "View as": an Admin previews the portal exactly as another person sees it - their
// nav, pages, data and permissions. The preview itself lives in a server-side cookie
// (so every API call is answered as that person, read-only); this store just mirrors
// who is being previewed so the UI can show the banner and swap the profile/role.

export interface ViewAsTarget {
  id:          string;
  name:        string;
  email:       string;
  role:        'ADMIN' | 'EMPLOYEE';
  designation: string | null;
  department:  string | null;
  avatarUrl:   string | null;
  managerId:   string | null;
}

interface ViewAsState {
  target:    ViewAsTarget | null;
  loaded:    boolean;
  setTarget: (t: ViewAsTarget | null) => void;
  pickerOpen:    boolean;
  setPickerOpen: (open: boolean) => void;
}

export const useViewAsStore = create<ViewAsState>((set) => ({
  target: null,
  loaded: false,
  setTarget: (target) => set({ target, loaded: true }),
  pickerOpen: false,
  setPickerOpen: (pickerOpen) => set({ pickerOpen }),
}));

// Every cached query belongs to the previous identity, so switching starts from a clean page load.
export async function startViewAs(userId: string): Promise<void> {
  const res = await fetch('/api/view-as', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(json.error ?? 'Could not start the preview');
  }
  window.location.assign('/dashboard');
}

export async function exitViewAs(): Promise<void> {
  await fetch('/api/view-as', { method: 'DELETE' });
  window.location.reload();
}
