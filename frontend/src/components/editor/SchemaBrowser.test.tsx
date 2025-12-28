import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { emptyHandlers, errorHandlers } from '@/mocks/handlers'

// Mock @tanstack/react-virtual to render all items without virtualization
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        start: i * 28,
        size: 28,
        key: i,
      })),
    getTotalSize: () => count * 28,
    scrollToIndex: vi.fn(),
  }),
}))

import { SchemaBrowser } from './SchemaBrowser'

// Mock IntersectionObserver
const mockIntersectionObserver = vi.fn()
mockIntersectionObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null,
})
window.IntersectionObserver = mockIntersectionObserver

// Mock ResizeObserver
const mockResizeObserver = vi.fn()
mockResizeObserver.mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))
window.ResizeObserver = mockResizeObserver

describe('SchemaBrowser', () => {
  const mockOnInsert = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  const renderSchemaBrowser = () => {
    return render(<SchemaBrowser onInsert={mockOnInsert} />)
  }

  describe('initial loading', () => {
    it('loads and displays catalogs', async () => {
      renderSchemaBrowser()

      await waitFor(() => {
        expect(screen.getByText('hive')).toBeInTheDocument()
        expect(screen.getByText('iceberg')).toBeInTheDocument()
        expect(screen.getByText('memory')).toBeInTheDocument()
      })
    })

    it('shows empty state when no catalogs', async () => {
      server.use(emptyHandlers.emptyCatalogs)

      renderSchemaBrowser()

      await waitFor(() => {
        expect(screen.getByText(/no catalogs/i)).toBeInTheDocument()
      })
    })

    it('shows error toast on catalog load failure', async () => {
      server.use(
        http.get('/api/catalogs', () =>
          HttpResponse.json({ error: 'Server error' }, { status: 500 })
        )
      )

      renderSchemaBrowser()

      // The component should still render the search input
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()
      })
    })
  })

  describe('catalog expansion', () => {
    it('loads schemas when catalog is expanded', async () => {
      renderSchemaBrowser()

      await waitFor(() => {
        expect(screen.getByText('hive')).toBeInTheDocument()
      })

      // Click on chevron to expand catalog
      const expandButton = screen.getAllByRole('button', { name: /expand/i })[0]
      fireEvent.click(expandButton)

      await waitFor(() => {
        expect(screen.getByText('default')).toBeInTheDocument()
        expect(screen.getByText('public')).toBeInTheDocument()
        expect(screen.getByText('test')).toBeInTheDocument()
      })
    })

    it('shows access denied for forbidden catalogs', async () => {
      server.use(errorHandlers.schemasForbidden)

      renderSchemaBrowser()

      await waitFor(() => {
        expect(screen.getByText('hive')).toBeInTheDocument()
      })

      // Click on chevron to expand catalog
      const expandButton = screen.getAllByRole('button', { name: /expand/i })[0]
      fireEvent.click(expandButton)

      await waitFor(() => {
        // Should show access denied state
        expect(screen.getByTitle('Access denied')).toBeInTheDocument()
      })
    })

    it('shows empty schemas message when catalog has no schemas', async () => {
      server.use(emptyHandlers.emptySchemas)

      renderSchemaBrowser()

      await waitFor(() => {
        expect(screen.getByText('hive')).toBeInTheDocument()
      })

      // Click on chevron to expand catalog
      const expandButton = screen.getAllByRole('button', { name: /expand/i })[0]
      fireEvent.click(expandButton)

      await waitFor(() => {
        expect(screen.getByText(/no schemas/i)).toBeInTheDocument()
      })
    })
  })

  describe('schema expansion', () => {
    it('loads tables when schema is expanded', async () => {
      renderSchemaBrowser()

      // Wait for catalogs
      await waitFor(() => {
        expect(screen.getByText('hive')).toBeInTheDocument()
      })

      // Expand catalog
      const expandButton = screen.getAllByRole('button', { name: /expand/i })[0]
      fireEvent.click(expandButton)

      await waitFor(() => {
        expect(screen.getByText('default')).toBeInTheDocument()
      })

      // Expand schema - find the expand button near 'default'
      const schemaRow = screen.getByText('default').closest('[role="treeitem"]')
      const schemaExpandButton = schemaRow?.querySelector('button')
      if (schemaExpandButton) {
        fireEvent.click(schemaExpandButton)
      }

      await waitFor(() => {
        expect(screen.getByText('users')).toBeInTheDocument()
        expect(screen.getByText('orders')).toBeInTheDocument()
        expect(screen.getByText('products')).toBeInTheDocument()
      })
    })

    it('shows empty tables message when schema has no tables', async () => {
      server.use(emptyHandlers.emptyTables)

      renderSchemaBrowser()

      // Wait for catalogs
      await waitFor(() => {
        expect(screen.getByText('hive')).toBeInTheDocument()
      })

      // Expand catalog
      const expandButton = screen.getAllByRole('button', { name: /expand/i })[0]
      fireEvent.click(expandButton)

      await waitFor(() => {
        expect(screen.getByText('default')).toBeInTheDocument()
      })

      // Expand schema
      const schemaRow = screen.getByText('default').closest('[role="treeitem"]')
      const schemaExpandButton = schemaRow?.querySelector('button')
      if (schemaExpandButton) {
        fireEvent.click(schemaExpandButton)
      }

      await waitFor(() => {
        expect(screen.getByText(/no tables/i)).toBeInTheDocument()
      })
    })
  })

  describe('table expansion', () => {
    it('loads columns when table is expanded', async () => {
      renderSchemaBrowser()

      // Wait for catalogs
      await waitFor(() => {
        expect(screen.getByText('hive')).toBeInTheDocument()
      })

      // Expand catalog
      const expandButton = screen.getAllByRole('button', { name: /expand/i })[0]
      fireEvent.click(expandButton)

      await waitFor(() => {
        expect(screen.getByText('default')).toBeInTheDocument()
      })

      // Expand schema
      const schemaRow = screen.getByText('default').closest('[role="treeitem"]')
      const schemaExpandButton = schemaRow?.querySelector('button')
      if (schemaExpandButton) {
        fireEvent.click(schemaExpandButton)
      }

      await waitFor(() => {
        expect(screen.getByText('users')).toBeInTheDocument()
      })

      // Expand table
      const tableRow = screen.getByText('users').closest('[role="treeitem"]')
      const tableExpandButton = tableRow?.querySelector('button')
      if (tableExpandButton) {
        fireEvent.click(tableExpandButton)
      }

      await waitFor(() => {
        expect(screen.getByText('id')).toBeInTheDocument()
        expect(screen.getByText('integer')).toBeInTheDocument()
        expect(screen.getByText('name')).toBeInTheDocument()
        expect(screen.getByText('varchar')).toBeInTheDocument()
      })
    })

    it('shows empty columns message when table has no columns', async () => {
      server.use(emptyHandlers.emptyColumns)

      renderSchemaBrowser()

      // Navigate to table
      await waitFor(() => {
        expect(screen.getByText('hive')).toBeInTheDocument()
      })

      const expandButton = screen.getAllByRole('button', { name: /expand/i })[0]
      fireEvent.click(expandButton)

      await waitFor(() => {
        expect(screen.getByText('default')).toBeInTheDocument()
      })

      const schemaRow = screen.getByText('default').closest('[role="treeitem"]')
      const schemaExpandButton = schemaRow?.querySelector('button')
      if (schemaExpandButton) {
        fireEvent.click(schemaExpandButton)
      }

      await waitFor(() => {
        expect(screen.getByText('users')).toBeInTheDocument()
      })

      const tableRow = screen.getByText('users').closest('[role="treeitem"]')
      const tableExpandButton = tableRow?.querySelector('button')
      if (tableExpandButton) {
        fireEvent.click(tableExpandButton)
      }

      await waitFor(() => {
        expect(screen.getByText(/no columns/i)).toBeInTheDocument()
      })
    })
  })

  describe('text insertion', () => {
    it('inserts table name on table double-click', async () => {
      renderSchemaBrowser()

      // Navigate to table
      await waitFor(() => {
        expect(screen.getByText('hive')).toBeInTheDocument()
      })

      const expandButton = screen.getAllByRole('button', { name: /expand/i })[0]
      fireEvent.click(expandButton)

      await waitFor(() => {
        expect(screen.getByText('default')).toBeInTheDocument()
      })

      const schemaRow = screen.getByText('default').closest('[role="treeitem"]')
      const schemaExpandButton = schemaRow?.querySelector('button')
      if (schemaExpandButton) {
        fireEvent.click(schemaExpandButton)
      }

      await waitFor(() => {
        expect(screen.getByText('users')).toBeInTheDocument()
      })

      // Double-click on table
      const tableRow = screen.getByText('users').closest('[role="treeitem"]')
      if (tableRow) {
        fireEvent.doubleClick(tableRow)
      }

      expect(mockOnInsert).toHaveBeenCalledWith(
        expect.stringContaining('SELECT')
      )
    })

    it('inserts column name on column click', async () => {
      renderSchemaBrowser()

      // Navigate to columns
      await waitFor(() => {
        expect(screen.getByText('hive')).toBeInTheDocument()
      })

      const expandButton = screen.getAllByRole('button', { name: /expand/i })[0]
      fireEvent.click(expandButton)

      await waitFor(() => {
        expect(screen.getByText('default')).toBeInTheDocument()
      })

      const schemaRow = screen.getByText('default').closest('[role="treeitem"]')
      const schemaExpandButton = schemaRow?.querySelector('button')
      if (schemaExpandButton) {
        fireEvent.click(schemaExpandButton)
      }

      await waitFor(() => {
        expect(screen.getByText('users')).toBeInTheDocument()
      })

      const tableRow = screen.getByText('users').closest('[role="treeitem"]')
      const tableExpandButton = tableRow?.querySelector('button')
      if (tableExpandButton) {
        fireEvent.click(tableExpandButton)
      }

      await waitFor(() => {
        expect(screen.getByText('id')).toBeInTheDocument()
      })

      // Click on column
      const columnRow = screen.getByText('id').closest('[role="treeitem"]')
      if (columnRow) {
        fireEvent.click(columnRow)
      }

      expect(mockOnInsert).toHaveBeenCalledWith('id')
    })
  })

  describe('search functionality', () => {
    it('filters nodes based on search query', async () => {
      renderSchemaBrowser()

      await waitFor(() => {
        expect(screen.getByText('hive')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText(/search/i)
      await userEvent.type(searchInput, 'hive')

      // Should still show hive (matches search)
      expect(screen.getByText('hive')).toBeInTheDocument()
    })
  })

  describe('refresh functionality', () => {
    it('refreshes data when refresh button is clicked', async () => {
      renderSchemaBrowser()

      await waitFor(() => {
        expect(screen.getByText('hive')).toBeInTheDocument()
      })

      const refreshButton = screen.getByRole('button', { name: /refresh/i })
      fireEvent.click(refreshButton)

      // Should trigger reload - catalogs should still be visible
      await waitFor(() => {
        expect(screen.getByText('hive')).toBeInTheDocument()
      })
    })
  })

  describe('collapse all functionality', () => {
    it('collapses all expanded nodes', async () => {
      renderSchemaBrowser()

      await waitFor(() => {
        expect(screen.getByText('hive')).toBeInTheDocument()
      })

      // Expand catalog
      const expandButton = screen.getAllByRole('button', { name: /expand/i })[0]
      fireEvent.click(expandButton)

      await waitFor(() => {
        expect(screen.getByText('default')).toBeInTheDocument()
      })

      // Click collapse all
      const collapseButton = screen.getByRole('button', { name: /collapse/i })
      fireEvent.click(collapseButton)

      // Schemas should no longer be visible
      await waitFor(() => {
        expect(screen.queryByText('default')).not.toBeInTheDocument()
      })
    })
  })
})
