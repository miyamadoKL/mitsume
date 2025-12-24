import type { EChartsOption } from 'echarts'
import type { ChartBuilderInput } from '../types'

/**
 * Build ECharts options for funnel chart
 * Visualizes stages in a process (e.g., sales funnel, conversion rates)
 */
export function buildFunnelOptions(input: ChartBuilderInput): EChartsOption {
  const { data, config } = input
  const funnelConfig = config.funnelConfig

  // Get column indices
  const labelColumn = funnelConfig?.labelColumn || config.xAxis || data.columns[0]
  const valueColumn = funnelConfig?.valueColumn || config.valueColumn || data.columns[1]

  const labelIdx = data.columns.indexOf(labelColumn)
  const valueIdx = data.columns.indexOf(valueColumn)

  // Extract data
  const funnelData = data.rows.map(row => ({
    name: String(row[labelIdx]),
    value: Number(row[valueIdx]) || 0,
  }))

  // Sort data based on config
  const sortOrder = funnelConfig?.sortOrder || 'descending'
  if (sortOrder === 'descending') {
    funnelData.sort((a, b) => b.value - a.value)
  } else if (sortOrder === 'ascending') {
    funnelData.sort((a, b) => a.value - b.value)
  }
  // 'none' keeps original order

  // Calculate percentages if needed
  const maxValue = Math.max(...funnelData.map(d => d.value))
  const showPercentage = funnelConfig?.showPercentage ?? true

  return {
    tooltip: {
      trigger: 'item',
      formatter: (params: unknown) => {
        const p = params as { name: string; value: number; percent: number }
        const percentage = maxValue > 0 ? ((p.value / maxValue) * 100).toFixed(1) : '0'
        return `${p.name}: ${p.value.toLocaleString()}${showPercentage ? ` (${percentage}%)` : ''}`
      },
    },
    legend: config.legend !== false ? {
      data: funnelData.map(d => d.name),
    } : undefined,
    series: [
      {
        name: 'Funnel',
        type: 'funnel',
        left: '10%',
        top: 60,
        bottom: 60,
        width: '80%',
        min: 0,
        max: maxValue,
        minSize: '0%',
        maxSize: '100%',
        sort: 'none', // We pre-sorted the data
        gap: 2,
        label: {
          show: true,
          position: funnelConfig?.labelPosition || 'inside',
          formatter: showPercentage
            ? (params: unknown) => {
                const p = params as { name: string; value: number }
                const percentage = maxValue > 0 ? ((p.value / maxValue) * 100).toFixed(1) : '0'
                return `${p.name}\n${percentage}%`
              }
            : '{b}',
        },
        labelLine: {
          length: 10,
          lineStyle: {
            width: 1,
            type: 'solid',
          },
        },
        itemStyle: {
          borderColor: '#fff',
          borderWidth: 1,
        },
        emphasis: {
          label: {
            fontSize: 16,
          },
        },
        data: funnelData,
      },
    ],
  }
}
