import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { ClusterDetail } from '@/types/cluster'
import type { TimeWindow } from '@/types/dashboard'

export function useClusterSummary(customerId: number, clusterId: number, timeWindow: TimeWindow) {
  return useQuery({
    queryKey: ['cluster', customerId, clusterId, 'summary', timeWindow],
    queryFn: () =>
      api
        .get<ClusterDetail>(`/customers/${customerId}/clusters/${clusterId}/summary?window=${timeWindow}`)
        .then((r) => r.data),
    enabled: customerId > 0 && clusterId > 0,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    retry: false,
  })
}
