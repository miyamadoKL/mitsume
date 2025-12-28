import { useState, useCallback } from 'react'
import { ChevronRight, ChevronDown, Table2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { catalogApi } from '@/services/api'
import { ColumnNode } from './ColumnNode'
import type { ColumnInfo } from '@/types'

interface TableNodeProps {
  catalog: string
  schema: string
  table: string
  searchQuery: string
  onTableClick: () => void
  onTableDoubleClick: () => void
  onColumnClick: (columnName: string) => void
}

export function TableNode({
  catalog,
  schema,
  table,
  searchQuery,
  onTableClick,
  onTableDoubleClick,
  onColumnClick,
}: TableNodeProps) {
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [columns, setColumns] = useState<ColumnInfo[]>([])
  const [error, setError] = useState<string | null>(null)

  const handleToggle = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()

    if (!expanded && columns.length === 0 && !loading) {
      setLoading(true)
      setError(null)
      try {
        const cols = await catalogApi.getColumns(catalog, schema, table)
        setColumns(cols)
      } catch (err) {
        setError('Failed to load columns')
        console.error('Failed to load columns:', err)
      } finally {
        setLoading(false)
      }
    }

    setExpanded(!expanded)
  }, [expanded, columns.length, loading, catalog, schema, table])

  // Highlight search match
  const highlightMatch = (text: string, query: string) => {
    if (!query) return text
    const index = text.toLowerCase().indexOf(query.toLowerCase())
    if (index === -1) return text
    return (
      <>
        {text.slice(0, index)}
        <mark className="bg-yellow-200 dark:bg-yellow-800">{text.slice(index, index + query.length)}</mark>
        {text.slice(index + query.length)}
      </>
    )
  }

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 px-2 py-1 rounded hover:bg-accent cursor-pointer text-sm"
        )}
      >
        <button
          onClick={handleToggle}
          className="p-0.5 hover:bg-accent-foreground/10 rounded"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : expanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>
        <div
          className="flex items-center gap-1 flex-1 min-w-0"
          onClick={onTableClick}
          onDoubleClick={onTableDoubleClick}
        >
          <Table2 className="h-4 w-4 shrink-0" />
          <span className="truncate">{highlightMatch(table, searchQuery)}</span>
        </div>
      </div>

      {expanded && (
        <div className="ml-6">
          {error ? (
            <div className="text-xs text-destructive px-2 py-1">{error}</div>
          ) : columns.length === 0 && !loading ? (
            <div className="text-xs text-muted-foreground px-2 py-1">No columns</div>
          ) : (
            columns.map((col) => (
              <ColumnNode
                key={col.name}
                column={col}
                onClick={() => onColumnClick(col.name)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
