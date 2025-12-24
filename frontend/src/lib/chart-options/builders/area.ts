import type { EChartsOption } from 'echarts'
import type { ChartBuilderInput } from '../types'
import { parseAxisConfig, extractSeriesData } from './common'
import { applyTimeSeriesTransform, isTimeAxis, aggregateByGranularity } from '../time-series'

/**
 * Build ECharts options for area chart
 * Supports stacking via cartesianConfig.stacking
 * Supports time series features (granularity, rolling average, cumulative, dataZoom)
 */
export function buildAreaOptions(input: ChartBuilderInput): EChartsOption {
  const { data, config } = input
  const axisConfig = parseAxisConfig(data, config)
  const seriesData = extractSeriesData(data, axisConfig)
  const timeSeriesConfig = config.timeSeriesConfig
  const dataZoomConfig = config.dataZoom

  const stacking = config.cartesianConfig?.stacking || 'none'
  const isStacked = stacking !== 'none'
  const isPercentStacked = stacking === 'percent'

  // Determine if x-axis is time-based
  const xAxisIsTime = isTimeAxis(axisConfig.xData)

  // Apply granularity aggregation first (if enabled)
  let xData = axisConfig.xData
  let aggregatedSeriesData = seriesData

  if (timeSeriesConfig?.granularity && xAxisIsTime) {
    const granularity = timeSeriesConfig.granularity
    const aggregation = timeSeriesConfig.aggregation || 'sum'

    aggregatedSeriesData = seriesData.map(s => {
      const result = aggregateByGranularity(
        xData as unknown[],
        s.values as number[],
        granularity,
        aggregation
      )
      return { ...s, values: result.y }
    })

    // Update xData to aggregated x values (use first series result)
    if (aggregatedSeriesData.length > 0 && seriesData.length > 0) {
      const result = aggregateByGranularity(
        xData as unknown[],
        seriesData[0].values as number[],
        granularity,
        aggregation
      )
      xData = result.x
    }
  }

  // Apply time series transformations (rolling/cumulative) after granularity
  let transformedSeriesData: { name: string; values: number[] }[] = aggregatedSeriesData.map(s => {
    let values = s.values as number[]

    if (timeSeriesConfig?.rollingWindow?.enabled || timeSeriesConfig?.cumulative?.enabled) {
      values = applyTimeSeriesTransform(values, timeSeriesConfig) as number[]
    }

    return { name: s.name, values }
  })

  // For percent stacking, calculate percentages per x-axis value
  if (isPercentStacked) {
    transformedSeriesData = calculatePercentages(transformedSeriesData)
  }

  // Build series with optional transformation indicator in name
  const series = transformedSeriesData.map(s => {
    let seriesName = s.name
    if (timeSeriesConfig?.rollingWindow?.enabled) {
      seriesName = `${s.name} (${timeSeriesConfig.rollingWindow.periods}-period ${timeSeriesConfig.rollingWindow.function})`
    } else if (timeSeriesConfig?.cumulative?.enabled) {
      seriesName = `${s.name} (cumulative)`
    }

    return {
      name: seriesName,
      type: 'line' as const,
      data: s.values,
      smooth: true,
      areaStyle: {},
      connectNulls: true,
      ...(isStacked && { stack: 'total' }),
    }
  })

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

  // If granularity was applied, x-axis becomes category (aggregated bucket keys)
  const useTimeAxis = xAxisIsTime && !timeSeriesConfig?.granularity

  return {
    tooltip: {
      trigger: 'axis',
      formatter: isPercentStacked ? formatPercentTooltip : undefined,
    },
    legend: config.legend !== false ? { data: series.map(s => s.name) } : undefined,
    grid: {
      left: '3%',
      right: '4%',
      bottom: dataZoomConfig?.enabled ? 60 : '3%',
      containLabel: true,
    },
    xAxis: {
      type: useTimeAxis ? 'time' : 'category' as const,
      data: useTimeAxis ? undefined : xData as string[],
    },
    yAxis: {
      type: 'value',
      ...(isPercentStacked && {
        max: 100,
        axisLabel: { formatter: '{value}%' },
      }),
    },
    series: (useTimeAxis
      ? series.map(s => ({
          ...s,
          data: xData.map((x, i) => [x, s.data[i]]),
        }))
      : series) as EChartsOption['series'],
    dataZoom: dataZoom.length > 0 ? dataZoom : undefined,
  }
}

/**
 * Calculate percentages for 100% stacked chart
 */
function calculatePercentages(seriesData: { name: string; values: number[] }[]): { name: string; values: number[] }[] {
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
