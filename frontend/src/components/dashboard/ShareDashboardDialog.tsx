import React, { useState, useEffect } from 'react'
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { dashboardApi, adminApi } from '@/services/api'
import type { Dashboard, DashboardPermission, RoleWithCatalogs } from '@/types'
import { toast } from '@/stores/toastStore'
import { getErrorMessage } from '@/lib/errors'
import { Trash2, Users, Globe, Lock, UserPlus, Shield } from 'lucide-react'

interface ShareDashboardDialogProps {
  open: boolean
  onClose: () => void
  dashboard: Dashboard
  onUpdate: (dashboard: Dashboard) => void
}

const permissionLevelOptions = [
  { value: 'view', label: 'Can View' },
  { value: 'edit', label: 'Can Edit' },
]

export const ShareDashboardDialog: React.FC<ShareDashboardDialogProps> = ({
  open,
  onClose,
  dashboard,
  onUpdate,
}) => {
  const [permissions, setPermissions] = useState<DashboardPermission[]>([])
  const [roles, setRoles] = useState<RoleWithCatalogs[]>([])
  const [loading, setLoading] = useState(false)
  const [isPublic, setIsPublic] = useState(dashboard.is_public || false)

  // New permission form
  const [grantType, setGrantType] = useState<'user' | 'role'>('user')
  const [userEmail, setUserEmail] = useState('')
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [permissionLevel, setPermissionLevel] = useState<'view' | 'edit'>('view')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      loadPermissions()
      loadRoles()
      setIsPublic(dashboard.is_public || false)
    }
  }, [open, dashboard.id])

  const loadPermissions = async () => {
    setLoading(true)
    try {
      const data = await dashboardApi.getPermissions(dashboard.id)
      setPermissions(data)
    } catch (err) {
      console.error('Failed to load permissions:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadRoles = async () => {
    try {
      const data = await adminApi.getRoles()
      setRoles(data.filter(r => r.name !== 'admin'))
    } catch {
      // User may not have admin access
      setRoles([])
    }
  }

  const handleTogglePublic = async () => {
    try {
      await dashboardApi.updateVisibility(dashboard.id, { is_public: !isPublic })
      setIsPublic(!isPublic)
      onUpdate({ ...dashboard, is_public: !isPublic })
      toast.success(isPublic ? 'Dashboard is now private' : 'Dashboard is now public')
    } catch (err) {
      toast.error('Failed to update visibility', getErrorMessage(err))
    }
  }

  const handleGrantPermission = async () => {
    if (grantType === 'user' && !userEmail.trim()) {
      toast.error('Please enter a user email')
      return
    }
    if (grantType === 'role' && !selectedRoleId) {
      toast.error('Please select a role')
      return
    }

    setSaving(true)
    try {
      // For user-based permission, we need to look up the user ID
      // In a real implementation, you'd have an API to search users by email
      // For now, we'll send the email as user_id (backend should handle this)
      const req = grantType === 'user'
        ? { user_id: userEmail.trim(), permission_level: permissionLevel }
        : { role_id: selectedRoleId, permission_level: permissionLevel }

      const newPermission = await dashboardApi.grantPermission(dashboard.id, req)
      setPermissions([...permissions, newPermission])
      setUserEmail('')
      setSelectedRoleId('')
      toast.success('Permission granted')
    } catch (err) {
      toast.error('Failed to grant permission', getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleRevokePermission = async (permissionId: string) => {
    try {
      await dashboardApi.revokePermission(dashboard.id, permissionId)
      setPermissions(permissions.filter(p => p.id !== permissionId))
      toast.success('Permission revoked')
    } catch (err) {
      toast.error('Failed to revoke permission', getErrorMessage(err))
    }
  }

  const getPermissionIcon = (level: string) => {
    switch (level) {
      case 'edit':
        return <Shield className="h-4 w-4 text-blue-500" />
      case 'view':
        return <Users className="h-4 w-4 text-gray-500" />
      default:
        return null
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader>
        <DialogTitle>Share Dashboard</DialogTitle>
      </DialogHeader>
      <DialogContent>
        <div className="space-y-6">
          {/* Public/Private Toggle */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              {isPublic ? (
                <Globe className="h-5 w-5 text-green-500" />
              ) : (
                <Lock className="h-5 w-5 text-gray-500" />
              )}
              <div>
                <p className="font-medium">
                  {isPublic ? 'Public Dashboard' : 'Private Dashboard'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isPublic
                    ? 'Anyone with access to the system can view this dashboard'
                    : 'Only you and people with explicit permission can access'}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleTogglePublic}>
              {isPublic ? 'Make Private' : 'Make Public'}
            </Button>
          </div>

          {/* Add Permission Form */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Add People or Roles</h3>
            <div className="flex gap-2">
              <Select
                value={grantType}
                onChange={(e) => setGrantType(e.target.value as 'user' | 'role')}
                options={[
                  { value: 'user', label: 'User' },
                  { value: 'role', label: 'Role' },
                ]}
                className="w-24"
              />
              {grantType === 'user' ? (
                <Input
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="Enter user ID"
                  className="flex-1"
                />
              ) : (
                <Select
                  value={selectedRoleId}
                  onChange={(e) => setSelectedRoleId(e.target.value)}
                  options={[
                    { value: '', label: 'Select role...' },
                    ...roles.map(r => ({ value: r.id, label: r.name })),
                  ]}
                  className="flex-1"
                />
              )}
              <Select
                value={permissionLevel}
                onChange={(e) => setPermissionLevel(e.target.value as 'view' | 'edit')}
                options={permissionLevelOptions}
                className="w-32"
              />
              <Button onClick={handleGrantPermission} disabled={saving}>
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Permission List */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">People with Access</h3>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : permissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No one else has access to this dashboard
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {permissions.map((perm) => (
                  <div
                    key={perm.id}
                    className="flex items-center justify-between p-2 bg-muted/50 rounded"
                  >
                    <div className="flex items-center gap-3">
                      {getPermissionIcon(perm.permission_level)}
                      <div>
                        <p className="text-sm font-medium">
                          {perm.user_name || perm.user_email || perm.role_name || 'Unknown'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {perm.role_id ? 'Role' : 'User'} - Can {perm.permission_level}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevokePermission(perm.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Done
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
