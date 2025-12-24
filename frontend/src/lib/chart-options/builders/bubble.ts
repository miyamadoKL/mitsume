import type { EChartsOption } from 'echarts'
import type { ChartBuilderInput } from '../types'

/**
 * Build ECharts options for bubble chart
 * Scatter plot with size dimension representing a third variable
 */
export function buildBubbleOptions(input: ChartBuilderInput): EChartsOption {
  const { data, config } = input
  const bubbleConfig = config.bubbleConfig

  // Get column indices
  const xColumn = bubbleConfig?.xColumn || config.xAxis || data.columns[0]
  const yColumn = bubbleConfig?.yColumn || (Array.isArray(config.yAxis) ? config.yAxis[0] : config.yAxis) || data.columns[1]
  const sizeColumn = bubbleConfig?.sizeColumn || data.columns[2]
  const colorColumn = bubbleConfig?.colorColumn

  const xIdx = data.columns.indexOf(xColumn)
  const yIdx = data.columns.indexOf(yColumn)
  const sizeIdx = data.columns.indexOf(sizeColumn)
  const colorIdx = colorColumn ? data.columns.indexOf(colorColumn) : -1

  // Find min/max for size scaling
  const sizeValues = data.rows.map(row => Number(row[sizeIdx]) || 0)
  const minSize = Math.min(...sizeValues)
  const maxSize = Math.max(...sizeValues)
  const sizeRange = maxSize - minSize || 1

  const maxBubbleSize = bubbleConfig?.maxBubbleSize || 50
  const minBubbleSize = 5

  // Group by color if colorColumn is specified
  const seriesMap = new Map<string, Array<[number, number, number, string]>>()

  for (const row of data.rows) {
    const x = Number(row[xIdx]) || 0
    const y = Number(row[yIdx]) || 0
    const size = Number(row[sizeIdx]) || 0
    const colorKey = colorIdx >= 0 ? String(row[colorIdx]) : 'default'

    if (!seriesMap.has(colorKey)) {
      seriesMap.set(colorKey, [])
    }
    seriesMap.get(colorKey)!.push([x, y, size, colorKey])
  }

  // Build series
  const series = Array.from(seriesMap.entries()).map(([name, points]) => ({
    name,
    type: 'scatter' as const,
    data: points.map(([x, y, size]) => ({
      value: [x, y],
      symbolSize: calculateSymbolSize(size, minSize, sizeRange, minBubbleSize, maxBubbleSize),
      originalSize: size,
    })),
  }))

  return {
    tooltip: {
      trigger: 'item',
      formatter: (params: unknown) => {
        const p = params as {
          seriesName: string
          value: [number, number]
          data: { originalSize: number }
        }
        const lines = [
          colorIdx >= 0 ? `<b>${p.seriesName}</b><br/>` : '',
          `${xColumn}: ${p.value[0].toLocaleString()}<br/>`,
          `${yColumn}: ${p.value[1].toLocaleString()}<br/>`,
          `${sizeColumn}: ${p.data.originalSize.toLocaleString()}`,
        ]
        return lines.join('')
      },
    },
    legend: config.legend !== false && colorIdx >= 0 ? {
      data: Array.from(seriesMap.keys()),
    } : undefined,
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'value',
      name: xColumn,
      nameLocation: 'middle',
      nameGap: 30,
      splitLine: {
        lineStyle: {
          type: 'dashed',
        },
      },
    },
    yAxis: {
      type: 'value',
      name: yColumn,
      nameLocation: 'middle',
      nameGap: 40,
      splitLine: {
        lineStyle: {
          type: 'dashed',
        },
      },
    },
    series,
  }
}

/**
 * Calculate symbol size based on value
 */
function calculateSymbolSize(
  value: number,
  minValue: number,
  range: number,
  minSize: number,
  maxSize: number
): number {
  const normalized = (value - minValue) / range
  return minSize + normalized * (maxSize - minSize)
}
