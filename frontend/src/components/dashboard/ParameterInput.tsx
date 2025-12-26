import React, { useCallback, useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { dashboardApi } from '@/services/api'
import type { ParameterDefinition, ParameterOption } from '@/types'
import { Loader2 } from 'lucide-react'

interface ParameterInputProps {
  definition: ParameterDefinition
  value: string
  onChange: (value: string) => void
  /** Dashboard ID for fetching dynamic options */
  dashboardId?: string
  /** All current parameter values (for dependsOn cascade) */
  allValues?: Record<string, string>
}

// Date range presets
const DATE_PRESETS = [
  { label: 'Today', days: 0 },
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
]

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function getDatePreset(days: number): { start: string; end: string } {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - days)
  return { start: formatDate(start), end: formatDate(end) }
}

export const ParameterInput: React.FC<ParameterInputProps> = ({
  definition,
  value,
  onChange,
  dashboardId,
  allValues = {},
}) => {
  const { t } = useTranslation()
  const [dynamicOptions, setDynamicOptions] = useState<ParameterOption[] | null>(null)
  const [isLoadingOptions, setIsLoadingOptions] = useState(false)
  const [optionsError, setOptionsError] = useState<string | null>(null)

  // Get dependent values for cascade
  const dependentValues = useMemo(() => {
    if (!definition.depends_on || definition.depends_on.length === 0) {
      return {}
    }
    const deps: Record<string, string> = {}
    for (const depName of definition.depends_on) {
      if (allValues[depName]) {
        deps[depName] = allValues[depName]
      }
    }
    return deps
  }, [definition.depends_on, allValues])

  // Check if all dependencies are satisfied
  const dependenciesSatisfied = useMemo(() => {
    if (!definition.depends_on || definition.depends_on.length === 0) {
      return true
    }
    return definition.depends_on.every(depName => allValues[depName] && allValues[depName].trim() !== '')
  }, [definition.depends_on, allValues])

  // Create a stable key for dependency values to trigger refetch
  const dependentValuesKey = useMemo(() => {
    return JSON.stringify(dependentValues)
  }, [dependentValues])

  // Fetch dynamic options when optionsQueryId is set
  useEffect(() => {
    const shouldFetchDynamicOptions =
      definition.options_query_id &&
      dashboardId &&
      (definition.type === 'select' || definition.type === 'multiselect')

    if (!shouldFetchDynamicOptions) {
      return
    }

    // If dependencies not satisfied, clear options
    if (!dependenciesSatisfied) {
      setDynamicOptions([])
      return
    }

    let cancelled = false
    setIsLoadingOptions(true)
    setOptionsError(null)

    dashboardApi
      .getParameterOptions(dashboardId, definition.name, dependentValues)
      .then(options => {
        if (!cancelled) {
          setDynamicOptions(options)
        }
      })
      .catch(err => {
        if (!cancelled) {
          console.error('Failed to fetch parameter options:', err)
          setOptionsError(t('dashboard.parameters.optionsError', 'Failed to load options'))
          setDynamicOptions([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingOptions(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [definition.options_query_id, definition.name, definition.type, dashboardId, dependentValuesKey, dependenciesSatisfied, t])

  // Get effective options (dynamic or static)
  const effectiveOptions = useMemo((): ParameterOption[] => {
    if (dynamicOptions !== null) {
      return dynamicOptions
    }
    return definition.options || []
  }, [dynamicOptions, definition.options])

  const handleMultiSelectChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(e.target.selectedOptions, option => option.value)
    onChange(selectedOptions.join(','))
  }, [onChange])

  // Parse daterange value (format: "start,end")
  const parseDateRange = (val: string): { start: string; end: string } => {
    const [start, end] = val.split(',')
    return { start: start || '', end: end || '' }
  }

  const handleDateRangeChange = (field: 'start' | 'end', newValue: string) => {
    const current = parseDateRange(value)
    current[field] = newValue
    onChange(`${current.start},${current.end}`)
  }

  const handlePresetClick = (days: number) => {
    const preset = getDatePreset(days)
    onChange(`${preset.start},${preset.end}`)
  }

  // Show loading/error state for select/multiselect with dynamic options
  if (isLoadingOptions && (definition.type === 'select' || definition.type === 'multiselect')) {
    return (
      <div className="flex items-center gap-2 w-40 h-8 px-2 border rounded-md bg-muted/50">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-xs text-muted-foreground">
          {t('common.loading', 'Loading...')}
        </span>
      </div>
    )
  }

  if (optionsError && (definition.type === 'select' || definition.type === 'multiselect')) {
    return (
      <div className="flex items-center gap-2 w-40 h-8 px-2 border border-red-300 rounded-md bg-red-50">
        <span className="text-xs text-red-600">{optionsError}</span>
      </div>
    )
  }

  // Show disabled state if dependencies not satisfied
  if (!dependenciesSatisfied && (definition.type === 'select' || definition.type === 'multiselect')) {
    const depLabels = definition.depends_on?.join(', ') || ''
    return (
      <div className="flex items-center gap-2 w-40 h-8 px-2 border rounded-md bg-muted/50">
        <span className="text-xs text-muted-foreground">
          {t('dashboard.parameters.selectDependency', `Select ${depLabels} first`)}
        </span>
      </div>
    )
  }

  switch (definition.type) {
    case 'number':
      return (
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={definition.label || definition.name}
          className="w-32 h-8"
        />
      )

    case 'date':
      return (
        <Input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-36 h-8"
        />
      )

    case 'daterange': {
      const range = parseDateRange(value)
      return (
        <div className="flex items-center gap-1">
          <Input
            type="date"
            value={range.start}
            onChange={(e) => handleDateRangeChange('start', e.target.value)}
            className="w-32 h-8"
          />
          <span className="text-muted-foreground">-</span>
          <Input
            type="date"
            value={range.end}
            onChange={(e) => handleDateRangeChange('end', e.target.value)}
            className="w-32 h-8"
          />
          <div className="flex gap-1 ml-1">
            {DATE_PRESETS.map(preset => (
              <button
                key={preset.days}
                type="button"
                onClick={() => handlePresetClick(preset.days)}
                className="px-2 py-1 text-xs rounded bg-muted hover:bg-muted/80"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )
    }

    case 'select':
      return (
        <Select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          options={[
            { value: '', label: t('common.select', 'Select...') },
            ...effectiveOptions,
          ]}
          className="w-40"
        />
      )

    case 'multiselect': {
      const selectedValues = value ? value.split(',') : []
      return (
        <select
          multiple
          value={selectedValues}
          onChange={handleMultiSelectChange}
          className="min-w-[160px] h-20 text-sm border rounded-md px-2 py-1"
        >
          {effectiveOptions.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )
    }

    case 'text':
    default:
      return (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={definition.label || definition.name}
          className="w-40 h-8"
        />
      )
  }
}
