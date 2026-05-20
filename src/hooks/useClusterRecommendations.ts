import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { WorkloadRecommendationsResponse } from "@/types/cluster";
import type { TimeWindow } from "@/types/dashboard";

export function useClusterRecommendations(
  customerId: number,
  clusterId: number,
  timeWindow: TimeWindow,
) {
  // TODO: replace polling with SSE for better scalability.
  // Current approach: every open tab polls independently — N users × M clusters = N×M requests/30s.
  // Better approach: one persistent EventSource per cluster page; the Go backend pushes a
  // WorkloadRecommendationsResponse whenever last_seen_at changes or a workload is added/removed.
  // Migration is a one-file change: open an EventSource here and call
  // queryClient.setQueryData(queryKey, event.data) on each message — ClusterPage needs no changes.
  return useQuery({
    queryKey: ["cluster", customerId, clusterId, "recommendations", timeWindow],
    queryFn: () =>
      api
        .get<WorkloadRecommendationsResponse>(
          `/customers/${customerId}/clusters/${clusterId}/workloads/recommendations?window=${timeWindow}`,
        )
        .then((r) => r.data),
    enabled: customerId > 0 && clusterId > 0 && !!timeWindow,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
