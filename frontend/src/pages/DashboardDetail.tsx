import React, { useEffect, useState, useMemo, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Layout } from 'react-grid-layout'
import { dashboardApi, queryApi } from '@/services/api'
import type { Dashboard, SavedQuery, ChartType, CreateWidgetRequest, Widget, PermissionLevel } from '@/types'
import { DashboardGrid } from '@/components/dashboard/DashboardGrid'
import { DashboardParameters } from '@/components/dashboard/DashboardParameters'
import { WidgetSettingsDialog } from '@/components/dashboard/WidgetSettingsDialog'
import { ShareDashboardDialog } from '@/components/dashboard/ShareDashboardDialog'
import { DashboardExportButton } from '@/components/export/DashboardExportButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { toast } from '@/stores/toastStore'
import { getErrorMessage } from '@/lib/errors'
import { extractAllParameters } from '@/lib/params'
import { ArrowLeft, Plus, Loader2, Edit, Save, RefreshCw, Share2, Eye, Globe } from 'lucide-react'

const autoRefreshOptions: { value: string; label: string }[] = [
  { value: '0', label: 'Off' },
  { value: '30', label: '30s' },
  { value: '60', label: '1m' },
  { value: '300', label: '5m' },
  { value: '600', label: '10m' },
]

const chartTypes: { value: ChartType; label: string }[] = [
  { value: 'bar', label: 'Bar Chart' },
  { value: 'line', label: 'Line Chart' },
  { value: 'pie', label: 'Pie Chart' },
  { value: 'area', label: 'Area Chart' },
  { value: 'scatter', label: 'Scatter Chart' },
  { value: 'table', label: 'Table' },
  { value: 'counter', label: 'Counter (KPI)' },
  { value: 'pivot', label: 'Pivot Table' },
  { value: 'markdown', label: 'Text (Markdown)' },
]

export const DashboardDetail: React.FC = () => {
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
    toast.success('Refreshing all widgets')
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

  const handleDeleteWidget = async (widgetId: string) => {
    if (!id) return
    try {
      await dashboardApi.deleteWidget(id, widgetId)
      setDashboard(prev => prev ? {
        ...prev,
        widgets: prev.widgets?.filter(w => w.id !== widgetId),
      } : null)
      toast.success('Widget deleted')
    } catch (err) {
      toast.error('Failed to delete widget', getErrorMessage(err))
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
      toast.success('Widget updated')
    } catch (err) {
      toast.error('Failed to update widget', getErrorMessage(err))
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
                  View Only
                </span>
              )}
              {myPermission === 'edit' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-600">
                  <Edit className="h-3 w-3" />
                  Can Edit
                </span>
              )}
              {dashboard.is_public && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-600">
                  <Globe className="h-3 w-3" />
                  Public
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
              <span className="text-sm text-muted-foreground">Auto:</span>
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
              Refresh
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
              Share
            </Button>
          )}
          {/* Edit button (only for edit permission or owner) */}
          {canEdit && (
            <Button
              variant={editMode ? 'default' : 'outline'}
              onClick={() => setEditMode(!editMode)}
            >
              {editMode ? <Save className="h-4 w-4 mr-2" /> : <Edit className="h-4 w-4 mr-2" />}
              {editMode ? 'Done' : 'Edit'}
            </Button>
          )}
          {editMode && (
            <Button onClick={() => setAddWidgetOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Widget
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
        {dashboard.widgets && dashboard.widgets.length > 0 ? (
          <DashboardGrid
            dashboard={dashboard}
            onLayoutChange={handleLayoutChange}
            editable={editMode}
            onDeleteWidget={handleDeleteWidget}
            onSettingsClick={handleSettingsClick}
            parameterValues={parameterValues}
            refreshKeys={refreshKeys}
            onRefreshWidget={handleRefreshWidget}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <p className="mb-4">No widgets yet</p>
            <Button onClick={() => { setEditMode(true); setAddWidgetOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Widget
            </Button>
          </div>
        )}
      </div>

      <Dialog open={addWidgetOpen} onClose={() => setAddWidgetOpen(false)}>
        <DialogHeader>
          <DialogTitle>Add Widget</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Widget Name</label>
              <Input
                value={widgetName}
                onChange={(e) => setWidgetName(e.target.value)}
                placeholder="Widget name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Saved Query</label>
              <Select
                value={selectedQueryId}
                onChange={(e) => setSelectedQueryId(e.target.value)}
                options={[
                  { value: '', label: 'Select a query...' },
                  ...savedQueries.map(q => ({ value: q.id, label: q.name })),
                ]}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Chart Type</label>
              <Select
                value={chartType}
                onChange={(e) => setChartType(e.target.value as ChartType)}
                options={chartTypes}
              />
            </div>
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAddWidgetOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleAddWidget} disabled={saving || !widgetName.trim()}>
            {saving ? 'Adding...' : 'Add Widget'}
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
