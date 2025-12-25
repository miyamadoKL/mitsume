import React, { useEffect, useState, useMemo, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Layout } from 'react-grid-layout'
import { dashboardApi, queryApi } from '@/services/api'
import type { Dashboard, SavedQuery, ChartType, CreateWidgetRequest, Widget, PermissionLevel } from '@/types'
import { DashboardGrid } from '@/components/dashboard/DashboardGrid'
import { DashboardParameters } from '@/components/dashboard/DashboardParameters'
import { WidgetSettingsDialog } from '@/components/dashboard/WidgetSettingsDialog'
import { ShareDashboardDialog } from '@/components/dashboard/ShareDashboardDialog'
import { QuickAddPanel } from '@/components/dashboard/QuickAddPanel'
import { DashboardExportButton } from '@/components/export/DashboardExportButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { toast } from '@/stores/toastStore'
import { getErrorMessage } from '@/lib/errors'
import { extractAllParameters } from '@/lib/params'
import { ArrowLeft, Plus, Loader2, Edit, Save, RefreshCw, Share2, Eye, Globe } from 'lucide-react'
import { getImplementedChartTypeOptions } from '@/lib/chart-options'

export const DashboardDetail: React.FC = () => {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [addWidgetOpen, setAddWidgetOpen] = useState(false)
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([])
  const [saving, setSaving] = useState(false)
  const [parameterValues, setParameterValues] = useState<Record<string, string>>({})

  // Refresh state
  const [refreshKeys, setRefreshKeys] = useState<Record<string, number>>({})
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(0)

  // Widget form state
  const [widgetName, setWidgetName] = useState('')
  const [selectedQueryId, setSelectedQueryId] = useState('')
  const [chartType, setChartType] = useState<ChartType>('bar')

  // Widget settings dialog state
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)
  const [editingWidget, setEditingWidget] = useState<Widget | null>(null)

  // Share dialog state
  const [shareDialogOpen, setShareDialogOpen] = useState(false)

  // Ref for export functionality
  const dashboardContentRef = useRef<HTMLDivElement>(null)

  const autoRefreshOptions: { value: string; label: string }[] = [
    { value: '0', label: t('dashboard.detail.autoRefreshOptions.off') },
    { value: '30', label: t('dashboard.detail.autoRefreshOptions.seconds30') },
    { value: '60', label: t('dashboard.detail.autoRefreshOptions.minute1') },
    { value: '300', label: t('dashboard.detail.autoRefreshOptions.minutes5') },
    { value: '600', label: t('dashboard.detail.autoRefreshOptions.minutes10') },
  ]

  const chartTypeOptions = getImplementedChartTypeOptions().map(option => ({
    ...option,
    label: t(`chart.types.${option.value}`, { defaultValue: option.label }),
  }))

  // Permission helpers
  const myPermission: PermissionLevel = dashboard?.my_permission || 'owner'
  const canEdit = myPermission === 'owner' || myPermission === 'edit'
  const isOwner = myPermission === 'owner'

  useEffect(() => {
    if (id) {
      loadDashboard()
      loadSavedQueries()
    }
  }, [id])

  // Extract all parameters from saved queries used by widgets
  const allParameters = useMemo(() => {
    const queryTexts = savedQueries
      .filter(q => dashboard?.widgets?.some(w => w.query_id === q.id))
      .map(q => q.query_text)
    return extractAllParameters(queryTexts)
  }, [savedQueries, dashboard?.widgets])

  // Initialize parameter values from URL on mount
  useEffect(() => {
    const initialParams: Record<string, string> = {}
    searchParams.forEach((value, key) => {
      if (key.startsWith('p_')) {
        initialParams[key.slice(2)] = value
      }
    })
    if (Object.keys(initialParams).length > 0) {
      setParameterValues(initialParams)
    }
  }, [])

  const handleParameterChange = (name: string, value: string) => {
    setParameterValues(prev => ({ ...prev, [name]: value }))
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (value) {
        next.set(`p_${name}`, value)
      } else {
        next.delete(`p_${name}`)
      }
      return next
    })
  }

  // Refresh a single widget
  const handleRefreshWidget = (widgetId: string) => {
    setRefreshKeys(prev => ({
      ...prev,
      [widgetId]: (prev[widgetId] || 0) + 1,
    }))
  }

  // Refresh all widgets
  const handleRefreshAll = () => {
    if (!dashboard?.widgets) return
    const newKeys: Record<string, number> = {}
    for (const widget of dashboard.widgets) {
      if (widget.chart_type !== 'markdown' && widget.query_id) {
        newKeys[widget.id] = (refreshKeys[widget.id] || 0) + 1
      }
    }
    setRefreshKeys(prev => ({ ...prev, ...newKeys }))
    toast.success(t('dashboard.detail.toast.refreshAll'))
  }

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefreshInterval <= 0) return
    const interval = setInterval(() => {
      handleRefreshAll()
    }, autoRefreshInterval * 1000)
    return () => clearInterval(interval)
  }, [autoRefreshInterval, dashboard?.widgets])

  const loadDashboard = async () => {
    if (!id) return
    try {
      const data = await dashboardApi.getById(id)
      setDashboard(data)
    } catch (err) {
      console.error('Failed to load dashboard:', err)
      navigate('/dashboards')
    } finally {
      setLoading(false)
    }
  }

  const loadSavedQueries = async () => {
    try {
      const queries = await queryApi.getSaved()
      setSavedQueries(queries)
    } catch (err) {
      console.error('Failed to load saved queries:', err)
    }
  }

  const handleLayoutChange = async (layout: Layout[]) => {
    if (!dashboard || !id) return

    const updatedWidgets = dashboard.widgets?.map(widget => {
      const layoutItem = layout.find(l => l.i === widget.id)
      if (layoutItem) {
        return {
          ...widget,
          position: {
            x: layoutItem.x,
            y: layoutItem.y,
            w: layoutItem.w,
            h: layoutItem.h,
          },
        }
      }
      return widget
    })

    setDashboard({ ...dashboard, widgets: updatedWidgets })

    // Save positions to backend
    for (const widget of updatedWidgets || []) {
      try {
        await dashboardApi.updateWidget(id, widget.id, {
          position: widget.position,
        })
      } catch (err) {
        console.error('Failed to update widget position:', err)
      }
    }
  }

  const handleAddWidget = async () => {
    if (!id || !widgetName.trim()) return
    setSaving(true)

    const maxY = dashboard?.widgets?.reduce((max, w) => Math.max(max, w.position.y + w.position.h), 0) || 0

    const req: CreateWidgetRequest = {
      name: widgetName,
      query_id: selectedQueryId || undefined,
      chart_type: chartType,
      chart_config: {},
      position: { x: 0, y: maxY, w: 6, h: 3 },
    }

    try {
      const widget = await dashboardApi.createWidget(id, req)
      setDashboard(prev => prev ? {
        ...prev,
        widgets: [...(prev.widgets || []), widget],
      } : null)
      setAddWidgetOpen(false)
      resetWidgetForm()
    } catch (err) {
      console.error('Failed to add widget:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleQuickAddWidget = async (type: ChartType) => {
    if (!id) return
    setSaving(true)

    const maxY = dashboard?.widgets?.reduce((max, w) => Math.max(max, w.position.y + w.position.h), 0) || 0
    const widgetCount = (dashboard?.widgets?.length || 0) + 1

    const req: CreateWidgetRequest = {
      name: `${t(`chart.types.${type}`)} ${widgetCount}`,
      query_id: undefined,
      chart_type: type,
      chart_config: type === 'markdown' ? { content: '' } : {},
      position: { x: 0, y: maxY, w: 6, h: 3 },
    }

    try {
      const widget = await dashboardApi.createWidget(id, req)
      setDashboard(prev => prev ? {
        ...prev,
        widgets: [...(prev.widgets || []), widget],
      } : null)
      // Open settings dialog for the new widget
      setEditingWidget(widget)
      setSettingsDialogOpen(true)
    } catch (err) {
      toast.error(t('dashboard.detail.toast.addWidgetFailed'), getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteWidget = async (widgetId: string) => {
    if (!id) return
    try {
      await dashboardApi.deleteWidget(id, widgetId)
      setDashboard(prev => prev ? {
        ...prev,
        widgets: prev.widgets?.filter(w => w.id !== widgetId),
      } : null)
      toast.success(t('dashboard.detail.toast.widgetDeleted'))
    } catch (err) {
      toast.error(t('dashboard.detail.toast.deleteWidgetFailed'), getErrorMessage(err))
    }
  }

  const handleDuplicateWidget = async (widget: Widget) => {
    if (!id) return
    setSaving(true)
    try {
      // Calculate position for duplicate (next row)
      const maxY = dashboard?.widgets?.reduce((max, w) => Math.max(max, w.position.y + w.position.h), 0) || 0

      const req: CreateWidgetRequest = {
        name: `${widget.name} (Copy)`,
        query_id: widget.query_id || undefined,
        chart_type: widget.chart_type,
        chart_config: widget.chart_config,
        position: { x: widget.position.x, y: maxY, w: widget.position.w, h: widget.position.h },
      }

      const newWidget = await dashboardApi.createWidget(id, req)
      setDashboard(prev => prev ? {
        ...prev,
        widgets: [...(prev.widgets || []), newWidget],
      } : null)
      toast.success(t('dashboard.detail.toast.widgetDuplicated'))
    } catch (err) {
      toast.error(t('dashboard.detail.toast.duplicateWidgetFailed'), getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleSettingsClick = (widget: Widget) => {
    setEditingWidget(widget)
    setSettingsDialogOpen(true)
  }

  const handleWidgetUpdate = async (updates: Partial<Widget>) => {
    if (!id || !editingWidget) return
    try {
      const updated = await dashboardApi.updateWidget(id, editingWidget.id, updates)
      setDashboard(prev => prev ? {
        ...prev,
        widgets: prev.widgets?.map(w => w.id === updated.id ? updated : w),
      } : null)
      setSettingsDialogOpen(false)
      setEditingWidget(null)
      toast.success(t('dashboard.detail.toast.widgetUpdated'))
    } catch (err) {
      toast.error(t('dashboard.detail.toast.updateWidgetFailed'), getErrorMessage(err))
      throw err
    }
  }

  const resetWidgetForm = () => {
    setWidgetName('')
    setSelectedQueryId('')
    setChartType('bar')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!dashboard) {
    return null
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboards')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">{dashboard.name}</h1>
              {/* Permission badge */}
              {myPermission === 'view' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                  <Eye className="h-3 w-3" />
                  {t('dashboard.permissions.viewOnly')}
                </span>
              )}
              {myPermission === 'edit' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-600">
                  <Edit className="h-3 w-3" />
                  {t('dashboard.permissions.canEdit')}
                </span>
              )}
              {dashboard.is_public && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-600">
                  <Globe className="h-3 w-3" />
                  {t('dashboard.permissions.public')}
                </span>
              )}
            </div>
            {dashboard.description && (
              <p className="text-sm text-muted-foreground">{dashboard.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Auto-refresh selector */}
          {!editMode && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t('dashboard.autoRefresh')}:</span>
              <Select
                value={String(autoRefreshInterval)}
                onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
                options={autoRefreshOptions}
                className="w-20"
              />
            </div>
          )}
          {/* Refresh all button */}
          {!editMode && (
            <Button variant="outline" onClick={handleRefreshAll}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('dashboard.refresh')}
            </Button>
          )}
          {/* Export button */}
          {!editMode && (
            <DashboardExportButton
              dashboardRef={dashboardContentRef}
              dashboardName={dashboard.name}
            />
          )}
          {/* Share button (only for owner) */}
          {isOwner && !editMode && (
            <Button variant="outline" onClick={() => setShareDialogOpen(true)}>
              <Share2 className="h-4 w-4 mr-2" />
              {t('dashboard.share')}
            </Button>
          )}
          {/* Edit button (only for edit permission or owner) */}
          {canEdit && (
            <Button
              variant={editMode ? 'default' : 'outline'}
              onClick={() => setEditMode(!editMode)}
            >
              {editMode ? <Save className="h-4 w-4 mr-2" /> : <Edit className="h-4 w-4 mr-2" />}
              {editMode ? t('common.done') : t('common.edit')}
            </Button>
          )}
          {editMode && (
            <Button onClick={() => setAddWidgetOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('dashboard.addWidget')}
            </Button>
          )}
        </div>
      </div>

      <DashboardParameters
        parameters={allParameters}
        values={parameterValues}
        onChange={handleParameterChange}
      />

      <div className="flex-1 overflow-auto p-4" ref={dashboardContentRef}>
        {editMode && <QuickAddPanel onAddWidget={handleQuickAddWidget} />}
        {dashboard.widgets && dashboard.widgets.length > 0 ? (
          <DashboardGrid
            dashboard={dashboard}
            onLayoutChange={handleLayoutChange}
            editable={editMode}
            onDeleteWidget={handleDeleteWidget}
            onDuplicateWidget={handleDuplicateWidget}
            onSettingsClick={handleSettingsClick}
            parameterValues={parameterValues}
            refreshKeys={refreshKeys}
            onRefreshWidget={handleRefreshWidget}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <p className="mb-4">{t('dashboard.detail.noWidgetsYet')}</p>
            <Button onClick={() => { setEditMode(true); setAddWidgetOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              {t('dashboard.addWidget')}
            </Button>
          </div>
        )}
      </div>

      <Dialog open={addWidgetOpen} onClose={() => setAddWidgetOpen(false)}>
        <DialogHeader>
          <DialogTitle>{t('dashboard.addWidget')}</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t('dashboard.detail.addWidgetDialog.widgetName')}</label>
              <Input
                value={widgetName}
                onChange={(e) => setWidgetName(e.target.value)}
                placeholder={t('dashboard.detail.addWidgetDialog.widgetNamePlaceholder')}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('dashboard.detail.addWidgetDialog.savedQuery')}</label>
              <Select
                value={selectedQueryId}
                onChange={(e) => setSelectedQueryId(e.target.value)}
                options={[
                  { value: '', label: t('dashboard.detail.addWidgetDialog.selectQueryPlaceholder') },
                  ...savedQueries.map(q => ({ value: q.id, label: q.name })),
                ]}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('dashboard.widget.chartType')}</label>
              <Select
                value={chartType}
                onChange={(e) => setChartType(e.target.value as ChartType)}
                options={chartTypeOptions}
              />
            </div>
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAddWidgetOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleAddWidget} disabled={saving || !widgetName.trim()}>
            {saving ? t('dashboard.detail.addWidgetDialog.adding') : t('dashboard.addWidget')}
          </Button>
        </DialogFooter>
      </Dialog>

      {editingWidget && (
        <WidgetSettingsDialog
          open={settingsDialogOpen}
          onClose={() => {
            setSettingsDialogOpen(false)
            setEditingWidget(null)
          }}
          widget={editingWidget}
          savedQueries={savedQueries}
          onSave={handleWidgetUpdate}
        />
      )}

      {/* Share Dialog */}
      {isOwner && (
        <ShareDashboardDialog
          open={shareDialogOpen}
          onClose={() => setShareDialogOpen(false)}
          dashboard={dashboard}
          onUpdate={setDashboard}
        />
      )}
    </div>
  )
}
