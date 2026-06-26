import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api, { getErrorCode } from '@/lib/api'
import type { TimeWindow } from '@/types/dashboard'

type Params = {
  customerId: number
  clusterId: number
  workloadId: number
  window: TimeWindow
}

export function useApplyRecommendation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ customerId, clusterId, workloadId, window }: Params) =>
      api.put(
        `/customers/${customerId}/clusters/${clusterId}/workloads/${workloadId}/recommendations/apply?window=${window}`,
      ),
    onSuccess: (_, { customerId, clusterId, workloadId }) => {
      qc.invalidateQueries({ queryKey: ['workload', customerId, clusterId, workloadId] })
      qc.invalidateQueries({ queryKey: ['cluster', customerId, clusterId, 'recommendations'] })
      toast.success('Recommendation applied')
    },
    onError: (err) => {
      const code = getErrorCode(err)
      const status = (err as { response?: { status?: number } })?.response?.status
      toast.error(
        status === 500
          ? 'Could not apply — cluster is unreachable or credentials are invalid.'
          : code === 'ACCESS_DENIED'
          ? 'You do not have permission to apply recommendations.'
          : code === 'WORKLOAD_NOT_FOUND'
          ? 'Workload not found.'
          : 'Failed to apply recommendation.',
      )
    },
  })
}
