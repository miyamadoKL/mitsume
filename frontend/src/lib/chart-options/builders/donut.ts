import type { EChartsOption } from 'echarts'
import type { ChartBuilderInput } from '../types'
import { parseAxisConfig } from './common'

/**
 * Build ECharts options for donut chart
 * Similar to pie chart but with a hollow center
 */
export function buildDonutOptions(input: ChartBuilderInput): EChartsOption {
  const { data, config } = input
  const axisConfig = parseAxisConfig(data, config)

  const donutData = data.rows.map(row => ({
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
      radius: ['40%', '70%'],  // Inner and outer radius for donut effect
      center: ['50%', '50%'],
      avoidLabelOverlap: true,
      itemStyle: {
        borderRadius: 4,
        borderColor: '#fff',
        borderWidth: 2,
      },
      label: {
        show: true,
        formatter: '{b}: {d}%',
      },
      emphasis: {
        label: {
          show: true,
          fontSize: 14,
          fontWeight: 'bold',
        },
      },
      labelLine: {
        show: true,
      },
      data: donutData,
    }],
  }
}
