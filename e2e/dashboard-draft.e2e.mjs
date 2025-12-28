import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createDefaultMockStore, handleMockApiRequest } from './mock-backend.mjs'

function normalizeBaseUrl(rawUrl) {
  const u = new URL(rawUrl)
  u.hash = ''
  u.search = ''
  u.pathname = u.pathname.replace(/\/+$/, '/')
  const normalized = u.toString()
  return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized
}

async function delay(ms) {
  await new Promise(resolve => setTimeout(resolve, ms))
}

function launchChrome({ outDir }) {
  const userDataDir = path.join(outDir, 'chrome-profile')
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-background-networking',
    '--disable-sync',
    '--disable-default-apps',
    '--disable-extensions',
    '--remote-debugging-address=127.0.0.1',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    '--window-size=1440,900',
    '--lang=en-US',
    'about:blank',
  ]

  const proc = spawn('google-chrome', args, { stdio: ['ignore', 'ignore', 'pipe'] })
  return { proc }
}

async function waitForDevtoolsEndpoint(proc, { timeoutMs = 30_000 } = {}) {
  const deadline = Date.now() + timeoutMs
  let buffer = ''
  let wsUrl = null

  proc.stderr.setEncoding('utf8')
  proc.stderr.on('data', (chunk) => {
    buffer += chunk
    const line = buffer.split('\n').find(l => l.includes('DevTools listening on'))
    if (!line) return
    const match = line.match(/DevTools listening on (ws:\/\/[^\s]+)/)
    if (match) wsUrl = match[1]
  })

  while (Date.now() < deadline) {
    if (wsUrl) return wsUrl
    await delay(100)
  }
  throw new Error('Timed out waiting for Chrome DevTools endpoint')
}

async function fetchJson(url, { method = 'GET', headers, body } = {}) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  if (!res.ok) {
    const msg = (json && typeof json === 'object' && json && 'error' in json && json.error) || text || `${res.status}`
    throw new Error(`${method} ${url} failed: ${msg}`)
  }
  return json
}

async function createTarget({ port, url }) {
  const newUrl = `http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`
  const res = await fetchJson(newUrl, { method: 'PUT' })
  if (!res.webSocketDebuggerUrl) throw new Error('Failed to create target')
  return res
}

function portFromWsUrl(wsUrl) {
  const u = new URL(wsUrl)
  return Number(u.port)
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl
    this.ws = null
    this.nextId = 1
    this.pending = new Map()
    this.listeners = new Map()
  }

  async connect() {
    const ws = new WebSocket(this.wsUrl)
    this.ws = ws

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.id) {
        const entry = this.pending.get(msg.id)
        if (!entry) return
        this.pending.delete(msg.id)
        if (msg.error) {
          entry.reject(new Error(msg.error.message || 'CDP error'))
        } else {
          entry.resolve(msg.result)
        }
        return
      }
      if (msg.method) {
        const handlers = this.listeners.get(msg.method)
        if (handlers) for (const h of handlers) h(msg.params)
      }
    }

    await new Promise((resolve, reject) => {
      ws.onopen = () => resolve()
      ws.onerror = (err) => reject(err)
    })
  }

  on(method, handler) {
    const list = this.listeners.get(method) || []
    list.push(handler)
    this.listeners.set(method, list)
  }

  async send(method, params, { timeoutMs = 30_000 } = {}) {
    if (!this.ws) throw new Error('WebSocket not connected')
    const id = this.nextId++
    this.ws.send(JSON.stringify({ id, method, params: params || {} }))

    return await new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`CDP timeout: ${method}`))
      }, timeoutMs)

      this.pending.set(id, {
        resolve: (res) => {
          clearTimeout(t)
          resolve(res)
        },
        reject: (err) => {
          clearTimeout(t)
          reject(err)
        },
      })
    })
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    })
    if (res.exceptionDetails) throw new Error('Runtime.evaluate exception')
    return res.result?.value
  }

  async close() {
    if (!this.ws) return
    this.ws.close()
    this.ws = null
  }
}

async function waitFor(client, fnExpression, { timeoutMs = 60_000, intervalMs = 250, label = 'condition' } = {}) {
  const deadline = Date.now() + timeoutMs
  let lastErr = null
  while (Date.now() < deadline) {
    try {
      const ok = await client.evaluate(fnExpression)
      if (ok) return
    } catch (err) {
      lastErr = err
    }
    await delay(intervalMs)
  }
  if (lastErr) throw lastErr
  throw new Error(`Timed out waiting for ${label}`)
}

async function screenshot(client, filePath) {
  const res = await client.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
  })
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, Buffer.from(res.data, 'base64'))
}

function headersToCdpArray(headers) {
  return Object.entries(headers || {}).map(([name, value]) => ({ name, value: String(value) }))
}

function mimeTypeForPath(p) {
  if (p.endsWith('.html')) return 'text/html; charset=utf-8'
  if (p.endsWith('.js') || p.endsWith('.mjs')) return 'application/javascript; charset=utf-8'
  if (p.endsWith('.css')) return 'text/css; charset=utf-8'
  if (p.endsWith('.svg')) return 'image/svg+xml'
  if (p.endsWith('.png')) return 'image/png'
  if (p.endsWith('.json')) return 'application/json; charset=utf-8'
  if (p.endsWith('.woff2')) return 'font/woff2'
  if (p.endsWith('.woff')) return 'font/woff'
  return 'application/octet-stream'
}

function isProbablyStaticAsset(pathname) {
  return pathname.includes('.') || pathname.startsWith('/assets/') || pathname === '/vite.svg'
}

function safeJoin(rootDir, pathname) {
  const safePath = pathname.replace(/\\/g, '/')
  const rel = safePath.startsWith('/') ? safePath.slice(1) : safePath
  const full = path.join(rootDir, rel)
  const normalizedRoot = path.resolve(rootDir) + path.sep
  const normalizedFull = path.resolve(full)
  if (!normalizedFull.startsWith(normalizedRoot)) {
    throw new Error('Path traversal blocked')
  }
  return normalizedFull
}

async function ensureFrontendBuild({ outDir }) {
  const distDir = path.join(process.cwd(), 'frontend', 'dist')

  const buildProc = spawn('npm', ['run', 'build'], {
    cwd: path.join(process.cwd(), 'frontend'),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  })

  buildProc.stdout.setEncoding('utf8')
  buildProc.stderr.setEncoding('utf8')
  const logPath = path.join(outDir, 'frontend-build.log')
  const write = async (chunk) => {
    try { await fs.appendFile(logPath, chunk) } catch {}
  }
  buildProc.stdout.on('data', write)
  buildProc.stderr.on('data', write)

  const code = await new Promise((resolve) => buildProc.on('close', resolve))
  if (code !== 0) {
    throw new Error(`frontend build failed (exit ${code}); see ${logPath}`)
  }
  await fs.stat(path.join(distDir, 'index.html'))
  return distDir
}

async function dispatchDrag(client, { start, end, steps = 12 }) {
  await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: start.x, y: start.y, buttons: 0 })
  await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: start.x, y: start.y, button: 'left', buttons: 1, clickCount: 1 })
  for (let i = 1; i <= steps; i += 1) {
    const x = start.x + (end.x - start.x) * (i / steps)
    const y = start.y + (end.y - start.y) * (i / steps)
    await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 1 })
    await delay(16)
  }
  await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: end.x, y: end.y, button: 'left', buttons: 0, clickCount: 1 })
  await delay(250)
}

async function clickButtonByText(client, text, { exact = true } = {}) {
  const wants = Array.isArray(text) ? text : [text]
  const expr = `(function(){
    const norm = (s) => (s || '').replace(/\\s+/g,' ').trim();
    const wants = ${JSON.stringify(wants)};
    const buttons = Array.from(document.querySelectorAll('button')).filter(b => {
      const r = b.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    const btn = buttons.find(b => {
      const t = norm(b.textContent);
      return wants.some(want => ${exact ? 't === want' : 't.includes(want)'});
    });
    if (!btn) return { ok:false };
    btn.scrollIntoView({ block: 'center', inline: 'center' });
    btn.click();
    return { ok:true };
  })()`
  const res = await client.evaluate(expr)
  if (!res?.ok) throw new Error(`Button not found: ${wants.join(' | ')}`)
}

async function clickButtonByTitle(client, title) {
  const titles = Array.isArray(title) ? title : [title]
  const expr = `(function(){
    const titles = ${JSON.stringify(titles)};
    const btn = titles.map(t => document.querySelector('button[title="' + CSS.escape(t) + '"]')).find(Boolean);
    if (!btn) return { ok:false };
    const r = btn.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) return { ok:false };
    btn.scrollIntoView({ block: 'center', inline: 'center' });
    btn.click();
    return { ok:true };
  })()`
  const res = await client.evaluate(expr)
  if (!res?.ok) throw new Error(`Button not found: [title="${titles.join('"|title="')}"]`)
}

async function waitForDialogOpen(client, dialogTitle, timeoutMs = 30_000) {
  const titles = Array.isArray(dialogTitle) ? dialogTitle : [dialogTitle]
  const expr = `(function(){
    const norm = (s) => (s || '').replace(/\\s+/g,' ').trim();
    const titles = ${JSON.stringify(titles)};
    const titleEl = Array.from(document.querySelectorAll('.max-w-lg h2'))
      .find(el => titles.includes(norm(el.textContent)));
    return !!titleEl;
  })()`
  await waitFor(client, expr, { timeoutMs, label: `dialog open: ${titles.join(' | ')}` })
}

async function waitForDialogClosed(client, dialogTitle, timeoutMs = 30_000) {
  const titles = Array.isArray(dialogTitle) ? dialogTitle : [dialogTitle]
  const expr = `(function(){
    const norm = (s) => (s || '').replace(/\\s+/g,' ').trim();
    const titles = ${JSON.stringify(titles)};
    const titleEl = Array.from(document.querySelectorAll('.max-w-lg h2'))
      .find(el => titles.includes(norm(el.textContent)));
    return !titleEl;
  })()`
  await waitFor(client, expr, { timeoutMs, label: `dialog closed: ${titles.join(' | ')}` })
}

async function setInputValueInDialog(client, dialogTitle, { placeholder, value }) {
  const titles = Array.isArray(dialogTitle) ? dialogTitle : [dialogTitle]
  const placeholders = Array.isArray(placeholder) ? placeholder : [placeholder]
  const expr = `(function(){
    const norm = (s) => (s || '').replace(/\\s+/g,' ').trim();
    const titles = ${JSON.stringify(titles)};
    const placeholders = ${JSON.stringify(placeholders)};
    const titleEl = Array.from(document.querySelectorAll('.max-w-lg h2'))
      .find(el => titles.includes(norm(el.textContent)));
    if (!titleEl) return { ok:false, error:'dialog not found' };
    const root = titleEl.closest('.max-w-lg');
    const input = placeholders.map(p => root.querySelector('input[placeholder="' + CSS.escape(p) + '"]')).find(Boolean);
    if (!input) return { ok:false, error:'input not found' };
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (!nativeSetter) return { ok:false, error:'native setter missing' };
    input.focus();
    nativeSetter.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok:true };
  })()`
  const res = await client.evaluate(expr)
  if (!res?.ok) throw new Error(`Failed to set input in dialog "${titles.join(' | ')}": ${res?.error || 'unknown'}`)
}

async function waitForButtonInDialogEnabled(client, dialogTitle, text, timeoutMs = 30_000) {
  const titles = Array.isArray(dialogTitle) ? dialogTitle : [dialogTitle]
  const wants = Array.isArray(text) ? text : [text]
  const expr = `(function(){
    const norm = (s) => (s || '').replace(/\\s+/g,' ').trim();
    const titles = ${JSON.stringify(titles)};
    const wants = ${JSON.stringify(wants)};
    const titleEl = Array.from(document.querySelectorAll('.max-w-lg h2'))
      .find(el => titles.includes(norm(el.textContent)));
    if (!titleEl) return false;
    const root = titleEl.closest('.max-w-lg');
    const buttons = Array.from(root.querySelectorAll('button'))
      .filter(b => {
        const r = b.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
    const btn = buttons.find(b => wants.includes(norm(b.textContent)));
    if (!btn) return false;
    return !btn.disabled;
  })()`
  await waitFor(client, expr, { timeoutMs, label: `dialog button enabled: ${titles.join(' | ')} / ${wants.join(' | ')}` })
}

async function clickButtonInDialog(client, dialogTitle, text, { exact = true } = {}) {
  const titles = Array.isArray(dialogTitle) ? dialogTitle : [dialogTitle]
  const wants = Array.isArray(text) ? text : [text]
  const expr = `(function(){
    const norm = (s) => (s || '').replace(/\\s+/g,' ').trim();
    const titles = ${JSON.stringify(titles)};
    const wants = ${JSON.stringify(wants)};
    const titleEl = Array.from(document.querySelectorAll('.max-w-lg h2'))
      .find(el => titles.includes(norm(el.textContent)));
    if (!titleEl) return { ok:false, error:'dialog not found' };
    const root = titleEl.closest('.max-w-lg');
    const buttons = Array.from(root.querySelectorAll('button'))
      .filter(b => {
        const r = b.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
    const btn = buttons.find(b => {
      const t = norm(b.textContent);
      return wants.some(want => ${exact ? 't === want' : 't.includes(want)'});
    });
    if (!btn) return { ok:false, error:'button not found' };
    btn.scrollIntoView({ block: 'center', inline: 'center' });
    btn.click();
    return { ok:true };
  })()`
  const res = await client.evaluate(expr)
  if (!res?.ok) throw new Error(`Button not found in dialog "${titles.join(' | ')}": ${wants.join(' | ')}`)
}

async function waitForWidgetTitle(client, widgetTitle, timeoutMs = 30_000) {
  const expr = `(function(){
    const norm = (s) => (s || '').replace(/\\s+/g,' ').trim();
    const title = ${JSON.stringify(widgetTitle)};
    return Array.from(document.querySelectorAll('.drag-handle'))
      .some(h => norm(h.textContent) === title);
  })()`
  await waitFor(client, expr, { timeoutMs, label: `widget visible: ${widgetTitle}` })
}

async function waitForWidgetAbsent(client, widgetTitle, timeoutMs = 30_000) {
  const expr = `(function(){
    const norm = (s) => (s || '').replace(/\\s+/g,' ').trim();
    const title = ${JSON.stringify(widgetTitle)};
    return !Array.from(document.querySelectorAll('.drag-handle'))
      .some(h => norm(h.textContent) === title);
  })()`
  await waitFor(client, expr, { timeoutMs, label: `widget absent: ${widgetTitle}` })
}

async function getWidgetLayout(client, widgetTitle) {
  const expr = `(function(){
    const norm = (s) => (s || '').replace(/\\s+/g,' ').trim();
    const title = ${JSON.stringify(widgetTitle)};
    const handle = Array.from(document.querySelectorAll('.drag-handle'))
      .find(h => norm(h.textContent) === title);
    if (!handle) return { ok:false, error:'handle not found' };
    const item = handle.closest('.react-grid-item');
    const grid = item?.closest('.react-grid-layout') || document.querySelector('.react-grid-layout');
    if (!item || !grid) return { ok:false, error:'grid item not found' };
    item.scrollIntoView({ block: 'center', inline: 'center' });
    const ir = item.getBoundingClientRect();
    const gr = grid.getBoundingClientRect();
    const hr = handle.getBoundingClientRect();
    return {
      ok:true,
      item: { left: ir.left - gr.left, top: ir.top - gr.top, width: ir.width, height: ir.height },
      handleCenter: { x: hr.left + hr.width / 2, y: hr.top + hr.height / 2 },
    };
  })()`
  const res = await client.evaluate(expr)
  if (!res?.ok) throw new Error(`Failed to get widget layout for ${widgetTitle}: ${res?.error || 'unknown'}`)
  return res
}

async function clickDeleteOnWidget(client, widgetTitle) {
  const expr = `(function(){
    const norm = (s) => (s || '').replace(/\\s+/g,' ').trim();
    const title = ${JSON.stringify(widgetTitle)};
    const handle = Array.from(document.querySelectorAll('.drag-handle'))
      .find(h => norm(h.textContent) === title);
    if (!handle) return { ok:false, error:'handle not found' };
    const item = handle.closest('.react-grid-item');
    if (!item) return { ok:false, error:'item not found' };
    const titles = ["Delete","削除"];
    const btn = titles.map(t => item.querySelector('button[title="' + CSS.escape(t) + '"]')).find(Boolean);
    if (!btn) return { ok:false, error:'delete button not found' };
    btn.scrollIntoView({ block: 'center', inline: 'center' });
    btn.click();
    return { ok:true };
  })()`
  const res = await client.evaluate(expr)
  if (!res?.ok) throw new Error(`Failed to delete widget "${widgetTitle}": ${res?.error || 'unknown'}`)
}

function assertMoved(before, after, { axis = 'left', minDelta = 5, label = 'position' } = {}) {
  const d = Math.abs(after.item[axis] - before.item[axis])
  if (!(d >= minDelta)) {
    throw new Error(`${label} did not change enough (Δ${axis}=${d.toFixed(1)}px)`)
  }
}

function assertMovedAnyAxis(before, after, { minDelta = 5, label = 'position' } = {}) {
  const dx = Math.abs(after.item.left - before.item.left)
  const dy = Math.abs(after.item.top - before.item.top)
  if (dx < minDelta && dy < minDelta) {
    throw new Error(`${label} did not change enough (Δleft=${dx.toFixed(1)}px, Δtop=${dy.toFixed(1)}px)`)
  }
}

function assertApproxEqual(a, b, { tolerance = 10, label = 'value' } = {}) {
  const d = Math.abs(a - b)
  if (d > tolerance) throw new Error(`${label} mismatch: expected ~${a.toFixed(1)}, got ${b.toFixed(1)} (Δ=${d.toFixed(1)} > ${tolerance})`)
}

async function getCurrentBreakpointLabel(client) {
  const label = await client.evaluate(`(function(){
    try {
      const text = (document.body && (document.body.innerText || document.body.textContent) || '');
      const m = text.match(/\\((LG|MD|SM|XS)\\)/);
      return m ? m[1] : null;
    } catch {
      return null;
    }
  })()`)
  return label
}

const GRID_COLS_BY_BP = { LG: 12, MD: 10, SM: 6, XS: 4 }
const GRID_ROW_HEIGHT_PX = 80
const GRID_MARGIN_X_PX = 10
const GRID_MARGIN_Y_PX = 10

async function getWidgetGridPosition(client, widgetTitle) {
  const bp = await getCurrentBreakpointLabel(client)
  if (!bp || !(bp in GRID_COLS_BY_BP)) throw new Error(`Unknown breakpoint: ${bp || 'null'}`)
  const cols = GRID_COLS_BY_BP[bp]

  const grid = await getGridRect(client)
  const layout = await getWidgetLayout(client, widgetTitle)

  // Approximate react-grid-layout: containerPadding [0,0], margin [10,10], rowHeight 80.
  // colWidth = (gridWidth - marginX*(cols-1)) / cols
  // left = x*(colWidth + marginX)
  // top = y*(rowHeight + marginY)
  const colWidth = (grid.width - GRID_MARGIN_X_PX * (cols - 1)) / cols
  const stepX = colWidth + GRID_MARGIN_X_PX
  const stepY = GRID_ROW_HEIGHT_PX + GRID_MARGIN_Y_PX
  const x = Math.round(layout.item.left / stepX)
  const y = Math.round(layout.item.top / stepY)

  return {
    breakpoint: bp,
    cols,
    gridWidth: grid.width,
    gridHeight: grid.height,
    colWidth,
    stepX,
    stepY,
    leftPx: layout.item.left,
    topPx: layout.item.top,
    x,
    y,
  }
}

async function waitForWidgetGridXY(client, widgetTitle, expected, { timeoutMs = 15_000, label = 'grid position' } = {}) {
  const deadline = Date.now() + timeoutMs
  let last = null
  while (Date.now() < deadline) {
    const pos = await getWidgetGridPosition(client, widgetTitle).catch(() => null)
    if (pos) {
      last = pos
      if (pos.x === expected.x && pos.y === expected.y) return pos
    }
    await delay(250)
  }
  const got = last ? `x=${last.x},y=${last.y},bp=${last.breakpoint},left=${last.leftPx.toFixed(1)},top=${last.topPx.toFixed(1)},gridW=${last.gridWidth.toFixed(1)}` : 'null'
  throw new Error(`${label} mismatch: expected x=${expected.x},y=${expected.y}; got ${got}`)
}

async function waitForGridWidthAtMost(client, maxWidthPx, { timeoutMs = 30_000, label } = {}) {
  const expr = `(function(){
    const grid = document.querySelector('.react-grid-layout');
    if (!grid) return false;
    const w = grid.getBoundingClientRect().width;
    return w > 0 && w <= ${JSON.stringify(maxWidthPx)};
  })()`
  await waitFor(client, expr, { timeoutMs, label: label || `grid width <= ${maxWidthPx}px` })
}

async function waitForWidgetLeftApprox(client, widgetTitle, expectedLeft, { tolerance = 12, timeoutMs = 15_000, label = 'widget left' } = {}) {
  const expr = `(function(){
    const norm = (s) => (s || '').replace(/\\s+/g,' ').trim();
    const title = ${JSON.stringify(widgetTitle)};
    const expected = ${JSON.stringify(expectedLeft)};
    const tol = ${JSON.stringify(tolerance)};
    const handle = Array.from(document.querySelectorAll('.drag-handle'))
      .find(h => norm(h.textContent) === title);
    if (!handle) return false;
    const item = handle.closest('.react-grid-item');
    const grid = item?.closest('.react-grid-layout') || document.querySelector('.react-grid-layout');
    if (!item || !grid) return false;
    const ir = item.getBoundingClientRect();
    const gr = grid.getBoundingClientRect();
    const left = ir.left - gr.left;
    return Math.abs(left - expected) <= tol;
  })()`
  await waitFor(client, expr, { timeoutMs, label: `${label}: ${widgetTitle}` })
}

async function isButtonDisabledByTitle(client, titles) {
  const ts = Array.isArray(titles) ? titles : [titles]
  const expr = `(function(){
    const titles = ${JSON.stringify(ts)};
    const btn = titles.map(t => document.querySelector('button[title="' + CSS.escape(t) + '"]')).find(Boolean);
    if (!btn) return null;
    return !!btn.disabled;
  })()`
  return await client.evaluate(expr)
}

async function getGridRect(client) {
  const expr = `(function(){
    const grid = document.querySelector('.react-grid-layout');
    if (!grid) return { ok:false, error:'grid not found' };
    const r = grid.getBoundingClientRect();
    return { ok:true, rect: { left: r.left, top: r.top, width: r.width, height: r.height } };
  })()`
  const res = await client.evaluate(expr)
  if (!res?.ok) throw new Error(`Failed to get grid rect: ${res?.error || 'unknown'}`)
  return res.rect
}

async function main() {
  const runId = Date.now().toString(36)
  const outDir = path.join(process.cwd(), '.tmp-e2e-dashboard-draft', runId)
  await fs.mkdir(outDir, { recursive: true })

  const distDir = await ensureFrontendBuild({ outDir })
  const store = createDefaultMockStore()
  const originalId = store.originalDashboardId

  const origin = normalizeBaseUrl('http://localhost')

  const { proc: chromeProc } = launchChrome({ outDir })
  let pageClient = null
  const apiCalls = []
  const results = []
  const consoleEvents = []
  let fatalError = null
  try {
    const browserWs = await waitForDevtoolsEndpoint(chromeProc)
    const port = portFromWsUrl(browserWs)
    const target = await createTarget({ port, url: 'about:blank' })
    pageClient = new CDPClient(target.webSocketDebuggerUrl)
    await pageClient.connect()
    await pageClient.send('Page.enable')
    await pageClient.send('Runtime.enable')
    await pageClient.send('Network.enable')
    await pageClient.send('Fetch.enable', {
      patterns: [
        { urlPattern: 'http://*/*', requestStage: 'Request' },
        { urlPattern: 'https://*/*', requestStage: 'Request' },
      ],
    })

    const inflight = new Map()
    const fulfill = async ({ requestId, status, headers, body }) => {
      const buf = Buffer.isBuffer(body) ? body : Buffer.from(body || '', 'utf8')
      await pageClient.send('Fetch.fulfillRequest', {
        requestId,
        responseCode: status,
        responseHeaders: headersToCdpArray(headers),
        body: buf.toString('base64'),
      })
    }

    const fail = async ({ requestId }) => {
      await pageClient.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' })
    }

    pageClient.on('Fetch.requestPaused', async (params) => {
      const requestId = params.requestId
      const url = params.request?.url || ''
      const method = params.request?.method || 'GET'
      const headers = params.request?.headers || {}
      let postData = params.request?.postData
      if ((method !== 'GET' && method !== 'HEAD') && (postData === undefined || postData === null || postData === '')) {
        try {
          const got = await pageClient.send('Fetch.getRequestPostData', { requestId })
          postData = got?.postData ?? ''
        } catch {
          postData = ''
        }
      }
      postData = postData || ''

      const p = (async () => {
        try {
          const u = new URL(url)
          if (u.origin !== origin) {
            return await fail({ requestId })
          }

          const pathname = u.pathname || '/'
          if (pathname.startsWith('/api')) {
            const apiRes = await handleMockApiRequest({
              store,
              method,
              url,
              headers,
              body: postData,
            })

            let responseSnippet = ''
            let responseSummary = null
            try {
              responseSnippet = apiRes.body ? String(apiRes.body).slice(0, 800) : ''
              if (pathname.match(/^\/api\/dashboards\/[^/]+\/draft$/)) {
                const data = apiRes.body ? JSON.parse(String(apiRes.body)) : null
                const pickWidget = (name) => (data?.widgets || []).find(w => w?.name === name) || null
                const widgetA = pickWidget('Widget A')
                const widgetB = pickWidget('Widget B')
                responseSummary = {
                  dashboardId: data?.id,
                  is_draft: data?.is_draft,
                  draft_of: data?.draft_of,
                  widgetA: widgetA ? { id: widgetA.id, responsive_positions: widgetA.responsive_positions } : null,
                  widgetB: widgetB ? { id: widgetB.id, responsive_positions: widgetB.responsive_positions } : null,
                }
              } else if (pathname.match(/^\/api\/dashboards\/[^/]+$/) && method === 'GET') {
                const data = apiRes.body ? JSON.parse(String(apiRes.body)) : null
                responseSummary = {
                  dashboardId: data?.id,
                  is_draft: data?.is_draft,
                  draft_of: data?.draft_of,
                  widgetCount: Array.isArray(data?.widgets) ? data.widgets.length : null,
                }
              } else if (pathname.match(/^\/api\/dashboards\/[^/]+\/widgets\/batch$/)) {
                const data = apiRes.body ? JSON.parse(String(apiRes.body)) : null
                responseSummary = {
                  created: Array.isArray(data?.created) ? data.created.length : null,
                  updated: Array.isArray(data?.updated) ? data.updated.length : null,
                  deleted: Array.isArray(data?.deleted) ? data.deleted.length : null,
                }
              }
            } catch {
              responseSummary = null
            }

            apiCalls.push({
              ts: Date.now(),
              method,
              pathname,
              status: apiRes.status,
              bodyBytes: postData.length,
              bodySnippet: postData.length ? postData.slice(0, 500) : '',
              responseBytes: apiRes.body ? String(apiRes.body).length : 0,
              responseSnippet,
              responseSummary,
            })
            return await fulfill({ requestId, ...apiRes })
          }

          if (method !== 'GET' && method !== 'HEAD') {
            return await fulfill({
              requestId,
              status: 405,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
              body: 'Method Not Allowed',
            })
          }

          const wantsIndex = pathname === '/' || !isProbablyStaticAsset(pathname)
          if (wantsIndex) {
            const html = await fs.readFile(path.join(distDir, 'index.html'))
            return await fulfill({
              requestId,
              status: 200,
              headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
              body: method === 'HEAD' ? Buffer.from('') : html,
            })
          }

          const fullPath = safeJoin(distDir, pathname)
          let file
          try {
            file = await fs.readFile(fullPath)
          } catch {
            return await fulfill({
              requestId,
              status: 404,
              headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
              body: `Not found: ${pathname}`,
            })
          }
          return await fulfill({
            requestId,
            status: 200,
            headers: { 'Content-Type': mimeTypeForPath(pathname), 'Cache-Control': 'no-store' },
            body: method === 'HEAD' ? Buffer.from('') : file,
          })
        } catch (err) {
          return await fulfill({
            requestId,
            status: 500,
            headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
            body: `mock fulfill error: ${String(err?.message || err)}`,
          })
        }
      })()

      inflight.set(requestId, p)
      try { await p } finally { inflight.delete(requestId) }
    })

    // Ensure app starts authenticated.
    await pageClient.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `try { localStorage.setItem("token", "test-token"); } catch {}`,
    })

    const navigate = async (url) => {
      const done = new Promise((resolve) => {
        pageClient.on('Page.loadEventFired', () => resolve())
      })
      await pageClient.send('Page.navigate', { url })
      await Promise.race([done, delay(60_000)])
    }

    const dashboardUrl = `${origin}/dashboards/${originalId}`
    const record = (name, ok, error) => results.push({ name, ok, error: error ? String(error?.message || error) : null })

      const runStep = async (name, fn) => {
        try {
          await fn()
          record(name, true)
        } catch (err) {
          await screenshot(pageClient, path.join(outDir, `${name.replace(/[^a-z0-9_-]+/gi, '_')}.png`)).catch(() => {})
          record(name, false, err)
          throw err
        }
      }

      pageClient.on('Runtime.consoleAPICalled', (e) => {
        try {
          const args = (e.args || []).map(a => ('value' in a ? a.value : a.description)).join(' ')
          consoleEvents.push({ type: e.type, args })
        } catch {
          // ignore
        }
      })
      pageClient.on('Runtime.exceptionThrown', (e) => {
        try {
          consoleEvents.push({ type: 'exception', args: e.exceptionDetails?.text || 'exception' })
        } catch {
          // ignore
        }
      })

      await navigate(dashboardUrl)
      const afterNav = await pageClient.evaluate(`(function(){
        try {
          return {
            href: location.href,
            pathname: location.pathname,
            token: localStorage.getItem('token'),
            title: document.title,
            h1: document.querySelector('h1') ? document.querySelector('h1').textContent : null,
            bodyText: (document.body && (document.body.innerText || document.body.textContent) || '').slice(0, 800),
          };
        } catch (e) {
          return { error: String(e && e.message || e) };
        }
      })()`)
      await fs.writeFile(path.join(outDir, 'after_navigate.json'), JSON.stringify(afterNav, null, 2))
      await screenshot(pageClient, path.join(outDir, 'after_navigate.png')).catch(() => {})
      await waitFor(pageClient, `(function(){
        const norm = (s) => (s || '').replace(/\\s+/g,' ').trim();
        return Array.from(document.querySelectorAll('.drag-handle')).some(el => norm(el.textContent) === "Widget A");
      })()`, { label: 'dashboard loaded' })

      // 1) Enter edit mode
      let desktopBreakpoint = null
      await runStep('enter_edit_mode', async () => {
        await clickButtonByText(pageClient, ['Edit', '編集'])
        await waitFor(pageClient, `document.querySelector('button[title="Tablet"], button[title="タブレット"]') !== null`, { label: 'edit mode preview controls' })
        desktopBreakpoint = await getCurrentBreakpointLabel(pageClient)
        if (!desktopBreakpoint) throw new Error('Failed to detect desktop breakpoint')
      })

      // 2) Add widget
      const addedWidgetName = `Added Widget (${runId})`
      await runStep('add_widget', async () => {
        await clickButtonByText(pageClient, ['Add Widget', 'ウィジェット追加'])
        await waitForDialogOpen(pageClient, ['Add Widget', 'ウィジェット追加'])
        await setInputValueInDialog(pageClient, ['Add Widget', 'ウィジェット追加'], { placeholder: ['Widget name', 'ウィジェット名'], value: addedWidgetName })
        await waitForButtonInDialogEnabled(pageClient, ['Add Widget', 'ウィジェット追加'], ['Add Widget', 'ウィジェット追加'])
        await clickButtonInDialog(pageClient, ['Add Widget', 'ウィジェット追加'], ['Add Widget', 'ウィジェット追加'])
        await waitForDialogClosed(pageClient, ['Add Widget', 'ウィジェット追加'])
        await waitForWidgetTitle(pageClient, addedWidgetName)
      })

      // 3) Delete widget + Undo/Redo
      await runStep('delete_widget_undo_redo', async () => {
        await clickDeleteOnWidget(pageClient, addedWidgetName)
        await waitForWidgetAbsent(pageClient, addedWidgetName)

        await clickButtonByTitle(pageClient, ['Undo (Ctrl+Z)', '元に戻す (Ctrl+Z)'])
        await waitForWidgetTitle(pageClient, addedWidgetName)

        await clickButtonByTitle(pageClient, ['Redo (Ctrl+Shift+Z)', 'やり直し (Ctrl+Shift+Z)'])
        await waitForWidgetAbsent(pageClient, addedWidgetName)
      })

      // Layout baselines (two widgets)
      const desktopBefore = await getWidgetLayout(pageClient, 'Widget A')
      const desktopBeforeB = await getWidgetLayout(pageClient, 'Widget B')

      // 4) Move widget (desktop) + Undo/Redo
      let desktopAfter = null
      await runStep('move_widget_desktop', async () => {
        const a0 = await getWidgetLayout(pageClient, 'Widget A')
        const b0 = await getWidgetLayout(pageClient, 'Widget B')
        await dispatchDrag(pageClient, { start: a0.handleCenter, end: b0.handleCenter })
        const a1 = await getWidgetLayout(pageClient, 'Widget A')
        assertMoved(a0, a1, { axis: 'left', label: 'desktop left' })
        desktopAfter = a1

        const undoDisabled = await isButtonDisabledByTitle(pageClient, ['Undo (Ctrl+Z)', '元に戻す (Ctrl+Z)'])
        if (undoDisabled) throw new Error('Undo button is disabled after move')

        await clickButtonByTitle(pageClient, ['Undo (Ctrl+Z)', '元に戻す (Ctrl+Z)'])
        await waitForWidgetLeftApprox(pageClient, 'Widget A', desktopBefore.item.left, { label: 'desktop undo left' })

        const redoDisabled = await isButtonDisabledByTitle(pageClient, ['Redo (Ctrl+Shift+Z)', 'やり直し (Ctrl+Shift+Z)'])
        if (redoDisabled) throw new Error('Redo button is disabled after undo')

        await clickButtonByTitle(pageClient, ['Redo (Ctrl+Shift+Z)', 'やり直し (Ctrl+Shift+Z)'])
        await waitForWidgetLeftApprox(pageClient, 'Widget A', desktopAfter.item.left, { label: 'desktop redo left' })
      })

      // 5) Tablet preview adjust
      let tabletAfter = null
      await runStep('adjust_layout_tablet', async () => {
        await clickButtonByTitle(pageClient, ['Tablet', 'タブレット'])
        await waitFor(pageClient, `document.body.textContent.includes("(SM)")`, { timeoutMs: 30_000, label: 'tablet breakpoint' })
        await waitForGridWidthAtMost(pageClient, 850, { label: 'tablet preview width applied' })
        await delay(200)
        const grid = await getGridRect(pageClient)
        const a0 = await getWidgetLayout(pageClient, 'Widget A')
        const targetX = a0.item.left < grid.width / 2 ? grid.left + grid.width * 0.75 : grid.left + grid.width * 0.25
        const targetY = a0.item.top < grid.height * 0.25 ? grid.top + grid.height * 0.8 : grid.top + grid.height * 0.1
        await dispatchDrag(pageClient, { start: a0.handleCenter, end: { x: targetX, y: targetY } })
        const a1 = await getWidgetLayout(pageClient, 'Widget A')
        assertMovedAnyAxis(a0, a1, { label: 'tablet move' })
        tabletAfter = await getWidgetGridPosition(pageClient, 'Widget A')
      })

      // 6) Mobile preview adjust
      let mobileAfter = null
      await runStep('adjust_layout_mobile', async () => {
        await clickButtonByTitle(pageClient, ['Mobile', 'モバイル'])
        await waitFor(pageClient, `document.body.textContent.includes("(XS)")`, { timeoutMs: 30_000, label: 'mobile breakpoint' })
        await waitForGridWidthAtMost(pageClient, 500, { label: 'mobile preview width applied' })
        await delay(200)
        const grid = await getGridRect(pageClient)
        const a0 = await getWidgetLayout(pageClient, 'Widget A')
        const targetY = a0.item.top < grid.height * 0.25 ? grid.top + grid.height * 0.8 : grid.top + grid.height * 0.1
        const targetX = grid.left + grid.width * 0.5
        await dispatchDrag(pageClient, { start: a0.handleCenter, end: { x: targetX, y: targetY } })
        const a1 = await getWidgetLayout(pageClient, 'Widget A')
        assertMovedAnyAxis(a0, a1, { label: 'mobile move' })
        mobileAfter = await getWidgetGridPosition(pageClient, 'Widget A')
      })

      // 7) Save Draft and verify it clears dirty state
      await runStep('save_draft', async () => {
        await clickButtonByText(pageClient, ['Save Draft', '下書きを保存'])
        await waitFor(pageClient, `(function(){
          const norm = (s) => (s || '').replace(/\\s+/g,' ').trim();
          const texts = Array.from(document.querySelectorAll('button'))
            .map(b => norm(b.textContent))
            .filter(Boolean);
          // During save: "Saving..." is shown; after save: button disappears.
          return !texts.some(t => t === "Save Draft" || t === "Saving..." || t === "保存中...");
        })()`, { timeoutMs: 60_000, label: 'save draft completed (button gone)' })
        await waitFor(pageClient, `document.body.textContent.includes("Draft saved") || document.body.textContent.includes("Changes saved") || document.body.textContent.includes("変更を保存しました")`, { timeoutMs: 60_000, label: 'save toast' })
      })

      // Snapshot mock state after save (debugging for persistence)
      try {
        const draftId = store.draftByOriginal.get(originalId) || null
        const draft = draftId ? store.dashboards.get(draftId) : null
        const slim = (d) => d ? ({
          id: d.id,
          is_draft: !!d.is_draft,
          draft_of: d.draft_of,
          widgets: (d.widgets || []).map(w => ({
            id: w.id,
            name: w.name,
            position: w.position,
            responsive_positions: w.responsive_positions,
          })),
        }) : null
        await fs.writeFile(
          path.join(outDir, 'mock-state-after-save.json'),
          JSON.stringify({ original: slim(store.dashboards.get(originalId)), draft: slim(draft) }, null, 2)
        )
      } catch {
        // ignore
      }

      // 8) Reload & ensure draft persists when re-entering edit
      await runStep('persist_after_reload', async () => {
        await navigate(dashboardUrl)
        await waitFor(pageClient, `(function(){
          const norm = (s) => (s || '').replace(/\\s+/g,' ').trim();
          return Array.from(document.querySelectorAll('.drag-handle')).some(el => norm(el.textContent) === "Widget A");
        })()`, { label: 'dashboard loaded (after reload)' })
        await clickButtonByText(pageClient, ['Edit', '編集'])
        await waitFor(pageClient, `document.querySelector('button[title="Tablet"], button[title="タブレット"]') !== null`, { label: 'edit mode (after reload)' })
        if (desktopBreakpoint) {
          await waitFor(pageClient, `document.body.textContent.includes("(${desktopBreakpoint})")`, { timeoutMs: 30_000, label: `desktop breakpoint (after reload): ${desktopBreakpoint}` })
        }

        const aDesktop = await getWidgetLayout(pageClient, 'Widget A')
        assertApproxEqual(desktopAfter.item.left, aDesktop.item.left, { label: 'desktop persisted left' })

        await clickButtonByTitle(pageClient, ['Tablet', 'タブレット'])
        await waitFor(pageClient, `document.body.textContent.includes("(SM)")`, { timeoutMs: 30_000, label: 'tablet breakpoint (after reload)' })
        await waitForGridWidthAtMost(pageClient, 850, { label: 'tablet preview width applied (after reload)' })
        if (tabletAfter) {
          await waitForWidgetGridXY(pageClient, 'Widget A', tabletAfter, { timeoutMs: 20_000, label: 'tablet persisted grid' })
        }

        await clickButtonByTitle(pageClient, ['Mobile', 'モバイル'])
        await waitFor(pageClient, `document.body.textContent.includes("(XS)")`, { timeoutMs: 30_000, label: 'mobile breakpoint (after reload)' })
        await waitForGridWidthAtMost(pageClient, 500, { label: 'mobile preview width applied (after reload)' })
        if (mobileAfter) {
          await waitForWidgetGridXY(pageClient, 'Widget A', mobileAfter, { timeoutMs: 20_000, label: 'mobile persisted grid' })
        }
      })

      // 9) Discard changes and verify original restores
      await runStep('discard_restores_original', async () => {
        await clickButtonByText(pageClient, ['Discard', '破棄'])
        await waitForDialogOpen(pageClient, ['Discard changes?', '変更を破棄しますか?'])
        await clickButtonInDialog(pageClient, ['Discard changes?', '変更を破棄しますか?'], ['Discard changes', '変更を破棄'], { exact: false })
        await waitFor(pageClient, `document.querySelector('button[title="Tablet"], button[title="タブレット"]') === null`, { label: 'exited edit mode' })

        const aView = await getWidgetLayout(pageClient, 'Widget A')
        const bView = await getWidgetLayout(pageClient, 'Widget B')
        assertApproxEqual(desktopBefore.item.left, aView.item.left, { label: 'original Widget A left' })
        assertApproxEqual(desktopBeforeB.item.left, bView.item.left, { label: 'original Widget B left' })

        // Re-enter edit to ensure draft is gone (fresh draft == original layout)
        await clickButtonByText(pageClient, ['Edit', '編集'])
        await waitFor(pageClient, `document.querySelector('button[title="Tablet"], button[title="タブレット"]') !== null`, { label: 'edit mode (after discard)' })
        const aNewDraft = await getWidgetLayout(pageClient, 'Widget A')
        assertApproxEqual(desktopBefore.item.left, aNewDraft.item.left, { label: 'fresh draft Widget A left' })
      })

    } catch (err) {
      fatalError = err
      throw err
    } finally {
      try {
        if (!fatalError) {
          await fs.writeFile(path.join(outDir, 'results.json'), JSON.stringify({ runId, results }, null, 2))
        } else {
          await fs.writeFile(path.join(outDir, 'results.json'), JSON.stringify({ runId, results, fatalError: String(fatalError?.message || fatalError) }, null, 2))
        }
      } catch {}
      try { await fs.writeFile(path.join(outDir, 'api-calls.json'), JSON.stringify(apiCalls, null, 2)) } catch {}
      try { await fs.writeFile(path.join(outDir, 'console.json'), JSON.stringify(consoleEvents, null, 2)) } catch {}
      try { await pageClient?.close() } catch {}
      try { chromeProc.kill('SIGKILL') } catch {}
      // eslint-disable-next-line no-console
      console.log(path.join(outDir, 'results.json'))
    }
}

await main()
