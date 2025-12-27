import { http, HttpResponse } from 'msw'
import type {
  AuthResponse,
  SavedQuery,
  QueryHistory,
  QueryResult,
  Dashboard,
  Widget,
} from '@/types'

// Mock data
export const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  auth_provider: 'local',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

export const mockToken = 'mock-jwt-token'

export const mockSavedQueries: SavedQuery[] = [
  {
    id: 'query-1',
    user_id: 'user-1',
    name: 'Test Query 1',
    description: 'A test query',
    query_text: 'SELECT 1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'query-2',
    user_id: 'user-1',
    name: 'Test Query 2',
    description: null,
    query_text: 'SELECT 2',
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
  },
]

export const mockQueryHistory: QueryHistory[] = [
  {
    id: 'history-1',
    user_id: 'user-1',
    query_text: 'SELECT 1',
    status: 'success',
    execution_time_ms: 100,
    row_count: 1,
    error_message: null,
    executed_at: '2024-01-01T10:00:00Z',
  },
  {
    id: 'history-2',
    user_id: 'user-1',
    query_text: 'SELECT * FROM invalid',
    status: 'error',
    execution_time_ms: 50,
    row_count: null,
    error_message: 'Table not found',
    executed_at: '2024-01-01T09:00:00Z',
  },
]

export const mockQueryResult: QueryResult = {
  columns: ['id', 'name', 'value'],
  rows: [
    [1, 'Item 1', 100],
    [2, 'Item 2', 200],
    [3, 'Item 3', 300],
  ],
  row_count: 3,
  execution_time_ms: 150,
}

export const mockDashboards: Dashboard[] = [
  {
    id: 'dashboard-1',
    user_id: 'user-1',
    name: 'Test Dashboard',
    description: 'A test dashboard',
    layout: [{ i: 'widget-1', x: 0, y: 0, w: 6, h: 4 }],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    widgets: [],
    my_permission: 'owner',
  },
]

export const mockWidgets: Widget[] = [
  {
    id: 'widget-1',
    dashboard_id: 'dashboard-1',
    name: 'Test Widget',
    query_id: 'query-1',
    chart_type: 'bar',
    chart_config: { xAxis: 'name', yAxis: 'value' },
    position: { x: 0, y: 0, w: 6, h: 4 },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
]

export const handlers = [
  // Auth handlers
  http.post('/api/auth/login', async ({ request }) => {
    const body = await request.json() as { email: string; password: string }
    if (body.email === 'test@example.com' && body.password === 'password123') {
      return HttpResponse.json<AuthResponse>({
        token: mockToken,
        user: mockUser,
      })
    }
    return HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }),

  http.post('/api/auth/register', async ({ request }) => {
    const body = await request.json() as { email: string; password: string; name: string }
    return HttpResponse.json<AuthResponse>({
      token: mockToken,
      user: { ...mockUser, email: body.email, name: body.name },
    })
  }),

  http.get('/api/auth/me', ({ request }) => {
    const authHeader = request.headers.get('Authorization')
    if (authHeader === `Bearer ${mockToken}`) {
      return HttpResponse.json(mockUser)
    }
    return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }),

  http.get('/api/auth/google', () => {
    return HttpResponse.json({ url: 'https://accounts.google.com/oauth/mock' })
  }),

  // Query handlers
  http.post('/api/queries/execute', async ({ request }) => {
    const body = await request.json() as { query: string }
    if (body.query.toLowerCase().includes('error')) {
      return HttpResponse.json({ error: 'Query execution failed' }, { status: 400 })
    }
    return HttpResponse.json<QueryResult>(mockQueryResult)
  }),

  http.get('/api/queries/saved', () => {
    return HttpResponse.json<SavedQuery[]>(mockSavedQueries)
  }),

  http.get('/api/queries/saved/:id', ({ params }) => {
    const query = mockSavedQueries.find((q) => q.id === params.id)
    if (query) {
      return HttpResponse.json<SavedQuery>(query)
    }
    return HttpResponse.json({ error: 'Not found' }, { status: 404 })
  }),

  http.post('/api/queries/saved', async ({ request }) => {
    const body = await request.json() as { name: string; query_text: string; description?: string }
    const newQuery: SavedQuery = {
      id: `query-${Date.now()}`,
      user_id: 'user-1',
      name: body.name,
      description: body.description || null,
      query_text: body.query_text,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    return HttpResponse.json<SavedQuery>(newQuery)
  }),

  http.put('/api/queries/saved/:id', async ({ params, request }) => {
    const body = await request.json() as Partial<SavedQuery>
    const query = mockSavedQueries.find((q) => q.id === params.id)
    if (query) {
      return HttpResponse.json<SavedQuery>({ ...query, ...body })
    }
    return HttpResponse.json({ error: 'Not found' }, { status: 404 })
  }),

  http.delete('/api/queries/saved/:id', ({ params }) => {
    const query = mockSavedQueries.find((q) => q.id === params.id)
    if (query) {
      return new HttpResponse(null, { status: 204 })
    }
    return HttpResponse.json({ error: 'Not found' }, { status: 404 })
  }),

  http.get('/api/queries/history', () => {
    return HttpResponse.json<QueryHistory[]>(mockQueryHistory)
  }),

  // Export handlers
  http.post('/api/export/csv', () => {
    const csvContent = 'id,name,value\n1,Item 1,100\n2,Item 2,200'
    return new HttpResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="export.csv"',
      },
    })
  }),

  http.post('/api/export/tsv', () => {
    const tsvContent = 'id\tname\tvalue\n1\tItem 1\t100\n2\tItem 2\t200'
    return new HttpResponse(tsvContent, {
      headers: {
        'Content-Type': 'text/tab-separated-values',
        'Content-Disposition': 'attachment; filename="export.tsv"',
      },
    })
  }),

  // Catalog handlers
  http.get('/api/catalogs', () => {
    return HttpResponse.json({ catalogs: ['hive', 'iceberg', 'memory'] })
  }),

  http.get('/api/catalogs/:catalog/schemas', () => {
    return HttpResponse.json({ schemas: ['default', 'public', 'test'] })
  }),

  http.get('/api/catalogs/:catalog/schemas/:schema/tables', () => {
    return HttpResponse.json({ tables: ['users', 'orders', 'products'] })
  }),

  // Dashboard handlers
  http.get('/api/dashboards', () => {
    return HttpResponse.json<Dashboard[]>(mockDashboards)
  }),

  http.get('/api/dashboards/:id', ({ params }) => {
    const dashboard = mockDashboards.find((d) => d.id === params.id)
    if (dashboard) {
      return HttpResponse.json<Dashboard>({
        ...dashboard,
        widgets: mockWidgets.filter((w) => w.dashboard_id === dashboard.id),
      })
    }
    return HttpResponse.json({ error: 'Not found' }, { status: 404 })
  }),

  http.post('/api/dashboards', async ({ request }) => {
    const body = await request.json() as { name: string; description?: string }
    const newDashboard: Dashboard = {
      id: `dashboard-${Date.now()}`,
      user_id: 'user-1',
      name: body.name,
      description: body.description || null,
      layout: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      widgets: [],
    }
    mockDashboards.unshift(newDashboard)
    return HttpResponse.json<Dashboard>(newDashboard)
  }),

  http.put('/api/dashboards/:id', async ({ params, request }) => {
    const body = await request.json() as Partial<Dashboard>
    const dashboard = mockDashboards.find((d) => d.id === params.id)
    if (dashboard) {
      return HttpResponse.json<Dashboard>({ ...dashboard, ...body })
    }
    return HttpResponse.json({ error: 'Not found' }, { status: 404 })
  }),

  http.delete('/api/dashboards/:id', ({ params }) => {
    const dashboard = mockDashboards.find((d) => d.id === params.id)
    if (dashboard) {
      return new HttpResponse(null, { status: 204 })
    }
    return HttpResponse.json({ error: 'Not found' }, { status: 404 })
  }),

  // Widget handlers
  http.post('/api/dashboards/:dashboardId/widgets', async ({ request }) => {
    const body = await request.json() as { name: string; chart_type: string }
    const newWidget: Widget = {
      id: `widget-${Date.now()}`,
      dashboard_id: 'dashboard-1',
      name: body.name,
      query_id: null,
      chart_type: body.chart_type as Widget['chart_type'],
      chart_config: {},
      position: { x: 0, y: 0, w: 6, h: 4 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    return HttpResponse.json<Widget>(newWidget)
  }),

  http.put('/api/dashboards/:dashboardId/widgets/:widgetId', async ({ params, request }) => {
    const body = await request.json() as Partial<Widget>
    const widget = mockWidgets.find((w) => w.id === params.widgetId)
    if (widget) {
      return HttpResponse.json<Widget>({ ...widget, ...body })
    }
    return HttpResponse.json({ error: 'Not found' }, { status: 404 })
  }),

  http.delete('/api/dashboards/:dashboardId/widgets/:widgetId', ({ params }) => {
    const widget = mockWidgets.find((w) => w.id === params.widgetId)
    if (widget) {
      return new HttpResponse(null, { status: 204 })
    }
    return HttpResponse.json({ error: 'Not found' }, { status: 404 })
  }),

  // Layout templates handler
  http.get('/api/layout-templates', () => {
    return HttpResponse.json([])
  }),

  http.post('/api/layout-templates', async ({ request }) => {
    const body = await request.json() as { name: string; description?: string; layout: unknown }
    return HttpResponse.json({
      id: `template-${Date.now()}`,
      name: body.name,
      description: body.description || '',
      layout: body.layout,
      is_system: false,
      created_at: new Date().toISOString(),
    })
  }),

  http.delete('/api/layout-templates/:id', () => {
    return new HttpResponse(null, { status: 204 })
  }),

  // Roles handler (for admin pages)
  http.get('/api/roles', () => {
    return HttpResponse.json([])
  }),

  // Notification channels handler
  http.get('/api/notification-channels', () => {
    return HttpResponse.json([])
  }),

  // Alerts handler
  http.get('/api/alerts', () => {
    return HttpResponse.json([])
  }),

  // Subscriptions handler
  http.get('/api/subscriptions', () => {
    return HttpResponse.json([])
  }),

  // Users handler
  http.get('/api/users', () => {
    return HttpResponse.json([])
  }),
]

export const errorHandlers = {
  loginFailure: http.post('/api/auth/login', () => {
    return HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }),
  registerFailure: http.post('/api/auth/register', () => {
    return HttpResponse.json({ error: 'Email already exists' }, { status: 409 })
  }),
  queryExecutionError: http.post('/api/queries/execute', () => {
    return HttpResponse.json({ error: 'Syntax error' }, { status: 400 })
  }),
  dashboardNotFound: http.get('/api/dashboards/:id', () => {
    return HttpResponse.json({ error: 'Dashboard not found' }, { status: 404 })
  }),
  serverError: http.get('*', () => {
    return HttpResponse.json({ error: 'Internal server error' }, { status: 500 })
  }),
  networkError: http.get('*', () => {
    return HttpResponse.error()
  }),
  googleAuth: http.get('/api/auth/google', () => {
    return HttpResponse.json({ url: 'https://accounts.google.com/oauth/mock' })
  }),
  catalogs: http.get('/api/catalogs', () => HttpResponse.json({ catalogs: ['memory'] })),
  schemas: http.get('/api/catalogs/:catalog/schemas', () => HttpResponse.json({ schemas: ['default'] })),
  tables: http.get('/api/catalogs/:catalog/schemas/:schema/tables', () => HttpResponse.json({ tables: ['sample_table'] })),
  // Token expiry (401) for authenticated endpoints
  tokenExpired: http.get('/api/auth/me', () => {
    return HttpResponse.json({ error: 'Token expired' }, { status: 401 })
  }),
  // Query-related errors
  querySaveError: http.post('/api/queries/saved', () => {
    return HttpResponse.json({ error: 'Failed to save query' }, { status: 500 })
  }),
  queryDeleteError: http.delete('/api/queries/saved/:id', () => {
    return HttpResponse.json({ error: 'Failed to delete query' }, { status: 500 })
  }),
  queryNotFound: http.get('/api/queries/saved/:id', () => {
    return HttpResponse.json({ error: 'Query not found' }, { status: 404 })
  }),
  // Dashboard update/delete errors
  dashboardUpdateError: http.put('/api/dashboards/:id', () => {
    return HttpResponse.json({ error: 'Failed to update dashboard' }, { status: 500 })
  }),
  dashboardDeleteError: http.delete('/api/dashboards/:id', () => {
    return HttpResponse.json({ error: 'Failed to delete dashboard' }, { status: 500 })
  }),
  // Widget errors
  widgetCreateError: http.post('/api/dashboards/:id/widgets', () => {
    return HttpResponse.json({ error: 'Failed to create widget' }, { status: 500 })
  }),
  widgetDeleteError: http.delete('/api/dashboards/:id/widgets/:widgetId', () => {
    return HttpResponse.json({ error: 'Failed to delete widget' }, { status: 500 })
  }),
}

// Empty state handlers for testing empty lists
export const emptyHandlers = {
  emptyQueries: http.get('/api/queries/saved', () => HttpResponse.json([])),
  emptyHistory: http.get('/api/queries/history', () => HttpResponse.json([])),
  emptyDashboards: http.get('/api/dashboards', () => HttpResponse.json([])),
}

// Slow handlers for loading state tests
export const slowHandlers = {
  slowLogin: http.post('/api/auth/login', async () => {
    await new Promise((r) => setTimeout(r, 2000))
    return HttpResponse.json({ token: mockToken, user: mockUser })
  }),
  slowQuery: http.post('/api/queries/execute', async () => {
    await new Promise((r) => setTimeout(r, 2000))
    return HttpResponse.json(mockQueryResult)
  }),
  slowDashboard: http.get('/api/dashboards/:id', async () => {
    await new Promise((r) => setTimeout(r, 2000))
    return HttpResponse.json({ ...mockDashboards[0], widgets: mockWidgets })
  }),
}

// Helper to reset mock data between tests
export function resetMockData() {
  // Reset dashboards
  mockDashboards.length = 1
  mockDashboards[0] = {
    id: 'dashboard-1',
    user_id: 'user-1',
    name: 'Test Dashboard',
    description: 'A test dashboard',
    layout: [{ i: 'widget-1', x: 0, y: 0, w: 6, h: 4 }],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    widgets: [],
    my_permission: 'owner',
  }

  // Reset widgets
  mockWidgets.length = 1
  mockWidgets[0] = {
    id: 'widget-1',
    dashboard_id: 'dashboard-1',
    name: 'Test Widget',
    query_id: 'query-1',
    chart_type: 'bar',
    chart_config: { xAxis: 'name', yAxis: 'value' },
    position: { x: 0, y: 0, w: 6, h: 4 },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  }

  // Reset saved queries
  mockSavedQueries.length = 2
  mockSavedQueries[0] = {
    id: 'query-1',
    user_id: 'user-1',
    name: 'Test Query 1',
    description: 'A test query',
    query_text: 'SELECT 1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  }
  mockSavedQueries[1] = {
    id: 'query-2',
    user_id: 'user-1',
    name: 'Test Query 2',
    description: null,
    query_text: 'SELECT 2',
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
  }
}
