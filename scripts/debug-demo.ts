#!/usr/bin/env node
/**
 * Debug a demo page using Playwright — streams console logs live.
 *
 * Usage:
 *   node scripts/debug-demo.ts [demo]        e.g. phase8-icons
 *   node scripts/debug-demo.ts phase8 --headed --snapshot
 *
 * Flags:
 *   --headed       Show browser window
 *   --port=N       Vite port (default 5174)
 *   --timeout=N    Exit after N ms (default: run until Ctrl+C)
 *   --snapshot     Save screenshot on exit
 */

import { chromium } from 'playwright'
import { spawn, type ChildProcess } from 'child_process'
import { createServer } from 'net'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// --- Args ---
const args = process.argv.slice(2)
const demo    = args.find(a => !a.startsWith('--')) ?? 'phase8-icons'
const headed  = args.includes('--headed')
const snapshot = args.includes('--snapshot')
const PORT    = parseInt(args.find(a => a.startsWith('--port='))?.split('=')[1] ?? '5174')
const TIMEOUT = args.find(a => a.startsWith('--timeout='))?.split('=')[1]
const url     = `http://localhost:${PORT}/${demo}/`

// --- Colours ---
const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  blue: '\x1b[34m', cyan: '\x1b[36m', yellow: '\x1b[33m',
  red: '\x1b[31m',  green: '\x1b[32m', grey: '\x1b[90m',
}

function fmt(type: string, text: string): string {
  const col: Record<string, string> = { log: C.reset, warn: C.yellow, error: C.red, info: C.cyan, debug: C.grey }
  const icon: Record<string, string> = { log: '·', warn: '⚠', error: '✖', info: 'ℹ', debug: '·' }
  const ts = new Date().toISOString().slice(11, 23)
  return `${C.dim}${ts}${C.reset} ${col[type] ?? C.reset}${icon[type] ?? '·'} ${text}${C.reset}`
}

// --- Port check ---
function isPortOpen(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const s = createServer()
    s.once('error', () => resolve(true))
    s.once('listening', () => { s.close(); resolve(false) })
    s.listen(port, '127.0.0.1')
  })
}

// --- Start Vite ---
function startVite(): Promise<ChildProcess> {
  console.log(`[debug-demo] Starting Vite on :${PORT}...`)
  const proc = spawn(
    'node_modules/.bin/vite',
    ['--config', 'vite.config.demo.ts', '--port', String(PORT)],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }
  )
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('Vite start timeout')), 15_000)
    proc.stdout!.on('data', (chunk: Buffer) => {
      const line = chunk.toString()
      if (line.includes('Local:') || line.includes('ready in')) { clearTimeout(t); res(proc) }
    })
    proc.stderr!.on('data', (c: Buffer) => process.stderr.write(c))
    proc.on('exit', code => { clearTimeout(t); rej(new Error(`Vite exited ${code}`)) })
  })
}

// --- Main ---
let viteProc: ChildProcess | null = null

const running = await isPortOpen(PORT)
if (!running) {
  viteProc = await startVite()
  console.log(`[debug-demo] Vite ready`)
} else {
  console.log(`[debug-demo] Using existing server on :${PORT}`)
}

console.log(`[debug-demo] Opening ${C.bold}${C.blue}${url}${C.reset}`)

const browser = await chromium.launch({
  headless: !headed,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-webgpu',
    '--ignore-gpu-blocklist',
  ],
})
const ctx     = await browser.newContext()
const page    = await ctx.newPage()

page.on('console',      msg => console.log(fmt(msg.type(), msg.text())))
page.on('pageerror',    err => console.error(fmt('error', `[PAGE ERROR] ${err.message}`)))
page.on('requestfailed', req => console.log(fmt('warn', `[NET FAIL] ${req.url()} — ${req.failure()?.errorText ?? '?'}`)))

await page.goto(url, { waitUntil: 'domcontentloaded' })
console.log(`[debug-demo] Page loaded — streaming logs (Ctrl+C to stop)\n`)

if (TIMEOUT) {
  await page.waitForTimeout(parseInt(TIMEOUT))
} else {
  await new Promise<void>(res => process.once('SIGINT', () => res()))
}

if (snapshot) {
  const file = resolve(ROOT, `debug-snapshot-${demo}-${Date.now()}.png`)
  await page.screenshot({ path: file })
  console.log(`\n[debug-demo] Screenshot → ${file}`)
}

await browser.close()
viteProc?.kill()
process.exit(0)
