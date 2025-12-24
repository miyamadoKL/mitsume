import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryStore } from '@/stores/queryStore'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { formatDate } from '@/lib/utils'
import { toast } from '@/stores/toastStore'
import { getErrorMessage } from '@/lib/errors'
import { SkeletonCard } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState, getErrorVariant } from '@/components/ui/error-state'
import { Play, Trash2, FileCode } from 'lucide-react'
import type { SavedQuery } from '@/types'

export const SavedQueries: React.FC = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { savedQueries, loadSavedQueries, setQuery, deleteQuery } = useQueryStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [isRetrying, setIsRetrying] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [queryToDelete, setQueryToDelete] = useState<SavedQuery | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await loadSavedQueries()
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [loadSavedQueries])

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

  const handleUseQuery = (query: SavedQuery) => {
    setQuery(query.query_text)
    navigate('/query')
  }

  const handleDeleteClick = (query: SavedQuery) => {
    setQueryToDelete(query)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!queryToDelete) return
    setDeleting(true)
    const queryName = queryToDelete.name
    try {
      await deleteQuery(queryToDelete.id)
      setDeleteDialogOpen(false)
      setQueryToDelete(null)
      toast.success(t('success.deleted'), `"${queryName}"`)
    } catch (err) {
      toast.error(t('errors.deleteFailed'), getErrorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-6">{t('savedQueries.title')}</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-6">{t('savedQueries.title')}</h1>
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
      <h1 className="text-2xl font-semibold mb-6">{t('savedQueries.title')}</h1>

      {savedQueries.length === 0 ? (
        <EmptyState
          title={t('savedQueries.empty')}
          description={t('savedQueries.emptyDescription')}
          icon={FileCode}
          action={{
            label: t('savedQueries.goToEditor'),
            onClick: () => navigate('/query'),
          }}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {savedQueries.map((query) => (
            <Card key={query.id}>
              <CardHeader>
                <CardTitle className="text-lg">{query.name}</CardTitle>
                <CardDescription>
                  {query.description || t('common.description')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-2 rounded text-xs overflow-hidden text-ellipsis whitespace-nowrap mb-4">
                  {query.query_text}
                </pre>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {formatDate(query.updated_at)}
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleUseQuery(query)}>
                      <Play className="h-3 w-3 mr-1" />
                      {t('common.use')}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteClick(query)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogHeader>
          <DialogTitle>{t('savedQueries.deleteConfirm.title')}</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <p>{t('savedQueries.deleteConfirm.description')}</p>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleting}>
            {deleting ? t('common.loading') : t('common.delete')}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
