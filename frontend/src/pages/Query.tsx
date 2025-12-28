import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { editor } from 'monaco-editor'
import { useQueryStore } from '@/stores/queryStore'
import { exportApi } from '@/services/api'
import { SQLEditor } from '@/components/editor/SQLEditor'
import { SchemaBrowser } from '@/components/editor/SchemaBrowser'
import { ResultsTable } from '@/components/results/ResultsTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { ExportDialog } from '@/components/ui/export-dialog'
import { toast } from '@/stores/toastStore'
import { getErrorMessage } from '@/lib/errors'
import { generateExportFilename, sanitizeFilename } from '@/lib/utils'
import { Play, Save, Download, Loader2, PanelLeftClose, PanelLeft } from 'lucide-react'

// Constants for sidebar sizing
const SIDEBAR_MIN_WIDTH = 200
const SIDEBAR_MAX_WIDTH = 500
const SIDEBAR_DEFAULT_WIDTH = 280
const SIDEBAR_WIDTH_STORAGE_KEY = 'mitsume-schema-browser-width'

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

  // Sidebar visibility and width
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const stored = localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)
    if (stored) {
      const width = parseInt(stored, 10)
      if (!isNaN(width) && width >= SIDEBAR_MIN_WIDTH && width <= SIDEBAR_MAX_WIDTH) {
        return width
      }
    }
    return SIDEBAR_DEFAULT_WIDTH
  })
  const [isResizing, setIsResizing] = useState(false)

  // Editor reference for text insertion
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)

  // Called when editor is ready
  const handleEditorReady = useCallback((ed: editor.IStandaloneCodeEditor) => {
    editorRef.current = ed
  }, [])

  // Save sidebar width to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, sidebarWidth.toString())
  }, [sidebarWidth])

  // Handle resize mouse events
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!sidebarRef.current) return
      const newWidth = e.clientX
      const clampedWidth = Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, newWidth))
      setSidebarWidth(clampedWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  // Insert text at cursor position (supports Undo)
  const insertTextAtCursor = useCallback((text: string) => {
    const ed = editorRef.current
    if (!ed) return

    const selection = ed.getSelection()
    if (!selection) return

    // Use executeEdits for Undo support
    ed.executeEdits('schema-browser', [{
      range: selection,
      text: text,
      forceMoveMarkers: true
    }])

    // Focus back to editor
    ed.focus()
  }, [])

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
    <div className={`flex h-full ${isResizing ? 'select-none' : ''}`}>
      {/* Schema Browser Sidebar */}
      {sidebarVisible && (
        <div
          ref={sidebarRef}
          className="flex-shrink-0 border-r bg-muted/30 relative"
          style={{ width: sidebarWidth }}
        >
          <SchemaBrowser onInsert={insertTextAtCursor} />
          {/* Resize handle */}
          <div
            className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/20 active:bg-primary/40 transition-colors"
            onMouseDown={handleResizeMouseDown}
          />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarVisible(!sidebarVisible)}
                title={t('editor.schemaBrowser.toggleSidebar', 'Toggle sidebar')}
              >
                {sidebarVisible ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
              </Button>
              <h1 className="text-xl font-semibold">{t('query.pageTitle')}</h1>
            </div>
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
            onEditorReady={handleEditorReady}
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
