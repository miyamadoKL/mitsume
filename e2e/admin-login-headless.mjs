import { spawn } from 'node:child_process'
import process from 'node:process'

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function launchChrome() {
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
    '--window-size=1280,720',
    '--lang=en-US',
    'about:blank',
  ]
  const proc = spawn('google-chrome', args, { stdio: ['ignore', 'ignore', 'pipe'] })
  return proc
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

function portFromWsUrl(wsUrl) {
  const u = new URL(wsUrl)
  return Number(u.port)
}

async function createTarget({ port, url }) {
  const newUrl = `http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`
  const res = await fetchJson(newUrl, { method: 'PUT' })
  if (!res.webSocketDebuggerUrl) throw new Error('Failed to create target')
  return res.webSocketDebuggerUrl
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
        if (msg.error) entry.reject(new Error(msg.error.message || 'CDP error'))
        else entry.resolve(msg.result)
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

  async close() {
    if (!this.ws) return
    this.ws.close()
    this.ws = null
  }
}

async function main() {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:8080'
  const username = process.env.MITSUME_ADMIN_USERNAME || 'admin'
  const password = process.env.MITSUME_ADMIN_PASSWORD || 'test'

  const chrome = launchChrome()
  let exitCode = 0

  try {
    const rootWs = await waitForDevtoolsEndpoint(chrome)
    const port = portFromWsUrl(rootWs)
    const pageWs = await createTarget({ port, url: `${frontendUrl}/login` })
    const cdp = new CDPClient(pageWs)
    await cdp.connect()

    await cdp.send('Page.enable')
    await cdp.send('Runtime.enable')

    await cdp.send('Page.navigate', { url: `${frontendUrl}/login` })
    await new Promise((resolve) => {
      const handler = () => resolve()
      cdp.on('Page.loadEventFired', handler)
    })

    const expr = `(async function(){
      const res = await fetch(${JSON.stringify(`${backendUrl}/api/auth/login`)}, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ${JSON.stringify(username)}, password: ${JSON.stringify(password)} }),
      });
      const text = await res.text();
      return { status: res.status, body: text };
    })()`

    const evalRes = await cdp.send('Runtime.evaluate', {
      expression: expr,
      awaitPromise: true,
      returnByValue: true,
    })

    const value = evalRes?.result?.value
    console.log(JSON.stringify({ frontendUrl, backendUrl, username, status: value?.status, body: value?.body }, null, 2))

    await cdp.close()
  } catch (err) {
    exitCode = 1
    console.error(String(err?.stack || err))
  } finally {
    chrome.kill('SIGKILL')
  }

  process.exit(exitCode)
}

await main()

