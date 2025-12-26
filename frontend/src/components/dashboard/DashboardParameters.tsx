import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ParameterInput } from './ParameterInput'
import { Check, RotateCcw, ChevronDown, ChevronUp, Filter } from 'lucide-react'
import type { ParameterDefinition } from '@/types'

interface DashboardParametersProps {
  /** Dashboard ID for fetching dynamic options */
  dashboardId: string
  /** List of parameter names to display (from discovery) */
  parameters: string[]
  /** Parameter definitions from dashboard settings */
  definitions?: ParameterDefinition[]
  /** Current draft values (user is editing) */
  draftValues: Record<string, string>
  /** Applied values (used by widgets) */
  appliedValues: Record<string, string>
  /** Called when a draft value changes */
  onDraftChange: (name: string, value: string) => void
  /** Called when user clicks Apply */
  onApply: () => void
  /** Called when user clicks Clear/Reset */
  onReset: () => void
  /** Whether there are unapplied changes */
  hasChanges: boolean
}

export const DashboardParameters: React.FC<DashboardParametersProps> = ({
  dashboardId,
  parameters,
  definitions = [],
  draftValues,
  appliedValues,
  onDraftChange,
  onApply,
  onReset,
  hasChanges,
}) => {
  const { t } = useTranslation()
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Build a map of definitions by name for quick lookup
  const definitionMap = useMemo(() => {
    const map = new Map<string, ParameterDefinition>()
    for (const def of definitions) {
      map.set(def.name, def)
    }
    return map
  }, [definitions])

  // Merge parameters: show defined parameters first (in order), then discovered ones
  const allParams = useMemo(() => {
    const definedNames = new Set(definitions.map(d => d.name))
    const discoveredOnly = parameters.filter(p => !definedNames.has(p))
    // Return defined params first (preserving order), then undiscovered
    return [...definitions.map(d => d.name), ...discoveredOnly]
  }, [parameters, definitions])

  // Count active filters
  const activeFilterCount = Object.values(appliedValues).filter(v => v && v.trim() !== '').length

  if (allParams.length === 0) {
    return null
  }

  return (
    <div className="border-b bg-muted/50">
      {/* Filter bar header */}
      <div className="flex items-center justify-between px-4 py-2">
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <Filter className="h-4 w-4" />
          <span>{t('dashboard.parameters.filters')}</span>
          {activeFilterCount > 0 && (
            <span className="px-1.5 py-0.5 text-xs rounded-full bg-primary text-primary-foreground">
              {activeFilterCount}
            </span>
          )}
          {isCollapsed ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </button>

        {/* Action buttons - always visible */}
        <div className="flex items-center gap-2">
          {hasChanges && (
            <span className="text-xs text-amber-600">
              {t('dashboard.parameters.unappliedChanges', 'Unapplied changes')}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            disabled={Object.keys(appliedValues).length === 0 && !hasChanges}
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            {t('dashboard.parameters.clear', 'Clear')}
          </Button>
          <Button
            size="sm"
            onClick={onApply}
            disabled={!hasChanges}
          >
            <Check className="h-3 w-3 mr-1" />
            {t('dashboard.parameters.apply', 'Apply')}
          </Button>
        </div>
      </div>

      {/* Collapsible filter content */}
      {!isCollapsed && (
        <div className="px-4 pb-3 overflow-x-auto">
          <div className="flex flex-wrap items-center gap-4 min-w-min">
            {allParams.map(paramName => {
              const def = definitionMap.get(paramName)
              const label = def?.label || paramName

              return (
                <div key={paramName} className="flex items-center gap-2 flex-shrink-0">
                  <label htmlFor={`param-${paramName}`} className="text-sm font-medium whitespace-nowrap">
                    {label}
                    {def?.required && <span className="text-red-500 ml-0.5">*</span>}
                    :
                  </label>
                  {def ? (
                    <ParameterInput
                      definition={def}
                      value={draftValues[paramName] || ''}
                      onChange={(value) => onDraftChange(paramName, value)}
                      dashboardId={dashboardId}
                      allValues={draftValues}
                    />
                  ) : (
                    <Input
                      id={`param-${paramName}`}
                      value={draftValues[paramName] || ''}
                      onChange={(e) => onDraftChange(paramName, e.target.value)}
                      placeholder={t('dashboard.parameters.enterPlaceholder', { param: paramName })}
                      className="w-40 h-8"
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
