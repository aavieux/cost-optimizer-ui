import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { CustomerSummary } from '@/types/customer'
import type { TimeWindow } from '@/types/dashboard'

export function useCustomerSummary(customerId: number, timeWindow: TimeWindow) {
  return useQuery({
    queryKey: ['customer', customerId, timeWindow],
    queryFn: () =>
      api.get<CustomerSummary>(`/customers/${customerId}/summary?window=${timeWindow}`).then((r) => r.data),
    refetchInterval: 30_000,
    retry: false,
    enabled: customerId > 0,
  })
}
