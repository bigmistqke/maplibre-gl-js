#!/usr/bin/env node
/**
 * Debug client — talks to debug-browser.ts over HTTP.
 * Run debug-browser.ts first in your terminal, then Claude uses this.
 *
 * Usage:
 *   node scripts/debug-demo.ts [demo]        e.g. phase8-icons
 *   node scripts/debug-demo.ts phase8-icons --timeout=5000 --snapshot
 *
 * Flags:
 *   --port=N       Vite port (default 5174)
 *   --server=N     Browser server port (default 7357)
 *   --timeout=N    Exit after N ms (default: run until Ctrl+C)
 *   --snapshot     Save screenshot on exit
 */

const args = process.argv.slice(2)
const demo        = args.find(a => !a.startsWith('--')) ?? 'phase8-icons'
const PORT        = parseInt(args.find(a => a.startsWith('--port='))?.split('=')[1] ?? '5174')
const SERVER_PORT = parseInt(args.find(a => a.startsWith('--server='))?.split('=')[1] ?? '7357')
const TIMEOUT     = args.find(a => a.startsWith('--timeout='))?.split('=')[1]
const snapshot    = args.includes('--snapshot')
const url         = `http://localhost:${PORT}/${demo}/`
const base        = `http://127.0.0.1:${SERVER_PORT}`

// --- Colours ---
const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  blue: '\x1b[34m', cyan: '\x1b[36m', yellow: '\x1b[33m',
  red: '\x1b[31m',  green: '\x1b[32m', grey: '\x1b[90m',
}

function fmt(type: string, text: string): string {
  const col: Record<string, string> = { log: C.reset, warn: C.yellow, error: C.red, pageerror: C.red, info: C.cyan, debug: C.grey, requestfailed: C.yellow }
  const icon: Record<string, string> = { log: '·', warn: '⚠', error: '✖', pageerror: '✖', info: 'ℹ', debug: '·', requestfailed: '⚠' }
  const ts = new Date().toISOString().slice(11, 23)
  return `${C.dim}${ts}${C.reset} ${col[type] ?? C.reset}${icon[type] ?? '·'} ${text}${C.reset}`
}

// --- Check server ---
try {
  const statusRes = await fetch(`${base}/status`)
  const { vitePort } = await statusRes.json() as { ok: boolean; vitePort: number }
  console.log(`[debug-demo] Browser server ready (Vite on :${vitePort})`)
} catch {
  console.error(`[debug-demo] Browser server not running on :${SERVER_PORT}`)
  console.error(`[debug-demo] Start it first: node scripts/debug-browser.ts`)
  process.exit(1)
}

// --- Connect SSE first, then navigate ---
console.log(`[debug-demo] Opening ${C.bold}${C.blue}${url}${C.reset}`)

const abort = new AbortController()
const logsRes = await fetch(`${base}/logs`, { signal: abort.signal })
const reader = logsRes.body!.getReader()
const decoder = new TextDecoder()
let sseBuffer = ''

// Navigate after SSE is connected
await fetch(`${base}/navigate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url }),
})

console.log(`[debug-demo] Streaming logs (Ctrl+C to stop)\n`)

if (TIMEOUT) setTimeout(() => abort.abort(), parseInt(TIMEOUT))
process.on('SIGINT', () => abort.abort())

try {
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    sseBuffer += decoder.decode(value, { stream: true })
    const lines = sseBuffer.split('\n')
    sseBuffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const ev = JSON.parse(line.slice(6))
        if (ev.type === 'connected' || ev.type === 'navigate') continue
        console.log(fmt(ev.type, ev.text))
      } catch {}
    }
  }
} catch (e: any) {
  if (e?.name !== 'AbortError') throw e
}

if (snapshot) {
  const snapRes = await fetch(`${base}/snapshot`)
  const buf = Buffer.from(await snapRes.arrayBuffer())
  const file = `debug-snapshot-${demo}-${Date.now()}.png`
  await import('fs').then(fs => fs.writeFileSync(file, buf))
  console.log(`\n[debug-demo] Screenshot → ${file}`)
}

process.exit(0)
