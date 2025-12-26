import React from 'react'
import { useTranslation } from 'react-i18next'
import GridLayout, { Layout, WidthProvider } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import './DashboardGrid.css'

const ResponsiveGridLayout = WidthProvider(GridLayout)
import type { Dashboard, Widget } from '@/types'
import { ChartWidget } from './ChartWidget'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Trash2, Settings, RefreshCw, Copy } from 'lucide-react'

interface DashboardGridProps {
  dashboard: Dashboard
  onLayoutChange?: (layout: Layout[]) => void
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

export const DashboardGrid: React.FC<DashboardGridProps> = ({
  dashboard,
  onLayoutChange,
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

  const layout: Layout[] = dashboard.widgets?.map(widget => ({
    i: widget.id,
    x: widget.position.x,
    y: widget.position.y,
    w: widget.position.w,
    h: widget.position.h,
  })) || []

  const handleLayoutChange = (newLayout: Layout[]) => {
    if (onLayoutChange && editable) {
      onLayoutChange(newLayout)
    }
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

  return (
    <ResponsiveGridLayout
      className={gridClassName}
      layout={layout}
      cols={12}
      rowHeight={80}
      onLayoutChange={handleLayoutChange}
      isDraggable={editable}
      isResizable={editable}
      draggableHandle=".drag-handle"
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
  )
}
