import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Building2, Server, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import api from '@/lib/api'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/customers', label: 'Customers', icon: Building2, end: false },
  { to: '/clusters', label: 'Clusters', icon: Server, end: false },
]

export default function Layout() {
  const navigate = useNavigate()
  const username = localStorage.getItem('username')

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
      <aside className="fixed top-0 left-0 h-full w-52 bg-white border-r border-neutral-100 flex flex-col z-10">
        {/* Brand */}
        <div className="px-5 h-14 flex items-center border-b border-neutral-100">
          <span className="text-sm font-semibold tracking-tight text-neutral-900">
            Cost Optimizer
          </span>
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
                    ? 'bg-neutral-100 text-neutral-900 font-medium'
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
