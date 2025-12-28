import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

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

import { VirtualizedTree, FlatNode } from './VirtualizedTree'

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

describe('VirtualizedTree', () => {
  const mockOnNodeExpand = vi.fn()
  const mockOnNodeClick = vi.fn()
  const mockOnNodeDoubleClick = vi.fn()

  const createNode = (overrides: Partial<FlatNode> = {}): FlatNode => ({
    id: 'node-1',
    type: 'catalog',
    depth: 0,
    name: 'Test Node',
    isExpanded: false,
    isLoading: false,
    isAccessDenied: false,
    hasChildren: true,
    parentId: null,
    ...overrides,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const renderTree = (nodes: FlatNode[], searchQuery = '') => {
    return render(
      <VirtualizedTree
        nodes={nodes}
        searchQuery={searchQuery}
        onNodeExpand={mockOnNodeExpand}
        onNodeClick={mockOnNodeClick}
        onNodeDoubleClick={mockOnNodeDoubleClick}
      />
    )
  }

  describe('rendering', () => {
    it('renders empty message when no nodes', () => {
      renderTree([])
      expect(screen.getByText('No items found')).toBeInTheDocument()
    })

    it('renders custom empty message', () => {
      render(
        <VirtualizedTree
          nodes={[]}
          searchQuery=""
          onNodeExpand={mockOnNodeExpand}
          onNodeClick={mockOnNodeClick}
          onNodeDoubleClick={mockOnNodeDoubleClick}
          emptyMessage="No catalogs available"
        />
      )
      expect(screen.getByText('No catalogs available')).toBeInTheDocument()
    })

    it('renders catalog nodes', () => {
      const nodes = [createNode({ id: 'catalog-1', name: 'hive', type: 'catalog' })]
      renderTree(nodes)
      expect(screen.getByText('hive')).toBeInTheDocument()
    })

    it('renders schema nodes with folder icon', () => {
      const nodes = [
        createNode({ id: 'schema-1', name: 'default', type: 'schema', depth: 1 }),
      ]
      renderTree(nodes)
      expect(screen.getByText('default')).toBeInTheDocument()
    })

    it('renders table nodes', () => {
      const nodes = [
        createNode({ id: 'table-1', name: 'users', type: 'table', depth: 2, hasChildren: true }),
      ]
      renderTree(nodes)
      expect(screen.getByText('users')).toBeInTheDocument()
    })

    it('renders column nodes with type info', () => {
      const nodes = [
        createNode({
          id: 'column-1',
          name: 'id',
          type: 'column',
          depth: 3,
          hasChildren: false,
          columnInfo: { type: 'integer', nullable: false, comment: null },
        }),
      ]
      renderTree(nodes)
      expect(screen.getByText('id')).toBeInTheDocument()
      expect(screen.getByText('integer')).toBeInTheDocument()
    })

    it('renders placeholder nodes', () => {
      const nodes = [
        createNode({
          id: 'placeholder-1',
          name: 'No schemas',
          type: 'placeholder',
          depth: 1,
          hasChildren: false,
        }),
      ]
      renderTree(nodes)
      expect(screen.getByText('No schemas')).toBeInTheDocument()
    })

    it('renders loading placeholder with spinner', () => {
      const nodes = [
        createNode({
          id: 'loading-1',
          name: 'Loading...',
          type: 'placeholder',
          depth: 1,
          isLoading: true,
          hasChildren: false,
        }),
      ]
      renderTree(nodes)
      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('renders access denied nodes with lock icon', () => {
      const nodes = [
        createNode({ id: 'denied-1', name: 'restricted', isAccessDenied: true }),
      ]
      renderTree(nodes)
      expect(screen.getByText('restricted')).toBeInTheDocument()
      expect(screen.getByTitle('Access denied')).toBeInTheDocument()
    })

    it('highlights search matches', () => {
      const nodes = [createNode({ id: 'node-1', name: 'users_table' })]
      renderTree(nodes, 'users')
      const mark = screen.getByText('users')
      expect(mark.tagName).toBe('MARK')
    })
  })

  describe('click behavior', () => {
    it('calls onNodeClick for column nodes on single click', async () => {
      const nodes = [
        createNode({
          id: 'column-1',
          name: 'id',
          type: 'column',
          hasChildren: false,
          columnInfo: { type: 'integer', nullable: false, comment: null },
        }),
      ]
      renderTree(nodes)

      fireEvent.click(screen.getByText('id'))
      expect(mockOnNodeClick).toHaveBeenCalledWith(nodes[0])
    })

    it('calls onNodeClick for table nodes after delay (single click)', async () => {
      const nodes = [
        createNode({ id: 'table-1', name: 'users', type: 'table', depth: 2 }),
      ]
      renderTree(nodes)

      fireEvent.click(screen.getByText('users'))

      // Should not be called immediately
      expect(mockOnNodeClick).not.toHaveBeenCalled()

      // Advance timer past double-click delay
      vi.advanceTimersByTime(250)

      expect(mockOnNodeClick).toHaveBeenCalledWith(nodes[0])
    })

    it('calls onNodeDoubleClick for table nodes on double click', async () => {
      const nodes = [
        createNode({ id: 'table-1', name: 'users', type: 'table', depth: 2 }),
      ]
      renderTree(nodes)

      fireEvent.doubleClick(screen.getByText('users'))

      // Single click should be cancelled
      vi.advanceTimersByTime(250)

      expect(mockOnNodeClick).not.toHaveBeenCalled()
      expect(mockOnNodeDoubleClick).toHaveBeenCalledWith(nodes[0])
    })

    it('does not call onNodeDoubleClick for non-table nodes', () => {
      const nodes = [
        createNode({ id: 'schema-1', name: 'default', type: 'schema', depth: 1 }),
      ]
      renderTree(nodes)

      fireEvent.doubleClick(screen.getByText('default'))
      expect(mockOnNodeDoubleClick).not.toHaveBeenCalled()
    })
  })

  describe('expand/collapse', () => {
    it('calls onNodeExpand when chevron is clicked', () => {
      const nodes = [createNode({ id: 'catalog-1', name: 'hive', hasChildren: true })]
      renderTree(nodes)

      const chevronButton = screen.getByRole('button', { name: /expand/i })
      fireEvent.click(chevronButton)

      expect(mockOnNodeExpand).toHaveBeenCalledWith(nodes[0])
    })

    it('does not call onNodeExpand for access denied nodes', () => {
      const nodes = [
        createNode({ id: 'catalog-1', name: 'restricted', isAccessDenied: true }),
      ]
      renderTree(nodes)

      const chevronButton = screen.getByRole('button')
      fireEvent.click(chevronButton)

      expect(mockOnNodeExpand).not.toHaveBeenCalled()
    })

    it('does not call onNodeExpand for nodes without children', () => {
      const nodes = [
        createNode({
          id: 'column-1',
          name: 'id',
          type: 'column',
          hasChildren: false,
        }),
      ]
      renderTree(nodes)

      // Column nodes don't have expandable chevrons
      const buttons = screen.queryAllByRole('button')
      if (buttons.length > 0) {
        fireEvent.click(buttons[0])
      }

      expect(mockOnNodeExpand).not.toHaveBeenCalled()
    })
  })

  describe('keyboard navigation', () => {
    it('moves focus down with ArrowDown', async () => {
      const nodes = [
        createNode({ id: 'node-1', name: 'First' }),
        createNode({ id: 'node-2', name: 'Second' }),
      ]
      renderTree(nodes)

      const tree = screen.getByRole('tree')
      fireEvent.keyDown(tree, { key: 'ArrowDown' })

      // Second node should be focused
      const secondItem = screen.getByText('Second').closest('[role="treeitem"]')
      expect(secondItem).toHaveAttribute('aria-selected', 'true')
    })

    it('moves focus up with ArrowUp', async () => {
      const nodes = [
        createNode({ id: 'node-1', name: 'First' }),
        createNode({ id: 'node-2', name: 'Second' }),
      ]
      renderTree(nodes)

      const tree = screen.getByRole('tree')
      // Move to second item first
      fireEvent.keyDown(tree, { key: 'ArrowDown' })
      // Then move back up
      fireEvent.keyDown(tree, { key: 'ArrowUp' })

      const firstItem = screen.getByText('First').closest('[role="treeitem"]')
      expect(firstItem).toHaveAttribute('aria-selected', 'true')
    })

    it('expands node with ArrowRight', () => {
      const nodes = [
        createNode({ id: 'catalog-1', name: 'hive', hasChildren: true, isExpanded: false }),
      ]
      renderTree(nodes)

      const tree = screen.getByRole('tree')
      fireEvent.keyDown(tree, { key: 'ArrowRight' })

      expect(mockOnNodeExpand).toHaveBeenCalledWith(nodes[0])
    })

    it('collapses node with ArrowLeft when expanded', () => {
      const nodes = [
        createNode({ id: 'catalog-1', name: 'hive', hasChildren: true, isExpanded: true }),
      ]
      renderTree(nodes)

      const tree = screen.getByRole('tree')
      fireEvent.keyDown(tree, { key: 'ArrowLeft' })

      expect(mockOnNodeExpand).toHaveBeenCalledWith(nodes[0])
    })

    it('moves to parent with ArrowLeft when collapsed', () => {
      const nodes = [
        createNode({ id: 'catalog-1', name: 'hive', isExpanded: true }),
        createNode({
          id: 'schema-1',
          name: 'default',
          type: 'schema',
          depth: 1,
          parentId: 'catalog-1',
          isExpanded: false,
        }),
      ]
      renderTree(nodes)

      const tree = screen.getByRole('tree')
      // Focus on schema first
      fireEvent.keyDown(tree, { key: 'ArrowDown' })
      // Press left to go to parent
      fireEvent.keyDown(tree, { key: 'ArrowLeft' })

      const catalogItem = screen.getByText('hive').closest('[role="treeitem"]')
      expect(catalogItem).toHaveAttribute('aria-selected', 'true')
    })

    it('activates table with Enter', () => {
      const nodes = [
        createNode({ id: 'table-1', name: 'users', type: 'table', depth: 2 }),
      ]
      renderTree(nodes)

      const tree = screen.getByRole('tree')
      fireEvent.keyDown(tree, { key: 'Enter' })

      expect(mockOnNodeDoubleClick).toHaveBeenCalledWith(nodes[0])
    })

    it('activates column with Enter', () => {
      const nodes = [
        createNode({
          id: 'column-1',
          name: 'id',
          type: 'column',
          hasChildren: false,
          columnInfo: { type: 'integer', nullable: false, comment: null },
        }),
      ]
      renderTree(nodes)

      const tree = screen.getByRole('tree')
      fireEvent.keyDown(tree, { key: 'Enter' })

      expect(mockOnNodeClick).toHaveBeenCalledWith(nodes[0])
    })

    it('jumps to first item with Home', () => {
      const nodes = [
        createNode({ id: 'node-1', name: 'First' }),
        createNode({ id: 'node-2', name: 'Second' }),
        createNode({ id: 'node-3', name: 'Third' }),
      ]
      renderTree(nodes)

      const tree = screen.getByRole('tree')
      // Move to last
      fireEvent.keyDown(tree, { key: 'End' })
      // Jump to first
      fireEvent.keyDown(tree, { key: 'Home' })

      const firstItem = screen.getByText('First').closest('[role="treeitem"]')
      expect(firstItem).toHaveAttribute('aria-selected', 'true')
    })

    it('jumps to last item with End', () => {
      const nodes = [
        createNode({ id: 'node-1', name: 'First' }),
        createNode({ id: 'node-2', name: 'Second' }),
        createNode({ id: 'node-3', name: 'Third' }),
      ]
      renderTree(nodes)

      const tree = screen.getByRole('tree')
      fireEvent.keyDown(tree, { key: 'End' })

      const lastItem = screen.getByText('Third').closest('[role="treeitem"]')
      expect(lastItem).toHaveAttribute('aria-selected', 'true')
    })
  })

  describe('accessibility', () => {
    it('has tree role', () => {
      renderTree([createNode()])
      expect(screen.getByRole('tree')).toBeInTheDocument()
    })

    it('has treeitem role for each node', () => {
      const nodes = [
        createNode({ id: 'node-1', name: 'First' }),
        createNode({ id: 'node-2', name: 'Second' }),
      ]
      renderTree(nodes)
      expect(screen.getAllByRole('treeitem')).toHaveLength(2)
    })

    it('sets aria-expanded for expandable nodes', () => {
      const nodes = [
        createNode({ id: 'catalog-1', name: 'hive', hasChildren: true, isExpanded: true }),
      ]
      renderTree(nodes)

      const item = screen.getByRole('treeitem')
      expect(item).toHaveAttribute('aria-expanded', 'true')
    })

    it('sets aria-level based on depth', () => {
      const nodes = [
        createNode({ id: 'catalog-1', name: 'hive', depth: 0 }),
        createNode({ id: 'schema-1', name: 'default', type: 'schema', depth: 1 }),
      ]
      renderTree(nodes)

      const items = screen.getAllByRole('treeitem')
      expect(items[0]).toHaveAttribute('aria-level', '1')
      expect(items[1]).toHaveAttribute('aria-level', '2')
    })
  })
})
