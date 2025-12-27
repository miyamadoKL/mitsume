import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Layout } from 'react-grid-layout'
import { dashboardApi, queryApi, layoutTemplateApi } from '@/services/api'
import type { Dashboard, SavedQuery, ChartType, CreateWidgetRequest, Widget, PermissionLevel, LayoutTemplate, ParameterDefinition, ResponsivePositions, Breakpoint, Position } from '@/types'
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

  // Draft mode: track unsaved changes and store local edits
  const [isDraft, setIsDraft] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [originalDashboard, setOriginalDashboard] = useState<Dashboard | null>(null)  // Snapshot when entering edit mode
  // pendingWidgetCreations now includes tempId for linking with temp widgets
  const [pendingWidgetCreations, setPendingWidgetCreations] = useState<Array<CreateWidgetRequest & { tempId: string }>>([])
  const [pendingWidgetDeletions, setPendingWidgetDeletions] = useState<string[]>([])
  const [pendingWidgetUpdates, setPendingWidgetUpdates] = useState<Record<string, Partial<Widget>>>({})
  const [pendingResponsivePositions, setPendingResponsivePositions] = useState<Record<string, ResponsivePositions>>({})
  const [savingChanges, setSavingChanges] = useState(false)

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

  // Save template dialog state
  const [saveTemplateDialogOpen, setSaveTemplateDialogOpen] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)

  // Drag & drop state
  const [draggingWidgetType, setDraggingWidgetType] = useState<ChartType | null>(null)

  // Parameter settings dialog state
  const [paramSettingsOpen, setParamSettingsOpen] = useState(false)

  // Undo/Redo for widget changes in edit mode
  // Equality check includes all tracked state: widgets, pending changes, and responsive positions
  const [widgetHistory, historyActions] = useUndoRedo<WidgetSnapshot>(
    { widgets: [] },
    (a, b) => {
      // Compare widgets
      if (a.widgets.length !== b.widgets.length) return false
      const widgetsEqual = a.widgets.every((w, i) => {
        const other = b.widgets[i]
        if (!other) return false
        return (
          w.id === other.id &&
          w.name === other.name &&
          w.chart_type === other.chart_type &&
          w.position.x === other.position.x &&
          w.position.y === other.position.y &&
          w.position.w === other.position.w &&
          w.position.h === other.position.h &&
          JSON.stringify(w.chart_config) === JSON.stringify(other.chart_config) &&
          JSON.stringify(w.responsive_positions) === JSON.stringify(other.responsive_positions)
        )
      })
      if (!widgetsEqual) return false

      // Compare pending creations
      const aCreations = a.pendingCreations || []
      const bCreations = b.pendingCreations || []
      if (aCreations.length !== bCreations.length) return false
      const creationsEqual = aCreations.every((c, i) => {
        const other = bCreations[i]
        return c.tempId === other?.tempId && c.name === other?.name
      })
      if (!creationsEqual) return false

      // Compare pending deletions
      const aDeletions = a.pendingDeletions || []
      const bDeletions = b.pendingDeletions || []
      if (aDeletions.length !== bDeletions.length) return false
      if (!aDeletions.every((id, i) => id === bDeletions[i])) return false

      // Compare pending updates (by keys AND values)
      const aUpdatesObj = a.pendingUpdates || {}
      const bUpdatesObj = b.pendingUpdates || {}
      const aUpdateKeys = Object.keys(aUpdatesObj).sort()
      const bUpdateKeys = Object.keys(bUpdatesObj).sort()
      if (aUpdateKeys.length !== bUpdateKeys.length) return false
      if (!aUpdateKeys.every((k, i) => k === bUpdateKeys[i])) return false
      // Compare values - use JSON.stringify per key for value comparison
      for (const key of aUpdateKeys) {
        if (JSON.stringify(aUpdatesObj[key]) !== JSON.stringify(bUpdatesObj[key])) return false
      }

      // Compare pending responsive positions (by keys AND values)
      const aRespObj = a.pendingResponsivePositions || {}
      const bRespObj = b.pendingResponsivePositions || {}
      const aRespKeys = Object.keys(aRespObj).sort()
      const bRespKeys = Object.keys(bRespObj).sort()
      if (aRespKeys.length !== bRespKeys.length) return false
      if (!aRespKeys.every((k, i) => k === bRespKeys[i])) return false
      // Compare values
      for (const key of aRespKeys) {
        if (JSON.stringify(aRespObj[key]) !== JSON.stringify(bRespObj[key])) return false
      }

      return true
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

  // Initialize edit mode: save original state and reset pending changes
  useEffect(() => {
    if (editMode && dashboard) {
      // Save original dashboard state for discard
      setOriginalDashboard(JSON.parse(JSON.stringify(dashboard)))
      // Reset all pending changes including responsive positions
      setPendingWidgetCreations([])
      setPendingWidgetDeletions([])
      setPendingWidgetUpdates({})
      setPendingResponsivePositions({})
      setIsDraft(false)

      // Initialize undo/redo history
      if (dashboard.widgets) {
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
      }
    }
  }, [editMode])

  // Mark as draft when there are pending changes
  useEffect(() => {
    const hasPendingChanges =
      pendingWidgetCreations.length > 0 ||
      pendingWidgetDeletions.length > 0 ||
      Object.keys(pendingWidgetUpdates).length > 0 ||
      Object.keys(pendingResponsivePositions).length > 0
    setIsDraft(hasPendingChanges)
  }, [pendingWidgetCreations, pendingWidgetDeletions, pendingWidgetUpdates, pendingResponsivePositions])

  // Page leave warning when there are unsaved changes (browser close/reload)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDraft) {
        e.preventDefault()
        // Modern browsers require returnValue to be set
        e.returnValue = ''
        return ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDraft])

  // SPA navigation blocking: Catch browser back/forward buttons
  useEffect(() => {
    if (!isDraft) return

    // Push a dummy state to history so we can catch the popstate
    const pushDummyState = () => {
      window.history.pushState({ dashboardDraft: true }, '')
    }

    const handlePopState = (_e: PopStateEvent) => {
      // If we're in draft mode and the user tries to navigate back
      if (isDraft) {
        // Ask for confirmation
        if (window.confirm(t('dashboard.draft.navigationBlockDescription', 'You have unsaved changes. Are you sure you want to leave this page? Your changes will be lost.'))) {
          // User confirmed - allow navigation by going back again
          window.history.back()
        } else {
          // User cancelled - push state again to prevent leaving
          pushDummyState()
        }
      }
    }

    pushDummyState()
    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [isDraft, t])

  // Intercept link clicks for navigation blocking
  useEffect(() => {
    if (!isDraft) return

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest('a')

      if (link && link.href && !link.href.startsWith('javascript:') && link.getAttribute('target') !== '_blank') {
        // Check if it's an internal navigation
        const url = new URL(link.href, window.location.origin)
        if (url.origin === window.location.origin && url.pathname !== window.location.pathname) {
          e.preventDefault()
          if (window.confirm(t('dashboard.draft.navigationBlockDescription', 'You have unsaved changes. Are you sure you want to leave this page? Your changes will be lost.'))) {
            navigate(url.pathname + url.search)
          }
        }
      }
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [isDraft, navigate, t])

  // Safe navigation wrapper that warns about unsaved changes
  const safeNavigate = useCallback((to: string) => {
    if (isDraft) {
      // Use browser's confirm dialog for SPA navigation
      if (window.confirm(t('dashboard.draft.navigationBlockDescription', 'You have unsaved changes. Are you sure you want to leave this page? Your changes will be lost.'))) {
        navigate(to)
      }
    } else {
      navigate(to)
    }
  }, [isDraft, navigate, t])

  // Helper to build a widget snapshot from given state (or current state if not provided)
  const buildSnapshot = useCallback((overrides?: {
    widgets?: Widget[],
    creations?: typeof pendingWidgetCreations,
    deletions?: typeof pendingWidgetDeletions,
    updates?: typeof pendingWidgetUpdates,
    responsivePositions?: typeof pendingResponsivePositions
  }): WidgetSnapshot | null => {
    const widgets = overrides?.widgets ?? dashboard?.widgets
    if (!widgets) return null
    const creations = overrides?.creations ?? pendingWidgetCreations
    const deletions = overrides?.deletions ?? pendingWidgetDeletions
    const updates = overrides?.updates ?? pendingWidgetUpdates
    const responsivePositions = overrides?.responsivePositions ?? pendingResponsivePositions

    return {
      widgets: widgets.map(w => ({
        id: w.id,
        name: w.name,
        query_id: w.query_id,
        chart_type: w.chart_type,
        chart_config: w.chart_config,
        position: w.position,
        responsive_positions: w.responsive_positions as Record<string, { x: number; y: number; w: number; h: number }> | undefined,
      })),
      // Include pending states so undo/redo restores them correctly
      pendingCreations: creations.map(c => ({
        tempId: c.tempId,
        name: c.name,
        query_id: c.query_id,
        chart_type: c.chart_type,
        chart_config: c.chart_config,
        position: c.position,
      })),
      pendingDeletions: [...deletions],
      pendingUpdates: JSON.parse(JSON.stringify(updates)),
      pendingResponsivePositions: JSON.parse(JSON.stringify(responsivePositions)),
    }
  }, [dashboard?.widgets, pendingWidgetCreations, pendingWidgetDeletions, pendingWidgetUpdates, pendingResponsivePositions])

  // Record a new snapshot to history (call with NEW state after change)
  const recordSnapshot = useCallback((snapshot: WidgetSnapshot) => {
    historyActions.set(snapshot)
  }, [historyActions])

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

  // Handle discard changes - restore from original state
  const handleDiscardChanges = useCallback(() => {
    if (!originalDashboard) return
    setDashboard(JSON.parse(JSON.stringify(originalDashboard)))
    setPendingWidgetCreations([])
    setPendingWidgetDeletions([])
    setPendingWidgetUpdates({})
    setPendingResponsivePositions({})
    historyActions.clear()
    setIsDraft(false)
    setShowDiscardConfirm(false)
    setEditMode(false)
    toast.success(t('dashboard.detail.changesDiscarded', 'Changes discarded'))
  }, [originalDashboard, historyActions, t])

  // Save all pending changes to backend using atomic batch API
  const handleSaveChanges = useCallback(async () => {
    if (!id || !dashboard) return
    setSavingChanges(true)

    try {
      // Build batch request for atomic update
      const batchReq: import('@/types').BatchWidgetUpdateRequest = {
        create: [],
        update: {},
        delete: [],
      }

      // 1. Collect widgets to delete (exclude temp widgets)
      for (const widgetId of pendingWidgetDeletions) {
        if (!widgetId.startsWith('temp-')) {
          batchReq.delete!.push(widgetId)
        }
      }

      // 2. Collect widgets to create (with responsive_positions if available)
      for (const req of pendingWidgetCreations) {
        const tempWidget = dashboard.widgets?.find(w => w.id === req.tempId)
        const responsivePos = tempWidget?.responsive_positions || pendingResponsivePositions[req.tempId]
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { tempId: _tempId, ...createReqBase } = req
        const createReq = responsivePos
          ? { ...createReqBase, responsive_positions: responsivePos }
          : createReqBase
        batchReq.create!.push(createReq)
      }

      // 3. Collect widgets to update (including responsive_positions)
      for (const [widgetId, updates] of Object.entries(pendingWidgetUpdates)) {
        if (!widgetId.startsWith('temp-') && !pendingWidgetDeletions.includes(widgetId)) {
          const responsivePos = pendingResponsivePositions[widgetId]
          const updateWithResponsive = responsivePos
            ? { ...updates, responsive_positions: responsivePos }
            : updates
          batchReq.update![widgetId] = updateWithResponsive
        }
      }

      // 4. Collect widgets that only have responsive_positions changes
      for (const [widgetId, responsivePos] of Object.entries(pendingResponsivePositions)) {
        if (!widgetId.startsWith('temp-') &&
            !pendingWidgetDeletions.includes(widgetId) &&
            !batchReq.update![widgetId]) {
          batchReq.update![widgetId] = { responsive_positions: responsivePos }
        }
      }

      // 5. Execute atomic batch update
      await dashboardApi.batchUpdateWidgets(id, batchReq)

      // 6. Reload dashboard to get fresh state
      const freshDashboard = await dashboardApi.getById(id)
      setDashboard(freshDashboard)

      // Reset pending changes
      setPendingWidgetCreations([])
      setPendingWidgetDeletions([])
      setPendingWidgetUpdates({})
      setPendingResponsivePositions({})
      setIsDraft(false)
      setEditMode(false)
      toast.success(t('dashboard.draft.saved', 'Changes saved'))
    } catch (err) {
      // Atomic batch failed - no partial state, no rollback needed
      console.error('Save failed:', err)
      toast.error(t('dashboard.draft.saveFailed', 'Failed to save changes'), getErrorMessage(err))
    } finally {
      setSavingChanges(false)
    }
  }, [id, dashboard, originalDashboard, pendingWidgetCreations, pendingWidgetDeletions, pendingWidgetUpdates, pendingResponsivePositions, t])

  // Handle exit edit mode with confirmation if draft
  const handleExitEditMode = useCallback(() => {
    if (isDraft) {
      setShowDiscardConfirm(true)
    } else {
      setEditMode(false)
    }
  }, [isDraft])

  // Force exit edit mode without saving (after confirmation)
  const handleConfirmExit = useCallback(() => {
    // Restore original state
    if (originalDashboard) {
      setDashboard(JSON.parse(JSON.stringify(originalDashboard)))
    }
    setPendingWidgetCreations([])
    setPendingWidgetDeletions([])
    setPendingWidgetUpdates({})
    setPendingResponsivePositions({})
    setEditMode(false)
    setIsDraft(false)
    setShowDiscardConfirm(false)
  }, [originalDashboard])

  // Apply widget history changes to dashboard state (including pending states)
  useEffect(() => {
    if (!editMode || !dashboard || widgetHistory.widgets.length === 0) return

    // Check if we need to apply changes (history differs from current state)
    // Include responsive_positions in comparison to properly detect responsive-only changes
    const buildWidgetSnapshot = (w: { id: string; position: Position; responsive_positions?: ResponsivePositions }) => {
      const respStr = w.responsive_positions ? JSON.stringify(w.responsive_positions) : ''
      return `${w.id}:${w.position.x},${w.position.y},${w.position.w},${w.position.h}:${respStr}`
    }
    const currentSnapshot = dashboard.widgets?.map(buildWidgetSnapshot).sort().join('|') || ''
    const historySnapshot = widgetHistory.widgets.map(buildWidgetSnapshot).sort().join('|')

    if (currentSnapshot !== historySnapshot) {
      // Reconstruct widgets from history
      const restoredWidgets: Widget[] = widgetHistory.widgets.map(hw => {
        const original = dashboard.widgets?.find(w => w.id === hw.id)
        if (original) {
          return {
            ...original,
            position: hw.position,
            name: hw.name,
            query_id: hw.query_id ?? original.query_id,
            chart_type: hw.chart_type as ChartType,
            chart_config: hw.chart_config as Record<string, unknown>,
            responsive_positions: hw.responsive_positions as ResponsivePositions | undefined,
          }
        }
        // Widget was in history but not in current - reconstruct it
        return {
          id: hw.id,
          dashboard_id: dashboard.id,
          name: hw.name,
          query_id: hw.query_id || null,
          chart_type: hw.chart_type as ChartType,
          chart_config: hw.chart_config as Record<string, unknown>,
          position: hw.position,
          responsive_positions: hw.responsive_positions as ResponsivePositions | undefined,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      })

      setDashboard(prev => prev ? { ...prev, widgets: restoredWidgets } : null)
    }

    // Restore pending states from history snapshot
    if (widgetHistory.pendingCreations !== undefined) {
      setPendingWidgetCreations(widgetHistory.pendingCreations.map(c => ({
        tempId: c.tempId,
        name: c.name,
        query_id: c.query_id,
        chart_type: c.chart_type as ChartType,
        chart_config: c.chart_config as Record<string, unknown>,
        position: c.position,
      })))
    }
    if (widgetHistory.pendingDeletions !== undefined) {
      setPendingWidgetDeletions(widgetHistory.pendingDeletions)
    }
    if (widgetHistory.pendingUpdates !== undefined) {
      setPendingWidgetUpdates(widgetHistory.pendingUpdates as Record<string, Partial<Widget>>)
    }
    if (widgetHistory.pendingResponsivePositions !== undefined) {
      setPendingResponsivePositions(widgetHistory.pendingResponsivePositions as Record<string, ResponsivePositions>)
    }
  }, [widgetHistory, editMode, dashboard?.id])

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

  // Handle layout change (visual update only, no API calls)
  // Performance: Use Map for O(1) lookup instead of O(n) find()
  const handleLayoutChange = useCallback((layout: Layout[]) => {
    if (!dashboard) return

    // Build a Map for O(1) lookups
    const layoutMap = new Map(layout.map(l => [l.i, l]))

    const updatedWidgets = dashboard.widgets?.map(widget => {
      const layoutItem = layoutMap.get(widget.id)
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
  }, [dashboard])

  // Handle layout change complete (on drag/resize stop) - record to history and pending updates
  // Performance: Use Map for O(1) lookup instead of O(n) find()
  const handleLayoutChangeComplete = useCallback((layout: Layout[], breakpoint: Breakpoint) => {
    if (!dashboard) return

    // Build a Map for O(1) lookups
    const layoutMap = new Map(layout.map(l => [l.i, l]))

    // Only update the main position for lg breakpoint (backward compatibility)
    if (breakpoint === 'lg') {
      // Build the new state FIRST
      const newUpdates = { ...pendingWidgetUpdates }
      const updatedWidgets = dashboard.widgets?.map(widget => {
        const layoutItem = layoutMap.get(widget.id)
        if (layoutItem) {
          const newPosition = {
            x: layoutItem.x,
            y: layoutItem.y,
            w: layoutItem.w,
            h: layoutItem.h,
          }
          // Track position update for existing widgets (not temp ones)
          if (!widget.id.startsWith('temp-')) {
            newUpdates[widget.id] = {
              ...(newUpdates[widget.id] || {}),
              position: newPosition,
            }
          }
          return { ...widget, position: newPosition }
        }
        return widget
      }) || []

      // Record NEW state to history (this pushes current state to past)
      const newSnapshot = buildSnapshot({ widgets: updatedWidgets as Widget[], updates: newUpdates })
      if (newSnapshot) recordSnapshot(newSnapshot)

      // Now apply state changes
      setPendingWidgetUpdates(newUpdates)
      setDashboard({ ...dashboard, widgets: updatedWidgets })
    }
    // Note: responsive_positions are tracked separately via handleAllLayoutsChange
  }, [dashboard, pendingWidgetUpdates, buildSnapshot, recordSnapshot])

  // Handle all layouts change (called with all breakpoint positions for all widgets)
  // Now properly records to undo/redo history
  const handleAllLayoutsChange = useCallback((layouts: Record<string, ResponsivePositions>) => {
    if (!dashboard) return

    // Build new responsive positions state
    const newResponsivePositions = { ...pendingResponsivePositions }
    Object.entries(layouts).forEach(([widgetId, positions]) => {
      newResponsivePositions[widgetId] = {
        ...(newResponsivePositions[widgetId] || {}),
        ...positions,
      }
    })

    // Build new widgets with updated responsive positions
    const updatedWidgets = dashboard.widgets?.map(widget => {
      if (layouts[widget.id]) {
        return {
          ...widget,
          responsive_positions: {
            ...(widget.responsive_positions || {}),
            ...layouts[widget.id],
          },
        }
      }
      return widget
    }) || []

    // Record NEW state to history (this enables undo/redo for responsive position changes)
    const newSnapshot = buildSnapshot({
      widgets: updatedWidgets as Widget[],
      responsivePositions: newResponsivePositions,
    })
    if (newSnapshot) recordSnapshot(newSnapshot)

    // Apply state changes
    setPendingResponsivePositions(newResponsivePositions)
    setDashboard({ ...dashboard, widgets: updatedWidgets })
    setIsDraft(true)
  }, [dashboard, pendingResponsivePositions, buildSnapshot, recordSnapshot])

  // Add widget locally (no API call until save)
  const handleAddWidget = useCallback(() => {
    if (!widgetName.trim() || !dashboard) return

    const maxY = dashboard.widgets?.reduce((max, w) => Math.max(max, w.position.y + w.position.h), 0) || 0
    const tempId = `temp-${Date.now()}`

    const req: CreateWidgetRequest & { tempId: string } = {
      tempId,
      name: widgetName,
      query_id: selectedQueryId || undefined,
      chart_type: chartType,
      chart_config: {},
      position: { x: 0, y: maxY, w: 6, h: 3 },
    }

    // Create temporary widget for local display
    const tempWidget: Widget = {
      id: tempId,
      dashboard_id: dashboard.id,
      name: req.name,
      query_id: req.query_id || null,
      chart_type: req.chart_type,
      chart_config: req.chart_config as Record<string, unknown>,
      position: req.position,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Build new state and record to history
    const newWidgets = [...(dashboard.widgets || []), tempWidget]
    const newCreations = [...pendingWidgetCreations, req]
    const newSnapshot = buildSnapshot({ widgets: newWidgets, creations: newCreations })
    if (newSnapshot) recordSnapshot(newSnapshot)

    // Apply state changes
    setDashboard(prev => prev ? { ...prev, widgets: newWidgets } : null)
    setPendingWidgetCreations(newCreations)

    setAddWidgetOpen(false)
    resetWidgetForm()
  }, [dashboard, widgetName, selectedQueryId, chartType, pendingWidgetCreations, buildSnapshot, recordSnapshot])

  // Quick add widget locally (no API call until save)
  const handleQuickAddWidget = useCallback((type: ChartType) => {
    if (!dashboard) return

    const maxY = dashboard.widgets?.reduce((max, w) => Math.max(max, w.position.y + w.position.h), 0) || 0
    const widgetCount = (dashboard.widgets?.length || 0) + 1
    const tempId = `temp-${Date.now()}`

    const req: CreateWidgetRequest & { tempId: string } = {
      tempId,
      name: `${t(`chart.types.${type}`)} ${widgetCount}`,
      query_id: undefined,
      chart_type: type,
      chart_config: type === 'markdown' ? { content: '' } : {},
      position: { x: 0, y: maxY, w: 6, h: 3 },
    }

    // Create temporary widget for local display
    const tempWidget: Widget = {
      id: tempId,
      dashboard_id: dashboard.id,
      name: req.name,
      query_id: null,
      chart_type: req.chart_type,
      chart_config: req.chart_config as Record<string, unknown>,
      position: req.position,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Build new state and record to history
    const newWidgets = [...(dashboard.widgets || []), tempWidget]
    const newCreations = [...pendingWidgetCreations, req]
    const newSnapshot = buildSnapshot({ widgets: newWidgets, creations: newCreations })
    if (newSnapshot) recordSnapshot(newSnapshot)

    // Apply state changes
    setDashboard(prev => prev ? { ...prev, widgets: newWidgets } : null)
    setPendingWidgetCreations(newCreations)

    // Open settings dialog for the new widget
    setEditingWidget(tempWidget)
    setSettingsDialogOpen(true)
  }, [dashboard, t, pendingWidgetCreations, buildSnapshot, recordSnapshot])

  // Handle drag start from QuickAddPanel
  const handleDragStart = useCallback((type: ChartType) => {
    setDraggingWidgetType(type)
  }, [])

  // Handle drag end from QuickAddPanel
  const handleDragEnd = useCallback(() => {
    setDraggingWidgetType(null)
  }, [])

  // Handle drop widget at specific position
  const handleDropWidget = useCallback((type: string, position: { x: number; y: number }) => {
    if (!dashboard) return

    const widgetCount = (dashboard.widgets?.length || 0) + 1
    const tempId = `temp-${Date.now()}`

    const req: CreateWidgetRequest & { tempId: string } = {
      tempId,
      name: `${t(`chart.types.${type}`)} ${widgetCount}`,
      query_id: undefined,
      chart_type: type as ChartType,
      chart_config: type === 'markdown' ? { content: '' } : {},
      position: { x: position.x, y: position.y, w: 6, h: 3 },
    }

    // Create temporary widget for local display
    const tempWidget: Widget = {
      id: tempId,
      dashboard_id: dashboard.id,
      name: req.name,
      query_id: null,
      chart_type: req.chart_type,
      chart_config: req.chart_config as Record<string, unknown>,
      position: req.position,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Build new state and record to history
    const newWidgets = [...(dashboard.widgets || []), tempWidget]
    const newCreations = [...pendingWidgetCreations, req]
    const newSnapshot = buildSnapshot({ widgets: newWidgets, creations: newCreations })
    if (newSnapshot) recordSnapshot(newSnapshot)

    // Apply state changes
    setDashboard(prev => prev ? { ...prev, widgets: newWidgets } : null)
    setPendingWidgetCreations(newCreations)
    setDraggingWidgetType(null)

    // Open settings dialog for the new widget
    setEditingWidget(tempWidget)
    setSettingsDialogOpen(true)
  }, [dashboard, t, pendingWidgetCreations, buildSnapshot, recordSnapshot])

  // Delete widget locally (no API call until save)
  const handleDeleteWidget = useCallback((widgetId: string) => {
    if (!dashboard) return

    // Build new state first
    const newWidgets = dashboard.widgets?.filter(w => w.id !== widgetId) || []
    let newCreations = pendingWidgetCreations
    let newDeletions = pendingWidgetDeletions
    let newUpdates = { ...pendingWidgetUpdates }
    let newResponsivePositions = { ...pendingResponsivePositions }

    // Track for batch save (only for existing widgets, not temp ones)
    if (widgetId.startsWith('temp-')) {
      // Remove from pending creations by matching tempId
      newCreations = pendingWidgetCreations.filter(creation => creation.tempId !== widgetId)
      // Also remove from pending responsive positions
      delete newResponsivePositions[widgetId]
    } else {
      newDeletions = [...pendingWidgetDeletions, widgetId]
      // Also remove from pending updates
      delete newUpdates[widgetId]
      // Also remove from pending responsive positions
      delete newResponsivePositions[widgetId]
    }

    // Build and record new snapshot
    const newSnapshot = buildSnapshot({
      widgets: newWidgets,
      creations: newCreations,
      deletions: newDeletions,
      updates: newUpdates,
      responsivePositions: newResponsivePositions,
    })
    if (newSnapshot) recordSnapshot(newSnapshot)

    // Apply state changes
    setDashboard(prev => prev ? { ...prev, widgets: newWidgets } : null)
    setPendingWidgetCreations(newCreations)
    setPendingWidgetDeletions(newDeletions)
    setPendingWidgetUpdates(newUpdates)
    setPendingResponsivePositions(newResponsivePositions)

    toast.success(t('dashboard.detail.toast.widgetDeleted'))
  }, [dashboard, pendingWidgetCreations, pendingWidgetDeletions, pendingWidgetUpdates, pendingResponsivePositions, buildSnapshot, recordSnapshot, t])

  // Duplicate widget - use API for existing widgets, local for temp widgets
  const handleDuplicateWidget = useCallback(async (widget: Widget) => {
    if (!dashboard || !id) return

    // For existing widgets, use the duplicate API
    if (!widget.id.startsWith('temp-')) {
      try {
        const duplicatedWidget = await dashboardApi.duplicateWidget(id, widget.id)
        // Add to local state
        const newWidgets = [...(dashboard.widgets || []), duplicatedWidget]
        const newSnapshot = buildSnapshot({ widgets: newWidgets })
        if (newSnapshot) recordSnapshot(newSnapshot)
        setDashboard(prev => prev ? { ...prev, widgets: newWidgets } : null)
        toast.success(t('dashboard.detail.toast.widgetDuplicated'))
      } catch (err) {
        toast.error(t('dashboard.detail.toast.widgetDuplicateFailed', 'Failed to duplicate widget'), getErrorMessage(err))
      }
      return
    }

    // For temp widgets, duplicate locally
    const newY = widget.position.y + widget.position.h
    const tempId = `temp-${Date.now()}`

    // Deep copy chart_config to avoid shared reference issues
    const chartConfigCopy = widget.chart_config
      ? JSON.parse(JSON.stringify(widget.chart_config))
      : {}

    const req: CreateWidgetRequest & { tempId: string } = {
      tempId,
      name: `${widget.name} (Copy)`,
      query_id: widget.query_id || undefined,
      chart_type: widget.chart_type,
      chart_config: chartConfigCopy,
      position: { x: widget.position.x, y: newY, w: widget.position.w, h: widget.position.h },
    }

    // Create temporary widget for local display
    const tempWidget: Widget = {
      id: tempId,
      dashboard_id: dashboard.id,
      name: req.name,
      query_id: req.query_id || null,
      chart_type: req.chart_type,
      chart_config: req.chart_config as Record<string, unknown>,
      position: req.position,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Build new state and record to history
    const newWidgets = [...(dashboard.widgets || []), tempWidget]
    const newCreations = [...pendingWidgetCreations, req]
    const newSnapshot = buildSnapshot({ widgets: newWidgets, creations: newCreations })
    if (newSnapshot) recordSnapshot(newSnapshot)

    // Apply state changes
    setDashboard(prev => prev ? { ...prev, widgets: newWidgets } : null)
    setPendingWidgetCreations(newCreations)

    toast.success(t('dashboard.detail.toast.widgetDuplicated'))
  }, [dashboard, id, pendingWidgetCreations, buildSnapshot, recordSnapshot, t])

  const handleSettingsClick = (widget: Widget) => {
    setEditingWidget(widget)
    setSettingsDialogOpen(true)
  }

  // Update widget locally (no API call until save in draft mode)
  const handleWidgetUpdate = useCallback(async (updates: Partial<Widget>): Promise<void> => {
    if (!editingWidget || !dashboard) return

    const widgetId = editingWidget.id

    // Build new state first
    const newWidgets = dashboard.widgets?.map(w =>
      w.id === widgetId ? { ...w, ...updates, updated_at: new Date().toISOString() } : w
    ) || []

    let newCreations = pendingWidgetCreations
    let newUpdates = { ...pendingWidgetUpdates }

    // Track for batch save
    if (widgetId.startsWith('temp-')) {
      // For temp widgets, update the pending creation
      newCreations = pendingWidgetCreations.map(creation => {
        if (creation.tempId === widgetId) {
          return {
            ...creation,
            ...(updates.name !== undefined && { name: updates.name }),
            ...(updates.query_id !== undefined && { query_id: updates.query_id || undefined }),
            ...(updates.chart_type !== undefined && { chart_type: updates.chart_type }),
            ...(updates.chart_config !== undefined && { chart_config: updates.chart_config }),
            ...(updates.position !== undefined && { position: updates.position }),
          }
        }
        return creation
      })
    } else {
      // For existing widgets, track update in pendingWidgetUpdates
      newUpdates = {
        ...pendingWidgetUpdates,
        [widgetId]: {
          ...(pendingWidgetUpdates[widgetId] || {}),
          ...updates,
        },
      }
    }

    // Build and record new snapshot
    const newSnapshot = buildSnapshot({ widgets: newWidgets, creations: newCreations, updates: newUpdates })
    if (newSnapshot) recordSnapshot(newSnapshot)

    // Apply state changes
    setDashboard(prev => prev ? { ...prev, widgets: newWidgets } : null)
    setPendingWidgetCreations(newCreations)
    setPendingWidgetUpdates(newUpdates)

    setSettingsDialogOpen(false)
    setEditingWidget(null)
    toast.success(t('dashboard.detail.toast.widgetUpdated'))
  }, [editingWidget, dashboard, pendingWidgetCreations, pendingWidgetUpdates, buildSnapshot, recordSnapshot, t])

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

  // Delete custom template
  const handleDeleteTemplate = async (templateId: string) => {
    try {
      await layoutTemplateApi.delete(templateId)
      setCustomTemplates(prev => prev.filter(t => t.id !== templateId))
      // If the deleted template was selected, reset to first system template
      if (selectedTemplate.id === templateId) {
        setSelectedTemplate(systemLayoutTemplates[0])
      }
      toast.success(t('dashboard.templates.deleted', 'Template deleted'))
    } catch (err) {
      toast.error(t('dashboard.templates.deleteFailed', 'Failed to delete template'), getErrorMessage(err))
    }
  }

  // Save current layout as template
  const handleSaveAsTemplate = async () => {
    if (!dashboard?.widgets || !templateName.trim()) return
    setSavingTemplate(true)

    try {
      // Extract positions from current widgets
      const layout = dashboard.widgets.map(w => ({
        x: w.position.x,
        y: w.position.y,
        w: w.position.w,
        h: w.position.h,
      }))

      const newTemplate = await layoutTemplateApi.create(
        templateName.trim(),
        templateDescription.trim(),
        layout
      )

      setCustomTemplates(prev => [...prev, newTemplate])
      setSaveTemplateDialogOpen(false)
      setTemplateName('')
      setTemplateDescription('')
      toast.success(t('dashboard.templates.saved', 'Layout saved as template'))
    } catch (err) {
      toast.error(t('dashboard.templates.saveFailed', 'Failed to save template'), getErrorMessage(err))
    } finally {
      setSavingTemplate(false)
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
          <Button variant="ghost" size="icon" onClick={() => safeNavigate('/dashboards')}>
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
              {/* Save button - only show when there are unsaved changes */}
              {isDraft && (
                <Button
                  variant="default"
                  onClick={handleSaveChanges}
                  disabled={savingChanges}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {savingChanges ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
                </Button>
              )}
              {/* Done button - exit edit mode */}
              <Button
                variant={isDraft ? 'outline' : 'default'}
                onClick={handleExitEditMode}
              >
                {isDraft ? (
                  <>
                    <X className="h-4 w-4 mr-2" />
                    {t('common.cancel', 'Cancel')}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {t('common.done')}
                  </>
                )}
              </Button>
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
        {editMode && (
          <QuickAddPanel
            onAddWidget={handleQuickAddWidget}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          />
        )}
        {(dashboard.widgets && dashboard.widgets.length > 0) || draggingWidgetType ? (
          <DashboardGrid
            dashboard={dashboard}
            onLayoutChange={handleLayoutChange}
            onLayoutChangeComplete={handleLayoutChangeComplete}
            onAllLayoutsChange={handleAllLayoutsChange}
            editable={editMode}
            onDeleteWidget={handleDeleteWidget}
            onDuplicateWidget={handleDuplicateWidget}
            onSettingsClick={handleSettingsClick}
            parameterValues={appliedValues}
            refreshKeys={refreshKeys}
            onRefreshWidget={handleRefreshWidget}
            onParametersDiscovered={handleParametersDiscovered}
            onCrossFilter={handleCrossFilter}
            draggingWidgetType={draggingWidgetType}
            onDropWidget={handleDropWidget}
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
          <Button onClick={handleAddWidget} disabled={!widgetName.trim()}>
            {t('dashboard.addWidget')}
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
              onDeleteTemplate={handleDeleteTemplate}
            />
            {/* Save current layout as template */}
            {dashboard?.widgets && dashboard.widgets.length > 0 && (
              <div className="pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setSaveTemplateDialogOpen(true)}
                  className="w-full"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {t('dashboard.templates.saveCurrent', 'Save current layout as template')}
                </Button>
              </div>
            )}
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

      {/* Save Template Dialog */}
      <Dialog open={saveTemplateDialogOpen} onClose={() => setSaveTemplateDialogOpen(false)}>
        <DialogHeader>
          <DialogTitle>{t('dashboard.templates.saveTitle', 'Save Layout as Template')}</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t('dashboard.templates.templateName', 'Template Name')}</label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder={t('dashboard.templates.templateNamePlaceholder', 'Enter template name')}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('dashboard.templates.templateDescription', 'Description')}</label>
              <Input
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                placeholder={t('dashboard.templates.templateDescriptionPlaceholder', 'Optional description')}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {t('dashboard.templates.saveInfo', 'This will save the current widget positions as a reusable template. Widget content (queries, chart settings) will not be saved.')}
            </p>
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setSaveTemplateDialogOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSaveAsTemplate} disabled={!templateName.trim() || savingTemplate}>
            {savingTemplate ? t('common.saving', 'Saving...') : t('common.save')}
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
