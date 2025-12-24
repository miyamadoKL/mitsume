import type { EChartsOption } from 'echarts'
import type { ChartBuilderInput } from '../types'

interface SunburstNode {
  name: string
  value?: number
  children?: SunburstNode[]
}

/**
 * Build ECharts options for sunburst chart
 * Hierarchical pie chart showing nested proportions
 */
export function buildSunburstOptions(input: ChartBuilderInput): EChartsOption {
  const { data, config } = input
  const sunburstConfig = config.sunburstConfig

  if (!sunburstConfig) {
    // Fallback: use first column as category, second as value (flat sunburst)
    return buildFlatSunburst(data, config)
  }

  const { hierarchyColumns, valueColumn } = sunburstConfig

  // Get column indices
  const hierarchyIndices = hierarchyColumns.map(col => data.columns.indexOf(col))
  const valueIdx = data.columns.indexOf(valueColumn)

  // Build tree structure
  const root: SunburstNode = { name: 'root', children: [] }

  for (const row of data.rows) {
    let currentNode = root

    for (let i = 0; i < hierarchyIndices.length; i++) {
      const idx = hierarchyIndices[i]
      const categoryValue = String(row[idx] ?? 'Unknown')

      let childNode = currentNode.children?.find(c => c.name === categoryValue)

      if (!childNode) {
        childNode = {
          name: categoryValue,
          children: i < hierarchyIndices.length - 1 ? [] : undefined,
          value: i === hierarchyIndices.length - 1 ? Number(row[valueIdx]) || 0 : undefined,
        }
        if (!currentNode.children) {
          currentNode.children = []
        }
        currentNode.children.push(childNode)
      } else if (i === hierarchyIndices.length - 1) {
        // Accumulate values for leaf nodes with same path
        childNode.value = (childNode.value || 0) + (Number(row[valueIdx]) || 0)
      }

      currentNode = childNode
    }
  }

  // Calculate parent values from children
  calculateNodeValues(root)

  return {
    tooltip: {
      formatter: (info: unknown) => {
        const node = info as { name: string; value: number; treePathInfo: Array<{ name: string }> }
        const path = node.treePathInfo
          .slice(1)
          .map(item => item.name)
          .join(' → ')
        return `${path}<br/>Value: ${(node.value ?? 0).toLocaleString()}`
      },
    },
    series: [
      {
        name: config.title || 'Sunburst',
        type: 'sunburst',
        data: root.children || [],
        radius: ['15%', '90%'],
        label: {
          rotate: 'radial',
          fontSize: 10,
        },
        emphasis: {
          focus: 'ancestor',
        },
        levels: buildLevelStyles(hierarchyIndices.length),
      },
    ],
  }
}

/**
 * Build a flat sunburst when no hierarchy is configured
 */
function buildFlatSunburst(
  data: ChartBuilderInput['data'],
  config: ChartBuilderInput['config']
): EChartsOption {
  const labelColumn = config.xAxis || data.columns[0]
  const valueColumn = config.valueColumn || data.columns[1]

  const labelIdx = data.columns.indexOf(labelColumn)
  const valueIdx = data.columns.indexOf(valueColumn)

  const sunburstData = data.rows.map(row => ({
    name: String(row[labelIdx]),
    value: Number(row[valueIdx]) || 0,
  }))

  return {
    tooltip: {
      formatter: (info: unknown) => {
        const node = info as { name: string; value: number }
        return `${node.name}: ${(node.value ?? 0).toLocaleString()}`
      },
    },
    series: [
      {
        name: config.title || 'Sunburst',
        type: 'sunburst',
        data: sunburstData,
        radius: ['15%', '90%'],
        label: {
          rotate: 'radial',
        },
        emphasis: {
          focus: 'ancestor',
        },
      },
    ],
  }
}

/**
 * Calculate values for non-leaf nodes by summing children
 */
function calculateNodeValues(node: SunburstNode): number {
  if (!node.children || node.children.length === 0) {
    return node.value || 0
  }

  let sum = 0
  for (const child of node.children) {
    sum += calculateNodeValues(child)
  }

  // Don't set value for non-leaf nodes (ECharts calculates it)
  return sum
}

/**
 * Build level-specific styles for sunburst
 */
function buildLevelStyles(depth: number) {
  const levels = [
    {
      // Root level
      r0: '15%',
      r: '35%',
      itemStyle: {
        borderWidth: 2,
      },
      label: {
        align: 'right',
      },
    },
  ]

  // Add intermediate levels
  const remainingSpace = 55 // 90% - 35%
  const levelHeight = remainingSpace / Math.max(1, depth - 1)

  for (let i = 1; i < depth; i++) {
    const r0 = 35 + (i - 1) * levelHeight
    const r = 35 + i * levelHeight
    levels.push({
      r0: `${r0}%`,
      r: `${r}%`,
      itemStyle: {
        borderWidth: 1,
      },
      label: {
        align: 'right',
      },
    })
  }

  return levels
}
