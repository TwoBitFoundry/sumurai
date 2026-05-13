import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { AccountFilterProvider } from '@/hooks/useAccountFilter';

export function AccountFilterStoryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AccountFilterProvider>{children}</AccountFilterProvider>
    </QueryClientProvider>
  );
}
