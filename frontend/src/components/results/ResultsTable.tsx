import React from 'react'
import { useTranslation } from 'react-i18next'
import type { QueryResult } from '@/types'
import { formatDuration } from '@/lib/utils'

interface ResultsTableProps {
  result: QueryResult
}

export const ResultsTable: React.FC<ResultsTableProps> = ({ result }) => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b bg-muted/50">
        <span className="text-sm text-muted-foreground">
          {t('query.rowsIn', { count: result.row_count, time: formatDuration(result.execution_time_ms) })}
        </span>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background border-b">
            <tr>
              {result.columns.map((column, index) => (
                <th
                  key={index}
                  className="px-4 py-2 text-left font-medium text-muted-foreground"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b hover:bg-muted/50">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-4 py-2 whitespace-nowrap">
                    {cell === null ? (
                      <span className="text-muted-foreground italic">{t('common.null')}</span>
                    ) : (
                      String(cell)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
