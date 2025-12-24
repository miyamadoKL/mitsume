import type { EChartsOption } from 'echarts'
import type { ChartType, QueryResult, ChartConfig } from '@/types'
import type { ChartBuilderInput, ChartOptionBuilder } from './types'
import { buildBarOptions } from './builders/bar'
import { buildLineOptions } from './builders/line'
import { buildAreaOptions } from './builders/area'
import { buildPieOptions } from './builders/pie'
import { buildScatterOptions } from './builders/scatter'
import { buildDonutOptions } from './builders/donut'
import { buildComboOptions } from './builders/combo'
import { buildHeatmapOptions } from './builders/heatmap'
import { buildGaugeOptions } from './builders/gauge'
import { buildProgressOptions } from './builders/progress'
// Phase 4: Advanced visualization
import { buildFunnelOptions } from './builders/funnel'
import { buildTreemapOptions } from './builders/treemap'
import { buildBubbleOptions } from './builders/bubble'
import { buildSunburstOptions } from './builders/sunburst'
import { buildBoxplotOptions } from './builders/boxplot'
import { isEChartsType } from './registry'

/**
 * Map of chart types to their option builders
 */
const chartBuilders: Partial<Record<ChartType, ChartOptionBuilder>> = {
  bar: buildBarOptions,
  line: buildLineOptions,
  area: buildAreaOptions,
  pie: buildPieOptions,
  scatter: buildScatterOptions,
  donut: buildDonutOptions,
  combo: buildComboOptions,
  heatmap: buildHeatmapOptions,
  gauge: buildGaugeOptions,
  progress: buildProgressOptions,
  // Phase 4: Advanced visualization
  funnel: buildFunnelOptions,
  treemap: buildTreemapOptions,
  bubble: buildBubbleOptions,
  sunburst: buildSunburstOptions,
  boxplot: buildBoxplotOptions,
}

/**
 * Build ECharts options for the given chart type
 * Returns empty object if no data or unsupported chart type
 */
export function buildChartOptions(
  type: ChartType,
  data: QueryResult | null,
  config: ChartConfig
): EChartsOption {
  if (!data) return {}
  if (!isEChartsType(type)) return {}

  const builder = chartBuilders[type]
  if (!builder) return {}

  const input: ChartBuilderInput = { type, data, config }
  return builder(input)
}

// Re-export types and registry
export * from './types'
export * from './registry'
export * from './builders'
