import { useRef, useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  Database,
  Folder,
  FolderOpen,
  Table2,
  Columns,
  ChevronRight,
  ChevronDown,
  Lock,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Node types for the tree
export type NodeType = 'catalog' | 'schema' | 'table' | 'column' | 'placeholder'

// Flattened node for virtualized list
export interface FlatNode {
  id: string
  type: NodeType
  depth: number
  name: string
  isExpanded: boolean
  isLoading: boolean
  isAccessDenied: boolean
  hasChildren: boolean
  parentId: string | null
  // Additional data for columns
  columnInfo?: {
    type: string
    nullable: boolean
    comment: string | null
  }
  // Search match info
  matchesSearch?: boolean
}

interface VirtualizedTreeProps {
  nodes: FlatNode[]
  searchQuery: string
  onNodeExpand: (node: FlatNode) => void
  onNodeClick: (node: FlatNode) => void
  onNodeDoubleClick: (node: FlatNode) => void
  emptyMessage?: string
}

// Row height in pixels
const ROW_HEIGHT = 28

// Double-click delay in ms
// Trade-off: This delay is necessary to distinguish single-click (insert table name)
// from double-click (insert SELECT * FROM). Without this delay, both handlers would fire.
// 200ms is the standard threshold for double-click detection.
const DOUBLE_CLICK_DELAY = 200

export function VirtualizedTree({
  nodes,
  searchQuery,
  onNodeExpand,
  onNodeClick,
  onNodeDoubleClick,
  emptyMessage = 'No items found',
}: VirtualizedTreeProps) {
  const { t } = useTranslation()
  const parentRef = useRef<HTMLDivElement>(null)
  const [focusedIndex, setFocusedIndex] = useState(0)
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current)
      }
    }
  }, [])

  // Virtual list setup
  const virtualizer = useVirtualizer({
    count: nodes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })

  // Keyboard navigation handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const node = nodes[focusedIndex]
      if (!node) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setFocusedIndex((prev) => Math.min(prev + 1, nodes.length - 1))
          break

        case 'ArrowUp':
          e.preventDefault()
          setFocusedIndex((prev) => Math.max(prev - 1, 0))
          break

        case 'ArrowRight':
          e.preventDefault()
          if (node.hasChildren && !node.isExpanded && !node.isAccessDenied) {
            onNodeExpand(node)
          } else if (node.isExpanded && focusedIndex < nodes.length - 1) {
            // Move to first child
            setFocusedIndex((prev) => prev + 1)
          }
          break

        case 'ArrowLeft':
          e.preventDefault()
          if (node.isExpanded) {
            onNodeExpand(node) // Collapse
          } else if (node.parentId) {
            // Move to parent
            const parentIndex = nodes.findIndex((n) => n.id === node.parentId)
            if (parentIndex >= 0) setFocusedIndex(parentIndex)
          }
          break

        case 'Enter':
        case ' ':
          e.preventDefault()
          if (node.type === 'table') {
            onNodeDoubleClick(node)
          } else if (node.type === 'column') {
            onNodeClick(node)
          } else if (node.hasChildren && !node.isAccessDenied) {
            onNodeExpand(node)
          }
          break

        case 'Home':
          e.preventDefault()
          setFocusedIndex(0)
          break

        case 'End':
          e.preventDefault()
          setFocusedIndex(nodes.length - 1)
          break
      }
    },
    [focusedIndex, nodes, onNodeExpand, onNodeClick, onNodeDoubleClick]
  )

  // Scroll to focused item when it changes
  useEffect(() => {
    if (nodes.length > 0) {
      virtualizer.scrollToIndex(focusedIndex, { align: 'auto' })
    }
  }, [focusedIndex, virtualizer, nodes.length])

  // Highlight search match in text
  const highlightMatch = (text: string, query: string) => {
    if (!query) return text
    const index = text.toLowerCase().indexOf(query.toLowerCase())
    if (index === -1) return text
    return (
      <>
        {text.slice(0, index)}
        <mark className="bg-yellow-200 dark:bg-yellow-800">
          {text.slice(index, index + query.length)}
        </mark>
        {text.slice(index + query.length)}
      </>
    )
  }

  // Get icon for node type
  const getNodeIcon = (node: FlatNode) => {
    if (node.isAccessDenied) {
      return <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
    }
    if (node.isLoading) {
      return <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
    }

    switch (node.type) {
      case 'catalog':
        return <Database className="h-4 w-4 shrink-0" />
      case 'schema':
        return node.isExpanded ? (
          <FolderOpen className="h-4 w-4 shrink-0" />
        ) : (
          <Folder className="h-4 w-4 shrink-0" />
        )
      case 'table':
        return <Table2 className="h-4 w-4 shrink-0" />
      case 'column':
        return <Columns className="h-3 w-3 shrink-0 text-muted-foreground" />
    }
  }

  // Get expand/collapse chevron
  const getChevron = (node: FlatNode) => {
    if (node.isAccessDenied) {
      return <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
    }
    if (!node.hasChildren) {
      return <span className="w-3" />
    }
    if (node.isLoading) {
      return <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
    }
    return node.isExpanded ? (
      <ChevronDown className="h-3 w-3 shrink-0" />
    ) : (
      <ChevronRight className="h-3 w-3 shrink-0" />
    )
  }

  // Handle row click with double-click detection
  const handleRowClick = (node: FlatNode) => {
    const index = nodes.findIndex((n) => n.id === node.id)
    setFocusedIndex(index)

    // For table nodes, delay click to detect double-click
    if (node.type === 'table') {
      // Clear any pending click timeout
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current)
        clickTimeoutRef.current = null
      }
      // Set timeout for single click action
      clickTimeoutRef.current = setTimeout(() => {
        clickTimeoutRef.current = null
        onNodeClick(node)
      }, DOUBLE_CLICK_DELAY)
    } else if (node.type === 'column') {
      onNodeClick(node)
    }
  }

  // Handle row double click
  const handleRowDoubleClick = (node: FlatNode) => {
    if (node.type === 'table') {
      // Cancel pending single click
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current)
        clickTimeoutRef.current = null
      }
      onNodeDoubleClick(node)
    }
  }

  // Handle chevron click
  const handleChevronClick = (node: FlatNode, e: React.MouseEvent) => {
    e.stopPropagation()
    if (node.hasChildren && !node.isAccessDenied) {
      onNodeExpand(node)
    }
  }

  if (nodes.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div
      ref={parentRef}
      role="tree"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-activedescendant={nodes[focusedIndex]?.id}
      className="h-full overflow-auto focus:outline-none"
      style={{ contain: 'strict' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const node = nodes[virtualRow.index]
          const isFocused = virtualRow.index === focusedIndex

          // Placeholder nodes render differently
          if (node.type === 'placeholder') {
            return (
              <div
                key={node.id}
                id={node.id}
                role="treeitem"
                aria-level={node.depth + 1}
                className="flex items-center gap-1 px-2 text-sm text-muted-foreground italic absolute top-0 left-0 w-full"
                style={{
                  height: `${ROW_HEIGHT}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                  paddingLeft: `${8 + node.depth * 16}px`,
                }}
              >
                {node.isLoading ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                    <span>{node.name}</span>
                  </>
                ) : (
                  <span>{node.name}</span>
                )}
              </div>
            )
          }

          return (
            <div
              key={node.id}
              id={node.id}
              role="treeitem"
              aria-expanded={node.hasChildren ? node.isExpanded : undefined}
              aria-selected={isFocused}
              aria-level={node.depth + 1}
              tabIndex={isFocused ? 0 : -1}
              className={cn(
                'flex items-center gap-1 px-2 cursor-pointer text-sm absolute top-0 left-0 w-full',
                'hover:bg-accent transition-colors',
                isFocused && 'ring-2 ring-primary ring-inset bg-accent/50',
                node.isAccessDenied && 'opacity-60'
              )}
              style={{
                height: `${ROW_HEIGHT}px`,
                transform: `translateY(${virtualRow.start}px)`,
                paddingLeft: `${8 + node.depth * 16}px`,
              }}
              onClick={() => handleRowClick(node)}
              onDoubleClick={() => handleRowDoubleClick(node)}
              title={
                node.isAccessDenied
                  ? t('editor.schemaBrowser.accessDenied', 'Access denied')
                  : node.columnInfo
                    ? `${node.name}: ${node.columnInfo.type}${node.columnInfo.nullable ? ` ${t('editor.schemaBrowser.nullable', '(nullable)')}` : ''}${node.columnInfo.comment ? ` - ${node.columnInfo.comment}` : ''}`
                    : undefined
              }
            >
              {/* Chevron */}
              <button
                onClick={(e) => handleChevronClick(node, e)}
                className="p-0.5 hover:bg-accent-foreground/10 rounded shrink-0"
                aria-label={node.isExpanded ? t('editor.schemaBrowser.collapse', 'Collapse') : t('editor.schemaBrowser.expand', 'Expand')}
                tabIndex={-1}
              >
                {getChevron(node)}
              </button>

              {/* Icon */}
              {getNodeIcon(node)}

              {/* Name */}
              <span className="truncate flex-1">
                {highlightMatch(node.name, searchQuery)}
              </span>

              {/* Column type info */}
              {node.columnInfo && (
                <span className="text-xs text-muted-foreground truncate">
                  {node.columnInfo.type}
                </span>
              )}

              {/* Access denied indicator */}
              {node.isAccessDenied && (
                <Lock className="h-3 w-3 shrink-0 text-muted-foreground ml-auto" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
