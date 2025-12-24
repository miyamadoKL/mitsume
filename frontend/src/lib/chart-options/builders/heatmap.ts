import type { EChartsOption } from 'echarts'
import type { ChartBuilderInput } from '../types'

/**
 * Build ECharts options for heatmap chart
 * Visualizes 2D data using color intensity
 */
export function buildHeatmapOptions(input: ChartBuilderInput): EChartsOption {
  const { data, config } = input
  const heatmapConfig = config.heatmapConfig

  // Determine columns
  const xColumn = heatmapConfig?.xColumn || config.xAxis || data.columns[0]
  const yColumn = heatmapConfig?.yColumn || data.columns[1]
  const valueColumn = heatmapConfig?.valueColumn || data.columns[2]

  const xColIdx = data.columns.indexOf(xColumn)
  const yColIdx = data.columns.indexOf(yColumn)
  const valColIdx = data.columns.indexOf(valueColumn)

  // Extract unique x and y values for axes
  const xValues = [...new Set(data.rows.map(row => String(row[xColIdx] ?? '')))]
  const yValues = [...new Set(data.rows.map(row => String(row[yColIdx] ?? '')))]

  // Build heatmap data: [xIndex, yIndex, value]
  const heatmapData: [number, number, number][] = []
  let minVal = Infinity
  let maxVal = -Infinity

  for (const row of data.rows) {
    const xVal = String(row[xColIdx] ?? '')
    const yVal = String(row[yColIdx] ?? '')
    const val = Number(row[valColIdx]) || 0

    const xIdx = xValues.indexOf(xVal)
    const yIdx = yValues.indexOf(yVal)

    heatmapData.push([xIdx, yIdx, val])
    minVal = Math.min(minVal, val)
    maxVal = Math.max(maxVal, val)
  }

  // Handle case where we have no data
  if (minVal === Infinity) minVal = 0
  if (maxVal === -Infinity) maxVal = 0

  const showValues = heatmapConfig?.showValues ?? true

  return {
    tooltip: {
      position: 'top',
      formatter: (params: unknown) => {
        const p = params as { value: [number, number, number]; marker: string }
        const xVal = xValues[p.value[0]]
        const yVal = yValues[p.value[1]]
        const val = p.value[2]
        return `${p.marker} ${xVal}, ${yVal}: ${val}`
      },
    },
    grid: {
      top: '10%',
      left: '15%',
      right: '10%',
      bottom: '15%',
    },
    xAxis: {
      type: 'category',
      data: xValues,
      splitArea: { show: true },
      axisLabel: {
        rotate: xValues.length > 10 ? 45 : 0,
      },
    },
    yAxis: {
      type: 'category',
      data: yValues,
      splitArea: { show: true },
    },
    visualMap: {
      min: minVal,
      max: maxVal,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: '0%',
      inRange: {
        color: getColorScheme(heatmapConfig?.colorScheme),
      },
    },
    series: [{
      type: 'heatmap' as const,
      data: heatmapData,
      label: {
        show: showValues,
        formatter: (params: unknown) => {
          const p = params as { value: [number, number, number] }
          return String(p.value[2])
        },
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowColor: 'rgba(0, 0, 0, 0.5)',
        },
      },
    }],
  }
}

/**
 * Get color scheme for heatmap
 */
function getColorScheme(scheme?: string): string[] {
  switch (scheme) {
    case 'blue':
      return ['#e3f2fd', '#1976d2']
    case 'green':
      return ['#e8f5e9', '#388e3c']
    case 'red':
      return ['#ffebee', '#d32f2f']
    case 'purple':
      return ['#f3e5f5', '#7b1fa2']
    case 'diverging':
      return ['#d32f2f', '#fff59d', '#388e3c']
    default:
      // Default warm colors
      return ['#f5f5f5', '#ffcc80', '#ff9800', '#e65100']
  }
}
