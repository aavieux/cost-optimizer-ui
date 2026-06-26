import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { SavingsHistoryResponse } from '@/types/cluster'

export function useSavingsHistory(customerId: number, clusterId: number, enabled: boolean) {
  return useQuery({
    queryKey: ['cluster', customerId, clusterId, 'savings-history'],
    queryFn: () =>
      api
        .get<SavingsHistoryResponse>(`/customers/${customerId}/clusters/${clusterId}/savings-history`)
        .then((r) => r.data),
    enabled: enabled && customerId > 0 && clusterId > 0,
    refetchOnWindowFocus: false,
    retry: false,
  })
}
