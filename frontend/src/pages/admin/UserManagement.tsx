import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { adminApi } from '@/services/api'
import { toast } from '@/stores/toastStore'
import { getErrorMessage } from '@/lib/errors'
import { SkeletonTable } from '@/components/ui/loading-state'
import { ErrorState, getErrorVariant } from '@/components/ui/error-state'
import { Users, Shield, Loader2, UserCog, UserCheck, UserX, Clock, CheckCircle, XCircle } from 'lucide-react'
import type { User, UserWithRoles, RoleWithCatalogs, UserStatus } from '@/types'
import { useAuthStore } from '@/stores/authStore'

type TabType = 'all' | 'pending' | 'active' | 'disabled'

const statusColors: Record<UserStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  disabled: 'bg-red-100 text-red-800',
}

const statusIcons: Record<UserStatus, typeof Clock> = {
  pending: Clock,
  active: CheckCircle,
  disabled: XCircle,
}

export default function UserManagement() {
  const { t } = useTranslation()
  const [users, setUsers] = useState<UserWithRoles[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [pendingUsers, setPendingUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<RoleWithCatalogs[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [isRetrying, setIsRetrying] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null)
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('all')
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)
  const currentUser = useAuthStore((state) => state.user)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [usersData, rolesData, allUsersData, pendingData] = await Promise.all([
        adminApi.getUsersWithRoles(),
        adminApi.getRoles(),
        adminApi.getAllUsers(),
        adminApi.getPendingUsers(),
      ])
      setUsers(usersData)
      setRoles(rolesData)
      setAllUsers(allUsersData)
      setPendingUsers(pendingData)
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
      toast.error(t('admin.users.toast.cannotRemoveAdminRole'), t('admin.users.toast.cannotRemoveAdminRoleDesc'))
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

      toast.success(t('admin.users.toast.rolesUpdated'), t('admin.users.toast.rolesUpdatedDesc', { name: selectedUser.name }))
      await loadData()
      handleCloseDialog()
    } catch (err) {
      toast.error(t('admin.users.toast.saveFailed'), getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleApproveUser = async (user: User) => {
    try {
      setActionInProgress(user.id)
      await adminApi.approveUser(user.id)
      toast.success(t('admin.users.toast.userApproved'), t('admin.users.toast.userApprovedDesc', { name: user.name }))
      await loadData()
    } catch (err) {
      toast.error(t('admin.users.toast.approveFailed'), getErrorMessage(err))
    } finally {
      setActionInProgress(null)
    }
  }

  const handleDisableUser = async (user: User) => {
    if (user.id === currentUser?.id) {
      toast.error(t('admin.users.toast.cannotDisableSelf'), t('admin.users.toast.cannotDisableSelfDesc'))
      return
    }
    try {
      setActionInProgress(user.id)
      await adminApi.disableUser(user.id)
      toast.success(t('admin.users.toast.userDisabled'), t('admin.users.toast.userDisabledDesc', { name: user.name }))
      await loadData()
    } catch (err) {
      toast.error(t('admin.users.toast.disableFailed'), getErrorMessage(err))
    } finally {
      setActionInProgress(null)
    }
  }

  const handleEnableUser = async (user: User) => {
    try {
      setActionInProgress(user.id)
      await adminApi.enableUser(user.id)
      toast.success(t('admin.users.toast.userEnabled'), t('admin.users.toast.userEnabledDesc', { name: user.name }))
      await loadData()
    } catch (err) {
      toast.error(t('admin.users.toast.enableFailed'), getErrorMessage(err))
    } finally {
      setActionInProgress(null)
    }
  }

  // Filter users based on active tab
  const filteredUsers = allUsers.filter((user) => {
    if (activeTab === 'all') return true
    return user.status === activeTab
  })

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">{t('admin.users.title')}</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t('nav.users')}
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
          <h1 className="text-2xl font-bold">{t('admin.users.title')}</h1>
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
        <h1 className="text-2xl font-bold">{t('admin.users.title')}</h1>
      </div>

      {/* Pending Users Alert */}
      {pendingUsers.length > 0 && (
        <Card className="mb-6 border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-yellow-800">
              <Clock className="h-5 w-5" />
              {t('admin.users.pendingApproval')}
            </CardTitle>
            <CardDescription className="text-yellow-700">
              {t('admin.users.pendingApprovalDesc', { count: pendingUsers.length })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {pendingUsers.map((user) => (
                <div key={user.id} className="flex items-center gap-2 bg-white px-3 py-2 rounded-md border">
                  <span className="font-medium">{user.name}</span>
                  <span className="text-muted-foreground text-sm">({user.email || user.username})</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={() => handleApproveUser(user)}
                    disabled={actionInProgress === user.id}
                  >
                    {actionInProgress === user.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UserCheck className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(['all', 'pending', 'active', 'disabled'] as TabType[]).map((tab) => (
          <Button
            key={tab}
            variant={activeTab === tab ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'all' && t('common.all')}
            {tab === 'pending' && t('admin.users.statusPending')}
            {tab === 'active' && t('admin.users.statusActive')}
            {tab === 'disabled' && t('admin.users.statusDisabled')}
            <span className="ml-1 text-xs opacity-70">
              ({allUsers.filter((u) => tab === 'all' || u.status === tab).length})
            </span>
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('nav.users')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">{t('common.name')}</th>
                  <th className="text-left py-3 px-4 font-medium">{t('auth.email')}</th>
                  <th className="text-left py-3 px-4 font-medium">{t('admin.users.status')}</th>
                  <th className="text-left py-3 px-4 font-medium">{t('admin.users.authProvider')}</th>
                  <th className="text-left py-3 px-4 font-medium">{t('admin.users.roles')}</th>
                  <th className="text-left py-3 px-4 font-medium">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const StatusIcon = statusIcons[user.status]
                  const userWithRoles = users.find((u) => u.id === user.id)
                  return (
                    <tr key={user.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {user.name}
                          {user.id === currentUser?.id && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                              {t('common.you')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{user.email || user.username || '-'}</td>
                      <td className="py-3 px-4">
                        <span className={`text-xs px-2 py-1 rounded flex items-center gap-1 w-fit ${statusColors[user.status]}`}>
                          <StatusIcon className="h-3 w-3" />
                          {user.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                          {user.auth_provider}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {userWithRoles?.roles && userWithRoles.roles.length > 0 ? (
                            userWithRoles.roles.map((role) => (
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
                            <span className="text-muted-foreground text-sm">{t('common.noRoles')}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          {user.status === 'pending' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => handleApproveUser(user)}
                              disabled={actionInProgress === user.id}
                            >
                              {actionInProgress === user.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <UserCheck className="h-4 w-4 mr-1" />
                              )}
                              {t('admin.users.approve')}
                            </Button>
                          )}
                          {user.status === 'active' && user.id !== currentUser?.id && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDisableUser(user)}
                              disabled={actionInProgress === user.id}
                            >
                              {actionInProgress === user.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <UserX className="h-4 w-4 mr-1" />
                              )}
                              {t('admin.users.disable')}
                            </Button>
                          )}
                          {user.status === 'disabled' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => handleEnableUser(user)}
                              disabled={actionInProgress === user.id}
                            >
                              {actionInProgress === user.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <UserCheck className="h-4 w-4 mr-1" />
                              )}
                              {t('admin.users.enable')}
                            </Button>
                          )}
                          {userWithRoles && (
                            <Button variant="outline" size="sm" onClick={() => handleOpenDialog(userWithRoles)}>
                              <UserCog className="h-4 w-4 mr-1" /> {t('admin.users.manageRoles')}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Role Assignment Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.users.manageRolesTitle', { name: selectedUser?.name })}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              {t('admin.users.manageRolesDesc')}
            </p>
            {roles.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('admin.users.noRolesAvailable')}</p>
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
                          <span className="text-xs text-amber-600 ml-2">({t('common.system')})</span>
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
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveRoles} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
