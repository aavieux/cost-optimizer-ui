import { useState } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useCustomerSummary } from '@/hooks/useCustomerSummary'
import { formatCurrency, formatSavingsPercent } from '@/lib/format'
import AnimatedCurrency from '@/components/AnimatedCurrency'
import { getErrorCode } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { TimeWindow } from '@/types/dashboard'
import type { ClusterSummary } from '@/types/customer'

const TIME_WINDOWS: { label: string; value: TimeWindow }[] = [
  { label: '1d', value: '1d' },
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
  { label: '90d', value: '90d' },
]

function ClusterRow({ cluster, customerId }: { cluster: ClusterSummary; customerId: number }) {
  const wb = cluster.workload_breakdown
  return (
    <Link
      to={`/customers/${customerId}/clusters/${cluster.cluster_id}`}
      className="flex items-center justify-between px-6 py-4 hover:bg-neutral-50 transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-neutral-900">{cluster.name}</span>
          <span className="text-xs text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded">
            {cluster.provider}
          </span>
          <span className={cn(
            'inline-flex items-center gap-1 text-xs',
            cluster.status === 'active' ? 'text-emerald-600' :
            cluster.status === 'pending' ? 'text-amber-600' : 'text-neutral-400'
          )}>
            <span className={cn(
              'w-1.5 h-1.5 rounded-full inline-block',
              cluster.status === 'active' ? 'bg-emerald-400' :
              cluster.status === 'pending' ? 'bg-amber-300' : 'bg-neutral-300'
            )} />
            {cluster.status}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-neutral-400">
            {cluster.workload_count} workloads
          </span>
          {wb.wasteful > 0 && (
            <span className="text-xs text-neutral-400">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-400 mr-1" />
              {wb.wasteful} wasteful
            </span>
          )}
          {wb.under_provisioned > 0 && (
            <span className="text-xs text-neutral-400">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-300 mr-1" />
              {wb.under_provisioned} under-provisioned
            </span>
          )}
          {wb.optimal > 0 && (
            <span className="text-xs text-neutral-400">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1" />
              {wb.optimal} optimal
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-8 text-right shrink-0 ml-6">
        <div>
          <p className="text-xs text-neutral-400 mb-0.5">Current</p>
          <p className="text-sm font-medium text-neutral-900">
            {formatCurrency(cluster.monthly_cost_current)}
            <span className="text-xs font-normal text-neutral-400">/mo</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-neutral-400 mb-0.5">Savings</p>
          <p className="text-sm font-semibold text-emerald-600">
            {formatCurrency(cluster.monthly_savings)}
            <span className="text-xs font-normal text-neutral-400">/mo</span>
          </p>
        </div>
        <ArrowRight size={14} className="text-neutral-300 group-hover:text-neutral-600 transition-colors" />
      </div>
    </Link>
  )
}

export default function CustomerPage() {
  const { id } = useParams<{ id: string }>()
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('7d')
  const customerId = Number(id)
  const { data, isLoading, error } = useCustomerSummary(customerId, timeWindow)

  if (!id || isNaN(customerId) || customerId <= 0) return <Navigate to="/customers" replace />

  return (
    <div className="px-8 py-8 max-w-5xl mx-auto">
      <Link
        to="/customers"
        className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-700 transition-colors mb-6"
      >
        <ArrowLeft size={12} />
        Customers
      </Link>

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-semibold text-neutral-900">
          {data?.customer_name ?? (isLoading ? '—' : 'Customer')}
        </h1>
        <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-1">
          {TIME_WINDOWS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setTimeWindow(value)}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                timeWindow === value
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-700'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-8 px-4 py-3 rounded-lg bg-red-50 border border-red-100">
          <p className="text-sm text-red-500">
            {getErrorCode(error) === 'DB_UNAVAILABLE'
              ? 'Service is temporarily unavailable. Please try again later.'
              : getErrorCode(error) === 'ACCESS_DENIED'
              ? 'You do not have access to this customer.'
              : getErrorCode(error) === 'CUSTOMER_NOT_FOUND'
              ? 'Customer not found.'
              : 'Failed to load customer data.'}
          </p>
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white border border-neutral-100 rounded-xl p-6 animate-pulse">
              <div className="h-3 w-24 bg-neutral-100 rounded mb-3" />
              <div className="h-7 w-32 bg-neutral-100 rounded" />
            </div>
          ))}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white border border-neutral-100 rounded-xl p-6">
              <p className="text-xs text-neutral-400 uppercase tracking-wide mb-2">Monthly Spend</p>
              <p className="text-2xl font-semibold text-neutral-900">
                <AnimatedCurrency value={data.monthly_cost_current} />
                <span className="text-sm font-normal text-neutral-400 ml-1">/mo</span>
              </p>
            </div>
            <div className="bg-white border border-neutral-100 rounded-xl p-6">
              <p className="text-xs text-neutral-400 uppercase tracking-wide mb-2">Recommended</p>
              <p className="text-2xl font-semibold text-neutral-900">
                <AnimatedCurrency value={data.monthly_cost_recommended} />
                <span className="text-sm font-normal text-neutral-400 ml-1">/mo</span>
              </p>
            </div>
            <div className="bg-white border border-neutral-100 rounded-xl p-6">
              <p className="text-xs text-neutral-400 uppercase tracking-wide mb-2">Monthly Savings</p>
              <p className="text-2xl font-semibold text-emerald-600">
                <AnimatedCurrency value={data.monthly_savings} />
                <span className="text-sm font-normal text-neutral-400 ml-1">/mo</span>
              </p>
              <p className="text-xs text-neutral-400 mt-1">
                {formatSavingsPercent(data.monthly_cost_current, data.monthly_savings)} reduction
              </p>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-4 mb-4">
              <h2 className="text-xs font-medium text-neutral-400 uppercase tracking-wide">
                Clusters · {data.cluster_count}
              </h2>
              <div className="flex items-center gap-3">
                {data.cluster_breakdown.active > 0 && (
                  <span className="flex items-center gap-1 text-xs text-neutral-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                    {data.cluster_breakdown.active} active
                  </span>
                )}
                {data.cluster_breakdown.inactive > 0 && (
                  <span className="flex items-center gap-1 text-xs text-neutral-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-neutral-300 inline-block" />
                    {data.cluster_breakdown.inactive} inactive
                  </span>
                )}
                {data.cluster_breakdown.pending > 0 && (
                  <span className="flex items-center gap-1 text-xs text-neutral-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-300 inline-block" />
                    {data.cluster_breakdown.pending} pending
                  </span>
                )}
              </div>
            </div>

            {data.clusters.length === 0 ? (
              <p className="text-sm text-neutral-400">No clusters registered.</p>
            ) : (
              <div className="bg-white border border-neutral-100 rounded-xl divide-y divide-neutral-100">
                {data.clusters.map((cluster) => (
                  <ClusterRow key={cluster.cluster_id} cluster={cluster} customerId={data.customer_id} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
