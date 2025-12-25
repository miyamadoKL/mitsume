import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { Widget, SavedQuery, ChartType, ChartConfig, Dashboard, ColumnLinkConfig, CartesianConfig, ConditionalFormatRule, ComparisonConfig, SparklineConfig } from '@/types'
import { queryApi, dashboardApi } from '@/services/api'
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { ParameterMappingEditor } from './ParameterMappingEditor'
import { getImplementedChartTypeOptions } from '@/lib/chart-options'
import { Loader2, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'

interface WidgetSettingsDialogProps {
  open: boolean
  onClose: () => void
  widget: Widget
  savedQueries: SavedQuery[]
  onSave: (updates: Partial<Widget>) => Promise<void>
}

export const WidgetSettingsDialog: React.FC<WidgetSettingsDialogProps> = ({
  open,
  onClose,
  widget,
  savedQueries,
  onSave,
}) => {
  const { t } = useTranslation()

  const chartTypeOptions = getImplementedChartTypeOptions().map(option => ({
    ...option,
    label: t(`chart.types.${option.value}`, { defaultValue: option.label }),
  }))

  const comboSeriesTypeOptions: { value: string; label: string }[] = [
    { value: 'bar', label: t('dashboard.widgetSettings.options.seriesType.bar') },
    { value: 'line', label: t('dashboard.widgetSettings.options.seriesType.line') },
    { value: 'area', label: t('dashboard.widgetSettings.options.seriesType.area') },
  ]

  const heatmapColorSchemes: { value: string; label: string }[] = [
    { value: 'default', label: t('dashboard.widgetSettings.options.heatmapColorScheme.default') },
    { value: 'blue', label: t('dashboard.widgetSettings.options.heatmapColorScheme.blue') },
    { value: 'green', label: t('dashboard.widgetSettings.options.heatmapColorScheme.green') },
    { value: 'red', label: t('dashboard.widgetSettings.options.heatmapColorScheme.red') },
    { value: 'purple', label: t('dashboard.widgetSettings.options.heatmapColorScheme.purple') },
    { value: 'diverging', label: t('dashboard.widgetSettings.options.heatmapColorScheme.diverging') },
  ]

  const stackingOptions: { value: string; label: string }[] = [
    { value: 'none', label: t('dashboard.widgetSettings.options.stacking.none') },
    { value: 'normal', label: t('dashboard.widgetSettings.options.stacking.normal') },
    { value: 'percent', label: t('dashboard.widgetSettings.options.stacking.percent') },
  ]

  const aggregationOptions: { value: string; label: string }[] = [
    { value: 'sum', label: t('dashboard.widgetSettings.options.aggregation.sum') },
    { value: 'count', label: t('dashboard.widgetSettings.options.aggregation.count') },
    { value: 'avg', label: t('dashboard.widgetSettings.options.aggregation.avg') },
    { value: 'min', label: t('dashboard.widgetSettings.options.aggregation.min') },
    { value: 'max', label: t('dashboard.widgetSettings.options.aggregation.max') },
  ]

  const rollingFunctionOptions: { value: string; label: string }[] = [
    { value: 'mean', label: t('dashboard.widgetSettings.options.rollingFunction.mean') },
    { value: 'sum', label: t('dashboard.widgetSettings.options.rollingFunction.sum') },
    { value: 'min', label: t('dashboard.widgetSettings.options.rollingFunction.min') },
    { value: 'max', label: t('dashboard.widgetSettings.options.rollingFunction.max') },
  ]

  const dataZoomTypeOptions: { value: string; label: string }[] = [
    { value: 'slider', label: t('dashboard.widgetSettings.options.dataZoomType.slider') },
    { value: 'inside', label: t('dashboard.widgetSettings.options.dataZoomType.inside') },
    { value: 'both', label: t('dashboard.widgetSettings.options.dataZoomType.both') },
  ]

  const granularityOptions: { value: string; label: string }[] = [
    { value: '', label: t('dashboard.widgetSettings.options.granularity.none') },
    { value: 'hour', label: t('dashboard.widgetSettings.options.granularity.hour') },
    { value: 'day', label: t('dashboard.widgetSettings.options.granularity.day') },
    { value: 'week', label: t('dashboard.widgetSettings.options.granularity.week') },
    { value: 'month', label: t('dashboard.widgetSettings.options.granularity.month') },
    { value: 'quarter', label: t('dashboard.widgetSettings.options.granularity.quarter') },
    { value: 'year', label: t('dashboard.widgetSettings.options.granularity.year') },
  ]

  const granularityAggregationOptions: { value: string; label: string }[] = [
    { value: 'sum', label: t('dashboard.widgetSettings.options.aggregation.sum') },
    { value: 'avg', label: t('dashboard.widgetSettings.options.aggregation.avg') },
    { value: 'min', label: t('dashboard.widgetSettings.options.aggregation.min') },
    { value: 'max', label: t('dashboard.widgetSettings.options.aggregation.max') },
    { value: 'count', label: t('dashboard.widgetSettings.options.aggregation.count') },
  ]

  const comparisonTypeOptions: { value: string; label: string }[] = [
    { value: 'none', label: t('dashboard.widgetSettings.options.comparisonType.none') },
    { value: 'previous_row', label: t('dashboard.widgetSettings.options.comparisonType.previous_row') },
    { value: 'target', label: t('dashboard.widgetSettings.options.comparisonType.target') },
  ]

  const conditionOptions: { value: string; label: string }[] = [
    { value: 'gt', label: t('dashboard.widgetSettings.options.condition.gt') },
    { value: 'gte', label: t('dashboard.widgetSettings.options.condition.gte') },
    { value: 'lt', label: t('dashboard.widgetSettings.options.condition.lt') },
    { value: 'lte', label: t('dashboard.widgetSettings.options.condition.lte') },
    { value: 'eq', label: t('dashboard.widgetSettings.options.condition.eq') },
    { value: 'between', label: t('dashboard.widgetSettings.options.condition.between') },
  ]

  const sparklineTypeOptions: { value: string; label: string }[] = [
    { value: 'line', label: t('dashboard.widgetSettings.options.seriesType.line') },
    { value: 'bar', label: t('dashboard.widgetSettings.options.seriesType.bar') },
    { value: 'area', label: t('dashboard.widgetSettings.options.seriesType.area') },
  ]

  const [name, setName] = useState(widget.name)
  const [queryId, setQueryId] = useState(widget.query_id || '')
  const [chartType, setChartType] = useState<ChartType>(widget.chart_type)
  const [xAxis, setXAxis] = useState(widget.chart_config.xAxis || '')
  const [yAxis, setYAxis] = useState<string[]>(
    Array.isArray(widget.chart_config.yAxis)
      ? widget.chart_config.yAxis
      : widget.chart_config.yAxis
        ? [widget.chart_config.yAxis]
        : []
  )
  const [showLegend, setShowLegend] = useState(widget.chart_config.legend !== false)
  const [chartTitle, setChartTitle] = useState(widget.chart_config.title || '')
  const [markdownContent, setMarkdownContent] = useState(widget.chart_config.content || '')

  // Cartesian config (bar, area stacking)
  const [stacking, setStacking] = useState<string>(
    widget.chart_config.cartesianConfig?.stacking || 'none'
  )

  // Combo config
  const [comboSeriesTypes, setComboSeriesTypes] = useState<Record<string, string>>(
    widget.chart_config.comboConfig?.seriesTypes || {}
  )
  const [comboDualYAxis, setComboDualYAxis] = useState(
    widget.chart_config.comboConfig?.dualYAxis || false
  )

  // Heatmap config
  const [heatmapXColumn, setHeatmapXColumn] = useState(
    widget.chart_config.heatmapConfig?.xColumn || ''
  )
  const [heatmapYColumn, setHeatmapYColumn] = useState(
    widget.chart_config.heatmapConfig?.yColumn || ''
  )
  const [heatmapValueColumn, setHeatmapValueColumn] = useState(
    widget.chart_config.heatmapConfig?.valueColumn || ''
  )
  const [heatmapColorScheme, setHeatmapColorScheme] = useState(
    widget.chart_config.heatmapConfig?.colorScheme || 'default'
  )
  const [heatmapShowValues, setHeatmapShowValues] = useState(
    widget.chart_config.heatmapConfig?.showValues ?? true
  )

  // Gauge config
  const [gaugeMin, setGaugeMin] = useState(
    widget.chart_config.gaugeConfig?.min ?? 0
  )
  const [gaugeMax, setGaugeMax] = useState(
    widget.chart_config.gaugeConfig?.max ?? 100
  )
  const [gaugeShowPointer, setGaugeShowPointer] = useState(
    widget.chart_config.gaugeConfig?.showPointer ?? true
  )

  // Progress config
  const [progressTargetValue, setProgressTargetValue] = useState(
    widget.chart_config.progressConfig?.targetValue ?? 100
  )
  const [progressShowPercentage, setProgressShowPercentage] = useState(
    widget.chart_config.progressConfig?.showPercentage ?? true
  )
  const [progressColor, setProgressColor] = useState(
    widget.chart_config.progressConfig?.color || '#3b82f6'
  )

  // Time series config
  const [granularity, setGranularity] = useState<string>(
    widget.chart_config.timeSeriesConfig?.granularity || ''
  )
  const [granularityAggregation, setGranularityAggregation] = useState<'sum' | 'avg' | 'min' | 'max' | 'count'>(
    widget.chart_config.timeSeriesConfig?.aggregation || 'sum'
  )
  const [rollingEnabled, setRollingEnabled] = useState(
    widget.chart_config.timeSeriesConfig?.rollingWindow?.enabled ?? false
  )
  const [rollingPeriods, setRollingPeriods] = useState(
    widget.chart_config.timeSeriesConfig?.rollingWindow?.periods ?? 7
  )
  const [rollingFunction, setRollingFunction] = useState<'mean' | 'sum' | 'min' | 'max'>(
    widget.chart_config.timeSeriesConfig?.rollingWindow?.function ?? 'mean'
  )
  const [cumulativeEnabled, setCumulativeEnabled] = useState(
    widget.chart_config.timeSeriesConfig?.cumulative?.enabled ?? false
  )

  // DataZoom config
  const [dataZoomEnabled, setDataZoomEnabled] = useState(
    widget.chart_config.dataZoom?.enabled ?? false
  )
  const [dataZoomType, setDataZoomType] = useState<'inside' | 'slider' | 'both'>(
    widget.chart_config.dataZoom?.type ?? 'slider'
  )

  // Counter config
  const [valueColumn, setValueColumn] = useState(widget.chart_config.valueColumn || '')
  const [counterLabel, setCounterLabel] = useState(widget.chart_config.counterLabel || '')
  const [counterPrefix, setCounterPrefix] = useState(widget.chart_config.counterPrefix || '')
  const [counterSuffix, setCounterSuffix] = useState(widget.chart_config.counterSuffix || '')

  // Counter comparison config
  const [comparisonType, setComparisonType] = useState<ComparisonConfig['type']>(
    widget.chart_config.comparison?.type || 'none'
  )
  const [comparisonTargetValue, setComparisonTargetValue] = useState(
    widget.chart_config.comparison?.targetValue ?? 0
  )
  const [comparisonShowPercentChange, setComparisonShowPercentChange] = useState(
    widget.chart_config.comparison?.showPercentChange ?? true
  )
  const [comparisonInvertColors, setComparisonInvertColors] = useState(
    widget.chart_config.comparison?.invertColors ?? false
  )

  // Counter conditional formatting
  const [conditionalRules, setConditionalRules] = useState<ConditionalFormatRule[]>(
    widget.chart_config.conditionalFormatting?.[0]?.rules || []
  )

  // Counter sparkline config
  const [sparklineEnabled, setSparklineEnabled] = useState(
    widget.chart_config.sparkline?.enabled ?? false
  )
  const [sparklineType, setSparklineType] = useState<SparklineConfig['type']>(
    widget.chart_config.sparkline?.type || 'line'
  )
  const [sparklineColumn, setSparklineColumn] = useState(
    widget.chart_config.sparkline?.column || ''
  )

  // Pivot config
  const [rowGroupColumn, setRowGroupColumn] = useState(widget.chart_config.rowGroupColumn || '')
  const [colGroupColumn, setColGroupColumn] = useState(widget.chart_config.colGroupColumn || '')
  const [valueAggColumn, setValueAggColumn] = useState(widget.chart_config.valueAggColumn || '')
  const [aggregation, setAggregation] = useState(widget.chart_config.aggregation || 'sum')

  // Drilldown config - Table column links
  const [columnLinks, setColumnLinks] = useState<ColumnLinkConfig[]>(
    widget.chart_config.columnLinks || []
  )
  const [expandedColumnLinks, setExpandedColumnLinks] = useState<Set<string>>(new Set())

  // Drilldown config - Chart drilldown
  const [drilldownEnabled, setDrilldownEnabled] = useState(!!widget.chart_config.drilldown)
  const [drilldownTargetDashboardId, setDrilldownTargetDashboardId] = useState(
    widget.chart_config.drilldown?.targetDashboardId || ''
  )
  const [drilldownParameterMapping, setDrilldownParameterMapping] = useState<Record<string, string>>(
    widget.chart_config.drilldown?.parameterMapping || {}
  )

  const [columns, setColumns] = useState<string[]>([])
  const [loadingColumns, setLoadingColumns] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dashboards, setDashboards] = useState<Dashboard[]>([])

  // Load dashboards for drilldown target selection
  useEffect(() => {
    dashboardApi.getAll().then(setDashboards).catch(() => setDashboards([]))
  }, [])

  // Reset form when widget changes
  useEffect(() => {
    if (open) {
      setName(widget.name)
      setQueryId(widget.query_id || '')
      setChartType(widget.chart_type)
      setXAxis(widget.chart_config.xAxis || '')
      setYAxis(
        Array.isArray(widget.chart_config.yAxis)
          ? widget.chart_config.yAxis
          : widget.chart_config.yAxis
            ? [widget.chart_config.yAxis]
            : []
      )
      setShowLegend(widget.chart_config.legend !== false)
      setChartTitle(widget.chart_config.title || '')
      setMarkdownContent(widget.chart_config.content || '')

      // Cartesian config (bar, area stacking)
      setStacking(widget.chart_config.cartesianConfig?.stacking || 'none')

      // Combo config
      setComboSeriesTypes(widget.chart_config.comboConfig?.seriesTypes || {})
      setComboDualYAxis(widget.chart_config.comboConfig?.dualYAxis || false)

      // Heatmap config
      setHeatmapXColumn(widget.chart_config.heatmapConfig?.xColumn || '')
      setHeatmapYColumn(widget.chart_config.heatmapConfig?.yColumn || '')
      setHeatmapValueColumn(widget.chart_config.heatmapConfig?.valueColumn || '')
      setHeatmapColorScheme(widget.chart_config.heatmapConfig?.colorScheme || 'default')
      setHeatmapShowValues(widget.chart_config.heatmapConfig?.showValues ?? true)

      // Gauge config
      setGaugeMin(widget.chart_config.gaugeConfig?.min ?? 0)
      setGaugeMax(widget.chart_config.gaugeConfig?.max ?? 100)
      setGaugeShowPointer(widget.chart_config.gaugeConfig?.showPointer ?? true)

      // Progress config
      setProgressTargetValue(widget.chart_config.progressConfig?.targetValue ?? 100)
      setProgressShowPercentage(widget.chart_config.progressConfig?.showPercentage ?? true)
      setProgressColor(widget.chart_config.progressConfig?.color || '#3b82f6')

      // Time series config
      setGranularity(widget.chart_config.timeSeriesConfig?.granularity || '')
      setGranularityAggregation(widget.chart_config.timeSeriesConfig?.aggregation || 'sum')
      setRollingEnabled(widget.chart_config.timeSeriesConfig?.rollingWindow?.enabled ?? false)
      setRollingPeriods(widget.chart_config.timeSeriesConfig?.rollingWindow?.periods ?? 7)
      setRollingFunction(widget.chart_config.timeSeriesConfig?.rollingWindow?.function ?? 'mean')
      setCumulativeEnabled(widget.chart_config.timeSeriesConfig?.cumulative?.enabled ?? false)

      // DataZoom config
      setDataZoomEnabled(widget.chart_config.dataZoom?.enabled ?? false)
      setDataZoomType(widget.chart_config.dataZoom?.type ?? 'slider')

      // Counter config
      setValueColumn(widget.chart_config.valueColumn || '')
      setCounterLabel(widget.chart_config.counterLabel || '')
      setCounterPrefix(widget.chart_config.counterPrefix || '')
      setCounterSuffix(widget.chart_config.counterSuffix || '')

      // Counter comparison config
      setComparisonType(widget.chart_config.comparison?.type || 'none')
      setComparisonTargetValue(widget.chart_config.comparison?.targetValue ?? 0)
      setComparisonShowPercentChange(widget.chart_config.comparison?.showPercentChange ?? true)
      setComparisonInvertColors(widget.chart_config.comparison?.invertColors ?? false)

      // Counter conditional formatting
      setConditionalRules(widget.chart_config.conditionalFormatting?.[0]?.rules || [])

      // Counter sparkline config
      setSparklineEnabled(widget.chart_config.sparkline?.enabled ?? false)
      setSparklineType(widget.chart_config.sparkline?.type || 'line')
      setSparklineColumn(widget.chart_config.sparkline?.column || '')

      // Pivot config
      setRowGroupColumn(widget.chart_config.rowGroupColumn || '')
      setColGroupColumn(widget.chart_config.colGroupColumn || '')
      setValueAggColumn(widget.chart_config.valueAggColumn || '')
      setAggregation(widget.chart_config.aggregation || 'sum')

      // Drilldown config - Table column links
      setColumnLinks(widget.chart_config.columnLinks || [])
      setExpandedColumnLinks(new Set())

      // Drilldown config - Chart drilldown
      setDrilldownEnabled(!!widget.chart_config.drilldown)
      setDrilldownTargetDashboardId(widget.chart_config.drilldown?.targetDashboardId || '')
      setDrilldownParameterMapping(widget.chart_config.drilldown?.parameterMapping || {})

      // Load columns if query is already selected
      if (widget.query_id) {
        loadQueryColumns(widget.query_id)
      }
    }
  }, [open, widget])

  const loadQueryColumns = async (selectedQueryId: string) => {
    const query = savedQueries.find(q => q.id === selectedQueryId)
    if (!query) {
      setColumns([])
      return
    }

    setLoadingColumns(true)
    try {
      const result = await queryApi.execute(query.query_text)
      setColumns(result.columns)
    } catch (err) {
      console.error('Failed to load query columns:', err)
      setColumns([])
    } finally {
      setLoadingColumns(false)
    }
  }

  const handleQueryChange = (newQueryId: string) => {
    setQueryId(newQueryId)
    setXAxis('')
    setYAxis([])
    if (newQueryId) {
      loadQueryColumns(newQueryId)
    } else {
      setColumns([])
    }
  }

  const handleYAxisToggle = (column: string) => {
    setYAxis(prev =>
      prev.includes(column)
        ? prev.filter(c => c !== column)
        : [...prev, column]
    )
  }

  // Column link helpers
  const toggleColumnLink = (column: string) => {
    const existingLink = columnLinks.find(l => l.column === column)
    if (existingLink) {
      setColumnLinks(columnLinks.filter(l => l.column !== column))
      setExpandedColumnLinks(prev => {
        const next = new Set(prev)
        next.delete(column)
        return next
      })
    } else {
      setColumnLinks([...columnLinks, {
        column,
        targetDashboardId: '',
        parameterMapping: {},
      }])
      setExpandedColumnLinks(prev => new Set(prev).add(column))
    }
  }

  const updateColumnLink = (column: string, updates: Partial<ColumnLinkConfig>) => {
    setColumnLinks(columnLinks.map(l =>
      l.column === column ? { ...l, ...updates } : l
    ))
  }

  const toggleColumnLinkExpanded = (column: string) => {
    setExpandedColumnLinks(prev => {
      const next = new Set(prev)
      if (next.has(column)) {
        next.delete(column)
      } else {
        next.add(column)
      }
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      let chartConfig: ChartConfig

      if (chartType === 'markdown') {
        chartConfig = { content: markdownContent }
      } else if (chartType === 'counter') {
        chartConfig = {
          valueColumn: valueColumn || undefined,
          counterLabel: counterLabel || undefined,
          counterPrefix: counterPrefix || undefined,
          counterSuffix: counterSuffix || undefined,
        }

        // Add comparison config if not 'none'
        if (comparisonType !== 'none') {
          chartConfig.comparison = {
            type: comparisonType,
            targetValue: comparisonType === 'target' ? comparisonTargetValue : undefined,
            showPercentChange: comparisonShowPercentChange,
            invertColors: comparisonInvertColors,
          }
        }

        // Add conditional formatting if rules exist
        if (conditionalRules.length > 0) {
          chartConfig.conditionalFormatting = [{
            rules: conditionalRules,
          }]
        }

        // Add sparkline config if enabled
        if (sparklineEnabled) {
          chartConfig.sparkline = {
            enabled: true,
            type: sparklineType,
            column: sparklineColumn || valueColumn || '',
          }
        }
      } else if (chartType === 'pivot') {
        chartConfig = {
          rowGroupColumn: rowGroupColumn || undefined,
          colGroupColumn: colGroupColumn || undefined,
          valueAggColumn: valueAggColumn || undefined,
          aggregation: aggregation as ChartConfig['aggregation'],
        }
      } else if (chartType === 'table') {
        // Table with optional column links
        const validColumnLinks = columnLinks.filter(l => l.targetDashboardId)
        chartConfig = {
          columnLinks: validColumnLinks.length > 0 ? validColumnLinks : undefined,
        }
      } else if (chartType === 'gauge') {
        chartConfig = {
          valueColumn: valueColumn || undefined,
          counterLabel: counterLabel || undefined,
          gaugeConfig: {
            min: gaugeMin,
            max: gaugeMax,
            showPointer: gaugeShowPointer,
          },
        }
      } else if (chartType === 'progress') {
        chartConfig = {
          valueColumn: valueColumn || undefined,
          counterLabel: counterLabel || undefined,
          progressConfig: {
            targetValue: progressTargetValue,
            showPercentage: progressShowPercentage,
            color: progressColor !== '#3b82f6' ? progressColor : undefined,
          },
        }
      } else {
        // Standard charts with optional drilldown
        chartConfig = {
          xAxis: xAxis || undefined,
          yAxis: yAxis.length > 0 ? (yAxis.length === 1 ? yAxis[0] : yAxis) : undefined,
          legend: showLegend,
          title: chartTitle || undefined,
        }

        // Add cartesian config for bar/area charts (stacking)
        if ((chartType === 'bar' || chartType === 'area') && stacking !== 'none') {
          chartConfig.cartesianConfig = { stacking: stacking as CartesianConfig['stacking'] }
        }

        // Add combo config for combo charts
        if (chartType === 'combo') {
          chartConfig.comboConfig = {
            seriesTypes: Object.keys(comboSeriesTypes).length > 0 ? comboSeriesTypes as Record<string, 'bar' | 'line' | 'area'> : undefined,
            dualYAxis: comboDualYAxis || undefined,
          }
        }

        // Add heatmap config for heatmap charts
        if (chartType === 'heatmap') {
          chartConfig.heatmapConfig = {
            xColumn: heatmapXColumn || columns[0],
            yColumn: heatmapYColumn || columns[1],
            valueColumn: heatmapValueColumn || columns[2],
            colorScheme: heatmapColorScheme !== 'default' ? heatmapColorScheme : undefined,
            showValues: heatmapShowValues,
          }
        }

        // Add time series config for line/area charts
        if ((chartType === 'line' || chartType === 'area') && (granularity || rollingEnabled || cumulativeEnabled)) {
          chartConfig.timeSeriesConfig = {
            enabled: true,
            granularity: granularity ? granularity as 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year' : undefined,
            aggregation: granularity ? granularityAggregation : undefined,
            rollingWindow: rollingEnabled ? {
              enabled: true,
              periods: rollingPeriods,
              function: rollingFunction as 'mean' | 'sum' | 'min' | 'max',
            } : undefined,
            cumulative: cumulativeEnabled ? {
              enabled: true,
            } : undefined,
          }
        }

        // Add dataZoom config for bar/line/area charts
        if ((chartType === 'bar' || chartType === 'line' || chartType === 'area') && dataZoomEnabled) {
          chartConfig.dataZoom = {
            enabled: true,
            type: dataZoomType as 'slider' | 'inside' | 'both',
          }
        }

        // Add drilldown config if enabled
        if (drilldownEnabled && drilldownTargetDashboardId) {
          chartConfig.drilldown = {
            targetDashboardId: drilldownTargetDashboardId,
            parameterMapping: drilldownParameterMapping,
          }
        }
      }

      await onSave({
        name,
        query_id: chartType === 'markdown' ? null : (queryId || null),
        chart_type: chartType,
        chart_config: chartConfig,
      })
    } finally {
      setSaving(false)
    }
  }

  const isMarkdown = chartType === 'markdown'
  const isCounter = chartType === 'counter'
  const isPivot = chartType === 'pivot'
  const isTable = chartType === 'table'
  const isHeatmap = chartType === 'heatmap'
  const isGauge = chartType === 'gauge'
  const isProgress = chartType === 'progress'
  const isStandardChart = !isMarkdown && !isCounter && !isPivot && !isTable && !isHeatmap && !isGauge && !isProgress
  const showChartConfig = isStandardChart && queryId && columns.length > 0
  const showCounterConfig = isCounter && queryId && columns.length > 0
  const showPivotConfig = isPivot && queryId && columns.length > 0
  const showGaugeConfig = isGauge && queryId && columns.length > 0
  const showProgressConfig = isProgress && queryId && columns.length > 0
  const showTableConfig = isTable && queryId && columns.length > 0
  const showHeatmapConfig = isHeatmap && queryId && columns.length > 0
  const showChartDrilldown = isStandardChart && queryId && columns.length > 0

	  return (
	    <Dialog open={open} onClose={onClose}>
	      <DialogHeader>
	        <DialogTitle>{t('dashboard.widgetSettings.title')}</DialogTitle>
	      </DialogHeader>
	      <DialogContent>
	        <div className="space-y-4">
	          {/* Basic Settings */}
	          <div>
	            <label className="text-sm font-medium">{t('common.name')}</label>
	            <Input
	              value={name}
	              onChange={(e) => setName(e.target.value)}
	              placeholder={t('dashboard.widgetSettings.namePlaceholder')}
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

          {/* Markdown Content */}
	          {isMarkdown && (
	            <div>
	              <label className="text-sm font-medium">{t('dashboard.widgetSettings.markdown.content')}</label>
	              <textarea
	                value={markdownContent}
	                onChange={(e) => setMarkdownContent(e.target.value)}
	                placeholder={t('dashboard.widgetSettings.markdown.placeholder')}
	                className="w-full h-40 mt-1 px-3 py-2 text-sm border rounded-md bg-background resize-y font-mono"
	              />
	              <p className="mt-1 text-xs text-muted-foreground">
	                {t('dashboard.widgetSettings.markdown.hint')}
	              </p>
	            </div>
	          )}

          {/* Query Selection (for non-markdown) */}
	          {!isMarkdown && (
	            <div>
	              <label className="text-sm font-medium">{t('dashboard.widgetSettings.query')}</label>
	              <Select
	                value={queryId}
	                onChange={(e) => handleQueryChange(e.target.value)}
	                options={[
	                  { value: '', label: t('dashboard.widgetSettings.selectQueryPlaceholder') },
	                  ...savedQueries.map(q => ({ value: q.id, label: q.name })),
	                ]}
	              />
	            </div>
	          )}

          {/* Loading columns indicator */}
	          {!isMarkdown && loadingColumns && (
	            <div className="flex items-center gap-2 text-sm text-muted-foreground">
	              <Loader2 className="h-4 w-4 animate-spin" />
	              {t('dashboard.widgetSettings.loadingColumns')}
	            </div>
	          )}

          {/* Counter Configuration */}
	          {showCounterConfig && (
	            <>
	              <div className="border-t pt-4">
	                <h4 className="text-sm font-medium mb-3">{t('dashboard.widgetSettings.counter.title')}</h4>
	              </div>

	              <div>
	                <label className="text-sm font-medium">{t('dashboard.widgetSettings.counter.valueColumn')}</label>
	                <Select
	                  value={valueColumn}
	                  onChange={(e) => setValueColumn(e.target.value)}
	                  options={[
	                    { value: '', label: t('dashboard.widgetSettings.columnDefaults.first') },
	                    ...columns.map(col => ({ value: col, label: col })),
	                  ]}
	                />
	              </div>

	              <div>
	                <label className="text-sm font-medium">{t('dashboard.widgetSettings.counter.labelOptional')}</label>
	                <Input
	                  value={counterLabel}
	                  onChange={(e) => setCounterLabel(e.target.value)}
	                  placeholder={t('dashboard.widgetSettings.counter.labelPlaceholderTotalSales')}
	                />
	              </div>

	              <div className="grid grid-cols-2 gap-4">
	                <div>
	                  <label className="text-sm font-medium">{t('dashboard.widgetSettings.counter.prefixOptional')}</label>
	                  <Input
	                    value={counterPrefix}
	                    onChange={(e) => setCounterPrefix(e.target.value)}
	                    placeholder={t('dashboard.widgetSettings.counter.prefixPlaceholder')}
	                  />
	                </div>
	                <div>
	                  <label className="text-sm font-medium">{t('dashboard.widgetSettings.counter.suffixOptional')}</label>
	                  <Input
	                    value={counterSuffix}
	                    onChange={(e) => setCounterSuffix(e.target.value)}
	                    placeholder={t('dashboard.widgetSettings.counter.suffixPlaceholder')}
	                  />
	                </div>
	              </div>

	              {/* Comparison */}
	              <div className="border-t pt-4">
	                <h4 className="text-sm font-medium mb-3">{t('dashboard.widgetSettings.comparison.title')}</h4>
	              </div>

	              <div>
	                <label className="text-sm font-medium">{t('dashboard.widgetSettings.comparison.type')}</label>
	                <Select
	                  value={comparisonType}
	                  onChange={(e) => setComparisonType(e.target.value as ComparisonConfig['type'])}
	                  options={comparisonTypeOptions}
	                />
	              </div>

	              {comparisonType === 'target' && (
	                <div>
	                  <label className="text-sm font-medium">{t('dashboard.widgetSettings.comparison.targetValue')}</label>
	                  <Input
	                    type="number"
	                    value={comparisonTargetValue}
	                    onChange={(e) => setComparisonTargetValue(Number(e.target.value) || 0)}
	                    placeholder={t('dashboard.widgetSettings.comparison.targetValuePlaceholder')}
	                  />
	                </div>
	              )}

	              {comparisonType !== 'none' && (
	                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={comparisonShowPercentChange}
                      onChange={(e) => setComparisonShowPercentChange(e.target.checked)}
                      className="rounded border-input"
                    />
	                    <span className="text-sm font-medium">{t('dashboard.widgetSettings.comparison.showPercentChange')}</span>
	                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={comparisonInvertColors}
                      onChange={(e) => setComparisonInvertColors(e.target.checked)}
                      className="rounded border-input"
                    />
	                    <span className="text-sm font-medium">{t('dashboard.widgetSettings.comparison.invertColors')}</span>
	                  </label>
	                  <p className="text-xs text-muted-foreground ml-5">
	                    {t('dashboard.widgetSettings.comparison.invertColorsHint')}
	                  </p>
	                </div>
	              )}

	              {/* Conditional Formatting */}
	              <div className="border-t pt-4">
	                <div className="flex items-center justify-between mb-3">
	                  <h4 className="text-sm font-medium">{t('dashboard.widgetSettings.conditionalFormatting.title')}</h4>
	                  <Button
	                    variant="outline"
	                    size="sm"
                    onClick={() => setConditionalRules([...conditionalRules, {
                      condition: 'gt',
                      value: 0,
                      backgroundColor: '#dcfce7',
                      textColor: '#166534',
	                    }])}
	                  >
	                    <Plus className="h-4 w-4 mr-1" />
	                    {t('dashboard.widgetSettings.conditionalFormatting.addRule')}
	                  </Button>
	                </div>
	              </div>

              {conditionalRules.length > 0 && (
                <div className="space-y-3">
                  {conditionalRules.map((rule, index) => (
                    <div key={index} className="border rounded-md p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Select
                          value={rule.condition}
                          onChange={(e) => {
                            const newRules = [...conditionalRules]
                            newRules[index] = {
                              ...rule,
                              condition: e.target.value as ConditionalFormatRule['condition'],
                              value: e.target.value === 'between' ? [0, 100] : (Array.isArray(rule.value) ? rule.value[0] : rule.value),
                            }
                            setConditionalRules(newRules)
                          }}
                          options={conditionOptions}
                        />
                        {rule.condition === 'between' ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              value={Array.isArray(rule.value) ? rule.value[0] : 0}
                              onChange={(e) => {
                                const newRules = [...conditionalRules]
                                const currentValue = Array.isArray(rule.value) ? rule.value : [0, 100]
                                newRules[index] = { ...rule, value: [Number(e.target.value) || 0, currentValue[1]] }
                                setConditionalRules(newRules)
                              }}
                              className="w-20"
                            />
	                            <span className="text-sm">{t('dashboard.widgetSettings.conditionalFormatting.and')}</span>
	                            <Input
                              type="number"
                              value={Array.isArray(rule.value) ? rule.value[1] : 100}
                              onChange={(e) => {
                                const newRules = [...conditionalRules]
                                const currentValue = Array.isArray(rule.value) ? rule.value : [0, 100]
                                newRules[index] = { ...rule, value: [currentValue[0], Number(e.target.value) || 0] }
                                setConditionalRules(newRules)
                              }}
                              className="w-20"
                            />
                          </div>
                        ) : (
                          <Input
                            type="number"
                            value={Array.isArray(rule.value) ? rule.value[0] : rule.value}
                            onChange={(e) => {
                              const newRules = [...conditionalRules]
                              newRules[index] = { ...rule, value: Number(e.target.value) || 0 }
                              setConditionalRules(newRules)
                            }}
                            className="w-24"
                          />
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConditionalRules(conditionalRules.filter((_, i) => i !== index))}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
	                      <div className="flex items-center gap-4">
	                        <div className="flex items-center gap-2">
	                          <label className="text-xs">{t('dashboard.widgetSettings.conditionalFormatting.background')}</label>
	                          <input
                            type="color"
                            value={rule.backgroundColor || '#dcfce7'}
                            onChange={(e) => {
                              const newRules = [...conditionalRules]
                              newRules[index] = { ...rule, backgroundColor: e.target.value }
                              setConditionalRules(newRules)
                            }}
                            className="w-8 h-6 rounded border border-input cursor-pointer"
                          />
	                        </div>
	                        <div className="flex items-center gap-2">
	                          <label className="text-xs">{t('dashboard.widgetSettings.conditionalFormatting.text')}</label>
	                          <input
                            type="color"
                            value={rule.textColor || '#166534'}
                            onChange={(e) => {
                              const newRules = [...conditionalRules]
                              newRules[index] = { ...rule, textColor: e.target.value }
                              setConditionalRules(newRules)
                            }}
                            className="w-8 h-6 rounded border border-input cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

	              {/* Sparkline */}
	              <div className="border-t pt-4">
	                <h4 className="text-sm font-medium mb-3">{t('dashboard.widgetSettings.sparkline.title')}</h4>
	              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
	                  <input
	                    type="checkbox"
	                    checked={sparklineEnabled}
	                    onChange={(e) => setSparklineEnabled(e.target.checked)}
	                    className="rounded border-input"
	                  />
	                  <span className="text-sm font-medium">{t('dashboard.widgetSettings.sparkline.enable')}</span>
	                </label>
	                <p className="mt-1 text-xs text-muted-foreground ml-5">
	                  {t('dashboard.widgetSettings.sparkline.enableHint')}
	                </p>
	              </div>

              {sparklineEnabled && (
	                <>
	                  <div className="ml-5">
	                    <label className="text-sm font-medium">{t('dashboard.widgetSettings.sparkline.type')}</label>
	                    <Select
	                      value={sparklineType}
	                      onChange={(e) => setSparklineType(e.target.value as SparklineConfig['type'])}
	                      options={sparklineTypeOptions}
                    />
                  </div>

	                  <div className="ml-5">
	                    <label className="text-sm font-medium">{t('dashboard.widgetSettings.sparkline.dataColumn')}</label>
	                    <Select
	                      value={sparklineColumn}
	                      onChange={(e) => setSparklineColumn(e.target.value)}
	                      options={[
	                        { value: '', label: t('dashboard.widgetSettings.sparkline.useValueColumn') },
	                        ...columns.map(col => ({ value: col, label: col })),
	                      ]}
	                    />
	                    <p className="mt-1 text-xs text-muted-foreground">
	                      {t('dashboard.widgetSettings.sparkline.dataColumnHint')}
	                    </p>
	                  </div>
	                </>
	              )}
            </>
          )}

          {/* Gauge Configuration */}
	          {showGaugeConfig && (
	            <>
	              <div className="border-t pt-4">
	                <h4 className="text-sm font-medium mb-3">{t('dashboard.widgetSettings.gauge.title')}</h4>
	              </div>

	              <div>
	                <label className="text-sm font-medium">{t('dashboard.widgetSettings.counter.valueColumn')}</label>
	                <Select
	                  value={valueColumn}
	                  onChange={(e) => setValueColumn(e.target.value)}
	                  options={[
	                    { value: '', label: t('dashboard.widgetSettings.columnDefaults.first') },
	                    ...columns.map(col => ({ value: col, label: col })),
	                  ]}
	                />
	              </div>

	              <div>
	                <label className="text-sm font-medium">{t('dashboard.widgetSettings.counter.labelOptional')}</label>
	                <Input
	                  value={counterLabel}
	                  onChange={(e) => setCounterLabel(e.target.value)}
	                  placeholder={t('dashboard.widgetSettings.gauge.labelPlaceholderCpuUsage')}
	                />
	              </div>

	              <div className="grid grid-cols-2 gap-4">
	                <div>
	                  <label className="text-sm font-medium">{t('dashboard.widgetSettings.gauge.minimum')}</label>
	                  <Input
	                    type="number"
	                    value={gaugeMin}
	                    onChange={(e) => setGaugeMin(Number(e.target.value) || 0)}
                    placeholder="0"
                  />
	                </div>
	                <div>
	                  <label className="text-sm font-medium">{t('dashboard.widgetSettings.gauge.maximum')}</label>
	                  <Input
	                    type="number"
	                    value={gaugeMax}
	                    onChange={(e) => setGaugeMax(Number(e.target.value) || 100)}
                    placeholder="100"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={gaugeShowPointer}
	                    onChange={(e) => setGaugeShowPointer(e.target.checked)}
	                    className="rounded border-input"
	                  />
	                  <span className="text-sm font-medium">{t('dashboard.widgetSettings.gauge.showPointer')}</span>
	                </label>
	              </div>
	            </>
	          )}

          {/* Progress Bar Configuration */}
	          {showProgressConfig && (
	            <>
	              <div className="border-t pt-4">
	                <h4 className="text-sm font-medium mb-3">{t('dashboard.widgetSettings.progress.title')}</h4>
	              </div>

	              <div>
	                <label className="text-sm font-medium">{t('dashboard.widgetSettings.counter.valueColumn')}</label>
	                <Select
	                  value={valueColumn}
	                  onChange={(e) => setValueColumn(e.target.value)}
	                  options={[
	                    { value: '', label: t('dashboard.widgetSettings.columnDefaults.first') },
	                    ...columns.map(col => ({ value: col, label: col })),
	                  ]}
	                />
	              </div>

	              <div>
	                <label className="text-sm font-medium">{t('dashboard.widgetSettings.counter.labelOptional')}</label>
	                <Input
	                  value={counterLabel}
	                  onChange={(e) => setCounterLabel(e.target.value)}
	                  placeholder={t('dashboard.widgetSettings.progress.labelPlaceholderTasksCompleted')}
	                />
	              </div>

	              <div>
	                <label className="text-sm font-medium">{t('dashboard.widgetSettings.progress.targetValue')}</label>
	                <Input
	                  type="number"
	                  value={progressTargetValue}
	                  onChange={(e) => setProgressTargetValue(Number(e.target.value) || 100)}
	                  placeholder="100"
	                />
	                <p className="mt-1 text-xs text-muted-foreground">
	                  {t('dashboard.widgetSettings.progress.targetValueHint')}
	                </p>
	              </div>

              <div className="grid grid-cols-2 gap-4">
	                <div>
	                  <label className="text-sm font-medium">{t('dashboard.widgetSettings.progress.progressColor')}</label>
	                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="color"
                      value={progressColor}
                      onChange={(e) => setProgressColor(e.target.value)}
                      className="w-10 h-8 rounded border border-input cursor-pointer"
                    />
                    <Input
                      value={progressColor}
                      onChange={(e) => setProgressColor(e.target.value)}
                      placeholder="#3b82f6"
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
	                    <input
	                      type="checkbox"
	                      checked={progressShowPercentage}
	                      onChange={(e) => setProgressShowPercentage(e.target.checked)}
	                      className="rounded border-input"
	                    />
	                    <span className="text-sm font-medium">{t('dashboard.widgetSettings.progress.showPercentage')}</span>
	                  </label>
	                </div>
	              </div>
	            </>
	          )}

          {/* Pivot Configuration */}
	          {showPivotConfig && (
	            <>
	              <div className="border-t pt-4">
	                <h4 className="text-sm font-medium mb-3">{t('dashboard.widgetSettings.pivot.title')}</h4>
	              </div>

	              <div>
	                <label className="text-sm font-medium">{t('dashboard.widgetSettings.pivot.rowGroupingColumn')}</label>
	                <Select
	                  value={rowGroupColumn}
	                  onChange={(e) => setRowGroupColumn(e.target.value)}
	                  options={[
	                    { value: '', label: t('dashboard.widgetSettings.columnDefaults.first') },
	                    ...columns.map(col => ({ value: col, label: col })),
	                  ]}
	                />
	              </div>

	              <div>
	                <label className="text-sm font-medium">{t('dashboard.widgetSettings.pivot.columnGroupingColumn')}</label>
	                <Select
	                  value={colGroupColumn}
	                  onChange={(e) => setColGroupColumn(e.target.value)}
	                  options={[
	                    { value: '', label: t('dashboard.widgetSettings.columnDefaults.second') },
	                    ...columns.map(col => ({ value: col, label: col })),
	                  ]}
	                />
	              </div>

	              <div>
	                <label className="text-sm font-medium">{t('dashboard.widgetSettings.pivot.valueColumn')}</label>
	                <Select
	                  value={valueAggColumn}
	                  onChange={(e) => setValueAggColumn(e.target.value)}
	                  options={[
	                    { value: '', label: t('dashboard.widgetSettings.columnDefaults.third') },
	                    ...columns.map(col => ({ value: col, label: col })),
	                  ]}
	                />
	              </div>

	              <div>
	                <label className="text-sm font-medium">{t('dashboard.widgetSettings.pivot.aggregation')}</label>
	                <Select
	                  value={aggregation}
	                  onChange={(e) => setAggregation((e.target.value as ChartConfig['aggregation']) || 'sum')}
	                  options={aggregationOptions}
                />
              </div>
            </>
          )}

          {/* Standard Chart Configuration */}
	          {showChartConfig && (
	            <>
	              <div className="border-t pt-4">
	                <h4 className="text-sm font-medium mb-3">{t('dashboard.widgetSettings.chart.title')}</h4>
	              </div>

	              <div>
	                <label className="text-sm font-medium">{t('dashboard.widgetSettings.chart.xAxisColumn')}</label>
	                <Select
	                  value={xAxis}
	                  onChange={(e) => setXAxis(e.target.value)}
	                  options={[
	                    { value: '', label: t('dashboard.widgetSettings.chart.selectColumnPlaceholder') },
	                    ...columns.map(col => ({ value: col, label: col })),
	                  ]}
	                />
	              </div>

	              <div>
	                <label className="text-sm font-medium">{t('dashboard.widgetSettings.chart.yAxisColumns')}</label>
	                <div className="mt-2 space-y-2 max-h-32 overflow-y-auto border rounded-md p-2">
                  {columns.map(col => (
                    <label key={col} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={yAxis.includes(col)}
                        onChange={() => handleYAxisToggle(col)}
                        className="rounded border-input"
                      />
                      <span className="text-sm">{col}</span>
                    </label>
                  ))}
                </div>
              </div>

	              <div>
	                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
	                    checked={showLegend}
	                    onChange={(e) => setShowLegend(e.target.checked)}
	                    className="rounded border-input"
	                  />
	                  <span className="text-sm font-medium">{t('dashboard.widgetSettings.chart.showLegend')}</span>
	                </label>
	              </div>

	              <div>
	                <label className="text-sm font-medium">{t('dashboard.widgetSettings.chart.chartTitleOptional')}</label>
	                <Input
	                  value={chartTitle}
	                  onChange={(e) => setChartTitle(e.target.value)}
	                  placeholder={t('dashboard.widgetSettings.chart.chartTitlePlaceholder')}
	                />
	              </div>

              {/* Stacking option for bar and area charts */}
	              {(chartType === 'bar' || chartType === 'area') && (
	                <div>
	                  <label className="text-sm font-medium">{t('dashboard.widgetSettings.chart.stacking')}</label>
	                  <Select
	                    value={stacking || 'none'}
	                    onChange={(e) => setStacking(e.target.value)}
	                    options={stackingOptions}
	                  />
	                  <p className="mt-1 text-xs text-muted-foreground">
	                    {t('dashboard.widgetSettings.chart.stackingHint')}
	                  </p>
	                </div>
	              )}

              {/* Combo chart configuration */}
	              {chartType === 'combo' && yAxis.length > 0 && (
	                <>
	                  <div className="border-t pt-4">
	                    <h4 className="text-sm font-medium mb-3">{t('dashboard.widgetSettings.combo.seriesTypes')}</h4>
	                    <p className="text-xs text-muted-foreground mb-2">
	                      {t('dashboard.widgetSettings.combo.seriesTypesHint')}
	                    </p>
	                  </div>

                  <div className="space-y-2">
                    {yAxis.map((col, index) => (
                      <div key={col} className="flex items-center gap-2">
                        <span className="text-sm flex-1 truncate" title={col}>{col}</span>
                        <Select
                          value={comboSeriesTypes[col] || (index === 0 ? 'bar' : 'line')}
                          onChange={(e) => setComboSeriesTypes(prev => ({ ...prev, [col]: e.target.value }))}
                          options={comboSeriesTypeOptions}
                        />
                      </div>
                    ))}
                  </div>

                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
	                      <input
	                        type="checkbox"
	                        checked={comboDualYAxis}
	                        onChange={(e) => setComboDualYAxis(e.target.checked)}
	                        className="rounded border-input"
	                      />
	                      <span className="text-sm font-medium">{t('dashboard.widgetSettings.combo.dualYAxis')}</span>
	                    </label>
	                    <p className="mt-1 text-xs text-muted-foreground ml-5">
	                      {t('dashboard.widgetSettings.combo.dualYAxisHint')}
	                    </p>
	                  </div>
	                </>
	              )}

              {/* Time Series Features (line/area only) */}
	              {(chartType === 'line' || chartType === 'area') && (
	                <>
	                  <div className="border-t pt-4">
	                    <h4 className="text-sm font-medium mb-3">{t('dashboard.widgetSettings.timeSeries.title')}</h4>
	                  </div>

                  {/* Time Granularity */}
	                  <div>
	                    <label className="text-sm font-medium">{t('dashboard.widgetSettings.timeSeries.granularity')}</label>
	                    <p className="text-xs text-muted-foreground mb-2">
	                      {t('dashboard.widgetSettings.timeSeries.granularityHint')}
	                    </p>
	                    <Select
	                      value={granularity}
	                      onChange={(e) => setGranularity(e.target.value)}
	                      options={granularityOptions}
                    />
                  </div>

	                  {granularity && (
	                    <div className="ml-5">
	                      <label className="text-sm font-medium">{t('dashboard.widgetSettings.timeSeries.aggregationFunction')}</label>
	                      <Select
	                        value={granularityAggregation}
	                        onChange={(e) => setGranularityAggregation(e.target.value as 'sum' | 'avg' | 'min' | 'max' | 'count')}
	                        options={granularityAggregationOptions}
                      />
                    </div>
                  )}

	                  <div>
	                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
	                        checked={rollingEnabled}
	                        onChange={(e) => setRollingEnabled(e.target.checked)}
	                        className="rounded border-input"
	                      />
	                      <span className="text-sm font-medium">{t('dashboard.widgetSettings.timeSeries.rollingWindow')}</span>
	                    </label>
	                  </div>

	                  {rollingEnabled && (
	                    <div className="grid grid-cols-2 gap-4 ml-5">
	                      <div>
	                        <label className="text-sm font-medium">{t('dashboard.widgetSettings.timeSeries.periods')}</label>
	                        <Input
	                          type="number"
	                          min="2"
	                          value={rollingPeriods}
                          onChange={(e) => setRollingPeriods(Number(e.target.value) || 7)}
                          placeholder="7"
                        />
	                      </div>
	                      <div>
	                        <label className="text-sm font-medium">{t('dashboard.widgetSettings.timeSeries.function')}</label>
	                        <Select
	                          value={rollingFunction}
	                          onChange={(e) => setRollingFunction(e.target.value as 'mean' | 'sum' | 'min' | 'max')}
	                          options={rollingFunctionOptions}
                        />
                      </div>
                    </div>
                  )}

	                  <div>
	                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
	                        checked={cumulativeEnabled}
	                        onChange={(e) => setCumulativeEnabled(e.target.checked)}
	                        className="rounded border-input"
	                      />
	                      <span className="text-sm font-medium">{t('dashboard.widgetSettings.timeSeries.cumulativeSum')}</span>
	                    </label>
	                    <p className="mt-1 text-xs text-muted-foreground ml-5">
	                      {t('dashboard.widgetSettings.timeSeries.cumulativeSumHint')}
	                    </p>
	                  </div>
	                </>
	              )}

              {/* Data Zoom (bar/line/area) */}
	              {(chartType === 'bar' || chartType === 'line' || chartType === 'area') && (
	                <>
	                  <div className="border-t pt-4">
	                    <h4 className="text-sm font-medium mb-3">{t('dashboard.widgetSettings.dataZoom.title')}</h4>
	                  </div>

                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
	                      checked={dataZoomEnabled}
	                      onChange={(e) => setDataZoomEnabled(e.target.checked)}
	                      className="rounded border-input"
	                    />
	                    <span className="text-sm font-medium">{t('dashboard.widgetSettings.dataZoom.enable')}</span>
	                  </label>
	                  <p className="mt-1 text-xs text-muted-foreground ml-5">
	                    {t('dashboard.widgetSettings.dataZoom.enableHint')}
	                  </p>
	                </div>

	                  {dataZoomEnabled && (
	                    <div className="ml-5">
	                      <label className="text-sm font-medium">{t('dashboard.widgetSettings.dataZoom.zoomType')}</label>
	                      <Select
	                        value={dataZoomType}
	                        onChange={(e) => setDataZoomType(e.target.value as 'inside' | 'slider' | 'both')}
	                        options={dataZoomTypeOptions}
                      />
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Heatmap Configuration */}
	          {showHeatmapConfig && (
	            <>
	              <div className="border-t pt-4">
	                <h4 className="text-sm font-medium mb-3">{t('dashboard.widgetSettings.heatmap.title')}</h4>
	              </div>

	              <div>
	                <label className="text-sm font-medium">{t('dashboard.widgetSettings.heatmap.xAxisCategories')}</label>
	                <Select
	                  value={heatmapXColumn}
	                  onChange={(e) => setHeatmapXColumn(e.target.value)}
	                  options={[
	                    { value: '', label: t('dashboard.widgetSettings.columnDefaults.first') },
	                    ...columns.map(col => ({ value: col, label: col })),
	                  ]}
	                />
	              </div>

	              <div>
	                <label className="text-sm font-medium">{t('dashboard.widgetSettings.heatmap.yAxisCategories')}</label>
	                <Select
	                  value={heatmapYColumn}
	                  onChange={(e) => setHeatmapYColumn(e.target.value)}
	                  options={[
	                    { value: '', label: t('dashboard.widgetSettings.columnDefaults.second') },
	                    ...columns.map(col => ({ value: col, label: col })),
	                  ]}
	                />
	              </div>

	              <div>
	                <label className="text-sm font-medium">{t('dashboard.widgetSettings.heatmap.valueColumn')}</label>
	                <Select
	                  value={heatmapValueColumn}
	                  onChange={(e) => setHeatmapValueColumn(e.target.value)}
	                  options={[
	                    { value: '', label: t('dashboard.widgetSettings.columnDefaults.third') },
	                    ...columns.map(col => ({ value: col, label: col })),
	                  ]}
	                />
	              </div>

	              <div>
	                <label className="text-sm font-medium">{t('dashboard.widgetSettings.heatmap.colorScheme')}</label>
	                <Select
	                  value={heatmapColorScheme}
	                  onChange={(e) => setHeatmapColorScheme(e.target.value)}
	                  options={heatmapColorSchemes}
                />
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={heatmapShowValues}
	                  onChange={(e) => setHeatmapShowValues(e.target.checked)}
	                  className="rounded border-input"
	                />
	                <span className="text-sm font-medium">{t('dashboard.widgetSettings.heatmap.showValues')}</span>
	              </label>
	              <p className="mt-1 text-xs text-muted-foreground ml-5">
	                {t('dashboard.widgetSettings.heatmap.showValuesHint')}
	              </p>
	            </div>
	          </>
	        )}

          {/* Table Column Links Configuration */}
	          {showTableConfig && (
	            <>
	              <div className="border-t pt-4">
	                <h4 className="text-sm font-medium mb-1">{t('dashboard.widgetSettings.tableLinks.title')}</h4>
	                <p className="text-xs text-muted-foreground mb-3">
	                  {t('dashboard.widgetSettings.tableLinks.description')}
	                </p>
	              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {columns.map(col => {
                  const linkConfig = columnLinks.find(l => l.column === col)
                  const isExpanded = expandedColumnLinks.has(col)

                  return (
                    <div key={col} className="border rounded-md">
                      <div
                        className="flex items-center gap-2 p-2 cursor-pointer hover:bg-muted/50"
                        onClick={() => linkConfig ? toggleColumnLinkExpanded(col) : toggleColumnLink(col)}
                      >
                        <input
                          type="checkbox"
                          checked={!!linkConfig}
                          onChange={() => toggleColumnLink(col)}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded border-input"
                        />
                        <span className="text-sm flex-1">{col}</span>
                        {linkConfig && (
                          isExpanded
                            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>

	                      {linkConfig && isExpanded && (
	                        <div className="p-3 pt-0 space-y-3 border-t">
	                          <div>
	                            <label className="text-xs font-medium">{t('dashboard.widgetSettings.tableLinks.targetDashboard')}</label>
	                            <Select
	                              value={linkConfig.targetDashboardId}
	                              onChange={(e) => updateColumnLink(col, { targetDashboardId: e.target.value })}
	                              options={[
	                                { value: '', label: t('dashboard.widgetSettings.tableLinks.selectDashboardPlaceholder') },
	                                ...dashboards.map(d => ({ value: d.id, label: d.name })),
	                              ]}
	                            />
	                          </div>

	                          <div>
	                            <label className="text-xs font-medium">{t('dashboard.widgetSettings.tableLinks.parameterMapping')}</label>
	                            <p className="text-xs text-muted-foreground mb-2">
	                              {t('dashboard.widgetSettings.tableLinks.parameterMappingHint')}
	                            </p>
	                            <ParameterMappingEditor
	                              mapping={linkConfig.parameterMapping}
	                              onChange={(mapping) => updateColumnLink(col, { parameterMapping: mapping })}
	                              availableSources={['@', ...columns]}
	                              sourcePlaceholder={t('dashboard.parameterMappingEditor.sourcePlaceholder')}
	                            />
	                          </div>

	                          <div>
	                            <label className="text-xs font-medium">{t('dashboard.widgetSettings.tableLinks.displayTextOptional')}</label>
	                            <Input
	                              value={linkConfig.textTemplate || ''}
	                              onChange={(e) => updateColumnLink(col, { textTemplate: e.target.value || undefined })}
	                              placeholder={t('dashboard.widgetSettings.tableLinks.displayTextPlaceholder', { at: '{{@}}' })}
	                              className="text-sm"
	                            />
	                            <p className="text-xs text-muted-foreground mt-1">
	                              {t('dashboard.widgetSettings.tableLinks.displayTextHint', { at: '{{@}}', columnName: '{{column_name}}' })}
	                            </p>
	                          </div>
	                        </div>
	                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* Chart Drilldown Configuration */}
	          {showChartDrilldown && (
	            <>
	              <div className="border-t pt-4">
	                <h4 className="text-sm font-medium mb-1">{t('dashboard.widgetSettings.drilldown.title')}</h4>
	                <p className="text-xs text-muted-foreground mb-3">
	                  {t('dashboard.widgetSettings.drilldown.description')}
	                </p>
	              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
	                  <input
	                    type="checkbox"
	                    checked={drilldownEnabled}
	                    onChange={(e) => setDrilldownEnabled(e.target.checked)}
	                    className="rounded border-input"
	                  />
	                  <span className="text-sm font-medium">{t('dashboard.widgetSettings.drilldown.enable')}</span>
	                </label>
	              </div>

              {drilldownEnabled && (
                <>
	                  <div>
	                    <label className="text-sm font-medium">{t('dashboard.widgetSettings.drilldown.targetDashboard')}</label>
	                    <Select
	                      value={drilldownTargetDashboardId}
	                      onChange={(e) => setDrilldownTargetDashboardId(e.target.value)}
	                      options={[
	                        { value: '', label: t('dashboard.widgetSettings.drilldown.selectDashboardPlaceholder') },
	                        ...dashboards.map(d => ({ value: d.id, label: d.name })),
	                      ]}
	                    />
	                  </div>

	                  <div>
	                    <label className="text-sm font-medium">{t('dashboard.widgetSettings.drilldown.parameterMapping')}</label>
	                    <p className="text-xs text-muted-foreground mb-2">
	                      {t('dashboard.widgetSettings.drilldown.parameterMappingHint')}
	                    </p>
	                    <ParameterMappingEditor
	                      mapping={drilldownParameterMapping}
	                      onChange={setDrilldownParameterMapping}
	                      availableSources={['name', 'value', 'series', ...columns]}
	                      sourcePlaceholder={t('dashboard.parameterMappingEditor.sourcePlaceholder')}
	                    />
	                  </div>
	                </>
	              )}
            </>
          )}
        </div>
      </DialogContent>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={saving}>
          {t('common.cancel')}
        </Button>
        <Button onClick={handleSave} disabled={saving || !name.trim()}>
          {saving ? t('common.saving') : t('common.save')}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
