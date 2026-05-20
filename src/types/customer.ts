export type Customer = {
  id: number
  name: string
  cluster_count: number
  created_at: string
}

export type CustomersResponse = {
  customers: Customer[]
}

export type WorkloadBreakdown = {
  wasteful: number
  optimal: number
  under_provisioned: number
  mixed: number
  unbounded: number
  insufficient_data: number
  loading: number
}

export type ClusterSummary = {
  cluster_id: number
  name: string
  provider: string
  status: 'active' | 'inactive' | 'pending'
  workload_count: number
  workload_breakdown: WorkloadBreakdown
  monthly_cost_current: number
  monthly_cost_recommended: number
  monthly_savings: number
}

export type CustomerSummary = {
  customer_id: number
  customer_name: string
  window: string
  cluster_count: number
  cluster_breakdown: {
    active: number
    inactive: number
    pending: number
  }
  total_workload_count: number
  monthly_cost_current: number
  monthly_cost_recommended: number
  monthly_savings: number
  clusters: ClusterSummary[]
  generated_at: string
}
