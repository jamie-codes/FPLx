import { useQuery } from '@tanstack/react-query'
import type { ClubForm } from '@/lib/types'

async function fetchClubForm(): Promise<ClubForm[]> {
  const res = await fetch('/api/club-form')
  if (!res.ok) throw new Error(`Failed to fetch club form: ${res.status}`)
  return res.json()
}

export function useClubForm() {
  return useQuery<ClubForm[]>({
    queryKey: ['club-form'],
    queryFn: fetchClubForm,
    staleTime: 1000 * 60 * 60 * 6,
  })
}
