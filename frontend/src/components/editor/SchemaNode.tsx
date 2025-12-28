import { Folder, FolderOpen, ChevronRight, ChevronDown } from 'lucide-react'
import { TableNode } from './TableNode'
import { cn } from '@/lib/utils'

interface SchemaNodeProps {
  catalog: string
  schema: string
  isExpanded: boolean
  tables: string[]
  searchQuery: string
  onExpand: () => void
  onTableClick: (table: string) => void
  onColumnClick: (table: string, column: string) => void
}

export function SchemaNode({
  catalog,
  schema,
  isExpanded,
  tables,
  searchQuery,
  onExpand,
  onTableClick,
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
          isExpanded && "bg-accent/50"
        )}
        onClick={onExpand}
      >
        {isExpanded ? (
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
                onColumnClick={(column) => onColumnClick(table, column)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
