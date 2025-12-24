import type { EChartsOption } from 'echarts'
import type { ChartBuilderInput } from '../types'
import { parseAxisConfig } from './common'

/**
 * Build ECharts options for scatter chart
 */
export function buildScatterOptions(input: ChartBuilderInput): EChartsOption {
  const { data, config } = input
  const axisConfig = parseAxisConfig(data, config)

  // For scatter, we pair x values with y values
  const scatterData = data.rows.map(row => [
    row[axisConfig.xAxisIndex] as number,
    row[axisConfig.yAxisIndices[0]] as number,
  ])

  return {
    tooltip: { trigger: 'item' },
    legend: config.legend !== false ? { data: axisConfig.yAxisColumns } : undefined,
    xAxis: { type: 'value' },
    yAxis: { type: 'value' },
    series: [{
      name: axisConfig.yAxisColumns[0],
      type: 'scatter' as const,
      data: scatterData,
    }],
  }
}
