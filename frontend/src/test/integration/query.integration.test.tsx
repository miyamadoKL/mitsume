import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp, mockToken } from '../integration-utils'
import { server } from '@/mocks/server'
import {
  errorHandlers,
  emptyHandlers,
  slowHandlers,
  handlers,
  resetMockData,
} from '@/mocks/handlers'

// Simplify Monaco editor for tests
vi.mock('@/components/editor/SQLEditor', () => ({
  SQLEditor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea data-testid="sql-editor" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}))

describe('クエリ統合テスト', () => {
  beforeEach(() => {
    localStorage.clear()
    server.resetHandlers(...handlers)
    resetMockData()
  })

  // ===================
  // クエリ実行テスト
  // ===================

  it('クエリを実行して結果を表示する', async () => {
    renderApp({ initialEntries: ['/query'], initialToken: mockToken })

    await waitFor(() => expect(screen.getByText('Query Editor')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /execute/i }))

    await waitFor(() => {
      expect(screen.getByText(/rows/i)).toBeInTheDocument()
    })
  })

  it('クエリ実行中にローディング状態を表示する', async () => {
    server.use(slowHandlers.slowQuery)
    renderApp({ initialEntries: ['/query'], initialToken: mockToken })

    await waitFor(() => expect(screen.getByText('Query Editor')).toBeInTheDocument())

    // Verify button is enabled before clicking
    const executeButton = screen.getByRole('button', { name: /execute/i })
    expect(executeButton).not.toBeDisabled()

    fireEvent.click(executeButton)

    // Button should be disabled and show spinner during execution
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /execute/i })).toBeDisabled()
    })
  })

  it('クエリ実行エラーを表示する', async () => {
    server.use(errorHandlers.queryExecutionError)
    renderApp({ initialEntries: ['/query'], initialToken: mockToken })

    await waitFor(() => expect(screen.getByText('Query Editor')).toBeInTheDocument())
    const editor = screen.getByTestId('sql-editor')
    await userEvent.clear(editor)
    await userEvent.type(editor, 'SELECT error')
    fireEvent.click(screen.getByRole('button', { name: /execute/i }))

    await waitFor(() => {
      expect(screen.getByText(/syntax error/i)).toBeInTheDocument()
    })
  })

  // ===================
  // クエリ保存テスト
  // ===================

  it('保存済みクエリ一覧に追加できる', async () => {
    renderApp({ initialEntries: ['/query'], initialToken: mockToken })
    await waitFor(() => expect(screen.getByText('Query Editor')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await userEvent.type(screen.getByPlaceholderText('Query name'), 'Integration Query')
    fireEvent.click(screen.getAllByRole('button', { name: /save/i }).pop()!)

    await waitFor(() => {
      expect(screen.queryByText('Save Query')).not.toBeInTheDocument()
    })
  })

  it('クエリ保存失敗時にダイアログが閉じない', async () => {
    server.use(errorHandlers.querySaveError)
    renderApp({ initialEntries: ['/query'], initialToken: mockToken })
    await waitFor(() => expect(screen.getByText('Query Editor')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await userEvent.type(screen.getByPlaceholderText('Query name'), 'Failing Query')

    const saveButton = screen.getAllByRole('button', { name: /save/i }).pop()!
    fireEvent.click(saveButton)

    // Dialog should remain open after error (save button still visible)
    await waitFor(
      () => {
        expect(screen.getByPlaceholderText('Query name')).toBeInTheDocument()
      },
      { timeout: 1000 }
    )
  })

  // ===================
  // 保存済みクエリ一覧テスト
  // ===================

  it('保存済みクエリ一覧を表示する', async () => {
    renderApp({ initialEntries: ['/saved'], initialToken: mockToken })

    await waitFor(() => {
      expect(screen.getByText('Test Query 1')).toBeInTheDocument()
      expect(screen.getByText('Test Query 2')).toBeInTheDocument()
    })
  })

  it('保存済みクエリが空の時にプレースホルダーを表示する', async () => {
    server.use(emptyHandlers.emptyQueries)
    renderApp({ initialEntries: ['/saved'], initialToken: mockToken })

    await waitFor(() => {
      expect(screen.getByText(/No saved queries/i)).toBeInTheDocument()
    })
  })

  it('保存済みクエリをエディタで使用できる', async () => {
    renderApp({ initialEntries: ['/saved'], initialToken: mockToken })

    await waitFor(() => {
      expect(screen.getByText('Test Query 1')).toBeInTheDocument()
    })

    // Click the "Use" button for the first query
    const useButtons = screen.getAllByRole('button', { name: /use/i })
    await userEvent.click(useButtons[0])

    // Should navigate to query editor
    await waitFor(() => {
      expect(screen.getByText('Query Editor')).toBeInTheDocument()
    })

    // Query should be loaded into the editor
    const editor = screen.getByTestId('sql-editor')
    expect(editor).toHaveValue('SELECT 1')
  })

  it('保存済みクエリを削除できる', async () => {
    renderApp({ initialEntries: ['/saved'], initialToken: mockToken })

    await waitFor(() => {
      expect(screen.getByText('Test Query 1')).toBeInTheDocument()
    })

    // Find all buttons and filter for delete button by looking for Trash2 icon
    const allButtons = screen.getAllByRole('button')
    const deleteButton = allButtons.find((btn) => {
      const svg = btn.querySelector('svg')
      return svg?.classList.contains('lucide-trash2')
    })
    expect(deleteButton).toBeTruthy()
    await userEvent.click(deleteButton!)

    // Confirm delete dialog - look for the dialog title and the query name
    await waitFor(() => {
      expect(screen.getByText('Delete Query')).toBeInTheDocument()
    })

    const confirmButton = screen.getByRole('button', { name: /^delete$/i })
    await userEvent.click(confirmButton)

    // Dialog should close after deletion
    await waitFor(() => {
      expect(screen.queryByText('Delete Query')).not.toBeInTheDocument()
    })
  })

  // ===================
  // クエリ履歴テスト
  // ===================

  it('クエリ履歴を表示する', async () => {
    renderApp({ initialEntries: ['/history'], initialToken: mockToken })

    await waitFor(() => {
      expect(screen.getByText('SELECT 1')).toBeInTheDocument()
      expect(screen.getByText(/SELECT \* FROM invalid/)).toBeInTheDocument()
    })
  })

  it('クエリ履歴が空の時にプレースホルダーを表示する', async () => {
    server.use(emptyHandlers.emptyHistory)
    renderApp({ initialEntries: ['/history'], initialToken: mockToken })

    await waitFor(() => {
      expect(screen.getByText(/No query history/i)).toBeInTheDocument()
    })
  })

  it('履歴からクエリをエディタで使用できる', async () => {
    renderApp({ initialEntries: ['/history'], initialToken: mockToken })

    await waitFor(() => {
      expect(screen.getByText('SELECT 1')).toBeInTheDocument()
    })

    // Click the "Use" button for the first history item
    const useButtons = screen.getAllByRole('button', { name: /use/i })
    await userEvent.click(useButtons[0])

    // Should navigate to query editor
    await waitFor(() => {
      expect(screen.getByText('Query Editor')).toBeInTheDocument()
    })

    // Query should be loaded into the editor
    const editor = screen.getByTestId('sql-editor')
    expect(editor).toHaveValue('SELECT 1')
  })

  it('エラーになった履歴クエリも再利用できる', async () => {
    renderApp({ initialEntries: ['/history'], initialToken: mockToken })

    await waitFor(() => {
      expect(screen.getByText(/SELECT \* FROM invalid/)).toBeInTheDocument()
    })

    // Find the Use button for the error query (second item)
    const useButtons = screen.getAllByRole('button', { name: /use/i })
    await userEvent.click(useButtons[1])

    // Should navigate to query editor
    await waitFor(() => {
      expect(screen.getByText('Query Editor')).toBeInTheDocument()
    })

    // Error query should be loaded into the editor
    const editor = screen.getByTestId('sql-editor')
    expect(editor).toHaveValue('SELECT * FROM invalid')
  })

  // ===================
  // エクスポートテスト
  // ===================

  it('CSVエクスポートボタンが結果表示後に使用可能になる', async () => {
    renderApp({ initialEntries: ['/query'], initialToken: mockToken })

    await waitFor(() => expect(screen.getByText('Query Editor')).toBeInTheDocument())

    // Export buttons should not be visible before query execution
    expect(screen.queryByRole('button', { name: /csv/i })).not.toBeInTheDocument()

    // Execute query to get results
    fireEvent.click(screen.getByRole('button', { name: /execute/i }))

    await waitFor(() => {
      expect(screen.getByText(/rows/i)).toBeInTheDocument()
    })

    // Check export buttons are visible after results
    expect(screen.getByRole('button', { name: /csv/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /tsv/i })).toBeInTheDocument()
  })

  it('CSVエクスポートボタンをクリックできる', async () => {
    renderApp({ initialEntries: ['/query'], initialToken: mockToken })

    await waitFor(() => expect(screen.getByText('Query Editor')).toBeInTheDocument())

    // Execute query first
    fireEvent.click(screen.getByRole('button', { name: /execute/i }))
    await waitFor(() => expect(screen.getByText(/rows/i)).toBeInTheDocument())

    // Verify CSV button exists and is clickable
    const csvButton = screen.getByRole('button', { name: /csv/i })
    expect(csvButton).toBeEnabled()

    // Click should not throw - the actual download is handled by the browser
    fireEvent.click(csvButton)
  })

  it('TSVエクスポートボタンをクリックできる', async () => {
    renderApp({ initialEntries: ['/query'], initialToken: mockToken })

    await waitFor(() => expect(screen.getByText('Query Editor')).toBeInTheDocument())

    // Execute query first
    fireEvent.click(screen.getByRole('button', { name: /execute/i }))
    await waitFor(() => expect(screen.getByText(/rows/i)).toBeInTheDocument())

    // Verify TSV button exists and is clickable
    const tsvButton = screen.getByRole('button', { name: /tsv/i })
    expect(tsvButton).toBeEnabled()

    // Click should not throw
    fireEvent.click(tsvButton)
  })
})
