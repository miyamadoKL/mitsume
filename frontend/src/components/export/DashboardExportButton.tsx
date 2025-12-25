import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Download, Loader2 } from 'lucide-react'
import { toast } from '@/stores/toastStore'
import { sanitizeFilename } from '@/lib/utils'

type ExportFormat = 'pdf' | 'png'

interface DashboardExportButtonProps {
  dashboardRef: React.RefObject<HTMLDivElement | null>
  dashboardName: string
}

export const DashboardExportButton: React.FC<DashboardExportButtonProps> = ({
  dashboardRef,
  dashboardName,
}) => {
  const { t } = useTranslation()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [format, setFormat] = useState<ExportFormat>('pdf')
  const [filename, setFilename] = useState('')
  const [exporting, setExporting] = useState(false)

  const formatOptions: { value: ExportFormat; label: string }[] = [
    { value: 'pdf', label: t('dashboard.exportDialog.formats.pdf') },
    { value: 'png', label: t('dashboard.exportDialog.formats.png') },
  ]

  const handleOpenDialog = () => {
    setFilename(sanitizeFilename(dashboardName) || t('dashboard.exportDialog.filenamePlaceholder'))
    setDialogOpen(true)
  }

  const handleExport = async () => {
    if (!dashboardRef.current) {
      toast.error(t('dashboard.exportDialog.toast.failed'), t('dashboard.exportDialog.toast.elementNotFound'))
      return
    }

    setExporting(true)

    try {
      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        allowTaint: true,
      })

      const sanitizedFilename = sanitizeFilename(filename) || 'dashboard'

      if (format === 'png') {
        const link = document.createElement('a')
        link.download = `${sanitizedFilename}.png`
        link.href = canvas.toDataURL('image/png')
        link.click()
        toast.success(t('dashboard.exportDialog.toast.complete'), t('dashboard.exportDialog.toast.downloaded', { filename: `${sanitizedFilename}.png` }))
      } else {
        const imgData = canvas.toDataURL('image/png')
        const imgWidth = canvas.width
        const imgHeight = canvas.height

        // Determine page orientation based on aspect ratio
        const orientation = imgWidth > imgHeight ? 'landscape' : 'portrait'

        // Create PDF with image dimensions (in mm, assuming 96 DPI)
        const pxToMm = 0.264583
        const pdfWidth = imgWidth * pxToMm / 2 // Divided by scale factor
        const pdfHeight = imgHeight * pxToMm / 2

        const pdf = new jsPDF({
          orientation,
          unit: 'mm',
          format: [pdfWidth, pdfHeight],
        })

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
        pdf.save(`${sanitizedFilename}.pdf`)
        toast.success(t('dashboard.exportDialog.toast.complete'), t('dashboard.exportDialog.toast.downloaded', { filename: `${sanitizedFilename}.pdf` }))
      }

      setDialogOpen(false)
    } catch (error) {
      console.error('Export failed:', error)
      toast.error(t('dashboard.exportDialog.toast.failed'), error instanceof Error ? error.message : t('errors.generic'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <Button variant="outline" onClick={handleOpenDialog}>
        <Download className="h-4 w-4 mr-2" />
        {t('common.export')}
      </Button>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogHeader>
          <DialogTitle>{t('dashboard.exportDialog.title')}</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t('export.filename')}</label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  placeholder={t('dashboard.exportDialog.filenamePlaceholder')}
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground">.{format}</span>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">{t('dashboard.exportDialog.format')}</label>
              <Select
                value={format}
                onChange={(e) => setFormat(e.target.value as ExportFormat)}
                options={formatOptions}
              />
            </div>

            <p className="text-sm text-muted-foreground">
              {format === 'pdf'
                ? t('dashboard.exportDialog.description.pdf')
                : t('dashboard.exportDialog.description.png')}
            </p>
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={exporting}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleExport} disabled={exporting || !filename.trim()}>
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('common.exporting')}
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                {t('common.export')}
              </>
            )}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  )
}
