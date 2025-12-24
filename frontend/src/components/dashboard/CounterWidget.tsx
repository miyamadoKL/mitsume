import React, { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { QueryResult, ChartConfig, ConditionalFormatRule } from '@/types'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

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

function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

function getComparisonValue(
  data: QueryResult,
  currentValue: number,
  config: ChartConfig
): { change: number; percentChange: number; isPositive: boolean } | null {
  const comparison = config.comparison
  if (!comparison || comparison.type === 'none') return null

  let previousValue: number | null = null

  if (comparison.type === 'previous_row' && data.rows.length > 1) {
    const valueColumnIndex = config.valueColumn
      ? data.columns.indexOf(config.valueColumn)
      : 0
    previousValue = Number(data.rows[1][valueColumnIndex]) || null
  } else if (comparison.type === 'target' && comparison.targetValue !== undefined) {
    previousValue = comparison.targetValue
  }

  if (previousValue === null || previousValue === 0) return null

  const change = currentValue - previousValue
  const percentChange = (change / Math.abs(previousValue)) * 100
  const isPositive = comparison.invertColors ? change < 0 : change > 0

  return { change, percentChange, isPositive }
}

function getConditionalColor(
  value: number,
  rules?: { column?: string; rules: ConditionalFormatRule[] }[]
): { backgroundColor?: string; textColor?: string } | null {
  if (!rules || rules.length === 0) return null

  // Find matching rule (first match wins)
  for (const ruleGroup of rules) {
    for (const rule of ruleGroup.rules) {
      let matches = false
      const ruleValue = rule.value

      switch (rule.condition) {
        case 'gt':
          matches = value > (ruleValue as number)
          break
        case 'gte':
          matches = value >= (ruleValue as number)
          break
        case 'lt':
          matches = value < (ruleValue as number)
          break
        case 'lte':
          matches = value <= (ruleValue as number)
          break
        case 'eq':
          matches = value === (ruleValue as number)
          break
        case 'between':
          if (Array.isArray(ruleValue)) {
            matches = value >= ruleValue[0] && value <= ruleValue[1]
          }
          break
      }

      if (matches) {
        return {
          backgroundColor: rule.backgroundColor,
          textColor: rule.textColor,
        }
      }
    }
  }

  return null
}

function getSparklineData(data: QueryResult, config: ChartConfig): number[] {
  const sparkline = config.sparkline
  if (!sparkline?.enabled) return []

  const columnIndex = sparkline.column
    ? data.columns.indexOf(sparkline.column)
    : (config.valueColumn ? data.columns.indexOf(config.valueColumn) : 0)

  if (columnIndex < 0) return []

  return data.rows.map(row => Number(row[columnIndex]) || 0).reverse()
}

export const CounterWidget: React.FC<CounterWidgetProps> = ({ data, config }) => {
  // Get the value from the first row
  const valueColumnIndex = config.valueColumn
    ? data.columns.indexOf(config.valueColumn)
    : 0

  const value = data.rows.length > 0 && valueColumnIndex >= 0
    ? data.rows[0][valueColumnIndex]
    : null

  const numericValue = Number(value) || 0
  const formattedValue = formatNumber(value)
  const prefix = config.counterPrefix || ''
  const suffix = config.counterSuffix || ''
  const label = config.counterLabel || (config.valueColumn ? config.valueColumn : data.columns[0])

  // Comparison
  const comparisonData = useMemo(
    () => getComparisonValue(data, numericValue, config),
    [data, numericValue, config]
  )

  // Conditional formatting
  const conditionalStyle = useMemo(
    () => getConditionalColor(numericValue, config.conditionalFormatting),
    [numericValue, config.conditionalFormatting]
  )

  // Sparkline
  const sparklineData = useMemo(
    () => getSparklineData(data, config),
    [data, config]
  )

  const sparklineOptions = useMemo(() => {
    if (sparklineData.length === 0) return null

    const sparkType = config.sparkline?.type || 'line'

    return {
      grid: { top: 0, right: 0, bottom: 0, left: 0 },
      xAxis: { type: 'category', show: false, data: sparklineData.map((_, i) => i) },
      yAxis: { type: 'value', show: false },
      series: [{
        type: sparkType === 'area' ? 'line' : sparkType,
        data: sparklineData,
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2, color: '#3b82f6' },
        areaStyle: sparkType === 'area' ? { color: 'rgba(59, 130, 246, 0.2)' } : undefined,
        itemStyle: sparkType === 'bar' ? { color: '#3b82f6' } : undefined,
      }],
    }
  }, [sparklineData, config.sparkline?.type])

  const containerStyle: React.CSSProperties = conditionalStyle?.backgroundColor
    ? { backgroundColor: conditionalStyle.backgroundColor }
    : {}

  const valueStyle: React.CSSProperties = conditionalStyle?.textColor
    ? { color: conditionalStyle.textColor }
    : {}

  return (
    <div
      className="flex flex-col items-center justify-center h-full p-4"
      style={containerStyle}
    >
      {/* Main Value */}
      <div className="text-4xl font-bold text-foreground" style={valueStyle}>
        {prefix}{formattedValue}{suffix}
      </div>

      {/* Label */}
      {label && (
        <div className="mt-1 text-sm text-muted-foreground">
          {label}
        </div>
      )}

      {/* Comparison */}
      {comparisonData && (
        <div className={`mt-2 flex items-center gap-1 text-sm ${
          comparisonData.isPositive ? 'text-green-600' : 'text-red-600'
        }`}>
          {comparisonData.change > 0 ? (
            <TrendingUp className="h-4 w-4" />
          ) : comparisonData.change < 0 ? (
            <TrendingDown className="h-4 w-4" />
          ) : (
            <Minus className="h-4 w-4" />
          )}
          {config.comparison?.showPercentChange !== false && (
            <span>{formatPercent(comparisonData.percentChange)}</span>
          )}
        </div>
      )}

      {/* Sparkline */}
      {sparklineOptions && (
        <div className="mt-3 w-full h-12">
          <ReactECharts
            option={sparklineOptions}
            style={{ height: '100%', width: '100%' }}
            opts={{ renderer: 'svg' }}
          />
        </div>
      )}
    </div>
  )
}
