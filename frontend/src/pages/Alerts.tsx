import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Input, Label, Select, Textarea } from '@/components/ui/input'
import { alertApi, queryApi, notificationApi } from '@/services/api'
import { toast } from '@/stores/toastStore'
import { getErrorMessage } from '@/lib/errors'
import { formatDate } from '@/lib/utils'
import { SkeletonCard } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState, getErrorVariant } from '@/components/ui/error-state'
import { Plus, Trash2, Edit2, Play, History, Loader2, Bell, BellOff } from 'lucide-react'
import type {
  QueryAlert,
  CreateAlertRequest,
  ConditionOperator,
  Aggregation,
  SavedQuery,
  NotificationChannel,
  AlertHistory,
} from '@/types'

const operatorKeys: ConditionOperator[] = ['gt', 'lt', 'eq', 'gte', 'lte', 'neq', 'contains']

const aggregationKeys: Aggregation[] = ['first', 'sum', 'avg', 'count', 'min', 'max']

export default function Alerts() {
  const { t } = useTranslation()
  const [alerts, setAlerts] = useState<QueryAlert[]>([])
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([])
  const [channels, setChannels] = useState<NotificationChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [isRetrying, setIsRetrying] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const [selectedAlertHistory, setSelectedAlertHistory] = useState<AlertHistory[]>([])
  const [editingAlert, setEditingAlert] = useState<QueryAlert | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    query_id: '',
    condition_column: '',
    condition_operator: 'gt' as ConditionOperator,
    condition_value: '',
    aggregation: 'first' as Aggregation,
    check_interval_minutes: 60,
    cooldown_minutes: 60,
    channel_ids: [] as string[],
  })
  const [testLoading, setTestLoading] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [alertsData, queriesData, channelsData] = await Promise.all([
        alertApi.getAll(),
        queryApi.getSaved(),
        notificationApi.getChannels(),
      ])
      setAlerts(alertsData)
      setSavedQueries(queriesData)
      setChannels(channelsData)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleRetry = useCallback(async () => {
    setIsRetrying(true)
    try {
      await loadData()
    } finally {
      setIsRetrying(false)
    }
  }, [loadData])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleOpenDialog = (alert?: QueryAlert) => {
    if (alert) {
      setEditingAlert(alert)
      setFormData({
        name: alert.name,
        description: alert.description || '',
        query_id: alert.query_id,
        condition_column: alert.condition_column,
        condition_operator: alert.condition_operator,
        condition_value: alert.condition_value,
        aggregation: alert.aggregation || 'first',
        check_interval_minutes: alert.check_interval_minutes,
        cooldown_minutes: alert.cooldown_minutes,
        channel_ids: alert.channel_ids,
      })
    } else {
      setEditingAlert(null)
      setFormData({
        name: '',
        description: '',
        query_id: '',
        condition_column: '',
        condition_operator: 'gt',
        condition_value: '',
        aggregation: 'first',
        check_interval_minutes: 60,
        cooldown_minutes: 60,
        channel_ids: [],
      })
    }
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingAlert(null)
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      if (editingAlert) {
        await alertApi.update(editingAlert.id, {
          name: formData.name,
          description: formData.description || undefined,
          condition_column: formData.condition_column,
          condition_operator: formData.condition_operator,
          condition_value: formData.condition_value,
          aggregation: formData.aggregation,
          check_interval_minutes: formData.check_interval_minutes,
          cooldown_minutes: formData.cooldown_minutes,
          channel_ids: formData.channel_ids,
        })
        toast.success(t('alerts.toast.updated'), t('alerts.toast.updatedDesc', { name: formData.name }))
      } else {
        const req: CreateAlertRequest = {
          query_id: formData.query_id,
          name: formData.name,
          description: formData.description || undefined,
          condition_column: formData.condition_column,
          condition_operator: formData.condition_operator,
          condition_value: formData.condition_value,
          aggregation: formData.aggregation,
          check_interval_minutes: formData.check_interval_minutes,
          cooldown_minutes: formData.cooldown_minutes,
          channel_ids: formData.channel_ids,
        }
        await alertApi.create(req)
        toast.success(t('alerts.toast.created'), t('alerts.toast.createdDesc', { name: formData.name }))
      }

      await loadData()
      handleCloseDialog()
    } catch (err) {
      toast.error(t('alerts.toast.saveFailed'), getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (alert: QueryAlert) => {
    if (!confirm(t('alerts.confirmDelete', { name: alert.name }))) return

    try {
      await alertApi.delete(alert.id)
      toast.success(t('alerts.toast.deleted'), t('alerts.toast.deletedDesc', { name: alert.name }))
      await loadData()
    } catch (err) {
      toast.error(t('alerts.toast.deleteFailed'), getErrorMessage(err))
    }
  }

  const handleToggleActive = async (alert: QueryAlert) => {
    try {
      await alertApi.update(alert.id, { is_active: !alert.is_active })
      toast.success(t('alerts.toast.updated'), !alert.is_active ? t('alerts.toast.nowActive', { name: alert.name }) : t('alerts.toast.nowInactive', { name: alert.name }))
      await loadData()
    } catch (err) {
      toast.error(t('alerts.toast.updateFailed'), getErrorMessage(err))
    }
  }

  const handleTest = async (alert: QueryAlert) => {
    try {
      setTestLoading(alert.id)
      const result = await alertApi.test(alert.id)
      if (result.triggered) {
        toast.success(t('alerts.toast.testSuccess'), t('alerts.toast.testSuccessDesc', { value: result.actual_value }))
      } else {
        toast.info(t('alerts.toast.testNoTrigger'), t('alerts.toast.testNoTriggerDesc', { value: result.actual_value }))
      }
    } catch (err) {
      toast.error(t('alerts.toast.testFailed'), getErrorMessage(err))
    } finally {
      setTestLoading(null)
    }
  }

  const handleShowHistory = async (alert: QueryAlert) => {
    try {
      const history = await alertApi.getHistory(alert.id)
      setSelectedAlertHistory(history)
      setHistoryDialogOpen(true)
    } catch (err) {
      toast.error(t('alerts.toast.historyFailed'), getErrorMessage(err))
    }
  }

  const getQueryName = (queryId: string) => {
    return savedQueries.find((q) => q.id === queryId)?.name || t('alerts.selectQuery')
  }

  const getOperatorLabel = (op: ConditionOperator) => {
    return t(`alerts.operators.${op}`)
  }

  const toggleChannelSelection = (channelId: string) => {
    setFormData((prev) => ({
      ...prev,
      channel_ids: prev.channel_ids.includes(channelId)
        ? prev.channel_ids.filter((id) => id !== channelId)
        : [...prev.channel_ids, channelId],
    }))
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">{t('alerts.title')}</h1>
        </div>
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
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">{t('alerts.title')}</h1>
        </div>
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">{t('alerts.title')}</h1>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          {t('alerts.create')}
        </Button>
      </div>

      {alerts.length === 0 ? (
        <EmptyState
          title={t('alerts.empty')}
          description={t('alerts.emptyDescription')}
          icon={Bell}
          action={{
            label: t('alerts.create'),
            onClick: () => handleOpenDialog(),
          }}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {alerts.map((alert) => (
            <Card key={alert.id}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>{alert.name}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleToggleActive(alert)}
                    title={alert.is_active ? t('alerts.clickToDisable') : t('alerts.clickToEnable')}
                  >
                    {alert.is_active ? (
                      <Bell className="h-4 w-4 text-green-600" />
                    ) : (
                      <BellOff className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p className="text-muted-foreground">{alert.description || t('common.noDescription')}</p>
                  <p>
                    <span className="font-medium">{t('alerts.form.savedQuery')}:</span> {getQueryName(alert.query_id)}
                  </p>
                  <p>
                    <span className="font-medium">{t('alerts.condition')}:</span>{' '}
                    {alert.condition_column} {getOperatorLabel(alert.condition_operator)} {alert.condition_value}
                  </p>
                  <p>
                    <span className="font-medium">{t('alerts.interval')}:</span> {alert.check_interval_minutes} min
                  </p>
                  {alert.last_triggered_at && (
                    <p className="text-xs text-muted-foreground">
                      {t('alerts.lastTriggered', { date: formatDate(alert.last_triggered_at) })}
                    </p>
                  )}
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleTest(alert)}
                    disabled={testLoading === alert.id}
                  >
                    {testLoading === alert.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleShowHistory(alert)}>
                    <History className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleOpenDialog(alert)}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(alert)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog}>
        <DialogHeader>
          <DialogTitle>{editingAlert ? t('alerts.edit') : t('alerts.create')}</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div>
              <Label htmlFor="name">{t('alerts.form.name')}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('alerts.form.namePlaceholder')}
              />
            </div>

            <div>
              <Label htmlFor="description">{t('alerts.form.description')}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('alerts.form.descriptionPlaceholder')}
                rows={2}
              />
            </div>

            {!editingAlert && (
              <div>
                <Label htmlFor="query">{t('alerts.form.savedQuery')}</Label>
                <Select
                  id="query"
                  value={formData.query_id}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, query_id: e.target.value })}
                >
                  <option value="">{t('alerts.form.selectQueryPlaceholder')}</option>
                  {savedQueries.map((q) => (
                    <option key={q.id} value={q.id}>{q.name}</option>
                  ))}
                </Select>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="column">{t('alerts.form.column')}</Label>
                <Input
                  id="column"
                  value={formData.condition_column}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, condition_column: e.target.value })}
                  placeholder={t('alerts.form.columnPlaceholder')}
                />
              </div>
              <div>
                <Label htmlFor="operator">{t('alerts.form.operator')}</Label>
                <Select
                  id="operator"
                  value={formData.condition_operator}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, condition_operator: e.target.value as ConditionOperator })}
                >
                  {operatorKeys.map((op) => (
                    <option key={op} value={op}>{t(`alerts.operators.${op}`)}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="value">{t('alerts.threshold')}</Label>
                <Input
                  id="value"
                  value={formData.condition_value}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, condition_value: e.target.value })}
                  placeholder={t('alerts.form.valuePlaceholder')}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="aggregation">{t('alerts.form.aggregation')}</Label>
              <Select
                id="aggregation"
                value={formData.aggregation}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, aggregation: e.target.value as Aggregation })}
              >
                {aggregationKeys.map((agg) => (
                  <option key={agg} value={agg}>{t(`alerts.aggregations.${agg}`)}</option>
                ))}
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="interval">{t('alerts.form.intervalMinutes')}</Label>
                <Input
                  id="interval"
                  type="number"
                  value={formData.check_interval_minutes}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, check_interval_minutes: parseInt(e.target.value) || 60 })}
                />
              </div>
              <div>
                <Label htmlFor="cooldown">{t('alerts.form.cooldownMinutes')}</Label>
                <Input
                  id="cooldown"
                  type="number"
                  value={formData.cooldown_minutes}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, cooldown_minutes: parseInt(e.target.value) || 60 })}
                />
              </div>
            </div>

            <div>
              <Label>{t('alerts.form.notificationChannels')}</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {channels.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                      formData.channel_ids.includes(ch.id)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted border-muted-foreground/20 hover:border-primary'
                    }`}
                    onClick={() => toggleChannelSelection(ch.id)}
                  >
                    {ch.name}
                  </button>
                ))}
                {channels.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {t('alerts.form.noChannelsConfigured')}
                  </p>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={handleCloseDialog}>{t('common.cancel')}</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t('common.saving') : editingAlert ? t('common.update') : t('common.create')}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyDialogOpen} onClose={() => setHistoryDialogOpen(false)}>
        <DialogHeader>
          <DialogTitle>{t('alerts.history.title')}</DialogTitle>
        </DialogHeader>
        <DialogContent>
          {selectedAlertHistory.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">{t('alerts.history.noHistory')}</p>
          ) : (
            <div className="max-h-[50vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">{t('alerts.history.triggeredAt')}</th>
                    <th className="text-left py-2">{t('alerts.history.value')}</th>
                    <th className="text-left py-2">{t('alerts.history.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedAlertHistory.map((h) => (
                    <tr key={h.id} className="border-b">
                      <td className="py-2">{formatDate(h.triggered_at)}</td>
                      <td className="py-2">{h.condition_met_value || '-'}</td>
                      <td className="py-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          h.notification_status === 'sent'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {h.notification_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setHistoryDialogOpen(false)}>{t('common.close')}</Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
