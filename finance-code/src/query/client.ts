import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: false,
      retry: 0,
    },
  },
})
