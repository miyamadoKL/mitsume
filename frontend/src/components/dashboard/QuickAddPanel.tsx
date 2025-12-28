import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Card } from '@/components/ui/card'
import type { ChartType } from '@/types'
import {
  BarChart3,
  LineChart,
  PieChart,
  Table,
  Hash,
  FileText,
  TrendingUp,
  Grid3X3,
  GripVertical,
} from 'lucide-react'

interface QuickAddItem {
  type: ChartType
  icon: React.ReactNode
  labelKey: string
}

const quickAddItems: QuickAddItem[] = [
  { type: 'bar', icon: <BarChart3 className="h-6 w-6" />, labelKey: 'chart.types.bar' },
  { type: 'line', icon: <LineChart className="h-6 w-6" />, labelKey: 'chart.types.line' },
  { type: 'pie', icon: <PieChart className="h-6 w-6" />, labelKey: 'chart.types.pie' },
  { type: 'table', icon: <Table className="h-6 w-6" />, labelKey: 'chart.types.table' },
  { type: 'counter', icon: <Hash className="h-6 w-6" />, labelKey: 'chart.types.counter' },
  { type: 'area', icon: <TrendingUp className="h-6 w-6" />, labelKey: 'chart.types.area' },
  { type: 'pivot', icon: <Grid3X3 className="h-6 w-6" />, labelKey: 'chart.types.pivot' },
  { type: 'markdown', icon: <FileText className="h-6 w-6" />, labelKey: 'chart.types.markdown' },
]

interface QuickAddPanelProps {
  onAddWidget: (type: ChartType) => void
  onDragStart?: (type: ChartType) => void
  onDragEnd?: () => void
}

export const QuickAddPanel: React.FC<QuickAddPanelProps> = ({
  onAddWidget,
  onDragStart,
  onDragEnd,
}) => {
  const { t } = useTranslation()

  const handleDragStart = useCallback((e: React.DragEvent, type: ChartType) => {
    // Set data for the drop target
    e.dataTransfer.setData('text/plain', type)
    e.dataTransfer.setData('application/x-widget-type', type)
    e.dataTransfer.effectAllowed = 'copy'

    // Notify parent about drag start
    onDragStart?.(type)
  }, [onDragStart])

  const handleDragEnd = useCallback(() => {
    onDragEnd?.()
  }, [onDragEnd])

  return (
    <Card className="p-3 mb-4">
      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-sm font-medium text-muted-foreground">
          {t('dashboard.quickAdd.title')}
        </span>
        <div className="flex gap-2 flex-wrap">
          {quickAddItems.map((item) => (
            <button
              key={item.type}
              onClick={() => onAddWidget(item.type)}
              draggable
              onDragStart={(e) => handleDragStart(e, item.type)}
              onDragEnd={handleDragEnd}
              className="group flex flex-col items-center gap-1 p-2 rounded-md hover:bg-muted transition-colors min-w-[60px] cursor-grab active:cursor-grabbing"
              title={t(item.labelKey)}
            >
              <div className="relative text-muted-foreground group-hover:text-foreground transition-colors">
                {item.icon}
                <GripVertical className="absolute -left-2 top-1/2 -translate-y-1/2 h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
              </div>
              <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                {t(item.labelKey)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </Card>
  )
}
