import type { LayoutTemplate } from '@/types'

/**
 * Built-in layout templates for dashboard creation
 */
export const systemLayoutTemplates: LayoutTemplate[] = [
  {
    id: 'blank',
    name: 'Blank',
    description: 'Start with an empty dashboard',
    layout: [],
    is_system: true,
  },
  {
    id: 'kpi-row-chart',
    name: 'KPI Row + Chart',
    description: 'Top KPIs with main chart below',
    layout: [
      { x: 0, y: 0, w: 3, h: 2 },  // KPI 1
      { x: 3, y: 0, w: 3, h: 2 },  // KPI 2
      { x: 6, y: 0, w: 3, h: 2 },  // KPI 3
      { x: 9, y: 0, w: 3, h: 2 },  // KPI 4
      { x: 0, y: 2, w: 12, h: 4 }, // Main chart
    ],
    is_system: true,
  },
  {
    id: 'two-column',
    name: 'Two Column',
    description: 'Side by side charts',
    layout: [
      { x: 0, y: 0, w: 6, h: 4 },
      { x: 6, y: 0, w: 6, h: 4 },
    ],
    is_system: true,
  },
  {
    id: 'three-column',
    name: 'Three Column',
    description: 'Three equal width charts',
    layout: [
      { x: 0, y: 0, w: 4, h: 4 },
      { x: 4, y: 0, w: 4, h: 4 },
      { x: 8, y: 0, w: 4, h: 4 },
    ],
    is_system: true,
  },
  {
    id: 'main-sidebar',
    name: 'Main + Sidebar',
    description: 'Large main area with sidebar',
    layout: [
      { x: 0, y: 0, w: 8, h: 5 },  // Main chart
      { x: 8, y: 0, w: 4, h: 2 },  // Sidebar top
      { x: 8, y: 2, w: 4, h: 3 },  // Sidebar bottom
    ],
    is_system: true,
  },
  {
    id: 'grid-2x2',
    name: 'Grid 2x2',
    description: '2x2 grid of equal charts',
    layout: [
      { x: 0, y: 0, w: 6, h: 3 },
      { x: 6, y: 0, w: 6, h: 3 },
      { x: 0, y: 3, w: 6, h: 3 },
      { x: 6, y: 3, w: 6, h: 3 },
    ],
    is_system: true,
  },
  {
    id: 'executive-summary',
    name: 'Executive Summary',
    description: 'KPIs on top, two charts below, table at bottom',
    layout: [
      { x: 0, y: 0, w: 3, h: 2 },  // KPI 1
      { x: 3, y: 0, w: 3, h: 2 },  // KPI 2
      { x: 6, y: 0, w: 3, h: 2 },  // KPI 3
      { x: 9, y: 0, w: 3, h: 2 },  // KPI 4
      { x: 0, y: 2, w: 6, h: 3 },  // Chart left
      { x: 6, y: 2, w: 6, h: 3 },  // Chart right
      { x: 0, y: 5, w: 12, h: 4 }, // Table
    ],
    is_system: true,
  },
]

/**
 * Get all available layout templates (system + custom)
 */
export function getLayoutTemplates(customTemplates?: LayoutTemplate[]): LayoutTemplate[] {
  return [...systemLayoutTemplates, ...(customTemplates || [])]
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string, customTemplates?: LayoutTemplate[]): LayoutTemplate | undefined {
  return getLayoutTemplates(customTemplates).find(t => t.id === id)
}
