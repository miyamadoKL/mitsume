import { describe, expect, it } from 'vitest'
import { buildBarOptions } from './bar'
import { buildDonutOptions } from './donut'
import { buildComboOptions } from './combo'
import { buildHeatmapOptions } from './heatmap'
import { buildGaugeOptions } from './gauge'
import { buildProgressOptions } from './progress'
import type { ChartBuilderInput } from '../types'
import type { QueryResult, ChartConfig, ChartType } from '@/types'

// Helper to create test data
function createTestData(columns: string[], rows: unknown[][]): QueryResult {
  return {
    columns,
    rows,
    row_count: rows.length,
    execution_time_ms: 10,
  }
}

// Helper to create builder input
function createInput(
  type: ChartType,
  data: QueryResult,
  config: ChartConfig
): ChartBuilderInput {
  return { type, data, config }
}

describe('buildBarOptions', () => {
  const testData = createTestData(
    ['category', 'value1', 'value2'],
    [
      ['A', 10, 20],
      ['B', 15, 25],
      ['C', 8, 12],
    ]
  )

  it('should create bar chart without stacking', () => {
    const result = buildBarOptions(createInput('bar', testData, {
      xAxis: 'category',
      yAxis: ['value1', 'value2'],
    }))

    expect(result.series).toHaveLength(2)
    const series = result.series as Array<{ type: string; stack?: string }>
    expect(series[0].type).toBe('bar')
    expect(series[1].type).toBe('bar')
    expect(series[0].stack).toBeUndefined()
  })

  it('should create stacked bar chart with normal stacking', () => {
    const result = buildBarOptions(createInput('bar', testData, {
      xAxis: 'category',
      yAxis: ['value1', 'value2'],
      cartesianConfig: { stacking: 'normal' },
    }))

    const series = result.series as Array<{ stack: string }>
    expect(series[0].stack).toBe('total')
    expect(series[1].stack).toBe('total')
  })

  it('should create 100% stacked bar chart with percent stacking', () => {
    const result = buildBarOptions(createInput('bar', testData, {
      xAxis: 'category',
      yAxis: ['value1', 'value2'],
      cartesianConfig: { stacking: 'percent' },
    }))

    const series = result.series as Array<{ stack: string; data: number[] }>
    expect(series[0].stack).toBe('total')
    expect(series[1].stack).toBe('total')

    // Check that values are percentages (should sum to 100 for each category)
    const data1 = series[0].data
    const data2 = series[1].data
    for (let i = 0; i < data1.length; i++) {
      const sum = data1[i] + data2[i]
      expect(sum).toBeCloseTo(100, 1)
    }

    // Check y-axis has max: 100
    const yAxis = result.yAxis as { max?: number }
    expect(yAxis.max).toBe(100)
  })
})

describe('buildDonutOptions', () => {
  const testData = createTestData(
    ['category', 'value'],
    [
      ['Slice A', 30],
      ['Slice B', 50],
      ['Slice C', 20],
    ]
  )

  it('should create donut chart with correct radius', () => {
    const result = buildDonutOptions(createInput('donut', testData, {
      xAxis: 'category',
      yAxis: 'value',
    }))

    const series = result.series as Array<{ radius: string[] }>
    expect(series).toHaveLength(1)
    expect(series[0].radius).toEqual(['40%', '70%'])
  })

  it('should have pie type series', () => {
    const result = buildDonutOptions(createInput('donut', testData, {
      xAxis: 'category',
      yAxis: 'value',
    }))

    const series = result.series as Array<{ type: string }>
    expect(series[0].type).toBe('pie')
  })

  it('should include all data points', () => {
    const result = buildDonutOptions(createInput('donut', testData, {
      xAxis: 'category',
      yAxis: 'value',
    }))

    const series = result.series as Array<{ data: Array<{ name: string; value: number }> }>
    expect(series[0].data).toHaveLength(3)
    expect(series[0].data[0].name).toBe('Slice A')
    expect(series[0].data[0].value).toBe(30)
  })
})

describe('buildComboOptions', () => {
  const testData = createTestData(
    ['month', 'sales', 'profit'],
    [
      ['Jan', 100, 20],
      ['Feb', 120, 25],
      ['Mar', 90, 15],
    ]
  )

  it('should create combo chart with specified series types', () => {
    const result = buildComboOptions(createInput('combo', testData, {
      xAxis: 'month',
      yAxis: ['sales', 'profit'],
      comboConfig: {
        seriesTypes: { sales: 'bar', profit: 'line' },
      },
    }))

    const series = result.series as Array<{ name: string; type: string }>
    const salesSeries = series.find(s => s.name === 'sales')
    const profitSeries = series.find(s => s.name === 'profit')

    expect(salesSeries?.type).toBe('bar')
    expect(profitSeries?.type).toBe('line')
  })

  it('should support dual Y-axis', () => {
    const result = buildComboOptions(createInput('combo', testData, {
      xAxis: 'month',
      yAxis: ['sales', 'profit'],
      comboConfig: {
        dualYAxis: true,
      },
    }))

    const yAxis = result.yAxis as Array<{ type: string }>
    expect(yAxis).toHaveLength(2)
    expect(yAxis[0].type).toBe('value')
    expect(yAxis[1].type).toBe('value')

    // Second series should use second y-axis
    const series = result.series as Array<{ yAxisIndex: number }>
    expect(series[0].yAxisIndex).toBe(0)
    expect(series[1].yAxisIndex).toBe(1)
  })

  it('should default to bar for first series, line for others', () => {
    const result = buildComboOptions(createInput('combo', testData, {
      xAxis: 'month',
      yAxis: ['sales', 'profit'],
    }))

    const series = result.series as Array<{ type: string }>
    expect(series[0].type).toBe('bar')
    expect(series[1].type).toBe('line')
  })
})

describe('buildHeatmapOptions', () => {
  const testData = createTestData(
    ['day', 'hour', 'value'],
    [
      ['Mon', '9AM', 10],
      ['Mon', '10AM', 15],
      ['Tue', '9AM', 8],
      ['Tue', '10AM', 20],
    ]
  )

  it('should extract unique x and y axis categories', () => {
    const result = buildHeatmapOptions(createInput('heatmap', testData, {
      heatmapConfig: {
        xColumn: 'day',
        yColumn: 'hour',
        valueColumn: 'value',
      },
    }))

    const xAxis = result.xAxis as { data: string[] }
    const yAxis = result.yAxis as { data: string[] }

    expect(xAxis.data).toContain('Mon')
    expect(xAxis.data).toContain('Tue')
    expect(yAxis.data).toContain('9AM')
    expect(yAxis.data).toContain('10AM')
  })

  it('should have visualMap with min/max from data', () => {
    const result = buildHeatmapOptions(createInput('heatmap', testData, {
      heatmapConfig: {
        xColumn: 'day',
        yColumn: 'hour',
        valueColumn: 'value',
      },
    }))

    const visualMap = result.visualMap as { min: number; max: number }
    expect(visualMap.min).toBe(8)
    expect(visualMap.max).toBe(20)
  })

  it('should apply color scheme', () => {
    const result = buildHeatmapOptions(createInput('heatmap', testData, {
      heatmapConfig: {
        xColumn: 'day',
        yColumn: 'hour',
        valueColumn: 'value',
        colorScheme: 'blue',
      },
    }))

    const visualMap = result.visualMap as { inRange: { color: string[] } }
    expect(visualMap.inRange.color).toEqual(['#e3f2fd', '#1976d2'])
  })

  it('should apply diverging color scheme', () => {
    const result = buildHeatmapOptions(createInput('heatmap', testData, {
      heatmapConfig: {
        xColumn: 'day',
        yColumn: 'hour',
        valueColumn: 'value',
        colorScheme: 'diverging',
      },
    }))

    const visualMap = result.visualMap as { inRange: { color: string[] } }
    expect(visualMap.inRange.color).toHaveLength(3)
  })
})

describe('buildGaugeOptions', () => {
  const testData = createTestData(
    ['metric', 'value'],
    [['CPU Usage', 75]],
  )

  it('should display value from first row', () => {
    const result = buildGaugeOptions(createInput('gauge', testData, {
      valueColumn: 'value',
    }))

    const series = result.series as Array<{ data: Array<{ value: number }> }>
    expect(series[0].data[0].value).toBe(75)
  })

  it('should use custom min/max from gaugeConfig', () => {
    const result = buildGaugeOptions(createInput('gauge', testData, {
      valueColumn: 'value',
      gaugeConfig: {
        min: 0,
        max: 200,
      },
    }))

    const series = result.series as Array<{ min: number; max: number }>
    expect(series[0].min).toBe(0)
    expect(series[0].max).toBe(200)
  })

  it('should apply custom color ranges', () => {
    const result = buildGaugeOptions(createInput('gauge', testData, {
      valueColumn: 'value',
      gaugeConfig: {
        min: 0,
        max: 100,
        ranges: [
          { from: 0, to: 50, color: '#00ff00' },
          { from: 50, to: 80, color: '#ffff00' },
          { from: 80, to: 100, color: '#ff0000' },
        ],
      },
    }))

    const series = result.series as Array<{
      axisLine: { lineStyle: { color: Array<[number, string]> } }
    }>
    const colors = series[0].axisLine.lineStyle.color

    expect(colors).toHaveLength(3)
    expect(colors[0]).toEqual([0.5, '#00ff00'])
    expect(colors[1]).toEqual([0.8, '#ffff00'])
    expect(colors[2]).toEqual([1, '#ff0000'])
  })

  it('should hide pointer when showPointer is false', () => {
    const result = buildGaugeOptions(createInput('gauge', testData, {
      valueColumn: 'value',
      gaugeConfig: {
        min: 0,
        max: 100,
        showPointer: false,
      },
    }))

    const series = result.series as Array<{ pointer: { show: boolean } }>
    expect(series[0].pointer.show).toBe(false)
  })
})

describe('buildProgressOptions', () => {
  const testData = createTestData(
    ['task', 'completed'],
    [['Tasks', 75]],
  )

  it('should calculate percentage based on target value', () => {
    const result = buildProgressOptions(createInput('progress', testData, {
      valueColumn: 'completed',
      progressConfig: {
        targetValue: 100,
      },
    }))

    const series = result.series as Array<{ data: number[] }>
    // Second series is the progress bar
    expect(series[1].data[0]).toBe(75)
  })

  it('should cap percentage at 100%', () => {
    const overData = createTestData(
      ['task', 'completed'],
      [['Tasks', 150]],
    )

    const result = buildProgressOptions(createInput('progress', overData, {
      valueColumn: 'completed',
      progressConfig: {
        targetValue: 100,
      },
    }))

    const series = result.series as Array<{ data: number[] }>
    expect(series[1].data[0]).toBe(100)
  })

  it('should display current/target value text', () => {
    const result = buildProgressOptions(createInput('progress', testData, {
      valueColumn: 'completed',
      progressConfig: {
        targetValue: 100,
      },
    }))

    const graphic = result.graphic as Array<{ style: { text: string } }>
    expect(graphic[0].style.text).toContain('75')
    expect(graphic[0].style.text).toContain('100')
  })

  it('should apply custom progress color', () => {
    const result = buildProgressOptions(createInput('progress', testData, {
      valueColumn: 'completed',
      progressConfig: {
        targetValue: 100,
        color: '#ff6b6b',
      },
    }))

    const series = result.series as Array<{ itemStyle: { color: string } }>
    // Second series is the progress bar
    expect(series[1].itemStyle.color).toBe('#ff6b6b')
  })

  it('should hide percentage when showPercentage is false', () => {
    const result = buildProgressOptions(createInput('progress', testData, {
      valueColumn: 'completed',
      progressConfig: {
        targetValue: 100,
        showPercentage: false,
      },
    }))

    const series = result.series as Array<{ label: { show: boolean } }>
    expect(series[1].label.show).toBe(false)
  })
})
