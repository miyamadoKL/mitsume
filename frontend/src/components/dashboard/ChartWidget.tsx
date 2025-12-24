import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import ReactECharts from 'echarts-for-react'
import type { Widget, QueryResult, ChartConfig } from '@/types'
import { queryApi } from '@/services/api'
import { replaceParameters, hasUnresolvedParameters } from '@/lib/params'
import {
  getColumnLinkConfig,
  resolveTableDrilldown,
  resolveChartDrilldown,
  resolveTextTemplate,
  type RowContext,
  type ChartClickData,
} from '@/lib/drilldown'
import { buildChartOptions } from '@/lib/chart-options'
import { MarkdownWidget } from './MarkdownWidget'
import { CounterWidget } from './CounterWidget'
import { PivotWidget } from './PivotWidget'
import { ErrorState, getErrorVariant } from '@/components/ui/error-state'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { BarChart3 } from 'lucide-react'

interface ChartWidgetProps {
  widget: Widget
  savedQueryText?: string
  parameterValues?: Record<string, string>
  refreshKey?: number  // Increment to trigger refresh
}

export const ChartWidget: React.FC<ChartWidgetProps> = ({
  widget,
  savedQueryText,
  parameterValues = {},
  refreshKey = 0,
}) => {
  const navigate = useNavigate()
  const [data, setData] = useState<QueryResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [isRetrying, setIsRetrying] = useState(false)
  const lastQueryRef = useRef<string | null>(null)

  const isMarkdown = widget.chart_type === 'markdown'
  const config = widget.chart_config as ChartConfig

  const loadData = useCallback(async (query: string) => {
    lastQueryRef.current = query
    setLoading(true)
    setError(null)
    try {
      const result = await queryApi.execute(query)
      setData(result)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleRetry = useCallback(async () => {
    if (!lastQueryRef.current) return
    setIsRetrying(true)
    try {
      await loadData(lastQueryRef.current)
    } finally {
      setIsRetrying(false)
    }
  }, [loadData])

  useEffect(() => {
    if (isMarkdown) return  // Markdown widget doesn't need data loading
    if (savedQueryText) {
      // Check if there are unresolved parameters
      if (hasUnresolvedParameters(savedQueryText, parameterValues)) {
        setData(null)
        setError(null)
        return
      }
      const resolvedQuery = replaceParameters(savedQueryText, parameterValues)
      loadData(resolvedQuery)
    }
  }, [savedQueryText, parameterValues, isMarkdown, refreshKey, loadData])

  // Render table cell with optional link
  const renderTableCell = useCallback((
    cell: unknown,
    columnIndex: number,
    row: unknown[],
    columns: string[]
  ) => {
    const columnName = columns[columnIndex]
    const linkConfig = getColumnLinkConfig(config.columnLinks, columnName)

    if (linkConfig) {
      const context: RowContext = { columns, row, currentColumnIndex: columnIndex }
      const url = resolveTableDrilldown(linkConfig, context)
      const displayText = linkConfig.textTemplate
        ? resolveTextTemplate(linkConfig.textTemplate, context)
        : String(cell ?? '')

      return (
        <Link
          to={url}
          className="text-primary hover:underline cursor-pointer"
        >
          {displayText}
        </Link>
      )
    }

    return String(cell ?? '')
  }, [config.columnLinks])

  // Handle chart click for drilldown
  const handleChartClick = useCallback((params: { name: string; value: unknown; seriesName?: string; dataIndex?: number }) => {
    const drilldownConfig = config.drilldown
    if (!drilldownConfig) return

    const clickData: ChartClickData = {
      name: params.name,
      value: params.value,
      seriesName: params.seriesName,
      dataIndex: params.dataIndex,
    }

    // Get corresponding row data if available
    const row = data?.rows[params.dataIndex ?? 0]

    const url = resolveChartDrilldown(
      drilldownConfig,
      clickData,
      data?.columns,
      row
    )

    navigate(url)
  }, [config.drilldown, data, navigate])

  // Build chart options using the centralized builder
  const chartOptions = useMemo(
    () => buildChartOptions(widget.chart_type, data, config),
    [widget.chart_type, data, config]
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingState size="lg" />
      </div>
    )
  }

  if (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load data'
    return (
      <div className="flex items-center justify-center h-full p-4">
        <ErrorState
          message={errorMessage}
          variant={getErrorVariant(error)}
          onRetry={handleRetry}
          isRetrying={isRetrying}
          compact
        />
      </div>
    )
  }

  if (!data) {
    const needsParams = savedQueryText && hasUnresolvedParameters(savedQueryText, parameterValues)
    return (
      <div className="flex items-center justify-center h-full">
        <EmptyState
          title={needsParams ? 'Parameters Required' : 'No Data'}
          description={needsParams ? 'Enter parameter values above to load data' : 'No data available for this widget'}
          icon={BarChart3}
          className="py-6"
        />
      </div>
    )
  }

  if (widget.chart_type === 'markdown') {
    return <MarkdownWidget content={widget.chart_config.content || ''} />
  }

  if (widget.chart_type === 'table') {
    return (
      <div className="h-full overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background border-b">
            <tr>
              {data.columns.map((col, i) => (
                <th key={i} className="px-2 py-1 text-left font-medium">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, i) => (
              <tr key={i} className="border-b">
                {row.map((cell, j) => (
                  <td key={j} className="px-2 py-1">
                    {renderTableCell(cell, j, row, data.columns)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (widget.chart_type === 'counter') {
    return <CounterWidget data={data} config={widget.chart_config} />
  }

  if (widget.chart_type === 'pivot') {
    return <PivotWidget data={data} config={widget.chart_config} />
  }

  // Add cursor pointer style if drilldown is configured
  const chartStyle: React.CSSProperties = {
    height: '100%',
    width: '100%',
    cursor: config.drilldown ? 'pointer' : 'default',
  }

  return (
    <ReactECharts
      option={chartOptions}
      style={chartStyle}
      opts={{ renderer: 'canvas' }}
      onEvents={config.drilldown ? { click: handleChartClick } : undefined}
    />
  )
}
