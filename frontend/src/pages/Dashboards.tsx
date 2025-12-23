import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { dashboardApi } from '@/services/api'
import type { Dashboard } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { formatDate } from '@/lib/utils'
import { toast } from '@/stores/toastStore'
import { getErrorMessage } from '@/lib/errors'
import { SkeletonCard } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState, getErrorVariant } from '@/components/ui/error-state'
import { Plus, Trash2, LayoutDashboard, Eye, Edit, Globe, Crown } from 'lucide-react'
import type { PermissionLevel } from '@/types'

const getPermissionBadge = (permission: PermissionLevel, isPublic?: boolean) => {
  const badges = []

  if (permission === 'owner') {
    badges.push(
      <span key="owner" className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">
        <Crown className="h-3 w-3" />
        Owner
      </span>
    )
  } else if (permission === 'edit') {
    badges.push(
      <span key="edit" className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-600">
        <Edit className="h-3 w-3" />
        Can Edit
      </span>
    )
  } else if (permission === 'view') {
    badges.push(
      <span key="view" className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
        <Eye className="h-3 w-3" />
        View Only
      </span>
    )
  }

  if (isPublic) {
    badges.push(
      <span key="public" className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-600">
        <Globe className="h-3 w-3" />
        Public
      </span>
    )
  }

  return badges
}

export const Dashboards: React.FC = () => {
  const navigate = useNavigate()
  const [dashboards, setDashboards] = useState<Dashboard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [isRetrying, setIsRetrying] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [dashboardToDelete, setDashboardToDelete] = useState<Dashboard | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const loadDashboards = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await dashboardApi.getAll()
      setDashboards(data)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleRetry = useCallback(async () => {
    setIsRetrying(true)
    try {
      await loadDashboards()
    } finally {
      setIsRetrying(false)
    }
  }, [loadDashboards])

  useEffect(() => {
    loadDashboards()
  }, [loadDashboards])

  const handleCreate = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const dashboard = await dashboardApi.create({
        name,
        description: description || undefined,
      })
      setDashboards([dashboard, ...dashboards])
      setCreateDialogOpen(false)
      setName('')
      setDescription('')
      toast.success('Dashboard created', `"${dashboard.name}" has been created`)
      navigate(`/dashboards/${dashboard.id}`)
    } catch (err) {
      toast.error('Failed to create dashboard', getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteClick = (dashboard: Dashboard, e: React.MouseEvent) => {
    e.stopPropagation()
    setDashboardToDelete(dashboard)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!dashboardToDelete) return
    setDeleting(true)
    const dashboardName = dashboardToDelete.name
    try {
      await dashboardApi.delete(dashboardToDelete.id)
      setDashboards(dashboards.filter(d => d.id !== dashboardToDelete.id))
      setDeleteDialogOpen(false)
      setDashboardToDelete(null)
      toast.success('Dashboard deleted', `"${dashboardName}" has been deleted`)
    } catch (err) {
      toast.error('Failed to delete dashboard', getErrorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Dashboards</h1>
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
          <h1 className="text-2xl font-semibold">Dashboards</h1>
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
        <h1 className="text-2xl font-semibold">Dashboards</h1>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Dashboard
        </Button>
      </div>

      {dashboards.length === 0 ? (
        <EmptyState
          title="No dashboards yet"
          description="Create your first dashboard to visualize your data"
          icon={LayoutDashboard}
          action={{
            label: 'New Dashboard',
            onClick: () => setCreateDialogOpen(true),
          }}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {dashboards.map((dashboard) => (
            <Card
              key={dashboard.id}
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => navigate(`/dashboards/${dashboard.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <LayoutDashboard className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg">{dashboard.name}</CardTitle>
                  </div>
                  {dashboard.my_permission === 'owner' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => handleDeleteClick(dashboard, e)}
                      aria-label="Delete dashboard"
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {getPermissionBadge(dashboard.my_permission || 'owner', dashboard.is_public)}
                </div>
                <CardDescription>
                  {dashboard.description || 'No description'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-xs text-muted-foreground">
                  Updated {formatDate(dashboard.updated_at)}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)}>
        <DialogHeader>
          <DialogTitle>Create Dashboard</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dashboard name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description (optional)</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description"
              />
            </div>
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={saving || !name.trim()}>
            {saving ? 'Creating...' : 'Create'}
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogHeader>
          <DialogTitle>Delete Dashboard</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <p>Are you sure you want to delete "{dashboardToDelete?.name}"?</p>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
