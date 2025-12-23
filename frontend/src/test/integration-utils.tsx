import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppRoutes } from '@/App'
import { useAuthStore } from '@/stores/authStore'
import { useQueryStore } from '@/stores/queryStore'
import { mockUser, mockToken as handlersMockToken } from '@/mocks/handlers'

interface RenderAppOptions {
  initialEntries?: string[]
  initialToken?: string
}

export const mockToken = handlersMockToken

export function renderApp(options: RenderAppOptions = {}) {
  const { initialEntries = ['/'], initialToken } = options

  // Clear localStorage first
  localStorage.clear()

  // Reset stores before each render
  useAuthStore.setState({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
  })
  useQueryStore.setState({
    currentQuery: 'SELECT 1',
    result: null,
    isExecuting: false,
    error: null,
    savedQueries: [],
    history: [],
  })

  if (initialToken) {
    localStorage.setItem('token', initialToken)
    // Override checkAuth to not make API call when we're pre-authenticated
    // This prevents race conditions between initial state and useEffect
    useAuthStore.setState({
      isAuthenticated: true,
      isLoading: false,
      token: initialToken,
      user: mockUser,
      // Replace checkAuth with a no-op for pre-authenticated state
      checkAuth: async () => {
        // Already authenticated, no need to verify
        useAuthStore.setState({ isLoading: false })
      },
    })
  }

  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AppRoutes />
    </MemoryRouter>
  )
}
