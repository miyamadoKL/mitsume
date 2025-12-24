import type { EChartsOption } from 'echarts'
import type { ChartBuilderInput } from '../types'
import { parseAxisConfig } from './common'

/**
 * Build ECharts options for pie chart
 */
export function buildPieOptions(input: ChartBuilderInput): EChartsOption {
  const { data, config } = input
  const axisConfig = parseAxisConfig(data, config)

  const pieData = data.rows.map(row => ({
    name: String(row[axisConfig.xAxisIndex] ?? ''),
    value: row[axisConfig.yAxisIndices[0]] as number,
  }))

  return {
    tooltip: { trigger: 'item' },
    legend: {
      orient: 'vertical',
      left: 'left',
    },
    series: [{
      type: 'pie' as const,
      radius: '50%',
      data: pieData,
    }],
  }
}
