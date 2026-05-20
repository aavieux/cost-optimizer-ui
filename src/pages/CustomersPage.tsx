import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Search, ArrowUpDown, Plus, Pencil, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useCustomers } from '@/hooks/useCustomers'
import { useCreateCustomer } from '@/hooks/useCreateCustomer'
import { useRenameCustomer } from '@/hooks/useRenameCustomer'
import { useDeleteCustomer } from '@/hooks/useDeleteCustomer'
import { getErrorCode } from '@/lib/api'
import { cn } from '@/lib/utils'
import Dialog from '@/components/Dialog'
import type { Customer } from '@/types/customer'

const SORT_OPTIONS = [
  { label: 'Name', value: 'name' },
  { label: 'Clusters', value: 'clusters' },
  { label: 'Date added', value: 'created' },
] as const

type SortKey = typeof SORT_OPTIONS[number]['value']
const VALID_SORT_KEYS = SORT_OPTIONS.map((o) => o.value) as readonly SortKey[]

function sortCustomers(customers: Customer[], key: SortKey): Customer[] {
  return [...customers].sort((a, b) => {
    const byName = a.name.localeCompare(b.name)
    switch (key) {
      case 'name': return byName
      case 'clusters': return (b.cluster_count - a.cluster_count) || byName
      case 'created': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    }
  })
}

const nameSchema = z.object({ name: z.string().min(1, 'Name is required') })
type NameForm = z.infer<typeof nameSchema>

type Modal =
  | { type: 'create' }
  | { type: 'rename'; customer: Customer }
  | { type: 'delete'; customer: Customer }

export default function CustomersPage() {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>(() => {
    const stored = localStorage.getItem('customers_sort')
    return stored && (VALID_SORT_KEYS as readonly string[]).includes(stored) ? (stored as SortKey) : 'name'
  })
  const [sortOpen, setSortOpen] = useState(false)
  const [modal, setModal] = useState<Modal | null>(null)
  const [countdown, setCountdown] = useState(0)
  const sortRef = useRef<HTMLDivElement>(null)

  const { data, isLoading, error } = useCustomers()
  const createCustomer = useCreateCustomer()
  const renameCustomer = useRenameCustomer()
  const deleteCustomer = useDeleteCustomer()

  const { register, handleSubmit, watch, formState: { errors }, setError, reset } = useForm<NameForm>({
    resolver: zodResolver(nameSchema),
    defaultValues: { name: '' },
  })

  useEffect(() => {
    if (modal?.type === 'rename') {
      reset({ name: modal.customer.name })
    } else if (modal?.type === 'create') {
      reset({ name: '' })
    }
  }, [modal, reset])

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

  const isDev = import.meta.env.VITE_ENV === 'dev'
  const deleteTargetId = modal?.type === 'delete' ? modal.customer.id : null
  useEffect(() => {
    if (deleteTargetId === null) return
    if (isDev) { setCountdown(0); return }
    setCountdown(10)
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(interval); return 0 }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [deleteTargetId])

  const filtered = data
    ? sortCustomers(
        data.customers.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())),
        sortKey
      )
    : []

  const currentSortLabel = SORT_OPTIONS.find((o) => o.value === sortKey)?.label ?? 'Sort'
  const isMutating = createCustomer.isPending || renameCustomer.isPending || deleteCustomer.isPending

  const onSubmitName = handleSubmit(async ({ name }) => {
    try {
      if (modal?.type === 'create') {
        await createCustomer.mutateAsync(name)
        toast.success('Customer created')
      } else if (modal?.type === 'rename') {
        await renameCustomer.mutateAsync({ id: modal.customer.id, name })
        toast.success('Customer renamed')
      }
      setModal(null)
    } catch (err) {
      const code = getErrorCode(err)
      if (code === 'NAME_TAKEN') {
        setError('name', { message: 'This name is already taken' })
      } else {
        setError('root', { message: 'Something went wrong. Please try again.' })
      }
    }
  })

  const onDelete = async () => {
    if (modal?.type !== 'delete') return
    try {
      await deleteCustomer.mutateAsync(modal.customer.id)
      toast.success('Customer deleted')
      setModal(null)
    } catch (err) {
      const code = getErrorCode(err)
      toast.error(code === 'ACCESS_DENIED' ? 'Access denied.' : 'Failed to delete customer.')
    }
  }

  return (
    <div className="px-8 py-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-semibold text-neutral-900">
          Customers
          {data && (
            <span className="text-neutral-400 font-normal text-base ml-2">
              · {data.customers.length}
            </span>
          )}
        </h1>
        <div className="flex items-center gap-2">
          <div ref={sortRef} className="relative">
            <button
              onClick={() => setSortOpen((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
            >
              <ArrowUpDown size={12} />
              {currentSortLabel}
            </button>
            {sortOpen && (
              <div className="absolute right-0 top-full mt-1 w-36 bg-white/90 backdrop-blur-sm border border-white/70 rounded-lg shadow-lg py-1 z-10">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => { setSortKey(option.value); setSortOpen(false); localStorage.setItem('customers_sort', option.value) }}
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

          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-neutral-100 border-0 outline-none focus:ring-1 focus:ring-neutral-300 w-44 placeholder:text-neutral-400"
            />
          </div>

          <button
            onClick={() => setModal({ type: 'create' })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#2563AF]/10 text-[#2563AF] hover:bg-[#2563AF]/15 transition-colors"
          >
            <Plus size={12} />
            New customer
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-red-50 border border-red-100">
          <p className="text-sm text-red-500">
            {getErrorCode(error) === 'DB_UNAVAILABLE'
              ? 'Service is temporarily unavailable. Please try again later.'
              : 'Failed to load customers.'}
          </p>
        </div>
      )}

      {isLoading && (
        <div className="space-y-1">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-neutral-50 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {data && (
        filtered.length === 0 ? (
          <p className="text-sm text-neutral-400">
            {search ? 'No customers match your search.' : 'No customers assigned.'}
          </p>
        ) : (
          <div className="bg-white border border-neutral-100 rounded-xl divide-y divide-neutral-100">
            {filtered.map((customer) => (
              <div
                key={customer.id}
                className="flex items-center justify-between py-4 px-6 group hover:bg-neutral-50 transition-colors"
              >
                <Link to={`/customers/${customer.id}`} className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-900 group-hover:text-black">
                    {customer.name}
                  </p>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {customer.cluster_count} {customer.cluster_count === 1 ? 'cluster' : 'clusters'}
                  </p>
                </Link>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setModal({ type: 'rename', customer })}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition-all"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => setModal({ type: 'delete', customer })}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-all"
                  >
                    <Trash2 size={13} />
                  </button>
                  <Link to={`/customers/${customer.id}`} className="p-1">
                    <ArrowRight size={14} className="text-neutral-300 group-hover:text-neutral-600 transition-colors" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {(modal?.type === 'create' || modal?.type === 'rename') && (
        <Dialog
          title={modal.type === 'create' ? 'New customer' : 'Rename customer'}
          onClose={() => setModal(null)}
        >
          <form onSubmit={onSubmitName} className="space-y-4">
            <div>
              <label className="block text-xs text-neutral-500 mb-1.5">Name</label>
              <input
                {...register('name')}
                autoFocus
                placeholder="e.g. Acme Corp"
                className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-200 outline-none focus:ring-1 focus:ring-neutral-400 placeholder:text-neutral-300"
              />
              {errors.name && (
                <p className="text-xs text-red-500 mt-1.5">{errors.name.message}</p>
              )}
              {errors.root && (
                <p className="text-xs text-red-500 mt-1.5">{errors.root.message}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isMutating || (modal.type === 'rename' && watch('name').trim() === modal.customer.name)}
                className="px-4 py-1.5 text-xs font-medium bg-[#2563AF]/10 text-[#2563AF] rounded-lg hover:bg-[#2563AF]/15 disabled:opacity-40 transition-colors"
              >
                {isMutating ? 'Saving…' : modal.type === 'create' ? 'Create' : 'Save'}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {modal?.type === 'delete' && (
        <Dialog title="Delete customer" onClose={() => setModal(null)}>
          <p className="text-xs text-neutral-500 mb-5 -mt-2">
            <span className="font-medium text-neutral-700">{modal.customer.name}</span> and all its
            data will be permanently removed. This cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setModal(null)}
              className="px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onDelete}
              disabled={isMutating || countdown > 0}
              className="px-4 py-1.5 text-xs font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
            >
              {isMutating ? 'Deleting…' : countdown > 0 ? `Delete (${countdown})` : 'Delete'}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  )
}
