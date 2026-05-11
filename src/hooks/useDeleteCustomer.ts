import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export function useDeleteCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/customers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  })
}
