import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { CustomersResponse } from '@/types/customer'

export function useDeleteCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/customers/${id}`),
    onSuccess: (_, id) => {
      qc.setQueryData<CustomersResponse>(['customers'], (old) =>
        old ? { customers: old.customers.filter((c) => c.id !== id) } : old
      )
    },
  })
}
