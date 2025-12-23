/**
 * Drilldown utilities for dashboard navigation
 */

import type { ColumnLinkConfig, ChartDrilldownConfig } from '@/types'

const TEXT_TEMPLATE_REGEX = /\{\{\s*([a-zA-Z_@][a-zA-Z0-9_]*)\s*\}\}/g

export interface RowContext {
  columns: string[]
  row: unknown[]
  currentColumnIndex: number
}

export interface ChartClickData {
  name: string      // X-axis value / category
  value: unknown    // Y-axis value
  seriesName?: string
  dataIndex?: number
}

/**
 * Build a dashboard URL with query parameters
 */
export function buildDashboardUrl(
  dashboardId: string,
  params: Record<string, string>
): string {
  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(`p_${key}`, value)
    }
  }
  const query = searchParams.toString()
  return `/dashboards/${dashboardId}${query ? `?${query}` : ''}`
}

/**
 * Resolve parameter mapping for table cell drilldown
 */
export function resolveTableDrilldown(
  config: ColumnLinkConfig,
  context: RowContext
): string {
  const params: Record<string, string> = {}

  for (const [paramName, source] of Object.entries(config.parameterMapping)) {
    if (source === '@') {
      // Current cell value
      params[paramName] = String(context.row[context.currentColumnIndex] ?? '')
    } else {
      // Column name reference
      const colIndex = context.columns.indexOf(source)
      if (colIndex >= 0) {
        params[paramName] = String(context.row[colIndex] ?? '')
      }
    }
  }

  return buildDashboardUrl(config.targetDashboardId, params)
}

/**
 * Resolve parameter mapping for chart drilldown
 */
export function resolveChartDrilldown(
  config: ChartDrilldownConfig,
  clickData: ChartClickData,
  columns?: string[],
  row?: unknown[]
): string {
  const params: Record<string, string> = {}

  for (const [paramName, source] of Object.entries(config.parameterMapping)) {
    if (source === 'name') {
      params[paramName] = String(clickData.name ?? '')
    } else if (source === 'value') {
      params[paramName] = String(clickData.value ?? '')
    } else if (source === 'series') {
      params[paramName] = String(clickData.seriesName ?? '')
    } else if (columns && row) {
      // Column name reference
      const colIndex = columns.indexOf(source)
      if (colIndex >= 0) {
        params[paramName] = String(row[colIndex] ?? '')
      }
    }
  }

  return buildDashboardUrl(config.targetDashboardId, params)
}

/**
 * Resolve text template for display
 * Supports {{ @ }} for current cell and {{ column_name }} for other columns
 */
export function resolveTextTemplate(
  template: string,
  context: RowContext
): string {
  return template.replace(TEXT_TEMPLATE_REGEX, (_match, placeholder) => {
    if (placeholder === '@') {
      return String(context.row[context.currentColumnIndex] ?? '')
    }

    const colIndex = context.columns.indexOf(placeholder)
    if (colIndex >= 0) {
      return String(context.row[colIndex] ?? '')
    }

    return `{{${placeholder}}}`
  })
}

/**
 * Get the link configuration for a specific column
 */
export function getColumnLinkConfig(
  columnLinks: ColumnLinkConfig[] | undefined,
  columnName: string
): ColumnLinkConfig | undefined {
  return columnLinks?.find(link => link.column === columnName)
}
