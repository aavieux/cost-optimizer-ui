import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Building2, Server, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import api from '@/lib/api'
import { useCurrency } from '@/context/CurrencyContext'
import Logo from '@/assets/logo.svg?react'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/customers', label: 'Customers', icon: Building2, end: false },
  { to: '/clusters', label: 'Clusters', icon: Server, end: false },
]

export default function Layout() {
  const navigate = useNavigate()
  const username = localStorage.getItem('username')
  const { currency, setCurrency, isLoadingRate } = useCurrency()

  async function handleLogout() {
    try {
      await api.post('/auth/logout')
    } finally {
      localStorage.removeItem('token')
      localStorage.removeItem('expires_at')
      localStorage.removeItem('username')
      navigate('/login')
    }
  }

  return (
    <div className="flex min-h-screen bg-neutral-50">
      {/* Sidebar */}
      <aside className="fixed top-0 left-0 h-full w-52 bg-white flex flex-col z-10 border-r border-neutral-100">
        {/* Brand */}
        <div className="h-14 flex items-center justify-center border-b border-neutral-100">
          <Logo className="h-10 w-auto" aria-label="Logo" />
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                  isActive
                    ? 'bg-gradient-to-r from-[#2563AF]/10 to-[#5AC9E9]/10 text-[#2563AF] font-medium'
                    : 'text-neutral-400 hover:text-neutral-900 hover:bg-neutral-50'
                )
              }
            >
              <Icon size={15} strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-neutral-100 space-y-3">
          {username && (
            <p className="text-xs text-neutral-400 px-1 truncate">{username}</p>
          )}
          <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-1">
            {(['USD', 'EUR'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                disabled={isLoadingRate && c === 'EUR' && currency !== 'EUR'}
                className={cn(
                  'flex-1 py-1 rounded-md text-xs font-medium transition-colors',
                  currency === c
                    ? 'bg-[#2563AF]/10 text-[#2563AF]'
                    : 'text-neutral-400 hover:text-neutral-700',
                  isLoadingRate && c === 'EUR' && currency !== 'EUR' && 'opacity-40 cursor-not-allowed',
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm text-neutral-400 hover:text-neutral-900 hover:bg-neutral-50 transition-colors"
          >
            <LogOut size={15} strokeWidth={1.75} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-52 flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  )
}
