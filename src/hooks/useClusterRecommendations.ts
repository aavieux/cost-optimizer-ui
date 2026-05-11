import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { WorkloadRecommendationsResponse } from "@/types/cluster";
import type { TimeWindow } from "@/types/dashboard";

export function useClusterRecommendations(
  customerId: number,
  clusterId: number,
  timeWindow: TimeWindow,
) {
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
    retry: false,
  });
}
