import { Folder, FolderOpen, ChevronRight, ChevronDown, Lock } from 'lucide-react'
import { TableNode } from './TableNode'
import { cn } from '@/lib/utils'

interface SchemaNodeProps {
  catalog: string
  schema: string
  isExpanded: boolean
  isAccessDenied: boolean
  tables: string[]
  searchQuery: string
  onExpand: () => void
  onTableClick: (table: string) => void
  onTableDoubleClick: (table: string) => void
  onColumnClick: (table: string, column: string) => void
}

export function SchemaNode({
  catalog,
  schema,
  isExpanded,
  isAccessDenied,
  tables,
  searchQuery,
  onExpand,
  onTableClick,
  onTableDoubleClick,
  onColumnClick,
}: SchemaNodeProps) {
  // Filter tables by search query
  const filteredTables = searchQuery
    ? tables.filter(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
    : tables

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 px-2 py-1 rounded hover:bg-accent cursor-pointer text-sm",
          isExpanded && "bg-accent/50",
          isAccessDenied && "opacity-60"
        )}
        onClick={onExpand}
        title={isAccessDenied ? 'Access denied' : undefined}
      >
        {isAccessDenied ? (
          <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : isExpanded ? (
          <ChevronDown className="h-4 w-4 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0" />
        )}
        {isExpanded ? (
          <FolderOpen className="h-4 w-4 shrink-0" />
        ) : (
          <Folder className="h-4 w-4 shrink-0" />
        )}
        <span className="truncate">{schema}</span>
        {isAccessDenied && (
          <Lock className="h-3 w-3 shrink-0 text-muted-foreground ml-auto" />
        )}
      </div>

      {isExpanded && (
        <div className="pl-4">
          {filteredTables.length === 0 ? (
            <div className="text-xs text-muted-foreground px-2 py-1">
              No tables
            </div>
          ) : (
            filteredTables.map(table => (
              <TableNode
                key={table}
                catalog={catalog}
                schema={schema}
                table={table}
                searchQuery={searchQuery}
                onTableClick={() => onTableClick(table)}
                onTableDoubleClick={() => onTableDoubleClick(table)}
                onColumnClick={(column) => onColumnClick(table, column)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
