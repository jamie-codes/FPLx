import { useQuery, useQueryClient } from '@tanstack/react-query'

interface AuthStatus {
  authenticated: boolean
  expiresAt?: number
}

async function fetchAuthStatus(): Promise<AuthStatus> {
  const res = await fetch('/api/auth/status')
  if (!res.ok) return { authenticated: false }
  return res.json()
}

export function useAuthStatus() {
  const queryClient = useQueryClient()

  const query = useQuery<AuthStatus>({
    queryKey: ['auth-status'],
    queryFn: fetchAuthStatus,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 0,
  })

  /** Refetch from server after login so expiresAt is populated */
  function setAuthenticated() {
    queryClient.invalidateQueries({ queryKey: ['auth-status'] })
  }

  /** Call after logout or 401 from my-team to clear auth state */
  function clearAuthenticated() {
    queryClient.setQueryData(['auth-status'], { authenticated: false })
  }

  return {
    isAuthenticated: query.data?.authenticated ?? false,
    expiresAt: query.data?.expiresAt,
    isLoading: query.isLoading,
    setAuthenticated,
    clearAuthenticated,
  }
}
