import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Query } from './Query'
import { useQueryStore } from '@/stores/queryStore'
import { exportApi } from '@/services/api'

// Mock Monaco Editor
vi.mock('@/components/editor/SQLEditor', () => ({
  SQLEditor: ({ value, onChange, onExecute }: { value: string; onChange: (v: string) => void; onExecute: () => void }) => (
    <div data-testid="sql-editor">
      <textarea
        data-testid="sql-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.ctrlKey && e.key === 'Enter' && onExecute()}
      />
    </div>
  ),
}))

// Mock ResultsTable
vi.mock('@/components/results/ResultsTable', () => ({
  ResultsTable: ({ result }: { result: { columns: string[]; rows: unknown[][] } }) => (
    <div data-testid="results-table">
      <div>Columns: {result.columns.join(', ')}</div>
      <div>Rows: {result.rows.length}</div>
    </div>
  ),
}))

// Mock exportApi
vi.mock('@/services/api', () => ({
  exportApi: {
    csv: vi.fn(),
    tsv: vi.fn(),
  },
}))

describe('Query Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useQueryStore.setState({
      currentQuery: 'SELECT 1 as test',
      result: null,
      isExecuting: false,
      error: null,
      savedQueries: [],
      history: [],
    })
  })

  describe('Rendering', () => {
    it('should render the query editor', () => {
      render(<Query />)

      expect(screen.getByText('Query Editor')).toBeInTheDocument()
      expect(screen.getByTestId('sql-editor')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /execute/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
    })

    it('should show placeholder when no results', () => {
      render(<Query />)

      expect(screen.getByText('Execute a query to see results')).toBeInTheDocument()
    })

    it('should display results when available', () => {
      useQueryStore.setState({
        result: {
          columns: ['id', 'name'],
          rows: [[1, 'Test']],
          row_count: 1,
          execution_time_ms: 100,
        },
      })

      render(<Query />)

      expect(screen.getByTestId('results-table')).toBeInTheDocument()
      expect(screen.getByText('Columns: id, name')).toBeInTheDocument()
    })

    it('should display error when query fails', () => {
      useQueryStore.setState({
        error: 'Query execution failed: Syntax error',
      })

      render(<Query />)

      expect(screen.getByText('Query execution failed: Syntax error')).toBeInTheDocument()
    })

    it('should show loading state during execution', () => {
      useQueryStore.setState({
        isExecuting: true,
      })

      render(<Query />)

      expect(screen.getByRole('button', { name: /execute/i })).toBeDisabled()
    })
  })

  describe('Query execution', () => {
    it('should execute query when Execute button is clicked', () => {
      const mockExecuteQuery = vi.fn()
      useQueryStore.setState({
        currentQuery: 'SELECT * FROM users',
        executeQuery: mockExecuteQuery,
      } as any)

      render(<Query />)

      fireEvent.click(screen.getByRole('button', { name: /execute/i }))

      expect(mockExecuteQuery).toHaveBeenCalledWith('SELECT * FROM users')
    })

    it('should update query when editor content changes', () => {
      const mockSetQuery = vi.fn()
      useQueryStore.setState({
        setQuery: mockSetQuery,
      } as any)

      render(<Query />)

      fireEvent.change(screen.getByTestId('sql-textarea'), {
        target: { value: 'SELECT * FROM orders' },
      })

      expect(mockSetQuery).toHaveBeenCalledWith('SELECT * FROM orders')
    })
  })

  describe('Save query dialog', () => {
    it('should open save dialog when Save button is clicked', () => {
      render(<Query />)

      fireEvent.click(screen.getByRole('button', { name: /save/i }))

      expect(screen.getByText('Save Query')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Query name')).toBeInTheDocument()
    })

    it('should call saveQuery when dialog is submitted', async () => {
      const mockSaveQuery = vi.fn().mockResolvedValue(undefined)
      useQueryStore.setState({
        saveQuery: mockSaveQuery,
      } as any)

      render(<Query />)

      fireEvent.click(screen.getByRole('button', { name: /save/i }))

      fireEvent.change(screen.getByPlaceholderText('Query name'), {
        target: { value: 'My Query' },
      })
      fireEvent.change(screen.getByPlaceholderText('Description'), {
        target: { value: 'Test description' },
      })

      const saveButtons = screen.getAllByRole('button', { name: /save/i })
      fireEvent.click(saveButtons[saveButtons.length - 1])

      await waitFor(() => {
        expect(mockSaveQuery).toHaveBeenCalledWith('My Query', 'Test description')
      })
    })

    it('should close dialog after successful save', async () => {
      const mockSaveQuery = vi.fn().mockResolvedValue(undefined)
      useQueryStore.setState({
        saveQuery: mockSaveQuery,
      } as any)

      render(<Query />)

      fireEvent.click(screen.getByRole('button', { name: /save/i }))

      fireEvent.change(screen.getByPlaceholderText('Query name'), {
        target: { value: 'My Query' },
      })

      const saveButtons = screen.getAllByRole('button', { name: /save/i })
      fireEvent.click(saveButtons[saveButtons.length - 1])

      await waitFor(() => {
        expect(screen.queryByText('Save Query')).not.toBeInTheDocument()
      })
    })

    it('should disable save button when name is empty', () => {
      render(<Query />)

      fireEvent.click(screen.getByRole('button', { name: /save/i }))

      const saveButtons = screen.getAllByRole('button', { name: /save/i })
      expect(saveButtons[saveButtons.length - 1]).toBeDisabled()
    })
  })

  describe('Export functionality', () => {
    beforeEach(() => {
      useQueryStore.setState({
        result: {
          columns: ['id', 'name'],
          rows: [[1, 'Test']],
          row_count: 1,
          execution_time_ms: 100,
        },
      })

      // Mock URL and document APIs
      global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
      global.URL.revokeObjectURL = vi.fn()
    })

    it('should show export buttons when results exist', () => {
      render(<Query />)

      expect(screen.getByRole('button', { name: /csv/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /tsv/i })).toBeInTheDocument()
    })

    it('should not show export buttons when no results', () => {
      useQueryStore.setState({ result: null })

      render(<Query />)

      expect(screen.queryByRole('button', { name: /csv/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /tsv/i })).not.toBeInTheDocument()
    })

    it('should open export dialog when CSV button is clicked', async () => {
      render(<Query />)

      fireEvent.click(screen.getByRole('button', { name: /csv/i }))

      await waitFor(() => {
        expect(screen.getByText('Export as CSV')).toBeInTheDocument()
        expect(screen.getByLabelText('Filename')).toBeInTheDocument()
      })
    })

    it('should open export dialog when TSV button is clicked', async () => {
      render(<Query />)

      fireEvent.click(screen.getByRole('button', { name: /tsv/i }))

      await waitFor(() => {
        expect(screen.getByText('Export as TSV')).toBeInTheDocument()
      })
    })

    it('should call exportApi.csv when Export button is clicked in dialog', async () => {
      const mockBlob = new Blob(['test'], { type: 'text/csv' })
      vi.mocked(exportApi.csv).mockResolvedValue(mockBlob)

      render(<Query />)

      fireEvent.click(screen.getByRole('button', { name: /csv/i }))

      await waitFor(() => {
        expect(screen.getByText('Export as CSV')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /^Export$/i }))

      await waitFor(() => {
        expect(exportApi.csv).toHaveBeenCalled()
      })
    })

    it('should call exportApi.tsv when Export button is clicked in dialog', async () => {
      const mockBlob = new Blob(['test'], { type: 'text/tab-separated-values' })
      vi.mocked(exportApi.tsv).mockResolvedValue(mockBlob)

      render(<Query />)

      fireEvent.click(screen.getByRole('button', { name: /tsv/i }))

      await waitFor(() => {
        expect(screen.getByText('Export as TSV')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /^Export$/i }))

      await waitFor(() => {
        expect(exportApi.tsv).toHaveBeenCalled()
      })
    })

    it('should close export dialog after successful export', async () => {
      const mockBlob = new Blob(['test'], { type: 'text/csv' })
      vi.mocked(exportApi.csv).mockResolvedValue(mockBlob)

      render(<Query />)

      fireEvent.click(screen.getByRole('button', { name: /csv/i }))

      await waitFor(() => {
        expect(screen.getByText('Export as CSV')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /^Export$/i }))

      await waitFor(() => {
        expect(screen.queryByText('Export as CSV')).not.toBeInTheDocument()
      })
    })
  })
})
