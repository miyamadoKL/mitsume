import type { QueryResult, ChartConfig } from '@/types'
import type { AxisConfig } from '../types'

/**
 * Parse axis configuration from data and config
 */
export function parseAxisConfig(data: QueryResult, config: ChartConfig): AxisConfig {
  const xAxisColumn = config.xAxis || data.columns[0]
  const xAxisIndex = data.columns.indexOf(xAxisColumn)

  const yAxisColumn = config.yAxis || data.columns[1]
  const yAxisIndices = Array.isArray(yAxisColumn)
    ? yAxisColumn.map(col => data.columns.indexOf(col))
    : [data.columns.indexOf(yAxisColumn)]

  const yAxisColumns = yAxisIndices.map(idx => data.columns[idx])
  const xData = data.rows.map(row => row[xAxisIndex])

  // Detect if x-axis data looks like timestamps
  const isTimeAxis = detectTimeAxis(xData)

  return {
    xAxisIndex,
    xAxisColumn,
    yAxisIndices,
    yAxisColumns,
    xData,
    isTimeAxis,
  }
}

/**
 * Detect if data appears to be time-based
 */
function detectTimeAxis(data: unknown[]): boolean {
  if (data.length === 0) return false

  const sample = data[0]
  if (typeof sample === 'string') {
    // Check if it looks like a date string
    const datePattern = /^\d{4}-\d{2}-\d{2}|^\d{2}\/\d{2}\/\d{4}/
    return datePattern.test(sample)
  }
  if (sample instanceof Date) {
    return true
  }
  return false
}

/**
 * Extract series data from query result
 */
export function extractSeriesData(
  data: QueryResult,
  axisConfig: AxisConfig
): { name: string; values: unknown[] }[] {
  return axisConfig.yAxisIndices.map((yIdx, i) => ({
    name: axisConfig.yAxisColumns[i],
    values: data.rows.map(row => row[yIdx]),
  }))
}

/**
 * Format value for display
 */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'number') {
    return value.toLocaleString()
  }
  return String(value)
}
