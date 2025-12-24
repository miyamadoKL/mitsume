import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryStore } from '@/stores/queryStore'
import { exportApi } from '@/services/api'
import { SQLEditor } from '@/components/editor/SQLEditor'
import { ResultsTable } from '@/components/results/ResultsTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { ExportDialog } from '@/components/ui/export-dialog'
import { toast } from '@/stores/toastStore'
import { getErrorMessage } from '@/lib/errors'
import { generateExportFilename, sanitizeFilename } from '@/lib/utils'
import { Play, Save, Download, Loader2 } from 'lucide-react'

export const Query: React.FC = () => {
  const { t } = useTranslation()
  const {
    currentQuery,
    setQuery,
    result,
    isExecuting,
    error,
    executeQuery,
    saveQuery,
  } = useQueryStore()

  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [queryName, setQueryName] = useState('')
  const [queryDescription, setQueryDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<'csv' | 'tsv'>('csv')
  const [isExporting, setIsExporting] = useState(false)

  const handleExecute = () => {
    executeQuery(currentQuery)
  }

  const handleSave = async () => {
    if (!queryName.trim()) return
    setSaving(true)
    try {
      await saveQuery(queryName, queryDescription || undefined)
      setSaveDialogOpen(false)
      setQueryName('')
      setQueryDescription('')
      toast.success(t('success.saved'), `"${queryName}"`)
    } catch (err) {
      toast.error(t('errors.saveFailed'), getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const openExportDialog = (format: 'csv' | 'tsv') => {
    setExportFormat(format)
    setExportDialogOpen(true)
  }

  const handleExport = async (filename: string) => {
    setIsExporting(true)
    try {
      const sanitized = sanitizeFilename(filename)
      const blob = exportFormat === 'csv'
        ? await exportApi.csv(currentQuery)
        : await exportApi.tsv(currentQuery)

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${sanitized}.${exportFormat}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setExportDialogOpen(false)
      toast.success(t('common.export'), `${sanitized}.${exportFormat}`)
    } catch (err) {
      toast.error(t('errors.generic'), getErrorMessage(err))
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold">{t('query.pageTitle')}</h1>
          <div className="flex gap-2">
            <Button onClick={handleExecute} disabled={isExecuting}>
              {isExecuting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              {t('query.execute')}
            </Button>
            <Button variant="outline" onClick={() => setSaveDialogOpen(true)}>
              <Save className="h-4 w-4 mr-2" />
              {t('common.save')}
            </Button>
            {result && (
              <>
                <Button variant="outline" onClick={() => openExportDialog('csv')}>
                  <Download className="h-4 w-4 mr-2" />
                  {t('query.csv')}
                </Button>
                <Button variant="outline" onClick={() => openExportDialog('tsv')}>
                  <Download className="h-4 w-4 mr-2" />
                  {t('query.tsv')}
                </Button>
              </>
            )}
          </div>
        </div>
        <SQLEditor
          value={currentQuery}
          onChange={setQuery}
          onExecute={handleExecute}
          height="200px"
        />
      </div>

      <div className="flex-1 overflow-hidden">
        {error && (
          <div className="p-4 bg-destructive/10 text-destructive">
            {error}
          </div>
        )}
        {result && <ResultsTable result={result} />}
        {!result && !error && !isExecuting && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            {t('query.noResults')}
          </div>
        )}
        {isExecuting && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)}>
        <DialogHeader>
          <DialogTitle>{t('savedQueries.saveDialog.title')}</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t('savedQueries.saveDialog.name')}</label>
              <Input
                value={queryName}
                onChange={(e) => setQueryName(e.target.value)}
                placeholder={t('savedQueries.saveDialog.namePlaceholder')}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('savedQueries.saveDialog.description')}</label>
              <Input
                value={queryDescription}
                onChange={(e) => setQueryDescription(e.target.value)}
                placeholder={t('savedQueries.saveDialog.descriptionPlaceholder')}
              />
            </div>
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving || !queryName.trim()}>
            {saving ? t('common.loading') : t('common.save')}
          </Button>
        </DialogFooter>
      </Dialog>

      <ExportDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        onExport={handleExport}
        defaultFilename={generateExportFilename()}
        format={exportFormat}
        isExporting={isExporting}
      />
    </div>
  )
}
