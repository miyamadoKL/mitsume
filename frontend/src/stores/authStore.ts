import { create } from 'zustand'
import type { User, Role } from '@/types'
import { authApi } from '@/services/api'

interface UserWithRolesResponse extends User {
  roles?: Role[]
}

interface AuthState {
  user: User | null
  roles: Role[]
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  logout: () => Promise<void>
  setToken: (token: string) => Promise<void>
  checkAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  roles: [],
  token: localStorage.getItem('token'),
  isLoading: true,
  isAuthenticated: false,
  isAdmin: false,

  login: async (email: string, password: string) => {
    const response = await authApi.login(email, password)
    if (response.status === 'pending_approval') {
      throw new Error(response.message || 'Your account is pending admin approval')
    }
    if (!response.token || !response.user) {
      throw new Error('Invalid response from server')
    }
    localStorage.setItem('token', response.token)
    // Fetch user with roles after login
    try {
      const userWithRoles = await authApi.me() as UserWithRolesResponse
      const roles = userWithRoles.roles || []
      const isAdmin = roles.some(r => r.name === 'admin')
      set({ user: userWithRoles, roles, token: response.token, isAuthenticated: true, isAdmin })
    } catch {
      set({ user: response.user, roles: [], token: response.token, isAuthenticated: true, isAdmin: false })
    }
  },

  register: async (email: string, password: string, name: string) => {
    const response = await authApi.register(email, password, name)
    if (response.status === 'pending_approval') {
      // Registration successful but pending approval - don't authenticate
      throw new Error(response.message || 'Registration successful. Awaiting admin approval.')
    }
    if (!response.token || !response.user) {
      throw new Error('Invalid response from server')
    }
    localStorage.setItem('token', response.token)
    // First user gets admin role automatically
    try {
      const userWithRoles = await authApi.me() as UserWithRolesResponse
      const roles = userWithRoles.roles || []
      const isAdmin = roles.some(r => r.name === 'admin')
      set({ user: userWithRoles, roles, token: response.token, isAuthenticated: true, isAdmin })
    } catch {
      set({ user: response.user, roles: [], token: response.token, isAuthenticated: true, isAdmin: false })
    }
  },

  logout: async () => {
    // Call backend logout to clear HTTP-only cookie
    try {
      await authApi.logout()
    } catch {
      // Ignore errors - we still want to clear local state
    }
    localStorage.removeItem('token')
    set({ user: null, roles: [], token: null, isAuthenticated: false, isAdmin: false })
  },

  setToken: async (token: string) => {
    localStorage.setItem('token', token)
    set({ token })
    try {
      const userWithRoles = await authApi.me() as UserWithRolesResponse
      const roles = userWithRoles.roles || []
      const isAdmin = roles.some(r => r.name === 'admin')
      set({ user: userWithRoles, roles, isAuthenticated: true, isLoading: false, isAdmin })
    } catch {
      localStorage.removeItem('token')
      set({ token: null, roles: [], isAuthenticated: false, isLoading: false, isAdmin: false })
    }
  },

  checkAuth: async () => {
    const token = localStorage.getItem('token')

    // Try to authenticate even without localStorage token
    // This supports cookie-based authentication (e.g., after OAuth login with page refresh)
    try {
      const userWithRoles = await authApi.me() as UserWithRolesResponse
      const roles = userWithRoles.roles || []
      const isAdmin = roles.some(r => r.name === 'admin')
      set({ user: userWithRoles, roles, token: token, isAuthenticated: true, isLoading: false, isAdmin })
    } catch {
      // Only clear localStorage token if we had one and it failed
      if (token) {
        localStorage.removeItem('token')
      }
      set({ user: null, roles: [], token: null, isAuthenticated: false, isLoading: false, isAdmin: false })
    }
  },
}))
