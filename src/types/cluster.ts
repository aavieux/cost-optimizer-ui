import type { WorkloadBreakdown } from './dashboard'

export type ClusterDetail = {
  cluster_id: number
  name: string
  provider: string
  status: 'active' | 'inactive' | 'pending'
  last_seen_at: string
  window: string
  workload_count: number
  workload_breakdown: WorkloadBreakdown
  monthly_cost_current: number
  monthly_cost_recommended: number
  monthly_savings: number
  generated_at: string
}

export type MetricPoint = {
  ts: string
  cpu_cores: number | null
  ram_bytes: number | null
  pod_count: number | null
}

export type ClusterMetricsResponse = {
  cluster_id: number
  granularity: 'hour' | 'day'
  from: string
  to: string
  points: MetricPoint[]
}

export type WorkloadRecommendation = {
  workload_id: number
  name: string
  namespace: string
  kind: string
  last_seen_at: string | null
  p95_cpu_cores: number
  p99_cpu_cores: number
  p95_ram_bytes: number
  p99_ram_bytes: number
  cpu_recommended: string
  ram_recommended: string
  cpu_request_current: string
  ram_request_current: string
  monthly_cost_current: number
  monthly_cost_recommended: number
  monthly_savings: number
  status: 'WASTEFUL' | 'OPTIMAL' | 'UNDER_PROVISIONED' | 'MIXED' | 'INSUFFICIENT_DATA' | 'UNBOUNDED'
  cpu_status: 'WASTEFUL' | 'UNDER_PROVISIONED' | 'OPTIMAL' | 'UNBOUNDED'
  ram_status: 'WASTEFUL' | 'UNDER_PROVISIONED' | 'OPTIMAL' | 'UNBOUNDED'
  stability: 'STABLE' | 'VARIABLE'
  sample_count: number
}

export type PendingWorkload = {
  workload_id: number
  name: string
  namespace: string
  kind: string
  last_seen_at: string | null
  sample_count: number
  samples_required: number
  samples_remaining: number
  data_span_hours: number
  span_required_hours: number
}

export type WorkloadRecommendationsResponse = {
  cluster_id: number
  window: string
  total_monthly_savings: number
  generated_at: string
  workloads: WorkloadRecommendation[]
  pending_workloads: PendingWorkload[]
}
