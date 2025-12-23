import { describe, it, expect } from 'vitest'
import {
  buildDashboardUrl,
  resolveTableDrilldown,
  resolveChartDrilldown,
  resolveTextTemplate,
  getColumnLinkConfig,
  type RowContext,
  type ChartClickData,
} from './drilldown'
import type { ColumnLinkConfig, ChartDrilldownConfig } from '@/types'

describe('buildDashboardUrl', () => {
  it('should build URL without parameters', () => {
    const url = buildDashboardUrl('dashboard-123', {})
    expect(url).toBe('/dashboards/dashboard-123')
  })

  it('should build URL with single parameter', () => {
    const url = buildDashboardUrl('dashboard-123', { customer: 'abc' })
    expect(url).toBe('/dashboards/dashboard-123?p_customer=abc')
  })

  it('should build URL with multiple parameters', () => {
    const url = buildDashboardUrl('dashboard-123', { customer: 'abc', date: '2024-01' })
    expect(url).toContain('/dashboards/dashboard-123?')
    expect(url).toContain('p_customer=abc')
    expect(url).toContain('p_date=2024-01')
  })

  it('should skip empty values', () => {
    const url = buildDashboardUrl('dashboard-123', { customer: 'abc', empty: '' })
    expect(url).toBe('/dashboards/dashboard-123?p_customer=abc')
  })

  it('should skip null values', () => {
    const url = buildDashboardUrl('dashboard-123', { customer: 'abc', empty: null as unknown as string })
    expect(url).toBe('/dashboards/dashboard-123?p_customer=abc')
  })

  it('should URL encode special characters', () => {
    const url = buildDashboardUrl('dashboard-123', { name: 'hello world' })
    expect(url).toBe('/dashboards/dashboard-123?p_name=hello+world')
  })
})

describe('resolveTableDrilldown', () => {
  const context: RowContext = {
    columns: ['id', 'name', 'region'],
    row: [123, 'Alice', 'Asia'],
    currentColumnIndex: 0,
  }

  it('should resolve @ placeholder to current cell value', () => {
    const config: ColumnLinkConfig = {
      column: 'id',
      targetDashboardId: 'dash-1',
      parameterMapping: { userId: '@' },
    }
    const url = resolveTableDrilldown(config, context)
    expect(url).toBe('/dashboards/dash-1?p_userId=123')
  })

  it('should resolve column name reference', () => {
    const config: ColumnLinkConfig = {
      column: 'id',
      targetDashboardId: 'dash-1',
      parameterMapping: { region: 'region' },
    }
    const url = resolveTableDrilldown(config, context)
    expect(url).toBe('/dashboards/dash-1?p_region=Asia')
  })

  it('should resolve multiple mappings', () => {
    const config: ColumnLinkConfig = {
      column: 'id',
      targetDashboardId: 'dash-1',
      parameterMapping: { userId: '@', name: 'name' },
    }
    const url = resolveTableDrilldown(config, context)
    expect(url).toContain('p_userId=123')
    expect(url).toContain('p_name=Alice')
  })

  it('should handle missing column gracefully', () => {
    const config: ColumnLinkConfig = {
      column: 'id',
      targetDashboardId: 'dash-1',
      parameterMapping: { unknown: 'nonexistent' },
    }
    const url = resolveTableDrilldown(config, context)
    expect(url).toBe('/dashboards/dash-1')
  })

  it('should handle null cell value', () => {
    const nullContext: RowContext = {
      columns: ['id', 'name'],
      row: [null, 'Alice'],
      currentColumnIndex: 0,
    }
    const config: ColumnLinkConfig = {
      column: 'id',
      targetDashboardId: 'dash-1',
      parameterMapping: { userId: '@' },
    }
    const url = resolveTableDrilldown(config, nullContext)
    expect(url).toBe('/dashboards/dash-1')
  })
})

describe('resolveChartDrilldown', () => {
  const clickData: ChartClickData = {
    name: 'Food',
    value: 1500,
    seriesName: '2024-01',
    dataIndex: 0,
  }

  it('should resolve name placeholder', () => {
    const config: ChartDrilldownConfig = {
      targetDashboardId: 'dash-1',
      parameterMapping: { category: 'name' },
    }
    const url = resolveChartDrilldown(config, clickData)
    expect(url).toBe('/dashboards/dash-1?p_category=Food')
  })

  it('should resolve value placeholder', () => {
    const config: ChartDrilldownConfig = {
      targetDashboardId: 'dash-1',
      parameterMapping: { amount: 'value' },
    }
    const url = resolveChartDrilldown(config, clickData)
    expect(url).toBe('/dashboards/dash-1?p_amount=1500')
  })

  it('should resolve series placeholder', () => {
    const config: ChartDrilldownConfig = {
      targetDashboardId: 'dash-1',
      parameterMapping: { month: 'series' },
    }
    const url = resolveChartDrilldown(config, clickData)
    expect(url).toBe('/dashboards/dash-1?p_month=2024-01')
  })

  it('should resolve column reference with row data', () => {
    const config: ChartDrilldownConfig = {
      targetDashboardId: 'dash-1',
      parameterMapping: { category: 'name', region: 'region' },
    }
    const columns = ['category', 'region', 'amount']
    const row = ['Food', 'Asia', 1500]
    const url = resolveChartDrilldown(config, clickData, columns, row)
    expect(url).toContain('p_category=Food')
    expect(url).toContain('p_region=Asia')
  })

  it('should handle missing series gracefully', () => {
    const clickDataNoSeries: ChartClickData = {
      name: 'Food',
      value: 1500,
    }
    const config: ChartDrilldownConfig = {
      targetDashboardId: 'dash-1',
      parameterMapping: { month: 'series' },
    }
    const url = resolveChartDrilldown(config, clickDataNoSeries)
    expect(url).toBe('/dashboards/dash-1')
  })
})

describe('resolveTextTemplate', () => {
  const context: RowContext = {
    columns: ['id', 'name', 'region'],
    row: [123, 'Alice', 'Asia'],
    currentColumnIndex: 0,
  }

  it('should resolve @ placeholder', () => {
    const result = resolveTextTemplate('ID: {{@}}', context)
    expect(result).toBe('ID: 123')
  })

  it('should resolve column name placeholder', () => {
    const result = resolveTextTemplate('Name: {{name}}', context)
    expect(result).toBe('Name: Alice')
  })

  it('should resolve multiple placeholders', () => {
    const result = resolveTextTemplate('{{name}} ({{region}})', context)
    expect(result).toBe('Alice (Asia)')
  })

  it('should keep unresolved placeholders', () => {
    const result = resolveTextTemplate('{{unknown}}', context)
    expect(result).toBe('{{unknown}}')
  })

  it('should handle mixed placeholders', () => {
    const result = resolveTextTemplate('View {{@}} - {{name}}', context)
    expect(result).toBe('View 123 - Alice')
  })
})

describe('getColumnLinkConfig', () => {
  const columnLinks: ColumnLinkConfig[] = [
    {
      column: 'id',
      targetDashboardId: 'dash-1',
      parameterMapping: { userId: '@' },
    },
    {
      column: 'name',
      targetDashboardId: 'dash-2',
      parameterMapping: { name: '@' },
    },
  ]

  it('should find config for existing column', () => {
    const config = getColumnLinkConfig(columnLinks, 'id')
    expect(config).toBeDefined()
    expect(config?.targetDashboardId).toBe('dash-1')
  })

  it('should return undefined for non-linked column', () => {
    const config = getColumnLinkConfig(columnLinks, 'region')
    expect(config).toBeUndefined()
  })

  it('should return undefined when columnLinks is undefined', () => {
    const config = getColumnLinkConfig(undefined, 'id')
    expect(config).toBeUndefined()
  })
})
