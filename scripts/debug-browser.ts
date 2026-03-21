#!/usr/bin/env node
/**
 * Playwright browser server — run this ONCE in your terminal (outside Claude's sandbox).
 * Claude talks to it via HTTP on localhost:7357.
 *
 * Usage:
 *   node scripts/debug-browser.ts [--port=N] [--vite-port=N] [--headed]
 */

import { chromium } from 'playwright'
import { spawn, type ChildProcess } from 'child_process'
import { createServer as createNetServer } from 'net'
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'http'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const args = process.argv.slice(2)
const SERVER_PORT = parseInt(args.find(a => a.startsWith('--port='))?.split('=')[1] ?? '7357')
const VITE_PORT   = parseInt(args.find(a => a.startsWith('--vite-port='))?.split('=')[1] ?? '5174')
const headed      = args.includes('--headed')

// --- SSE clients ---
const sseClients = new Set<ServerResponse>()

function broadcast(event: object) {
  const data = `data: ${JSON.stringify(event)}\n\n`
  for (const res of sseClients) res.write(data)
}

// --- Port check ---
function isPortOpen(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const s = createNetServer()
    s.once('error', () => resolve(true))
    s.once('listening', () => { s.close(); resolve(false) })
    s.listen(port, '127.0.0.1')
  })
}

// --- Start Vite ---
async function startVite(): Promise<ChildProcess> {
  console.log(`[browser] Starting Vite on :${VITE_PORT}...`)
  const proc = spawn(
    'node_modules/.bin/vite',
    ['--config', 'vite.config.demo.ts', '--port', String(VITE_PORT)],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }
  )
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('Vite start timeout')), 15_000)
    proc.stdout!.on('data', (chunk: Buffer) => {
      if (chunk.toString().includes('Local:') || chunk.toString().includes('ready in')) {
        clearTimeout(t); res(proc)
      }
    })
    proc.stderr!.on('data', (c: Buffer) => process.stderr.write(c))
    proc.on('exit', code => { clearTimeout(t); rej(new Error(`Vite exited ${code}`)) })
  })
}

// --- Start browser ---
const browser = await chromium.launch({
  headless: !headed,
  args: [
    '--ignore-gpu-blocklist',
    '--enable-webgl',
    '--enable-unsafe-webgpu',
    '--use-gl=angle',
    '--use-angle=swiftshader',
  ],
})
const ctx = await browser.newContext()
let page = await ctx.newPage()

page.on('console', msg => {
  const ev = { type: msg.type(), text: msg.text(), time: new Date().toISOString() }
  process.stdout.write(`  [${ev.type}] ${ev.text}\n`)
  broadcast(ev)
})
page.on('pageerror', err => {
  const ev = { type: 'pageerror', text: err.message, time: new Date().toISOString() }
  process.stdout.write(`  [pageerror] ${ev.text}\n`)
  broadcast(ev)
})
page.on('requestfailed', req => {
  const ev = { type: 'requestfailed', text: `${req.url()} — ${req.failure()?.errorText ?? '?'}`, time: new Date().toISOString() }
  process.stdout.write(`  [netfail] ${ev.text}\n`)
  broadcast(ev)
})

// --- Start Vite if needed ---
const viteRunning = await isPortOpen(VITE_PORT)
let viteProc: ChildProcess | null = null
if (!viteRunning) {
  viteProc = await startVite()
  console.log(`[browser] Vite ready on :${VITE_PORT}`)
} else {
  console.log(`[browser] Vite already running on :${VITE_PORT}`)
}

// --- HTTP server ---
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((res, rej) => {
    let body = ''
    req.on('data', c => body += c)
    req.on('end', () => res(body))
    req.on('error', rej)
  })
}

const http = createHttpServer(async (req, res) => {
  const url = req.url ?? '/'

  if (url === '/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, vitePort: VITE_PORT }))
    return
  }

  if (url === '/navigate' && req.method === 'POST') {
    try {
      const body = JSON.parse(await readBody(req))
      const target: string = body.url
      console.log(`[browser] Navigating to ${target}`)
      broadcast({ type: 'navigate', text: target, time: new Date().toISOString() })
      await page.goto(target, { waitUntil: 'domcontentloaded' })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
    } catch (e: any) {
      console.error(`[browser] Navigate error: ${e.message}`)
      broadcast({ type: 'error', text: `[navigate] ${e.message}`, time: new Date().toISOString() })
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: e.message }))
    }
    return
  }

  if (url === '/logs' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    })
    res.write(`data: ${JSON.stringify({ type: 'connected', time: new Date().toISOString() })}\n\n`)
    sseClients.add(res)
    req.on('close', () => sseClients.delete(res))
    return
  }

  if (url === '/snapshot' && req.method === 'GET') {
    const buf = await page.screenshot()
    res.writeHead(200, { 'Content-Type': 'image/png' })
    res.end(buf)
    return
  }

  res.writeHead(404)
  res.end('Not found')
})

http.listen(SERVER_PORT, '127.0.0.1', () => {
  console.log(`[browser] Server ready on http://127.0.0.1:${SERVER_PORT}`)
  console.log(`[browser] Waiting for navigate commands...`)
})

async function shutdown() {
  await browser.close()
  viteProc?.kill()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
