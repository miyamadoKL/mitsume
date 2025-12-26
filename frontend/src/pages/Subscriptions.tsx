import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Input, Label, Select } from '@/components/ui/input'
import { subscriptionApi, dashboardApi, notificationApi } from '@/services/api'
import { toast } from '@/stores/toastStore'
import { getErrorMessage } from '@/lib/errors'
import { formatDate } from '@/lib/utils'
import { SkeletonCard } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState, getErrorVariant } from '@/components/ui/error-state'
import { Plus, Trash2, Edit2, Play, Loader2, Bell, BellOff, Clock, CalendarClock } from 'lucide-react'
import type {
  DashboardSubscription,
  CreateSubscriptionRequest,
  Dashboard,
  NotificationChannel,
} from '@/types'

const commonCronPresets = [
  { labelKey: 'subscriptions.cronPresets.everyHour', value: '0 * * * *' },
  { labelKey: 'subscriptions.cronPresets.dailyAt9', value: '0 9 * * *' },
  { labelKey: 'subscriptions.cronPresets.mondayAt9', value: '0 9 * * 1' },
  { labelKey: 'subscriptions.cronPresets.firstOfMonthAt9', value: '0 9 1 * *' },
]

const timezones = [
  'Asia/Tokyo',
  'UTC',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
]

export default function Subscriptions() {
  const { t } = useTranslation()
  const [subscriptions, setSubscriptions] = useState<DashboardSubscription[]>([])
  const [dashboards, setDashboards] = useState<Dashboard[]>([])
  const [channels, setChannels] = useState<NotificationChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [isRetrying, setIsRetrying] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSubscription, setEditingSubscription] = useState<DashboardSubscription | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    dashboard_id: '',
    schedule_cron: '0 9 * * *',
    timezone: 'Asia/Tokyo',
    format: 'pdf' as 'pdf' | 'png',
    channel_ids: [] as string[],
  })
  const [triggerLoading, setTriggerLoading] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [subscriptionsData, dashboardsData, channelsData] = await Promise.all([
        subscriptionApi.getAll(),
        dashboardApi.getAll(),
        notificationApi.getChannels(),
      ])
      setSubscriptions(subscriptionsData)
      setDashboards(dashboardsData)
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

  const handleOpenDialog = (subscription?: DashboardSubscription) => {
    if (subscription) {
      setEditingSubscription(subscription)
      setFormData({
        name: subscription.name,
        dashboard_id: subscription.dashboard_id,
        schedule_cron: subscription.schedule_cron,
        timezone: subscription.timezone,
        format: subscription.format,
        channel_ids: subscription.channel_ids,
      })
    } else {
      setEditingSubscription(null)
      setFormData({
        name: '',
        dashboard_id: '',
        schedule_cron: '0 9 * * *',
        timezone: 'Asia/Tokyo',
        format: 'pdf',
        channel_ids: [],
      })
    }
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingSubscription(null)
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      if (editingSubscription) {
        await subscriptionApi.update(editingSubscription.id, {
          name: formData.name,
          schedule_cron: formData.schedule_cron,
          timezone: formData.timezone,
          format: formData.format,
          channel_ids: formData.channel_ids,
        })
        toast.success(t('subscriptions.toast.updated'), t('subscriptions.toast.updatedDesc', { name: formData.name }))
      } else {
        const req: CreateSubscriptionRequest = {
          dashboard_id: formData.dashboard_id,
          name: formData.name,
          schedule_cron: formData.schedule_cron,
          timezone: formData.timezone,
          format: formData.format,
          channel_ids: formData.channel_ids,
        }
        await subscriptionApi.create(req)
        toast.success(t('subscriptions.toast.created'), t('subscriptions.toast.createdDesc', { name: formData.name }))
      }

      await loadData()
      handleCloseDialog()
    } catch (err) {
      toast.error(t('subscriptions.toast.saveFailed'), getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (subscription: DashboardSubscription) => {
    if (!confirm(t('subscriptions.confirmDelete', { name: subscription.name }))) return

    try {
      await subscriptionApi.delete(subscription.id)
      toast.success(t('subscriptions.toast.deleted'), t('subscriptions.toast.deletedDesc', { name: subscription.name }))
      await loadData()
    } catch (err) {
      toast.error(t('subscriptions.toast.deleteFailed'), getErrorMessage(err))
    }
  }

  const handleToggleActive = async (subscription: DashboardSubscription) => {
    try {
      await subscriptionApi.update(subscription.id, { is_active: !subscription.is_active })
      toast.success(t('subscriptions.toast.updated'), !subscription.is_active ? t('subscriptions.toast.nowActive', { name: subscription.name }) : t('subscriptions.toast.nowInactive', { name: subscription.name }))
      await loadData()
    } catch (err) {
      toast.error(t('subscriptions.toast.updateFailed'), getErrorMessage(err))
    }
  }

  const handleTrigger = async (subscription: DashboardSubscription) => {
    try {
      setTriggerLoading(subscription.id)
      await subscriptionApi.trigger(subscription.id)
      toast.success(t('subscriptions.toast.triggered'), t('subscriptions.toast.triggeredDesc', { name: subscription.name }))
    } catch (err) {
      toast.error(t('subscriptions.toast.triggerFailed'), getErrorMessage(err))
    } finally {
      setTriggerLoading(null)
    }
  }

  const getDashboardName = (dashboardId: string) => {
    return dashboards.find((d) => d.id === dashboardId)?.name || t('subscriptions.unknownDashboard')
  }

  const describeCron = (cron: string) => {
    const preset = commonCronPresets.find((p) => p.value === cron)
    if (preset) return t(preset.labelKey)

    const parts = cron.split(' ')
    if (parts.length !== 5) return cron

    const [minute, hour, dom, _month, dow] = parts
    const minuteLabel = minute.padStart(2, '0')
    const hourLabel = hour.padStart(2, '0')

    if (dom === '*' && dow === '*') {
      if (hour === '*') {
        return t('subscriptions.cron.everyHourAt', { minute: minuteLabel })
      } else {
        return t('subscriptions.cron.dailyAt', { hour: hourLabel, minute: minuteLabel })
      }
    } else if (dow !== '*' && dom === '*') {
      const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
      const dayIndex = Number.parseInt(dow, 10)
      const day = Number.isFinite(dayIndex) && dayIndex >= 0 && dayIndex < dayKeys.length
        ? t(`subscriptions.cron.days.${dayKeys[dayIndex]}`)
        : dow
      return t('subscriptions.cron.dayOfWeekAt', { day, hour: hourLabel, minute: minuteLabel })
    } else if (dom !== '*') {
      return t('subscriptions.cron.dayOfMonthAt', { day: dom, hour: hourLabel, minute: minuteLabel })
    } else {
      return cron
    }
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
          <h1 className="text-2xl font-semibold">{t('subscriptions.title')}</h1>
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
          <h1 className="text-2xl font-semibold">{t('subscriptions.title')}</h1>
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
        <h1 className="text-2xl font-semibold">{t('subscriptions.title')}</h1>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          {t('subscriptions.create')}
        </Button>
      </div>

      {subscriptions.length === 0 ? (
        <EmptyState
          title={t('subscriptions.empty')}
          description={t('subscriptions.emptyDescription')}
          icon={CalendarClock}
          action={{
            label: t('subscriptions.create'),
            onClick: () => handleOpenDialog(),
          }}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {subscriptions.map((sub) => (
            <Card key={sub.id}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>{sub.name}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleToggleActive(sub)}
                    title={sub.is_active ? t('alerts.clickToDisable') : t('alerts.clickToEnable')}
                  >
                    {sub.is_active ? (
                      <Bell className="h-4 w-4 text-green-600" />
                    ) : (
                      <BellOff className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="font-medium">{t('subscriptions.selectDashboard')}:</span> {getDashboardName(sub.dashboard_id)}
                  </p>
                  <p className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{describeCron(sub.schedule_cron)}</span>
                    <span className="text-muted-foreground">({sub.timezone})</span>
                  </p>
                  <p>
                    <span className="font-medium">{t('subscriptions.format')}:</span>{' '}
                    <span className="px-2 py-0.5 rounded bg-muted text-xs uppercase">{sub.format}</span>
                  </p>
                  {sub.next_run_at && (
                    <p className="text-xs text-muted-foreground">
                      {t('subscriptions.nextRun', { date: formatDate(sub.next_run_at) })}
                    </p>
                  )}
                  {sub.last_sent_at && (
                    <p className="text-xs text-muted-foreground">
                      {t('subscriptions.lastSent', { date: formatDate(sub.last_sent_at) })}
                    </p>
                  )}
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleTrigger(sub)}
                    disabled={triggerLoading === sub.id}
                  >
                    {triggerLoading === sub.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleOpenDialog(sub)}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(sub)}>
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
          <DialogTitle>{editingSubscription ? t('subscriptions.edit') : t('subscriptions.create')}</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div>
              <Label htmlFor="name">{t('subscriptions.form.name')}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('subscriptions.form.namePlaceholder')}
              />
            </div>

            {!editingSubscription && (
              <div>
                <Label htmlFor="dashboard">{t('subscriptions.selectDashboard')}</Label>
                <Select
                  id="dashboard"
                  value={formData.dashboard_id}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, dashboard_id: e.target.value })}
                >
                  <option value="">{t('subscriptions.form.selectDashboardPlaceholder')}</option>
                  {dashboards.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor="schedule">{t('subscriptions.schedule')}</Label>
              <Select
                id="schedule"
                value={formData.schedule_cron}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, schedule_cron: e.target.value })}
              >
                {commonCronPresets.map((preset) => (
                  <option key={preset.value} value={preset.value}>{t(preset.labelKey)}</option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {t('subscriptions.form.customCronHint', { cron: formData.schedule_cron })}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="timezone">{t('subscriptions.timezone')}</Label>
                <Select
                  id="timezone"
                  value={formData.timezone}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, timezone: e.target.value })}
                >
                  {timezones.map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="format">{t('subscriptions.form.exportFormat')}</Label>
                <Select
                  id="format"
                  value={formData.format}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, format: e.target.value as 'pdf' | 'png' })}
                >
                  <option value="pdf">{t('subscriptions.formats.pdf')}</option>
                  <option value="png">{t('subscriptions.formats.png')}</option>
                </Select>
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
            {saving ? t('common.saving') : editingSubscription ? t('common.update') : t('common.create')}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
