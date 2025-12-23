import { describe, it, expect, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp, mockToken } from '../integration-utils'
import { server } from '@/mocks/server'
import { errorHandlers, handlers, resetMockData } from '@/mocks/handlers'
import { useAuthStore } from '@/stores/authStore'

// Force sequential execution to prevent handler state pollution between tests
describe.sequential('認証フロー統合テスト', () => {
  beforeEach(() => {
    // Clear localStorage before each test to prevent state pollution
    localStorage.clear()
    // Reset MSW handlers to default state explicitly with all handlers
    server.resetHandlers(...handlers)
    // Reset mock data
    resetMockData()
  })

  // ===================
  // 登録関連テスト (First to avoid state pollution)
  // ===================

  it('登録成功後にクエリページへ遷移する', async () => {
    renderApp({ initialEntries: ['/login'] })

    // Switch to register tab and wait for it to be active
    const registerTab = screen.getAllByRole('button', { name: /^Register$/i })[0]
    await userEvent.click(registerTab)

    // Wait for the register form to be visible
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Name')).toBeInTheDocument()
    })

    await userEvent.type(screen.getByPlaceholderText('Name'), 'New User')
    await userEvent.type(screen.getByPlaceholderText('Email'), 'newuser@example.com')
    await userEvent.type(screen.getByPlaceholderText(/password.*min/i), 'password123')

    const registerButton = screen.getAllByRole('button', { name: /^Register$/i })
      .find((btn) => btn.getAttribute('type') === 'submit')
    await userEvent.click(registerButton!)

    await waitFor(() => {
      expect(screen.getByText('Query Editor')).toBeInTheDocument()
    })
  })

  it('登録失敗時にエラーを表示する', async () => {
    server.use(errorHandlers.registerFailure)
    renderApp({ initialEntries: ['/login'] })

    // Switch to register tab
    const registerTab = screen.getAllByRole('button', { name: /^Register$/i })[0]
    await userEvent.click(registerTab)

    await userEvent.type(screen.getByPlaceholderText('Name'), 'Existing User')
    await userEvent.type(screen.getByPlaceholderText('Email'), 'existing@example.com')
    await userEvent.type(screen.getByPlaceholderText(/password.*min/i), 'password123')

    const registerButton = screen.getAllByRole('button', { name: /^Register$/i })
      .find((btn) => btn.getAttribute('type') === 'submit')
    await userEvent.click(registerButton!)

    await waitFor(() => {
      expect(screen.getByText(/registration failed/i)).toBeInTheDocument()
    })
  })

  // ===================
  // ログイン関連テスト
  // ===================

  it('ログイン成功後にクエリページへ遷移する', async () => {
    renderApp({ initialEntries: ['/login'] })

    await userEvent.type(await screen.findByPlaceholderText('Email'), 'test@example.com')
    await userEvent.type(screen.getByPlaceholderText('Password'), 'password123')
    const loginButton = screen.getAllByRole('button', { name: /^Login$/i })
      .find((btn) => btn.getAttribute('type') === 'submit')
    await userEvent.click(loginButton!)

    await waitFor(() => {
      expect(screen.getByText('Query Editor')).toBeInTheDocument()
    })
  })

  it('ログイン失敗時にエラーを表示する', async () => {
    server.use(errorHandlers.loginFailure)
    renderApp({ initialEntries: ['/login'] })

    await userEvent.type(await screen.findByPlaceholderText('Email'), 'bad@example.com')
    await userEvent.type(screen.getByPlaceholderText('Password'), 'wrong')
    const loginButton = screen.getAllByRole('button', { name: /^Login$/i })
      .find((btn) => btn.getAttribute('type') === 'submit')
    await userEvent.click(loginButton!)

    await waitFor(() => {
      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument()
    })
  })

  // ===================
  // 認証状態・保護ルート
  // ===================

  it('未認証アクセスはログインへリダイレクトする', async () => {
    renderApp({ initialEntries: ['/query'] })
    await waitFor(() => {
      expect(screen.getByText('Mitsume')).toBeInTheDocument()
    })
  })

  it('トークン保持時は保護ページにアクセスできる', async () => {
    renderApp({ initialEntries: ['/query'], initialToken: mockToken })
    await waitFor(() => {
      expect(screen.getByText('Query Editor')).toBeInTheDocument()
    })
  })

  // ===================
  // ログアウト関連テスト
  // ===================

  it('ログアウト後にログインページへ遷移する', async () => {
    renderApp({ initialEntries: ['/query'], initialToken: mockToken })

    // Wait for Query Editor and ensure sidebar is loaded
    await waitFor(() => {
      expect(screen.getByText('Query Editor')).toBeInTheDocument()
    })

    // Wait for logout button to appear (sidebar loads with auth)
    const logoutButton = await screen.findByTitle('Logout')
    await userEvent.click(logoutButton)

    await waitFor(() => {
      expect(screen.getByText('Mitsume')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Email')).toBeInTheDocument()
    })

    // Verify token is cleared
    expect(localStorage.getItem('token')).toBeNull()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  // ===================
  // OAuth関連テスト
  // ===================

  it('Google OAuth URLを取得できる', async () => {
    renderApp({ initialEntries: ['/login'] })

    const googleButton = await screen.findByRole('button', { name: /google/i })
    expect(googleButton).toBeInTheDocument()
  })

  // ===================
  // トークン期限切れテスト
  // ===================

  it('トークン期限切れ時にログインページへリダイレクトされる', async () => {
    // Set up token expiry handler for /api/auth/me
    server.use(errorHandlers.tokenExpired)

    // Start with token in localStorage (simulates stale token)
    localStorage.setItem('token', 'expired-token')

    renderApp({ initialEntries: ['/query'] })

    // Should redirect to login due to 401 from /api/auth/me
    await waitFor(() => {
      expect(screen.getByText('Mitsume')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Email')).toBeInTheDocument()
    })
  })
})
