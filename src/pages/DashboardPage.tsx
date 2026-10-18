import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, TrendingDown, ArrowUpDown } from 'lucide-react'
import { useDashboard } from '@/hooks/useDashboard'
import { getErrorCode } from '@/lib/api'
import { formatSavingsPercent } from '@/lib/format'
import { useFormatCurrency } from '@/context/CurrencyContext'
import AnimatedCurrency from '@/components/AnimatedCurrency'
import RealizedAmount from '@/components/RealizedAmount'
import PotentialAmount from '@/components/PotentialAmount'
import { cn } from '@/lib/utils'
import type { DashboardCustomer, TimeWindow } from '@/types/dashboard'

const TIME_WINDOWS: { label: string; value: TimeWindow }[] = [
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
]

const SORT_OPTIONS = [
  { label: 'Name', value: 'name' },
  { label: 'Current cost', value: 'cost' },
  { label: 'Savings $', value: 'savings' },
  { label: 'Savings %', value: 'savings_pct' },
  { label: 'Clusters', value: 'clusters' },
] as const

type SortKey = typeof SORT_OPTIONS[number]['value']

function savingsLabel(window: TimeWindow): string {
  if (window === '7d') return 'Weekly Savings'
  return 'Potential Monthly Savings'
}

function sortCustomers(customers: DashboardCustomer[], key: SortKey): DashboardCustomer[] {
  return [...customers].sort((a, b) => {
    const byName = a.customer_name.localeCompare(b.customer_name)
    switch (key) {
      case 'name':
        return byName
      case 'cost':
        return (b.monthly_cost_current - a.monthly_cost_current) || byName
      case 'savings':
        return (b.monthly_savings - a.monthly_savings) || byName
      case 'savings_pct': {
        const pctA = a.monthly_cost_current === 0 ? 0 : a.monthly_savings / a.monthly_cost_current
        const pctB = b.monthly_cost_current === 0 ? 0 : b.monthly_savings / b.monthly_cost_current
        return (pctB - pctA) || byName
      }
      case 'clusters':
        return (b.cluster_count - a.cluster_count) || byName
    }
  })
}

function CustomerCard({ customer }: { customer: DashboardCustomer }) {
  const fmt = useFormatCurrency()
  return (
    <Link
      to={`/customers/${customer.customer_id}`}
      className="block bg-white border border-neutral-100 rounded-xl p-6 hover:border-neutral-300 transition-colors group"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900 group-hover:text-black">
            {customer.customer_name}
          </h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            {customer.cluster_count} {customer.cluster_count === 1 ? 'cluster' : 'clusters'}
            {' · '}
            {customer.total_workload_count} workloads
          </p>
        </div>
        <ArrowRight size={14} className="text-neutral-300 group-hover:text-neutral-600 transition-colors mt-0.5" />
      </div>

      {customer.cluster_count === 0 ? (
        <div className="flex items-center justify-center py-6 mb-4 rounded-lg bg-neutral-50">
          <span className="text-xs text-neutral-400">No clusters yet</span>
        </div>
      ) : (
        <>
          <div className="space-y-1 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-400 w-24">Current</span>
              <span className="text-sm font-medium text-neutral-900">
                {fmt(customer.monthly_cost_current)}
                <span className="text-xs text-neutral-400 font-normal">/mo</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-400 w-24">Recommended</span>
              <span className="text-sm font-medium text-neutral-900">
                {fmt(customer.monthly_cost_recommended)}
                <span className="text-xs text-neutral-400 font-normal">/mo</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-4 border-t border-neutral-50">
            <TrendingDown size={13} className="text-emerald-500" />
            <span className="text-sm font-semibold">
              <PotentialAmount value={customer.monthly_savings} />/mo
            </span>
            <span className="text-xs text-neutral-400">
              · {formatSavingsPercent(customer.monthly_cost_current, customer.monthly_savings)} savings
            </span>
          </div>
        </>
      )}

      <div className="flex items-center gap-3 mt-3">
        {customer.cluster_breakdown.active > 0 && (
          <span className="text-xs text-neutral-400">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1" />
            {customer.cluster_breakdown.active} active
          </span>
        )}
        {customer.cluster_breakdown.inactive > 0 && (
          <span className="text-xs text-neutral-400">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-neutral-300 mr-1" />
            {customer.cluster_breakdown.inactive} inactive
          </span>
        )}
        {customer.cluster_breakdown.pending > 0 && (
          <span className="text-xs text-neutral-400">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-300 mr-1" />
            {customer.cluster_breakdown.pending} pending
          </span>
        )}
      </div>
    </Link>
  )
}

export default function DashboardPage() {
  const [timeWindow, setTimeWindow] = useState<TimeWindow>(() => {
    const s = localStorage.getItem('time_window')
    return (['7d', '30d'] as TimeWindow[]).includes(s as TimeWindow)
      ? (s as TimeWindow)
      : '7d'
  })
  const [sortKey, setSortKey] = useState<SortKey>(
    () => (localStorage.getItem('dashboard_sort') as SortKey) ?? 'savings'
  )
  const [sortOpen, setSortOpen] = useState(false)
  const sortRef = useRef<HTMLDivElement>(null)
  const { data, isLoading, error } = useDashboard(timeWindow)

  useEffect(() => {
    if (!sortOpen) return
    function onMouseDown(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [sortOpen])

  function handleSort(key: SortKey) {
    setSortKey(key)
    setSortOpen(false)
    localStorage.setItem('dashboard_sort', key)
  }

  const currentSortLabel = SORT_OPTIONS.find((o) => o.value === sortKey)?.label ?? 'Sort'
  const sorted = data ? sortCustomers(data.customers, sortKey) : []

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-semibold text-neutral-900">Dashboard</h1>
        <div className="flex items-center gap-3">
          <div ref={sortRef} className="relative">
            <button
              onClick={() => setSortOpen((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
            >
              <ArrowUpDown size={12} />
              {currentSortLabel}
            </button>
            {sortOpen && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-neutral-100 rounded-lg shadow-sm py-1 z-10">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleSort(option.value)}
                    className={cn(
                      'w-full text-left px-3 py-1.5 text-xs transition-colors',
                      sortKey === option.value
                        ? 'text-neutral-900 font-medium'
                        : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-1">
            {TIME_WINDOWS.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => {
                  setTimeWindow(value)
                  localStorage.setItem('time_window', value)
                }}
                className={cn(
                  'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                  timeWindow === value
                    ? 'bg-[#2563AF]/10 text-[#2563AF]'
                    : 'text-neutral-400 hover:text-neutral-700'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

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

      {error && (
        <div className="mb-8 px-4 py-3 rounded-lg bg-red-50 border border-red-100">
          <p className="text-sm text-red-500">
            {getErrorCode(error) === 'DB_UNAVAILABLE'
              ? 'Service is temporarily unavailable. Please try again later.'
              : 'Failed to load dashboard data.'}
          </p>
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-white border border-neutral-100 rounded-xl p-6">
              <p className="text-xs text-neutral-400 uppercase tracking-wide mb-2">Total Monthly Spend</p>
              <p className="text-2xl font-semibold text-neutral-900">
                <AnimatedCurrency value={data.total_monthly_cost_current} />
                <span className="text-sm font-normal text-neutral-400 ml-1">/mo</span>
              </p>
            </div>
            <div className="bg-white border border-neutral-100 rounded-xl p-6">
              <p className="text-xs text-neutral-400 uppercase tracking-wide mb-2">Recommended</p>
              <p className="text-2xl font-semibold text-neutral-900">
                <AnimatedCurrency value={data.total_monthly_cost_recommended} />
                <span className="text-sm font-normal text-neutral-400 ml-1">/mo</span>
              </p>
            </div>
            <div className="bg-white border border-neutral-100 rounded-xl p-6">
              <p className="text-xs text-neutral-400 uppercase tracking-wide mb-2">{savingsLabel(timeWindow)}</p>
              <p className="text-2xl font-semibold">
                <PotentialAmount value={data.total_monthly_savings} animated />
                <span className="text-sm font-normal text-neutral-400 ml-1">/mo</span>
              </p>
              <p className="text-xs text-neutral-400 mt-1">
                {formatSavingsPercent(data.total_monthly_cost_current, data.total_monthly_savings)} reduction
              </p>
            </div>
            <div className="bg-white border border-neutral-100 rounded-xl p-6">
              <p className="text-xs text-neutral-400 uppercase tracking-wide mb-2">Realized Savings</p>
              <p className="text-2xl font-semibold">
                <RealizedAmount value={data.total_realized_savings} animated />
              </p>
              <p className="text-xs text-neutral-400 mt-1">all time</p>
            </div>
          </div>

          <div>
            <h2 className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-4">
              Customers · {data.customer_count}
            </h2>
            {sorted.length === 0 ? (
              <p className="text-sm text-neutral-400">No customers assigned.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {sorted.map((customer) => (
                  <CustomerCard key={customer.customer_id} customer={customer} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
