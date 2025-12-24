import type { EChartsOption } from 'echarts'
import type { ChartBuilderInput } from '../types'

interface TreemapNode {
  name: string
  value?: number
  children?: TreemapNode[]
}

/**
 * Build ECharts options for treemap chart
 * Shows hierarchical data as nested rectangles
 */
export function buildTreemapOptions(input: ChartBuilderInput): EChartsOption {
  const { data, config } = input
  const treemapConfig = config.treemapConfig

  if (!treemapConfig) {
    // Fallback: use first column as category, second as value
    return buildFlatTreemap(data, config)
  }

  const { hierarchyColumns, valueColumn } = treemapConfig

  // Get column indices
  const hierarchyIndices = hierarchyColumns.map(col => data.columns.indexOf(col))
  const valueIdx = data.columns.indexOf(valueColumn)

  // Build tree structure
  const root: TreemapNode = { name: 'root', children: [] }

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
        name: config.title || 'Treemap',
        type: 'treemap',
        roam: false,
        data: root.children || [],
        leafDepth: hierarchyIndices.length,
        label: {
          show: true,
          formatter: '{b}',
        },
        upperLabel: {
          show: true,
          height: 30,
        },
        levels: buildLevelStyles(hierarchyIndices.length),
        breadcrumb: {
          show: true,
        },
      },
    ],
  }
}

/**
 * Build a flat treemap when no hierarchy is configured
 */
function buildFlatTreemap(
  data: ChartBuilderInput['data'],
  config: ChartBuilderInput['config']
): EChartsOption {
  const labelColumn = config.xAxis || data.columns[0]
  const valueColumn = config.valueColumn || data.columns[1]

  const labelIdx = data.columns.indexOf(labelColumn)
  const valueIdx = data.columns.indexOf(valueColumn)

  const treeData = data.rows.map(row => ({
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
        name: config.title || 'Treemap',
        type: 'treemap',
        roam: false,
        data: treeData,
        label: {
          show: true,
          formatter: '{b}',
        },
        breadcrumb: {
          show: false,
        },
      },
    ],
  }
}

/**
 * Build level-specific styles for treemap
 */
function buildLevelStyles(depth: number) {
  const levels = []

  for (let i = 0; i <= depth; i++) {
    levels.push({
      itemStyle: {
        borderWidth: Math.max(1, 4 - i),
        borderColor: i === 0 ? '#333' : '#aaa',
        gapWidth: Math.max(1, 3 - i),
      },
      upperLabel: {
        show: i > 0,
      },
    })
  }

  return levels
}
