import { Database, ChevronRight, ChevronDown, Lock } from 'lucide-react'
import { SchemaNode } from './SchemaNode'
import { cn } from '@/lib/utils'

interface CatalogNodeProps {
  catalog: string
  isExpanded: boolean
  isAccessDenied: boolean
  schemas: string[]
  expandedSchemas: Set<string>
  accessDeniedSchemas: Set<string>
  tablesMap: Map<string, string[]>
  showSystemSchemas: boolean
  searchQuery: string
  onExpand: () => void
  onSchemaExpand: (schema: string) => void
  onTableClick: (schema: string, table: string) => void
  onTableDoubleClick: (schema: string, table: string) => void
  onColumnClick: (schema: string, table: string, column: string) => void
}

// System schemas list
const SYSTEM_SCHEMAS = new Set([
  'information_schema',
  'sys',
  'pg_catalog',
  '$system',
])

export function CatalogNode({
  catalog,
  isExpanded,
  isAccessDenied,
  schemas,
  expandedSchemas,
  accessDeniedSchemas,
  tablesMap,
  showSystemSchemas,
  searchQuery,
  onExpand,
  onSchemaExpand,
  onTableClick,
  onTableDoubleClick,
  onColumnClick,
}: CatalogNodeProps) {
  // Filter system schemas
  const filteredSchemas = showSystemSchemas
    ? schemas
    : schemas.filter(s => !SYSTEM_SCHEMAS.has(s.toLowerCase()))

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
        <Database className="h-4 w-4 shrink-0" />
        <span className="truncate">{catalog}</span>
        {isAccessDenied && (
          <Lock className="h-3 w-3 shrink-0 text-muted-foreground ml-auto" />
        )}
      </div>

      {isExpanded && (
        <div className="pl-4">
          {filteredSchemas.length === 0 ? (
            <div className="text-xs text-muted-foreground px-2 py-1">
              No schemas
            </div>
          ) : (
            filteredSchemas.map(schema => (
              <SchemaNode
                key={schema}
                catalog={catalog}
                schema={schema}
                isExpanded={expandedSchemas.has(`${catalog}.${schema}`)}
                isAccessDenied={accessDeniedSchemas.has(`${catalog}.${schema}`)}
                tables={tablesMap.get(`${catalog}.${schema}`) || []}
                searchQuery={searchQuery}
                onExpand={() => onSchemaExpand(schema)}
                onTableClick={(table) => onTableClick(schema, table)}
                onTableDoubleClick={(table) => onTableDoubleClick(schema, table)}
                onColumnClick={(table, column) => onColumnClick(schema, table, column)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
