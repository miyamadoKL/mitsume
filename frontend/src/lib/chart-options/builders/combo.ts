import type { EChartsOption, SeriesOption } from 'echarts'
import type { ChartBuilderInput } from '../types'
import { parseAxisConfig, extractSeriesData } from './common'

/**
 * Build ECharts options for combo chart
 * Combines bar and line series with optional dual Y-axis
 */
export function buildComboOptions(input: ChartBuilderInput): EChartsOption {
  const { data, config } = input
  const axisConfig = parseAxisConfig(data, config)
  const seriesData = extractSeriesData(data, axisConfig)

  const comboConfig = config.comboConfig
  const seriesTypes = comboConfig?.seriesTypes || {}
  const dualYAxis = comboConfig?.dualYAxis ?? false

  // Build series with specified types
  const series: SeriesOption[] = seriesData.map((s, index) => {
    // Get the type for this series, default to 'bar' for first series, 'line' for others
    const seriesType = seriesTypes[s.name] || (index === 0 ? 'bar' : 'line')

    const baseSeries = {
      name: s.name,
      data: s.values as number[],
      yAxisIndex: dualYAxis && index > 0 ? 1 : 0,
    }

    if (seriesType === 'bar') {
      return {
        ...baseSeries,
        type: 'bar' as const,
      }
    } else if (seriesType === 'area') {
      return {
        ...baseSeries,
        type: 'line' as const,
        smooth: true,
        areaStyle: {},
      }
    } else {
      return {
        ...baseSeries,
        type: 'line' as const,
        smooth: true,
      }
    }
  })

  // Build Y-axis configuration
  const yAxis: EChartsOption['yAxis'] = dualYAxis
    ? [
        { type: 'value', name: axisConfig.yAxisColumns[0] },
        { type: 'value', name: axisConfig.yAxisColumns[1] || '' },
      ]
    : { type: 'value' }

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
    },
    legend: config.legend !== false ? { data: axisConfig.yAxisColumns } : undefined,
    xAxis: { type: 'category', data: axisConfig.xData as string[] },
    yAxis,
    series,
  }
}
