import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { ClusterMetricsResponse } from '@/types/cluster'

type Params = {
  customerId: number
  clusterId: number
  from: string
  to: string
  granularity: 'hour' | 'day'
}

export function useClusterMetrics({ customerId, clusterId, from, to, granularity }: Params) {
  return useQuery({
    queryKey: ['cluster', customerId, clusterId, 'metrics', from, to, granularity],
    queryFn: () =>
      api
        .get<ClusterMetricsResponse>(`/customers/${customerId}/clusters/${clusterId}/metrics`, {
          params: { from, to, granularity },
        })
        .then((r) => r.data),
    enabled: customerId > 0 && clusterId > 0,
    retry: false,
  })
}
