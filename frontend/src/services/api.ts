import axios, { AxiosError } from 'axios'
import type {
  AuthResponse,
  SavedQuery,
  QueryHistory,
  QueryResult,
  Dashboard,
  Widget,
  CreateDashboardRequest,
  CreateWidgetRequest,
  NotificationChannel,
  CreateNotificationChannelRequest,
  UpdateNotificationChannelRequest,
  QueryAlert,
  CreateAlertRequest,
  UpdateAlertRequest,
  AlertHistory,
  AlertTestResult,
  DashboardSubscription,
  CreateSubscriptionRequest,
  UpdateSubscriptionRequest,
  Role,
  RoleWithCatalogs,
  UserWithRoles,
  CreateRoleRequest,
  UpdateRoleRequest,
  DashboardPermission,
  GrantPermissionRequest,
  UpdateVisibilityRequest,
  LayoutTemplate,
  Position,
} from '@/types'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Auth
export const authApi = {
  register: async (email: string, password: string, name: string): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>('/auth/register', { email, password, name })
    return data
  },

  login: async (email: string, password: string): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>('/auth/login', { email, password })
    return data
  },

  getGoogleLoginUrl: async (): Promise<string> => {
    const { data } = await api.get<{ url: string }>('/auth/google')
    return data.url
  },

  me: async (): Promise<AuthResponse['user']> => {
    const { data } = await api.get<AuthResponse['user']>('/auth/me')
    return data
  },
}

// Queries
export const queryApi = {
  execute: async (query: string, catalog?: string, schema?: string): Promise<QueryResult> => {
    const { data } = await api.post<QueryResult>('/queries/execute', { query, catalog, schema })
    return data
  },

  getSaved: async (): Promise<SavedQuery[]> => {
    const { data } = await api.get<SavedQuery[]>('/queries/saved')
    return data
  },

  getSavedById: async (id: string): Promise<SavedQuery> => {
    const { data } = await api.get<SavedQuery>(`/queries/saved/${id}`)
    return data
  },

  save: async (name: string, queryText: string, description?: string): Promise<SavedQuery> => {
    const { data } = await api.post<SavedQuery>('/queries/saved', {
      name,
      query_text: queryText,
      description,
    })
    return data
  },

  update: async (id: string, updates: Partial<SavedQuery>): Promise<SavedQuery> => {
    const { data } = await api.put<SavedQuery>(`/queries/saved/${id}`, updates)
    return data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/queries/saved/${id}`)
  },

  getHistory: async (limit = 50, offset = 0): Promise<QueryHistory[]> => {
    const { data } = await api.get<QueryHistory[]>('/queries/history', {
      params: { limit, offset },
    })
    return data
  },
}

// Export
export const exportApi = {
  csv: async (query: string, filename?: string): Promise<Blob> => {
    const { data } = await api.post(
      '/export/csv',
      { query, filename },
      { responseType: 'blob' }
    )
    return data
  },

  tsv: async (query: string, filename?: string): Promise<Blob> => {
    const { data } = await api.post(
      '/export/tsv',
      { query, filename },
      { responseType: 'blob' }
    )
    return data
  },
}

// Catalogs
export const catalogApi = {
  getCatalogs: async (): Promise<string[]> => {
    const { data } = await api.get<{ catalogs: string[] }>('/catalogs')
    return data.catalogs
  },

  getSchemas: async (catalog: string): Promise<string[]> => {
    const { data } = await api.get<{ schemas: string[] }>(`/catalogs/${catalog}/schemas`)
    return data.schemas
  },

  getTables: async (catalog: string, schema: string): Promise<string[]> => {
    const { data } = await api.get<{ tables: string[] }>(
      `/catalogs/${catalog}/schemas/${schema}/tables`
    )
    return data.tables
  },
}

// Dashboards
export const dashboardApi = {
  getAll: async (): Promise<Dashboard[]> => {
    const { data } = await api.get<Dashboard[]>('/dashboards')
    return data
  },

  getById: async (id: string): Promise<Dashboard> => {
    const { data } = await api.get<Dashboard>(`/dashboards/${id}`)
    return data
  },

  create: async (req: CreateDashboardRequest): Promise<Dashboard> => {
    const { data } = await api.post<Dashboard>('/dashboards', req)
    return data
  },

  update: async (id: string, updates: Partial<Dashboard>): Promise<Dashboard> => {
    const { data } = await api.put<Dashboard>(`/dashboards/${id}`, updates)
    return data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/dashboards/${id}`)
  },

  // Widgets
  createWidget: async (dashboardId: string, req: CreateWidgetRequest): Promise<Widget> => {
    const { data } = await api.post<Widget>(`/dashboards/${dashboardId}/widgets`, req)
    return data
  },

  updateWidget: async (
    dashboardId: string,
    widgetId: string,
    updates: Partial<Widget>
  ): Promise<Widget> => {
    const { data } = await api.put<Widget>(
      `/dashboards/${dashboardId}/widgets/${widgetId}`,
      updates
    )
    return data
  },

  deleteWidget: async (dashboardId: string, widgetId: string): Promise<void> => {
    await api.delete(`/dashboards/${dashboardId}/widgets/${widgetId}`)
  },

  // Permissions
  getPermissions: async (dashboardId: string): Promise<DashboardPermission[]> => {
    const { data } = await api.get<DashboardPermission[]>(`/dashboards/${dashboardId}/permissions`)
    return data
  },

  grantPermission: async (dashboardId: string, req: GrantPermissionRequest): Promise<DashboardPermission> => {
    const { data } = await api.post<DashboardPermission>(`/dashboards/${dashboardId}/permissions`, req)
    return data
  },

  revokePermission: async (dashboardId: string, permissionId: string): Promise<void> => {
    await api.delete(`/dashboards/${dashboardId}/permissions/${permissionId}`)
  },

  updateVisibility: async (dashboardId: string, req: UpdateVisibilityRequest): Promise<void> => {
    await api.put(`/dashboards/${dashboardId}/visibility`, req)
  },
}

// Notification Channels
export const notificationApi = {
  getChannels: async (): Promise<NotificationChannel[]> => {
    const { data } = await api.get<NotificationChannel[]>('/notification-channels')
    return data
  },

  getChannel: async (id: string): Promise<NotificationChannel> => {
    const { data } = await api.get<NotificationChannel>(`/notification-channels/${id}`)
    return data
  },

  createChannel: async (req: CreateNotificationChannelRequest): Promise<NotificationChannel> => {
    const { data } = await api.post<NotificationChannel>('/notification-channels', req)
    return data
  },

  updateChannel: async (id: string, updates: UpdateNotificationChannelRequest): Promise<NotificationChannel> => {
    const { data } = await api.put<NotificationChannel>(`/notification-channels/${id}`, updates)
    return data
  },

  deleteChannel: async (id: string): Promise<void> => {
    await api.delete(`/notification-channels/${id}`)
  },

  testChannel: async (id: string): Promise<{ message: string }> => {
    const { data } = await api.post<{ message: string }>(`/notification-channels/${id}/test`)
    return data
  },
}

// Alerts
export const alertApi = {
  getAll: async (): Promise<QueryAlert[]> => {
    const { data } = await api.get<QueryAlert[]>('/alerts')
    return data
  },

  getById: async (id: string): Promise<QueryAlert> => {
    const { data } = await api.get<QueryAlert>(`/alerts/${id}`)
    return data
  },

  create: async (req: CreateAlertRequest): Promise<QueryAlert> => {
    const { data } = await api.post<QueryAlert>('/alerts', req)
    return data
  },

  update: async (id: string, updates: UpdateAlertRequest): Promise<QueryAlert> => {
    const { data } = await api.put<QueryAlert>(`/alerts/${id}`, updates)
    return data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/alerts/${id}`)
  },

  test: async (id: string): Promise<AlertTestResult> => {
    const { data } = await api.post<AlertTestResult>(`/alerts/${id}/test`)
    return data
  },

  getHistory: async (id: string, limit = 50): Promise<AlertHistory[]> => {
    const { data } = await api.get<AlertHistory[]>(`/alerts/${id}/history`, {
      params: { limit },
    })
    return data
  },
}

// Subscriptions
export const subscriptionApi = {
  getAll: async (): Promise<DashboardSubscription[]> => {
    const { data } = await api.get<DashboardSubscription[]>('/subscriptions')
    return data
  },

  getById: async (id: string): Promise<DashboardSubscription> => {
    const { data } = await api.get<DashboardSubscription>(`/subscriptions/${id}`)
    return data
  },

  create: async (req: CreateSubscriptionRequest): Promise<DashboardSubscription> => {
    const { data } = await api.post<DashboardSubscription>('/subscriptions', req)
    return data
  },

  update: async (id: string, updates: UpdateSubscriptionRequest): Promise<DashboardSubscription> => {
    const { data } = await api.put<DashboardSubscription>(`/subscriptions/${id}`, updates)
    return data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/subscriptions/${id}`)
  },

  trigger: async (id: string): Promise<{ message: string }> => {
    const { data } = await api.post<{ message: string }>(`/subscriptions/${id}/trigger`)
    return data
  },
}

// Layout Templates
export const layoutTemplateApi = {
  getAll: async (): Promise<LayoutTemplate[]> => {
    const { data } = await api.get<LayoutTemplate[]>('/layout-templates')
    return data
  },

  create: async (name: string, description: string, layout: Position[]): Promise<LayoutTemplate> => {
    const { data } = await api.post<LayoutTemplate>('/layout-templates', {
      name,
      description,
      layout,
    })
    return data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/layout-templates/${id}`)
  },
}

// Admin API
export const adminApi = {
  // Roles
  getRoles: async (): Promise<RoleWithCatalogs[]> => {
    const { data } = await api.get<RoleWithCatalogs[]>('/admin/roles')
    return data
  },

  getRole: async (id: string): Promise<RoleWithCatalogs> => {
    const { data } = await api.get<RoleWithCatalogs>(`/admin/roles/${id}`)
    return data
  },

  createRole: async (req: CreateRoleRequest): Promise<Role> => {
    const { data } = await api.post<Role>('/admin/roles', req)
    return data
  },

  updateRole: async (id: string, req: UpdateRoleRequest): Promise<Role> => {
    const { data } = await api.put<Role>(`/admin/roles/${id}`, req)
    return data
  },

  deleteRole: async (id: string): Promise<void> => {
    await api.delete(`/admin/roles/${id}`)
  },

  setRoleCatalogs: async (id: string, catalogs: string[]): Promise<void> => {
    await api.put(`/admin/roles/${id}/catalogs`, { catalogs })
  },

  getAvailableCatalogs: async (): Promise<string[]> => {
    const { data } = await api.get<{ catalogs: string[] }>('/admin/catalogs/available')
    return data.catalogs
  },

  // Users
  getUsersWithRoles: async (): Promise<UserWithRoles[]> => {
    const { data } = await api.get<UserWithRoles[]>('/admin/users')
    return data
  },

  assignRole: async (userId: string, roleId: string): Promise<void> => {
    await api.post(`/admin/users/${userId}/roles`, { role_id: roleId })
  },

  unassignRole: async (userId: string, roleId: string): Promise<void> => {
    await api.delete(`/admin/users/${userId}/roles/${roleId}`)
  },
}

export default api
