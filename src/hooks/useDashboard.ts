import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { DashboardResponse, TimeWindow } from '@/types/dashboard'

export function useDashboard(timeWindow: TimeWindow) {
  return useQuery({
    queryKey: ['dashboard', timeWindow],
    queryFn: () =>
      api.get<DashboardResponse>(`/dashboard?window=${timeWindow}`).then((r) => r.data),
    retry: false,
  })
}
