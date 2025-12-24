import * as React from 'react'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from './dialog'
import { Button } from './button'
import { Input } from './input'
import { Loader2, Download } from 'lucide-react'

interface ExportDialogProps {
  open: boolean
  onClose: () => void
  onExport: (filename: string) => Promise<void>
  defaultFilename: string
  format: 'csv' | 'tsv'
  isExporting: boolean
}

export const ExportDialog: React.FC<ExportDialogProps> = ({
  open,
  onClose,
  onExport,
  defaultFilename,
  format,
  isExporting,
}) => {
  const { t } = useTranslation()
  const [filename, setFilename] = useState(defaultFilename)

  useEffect(() => {
    if (open) {
      setFilename(defaultFilename)
    }
  }, [open, defaultFilename])

  const handleExport = async () => {
    await onExport(filename)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isExporting && filename.trim()) {
      handleExport()
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader>
        <DialogTitle>{t('export.title', { format: format.toUpperCase() })}</DialogTitle>
      </DialogHeader>
      <DialogContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="filename" className="text-sm font-medium">
              {t('export.filename')}
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="filename"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('export.filenamePlaceholder')}
                disabled={isExporting}
                className="flex-1"
              />
              <span className="text-sm text-muted-foreground">.{format}</span>
            </div>
          </div>
        </div>
      </DialogContent>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={isExporting}>
          {t('common.cancel')}
        </Button>
        <Button onClick={handleExport} disabled={isExporting || !filename.trim()}>
          {isExporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('common.exporting')}
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              {t('common.export')}
            </>
          )}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
