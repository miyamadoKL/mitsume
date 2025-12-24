export { buildBarOptions } from './bar'
export { buildLineOptions } from './line'
export { buildAreaOptions } from './area'
export { buildPieOptions } from './pie'
export { buildScatterOptions } from './scatter'
export { buildDonutOptions } from './donut'
export { buildComboOptions } from './combo'
export { buildHeatmapOptions } from './heatmap'
export { buildGaugeOptions } from './gauge'
export { buildProgressOptions } from './progress'

// Phase 4: Advanced visualization
export { buildFunnelOptions } from './funnel'
export { buildTreemapOptions } from './treemap'
export { buildBubbleOptions } from './bubble'
export { buildSunburstOptions } from './sunburst'
export { buildBoxplotOptions } from './boxplot'

// Re-export common utilities for external use
export {
  parseAxisConfig,
  extractSeriesData,
  formatValue,
} from './common'
