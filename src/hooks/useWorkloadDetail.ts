import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { WorkloadDetailResponse } from "@/types/cluster";
import type { TimeWindow } from "@/types/dashboard";

type Params = {
  customerId: number;
  clusterId: number;
  workloadId: number;
  timeWindow: TimeWindow;
  from: string;
  to: string;
  granularity: "hour" | "day";
};

export function useWorkloadDetail(params: Params) {
  const { customerId, clusterId, workloadId, timeWindow, from, to, granularity } = params;
  return useQuery({
    queryKey: ["workload", customerId, clusterId, workloadId, timeWindow, from, to, granularity],
    queryFn: () =>
      api
        .get<WorkloadDetailResponse>(
          `/customers/${customerId}/clusters/${clusterId}/workloads/${workloadId}?window=${timeWindow}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&granularity=${granularity}`,
        )
        .then((r) => r.data),
    enabled: customerId > 0 && clusterId > 0 && workloadId > 0,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
