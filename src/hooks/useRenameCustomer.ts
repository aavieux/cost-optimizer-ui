import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Customer } from '@/types/customer'

export function useRenameCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      api.put<Customer>(`/customers/${id}`, { name }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  })
}
