import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Input, Label, Select } from '@/components/ui/input'
import { notificationApi } from '@/services/api'
import { toast } from '@/stores/toastStore'
import { getErrorMessage } from '@/lib/errors'
import { SkeletonCard } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState, getErrorVariant } from '@/components/ui/error-state'
import { Plus, Trash2, Edit2, Send, Loader2, Mail } from 'lucide-react'
import type {
  NotificationChannel,
  ChannelType,
  CreateNotificationChannelRequest,
  SlackChannelConfig,
  EmailChannelConfig,
  GoogleChatChannelConfig,
} from '@/types'

export default function NotificationChannels() {
  const { t } = useTranslation()
  const [channels, setChannels] = useState<NotificationChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [isRetrying, setIsRetrying] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingChannel, setEditingChannel] = useState<NotificationChannel | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    channel_type: 'slack' as ChannelType,
    webhook_url: '',
    recipients: '',
  })
  const [testLoading, setTestLoading] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const loadChannels = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await notificationApi.getChannels()
      setChannels(data)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleRetry = useCallback(async () => {
    setIsRetrying(true)
    try {
      await loadChannels()
    } finally {
      setIsRetrying(false)
    }
  }, [loadChannels])

  useEffect(() => {
    loadChannels()
  }, [loadChannels])

  const handleOpenDialog = (channel?: NotificationChannel) => {
    if (channel) {
      setEditingChannel(channel)
      setFormData({
        name: channel.name,
        channel_type: channel.channel_type,
        webhook_url:
          channel.channel_type === 'slack'
            ? (channel.config as SlackChannelConfig).webhook_url
            : channel.channel_type === 'google_chat'
            ? (channel.config as GoogleChatChannelConfig).webhook_url
            : '',
        recipients:
          channel.channel_type === 'email'
            ? (channel.config as EmailChannelConfig).recipients.join(', ')
            : '',
      })
    } else {
      setEditingChannel(null)
      setFormData({
        name: '',
        channel_type: 'slack',
        webhook_url: '',
        recipients: '',
      })
    }
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingChannel(null)
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      let config: SlackChannelConfig | EmailChannelConfig | GoogleChatChannelConfig

      if (formData.channel_type === 'slack') {
        config = { webhook_url: formData.webhook_url }
      } else if (formData.channel_type === 'google_chat') {
        config = { webhook_url: formData.webhook_url }
      } else {
        config = {
          recipients: formData.recipients.split(',').map((r) => r.trim()).filter(Boolean),
        }
      }

      if (editingChannel) {
        await notificationApi.updateChannel(editingChannel.id, {
          name: formData.name,
          config,
        })
        toast.success(t('notifications.toast.updated'), t('notifications.toast.updatedDesc', { name: formData.name }))
      } else {
        const req: CreateNotificationChannelRequest = {
          name: formData.name,
          channel_type: formData.channel_type,
          config,
        }
        await notificationApi.createChannel(req)
        toast.success(t('notifications.toast.created'), t('notifications.toast.createdDesc', { name: formData.name }))
      }

      await loadChannels()
      handleCloseDialog()
    } catch (err) {
      toast.error(t('notifications.toast.saveFailed'), getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (channel: NotificationChannel) => {
    if (!confirm(t('notifications.confirmDelete', { name: channel.name }))) return

    try {
      await notificationApi.deleteChannel(channel.id)
      toast.success(t('notifications.toast.deleted'), t('notifications.toast.deletedDesc', { name: channel.name }))
      await loadChannels()
    } catch (err) {
      toast.error(t('notifications.toast.deleteFailed'), getErrorMessage(err))
    }
  }

  const handleTest = async (channel: NotificationChannel) => {
    try {
      setTestLoading(channel.id)
      await notificationApi.testChannel(channel.id)
      toast.success(t('notifications.toast.testSent'), t('notifications.toast.testSentDesc', { name: channel.name }))
    } catch (err) {
      toast.error(t('notifications.toast.testFailed'), getErrorMessage(err))
    } finally {
      setTestLoading(null)
    }
  }

  const getChannelTypeLabel = (type: ChannelType) => {
    switch (type) {
      case 'slack': return t('notifications.types.slack')
      case 'email': return t('notifications.types.email')
      case 'google_chat': return t('notifications.types.googleChat')
      default: return type
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">{t('notifications.title')}</h1>
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
          <h1 className="text-2xl font-semibold">{t('notifications.title')}</h1>
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
        <h1 className="text-2xl font-semibold">{t('notifications.title')}</h1>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          {t('notifications.add')}
        </Button>
      </div>

      {channels.length === 0 ? (
        <EmptyState
          title={t('notifications.empty')}
          description={t('notifications.addEmptyDescription')}
          icon={Mail}
          action={{
            label: t('notifications.add'),
            onClick: () => handleOpenDialog(),
          }}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {channels.map((channel) => (
            <Card key={channel.id}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>{channel.name}</span>
                  <span className="text-xs font-normal px-2 py-1 rounded bg-muted">
                    {getChannelTypeLabel(channel.channel_type)}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {channel.channel_type === 'email'
                    ? (channel.config as EmailChannelConfig).recipients.join(', ')
                    : t('common.webhookConfigured')}
                </p>
                <div className="flex items-center justify-between">
                  <span className={`text-xs px-2 py-1 rounded ${channel.is_verified ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'}`}>
                    {channel.is_verified ? t('common.verified') : t('common.unverified')}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTest(channel)}
                      disabled={testLoading === channel.id}
                    >
                      {testLoading === channel.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Send className="h-3 w-3" />
                      )}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleOpenDialog(channel)}>
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(channel)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onClose={handleCloseDialog}>
        <DialogHeader>
          <DialogTitle>{editingChannel ? t('notifications.edit') : t('notifications.add')}</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">{t('notifications.form.name')}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('notifications.form.namePlaceholder')}
              />
            </div>

            {!editingChannel && (
              <div>
                <Label htmlFor="type">{t('notifications.form.channelType')}</Label>
                <Select
                  id="type"
                  value={formData.channel_type}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, channel_type: e.target.value as ChannelType })}
                >
                  <option value="slack">{t('notifications.types.slack')}</option>
                  <option value="email">{t('notifications.types.email')}</option>
                  <option value="google_chat">{t('notifications.types.googleChat')}</option>
                </Select>
              </div>
            )}

            {(formData.channel_type === 'slack' || formData.channel_type === 'google_chat') && (
              <div>
                <Label htmlFor="webhook">{formData.channel_type === 'slack' ? t('notifications.slack.webhookUrl') : t('notifications.googleChat.webhookUrl')}</Label>
                <Input
                  id="webhook"
                  value={formData.webhook_url}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, webhook_url: e.target.value })}
                  placeholder={formData.channel_type === 'slack' ? t('notifications.slack.webhookPlaceholder') : t('notifications.googleChat.webhookPlaceholder')}
                />
              </div>
            )}

            {formData.channel_type === 'email' && (
              <div>
                <Label htmlFor="recipients">{t('notifications.email.recipients')}</Label>
                <Input
                  id="recipients"
                  value={formData.recipients}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, recipients: e.target.value })}
                  placeholder={t('notifications.email.recipientsPlaceholder')}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t('notifications.email.recipientsHint')}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={handleCloseDialog}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t('common.saving') : editingChannel ? t('common.update') : t('common.create')}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
