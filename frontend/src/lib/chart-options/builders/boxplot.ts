import type { EChartsOption } from 'echarts'
import type { ChartBuilderInput } from '../types'

/**
 * Build ECharts options for boxplot chart
 * Shows data distribution with min, Q1, median, Q3, max, and outliers
 */
export function buildBoxplotOptions(input: ChartBuilderInput): EChartsOption {
  const { data, config } = input
  const boxplotConfig = config.boxplotConfig

  // Get column indices
  const categoryColumn = boxplotConfig?.categoryColumn || config.xAxis || data.columns[0]
  const valueColumn = boxplotConfig?.valueColumn || (Array.isArray(config.yAxis) ? config.yAxis[0] : config.yAxis) || data.columns[1]

  const categoryIdx = data.columns.indexOf(categoryColumn)
  const valueIdx = data.columns.indexOf(valueColumn)

  // Group values by category
  const categoryValues = new Map<string, number[]>()

  for (const row of data.rows) {
    const category = String(row[categoryIdx])
    const value = Number(row[valueIdx])

    if (!isNaN(value)) {
      if (!categoryValues.has(category)) {
        categoryValues.set(category, [])
      }
      categoryValues.get(category)!.push(value)
    }
  }

  // Sort categories and prepare data
  const categories = Array.from(categoryValues.keys()).sort()
  const boxplotData: number[][] = []
  const outliers: Array<[number, number]> = []

  const showOutliers = boxplotConfig?.showOutliers ?? true

  categories.forEach((category, categoryIndex) => {
    const values = categoryValues.get(category)!.sort((a, b) => a - b)
    const stats = calculateBoxplotStats(values)

    boxplotData.push([
      stats.min,
      stats.q1,
      stats.median,
      stats.q3,
      stats.max,
    ])

    // Add outliers if enabled
    if (showOutliers) {
      for (const outlier of stats.outliers) {
        outliers.push([categoryIndex, outlier])
      }
    }
  })

  const series: EChartsOption['series'] = [
    {
      name: valueColumn,
      type: 'boxplot',
      data: boxplotData,
      tooltip: {
        formatter: (params: unknown) => {
          const p = params as { name: string; value: number[] }
          return [
            `<b>${p.name}</b>`,
            `Max: ${p.value[5]?.toLocaleString() ?? p.value[4]?.toLocaleString()}`,
            `Q3: ${p.value[4]?.toLocaleString() ?? p.value[3]?.toLocaleString()}`,
            `Median: ${p.value[3]?.toLocaleString() ?? p.value[2]?.toLocaleString()}`,
            `Q1: ${p.value[2]?.toLocaleString() ?? p.value[1]?.toLocaleString()}`,
            `Min: ${p.value[1]?.toLocaleString() ?? p.value[0]?.toLocaleString()}`,
          ].join('<br/>')
        },
      },
    },
  ]

  // Add outliers as scatter series
  if (showOutliers && outliers.length > 0) {
    (series as Array<Record<string, unknown>>).push({
      name: 'Outliers',
      type: 'scatter',
      data: outliers,
      itemStyle: {
        color: '#ff4444',
      },
      tooltip: {
        formatter: (params: unknown) => {
          const p = params as { value: [number, number] }
          return `${categories[p.value[0]]}: ${p.value[1].toLocaleString()}`
        },
      },
    })
  }

  return {
    tooltip: {
      trigger: 'item',
    },
    legend: config.legend !== false ? {
      data: [valueColumn, ...(showOutliers && outliers.length > 0 ? ['Outliers'] : [])],
    } : undefined,
    grid: {
      left: '10%',
      right: '10%',
      bottom: '15%',
    },
    xAxis: {
      type: 'category',
      data: categories,
      boundaryGap: true,
      nameGap: 30,
      splitArea: {
        show: false,
      },
      axisLabel: {
        rotate: categories.length > 5 ? 45 : 0,
      },
    },
    yAxis: {
      type: 'value',
      name: valueColumn,
      splitArea: {
        show: true,
      },
    },
    series,
  }
}

interface BoxplotStats {
  min: number
  q1: number
  median: number
  q3: number
  max: number
  outliers: number[]
}

/**
 * Calculate boxplot statistics for a sorted array of values
 */
function calculateBoxplotStats(sortedValues: number[]): BoxplotStats {
  const n = sortedValues.length

  if (n === 0) {
    return { min: 0, q1: 0, median: 0, q3: 0, max: 0, outliers: [] }
  }

  if (n === 1) {
    const v = sortedValues[0]
    return { min: v, q1: v, median: v, q3: v, max: v, outliers: [] }
  }

  // Calculate quartiles
  const q1 = percentile(sortedValues, 25)
  const median = percentile(sortedValues, 50)
  const q3 = percentile(sortedValues, 75)

  // Calculate IQR and bounds for outliers
  const iqr = q3 - q1
  const lowerBound = q1 - 1.5 * iqr
  const upperBound = q3 + 1.5 * iqr

  // Find outliers and whisker endpoints
  const outliers: number[] = []
  let min = sortedValues[0]
  let max = sortedValues[n - 1]

  // Find min/max within bounds
  for (const value of sortedValues) {
    if (value < lowerBound || value > upperBound) {
      outliers.push(value)
    } else {
      if (value < min || min < lowerBound) min = value
      if (value > max || max > upperBound) max = value
    }
  }

  // If all values are outliers, use q1/q3 as min/max
  if (min < lowerBound) min = q1
  if (max > upperBound) max = q3

  return { min, q1, median, q3, max, outliers }
}

/**
 * Calculate percentile value
 */
function percentile(sortedValues: number[], p: number): number {
  const n = sortedValues.length
  const rank = (p / 100) * (n - 1)
  const lowerIndex = Math.floor(rank)
  const upperIndex = Math.ceil(rank)
  const fraction = rank - lowerIndex

  if (lowerIndex === upperIndex) {
    return sortedValues[lowerIndex]
  }

  return sortedValues[lowerIndex] * (1 - fraction) + sortedValues[upperIndex] * fraction
}
