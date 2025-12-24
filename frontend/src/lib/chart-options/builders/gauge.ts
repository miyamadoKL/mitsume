import type { EChartsOption } from 'echarts'
import type { ChartBuilderInput } from '../types'

/**
 * Build ECharts options for gauge chart
 * Displays a single value on a meter-style gauge
 */
export function buildGaugeOptions(input: ChartBuilderInput): EChartsOption {
  const { data, config } = input
  const gaugeConfig = config.gaugeConfig

  // Get value from first row, first numeric column
  const valueColumn = config.valueColumn || data.columns[0]
  const valueIndex = data.columns.indexOf(valueColumn)
  const value = data.rows.length > 0 ? Number(data.rows[0][valueIndex]) || 0 : 0

  const min = gaugeConfig?.min ?? 0
  const max = gaugeConfig?.max ?? 100
  const showPointer = gaugeConfig?.showPointer ?? true

  // Build axis line colors from ranges
  const axisLineColors: [number, string][] = []
  if (gaugeConfig?.ranges && gaugeConfig.ranges.length > 0) {
    for (const range of gaugeConfig.ranges) {
      const normalizedTo = (range.to - min) / (max - min)
      axisLineColors.push([normalizedTo, range.color])
    }
  } else {
    // Default gradient: green -> yellow -> red
    axisLineColors.push(
      [0.3, '#67e0e3'],
      [0.7, '#37a2da'],
      [1, '#fd666d']
    )
  }

  return {
    series: [{
      type: 'gauge' as const,
      min,
      max,
      progress: {
        show: true,
        width: 18,
      },
      axisLine: {
        lineStyle: {
          width: 18,
          color: axisLineColors,
        },
      },
      axisTick: {
        show: false,
      },
      splitLine: {
        length: 15,
        lineStyle: {
          width: 2,
          color: '#999',
        },
      },
      axisLabel: {
        distance: 25,
        color: '#999',
        fontSize: 12,
      },
      anchor: {
        show: showPointer,
        showAbove: true,
        size: 20,
        itemStyle: {
          borderWidth: 8,
        },
      },
      pointer: {
        show: showPointer,
        length: '60%',
        width: 6,
      },
      title: {
        show: true,
        offsetCenter: [0, '70%'],
        fontSize: 14,
      },
      detail: {
        valueAnimation: true,
        fontSize: 32,
        offsetCenter: [0, '40%'],
        formatter: '{value}',
      },
      data: [{
        value,
        name: config.counterLabel || valueColumn,
      }],
    }],
  }
}
