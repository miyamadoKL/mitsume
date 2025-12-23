import { describe, it, expect } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from '@/App'
import { useAuthStore } from '@/stores/authStore'
import { render, screen } from '@testing-library/react'

describe('ProtectedRoute', () => {
  const ProtectedContent = () => <div>Protected Content</div>
  const Login = () => <div>Login Page</div>

  it('redirects unauthenticated users to login', () => {
    useAuthStore.setState({ isAuthenticated: false, isLoading: false })

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <ProtectedContent />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<Login />} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Login Page')).toBeInTheDocument()
  })

  it('renders children when authenticated', () => {
    useAuthStore.setState({ isAuthenticated: true, isLoading: false })

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <ProtectedContent />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<Login />} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })
})
