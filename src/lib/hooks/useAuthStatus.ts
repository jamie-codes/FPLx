import { useQuery, useQueryClient } from '@tanstack/react-query'

interface AuthStatus {
  isAuthenticated: boolean
}

async function fetchAuthStatus(): Promise<AuthStatus> {
  const res = await fetch('/api/auth/status')
  if (!res.ok) return { isAuthenticated: false }
  return res.json()
}

export function useAuthStatus() {
  const queryClient = useQueryClient()

  const query = useQuery<AuthStatus>({
    queryKey: ['auth-status'],
    queryFn: fetchAuthStatus,
    staleTime: 1000 * 60 * 5, // 5 minutes — short enough to catch session expiry
    retry: 0,
  })

  /** Call after successful login to immediately reflect auth state */
  function setAuthenticated() {
    queryClient.setQueryData(['auth-status'], { isAuthenticated: true })
  }

  /** Call after logout or 401 from my-team to clear auth state */
  function clearAuthenticated() {
    queryClient.setQueryData(['auth-status'], { isAuthenticated: false })
  }

  return {
    isAuthenticated: query.data?.isAuthenticated ?? false,
    isLoading: query.isLoading,
    setAuthenticated,
    clearAuthenticated,
  }
}
