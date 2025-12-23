import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryStore } from '@/stores/queryStore'
import { Button } from '@/components/ui/button'
import { formatDate, formatDuration } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { getErrorMessage } from '@/lib/errors'
import { SkeletonList } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState, getErrorVariant } from '@/components/ui/error-state'
import { Play, CheckCircle, XCircle, History as HistoryIcon } from 'lucide-react'

export const History: React.FC = () => {
  const navigate = useNavigate()
  const { history, loadHistory, setQuery } = useQueryStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [isRetrying, setIsRetrying] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await loadHistory()
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [loadHistory])

  const handleRetry = useCallback(async () => {
    setIsRetrying(true)
    try {
      await load()
    } finally {
      setIsRetrying(false)
    }
  }, [load])

  useEffect(() => {
    load()
  }, [load])

  const handleUseQuery = (queryText: string) => {
    setQuery(queryText)
    navigate('/query')
  }

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-6">Query History</h1>
        <SkeletonList items={5} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-6">Query History</h1>
        <ErrorState
          message={getErrorMessage(error)}
          variant={getErrorVariant(error)}
          onRetry={handleRetry}
          isRetrying={isRetrying}
        />
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Query History</h1>

      {history.length === 0 ? (
        <EmptyState
          title="No query history"
          description="Execute some queries to see them here"
          icon={HistoryIcon}
          action={{
            label: 'Go to Query Editor',
            onClick: () => navigate('/query'),
          }}
        />
      ) : (
        <div className="space-y-2">
          {history.map((item) => (
            <div
              key={item.id}
              className={cn(
                'flex items-start gap-4 p-4 rounded-lg border',
                item.status === 'error' && 'border-destructive/50 bg-destructive/5'
              )}
            >
              <div className="flex-shrink-0 pt-1">
                {item.status === 'success' ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <pre className="bg-muted p-2 rounded text-sm overflow-x-auto whitespace-pre-wrap break-all mb-2">
                  {item.query_text}
                </pre>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span>{formatDate(item.executed_at)}</span>
                  {item.execution_time_ms != null && (
                    <span>{formatDuration(item.execution_time_ms)}</span>
                  )}
                  {item.row_count != null && (
                    <span>{item.row_count} rows</span>
                  )}
                  {item.error_message && (
                    <span className="text-destructive">{item.error_message}</span>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleUseQuery(item.query_text)}
              >
                <Play className="h-3 w-3 mr-1" />
                Use
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
