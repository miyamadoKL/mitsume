import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAuthStore } from './authStore'
import { mockUser, mockToken } from '../mocks/handlers'
import { localStorageData, setupLocalStorageMock } from '../test/setup'
import { authApi } from '../services/api'

// Mock the authApi module
vi.mock('../services/api', async () => {
  const actual = await vi.importActual('../services/api')
  return {
    ...actual,
    authApi: {
      login: vi.fn(),
      register: vi.fn(),
      me: vi.fn(),
      getGoogleLoginUrl: vi.fn(),
      logout: vi.fn().mockResolvedValue(undefined),
    },
  }
})

describe('authStore', () => {
  beforeEach(() => {
    setupLocalStorageMock()
    // Reset the store state before each test
    useAuthStore.setState({
      user: null,
      token: null,
      isLoading: true,
      isAuthenticated: false,
    })
    vi.clearAllMocks()
  })

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      vi.mocked(authApi.login).mockResolvedValue({
        status: 'success',
        token: mockToken,
        user: mockUser,
      })
      const { login } = useAuthStore.getState()

      await login('test@example.com', 'password123')

      const state = useAuthStore.getState()
      expect(state.user).toEqual(mockUser)
      expect(state.token).toBe(mockToken)
      expect(state.isAuthenticated).toBe(true)
      expect(localStorage.setItem).toHaveBeenCalledWith('token', mockToken)
    })

    it('should throw error with invalid credentials', async () => {
      vi.mocked(authApi.login).mockRejectedValue(new Error('Invalid credentials'))
      const { login } = useAuthStore.getState()

      await expect(login('wrong@example.com', 'wrongpassword')).rejects.toThrow()

      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.isAuthenticated).toBe(false)
    })
  })

  describe('register', () => {
    it('should register successfully', async () => {
      vi.mocked(authApi.register).mockResolvedValue({
        status: 'success',
        token: mockToken,
        user: { ...mockUser, email: 'new@example.com', name: 'New User' },
      })
      const { register } = useAuthStore.getState()

      await register('new@example.com', 'password123', 'New User')

      const state = useAuthStore.getState()
      expect(state.user).toBeTruthy()
      expect(state.user?.email).toBe('new@example.com')
      expect(state.token).toBe(mockToken)
      expect(state.isAuthenticated).toBe(true)
      expect(localStorage.setItem).toHaveBeenCalledWith('token', mockToken)
    })
  })

  describe('logout', () => {
    it('should clear user state on logout', async () => {
      // First login
      useAuthStore.setState({
        user: mockUser,
        token: mockToken,
        isAuthenticated: true,
      })

      const { logout } = useAuthStore.getState()
      await logout()

      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.token).toBeNull()
      expect(state.isAuthenticated).toBe(false)
      expect(localStorage.removeItem).toHaveBeenCalledWith('token')
    })
  })

  describe('setToken', () => {
    it('should set token and fetch user', async () => {
      vi.mocked(authApi.me).mockResolvedValue(mockUser)
      const { setToken } = useAuthStore.getState()

      await setToken(mockToken)

      const state = useAuthStore.getState()
      expect(state.token).toBe(mockToken)
      expect(state.user).toEqual(mockUser)
      expect(state.isAuthenticated).toBe(true)
      expect(state.isLoading).toBe(false)
    })

    it('should clear token on auth failure', async () => {
      vi.mocked(authApi.me).mockRejectedValue(new Error('Unauthorized'))
      const { setToken } = useAuthStore.getState()

      await setToken('invalid-token')

      const state = useAuthStore.getState()
      expect(state.token).toBeNull()
      expect(state.user).toBeNull()
      expect(state.isAuthenticated).toBe(false)
      expect(localStorage.removeItem).toHaveBeenCalledWith('token')
    })
  })

  describe('checkAuth', () => {
    it('should authenticate if valid token exists', async () => {
      localStorageData['token'] = mockToken
      vi.mocked(authApi.me).mockResolvedValue(mockUser)
      const { checkAuth } = useAuthStore.getState()

      await checkAuth()

      const state = useAuthStore.getState()
      expect(state.user).toEqual(mockUser)
      expect(state.isAuthenticated).toBe(true)
      expect(state.isLoading).toBe(false)
    })

    it('should not authenticate if no token and cookie auth fails', async () => {
      // When there's no localStorage token, checkAuth still tries API (for cookie auth)
      // If API fails (no cookie either), it should not authenticate
      vi.mocked(authApi.me).mockRejectedValue(new Error('Unauthorized'))
      const { checkAuth } = useAuthStore.getState()

      await checkAuth()

      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.isAuthenticated).toBe(false)
      expect(state.isLoading).toBe(false)
    })

    it('should clear state if token is invalid', async () => {
      localStorageData['token'] = 'invalid-token'
      vi.mocked(authApi.me).mockRejectedValue(new Error('Unauthorized'))
      const { checkAuth } = useAuthStore.getState()

      await checkAuth()

      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.isAuthenticated).toBe(false)
      expect(state.isLoading).toBe(false)
      expect(localStorage.removeItem).toHaveBeenCalledWith('token')
    })
  })
})
