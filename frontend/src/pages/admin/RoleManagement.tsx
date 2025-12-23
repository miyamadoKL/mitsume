import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Input, Label, Textarea } from '@/components/ui/input'
import { adminApi } from '@/services/api'
import { toast } from '@/stores/toastStore'
import { getErrorMessage } from '@/lib/errors'
import { SkeletonCard } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState, getErrorVariant } from '@/components/ui/error-state'
import { Plus, Trash2, Edit2, Shield, Loader2, Database } from 'lucide-react'
import type { RoleWithCatalogs, CreateRoleRequest } from '@/types'

export default function RoleManagement() {
  const [roles, setRoles] = useState<RoleWithCatalogs[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [isRetrying, setIsRetrying] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [catalogDialogOpen, setCatalogDialogOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<RoleWithCatalogs | null>(null)
  const [selectedRole, setSelectedRole] = useState<RoleWithCatalogs | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  })
  const [availableCatalogs, setAvailableCatalogs] = useState<string[]>([])
  const [selectedCatalogs, setSelectedCatalogs] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const loadRoles = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminApi.getRoles()
      setRoles(data)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleRetry = useCallback(async () => {
    setIsRetrying(true)
    try {
      await loadRoles()
    } finally {
      setIsRetrying(false)
    }
  }, [loadRoles])

  useEffect(() => {
    loadRoles()
  }, [loadRoles])

  const handleOpenDialog = (role?: RoleWithCatalogs) => {
    if (role) {
      setEditingRole(role)
      setFormData({
        name: role.name,
        description: role.description || '',
      })
    } else {
      setEditingRole(null)
      setFormData({
        name: '',
        description: '',
      })
    }
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingRole(null)
  }

  const handleOpenCatalogDialog = async (role: RoleWithCatalogs) => {
    setSelectedRole(role)
    setSelectedCatalogs(role.catalogs || [])
    try {
      const catalogs = await adminApi.getAvailableCatalogs()
      setAvailableCatalogs(catalogs)
      setCatalogDialogOpen(true)
    } catch (err) {
      toast.error('Failed to load catalogs', getErrorMessage(err))
    }
  }

  const handleCloseCatalogDialog = () => {
    setCatalogDialogOpen(false)
    setSelectedRole(null)
    setSelectedCatalogs([])
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      if (editingRole) {
        await adminApi.updateRole(editingRole.id, {
          name: formData.name,
          description: formData.description,
        })
        toast.success('Role updated', `"${formData.name}" has been updated`)
      } else {
        const req: CreateRoleRequest = {
          name: formData.name,
          description: formData.description,
        }
        await adminApi.createRole(req)
        toast.success('Role created', `"${formData.name}" has been created`)
      }

      await loadRoles()
      handleCloseDialog()
    } catch (err) {
      toast.error('Failed to save role', getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleSaveCatalogs = async () => {
    if (!selectedRole) return
    try {
      setSaving(true)
      await adminApi.setRoleCatalogs(selectedRole.id, selectedCatalogs)
      toast.success('Catalogs updated', `Catalog permissions for "${selectedRole.name}" have been updated`)
      await loadRoles()
      handleCloseCatalogDialog()
    } catch (err) {
      toast.error('Failed to save catalogs', getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (role: RoleWithCatalogs) => {
    if (role.is_system) {
      toast.error('Cannot delete system role', 'The admin role cannot be deleted')
      return
    }
    if (!confirm(`Are you sure you want to delete "${role.name}"?`)) return

    try {
      await adminApi.deleteRole(role.id)
      toast.success('Role deleted', `"${role.name}" has been deleted`)
      await loadRoles()
    } catch (err) {
      toast.error('Failed to delete role', getErrorMessage(err))
    }
  }

  const toggleCatalog = (catalog: string) => {
    setSelectedCatalogs(prev =>
      prev.includes(catalog)
        ? prev.filter(c => c !== catalog)
        : [...prev, catalog]
    )
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Role Management</h1>
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
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Role Management</h1>
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
        <h1 className="text-2xl font-bold">Role Management</h1>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" /> Create Role
        </Button>
      </div>

      {roles.length === 0 ? (
        <EmptyState
          title="No roles configured"
          description="Create a role to manage user permissions"
          icon={Shield}
          action={{
            label: 'Create Role',
            onClick: () => handleOpenDialog(),
          }}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => (
          <Card key={role.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className={`h-5 w-5 ${role.is_system ? 'text-amber-500' : 'text-muted-foreground'}`} />
                  <CardTitle className="text-lg">{role.name}</CardTitle>
                </div>
                {role.is_system && (
                  <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded">
                    System
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                {role.description || 'No description'}
              </p>
              <div className="text-sm mb-3">
                <span className="font-medium">Catalogs:</span>{' '}
                {role.is_system ? (
                  <span className="text-muted-foreground">All catalogs</span>
                ) : role.catalogs && role.catalogs.length > 0 ? (
                  <span className="text-muted-foreground">{role.catalogs.join(', ')}</span>
                ) : (
                  <span className="text-muted-foreground">None</span>
                )}
              </div>
              <div className="flex gap-2">
                {!role.is_system && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenCatalogDialog(role)}
                    >
                      <Database className="h-4 w-4 mr-1" /> Catalogs
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDialog(role)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(role)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        </div>
      )}

      {/* Create/Edit Role Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRole ? 'Edit Role' : 'Create Role'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Role name"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Role description"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !formData.name}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingRole ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Catalog Permissions Dialog */}
      <Dialog open={catalogDialogOpen} onClose={handleCloseCatalogDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Catalog Permissions - {selectedRole?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Select which catalogs users with this role can access.
            </p>
            {availableCatalogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No catalogs available.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {availableCatalogs.map((catalog) => (
                  <label
                    key={catalog}
                    className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCatalogs.includes(catalog)}
                      onChange={() => toggleCatalog(catalog)}
                      className="h-4 w-4"
                    />
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <span>{catalog}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseCatalogDialog}>
              Cancel
            </Button>
            <Button onClick={handleSaveCatalogs} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
