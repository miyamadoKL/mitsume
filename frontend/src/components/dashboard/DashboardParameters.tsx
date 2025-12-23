import React from 'react'
import { Input } from '@/components/ui/input'

interface DashboardParametersProps {
  /** List of parameter names to display */
  parameters: string[]
  /** Current parameter values */
  values: Record<string, string>
  /** Called when a parameter value changes */
  onChange: (name: string, value: string) => void
}

export const DashboardParameters: React.FC<DashboardParametersProps> = ({
  parameters,
  values,
  onChange,
}) => {
  if (parameters.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-4 p-4 bg-muted/50 border-b">
      <span className="text-sm font-medium text-muted-foreground">Filters:</span>
      {parameters.map(param => (
        <div key={param} className="flex items-center gap-2">
          <label htmlFor={`param-${param}`} className="text-sm font-medium">
            {param}:
          </label>
          <Input
            id={`param-${param}`}
            value={values[param] || ''}
            onChange={(e) => onChange(param, e.target.value)}
            placeholder={`Enter ${param}`}
            className="w-40 h-8"
          />
        </div>
      ))}
    </div>
  )
}
