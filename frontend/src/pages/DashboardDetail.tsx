import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Layout } from 'react-grid-layout'
import { dashboardApi, queryApi, layoutTemplateApi } from '@/services/api'
import type { Dashboard, SavedQuery, ChartType, CreateWidgetRequest, Widget, PermissionLevel, LayoutTemplate, ParameterDefinition } from '@/types'
import { DashboardGrid } from '@/components/dashboard/DashboardGrid'
import { DashboardParameters } from '@/components/dashboard/DashboardParameters'
import { WidgetSettingsDialog } from '@/components/dashboard/WidgetSettingsDialog'
import { ShareDashboardDialog } from '@/components/dashboard/ShareDashboardDialog'
import { QuickAddPanel } from '@/components/dashboard/QuickAddPanel'
import { ParameterSettingsDialog } from '@/components/dashboard/ParameterSettingsDialog'
import { DashboardExportButton } from '@/components/export/DashboardExportButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { toast } from '@/stores/toastStore'
import { getErrorMessage } from '@/lib/errors'
import { extractAllParameters } from '@/lib/params'
import { ArrowLeft, Plus, Loader2, Edit, Save, RefreshCw, Share2, Eye, Globe, LayoutTemplate as LayoutTemplateIcon, SlidersHorizontal, Link2, Undo2, Redo2, X, AlertTriangle } from 'lucide-react'
import { useUndoRedo, WidgetSnapshot } from '@/hooks/useUndoRedo'
import { LayoutTemplateSelector } from '@/components/dashboard/LayoutTemplateSelector'
import { systemLayoutTemplates } from '@/lib/layout-templates'
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

  // Draft mode: track unsaved changes
  const [isDraft, setIsDraft] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)

  // Parameter state: draft (editing) vs applied (used by widgets)
  const [draftValues, setDraftValues] = useState<Record<string, string>>({})
  const [appliedValues, setAppliedValues] = useState<Record<string, string>>({})

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

  // Template dialog state
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [customTemplates, setCustomTemplates] = useState<LayoutTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<LayoutTemplate>(systemLayoutTemplates[0])
  const [applyingTemplate, setApplyingTemplate] = useState(false)

  // Parameter settings dialog state
  const [paramSettingsOpen, setParamSettingsOpen] = useState(false)

  // Undo/Redo for widget changes in edit mode
  const [widgetHistory, historyActions] = useUndoRedo<WidgetSnapshot>(
    { widgets: [] },
    (a, b) => {
      if (a.widgets.length !== b.widgets.length) return false
      return a.widgets.every((w, i) => {
        const other = b.widgets[i]
        return (
          w.id === other.id &&
          w.name === other.name &&
          w.position.x === other.position.x &&
          w.position.y === other.position.y &&
          w.position.w === other.position.w &&
          w.position.h === other.position.h
        )
      })
    }
  )

  // Ref for export functionality
  const dashboardContentRef = useRef<HTMLDivElement>(null)

  // Discovered parameters from widget data API responses (for viewers who can't access savedQueries)
  const [discoveredParameters, setDiscoveredParameters] = useState<Record<string, string[]>>({})

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

  // Initialize widget history when entering edit mode
  useEffect(() => {
    if (editMode && dashboard?.widgets) {
      const snapshot: WidgetSnapshot = {
        widgets: dashboard.widgets.map(w => ({
          id: w.id,
          name: w.name,
          query_id: w.query_id || undefined,
          chart_type: w.chart_type,
          chart_config: w.chart_config,
          position: w.position,
        })),
      }
      historyActions.set(snapshot, true) // Skip adding to history - just set initial state
      historyActions.clear() // Clear any previous history
      setIsDraft(false) // Reset draft flag when entering edit mode
    }
  }, [editMode])

  // Mark as draft when history changes (indicating unsaved changes)
  useEffect(() => {
    if (editMode && historyActions.canUndo) {
      setIsDraft(true)
    }
  }, [editMode, historyActions.canUndo])

  // Helper to record current widget state to history
  const recordWidgetSnapshot = useCallback(() => {
    if (!dashboard?.widgets) return
    const snapshot: WidgetSnapshot = {
      widgets: dashboard.widgets.map(w => ({
        id: w.id,
        name: w.name,
        query_id: w.query_id || undefined,
        chart_type: w.chart_type,
        chart_config: w.chart_config,
        position: w.position,
      })),
    }
    historyActions.set(snapshot)
  }, [dashboard?.widgets, historyActions])

  // Handle undo action
  const handleUndo = useCallback(() => {
    if (!historyActions.canUndo || !dashboard) return
    historyActions.undo()
  }, [historyActions, dashboard])

  // Handle redo action
  const handleRedo = useCallback(() => {
    if (!historyActions.canRedo || !dashboard) return
    historyActions.redo()
  }, [historyActions, dashboard])

  // Handle discard changes - reload from server
  const handleDiscardChanges = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await dashboardApi.getById(id)
      setDashboard(data)
      historyActions.clear()
      setIsDraft(false)
      setShowDiscardConfirm(false)
      toast.success(t('dashboard.detail.changesDiscarded', 'Changes discarded'))
    } catch (err) {
      toast.error(t('errors.loadFailed'), getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [id, historyActions, t])

  // Handle exit edit mode with confirmation if draft
  const handleExitEditMode = useCallback(() => {
    if (isDraft) {
      setShowDiscardConfirm(true)
    } else {
      setEditMode(false)
    }
  }, [isDraft])

  // Force exit edit mode (after confirmation or when saving)
  const handleConfirmExit = useCallback(() => {
    setEditMode(false)
    setIsDraft(false)
    setShowDiscardConfirm(false)
  }, [])

  // Apply widget history changes to dashboard state
  useEffect(() => {
    if (!editMode || !dashboard || widgetHistory.widgets.length === 0) return

    // Check if we need to apply changes (history differs from current state)
    const currentSnapshot = dashboard.widgets?.map(w => `${w.id}:${w.position.x},${w.position.y},${w.position.w},${w.position.h}`).sort().join('|') || ''
    const historySnapshot = widgetHistory.widgets.map(w => `${w.id}:${w.position.x},${w.position.y},${w.position.w},${w.position.h}`).sort().join('|')

    if (currentSnapshot !== historySnapshot) {
      // Reconstruct widgets from history
      const restoredWidgets = widgetHistory.widgets.map(hw => {
        const original = dashboard.widgets?.find(w => w.id === hw.id)
        if (original) {
          return { ...original, position: hw.position, name: hw.name }
        }
        // Widget was in history but not in current - this shouldn't happen normally
        return {
          id: hw.id,
          dashboard_id: dashboard.id,
          name: hw.name,
          query_id: hw.query_id || null,
          chart_type: hw.chart_type,
          chart_config: hw.chart_config as Record<string, unknown>,
          position: hw.position,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as Widget
      })

      setDashboard(prev => prev ? { ...prev, widgets: restoredWidgets } : null)
    }
  }, [widgetHistory])

  // Handler for when widgets report their required parameters
  const handleParametersDiscovered = useCallback((widgetId: string, requiredParams: string[]) => {
    setDiscoveredParameters(prev => ({
      ...prev,
      [widgetId]: requiredParams,
    }))
  }, [])

  // Extract all parameters - combine savedQueries (for editors) and discovered parameters (for viewers)
  const allParameters = useMemo(() => {
    // For editors: extract from savedQueries (if available)
    const queryTexts = savedQueries
      .filter(q => dashboard?.widgets?.some(w => w.query_id === q.id))
      .map(q => q.query_text)
    const fromQueries = extractAllParameters(queryTexts)

    // For viewers: use discovered parameters from widget data API
    const fromDiscovered = new Set<string>()
    Object.values(discoveredParameters).forEach(params => {
      params.forEach(p => fromDiscovered.add(p))
    })

    // Merge both sources, removing duplicates
    const all = new Set([...fromQueries, ...fromDiscovered])
    return Array.from(all)
  }, [savedQueries, dashboard?.widgets, discoveredParameters])

  // Initialize parameter values: URL > Default values
  useEffect(() => {
    if (!dashboard) return

    const initialParams: Record<string, string> = {}

    // First, apply default values from parameter definitions
    const paramDefs = dashboard.parameters || []
    for (const def of paramDefs) {
      if (def.default_value !== undefined) {
        if (typeof def.default_value === 'string') {
          initialParams[def.name] = def.default_value
        } else if (def.type === 'daterange' && typeof def.default_value === 'object' && 'start' in def.default_value) {
          // daterange: { start, end } -> "start,end"
          initialParams[def.name] = `${def.default_value.start},${def.default_value.end}`
        } else if (Array.isArray(def.default_value)) {
          // multiselect: ["a", "b"] -> "a,b"
          initialParams[def.name] = def.default_value.join(',')
        }
      }
    }

    // Then, override with URL parameters (URL takes precedence)
    searchParams.forEach((value, key) => {
      if (key.startsWith('p_')) {
        const paramName = key.slice(2)
        // Handle daterange split params (p_name_start, p_name_end)
        if (paramName.endsWith('_start')) {
          const baseName = paramName.slice(0, -6)
          const current = initialParams[baseName] || ','
          const [, end] = current.split(',')
          initialParams[baseName] = `${value},${end || ''}`
        } else if (paramName.endsWith('_end')) {
          const baseName = paramName.slice(0, -4)
          const current = initialParams[baseName] || ','
          const [start] = current.split(',')
          initialParams[baseName] = `${start || ''},${value}`
        } else {
          initialParams[paramName] = value
        }
      }
    })

    if (Object.keys(initialParams).length > 0) {
      setDraftValues(initialParams)
      setAppliedValues(initialParams)
    }
  }, [dashboard, searchParams])

  // Handle draft parameter changes (editing, not yet applied)
  const handleDraftChange = useCallback((name: string, value: string) => {
    setDraftValues(prev => ({ ...prev, [name]: value }))
  }, [])

  // Check if there are unapplied changes
  const hasParameterChanges = useMemo(() => {
    const draftKeys = Object.keys(draftValues)
    const appliedKeys = Object.keys(appliedValues)
    const allKeys = new Set([...draftKeys, ...appliedKeys])
    for (const key of allKeys) {
      if (draftValues[key] !== appliedValues[key]) {
        return true
      }
    }
    return false
  }, [draftValues, appliedValues])

  // Apply draft values to widgets and URL
  const handleApplyParameters = useCallback(() => {
    setAppliedValues({ ...draftValues })
    const defsByName = new Map((dashboard?.parameters || []).map(def => [def.name, def]))
    // Update URL with applied values
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      // Clear old p_ params
      Array.from(next.keys()).forEach(key => {
        if (key.startsWith('p_')) next.delete(key)
      })
      // Add new p_ params
      Object.entries(draftValues).forEach(([name, value]) => {
        if (value) {
          const def = defsByName.get(name)
          if (def?.type === 'daterange') {
            const [start, end] = value.split(',')
            if (start) next.set(`p_${name}_start`, start)
            if (end) next.set(`p_${name}_end`, end)
          } else {
            next.set(`p_${name}`, value)
          }
        }
      })
      return next
    })
  }, [draftValues, setSearchParams, dashboard?.parameters])

  // Clear/reset all parameters
  const handleResetParameters = useCallback(() => {
    setDraftValues({})
    setAppliedValues({})
    // Clear URL params
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      Array.from(next.keys()).forEach(key => {
        if (key.startsWith('p_')) next.delete(key)
      })
      return next
    })
  }, [setSearchParams])

  // Copy current URL with parameters to clipboard
  const handleCopyLink = useCallback(async () => {
    const text = window.location.href

    const tryClipboardApi = async () => {
      if (!navigator.clipboard?.writeText) return false
      try {
        await navigator.clipboard.writeText(text)
        return true
      } catch (err) {
        console.error('navigator.clipboard.writeText failed:', err)
        return false
      }
    }

    const tryExecCommand = () => {
      try {
        const el = document.createElement('textarea')
        el.value = text
        el.setAttribute('readonly', '')
        el.style.position = 'fixed'
        el.style.top = '-9999px'
        el.style.left = '-9999px'
        document.body.appendChild(el)
        el.focus()
        el.select()
        const ok = document.execCommand('copy')
        document.body.removeChild(el)
        return ok
      } catch (err) {
        console.error('document.execCommand(copy) failed:', err)
        return false
      }
    }

    const ok = (await tryClipboardApi()) || tryExecCommand()
    if (ok) {
      toast.success(t('dashboard.detail.linkCopied', 'Link copied to clipboard'))
    } else {
      toast.error(t('dashboard.detail.copyLinkFailed', 'Failed to copy link'))
    }
  }, [t])

  // Handle cross-filter from chart clicks
  const handleCrossFilter = useCallback((parameterUpdates: Record<string, string>) => {
    // Update draft values with the cross-filter updates
    setDraftValues(prev => ({ ...prev, ...parameterUpdates }))
    // Show toast to indicate filter was applied
    toast.info(t('dashboard.detail.crossFilterApplied', 'Filter updated - click Apply to refresh'))
  }, [t])

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

  // Load custom templates when template dialog opens
  useEffect(() => {
    if (templateDialogOpen) {
      layoutTemplateApi.getAll()
        .then(templates => setCustomTemplates(templates.filter(t => !t.is_system)))
        .catch(err => console.error('Failed to load custom templates:', err))
    }
  }, [templateDialogOpen])

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

    // Record current state before change for undo
    recordWidgetSnapshot()

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

    // Record current state before change for undo
    recordWidgetSnapshot()

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

    // Record current state before change for undo
    recordWidgetSnapshot()

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

    // Record current state before change for undo
    recordWidgetSnapshot()

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

    // Record current state before change for undo
    recordWidgetSnapshot()

    try {
      // Position duplicate slightly below the original widget (offset by 1 row)
      const newY = widget.position.y + widget.position.h

      // Deep copy chart_config to avoid shared reference issues
      const chartConfigCopy = widget.chart_config
        ? JSON.parse(JSON.stringify(widget.chart_config))
        : {}

      const req: CreateWidgetRequest = {
        name: `${widget.name} (Copy)`,
        query_id: widget.query_id || undefined,
        chart_type: widget.chart_type,
        chart_config: chartConfigCopy,
        position: { x: widget.position.x, y: newY, w: widget.position.w, h: widget.position.h },
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

  const handleApplyTemplate = async (replaceExisting: boolean) => {
    if (!id || !selectedTemplate) return
    setApplyingTemplate(true)

    // Save current state for rollback
    const previousWidgets = dashboard?.widgets || []

    try {
      // Delete existing widgets if replaceExisting is true
      if (replaceExisting && previousWidgets.length > 0) {
        const deleteResults = await Promise.allSettled(
          previousWidgets.map(w => dashboardApi.deleteWidget(id, w.id))
        )
        const deleteFailed = deleteResults.filter(r => r.status === 'rejected')
        if (deleteFailed.length > 0) {
          throw new Error(t('dashboard.applyTemplate.deleteError'))
        }
      }

      // Calculate starting Y position for new widgets
      const startY = replaceExisting ? 0 : (
        previousWidgets.reduce((max, w) => Math.max(max, w.position.y + w.position.h), 0)
      )

      // Create new widgets in parallel
      if (selectedTemplate.layout.length > 0) {
        const widgetPromises = selectedTemplate.layout.map((pos, i) =>
          dashboardApi.createWidget(id, {
            name: `${t('dashboard.widget.title')} ${(replaceExisting ? 0 : previousWidgets.length) + i + 1}`,
            chart_type: 'bar',
            chart_config: {},
            position: { ...pos, y: pos.y + startY },
          })
        )

        const results = await Promise.allSettled(widgetPromises)
        const createdWidgets = results
          .filter((r): r is PromiseFulfilledResult<Widget> => r.status === 'fulfilled')
          .map(r => r.value)
        const failedCount = results.filter(r => r.status === 'rejected').length

        // Update state with created widgets
        setDashboard(prev => prev ? {
          ...prev,
          widgets: replaceExisting ? createdWidgets : [...(prev.widgets || []), ...createdWidgets],
        } : null)

        if (failedCount > 0) {
          toast.error(
            t('dashboard.applyTemplate.partialError'),
            t('dashboard.applyTemplate.partialErrorDetail', { count: failedCount })
          )
        } else {
          toast.success(t('dashboard.applyTemplate.success'))
        }
      } else {
        // Blank template - just clear widgets
        setDashboard(prev => prev ? {
          ...prev,
          widgets: replaceExisting ? [] : prev.widgets,
        } : null)
        toast.success(t('dashboard.applyTemplate.success'))
      }

      setTemplateDialogOpen(false)
    } catch (err) {
      toast.error(t('dashboard.applyTemplate.error'), getErrorMessage(err))
      // Rollback to previous state on complete failure
      setDashboard(prev => prev ? { ...prev, widgets: previousWidgets } : null)
    } finally {
      setApplyingTemplate(false)
    }
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
          {/* Copy link button */}
          {!editMode && (
            <Button variant="outline" onClick={handleCopyLink} title={t('dashboard.detail.copyLinkTooltip', 'Copy current URL with filters')}>
              <Link2 className="h-4 w-4 mr-2" />
              {t('dashboard.detail.copyLink', 'Copy link')}
            </Button>
          )}
          {/* Share button (only for owner) */}
          {isOwner && !editMode && (
            <Button variant="outline" onClick={() => setShareDialogOpen(true)}>
              <Share2 className="h-4 w-4 mr-2" />
              {t('dashboard.share')}
            </Button>
          )}
          {/* Edit button (only for edit permission or owner) */}
          {canEdit && !editMode && (
            <Button
              variant="outline"
              onClick={() => setEditMode(true)}
            >
              <Edit className="h-4 w-4 mr-2" />
              {t('common.edit')}
            </Button>
          )}
          {editMode && (
            <>
              {/* Draft indicator */}
              {isDraft && (
                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700 border border-yellow-300">
                  <AlertTriangle className="h-3 w-3" />
                  {t('dashboard.draft.unsavedChanges', 'Unsaved changes')}
                </span>
              )}
              {/* Done button */}
              <Button
                variant="default"
                onClick={handleExitEditMode}
              >
                <Save className="h-4 w-4 mr-2" />
                {t('common.done')}
              </Button>
              {/* Discard button */}
              {isDraft && (
                <Button
                  variant="outline"
                  onClick={() => setShowDiscardConfirm(true)}
                  className="text-destructive hover:text-destructive"
                >
                  <X className="h-4 w-4 mr-2" />
                  {t('dashboard.draft.discard', 'Discard')}
                </Button>
              )}
              {/* Undo/Redo buttons */}
              <div className="flex border rounded-md">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleUndo}
                  disabled={!historyActions.canUndo}
                  title={t('dashboard.undo', 'Undo (Ctrl+Z)')}
                  className="rounded-r-none"
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRedo}
                  disabled={!historyActions.canRedo}
                  title={t('dashboard.redo', 'Redo (Ctrl+Shift+Z)')}
                  className="rounded-l-none border-l"
                >
                  <Redo2 className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="outline" onClick={() => setTemplateDialogOpen(true)}>
                <LayoutTemplateIcon className="h-4 w-4 mr-2" />
                {t('dashboard.applyTemplate.button')}
              </Button>
              <Button variant="outline" onClick={() => setParamSettingsOpen(true)}>
                <SlidersHorizontal className="h-4 w-4 mr-2" />
                {t('dashboard.parameters.settings', 'Parameters')}
              </Button>
              <Button onClick={() => setAddWidgetOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {t('dashboard.addWidget')}
              </Button>
            </>
          )}
        </div>
      </div>

      <DashboardParameters
        dashboardId={id || ''}
        parameters={allParameters}
        definitions={dashboard.parameters}
        draftValues={draftValues}
        appliedValues={appliedValues}
        onDraftChange={handleDraftChange}
        onApply={handleApplyParameters}
        onReset={handleResetParameters}
        hasChanges={hasParameterChanges}
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
            parameterValues={appliedValues}
            refreshKeys={refreshKeys}
            onRefreshWidget={handleRefreshWidget}
            onParametersDiscovered={handleParametersDiscovered}
            onCrossFilter={handleCrossFilter}
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

      {/* Template Dialog */}
      <Dialog open={templateDialogOpen} onClose={() => setTemplateDialogOpen(false)}>
        <DialogHeader>
          <DialogTitle>{t('dashboard.applyTemplate.title')}</DialogTitle>
        </DialogHeader>
        <DialogContent className="max-w-2xl">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('dashboard.applyTemplate.description')}
            </p>
            <LayoutTemplateSelector
              selectedId={selectedTemplate.id}
              onSelect={setSelectedTemplate}
              customTemplates={customTemplates}
            />
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
            {t('common.cancel')}
          </Button>
          {dashboard?.widgets && dashboard.widgets.length > 0 && (
            <Button
              variant="outline"
              onClick={() => handleApplyTemplate(false)}
              disabled={applyingTemplate}
            >
              {applyingTemplate ? t('common.loading') : t('dashboard.applyTemplate.addWidgets')}
            </Button>
          )}
          <Button
            onClick={() => handleApplyTemplate(true)}
            disabled={applyingTemplate}
          >
            {applyingTemplate ? t('common.loading') : t('dashboard.applyTemplate.replaceAll')}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Parameter Settings Dialog */}
      {canEdit && (
        <ParameterSettingsDialog
          open={paramSettingsOpen}
          onClose={() => setParamSettingsOpen(false)}
          parameters={dashboard.parameters || []}
          discoveredParameters={allParameters}
          savedQueries={savedQueries}
          onSave={async (params: ParameterDefinition[]) => {
            if (!id) return
            try {
              const updated = await dashboardApi.update(id, { parameters: params })
              setDashboard(updated)
              toast.success(t('dashboard.parameters.saved', 'Parameters saved'))
            } catch (err) {
              toast.error(t('dashboard.parameters.saveFailed', 'Failed to save parameters'), getErrorMessage(err))
              throw err
            }
          }}
        />
      )}

      {/* Discard Changes Confirmation Dialog */}
      <Dialog open={showDiscardConfirm} onClose={() => setShowDiscardConfirm(false)}>
        <DialogHeader>
          <DialogTitle>{t('dashboard.draft.discardConfirmTitle', 'Discard changes?')}</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <p className="text-sm text-muted-foreground">
            {t('dashboard.draft.discardConfirmDescription', 'You have unsaved changes. Are you sure you want to discard them? This action cannot be undone.')}
          </p>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowDiscardConfirm(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="outline" onClick={handleConfirmExit}>
            {t('dashboard.draft.exitWithoutSaving', 'Exit without saving')}
          </Button>
          <Button variant="destructive" onClick={handleDiscardChanges}>
            {t('dashboard.draft.discardAndReload', 'Discard and reload')}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
