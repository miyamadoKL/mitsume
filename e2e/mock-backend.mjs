import http from 'node:http'
import { randomUUID } from 'node:crypto'

function nowIso() {
  return new Date().toISOString()
}

function json(res, status, body, headers = {}) {
  const payload = body === undefined ? '' : JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  })
  res.end(payload)
}

function text(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  })
  res.end(body || '')
}

async function readJsonBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function withCorsHeaders(req, res) {
  const origin = req.headers.origin || '*'
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
}

function notFound(req, res) {
  json(res, 404, { error: `Not found: ${req.method} ${req.url}` })
}

function unauthorized(res) {
  json(res, 401, { error: 'Unauthorized' })
}

function cloneDeep(value) {
  return value ? JSON.parse(JSON.stringify(value)) : value
}

export function createDefaultMockStore() {
  const userId = '00000000-0000-0000-0000-000000000001'
  const originalDashboardId = '11111111-1111-1111-1111-111111111111'

  const widgetAId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  const widgetBId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

  const base = {
    id: originalDashboardId,
    user_id: userId,
    name: 'E2E Dashboard',
    description: 'Mock dashboard for headless tests',
    layout: [],
    is_public: false,
    parameters: [],
    is_draft: false,
    draft_of: null,
    created_at: nowIso(),
    updated_at: nowIso(),
    my_permission: 'owner',
    widgets: [
      {
        id: widgetAId,
        dashboard_id: originalDashboardId,
        name: 'Widget A',
        query_id: null,
        chart_type: 'bar',
        chart_config: {},
        position: { x: 0, y: 0, w: 4, h: 2 },
        responsive_positions: {
          sm: { x: 0, y: 0, w: 3, h: 2 },
          xs: { x: 0, y: 0, w: 2, h: 2 },
        },
        created_at: nowIso(),
        updated_at: nowIso(),
      },
      {
        id: widgetBId,
        dashboard_id: originalDashboardId,
        name: 'Widget B',
        query_id: null,
        chart_type: 'bar',
        chart_config: {},
        position: { x: 4, y: 0, w: 4, h: 2 },
        responsive_positions: {
          sm: { x: 3, y: 0, w: 3, h: 2 },
          xs: { x: 2, y: 0, w: 2, h: 2 },
        },
        created_at: nowIso(),
        updated_at: nowIso(),
      },
    ],
  }

  const dashboards = new Map()
  dashboards.set(originalDashboardId, base)

  return {
    userId,
    originalDashboardId,
    dashboards, // id -> dashboard
    draftByOriginal: new Map(), // originalId -> draftId
  }
}

function findDraftId(store, originalId) {
  return store.draftByOriginal.get(originalId) || null
}

function requireAuth(req, res) {
  const auth = req.headers.authorization || ''
  if (!auth.startsWith('Bearer ')) {
    unauthorized(res)
    return false
  }
  return true
}

function parsePath(url) {
  const u = new URL(url, 'http://127.0.0.1')
  const pathname = u.pathname.replace(/\/+$/, '') || '/'
  return { pathname, searchParams: u.searchParams }
}

function match(pathname, pattern) {
  const p1 = pathname.split('/').filter(Boolean)
  const p2 = pattern.split('/').filter(Boolean)
  if (p1.length !== p2.length) return null
  const params = {}
  for (let i = 0; i < p1.length; i += 1) {
    const a = p1[i]
    const b = p2[i]
    if (b.startsWith(':')) params[b.slice(1)] = a
    else if (a !== b) return null
  }
  return params
}

function listDashboards(store) {
  const out = []
  for (const d of store.dashboards.values()) {
    if (d.is_draft) continue
    out.push(d)
  }
  return out
}

function getDashboard(store, id) {
  return store.dashboards.get(id) || null
}

function createDraft(store, originalId) {
  const original = getDashboard(store, originalId)
  if (!original || original.is_draft) return null

  const existingId = findDraftId(store, originalId)
  if (existingId) {
    const existing = getDashboard(store, existingId)
    return existing ? cloneDeep(existing) : null
  }

  const draftId = randomUUID()
  const createdAt = nowIso()
  const draft = cloneDeep({
    ...original,
    id: draftId,
    is_public: false,
    is_draft: true,
    draft_of: originalId,
    created_at: createdAt,
    updated_at: createdAt,
    widgets: (original.widgets || []).map(w => ({
      ...w,
      id: randomUUID(),
      dashboard_id: draftId,
      created_at: createdAt,
      updated_at: createdAt,
    })),
  })

  store.dashboards.set(draftId, draft)
  store.draftByOriginal.set(originalId, draftId)
  return cloneDeep(draft)
}

function discardDraft(store, draftId) {
  const draft = getDashboard(store, draftId)
  if (!draft || !draft.is_draft || !draft.draft_of) return false
  store.dashboards.delete(draftId)
  const originalId = String(draft.draft_of)
  if (store.draftByOriginal.get(originalId) === draftId) {
    store.draftByOriginal.delete(originalId)
  }
  return true
}

function publishDraft(store, draftId) {
  const draft = getDashboard(store, draftId)
  if (!draft || !draft.is_draft || !draft.draft_of) return null
  const originalId = String(draft.draft_of)
  const original = getDashboard(store, originalId)
  if (!original || original.is_draft) return null

  const updatedAt = nowIso()
  const nextOriginal = cloneDeep({
    ...original,
    name: draft.name,
    description: draft.description,
    layout: draft.layout || [],
    parameters: draft.parameters || [],
    updated_at: updatedAt,
    widgets: (draft.widgets || []).map(w => ({
      ...w,
      id: randomUUID(),
      dashboard_id: originalId,
      created_at: updatedAt,
      updated_at: updatedAt,
    })),
  })

  store.dashboards.set(originalId, nextOriginal)
  discardDraft(store, draftId)
  return cloneDeep(nextOriginal)
}

function applyBatch(store, dashboardId, req) {
  const d = getDashboard(store, dashboardId)
  if (!d) return { ok: false, error: 'dashboard not found' }
  if (!d.is_draft) return { ok: false, error: 'not a draft dashboard' }

  const updatedAt = nowIso()
  const next = cloneDeep(d)
  next.updated_at = updatedAt
  next.widgets = next.widgets || []

  const created = []
  const updated = []
  const deleted = []

  // Delete
  if (Array.isArray(req?.delete)) {
    const toDelete = new Set(req.delete)
    next.widgets = next.widgets.filter(w => {
      if (toDelete.has(w.id)) {
        deleted.push(w.id)
        return false
      }
      return true
    })
  }

  // Update
  const updates = req?.update && typeof req.update === 'object' ? req.update : {}
  for (const [widgetId, patch] of Object.entries(updates)) {
    const idx = next.widgets.findIndex(w => w.id === widgetId)
    if (idx === -1) continue
    const prev = next.widgets[idx]
    const nextWidget = {
      ...prev,
      ...cloneDeep(patch),
      query_id: 'query_id' in patch ? (patch.query_id ?? null) : prev.query_id,
      updated_at: updatedAt,
    }
    if (patch?.responsive_positions) {
      nextWidget.responsive_positions = {
        ...(prev.responsive_positions || {}),
        ...(cloneDeep(patch.responsive_positions) || {}),
      }
    }
    next.widgets[idx] = nextWidget
    updated.push(nextWidget)
  }

  // Create
  if (Array.isArray(req?.create)) {
    for (const c of req.create) {
      const id = randomUUID()
      const widget = {
        id,
        dashboard_id: dashboardId,
        name: String(c?.name || 'Untitled'),
        query_id: c?.query_id ?? null,
        chart_type: c?.chart_type || 'bar',
        chart_config: c?.chart_config || {},
        position: c?.position || { x: 0, y: 0, w: 6, h: 3 },
        responsive_positions: c?.responsive_positions || undefined,
        created_at: updatedAt,
        updated_at: updatedAt,
      }
      next.widgets.push(widget)
      created.push(widget)
    }
  }

  store.dashboards.set(dashboardId, next)
  return { ok: true, created, updated, deleted, dashboard: cloneDeep(next) }
}

export async function startMockBackend({ port = 8080, store = createDefaultMockStore(), quiet = false } = {}) {
  const server = http.createServer(async (req, res) => {
    withCorsHeaders(req, res)
    if (req.method === 'OPTIONS') return text(res, 204, '')

    const { pathname } = parsePath(req.url || '/')

    // Health
    if (pathname === '/health' && req.method === 'GET') {
      return json(res, 200, { ok: true })
    }

    // Everything below /api requires auth to mimic real app behavior.
    if (pathname.startsWith('/api') && !requireAuth(req, res)) return

    // Auth
    if (pathname === '/api/auth/me' && req.method === 'GET') {
      const ts = nowIso()
      return json(res, 200, {
        id: store.userId,
        email: 'e2e@example.com',
        name: 'E2E User',
        auth_provider: 'mock',
        created_at: ts,
        updated_at: ts,
      })
    }

    // Queries
    if (pathname === '/api/queries/saved' && req.method === 'GET') {
      return json(res, 200, [])
    }

    // Layout templates
    if (pathname === '/api/layout-templates' && req.method === 'GET') {
      return json(res, 200, [])
    }

    // Dashboards list
    if (pathname === '/api/dashboards' && req.method === 'GET') {
      return json(res, 200, cloneDeep(listDashboards(store)))
    }

    // GET /api/dashboards/:id/draft (original -> draft)
    {
      const params = match(pathname, '/api/dashboards/:id/draft')
      if (params && req.method === 'GET') {
        const originalId = params.id
        const draftId = findDraftId(store, originalId)
        if (!draftId) return json(res, 404, { error: 'draft not found' })
        const draft = getDashboard(store, draftId)
        if (!draft) return json(res, 404, { error: 'draft not found' })
        return json(res, 200, cloneDeep(draft))
      }
      if (params && req.method === 'POST') {
        const originalId = params.id
        const draft = createDraft(store, originalId)
        if (!draft) return json(res, 404, { error: 'original dashboard not found' })
        return json(res, 201, cloneDeep(draft))
      }
    }

    // POST /api/dashboards/:id/save-draft (draft id)
    {
      const params = match(pathname, '/api/dashboards/:id/save-draft')
      if (params && req.method === 'POST') {
        const draft = getDashboard(store, params.id)
        if (!draft) return json(res, 404, { error: 'draft not found' })
        if (!draft.is_draft) return json(res, 400, { error: 'not a draft' })
        const updated = cloneDeep({ ...draft, updated_at: nowIso() })
        store.dashboards.set(params.id, updated)
        return json(res, 200, cloneDeep(updated))
      }
    }

    // POST /api/dashboards/:id/publish (draft id)
    {
      const params = match(pathname, '/api/dashboards/:id/publish')
      if (params && req.method === 'POST') {
        const published = publishDraft(store, params.id)
        if (!published) return json(res, 400, { error: 'publish failed' })
        return json(res, 200, cloneDeep(published))
      }
    }

    // DELETE /api/dashboards/:id/discard-draft (draft id)
    {
      const params = match(pathname, '/api/dashboards/:id/discard-draft')
      if (params && req.method === 'DELETE') {
        const ok = discardDraft(store, params.id)
        if (!ok) return json(res, 404, { error: 'draft not found' })
        return text(res, 204, '')
      }
    }

    // POST /api/dashboards/:id/widgets/batch (draft id)
    {
      const params = match(pathname, '/api/dashboards/:id/widgets/batch')
      if (params && req.method === 'POST') {
        const body = await readJsonBody(req)
        const resu = applyBatch(store, params.id, body || {})
        if (!resu.ok) return json(res, 400, { error: resu.error })
        return json(res, 200, { created: resu.created, updated: resu.updated, deleted: resu.deleted })
      }
    }

    // GET /api/dashboards/:id
    {
      const params = match(pathname, '/api/dashboards/:id')
      if (params && req.method === 'GET') {
        const d = getDashboard(store, params.id)
        if (!d) return json(res, 404, { error: 'not found' })
        return json(res, 200, cloneDeep(d))
      }
    }

    if (!quiet) {
      // eslint-disable-next-line no-console
      console.warn(`mock-backend: unhandled ${req.method} ${pathname}`)
    }
    return notFound(req, res)
  })

  await new Promise((resolve, reject) => {
    server.on('error', reject)
    server.listen(port, '127.0.0.1', () => resolve())
  })

  const baseUrl = `http://127.0.0.1:${port}`
  return {
    server,
    baseUrl,
    store,
    close: async () => {
      await new Promise((resolve) => server.close(() => resolve()))
    },
  }
}

function responseJson(status, body, headers = {}) {
  return {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
    body: body === undefined ? '' : JSON.stringify(body),
  }
}

function responseText(status, body, headers = {}) {
  return {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
    body: body || '',
  }
}

export async function handleMockApiRequest({ store, method, url, headers, body }) {
  const { pathname } = parsePath(url || '/')

  if (method === 'OPTIONS') return responseText(204, '')

  if (!pathname.startsWith('/api')) return responseJson(404, { error: `Not an API path: ${pathname}` })

  const authHeader = headers?.authorization || headers?.Authorization || ''
  if (!String(authHeader).startsWith('Bearer ')) return responseJson(401, { error: 'Unauthorized' })

  // Auth
  if (pathname === '/api/auth/me' && method === 'GET') {
    const ts = nowIso()
    return responseJson(200, {
      id: store.userId,
      email: 'e2e@example.com',
      name: 'E2E User',
      auth_provider: 'mock',
      created_at: ts,
      updated_at: ts,
    })
  }

  // Queries
  if (pathname === '/api/queries/saved' && method === 'GET') {
    return responseJson(200, [])
  }

  // Layout templates
  if (pathname === '/api/layout-templates' && method === 'GET') {
    return responseJson(200, [])
  }

  // Dashboards list
  if (pathname === '/api/dashboards' && method === 'GET') {
    return responseJson(200, cloneDeep(listDashboards(store)))
  }

  // GET/POST /api/dashboards/:id/draft (original -> draft)
  {
    const params = match(pathname, '/api/dashboards/:id/draft')
    if (params && method === 'GET') {
      const draftId = findDraftId(store, params.id)
      if (!draftId) return responseJson(404, { error: 'draft not found' })
      const draft = getDashboard(store, draftId)
      if (!draft) return responseJson(404, { error: 'draft not found' })
      return responseJson(200, cloneDeep(draft))
    }
    if (params && method === 'POST') {
      const draft = createDraft(store, params.id)
      if (!draft) return responseJson(404, { error: 'original dashboard not found' })
      return responseJson(201, cloneDeep(draft))
    }
  }

  // POST /api/dashboards/:id/save-draft (draft id)
  {
    const params = match(pathname, '/api/dashboards/:id/save-draft')
    if (params && method === 'POST') {
      const draft = getDashboard(store, params.id)
      if (!draft) return responseJson(404, { error: 'draft not found' })
      if (!draft.is_draft) return responseJson(400, { error: 'not a draft' })
      const updated = cloneDeep({ ...draft, updated_at: nowIso() })
      store.dashboards.set(params.id, updated)
      return responseJson(200, cloneDeep(updated))
    }
  }

  // POST /api/dashboards/:id/publish (draft id)
  {
    const params = match(pathname, '/api/dashboards/:id/publish')
    if (params && method === 'POST') {
      const published = publishDraft(store, params.id)
      if (!published) return responseJson(400, { error: 'publish failed' })
      return responseJson(200, cloneDeep(published))
    }
  }

  // DELETE /api/dashboards/:id/discard-draft (draft id)
  {
    const params = match(pathname, '/api/dashboards/:id/discard-draft')
    if (params && method === 'DELETE') {
      const ok = discardDraft(store, params.id)
      if (!ok) return responseJson(404, { error: 'draft not found' })
      return responseText(204, '')
    }
  }

  // POST /api/dashboards/:id/widgets/batch (draft id)
  {
    const params = match(pathname, '/api/dashboards/:id/widgets/batch')
    if (params && method === 'POST') {
      const parsed = (() => {
        try { return body ? JSON.parse(body) : {} } catch { return {} }
      })()
      const resu = applyBatch(store, params.id, parsed)
      if (!resu.ok) return responseJson(400, { error: resu.error })
      return responseJson(200, { created: resu.created, updated: resu.updated, deleted: resu.deleted })
    }
  }

  // GET /api/dashboards/:id
  {
    const params = match(pathname, '/api/dashboards/:id')
    if (params && method === 'GET') {
      const d = getDashboard(store, params.id)
      if (!d) return responseJson(404, { error: 'not found' })
      return responseJson(200, cloneDeep(d))
    }
  }

  return responseJson(404, { error: `Not found: ${method} ${pathname}` })
}
