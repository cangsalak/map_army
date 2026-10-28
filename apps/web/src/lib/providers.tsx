'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth-context';
import { ThemeProvider } from './theme-context';
import { SharedMapProvider } from './map-context';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 30, // 30 seconds
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <SharedMapProvider>{children}</SharedMapProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
