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
  logout: () => void
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

  logout: () => {
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
    if (!token) {
      set({ isLoading: false, isAuthenticated: false })
      return
    }

    try {
      const userWithRoles = await authApi.me() as UserWithRolesResponse
      const roles = userWithRoles.roles || []
      const isAdmin = roles.some(r => r.name === 'admin')
      set({ user: userWithRoles, roles, isAuthenticated: true, isLoading: false, isAdmin })
    } catch {
      localStorage.removeItem('token')
      set({ user: null, roles: [], token: null, isAuthenticated: false, isLoading: false, isAdmin: false })
    }
  },
}))
