import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { CustomersResponse } from '@/types/customer'

export function useCustomers() {
  return useQuery({
    queryKey: ['customers'],
    queryFn: () => api.get<CustomersResponse>('/customers').then((r) => r.data),
    retry: false,
  })
}
