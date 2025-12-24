import type { ChartType } from '@/types'
import type { ChartTypeInfo } from './types'

/**
 * Chart type registry - single source of truth for all chart types
 * Used by both chart rendering and UI dropdowns
 */
export const CHART_TYPES: ChartTypeInfo[] = [
  // =====================
  // Basic charts (ECharts-based)
  // =====================
  {
    value: 'bar',
    label: 'Bar Chart',
    description: 'Compare values across categories',
    icon: 'BarChart3',
    category: 'comparison',
    requiresData: true,
  },
  {
    value: 'line',
    label: 'Line Chart',
    description: 'Show trends over time or sequence',
    icon: 'LineChart',
    category: 'basic',
    requiresData: true,
  },
  {
    value: 'area',
    label: 'Area Chart',
    description: 'Show trends with filled area',
    icon: 'AreaChart',
    category: 'basic',
    requiresData: true,
  },
  {
    value: 'pie',
    label: 'Pie Chart',
    description: 'Show proportions of a whole',
    icon: 'PieChart',
    category: 'composition',
    requiresData: true,
  },
  {
    value: 'scatter',
    label: 'Scatter Plot',
    description: 'Show correlation between two variables',
    icon: 'ScatterChart',
    category: 'relationship',
    requiresData: true,
  },

  // =====================
  // Phase 1: Basic chart enhancements
  // =====================
  {
    value: 'donut',
    label: 'Donut Chart',
    description: 'Show proportions with center space',
    icon: 'Circle',
    category: 'composition',
    requiresData: true,
  },
  {
    value: 'combo',
    label: 'Combo Chart',
    description: 'Combine bar and line in one chart',
    icon: 'BarChart2',
    category: 'comparison',
    requiresData: true,
  },
  {
    value: 'heatmap',
    label: 'Heatmap',
    description: 'Visualize data density with colors',
    icon: 'Grid3X3',
    category: 'distribution',
    requiresData: true,
  },

  // =====================
  // Phase 2: KPI & Metrics
  // =====================
  {
    value: 'gauge',
    label: 'Gauge',
    description: 'Show progress toward a goal',
    icon: 'Gauge',
    category: 'kpi',
    requiresData: true,
  },
  {
    value: 'progress',
    label: 'Progress Bar',
    description: 'Show completion percentage',
    icon: 'BarChart',
    category: 'kpi',
    requiresData: true,
  },

  // =====================
  // Phase 4: Advanced visualization
  // =====================
  {
    value: 'funnel',
    label: 'Funnel Chart',
    description: 'Visualize stages in a process',
    icon: 'Filter',
    category: 'distribution',
    requiresData: true,
  },
  {
    value: 'treemap',
    label: 'Treemap',
    description: 'Show hierarchical data as nested rectangles',
    icon: 'LayoutGrid',
    category: 'composition',
    requiresData: true,
  },
  {
    value: 'bubble',
    label: 'Bubble Chart',
    description: 'Scatter plot with size dimension',
    icon: 'CircleDot',
    category: 'relationship',
    requiresData: true,
  },
  {
    value: 'sunburst',
    label: 'Sunburst',
    description: 'Hierarchical pie chart',
    icon: 'Sun',
    category: 'composition',
    requiresData: true,
  },
  {
    value: 'boxplot',
    label: 'Box Plot',
    description: 'Show data distribution statistics',
    icon: 'BoxSelect',
    category: 'distribution',
    requiresData: true,
  },

  // =====================
  // Non-ECharts widgets
  // =====================
  {
    value: 'table',
    label: 'Table',
    description: 'Display data in tabular format',
    icon: 'Table',
    category: 'other',
    requiresData: true,
  },
  {
    value: 'counter',
    label: 'Counter (KPI)',
    description: 'Display a single metric value',
    icon: 'Hash',
    category: 'kpi',
    requiresData: true,
  },
  {
    value: 'pivot',
    label: 'Pivot Table',
    description: 'Summarize data with row/column grouping',
    icon: 'Grid3X3',
    category: 'other',
    requiresData: true,
  },
  {
    value: 'markdown',
    label: 'Markdown',
    description: 'Display formatted text',
    icon: 'FileText',
    category: 'other',
    requiresData: false,
  },
]

/**
 * Get chart type info by value
 */
export function getChartTypeInfo(type: ChartType): ChartTypeInfo | undefined {
  return CHART_TYPES.find(t => t.value === type)
}

/**
 * Get chart types that render with ECharts
 */
export function getEChartsTypes(): ChartType[] {
  return [
    // Basic
    'bar', 'line', 'area', 'pie', 'scatter',
    // Phase 1
    'donut', 'combo', 'heatmap',
    // Phase 2
    'gauge', 'progress',
    // Phase 4
    'funnel', 'treemap', 'bubble', 'sunburst', 'boxplot',
  ]
}

/**
 * Check if a chart type uses ECharts for rendering
 */
export function isEChartsType(type: ChartType): boolean {
  return getEChartsTypes().includes(type)
}

/**
 * Get chart types for UI dropdown (grouped by category)
 */
export function getChartTypesForDropdown(): { label: string; options: ChartTypeInfo[] }[] {
  const categories: Record<string, ChartTypeInfo[]> = {}

  for (const chartType of CHART_TYPES) {
    if (!categories[chartType.category]) {
      categories[chartType.category] = []
    }
    categories[chartType.category].push(chartType)
  }

  const categoryLabels: Record<string, string> = {
    basic: 'Basic Charts',
    comparison: 'Comparison',
    composition: 'Composition',
    distribution: 'Distribution',
    relationship: 'Relationship',
    kpi: 'KPI & Metrics',
    other: 'Other',
  }

  return Object.entries(categories).map(([category, options]) => ({
    label: categoryLabels[category] || category,
    options,
  }))
}

/**
 * Get all chart type values (for type validation)
 */
export function getAllChartTypes(): ChartType[] {
  return CHART_TYPES.map(t => t.value)
}

/**
 * List of currently implemented chart types
 * ECharts types with option builders + non-ECharts widgets
 */
const IMPLEMENTED_CHART_TYPES: ChartType[] = [
  // Basic ECharts
  'bar', 'line', 'area', 'pie', 'scatter',
  // Phase 1: Enhanced ECharts
  'donut', 'combo', 'heatmap',
  // Phase 2: KPI ECharts
  'gauge', 'progress',
  // Phase 4: Advanced visualization
  'funnel', 'treemap', 'bubble', 'sunburst', 'boxplot',
  // Non-ECharts widgets
  'table', 'counter', 'pivot', 'markdown',
]

/**
 * Get implemented chart types for UI dropdowns
 * Single source of truth for Add Widget and Widget Settings dialogs
 */
export function getImplementedChartTypeOptions(): { value: ChartType; label: string }[] {
  return CHART_TYPES
    .filter(t => IMPLEMENTED_CHART_TYPES.includes(t.value))
    .map(t => ({ value: t.value, label: t.label }))
}

/**
 * Check if a chart type is implemented
 */
export function isImplementedChartType(type: ChartType): boolean {
  return IMPLEMENTED_CHART_TYPES.includes(type)
}
