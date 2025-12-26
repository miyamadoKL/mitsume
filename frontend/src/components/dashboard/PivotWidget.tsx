import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { QueryResult, ChartConfig } from '@/types'

interface PivotWidgetProps {
  data: QueryResult
  config: ChartConfig
}

type AggregationType = 'sum' | 'count' | 'avg' | 'min' | 'max'

function aggregate(values: number[], type: AggregationType): number {
  if (values.length === 0) return 0

  switch (type) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0)
    case 'count':
      return values.length
    case 'avg':
      return values.reduce((a, b) => a + b, 0) / values.length
    case 'min':
      return Math.min(...values)
    case 'max':
      return Math.max(...values)
    default:
      return values.reduce((a, b) => a + b, 0)
  }
}

function formatValue(value: number, aggregation: AggregationType): string {
  if (aggregation === 'count') {
    return value.toLocaleString()
  }
  if (Number.isInteger(value)) {
    return value.toLocaleString()
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export const PivotWidget: React.FC<PivotWidgetProps> = ({ data, config }) => {
  const { t } = useTranslation()

  const pivotData = useMemo(() => {
    const rowGroupIdx = config.rowGroupColumn
      ? data.columns.indexOf(config.rowGroupColumn)
      : 0
    const colGroupIdx = config.colGroupColumn
      ? data.columns.indexOf(config.colGroupColumn)
      : 1
    const valueIdx = config.valueAggColumn
      ? data.columns.indexOf(config.valueAggColumn)
      : 2
    const aggregation = config.aggregation || 'sum'

    // Collect unique row and column values
    const rowValues = new Set<string>()
    const colValues = new Set<string>()
    const cellData: Record<string, Record<string, number[]>> = {}

    for (const row of data.rows) {
      const rowKey = String(row[rowGroupIdx] ?? '')
      const colKey = String(row[colGroupIdx] ?? '')
      const value = Number(row[valueIdx]) || 0

      rowValues.add(rowKey)
      colValues.add(colKey)

      if (!cellData[rowKey]) cellData[rowKey] = {}
      if (!cellData[rowKey][colKey]) cellData[rowKey][colKey] = []
      cellData[rowKey][colKey].push(value)
    }

    const rows = Array.from(rowValues).sort()
    const cols = Array.from(colValues).sort()

    // Calculate aggregated values
    const aggregatedData: Record<string, Record<string, number>> = {}
    const rowTotals: Record<string, number[]> = {}
    const colTotals: Record<string, number[]> = {}
    const grandTotal: number[] = []

    for (const rowKey of rows) {
      aggregatedData[rowKey] = {}
      rowTotals[rowKey] = []
      for (const colKey of cols) {
        const values = cellData[rowKey]?.[colKey] || []
        const aggValue = values.length > 0 ? aggregate(values, aggregation) : 0
        aggregatedData[rowKey][colKey] = aggValue

        // Collect for totals
        if (values.length > 0) {
          rowTotals[rowKey].push(...values)
          if (!colTotals[colKey]) colTotals[colKey] = []
          colTotals[colKey].push(...values)
          grandTotal.push(...values)
        }
      }
    }

    return {
      rows,
      cols,
      aggregatedData,
      rowTotals,
      colTotals,
      grandTotal,
      aggregation,
      rowGroupLabel: config.rowGroupColumn || data.columns[rowGroupIdx] || t('common.row'),
      colGroupLabel: config.colGroupColumn || data.columns[colGroupIdx] || t('common.column'),
    }
  }, [data, config, t])

  if (pivotData.rows.length === 0 || pivotData.cols.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        {t('dashboard.pivot.noData')}
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto">
      <table className="w-full text-sm border-collapse">
        <thead className="sticky top-0 bg-background">
          <tr className="border-b">
            <th className="px-2 py-1 text-left font-medium bg-muted">
              {pivotData.rowGroupLabel} / {pivotData.colGroupLabel}
            </th>
            {pivotData.cols.map(col => (
              <th key={col} className="px-2 py-1 text-right font-medium bg-muted">
                {col}
              </th>
            ))}
            <th className="px-2 py-1 text-right font-medium bg-muted/80">
              {t('common.total')}
            </th>
          </tr>
        </thead>
        <tbody>
          {pivotData.rows.map(row => (
            <tr key={row} className="border-b hover:bg-muted/50">
              <td className="px-2 py-1 font-medium">{row}</td>
              {pivotData.cols.map(col => (
                <td key={col} className="px-2 py-1 text-right tabular-nums">
                  {formatValue(pivotData.aggregatedData[row][col], pivotData.aggregation)}
                </td>
              ))}
              <td className="px-2 py-1 text-right font-medium tabular-nums bg-muted/30">
                {formatValue(
                  aggregate(pivotData.rowTotals[row], pivotData.aggregation),
                  pivotData.aggregation
                )}
              </td>
            </tr>
          ))}
          <tr className="border-t-2 bg-muted/30">
            <td className="px-2 py-1 font-medium">{t('common.total')}</td>
            {pivotData.cols.map(col => (
              <td key={col} className="px-2 py-1 text-right font-medium tabular-nums">
                {formatValue(
                  aggregate(pivotData.colTotals[col] || [], pivotData.aggregation),
                  pivotData.aggregation
                )}
              </td>
            ))}
            <td className="px-2 py-1 text-right font-bold tabular-nums">
              {formatValue(
                aggregate(pivotData.grandTotal, pivotData.aggregation),
                pivotData.aggregation
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
