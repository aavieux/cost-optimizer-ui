export type ClusterBreakdown = {
  active: number
  inactive: number
  pending: number
}

export type WorkloadBreakdown = {
  wasteful: number
  optimal: number
  under_provisioned: number
  insufficient_data: number
  loading: number
}

export type DashboardCustomer = {
  customer_id: number
  customer_name: string
  window: string
  cluster_count: number
  cluster_breakdown: ClusterBreakdown
  total_workload_count: number
  monthly_cost_current: number
  monthly_cost_recommended: number
  monthly_savings: number
  generated_at: string
}

export type DashboardResponse = {
  window: string
  customer_count: number
  total_monthly_cost_current: number
  total_monthly_cost_recommended: number
  total_monthly_savings: number
  customers: DashboardCustomer[]
  generated_at: string
}

export type TimeWindow = '1d' | '7d' | '30d'
