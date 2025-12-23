import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { Login } from './Login'
import { useAuthStore } from '@/stores/authStore'
import { authApi } from '@/services/api'

// Mock react-router-dom
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock authApi
vi.mock('@/services/api', () => ({
  authApi: {
    getGoogleLoginUrl: vi.fn(),
  },
}))

const renderLogin = () => {
  return render(
    <BrowserRouter>
      <Login />
    </BrowserRouter>
  )
}

describe('Login Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,
    })
  })

  describe('Rendering', () => {
    it('should render login form by default', () => {
      renderLogin()

      expect(screen.getByText('Mitsume')).toBeInTheDocument()
      expect(screen.getByText('Trino SQL Client')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Email')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Password')).toBeInTheDocument()
      // Should have Login tab and Login submit button
      expect(screen.getAllByRole('button', { name: /^Login$/ }).length).toBeGreaterThanOrEqual(1)
    })

    it('should switch to register tab', () => {
      renderLogin()

      // Get the Register tab button (in the TabsList)
      const registerTabButtons = screen.getAllByRole('button', { name: /^Register$/ })
      fireEvent.click(registerTabButtons[0])

      expect(screen.getByPlaceholderText('Name')).toBeInTheDocument()
    })

    it('should render Google login button', () => {
      renderLogin()

      expect(screen.getByRole('button', { name: /google/i })).toBeInTheDocument()
    })
  })

  describe('Login flow', () => {
    it('should update input fields', () => {
      renderLogin()

      const emailInput = screen.getByPlaceholderText('Email')
      const passwordInput = screen.getByPlaceholderText('Password')

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })

      expect(emailInput).toHaveValue('test@example.com')
      expect(passwordInput).toHaveValue('password123')
    })

    it('should call login and navigate on success', async () => {
      // Mock successful login
      const mockLogin = vi.fn().mockResolvedValue(undefined)
      useAuthStore.setState({
        login: mockLogin,
        register: vi.fn(),
      } as any)

      renderLogin()

      fireEvent.change(screen.getByPlaceholderText('Email'), {
        target: { value: 'test@example.com' },
      })
      fireEvent.change(screen.getByPlaceholderText('Password'), {
        target: { value: 'password123' },
      })
      // Get submit button (the one with type="submit" is the last one)
      const loginButtons = screen.getAllByRole('button', { name: /^Login$/ })
      fireEvent.click(loginButtons[loginButtons.length - 1])

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123')
        expect(mockNavigate).toHaveBeenCalledWith('/query')
      })
    })

    it('should show error on login failure', async () => {
      // Mock failed login
      const mockLogin = vi.fn().mockRejectedValue(new Error('Invalid credentials'))
      useAuthStore.setState({
        login: mockLogin,
        register: vi.fn(),
      } as any)

      renderLogin()

      fireEvent.change(screen.getByPlaceholderText('Email'), {
        target: { value: 'test@example.com' },
      })
      fireEvent.change(screen.getByPlaceholderText('Password'), {
        target: { value: 'wrong' },
      })
      const loginButtons = screen.getAllByRole('button', { name: /^Login$/ })
      fireEvent.click(loginButtons[loginButtons.length - 1])

      await waitFor(() => {
        expect(screen.getByText('Invalid email or password')).toBeInTheDocument()
      })
    })

    it('should show loading state during login', async () => {
      // Mock slow login
      const mockLogin = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      )
      useAuthStore.setState({
        login: mockLogin,
        register: vi.fn(),
      } as any)

      renderLogin()

      fireEvent.change(screen.getByPlaceholderText('Email'), {
        target: { value: 'test@example.com' },
      })
      fireEvent.change(screen.getByPlaceholderText('Password'), {
        target: { value: 'password123' },
      })
      const loginButtons = screen.getAllByRole('button', { name: /^Login$/ })
      fireEvent.click(loginButtons[loginButtons.length - 1])

      expect(screen.getByRole('button', { name: /loading/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /loading/i })).toBeDisabled()
    })
  })

  describe('Register flow', () => {
    it('should call register and navigate on success', async () => {
      // Mock successful register
      const mockRegister = vi.fn().mockResolvedValue(undefined)
      useAuthStore.setState({
        login: vi.fn(),
        register: mockRegister,
      } as any)

      renderLogin()

      // Switch to register tab
      const registerTabButtons = screen.getAllByRole('button', { name: /^Register$/ })
      fireEvent.click(registerTabButtons[0])

      fireEvent.change(screen.getByPlaceholderText('Name'), {
        target: { value: 'Test User' },
      })
      fireEvent.change(screen.getByPlaceholderText('Email'), {
        target: { value: 'new@example.com' },
      })
      fireEvent.change(screen.getByPlaceholderText(/password/i), {
        target: { value: 'password123' },
      })
      // Click the submit button in the register form
      const registerSubmitButtons = screen.getAllByRole('button', { name: /^Register$/ })
      fireEvent.click(registerSubmitButtons[registerSubmitButtons.length - 1])

      await waitFor(() => {
        expect(mockRegister).toHaveBeenCalledWith('new@example.com', 'password123', 'Test User')
        expect(mockNavigate).toHaveBeenCalledWith('/query')
      })
    })

    it('should show error on registration failure', async () => {
      // Mock failed register
      const mockRegister = vi.fn().mockRejectedValue(new Error('Email taken'))
      useAuthStore.setState({
        login: vi.fn(),
        register: mockRegister,
      } as any)

      renderLogin()

      // Switch to register tab
      const registerTabButtons = screen.getAllByRole('button', { name: /^Register$/ })
      fireEvent.click(registerTabButtons[0])

      fireEvent.change(screen.getByPlaceholderText('Name'), {
        target: { value: 'Test User' },
      })
      fireEvent.change(screen.getByPlaceholderText('Email'), {
        target: { value: 'existing@example.com' },
      })
      fireEvent.change(screen.getByPlaceholderText(/password/i), {
        target: { value: 'password123' },
      })
      // Click the submit button in the register form
      const registerSubmitButtons = screen.getAllByRole('button', { name: /^Register$/ })
      fireEvent.click(registerSubmitButtons[registerSubmitButtons.length - 1])

      await waitFor(() => {
        expect(screen.getByText('Registration failed')).toBeInTheDocument()
      })
    })
  })

  describe('Google login', () => {
    it('should redirect to Google on button click', async () => {
      vi.mocked(authApi.getGoogleLoginUrl).mockResolvedValue('https://accounts.google.com/oauth')

      renderLogin()

      fireEvent.click(screen.getByRole('button', { name: /google/i }))

      await waitFor(() => {
        expect(authApi.getGoogleLoginUrl).toHaveBeenCalled()
      })
    })

    it('should show error if Google login not configured', async () => {
      vi.mocked(authApi.getGoogleLoginUrl).mockRejectedValue(new Error('Not configured'))

      renderLogin()

      fireEvent.click(screen.getByRole('button', { name: /google/i }))

      await waitFor(() => {
        expect(screen.getByText('Google login is not configured')).toBeInTheDocument()
      })
    })
  })
})
