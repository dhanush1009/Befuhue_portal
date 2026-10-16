import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import type { MyProfile } from '@/types/profile';

export function useMyProfile() {
  const queryClient = useQueryClient();
  const { update: updateSession } = useSession();

  const profile = useQuery({
    queryKey: ['myProfile'],
    queryFn:  async (): Promise<MyProfile> => {
      const res = await fetch('/api/employees/me');
      if (!res.ok) throw new Error('Failed to fetch profile');
      const json = await res.json() as { data: MyProfile };
      return json.data;
    },
    staleTime: 1000 * 60 * 5,
  });

  const updateProfile = useMutation({
    mutationFn: async (data: {
      name?: string;
      phone?: string | null;
      fatherName?: string | null;
      motherName?: string | null;
      parentsPhone?: string | null;
      bondCertificateSubmitted?: boolean;
    }) => {
      const res = await fetch('/api/employees/me', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error ?? 'Failed to update profile');
      }
      return res.json() as Promise<{ data: Partial<MyProfile> }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myProfile'] });
      toast.success('Profile updated.');
    },
    onError: () => toast.error('Failed to update profile.'),
  });

  /** Call this after a successful avatar upload to sync all avatar surfaces instantly. */
  function updateAvatarCache(newUrl: string | null) {
    // 1. Patch the TanStack Query cache so ProfileCard re-renders immediately
    queryClient.setQueryData<MyProfile>(['myProfile'], (prev) =>
      prev ? { ...prev, avatarUrl: newUrl } : prev,
    );
    // 2. Patch the NextAuth session token so TopHeader + Sidebar re-render immediately
    void updateSession({ avatarUrl: newUrl });
  }

  return { profile, updateProfile, updateAvatarCache };
}
