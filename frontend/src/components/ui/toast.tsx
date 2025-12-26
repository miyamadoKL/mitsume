import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { useToastStore, type Toast, type ToastType } from '@/stores/toastStore'

const toastIcons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="h-5 w-5 text-green-500" />,
  error: <AlertCircle className="h-5 w-5 text-red-500" />,
  info: <Info className="h-5 w-5 text-blue-500" />,
  warning: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
}

const toastStyles: Record<ToastType, string> = {
  success: 'border-green-500/50 bg-green-500/10',
  error: 'border-red-500/50 bg-red-500/10',
  info: 'border-blue-500/50 bg-blue-500/10',
  warning: 'border-yellow-500/50 bg-yellow-500/10',
}

interface ToastItemProps {
  toast: Toast
  onDismiss: (id: string) => void
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const { t } = useTranslation()

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className={cn(
        'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border p-4 shadow-lg backdrop-blur-sm transition-all',
        'animate-in slide-in-from-right-full duration-300',
        toastStyles[toast.type]
      )}
    >
      <div className="flex-shrink-0">{toastIcons[toast.type]}</div>
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium text-foreground">{toast.title}</p>
        {toast.message && (
          <p className="text-sm text-muted-foreground">{toast.message}</p>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        aria-label={t('common.closeNotification')}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export const ToastContainer: React.FC = () => {
  const { t } = useTranslation()
  const { toasts, removeToast } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div
      aria-label={t('common.notifications')}
      className="pointer-events-none fixed bottom-0 right-0 z-50 flex max-h-screen w-full flex-col gap-2 p-4 sm:max-w-sm"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
      ))}
    </div>
  )
}
