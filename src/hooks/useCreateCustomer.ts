import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Customer, CustomersResponse } from '@/types/customer'

export function useCreateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) =>
      api.post<Customer>('/customers', { name }).then((r) => r.data),
    onSuccess: (newCustomer) => {
      qc.setQueryData<CustomersResponse>(['customers'], (old) =>
        old ? { customers: [...old.customers, newCustomer] } : old
      )
    },
  })
}
