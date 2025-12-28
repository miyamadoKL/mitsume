import { Columns } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ColumnInfo } from '@/types'

interface ColumnNodeProps {
  column: ColumnInfo
  onClick: () => void
}

export function ColumnNode({ column, onClick }: ColumnNodeProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 px-2 py-1 rounded hover:bg-accent cursor-pointer text-sm"
      )}
      onClick={onClick}
      title={`${column.name}: ${column.type}${column.nullable ? ' (nullable)' : ''}${column.comment ? ` - ${column.comment}` : ''}`}
    >
      <Columns className="h-3 w-3 shrink-0 text-muted-foreground" />
      <span className="truncate">{column.name}</span>
      <span className="text-xs text-muted-foreground truncate">{column.type}</span>
    </div>
  )
}
