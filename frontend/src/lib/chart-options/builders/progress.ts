import type { EChartsOption } from 'echarts'
import type { ChartBuilderInput } from '../types'

/**
 * Build ECharts options for progress bar chart
 * Shows progress toward a target value
 */
export function buildProgressOptions(input: ChartBuilderInput): EChartsOption {
  const { data, config } = input
  const progressConfig = config.progressConfig

  // Get value from first row, first numeric column
  const valueColumn = config.valueColumn || data.columns[0]
  const valueIndex = data.columns.indexOf(valueColumn)
  const currentValue = data.rows.length > 0 ? Number(data.rows[0][valueIndex]) || 0 : 0

  const targetValue = progressConfig?.targetValue ?? 100
  const percentage = Math.min(100, Math.max(0, (currentValue / targetValue) * 100))
  const showPercentage = progressConfig?.showPercentage ?? true
  const color = progressConfig?.color || '#3b82f6'
  const backgroundColor = progressConfig?.backgroundColor || '#e5e7eb'

  const label = config.counterLabel || valueColumn

  return {
    grid: {
      top: '40%',
      bottom: '30%',
      left: '10%',
      right: '10%',
    },
    xAxis: {
      type: 'value',
      max: 100,
      show: false,
    },
    yAxis: {
      type: 'category',
      data: [label],
      show: false,
    },
    series: [
      // Background bar
      {
        type: 'bar' as const,
        data: [100],
        barWidth: 30,
        itemStyle: {
          color: backgroundColor,
          borderRadius: 15,
        },
        z: 1,
      },
      // Progress bar
      {
        type: 'bar' as const,
        data: [percentage],
        barWidth: 30,
        itemStyle: {
          color,
          borderRadius: 15,
        },
        z: 2,
        label: {
          show: showPercentage,
          position: 'inside',
          formatter: `${percentage.toFixed(0)}%`,
          color: '#fff',
          fontSize: 14,
          fontWeight: 'bold',
        },
      },
    ],
    graphic: [
      // Current value display
      {
        type: 'text',
        left: 'center',
        top: '15%',
        style: {
          text: `${currentValue.toLocaleString()} / ${targetValue.toLocaleString()}`,
          fontSize: 24,
          fontWeight: 'bold',
          fill: '#333',
        },
      },
      // Label
      {
        type: 'text',
        left: 'center',
        bottom: '10%',
        style: {
          text: label,
          fontSize: 14,
          fill: '#666',
        },
      },
    ],
  }
}
