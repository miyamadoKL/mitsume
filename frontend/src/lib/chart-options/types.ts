import type { QueryResult, ChartConfig, ChartType } from '@/types'
import type { EChartsOption } from 'echarts'

/**
 * Input data for chart option builders
 */
export interface ChartBuilderInput {
  type: ChartType
  data: QueryResult
  config: ChartConfig
}

/**
 * Chart option builder function signature
 */
export type ChartOptionBuilder = (input: ChartBuilderInput) => EChartsOption

/**
 * Chart type metadata for UI display
 */
export interface ChartTypeInfo {
  value: ChartType
  label: string
  description: string
  icon: string
  category: 'basic' | 'distribution' | 'comparison' | 'composition' | 'relationship' | 'kpi' | 'other'
  requiresData: boolean
}

/**
 * Parsed axis configuration
 */
export interface AxisConfig {
  xAxisIndex: number
  xAxisColumn: string
  yAxisIndices: number[]
  yAxisColumns: string[]
  xData: unknown[]
  isTimeAxis: boolean
}

/**
 * Series data for ECharts
 */
export interface SeriesData {
  name: string
  type: string
  data: unknown[]
  [key: string]: unknown
}
