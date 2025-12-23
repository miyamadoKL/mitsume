import React from 'react'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Plus, Trash2 } from 'lucide-react'

interface ParameterMappingEditorProps {
  mapping: Record<string, string>
  onChange: (mapping: Record<string, string>) => void
  availableSources: string[]
  sourcePlaceholder?: string
}

export const ParameterMappingEditor: React.FC<ParameterMappingEditorProps> = ({
  mapping,
  onChange,
  availableSources,
  sourcePlaceholder = 'Select source...',
}) => {
  const entries = Object.entries(mapping)

  const addEntry = () => {
    const newKey = `param_${entries.length + 1}`
    onChange({ ...mapping, [newKey]: '' })
  }

  const updateKey = (oldKey: string, newKey: string) => {
    if (oldKey === newKey) return
    const newMapping: Record<string, string> = {}
    for (const [key, value] of Object.entries(mapping)) {
      if (key === oldKey) {
        newMapping[newKey] = value
      } else {
        newMapping[key] = value
      }
    }
    onChange(newMapping)
  }

  const updateValue = (key: string, value: string) => {
    onChange({ ...mapping, [key]: value })
  }

  const removeEntry = (key: string) => {
    const newMapping = { ...mapping }
    delete newMapping[key]
    onChange(newMapping)
  }

  return (
    <div className="space-y-2">
      {entries.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No parameter mappings configured.
        </p>
      )}
      {entries.map(([key, value], index) => (
        <div key={index} className="flex gap-2 items-center">
          <Input
            placeholder="Parameter name"
            value={key}
            onChange={(e) => updateKey(key, e.target.value)}
            className="flex-1"
          />
          <span className="text-muted-foreground">=</span>
          <Select
            value={value}
            onChange={(e) => updateValue(key, e.target.value)}
            options={[
              { value: '', label: sourcePlaceholder },
              ...availableSources.map(s => ({ value: s, label: s })),
            ]}
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => removeEntry(key)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addEntry}>
        <Plus className="h-4 w-4 mr-1" /> Add Mapping
      </Button>
    </div>
  )
}
