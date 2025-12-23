import React from 'react'
import type { QueryResult, ChartConfig } from '@/types'

interface CounterWidgetProps {
  data: QueryResult
  config: ChartConfig
}

function formatNumber(value: unknown): string {
  if (value === null || value === undefined) return '-'
  const num = Number(value)
  if (isNaN(num)) return String(value)

  // Format large numbers with K, M, B suffixes
  if (Math.abs(num) >= 1e9) {
    return (num / 1e9).toFixed(1) + 'B'
  }
  if (Math.abs(num) >= 1e6) {
    return (num / 1e6).toFixed(1) + 'M'
  }
  if (Math.abs(num) >= 1e3) {
    return (num / 1e3).toFixed(1) + 'K'
  }

  // Format with appropriate decimal places
  if (Number.isInteger(num)) {
    return num.toLocaleString()
  }
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export const CounterWidget: React.FC<CounterWidgetProps> = ({ data, config }) => {
  // Get the value from the first row
  const valueColumnIndex = config.valueColumn
    ? data.columns.indexOf(config.valueColumn)
    : 0

  const value = data.rows.length > 0 && valueColumnIndex >= 0
    ? data.rows[0][valueColumnIndex]
    : null

  const formattedValue = formatNumber(value)
  const prefix = config.counterPrefix || ''
  const suffix = config.counterSuffix || ''
  const label = config.counterLabel || (config.valueColumn ? config.valueColumn : data.columns[0])

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="text-4xl font-bold text-foreground">
        {prefix}{formattedValue}{suffix}
      </div>
      {label && (
        <div className="mt-2 text-sm text-muted-foreground">
          {label}
        </div>
      )}
    </div>
  )
}
