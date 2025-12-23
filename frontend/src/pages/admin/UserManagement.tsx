import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { adminApi } from '@/services/api'
import { toast } from '@/stores/toastStore'
import { getErrorMessage } from '@/lib/errors'
import { SkeletonTable } from '@/components/ui/loading-state'
import { ErrorState, getErrorVariant } from '@/components/ui/error-state'
import { Users, Shield, Loader2, UserCog } from 'lucide-react'
import type { UserWithRoles, RoleWithCatalogs } from '@/types'
import { useAuthStore } from '@/stores/authStore'

export default function UserManagement() {
  const [users, setUsers] = useState<UserWithRoles[]>([])
  const [roles, setRoles] = useState<RoleWithCatalogs[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [isRetrying, setIsRetrying] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null)
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const currentUser = useAuthStore((state) => state.user)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [usersData, rolesData] = await Promise.all([
        adminApi.getUsersWithRoles(),
        adminApi.getRoles(),
      ])
      setUsers(usersData)
      setRoles(rolesData)
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

  const handleOpenDialog = (user: UserWithRoles) => {
    setSelectedUser(user)
    setSelectedRoleIds(user.roles?.map((r) => r.id) || [])
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setSelectedUser(null)
    setSelectedRoleIds([])
  }

  const toggleRole = (roleId: string) => {
    // Prevent removing admin role from current user
    const adminRole = roles.find((r) => r.name === 'admin')
    if (
      adminRole &&
      roleId === adminRole.id &&
      selectedUser?.id === currentUser?.id &&
      selectedRoleIds.includes(roleId)
    ) {
      toast.error('Cannot remove admin role', 'You cannot remove your own admin role')
      return
    }

    setSelectedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    )
  }

  const handleSaveRoles = async () => {
    if (!selectedUser) return

    try {
      setSaving(true)
      const currentRoleIds = selectedUser.roles?.map((r) => r.id) || []

      // Find roles to add and remove
      const rolesToAdd = selectedRoleIds.filter((id) => !currentRoleIds.includes(id))
      const rolesToRemove = currentRoleIds.filter((id) => !selectedRoleIds.includes(id))

      // Execute all changes
      await Promise.all([
        ...rolesToAdd.map((roleId) => adminApi.assignRole(selectedUser.id, roleId)),
        ...rolesToRemove.map((roleId) => adminApi.unassignRole(selectedUser.id, roleId)),
      ])

      toast.success('Roles updated', `Roles for "${selectedUser.name}" have been updated`)
      await loadData()
      handleCloseDialog()
    } catch (err) {
      toast.error('Failed to save roles', getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">User Management</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SkeletonTable rows={5} cols={5} />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">User Management</h1>
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">User Management</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">Name</th>
                  <th className="text-left py-3 px-4 font-medium">Email</th>
                  <th className="text-left py-3 px-4 font-medium">Auth Provider</th>
                  <th className="text-left py-3 px-4 font-medium">Roles</th>
                  <th className="text-left py-3 px-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {user.name}
                        {user.id === currentUser?.id && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                            You
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{user.email}</td>
                    <td className="py-3 px-4">
                      <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                        {user.auth_provider}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {user.roles && user.roles.length > 0 ? (
                          user.roles.map((role) => (
                            <span
                              key={role.id}
                              className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${
                                role.is_system
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-green-100 text-green-800'
                              }`}
                            >
                              <Shield className="h-3 w-3" />
                              {role.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-muted-foreground text-sm">No roles</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Button variant="outline" size="sm" onClick={() => handleOpenDialog(user)}>
                        <UserCog className="h-4 w-4 mr-1" /> Manage Roles
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Role Assignment Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Roles - {selectedUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Select roles to assign to this user.
            </p>
            {roles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No roles available.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {roles.map((role) => {
                  const isAdminRole = role.name === 'admin'
                  const isSelfAdminRole =
                    isAdminRole &&
                    selectedUser?.id === currentUser?.id &&
                    selectedRoleIds.includes(role.id)

                  return (
                    <label
                      key={role.id}
                      className={`flex items-center gap-2 p-2 rounded hover:bg-muted ${
                        isSelfAdminRole ? 'opacity-50' : 'cursor-pointer'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedRoleIds.includes(role.id)}
                        onChange={() => toggleRole(role.id)}
                        disabled={isSelfAdminRole}
                        className="h-4 w-4"
                      />
                      <Shield
                        className={`h-4 w-4 ${
                          role.is_system ? 'text-amber-500' : 'text-muted-foreground'
                        }`}
                      />
                      <div>
                        <span className="font-medium">{role.name}</span>
                        {role.is_system && (
                          <span className="text-xs text-amber-600 ml-2">(System)</span>
                        )}
                        {role.description && (
                          <p className="text-xs text-muted-foreground">{role.description}</p>
                        )}
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button onClick={handleSaveRoles} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
