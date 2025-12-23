import React, { useState, useEffect } from 'react'
import type { Widget, SavedQuery, ChartType, ChartConfig, Dashboard, ColumnLinkConfig } from '@/types'
import { queryApi, dashboardApi } from '@/services/api'
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { ParameterMappingEditor } from './ParameterMappingEditor'
import { Loader2, ChevronDown, ChevronRight } from 'lucide-react'

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

const aggregationOptions: { value: string; label: string }[] = [
  { value: 'sum', label: 'Sum' },
  { value: 'count', label: 'Count' },
  { value: 'avg', label: 'Average' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
]

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

  // Counter config
  const [valueColumn, setValueColumn] = useState(widget.chart_config.valueColumn || '')
  const [counterLabel, setCounterLabel] = useState(widget.chart_config.counterLabel || '')
  const [counterPrefix, setCounterPrefix] = useState(widget.chart_config.counterPrefix || '')
  const [counterSuffix, setCounterSuffix] = useState(widget.chart_config.counterSuffix || '')

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

      // Counter config
      setValueColumn(widget.chart_config.valueColumn || '')
      setCounterLabel(widget.chart_config.counterLabel || '')
      setCounterPrefix(widget.chart_config.counterPrefix || '')
      setCounterSuffix(widget.chart_config.counterSuffix || '')

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
      } else {
        // Standard charts with optional drilldown
        chartConfig = {
          xAxis: xAxis || undefined,
          yAxis: yAxis.length > 0 ? (yAxis.length === 1 ? yAxis[0] : yAxis) : undefined,
          legend: showLegend,
          title: chartTitle || undefined,
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
  const isStandardChart = !isMarkdown && !isCounter && !isPivot && !isTable
  const showChartConfig = isStandardChart && queryId && columns.length > 0
  const showCounterConfig = isCounter && queryId && columns.length > 0
  const showPivotConfig = isPivot && queryId && columns.length > 0
  const showTableConfig = isTable && queryId && columns.length > 0
  const showChartDrilldown = isStandardChart && queryId && columns.length > 0

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader>
        <DialogTitle>Widget Settings</DialogTitle>
      </DialogHeader>
      <DialogContent>
        <div className="space-y-4">
          {/* Basic Settings */}
          <div>
            <label className="text-sm font-medium">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Widget name"
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

          {/* Markdown Content */}
          {isMarkdown && (
            <div>
              <label className="text-sm font-medium">Content (Markdown)</label>
              <textarea
                value={markdownContent}
                onChange={(e) => setMarkdownContent(e.target.value)}
                placeholder="Enter markdown content..."
                className="w-full h-40 mt-1 px-3 py-2 text-sm border rounded-md bg-background resize-y font-mono"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Supports Markdown: **bold**, *italic*, # headings, - lists, [links](url)
              </p>
            </div>
          )}

          {/* Query Selection (for non-markdown) */}
          {!isMarkdown && (
            <div>
              <label className="text-sm font-medium">Query</label>
              <Select
                value={queryId}
                onChange={(e) => handleQueryChange(e.target.value)}
                options={[
                  { value: '', label: 'Select a query...' },
                  ...savedQueries.map(q => ({ value: q.id, label: q.name })),
                ]}
              />
            </div>
          )}

          {/* Loading columns indicator */}
          {!isMarkdown && loadingColumns && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading columns...
            </div>
          )}

          {/* Counter Configuration */}
          {showCounterConfig && (
            <>
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-3">Counter Configuration</h4>
              </div>

              <div>
                <label className="text-sm font-medium">Value Column</label>
                <Select
                  value={valueColumn}
                  onChange={(e) => setValueColumn(e.target.value)}
                  options={[
                    { value: '', label: 'First column (default)' },
                    ...columns.map(col => ({ value: col, label: col })),
                  ]}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Label (optional)</label>
                <Input
                  value={counterLabel}
                  onChange={(e) => setCounterLabel(e.target.value)}
                  placeholder="e.g., Total Sales"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Prefix (optional)</label>
                  <Input
                    value={counterPrefix}
                    onChange={(e) => setCounterPrefix(e.target.value)}
                    placeholder="e.g., $"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Suffix (optional)</label>
                  <Input
                    value={counterSuffix}
                    onChange={(e) => setCounterSuffix(e.target.value)}
                    placeholder="e.g., %"
                  />
                </div>
              </div>
            </>
          )}

          {/* Pivot Configuration */}
          {showPivotConfig && (
            <>
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-3">Pivot Configuration</h4>
              </div>

              <div>
                <label className="text-sm font-medium">Row Grouping Column</label>
                <Select
                  value={rowGroupColumn}
                  onChange={(e) => setRowGroupColumn(e.target.value)}
                  options={[
                    { value: '', label: 'First column (default)' },
                    ...columns.map(col => ({ value: col, label: col })),
                  ]}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Column Grouping Column</label>
                <Select
                  value={colGroupColumn}
                  onChange={(e) => setColGroupColumn(e.target.value)}
                  options={[
                    { value: '', label: 'Second column (default)' },
                    ...columns.map(col => ({ value: col, label: col })),
                  ]}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Value Column</label>
                <Select
                  value={valueAggColumn}
                  onChange={(e) => setValueAggColumn(e.target.value)}
                  options={[
                    { value: '', label: 'Third column (default)' },
                    ...columns.map(col => ({ value: col, label: col })),
                  ]}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Aggregation</label>
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
                <h4 className="text-sm font-medium mb-3">Chart Configuration</h4>
              </div>

              <div>
                <label className="text-sm font-medium">X-Axis Column</label>
                <Select
                  value={xAxis}
                  onChange={(e) => setXAxis(e.target.value)}
                  options={[
                    { value: '', label: 'Select column...' },
                    ...columns.map(col => ({ value: col, label: col })),
                  ]}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Y-Axis Column(s)</label>
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
                  <span className="text-sm font-medium">Show Legend</span>
                </label>
              </div>

              <div>
                <label className="text-sm font-medium">Chart Title (optional)</label>
                <Input
                  value={chartTitle}
                  onChange={(e) => setChartTitle(e.target.value)}
                  placeholder="Chart title"
                />
              </div>
            </>
          )}

          {/* Table Column Links Configuration */}
          {showTableConfig && (
            <>
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-1">Column Links (Drilldown)</h4>
                <p className="text-xs text-muted-foreground mb-3">
                  Configure columns to be clickable links to other dashboards.
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
                            <label className="text-xs font-medium">Target Dashboard</label>
                            <Select
                              value={linkConfig.targetDashboardId}
                              onChange={(e) => updateColumnLink(col, { targetDashboardId: e.target.value })}
                              options={[
                                { value: '', label: 'Select dashboard...' },
                                ...dashboards.map(d => ({ value: d.id, label: d.name })),
                              ]}
                            />
                          </div>

                          <div>
                            <label className="text-xs font-medium">Parameter Mapping</label>
                            <p className="text-xs text-muted-foreground mb-2">
                              Use "@" for this cell value, or column names.
                            </p>
                            <ParameterMappingEditor
                              mapping={linkConfig.parameterMapping}
                              onChange={(mapping) => updateColumnLink(col, { parameterMapping: mapping })}
                              availableSources={['@', ...columns]}
                              sourcePlaceholder="Select source..."
                            />
                          </div>

                          <div>
                            <label className="text-xs font-medium">Display Text (optional)</label>
                            <Input
                              value={linkConfig.textTemplate || ''}
                              onChange={(e) => updateColumnLink(col, { textTemplate: e.target.value || undefined })}
                              placeholder="e.g., View {{@}}"
                              className="text-sm"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              {'Use {{@}} for cell value or {{column_name}}.'}
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
                <h4 className="text-sm font-medium mb-1">Click Action (Drilldown)</h4>
                <p className="text-xs text-muted-foreground mb-3">
                  Navigate to another dashboard when clicking chart elements.
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
                  <span className="text-sm font-medium">Enable drilldown</span>
                </label>
              </div>

              {drilldownEnabled && (
                <>
                  <div>
                    <label className="text-sm font-medium">Target Dashboard</label>
                    <Select
                      value={drilldownTargetDashboardId}
                      onChange={(e) => setDrilldownTargetDashboardId(e.target.value)}
                      options={[
                        { value: '', label: 'Select dashboard...' },
                        ...dashboards.map(d => ({ value: d.id, label: d.name })),
                      ]}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Parameter Mapping</label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Map clicked data to dashboard parameters: name (X-axis), value (Y-axis), series, or column names.
                    </p>
                    <ParameterMappingEditor
                      mapping={drilldownParameterMapping}
                      onChange={setDrilldownParameterMapping}
                      availableSources={['name', 'value', 'series', ...columns]}
                      sourcePlaceholder="Select source..."
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
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving || !name.trim()}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
