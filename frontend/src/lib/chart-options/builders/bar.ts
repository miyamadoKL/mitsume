import type { EChartsOption } from 'echarts'
import type { ChartBuilderInput } from '../types'
import { parseAxisConfig, extractSeriesData } from './common'

/**
 * Build ECharts options for bar chart
 * Supports stacking via cartesianConfig.stacking
 * Supports dataZoom for large datasets
 */
export function buildBarOptions(input: ChartBuilderInput): EChartsOption {
  const { data, config } = input
  const axisConfig = parseAxisConfig(data, config)
  const seriesData = extractSeriesData(data, axisConfig)
  const dataZoomConfig = config.dataZoom

  const stacking = config.cartesianConfig?.stacking || 'none'
  const isStacked = stacking !== 'none'
  const isPercentStacked = stacking === 'percent'

  // For percent stacking, calculate percentages per x-axis value
  let processedSeriesData = seriesData
  if (isPercentStacked) {
    processedSeriesData = calculatePercentages(seriesData)
  }

  // Build dataZoom components if enabled
  const dataZoom: EChartsOption['dataZoom'] = []
  if (dataZoomConfig?.enabled) {
    const zoomType = dataZoomConfig.type || 'slider'

    if (zoomType === 'inside' || zoomType === 'both') {
      dataZoom.push({
        type: 'inside',
        xAxisIndex: 0,
        start: dataZoomConfig.start ?? 0,
        end: dataZoomConfig.end ?? 100,
      })
    }

    if (zoomType === 'slider' || zoomType === 'both') {
      dataZoom.push({
        type: 'slider',
        xAxisIndex: 0,
        start: dataZoomConfig.start ?? 0,
        end: dataZoomConfig.end ?? 100,
        height: 20,
        bottom: 5,
      })
    }
  }

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: isStacked ? 'shadow' : 'line' },
      formatter: isPercentStacked ? formatPercentTooltip : undefined,
    },
    legend: config.legend !== false ? { data: axisConfig.yAxisColumns } : undefined,
    grid: {
      left: '3%',
      right: '4%',
      bottom: dataZoomConfig?.enabled ? 60 : '3%',
      containLabel: true,
    },
    xAxis: { type: 'category', data: axisConfig.xData as string[] },
    yAxis: {
      type: 'value',
      ...(isPercentStacked && {
        max: 100,
        axisLabel: { formatter: '{value}%' },
      }),
    },
    series: processedSeriesData.map(s => ({
      name: s.name,
      type: 'bar' as const,
      data: s.values as number[],
      ...(isStacked && { stack: 'total' }),
    })),
    dataZoom: dataZoom.length > 0 ? dataZoom : undefined,
  }
}

/**
 * Calculate percentages for 100% stacked chart
 */
function calculatePercentages(seriesData: { name: string; values: unknown[] }[]) {
  if (seriesData.length === 0) return seriesData

  const dataLength = seriesData[0].values.length

  // Calculate totals for each x-axis position
  const totals: number[] = Array(dataLength).fill(0)
  for (const series of seriesData) {
    series.values.forEach((val, idx) => {
      totals[idx] += Number(val) || 0
    })
  }

  // Convert to percentages
  return seriesData.map(series => ({
    name: series.name,
    values: series.values.map((val, idx) => {
      const total = totals[idx]
      if (total === 0) return 0
      return ((Number(val) || 0) / total) * 100
    }),
  }))
}

/**
 * Format tooltip for percent stacked chart
 */
function formatPercentTooltip(params: unknown) {
  if (!Array.isArray(params)) return ''
  const items = params as Array<{
    seriesName: string
    value: number
    marker: string
  }>
  const lines = items.map(item =>
    `${item.marker} ${item.seriesName}: ${item.value.toFixed(1)}%`
  )
  return `${(params[0] as { name: string }).name}<br/>${lines.join('<br/>')}`
}
