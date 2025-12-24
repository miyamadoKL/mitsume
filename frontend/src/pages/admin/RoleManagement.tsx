import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
      toast.error(t('admin.roles.toast.catalogsFailed'), getErrorMessage(err))
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
        toast.success(t('admin.roles.toast.updated'), t('admin.roles.toast.updatedDesc', { name: formData.name }))
      } else {
        const req: CreateRoleRequest = {
          name: formData.name,
          description: formData.description,
        }
        await adminApi.createRole(req)
        toast.success(t('admin.roles.toast.created'), t('admin.roles.toast.createdDesc', { name: formData.name }))
      }

      await loadRoles()
      handleCloseDialog()
    } catch (err) {
      toast.error(t('admin.roles.toast.saveFailed'), getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleSaveCatalogs = async () => {
    if (!selectedRole) return
    try {
      setSaving(true)
      await adminApi.setRoleCatalogs(selectedRole.id, selectedCatalogs)
      toast.success(t('admin.roles.toast.catalogsUpdated'), t('admin.roles.toast.catalogsUpdatedDesc', { name: selectedRole.name }))
      await loadRoles()
      handleCloseCatalogDialog()
    } catch (err) {
      toast.error(t('admin.roles.toast.catalogsSaveFailed'), getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (role: RoleWithCatalogs) => {
    if (role.is_system) {
      toast.error(t('admin.roles.toast.cannotDeleteSystem'), t('admin.roles.toast.cannotDeleteSystemDesc'))
      return
    }
    if (!confirm(t('admin.roles.confirmDelete', { name: role.name }))) return

    try {
      await adminApi.deleteRole(role.id)
      toast.success(t('admin.roles.toast.deleted'), t('admin.roles.toast.deletedDesc', { name: role.name }))
      await loadRoles()
    } catch (err) {
      toast.error(t('admin.roles.toast.deleteFailed'), getErrorMessage(err))
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
          <h1 className="text-2xl font-bold">{t('admin.roles.title')}</h1>
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
          <h1 className="text-2xl font-bold">{t('admin.roles.title')}</h1>
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
        <h1 className="text-2xl font-bold">{t('admin.roles.title')}</h1>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" /> {t('admin.roles.create')}
        </Button>
      </div>

      {roles.length === 0 ? (
        <EmptyState
          title={t('admin.roles.empty')}
          description={t('admin.roles.emptyDescription')}
          icon={Shield}
          action={{
            label: t('admin.roles.create'),
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
                    {t('common.system')}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                {role.description || t('common.noDescription')}
              </p>
              <div className="text-sm mb-3">
                <span className="font-medium">{t('admin.roles.catalogs')}:</span>{' '}
                {role.is_system ? (
                  <span className="text-muted-foreground">{t('admin.roles.allCatalogs')}</span>
                ) : role.catalogs && role.catalogs.length > 0 ? (
                  <span className="text-muted-foreground">{role.catalogs.join(', ')}</span>
                ) : (
                  <span className="text-muted-foreground">{t('common.none')}</span>
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
                      <Database className="h-4 w-4 mr-1" /> {t('admin.roles.catalogsButton')}
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
            <DialogTitle>{editingRole ? t('admin.roles.edit') : t('admin.roles.create')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">{t('admin.roles.name')}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('admin.roles.namePlaceholder')}
              />
            </div>
            <div>
              <Label htmlFor="description">{t('admin.roles.description')}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('admin.roles.descriptionPlaceholder')}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving || !formData.name}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingRole ? t('common.update') : t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Catalog Permissions Dialog */}
      <Dialog open={catalogDialogOpen} onClose={handleCloseCatalogDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.roles.catalogPermissionsTitle', { name: selectedRole?.name })}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              {t('admin.roles.catalogPermissionsDesc')}
            </p>
            {availableCatalogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('admin.roles.noCatalogsAvailable')}</p>
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
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveCatalogs} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
