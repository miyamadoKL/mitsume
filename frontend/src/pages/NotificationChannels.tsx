import React, { useState, useEffect, useCallback } from 'react'
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
        toast.success('Channel updated', `"${formData.name}" has been updated`)
      } else {
        const req: CreateNotificationChannelRequest = {
          name: formData.name,
          channel_type: formData.channel_type,
          config,
        }
        await notificationApi.createChannel(req)
        toast.success('Channel created', `"${formData.name}" has been created`)
      }

      await loadChannels()
      handleCloseDialog()
    } catch (err) {
      toast.error('Failed to save channel', getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (channel: NotificationChannel) => {
    if (!confirm(`Are you sure you want to delete "${channel.name}"?`)) return

    try {
      await notificationApi.deleteChannel(channel.id)
      toast.success('Channel deleted', `"${channel.name}" has been deleted`)
      await loadChannels()
    } catch (err) {
      toast.error('Failed to delete channel', getErrorMessage(err))
    }
  }

  const handleTest = async (channel: NotificationChannel) => {
    try {
      setTestLoading(channel.id)
      await notificationApi.testChannel(channel.id)
      toast.success('Test sent', `Test notification sent to "${channel.name}"`)
    } catch (err) {
      toast.error('Test failed', getErrorMessage(err))
    } finally {
      setTestLoading(null)
    }
  }

  const getChannelTypeLabel = (type: ChannelType) => {
    switch (type) {
      case 'slack': return 'Slack'
      case 'email': return 'Email'
      case 'google_chat': return 'Google Chat'
      default: return type
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Notification Channels</h1>
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
          <h1 className="text-2xl font-semibold">Notification Channels</h1>
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
        <h1 className="text-2xl font-semibold">Notification Channels</h1>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Add Channel
        </Button>
      </div>

      {channels.length === 0 ? (
        <EmptyState
          title="No notification channels"
          description="Add a channel to receive alerts and reports"
          icon={Mail}
          action={{
            label: 'Add Channel',
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
                    : 'Webhook configured'}
                </p>
                <div className="flex items-center justify-between">
                  <span className={`text-xs px-2 py-1 rounded ${channel.is_verified ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'}`}>
                    {channel.is_verified ? 'Verified' : 'Unverified'}
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
          <DialogTitle>{editingChannel ? 'Edit Channel' : 'Add Notification Channel'}</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
                placeholder="My Slack Channel"
              />
            </div>

            {!editingChannel && (
              <div>
                <Label htmlFor="type">Channel Type</Label>
                <Select
                  id="type"
                  value={formData.channel_type}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, channel_type: e.target.value as ChannelType })}
                >
                  <option value="slack">Slack</option>
                  <option value="email">Email</option>
                  <option value="google_chat">Google Chat</option>
                </Select>
              </div>
            )}

            {(formData.channel_type === 'slack' || formData.channel_type === 'google_chat') && (
              <div>
                <Label htmlFor="webhook">Webhook URL</Label>
                <Input
                  id="webhook"
                  value={formData.webhook_url}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, webhook_url: e.target.value })}
                  placeholder={formData.channel_type === 'slack' ? 'https://hooks.slack.com/services/...' : 'https://chat.googleapis.com/v1/spaces/...'}
                />
              </div>
            )}

            {formData.channel_type === 'email' && (
              <div>
                <Label htmlFor="recipients">Recipients</Label>
                <Input
                  id="recipients"
                  value={formData.recipients}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, recipients: e.target.value })}
                  placeholder="email1@example.com, email2@example.com"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Separate multiple email addresses with commas
                </p>
              </div>
            )}
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={handleCloseDialog}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : editingChannel ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
