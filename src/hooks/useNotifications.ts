import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNotificationStore } from '@/store/useNotificationStore';
import type { Notification } from '@/store/useNotificationStore';

interface NotificationsResponse {
  data:  Notification[];
  total: number;
  page:  number;
  limit: number;
}

export function useNotifications(page = 1) {
  const { setNotifications } = useNotificationStore();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['notifications', page],
    queryFn: async (): Promise<NotificationsResponse> => {
      const res = await fetch(`/api/notifications?page=${page}`);
      if (!res.ok) throw new Error('Failed to fetch notifications');
      const json = await res.json() as NotificationsResponse;
      // Sync first page into Zustand store so the bell badge stays accurate
      if (page === 1) setNotifications(json.data);
      return json;
    },
    staleTime:     1000 * 30,       // 30s cache
    refetchInterval: 1000 * 60,     // background poll every 60s to keep badge fresh
  });

  const readOne = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const readAll = useMutation({
    mutationFn: async () => {
      await fetch('/api/notifications/read-all', { method: 'PATCH' });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return { query, readOne, readAll };
}
