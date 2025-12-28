import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { AxiosError } from 'axios'
import { catalogApi } from '@/services/api'
import { VirtualizedTree, FlatNode } from './VirtualizedTree'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, RefreshCw, Eye, EyeOff, Loader2, X, Globe } from 'lucide-react'
import { buildFullyQualifiedName, quoteIdentifier } from '@/lib/sql-utils'
import { useDebounce } from '@/hooks/useDebounce'
import { toast } from '@/stores/toastStore'
import { getErrorMessage } from '@/lib/errors'
import type { ColumnInfo, MetadataSearchResult } from '@/types'

// Helper to check if error is 403
const isAccessDenied = (err: unknown): boolean => {
  if (err instanceof AxiosError) {
    return err.response?.status === 403
  }
  return false
}

// Storage keys
const STORAGE_KEYS = {
  EXPANDED_CATALOGS: 'mitsume-schema-browser-expanded-catalogs',
  EXPANDED_SCHEMAS: 'mitsume-schema-browser-expanded-schemas',
  EXPANDED_TABLES: 'mitsume-schema-browser-expanded-tables',
  SHOW_SYSTEM_SCHEMAS: 'mitsume-schema-browser-show-system-schemas',
}

// System schemas to filter
const SYSTEM_SCHEMAS = new Set([
  'information_schema',
  'sys',
  'pg_catalog',
  '$system',
])

// Helper to load Set from localStorage
const loadSetFromStorage = (key: string): Set<string> => {
  try {
    const stored = localStorage.getItem(key)
    if (stored) {
      return new Set(JSON.parse(stored))
    }
  } catch {
    // Ignore parse errors
  }
  return new Set()
}

// Helper to save Set to localStorage
const saveSetToStorage = (key: string, set: Set<string>) => {
  localStorage.setItem(key, JSON.stringify([...set]))
}

interface SchemaBrowserProps {
  onInsert: (text: string) => void
}

export function SchemaBrowser({ onInsert }: SchemaBrowserProps) {
  const { t } = useTranslation()

  // Data state - load from localStorage
  const [catalogs, setCatalogs] = useState<string[]>([])
  const [expandedCatalogs, setExpandedCatalogs] = useState<Set<string>>(() =>
    loadSetFromStorage(STORAGE_KEYS.EXPANDED_CATALOGS)
  )
  const [schemasMap, setSchemasMap] = useState<Map<string, string[]>>(new Map())
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(() =>
    loadSetFromStorage(STORAGE_KEYS.EXPANDED_SCHEMAS)
  )
  const [tablesMap, setTablesMap] = useState<Map<string, string[]>>(new Map())
  const [expandedTables, setExpandedTables] = useState<Set<string>>(() =>
    loadSetFromStorage(STORAGE_KEYS.EXPANDED_TABLES)
  )
  const [columnsMap, setColumnsMap] = useState<Map<string, ColumnInfo[]>>(new Map())
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebounce(searchQuery, 300)
  const [useServerSearch, setUseServerSearch] = useState(false)
  const [serverSearchResults, setServerSearchResults] = useState<MetadataSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showSystemSchemas, setShowSystemSchemas] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.SHOW_SYSTEM_SCHEMAS)
    return stored === 'true'
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Track access denied items (403 errors)
  const [accessDeniedCatalogs, setAccessDeniedCatalogs] = useState<Set<string>>(new Set())
  const [accessDeniedSchemas, setAccessDeniedSchemas] = useState<Set<string>>(new Set())

  // Track loading states
  const [loadingNodes, setLoadingNodes] = useState<Set<string>>(new Set())

  // Save expanded catalogs to localStorage
  useEffect(() => {
    saveSetToStorage(STORAGE_KEYS.EXPANDED_CATALOGS, expandedCatalogs)
  }, [expandedCatalogs])

  // Save expanded schemas to localStorage
  useEffect(() => {
    saveSetToStorage(STORAGE_KEYS.EXPANDED_SCHEMAS, expandedSchemas)
  }, [expandedSchemas])

  // Save expanded tables to localStorage
  useEffect(() => {
    saveSetToStorage(STORAGE_KEYS.EXPANDED_TABLES, expandedTables)
  }, [expandedTables])

  // Save showSystemSchemas to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SHOW_SYSTEM_SCHEMAS, String(showSystemSchemas))
  }, [showSystemSchemas])

  // Server-side search effect
  useEffect(() => {
    if (!useServerSearch || !debouncedSearch || debouncedSearch.length < 2) {
      setServerSearchResults([])
      return
    }

    let cancelled = false
    const search = async () => {
      setIsSearching(true)
      try {
        const results = await catalogApi.searchMetadata(debouncedSearch, 'all', 50)
        if (!cancelled) {
          setServerSearchResults(results)
        }
      } catch (err) {
        console.error('Search metadata failed:', err)
        if (!cancelled) {
          setServerSearchResults([])
        }
      } finally {
        if (!cancelled) {
          setIsSearching(false)
        }
      }
    }

    search()
    return () => {
      cancelled = true
    }
  }, [debouncedSearch, useServerSearch])

  // Flatten tree into FlatNode array for virtualization
  const flatNodes = useMemo(() => {
    const result: FlatNode[] = []
    const searchLower = debouncedSearch.toLowerCase()

    // Server-side search mode: show flat list of results
    if (useServerSearch && debouncedSearch.length >= 2 && serverSearchResults.length > 0) {
      for (const sr of serverSearchResults) {
        if (sr.type === 'table') {
          const tableId = `${sr.catalog}.${sr.schema}.${sr.table}`
          result.push({
            id: tableId,
            type: 'table',
            depth: 0,
            name: `${sr.catalog}.${sr.schema}.${sr.table}`,
            isExpanded: false,
            isLoading: false,
            isAccessDenied: false,
            hasChildren: false,
            parentId: null,
            matchesSearch: true,
          })
        } else if (sr.type === 'column' && sr.column) {
          const columnId = `${sr.catalog}.${sr.schema}.${sr.table}.${sr.column}`
          result.push({
            id: columnId,
            type: 'column',
            depth: 0,
            name: `${sr.catalog}.${sr.schema}.${sr.table}.${sr.column}`,
            isExpanded: false,
            isLoading: false,
            isAccessDenied: false,
            hasChildren: false,
            parentId: null,
            matchesSearch: true,
          })
        }
      }
      return result
    }

    for (const catalog of catalogs) {
      const catalogId = catalog
      const schemas = schemasMap.get(catalog) || []
      const filteredSchemas = showSystemSchemas
        ? schemas
        : schemas.filter(s => !SYSTEM_SCHEMAS.has(s.toLowerCase()))

      result.push({
        id: catalogId,
        type: 'catalog',
        depth: 0,
        name: catalog,
        isExpanded: expandedCatalogs.has(catalogId),
        isLoading: loadingNodes.has(catalogId),
        isAccessDenied: accessDeniedCatalogs.has(catalogId),
        hasChildren: true,
        parentId: null,
      })

      if (!expandedCatalogs.has(catalogId)) continue

      // Show placeholder if catalog is expanded but loading or has no schemas
      if (loadingNodes.has(catalogId)) {
        result.push({
          id: `${catalogId}.__loading__`,
          type: 'placeholder',
          depth: 1,
          name: t('editor.schemaBrowser.loadingColumns', 'Loading...'),
          isExpanded: false,
          isLoading: true,
          isAccessDenied: false,
          hasChildren: false,
          parentId: catalogId,
        })
      } else if (filteredSchemas.length === 0 && schemasMap.has(catalogId)) {
        result.push({
          id: `${catalogId}.__empty__`,
          type: 'placeholder',
          depth: 1,
          name: t('editor.schemaBrowser.noSchemas', 'No schemas'),
          isExpanded: false,
          isLoading: false,
          isAccessDenied: false,
          hasChildren: false,
          parentId: catalogId,
        })
      }

      for (const schema of filteredSchemas) {
        const schemaId = `${catalog}.${schema}`
        const tables = tablesMap.get(schemaId) || []

        result.push({
          id: schemaId,
          type: 'schema',
          depth: 1,
          name: schema,
          isExpanded: expandedSchemas.has(schemaId),
          isLoading: loadingNodes.has(schemaId),
          isAccessDenied: accessDeniedSchemas.has(schemaId),
          hasChildren: true,
          parentId: catalogId,
        })

        if (!expandedSchemas.has(schemaId)) continue

        // Filter tables by search query (local filtering when not using server search)
        const filteredTables = (!useServerSearch && debouncedSearch)
          ? tables.filter(t => t.toLowerCase().includes(searchLower))
          : tables

        // Show placeholder if schema is expanded but loading or has no tables
        if (loadingNodes.has(schemaId)) {
          result.push({
            id: `${schemaId}.__loading__`,
            type: 'placeholder',
            depth: 2,
            name: t('editor.schemaBrowser.loadingColumns', 'Loading...'),
            isExpanded: false,
            isLoading: true,
            isAccessDenied: false,
            hasChildren: false,
            parentId: schemaId,
          })
        } else if (filteredTables.length === 0 && tablesMap.has(schemaId)) {
          result.push({
            id: `${schemaId}.__empty__`,
            type: 'placeholder',
            depth: 2,
            name: t('editor.schemaBrowser.noTables', 'No tables'),
            isExpanded: false,
            isLoading: false,
            isAccessDenied: false,
            hasChildren: false,
            parentId: schemaId,
          })
        }

        for (const table of filteredTables) {
          const tableId = `${catalog}.${schema}.${table}`
          const columns = columnsMap.get(tableId) || []

          result.push({
            id: tableId,
            type: 'table',
            depth: 2,
            name: table,
            isExpanded: expandedTables.has(tableId),
            isLoading: loadingNodes.has(tableId),
            isAccessDenied: false,
            hasChildren: true,
            parentId: schemaId,
            matchesSearch: debouncedSearch ? table.toLowerCase().includes(searchLower) : undefined,
          })

          if (!expandedTables.has(tableId)) continue

          // Show placeholder if table is expanded but loading or has no columns
          if (loadingNodes.has(tableId)) {
            result.push({
              id: `${tableId}.__loading__`,
              type: 'placeholder',
              depth: 3,
              name: t('editor.schemaBrowser.loadingColumns', 'Loading columns...'),
              isExpanded: false,
              isLoading: true,
              isAccessDenied: false,
              hasChildren: false,
              parentId: tableId,
            })
          } else if (columns.length === 0 && columnsMap.has(tableId)) {
            result.push({
              id: `${tableId}.__empty__`,
              type: 'placeholder',
              depth: 3,
              name: t('editor.schemaBrowser.noColumns', 'No columns'),
              isExpanded: false,
              isLoading: false,
              isAccessDenied: false,
              hasChildren: false,
              parentId: tableId,
            })
          }

          for (const col of columns) {
            result.push({
              id: `${tableId}.${col.name}`,
              type: 'column',
              depth: 3,
              name: col.name,
              isExpanded: false,
              isLoading: false,
              isAccessDenied: false,
              hasChildren: false,
              parentId: tableId,
              columnInfo: {
                type: col.type,
                nullable: col.nullable,
                comment: col.comment ?? null,
              },
            })
          }
        }
      }
    }

    return result
  }, [
    catalogs,
    schemasMap,
    tablesMap,
    columnsMap,
    expandedCatalogs,
    expandedSchemas,
    expandedTables,
    loadingNodes,
    accessDeniedCatalogs,
    accessDeniedSchemas,
    showSystemSchemas,
    debouncedSearch,
    useServerSearch,
    serverSearchResults,
  ])

  // Initial load
  useEffect(() => {
    loadCatalogs()
  }, [])

  const loadCatalogs = useCallback(async (
    catalogsToRestore: Set<string> = expandedCatalogs,
    schemasToRestore: Set<string> = expandedSchemas
  ) => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await catalogApi.getCatalogs()
      setCatalogs(data)

      // Restore previously expanded catalogs by loading their schemas
      const restoredCatalogs = new Set<string>()
      for (const catalog of catalogsToRestore) {
        if (data.includes(catalog) && !schemasMap.has(catalog)) {
          try {
            const schemas = await catalogApi.getSchemas(catalog)
            setSchemasMap(prev => new Map(prev).set(catalog, schemas))
            restoredCatalogs.add(catalog)
          } catch (err) {
            if (isAccessDenied(err)) {
              setAccessDeniedCatalogs(prev => new Set(prev).add(catalog))
            } else {
              console.error(`Failed to restore schemas for catalog: ${catalog}`, err)
              toast.error('Schema Browser', getErrorMessage(err))
            }
          }
        }
      }

      // Restore previously expanded schemas by loading their tables
      for (const key of schemasToRestore) {
        const [catalog, schema] = key.split('.')
        if (restoredCatalogs.has(catalog) || schemasMap.has(catalog)) {
          if (!tablesMap.has(key)) {
            try {
              const tables = await catalogApi.getTables(catalog, schema)
              setTablesMap(prev => new Map(prev).set(key, tables))
            } catch (err) {
              if (isAccessDenied(err)) {
                setAccessDeniedSchemas(prev => new Set(prev).add(key))
              } else {
                console.error(`Failed to restore tables for schema: ${key}`, err)
                toast.error('Schema Browser', getErrorMessage(err))
              }
            }
          }
        }
      }
    } catch {
      setError(t('editor.schemaBrowser.error', 'Failed to load catalogs'))
    } finally {
      setIsLoading(false)
    }
  }, [expandedCatalogs, expandedSchemas, schemasMap, tablesMap, t])

  const handleRefresh = useCallback(() => {
    // Clear cache and expansion state
    setSchemasMap(new Map())
    setTablesMap(new Map())
    setColumnsMap(new Map())
    setExpandedCatalogs(new Set())
    setExpandedSchemas(new Set())
    setExpandedTables(new Set())
    setAccessDeniedCatalogs(new Set())
    setAccessDeniedSchemas(new Set())
    // Pass empty sets to avoid restoring old expansion state
    loadCatalogs(new Set(), new Set())
  }, [loadCatalogs])

  // Handle node expand/collapse
  const handleNodeExpand = useCallback(async (node: FlatNode) => {
    const nodeId = node.id

    // Don't expand if access denied
    if (node.isAccessDenied) return

    if (node.type === 'catalog') {
      if (expandedCatalogs.has(nodeId)) {
        setExpandedCatalogs(prev => {
          const next = new Set(prev)
          next.delete(nodeId)
          return next
        })
        return
      }

      setExpandedCatalogs(prev => new Set(prev).add(nodeId))

      if (!schemasMap.has(nodeId)) {
        setLoadingNodes(prev => new Set(prev).add(nodeId))
        try {
          const schemas = await catalogApi.getSchemas(nodeId)
          setSchemasMap(prev => new Map(prev).set(nodeId, schemas))
        } catch (err) {
          if (isAccessDenied(err)) {
            setAccessDeniedCatalogs(prev => new Set(prev).add(nodeId))
            setExpandedCatalogs(prev => {
              const next = new Set(prev)
              next.delete(nodeId)
              return next
            })
          } else {
            console.error(`Failed to load schemas for catalog: ${nodeId}`, err)
            toast.error('Schema Browser', getErrorMessage(err))
          }
        } finally {
          setLoadingNodes(prev => {
            const next = new Set(prev)
            next.delete(nodeId)
            return next
          })
        }
      }
    } else if (node.type === 'schema') {
      if (expandedSchemas.has(nodeId)) {
        setExpandedSchemas(prev => {
          const next = new Set(prev)
          next.delete(nodeId)
          return next
        })
        return
      }

      setExpandedSchemas(prev => new Set(prev).add(nodeId))

      if (!tablesMap.has(nodeId)) {
        setLoadingNodes(prev => new Set(prev).add(nodeId))
        try {
          const [catalog, schema] = nodeId.split('.')
          const tables = await catalogApi.getTables(catalog, schema)
          setTablesMap(prev => new Map(prev).set(nodeId, tables))
        } catch (err) {
          if (isAccessDenied(err)) {
            setAccessDeniedSchemas(prev => new Set(prev).add(nodeId))
            setExpandedSchemas(prev => {
              const next = new Set(prev)
              next.delete(nodeId)
              return next
            })
          } else {
            console.error(`Failed to load tables for schema: ${nodeId}`, err)
            toast.error('Schema Browser', getErrorMessage(err))
          }
        } finally {
          setLoadingNodes(prev => {
            const next = new Set(prev)
            next.delete(nodeId)
            return next
          })
        }
      }
    } else if (node.type === 'table') {
      if (expandedTables.has(nodeId)) {
        setExpandedTables(prev => {
          const next = new Set(prev)
          next.delete(nodeId)
          return next
        })
        return
      }

      setExpandedTables(prev => new Set(prev).add(nodeId))

      if (!columnsMap.has(nodeId)) {
        setLoadingNodes(prev => new Set(prev).add(nodeId))
        try {
          const [catalog, schema, table] = nodeId.split('.')
          const columns = await catalogApi.getColumns(catalog, schema, table)
          setColumnsMap(prev => new Map(prev).set(nodeId, columns))
        } catch (err) {
          console.error(`Failed to load columns for table: ${nodeId}`, err)
          toast.error('Schema Browser', getErrorMessage(err))
        } finally {
          setLoadingNodes(prev => {
            const next = new Set(prev)
            next.delete(nodeId)
            return next
          })
        }
      }
    }
  }, [expandedCatalogs, expandedSchemas, expandedTables, schemasMap, tablesMap, columnsMap])

  // Handle node click - insert name
  const handleNodeClick = useCallback((node: FlatNode) => {
    // Server search mode shows full paths in name, use id for proper parsing
    const parts = node.id.split('.')

    if (node.type === 'table') {
      const [catalog, schema, table] = parts
      const fullName = buildFullyQualifiedName(catalog, schema, table)
      onInsert(fullName)
    } else if (node.type === 'column') {
      // In server search mode, column id is catalog.schema.table.column
      // Extract just the column name
      const columnName = parts[parts.length - 1]
      const quotedColumn = quoteIdentifier(columnName)
      onInsert(quotedColumn)
    } else if (node.type === 'catalog' || node.type === 'schema') {
      const quotedName = parts.map(p => quoteIdentifier(p)).join('.')
      onInsert(quotedName)
    }
  }, [onInsert])

  // Handle node double click - insert SELECT statement for tables
  const handleNodeDoubleClick = useCallback((node: FlatNode) => {
    if (node.type === 'table') {
      const [catalog, schema, table] = node.id.split('.')
      const fullName = buildFullyQualifiedName(catalog, schema, table)
      onInsert(`SELECT * FROM ${fullName} LIMIT 100`)
    }
  }, [onInsert])

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
        <Button
          variant={useServerSearch ? 'secondary' : 'ghost'}
          size="icon"
          onClick={() => setUseServerSearch(!useServerSearch)}
          title={useServerSearch
            ? t('editor.schemaBrowser.useLocalSearch', 'Switch to local search')
            : t('editor.schemaBrowser.useServerSearch', 'Switch to cross-catalog search')}
        >
          <Globe className="h-4 w-4" />
        </Button>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-4">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="link" onClick={() => loadCatalogs()}>
              {t('editor.schemaBrowser.retry', 'Retry')}
            </Button>
          </div>
        ) : isSearching ? (
          <div className="flex items-center justify-center py-4 gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">
              {t('editor.schemaBrowser.searching', 'Searching...')}
            </span>
          </div>
        ) : useServerSearch && debouncedSearch.length >= 2 && serverSearchResults.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t('editor.schemaBrowser.noSearchResults', 'No results found')}
          </p>
        ) : catalogs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t('editor.schemaBrowser.noCatalogs', 'No catalogs available')}
          </p>
        ) : (
          <VirtualizedTree
            nodes={flatNodes}
            searchQuery={debouncedSearch}
            onNodeExpand={handleNodeExpand}
            onNodeClick={handleNodeClick}
            onNodeDoubleClick={handleNodeDoubleClick}
            emptyMessage={t('editor.schemaBrowser.noSearchResults', 'No results found')}
          />
        )}
      </div>
    </div>
  )
}
