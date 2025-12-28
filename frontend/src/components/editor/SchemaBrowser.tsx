import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { catalogApi } from '@/services/api'
import { CatalogNode } from './CatalogNode'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, RefreshCw, Eye, EyeOff, Loader2, X } from 'lucide-react'
import { buildFullyQualifiedName, quoteIdentifier } from '@/lib/sql-utils'
import { useDebounce } from '@/hooks/useDebounce'

interface SchemaBrowserProps {
  onInsert: (text: string) => void
}

export function SchemaBrowser({ onInsert }: SchemaBrowserProps) {
  const { t } = useTranslation()

  // Data state
  const [catalogs, setCatalogs] = useState<string[]>([])
  const [expandedCatalogs, setExpandedCatalogs] = useState<Set<string>>(new Set())
  const [schemasMap, setSchemasMap] = useState<Map<string, string[]>>(new Map())
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set())
  const [tablesMap, setTablesMap] = useState<Map<string, string[]>>(new Map())
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebounce(searchQuery, 200)
  const [showSystemSchemas, setShowSystemSchemas] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Initial load
  useEffect(() => {
    loadCatalogs()
  }, [])

  const loadCatalogs = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await catalogApi.getCatalogs()
      setCatalogs(data)
    } catch {
      setError(t('editor.schemaBrowser.error', 'Failed to load catalogs'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefresh = () => {
    // Clear cache
    setSchemasMap(new Map())
    setTablesMap(new Map())
    loadCatalogs()
  }

  // Catalog expand
  const handleCatalogExpand = async (catalog: string) => {
    if (expandedCatalogs.has(catalog)) {
      setExpandedCatalogs(prev => {
        const next = new Set(prev)
        next.delete(catalog)
        return next
      })
      return
    }

    setExpandedCatalogs(prev => new Set(prev).add(catalog))

    if (!schemasMap.has(catalog)) {
      try {
        const schemas = await catalogApi.getSchemas(catalog)
        setSchemasMap(prev => new Map(prev).set(catalog, schemas))
      } catch {
        // Error handling
      }
    }
  }

  // Schema expand
  const handleSchemaExpand = async (catalog: string, schema: string) => {
    const key = `${catalog}.${schema}`

    if (expandedSchemas.has(key)) {
      setExpandedSchemas(prev => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
      return
    }

    setExpandedSchemas(prev => new Set(prev).add(key))

    if (!tablesMap.has(key)) {
      try {
        const tables = await catalogApi.getTables(catalog, schema)
        setTablesMap(prev => new Map(prev).set(key, tables))
      } catch {
        // Error handling
      }
    }
  }

  // Table click
  const handleTableClick = (catalog: string, schema: string, table: string) => {
    const fullName = buildFullyQualifiedName(catalog, schema, table)
    onInsert(fullName)
  }

  // Column click
  const handleColumnClick = (column: string) => {
    const quotedColumn = quoteIdentifier(column)
    onInsert(quotedColumn)
  }

  return (
    <div className="w-full flex flex-col h-full">
      {/* Toolbar */}
      <div className="p-2 border-b flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('editor.schemaBrowser.searchPlaceholder', 'Search tables...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-8 h-9"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          title={t('editor.schemaBrowser.refresh', 'Refresh')}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowSystemSchemas(!showSystemSchemas)}
          title={showSystemSchemas
            ? t('editor.schemaBrowser.hideSystemSchemas', 'Hide system schemas')
            : t('editor.schemaBrowser.showSystemSchemas', 'Show system schemas')}
        >
          {showSystemSchemas ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-4">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="link" onClick={loadCatalogs}>
              {t('editor.schemaBrowser.retry', 'Retry')}
            </Button>
          </div>
        ) : catalogs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t('editor.schemaBrowser.noCatalogs', 'No catalogs available')}
          </p>
        ) : (
          catalogs.map(catalog => (
            <CatalogNode
              key={catalog}
              catalog={catalog}
              isExpanded={expandedCatalogs.has(catalog)}
              schemas={schemasMap.get(catalog) || []}
              expandedSchemas={expandedSchemas}
              tablesMap={tablesMap}
              showSystemSchemas={showSystemSchemas}
              searchQuery={debouncedSearch}
              onExpand={() => handleCatalogExpand(catalog)}
              onSchemaExpand={(schema) => handleSchemaExpand(catalog, schema)}
              onTableClick={(schema, table) => handleTableClick(catalog, schema, table)}
              onColumnClick={(_, __, column) => handleColumnClick(column)}
            />
          ))
        )}
      </div>
    </div>
  )
}
