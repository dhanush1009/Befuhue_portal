'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime:            1000 * 60 * 5, // 5 minutes cache
            gcTime:               1000 * 60 * 15, // 15 minutes garbage collection
            retry:                1,
            refetchOnWindowFocus: false,
            refetchOnReconnect:   false,
            refetchOnMount:       false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
