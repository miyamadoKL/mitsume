import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { MainLayout } from '@/components/layout/MainLayout'
import { Login } from '@/pages/Login'
import { AuthCallback } from '@/pages/AuthCallback'
import { Query } from '@/pages/Query'
import { SavedQueries } from '@/pages/SavedQueries'
import { History } from '@/pages/History'
import { Dashboards } from '@/pages/Dashboards'
import { DashboardDetail } from '@/pages/DashboardDetail'
import NotificationChannels from '@/pages/NotificationChannels'
import Alerts from '@/pages/Alerts'
import Subscriptions from '@/pages/Subscriptions'
import RoleManagement from '@/pages/admin/RoleManagement'
import UserManagement from '@/pages/admin/UserManagement'
import { AdminProtectedRoute } from '@/components/auth/AdminProtectedRoute'
import { ToastContainer } from '@/components/ui/toast'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { LoadingState } from '@/components/ui/loading-state'

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingState size="lg" message="Loading..." />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export const AppRoutes: React.FC = () => {
  const { checkAuth } = useAuthStore()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/query" replace />} />
        <Route path="query" element={<Query />} />
        <Route path="saved" element={<SavedQueries />} />
        <Route path="history" element={<History />} />
        <Route path="dashboards" element={<Dashboards />} />
        <Route path="dashboards/:id" element={<DashboardDetail />} />
        <Route path="notifications" element={<NotificationChannels />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="subscriptions" element={<Subscriptions />} />
        <Route
          path="admin/roles"
          element={
            <AdminProtectedRoute>
              <RoleManagement />
            </AdminProtectedRoute>
          }
        />
        <Route
          path="admin/users"
          element={
            <AdminProtectedRoute>
              <UserManagement />
            </AdminProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/query" replace />} />
    </Routes>
  )
}

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppRoutes />
        <ToastContainer />
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
