import React, { useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Responsive, WidthProvider, Layout, Layouts } from 'react-grid-layout'

// CompactType is not exported from react-grid-layout, so we define it locally
type CompactType = 'horizontal' | 'vertical' | null
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import './DashboardGrid.css'

const ResponsiveGridLayout = WidthProvider(Responsive)
import type { Dashboard, Widget, Breakpoint, ResponsivePositions, Position } from '@/types'
import { ChartWidget } from './ChartWidget'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Trash2, Settings, RefreshCw, Copy, Monitor, Tablet, Smartphone, AlignVerticalJustifyStart, AlignHorizontalJustifyStart, LayoutGrid } from 'lucide-react'

// Responsive breakpoints
const breakpoints = { lg: 1200, md: 996, sm: 768, xs: 480 }
const cols = { lg: 12, md: 10, sm: 6, xs: 4 }

// Widget size constraints
const MIN_WIDGET_WIDTH = 2
const MIN_WIDGET_HEIGHT = 2
const MAX_WIDGET_WIDTH = 12
const MAX_WIDGET_HEIGHT = 8

interface DashboardGridProps {
  dashboard: Dashboard
  onLayoutChange?: (layout: Layout[]) => void
  onLayoutChangeComplete?: (layout: Layout[], breakpoint: Breakpoint) => void  // Called on drag/resize stop with breakpoint
  onAllLayoutsChange?: (layouts: Record<string, ResponsivePositions>) => void  // Called with all breakpoint layouts
  editable?: boolean
  onDeleteWidget?: (widgetId: string) => void
  onDuplicateWidget?: (widget: Widget) => void
  onSettingsClick?: (widget: Widget) => void
  parameterValues?: Record<string, string>
  refreshKeys?: Record<string, number>  // Per-widget refresh keys
  onRefreshWidget?: (widgetId: string) => void
  onParametersDiscovered?: (widgetId: string, requiredParams: string[], missingParams: string[]) => void
  onCrossFilter?: (parameterUpdates: Record<string, string>) => void
}

// Preview width presets
type PreviewMode = 'auto' | 'desktop' | 'tablet' | 'mobile'
const previewWidths: Record<PreviewMode, number | undefined> = {
  auto: undefined,
  desktop: 1400,
  tablet: 800,
  mobile: 400,
}

export const DashboardGrid: React.FC<DashboardGridProps> = ({
  dashboard,
  onLayoutChange,
  onLayoutChangeComplete,
  onAllLayoutsChange,
  editable = false,
  onDeleteWidget,
  onDuplicateWidget,
  onSettingsClick,
  parameterValues = {},
  refreshKeys = {},
  onRefreshWidget,
  onParametersDiscovered,
  onCrossFilter,
}) => {
  const { t } = useTranslation()
  const [previewMode, setPreviewMode] = useState<PreviewMode>('auto')
  const [currentBreakpoint, setCurrentBreakpoint] = useState<string>('lg')
  const [compactType, setCompactType] = useState<CompactType>('vertical')

  // Track all layouts for each breakpoint
  const layoutsRef = useRef<Layouts>({})

  // Generate layouts for all breakpoints - use responsive_positions if available
  const generateLayouts = useCallback((): Layouts => {
    const allBreakpoints: Breakpoint[] = ['lg', 'md', 'sm', 'xs']
    const result: Layouts = {}

    allBreakpoints.forEach(bp => {
      result[bp] = dashboard.widgets?.map(widget => {
        // Check if widget has saved position for this breakpoint
        const savedPos = widget.responsive_positions?.[bp]
        const basePos = widget.position

        let pos: Position
        if (savedPos) {
          // Use saved position for this breakpoint
          pos = savedPos
        } else if (bp === 'lg') {
          // Use base position for lg
          pos = basePos
        } else {
          // Derive from lg position with adjustments for smaller screens
          const lgW = basePos.w
          const lgX = basePos.x
          if (bp === 'md') {
            pos = {
              x: Math.min(lgX, cols.md - Math.min(lgW, cols.md)),
              y: basePos.y,
              w: Math.min(lgW, cols.md),
              h: basePos.h,
            }
          } else if (bp === 'sm') {
            pos = {
              x: 0,
              y: basePos.y,
              w: Math.min(lgW, cols.sm),
              h: basePos.h,
            }
          } else {
            // xs
            pos = {
              x: 0,
              y: basePos.y,
              w: cols.xs,
              h: basePos.h,
            }
          }
        }

        return {
          i: widget.id,
          x: pos.x,
          y: pos.y,
          w: pos.w,
          h: pos.h,
          minW: MIN_WIDGET_WIDTH,
          minH: MIN_WIDGET_HEIGHT,
          maxW: MAX_WIDGET_WIDTH,
          maxH: MAX_WIDGET_HEIGHT,
        }
      }) || []
    })

    layoutsRef.current = result
    return result
  }, [dashboard.widgets])

  const handleLayoutChange = (currentLayout: Layout[], allLayouts: Layouts) => {
    // Update tracked layouts
    layoutsRef.current = allLayouts

    // Only propagate changes for the lg (desktop) layout to onLayoutChange
    if (onLayoutChange && editable && currentBreakpoint === 'lg') {
      onLayoutChange(currentLayout)
    }
  }

  // Helper to build responsive positions from current layouts
  const buildResponsivePositions = useCallback((widgetId: string): ResponsivePositions => {
    const result: ResponsivePositions = {}
    const allBreakpoints: Breakpoint[] = ['lg', 'md', 'sm', 'xs']

    allBreakpoints.forEach(bp => {
      const layout = layoutsRef.current[bp]
      if (layout) {
        const item = layout.find(l => l.i === widgetId)
        if (item) {
          result[bp] = { x: item.x, y: item.y, w: item.w, h: item.h }
        }
      }
    })

    return result
  }, [])

  // Called when drag or resize operation is complete
  const handleDragStop = (layout: Layout[], _oldItem: Layout, newItem: Layout, _placeholder: Layout, _e: MouseEvent, _element: HTMLElement) => {
    if (!editable) return

    // Update the layouts ref with the new layout for current breakpoint
    layoutsRef.current[currentBreakpoint] = layout

    const bp = currentBreakpoint as Breakpoint
    if (onLayoutChangeComplete) {
      onLayoutChangeComplete(layout, bp)
    }

    // Also report all layouts for all widgets if callback provided
    if (onAllLayoutsChange) {
      const allResponsivePositions: Record<string, ResponsivePositions> = {}
      dashboard.widgets?.forEach(widget => {
        allResponsivePositions[widget.id] = buildResponsivePositions(widget.id)
      })
      // Update the position for the item that was just moved
      if (allResponsivePositions[newItem.i]) {
        allResponsivePositions[newItem.i][bp] = {
          x: newItem.x,
          y: newItem.y,
          w: newItem.w,
          h: newItem.h,
        }
      }
      onAllLayoutsChange(allResponsivePositions)
    }
  }

  const handleResizeStop = (layout: Layout[], _oldItem: Layout, newItem: Layout, _placeholder: Layout, _e: MouseEvent, _element: HTMLElement) => {
    if (!editable) return

    // Update the layouts ref with the new layout for current breakpoint
    layoutsRef.current[currentBreakpoint] = layout

    const bp = currentBreakpoint as Breakpoint
    if (onLayoutChangeComplete) {
      onLayoutChangeComplete(layout, bp)
    }

    // Also report all layouts for all widgets if callback provided
    if (onAllLayoutsChange) {
      const allResponsivePositions: Record<string, ResponsivePositions> = {}
      dashboard.widgets?.forEach(widget => {
        allResponsivePositions[widget.id] = buildResponsivePositions(widget.id)
      })
      // Update the position for the item that was just resized
      if (allResponsivePositions[newItem.i]) {
        allResponsivePositions[newItem.i][bp] = {
          x: newItem.x,
          y: newItem.y,
          w: newItem.w,
          h: newItem.h,
        }
      }
      onAllLayoutsChange(allResponsivePositions)
    }
  }

  const handleBreakpointChange = (newBreakpoint: string) => {
    setCurrentBreakpoint(newBreakpoint)
  }

  const isEmpty = !dashboard.widgets || dashboard.widgets.length === 0
  const gridClassName = [
    'layout',
    'dashboard-grid',
    editable ? 'editing' : '',
    editable && isEmpty ? 'empty' : '',
  ].filter(Boolean).join(' ')

  // Show empty state message when in edit mode with no widgets
  if (editable && isEmpty) {
    return (
      <div className={gridClassName}>
        <p className="text-muted-foreground text-sm">
          {t('dashboard.grid.emptyState')}
        </p>
      </div>
    )
  }

  const previewWidth = previewWidths[previewMode]

  return (
    <div>
      {/* Preview mode selector (only in edit mode) */}
      {editable && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-muted-foreground">{t('dashboard.grid.previewMode', 'Preview:')}</span>
          <div className="flex border rounded-md">
            <Button
              variant={previewMode === 'auto' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setPreviewMode('auto')}
              className="rounded-r-none px-2"
              title={t('dashboard.grid.previewAuto', 'Auto')}
            >
              Auto
            </Button>
            <Button
              variant={previewMode === 'desktop' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setPreviewMode('desktop')}
              className="rounded-none border-l px-2"
              title={t('dashboard.grid.previewDesktop', 'Desktop')}
            >
              <Monitor className="h-4 w-4" />
            </Button>
            <Button
              variant={previewMode === 'tablet' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setPreviewMode('tablet')}
              className="rounded-none border-l px-2"
              title={t('dashboard.grid.previewTablet', 'Tablet')}
            >
              <Tablet className="h-4 w-4" />
            </Button>
            <Button
              variant={previewMode === 'mobile' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setPreviewMode('mobile')}
              className="rounded-l-none border-l px-2"
              title={t('dashboard.grid.previewMobile', 'Mobile')}
            >
              <Smartphone className="h-4 w-4" />
            </Button>
          </div>
          <span className="text-xs text-muted-foreground">
            ({currentBreakpoint.toUpperCase()})
          </span>

          {/* Compact mode selector */}
          <div className="flex items-center gap-2 ml-4">
            <span className="text-sm text-muted-foreground">{t('dashboard.grid.compactMode', 'Compact:')}</span>
            <div className="flex border rounded-md">
              <Button
                variant={compactType === 'vertical' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setCompactType('vertical')}
                className="rounded-r-none px-2"
                title={t('dashboard.grid.compactVertical', 'Vertical')}
              >
                <AlignVerticalJustifyStart className="h-4 w-4" />
              </Button>
              <Button
                variant={compactType === 'horizontal' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setCompactType('horizontal')}
                className="rounded-none border-l px-2"
                title={t('dashboard.grid.compactHorizontal', 'Horizontal')}
              >
                <AlignHorizontalJustifyStart className="h-4 w-4" />
              </Button>
              <Button
                variant={compactType === null ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setCompactType(null)}
                className="rounded-l-none border-l px-2"
                title={t('dashboard.grid.compactNone', 'None (Free)')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <div
        style={previewWidth ? {
          maxWidth: previewWidth,
          margin: '0 auto',
          border: '1px dashed var(--border)',
          borderRadius: '8px',
          padding: '8px',
        } : undefined}
      >
        <ResponsiveGridLayout
          className={gridClassName}
          layouts={generateLayouts()}
          breakpoints={breakpoints}
          cols={cols}
          rowHeight={80}
          onLayoutChange={handleLayoutChange}
          onBreakpointChange={handleBreakpointChange}
          onDragStop={handleDragStop}
          onResizeStop={handleResizeStop}
          isDraggable={editable}
          isResizable={editable}
          draggableHandle=".drag-handle"
          compactType={compactType}
          preventCollision={false}
          width={previewWidth}
        >
          {dashboard.widgets?.map(widget => (
            <div key={widget.id}>
              <Card className="h-full flex flex-col">
                <CardHeader className="py-2 px-4 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm font-medium drag-handle cursor-move">
                    {widget.name}
                  </CardTitle>
                  <div className="flex gap-1">
                    {/* Refresh button - only for data widgets, not markdown */}
                    {!editable && widget.chart_type !== 'markdown' && widget.query_id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => onRefreshWidget?.(widget.id)}
                        title={t('dashboard.grid.refresh')}
                      >
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                    )}
                    {editable && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => onSettingsClick?.(widget)}
                          title={t('dashboard.grid.settings')}
                        >
                          <Settings className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => onDuplicateWidget?.(widget)}
                          title={t('dashboard.grid.duplicate')}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => onDeleteWidget?.(widget.id)}
                          title={t('dashboard.grid.delete')}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 p-2 pt-0">
                  <ChartWidget
                    widget={widget}
                    dashboardId={dashboard.id}
                    parameterValues={parameterValues}
                    refreshKey={refreshKeys[widget.id] || 0}
                    onParametersDiscovered={onParametersDiscovered}
                    onCrossFilter={onCrossFilter}
                  />
                </CardContent>
              </Card>
            </div>
          ))}
        </ResponsiveGridLayout>
      </div>
    </div>
  )
}
