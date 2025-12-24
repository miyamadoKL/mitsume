import type { EChartsOption } from 'echarts'
import type { ChartBuilderInput } from '../types'
import { parseAxisConfig, extractSeriesData } from './common'
import { applyTimeSeriesTransform, isTimeAxis, aggregateByGranularity } from '../time-series'

/**
 * Build ECharts options for line chart
 */
export function buildLineOptions(input: ChartBuilderInput): EChartsOption {
  const { data, config } = input
  const axisConfig = parseAxisConfig(data, config)
  const seriesData = extractSeriesData(data, axisConfig)
  const timeSeriesConfig = config.timeSeriesConfig
  const dataZoomConfig = config.dataZoom

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
  const transformedSeries = aggregatedSeriesData.map(s => {
    let values = s.values as number[]

    if (timeSeriesConfig?.rollingWindow?.enabled || timeSeriesConfig?.cumulative?.enabled) {
      values = applyTimeSeriesTransform(values, timeSeriesConfig) as number[]
    }

    return { ...s, values }
  })

  // Build series with optional rolling average indicator
  const series = transformedSeries.map(s => {
    const seriesName = timeSeriesConfig?.rollingWindow?.enabled
      ? `${s.name} (${timeSeriesConfig.rollingWindow.periods}-period ${timeSeriesConfig.rollingWindow.function})`
      : timeSeriesConfig?.cumulative?.enabled
        ? `${s.name} (cumulative)`
        : s.name

    return {
      name: seriesName,
      type: 'line' as const,
      data: s.values,
      smooth: true,
      connectNulls: true,
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
    tooltip: { trigger: 'axis' },
    legend: config.legend !== false
      ? { data: series.map(s => s.name) }
      : undefined,
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
    yAxis: { type: 'value' },
    series: (useTimeAxis
      ? series.map((s) => ({
          ...s,
          data: xData.map((x, i) => [x, s.data[i]]),
        }))
      : series) as EChartsOption['series'],
    dataZoom: dataZoom.length > 0 ? dataZoom : undefined,
  }
}
