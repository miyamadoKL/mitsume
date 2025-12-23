import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { renderApp, mockToken } from '../integration-utils'
import { server } from '@/mocks/server'
import {
  errorHandlers,
  emptyHandlers,
  slowHandlers,
  handlers,
  resetMockData,
} from '@/mocks/handlers'

// Simplify Monaco/editor-heavy parts if invoked
vi.mock('@/components/editor/SQLEditor', () => ({
  SQLEditor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea data-testid="sql-editor" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}))

// Mock ChartWidget to avoid ECharts canvas errors in jsdom
vi.mock('@/components/dashboard/ChartWidget', () => ({
  ChartWidget: ({ widget }: { widget: { name: string } }) => (
    <div data-testid="chart-widget">{widget.name}</div>
  ),
}))

describe('ダッシュボード統合テスト', () => {
  beforeEach(() => {
    localStorage.clear()
    server.resetHandlers(...handlers)
    resetMockData()
  })

  // ===================
  // ダッシュボード一覧テスト
  // ===================

  it('ダッシュボード一覧が表示される', async () => {
    renderApp({ initialEntries: ['/dashboards'], initialToken: mockToken })

    await waitFor(() => {
      expect(screen.getByText('Test Dashboard')).toBeInTheDocument()
    })
  })

  it('ダッシュボードが空の時にプレースホルダーを表示する', async () => {
    server.use(emptyHandlers.emptyDashboards)
    renderApp({ initialEntries: ['/dashboards'], initialToken: mockToken })

    await waitFor(() => {
      expect(screen.getByText(/No dashboards yet/i)).toBeInTheDocument()
    })
  })

  it('新規ダッシュボードを作成できる', async () => {
    renderApp({ initialEntries: ['/dashboards'], initialToken: mockToken })

    await waitFor(() => expect(screen.getByText('Dashboards')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /new dashboard/i }))
    await userEvent.type(screen.getByPlaceholderText('Dashboard name'), 'New Dashboard')
    fireEvent.click(screen.getByRole('button', { name: /^Create$/i }))

    await waitFor(() => {
      expect(screen.getByText('New Dashboard')).toBeInTheDocument()
    })
  })

  it('ダッシュボードを削除できる', async () => {
    renderApp({ initialEntries: ['/dashboards'], initialToken: mockToken })

    await waitFor(() => {
      expect(screen.getByText('Test Dashboard')).toBeInTheDocument()
    })

    // Click delete button on the dashboard card (Trash icon)
    const allButtons = screen.getAllByRole('button')
    const deleteButton = allButtons.find((btn) => {
      const svg = btn.querySelector('svg')
      return svg?.classList.contains('lucide-trash2')
    })
    expect(deleteButton).toBeTruthy()
    await userEvent.click(deleteButton!)

    // Confirm delete dialog - look for the dialog title
    await waitFor(() => {
      expect(screen.getByText('Delete Dashboard')).toBeInTheDocument()
    })

    const confirmButton = screen.getByRole('button', { name: /^delete$/i })
    await userEvent.click(confirmButton)

    // Dialog should close after deletion
    await waitFor(() => {
      expect(screen.queryByText('Delete Dashboard')).not.toBeInTheDocument()
    })
  })

  // ===================
  // ダッシュボード詳細テスト
  // ===================

  it('ダッシュボード詳細でウィジェットが表示される', async () => {
    renderApp({ initialEntries: ['/dashboards/dashboard-1'], initialToken: mockToken })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Test Dashboard' })).toBeInTheDocument()
    })
    // Widget is rendered with mocked ChartWidget
    expect(screen.getByTestId('chart-widget')).toBeInTheDocument()
  })

  it('ダッシュボード詳細でローディング状態を表示する', async () => {
    server.use(slowHandlers.slowDashboard)
    renderApp({ initialEntries: ['/dashboards/dashboard-1'], initialToken: mockToken })

    // Should show loading spinner
    await waitFor(() => {
      const loadingSpinner = document.querySelector('.animate-spin')
      expect(loadingSpinner).toBeInTheDocument()
    })
  })

  it('存在しないダッシュボードにアクセスするとダッシュボード一覧へリダイレクトする', async () => {
    server.use(errorHandlers.dashboardNotFound)
    renderApp({ initialEntries: ['/dashboards/nonexistent'], initialToken: mockToken })

    // DashboardDetail navigates to /dashboards on 404
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /new dashboard/i })).toBeInTheDocument()
    })
  })

  it('ダッシュボード詳細から一覧に戻れる', async () => {
    renderApp({ initialEntries: ['/dashboards/dashboard-1'], initialToken: mockToken })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Test Dashboard' })).toBeInTheDocument()
    })

    // Click back/dashboards link in sidebar
    const dashboardsLink = screen.getByRole('link', { name: /dashboards/i })
    await userEvent.click(dashboardsLink)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Dashboards' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /new dashboard/i })).toBeInTheDocument()
    })
  })

  // ===================
  // ウィジェットCRUDテスト
  // ===================

  it('編集モードに切り替えできる', async () => {
    renderApp({ initialEntries: ['/dashboards/dashboard-1'], initialToken: mockToken })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Test Dashboard' })).toBeInTheDocument()
    })

    // Click Edit button
    const editButton = screen.getByRole('button', { name: /edit/i })
    await userEvent.click(editButton)

    // Edit mode should be active - Add Widget button should be visible
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add widget/i })).toBeInTheDocument()
    })
  })

  it('ウィジェットを追加できる', async () => {
    renderApp({ initialEntries: ['/dashboards/dashboard-1'], initialToken: mockToken })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Test Dashboard' })).toBeInTheDocument()
    })

    // Enter edit mode
    await userEvent.click(screen.getByRole('button', { name: /edit/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add widget/i })).toBeInTheDocument()
    })

    // Open add widget dialog
    await userEvent.click(screen.getByRole('button', { name: /add widget/i }))

    // Fill widget form
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Widget name')).toBeInTheDocument()
    })

    await userEvent.type(screen.getByPlaceholderText('Widget name'), 'New Test Widget')

    // Click Add Widget button in dialog
    const addButtons = screen.getAllByRole('button', { name: /add widget/i })
    const dialogAddButton = addButtons.find(btn =>
      btn.closest('[role="dialog"]') || btn.closest('.fixed')
    )
    await userEvent.click(dialogAddButton || addButtons[addButtons.length - 1])

    // Dialog should close
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Widget name')).not.toBeInTheDocument()
    })
  })

  it('ウィジェットを保存済みクエリと関連付けて追加できる', async () => {
    renderApp({ initialEntries: ['/dashboards/dashboard-1'], initialToken: mockToken })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Test Dashboard' })).toBeInTheDocument()
    })

    // Enter edit mode
    await userEvent.click(screen.getByRole('button', { name: /edit/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add widget/i })).toBeInTheDocument()
    })

    // Open add widget dialog
    await userEvent.click(screen.getByRole('button', { name: /add widget/i }))

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Widget name')).toBeInTheDocument()
    })

    await userEvent.type(screen.getByPlaceholderText('Widget name'), 'Query Widget')

    // Select a saved query - the select should have saved queries loaded
    const querySelect = screen.getAllByRole('combobox')[0]
    await userEvent.selectOptions(querySelect, 'query-1')

    // Click Add Widget button
    const addButtons = screen.getAllByRole('button', { name: /add widget/i })
    await userEvent.click(addButtons[addButtons.length - 1])

    // Dialog should close
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Widget name')).not.toBeInTheDocument()
    })
  })

  it('ウィジェット追加に失敗した場合ダイアログが閉じない', async () => {
    server.use(errorHandlers.widgetCreateError)
    renderApp({ initialEntries: ['/dashboards/dashboard-1'], initialToken: mockToken })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Test Dashboard' })).toBeInTheDocument()
    })

    // Enter edit mode
    await userEvent.click(screen.getByRole('button', { name: /edit/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add widget/i })).toBeInTheDocument()
    })

    // Open add widget dialog
    await userEvent.click(screen.getByRole('button', { name: /add widget/i }))
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Widget name')).toBeInTheDocument()
    })

    await userEvent.type(screen.getByPlaceholderText('Widget name'), 'Failing Widget')

    // Click Add Widget
    const addButtons = screen.getAllByRole('button', { name: /add widget/i })
    await userEvent.click(addButtons[addButtons.length - 1])

    // Dialog should remain open after error
    await waitFor(
      () => {
        expect(screen.getByPlaceholderText('Widget name')).toBeInTheDocument()
      },
      { timeout: 1000 }
    )
  })

  // ===================
  // 空のダッシュボードテスト
  // ===================

  it('ウィジェットが空のダッシュボードでプレースホルダーを表示する', async () => {
    // Override dashboard to have no widgets
    server.use(
      http.get('/api/dashboards/:id', () => {
        return HttpResponse.json({
          id: 'dashboard-1',
          user_id: 'user-1',
          name: 'Empty Dashboard',
          description: 'A dashboard with no widgets',
          layout: [],
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          widgets: [],
        })
      })
    )

    renderApp({ initialEntries: ['/dashboards/dashboard-1'], initialToken: mockToken })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Empty Dashboard' })).toBeInTheDocument()
    })

    expect(screen.getByText(/No widgets yet/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add widget/i })).toBeInTheDocument()
  })
})
