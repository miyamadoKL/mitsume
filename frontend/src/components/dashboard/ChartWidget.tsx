import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import ReactECharts from 'echarts-for-react'
import type { Widget, QueryResult, ChartConfig, WidgetDataResponse } from '@/types'
import { dashboardApi } from '@/services/api'
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
  dashboardId: string
  parameterValues?: Record<string, string>
  refreshKey?: number  // Increment to trigger refresh
  onParametersDiscovered?: (widgetId: string, requiredParams: string[], missingParams: string[]) => void
  onCrossFilter?: (parameterUpdates: Record<string, string>) => void
}

export const ChartWidget: React.FC<ChartWidgetProps> = ({
  widget,
  dashboardId,
  parameterValues = {},
  refreshKey = 0,
  onParametersDiscovered,
  onCrossFilter,
}) => {
  const navigate = useNavigate()
  const [data, setData] = useState<QueryResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [isRetrying, setIsRetrying] = useState(false)
  const [missingParams, setMissingParams] = useState<string[]>([])
  const lastParamsRef = useRef<Record<string, string> | null>(null)

  const isMarkdown = widget.chart_type === 'markdown'
  const hasQuery = !!widget.query_id
  const config = widget.chart_config as ChartConfig

  const loadData = useCallback(async (params: Record<string, string>) => {
    lastParamsRef.current = params
    setLoading(true)
    setError(null)
    setMissingParams([])
    try {
      const response: WidgetDataResponse = await dashboardApi.getWidgetData(
        dashboardId,
        widget.id,
        params
      )

      // Report discovered parameters to parent
      if (onParametersDiscovered) {
        onParametersDiscovered(
          widget.id,
          response.required_parameters || [],
          response.missing_parameters || []
        )
      }

      if (response.error) {
        setError(new Error(response.error))
        setData(null)
      } else if (response.missing_parameters && response.missing_parameters.length > 0) {
        // Server indicates missing parameters
        setMissingParams(response.missing_parameters)
        setData(null)
      } else {
        setData(response.query_result || null)
      }
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [dashboardId, widget.id, onParametersDiscovered])

  const handleRetry = useCallback(async () => {
    if (!lastParamsRef.current) return
    setIsRetrying(true)
    try {
      await loadData(lastParamsRef.current)
    } finally {
      setIsRetrying(false)
    }
  }, [loadData])

  useEffect(() => {
    if (isMarkdown) return  // Markdown widget doesn't need data loading
    if (!hasQuery) return   // No query associated with widget

    loadData(parameterValues)
  }, [parameterValues, isMarkdown, hasQuery, refreshKey, loadData])

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

  // Handle chart click for drilldown or cross-filter
  const handleChartClick = useCallback((params: { name: string; value: unknown; seriesName?: string; dataIndex?: number }) => {
    const clickData: ChartClickData = {
      name: params.name,
      value: params.value,
      seriesName: params.seriesName,
      dataIndex: params.dataIndex,
    }

    // Get corresponding row data if available
    const row = data?.rows[params.dataIndex ?? 0]

    // Drilldown takes priority over cross-filter
    const drilldownConfig = config.drilldown
    if (drilldownConfig) {
      const url = resolveChartDrilldown(
        drilldownConfig,
        clickData,
        data?.columns,
        row
      )
      navigate(url)
      return
    }

    // Cross-filter: update parameters on the same dashboard
    const crossFilterConfig = config.crossFilter
    if (crossFilterConfig?.enabled && onCrossFilter) {
      const parameterUpdates: Record<string, string> = {}

      for (const [paramName, source] of Object.entries(crossFilterConfig.parameterMapping)) {
        let value: string | undefined

        switch (source) {
          case 'name':
            value = clickData.name
            break
          case 'value':
            value = String(clickData.value ?? '')
            break
          case 'series':
            value = clickData.seriesName
            break
          default:
            // Column name: get value from row data
            if (data?.columns && row) {
              const colIndex = data.columns.indexOf(source)
              if (colIndex >= 0 && row[colIndex] !== undefined) {
                value = String(row[colIndex])
              }
            }
        }

        if (value !== undefined) {
          parameterUpdates[paramName] = value
        }
      }

      if (Object.keys(parameterUpdates).length > 0) {
        onCrossFilter(parameterUpdates)
      }
    }
  }, [config.drilldown, config.crossFilter, data, navigate, onCrossFilter])

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
    const needsParams = missingParams.length > 0
    return (
      <div className="flex items-center justify-center h-full">
        <EmptyState
          title={needsParams ? 'Parameters Required' : 'No Data'}
          description={needsParams ? `Enter values for: ${missingParams.join(', ')}` : 'No data available for this widget'}
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

  // Add cursor pointer style if drilldown or cross-filter is configured
  const hasClickHandler = config.drilldown || config.crossFilter?.enabled
  const chartStyle: React.CSSProperties = {
    height: '100%',
    width: '100%',
    cursor: hasClickHandler ? 'pointer' : 'default',
  }

  return (
    <ReactECharts
      option={chartOptions}
      style={chartStyle}
      opts={{ renderer: 'canvas' }}
      onEvents={hasClickHandler ? { click: handleChartClick } : undefined}
    />
  )
}
