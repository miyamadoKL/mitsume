import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp } from 'lucide-react'
import type { ParameterDefinition, ParameterType, SqlFormat, SavedQuery } from '@/types'

interface ParameterSettingsDialogProps {
  open: boolean
  onClose: () => void
  parameters: ParameterDefinition[]
  discoveredParameters: string[]
  savedQueries?: SavedQuery[]
  onSave: (parameters: ParameterDefinition[]) => Promise<void>
}

const parameterTypeOptions: { value: ParameterType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'daterange', label: 'Date Range' },
  { value: 'select', label: 'Select' },
  { value: 'multiselect', label: 'Multi-Select' },
]

const sqlFormatOptions: { value: SqlFormat; label: string }[] = [
  { value: 'raw', label: 'Raw (as-is)' },
  { value: 'string', label: 'String (quoted)' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'identifier', label: 'Identifier' },
  { value: 'string_list', label: 'String List' },
  { value: 'number_list', label: 'Number List' },
]

export const ParameterSettingsDialog: React.FC<ParameterSettingsDialogProps> = ({
  open,
  onClose,
  parameters,
  discoveredParameters,
  savedQueries = [],
  onSave,
}) => {
  const { t } = useTranslation()
  const [localParams, setLocalParams] = useState<ParameterDefinition[]>([])
  const [saving, setSaving] = useState(false)
  const [expandedParams, setExpandedParams] = useState<Set<number>>(new Set())

  // Build query options for select
  const queryOptions = useMemo(() => [
    { value: '', label: t('dashboard.parameters.noOptionsQuery', 'No options query (use static options)') },
    ...savedQueries.map(q => ({ value: q.id, label: q.name })),
  ], [savedQueries, t])

  // Initialize with current parameters
  useEffect(() => {
    if (open) {
      setLocalParams([...parameters])
    }
  }, [open, parameters])

  // Add discovered parameters that are not already defined
  const handleAddDiscovered = useCallback(() => {
    const existingNames = new Set(localParams.map(p => p.name))
    const newParams = discoveredParameters
      .filter(name => !existingNames.has(name))
      .map(name => ({
        name,
        type: 'text' as ParameterType,
        label: name,
        required: false,
        sql_format: 'raw' as SqlFormat,
      }))
    setLocalParams(prev => [...prev, ...newParams])
  }, [localParams, discoveredParameters])

  const handleAddParameter = useCallback(() => {
    const newParam: ParameterDefinition = {
      name: '',
      type: 'text',
      label: '',
      required: false,
      sql_format: 'raw',
    }
    setLocalParams(prev => [...prev, newParam])
  }, [])

  const handleRemoveParameter = useCallback((index: number) => {
    setLocalParams(prev => prev.filter((_, i) => i !== index))
  }, [])

  const handleUpdateParameter = useCallback((index: number, updates: Partial<ParameterDefinition>) => {
    setLocalParams(prev => prev.map((p, i) => (i === index ? { ...p, ...updates } : p)))
  }, [])

  const toggleExpanded = useCallback((index: number) => {
    setExpandedParams(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }, [])

  const handleSave = useCallback(async () => {
    // Validate: remove empty names
    const validParams = localParams.filter(p => p.name.trim() !== '')
    setSaving(true)
    try {
      await onSave(validParams)
      onClose()
    } catch (err) {
      console.error('Failed to save parameters:', err)
    } finally {
      setSaving(false)
    }
  }, [localParams, onSave, onClose])

  // Count undiscovered parameters
  const existingNames = new Set(localParams.map(p => p.name))
  const undiscoveredCount = discoveredParameters.filter(name => !existingNames.has(name)).length

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader>
        <DialogTitle>{t('dashboard.parameters.settings', 'Parameter Settings')}</DialogTitle>
      </DialogHeader>
      <DialogContent className="max-h-[60vh] overflow-y-auto">
        <div className="space-y-4">
          {/* Auto-discover button */}
          {undiscoveredCount > 0 && (
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <span className="text-sm">
                {t('dashboard.parameters.discoveredCount', {
                  count: undiscoveredCount,
                  defaultValue: `${undiscoveredCount} parameter(s) found in queries`,
                })}
              </span>
              <Button size="sm" variant="outline" onClick={handleAddDiscovered}>
                {t('dashboard.parameters.addDiscovered', 'Add All')}
              </Button>
            </div>
          )}

          {/* Parameter list */}
          {localParams.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {t('dashboard.parameters.noParameters', 'No parameters defined')}
            </div>
          ) : (
            <div className="space-y-3">
              {localParams.map((param, index) => {
                const isSelectType = param.type === 'select' || param.type === 'multiselect'
                const isExpanded = expandedParams.has(index)
                const otherParamNames = localParams.filter((_, i) => i !== index).map(p => p.name).filter(n => n)

                return (
                  <div key={index} className="border rounded-lg p-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <Input
                          placeholder={t('dashboard.parameters.namePlaceholder', 'Parameter name')}
                          value={param.name}
                          onChange={(e) => handleUpdateParameter(index, { name: e.target.value })}
                        />
                        <Input
                          placeholder={t('dashboard.parameters.labelPlaceholder', 'Display label')}
                          value={param.label || ''}
                          onChange={(e) => handleUpdateParameter(index, { label: e.target.value || undefined })}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveParameter(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <Select
                        value={param.type}
                        onChange={(e) => handleUpdateParameter(index, { type: e.target.value as ParameterType })}
                        options={parameterTypeOptions}
                      />
                      <Select
                        value={param.sql_format || 'raw'}
                        onChange={(e) => handleUpdateParameter(index, { sql_format: e.target.value as SqlFormat })}
                        options={sqlFormatOptions}
                      />
                      <Input
                        placeholder={t('dashboard.parameters.defaultPlaceholder', 'Default value')}
                        value={typeof param.default_value === 'string' ? param.default_value : ''}
                        onChange={(e) => handleUpdateParameter(index, { default_value: e.target.value || undefined })}
                      />
                    </div>

                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={param.required || false}
                          onChange={(e) => handleUpdateParameter(index, { required: e.target.checked })}
                        />
                        {t('dashboard.parameters.required', 'Required')}
                      </label>

                      {/* Advanced options toggle for select types */}
                      {isSelectType && (
                        <button
                          type="button"
                          onClick={() => toggleExpanded(index)}
                          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          {t('dashboard.parameters.advancedOptions', 'Advanced')}
                        </button>
                      )}
                    </div>

                    {/* Advanced options for select/multiselect */}
                    {isSelectType && isExpanded && (
                      <div className="mt-3 pt-3 border-t space-y-3">
                        {/* Options Query */}
                        <div>
                          <label className="text-sm font-medium">
                            {t('dashboard.parameters.optionsQuery', 'Options Query')}
                          </label>
                          <Select
                            value={param.options_query_id || ''}
                            onChange={(e) => handleUpdateParameter(index, {
                              options_query_id: e.target.value || undefined
                            })}
                            options={queryOptions}
                            className="mt-1"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            {t('dashboard.parameters.optionsQueryHint', 'Query should return 2 columns: value, label')}
                          </p>
                        </div>

                        {/* Depends On */}
                        {otherParamNames.length > 0 && (
                          <div>
                            <label className="text-sm font-medium">
                              {t('dashboard.parameters.dependsOn', 'Depends On')}
                            </label>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {otherParamNames.map(name => {
                                const isSelected = param.depends_on?.includes(name)
                                return (
                                  <button
                                    key={name}
                                    type="button"
                                    onClick={() => {
                                      const current = param.depends_on || []
                                      const next = isSelected
                                        ? current.filter(n => n !== name)
                                        : [...current, name]
                                      handleUpdateParameter(index, {
                                        depends_on: next.length > 0 ? next : undefined
                                      })
                                    }}
                                    className={`px-2 py-1 text-xs rounded border ${
                                      isSelected
                                        ? 'bg-primary text-primary-foreground border-primary'
                                        : 'bg-muted border-muted-foreground/20 hover:border-primary'
                                    }`}
                                  >
                                    {name}
                                  </button>
                                )
                              })}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {t('dashboard.parameters.dependsOnHint', 'Options will reload when these parameters change')}
                            </p>
                          </div>
                        )}

                        {/* Static options (only if no options query) */}
                        {!param.options_query_id && (
                          <div>
                            <label className="text-sm font-medium">
                              {t('dashboard.parameters.staticOptions', 'Static Options')}
                            </label>
                            <Input
                              placeholder={t('dashboard.parameters.staticOptionsPlaceholder', 'value1:Label 1,value2:Label 2')}
                              value={(param.options || []).map(o => `${o.value}:${o.label}`).join(',')}
                              onChange={(e) => {
                                const options = e.target.value
                                  .split(',')
                                  .map(s => s.trim())
                                  .filter(s => s)
                                  .map(s => {
                                    const [value, label] = s.split(':')
                                    return { value: value || '', label: label || value || '' }
                                  })
                                handleUpdateParameter(index, { options: options.length > 0 ? options : undefined })
                              }}
                              className="mt-1"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              {t('dashboard.parameters.staticOptionsHint', 'Format: value1:Label 1,value2:Label 2')}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Add parameter button */}
          <Button variant="outline" className="w-full" onClick={handleAddParameter}>
            <Plus className="h-4 w-4 mr-2" />
            {t('dashboard.parameters.addParameter', 'Add Parameter')}
          </Button>
        </div>
      </DialogContent>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
