import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { CurrencyProvider } from '@/context/CurrencyContext'
import Layout from '@/components/Layout'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import CustomersPage from '@/pages/CustomersPage'
import ClustersPage from '@/pages/ClustersPage'
import CustomerPage from '@/pages/CustomerPage'
import ClusterPage from '@/pages/ClusterPage'

const queryClient = new QueryClient()

function isAuthenticated() {
  const token = localStorage.getItem('token')
  const expiresAt = localStorage.getItem('expires_at')
  if (!token || !expiresAt) return false
  return new Date(expiresAt) > new Date()
}

function ProtectedLayout() {
  if (!isAuthenticated()) {
    localStorage.clear() //TODO Consider deleting the items one by one
    return <Navigate to="/login" replace />
  }
  return <CurrencyProvider><Layout /></CurrencyProvider>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  if (isAuthenticated()) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/customers/:id" element={<CustomerPage />} />
            <Route path="/customers/:id/clusters/:cid" element={<ClusterPage />} />
            <Route path="/clusters" element={<ClustersPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster richColors />
    </QueryClientProvider>
  )
}
