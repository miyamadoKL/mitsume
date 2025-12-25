import React from 'react'
import { useTranslation } from 'react-i18next'
import type { LayoutTemplate } from '@/types'
import { systemLayoutTemplates } from '@/lib/layout-templates'
import { cn } from '@/lib/utils'
import {
  LayoutGrid,
  LayoutList,
  Columns,
  Grid2X2,
  PanelLeft,
  Gauge,
  FileSpreadsheet,
} from 'lucide-react'

interface LayoutTemplateSelectorProps {
  selectedId: string
  onSelect: (template: LayoutTemplate) => void
  customTemplates?: LayoutTemplate[]
}

// Map template IDs to icons
const templateIcons: Record<string, React.ReactNode> = {
  'blank': <LayoutGrid className="h-8 w-8" />,
  'kpi-row-chart': <Gauge className="h-8 w-8" />,
  'two-column': <Columns className="h-8 w-8" />,
  'three-column': <LayoutList className="h-8 w-8" />,
  'main-sidebar': <PanelLeft className="h-8 w-8" />,
  'grid-2x2': <Grid2X2 className="h-8 w-8" />,
  'executive-summary': <FileSpreadsheet className="h-8 w-8" />,
}

export const LayoutTemplateSelector: React.FC<LayoutTemplateSelectorProps> = ({
  selectedId,
  onSelect,
  customTemplates = [],
}) => {
  const { t } = useTranslation()
  const allTemplates = [...systemLayoutTemplates, ...customTemplates]

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium text-muted-foreground mb-2">
        {t('dashboard.templates.selectTemplate')}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {allTemplates.map((template) => (
          <button
            key={template.id}
            onClick={() => onSelect(template)}
            className={cn(
              'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors',
              'hover:border-primary/50 hover:bg-muted/50',
              selectedId === template.id
                ? 'border-primary bg-primary/5'
                : 'border-border'
            )}
          >
            <div className={cn(
              'text-muted-foreground',
              selectedId === template.id && 'text-primary'
            )}>
              {templateIcons[template.id] || <LayoutGrid className="h-8 w-8" />}
            </div>
            <div className="text-center">
              <div className={cn(
                'text-sm font-medium',
                selectedId === template.id && 'text-primary'
              )}>
                {t(`dashboard.templates.${template.id}.name`, { defaultValue: template.name })}
              </div>
              <div className="text-xs text-muted-foreground line-clamp-2">
                {t(`dashboard.templates.${template.id}.description`, { defaultValue: template.description })}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
