import React from 'react'
import { useTranslation } from 'react-i18next'
import type { LayoutTemplate } from '@/types'
import { systemLayoutTemplates } from '@/lib/layout-templates'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  LayoutGrid,
  LayoutList,
  Columns,
  Grid2X2,
  PanelLeft,
  Gauge,
  FileSpreadsheet,
  Trash2,
  User,
} from 'lucide-react'

interface LayoutTemplateSelectorProps {
  selectedId: string
  onSelect: (template: LayoutTemplate) => void
  customTemplates?: LayoutTemplate[]
  onDeleteTemplate?: (templateId: string) => void
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
  onDeleteTemplate,
}) => {
  const { t } = useTranslation()

  const handleDelete = (e: React.MouseEvent, templateId: string) => {
    e.stopPropagation()
    if (onDeleteTemplate) {
      onDeleteTemplate(templateId)
    }
  }

  return (
    <div className="space-y-4">
      {/* System templates */}
      <div>
        <div className="text-sm font-medium text-muted-foreground mb-2">
          {t('dashboard.templates.systemTemplates', 'System Templates')}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {systemLayoutTemplates.map((template) => (
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

      {/* Custom templates */}
      {customTemplates.length > 0 && (
        <div>
          <div className="text-sm font-medium text-muted-foreground mb-2">
            {t('dashboard.templates.customTemplates', 'My Templates')}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {customTemplates.map((template) => (
              <div
                key={template.id}
                className={cn(
                  'relative flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors cursor-pointer',
                  'hover:border-primary/50 hover:bg-muted/50',
                  selectedId === template.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border'
                )}
                onClick={() => onSelect(template)}
              >
                {/* Delete button for custom templates */}
                {onDeleteTemplate && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6 opacity-50 hover:opacity-100"
                    onClick={(e) => handleDelete(e, template.id)}
                    title={t('common.delete')}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
                <div className={cn(
                  'text-muted-foreground',
                  selectedId === template.id && 'text-primary'
                )}>
                  <User className="h-8 w-8" />
                </div>
                <div className="text-center">
                  <div className={cn(
                    'text-sm font-medium',
                    selectedId === template.id && 'text-primary'
                  )}>
                    {template.name}
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-2">
                    {template.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
