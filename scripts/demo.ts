#!/usr/bin/env node
/**
 * CLI for controlling demos via the debug-browser Playwright bridge.
 *
 * Requires debug-browser.ts running in a separate terminal:
 *   node scripts/debug-browser.ts
 *
 * Commands:
 *   demo open <name>                       Navigate to a demo
 *   demo screenshot [label]                Save screenshot with descriptive name
 *   demo eval <expr>                       Evaluate JS in the browser
 *   demo camera                            Print current camera state
 *   demo zoom <level>                      Set zoom level instantly
 *   demo zoom <from> <to> [--duration ms]  Animate zoom using rAF
 *   demo center <lng> <lat>                Set map center
 */

import { Command } from 'commander'
import { resolve } from 'path'
import { writeFileSync, mkdirSync } from 'fs'

const SERVER_PORT = parseInt(process.env.DEMO_SERVER_PORT ?? '7357')
const base = `http://127.0.0.1:${SERVER_PORT}`

// Track current demo name for screenshot filenames
let currentDemo = 'unknown'

const SCREENSHOT_DIR = resolve('screenshots')

async function checkServer(): Promise<{ vitePort: number }> {
  try {
    const res = await fetch(`${base}/status`)
    return await res.json() as { ok: boolean; vitePort: number }
  } catch {
    console.error('Browser server not running on :' + SERVER_PORT)
    console.error('Start it first: node scripts/debug-browser.ts')
    process.exit(1)
  }
}

async function evalExpr(expr: string): Promise<any> {
  const res = await fetch(`${base}/eval`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expr }),
  })
  return res.json()
}

async function navigate(url: string): Promise<void> {
  await fetch(`${base}/navigate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
}

async function detectCurrentDemo(): Promise<void> {
  try {
    const result = await evalExpr('document.title')
    if (result.ok && typeof result.value === 'string') {
      // Extract demo name from title like "Phase 9 — Placement"
      const match = result.value.match(/Phase\s*(\d+\S*)/i)
      if (match) {
        currentDemo = 'phase' + match[1].toLowerCase()
        return
      }
    }
  } catch {}
  // Fallback: try URL
  try {
    const result = await evalExpr('location.pathname')
    if (result.ok && typeof result.value === 'string') {
      const parts = result.value.replace(/^\/|\/$/g, '').split('/')
      if (parts.length > 0 && parts[0]) {
        currentDemo = parts[0]
        return
      }
    }
  } catch {}
}

async function takeScreenshot(label?: string): Promise<string> {
  const res = await fetch(`${base}/snapshot`)
  const buf = Buffer.from(await res.arrayBuffer())
  mkdirSync(SCREENSHOT_DIR, { recursive: true })
  const slug = label ? `-${label}` : ''
  const name = `${currentDemo}${slug}.png`
  const abs = resolve(SCREENSHOT_DIR, name)
  writeFileSync(abs, buf)
  return abs
}

const program = new Command()
program.name('demo').description('Control demos via the debug-browser Playwright bridge')

program
  .command('open <name>')
  .description('Navigate to a demo (e.g. phase9, phase8-icons)')
  .option('--wait <ms>', 'Wait after navigation before returning', '3000')
  .action(async (name: string, opts: { wait: string }) => {
    const { vitePort } = await checkServer()
    const url = `http://localhost:${vitePort}/${name}/`
    currentDemo = name
    console.log(`Opening ${url}`)
    await navigate(url)
    await new Promise(r => setTimeout(r, parseInt(opts.wait)))
    console.log('Ready')
  })

program
  .command('screenshot [label]')
  .description('Save a screenshot. Label is used in filename: <demo>-<label>.png')
  .action(async (label?: string) => {
    await checkServer()
    await detectCurrentDemo()
    const abs = await takeScreenshot(label)
    console.log(abs)
  })

program
  .command('eval <expr>')
  .description('Evaluate JavaScript in the browser page')
  .action(async (expr: string) => {
    await checkServer()
    const result = await evalExpr(expr)
    if (result.ok) {
      if (result.value !== undefined && result.value !== 'undefined') {
        console.log(JSON.stringify(result.value, null, 2))
      }
    } else {
      console.error('Error:', result.error)
      process.exit(1)
    }
  })

program
  .command('camera')
  .description('Print current camera state')
  .action(async () => {
    await checkServer()
    const result = await evalExpr('__map.getCamera()')
    if (result.ok) {
      console.log(JSON.stringify(result.value, null, 2))
    } else {
      console.error('Error:', result.error)
      process.exit(1)
    }
  })

program
  .command('zoom <from> [to]')
  .description('Set zoom instantly, or animate from→to over duration')
  .option('-d, --duration <ms>', 'Animation duration in ms', '1000')
  .option('-s, --screenshot', 'Take screenshot after zoom completes')
  .action(async (from: string, to: string | undefined, opts: { duration: string; screenshot?: boolean }) => {
    await checkServer()
    await detectCurrentDemo()

    if (to === undefined) {
      // Instant zoom
      const level = parseFloat(from)
      const result = await evalExpr(`__map.setCamera({ zoom: ${level} })`)
      if (!result.ok) { console.error('Error:', result.error); process.exit(1) }
      console.log(`Zoom set to ${level}`)
      if (opts.screenshot) {
        await new Promise(r => setTimeout(r, 500))
        const abs = await takeScreenshot(`zoom${level}`)
        console.log(abs)
      }
      return
    }

    // Animated zoom: runs a rAF loop inside the browser
    const fromZ = parseFloat(from)
    const toZ = parseFloat(to)
    const duration = parseInt(opts.duration)

    console.log(`Animating zoom ${fromZ} → ${toZ} over ${duration}ms`)

    const animExpr = `
      new Promise(resolve => {
        const from = ${fromZ}, to = ${toZ}, dur = ${duration}
        __map.setCamera({ zoom: from })
        const start = performance.now()
        function tick(now) {
          const t = Math.min((now - start) / dur, 1)
          const ease = t * (2 - t)  // ease-out quad
          __map.setCamera({ zoom: from + (to - from) * ease })
          if (t < 1) requestAnimationFrame(tick)
          else resolve('done')
        }
        requestAnimationFrame(tick)
      })
    `

    const result = await evalExpr(animExpr)
    if (!result.ok) { console.error('Error:', result.error); process.exit(1) }
    console.log(`Zoom animated to ${toZ}`)

    if (opts.screenshot) {
      await new Promise(r => setTimeout(r, 500))
      const abs = await takeScreenshot(`zoom${fromZ}to${toZ}`)
      console.log(abs)
    }
  })

program
  .command('center <lng> <lat>')
  .description('Set map center')
  .action(async (lng: string, lat: string) => {
    await checkServer()
    const result = await evalExpr(`__map.setCamera({ center: { lng: ${parseFloat(lng)}, lat: ${parseFloat(lat)} } })`)
    if (!result.ok) { console.error('Error:', result.error); process.exit(1) }
    console.log(`Center set to ${lng}, ${lat}`)
  })

program
  .command('logs')
  .description('Stream browser console logs (includes worker logs)')
  .option('-d, --duration <ms>', 'Stop after N ms', '5000')
  .option('-f, --filter <text>', 'Only show logs containing this text')
  .option('--json', 'Output raw JSON per line (for piping)')
  .action(async (opts: { duration: string; filter?: string; json?: boolean }) => {
    await checkServer()
    const duration = parseInt(opts.duration)
    const filter = opts.filter
    const abort = new AbortController()

    const res = await fetch(`${base}/logs`, { signal: abort.signal })
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buf = ''

    setTimeout(() => abort.abort(), duration)

    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const ev = JSON.parse(line.slice(6))
            if (ev.type === 'connected' || ev.type === 'navigate') continue
            // Extract clean text (strip console formatting directives)
            let text: string = ev.text ?? ''
            text = text.replace(/%c/g, '').replace(/color:[^;]*;?/g, '').replace(/font-weight:[^;]*;?/g, '').trim()
            if (filter && !text.includes(filter)) continue
            if (opts.json) {
              console.log(JSON.stringify({ type: ev.type, text }))
            } else {
              console.log(text)
            }
          } catch {}
        }
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') throw e
    }
  })

program.parse()
