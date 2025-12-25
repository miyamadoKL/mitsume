import React from 'react'
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
}

export const QuickAddPanel: React.FC<QuickAddPanelProps> = ({ onAddWidget }) => {
  const { t } = useTranslation()

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
              className="flex flex-col items-center gap-1 p-2 rounded-md hover:bg-muted transition-colors min-w-[60px]"
              title={t(item.labelKey)}
            >
              <div className="text-muted-foreground group-hover:text-foreground">
                {item.icon}
              </div>
              <span className="text-xs text-muted-foreground">
                {t(item.labelKey)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </Card>
  )
}
